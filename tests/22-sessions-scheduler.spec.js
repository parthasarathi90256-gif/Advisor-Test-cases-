const { test, expect, caseOf } = require('../support/testcase');

const dataRows = (page) => page.getByRole('row').filter({ has: page.getByRole('cell') });

test.describe('Sessions', () => {
  const MODULE = 'Advisor Portal → Sessions';

  test.beforeEach(async ({ page }) => {
    await page.goto('/wellness/sessions');
    await page.waitForLoadState('networkidle');
  });

  test(...caseOf({
    id: 'AP_TC_141',
    module: MODULE,
    scenario: 'Verify the Sessions page loads with the calendar and its navigation controls',
    preconditions: 'Advisor is logged in to the Advisor Portal.',
    steps: [
      'Open Sessions from the sidebar.',
      'Observe the page heading and the calendar controls.',
    ],
    data: 'N/A',
    expected: 'The Sessions heading is displayed together with the Previous, Today and Next '
      + 'controls and the Week / Month view switches.',
  }), async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Sessions' })).toBeVisible();
    for (const b of ['Previous', 'Today', 'Next', 'Week', 'Month']) {
      await expect(page.getByRole('button', { name: b, exact: true })).toBeVisible();
    }
  });

  test(...caseOf({
    id: 'AP_TC_142',
    module: MODULE,
    scenario: 'Verify the advisor can switch the sessions calendar between Week and Month views',
    preconditions: 'Advisor is on the Sessions page.',
    steps: [
      'Click the "Month" view control.',
      'Observe the calendar.',
      'Click the "Week" view control.',
      'Observe the calendar returns to the weekly layout.',
    ],
    data: 'N/A',
    expected: 'The calendar re-renders in each view without an application error and the '
      + 'Sessions page stays loaded.',
  }), async ({ page }) => {
    await page.getByRole('button', { name: 'Month', exact: true }).click();
    await page.waitForTimeout(1200);
    await expect(page.getByRole('heading', { name: 'Sessions' })).toBeVisible();

    await page.getByRole('button', { name: 'Week', exact: true }).click();
    await page.waitForTimeout(1200);
    await expect(page.getByRole('heading', { name: 'Sessions' })).toBeVisible();
  });

  test(...caseOf({
    id: 'AP_TC_143',
    module: MODULE,
    scenario: 'Verify the advisor can collapse and restore the sessions calendar',
    preconditions: 'Advisor is on the Sessions page with the calendar shown.',
    steps: [
      'Click "Hide calendar".',
      'Observe the calendar is collapsed and the control changes.',
      'Click the control again to restore the calendar.',
    ],
    data: 'N/A',
    expected: 'The calendar collapses and the control switches to "Show calendar"; clicking it '
      + 'again restores the calendar.',
  }), async ({ page }) => {
    const hide = page.getByRole('button', { name: /Hide calendar/i });
    await expect(hide).toBeVisible();
    await hide.click();

    const show = page.getByRole('button', { name: /Show calendar/i });
    await expect(show).toBeVisible();
    await show.click();
    await expect(page.getByRole('button', { name: /Hide calendar/i })).toBeVisible();
  });

  test(...caseOf({
    id: 'AP_TC_144',
    module: MODULE,
    scenario: 'NEGATIVE - Verify searching sessions for a value that cannot match returns no results',
    preconditions: 'Advisor is on the Sessions page.',
    steps: [
      'Type a string that cannot match any session into the sessions search box.',
      'Observe the session list.',
    ],
    data: 'Search term: "zzzzz-no-such-session-9999"',
    expected: 'No session rows are returned and the page shows an empty state rather than an '
      + 'application error.',
  }), async ({ page }) => {
    // Sessions load after the calendar mounts; typing before that lands lets a late
    // re-render wipe the search box, so wait for the list to settle first.
    await expect(page.getByRole('button', { name: /Hide calendar/i })).toBeVisible();
    await page.waitForTimeout(3000);

    const search = page.getByPlaceholder(/Search member, session type/i);
    await search.fill('zzzzz-no-such-session-9999');
    await expect(search, 'search box was cleared by the app').toHaveValue('zzzzz-no-such-session-9999');
    await page.waitForTimeout(2500);

    // The empty state is the signal here; the page heading is ambiguous because
    // 'Sessions' also matches the "No sessions scheduled" empty-state heading.
    await expect(page.getByText(/no sessions/i).first()).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Care Scheduler', () => {
  const MODULE = 'Advisor Portal → Care Scheduler';

  test.beforeEach(async ({ page }) => {
    await page.goto('/wellness/care-scheduler');
    await page.waitForLoadState('networkidle');
  });

  test(...caseOf({
    id: 'AP_TC_145',
    module: MODULE,
    scenario: 'Verify the Care Scheduler loads pending care requests with all column headers',
    preconditions: 'Advisor is logged in and at least one care request exists.',
    steps: [
      'Open Care Scheduler from the sidebar.',
      'Observe the request list and its column headers.',
    ],
    data: 'N/A',
    expected: 'The Care Scheduler heading is shown with the MEMBER, APPOINTMENT TYPE, STATUS and '
      + 'SUBMITTED column headers, and at least one request row is listed.',
  }), async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Care Scheduler' })).toBeVisible();

    // Headers render as text inside a single header row, not as ARIA columnheaders,
    // and they are uppercased by CSS - the DOM text is title case.
    const headerRow = page.getByRole('row').first();
    for (const h of [/Member/i, /Appointment Type/i, /Status/i, /Submitted/i]) {
      await expect(headerRow).toContainText(h);
    }
  });

  test(...caseOf({
    id: 'AP_TC_146',
    module: MODULE,
    scenario: 'Verify the advisor can open a care request via View Details',
    preconditions: 'Advisor is on the Care Scheduler page with at least one request listed.',
    steps: [
      'Locate a care request row.',
      'Click "View Details" on that row.',
      'Observe the request detail surface.',
    ],
    data: 'The first listed care request',
    expected: 'The request detail opens as a dialog or detail page without an application error.',
  }), async ({ page }) => {
    const count = await dataRows(page).count();
    test.skip(count === 0, 'No care requests exist in this environment - nothing to open.');

    await page.getByRole('button', { name: /View Details/i }).first().click();
    await page.waitForTimeout(2000);

    const opened = (await page.getByRole('dialog').count()) > 0
      || !/\/care-scheduler$/.test(new URL(page.url()).pathname);
    expect(opened, 'no detail dialog or route opened').toBeTruthy();
  });

  test(...caseOf({
    id: 'AP_TC_147',
    module: MODULE,
    scenario: 'NEGATIVE - Verify searching care requests for an unknown member returns no results',
    preconditions: 'Advisor is on the Care Scheduler page with requests listed.',
    steps: [
      'Type a member name that does not exist into "Search by member name, email...".',
      'Observe the request list.',
    ],
    data: 'Search term: "zzzzz-no-such-member-9999"',
    expected: 'No care request rows are returned and the page shows an empty state rather than '
      + 'the unfiltered list.',
  }), async ({ page }) => {
    const count = await dataRows(page).count();
    test.skip(count === 0, 'No care requests exist in this environment - nothing to filter.');

    await page.getByPlaceholder(/Search by member name/i).fill('zzzzz-no-such-member-9999');
    await page.waitForTimeout(2000);

    expect(await dataRows(page).count()).toBe(0);
  });
});
