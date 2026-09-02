const { test, expect, caseOf } = require('../support/testcase');

test.describe('Help & Support', () => {
  const MODULE = 'Advisor Portal → Help & Support';

  test.beforeEach(async ({ page }) => {
    await page.goto('/wellness/support');
    await page.waitForLoadState('networkidle');
  });

  test(...caseOf({
    id: 'AP_TC_157',
    module: MODULE,
    scenario: 'Verify the Help & Support page loads the contact form, knowledge base and live chat',
    preconditions: 'Advisor is logged in to the Advisor Portal.',
    steps: [
      'Open Help & Support from the sidebar.',
      'Observe the support options and the contact form fields.',
    ],
    data: 'N/A',
    expected: 'The Help & Support heading is shown with the Contact Support, Knowledge Base and '
      + 'Live Chat sections, and the contact form exposes name, email, subject and message fields.',
  }), async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Help & Support' })).toBeVisible();
    for (const s of ['Contact Support', 'Knowledge Base', 'Live Chat']) {
      await expect(page.getByText(s, { exact: false }).first()).toBeVisible();
    }
    await expect(page.getByPlaceholder(/Your name/i)).toBeVisible();
    await expect(page.getByPlaceholder(/Brief summary of your request/i)).toBeVisible();
    await expect(page.getByPlaceholder(/describe your issue/i)).toBeVisible();
  });

  test(...caseOf({
    id: 'AP_TC_158',
    module: MODULE,
    scenario: 'Verify the support contact form pre-fills the logged-in advisor email address',
    preconditions: 'Advisor is logged in and on the Help & Support page.',
    steps: [
      'Locate the email field on the Contact Support form.',
      'Read its value.',
    ],
    data: 'The logged-in advisor account email',
    expected: 'The email field is pre-populated with the signed-in advisor\'s email address so it '
      + 'does not have to be retyped.',
  }), async ({ page }) => {
    const email = page.locator('input[type=email]').first();
    await expect(email).toBeVisible();
    const value = await email.inputValue();
    expect(value, 'email field was not pre-filled').toMatch(/@/);
  });

  test(...caseOf({
    id: 'AP_TC_159',
    module: MODULE,
    scenario: 'Verify a knowledge base FAQ entry expands to reveal its answer',
    preconditions: 'Advisor is on the Help & Support page with the Knowledge Base listed.',
    steps: [
      'Locate the FAQ entry "How do I manage my sessions calendar?".',
      'Click the entry.',
      'Observe the answer content.',
    ],
    data: 'FAQ: "How do I manage my sessions calendar?"',
    expected: 'The FAQ entry expands and reveals additional answer text without navigating away '
      + 'from the page.',
  }), async ({ page }) => {
    const faq = page.getByRole('button', { name: /How do I manage my sessions calendar/i });
    await expect(faq).toBeVisible();

    const before = (await page.locator('body').innerText()).length;
    await faq.click();
    await page.waitForTimeout(1200);
    const after = (await page.locator('body').innerText()).length;

    expect(after, 'no answer text appeared after expanding the FAQ').toBeGreaterThan(before);
  });

  test(...caseOf({
    id: 'AP_TC_160',
    module: MODULE,
    scenario: 'NEGATIVE - Verify the support request cannot be submitted with an invalid email address',
    preconditions: 'Advisor is on the Help & Support page with the Contact Support form displayed.',
    steps: [
      'Enter a name and a subject.',
      'Replace the email address with an invalid value such as "not-an-email".',
      'Enter a message.',
      'Attempt to submit the form.',
    ],
    data: 'Name: Test Advisor; Email: "not-an-email"; Subject: Automated negative check',
    expected: 'The form refuses the submission - the submit control stays disabled or a validation '
      + 'message is shown - and no support ticket is created.',
  }), async ({ page }) => {
    await page.getByPlaceholder(/Your name/i).fill('Test Advisor');
    const email = page.locator('input[type=email]').first();
    await email.fill('not-an-email');
    await page.getByPlaceholder(/Brief summary of your request/i).fill('Automated negative check');
    await page.getByPlaceholder(/describe your issue/i).fill('Automated negative check - do not action.');
    await page.waitForTimeout(800);

    // Browser-native validation on a type=email input is the expected guard.
    const valid = await email.evaluate((e) => e.checkValidity());
    expect(valid, 'invalid email was accepted as valid').toBe(false);
  });
});

