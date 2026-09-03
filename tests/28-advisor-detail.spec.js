const { test, expect, caseOf } = require('../support/testcase');

const MODULE = 'Advisor Portal → Admin → Advisor Detail';

test.describe('Advisor Detail', () => {
  let advisorId;

  test.beforeEach(async ({ page }) => {
    // Resolve a real advisor id off the live roster each run, rather than
    // hard-coding one, so this survives roster changes in shared dev data.
    await page.goto('/wellness/admin/advisors');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'View' }).first().click();
    await page.waitForURL(/\/wellness\/admin\/advisors\/[^/]+/);
    await page.waitForLoadState('networkidle');
    advisorId = new URL(page.url()).pathname.split('/')[4];
  });

  test(...caseOf({
    id: 'AP_TC_187',
    module: MODULE,
    scenario: 'Verify the advisor detail view loads with its section navigation',
    preconditions: 'Advisor has administration access and opened an advisor from the roster.',
    steps: [
      'Open Admin → Advisors and click "View" on an advisor.',
      'Observe the advisor detail sections.',
    ],
    data: 'The first listed advisor',
    expected: 'The advisor\'s name is shown as a heading together with Profile, Assigned members '
      + '(Caseload), Workload and Lifecycle section links, and a "Back to Advisors" control.',
  }), async ({ page }) => {
    await expect(page.getByRole('heading').first()).toBeVisible();
    for (const link of ['Profile', 'Workload', 'Lifecycle']) {
      await expect(page.getByRole('link', { name: link, exact: true })).toBeVisible();
    }
    await expect(page.getByRole('link', { name: /Assigned members/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Back to Advisors/i })).toBeVisible();
  });

  test(...caseOf({
    id: 'AP_TC_188',
    module: MODULE,
    scenario: 'Verify the Workload tab shows capacity and load metrics',
    preconditions: 'Advisor is on an advisor\'s detail view.',
    steps: [
      'Click the "Workload" section link.',
      'Observe the workload metrics.',
    ],
    data: 'N/A',
    expected: 'The advisor\'s Assigned members, Sessions this week and Employer groups metrics are '
      + 'shown, without an application error.',
  }), async ({ page }) => {
    await page.getByRole('link', { name: 'Workload', exact: true }).click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/workload$/);
    for (const m of ['Assigned members', 'Sessions this week', 'Employer groups']) {
      await expect(page.getByText(m, { exact: false }).first()).toBeVisible();
    }
  });

  test(...caseOf({
    id: 'AP_TC_189',
    module: MODULE,
    scenario: 'Verify the Lifecycle tab shows availability status and case metrics',
    preconditions: 'Advisor is on an advisor\'s detail view.',
    steps: [
      'Click the "Lifecycle" section link.',
      'Observe the availability status and case metrics.',
    ],
    data: 'N/A',
    expected: 'The advisor\'s availability status and Members / Upcoming Sessions / Open Care '
      + 'Requests / Assessments In Progress metrics are shown.',
  }), async ({ page }) => {
    await page.getByRole('link', { name: 'Lifecycle', exact: true }).click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/lifecycle$/);
    await expect(page.getByText('Availability', { exact: true })).toBeVisible();
    for (const m of [/Upcoming Sessions/i, /Open Care Requests/i, /Assessments In Progress/i]) {
      await expect(page.getByText(m).first()).toBeVisible();
    }
  });

  test(...caseOf({
    id: 'AP_TC_190',
    module: MODULE,
    scenario: 'Verify "Back to Advisors" returns to the Admin advisor roster',
    preconditions: 'Advisor is on an advisor\'s detail view.',
    steps: [
      'Click "Back to Advisors".',
      'Observe the resulting page.',
    ],
    data: 'N/A',
    expected: 'The advisor is returned to the Admin → Advisors roster.',
  }), async ({ page }) => {
    await page.getByRole('button', { name: /Back to Advisors/i }).click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/wellness\/admin\/advisors$/);
  });
});
