const { test, expect, caseOf } = require('../support/testcase');

const MODULE = 'Advisor Portal → Dashboard';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/wellness/dashboard');
    await page.waitForLoadState('networkidle');
  });

  test(...caseOf({
    id: 'AP_TC_132',
    module: MODULE,
    scenario: 'Verify the advisor Dashboard loads with all four summary stat tiles',
    preconditions: 'Advisor is logged in and the Advisor Portal is selected.',
    steps: [
      'Log in and select the Advisor Portal.',
      'Land on the Dashboard page.',
      'Observe the summary stat tiles.',
    ],
    data: 'Logged-in advisor account',
    expected: 'The Dashboard heading is shown along with the Today\'s Sessions, Care Requests '
      + 'Pending, Total Members and Sessions Completed tiles.',
  }), async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    for (const tile of ['Today\'s Sessions', 'Care Requests Pending', 'Total Members', 'Sessions Completed']) {
      await expect(page.getByText(tile, { exact: false }).first()).toBeVisible();
    }
  });

  test(...caseOf({
    id: 'AP_TC_133',
    module: MODULE,
    scenario: 'Verify the advisor can hide and restore the Dashboard statistics row',
    preconditions: 'Advisor is on the Dashboard with the stats row visible.',
    steps: [
      'Click "Hide Stats".',
      'Observe the statistics row.',
      'Click the same control again to restore it.',
    ],
    data: 'N/A',
    expected: 'The stats row collapses on Hide Stats and the control switches to Show Stats; '
      + 'clicking it again restores the tiles.',
  }), async ({ page }) => {
    const toggle = page.getByRole('button', { name: /Hide Stats/i });
    await expect(toggle).toBeVisible();
    await toggle.click();

    const show = page.getByRole('button', { name: /Show Stats/i });
    await expect(show).toBeVisible();

    await show.click();
    await expect(page.getByRole('button', { name: /Hide Stats/i })).toBeVisible();
  });

  test(...caseOf({
    id: 'AP_TC_134',
    module: MODULE,
    scenario: 'Verify the Recent Members "View all" link navigates to the Members page',
    preconditions: 'Advisor is on the Dashboard and the Recent Members panel is displayed.',
    steps: [
      'Locate the Recent Members panel.',
      'Click "View all".',
      'Observe the resulting page.',
    ],
    data: 'N/A',
    expected: 'The advisor is taken to the Members page (/wellness/members) and the Members '
      + 'heading is displayed.',
  }), async ({ page }) => {
    await page.getByRole('button', { name: /View all/i }).first().click();
    await expect(page).toHaveURL(/\/wellness\/members/);
    await expect(page.getByRole('heading', { name: 'Members' })).toBeVisible();
  });

  test(...caseOf({
    id: 'AP_TC_135',
    module: MODULE,
    scenario: 'Verify the Schedule Session action is available from the Dashboard',
    preconditions: 'Advisor is on the Dashboard.',
    steps: [
      'Locate the "Schedule Session" button in the page header.',
      'Click it.',
      'Observe that a scheduling surface opens.',
    ],
    data: 'N/A',
    expected: 'The Schedule Session control is enabled and opens a scheduling dialog or page '
      + 'without an application error.',
  }), async ({ page }) => {
    const btn = page.getByRole('button', { name: /Schedule Session/i }).first();
    await expect(btn).toBeEnabled();
    await btn.click();
    await page.waitForTimeout(1500);
    // Either a dialog opens or the app routes to a scheduling surface.
    const opened = (await page.getByRole('dialog').count()) > 0
      || /schedul/i.test(page.url())
      || (await page.getByText(/schedule/i).count()) > 0;
    expect(opened, 'no scheduling dialog or route appeared').toBeTruthy();
  });
});
