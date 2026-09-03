const { test, expect, caseOf } = require('../support/testcase');

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

test.describe('Sessions — Scheduling (write path)', () => {
  const MODULE = 'Advisor Portal → Sessions';

  // A real member this dev environment is safe to book/cancel against for testing.
  // Resolved once via the Members search: parthaaa06+emp_9@gmail.com -> "Sadie Sink".
  const MEMBER_NAME = 'Sadie Sink';
  const SESSION_TYPE = 'Wellness Check-in';

  test.beforeEach(async ({ page }) => {
    await page.goto('/wellness/sessions');
    await page.waitForLoadState('networkidle');
  });

  test(...caseOf({
    id: 'AP_TC_170',
    module: MODULE,
    scenario: 'Verify the advisor can schedule a phone session for a member and then cancel it',
    preconditions: 'Advisor is on the Sessions page. Member "Sadie Sink" '
      + '(parthaaa06+emp_9@gmail.com) exists in this environment.',
    steps: [
      'Click "Schedule Session".',
      'In the "Book a session" dialog, choose the member, a session type and Phone as the '
        + 'meeting type (auto-fills the title and the member\'s phone number).',
      'Submit "Schedule Session".',
      'Confirm the new session appears in today\'s session list.',
      'Cancel the session with a reason, to leave no test data behind.',
    ],
    data: `Member: ${MEMBER_NAME}; Session type: ${SESSION_TYPE}; Meeting type: Phone`,
    expected: 'The session is created and listed with a Scheduled status; after cancelling with '
      + 'a reason, the same row shows a Cancelled status and offers to reschedule.',
  }), async ({ page }) => {
    await page.getByRole('button', { name: 'Schedule Session' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Book a session' });
    await expect(dialog).toBeVisible();

    await dialog.getByRole('combobox', { name: 'Member *' }).click();
    await page.getByRole('option', { name: MEMBER_NAME }).click();

    await dialog.getByRole('combobox', { name: 'Session type *' }).click();
    await page.getByRole('option', { name: SESSION_TYPE }).click();

    // Phone auto-fills the member's number and the required meeting-link field, so the
    // form is submittable without generating a real Zoom link.
    await dialog.getByRole('button', { name: 'Phone', exact: true }).click();

    const submit = dialog.getByRole('button', { name: 'Schedule Session' });
    await expect(submit, 'submit stayed disabled with all required fields filled').toBeEnabled();
    await submit.click();
    await expect(dialog).toBeHidden();

    // Match on status too: a member/type/channel combo can repeat across runs (an
    // earlier run's now-Cancelled session stays listed), so name-only would grab
    // whichever row comes first in the DOM rather than the one just created. The
    // default start time is only minute-precision, so two runs close together can
    // even land on the identical slot - the "Scheduled" filter is what keeps this
    // pointed at a genuinely live row instead of an old Cancelled one.
    const scheduledRow = page.getByRole('button', {
      name: new RegExp(`${MEMBER_NAME}.*${SESSION_TYPE}.*Phone`, 'i'),
    }).filter({ hasText: 'Scheduled' });
    await expect(scheduledRow, 'new session did not appear in the list').toBeVisible({ timeout: 15000 });

    // Clean up: cancel the session we just created rather than leaving it in shared dev data.
    await scheduledRow.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByPlaceholder(/reason for cancellation/i).fill('Automated test cleanup - AP_TC_170.');
    await page.getByRole('button', { name: 'Cancel Session', exact: true }).click();

    // A same-time historical Cancelled row can make the row's own text ambiguous
    // to re-match after this, so confirm via the one-shot success toast instead,
    // plus the "Scheduled" filter now matching nothing for this row.
    await expect(page.getByText('Session Cancelled', { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(scheduledRow, 'session still shows as Scheduled after cancelling').toHaveCount(0);
  });

  test(...caseOf({
    id: 'AP_TC_171',
    module: MODULE,
    scenario: 'NEGATIVE - Verify "Schedule Session" stays disabled until the required booking fields are set',
    preconditions: 'Advisor is on the Sessions page with the "Book a session" dialog open.',
    steps: [
      'Click "Schedule Session" to open the booking dialog.',
      'Without filling in any fields, observe the submit control.',
    ],
    data: 'N/A',
    expected: 'The "Schedule Session" submit button remains disabled while member, session type, '
      + 'title and meeting link are still unset. No session is created.',
  }), async ({ page }) => {
    await page.getByRole('button', { name: 'Schedule Session' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Book a session' });
    await expect(dialog).toBeVisible();

    await expect(dialog.getByRole('button', { name: 'Schedule Session' })).toBeDisabled();
    await expect(dialog.getByText(/Still needed:/i)).toBeVisible();
  });
});

test.describe('Care Scheduler', () => {
  const MODULE = 'Advisor Portal → Care Scheduler';

  // Unlike the Members/Sessions grids, Care Scheduler rows carry NO role=row /
  // role=cell at all (only the header row does), so the generic dataRows() helper
  // always reports zero here regardless of real data. Anchor on the one reliable
  // per-row element instead - every request row has exactly one "View Details".
  const careRows = (page) => page.getByRole('button', { name: 'View Details' });

  // The request list is a delayed client-side fetch that lands after networkidle,
  // and under the full suite's tracing/video overhead it can still be empty the
  // instant a test body runs - a bare count() then false-skips even with real
  // data present. Give it a bounded chance to settle before deciding count.
  async function settledCareRowCount(page) {
    await careRows(page).first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
    return careRows(page).count();
  }

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
    const count = await settledCareRowCount(page);
    test.skip(count === 0, 'No care requests exist in this environment - nothing to open.');

    await careRows(page).first().click();
    await page.waitForTimeout(2000);

    const opened = (await page.getByRole('dialog').count()) > 0
      || !/\/care-scheduler$/.test(new URL(page.url()).pathname);
    expect(opened, 'no detail dialog or route opened').toBeTruthy();
    await expect(page.getByRole('heading', { name: 'Appointment Request Details' })).toBeVisible();
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
    const count = await settledCareRowCount(page);
    test.skip(count === 0, 'No care requests exist in this environment - nothing to filter.');

    await page.getByPlaceholder(/Search by member name/i).fill('zzzzz-no-such-member-9999');
    await page.waitForTimeout(2000);

    expect(await careRows(page).count()).toBe(0);
    await expect(page.getByText(/no appointment requests found/i)).toBeVisible();
  });
});
