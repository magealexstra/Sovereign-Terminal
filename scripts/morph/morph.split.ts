/**
 * morph.split -- decomposes one file into a module directory: `engine.jsx`
 * becomes `engine/` with an index re-exporting the public API, default export
 * included (so every existing import path survives), and family-prefixed
 * submodules `engine.<suffix>.js(x)`. A TypeScript source yields `.ts(x)` files.
 *
 *   npx tsx scripts/morph/morph.split.ts <file> --map <suffix>=<declA>,<declB> [--map ...]
 *       [--rest <suffix>] [--trash <dir>] [--dry] [--root <project-root>]
 *
 * The caller maps every top-level declaration to a submodule suffix; `--rest`
 * takes whatever is unmapped. Declaration text (with its JSDoc) moves byte for
 * byte. Each submodule gets exactly the original imports it uses (relative paths
 * re-based one directory deeper) plus sibling imports for what it uses from
 * other submodules; a non-exported declaration used across submodules gains
 * `export` but is not re-exported from the index. The index carries the original
 * file header and re-exports, per submodule in `--map` order, the names the
 * original exported, in declaration order. The original file is moved (never
 * deleted) to `--trash` (default `<root>/_temp_trash/morph.split/`). Importers
 * that spelled the file with an extension are re-pointed to the directory.
 *
 * Exit 0 done, 1 unresolved imports or public-API mismatch, 2 usage error.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { ImportDeclaration, Node, SyntaxKind, ts, type ExportDeclaration, type Statement } from 'ts-morph';
import {
  DEFAULT_UI_ROOT, collectImportSites, fail, getSourceFileOrFail, loadProject, rel,
  reportImportCheck, resolveSpecifier, resolveUserPath,
} from './morph.project.ts';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    map: { type: 'string', multiple: true, default: [] },
    rest: { type: 'string' },
    trash: { type: 'string' },
    dry: { type: 'boolean', default: false },
    root: { type: 'string', default: DEFAULT_UI_ROOT },
  },
});
if (!positionals[0] || (values.map.length === 0 && !values.rest)) {
  process.stderr.write('usage: morph.split.ts <file> --map <suffix>=<declA>,<declB> [--map ...] [--rest <suffix>] [--dry]\n');
  process.exit(2);
}

const ctx = loadProject(resolveUserPath(process.cwd(), values.root));
const sf = getSourceFileOrFail(ctx, positionals[0]);
const filePath = sf.getFilePath();
const ext = path.extname(filePath);
const family = path.basename(filePath, ext);
const dir = path.dirname(filePath);
const outDir = path.join(dir, family);
if (fs.existsSync(outDir)) fail(`${rel(ctx.uiRoot, outDir)} already exists`);

// ---- mapping ---------------------------------------------------------------
const suffixOrder: string[] = [];
const suffixOf = new Map<string, string>();
for (const entry of values.map) {
  const [suffix, list] = entry.split('=');
  if (!suffix || !list) fail(`bad --map '${entry}' (want suffix=declA,declB)`);
  if (!suffixOrder.includes(suffix)) suffixOrder.push(suffix);
  for (const n of list.split(',').map((s) => s.trim()).filter(Boolean)) suffixOf.set(n, suffix);
}
if (values.rest && !suffixOrder.includes(values.rest)) suffixOrder.push(values.rest);

// ---- units: one per top-level declaration statement ----------------------
interface Unit { stmt: Statement; names: string[]; exported: boolean; isDefault: boolean; typeOnly: boolean; suffix: string; declNodes: Node[] }
const imports: ImportDeclaration[] = [];
const reexports: ExportDeclaration[] = [];
const units: Unit[] = [];
const statements = sf.getStatements();
for (const stmt of statements) {
  if (Node.isImportDeclaration(stmt)) { imports.push(stmt); continue; }
  if (Node.isExportDeclaration(stmt) && stmt.getModuleSpecifierValue()) { reexports.push(stmt); continue; }
  let names: string[];
  let declNodes: Node[];
  if (Node.isVariableStatement(stmt)) {
    declNodes = stmt.getDeclarations();
    names = stmt.getDeclarations().map((d) => d.getName());
  } else if (Node.isFunctionDeclaration(stmt) || Node.isClassDeclaration(stmt) || Node.isInterfaceDeclaration(stmt)
    || Node.isTypeAliasDeclaration(stmt) || Node.isEnumDeclaration(stmt) || Node.isModuleDeclaration(stmt)) {
    const n = stmt.getName();
    if (!n) fail(`anonymous declaration at line ${stmt.getStartLineNumber()} is not supported`);
    declNodes = [stmt];
    names = [n];
  } else {
    fail(`unsupported top-level statement at line ${stmt.getStartLineNumber()}: ${stmt.getKindName()}`);
  }
  const suffixes = new Set(names.map((n) => suffixOf.get(n) ?? values.rest));
  if (suffixes.size !== 1 || [...suffixes][0] === undefined) {
    fail(`declaration(s) ${names.join(', ')} (line ${stmt.getStartLineNumber()}) not mapped to exactly one suffix; add to --map or pass --rest`);
  }
  const exported = Node.isExportable(stmt) && stmt.isExported();
  const typeOnly = Node.isInterfaceDeclaration(stmt) || Node.isTypeAliasDeclaration(stmt);
  const isDefault = Node.isExportable(stmt) && stmt.isDefaultExport();
  units.push({ stmt, names, exported, isDefault, typeOnly, suffix: [...suffixes][0] as string, declNodes });
}
const known = new Set(units.flatMap((u) => u.names));
for (const n of suffixOf.keys()) if (!known.has(n)) fail(`--map names '${n}', which is not a top-level declaration of ${family}${ext}`);

// ---- binding table: which import or unit owns each declaration node -------
type Owner = { kind: 'import'; imp: ImportDeclaration; name: string } | { kind: 'unit'; unit: Unit; name: string };
const owners = new Map<Node, Owner>();
for (const imp of imports) {
  const def = imp.getDefaultImport();
  if (def) owners.set(imp.getImportClauseOrThrow(), { kind: 'import', imp, name: def.getText() });
  const ns = imp.getNamespaceImport();
  if (ns) owners.set(ns.getParentOrThrow(), { kind: 'import', imp, name: ns.getText() });
  for (const spec of imp.getNamedImports()) owners.set(spec, { kind: 'import', imp, name: (spec.getAliasNode() ?? spec.getNameNode()).getText() });
}
for (const unit of units) unit.declNodes.forEach((d, i) => owners.set(d, { kind: 'unit', unit, name: unit.names[i] }));

const checker = ctx.project.getTypeChecker();
interface Needs { imports: Map<ImportDeclaration, Set<string>>; siblings: Map<string, Set<Unit>>; jsx: boolean }
const needs = new Map<string, Needs>(suffixOrder.map((s) => [s, { imports: new Map(), siblings: new Map(), jsx: false }]));
const promoted = new Set<Unit>();
for (const unit of units) {
  const need = needs.get(unit.suffix) as Needs;
  if (unit.stmt.getFirstDescendant((d) => Node.isJsxElement(d) || Node.isJsxSelfClosingElement(d) || Node.isJsxFragment(d))) need.jsx = true;
  for (const id of unit.stmt.getDescendantsOfKind(SyntaxKind.Identifier)) {
    const parent = id.getParent();
    const sym = parent && Node.isShorthandPropertyAssignment(parent) && parent.getNameNode() === id
      ? checker.getShorthandAssignmentValueSymbol(parent) : id.getSymbol();
    for (const d of sym?.getDeclarations() ?? []) {
      const owner = owners.get(d);
      if (!owner) continue;
      if (owner.kind === 'import') {
        const set = need.imports.get(owner.imp) ?? new Set<string>();
        set.add(owner.name);
        need.imports.set(owner.imp, set);
      } else if (owner.unit.suffix !== unit.suffix) {
        const set = need.siblings.get(owner.unit.suffix) ?? new Set<Unit>();
        set.add(owner.unit);
        need.siblings.set(owner.unit.suffix, set);
        if (!owner.unit.exported) promoted.add(owner.unit);
      }
    }
  }
}

// ---- text generation --------------------------------------------------------
const posix = (p: string) => p.split(path.sep).join('/');
function rebase(spec: string): string {
  if (!spec.startsWith('.')) return spec;
  const r = posix(path.relative(outDir, path.resolve(dir, spec)));
  return r.startsWith('.') ? r : `./${r}`;
}
const quoteOf = (imp: ImportDeclaration) => imp.getModuleSpecifier().getText()[0];
function importText(imp: ImportDeclaration, used: Set<string>): string {
  const spec = rebase(imp.getModuleSpecifierValue());
  const q = quoteOf(imp);
  const all = [imp.getDefaultImport()?.getText(), imp.getNamespaceImport()?.getText(),
    ...imp.getNamedImports().map((s) => (s.getAliasNode() ?? s.getNameNode()).getText())].filter(Boolean);
  if (all.every((n) => used.has(n as string))) {
    const text = imp.getText();
    const oldSpec = imp.getModuleSpecifier().getText();
    const at = text.lastIndexOf(oldSpec);
    return text.slice(0, at) + q + spec + q + text.slice(at + oldSpec.length);
  }
  const parts: string[] = [];
  const def = imp.getDefaultImport()?.getText();
  if (def && used.has(def)) parts.push(def);
  const ns = imp.getNamespaceImport()?.getText();
  if (ns && used.has(ns)) parts.push(`* as ${ns}`);
  const named = imp.getNamedImports().filter((s) => used.has((s.getAliasNode() ?? s.getNameNode()).getText())).map((s) => s.getText());
  if (named.length) parts.push(`{ ${named.join(', ')} }`);
  return `import ${imp.isTypeOnly() ? 'type ' : ''}${parts.join(', ')} from ${q}${spec}${q};`;
}
const byName = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
function siblingImportText(suffix: string, used: Set<Unit>): string {
  // A default-exported declaration stays the default export of its submodule and is imported as one.
  const def = [...used].find((u) => u.isDefault)?.names[0];
  const vals = [...used].filter((u) => !u.typeOnly && !u.isDefault).flatMap((u) => u.names).sort(byName);
  const types = [...used].filter((u) => u.typeOnly).flatMap((u) => u.names).sort(byName);
  const spec = `./${family}.${suffix}`;
  if (vals.length === 0 && !def) return `import type { ${types.join(', ')} } from '${spec}';`;
  const named = [...vals, ...types.map((t) => `type ${t}`)];
  return `import ${[def, named.length ? `{ ${named.join(', ')} }` : ''].filter(Boolean).join(', ')} from '${spec}';`;
}

const first = statements[0];
const fullText = sf.getFullText();
const headerRange = ts.getLeadingCommentRanges(fullText, 0)?.[0];
const header = headerRange && first && /\n\s*\n/.test(fullText.slice(headerRange.end, first.getStart()))
  ? fullText.slice(headerRange.pos, headerRange.end) : undefined;

function unitText(unit: Unit): string {
  const full = unit.stmt.getFullText();
  const codeAt = unit.stmt.getStart() - unit.stmt.getPos();
  let lead = full.slice(0, codeAt);
  if (unit.stmt === first && header) lead = lead.slice(lead.indexOf(header) + header.length);
  return (lead + (promoted.has(unit) ? 'export ' : '') + full.slice(codeAt)).trimStart();
}

interface OutFile { suffix: string; filePath: string; text: string }
// Submodules keep the language of the file being split: a JavaScript source yields `.js` / `.jsx`.
const isJs = /^\.[cm]?jsx?$/.test(ext);
const outExt = (jsx: boolean): string => (isJs ? (jsx ? '.jsx' : '.js') : (jsx ? '.tsx' : '.ts'));
const outFiles: OutFile[] = [];
for (const suffix of suffixOrder) {
  const mine = units.filter((u) => u.suffix === suffix);
  if (mine.length === 0) continue;
  const need = needs.get(suffix) as Needs;
  const importLines = imports.filter((imp) => need.imports.has(imp)).map((imp) => importText(imp, need.imports.get(imp) as Set<string>));
  const siblingLines = [...need.siblings.entries()].sort(([a], [b]) => byName(`${family}.${a}`, `${family}.${b}`))
    .map(([s, used]) => siblingImportText(s, used));
  const importBlock = [...importLines, ...siblingLines].join('\n');
  const subHeader = `/**\n * ${family} -- ${suffix}.\n *\n * Split out of \`${family}${ext}\` by morph.split; the public API\n * is re-exported from \`index.ts\`.\n */`;
  const text = `${subHeader}\n\n${importBlock ? `${importBlock}\n\n` : ''}${mine.map(unitText).join('\n\n')}\n`;
  outFiles.push({ suffix, filePath: path.join(outDir, `${family}.${suffix}${outExt(need.jsx)}`), text });
}

const exportGroups = outFiles.map(({ suffix }) => {
  const names = units.filter((u) => u.suffix === suffix && u.exported)
    .flatMap((u) => (u.isDefault ? ['default'] : u.names.map((n) => (u.typeOnly ? `type ${n}` : n))));
  if (names.length === 0) return '';
  const spec = `./${family}.${suffix}`;
  const oneLine = `export { ${names.join(', ')} } from '${spec}';`;
  return oneLine.length <= 100 ? oneLine : `export {\n${names.map((n) => `  ${n},`).join('\n')}\n} from '${spec}';`;
}).filter(Boolean);
const sideEffects = imports.filter((imp) => !imp.getImportClause()).map((imp) => importText(imp, new Set()));
const reexportLines = reexports.map((r) => {
  const t = r.getText();
  const old = r.getModuleSpecifier();
  if (!old) return t;
  const newSpec = rebase(old.getLiteralValue());
  return t.replace(old.getText(), `${old.getText()[0]}${newSpec}${old.getText()[0]}`);
});
const indexPath = path.join(outDir, `index${outExt(false)}`);
const indexText = `${header ? `${header}\n\n` : ''}${[sideEffects.join('\n'), ...exportGroups, reexportLines.join('\n')].filter(Boolean).join('\n\n')}\n`;

// ---- report the plan ------------------------------------------------------
const lines = (t: string) => t.split('\n').length - 1;
process.stdout.write(`split: ${rel(ctx.uiRoot, filePath)} (${lines(fullText)} lines) -> ${rel(ctx.uiRoot, outDir)}/${values.dry ? ' [dry run]' : ''}\n`);
for (const f of [...outFiles, { suffix: 'index', filePath: indexPath, text: indexText }]) {
  const n = lines(f.text);
  process.stdout.write(`  ${path.basename(f.filePath).padEnd(48)} ${String(n).padStart(5)} lines${n > 800 ? '  [OVER 800]' : ''}\n`);
}
if (promoted.size) process.stdout.write(`  export added for sibling use (not in index): ${[...promoted].flatMap((u) => u.names).join(', ')}\n`);
const graph = new Map(outFiles.map((f) => [f.suffix, [...(needs.get(f.suffix) as Needs).siblings.keys()]]));
const cycle = (start: string, at: string, seen: Set<string>): boolean =>
  (graph.get(at) ?? []).some((n) => n === start || (!seen.has(n) && (seen.add(n), cycle(start, n, seen))));
const cyclic = [...graph.keys()].filter((s) => cycle(s, s, new Set()));
if (cyclic.length) process.stdout.write(`  [WARNING] submodule import cycle through: ${cyclic.join(', ')}\n`);

const oldExports = [...sf.getExportedDeclarations().keys()].sort();
const importers = collectImportSites(ctx).filter(({ sf: s, specifier }) => s !== sf && resolveSpecifier(ctx, s.getFilePath(), specifier) === filePath);
if (values.dry) process.exit(0);

// ---- write, re-point, move the original ------------------------------------
for (const { sf: s, node, specifier } of importers) {
  if (!/\.(tsx?|jsx?)$/.test(specifier)) continue;
  const lit = Node.isImportDeclaration(node) || Node.isExportDeclaration(node) ? node.getModuleSpecifier() : node.getFirstDescendantByKind(SyntaxKind.StringLiteral);
  if (lit && Node.isStringLiteral(lit)) {
    lit.setLiteralValue(specifier.replace(/\.(tsx?|jsx?)$/, ''));
    process.stdout.write(`  re-pointed ${rel(ctx.uiRoot, s.getFilePath())}:${node.getStartLineNumber()} '${specifier}' -> '${lit.getLiteralValue()}'\n`);
  }
}
ctx.project.removeSourceFile(sf);
for (const f of outFiles) ctx.project.createSourceFile(f.filePath, f.text);
const indexSf = ctx.project.createSourceFile(indexPath, indexText);
await ctx.project.save();
const trashDir = values.trash ? resolveUserPath(ctx.uiRoot, values.trash) : path.join(ctx.uiRoot, '_temp_trash', 'morph.split');
fs.mkdirSync(trashDir, { recursive: true });
const trashed = path.join(trashDir, `${family}.pre-split.${Date.now()}${ext}`);
fs.renameSync(filePath, trashed);
process.stdout.write(`  original moved to ${trashed}\n`);

const newExports = [...indexSf.getExportedDeclarations().keys()].sort();
const missing = oldExports.filter((n) => !newExports.includes(n));
const extra = newExports.filter((n) => !oldExports.includes(n));
process.stdout.write(`public API: ${oldExports.length} before, ${newExports.length} in the index; missing [${missing.join(', ')}]; extra [${extra.join(', ')}]\n`);
const code = reportImportCheck(ctx, [filePath]);
process.exit(code || (missing.length + extra.length > 0 ? 1 : 0));
