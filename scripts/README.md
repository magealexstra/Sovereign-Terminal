# Developer tools

Read-only checks and structural edits for working on Sovereign Terminal. None of this ships in the
app: the tools are dev dependencies, and the runtime image holds only the built front end and the server.

Run every command from the project root. Paths are given from the project root
(`src/hooks/useToast.js`).

## Setup

`npm install` covers the JavaScript tools. The two Python tools need their own environment once:

```
python3 -m venv scripts/.venv
scripts/.venv/bin/pip install -r scripts/requirements-dev.txt
```

## Reading (changes nothing)

| Job | Command |
| :-- | :-- |
| Lint (oxlint) | `npm run lint` |
| Type check of the JavaScript, against a baseline | `npm run typecheck [-- --update]` |
| Dead and over-exported code, by area (knip) | `npm run dead [-- --area <n>]` |
| Every reference to a symbol, by the type checker | `npm run morph:refs -- <name> [--file <declaring-file>]` |
| Who imports a file, transitively, and import cycles | `npm run graph -- <file-or-dir> [--depth N]` |
| Every relative import resolves | `npm run morph:check [-- --forbid <old-file>]` |
| Comments that tell history instead of describing the code | `npm run comments:check -- <file or folder> ...` |
| Unused Python in `server/` (vulture) | `npm run py:dead` |
| Python lint in `server/` (ruff) | `npm run py:lint [-- --statistics]` |

`npm run typecheck` runs the TypeScript checker over the plain JavaScript. The findings the code
already carries are listed in `scripts/typecheck/typecheck.baseline.txt`; the command fails only on
a finding the baseline lacks, so a change may not add one. After fixing some, `-- --update` rewrites
the baseline. Never use `--update` to pass a new finding.

## Editing (ts-morph)

Every command prints what it did and runs the import check after it saves. Each takes `--root <dir>`
to run against a scratch copy of the tree; the copy needs `scripts/tsconfig.json`.

| Job | Command |
| :-- | :-- |
| Rename a symbol, a local or a parameter everywhere | `npm run morph:rename -- <file-or-folder> <name> <newName> [--every] [--line <n>] [--dry]` |
| Move or rename a file or a directory | `npm run morph:move -- <from> <to> [--dry]` |
| Drop an `export` nothing outside its file reads | `npm run morph:unexport -- <name> --file <file> [--dry]`, or `--list <listing>` |
| Move declarations to a sibling file | `npm run morph:extract -- <sourceFile> <targetFile> <name> [<name> ...] [--dry-run]` |
| Split a file into a module directory | `npm run morph:split -- <file> --map <suffix>=<declA>,<declB> ... [--rest <suffix>] [--dry]` |

- `morph:rename` goes through the language service: only true references change, never a same-named
  local elsewhere. It refuses a new name already declared in a file it would change.
- `morph:rename` and `morph:move` never rewrite comments or strings. They list the lines that name
  the old symbol or file, to be changed by hand.
- `morph:unexport` confirms each candidate by the type checker and prints a reason for every
  refusal. It accepts the lines of `npm run dead` as its `--list`.
- `morph:extract` moves named top-level declarations, with the imports they need, to a sibling file
  and re-points every importer. A dynamic `import()` of the source is listed as a warning, not
  rewritten.
- `morph:split` turns `Foo.jsx` into `Foo/` with `Foo.<suffix>.js` or `.jsx` submodules and an
  `index.js` that re-exports the same public API, default export included, so no importer changes.
  Every top-level declaration must be mapped, or pass `--rest`. The original moves to
  `_temp_trash/morph.split/`. Each submodule gets a stub header to rewrite.

Run `npm run lint`, `npm run typecheck` and `npm run build` after any edit.

## Limits

- The project is plain JavaScript, loaded through `scripts/tsconfig.json` with `allowJs`. The type
  checker follows imports and bindings, not shapes: a property read through an object
  (`settings.foo`) is not a reference `morph:refs` can prove.
- `npm run dead` lists candidates. A `localStorage` key, a name built from a string and anything
  the server calls are invisible to it. Read the code before removing anything.
- `npm run py:dead` skips functions under `@router.*` and `@app.*` decorators. Whether the front
  end calls an endpoint is a read, not a tool result.
- CSS is covered by no tool here.

## Layout

| Path | What it holds |
| :-- | :-- |
| `scripts/morph/` | the ts-morph commands and their shared project loader |
| `scripts/dead/` | the knip runner and the areas it groups by |
| `scripts/graph/` | the importer graph (dependency-cruiser) |
| `scripts/commentCheck/` | the comment check |
| `scripts/typecheck/` | the type check runner and its baseline |
| `scripts/knip.json`, `scripts/dependency-cruiser.cjs`, `scripts/tsconfig.json` | tool configuration |
| `scripts/requirements-dev.txt` | the Python tools |
