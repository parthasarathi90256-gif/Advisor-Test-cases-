const { test, expect, caseOf } = require('../support/testcase');
const { gotoSettled } = require('../support/portal');

const MODULE = 'Advisor Portal → Authentication & Shell';

// Deliberately the last spec: signing out may revoke the saved refresh token
// on the server, which would break every test that runs after it.
test(...caseOf({
  id: 'AP_TC_202',
  module: MODULE,
  scenario: 'Verify "Sign out" ends the session and protected routes redirect to /login',
  preconditions: 'Advisor is logged in. Runs last: it invalidates the saved session for this browser context only.',
  steps: ['Click "Sign out" in the sidebar.', 'Observe the page.', 'Navigate to /wellness/dashboard.'],
  data: 'N/A',
  expected: 'The app returns to /login, the session token is cleared and the dashboard redirects to /login.',
}), async ({ page }) => {
  await gotoSettled(page, '/wellness/dashboard', 2000);
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.waitForURL(/\/login/, { timeout: 40000 });
  expect(await page.evaluate(() => localStorage.getItem('aperion_token'))).toBeFalsy();
  await page.goto('/wellness/dashboard');
  await page.waitForLoadState('networkidle').catch(() => {});
  await expect(page).toHaveURL(/\/login/);
});
