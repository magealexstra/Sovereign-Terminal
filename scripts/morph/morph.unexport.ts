/**
 * morph.unexport -- drops an `export` nothing outside its own file reads, each one confirmed by the type checker
 * first, then saves and runs the import check.
 *
 *   npx tsx scripts/morph/morph.unexport.ts <name> --file <file> [--dry] [--root <project-root>]
 *   npx tsx scripts/morph/morph.unexport.ts --list <listing> [--dry] [--root <project-root>]
 *
 * `--list` reads lines of the form `name | path` (a leading dash, backticks, a `(type)` mark and a `:line` are
 * allowed, so the lines of `npm run dead` can be given as they are); other lines are ignored.
 *
 * Two shapes are handled, and nothing else is ever edited:
 *  - A DECLARATION exported from its file (`export const`, `function`, `type`, `interface`, `class`, `enum`): the
 *    `export` keyword is removed when every reference is in that file and at least one is a use. A name with no
 *    use at all is refused: it is dead, and without its `export` it would stop the build as an unused local.
 *  - A RE-EXPORTED NAME in an export list (`export { a, b } from './x'`, `export type { T }`): the name is removed
 *    from the list when no file takes it through this file. A list that would be left empty goes with its last
 *    name only when that cannot change what is loaded: a type-only list, or a file the same file imports elsewhere.
 *    Otherwise the names stay and are reported, since removing the statement would stop this file loading that one.
 *    A removed list takes the comment above it with it, except a file's first statement: the comment above that
 *    one is the file's header and stays.
 *
 * Every refusal is printed with its reason. Exit 0 done, 1 unresolved imports after save, 2 usage error.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { Node, type ExportDeclaration, type ExportSpecifier, type SourceFile } from 'ts-morph';
import {
  DEFAULT_UI_ROOT, collectImportSites, loadProject, rel, reportImportCheck, resolveSpecifier, resolveUserPath,
  type MorphContext,
} from './morph.project.ts';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    file: { type: 'string' },
    list: { type: 'string' },
    dry: { type: 'boolean', default: false },
    root: { type: 'string', default: DEFAULT_UI_ROOT },
  },
});

interface Candidate {
  name: string;
  file: string;
}

function readCandidates(): Candidate[] {
  if (values.list) {
    const out: Candidate[] = [];
    for (const line of fs.readFileSync(values.list, 'utf8').split('\n')) {
      const m = /^\s*(?:-\s*)?`?([A-Za-z_$][\w$]*)`?(?:\s*\(type\))?\s*\|\s*(\S+?)(?::\d+)?\s*$/.exec(line);
      if (m) out.push({ name: m[1], file: m[2] });
    }
    return out;
  }
  if (positionals[0] && values.file) return [{ name: positionals[0], file: values.file }];
  process.stderr.write('usage: morph.unexport.ts <name> --file <file> [--dry]  |  morph.unexport.ts --list <listing> [--dry]\n');
  process.exit(2);
}

const ctx: MorphContext = loadProject(resolveUserPath(process.cwd(), values.root));
const candidates = readCandidates();
const done: string[] = [];
const refused: string[] = [];
const refuse = (c: Candidate, reason: string): void => { refused.push(`REFUSED ${c.name} | ${c.file} | ${reason}`); };

function sourceOf(c: Candidate): SourceFile | undefined {
  return ctx.project.getSourceFile(resolveUserPath(ctx.uiRoot, c.file));
}

function ownRefs(node: Node): Node[] {
  if (!Node.isReferenceFindable(node)) return [];
  return node.findReferencesAsNodes().filter((r) => r !== node && !r.getSourceFile().getFilePath().includes('/node_modules/'));
}

/** The specifier that exports `name` from `sf` through an export list, with its statement. */
function specifierOf(sf: SourceFile, name: string): { spec: ExportSpecifier; decl: ExportDeclaration } | undefined {
  for (const decl of sf.getExportDeclarations()) {
    for (const spec of decl.getNamedExports()) {
      if ((spec.getAliasNode()?.getText() ?? spec.getNameNode().getText()) === name) return { spec, decl };
    }
  }
  return undefined;
}

/** Why `name` cannot leave `sf`'s export list: a file that takes it through `sf`, or could. Undefined when none. */
function readerThrough(sf: SourceFile, name: string): string | undefined {
  const target = path.resolve(sf.getFilePath());
  for (const site of collectImportSites(ctx)) {
    if (site.sf === sf) continue;
    const resolved = resolveSpecifier(ctx, site.sf.getFilePath(), site.specifier);
    if (!resolved || path.resolve(resolved) !== target) continue;
    const at = `${rel(ctx.uiRoot, site.sf.getFilePath())}:${site.node.getStartLineNumber()}`;
    if (Node.isImportDeclaration(site.node)) {
      if (site.node.getNamespaceImport()) return `a namespace import at ${at}`;
      if (site.node.getNamedImports().some((n) => n.getNameNode().getText() === name)) return `imported at ${at}`;
    } else if (Node.isExportDeclaration(site.node)) {
      if (site.node.isNamespaceExport()) return `an export * at ${at}`;
      if (site.node.getNamedExports().some((n) => n.getNameNode().getText() === name)) return `re-exported at ${at}`;
    } else if (Node.isImportTypeNode(site.node)) {
      if (site.node.getQualifier()?.getText().split('.')[0] === name) return `an import type at ${at}`;
    } else {
      return `a dynamic import at ${at}`;
    }
  }
  return undefined;
}

