/**
 * dead.areas.mjs -- how `npm run dead` groups and filters what knip reports: the areas of the
 * codebase (matched in order by path prefix from the project root) and the items
 * kept on purpose, which are never listed.
 *
 * Strictly zero emojis.
 */

/** The areas, first match wins; the last takes everything else. */
export const AREAS = [
  { name: '1. The terminal', prefixes: ['src/components/terminal/', 'src/hooks/useSessions.js'] },
  { name: '2. The explorer, viewer and editor', prefixes: ['src/components/explorer/', 'src/utils/'] },
  { name: '3. Settings', prefixes: ['src/components/settings/'] },
  { name: '4. The app shell, contexts, hooks and dependencies', prefixes: [''] },
];

/** Kept on purpose: an export by its name and file, a dependency by its name. */
export const KEPT = [];
