const { test, expect, caseOf } = require('../support/testcase');
const { gotoSettled } = require('../support/portal');

const dataRows = (page) => page.getByRole('row').filter({ has: page.getByRole('cell') });

test.describe('Dashboard — extended', () => {
  const MODULE = 'Advisor Portal → Dashboard';

  test.beforeEach(async ({ page }) => {
    await gotoSettled(page, '/wellness/dashboard', 4000);
    await expect(page.getByRole('button', { name: /Today's Sessions/ })).toBeVisible({ timeout: 40000 });
  });

  test(...caseOf({
    id: 'AP_TC_208',
    module: MODULE,
    scenario: 'Verify each Dashboard stat tile drills down to its page',
    preconditions: 'Advisor is on the Dashboard.',
    steps: ['Click Today\'s Sessions.', 'Return; click Care Requests Pending.', 'Return; click Total Members.', 'Return; click Sessions Completed.'],
    data: 'N/A',
    expected: 'Today\'s Sessions and Sessions Completed open /wellness/sessions, Care Requests Pending opens /wellness/care-scheduler, Total Members opens /wellness/members.',
  }), async ({ page }) => {
    const tiles = [[/Today's Sessions/, /\/wellness\/sessions/], [/Care Requests Pending/, /\/wellness\/care-scheduler/], [/Total Members/, /\/wellness\/members/], [/Sessions Completed/, /\/wellness\/sessions/]];
    for (const [name, url] of tiles) {
      await page.getByRole('button', { name }).click();
      await expect(page).toHaveURL(url, { timeout: 40000 });
      await gotoSettled(page, '/wellness/dashboard', 4000);
      await expect(page.getByRole('button', { name: /Today's Sessions/ })).toBeVisible({ timeout: 40000 });
    }
  });

  test(...caseOf({
    id: 'AP_TC_209',
    module: MODULE,
    scenario: 'Verify the Upcoming Sessions and Tasks & Follow-ups "View all" links navigate',
    preconditions: 'Advisor is on the Dashboard.',
    steps: ['Click "View all" on Upcoming Sessions.', 'Return; click "View all" on Tasks & Follow-ups.'],
    data: 'N/A',
    expected: 'Upcoming Sessions opens /wellness/sessions and Tasks & Follow-ups opens /wellness/care-scheduler.',
  }), async ({ page }) => {
    await page.getByRole('button', { name: 'View all' }).nth(1).click();
    await expect(page).toHaveURL(/\/wellness\/sessions/, { timeout: 40000 });
    await gotoSettled(page, '/wellness/dashboard', 4000);
    await page.getByRole('button', { name: 'View all' }).nth(2).click();
    await expect(page).toHaveURL(/\/wellness\/care-scheduler/, { timeout: 40000 });
  });

  test(...caseOf({
    id: 'AP_TC_210',
    module: MODULE,
    scenario: 'Verify the Recent Members, Upcoming Sessions and Tasks & Follow-ups panels render their content',
    preconditions: 'Advisor is on the Dashboard with members and care requests.',
    steps: ['Observe the three panels.'],
    data: 'N/A',
    expected: 'Recent Members shows "n of m · newest first" with member cards and join dates; Upcoming Sessions lists next sessions (or an empty state); Tasks & Follow-ups lists open care requests with days open.',
  }), async ({ page }) => {
    await expect(page.getByText(/Recent Members \d+ of \d+/)).toBeVisible();
    await expect(page.getByText(/Joined on:/).first()).toBeVisible();
    await expect(page.getByText(/Upcoming Sessions/).first()).toBeVisible();
    await expect(page.getByText(/Tasks & Follow-ups/).first()).toBeVisible();
    await expect(page.getByText(/\d+ days? open/).first()).toBeVisible();
  });
});

test.describe('Members — extended', () => {
  const MODULE = 'Advisor Portal → Members';

  test.beforeEach(async ({ page }) => {
    await gotoSettled(page, '/wellness/members', 3000);
    await expect(dataRows(page).first()).toBeVisible({ timeout: 40000 });
  });

  test(...caseOf({
    id: 'AP_TC_211',
    module: MODULE,
    scenario: 'Verify the member status filter offers Active / Pending and filters the list',
    preconditions: 'Advisor is on the Members page.',
    steps: ['Open "Filter by status".', 'Choose "Active".', 'Observe the STATUS column.'],
    data: 'Status: Active',
    expected: 'All / Active / Pending are offered and every remaining row shows the chosen status.',
  }), async ({ page }) => {
    await page.getByRole('combobox', { name: 'Filter by status' }).click();
    for (const o of ['All Status', 'Active', 'Pending']) await expect(page.getByRole('option', { name: o })).toBeVisible();
    await page.getByRole('option', { name: 'Active' }).click();
    await page.waitForTimeout(2500);
    const rows = await dataRows(page).allInnerTexts();
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(r).toMatch(/Active/);
  });

  test(...caseOf({
    id: 'AP_TC_212',
    module: MODULE,
    scenario: 'Verify the employer filter narrows the list to one employer',
    preconditions: 'Advisor is on the Members page with members from more than one employer.',
    steps: ['Click "Filter by employer…" and pick an employer.', 'Observe the EMPLOYER column.', 'Click "Clear all".'],
    data: 'First employer option',
    expected: 'Every remaining row belongs to the chosen employer; Clear all restores the full list.',
  }), async ({ page }) => {
    const before = await dataRows(page).count();
    await page.getByRole('textbox', { name: 'Filter by employer...' }).click();
    await page.waitForTimeout(600);
    const opt = page.getByRole('option').filter({ hasNotText: /All Employers/ }).first();
    test.skip(!(await opt.count()), 'No employer options.');
    const employer = (await opt.innerText()).trim();
    await opt.click();
    await page.waitForTimeout(2500);
    const rows = await dataRows(page).allInnerTexts();
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(r).toContain(employer);
    await page.getByRole('button', { name: /Clear all/ }).click();
    await page.waitForTimeout(2500);
    expect(await dataRows(page).count()).toBe(before);
  });

  test(...caseOf({
    id: 'AP_TC_213',
    module: MODULE,
    scenario: 'Verify clicking a column header sorts the list',
    preconditions: 'Advisor is on the Members page with several members.',
    steps: ['Note the first member.', 'Click the "Member" column header twice.', 'Compare the first member.'],
    data: 'N/A',
    expected: 'The order changes between ascending and descending.',
  }), async ({ page }) => {
    const first = async () => (await dataRows(page).first().innerText()).split('\n')[0];
    const a = await first();
    await page.getByRole('columnheader', { name: 'Member' }).getByRole('button').click();
    await page.waitForTimeout(1500);
    await page.getByRole('columnheader', { name: 'Member' }).getByRole('button').click();
    await page.waitForTimeout(1500);
    const b = await first();
    expect(b).not.toBe(a);
  });

  test(...caseOf({
    id: 'AP_TC_214',
    module: MODULE,
    scenario: 'Verify the Members stat tiles include Total, Completed Sessions, Pending Members and Upcoming Sessions',
    preconditions: 'Advisor is on the Members page.',
    steps: ['Observe the tiles.'],
    data: 'N/A',
    expected: 'Total Members, Completed Sessions, Pending Members and Upcoming Sessions tiles are shown with counts.',
  }), async ({ page }) => {
    for (const t of ['Total Members', 'Completed Sessions', 'Pending Members', 'Upcoming Sessions']) await expect(page.getByText(t, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/\d+ assigned to you/)).toBeVisible();
  });

  test(...caseOf({
    id: 'AP_TC_215',
    module: MODULE,
    scenario: 'Verify Grid view shows one card per member with a View action',
    preconditions: 'Advisor is on the Members page in List view.',
    steps: ['Note the row count.', 'Click "Grid".', 'Count the View actions.'],
    data: 'N/A',
    expected: 'Grid view shows the same number of member cards (View actions) as the list had rows.',
  }), async ({ page }) => {
    const rows = await dataRows(page).count();
    await page.getByRole('button', { name: 'Grid', exact: true }).click();
    await page.waitForTimeout(2500);
    expect(await page.getByRole('button', { name: 'View', exact: true }).count()).toBe(rows);
  });
});
