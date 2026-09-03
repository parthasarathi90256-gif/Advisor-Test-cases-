const { test, expect, caseOf } = require('../support/testcase');

test.describe('Advisor Profile', () => {
  const MODULE = 'Advisor Portal → Profile';

  test.beforeEach(async ({ page }) => {
    await page.goto('/wellness/profile');
    await page.waitForLoadState('networkidle');
  });

  test(...caseOf({
    id: 'AP_TC_172',
    module: MODULE,
    scenario: 'Verify the advisor Profile page loads with its section navigation',
    preconditions: 'Advisor is logged in to the Advisor Portal.',
    steps: [
      'Open the profile from the avatar menu (or navigate to /wellness/profile).',
      'Observe the profile sections.',
    ],
    data: 'N/A',
    expected: 'The Profile heading is shown together with Overview, Personal Information, Address '
      + 'Information, Professional Information, Languages Spoken, About and Expertise & Specialties '
      + 'sections, and a "Back to workspace" control.',
  }), async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
    for (const section of [
      'Overview', 'Personal Information', 'Address Information',
      'Professional Information', 'Languages Spoken', 'About', 'Expertise & Specialties',
    ]) {
      await expect(page.getByRole('button', { name: section, exact: true })).toBeVisible();
    }
    await expect(page.getByRole('button', { name: /Back to workspace/i })).toBeVisible();
  });

  test(...caseOf({
    id: 'AP_TC_173',
    module: MODULE,
    scenario: 'Verify clicking a profile section scrolls to / opens that section',
    preconditions: 'Advisor is on the Profile page.',
    steps: [
      'Click the "Personal Information" section control.',
      'Observe the Personal Information section and its Edit control.',
    ],
    data: 'N/A',
    expected: 'The Personal Information section is shown (or scrolled into view) with an Edit '
      + 'control, without an application error.',
  }), async ({ page }) => {
    await page.getByRole('button', { name: 'Personal Information', exact: true }).click();
    await page.waitForTimeout(800);
    await expect(page.getByRole('heading', { name: 'Personal Information' })).toBeVisible();
  });

  test(...caseOf({
    id: 'AP_TC_174',
    module: MODULE,
    scenario: 'Verify "Back to workspace" returns to the Advisor Portal dashboard',
    preconditions: 'Advisor is on the Profile page.',
    steps: [
      'Click "Back to workspace".',
      'Observe the resulting page.',
    ],
    data: 'N/A',
    expected: 'The advisor is returned to the workspace (Dashboard), out of /wellness/profile.',
  }), async ({ page }) => {
    await page.getByRole('button', { name: /Back to workspace/i }).click();
    await page.waitForTimeout(1500);
    expect(page.url()).not.toContain('/wellness/profile');
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
    await expect(page.getByRole('heading', { name: 'Confirmed Appointments' })).toBeVisible();
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
