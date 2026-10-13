/**
 * dead.run.mjs -- `npm run dead [-- --area <n>]`: what knip finds, as one row per candidate.
 *
 * knip runs twice over `knip.json`: once as it is, once ignoring an export that is used inside its own file. An
 * export the second run still reports has no reader anywhere: DEAD. One only the first run reports is read in
 * its own file alone: OVER-EXPORTED (it needs no `export`). Rows carry the full path and line, are grouped by the
 * areas of the codebase (`dead.areas.mjs`) and leave out what is kept on purpose. Reads only; prints rows and counts.
 * These are candidates: an item built ahead for a scoped addition is not dead, and that is a person's call.
 *
 * Strictly zero emojis.
 */

/* global console, process */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AREAS, KEPT } from './dead.areas.mjs';

const uiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const knipConfig = path.join(uiRoot, 'scripts', 'knip.json');
const KINDS = ['exports', 'types', 'duplicates', 'dependencies', 'devDependencies', 'enumMembers', 'classMembers'];

/** knip's issues as JSON, with `extra` merged over `knip.json`. */
function runKnip(extra) {
  let config = knipConfig;
  if (extra) {
    const dir = path.join(uiRoot, 'node_modules/.cache/dead');
    fs.mkdirSync(dir, { recursive: true });
    config = path.join(dir, 'knip.json');
    fs.writeFileSync(config, JSON.stringify({ ...JSON.parse(fs.readFileSync(knipConfig, 'utf8')), ...extra }));
  }
  const bin = path.join(uiRoot, 'node_modules', '.bin', 'knip');
  const out = execFileSync(bin, ['--reporter', 'json', '--no-exit-code', '--config', config], { cwd: uiRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return JSON.parse(out).issues;
}

/** One row per reported item: its kind, name, file and line. */
function rowsOf(issues) {
  const rows = [];
  for (const issue of issues) {
    if (issue.files?.length) rows.push({ kind: 'file', name: path.basename(issue.file), file: issue.file, line: 0 });
    for (const kind of KINDS) {
      for (const item of issue[kind] ?? []) {
        const parts = Array.isArray(item) ? item : [item];
        rows.push({ kind, name: parts.map((p) => p.name).join(' = '), file: issue.file, line: parts[0].line ?? 0 });
      }
    }
  }
  return rows;
}

const keyOf = (row) => `${row.kind}|${row.name}|${row.file}`;
const isKept = (row) => KEPT.some((kept) => kept.name === row.name && kept.file === row.file);
const areaOf = (row) => AREAS.findIndex((area) => area.prefixes.some((prefix) => row.file.startsWith(prefix)));

const areaArg = process.argv.indexOf('--area');
const onlyArea = areaArg > 0 ? Number(process.argv[areaArg + 1]) - 1 : null;

const all = rowsOf(runKnip(null)).filter((row) => !isKept(row));
const unreadKeys = new Set(rowsOf(runKnip({ ignoreExportsUsedInFile: true })).map(keyOf));
const label = { exports: '', types: ' (type)', duplicates: ' (exported twice)', file: ' (file)', enumMembers: ' (enum member)', classMembers: ' (class member)' };

let dead = 0;
let overExported = 0;
AREAS.forEach((area, index) => {
  if (onlyArea !== null && onlyArea !== index) return;
  const mine = all.filter((row) => areaOf(row) === index).sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
  const unread = mine.filter((row) => unreadKeys.has(keyOf(row)));
  const ownFile = mine.filter((row) => !unreadKeys.has(keyOf(row)));
  dead += unread.length;
  overExported += ownFile.length;
  console.log(`\n## ${area.name}: ${unread.length} dead, ${ownFile.length} over-exported`);
  for (const [title, rows] of [['DEAD (no reader)', unread], ['OVER-EXPORTED (read only in its own file)', ownFile]]) {
    if (rows.length === 0) continue;
    console.log(`\n### ${title}`);
    for (const row of rows) console.log(`- \`${row.name}\`${label[row.kind] ?? ` (${row.kind})`} | ${row.file}:${row.line}`);
  }
});
console.log(`\n${dead} dead, ${overExported} over-exported. Candidates: an item built ahead for a scoped addition stays.`);
