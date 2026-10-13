/**
 * morph.checkImports -- verifies every relative and `@/` import, export-from,
 * `import()` and `import('x').T` specifier in the project
 * resolves to a file that exists. `--forbid <file>` (repeatable) also fails
 * any specifier that still resolves to that file (a moved or split module).
 *
 *   npx tsx scripts/morph/morph.checkImports.ts [--forbid <file>]... [--root <project-root>]
 *
 * Exit 0 clean, 1 unresolved or forbidden imports, 2 usage error.
 */
import { parseArgs } from 'node:util';
import { DEFAULT_UI_ROOT, loadProject, reportImportCheck, resolveUserPath } from './morph.project.ts';

const { values } = parseArgs({
  options: {
    forbid: { type: 'string', multiple: true, default: [] },
    root: { type: 'string', default: DEFAULT_UI_ROOT },
  },
});

const ctx = loadProject(resolveUserPath(process.cwd(), values.root));
const forbid = values.forbid.map((f) => resolveUserPath(ctx.uiRoot, f));
process.exit(reportImportCheck(ctx, forbid));
