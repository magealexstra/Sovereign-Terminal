/**
 * commentCheck.run.mjs -- `npm run comments:check -- <file or folder> ...`: the comments that break the comment
 * standard: a comment says what the code does and why, as it stands, with no history.
 *
 * Reads the comments of each TypeScript, JavaScript and Python file named (a folder is walked) and lists every
 * line that carries a mark of history. Two kinds of mark: IDS (a quest, phase, task or bug id, a date), which
 * are never right in a comment, and WORDING ("no longer", "previously", "was replaced"), which
 * usually tells what the code used to do and is sometimes plain description: read those before changing them.
 * Prints `file:line [kind] the comment line`, then the counts. Exits 1 when an IDS mark is found, else 0. Reads
 * only. Paths are taken from the project root, else from the folder the command is run in.
 *
 * A checkout may add its own IDS patterns (names, local ticket formats) in `.agents/comment-check-ids.txt`, one
 * regular expression per line, matched without regard to case. The file is optional and git-ignored.
 *
 * Strictly zero emojis.
 */

/* global console, process */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const SCRIPT_KINDS = new Set(['.ts', '.tsx', '.mts', '.js', '.jsx', '.mjs']);
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', '.venv', '__pycache__', '_temp_trash', '.agents', 'venv']);

const IDS = [
  /\bQuest\s+\d{3,4}/i,
  /\b\d{4}(-\d)?\s+(Phase|Task)\s+\d/,
  /\b(Phase|Task|Cleanup|Wave|Batch)\s+[0-9A-Z]{1,3}\b/,
  /\bBUG-\d+/,
  /\b20\d\d-\d\d-\d\d\b/,
  /\bP\d-[A-Z]\b/,
];
const WORDING = [
  /\bno longer\b/i,
  /\b(previously|formerly|originally)\b/i,
  /\bused to\b/i,
  /\b(was|were|is|are|been|got) (replaced|removed|retired|renamed|rewritten|superseded|split out|moved|dropped|deleted)\b/i,
  /\b(replaces|replaced by|superseded by|rewritten for|split (out )?from|moved (here )?from|landed|retired)\b/i,
  /\b(legacy|deprecated|backward|backwards)\b/i,
];

/** Every comment of a script file as `{ line, text }` rows, one per source line of the comment. */
function scriptComments(source, isTsx) {
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, isTsx ? ts.LanguageVariant.JSX : ts.LanguageVariant.Standard, source);
  const starts = ts.computeLineStarts(source);
  const rows = [];
  for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
    if (token !== ts.SyntaxKind.SingleLineCommentTrivia && token !== ts.SyntaxKind.MultiLineCommentTrivia) continue;
    const first = ts.computeLineAndCharacterOfPosition(starts, scanner.getTokenStart()).line;
    scanner.getTokenText().split('\n').forEach((text, offset) => rows.push({ line: first + offset + 1, text }));
  }
  return rows;
}

/** Every `#` comment and docstring line of a Python file. A `#` inside a string on a code line is read as one. */
function pythonComments(source) {
  const rows = [];
  let inDoc = null;
  source.split('\n').forEach((text, index) => {
    const quote = /("""|''')/.exec(text)?.[1];
    if (inDoc) {
      rows.push({ line: index + 1, text });
      if (text.includes(inDoc)) inDoc = null;
    } else if (quote && /^\s*[rRbBuU]?("""|''')/.test(text)) {
      rows.push({ line: index + 1, text });
      if (text.indexOf(quote, text.indexOf(quote) + 3) < 0) inDoc = quote;
    } else if (/(^|\s)#/.test(text)) {
      rows.push({ line: index + 1, text: text.slice(text.search(/(^|\s)#/)) });
    }
  });
  return rows;
}

/** The files under `target` this check reads. */
function filesOf(target) {
  const stat = fs.statSync(target);
  if (stat.isFile()) return [target];
  return fs.readdirSync(target, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) return SKIP_DIRS.has(entry.name) ? [] : filesOf(path.join(target, entry.name));
    const kind = path.extname(entry.name);
    return SCRIPT_KINDS.has(kind) || kind === '.py' ? [path.join(target, entry.name)] : [];
  });
}

const targets = process.argv.slice(2);
if (targets.length === 0) {
  console.log('usage: npm run comments:check -- <file or folder> ...');
  process.exit(2);
}

let ids = 0;
let wording = 0;
let filesWithMarks = 0;
// A path is taken from the project root when it exists there, else from the folder the command is run in.
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const fromRoot = (target) => (!path.isAbsolute(target) && fs.existsSync(path.join(projectRoot, target)) ? path.join(projectRoot, target) : target);
const localIdsFile = path.join(projectRoot, '.agents', 'comment-check-ids.txt');
if (fs.existsSync(localIdsFile)) {
  for (const line of fs.readFileSync(localIdsFile, 'utf8').split('\n')) {
    if (line.trim()) IDS.push(new RegExp(line.trim(), 'i'));
  }
}
const files = targets.map(fromRoot).flatMap(filesOf);
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const kind = path.extname(file);
  const comments = kind === '.py' ? pythonComments(source) : scriptComments(source, kind === '.tsx' || kind === '.jsx');
  let marked = false;
  for (const { line, text } of comments) {
    const mark = IDS.some((re) => re.test(text)) ? 'ids' : WORDING.some((re) => re.test(text)) ? 'wording' : null;
    if (!mark) continue;
    if (mark === 'ids') ids += 1; else wording += 1;
    marked = true;
    console.log(`${path.relative(projectRoot, path.resolve(file))}:${line} [${mark}] ${text.trim().slice(0, 150)}`);
  }
  if (marked) filesWithMarks += 1;
}
console.log(`\n${files.length} files read, ${filesWithMarks} with marks: ${ids} ids, ${wording} wording.`);
process.exit(ids > 0 ? 1 : 0);
