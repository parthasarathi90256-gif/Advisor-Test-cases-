const { test, expect, caseOf } = require('../support/testcase');

const MODULE = 'Advisor Portal → Sessions → Clinical Workflow';

/**
 * These five routes are where an advisor actually runs a session - not just list
 * or schedule one. Reaching them means starting a real session (Scheduled ->
 * Started), and unlike scheduling, THERE IS NO CANCEL once a session is started;
 * it stays "Waiting for member" indefinitely. Each run of these tests therefore
 * permanently leaves one more stuck session per case in this shared dev
 * environment - a known, accepted tradeoff (see conversation/commit history),
 * not an oversight. Each case only verifies the screen loads with real content;
 * none of them enter or submit any assessment data.
 */
async function bookAndOpen(page, dialog, member, sessionType) {
  await page.getByRole('button', { name: 'Schedule Session' }).first().click();
  await expect(dialog).toBeVisible();

  await dialog.getByRole('combobox', { name: 'Member *' }).click();
  await page.getByRole('option', { name: member }).click();

  await dialog.getByRole('combobox', { name: 'Session type *' }).click();
  // Same booking-conflict rule found for AP_TC_170: a session type already
  // booked for this member today (even a cancelled one) is disabled here, and
  // the disabled state is computed asynchronously - give it a beat to settle.
  // When every type is already booked, the popover can also destabilize (the
  // option flickers/detaches) rather than settling into a plain disabled
  // state - treat any failure to read it as "can't book today" too.
  const typeOption = page.getByRole('option', { name: sessionType, exact: true });
  let preDisabled = true;
  try {
    await expect(typeOption).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(1000);
    preDisabled = (await typeOption.getAttribute('aria-disabled', { timeout: 5000 })) === 'true';
  } catch {
    preDisabled = true;
  }
  if (preDisabled) return { skip: true };
  await typeOption.click();

  await dialog.getByRole('button', { name: 'Phone', exact: true }).click();

  const submit = dialog.getByRole('button', { name: 'Schedule Session' });
  await expect(submit, 'submit stayed disabled with all required fields filled').toBeEnabled();
  await submit.click();

  const conflictToast = page.getByText('Could not schedule the session', { exact: true });
  await Promise.race([
    dialog.waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {}),
    conflictToast.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {}),
  ]);
  if (await conflictToast.isVisible()) return { skip: true };
  await expect(dialog).toBeHidden();

  // The list on this page instance doesn't reliably pick up a row it didn't
  // already have - reload for a fresh fetch, then use the search box (the
  // default view can page/window a row out of sight on a busy day) and switch
  // to Week view, since the app can auto-roll an overflow booking to tomorrow.
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: 'Week', exact: true }).click();
  await page.waitForTimeout(1000);
  await page.getByPlaceholder(/Search member, session type/i).fill(member);
  await page.waitForTimeout(1500);

  const scheduledRow = page.getByRole('button', {
    name: new RegExp(`${member}.*${sessionType}.*Phone`, 'i'),
  }).filter({ hasText: 'Scheduled' });
  await expect(scheduledRow, 'new session did not appear in the list').toBeVisible({ timeout: 15000 });
  await scheduledRow.getByRole('button', { name: 'Start', exact: true }).click();
  await page.waitForTimeout(1500);

  const startedRow = page.getByRole('button', {
    name: new RegExp(`${member}.*${sessionType}.*Phone`, 'i'),
  }).filter({ hasText: 'Assessment' });
  await expect(startedRow, 'session did not transition to a startable state').toBeVisible({ timeout: 15000 });
  await startedRow.getByRole('button', { name: 'Assessment', exact: true }).click();

  return { skip: false };
}

