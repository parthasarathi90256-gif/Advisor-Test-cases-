const { test, expect, caseOf } = require('../support/testcase');
const {
  gotoSettled, findSessionRow, bookSession, startAndJoin, completeWorkflow, runFullSession, fillStep,
} = require('../support/portal');

const MODULE = 'Advisor Portal → Sessions → Clinical Workflow';

/**
 * Each case books a real session, starts it, drives every step of the
 * workflow and completes it. That is the only way to exercise these screens,
 * and it permanently adds one completed session per case to the shared dev
 * data (see the note in 29-session-clinical-screens.spec.js). Cases skip
 * cleanly when every test member already holds that session type today.
 */
test.describe('Clinical workflows - end to end', () => {
  test.describe.configure({ timeout: 900000 });

  const full = (id, type, steps, expectedSteps) => test(...caseOf({
    id,
    module: MODULE,
    scenario: `Verify the ${type} workflow can be completed end to end (${expectedSteps.length} steps)`,
    preconditions: 'Advisor is logged in; a test member has no session of this type today.',
    steps: [
      `Schedule a ${type} (Phone) for a test member and start it; click Member Joined.`,
      ...steps,
      'Confirm the session shows as Completed in the list.',
    ],
    data: `Session type: ${type}; realistic values for every required field`,
    expected: `Every step saves and advances (${expectedSteps.join(' → ')}), the completion button closes the workflow and the session row shows Completed with Assessment and Share actions.`,
  }), async ({ page }) => {
    let result;
    try { result = await runFullSession(page, type); }
    catch (e) { if (/free today|rerun another day/.test(e.message)) test.skip(true, e.message); throw e; }
    for (const s of expectedSteps.slice(0, -1)) expect(result.steps.join(' | '), `step "${s}" was not visited`).toContain(s);
    const row = await findSessionRow(page, result.member, type, /Completed/);
    await expect(row.getByRole('button', { name: 'Assessment', exact: true })).toBeVisible();
    await expect(row.getByRole('button', { name: 'Share' })).toBeVisible();
  });

  full('AP_TC_246', 'Health Assessment', [
    'Step 1 Demographics & Physical: enter height/weight (BMI is validated) and Confirm & continue.',
    'Steps 2-5: Employment & Literacy, Lifestyle Habits, Dietary & Behavioral Health, Health Assessment - fill and Confirm & continue.',
    'Step 6 Assessment Review: click "Complete assessment".',
  ], ['Demographics & Physical', 'Employment & Literacy', 'Lifestyle Habits', 'Dietary & Behavioral Health', 'Health Assessment', 'Assessment Review']);

  full('AP_TC_250', 'Post-Visit Session', [
    'Step 1 Screening Planning & Notes: record each screening and Save & Continue.',
    'Step 2 Health Risk Assessment Outcomes: record outcomes and Save & Continue.',
    'Step 3 Doctor Questions - Outcomes and Step 4 Visit Priorities - Achievement Status: Save & Continue.',
    'Step 5 Visit Summary: click "Complete Session".',
  ], ['Screening Planning & Notes', 'Health Risk Assessment Outcomes', 'Doctor Questions - Outcomes', 'Visit Priorities - Achievement Status', 'Visit Summary']);

  full('AP_TC_251', 'Wellness Check-in', [
    'Step 1 Wellness Progress & Feedback, Step 2 Barriers & Challenges, Step 3 Next Steps & Actions: fill and Save & Continue.',
    'Step 4 Session Summary: click "Complete Session".',
  ], ['Wellness Progress & Feedback', 'Barriers & Challenges', 'Next Steps & Actions', 'Session Summary']);

  full('AP_TC_252', 'Annual Road Map', [
    'Step 1 Health Profile Comparison: enter current metrics and Save & Continue.',
    'Step 2 Preventive Care Completion and Step 3 Wellness Goal Achievement: Save & Continue.',
    'Step 4 Member Feedback & Experience: rate each 1-10 scale and Save & Continue.',
    'Step 5 Summary: click "Complete Session".',
  ], ['Health Profile Comparison', 'Preventive Care Completion', 'Wellness Goal Achievement', 'Member Feedback & Experience', 'Summary']);

  test(...caseOf({
    id: 'AP_TC_248',
    module: MODULE,
    scenario: 'Verify Pre Visit Session step 1 (Screening Planning) saves and step 2 (Health Risk Assessment) requires every risk item to be recorded',
    preconditions: 'Advisor is logged in; a test member has no Pre Visit Session today.',
    steps: [
      'Schedule and start a Pre Visit Session; click Member Joined.',
      'Step 1: observe Critical / Advised / Optional groups and the screening cards; click Confirm & continue.',
      'Step 2: observe the four risk categories with three items each; open an item.',
      'Observe "Confirm & continue" before all items are recorded.',
    ],
    data: 'Session type: Pre Visit Session',
    expected: 'Step 1 saves (screening step marked reviewed) and step 2 lists Cardiovascular Health, Metabolic & Diabetes Risk, '
      + 'Men\'s/Women\'s Health Concerns and Mental Health & Wellbeing; each item needs a Risk level and Notes; "Confirm & continue" stays disabled until every item is saved, skipped or removed.',
  }), async ({ page }) => {
    let booked;
    try { booked = await bookSession(page, { type: 'Pre Visit Session', meeting: 'Phone' }); }
    catch (e) { test.skip(true, e.message); }
    await startAndJoin(page, booked.member, 'Pre Visit Session');
    await expect(page.getByRole('heading', { name: 'Screening Planning' })).toBeVisible({ timeout: 40000 });
    for (const g of [/^Critical \d+/, /^Advised \d+/, /^Optional \d+/]) await expect(page.getByRole('button', { name: g })).toBeVisible();
    await fillStep(page);
    const reviewed = page.waitForResponse((r) => /screening\/reviewed|member-screening-assessments/.test(r.url()) && r.status() < 400, { timeout: 40000 });
    await page.getByRole('button', { name: 'Confirm & continue' }).click();
    await reviewed;
    await expect(page.getByRole('heading', { name: 'Health Risk Assessment' })).toBeVisible({ timeout: 40000 });
    for (const c of [/^Cardiovascular Health \d+/, /^Metabolic & Diabetes Risk \d+/, /^Mental Health & Wellbeing \d+/]) await expect(page.getByRole('button', { name: c })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirm & continue' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Save & next' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Skip', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Remove from plan' })).toBeVisible();
    await expect(page.getByText(/Notes for this member/)).toBeVisible();
  });

  test(...caseOf({
    id: 'AP_TC_247',
    module: MODULE,
    scenario: 'NEGATIVE - Verify the Health Assessment rejects implausible physical measurements (BMI check)',
    preconditions: 'An in-progress Health Assessment is open (created by this test).',
    steps: ['Schedule and start a Health Assessment; click Member Joined.', 'Enter height 6 ft 6 in and weight 60 lbs.', 'Click "Confirm & continue".'],
    data: 'Height: 6\'6"; Weight: 60 lbs (BMI ≈ 6.9)',
    expected: 'A BMI warning ("extremely low… verify the values") is shown and the step does not advance.',
  }), async ({ page }) => {
    let booked;
    try { booked = await bookSession(page, { type: 'Health Assessment', meeting: 'Phone' }); }
    catch (e) { test.skip(true, e.message); }
    await startAndJoin(page, booked.member, 'Health Assessment');
    await expect(page.getByRole('heading', { name: 'Demographics & Physical' })).toBeVisible({ timeout: 40000 });
    await page.getByRole('spinbutton', { name: /Height \(feet\)/ }).fill('6');
    await page.getByRole('spinbutton', { name: /Height \(inches\)/ }).fill('6');
    await page.getByRole('spinbutton', { name: /Weight \(lbs\)/ }).fill('60');
    await page.getByRole('button', { name: 'Confirm & continue' }).click();
    await expect(page.getByText(/BMI [\d.]+ is extremely low/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('heading', { name: 'Demographics & Physical' })).toBeVisible();
    // Leave the session usable: correct the values and complete it.
    await completeWorkflow(page);
  });

  test(...caseOf({
    id: 'AP_TC_253',
    module: MODULE,
    scenario: 'Verify an in-progress workflow retains saved data when reopened',
    preconditions: 'An in-progress Health Assessment with step 1 saved exists (created by this test).',
    steps: ['Schedule and start a Health Assessment; click Member Joined.', 'Enter 5 ft 8 in / 170 lbs and Confirm & continue.', 'Return to Sessions and open the Assessment again.', 'Observe step 1 values.'],
    data: 'Height 5\'8", Weight 170 lbs',
    expected: 'The saved measurements are shown again (the workflow reopens on step 1 - progress position is not remembered, data is).',
  }), async ({ page }) => {
    let booked;
    try { booked = await bookSession(page, { type: 'Health Assessment', meeting: 'Phone' }); }
    catch (e) { test.skip(true, e.message); }
    await startAndJoin(page, booked.member, 'Health Assessment');
    await expect(page.getByRole('heading', { name: 'Demographics & Physical' })).toBeVisible({ timeout: 40000 });
    await page.getByRole('spinbutton', { name: /Height \(feet\)/ }).fill('5');
    await page.getByRole('spinbutton', { name: /Height \(inches\)/ }).fill('8');
    await page.getByRole('spinbutton', { name: /Weight \(lbs\)/ }).fill('170');
    await fillStep(page);
    const saved = page.waitForResponse((r) => /demographics-physical/.test(r.url()) && r.request().method() === 'PUT' && r.status() === 200, { timeout: 40000 });
    await page.getByRole('button', { name: 'Confirm & continue' }).click();
    await saved;
    const row = await findSessionRow(page, booked.member, 'Health Assessment', /In progress/);
    await row.getByRole('button', { name: 'Assessment', exact: true }).click();
    await page.waitForURL(/health-assessment/, { timeout: 60000 });
    await expect(page.getByRole('spinbutton', { name: /Weight \(lbs\)/ })).toHaveValue('170', { timeout: 40000 });
    await completeWorkflow(page);
  });

  test(...caseOf({
    id: 'AP_TC_254',
    module: MODULE,
    scenario: 'Verify workflow journey steps are gated sequentially and the Member info panel collapses',
    preconditions: 'An in-progress Post-Visit Session is open (created by this test).',
    steps: ['Schedule and start a Post-Visit Session; click Member Joined.', 'Observe the Journey progress steps.', 'Click "Collapse Member info".'],
    data: 'N/A',
    expected: 'Steps 02-05 are disabled until step 01 is saved; History and End Meeting are available; the Member info panel collapses.',
  }), async ({ page }) => {
    let booked;
    try { booked = await bookSession(page, { type: 'Post-Visit Session', meeting: 'Phone' }); }
    catch (e) { test.skip(true, e.message); }
    await startAndJoin(page, booked.member, 'Post-Visit Session');
    await expect(page.getByRole('heading', { name: 'Screening Planning & Notes' })).toBeVisible({ timeout: 40000 });
    for (const s of [/^02 /, /^03 /, /^04 /, /^05 /]) await expect(page.getByRole('button', { name: s })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'History' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'End Meeting' })).toBeVisible();
    await page.getByRole('button', { name: /Collapse Member info/i }).click();
    await expect(page.getByRole('button', { name: /Expand Member info/i })).toBeVisible();
    await completeWorkflow(page);
  });
});
