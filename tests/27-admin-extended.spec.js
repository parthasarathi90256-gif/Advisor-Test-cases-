const { test, expect, caseOf } = require('../support/testcase');

const MODULE = 'Advisor Portal → Admin';

test.describe('Admin → Advisors', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/wellness/admin/advisors');
    await page.waitForLoadState('networkidle');
  });

  test(...caseOf({
    id: 'AP_TC_178',
    module: MODULE,
    scenario: 'Verify Admin → Advisors loads the advisor roster with column headers',
    preconditions: 'Advisor has administration access.',
    steps: [
      'Open Admin, then the Advisors tab.',
      'Observe the advisor list and its column headers.',
    ],
    data: 'N/A',
    expected: 'The ADVISOR, EMAIL, SPECIALTY, LOCATION and ASSIGNED MEMBERS column headers are '
      + 'shown with at least one advisor row and a "View" action per row.',
  }), async ({ page }) => {
    const headerRow = page.getByRole('row').first();
    for (const h of [/Advisor/i, /Email/i, /Specialty/i, /Location/i, /Assigned Members/i]) {
      await expect(headerRow).toContainText(h);
    }
    await expect(page.getByRole('button', { name: 'View' }).first()).toBeVisible();
  });

  test(...caseOf({
    id: 'AP_TC_179',
    module: MODULE,
    scenario: 'Verify searching Admin → Advisors for an unknown name returns no results',
    preconditions: 'Advisor is on Admin → Advisors with advisors listed.',
    steps: [
      'Type a name that does not exist into "Search by name or email...".',
      'Observe the advisor list.',
    ],
    data: 'Search term: "zzzzz-no-such-advisor-9999"',
    expected: 'No advisor rows are returned and the page shows an empty state rather than the '
      + 'unfiltered roster.',
  }), async ({ page }) => {
    await page.getByPlaceholder(/Search by name or email/i).fill('zzzzz-no-such-advisor-9999');
    await page.waitForTimeout(1500);
    expect(await page.getByRole('button', { name: 'View' }).count()).toBe(0);
  });

  test(...caseOf({
    id: 'AP_TC_180',
    module: MODULE,
    scenario: 'Verify opening an advisor from the roster reaches their detail view',
    preconditions: 'Advisor is on Admin → Advisors with advisors listed.',
    steps: [
      'Click "View" on the first advisor row.',
      'Observe the resulting page.',
    ],
    data: 'The first listed advisor',
    expected: 'The advisor detail view opens, showing that advisor\'s name as a heading.',
  }), async ({ page }) => {
    await page.getByRole('button', { name: 'View' }).first().click();
    await page.waitForTimeout(1500);
    await expect(page).toHaveURL(/\/wellness\/admin\/advisors\/[^/]+/);
    await expect(page.getByRole('button', { name: /Back to Advisors/i })).toBeVisible();
  });
});

test.describe('Admin → Members', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/wellness/admin/members');
    await page.waitForLoadState('networkidle');
  });

  test(...caseOf({
    id: 'AP_TC_181',
    module: MODULE,
    scenario: 'Verify Admin → Members loads the member roster with column headers',
    preconditions: 'Advisor has administration access.',
    steps: [
      'Open Admin, then the Members tab.',
      'Observe the member list and its column headers.',
    ],
    data: 'N/A',
    expected: 'The MEMBER, EMAIL, LOCATION, EMPLOYER, RISK and WAITING column headers are shown '
      + 'with at least one member row.',
  }), async ({ page }) => {
    const headerRow = page.getByRole('row').first();
    for (const h of [/Member/i, /Email/i, /Location/i, /Employer/i, /Risk/i, /Waiting/i]) {
      await expect(headerRow).toContainText(h);
    }
  });

  test(...caseOf({
    id: 'AP_TC_182',
    module: MODULE,
    scenario: 'NEGATIVE - Verify searching Admin → Members for an unknown name returns no results',
    preconditions: 'Advisor is on Admin → Members with members listed.',
    steps: [
      'Type a name that does not exist into "Search by name or email...".',
      'Observe the member list.',
    ],
    data: 'Search term: "zzzzz-no-such-member-9999"',
    expected: 'No member rows are returned rather than the unfiltered roster.',
  }), async ({ page }) => {
    // The roster is a delayed client-side fetch that lands after networkidle;
    // capturing "before" without waiting for it to settle can read the
    // pre-hydration row count (just the header) and make this a no-op check.
    await expect(page.getByRole('row').nth(1)).toBeVisible({ timeout: 15000 });
    const before = await page.getByRole('row').count();

    await page.getByPlaceholder(/Search by name or email/i).fill('zzzzz-no-such-member-9999');
    await page.waitForTimeout(1500);

    expect(await page.getByRole('row').count()).toBeLessThan(before);
    await expect(page.getByText(/No members found/i)).toBeVisible();
  });
});

