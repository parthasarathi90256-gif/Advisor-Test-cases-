const { test, expect, caseOf } = require('../support/testcase');

const MODULE = 'Advisor Portal → Members';
const SEARCH = 'Search by name or email...';

// The grid is an ARIA table (role=table), not a <table> element. The header row
// holds columnheaders and the data rows hold cells, so filtering on cells is what
// separates real records from the header.
const dataRows = (page) => page.getByRole('row').filter({ has: page.getByRole('cell') });

/** Rows arrive from a client-side fetch after load, so always wait before counting. */
async function readyRows(page) {
  const rows = dataRows(page);
  await expect(rows.first()).toBeVisible({ timeout: 20000 });
  return rows;
}

test.describe('Members', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/wellness/members');
    await page.waitForLoadState('networkidle');
  });

  test(...caseOf({
    id: 'AP_TC_136',
    module: MODULE,
    scenario: 'Verify the Members list loads with member records and all column headers',
    preconditions: 'Advisor is logged in and at least one member is assigned.',
    steps: [
      'Open Members from the sidebar.',
      'Observe the column headers and the member rows.',
    ],
    data: 'Advisor account with assigned members',
    expected: 'The Members heading is shown, the MEMBER, EMPLOYER, STATUS, UPCOMING SESSION and '
      + 'ACTIONS column headers are present, and at least one member row is listed.',
  }), async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Members' })).toBeVisible();

    for (const h of ['MEMBER', 'EMPLOYER', 'STATUS', 'UPCOMING SESSION', 'ACTIONS']) {
      await expect(page.getByRole('columnheader', { name: h })).toBeVisible();
    }

    const rows = await readyRows(page);
    expect(await rows.count()).toBeGreaterThan(0);
  });

  test(...caseOf({
    id: 'AP_TC_137',
    module: MODULE,
    scenario: 'Verify searching by a valid member name filters the Members list',
    preconditions: 'Advisor is on the Members page with more than one member listed.',
    steps: [
      'Note the total number of member rows.',
      'Read an existing member name from the first row.',
      'Type that name into "Search by name or email...".',
      'Observe the filtered list.',
    ],
    data: 'Search term: the first listed member\'s first name',
    expected: 'The list narrows to rows matching the search term, at least one row remains, and '
      + 'the matching member is still displayed.',
  }), async ({ page }) => {
    const rows = await readyRows(page);
    const before = await rows.count();

    // Cell 0 is the member identity cell; take a real name so the test is seed-agnostic.
    const nameCell = (await rows.first().getByRole('cell').first().innerText()).trim();
    const term = nameCell.split('\n').filter(Boolean)[1] || nameCell.split(/\s+/)[1] || nameCell;

    await page.getByPlaceholder(SEARCH).fill(term);
    await page.waitForTimeout(1800);

    const after = await dataRows(page).count();
    expect(after, `no rows left after searching "${term}"`).toBeGreaterThan(0);
    expect(after).toBeLessThanOrEqual(before);
    await expect(page.getByText(term, { exact: false }).first()).toBeVisible();
  });

  test(...caseOf({
    id: 'AP_TC_138',
    module: MODULE,
    scenario: 'NEGATIVE - Verify searching for a member that does not exist returns no results',
    preconditions: 'Advisor is on the Members page with members listed.',
    steps: [
      'Confirm the list initially has member rows.',
      'Type a string that cannot match any member into the search box.',
      'Observe the list.',
    ],
    data: 'Search term: "zzzzz-no-such-member-9999"',
    expected: 'All member rows are removed and an empty-state message is displayed, rather than '
      + 'an unfiltered list or an application error.',
  }), async ({ page }) => {
    const rows = await readyRows(page);
    expect(await rows.count()).toBeGreaterThan(0);

    await page.getByPlaceholder(SEARCH).fill('zzzzz-no-such-member-9999');
    await page.waitForTimeout(2000);

    expect(await dataRows(page).count(), 'rows should be filtered out').toBe(0);
    await expect(
      page.getByText(/no (members?|results?|matches?)/i).first(),
    ).toBeVisible();
  });

  test(...caseOf({
    id: 'AP_TC_139',
    module: MODULE,
    scenario: 'Verify "Clear all" resets an applied search filter and restores the full list',
    preconditions: 'Advisor is on the Members page with a search term applied.',
    steps: [
      'Note the unfiltered row count.',
      'Enter a search term that filters every row out.',
      'Click "Clear all".',
      'Observe the search box and the list.',
    ],
    data: 'Search term: "zzzzz-no-such-member-9999"',
    expected: 'The search box is emptied and the member list is restored to its original row count.',
  }), async ({ page }) => {
    const rows = await readyRows(page);
    const before = await rows.count();

    await page.getByPlaceholder(SEARCH).fill('zzzzz-no-such-member-9999');
    await page.waitForTimeout(1800);

    await page.getByRole('button', { name: /Clear all/i }).click();
    await page.waitForTimeout(1800);

    await expect(page.getByPlaceholder(SEARCH)).toHaveValue('');
    await expect(dataRows(page).first()).toBeVisible({ timeout: 20000 });
    expect(await dataRows(page).count()).toBe(before);
  });

  test(...caseOf({
    id: 'AP_TC_140',
    module: MODULE,
    scenario: 'Verify the advisor can switch the Members view between Grid and List layouts',
    preconditions: 'Advisor is on the Members page in the default List view.',
    steps: [
      'Note the member row count in List view.',
      'Click the "Grid" view toggle and observe the layout.',
      'Click the "List" view toggle.',
      'Observe the list is restored with the same records.',
    ],
    data: 'N/A',
    expected: 'The records re-render as a card grid and back into a list, with the same number of '
      + 'members and no application error.',
  }), async ({ page }) => {
    const rows = await readyRows(page);
    const before = await rows.count();

    await page.getByRole('button', { name: 'Grid', exact: true }).click();
    await page.waitForTimeout(1500);
    await expect(page.getByRole('heading', { name: 'Members' })).toBeVisible();

    await page.getByRole('button', { name: 'List', exact: true }).click();
    await expect(dataRows(page).first()).toBeVisible({ timeout: 20000 });
    expect(await dataRows(page).count()).toBe(before);
  });
});
