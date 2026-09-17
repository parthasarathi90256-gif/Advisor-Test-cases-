const { test, expect, caseOf } = require('../support/testcase');
const path = require('path');
const fs = require('fs');
const os = require('os');

// A 1x1 PNG for the upload cases - written to the OS temp dir at run time, never committed.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==', 'base64');
const pngPath = path.join(os.tmpdir(), 'aperion-qa-photo.png');
fs.writeFileSync(pngPath, PNG);

test.describe('Advisor Profile', () => {
  const MODULE = 'Advisor Portal → Profile';

  test.beforeEach(async ({ page }) => {
    await page.goto('/wellness/profile');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('region', { name: 'Personal Information' })).toBeVisible({ timeout: 40000 });
  });

  test(...caseOf({
    id: 'AP_TC_172',
    module: MODULE,
    scenario: 'Verify the advisor Profile page loads its overview and all information sections',
    preconditions: 'Advisor is logged in to the Advisor Portal.',
    steps: [
      'Open the profile from the avatar (or navigate to /wellness/profile).',
      'Observe the Profile Overview and the information sections.',
    ],
    data: 'N/A',
    expected: 'The Profile heading is shown with a Profile Overview (photo, email, experience, languages, Expertise '
      + 'Summary) and the Personal Information, Address Information, Professional Information, Languages Spoken, '
      + 'About and Expertise & Specialties sections, plus a "Back to workspace" control.',
  }), async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Profile', exact: true })).toBeVisible();
    for (const section of [
      'Profile Overview', 'Personal Information', 'Address Information',
      'Professional Information', 'Languages Spoken', 'About', 'Expertise & Specialties',
    ]) {
      await expect(page.getByRole('region', { name: section })).toBeVisible();
    }
    await expect(page.getByRole('heading', { name: 'Expertise Summary' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Back to workspace/i })).toBeVisible();
  });

  test(...caseOf({
    id: 'AP_TC_173',
    module: MODULE,
    scenario: 'Verify "Edit" on Personal Information opens an editable form with the identity fields locked',
    preconditions: 'Advisor is on the Profile page.',
    steps: ['Click "Edit" in the Personal Information section.', 'Observe the form fields.', 'Click Cancel.'],
    data: 'N/A',
    expected: 'First Name, Last Name, Date of Birth and Gender become editable; Email Address and Phone Number stay '
      + 'disabled; "Save Changes" is disabled until something changes; Cancel restores the read-only view.',
  }), async ({ page }) => {
    const region = page.getByRole('region', { name: 'Personal Information' });
    await region.getByRole('button', { name: 'Edit' }).click();
    await expect(region.getByRole('textbox', { name: /First Name/ })).toBeEditable();
    await expect(region.getByRole('textbox', { name: /Last Name/ })).toBeEditable();
    await expect(region.getByRole('textbox', { name: /Email Address/ })).toBeDisabled();
    await expect(region.getByRole('textbox', { name: /Phone Number/ })).toBeDisabled();
    await expect(region.getByRole('button', { name: /Save Changes/ })).toBeDisabled();
    await region.getByRole('button', { name: 'Cancel' }).click();
    await expect(region.getByRole('button', { name: 'Edit' })).toBeVisible();
  });

  test(...caseOf({
    id: 'AP_TC_174',
    module: MODULE,
    scenario: 'Verify "Back to workspace" returns to the Advisor Portal dashboard',
    preconditions: 'Advisor is on the Profile page.',
    steps: ['Click "Back to workspace".', 'Observe the resulting page.'],
    data: 'N/A',
    expected: 'The advisor is returned to the workspace (Dashboard), out of /wellness/profile.',
  }), async ({ page }) => {
    await page.getByRole('button', { name: /Back to workspace/i }).click();
    await page.waitForTimeout(1500);
    expect(page.url()).not.toContain('/wellness/profile');
  });

  test(...caseOf({
    id: 'AP_TC_297',
    module: MODULE,
    scenario: 'NEGATIVE - Verify a blank First Name is rejected in Personal Information',
    preconditions: 'Advisor is on the Profile page.',
    steps: ['Click "Edit" in Personal Information.', 'Clear the First Name field.', 'Observe the validation and the Save control.'],
    data: 'First Name: (blank)',
    expected: 'A "First name is required" message is shown and "Save Changes" stays disabled.',
  }), async ({ page }) => {
    const region = page.getByRole('region', { name: 'Personal Information' });
    await region.getByRole('button', { name: 'Edit' }).click();
    await region.getByRole('textbox', { name: /First Name/ }).fill('');
    await expect(region.getByText(/First name is required/i)).toBeVisible();
    await expect(region.getByRole('button', { name: /Save Changes/ })).toBeDisabled();
    await region.getByRole('button', { name: 'Cancel' }).click();
  });

  test(...caseOf({
    id: 'AP_TC_298',
    module: MODULE,
    scenario: 'Verify Date of Birth and Gender can be saved and persist after reload',
    preconditions: 'Advisor is on the Profile page.',
    steps: ['Click "Edit" in Personal Information.', 'Enter a Date of Birth and pick a Gender.', 'Click "Save Changes".', 'Reload the page.'],
    data: 'DOB: 05/06/1990; Gender: first option',
    expected: 'An "Information updated" confirmation is shown and the saved values are displayed after reload.',
  }), async ({ page }) => {
    const region = page.getByRole('region', { name: 'Personal Information' });
    await region.getByRole('button', { name: 'Edit' }).click();
    await region.getByRole('textbox', { name: 'Month' }).fill('05');
    await region.getByRole('textbox', { name: 'Day' }).fill('06');
    await region.getByRole('textbox', { name: 'Year' }).fill('1990');
    const gender = region.getByRole('combobox', { name: /Gender/ });
    await gender.click();
    await page.getByRole('option').first().click();
    await region.getByRole('button', { name: /Save Changes/ }).click();
    await expect(page.getByText(/Information updated/i)).toBeVisible({ timeout: 15000 });
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('region', { name: 'Personal Information' })).toContainText('05/06/1990', { timeout: 40000 });
  });

  test(...caseOf({
    id: 'AP_TC_299',
    module: MODULE,
    scenario: 'Verify a profile photo (PNG) can be uploaded',
    preconditions: 'Advisor is on the Profile page.',
    steps: ['Click "Choose File" and pick a PNG under 3 MB.', 'Click "Upload Photo".'],
    data: 'File: 1x1 PNG',
    expected: '"Upload Photo" enables after a file is chosen and the photo is uploaded; the overview shows the image.',
  }), async ({ page }) => {
    await page.locator('input[type=file]').first().setInputFiles(pngPath);
    const upload = page.getByRole('button', { name: 'Upload Photo' });
    await expect(upload).toBeEnabled();
    const resp = page.waitForResponse((r) => /profile\/photo/.test(r.url()) && r.request().method() === 'POST', { timeout: 30000 });
    await upload.click();
    expect((await resp).status()).toBe(200);
    await expect(page.getByRole('region', { name: 'Profile Overview' }).locator('img').first()).toBeVisible();
  });

  test(...caseOf({
    id: 'AP_TC_301',
    module: MODULE,
    scenario: 'Verify Address Information and Languages Spoken have editable forms',
    preconditions: 'Advisor is on the Profile page.',
    steps: ['Click "Edit" in Address Information; observe the form; Cancel.', 'Click "Edit" in Languages Spoken; observe; Cancel.'],
    data: 'N/A',
    expected: 'Address Information exposes editable Address Line 1/2, City, State, ZIP Code and Country; Languages Spoken opens an editor; both close on Cancel.',
  }), async ({ page }) => {
    const addr = page.getByRole('region', { name: 'Address Information' });
    await addr.getByRole('button', { name: 'Edit' }).click();
    expect(await addr.getByRole('textbox').count() + await addr.getByRole('combobox').count()).toBeGreaterThanOrEqual(5);
    await addr.getByRole('button', { name: 'Cancel' }).click();
    const lang = page.getByRole('region', { name: 'Languages Spoken' });
    await lang.getByRole('button', { name: 'Edit' }).click();
    await expect(lang.getByRole('button', { name: /Save|Cancel/ }).first()).toBeVisible();
    await lang.getByRole('button', { name: 'Cancel' }).click();
  });

  test(...caseOf({
    id: 'AP_TC_302',
    module: MODULE,
    scenario: 'Verify Professional Information can be edited and saved',
    preconditions: 'Advisor is on the Profile page.',
    steps: ['Click "Edit" in Professional Information.', 'Set Years of Experience.', 'Click "Save Changes".'],
    data: 'Years of Experience: 4',
    expected: 'The value is saved and shown in the read-only view.',
  }), async ({ page }) => {
    const prof = page.getByRole('region', { name: 'Professional Information' });
    await prof.getByRole('button', { name: 'Edit' }).click();
    const years = prof.getByRole('spinbutton').first().or(prof.getByRole('textbox', { name: /Years/ }).first());
    await years.fill('4');
    await prof.getByRole('button', { name: /Save Changes/ }).click();
    await page.waitForTimeout(3000);
    await expect(prof).toContainText(/4\s*years?|Years of Experience\s*\*?\s*4/i, { timeout: 15000 });
  });

  test(...caseOf({
    id: 'AP_TC_303',
    module: MODULE,
    scenario: 'Verify the Expertise Summary lists the matching dimensions used by the Navigation Matrix',
    preconditions: 'Advisor is on the Profile page.',
    steps: ['Locate the Expertise Summary in the Profile Overview.'],
    data: 'N/A',
    expected: 'Location Expertise, Health Conditions, Cultural Expertise and Age Groups are listed.',
  }), async ({ page }) => {
    const overview = page.getByRole('region', { name: 'Profile Overview' });
    for (const t of ['Location Expertise', 'Health Conditions', 'Cultural Expertise', 'Age Groups']) {
      await expect(overview.getByText(t, { exact: false })).toBeVisible();
    }
  });
});

