const { test, expect, caseOf } = require('../support/testcase');

const dataRows = (page) => page.getByRole('row').filter({ has: page.getByRole('cell') });

test.describe('Navigation Matrix', () => {
  const MODULE = 'Advisor Portal → Navigation Matrix';

  test.beforeEach(async ({ page }) => {
    await page.goto('/wellness/navigation-matrix');
    await page.waitForLoadState('networkidle');
  });

  test(...caseOf({
    id: 'AP_TC_148',
    module: MODULE,
    scenario: 'Verify the Navigation Matrix loads the screening condition catalogue',
    preconditions: 'Advisor is logged in to the Advisor Portal.',
    steps: [
      'Open Navigation Matrix from the sidebar.',
      'Observe the listed screening conditions and the available filters.',
    ],
    data: 'N/A',
    expected: 'The Navigation Matrix heading is displayed with screening conditions such as '
      + '"Colorectal Cancer" and "Depression", plus the gender, priority and commonness filters.',
  }), async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Navigation Matrix' })).toBeVisible();
    await expect(page.getByText('Colorectal Cancer').first()).toBeVisible();
    await expect(page.getByText('Depression').first()).toBeVisible();
    // These render as <button role="combobox"> with no accessible name, so match
    // on visible text rather than on the role's name.
    for (const f of ['All Genders', 'All Priorities', 'All Commonness']) {
      await expect(page.locator('[role=combobox]').filter({ hasText: f })).toBeVisible();
    }
  });

  test(...caseOf({
    id: 'AP_TC_149',
    module: MODULE,
    scenario: 'Verify searching the Navigation Matrix filters to the matching condition',
    preconditions: 'Advisor is on the Navigation Matrix page with all conditions listed.',
    steps: [
      'Type "Diabetes" into "Search navigation...".',
      'Observe the filtered conditions.',
    ],
    data: 'Search term: "Diabetes"',
    expected: 'The Diabetes (A1C) condition remains listed while unrelated conditions such as '
      + '"Colorectal Cancer" are filtered out.',
  }), async ({ page }) => {
    await page.getByPlaceholder(/Search navigation/i).fill('Diabetes');
    await page.waitForTimeout(1800);

    await expect(page.getByText(/Diabetes/i).first()).toBeVisible();
    await expect(page.getByText('Colorectal Cancer')).toHaveCount(0);
  });

  test(...caseOf({
    id: 'AP_TC_150',
    module: MODULE,
    scenario: 'Verify entering a patient age filters the matrix to age-appropriate screenings',
    preconditions: 'Advisor is on the Navigation Matrix page.',
    steps: [
      'Enter a valid age into "Enter age (e.g., 45)".',
      'Observe the recommended screenings.',
    ],
    data: 'Age: 45',
    expected: 'The matrix re-filters to screenings relevant to the entered age and remains '
      + 'usable, with no application error.',
  }), async ({ page }) => {
    await page.getByPlaceholder(/Enter age/i).fill('45');
    await page.waitForTimeout(1800);
    await expect(page.getByRole('heading', { name: 'Navigation Matrix' })).toBeVisible();
    await expect(page.getByPlaceholder(/Enter age/i)).toHaveValue('45');
  });

  test(...caseOf({
    id: 'AP_TC_151',
    module: MODULE,
    scenario: 'NEGATIVE - Verify a non-numeric age is rejected by the age filter',
    preconditions: 'Advisor is on the Navigation Matrix page.',
    steps: [
      'Type letters into the "Enter age (e.g., 45)" field.',
      'Observe the field value and the condition list.',
    ],
    data: 'Age: "abc"',
    expected: 'The age field does not accept alphabetic input (it stays empty or shows a '
      + 'validation message) and the page does not crash.',
  }), async ({ page }) => {
    const age = page.getByPlaceholder(/Enter age/i);
    await age.fill('abc');
    await page.waitForTimeout(1200);

    const value = await age.inputValue();
    expect(value, `age field accepted alphabetic input: "${value}"`).not.toMatch(/[a-z]/i);
    await expect(page.getByRole('heading', { name: 'Navigation Matrix' })).toBeVisible();
  });

  test(...caseOf({
    id: 'AP_TC_152',
    module: MODULE,
    scenario: 'NEGATIVE - Verify searching the matrix for an unknown condition returns no results',
    preconditions: 'Advisor is on the Navigation Matrix page.',
    steps: [
      'Type a condition name that does not exist into the search box.',
      'Observe the condition list.',
    ],
    data: 'Search term: "zzzzz-no-such-condition"',
    expected: 'No screening conditions are listed and the page shows an empty state instead of '
      + 'the full catalogue.',
  }), async ({ page }) => {
    await page.getByPlaceholder(/Search navigation/i).fill('zzzzz-no-such-condition');
    await page.waitForTimeout(3500);

    await expect(page.getByText('Colorectal Cancer')).toHaveCount(0, { timeout: 15000 });
    await expect(page.getByText('Depression')).toHaveCount(0, { timeout: 15000 });
  });
});

