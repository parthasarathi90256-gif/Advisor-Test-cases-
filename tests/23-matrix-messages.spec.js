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

test.describe('Navigation Matrix — extended', () => {
  const MODULE = 'Advisor Portal → Navigation Matrix';
  const cards = (page) => page.locator('main h3');

  test.beforeEach(async ({ page }) => {
    await page.goto('/wellness/navigation-matrix');
    await page.waitForLoadState('networkidle');
    await expect(cards(page).first()).toBeVisible({ timeout: 60000 });
  });

  test(...caseOf({
    id: 'AP_TC_267',
    module: MODULE,
    scenario: 'Verify the gender filter shows sex-specific screenings only for the chosen gender',
    preconditions: 'Advisor is on the Navigation Matrix with the full catalogue loaded.',
    steps: ['Choose "Female" in "Filter by gender".', 'Observe the condition cards.'],
    data: 'Gender: Female',
    expected: 'Breast Cancer and Cervical Cancer cards remain, Prostate Cancer (PSA) is removed, and the card count drops.',
  }), async ({ page }) => {
    const all = await cards(page).count();
    await page.getByRole('combobox', { name: 'Filter by gender' }).click();
    await page.getByRole('option', { name: /Female/ }).click();
    await page.waitForTimeout(3000);
    const names = await cards(page).allInnerTexts();
    expect(names.length).toBeLessThan(all);
    expect(names.some((n) => /Breast Cancer/.test(n))).toBeTruthy();
    expect(names.some((n) => /Cervical Cancer/.test(n))).toBeTruthy();
    expect(names.some((n) => /Prostate Cancer/.test(n))).toBeFalsy();
  });

  test(...caseOf({
    id: 'AP_TC_268',
    module: MODULE,
    scenario: 'Verify the age filter hides screenings that do not apply at that age',
    preconditions: 'Advisor is on the Navigation Matrix.',
    steps: ['Enter age 30.', 'Observe the cards.'],
    data: 'Age: 30',
    expected: 'AAA (Aortic Aneurysm), which applies to men 65-75, is no longer listed; age-appropriate screenings remain.',
  }), async ({ page }) => {
    await page.getByPlaceholder(/Enter age/i).fill('30');
    await page.waitForTimeout(3000);
    const names = await cards(page).allInnerTexts();
    expect(names.length).toBeGreaterThan(0);
    expect(names.some((n) => /AAA/.test(n))).toBeFalsy();
  });

  test(...caseOf({
    id: 'AP_TC_269',
    module: MODULE,
    scenario: 'Verify the priority and commonness filters narrow the catalogue',
    preconditions: 'Advisor is on the Navigation Matrix.',
    steps: ['Choose a priority in "Filter by priority".', 'Note the count; Clear all.', 'Choose a commonness in "Filter by commonness".'],
    data: 'First non-default option of each filter',
    expected: 'Each filter reduces the number of cards and Clear all restores the full set.',
  }), async ({ page }) => {
    const all = await cards(page).count();
    for (const f of ['Filter by priority', 'Filter by commonness']) {
      await page.getByRole('combobox', { name: f }).click();
      await page.getByRole('option').nth(1).click();
      await page.waitForTimeout(3000);
      expect(await cards(page).count()).toBeLessThan(all);
      await page.getByRole('button', { name: 'Clear all' }).click();
      await page.waitForTimeout(3000);
      expect(await cards(page).count()).toBe(all);
    }
  });

  test(...caseOf({
    id: 'AP_TC_270',
    module: MODULE,
    scenario: 'Verify the matrix can be switched between Grid and List views',
    preconditions: 'Advisor is on the Navigation Matrix (Grid).',
    steps: ['Click "List".', 'Click "Grid".'],
    data: 'N/A',
    expected: 'List view renders the conditions as a table; Grid restores the cards.',
  }), async ({ page }) => {
    const group = page.getByRole('group', { name: 'Matrix view' });
    await group.getByRole('button', { name: 'List', exact: true }).click();
    await page.waitForTimeout(3000);
    await expect(page.getByRole('table').first()).toBeVisible();
    await group.getByRole('button', { name: 'Grid', exact: true }).click();
    await page.waitForTimeout(3000);
    await expect(cards(page).first()).toBeVisible();
  });

  test(...caseOf({
    id: 'AP_TC_272',
    module: MODULE,
    scenario: 'Verify a condition card shows target population, age-based eligibility and clinical notes',
    preconditions: 'Advisor is on the Navigation Matrix.',
    steps: ['Read the first condition card.'],
    data: 'N/A',
    expected: 'The card shows Target population, Age-based eligibility bands (18–39, 40–49, 50–64, 65+) and Clinical notes, plus the eligibility legend.',
  }), async ({ page }) => {
    const main = page.locator('main');
    for (const t of ['Target population', 'Age-based eligibility', '18–39', '40–49', '50–64', '65+', 'Clinical notes']) {
      await expect(main.getByText(t, { exact: false }).first()).toBeVisible();
    }
    await expect(main.getByText(/Eligibility/).first()).toBeVisible();
  });
});
