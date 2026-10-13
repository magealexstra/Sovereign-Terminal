/**
 * morph.extract -- moves one or more named top-level declarations (const,
 * function, type, interface, class, enum) from a source file to a sibling
 * file in the same directory, new or existing.
 *
 *   npx tsx scripts/morph/morph.extract.ts <sourceFile> <targetFile> <name> [<name> ...]
 *       [--dry-run] [--root <project-root>]
 *
 * Declaration text moves byte for byte, with its leading JSDoc/comments and
 * its `export` modifier untouched. Imports the moved declarations use move
 * with them; an import the source no longer uses after the move is dropped
 * from the source. If a moved declaration still uses a name that stays in
 * the source, the target gets `import { name } from './source'` (the
 * source's declaration gains `export` if it did not have it); if the
 * reverse also holds (something staying in the source uses a moved name),
 * that is a new source<->target cycle and this command warns rather than
 * silently building one. An existing target drops every import of a name it
 * now declares, so it never imports its own declarations back.
 *
 * Every importer of a moved name is re-pointed: an `import`/`export ... from`
 * naming the source file has the moved names split out to a new or merged
 * specifier pointing at the target (same alias style: `@/...` stays `@/...`,
 * relative stays relative); the names that did not move keep importing from
 * the source unchanged. An importer that reached a moved name through the
 * directory's own barrel (`export * from './source'` or
 * `export { name } from './source'` in that directory's index.ts) is left
 * alone -- the barrel itself gets the new `export { name } from './target'`
 * line, and loses the moved name from its old from-source line. Nothing is
 * left exported from the source at the old path.
 *
 * Refuses (exit 2) a name that is not a top-level declaration of the source
 * file (not found, or a `Container.member` address). `--dry-run` prints the
 * plan and writes nothing. Exit 0 done, 1 unresolved imports after save
 * (`morph.checkImports`), 2 usage error / refusal.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { ExportDeclaration, ImportDeclaration, Node, SourceFile, SyntaxKind, ts, type Statement } from 'ts-morph';
import {
  DEFAULT_UI_ROOT, collectImportSites, fail, getSourceFileOrFail, loadProject, rel,
  reportImportCheck, resolveSpecifier, resolveUserPath,
} from './morph.project.ts';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    'dry-run': { type: 'boolean', default: false },
    root: { type: 'string', default: DEFAULT_UI_ROOT },
  },
});
const [sourceArg, targetArg, ...names] = positionals;
if (!sourceArg || !targetArg || names.length === 0) {
  process.stderr.write('usage: morph.extract.ts <sourceFile> <targetFile> <name> [<name> ...] [--dry-run] [--root <project-root>]\n');
  process.exit(2);
}

const ctx = loadProject(resolveUserPath(process.cwd(), values.root));
const sf = getSourceFileOrFail(ctx, sourceArg);
const sourcePath = sf.getFilePath();
const sourceDir = path.dirname(sourcePath);
const sourceExt = path.extname(sourcePath);
const sourceBase = path.basename(sourcePath, sourceExt);

// Not resolveUserPath: the target commonly does not exist yet, so it is
// always resolved against the project root (or taken as-is if already absolute),
// never against cwd (which resolveUserPath falls back to for a missing path).
const targetArgAbs = path.isAbsolute(targetArg) ? targetArg : path.resolve(ctx.uiRoot, targetArg);
const targetExt = path.extname(targetArgAbs) || sourceExt;
const targetPath = path.extname(targetArgAbs) ? targetArgAbs : `${targetArgAbs}${targetExt}`;
if (path.dirname(targetPath) !== sourceDir) fail(`target must be a sibling of ${rel(ctx.uiRoot, sourcePath)} (same directory): got ${rel(ctx.uiRoot, targetPath)}`);
if (path.resolve(targetPath) === path.resolve(sourcePath)) fail('target must not be the source file');
const targetBase = path.basename(targetPath, targetExt);

// ---- partition the source's top-level statements into units --------------
interface Unit { stmt: Statement; names: string[]; exported: boolean; typeOnly: boolean; declNodes: Node[] }
const imports: ImportDeclaration[] = [];
const units: Unit[] = [];
for (const stmt of sf.getStatements()) {
  if (Node.isImportDeclaration(stmt)) { imports.push(stmt); continue; }
  if (Node.isExportDeclaration(stmt) && stmt.getModuleSpecifierValue()) continue; // re-export statement, not addressable
  let unitNames: string[];
  let declNodes: Node[];
  if (Node.isVariableStatement(stmt)) {
    declNodes = stmt.getDeclarations();
    unitNames = stmt.getDeclarations().map((d) => d.getName());
  } else if (Node.isFunctionDeclaration(stmt) || Node.isClassDeclaration(stmt) || Node.isInterfaceDeclaration(stmt)
    || Node.isTypeAliasDeclaration(stmt) || Node.isEnumDeclaration(stmt) || Node.isModuleDeclaration(stmt)) {
    const n = stmt.getName();
    if (!n) continue; // anonymous (e.g. `export default function () {}`) -- not addressable by name
    declNodes = [stmt];
    unitNames = [n];
  } else {
    continue; // not a named top-level declaration
  }
  units.push({
    stmt, names: unitNames, declNodes,
    exported: Node.isExportable(stmt) && stmt.isExported(),
    typeOnly: Node.isInterfaceDeclaration(stmt) || Node.isTypeAliasDeclaration(stmt),
  });
}

const requested = new Set(names);
const movingUnits: Unit[] = [];
for (const unit of units) {
  const matched = unit.names.filter((n) => requested.has(n));
  if (matched.length === 0) continue;
  if (matched.length !== unit.names.length) {
    fail(`'${matched.join(', ')}' shares a declaration statement with '${unit.names.filter((n) => !matched.includes(n)).join(', ')}' `
      + `(line ${unit.stmt.getStartLineNumber()}); request every name in that statement together`);
  }
  movingUnits.push(unit);
}
const foundNames = new Set(movingUnits.flatMap((u) => u.names));
const notFound = names.filter((n) => !foundNames.has(n));
if (notFound.length) {
  fail(`not found as a top-level declaration in ${rel(ctx.uiRoot, sourcePath)}: ${notFound.join(', ')} `
    + '(not present, or not top-level -- a Container.member address is not extractable)');
}
const stayingUnits = units.filter((u) => !movingUnits.includes(u));

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
function ownersUsedBy(stmt: Node): Owner[] {
  const out: Owner[] = [];
  for (const id of stmt.getDescendantsOfKind(SyntaxKind.Identifier)) {
    const parent = id.getParent();
    const sym = parent && Node.isShorthandPropertyAssignment(parent) && parent.getNameNode() === id
      ? checker.getShorthandAssignmentValueSymbol(parent) : id.getSymbol();
    for (const d of sym?.getDeclarations() ?? []) {
      const owner = owners.get(d);
      if (owner) out.push(owner);
    }
  }
  return out;
}
function usedNamesInUnits(unitsList: Unit[], imp: ImportDeclaration): Set<string> {
  const set = new Set<string>();
  for (const u of unitsList) for (const owner of ownersUsedBy(u.stmt)) if (owner.kind === 'import' && owner.imp === imp) set.add(owner.name);
  return set;
}

// ---- what the target needs from the source's imports and from the source itself ----
const targetImportNeeds = new Map<ImportDeclaration, Set<string>>();
const targetImportsFromSource = new Set<Unit>();
for (const unit of movingUnits) {
  for (const owner of ownersUsedBy(unit.stmt)) {
    if (owner.kind === 'import') {
      const set = targetImportNeeds.get(owner.imp) ?? new Set<string>();
      set.add(owner.name);
      targetImportNeeds.set(owner.imp, set);
    } else if (!movingUnits.includes(owner.unit)) {
      targetImportsFromSource.add(owner.unit);
    }
  }
}
// ---- what stays in the source that still needs a moved name back from the target ----
const sourceImportsFromTarget = new Set<Unit>();
for (const unit of stayingUnits) {
  for (const owner of ownersUsedBy(unit.stmt)) {
    if (owner.kind === 'unit' && movingUnits.includes(owner.unit)) sourceImportsFromTarget.add(owner.unit);
  }
}
const newCycle = targetImportsFromSource.size > 0 && sourceImportsFromTarget.size > 0;

// ---- imports the source drops (only used by the moving declarations) ------
const droppedImports = imports.filter((imp) => targetImportNeeds.has(imp) && usedNamesInUnits(stayingUnits, imp).size === 0);

// ---- text helpers (matching morph.split) ----------------
const quoteOf = (imp: ImportDeclaration) => imp.getModuleSpecifier().getText()[0];
function importTextFor(imp: ImportDeclaration, used: Set<string>): string {
  const q = quoteOf(imp);
  const spec = imp.getModuleSpecifierValue();
  const all = [imp.getDefaultImport()?.getText(), imp.getNamespaceImport()?.getText(),
    ...imp.getNamedImports().map((s) => (s.getAliasNode() ?? s.getNameNode()).getText())].filter(Boolean);
  if (all.every((n) => used.has(n as string))) return imp.getText();
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
function siblingImportText(spec: string, unitsUsed: Set<Unit>): string {
  const vals = [...unitsUsed].filter((u) => !u.typeOnly).flatMap((u) => u.names).sort(byName);
  const types = [...unitsUsed].filter((u) => u.typeOnly).flatMap((u) => u.names).sort(byName);
  if (vals.length === 0) return `import type { ${types.join(', ')} } from '${spec}';`;
  return `import { ${[...vals, ...types.map((t) => `type ${t}`)].join(', ')} } from '${spec}';`;
}

const statements = sf.getStatements();
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
  // A moved declaration the source still calls must be exported from the target.
  const code = !unit.exported && sourceImportsFromTarget.has(unit) ? `export ${full.slice(codeAt)}` : full.slice(codeAt);
  return (lead + code).trimStart();
}

// ---- report the plan --------------------------------------------------------
const dry = values['dry-run'] === true;
process.stdout.write(`extract: ${rel(ctx.uiRoot, sourcePath)} -> ${rel(ctx.uiRoot, targetPath)}: `
  + `${movingUnits.flatMap((u) => u.names).join(', ')}${dry ? ' [dry run]' : ''}\n`);
if (droppedImports.length) {
  process.stdout.write(`  source drops import(s): ${droppedImports.map((i) => i.getModuleSpecifierValue()).join(', ')}\n`);
}
if (targetImportsFromSource.size) {
  process.stdout.write(`  target imports from source: ${[...targetImportsFromSource].flatMap((u) => u.names).join(', ')}`
    + `${[...targetImportsFromSource].some((u) => !u.exported) ? ' (source gains export on: '
      + [...targetImportsFromSource].filter((u) => !u.exported).flatMap((u) => u.names).join(', ') + ')' : ''}\n`);
}
if (sourceImportsFromTarget.size) {
  process.stdout.write(`  source still needs from target: ${[...sourceImportsFromTarget].flatMap((u) => u.names).join(', ')}\n`);
}
// ---- the target's own imports of names it is about to declare ---------------
// An existing target that imported a moved name (from the source or anywhere) would import its own
// declaration back once the move lands; every such specifier is dropped.
const existingTargetSf = fs.existsSync(targetPath) ? ctx.project.getSourceFile(targetPath) : undefined;
const targetSelfImports = (existingTargetSf?.getImportDeclarations() ?? []).flatMap((d) =>
  d.getNamedImports().filter((spec) => foundNames.has((spec.getAliasNode() ?? spec.getNameNode()).getText())));
if (targetSelfImports.length) {
  process.stdout.write(`  target drops its import(s) of: ${targetSelfImports.map((s) => s.getText()).join(', ')}\n`);
}
if (newCycle) {
  process.stdout.write(`  [WARNING] new source<->target cycle: ${rel(ctx.uiRoot, targetPath)} imports from `
    + `${rel(ctx.uiRoot, sourcePath)} and vice versa\n`);
}

// ---- who imports the moved names today -------------------------------------
const sites = collectImportSites(ctx).filter(({ sf: s, specifier }) => s !== sf
  && s.getFilePath() !== targetPath && resolveSpecifier(ctx, s.getFilePath(), specifier) === sourcePath);
interface Repoint { sf: SourceFile; kind: 'import' | 'export'; node: ImportDeclaration | ExportDeclaration; matched: string[] }
const repoints: Repoint[] = [];
const skippedSites: string[] = [];
for (const { sf: s, node } of sites) {
  if (Node.isImportDeclaration(node)) {
    const matched = node.getNamedImports().map((spec) => spec.getNameNode().getText()).filter((n) => foundNames.has(n));
    if (matched.length) repoints.push({ sf: s, kind: 'import', node, matched });
  } else if (Node.isExportDeclaration(node)) {
    const wildcard = node.isNamespaceExport() || node.getNamedExports().length === 0;
    // A wholesale re-export only ever carried the names the source exported.
    const matched = wildcard ? movingUnits.filter((u) => u.exported).flatMap((u) => u.names) : node.getNamedExports().map((spec) => spec.getNameNode().getText()).filter((n) => foundNames.has(n));
    if (matched.length) repoints.push({ sf: s, kind: 'export', node, matched });
  } else {
    skippedSites.push(`${rel(ctx.uiRoot, s.getFilePath())}:${node.getStartLineNumber()} (${node.getKindName()}, not an import/export-from -- check by hand)`);
  }
}
if (repoints.length) {
  process.stdout.write(`  re-points ${repoints.length} import/export site(s):\n`);
  for (const r of repoints) process.stdout.write(`    ${r.kind === 'export' ? '[barrel] ' : ''}${rel(ctx.uiRoot, r.sf.getFilePath())}:${r.node.getStartLineNumber()}  ${r.matched.join(', ')}\n`);
}
if (skippedSites.length) {
  process.stdout.write(`  [WARNING] not re-pointed (not a static import/export-from), check by hand:\n`);
  for (const s of skippedSites) process.stdout.write(`    ${s}\n`);
}
if (dry) process.exit(0);

// ---- apply: build the target file ------------------------------------------
const relSpecifier = (fromDir: string, toFile: string): string => {
  const ext = path.extname(toFile);
  let r = path.relative(fromDir, toFile).split(path.sep).join('/').replace(new RegExp(`\\${ext}$`), '');
  if (!r.startsWith('.')) r = `./${r}`;
  return r;
};
const srcRoot = path.join(ctx.uiRoot, 'src');
const aliasSpecifier = (toFile: string): string | undefined => {
  if (!toFile.startsWith(srcRoot + path.sep)) return undefined;
  const ext = path.extname(toFile);
  return `@/${path.relative(srcRoot, toFile).split(path.sep).join('/').replace(new RegExp(`\\${ext}$`), '')}`;
};
const specifierLike = (originalSpec: string, fromDir: string, toFile: string): string =>
  (originalSpec.startsWith('@/') ? aliasSpecifier(toFile) : undefined) ?? relSpecifier(fromDir, toFile);

if (existingTargetSf) {
  for (const spec of targetSelfImports) {
    const decl = spec.getImportDeclaration();
    spec.remove();
    if (decl.getNamedImports().length === 0 && !decl.getDefaultImport() && !decl.getNamespaceImport()) decl.remove();
  }
  for (const [imp, used] of targetImportNeeds) {
    const spec = imp.getModuleSpecifierValue();
    // The source imported these from the target itself: the target already declares them.
    if (resolveSpecifier(ctx, sourcePath, spec) === targetPath) continue;
    const existingImp = existingTargetSf.getImportDeclaration((d) => d.getModuleSpecifierValue() === spec && d.isTypeOnly() === imp.isTypeOnly());
    if (existingImp) {
      const already = new Set(existingImp.getNamedImports().map((s) => (s.getAliasNode() ?? s.getNameNode()).getText()));
      for (const n of used) if (!already.has(n)) existingImp.addNamedImport(n);
    } else {
      existingTargetSf.addImportDeclaration({
        moduleSpecifier: spec, isTypeOnly: imp.isTypeOnly(),
        namedImports: imp.getNamedImports().filter((s) => used.has((s.getAliasNode() ?? s.getNameNode()).getText()))
          .map((s) => ({ name: s.getNameNode().getText(), alias: s.getAliasNode()?.getText(), isTypeOnly: s.isTypeOnly() })),
      });
    }
  }
  if (targetImportsFromSource.size) {
    const spec = `./${sourceBase}`;
    const names2 = [...targetImportsFromSource].flatMap((u) => u.names.map((n) => ({ n, typeOnly: u.typeOnly })));
    // Merge into the target's value import of the source, however it is spelled (`./x` or `@/...`).
    const existingImp = existingTargetSf.getImportDeclaration((d) => !d.isTypeOnly()
      && resolveSpecifier(ctx, targetPath, d.getModuleSpecifierValue()) === sourcePath);
    if (existingImp) {
      const already = new Set(existingImp.getNamedImports().map((s) => (s.getAliasNode() ?? s.getNameNode()).getText()));
      for (const { n, typeOnly } of names2) if (!already.has(n)) existingImp.addNamedImport({ name: n, isTypeOnly: typeOnly });
    } else {
      existingTargetSf.addImportDeclaration({ moduleSpecifier: spec, namedImports: names2.map(({ n, typeOnly }) => ({ name: n, isTypeOnly: typeOnly })) });
    }
  }
  for (const u of movingUnits) existingTargetSf.addStatements(`\n${unitText(u)}`);
} else {
  const carriedImportLines = [...targetImportNeeds.entries()].map(([imp, used]) => importTextFor(imp, used));
  const siblingLine = targetImportsFromSource.size ? [siblingImportText(`./${sourceBase}`, targetImportsFromSource)] : [];
  const importBlock = [...carriedImportLines, ...siblingLine].join('\n');
  const bodyText = movingUnits.map(unitText).join('\n\n');
  const newHeader = `/**\n * ${targetBase} -- split out of \`${sourceBase}${sourceExt}\` by morph.extract.\n */`;
  const targetText = `${newHeader}\n\n${importBlock ? `${importBlock}\n\n` : ''}${bodyText}\n`;
  ctx.project.createSourceFile(targetPath, targetText);
}

// ---- apply: promote staying symbols the target now needs -------------------
for (const u of targetImportsFromSource) {
  if (u.exported) continue;
  const stmt = u.stmt;
  if (Node.isVariableStatement(stmt) || Node.isFunctionDeclaration(stmt) || Node.isClassDeclaration(stmt)
    || Node.isInterfaceDeclaration(stmt) || Node.isTypeAliasDeclaration(stmt) || Node.isEnumDeclaration(stmt)) {
    stmt.setIsExported(true);
  }
}

// ---- apply: remove the moved statements and now-dead imports from source ---
for (const u of movingUnits) u.stmt.remove();
for (const imp of droppedImports) imp.remove();
if (sourceImportsFromTarget.size) {
  const spec = `./${targetBase}`;
  const names3 = [...sourceImportsFromTarget].flatMap((u) => u.names.map((n) => ({ n, typeOnly: u.typeOnly })));
  const existingImp = sf.getImportDeclaration((d) => !d.isTypeOnly()
    && resolveSpecifier(ctx, sourcePath, d.getModuleSpecifierValue()) === targetPath);
  if (existingImp) {
    const already = new Set(existingImp.getNamedImports().map((s) => (s.getAliasNode() ?? s.getNameNode()).getText()));
    for (const { n, typeOnly } of names3) if (!already.has(n)) existingImp.addNamedImport({ name: n, isTypeOnly: typeOnly });
  } else {
    sf.addImportDeclaration({ moduleSpecifier: spec, namedImports: names3.map(({ n, typeOnly }) => ({ name: n, isTypeOnly: typeOnly })) });
  }
}

// ---- apply: re-point every importer and barrel ------------------------------
const barrelAdds = new Map<SourceFile, Set<string>>();
for (const r of repoints) {
  if (r.kind === 'export') {
    const decl = r.node as ExportDeclaration;
    if (!(decl.isNamespaceExport() || decl.getNamedExports().length === 0)) {
      for (const spec of decl.getNamedExports()) if (r.matched.includes(spec.getNameNode().getText())) spec.remove();
      if (decl.getNamedExports().length === 0) decl.remove();
    }
    const set = barrelAdds.get(r.sf) ?? new Set<string>();
    for (const n of r.matched) set.add(n);
    barrelAdds.set(r.sf, set);
  } else {
    const decl = r.node as ImportDeclaration;
    const importerDir = path.dirname(r.sf.getFilePath());
    const newSpec = specifierLike(decl.getModuleSpecifierValue(), importerDir, targetPath);
    const moving = decl.getNamedImports().filter((spec) => r.matched.includes(spec.getNameNode().getText()));
    const moved = moving.map((spec) => ({ name: spec.getNameNode().getText(), alias: spec.getAliasNode()?.getText(), isTypeOnly: spec.isTypeOnly() }));
    for (const spec of moving) spec.remove();
    if (decl.getNamedImports().length === 0 && !decl.getDefaultImport() && !decl.getNamespaceImport()) decl.remove();
    const existingImp = r.sf.getImportDeclaration(newSpec);
    if (existingImp) {
      const already = new Set(existingImp.getNamedImports().map((s) => (s.getAliasNode() ?? s.getNameNode()).getText()));
      for (const m of moved) if (!already.has(m.alias ?? m.name)) existingImp.addNamedImport(m);
    } else {
      r.sf.addImportDeclaration({ moduleSpecifier: newSpec, namedImports: moved });
    }
  }
}
// A barrel that re-exported the source wholesale (`export *`) gets `export *` of the target, once; one that
// already re-exports the target wholesale needs nothing; otherwise it names the moved symbols.
const exportsWholesale = (barrelSf: SourceFile, file: string): boolean => barrelSf.getExportDeclarations().some((d) =>
  (d.isNamespaceExport() || d.getNamedExports().length === 0) && d.getModuleSpecifierValue() !== undefined
  && resolveSpecifier(ctx, barrelSf.getFilePath(), d.getModuleSpecifierValue() as string) === file);
for (const [barrelSf, set] of barrelAdds) {
  if (exportsWholesale(barrelSf, targetPath)) continue;
  const spec = specifierLike('./x', path.dirname(barrelSf.getFilePath()), targetPath);
  if (exportsWholesale(barrelSf, sourcePath)) barrelSf.addExportDeclaration({ moduleSpecifier: spec });
  else barrelSf.addExportDeclaration({ moduleSpecifier: spec, namedExports: [...set].sort(byName) });
}

const changed = ctx.project.getSourceFiles().filter((s) => !s.isSaved());
await ctx.project.save();
process.stdout.write(`saved ${changed.length} file(s)\n`);
process.exit(reportImportCheck(ctx));
