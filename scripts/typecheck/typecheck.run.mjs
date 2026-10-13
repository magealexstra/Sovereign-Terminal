/**
 * typecheck.run.mjs -- `npm run typecheck [-- --update]`: the TypeScript checker over the JavaScript source,
 * held to a baseline.
 *
 * The app is plain JavaScript, so the checker (`tsc --checkJs` over `scripts/tsconfig.json`) reports findings
 * the code has always carried, most of them DOM typing the checker cannot infer. Those are listed in
 * `typecheck.baseline.txt`. A run passes when it reports nothing the baseline lacks, so a change may not add a
 * finding: an undefined name, a prop a component does not take, a read of something that does not exist.
 *
 * A finding is matched by file, code and message, never by line, so moving code does not make it new. The same
 * finding twice in a file counts twice. Prints the new findings with their lines, then the baseline entries the
 * run no longer reports. `--update` rewrites the baseline to the current findings: use it after fixing some,
 * never to wave a new one through. Exit 0 no new finding, 1 new findings. Reads only, apart from `--update`.
 */

/* global console, process */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const baselineFile = path.join(here, 'typecheck.baseline.txt');

const tsc = path.join(root, 'node_modules', '.bin', 'tsc');
const run = spawnSync(tsc, ['-p', 'scripts/tsconfig.json', '--noEmit', '--checkJs', '--pretty', 'false'], {
  cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
});
if (run.error) throw run.error;

/** One finding per `file(line,col): error TSnnnn: message` line; continuation lines are dropped. */
const findings = [];
for (const line of run.stdout.split('\n')) {
  const m = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.*)$/.exec(line);
  if (m) findings.push({ file: m[1].split(path.sep).join('/'), line: Number(m[2]), key: `${m[1]} | ${m[4]} | ${m[5]}` });
}
if (findings.length === 0 && run.status !== 0) {
  process.stderr.write(run.stdout + run.stderr);
  process.exit(run.status ?? 1);
}

const keys = findings.map((f) => f.key).sort();
if (process.argv.includes('--update')) {
  fs.writeFileSync(baselineFile, keys.length ? `${keys.join('\n')}\n` : '');
  console.log(`typecheck: baseline rewritten with ${keys.length} finding(s).`);
  process.exit(0);
}

const baseline = fs.existsSync(baselineFile) ? fs.readFileSync(baselineFile, 'utf8').split('\n').filter(Boolean) : [];
const left = [...baseline];
const fresh = [];
for (const finding of findings) {
  const at = left.indexOf(finding.key);
  if (at >= 0) left.splice(at, 1); else fresh.push(finding);
}

console.log(`typecheck: ${findings.length} finding(s), ${baseline.length} in the baseline, ${fresh.length} new, ${left.length} no longer reported.`);
if (fresh.length) {
  console.log('\nNEW (fix these):');
  for (const f of fresh) console.log(`  ${f.file}:${f.line}  ${f.key.split(' | ').slice(1).join(' ')}`);
}
if (left.length) {
  console.log('\nNo longer reported (run with --update to drop them from the baseline):');
  for (const key of left) console.log(`  ${key}`);
}
process.exit(fresh.length ? 1 : 0);