/** Whether `sf` still loads the module `decl` re-exports from once `decl` is gone. */
function loadsElsewhere(sf: SourceFile, decl: ExportDeclaration): boolean {
  const target = decl.getModuleSpecifierSourceFile();
  if (!target) return false;
  const imports = sf.getImportDeclarations().some((d) => !d.isTypeOnly() && d.getModuleSpecifierSourceFile() === target);
  const exports = sf.getExportDeclarations().some((d) => d !== decl && !d.isTypeOnly() && d.getModuleSpecifierSourceFile() === target);
  return imports || exports;
}

// The export lists first: a declaration read only by an unread list entry is free once the entry is gone.
const listed = new Map<ExportDeclaration, Array<{ c: Candidate; spec: ExportSpecifier }>>();
const declared: Candidate[] = [];
for (const c of candidates) {
  const sf = sourceOf(c);
  if (!sf) { refuse(c, 'the file is not part of the project'); continue; }
  const found = specifierOf(sf, c.name);
  if (!found) { declared.push(c); continue; }
  const reader = readerThrough(sf, c.name);
  if (reader) { refuse(c, `taken through this file: ${reader}`); continue; }
  if (!found.decl.getModuleSpecifierValue()) {
    const uses = ownRefs(found.spec.getNameNode()).filter((r) => r.getSourceFile() === sf && !Node.isImportSpecifier(r.getParent()));
    if (uses.length === 0) { refuse(c, 'the name has no other use in this file: its import would be left unused'); continue; }
  }
  const batch = listed.get(found.decl) ?? [];
  batch.push({ c, spec: found.spec });
  listed.set(found.decl, batch);
}
for (const [decl, batch] of listed) {
  const sf = decl.getSourceFile();
  const emptied = batch.length === decl.getNamedExports().length;
  const typeOnly = decl.isTypeOnly() || decl.getNamedExports().every((s) => s.isTypeOnly());
  if (emptied && decl.getModuleSpecifierValue() && !typeOnly && !loadsElsewhere(sf, decl)) {
    for (const { c } of batch) refuse(c, `the last names of its export list: removing the list would stop this file loading '${decl.getModuleSpecifierValue()}'`);
    continue;
  }
  for (const { c } of batch) done.push(`removed re-export ${c.name} | ${c.file}`);
  if (!emptied) { for (const { spec } of batch) spec.remove(); continue; }
  // A file's first statement carries the file's header comment: the comment is put back.
  const header = sf.getStatements()[0] === decl ? decl.getLeadingCommentRanges().map((r) => r.getText()).join('\n') : '';
  decl.remove();
  if (header) sf.insertStatements(0, header);
}

for (const c of declared) {
  const sf = sourceOf(c) as SourceFile;
  const statements = sf.getStatements().filter((s) => {
    if (Node.isVariableStatement(s)) return s.getDeclarations().some((d) => d.getName() === c.name);
    return Node.hasName(s) && s.getName() === c.name;
  });
  const exported = statements.filter((s) => Node.isExportable(s) && s.hasExportKeyword() && !s.hasDefaultKeyword());
  if (exported.length === 0) { refuse(c, 'no exported declaration of that name in the file'); continue; }
  const shared = exported.find((s) => Node.isVariableStatement(s) && s.getDeclarations().length > 1);
  if (shared) { refuse(c, 'declared in one statement with other names'); continue; }
  const nameNodes = exported.map((s) => (Node.isVariableStatement(s) ? s.getDeclarations()[0].getNameNode() : Node.hasName(s) ? s.getNameNode() : undefined))
    .filter((n): n is Node => !!n);
  const refs = nameNodes.flatMap((n) => ownRefs(n)).filter((r) => !nameNodes.includes(r));
  const outside = new Set(refs.filter((r) => r.getSourceFile() !== sf).map((r) => rel(ctx.uiRoot, r.getSourceFile().getFilePath())));
  if (outside.size > 0) { refuse(c, `read in ${outside.size} other file(s): ${[...outside].slice(0, 3).join(', ')}`); continue; }
  if (refs.length === 0) { refuse(c, 'no use at all: dead, not over-exported'); continue; }
  for (const s of exported) if (Node.isExportable(s)) s.setIsExported(false);
  done.push(`unexported ${c.name} | ${c.file}`);
}

for (const line of done) process.stdout.write(`${line}\n`);
for (const line of refused) process.stdout.write(`${line}\n`);
const changed = ctx.project.getSourceFiles().filter((s) => !s.isSaved());
process.stdout.write(`unexport: ${candidates.length} candidate(s), ${done.length} done, ${refused.length} refused, ${changed.length} file(s) changed${values.dry ? ' [dry run]' : ''}\n`);
if (values.dry) process.exit(0);
await ctx.project.save();
process.exit(reportImportCheck(ctx));
