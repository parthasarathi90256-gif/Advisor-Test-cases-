/**
 * caseOf() - carry a test's test-case document fields alongside the test itself,
 * so `npm run excel` can emit a proper QA sheet with no duplicate bookkeeping.
 * The metadata rides along as Playwright annotations.
 *
 * Spread it into test() so Playwright still attributes the test to YOUR spec
 * file. (Calling test() from inside a helper makes every test report its
 * location as this file, which breaks report links and jump-to-test.)
 *
 *   test(...caseOf({ id: 'TC-MEM-001', ... }), async ({ page }) => { ... });
 *   test.skip(...caseOf({ ... }), async ({ page }) => { ... });   // parks a case
 */
const { test, expect } = require('@playwright/test');

// These are the sheet's columns. `id` and `scenario` come from the test title;
// `actual` and `status` come from the run. Anything else is not in the document.
const FIELDS = ['module', 'preconditions', 'steps', 'data', 'expected'];

/** Arrays become numbered lines - "1. ...\n2. ..." - matching the team sheet. */
function format(value) {
  if (Array.isArray(value)) return value.map((s, i) => `${i + 1}. ${s}`).join('\n');
  return String(value === undefined || value === null ? '' : value);
}

function caseOf(meta) {
  if (!meta || !meta.id) throw new Error('caseOf() needs an `id`, e.g. "TC-MEM-001".');
  if (!meta.scenario) throw new Error(`${meta.id}: caseOf() needs a \`scenario\`.`);

  // Fail loudly instead of silently running a case the author meant to park.
  for (const flag of ['skip', 'only', 'fixme']) {
    if (flag in meta) {
      throw new Error(
        `${meta.id}: \`${flag}\` is not a caseOf() field - it would be ignored and the ` +
        `test would still run. Use the Playwright modifier instead:\n` +
        `    test.${flag === 'fixme' ? 'fixme' : flag}(...caseOf({ /* no ${flag} key */ }), async ({ page }) => { ... });`
      );
    }
  }

  const annotation = FIELDS
    .filter((f) => meta[f] !== undefined)
    .map((f) => ({ type: f, description: format(meta[f]) }));

  return [`${meta.id}: ${meta.scenario}`, { annotation }];
}

module.exports = { caseOf, test, expect, FIELDS };
