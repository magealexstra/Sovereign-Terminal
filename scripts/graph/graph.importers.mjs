/**
 * graph.importers -- the blast radius of a file before it is edited:
 * every module that imports it, transitively, grouped by hop count, plus any
 * dependency-cruiser rule violations that touch it. One call instead of a grep
 * chain.
 *
 *   npm run graph -- <file-or-directory> [--depth N]     (default depth 3)
 *
 * A directory (e.g. `src/components/terminal`) is treated as
 * every module inside it. Runs dependency-cruiser with `scripts/dependency-cruiser.cjs`
 * (type-only imports included). Exit 0, or 2 on a usage error.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.stdout.on('error', (e) => {
  if (e.code === 'EPIPE') process.exit(0);
  throw e;
});

const uiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const depthAt = args.indexOf('--depth');
const maxDepth = depthAt >= 0 ? Number(args[depthAt + 1]) : 3;
const target = args.find((a, i) => !a.startsWith('--') && (depthAt < 0 || i !== depthAt + 1));
if (!target || !Number.isInteger(maxDepth) || maxDepth < 1) {
  process.stderr.write('usage: npm run graph -- <file-or-directory> [--depth N]\n');
  process.exit(2);
}

const abs = path.resolve(fs.existsSync(path.resolve(uiRoot, target)) ? uiRoot : process.cwd(), target);
const relTarget = path.relative(uiRoot, abs).split(path.sep).join('/');
const isDir = fs.existsSync(abs) && fs.statSync(abs).isDirectory();

const bin = path.join(uiRoot, 'node_modules', '.bin', 'depcruise');
const raw = execFileSync(bin, ['src', '--config', path.join(uiRoot, 'scripts', 'dependency-cruiser.cjs'), '--output-type', 'json'], {
  cwd: uiRoot, maxBuffer: 256 * 1024 * 1024, encoding: 'utf8',
});
const { modules, summary } = JSON.parse(raw);

const matches = (source) => (isDir ? source.startsWith(`${relTarget}/`) : source === relTarget);
const targets = modules.map((m) => m.source).filter(matches);
if (targets.length === 0) {
  process.stderr.write(`graph: ${relTarget} is not a module under src/ (paths are relative to the project root)\n`);
  process.exit(2);
}

/** Reverse edges: module -> modules that import it. */
const importers = new Map();
for (const m of modules) {
  for (const d of m.dependencies) {
    if (!importers.has(d.resolved)) importers.set(d.resolved, new Set());
    importers.get(d.resolved).add(m.source);
  }
}

const seen = new Set(targets);
let frontier = targets;
const levels = [];
for (let depth = 1; frontier.length > 0; depth++) {
  const next = [];
  for (const t of frontier) {
    for (const i of importers.get(t) ?? []) {
      if (!seen.has(i)) { seen.add(i); next.push(i); }
    }
  }
  levels.push(next.sort());
  frontier = next;
}

const out = [];
out.push(`graph: ${relTarget}${isDir ? ` (${targets.length} modules)` : ''}`);
levels.slice(0, maxDepth).forEach((lvl, i) => {
  out.push(`  depth ${i + 1}: ${lvl.length} importer(s)`);
  for (const f of lvl) out.push(`    ${f}`);
});
const total = levels.reduce((n, l) => n + l.length, 0);
const shown = levels.slice(0, maxDepth).reduce((n, l) => n + l.length, 0);
out.push(`  total: ${shown} importer(s) within depth ${maxDepth}; ${total} at any depth (${levels.length} hops)`);

const touching = summary.violations.filter((v) => matches(v.from) || matches(v.to));
out.push(`  rule violations touching it: ${touching.length}`);
for (const v of touching) {
  const where = v.cycle ? v.cycle.map((c) => (typeof c === 'string' ? c : c.name)).join(' -> ') : `${v.from} -> ${v.to}`;
  out.push(`    ${v.rule.severity} ${v.rule.name}: ${where}`);
}
process.stdout.write(`${out.join('\n')}\n`);
