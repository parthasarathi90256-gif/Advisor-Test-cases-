const { test, expect, caseOf } = require('../support/testcase');

const MODULE = 'Advisor Portal → Access Control';

/**
 * These run WITHOUT the saved session on purpose, to prove protected routes are
 * actually protected. Everything else in the suite runs authenticated.
 */
test.describe('Unauthenticated access', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test(...caseOf({
    id: 'AP_TC_166',
    module: MODULE,
    scenario: 'NEGATIVE - Verify an unauthenticated user cannot reach the advisor Dashboard',
    preconditions: 'No session exists in the browser (signed out / fresh browser).',
    steps: [
      'Clear all session storage.',
      'Navigate directly to /wellness/dashboard.',
      'Observe the resulting page.',
    ],
    data: 'Route: /wellness/dashboard',
    expected: 'The application redirects to the /login page and no advisor data is rendered.',
  }), async ({ page }) => {
    await page.goto('/wellness/dashboard');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toHaveCount(0);
  });

  test(...caseOf({
    id: 'AP_TC_167',
    module: MODULE,
    scenario: 'NEGATIVE - Verify an unauthenticated user cannot reach member records',
    preconditions: 'No session exists in the browser.',
    steps: [
      'Navigate directly to /wellness/members.',
      'Observe the resulting page.',
    ],
    data: 'Route: /wellness/members',
    expected: 'The application redirects to /login and no member records are displayed.',
  }), async ({ page }) => {
    await page.goto('/wellness/members');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('row')).toHaveCount(0);
  });

  test(...caseOf({
    id: 'AP_TC_168',
    module: MODULE,
    scenario: 'NEGATIVE - Verify an unauthenticated user cannot reach the Administration area',
    preconditions: 'No session exists in the browser.',
    steps: [
      'Navigate directly to /wellness/admin/overview.',
      'Observe the resulting page.',
    ],
    data: 'Route: /wellness/admin/overview',
    expected: 'The application redirects to /login and the Administration overview is not rendered.',
  }), async ({ page }) => {
    await page.goto('/wellness/admin/overview');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: 'Administration' })).toHaveCount(0);
  });

  test(...caseOf({
    id: 'AP_TC_169',
    module: MODULE,
    scenario: 'NEGATIVE - Verify requesting an OTP for an unregistered email does not sign the user in',
    preconditions: 'User is on the /login page and not signed in.',
    steps: [
      'Select the Email sign-in tab.',
      'Enter an email address that is not registered.',
      'Click "Send One-Time Passcode".',
      'Observe the result.',
    ],
    data: 'Email: "zzzzz-not-registered-9999@example.com"',
    expected: 'The user is not signed in and no session token is issued - the app stays on the '
      + 'login/verify flow and never reaches the advisor portal.',
  }), async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Email', exact: true }).click();
    await page.locator('input').first().fill('zzzzz-not-registered-9999@example.com');
    await page.getByRole('button', { name: /Send One-Time Passcode/i }).click();
    await page.waitForTimeout(4000);

    expect(page.url(), 'unregistered email reached the portal').not.toMatch(/\/wellness\//);
    const token = await page.evaluate(() => localStorage.getItem('aperion_token'));
    expect(token, 'a session token was issued for an unregistered email').toBeFalsy();
  });
});
