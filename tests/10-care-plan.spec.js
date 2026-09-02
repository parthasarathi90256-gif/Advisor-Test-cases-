const { test, expect, caseOf } = require('../support/testcase');

/**
 * TEMPLATE - this is what a recorded case looks like after cleanup.
 *
 * Record your own with `npm run record`, paste the generated body in here,
 * fill the metadata from your manual test case, then change `test.skip` to
 * `test`. Locators below are placeholders and will not match the real portal.
 */
test.skip(...caseOf({
  id: 'AP_TC_132',
  module: 'Care Plan',
  scenario: 'Member can open and read their active care plan',
  preconditions: 'Logged in as a member who has at least one active care plan.',
  steps: [
    'From the dashboard, click "Care Plan" in the sidebar.',
    'Select the active plan card.',
    'Read the plan header details.',
  ],
  data: 'Member: test member account; Plan: any active plan',
  expected: 'Plan name, start date and assigned coach are all displayed on the plan header.',
}), async ({ page }) => {
  await page.goto('/member/dashboard');
  await page.getByRole('link', { name: 'Care Plan' }).click();
  await page.getByText('Active Plan').click();

  await expect(page.getByTestId('plan-name')).toBeVisible();
  await expect(page.getByTestId('plan-start-date')).toBeVisible();
  await expect(page.getByTestId('coach-name')).toBeVisible();
});