test.describe('Notification Settings', () => {
  const MODULE = 'Advisor Portal → Notifications';

  test.beforeEach(async ({ page }) => {
    await page.goto('/wellness/notifications');
    await page.waitForLoadState('networkidle');
  });

  test(...caseOf({
    id: 'AP_TC_175',
    module: MODULE,
    scenario: 'Verify the Notification Settings page loads with delivery preferences',
    preconditions: 'Advisor is logged in to the Advisor Portal.',
    steps: [
      'Navigate to /wellness/notifications.',
      'Observe the notification settings.',
    ],
    data: 'N/A',
    expected: 'The Notification Settings heading is shown together with the "Notification Delivery '
      + 'Tips" guidance, without an application error.',
  }), async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Notification Settings' })).toBeVisible();
    await expect(page.getByText(/Notification Delivery Tips/i)).toBeVisible();
  });
});

test.describe('Care Scheduler → Confirmed Appointments', () => {
  const MODULE = 'Advisor Portal → Care Scheduler';

  test.beforeEach(async ({ page }) => {
    await page.goto('/wellness/care-scheduler/confirmed');
    await page.waitForLoadState('networkidle');
  });

  test(...caseOf({
    id: 'AP_TC_176',
    module: MODULE,
    scenario: 'Verify the Confirmed Appointments view loads',
    preconditions: 'Advisor is on Care Scheduler → Confirmed Appointments.',
    steps: [
      'Open Care Scheduler, then Confirmed Appointments.',
      'Observe the confirmed appointments list or its empty state.',
    ],
    data: 'N/A',
    expected: 'The "Confirmed Appointments" heading and an "Upcoming Appointments" count are shown, '
      + 'with either appointment rows or a "No Confirmed Appointments" empty state - not an error.',
  }), async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Confirmed Appointments', exact: true })).toBeVisible();
    await expect(page.getByText(/Upcoming Appointments/i)).toBeVisible();
  });

  test(...caseOf({
    id: 'AP_TC_177',
    module: MODULE,
    scenario: 'Verify "View member requests" returns to the Care Scheduler queue',
    preconditions: 'Advisor is on Care Scheduler → Confirmed Appointments.',
    steps: [
      'Click "View member requests".',
      'Observe the resulting page.',
    ],
    data: 'N/A',
    expected: 'The advisor is taken back to the Care Scheduler request queue.',
  }), async ({ page }) => {
    await page.getByRole('button', { name: /View member requests/i }).click();
    await page.waitForTimeout(1000);
    await expect(page).toHaveURL(/\/wellness\/care-scheduler$/);
  });
});
