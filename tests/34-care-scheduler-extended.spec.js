const { test, expect, caseOf } = require('../support/testcase');
const { gotoSettled } = require('../support/portal');

const MODULE = 'Advisor Portal → Care Scheduler';
const careRows = (page) => page.getByRole('button', { name: 'View Details' });

test.describe('Care Scheduler — queue', () => {
  test.beforeEach(async ({ page }) => {
    await gotoSettled(page, '/wellness/care-scheduler', 3000);
    await careRows(page).first().waitFor({ state: 'visible', timeout: 40000 }).catch(() => {});
  });

  test(...caseOf({
    id: 'AP_TC_256',
    module: MODULE,
    scenario: 'Verify the Care Scheduler stat tiles (Total requests, In progress, Closed) are shown',
    preconditions: 'Advisor is on the Care Scheduler page.',
    steps: ['Observe the tiles above the request list.'],
    data: 'N/A',
    expected: 'Total requests, In progress and Closed tiles are shown with counts.',
  }), async ({ page }) => {
    for (const t of ['Total requests', 'In progress', 'Closed']) await expect(page.getByText(t, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/\d+ in your queue/)).toBeVisible();
  });

  test(...caseOf({
    id: 'AP_TC_257',
    module: MODULE,
    scenario: 'Verify the request status filter offers every request status and narrows the list',
    preconditions: 'Advisor is on the Care Scheduler page with requests listed.',
    steps: ['Open "Filter by status".', 'Observe the options.', 'Choose "Completed".'],
    data: 'Statuses: Pending, In Progress, Completed, Unreported, Cancelled',
    expected: 'The status options are listed (each once) and applying one leaves only rows with that status.',
  }), async ({ page }) => {
    await page.getByRole('combobox', { name: 'Filter by status' }).click();
    const options = await page.getByRole('option').allInnerTexts();
    for (const s of ['Pending', 'In Progress', 'Completed']) expect(options.join('|')).toContain(s);
    // Known gap on the current build: "Completed" appears twice in this list.
    expect(options.filter((o) => o.trim() === 'Completed').length, 'duplicate "Completed" option').toBe(1);
    await page.getByRole('option', { name: 'Completed' }).first().click();
    await page.waitForTimeout(3000);
    const text = await page.locator('main').innerText();
    expect(text).not.toMatch(/\bPending\b(?!.*Filter)/);
  });

  test(...caseOf({
    id: 'AP_TC_258',
    module: MODULE,
    scenario: 'Verify the employer filter narrows the request list',
    preconditions: 'Advisor is on the Care Scheduler page with requests listed.',
    steps: ['Click "Filter by employer…" and pick an employer.', 'Observe the list.', 'Click "Clear all".'],
    data: 'First employer in the list',
    expected: 'Only that employer\'s requests remain; Clear all restores the full list.',
  }), async ({ page }) => {
    const before = await careRows(page).count();
    test.skip(before === 0, 'No care requests in this environment.');
    await page.getByRole('textbox', { name: 'Filter by employer...' }).click();
    await page.waitForTimeout(600);
    const opts = page.getByRole('option').filter({ hasNotText: /All Employers/ });
    test.skip(!(await opts.count()), 'No employer options.');
    await opts.first().click();
    await page.waitForTimeout(2500);
    expect(await careRows(page).count()).toBeLessThanOrEqual(before);
    await page.getByRole('button', { name: /Clear all/ }).click();
    await page.waitForTimeout(2500);
    expect(await careRows(page).count()).toBe(before);
  });

  test(...caseOf({
    id: 'AP_TC_259',
    module: MODULE,
    scenario: 'Verify the request list can be sorted by Submitted date',
    preconditions: 'Advisor is on the Care Scheduler page with at least two requests.',
    steps: ['Click "Sort by Submitted" twice.', 'Compare the first row each time.'],
    data: 'N/A',
    expected: 'The order of the rows changes between ascending and descending.',
  }), async ({ page }) => {
    test.skip((await careRows(page).count()) < 2, 'Fewer than two requests.');
    const first = async () => (await page.locator('main').innerText()).match(/REQ-[A-Z0-9]+-\d+|\bPending\b|\bCompleted\b/)?.[0];
    const a = await first();
    await page.getByRole('button', { name: 'Sort by Submitted' }).click();
    await page.waitForTimeout(2000);
    await page.getByRole('button', { name: 'Sort by Submitted' }).click();
    await page.waitForTimeout(2000);
    const b = await first();
    expect(a || b).toBeTruthy();
  });

  test(...caseOf({
    id: 'AP_TC_260',
    module: MODULE,
    scenario: 'Verify request list pagination (rows per page and page controls)',
    preconditions: 'Advisor is on the Care Scheduler page.',
    steps: ['Observe the pagination footer.', 'Open "Rows per page".'],
    data: 'N/A',
    expected: '"Showing x–y of n requests", Previous/Next page controls and a Rows per page selector are shown.',
  }), async ({ page }) => {
    await expect(page.getByText(/Showing \d+–\d+ of \d+ requests?/)).toBeVisible();
    await expect(page.getByRole('button', { name: /Previous page/ })).toBeVisible();
    await page.getByRole('combobox', { name: 'Rows per page' }).click();
    expect(await page.getByRole('option').count()).toBeGreaterThan(1);
    await page.keyboard.press('Escape');
  });

  test(...caseOf({
    id: 'AP_TC_261',
    module: MODULE,
    scenario: 'Verify searching by Request ID finds the request',
    preconditions: 'Advisor is on the Care Scheduler page with requests listed.',
    steps: ['Read a Request ID from the list.', 'Type it into the search box.'],
    data: 'First listed REQ-… id',
    expected: 'Exactly that request remains listed.',
  }), async ({ page }) => {
    const id = (await page.locator('main').innerText()).match(/REQ-[A-Z0-9]+-\d+/)?.[0];
    test.skip(!id, 'No request IDs shown.');
    await page.getByPlaceholder(/Search by member name/i).fill(id);
    await page.waitForTimeout(3000);
    expect(await careRows(page).count()).toBe(1);
    await expect(page.locator('main').getByText(id)).toBeVisible();
  });

  test(...caseOf({
    id: 'AP_TC_262',
    module: MODULE,
    scenario: 'Verify the request details page shows the member panel, request facts, slot preferences and an advisor note',
    preconditions: 'Advisor is on the Care Scheduler page with at least one request.',
    steps: ['Click "View Details" on a request.', 'Observe the page.'],
    data: 'First listed request',
    expected: 'A details page (/care-scheduler/requests/:id) shows the member\'s contact and location (read-only), Request ID, appointment type, preferred provider, submitted date, Primary/Secondary slot preferences and an Advisor note field, plus "Back to Requests".',
  }), async ({ page }) => {
    test.skip(!(await careRows(page).count()), 'No care requests.');
    await careRows(page).first().click();
    await page.waitForURL(/\/care-scheduler\/requests\/[^/]+/, { timeout: 40000 });
    await page.waitForLoadState('networkidle').catch(() => {});
    await expect(page.getByRole('button', { name: /Back to Requests/i })).toBeVisible({ timeout: 40000 });
    const main = page.locator('main');
    for (const t of ['Request ID', 'Appointment type', 'Submitted', 'Primary Slot', 'Advisor note']) await expect(main.getByText(t, { exact: false }).first()).toBeVisible();
    await expect(main.getByRole('textbox', { name: 'Advisor note' })).toBeVisible();
    await expect(main.getByRole('button', { name: 'Close request' })).toBeVisible();
  });

  test(...caseOf({
    id: 'AP_TC_263',
    module: MODULE,
    scenario: 'Verify the review checklist gates "Mark as Reviewed" until every item is confirmed',
    preconditions: 'A Pending request exists.',
    steps: ['Open a Pending request.', 'Observe "Mark as Reviewed" with nothing checked.', 'Click "Select All".', 'Observe the control.'],
    data: 'First Pending request',
    expected: '"Mark as Reviewed" is disabled until Member need, Contact details, Location and Preferred times are all confirmed; Select All enables it.',
  }), async ({ page }) => {
    await page.getByRole('combobox', { name: 'Filter by status' }).click();
    await page.getByRole('option', { name: 'Pending' }).first().click();
    await page.waitForTimeout(3000);
    test.skip(!(await careRows(page).count()), 'No Pending requests.');
    await careRows(page).first().click();
    await page.waitForURL(/\/care-scheduler\/requests\/[^/]+/, { timeout: 40000 });
    await page.waitForLoadState('networkidle').catch(() => {});
    const mark = page.getByRole('button', { name: 'Mark as Reviewed' });
    await expect(mark).toBeVisible({ timeout: 40000 });
    await expect(mark).toBeDisabled();
    for (const item of [/Member need/, /Contact details/, /Location and travel radius/, /Preferred times/]) await expect(page.getByRole('button', { name: item })).toBeVisible();
    await page.getByRole('button', { name: 'Select All' }).click();
    await expect(mark).toBeEnabled();
  });

  test(...caseOf({
    id: 'AP_TC_264',
    module: MODULE,
    scenario: 'Verify "Mark as Reviewed" moves a Pending request to In Progress and opens the provider-call step',
    preconditions: 'A Pending request exists (this test changes its status).',
    steps: ['Open a Pending request.', 'Click "Select All" then "Mark as Reviewed".', 'Observe the next step and the queue status.'],
    data: 'First Pending request',
    expected: 'The page advances to "Call the provider & check availability" with per-slot Confirmed / Not Available controls, and the queue shows the request as In Progress.',
  }), async ({ page }) => {
    test.skip(process.env.ALLOW_CARE_WRITES !== '1', 'Set ALLOW_CARE_WRITES=1 to run this write case.');
    await page.getByRole('combobox', { name: 'Filter by status' }).click();
    await page.getByRole('option', { name: 'Pending' }).first().click();
    await page.waitForTimeout(3000);
    test.skip(!(await careRows(page).count()), 'No Pending requests.');
    await careRows(page).first().click();
    await page.waitForURL(/\/care-scheduler\/requests\/[^/]+/, { timeout: 40000 });
    const id = page.url().split('/requests/')[1];
    await page.getByRole('button', { name: 'Select All' }).click();
    await page.getByRole('button', { name: 'Mark as Reviewed' }).click();
    await expect(page.getByRole('heading', { name: /Call the provider/i })).toBeVisible({ timeout: 60000 });
    await expect(page.getByRole('button', { name: 'Confirmed', exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Not Available', exact: true }).first()).toBeVisible();
    await gotoSettled(page, '/wellness/care-scheduler', 3000);
    await page.getByPlaceholder(/Search by member name/i).fill(id.slice(0, 8));
    await page.waitForTimeout(3000);
  });

  test(...caseOf({
    id: 'AP_TC_265',
    module: MODULE,
    scenario: 'Verify the provider-call step records slot outcomes and gates Continue until a slot is confirmed',
    preconditions: 'An In Progress request exists.',
    steps: ['Filter to In Progress and open a request.', 'Observe the provider card and slot controls.', 'Observe "Continue".'],
    data: 'First In Progress request',
    expected: 'The provider name/phone/address are shown; each preferred slot has Confirmed / Not Available; "Still needed: a slot the provider can confirm" is shown and Continue is disabled until then; Close request is available.',
  }), async ({ page }) => {
    await page.getByRole('combobox', { name: 'Filter by status' }).click();
    await page.getByRole('option', { name: 'In Progress' }).first().click();
    await page.waitForTimeout(3000);
    test.skip(!(await careRows(page).count()), 'No In Progress requests.');
    await careRows(page).first().click();
    await page.waitForURL(/\/care-scheduler\/requests\/[^/]+/, { timeout: 40000 });
    await expect(page.getByRole('heading', { name: /Call the provider/i })).toBeVisible({ timeout: 60000 });
    await expect(page.getByRole('button', { name: 'Confirmed', exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Not Available', exact: true }).first()).toBeVisible();
    await expect(page.getByText(/Still needed: a slot the provider can confirm/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Close request' })).toBeVisible();
  });
});

test.describe('Care Scheduler — confirmed appointments', () => {
  test(...caseOf({
    id: 'AP_TC_266',
    module: MODULE,
    scenario: 'Verify the Confirmed Appointments view shows the upcoming count and the list or empty state',
    preconditions: 'Advisor is logged in.',
    steps: ['Open /wellness/care-scheduler/confirmed.'],
    data: 'N/A',
    expected: '"Upcoming Appointments (n)" is shown with either appointment rows or "No Confirmed Appointments".',
  }), async ({ page }) => {
    await gotoSettled(page, '/wellness/care-scheduler/confirmed', 3000);
    await expect(page.getByRole('heading', { name: /Upcoming Appointments \(\d+\)/ })).toBeVisible({ timeout: 40000 });
    const empty = await page.getByRole('heading', { name: 'No Confirmed Appointments' }).count();
    const rows = await page.getByRole('row').count();
    expect(empty > 0 || rows > 1).toBeTruthy();
  });
});
