/**
 * morph.rename -- renames a symbol and every reference to it across the
 * project through the TypeScript language service, then saves and runs the
 * import check.
 *
 *   npx tsx scripts/morph/morph.rename.ts <file-or-folder> <name> <newName> [--every] [--line <n>] [--dry] [--root <project-root>]
 *
 * WHAT IS RENAMED. In a file, `<name>` is first looked for as a top-level
 * declaration; `Container.member` names a member of an interface, class, enum or
 * type alias. A name that is not top-level is looked for as a
 * LOCAL: a variable, a function, a class, a parameter (a function type's
 * included) or a destructured binding, at any depth. A folder searches every
 * project file under it the same way.
 *
 * Each declaration is its own symbol, renamed with its own references. One
 * found: it is renamed. Several found (a parameter of the same name in many
 * functions): nothing is renamed and they are listed, until `--every` takes them
 * all or `--line <n>` takes the one declared on that line of the file.
 *
 * REFUSED: a rename whose new name is already declared in a file it would
 * change. A reference could then bind to the other declaration with no type
 * error to show it.
 *
 * Shorthand properties and destructuring keep their shape (`{ old }` becomes
 * `{ newName: old }` or `{ old: newName }`), so object keys that leave the
 * module never silently change. Strings and comments are not touched; the
 * command lists the string-literal and the comment mentions so they can be
 * changed by hand.
 *
 * Exit 0 done, 1 unresolved imports after save, 2 usage error or refusal.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { Node, SyntaxKind, type SourceFile } from 'ts-morph';
import {
  DEFAULT_UI_ROOT, fail, findNamedDeclaration, loadProject, rel, reportImportCheck, resolveUserPath,
} from './morph.project.ts';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    every: { type: 'boolean', default: false },
    line: { type: 'string' },
    dry: { type: 'boolean', default: false },
    root: { type: 'string', default: DEFAULT_UI_ROOT },
  },
});
const [where, name, newName] = positionals;
if (!where || !name || !newName) {
  process.stderr.write('usage: morph.rename.ts <file-or-folder> <name> <newName> [--every] [--line <n>] [--dry]\n');
  process.exit(2);
}
if (!/^[A-Za-z_$][\w$]*$/.test(newName)) fail(`'${newName}' is not an identifier`);

const ctx = loadProject(resolveUserPath(process.cwd(), values.root));
const target = resolveUserPath(ctx.uiRoot, where);
const isFolder = fs.existsSync(target) && fs.statSync(target).isDirectory();
const inScope = (sf: SourceFile): boolean => {
  const p = sf.getFilePath();
  if (p.includes('/node_modules/')) return false;
  return isFolder ? p.startsWith(target + path.sep) : path.resolve(p) === path.resolve(target);
};
const files = ctx.project.getSourceFiles().filter(inScope);
if (files.length === 0) fail(`${rel(ctx.uiRoot, target)} holds no file of the tsconfig project`);

const leaf = name.split('.').pop() as string;
const here = (node: Node): string => `${rel(ctx.uiRoot, node.getSourceFile().getFilePath())}:${node.getStartLineNumber()}`;

/** The kinds a local of a given name is declared by. A property is not one: it is addressed as `Container.member`. */
function declaresLocal(node: Node): boolean {
  return Node.isVariableDeclaration(node) || Node.isParameterDeclaration(node) || Node.isBindingElement(node)
    || Node.isFunctionDeclaration(node) || Node.isFunctionExpression(node) || Node.isClassDeclaration(node)
    || Node.isClassExpression(node);
}

/** The name nodes of every declaration of `wanted` in `sf`, at any depth, in source order. */
function localNameNodes(sf: SourceFile, wanted: string): Node[] {
  return sf.getDescendantsOfKind(SyntaxKind.Identifier)
    .filter((id) => {
      if (id.getText() !== wanted) return false;
      const parent = id.getParent();
      return declaresLocal(parent) && Node.hasName(parent) && parent.getNameNode() === id;
    });
}

/** The declarations to rename: one top-level declaration of a file, else every local of the name in scope. */
function findTargets(): Node[] {
  if (!isFolder) {
    const top = findNamedDeclaration(files[0], name);
    if (top && Node.hasName(top)) return [top.getNameNode()];
  }
  if (name.includes('.')) fail(`no member '${name}' in ${rel(ctx.uiRoot, target)}`);
  return files.flatMap((sf) => localNameNodes(sf, name));
}

let targets = findTargets();
if (targets.length === 0) fail(`no declaration '${name}' in ${rel(ctx.uiRoot, target)}`);
if (values.line !== undefined) {
  const line = Number(values.line);
  targets = targets.filter((node) => node.getStartLineNumber() === line);
  if (targets.length !== 1) fail(`${targets.length} declaration(s) of '${name}' on line ${values.line} of ${rel(ctx.uiRoot, target)}`);
}
if (targets.length > 1 && !values.every) {
  process.stdout.write(`rename: '${name}' is declared ${targets.length} times in ${rel(ctx.uiRoot, target)}; nothing renamed. Take all with --every, or one with --line <n>:\n`);
  for (const node of targets) process.stdout.write(`  ${here(node)}  ${node.getParentOrThrow().getKindName()}\n`);
  process.exit(2);
}

