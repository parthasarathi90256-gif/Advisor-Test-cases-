const { test, expect, caseOf } = require('../support/testcase');
const {
  gotoSettled, findSessionRow, openBookingDialog, bookSession, cancelSession, sessionRow,
} = require('../support/portal');

const MODULE = 'Advisor Portal → Sessions';

test.describe('Sessions — filters, calendar and booking rules', () => {
  test.beforeEach(async ({ page }) => {
    await gotoSettled(page, '/wellness/sessions', 3000);
  });

  test(...caseOf({
    id: 'AP_TC_231',
    module: MODULE,
    scenario: 'Verify the session status filter lists all statuses and filters the list',
    preconditions: 'Advisor is on the Sessions page.',
    steps: ['Open the "All Statuses" dropdown.', 'Observe the options.', 'Choose "Completed".'],
    data: 'Statuses: Scheduled, In Progress, Completed, Cancelled, Skipped',
    expected: 'All five statuses are offered and the list re-renders without an application error.',
  }), async ({ page }) => {
    await page.locator('[role=combobox]').filter({ hasText: 'All Statuses' }).click();
    for (const o of ['Scheduled', 'In Progress', 'Completed', 'Cancelled', 'Skipped']) {
      await expect(page.getByRole('option', { name: o })).toBeVisible();
    }
    await page.getByRole('option', { name: 'Completed' }).click();
    await page.waitForTimeout(2500);
    await expect(page.getByRole('heading', { name: 'Sessions', exact: true })).toBeVisible();
    expect(await sessionRow(page, '', '').filter({ hasText: /Scheduled$|Cancelled/ }).count()).toBe(0);
  });

  test(...caseOf({
    id: 'AP_TC_232',
    module: MODULE,
    scenario: 'Verify the session type filter lists the five session types',
    preconditions: 'Advisor is on the Sessions page.',
    steps: ['Open the "All Session Types" dropdown.', 'Observe the options.', 'Choose "Health Assessment".'],
    data: 'Types: Health Assessment, Pre Visit Session, Post-Visit Session, Wellness Check-in, Annual Road Map',
    expected: 'All five types are offered and the list re-renders without an application error.',
  }), async ({ page }) => {
    await page.locator('[role=combobox]').filter({ hasText: 'All Session Types' }).click();
    for (const o of ['Health Assessment', 'Pre Visit Session', 'Post-Visit Session', 'Wellness Check-in', 'Annual Road Map']) {
      await expect(page.getByRole('option', { name: o, exact: true })).toBeVisible();
    }
    await page.getByRole('option', { name: 'Health Assessment', exact: true }).click();
    await page.waitForTimeout(2500);
    await expect(page.getByRole('heading', { name: 'Sessions', exact: true })).toBeVisible();
  });

  test(...caseOf({
    id: 'AP_TC_233',
    module: MODULE,
    scenario: 'Verify the calendar Previous / Next / Today controls move the displayed month',
    preconditions: 'Advisor is on the Sessions page in Month view.',
    steps: ['Switch to Month view and note the month label.', 'Click Previous.', 'Click Next twice.', 'Click Today.'],
    data: 'N/A',
    expected: 'Previous shows the prior month, Next moves forward, and Today returns to the current month.',
  }), async ({ page }) => {
    const label = () => page.locator('main p').filter({ hasText: /^[A-Z][a-z]+ 20\d\d$/ }).first().innerText();
    await page.getByRole('button', { name: 'Month', exact: true }).click();
    await page.waitForTimeout(1200);
    const start = await label();
    await page.getByRole('button', { name: 'Previous', exact: true }).click();
    await page.waitForTimeout(1200);
    const prev = await label();
    expect(prev).not.toBe(start);
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await page.waitForTimeout(1200);
    expect(await label()).not.toBe(prev);
    await page.getByRole('button', { name: 'Today', exact: true }).click();
    await page.waitForTimeout(1200);
    expect(await label()).toBe(start);
  });

  test(...caseOf({
    id: 'AP_TC_234',
    module: MODULE,
    scenario: 'Verify selecting a day in Month view lists that day\'s sessions with counts',
    preconditions: 'Advisor is on the Sessions page; at least one past day has sessions.',
    steps: ['Switch to Month view.', 'Click a day whose button shows "— N sessions".', 'Observe the Selected Day panel and the list.'],
    data: 'Any day with sessions in the current or previous month',
    expected: 'The Selected Day panel shows that date with Sessions / Virtual / Phone counts and the list shows rows for it.',
  }), async ({ page }) => {
    await page.getByRole('button', { name: 'Month', exact: true }).click();
    await page.waitForTimeout(1200);
    let day = page.getByRole('button', { name: /— \d+ sessions?$/ }).first();
    if (!(await day.count())) {
      await page.getByRole('button', { name: 'Previous', exact: true }).click();
      await page.waitForTimeout(1500);
      day = page.getByRole('button', { name: /— \d+ sessions?$/ }).first();
    }
    test.skip(!(await day.count()), 'No day with sessions in this or the previous month.');
    const name = await day.getAttribute('aria-label') || await day.innerText();
    await day.click();
    await page.waitForTimeout(3000);
    await expect(page.getByText(/Selected Day/i)).toBeVisible();
    expect(await sessionRow(page, '', '').count(), `no rows listed for ${name}`).toBeGreaterThan(0);
  });

  test(...caseOf({
    id: 'AP_TC_235',
    module: MODULE,
    scenario: 'NEGATIVE - Verify past dates and Sundays cannot be chosen in the booking calendar',
    preconditions: 'Advisor has the "Book a session" dialog open.',
    steps: ['Click "Schedule Session".', 'Inspect the date buttons for days before today and for Sundays.'],
    data: 'Current month',
    expected: 'Days before today are disabled; Sundays are disabled and labelled "Sunday, unavailable"; today is pre-selected.',
  }), async ({ page }) => {
    const dialog = await openBookingDialog(page);
    const today = new Date();
    const iso = today.toISOString().slice(0, 10);
    await expect(dialog.getByRole('button', { name: iso, exact: true })).toHaveAttribute('aria-pressed', 'true');
    const sundays = dialog.getByRole('button', { name: /Sunday, unavailable/ });
    expect(await sundays.count()).toBeGreaterThan(0);
    for (const s of await sundays.all()) await expect(s).toBeDisabled();
    const yesterday = new Date(today.getTime() - 86400000).toISOString().slice(0, 10);
    if (yesterday.slice(0, 7) === iso.slice(0, 7)) {
      await expect(dialog.getByRole('button', { name: new RegExp(`^${yesterday}`) })).toBeDisabled();
    }
    await dialog.getByRole('button', { name: 'Cancel' }).click();
  });

  test(...caseOf({
    id: 'AP_TC_236',
    module: MODULE,
    scenario: 'Verify the booking form auto-fills the title and computes a 45-minute duration',
    preconditions: 'Advisor has the "Book a session" dialog open.',
    steps: ['Choose a member and a session type.', 'Observe the Session title and Duration.', 'Observe the "Still needed" status as fields are filled.'],
    data: 'Member: first test member; Type: Health Assessment',
    expected: 'The title becomes "<Member> – <Type>", Duration reads "45 minutes" (auto), and the status text lists only the remaining required fields.',
  }), async ({ page }) => {
    const dialog = await openBookingDialog(page);
    await expect(dialog.getByRole('status')).toContainText(/Still needed: member, session type, session title, meeting link/i);
    await dialog.getByRole('combobox', { name: 'Member *' }).click();
    const opt = page.getByRole('option').first();
    const member = (await opt.innerText()).split('\n')[0].trim();
    await opt.click();
    await dialog.getByRole('combobox', { name: 'Session type *' }).click();
    await page.waitForTimeout(1500);
    const type = page.getByRole('option').filter({ hasNot: page.locator('[aria-disabled="true"]') }).first();
    test.skip(!(await type.count()), 'Every session type is already booked for this member today.');
    const typeName = (await type.innerText()).trim();
    await type.click();
    await expect(dialog.getByRole('textbox', { name: 'Session title *' })).toHaveValue(new RegExp(`${member}.*${typeName}`));
    await expect(dialog.getByText(/Duration/)).toBeVisible();
    await expect(dialog.getByText(/45 minutes/)).toBeVisible();
    await expect(dialog.getByRole('status')).toContainText(/Still needed: meeting link/i);
    await dialog.getByRole('button', { name: 'Cancel' }).click();
  });

  test(...caseOf({
    id: 'AP_TC_237',
    module: MODULE,
    scenario: 'Verify "Generate Zoom link" creates a meeting link for a Virtual session',
    preconditions: 'Advisor has the "Book a session" dialog open with a member and type chosen.',
    steps: ['Keep Meeting type = Virtual.', 'Click "Generate Zoom link".', 'Observe the Meeting link field and the Copy control.'],
    data: 'Meeting type: Virtual',
    expected: 'A zoom.us join URL is filled in, Copy becomes enabled and the "Still needed" status no longer lists the meeting link. No session is created.',
  }), async ({ page }) => {
    const dialog = await openBookingDialog(page);
    await dialog.getByRole('combobox', { name: 'Member *' }).click();
    await page.getByRole('option').first().click();
    await dialog.getByRole('combobox', { name: 'Session type *' }).click();
    await page.waitForTimeout(1500);
    const type = page.getByRole('option').filter({ hasNot: page.locator('[aria-disabled="true"]') }).first();
    test.skip(!(await type.count()), 'Every session type is already booked for this member today.');
    await type.click();
    await dialog.getByRole('button', { name: 'Generate Zoom link' }).click();
    await expect(dialog.getByText(/zoom\.us\/j\//)).toBeVisible({ timeout: 30000 });
    await expect(dialog.getByRole('button', { name: 'Copy' })).toBeEnabled();
    await expect(dialog.getByRole('status')).not.toContainText(/meeting link/i);
    await dialog.getByRole('button', { name: 'Cancel' }).click();
  });

  test(...caseOf({
    id: 'AP_TC_238',
    module: MODULE,
    scenario: 'NEGATIVE - Verify a member cannot be booked for the same session type twice on one day',
    preconditions: 'A test member already has a session of some type today (created by this test if needed).',
    steps: ['Book a Phone session for a member.', 'Open "Book a session" again for the same member.', 'Open the Session type list.'],
    data: 'Type: first free type for the member',
    expected: 'The type just booked is disabled in the list for that member (or the app rejects the duplicate with a "Could not schedule" message).',
  }), async ({ page }) => {
    let booked;
    try { booked = await bookSession(page, { type: 'Annual Road Map', meeting: 'Phone', description: 'AP_TC_238 duplicate-booking check' }); }
    catch (e) { test.skip(true, e.message); }
    await gotoSettled(page, '/wellness/sessions', 3000);
    const dialog = await openBookingDialog(page);
    await dialog.getByRole('combobox', { name: 'Member *' }).click();
    await page.getByRole('option', { name: booked.member }).first().click();
    await dialog.getByRole('combobox', { name: 'Session type *' }).click();
    await page.waitForTimeout(2000);
    const opt = page.getByRole('option', { name: 'Annual Road Map', exact: true });
    expect(await opt.count() === 0 || (await opt.getAttribute('aria-disabled')) === 'true', 'duplicate type still offered').toBeTruthy();
    await page.keyboard.press('Escape');
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    const row = await findSessionRow(page, booked.member, 'Annual Road Map', 'Scheduled');
    await cancelSession(page, row, 'AP_TC_238 cleanup');
  });

  test(...caseOf({
    id: 'AP_TC_245',
    module: MODULE,
    scenario: 'Verify the session list paginates (rows per page + page controls)',
    preconditions: 'Advisor is on the Sessions page.',
    steps: ['Select a day with sessions (or today).', 'Observe the pagination footer.'],
    data: 'N/A',
    expected: 'A "Rows per page" selector and "Showing x–y of n sessions" text with Previous/Next page controls are shown.',
  }), async ({ page }) => {
    await expect(page.getByText(/Rows per page/)).toBeVisible();
    await expect(page.getByText(/Showing \d+–\d+ of \d+ sessions?|No sessions/)).toBeVisible();
    await expect(page.getByRole('button', { name: /Previous page/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Next page/ })).toBeVisible();
  });
});

test.describe('Sessions — lifecycle (write path)', () => {
  test(...caseOf({
    id: 'AP_TC_239',
    module: MODULE,
    scenario: 'NEGATIVE - Verify a session cannot be cancelled without a reason',
    preconditions: 'A Scheduled test session exists (created by this test).',
    steps: ['Book a Phone session.', 'Click Cancel on its row.', 'Leave Reason blank and observe "Cancel Session".', 'Enter a reason and confirm.'],
    data: 'Reason: (blank) then "AP_TC_239 cleanup"',
    expected: 'Reason is marked required and "Cancel Session" is disabled while it is blank; with a reason the session is cancelled.',
  }), async ({ page }) => {
    let booked;
    try { booked = await bookSession(page, { type: 'Wellness Check-in', meeting: 'Phone' }); }
    catch (e) { test.skip(true, e.message); }
    const row = await findSessionRow(page, booked.member, 'Wellness Check-in', 'Scheduled');
    await row.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByText('Reason *')).toBeVisible();
    const confirm = page.getByRole('button', { name: 'Cancel Session', exact: true });
    // Expected behaviour: required field guards the confirm. Known gap on the
    // current build - the button is enabled with a blank reason.
    await expect(confirm, 'Cancel Session is enabled with a blank reason').toBeDisabled();
    await page.getByPlaceholder(/reason for cancellation/i).fill('AP_TC_239 cleanup');
    await expect(confirm).toBeEnabled();
    await confirm.click();
    await expect(page.getByText('Session Cancelled', { exact: true })).toBeVisible({ timeout: 15000 });
  });

  test(...caseOf({
    id: 'AP_TC_240',
    module: MODULE,
    scenario: 'Verify a cancelled session can be rescheduled to another day',
    preconditions: 'A Cancelled test session exists (created by this test).',
    steps: ['Book a Phone session and cancel it with a reason.', 'Click "Reschedule" on the Cancelled row.', 'In "Edit session" pick the next available day.', 'Click "Save changes".'],
    data: 'Type: Wellness Check-in; new date: next enabled day',
    expected: '"Edit session" opens with the member locked and the session type pre-filled; after saving, the session is listed as "Rescheduled" on the new day.',
  }), async ({ page }) => {
    let booked;
    try { booked = await bookSession(page, { type: 'Wellness Check-in', meeting: 'Phone' }); }
    catch (e) { test.skip(true, e.message); }
    const row = await findSessionRow(page, booked.member, 'Wellness Check-in', 'Scheduled');
    await cancelSession(page, row, 'AP_TC_240 - cancel before reschedule');
    const cancelled = await findSessionRow(page, booked.member, 'Wellness Check-in', /Cancelled/);
    await cancelled.getByRole('button', { name: 'Reschedule' }).click();
    await page.waitForTimeout(2500);
    await expect(page.getByText('Edit session')).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Member *' })).toBeDisabled();
    await expect(page.getByRole('combobox', { name: /Session type/ })).toContainText('Wellness Check-in');
    const days = page.getByRole('button', { name: /^2026-\d\d-\d\d$/ });
    let picked = '';
    for (const d of await days.all()) {
      if (await d.isEnabled() && (await d.getAttribute('aria-pressed')) !== 'true') { picked = await d.getAttribute('aria-label'); await d.click(); break; }
    }
    expect(picked, 'no other bookable day in the month').toBeTruthy();
    await page.getByRole('button', { name: 'Save changes' }).click();
    await page.waitForTimeout(5000);
    await gotoSettled(page, '/wellness/sessions', 3000);
    await page.getByRole('button', { name: 'Week', exact: true }).click();
    await page.getByPlaceholder(/Search member, session type/i).fill(booked.member);
    await page.waitForTimeout(3000);
    await expect(sessionRow(page, booked.member, 'Wellness Check-in', /Rescheduled/)).toBeVisible({ timeout: 20000 });
  });

  test(...caseOf({
    id: 'AP_TC_241',
    module: MODULE,
    scenario: 'Verify Start moves a session to "Waiting for member" and "Member Joined" moves it to In progress',
    preconditions: 'A Scheduled test session exists (created by this test). Started sessions cannot be cancelled - this leaves one in-progress session behind.',
    steps: ['Book a Phone session.', 'Click "Start" on the row and confirm "Start session".', 'Observe the row status and pipeline.', 'Click "Member Joined".'],
    data: 'Type: Post-Visit Session',
    expected: 'The row shows "Waiting for member" with Member Joined / Assessment actions; Member Joined opens the assessment and the status becomes In progress.',
  }), async ({ page }) => {
    let booked;
    try { booked = await bookSession(page, { type: 'Post-Visit Session', meeting: 'Phone' }); }
    catch (e) { test.skip(true, e.message); }
    const row = await findSessionRow(page, booked.member, 'Post-Visit Session', 'Scheduled');
    await row.getByRole('button', { name: 'Start', exact: true }).click();
    await page.waitForTimeout(2500);
    const confirm = page.getByRole('button', { name: 'Start session' });
    if (await confirm.count()) await confirm.click();
    const waiting = await findSessionRow(page, booked.member, 'Post-Visit Session', /Waiting for member/);
    await expect(waiting.getByRole('button', { name: 'Member Joined' })).toBeVisible();
    await expect(waiting.getByRole('button', { name: 'Assessment', exact: true })).toBeVisible();
    await waiting.getByRole('button', { name: 'Member Joined' }).click();
    await page.waitForURL(/\/post-visit-session/, { timeout: 60000 });
    await expect(page.getByText('In progress').first()).toBeVisible({ timeout: 30000 });
  });

  test(...caseOf({
    id: 'AP_TC_242',
    module: MODULE,
    scenario: 'Verify "End Meeting" moves an in-progress session to "Wrapping up" and the header shows the active-session banner',
    preconditions: 'An in-progress test session exists (AP_TC_241 or created here).',
    steps: ['Open the in-progress session\'s Assessment.', 'Observe the header banner.', 'Click "End Meeting".', 'Return to Sessions and observe the row.'],
    data: 'N/A',
    expected: 'The header shows an "IN PROGRESS … Go to session" banner; End Meeting sets the row to "Wrapping up" with the Assessment action still available.',
  }), async ({ page }) => {
    await gotoSettled(page, '/wellness/sessions', 3000);
    let row = sessionRow(page, '', '').filter({ hasText: /In progress/ }).first();
    if (!(await row.count())) {
      let booked;
      try { booked = await bookSession(page, { type: 'Post-Visit Session', meeting: 'Phone' }); }
      catch (e) { test.skip(true, e.message); }
      const { startAndJoin } = require('../support/portal');
      await startAndJoin(page, booked.member, 'Post-Visit Session');
    } else {
      await row.getByRole('button', { name: 'Assessment', exact: true }).click();
      await page.waitForURL((u) => /\/wellness\/sessions\/[^/]+\//.test(u.pathname), { timeout: 60000 });
    }
    await page.waitForLoadState('networkidle').catch(() => {});
    await expect(page.getByRole('button', { name: 'End Meeting' })).toBeVisible({ timeout: 40000 });
    await page.getByRole('button', { name: 'End Meeting' }).click();
    await page.waitForTimeout(3000);
    await gotoSettled(page, '/wellness/sessions', 3000);
    await expect(sessionRow(page, '', '').filter({ hasText: /Wrapping up/ }).first()).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('button', { name: /Go to session/i })).toBeVisible();
  });

  test(...caseOf({
    id: 'AP_TC_244',
    module: MODULE,
    scenario: 'Verify a completed session offers Assessment and Share, and Share marks the summary as sent',
    preconditions: 'A Completed session exists for the advisor.',
    steps: ['Filter the list to Completed (or pick a past day).', 'Observe the row actions.', 'Click "Share".'],
    data: 'Any completed session',
    expected: 'The row shows Assessment and Share; after Share the pipeline shows "Summary Sent" / the summary is recorded as shared.',
  }), async ({ page }) => {
    await gotoSettled(page, '/wellness/sessions', 3000);
    await page.locator('[role=combobox]').filter({ hasText: 'All Statuses' }).click();
    await page.getByRole('option', { name: 'Completed' }).click();
    await page.waitForTimeout(3000);
    let row = sessionRow(page, '', '').filter({ hasText: /Completed/ }).first();
    if (!(await row.count())) {
      await page.getByRole('button', { name: 'Month', exact: true }).click();
      await page.getByRole('button', { name: 'Previous', exact: true }).click();
      await page.waitForTimeout(1500);
      const day = page.getByRole('button', { name: /— \d+ sessions?$/ }).first();
      test.skip(!(await day.count()), 'No completed sessions available.');
      await day.click();
      await page.waitForTimeout(3000);
      row = sessionRow(page, '', '').filter({ hasText: /Completed/ }).first();
    }
    test.skip(!(await row.count()), 'No completed sessions available.');
    await expect(row.getByRole('button', { name: 'Assessment', exact: true })).toBeVisible();
    const share = row.getByRole('button', { name: 'Share' });
    await expect(share).toBeVisible();
    await share.click();
    await page.waitForTimeout(6000);
    await row.click();
    await page.waitForTimeout(1500);
    await expect(page.getByText(/Summary Sent/i).first()).toBeVisible();
  });
});
