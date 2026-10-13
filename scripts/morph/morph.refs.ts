/**
 * morph.refs -- lists every reference to a symbol, resolved by the type
 * checker (not text): definitions, then references grouped by file, then
 * string-literal mentions (persist keys, test ids) that grep would also find.
 *
 *   npx tsx scripts/morph/morph.refs.ts <name> [--file <declaring-file>] [--root <project-root>]
 *
 * `<name>` may be `Container.member` (an interface, class, enum or type-alias
 * member). Without `--file`, every declaration named `<name>` in the project
 * is used. Read-only. Exit 0 found, 1 no declaration found.
 */
import { parseArgs } from 'node:util';
import { Node, SyntaxKind } from 'ts-morph';
import {
  DEFAULT_UI_ROOT, findNamedDeclaration, getSourceFileOrFail, loadProject, rel, resolveUserPath,
} from './morph.project.ts';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    file: { type: 'string' },
    root: { type: 'string', default: DEFAULT_UI_ROOT },
  },
});
const name = positionals[0];
if (!name) {
  process.stderr.write('usage: morph.refs.ts <name> [--file <declaring-file>]\n');
  process.exit(2);
}

const ctx = loadProject(resolveUserPath(process.cwd(), values.root));
const leaf = name.split('.').pop() as string;
const inProject = (n: Node) => !n.getSourceFile().getFilePath().includes('/node_modules/');

/** The name identifiers of the declarations to query. */
const defIds: Node[] = [];
if (values.file) {
  const decl = findNamedDeclaration(getSourceFileOrFail(ctx, values.file), name);
  const id = decl && Node.hasName(decl) ? decl.getNameNode() : undefined;
  if (id) defIds.push(id);
} else {
  for (const sf of ctx.project.getSourceFiles().filter(inProject)) {
    for (const id of sf.getDescendantsOfKind(SyntaxKind.Identifier)) {
      if (id.getText() !== leaf) continue;
      const parent = id.getParent();
      if (!parent || !Node.hasName(parent) || parent.getNameNode() !== id) continue;
      if (Node.isImportSpecifier(parent) || Node.isExportSpecifier(parent) || Node.isBindingElement(parent) || Node.isShorthandPropertyAssignment(parent)) continue;
      if (Node.isPropertyAssignment(parent)) continue;
      if (leaf !== name) {
        const container = parent.getParent();
        const owner = Node.isTypeLiteral(container) ? container.getParent() : container;
        if (!owner || !Node.hasName(owner) || owner.getName() !== name.split('.')[0]) continue;
      }
      defIds.push(id);
    }
  }
}
if (defIds.length === 0) {
  process.stdout.write(`refs: no declaration named '${name}' found\n`);
  process.exit(1);
}

const where = (n: Node) => `${rel(ctx.uiRoot, n.getSourceFile().getFilePath())}:${n.getStartLineNumber()}`;
const lineText = (n: Node) => n.getSourceFile().getFullText().split('\n')[n.getStartLineNumber() - 1].trim();

const seen = new Set<string>();
const byFile = new Map<string, string[]>();
const defSites = new Set(defIds.map((d) => `${d.getSourceFile().getFilePath()}:${d.getStart()}`));
for (const id of defIds) {
  const refs = Node.isReferenceFindable(id) ? id.findReferencesAsNodes() : [];
  for (const r of refs.filter(inProject)) {
    const key = `${r.getSourceFile().getFilePath()}:${r.getStart()}`;
    if (seen.has(key) || defSites.has(key)) continue;
    seen.add(key);
    const file = rel(ctx.uiRoot, r.getSourceFile().getFilePath());
    const list = byFile.get(file) ?? [];
    list.push(`${String(r.getStartLineNumber()).padStart(5)}  ${lineText(r)}`);
    byFile.set(file, list);
  }
}

process.stdout.write(`refs: '${name}' -- ${defIds.length} declaration(s), ${seen.size} reference(s) in ${byFile.size} file(s)\n`);
process.stdout.write('\ndeclarations:\n');
for (const d of defIds) process.stdout.write(`  ${where(d)}  ${lineText(d)}\n`);
process.stdout.write('\nreferences:\n');
for (const [file, lines] of [...byFile.entries()].sort()) {
  process.stdout.write(`  ${file} (${lines.length})\n`);
  for (const l of lines) process.stdout.write(`   ${l}\n`);
}

const strings: string[] = [];
for (const sf of ctx.project.getSourceFiles().filter(inProject)) {
  for (const s of sf.getDescendantsOfKind(SyntaxKind.StringLiteral)) {
    if (s.getLiteralValue() === leaf) strings.push(`  ${where(s)}  ${lineText(s)}`);
  }
}
process.stdout.write(`\nstring-literal mentions (not renamed by morph.rename): ${strings.length}\n`);
for (const s of strings) process.stdout.write(`${s}\n`);