const refsOf = (node: Node): Node[] => (Node.isReferenceFindable(node) ? node.findReferencesAsNodes() : [])
  .filter((r) => !r.getSourceFile().getFilePath().includes('/node_modules/'));

// What the rename will touch, read before anything is changed.
const touched = new Map<string, number>();
for (const node of targets) {
  if (!Node.isRenameable(node)) fail(`'${name}' at ${here(node)} cannot be renamed`);
  for (const r of [node, ...refsOf(node)]) {
    const f = rel(ctx.uiRoot, r.getSourceFile().getFilePath());
    touched.set(f, (touched.get(f) ?? 0) + 1);
  }
}
const clashes = [...touched.keys()].flatMap((f) => {
  const sf = ctx.project.getSourceFileOrThrow(path.join(ctx.uiRoot, f));
  const top = name.includes('.') ? [] : sf.getStatements().flatMap((s): Node[] => (Node.isVariableStatement(s) ? s.getDeclarations() : [s]))
    .filter((s) => Node.hasName(s) && s.getName() === newName).map((s) => (Node.hasName(s) ? s.getNameNode() : s));
  return [...new Set([...top, ...(name.includes('.') ? [] : localNameNodes(sf, newName))])];
});
if (clashes.length > 0) {
  process.stdout.write(`rename: REFUSED, '${newName}' is already declared where the rename would reach:\n`);
  for (const node of clashes) process.stdout.write(`  ${here(node)}\n`);
  process.exit(2);
}

const mentionsOf = (kind: 'string' | 'comment'): string[] => ctx.project.getSourceFiles()
  .filter((s) => !s.getFilePath().includes('/node_modules/'))
  .flatMap((s) => {
    if (kind === 'string') {
      return s.getDescendantsOfKind(SyntaxKind.StringLiteral)
        .filter((l) => l.getLiteralValue() === leaf)
        .map((l) => `${rel(ctx.uiRoot, s.getFilePath())}:${l.getStartLineNumber()}`);
    }
    if (!touched.has(rel(ctx.uiRoot, s.getFilePath()))) return [];
    const word = new RegExp(`(^|[^\\w$])${leaf.replace(/[$]/g, '\\$')}([^\\w$]|$)`);
    return s.getFullText().split('\n')
      .map((text, i) => ({ text, line: i + 1 }))
      .filter(({ text }) => /^\s*(\/\/|\/\*|\*)/.test(text) && word.test(text))
      .map(({ line }) => `${rel(ctx.uiRoot, s.getFilePath())}:${line}`);
  });
const stringMentions = mentionsOf('string');
const commentMentions = mentionsOf('comment');

const count = [...touched.values()].reduce((a, b) => a + b, 0);
process.stdout.write(`rename: ${name} -> ${newName}: ${targets.length} declaration(s), ${count - targets.length} reference(s) in ${touched.size} file(s)${values.dry ? ' [dry run]' : ''}\n`);
for (const [f, n] of [...touched.entries()].sort()) process.stdout.write(`  ${f}  (${n})\n`);
if (stringMentions.length) {
  process.stdout.write(`string-literal mentions NOT renamed (${stringMentions.length}); change them by hand:\n`);
  for (const m of stringMentions) process.stdout.write(`  ${m}\n`);
}
if (commentMentions.length) {
  process.stdout.write(`comment lines that name it, NOT changed (${commentMentions.length}); reword them by hand:\n`);
  for (const m of commentMentions) process.stdout.write(`  ${m}\n`);
}
if (values.dry) process.exit(0);

// A rename rewrites its files, so the next declaration is found again each time: once renamed it no longer matches.
const firstLeft = (): Node | undefined => {
  if (targets.length === 1) return undefined;
  for (const sf of ctx.project.getSourceFiles().filter(inScope)) {
    const left = localNameNodes(sf, name)[0];
    if (left) return left;
  }
  return undefined;
};
const renameOne = (node: Node): void => {
  if (!Node.isRenameable(node)) fail(`'${name}' at ${here(node)} cannot be renamed`);
  node.rename(newName, { usePrefixAndSuffixText: true, renameInComments: false, renameInStrings: false });
};
if (targets.length === 1) {
  renameOne(targets[0]);
} else {
  for (let node = firstLeft(); node; node = firstLeft()) renameOne(node);
}

const changed = ctx.project.getSourceFiles().filter((s) => !s.isSaved());
await ctx.project.save();
process.stdout.write(`saved ${changed.length} file(s)\n`);
process.exit(reportImportCheck(ctx));
