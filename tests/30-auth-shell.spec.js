const { test, expect, caseOf } = require('../support/testcase');
const { gotoSettled } = require('../support/portal');

const MODULE = 'Advisor Portal → Authentication & Shell';

// Login cases need real credentials for this environment. They are read from
// the environment at run time and never stored in the repo (see README).
const EMAIL = process.env.LOGIN_EMAIL;
const OTP = process.env.LOGIN_OTP;
const MEMBER_EMAIL = process.env.MEMBER_LOGIN_EMAIL;
const PHONE = process.env.LOGIN_PHONE;

async function requestOtp(page, email) {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: 'Email', exact: true }).click();
  await page.getByRole('textbox', { name: /Email address/i }).fill(email);
  await page.getByRole('button', { name: /Send One-Time Passcode/i }).click();
}

async function enterOtp(page, code) {
  await page.waitForURL(/\/verify/, { timeout: 60000 });
  await page.waitForTimeout(1500);
  const boxes = page.getByRole('textbox');
  await expect(boxes).toHaveCount(6);
  for (let i = 0; i < 6; i++) { await boxes.nth(i).click(); await page.keyboard.type(code[i]); }
}

test.describe('Login (no saved session)', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test(...caseOf({
    id: 'AP_TC_196',
    module: MODULE,
    scenario: 'Verify an advisor can log in with email + one-time passcode and reach the portal',
    preconditions: 'LOGIN_EMAIL / LOGIN_OTP are set for this environment; the account is an advisor.',
    steps: ['Open /login and choose the Email tab.', 'Enter the email and click "Send One-Time Passcode".', 'Enter the 6-digit code on /verify.', 'Observe where the app lands.'],
    data: 'Email: LOGIN_EMAIL; OTP: LOGIN_OTP',
    expected: 'The code is accepted and the app lands on the portal selection page (or directly on the dashboard for single-portal accounts) with a session token stored.',
  }), async ({ page }) => {
    test.skip(!EMAIL || !OTP, 'LOGIN_EMAIL / LOGIN_OTP not set.');
    await requestOtp(page, EMAIL);
    await enterOtp(page, OTP);
    await page.waitForURL((u) => !/\/(login|verify)/.test(u.pathname), { timeout: 60000 });
    expect(page.url()).toMatch(/portal-selection|\/wellness\/dashboard/);
    expect(await page.evaluate(() => localStorage.getItem('aperion_token'))).toBeTruthy();
  });

  test(...caseOf({
    id: 'AP_TC_197',
    module: MODULE,
    scenario: 'NEGATIVE - Verify a wrong one-time passcode is rejected',
    preconditions: 'LOGIN_EMAIL is set; the account is registered.',
    steps: ['Request a passcode for the email.', 'Enter 000000 on /verify.'],
    data: 'OTP: 000000',
    expected: '"Invalid OTP code. Please try again." is shown, the user stays on /verify and a Resend OTP countdown is offered.',
  }), async ({ page }) => {
    test.skip(!EMAIL, 'LOGIN_EMAIL not set.');
    await requestOtp(page, EMAIL);
    await enterOtp(page, '000000');
    await expect(page.getByText(/Invalid OTP code/i)).toBeVisible({ timeout: 15000 });
    await expect(page).toHaveURL(/\/verify/);
    await expect(page.getByText(/Resend OTP/i)).toBeVisible();
  });

  test(...caseOf({
    id: 'AP_TC_198',
    module: MODULE,
    scenario: 'NEGATIVE - Verify an unregistered email cannot request a passcode',
    preconditions: 'User is on /login.',
    steps: ['Choose the Email tab.', 'Enter an unregistered address and click "Send One-Time Passcode".'],
    data: 'Email: zzzzz-not-registered-9999@example.com',
    expected: 'An "Account not found" message is shown and the user stays on /login.',
  }), async ({ page }) => {
    await requestOtp(page, 'zzzzz-not-registered-9999@example.com');
    await expect(page.getByText(/Account not found|No account exists/i).first()).toBeVisible({ timeout: 15000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test(...caseOf({
    id: 'AP_TC_199',
    module: MODULE,
    scenario: 'Verify the Phone tab requests a passcode by SMS',
    preconditions: 'LOGIN_PHONE is set to a registered US number (digits only).',
    steps: ['Open /login (Phone tab is default).', 'Enter the number and click "Send One-Time Passcode".'],
    data: 'Phone: LOGIN_PHONE',
    expected: 'The app moves to /verify and says the code was sent to the phone.',
  }), async ({ page }) => {
    test.skip(!PHONE, 'LOGIN_PHONE not set.');
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Phone', exact: true }).click();
    await page.getByRole('textbox', { name: /\(123\) 456-7890/ }).fill(PHONE);
    await page.getByRole('button', { name: /Send One-Time Passcode/i }).click();
    await page.waitForURL(/\/verify/, { timeout: 60000 });
    await expect(page.getByText(/code sent to your phone/i)).toBeVisible();
  });

  test(...caseOf({
    id: 'AP_TC_206',
    module: MODULE,
    scenario: 'NEGATIVE - Verify a member account cannot reach Advisor Portal routes',
    preconditions: 'MEMBER_LOGIN_EMAIL / LOGIN_OTP are set for a member (non-advisor) account.',
    steps: ['Log in as the member.', 'Navigate to /wellness/dashboard.', 'Navigate to /wellness/admin/overview.'],
    data: 'Email: MEMBER_LOGIN_EMAIL',
    expected: 'The member lands on /member/dashboard and every /wellness/* route redirects back to the member dashboard.',
  }), async ({ page }) => {
    test.skip(!MEMBER_EMAIL || !OTP, 'MEMBER_LOGIN_EMAIL / LOGIN_OTP not set.');
    await requestOtp(page, MEMBER_EMAIL);
    await enterOtp(page, OTP);
    await page.waitForURL((u) => !/\/(login|verify)/.test(u.pathname), { timeout: 60000 });
    for (const route of ['/wellness/dashboard', '/wellness/admin/overview', '/wellness/members']) {
      await page.goto(route);
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(3000);
      await expect(page).toHaveURL(/\/member\//);
      await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toHaveCount(0);
    }
  });
});

test.describe('Shell (saved session)', () => {
  test(...caseOf({
    id: 'AP_TC_200',
    module: MODULE,
    scenario: 'Verify the portal selection page lists the portals and opens the Advisor Portal',
    preconditions: 'Advisor is logged in with access to more than one portal.',
    steps: ['Open /auth/portal-selection.', 'Observe the portal cards.', 'Click Advisor Portal.'],
    data: 'N/A',
    expected: '"Select Your Portal" lists the account\'s portals (Advisor Portal included) and choosing Advisor Portal opens /wellness/dashboard.',
  }), async ({ page }) => {
    await gotoSettled(page, '/auth/portal-selection', 2000);
    await expect(page.getByRole('heading', { name: 'Select Your Portal' })).toBeVisible();
    await expect(page.getByText('Advisor Portal', { exact: true })).toBeVisible();
    await page.getByText('Advisor Portal', { exact: true }).click();
    await page.waitForURL(/\/wellness\/dashboard/, { timeout: 60000 });
  });

  test(...caseOf({
    id: 'AP_TC_201',
    module: MODULE,
    scenario: 'Verify "Switch Portal" returns to the portal picker',
    preconditions: 'Advisor is on any Advisor Portal page.',
    steps: ['Click "Switch Portal" in the sidebar.'],
    data: 'N/A',
    expected: 'The portal selection page opens.',
  }), async ({ page }) => {
    await gotoSettled(page, '/wellness/dashboard', 2000);
    await page.getByRole('button', { name: 'Switch Portal' }).click();
    await page.waitForURL(/portal-selection/, { timeout: 40000 });
    await expect(page.getByRole('heading', { name: 'Select Your Portal' })).toBeVisible();
  });

  test(...caseOf({
    id: 'AP_TC_203',
    module: MODULE,
    scenario: 'Verify every sidebar entry opens its page',
    preconditions: 'Advisor is on the Dashboard.',
    steps: ['Click each Workspace and Administration entry in turn.', 'Observe the page heading.'],
    data: 'Dashboard, Members, Sessions, Care Scheduler, Navigation Matrix, Communication Center, Help & Support, Reports, Admin',
    expected: 'Each entry navigates to its page and the matching heading is shown.',
  }), async ({ page }) => {
    await gotoSettled(page, '/wellness/dashboard', 2000);
    const items = [
      ['Members', /\/wellness\/members/, 'Members'], ['Sessions', /\/wellness\/sessions/, 'Sessions'],
      ['Care Scheduler', /\/wellness\/care-scheduler/, 'Care Scheduler'], ['Navigation Matrix', /\/wellness\/navigation-matrix/, 'Navigation Matrix'],
      ['Communication Center', /\/wellness\/messages/, 'Communication Center'], ['Help & Support', /\/wellness\/support/, 'Help & Support'],
      ['Reports', /\/wellness\/reports/, 'Reports & Analytics'], ['Dashboard', /\/wellness\/dashboard/, 'Dashboard'],
      // Admin last: inside the admin area the sidebar is replaced by the admin navigation.
      ['Admin', /\/wellness\/admin/, 'Administration'],
    ];
    for (const [label, url, heading] of items) {
      await page.getByRole('navigation').getByRole('button', { name: label, exact: true }).click();
      await expect(page).toHaveURL(url, { timeout: 40000 });
      await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible({ timeout: 40000 });
    }
  });

  test(...caseOf({
    id: 'AP_TC_207',
    module: MODULE,
    scenario: 'Verify the sidebar can be collapsed and expanded',
    preconditions: 'Advisor is on any Advisor Portal page.',
    steps: ['Click "Collapse sidebar".', 'Click "Expand sidebar".'],
    data: 'N/A',
    expected: 'The sidebar collapses to icons and the control toggles; expanding restores the labels.',
  }), async ({ page }) => {
    await gotoSettled(page, '/wellness/dashboard', 2000);
    await page.getByRole('button', { name: 'Collapse sidebar' }).click();
    await expect(page.getByRole('button', { name: 'Expand sidebar' })).toBeVisible();
    await page.getByRole('button', { name: 'Expand sidebar' }).click();
    await expect(page.getByRole('button', { name: 'Collapse sidebar' })).toBeVisible();
  });

});