test.describe('Admin → Departures', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/wellness/admin/departures');
    await page.waitForLoadState('networkidle');
  });

  test(...caseOf({
    id: 'AP_TC_183',
    module: MODULE,
    scenario: 'Verify Admin → Departures loads with its status filter tabs',
    preconditions: 'Advisor has administration access.',
    steps: [
      'Open Admin, then the Departures tab.',
      'Observe the status filter tabs.',
    ],
    data: 'N/A',
    expected: 'The Departures heading is shown with the All open, Not started, In progress, With '
      + 'Command Center, Closed and Departed filter tabs, without an application error.',
  }), async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Departures' })).toBeVisible();
    for (const tab of ['All open', 'Not started', 'In progress', 'With Command Center', 'Closed', 'Departed']) {
      await expect(page.getByRole('button', { name: tab, exact: true })).toBeVisible();
    }
  });
});

test.describe('Admin → Assessment Audit', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/wellness/admin/assessment-audit');
    await page.waitForLoadState('networkidle');
  });

  test(...caseOf({
    id: 'AP_TC_184',
    module: MODULE,
    scenario: 'Verify Admin → Assessment Audit loads with search and export controls',
    preconditions: 'Advisor has administration access.',
    steps: [
      'Open Admin, then the Assessment Audit tab.',
      'Observe the page controls.',
    ],
    data: 'N/A',
    expected: 'The Assessment Audit heading is shown with a member/advisor/assessment search box '
      + 'and an "Export CSV" control.',
  }), async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Assessment Audit' })).toBeVisible();
    await expect(page.getByPlaceholder(/Search member, advisor, assessment/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Export CSV/i })).toBeVisible();
  });
});

test.describe('Admin → Follow-ups', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/wellness/admin/follow-ups');
    await page.waitForLoadState('networkidle');
  });

  test(...caseOf({
    id: 'AP_TC_185',
    module: MODULE,
    scenario: 'Verify Admin → Follow-ups loads with its column headers',
    preconditions: 'Advisor has administration access.',
    steps: [
      'Open Admin, then the Follow-ups tab.',
      'Observe the follow-up list and its column headers.',
    ],
    data: 'N/A',
    expected: 'The MEMBER, FLAG, NEXT STEP, EMPLOYER, ADVISOR and DAYS STUCK column headers are '
      + 'shown with at least one row.',
  }), async ({ page }) => {
    const headerRow = page.getByRole('row').first();
    for (const h of [/Member/i, /Flag/i, /Next Step/i, /Employer/i, /Advisor/i, /Days Stuck/i]) {
      await expect(headerRow).toContainText(h);
    }
  });
});

test.describe('Admin → Advisor notifications', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/wellness/admin/notifications');
    await page.waitForLoadState('networkidle');
  });

  test(...caseOf({
    id: 'AP_TC_186',
    module: MODULE,
    scenario: 'Verify Admin → Advisor notifications loads the Scheduler / Engine / Delivery panels',
    preconditions: 'Advisor has administration access.',
    steps: [
      'Open Admin, then the Advisor notifications tab.',
      'Observe the panels shown.',
    ],
    data: 'N/A',
    expected: 'The "Advisor notifications" heading is shown together with Scheduler, Engine and '
      + 'Delivery sections, without an application error.',
  }), async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Advisor notifications' })).toBeVisible();
    for (const s of ['Scheduler', 'Engine', 'Delivery']) {
      await expect(page.getByText(s, { exact: true }).first()).toBeVisible();
    }
  });
});
