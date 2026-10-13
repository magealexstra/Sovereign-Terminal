/**
 * morph.move -- moves a file or a directory and re-points every importer
 * through ts-morph (`SourceFile.move` / `Directory.move`), then saves and runs
 * the import check.
 *
 *   npx tsx scripts/morph/morph.move.ts <from> <to> [--dry] [--root <project-root>]
 *
 * `<to>` is the new path. When `<to>` is an existing directory (or ends in `/`)
 * the source keeps its name inside it. A file keeps its extension unless `<to>`
 * names a different one. Refuses a target that already exists. A move that
 * changes only the file's name is a rename of the file (the symbols inside stay
 * as they are; use morph.rename for those).
 *
 * `--dry` prints every import, export-from and `import()` specifier
 * that resolves into the moved set (these are what the move rewrites) and every
 * comment or string that mentions the old file name (these are NOT rewritten;
 * fix them by hand), and writes nothing.
 *
 * Exit 0 done, 1 unresolved imports after save, 2 usage error / refusal.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import {
  collectImportSites, DEFAULT_UI_ROOT, fail, loadProject, rel, reportImportCheck, resolveSpecifier,
  resolveUserPath,
} from './morph.project.ts';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    dry: { type: 'boolean', default: false },
    root: { type: 'string', default: DEFAULT_UI_ROOT },
  },
});
const [from, to] = positionals;
if (!from || !to || positionals.length > 2) {
  process.stderr.write('usage: morph.move.ts <from> <to> [--dry] [--root <project-root>]\n');
  process.exit(2);
}

const ctx = loadProject(resolveUserPath(process.cwd(), values.root));
const fromAbs = resolveUserPath(ctx.uiRoot, from);
if (!fs.existsSync(fromAbs)) fail(`${from} does not exist`);
const isDir = fs.statSync(fromAbs).isDirectory();

let toAbs = path.isAbsolute(to) ? to : path.resolve(ctx.uiRoot, to);
if (to.endsWith('/') || (fs.existsSync(toAbs) && fs.statSync(toAbs).isDirectory())) {
  toAbs = path.join(toAbs, path.basename(fromAbs));
}
if (fs.existsSync(toAbs)) fail(`${rel(ctx.uiRoot, toAbs)} already exists`);
if (isDir && (toAbs + path.sep).startsWith(fromAbs + path.sep)) fail('cannot move a directory into itself');

// The set of project files that move, and where each lands.
const moving = new Map<string, string>();
if (isDir) {
  const dir = ctx.project.getDirectory(fromAbs);
  if (!dir) fail(`${rel(ctx.uiRoot, fromAbs)} is not part of the tsconfig project`);
  for (const f of dir.getDescendantSourceFiles()) moving.set(f.getFilePath(), path.join(toAbs, path.relative(fromAbs, f.getFilePath())));
} else {
  const sf = ctx.project.getSourceFile(fromAbs);
  if (!sf) fail(`${rel(ctx.uiRoot, fromAbs)} is not part of the tsconfig project`);
  if (!path.extname(toAbs)) toAbs += path.extname(fromAbs);
  moving.set(fromAbs, toAbs);
}

// Importers: every specifier in the project that resolves into the moved set.
const sites: string[] = [];
for (const { sf, node, specifier } of collectImportSites(ctx)) {
  if (!specifier.startsWith('.') && !specifier.startsWith('@/')) continue;
  const resolved = resolveSpecifier(ctx, sf.getFilePath(), specifier);
  if (resolved && moving.has(resolved)) {
    sites.push(`${rel(ctx.uiRoot, sf.getFilePath())}:${node.getStartLineNumber()}  '${specifier}'`);
  }
}

// Mentions of the old file name in comments and strings: not rewritten.
const mentionName = path.basename(fromAbs);
const mentions: string[] = [];
for (const sf of ctx.project.getSourceFiles()) {
  if (sf.getFilePath().includes('/node_modules/')) continue;
  sf.getFullText().split('\n').forEach((line, i) => {
    if (!line.includes(mentionName)) return;
    if (/^\s*(import|export)\b.*\bfrom\b/.test(line)) return;
    mentions.push(`${rel(ctx.uiRoot, sf.getFilePath())}:${i + 1}  ${line.trim().slice(0, 110)}`);
  });
}

process.stdout.write(`move: ${rel(ctx.uiRoot, fromAbs)} -> ${rel(ctx.uiRoot, toAbs)}${isDir ? '/' : ''}: ${moving.size} file(s), ${sites.length} specifier(s) point into it${values.dry ? ' [dry run]' : ''}\n`);
for (const s of sites) process.stdout.write(`  ${s}\n`);
if (mentions.length) {
  process.stdout.write(`mentions of '${mentionName}' NOT rewritten (${mentions.length}); change them by hand:\n`);
  for (const m of mentions) process.stdout.write(`  ${m}\n`);
}
if (values.dry) process.exit(0);

if (isDir) {
  const dir = ctx.project.getDirectoryOrThrow(fromAbs);
  dir.move(toAbs);
} else {
  ctx.project.getSourceFileOrThrow(fromAbs).move(toAbs);
}
const changed = ctx.project.getSourceFiles().filter((s) => !s.isSaved());
await ctx.project.save();
process.stdout.write(`saved ${changed.length} file(s)\n`);
process.exit(reportImportCheck(ctx, [...moving.keys()]));
