/**
 * morph family -- shared project loading, declaration lookup and the import
 * resolution check every morph command runs after it saves.
 *
 * Not a command itself; imported by every morph command.
 */
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Node, Project, QuoteKind, SyntaxKind, ts, type SourceFile } from 'ts-morph';

// Piping into `head` closes stdout early; that is not an error.
process.stdout.on('error', (e: NodeJS.ErrnoException) => {
  if (e.code === 'EPIPE') process.exit(0);
  throw e;
});

/** The project root of the checkout this script lives in (`scripts/morph/` below it); `--root <dir>` overrides it. */
export const DEFAULT_UI_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Where the tooling's tsconfig sits under a project root. */
const TOOLS_TSCONFIG = path.join('scripts', 'tsconfig.json');

export interface MorphContext {
  uiRoot: string;
  project: Project;
}

/**
 * Loads the tooling tsconfig (`allowJs`: `src/` and the Vite config, all plain
 * JavaScript and JSX), so every morph command sees the same project.
 */
export function loadProject(uiRoot: string): MorphContext {
  const tsConfigFilePath = path.join(uiRoot, TOOLS_TSCONFIG);
  if (!fs.existsSync(tsConfigFilePath)) fail(`no ${TOOLS_TSCONFIG} under ${uiRoot}`);
  const project = new Project({ tsConfigFilePath });
  // The codebase quotes with single quotes; structural inserts (morph.extract's
  // new import/export declarations) default to double without this.
  project.manipulationSettings.set({ quoteKind: QuoteKind.Single });
  return { uiRoot, project };
}

/** Resolves a user-supplied path against the project root first, then the cwd. */
export function resolveUserPath(uiRoot: string, p: string): string {
  if (path.isAbsolute(p)) return p;
  const fromRoot = path.resolve(uiRoot, p);
  if (fs.existsSync(fromRoot)) return fromRoot;
  return path.resolve(process.cwd(), p);
}

export function rel(uiRoot: string, p: string): string {
  return path.relative(uiRoot, p) || '.';
}

export function fail(message: string): never {
  process.stderr.write(`morph: ${message}\n`);
  process.exit(2);
}

export function getSourceFileOrFail(ctx: MorphContext, p: string): SourceFile {
  const abs = resolveUserPath(ctx.uiRoot, p);
  const sf = ctx.project.getSourceFile(abs);
  if (!sf) fail(`${rel(ctx.uiRoot, abs)} is not part of the tsconfig project`);
  return sf;
}

/**
 * Finds the declaration named `name` in `sf`. `Container.member` addresses a
 * member of an interface, class, enum or type-literal alias declared in `sf`.
 */
export function findNamedDeclaration(sf: SourceFile, name: string): Node | undefined {
  const [head, member] = name.split('.');
  const top = sf.getStatements()
    .flatMap((s): Node[] => (Node.isVariableStatement(s) ? s.getDeclarations() : [s]))
    .find((s) => Node.hasName(s) && s.getName() === head);
  if (!top || member === undefined) return top;
  let container: Node | undefined = top;
  if (Node.isTypeAliasDeclaration(top)) container = top.getTypeNode();
  if (!container) return undefined;
  return container.getDescendants().find(
    (d) => (Node.isPropertySignature(d) || Node.isPropertyDeclaration(d) || Node.isMethodSignature(d)
      || Node.isMethodDeclaration(d) || Node.isEnumMember(d)) && d.getName() === member,
  );
}

export interface ImportSite {
  file: string;
  line: number;
  specifier: string;
  resolvedTo?: string;
}

/** Module specifiers the check ignores: packages and Vite asset suffixes. */
function isCheckedSpecifier(spec: string): boolean {
  if (spec.includes('?')) return false;
  if (!spec.startsWith('.') && !spec.startsWith('@/')) return false;
  return !/\.(css|svg|png|jpe?g|glb|gltf|wasm|stl|obj)$/.test(spec);
}

/** Every import / export-from / import() / import('x').T specifier in the project. */
export function collectImportSites(ctx: MorphContext): Array<{ sf: SourceFile; node: Node; specifier: string }> {
  const out: Array<{ sf: SourceFile; node: Node; specifier: string }> = [];
  for (const sf of ctx.project.getSourceFiles()) {
    if (sf.getFilePath().includes('/node_modules/')) continue;
    for (const d of sf.getImportDeclarations()) out.push({ sf, node: d, specifier: d.getModuleSpecifierValue() });
    for (const d of sf.getExportDeclarations()) {
      const spec = d.getModuleSpecifierValue();
      if (spec) out.push({ sf, node: d, specifier: spec });
    }
    for (const call of sf.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      if (call.getExpression().getKind() !== SyntaxKind.ImportKeyword) continue;
      const arg = call.getArguments()[0];
      if (arg && Node.isStringLiteral(arg)) out.push({ sf, node: call, specifier: arg.getLiteralValue() });
    }
    for (const it of sf.getDescendantsOfKind(SyntaxKind.ImportType)) {
      const lit = it.getArgument().getFirstDescendantByKind(SyntaxKind.StringLiteral);
      if (lit) out.push({ sf, node: it, specifier: lit.getLiteralValue() });
    }
  }
  return out;
}

export function resolveSpecifier(ctx: MorphContext, fromFile: string, specifier: string): string | undefined {
  const r = ts.resolveModuleName(
    specifier, fromFile, ctx.project.getCompilerOptions(), ctx.project.getModuleResolutionHost(),
  );
  return r.resolvedModule?.resolvedFileName;
}

export interface ImportCheckResult {
  checked: number;
  unresolved: ImportSite[];
  forbidden: ImportSite[];
}

/**
 * Resolves every relative and `@/` specifier from disk. `forbid` lists files
 * that must no longer be the target of any import (a moved or split file).
 */
export function checkImports(ctx: MorphContext, forbid: string[] = []): ImportCheckResult {
  const forbidden = new Set(forbid.map((f) => path.resolve(f)));
  const result: ImportCheckResult = { checked: 0, unresolved: [], forbidden: [] };
  for (const { sf, node, specifier } of collectImportSites(ctx)) {
    if (!isCheckedSpecifier(specifier)) continue;
    result.checked++;
    const site: ImportSite = { file: rel(ctx.uiRoot, sf.getFilePath()), line: node.getStartLineNumber(), specifier };
    const resolved = resolveSpecifier(ctx, sf.getFilePath(), specifier);
    if (!resolved || !fs.existsSync(resolved)) {
      result.unresolved.push(site);
    } else if (forbidden.has(path.resolve(resolved))) {
      result.forbidden.push({ ...site, resolvedTo: rel(ctx.uiRoot, resolved) });
    }
  }
  return result;
}

/** Prints the check and returns the exit code (0 clean, 1 any unresolved or forbidden). */
export function reportImportCheck(ctx: MorphContext, forbid: string[] = []): number {
  const r = checkImports(ctx, forbid);
  process.stdout.write(`checkImports: ${r.checked} specifiers checked, ${r.unresolved.length} unresolved, ${r.forbidden.length} forbidden\n`);
  for (const s of r.unresolved) process.stdout.write(`  UNRESOLVED ${s.file}:${s.line}  '${s.specifier}'\n`);
  for (const s of r.forbidden) process.stdout.write(`  FORBIDDEN  ${s.file}:${s.line}  '${s.specifier}' -> ${s.resolvedTo}\n`);
  return r.unresolved.length + r.forbidden.length > 0 ? 1 : 0;
}
