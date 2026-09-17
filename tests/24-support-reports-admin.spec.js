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
    scenario: 'Verify the Help & Support page loads contact details, knowledge base, live chat and FAQs',
    preconditions: 'Advisor is logged in to the Advisor Portal.',
    steps: ['Open Help & Support from the sidebar.', 'Observe the support sections and the FAQ list.'],
    data: 'N/A',
    expected: 'The Help & Support heading is shown with a Contact Support card (phone number, hours, support email), '
      + 'Knowledge Base and Live Chat cards (currently "Coming Soon") and a Frequently Asked Questions list.',
  }), async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Help & Support' })).toBeVisible();
    for (const s of ['Contact Support', 'Knowledge Base', 'Live Chat']) {
      await expect(page.getByRole('heading', { name: s })).toBeVisible();
    }
    await expect(page.getByText(/\(\d{3}\) \d{3}-\d{4}/)).toBeVisible();
    await expect(page.getByText(/Frequently Asked Questions/i)).toBeVisible();
    expect(await page.getByRole('button', { name: /^How do I|^Where can I/ }).count()).toBeGreaterThan(0);
  });

  test(...caseOf({
    id: 'AP_TC_158',
    module: MODULE,
    scenario: 'Verify the support email is offered as a mailto link',
    preconditions: 'Advisor is on the Help & Support page.',
    steps: ['Locate the support email in the Contact Support card.', 'Inspect the link target.'],
    data: 'N/A',
    expected: 'The support email address is a "mailto:" link so it opens the advisor\'s mail client.',
  }), async ({ page }) => {
    const link = page.getByRole('link', { name: /@aperion\.health/ });
    await expect(link).toBeVisible();
    expect(await link.getAttribute('href')).toMatch(/^mailto:/);
  });

  test(...caseOf({
    id: 'AP_TC_159',
    module: MODULE,
    scenario: 'Verify a knowledge base FAQ entry expands to reveal its answer',
    preconditions: 'Advisor is on the Help & Support page with the FAQ list shown.',
    steps: ['Click the first FAQ question.', 'Observe the answer content.'],
    data: 'FAQ: "How do I schedule advisory sessions with members?"',
    expected: 'The FAQ entry expands and reveals additional answer text without navigating away from the page.',
  }), async ({ page }) => {
    const faq = page.getByRole('button', { name: /How do I schedule advisory sessions/i });
    await expect(faq).toBeVisible();
    const before = (await page.locator('main').innerText()).length;
    await faq.click();
    await page.waitForTimeout(1200);
    const after = (await page.locator('main').innerText()).length;
    expect(after, 'no answer text appeared after expanding the FAQ').toBeGreaterThan(before);
    await expect(page).toHaveURL(/\/wellness\/support/);
  });

  test(...caseOf({
    id: 'AP_TC_160',
    module: MODULE,
    scenario: 'NEGATIVE - Verify a support request cannot be submitted until category, title and a 20+ character description are provided',
    preconditions: 'Advisor is logged in; the header "Support" button is available on every page.',
    steps: [
      'Click "Support" in the page header.',
      'Observe the submit control with the form empty.',
      'Pick a category and a title but type a description shorter than 20 characters.',
      'Observe the submit control.',
    ],
    data: 'Category: Feedback; Title: "Automated negative check"; Description: "too short"',
    expected: '"Submit Request" stays disabled while the form is incomplete; no ticket is created.',
  }), async ({ page }) => {
    await page.getByRole('button', { name: 'Support', exact: true }).first().click();
    const submit = page.getByRole('button', { name: 'Submit Request' });
    await expect(submit).toBeVisible();
    await expect(submit).toBeDisabled();
    await page.getByRole('button', { name: /^Feedback/ }).click();
    await page.getByRole('textbox', { name: 'Title *' }).fill('Automated negative check');
    await page.getByRole('textbox', { name: 'Description *' }).fill('too short');
    await page.waitForTimeout(600);
    await expect(submit).toBeDisabled();
    await page.getByRole('button', { name: 'Cancel' }).click();
  });

  test(...caseOf({
    id: 'AP_TC_204',
    module: MODULE,
    scenario: 'Verify the header Support modal offers Issue / Feedback / Feature Request categories, title, description and attachments',
    preconditions: 'Advisor is logged in.',
    steps: ['Click "Support" in the page header.', 'Observe the modal fields.', 'Close it with Cancel.'],
    data: 'N/A',
    expected: 'A Contact Support modal opens with the three category buttons, a Title (max 200), a Description '
      + '(minimum 20 characters), an attachments drop zone (JPG/PNG/WebP/MP4/MOV, up to 5 files) and Cancel / Submit Request.',
  }), async ({ page }) => {
    await page.getByRole('button', { name: 'Support', exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'Contact Support' })).toBeVisible();
    for (const c of [/^Issue/, /^Feedback/, /^Feature Request/]) await expect(page.getByRole('button', { name: c })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Title *' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Description *' })).toBeVisible();
    await expect(page.getByText(/Minimum 20 characters/)).toBeVisible();
    await expect(page.getByText(/up to 5 files/)).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('heading', { name: 'Contact Support' })).toHaveCount(0);
  });

  test(...caseOf({
    id: 'AP_TC_205',
    module: MODULE,
    scenario: 'Verify a complete support request can be submitted from the header Support modal',
    preconditions: 'Advisor is logged in.',
    steps: ['Open the header Support modal.', 'Choose Feedback, enter a title and a 20+ character description.', 'Click "Submit Request".'],
    data: 'Category: Feedback; Title: "Automated QA ticket"; Description: "Automated test submission from the QA suite - please ignore."',
    expected: '"Submit Request" becomes enabled once the form is valid and the modal closes after submission.',
  }), async ({ page }) => {
    await page.getByRole('button', { name: 'Support', exact: true }).first().click();
    await page.getByRole('button', { name: /^Feedback/ }).click();
    await page.getByRole('textbox', { name: 'Title *' }).fill('Automated QA ticket');
    await page.getByRole('textbox', { name: 'Description *' }).fill('Automated test submission from the QA suite - please ignore.');
    const submit = page.getByRole('button', { name: 'Submit Request' });
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect(page.getByRole('heading', { name: 'Contact Support' })).toHaveCount(0, { timeout: 15000 });
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

test.describe('Reports & Analytics — extended', () => {
  const MODULE = 'Advisor Portal → Reports';

  test.beforeEach(async ({ page }) => {
    await page.goto('/wellness/reports');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('[role=combobox]').filter({ hasText: /Last 7 days/i })).toBeVisible({ timeout: 40000 });
  });

  test(...caseOf({
    id: 'AP_TC_277',
    module: MODULE,
    scenario: 'Verify changing the reporting period recalculates the metrics',
    preconditions: 'Advisor is on the Reports page with the default "Last 7 days" period.',
    steps: ['Read the Sessions Completed value.', 'Switch the period to "All time".', 'Read the value again.'],
    data: 'Periods: Last 7 days, All time',
    expected: 'The Sessions Completed value changes (All time is greater than or equal to the 7-day value).',
  }), async ({ page }) => {
    const tile = page.getByRole('button', { name: /Sessions Completed/ });
    const before = parseInt((await tile.innerText()).match(/\d+/)[0], 10);
    await page.locator('[role=combobox]').filter({ hasText: /Last 7 days/i }).click();
    await page.getByRole('option', { name: 'All time' }).click();
    await page.waitForTimeout(4000);
    const after = parseInt((await tile.innerText()).match(/\d+/)[0], 10);
    expect(after).toBeGreaterThanOrEqual(before);
  });

  test(...caseOf({
    id: 'AP_TC_278',
    module: MODULE,
    scenario: 'Verify a metric tile drills down to the Sessions page',
    preconditions: 'Advisor is on the Reports page.',
    steps: ['Click the "Sessions Completed" tile.', 'Observe the resulting page.'],
    data: 'N/A',
    expected: 'The advisor is taken to /wellness/sessions.',
  }), async ({ page }) => {
    await page.getByRole('button', { name: /Sessions Completed/ }).click();
    await expect(page).toHaveURL(/\/wellness\/sessions/, { timeout: 20000 });
  });

  test(...caseOf({
    id: 'AP_TC_279',
    module: MODULE,
    scenario: 'Verify the report charts render (Goal Completion by Member, Sessions By Type, Goals by Category, Session Distribution by Day)',
    preconditions: 'Advisor is on the Reports page.',
    steps: ['Scroll through the report.', 'Observe each chart section.'],
    data: 'N/A',
    expected: 'All four chart sections are present with their titles.',
  }), async ({ page }) => {
    for (const t of ['Goal Completion by Member', 'Sessions By Type', 'Goals by Category', 'Session Distribution by Day']) {
      await expect(page.getByText(t, { exact: false }).first()).toBeVisible();
    }
  });

  test(...caseOf({
    id: 'AP_TC_280',
    module: MODULE,
    scenario: 'Verify the Reports stats row can be hidden and restored',
    preconditions: 'Advisor is on the Reports page.',
    steps: ['Click "Hide Stats".', 'Click "Show Stats".'],
    data: 'N/A',
    expected: 'The metric tiles collapse and the control toggles to Show Stats; clicking again restores them.',
  }), async ({ page }) => {
    await page.getByRole('button', { name: /Hide Stats/i }).click();
    await expect(page.getByRole('button', { name: /Show Stats/i })).toBeVisible();
    await page.getByRole('button', { name: /Show Stats/i }).click();
    await expect(page.getByRole('button', { name: /Hide Stats/i })).toBeVisible();
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
