/**
 * dependency-cruiser config. Used by `npm run graph -- <file>`
 * (transitive importers of a file, the blast radius before an edit) and
 * directly: `npx depcruise src --config scripts/dependency-cruiser.cjs`.
 *
 * An import cycle is a warning; an import that resolves to no file is an error.
 */
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      comment: 'Import cycle. Break it by moving the shared piece into its own family-prefixed module.',
      severity: 'warn',
      from: { path: '^src/' },
      to: { circular: true },
    },
    {
      name: 'not-to-unresolvable',
      comment: 'Import that does not resolve to a file on disk (moved or deleted module).',
      severity: 'error',
      from: { path: '^src/' },
      to: { couldNotResolve: true, pathNot: '\\?(url|raw)$' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(^|/)node_modules/' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      mainFields: ['module', 'main', 'types', 'typings'],
    },
  },
};