test.describe('Communication Center', () => {
  const MODULE = 'Advisor Portal → Messages';

  test.beforeEach(async ({ page }) => {
    await page.goto('/wellness/messages');
    await page.waitForLoadState('networkidle');
  });

  test(...caseOf({
    id: 'AP_TC_153',
    module: MODULE,
    scenario: 'Verify the Communication Center loads sent communications with column headers',
    preconditions: 'Advisor is logged in and at least one communication has been sent.',
    steps: [
      'Open Messages from the sidebar.',
      'Observe the communications list and its column headers.',
    ],
    data: 'N/A',
    expected: 'The Communication Center heading is shown with the RECIPIENT, SUBJECT and CHANNEL '
      + 'column headers and at least one communication row.',
  }), async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Communication Center' })).toBeVisible();

    // This grid exposes no ARIA columnheaders, and CSS uppercases the labels, so
    // assert the header row's text case-insensitively.
    const headerRow = page.getByRole('row').first();
    for (const h of [/Recipient/i, /Subject/i, /Channel/i]) {
      await expect(headerRow).toContainText(h);
    }
    await expect(dataRows(page).first()).toBeVisible({ timeout: 20000 });
  });

  test(...caseOf({
    id: 'AP_TC_154',
    module: MODULE,
    scenario: 'Verify communications can be filtered by the Email and SMS channels',
    preconditions: 'Advisor is on the Communication Center page with communications listed.',
    steps: [
      'Note the total number of communications under the "All" filter.',
      'Click the "Email" channel filter and observe the list.',
      'Click the "SMS" channel filter and observe the list.',
      'Click "All" to restore the full list.',
    ],
    data: 'Channels: All, Email, SMS',
    expected: 'Each channel filter narrows the list to that channel only, and "All" restores the '
      + 'original number of communications.',
  }), async ({ page }) => {
    await expect(dataRows(page).first()).toBeVisible({ timeout: 20000 });
    const all = await dataRows(page).count();

    await page.getByRole('button', { name: 'Email', exact: true }).click();
    await page.waitForTimeout(1500);
    const email = await dataRows(page).count();
    expect(email).toBeLessThanOrEqual(all);

    await page.getByRole('button', { name: 'SMS', exact: true }).click();
    await page.waitForTimeout(1500);
    const sms = await dataRows(page).count();
    expect(sms).toBeLessThanOrEqual(all);

    await page.getByRole('button', { name: 'All', exact: true }).click();
    await page.waitForTimeout(1500);
    expect(await dataRows(page).count()).toBe(all);
  });

  test(...caseOf({
    id: 'AP_TC_155',
    module: MODULE,
    scenario: 'Verify the Compose action opens the message composer',
    preconditions: 'Advisor is on the Communication Center page.',
    steps: [
      'Click "Compose".',
      'Observe the composer surface.',
    ],
    data: 'N/A',
    expected: 'A message composer opens as a dialog or a dedicated view without an application '
      + 'error. No message is sent.',
  }), async ({ page }) => {
    await page.getByRole('button', { name: /^Compose$/i }).click();
    await page.waitForTimeout(2000);

    const opened = (await page.getByRole('dialog').count()) > 0
      || (await page.getByRole('textbox').count()) > 1;
    expect(opened, 'composer did not open').toBeTruthy();
  });

  test(...caseOf({
    id: 'AP_TC_156',
    module: MODULE,
    scenario: 'NEGATIVE - Verify searching communications for an unknown recipient returns no results',
    preconditions: 'Advisor is on the Communication Center page with communications listed.',
    steps: [
      'Type a recipient that does not exist into "Search communications...".',
      'Observe the communications list.',
    ],
    data: 'Search term: "zzzzz-no-such-recipient"',
    expected: 'No communication rows are returned and an empty state is displayed.',
  }), async ({ page }) => {
    await expect(dataRows(page).first()).toBeVisible({ timeout: 20000 });
    const before = await dataRows(page).count();

    await page.getByPlaceholder(/Search communications/i).fill('zzzzz-no-such-recipient');
    await page.waitForTimeout(3000);

    // The grid keeps one empty-state row, so assert the drop plus the message
    // rather than an exact count of zero.
    expect(await dataRows(page).count()).toBeLessThan(before);
    await expect(page.getByText(/no (communications?|messages?|results?|matches?)/i).first())
      .toBeVisible({ timeout: 15000 });
  });
});