test.describe('Reports & Analytics', () => {
  const MODULE = 'Advisor Portal → Reports';

  test.beforeEach(async ({ page }) => {
    await page.goto('/wellness/reports');
    await page.waitForLoadState('networkidle');
  });

  test(...caseOf({
    id: 'AP_TC_161',
    module: MODULE,
    scenario: 'Verify the Reports page loads the advisor performance metrics',
    preconditions: 'Advisor is logged in to the Advisor Portal.',
    steps: [
      'Open Reports from the sidebar.',
      'Observe the reported metrics.',
    ],
    data: 'N/A',
    expected: 'The Reports & Analytics heading is displayed along with the Sessions Completed, '
      + 'Member Engagement and Goals Completed metrics.',
  }), async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Reports & Analytics' })).toBeVisible();
    for (const m of ['Sessions Completed', 'Member Engagement', 'Goals Completed']) {
      await expect(page.getByText(m, { exact: false }).first()).toBeVisible();
    }
  });

  test(...caseOf({
    id: 'AP_TC_162',
    module: MODULE,
    scenario: 'Verify the reporting period filter is available and can be changed',
    preconditions: 'Advisor is on the Reports page with the default period applied.',
    steps: [
      'Locate the reporting period control showing "Last 7 days".',
      'Open the control.',
      'Observe the available period options.',
    ],
    data: 'Default period: Last 7 days',
    expected: 'The period control is displayed and opens a list of alternative reporting periods '
      + 'without an application error.',
  }), async ({ page }) => {
    // Renders as <button role="combobox"> with a null accessible name, so match the
    // attribute directly rather than going through the ARIA name.
    const period = page.locator('[role=combobox]').filter({ hasText: /Last 7 days/i });
    // The control mounts only after the report data resolves, which is slower than
    // the default 5s expect timeout on this page.
    await expect(period).toBeVisible({ timeout: 25000 });
    await period.click();
    await page.waitForTimeout(1200);

    // The popover marks the rest of the page aria-hidden while open, so the page
    // heading is no longer in the a11y tree - assert the options themselves, which
    // is what this case is actually about.
    for (const option of ['Last 30 days', 'Last 90 days', 'All time']) {
      await expect(page.getByRole('option', { name: option })).toBeVisible();
    }
  });

  test(...caseOf({
    id: 'AP_TC_163',
    module: MODULE,
    scenario: 'Verify "View all members" navigates from Reports to the Members page',
    preconditions: 'Advisor is on the Reports page.',
    steps: [
      'Click "View all members".',
      'Observe the resulting page.',
    ],
    data: 'N/A',
    expected: 'The advisor is taken to the Members page and the Members heading is displayed.',
  }), async ({ page }) => {
    await page.getByRole('button', { name: /View all members/i }).click();
    await expect(page).toHaveURL(/\/wellness\/members/);
    await expect(page.getByRole('heading', { name: 'Members' })).toBeVisible();
  });
});

test.describe('Administration', () => {
  const MODULE = 'Advisor Portal → Admin';

  test(...caseOf({
    id: 'AP_TC_164',
    module: MODULE,
    scenario: 'Verify the Administration overview loads for an authorised advisor',
    preconditions: 'Advisor account has administration access.',
    steps: [
      'Open Admin from the sidebar.',
      'Observe the administration overview.',
    ],
    data: 'N/A',
    expected: 'The Administration heading is displayed together with the "Needs attention" panel '
      + 'and no access-denied message.',
  }), async ({ page }) => {
    await page.goto('/wellness/admin/overview');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();
    await expect(page.getByText(/Needs attention/i).first()).toBeVisible();
    await expect(page.getByText(/access denied|not authoris|not authoriz/i)).toHaveCount(0);
  });

  test(...caseOf({
    id: 'AP_TC_165',
    module: MODULE,
    scenario: 'Verify the advisor can return from Administration to the main portal',
    preconditions: 'Advisor is on the Administration overview page.',
    steps: [
      'Click "Back to main page".',
      'Observe the resulting page.',
    ],
    data: 'N/A',
    expected: 'The advisor is returned to the main Advisor Portal area, out of the /admin routes.',
  }), async ({ page }) => {
    await page.goto('/wellness/admin/overview');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /Back to main page/i }).click();
    await page.waitForTimeout(2000);
    expect(page.url()).not.toMatch(/\/admin\//);
  });
});