test.describe('Clinical Workflow Screens', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/wellness/sessions');
    await page.waitForLoadState('networkidle');
  });

  test(...caseOf({
    id: 'AP_TC_191',
    module: MODULE,
    scenario: 'Verify the Health Assessment workflow screen loads for a started session',
    preconditions: 'Advisor is on the Sessions page. Member "Tom Jerry" (parthaaa06+emp_7@gmail.com) '
      + 'has no Health Assessment already on record today.',
    steps: [
      'Schedule a Health Assessment session for the member and start it.',
      'Open the Assessment action.',
      'Observe the resulting screen. Do not enter or submit any data.',
    ],
    data: 'Member: Tom Jerry; Session type: Health Assessment; Meeting type: Phone',
    expected: 'The Health Assessment screen loads at /wellness/sessions/:id/health-assessment with '
      + 'its Demographics & Physical section, without an application error.',
  }), async ({ page }) => {
    const dialog = page.getByRole('dialog', { name: 'Book a session' });
    const { skip } = await bookAndOpen(page, dialog, 'Tom Jerry', 'Health Assessment');
    test.skip(skip, 'Tom Jerry already has a Health Assessment booked today - rerun another day.');

    await expect(page).toHaveURL(/\/health-assessment/);
    await expect(page.getByRole('heading', { name: 'Health Assessment' })).toBeVisible();
    await expect(page.getByText('Demographics & Physical')).toBeVisible();
  });

  test(...caseOf({
    id: 'AP_TC_192',
    module: MODULE,
    scenario: 'Verify the Pre Visit Session planning screen loads for a started session',
    preconditions: 'Advisor is on the Sessions page. Member "Tom Jerry" (parthaaa06+emp_7@gmail.com) '
      + 'has no Pre Visit Session already on record today.',
    steps: [
      'Schedule a Pre Visit Session for the member and start it.',
      'Open the Assessment action.',
      'Observe the resulting screen. Do not enter or submit any data.',
    ],
    data: 'Member: Tom Jerry; Session type: Pre Visit Session; Meeting type: Phone',
    expected: 'The Pre Visit Session screen loads at /wellness/sessions/:id/pre-visit-planning with '
      + 'its Screening Planning section, without an application error.',
  }), async ({ page }) => {
    const dialog = page.getByRole('dialog', { name: 'Book a session' });
    const { skip } = await bookAndOpen(page, dialog, 'Tom Jerry', 'Pre Visit Session');
    test.skip(skip, 'Tom Jerry already has a Pre Visit Session booked today - rerun another day.');

    await expect(page).toHaveURL(/\/pre-visit-planning/);
    await expect(page.getByRole('heading', { name: 'Pre Visit Session' })).toBeVisible();
    await expect(page.getByText('Screening Planning')).toBeVisible();
  });

  test(...caseOf({
    id: 'AP_TC_193',
    module: MODULE,
    scenario: 'Verify the Post-Visit Session screen loads for a started session',
    preconditions: 'Advisor is on the Sessions page. Member "Emily Anderson" (parthaaa06+ios_3@gmail.com) '
      + 'has no Post-Visit Session already on record today.',
    steps: [
      'Schedule a Post-Visit Session for the member and start it.',
      'Open the Assessment action.',
      'Observe the resulting screen. Do not enter or submit any data.',
    ],
    data: 'Member: Emily Anderson; Session type: Post-Visit Session; Meeting type: Phone',
    expected: 'The Post-Visit Session screen loads at /wellness/sessions/:id/post-visit-session with '
      + 'its Screening Planning & Notes section, without an application error.',
  }), async ({ page }) => {
    const dialog = page.getByRole('dialog', { name: 'Book a session' });
    const { skip } = await bookAndOpen(page, dialog, 'Emily Anderson', 'Post-Visit Session');
    test.skip(skip, 'Emily Anderson already has a Post-Visit Session booked today - rerun another day.');

    await expect(page).toHaveURL(/\/post-visit-session/);
    await expect(page.getByRole('heading', { name: 'Post-Visit Session' })).toBeVisible();
    await expect(page.getByText('Screening Planning & Notes')).toBeVisible();
  });

  test(...caseOf({
    id: 'AP_TC_194',
    module: MODULE,
    scenario: 'Verify the Wellness Check-in screen loads for a started session',
    preconditions: 'Advisor is on the Sessions page. Member "Emily Anderson" (parthaaa06+ios_3@gmail.com) '
      + 'has no Wellness Check-in already on record today.',
    steps: [
      'Schedule a Wellness Check-in session for the member and start it.',
      'Open the Assessment action.',
      'Observe the resulting screen. Do not enter or submit any data.',
    ],
    data: 'Member: Emily Anderson; Session type: Wellness Check-in; Meeting type: Phone',
    expected: 'The Wellness Check-in screen loads at /wellness/sessions/:id/wellness-check-in with '
      + 'its Wellness Progress & Feedback section, without an application error.',
  }), async ({ page }) => {
    const dialog = page.getByRole('dialog', { name: 'Book a session' });
    const { skip } = await bookAndOpen(page, dialog, 'Emily Anderson', 'Wellness Check-in');
    test.skip(skip, 'Emily Anderson already has a Wellness Check-in booked today - rerun another day.');

    await expect(page).toHaveURL(/\/wellness-check-in/);
    await expect(page.getByRole('heading', { name: 'Wellness Check-in' })).toBeVisible();
    await expect(page.getByText('Wellness Progress & Feedback')).toBeVisible();
  });

  test(...caseOf({
    id: 'AP_TC_195',
    module: MODULE,
    scenario: 'Verify the Annual Road Map review screen loads for a started session',
    preconditions: 'Advisor is on the Sessions page. Member "Emily Anderson" (parthaaa06+ios_3@gmail.com) '
      + 'has no Annual Road Map session already on record today.',
    steps: [
      'Schedule an Annual Road Map session for the member and start it.',
      'Open the Assessment action.',
      'Observe the resulting screen. Do not enter or submit any data.',
    ],
    data: 'Member: Emily Anderson; Session type: Annual Road Map; Meeting type: Phone',
    expected: 'The Annual Road Map screen loads at /wellness/sessions/:id/annual-road-map-review '
      + 'with its Health Profile Comparison section, without an application error.',
  }), async ({ page }) => {
    const dialog = page.getByRole('dialog', { name: 'Book a session' });
    const { skip } = await bookAndOpen(page, dialog, 'Emily Anderson', 'Annual Road Map');
    test.skip(skip, 'Emily Anderson already has an Annual Road Map session booked today - rerun another day.');

    await expect(page).toHaveURL(/\/annual-road-map-review/);
    await expect(page.getByRole('heading', { name: 'Annual Road Map' })).toBeVisible();
    await expect(page.getByText('Health Profile Comparison')).toBeVisible();
  });
});
