const { test, expect, caseOf } = require('../support/testcase');

// Which protected route to probe. Both portals ship from one deployment, so this
// depends on the account you logged in with:
//   advisor / wellness coach -> /wellness/dashboard   (default)
//   member                   -> /member/dashboard
// Override per run with SMOKE_ROUTE, or set it in .env.
const ROUTE = process.env.SMOKE_ROUTE || '/wellness/dashboard';

/**
 * Run this first. It answers one question: is the saved session still good?
 * If this fails, every other spec will fail too - re-run `npm run auth`.
 *
 * It probes a PROTECTED route on purpose. The site root ("/") is a public
 * marketing page that renders fine with no session at all, so asserting
 * against "/" would pass even when completely logged out.
 */
test(...caseOf({
  id: 'TC-ENV-001',
  module: 'Setup & Environment',
  scenario: 'Saved manual-login session is still valid',
  preconditions: 'npm run auth completed; auth/auth.json exists with a live refresh token.',
  steps: [
    'Pre-flight refresh tops up aperion_token via /api/v1/auth/refresh.',
    'Open the protected route (SMOKE_ROUTE, default /wellness/dashboard) with the saved storage state.',
    'Check the landing URL and read aperion_token from localStorage.',
  ],
  data: 'auth/auth.json (localStorage: aperion_token, aperion_refresh_token)',
  expected: 'The dashboard loads without redirecting to /login, and a non-empty '
    + 'aperion_token is present in localStorage.',
}), async ({ page }) => {
  await page.goto(ROUTE);

  // The redirect is client-side and fires AFTER the first paint, so a bare
  // not.toHaveURL() would pass instantly on the pre-redirect URL. Settle first.
  await page.waitForLoadState('networkidle');

  // AuthContext.initializeAuth validates the access token on a cold load and
  // redirects to /login on 401, so staying off /login means the session holds.
  await expect(page).not.toHaveURL(/\/login/);

  // Second, independent signal: the app only keeps a token for a live session.
  const token = await page.evaluate(() => localStorage.getItem('aperion_token'));
  expect(token, 'aperion_token missing - session is not authenticated').toBeTruthy();
});
