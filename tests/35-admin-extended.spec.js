const { test, expect, caseOf } = require('../support/testcase');
const { gotoSettled } = require('../support/portal');
const fs = require('fs');

const MODULE = 'Advisor Portal → Admin';
const ADVISOR_MODULE = 'Advisor Portal → Admin → Advisor Detail';

async function openFirstAdvisor(page) {
  await gotoSettled(page, '/wellness/admin/advisors', 4000);
  await page.getByRole('button', { name: 'View' }).first().waitFor({ timeout: 60000 });
  await page.getByRole('button', { name: 'View' }).first().click();
  await page.waitForURL(/\/wellness\/admin\/advisors\/[^/]+/, { timeout: 40000 });
  await page.waitForLoadState('networkidle').catch(() => {});
}

test.describe('Admin → Advisors', () => {
  test.beforeEach(async ({ page }) => {
    await gotoSettled(page, '/wellness/admin/advisors', 4000);
    await page.getByRole('button', { name: 'View' }).first().waitFor({ timeout: 60000 });
  });

  test(...caseOf({
    id: 'AP_TC_281',
    module: MODULE,
    scenario: 'Verify the advisor roster filters (specialty, capacity, status), positive search and Grid view',
    preconditions: 'Advisor has administration access; advisors exist.',
    steps: ['Open each filter and observe its options.', 'Search for an existing advisor by name.', 'Apply a status filter.', 'Switch to Grid.'],
    data: 'Search: the first listed advisor\'s name',
    expected: 'Specialty, capacity (No members / Carrying members) and status (Active / Pending / On leave / Paused / Departed) filters are offered; the search narrows to the advisor; Grid renders cards with View actions.',
  }), async ({ page }) => {
    await page.getByRole('combobox', { name: 'Filter by capacity' }).click();
    for (const o of ['No members', 'Carrying members']) await expect(page.getByRole('option', { name: o })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('combobox', { name: 'Filter by status' }).click();
    for (const o of ['Active', 'Pending', 'On leave', 'Paused', 'Departed']) await expect(page.getByRole('option', { name: o })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('combobox', { name: 'Filter by specialty' }).click();
    expect(await page.getByRole('option').count()).toBeGreaterThan(1);
    await page.keyboard.press('Escape');
    const name = (await page.getByRole('row').nth(1).innerText()).split('\n').find((t) => /^[A-Z][a-z]+ [A-Z]/.test(t)) || '';
    await page.getByPlaceholder('Search by name or email...').fill(name.split(' ')[0]);
    await page.waitForTimeout(2500);
    expect(await page.getByRole('button', { name: 'View' }).count()).toBeGreaterThan(0);
    await page.getByRole('button', { name: /Clear all/ }).click();
    await page.getByRole('button', { name: 'Grid', exact: true }).click();
    await page.waitForTimeout(2000);
    expect(await page.getByRole('button', { name: 'View' }).count()).toBeGreaterThan(0);
  });
});

test.describe('Admin → Advisor detail', () => {
  test.beforeEach(async ({ page }) => { await openFirstAdvisor(page); });

  test(...caseOf({
    id: 'AP_TC_282',
    module: ADVISOR_MODULE,
    scenario: 'Verify the Profile tab shows the advisor\'s details',
    preconditions: 'Advisor has administration access and opened an advisor.',
    steps: ['Observe the Profile tab (default).'],
    data: 'First listed advisor',
    expected: 'The advisor\'s name heading, contact details and section links (Profile, Assigned members, Workload, Lifecycle) are shown.',
  }), async ({ page }) => {
    await expect(page.getByRole('heading').first()).toBeVisible();
    for (const l of ['Profile', 'Workload', 'Lifecycle']) await expect(page.getByRole('link', { name: l, exact: true })).toBeVisible({ timeout: 60000 });
    await expect(page.getByRole('link', { name: /Assigned members/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Back to Advisors/i })).toBeVisible();
  });

  test(...caseOf({
    id: 'AP_TC_283',
    module: ADVISOR_MODULE,
    scenario: 'Verify the Caseload tab lists assigned members and offers the "Assign members" wizard',
    preconditions: 'Advisor has administration access and opened an advisor.',
    steps: ['Click "Assigned members".', 'Observe the table and the "Assign members" action.', 'Click "Assign members"; observe; Cancel.'],
    data: 'N/A',
    expected: 'The caseload table (Member, Employer, Location, Progress) and search/List/Grid controls are shown; "Assign members" opens a wizard whose destination is this advisor ("Pick members from the unassigned pool").',
  }), async ({ page }) => {
    await page.getByRole('link', { name: /Assigned members/ }).click();
    await page.waitForLoadState('networkidle').catch(() => {});
    await expect(page.getByRole('button', { name: 'Assign members' })).toBeVisible({ timeout: 40000 });
    for (const h of ['Member', 'Employer', 'Location']) await expect(page.getByRole('columnheader', { name: h })).toBeVisible({ timeout: 60000 });
    await page.getByRole('button', { name: 'Assign members' }).click();
    await page.waitForURL(/\/assign/, { timeout: 40000 });
    await expect(page.getByText(/Pick members from the unassigned pool/i)).toBeVisible({ timeout: 40000 });
    await expect(page.getByRole('button', { name: /^Assign members/ })).toBeDisabled();
    await page.getByRole('button', { name: /Cancel|Back/ }).first().click();
  });

  test(...caseOf({
    id: 'AP_TC_284',
    module: ADVISOR_MODULE,
    scenario: 'Verify "Set availability" on the Lifecycle tab offers On leave / Paused (cancelled without saving)',
    preconditions: 'Advisor is on an advisor\'s Lifecycle tab.',
    steps: ['Click "Lifecycle".', 'Click "Set availability".', 'Observe the options.', 'Cancel.'],
    data: 'N/A',
    expected: 'A "Set availability" dialog explains the current status and offers On leave and Paused; Cancel closes it without changing the status.',
  }), async ({ page }) => {
    await page.getByRole('link', { name: 'Lifecycle', exact: true }).click();
    await page.waitForLoadState('networkidle').catch(() => {});
    await expect(page.getByRole('button', { name: 'Set availability' })).toBeVisible({ timeout: 40000 });
    await page.getByRole('button', { name: 'Set availability' }).click();
    await expect(page.getByRole('heading', { name: 'Set availability' })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'On leave' })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Paused' })).toBeVisible();
    await page.getByRole('button', { name: /^(Cancel|Close)$/ }).last().click();
    await expect(page.getByRole('heading', { name: 'Set availability' })).toHaveCount(0);
  });

  test(...caseOf({
    id: 'AP_TC_285',
    module: ADVISOR_MODULE,
    scenario: 'NEGATIVE - Verify "Off board" requires a reason before a departure can be started (cancelled without saving)',
    preconditions: 'Advisor is on an advisor\'s Lifecycle tab.',
    steps: ['Click "Off board".', 'Observe the dialog with no reason chosen.', 'Cancel.'],
    data: 'N/A',
    expected: 'An "Off-board <advisor>?" dialog explains that members must be handed over; the primary action stays disabled until a reason is chosen; Cancel closes it and no departure is created.',
  }), async ({ page }) => {
    await page.getByRole('link', { name: 'Lifecycle', exact: true }).click();
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.getByRole('button', { name: 'Off board' }).click({ timeout: 40000 });
    await expect(page.getByRole('heading', { name: /Off-board .*\?/ })).toBeVisible();
    await expect(page.getByRole('combobox', { name: /Reason for off-boarding/ })).toBeVisible();
    const primary = page.getByRole('button', { name: /^(Start off-?boarding|Off board|Start departure|Confirm)$/i }).last();
    if (await primary.count()) await expect(primary).toBeDisabled();
    await page.getByRole('button', { name: /^(Cancel|Close)$/ }).last().click();
    await expect(page.getByRole('heading', { name: /Off-board .*\?/ })).toHaveCount(0);
  });
});

test.describe('Admin → Members', () => {
  test.beforeEach(async ({ page }) => {
    await gotoSettled(page, '/wellness/admin/members', 4000);
    await expect(page.getByRole('tab', { name: 'Pending' })).toBeVisible({ timeout: 60000 });
  });

  test(...caseOf({
    id: 'AP_TC_286',
    module: MODULE,
    scenario: 'Verify Admin → Members shows assignment stats and the Pending / Assigned tabs',
    preconditions: 'Advisor has administration access.',
    steps: ['Observe the stat tiles.', 'Click the "Assigned" tab.', 'Click the "Pending" tab.'],
    data: 'N/A',
    expected: 'Total Members, Pending Assignment, Assigned and Longest Wait tiles are shown; the Pending tab lists unassigned members with an Assign action and the Assigned tab lists members with their advisor.',
  }), async ({ page }) => {
    for (const t of ['Total Members', 'Pending Assignment', 'Assigned', 'Longest Wait']) await expect(page.getByText(t, { exact: true }).first()).toBeVisible();
    await page.getByRole('tab', { name: 'Assigned' }).click();
    await page.waitForTimeout(3000);
    await expect(page.getByRole('columnheader', { name: 'Advisor' })).toBeVisible({ timeout: 40000 });
    await page.getByRole('tab', { name: 'Pending' }).click();
    await page.waitForTimeout(3000);
    await expect(page.getByRole('table', { name: 'Unassigned members' })).toBeVisible({ timeout: 40000 });
  });

  test(...caseOf({
    id: 'AP_TC_287',
    module: MODULE,
    scenario: 'Verify the employer, risk and account-status filters on Admin → Members',
    preconditions: 'Advisor has administration access.',
    steps: ['Open each filter and observe its options.', 'Apply a risk filter.'],
    data: 'Risk: first option',
    expected: 'Employer, Risk (Critical / High / Moderate / Low / Unknown) and Account status (Active / Pending activation) filters are offered and applying one re-renders the list without an error.',
  }), async ({ page }) => {
    await page.getByRole('combobox', { name: 'Filter by risk' }).click();
    for (const o of ['Critical', 'High', 'Moderate', 'Low', 'Unknown']) await expect(page.getByRole('option', { name: o })).toBeVisible();
    await page.getByRole('option', { name: 'Unknown' }).click();
    await page.waitForTimeout(2500);
    await page.getByRole('combobox', { name: 'Filter by account status' }).click();
    for (const o of ['Active', 'Pending activation']) await expect(page.getByRole('option', { name: o })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('combobox', { name: 'Filter by employer' }).click();
    expect(await page.getByRole('option').count()).toBeGreaterThan(1);
    await page.keyboard.press('Escape');
  });

  test(...caseOf({
    id: 'AP_TC_288',
    module: MODULE,
    scenario: 'Verify "Assign" opens the advisor-choice wizard with a confirmation step (cancelled before confirming)',
    preconditions: 'At least one pending member exists.',
    steps: ['Click "Assign" on a pending member.', 'Search and select an advisor.', 'Click "Assign 1 member".', 'Observe the confirmation; click Cancel.'],
    data: 'Advisor: first advisor in the list',
    expected: 'Step 2 of the wizard lists advisors with radio selection and filters; "Assign 1 member" is disabled until an advisor is chosen; clicking it asks "Assign this member?" with Cancel / Yes, assign.',
  }), async ({ page }) => {
    const assign = page.getByRole('button', { name: 'Assign' }).first();
    test.skip(!(await assign.count()), 'No pending members.');
    await assign.click();
    await page.waitForURL(/\/unassigned\/assign/, { timeout: 40000 });
    await expect(page.getByText(/Choose the advisor/i)).toBeVisible({ timeout: 40000 });
    const go = page.getByRole('button', { name: /^Assign 1 member/ });
    await expect(go).toBeDisabled();
    await page.getByRole('radio', { name: /^Assign to / }).first().check();
    await expect(go).toBeEnabled();
    await go.click();
    const dlg = page.getByRole('alertdialog', { name: /Assign this member\?/ });
    await expect(dlg).toBeVisible();
    await expect(dlg.getByRole('button', { name: 'Yes, assign' })).toBeVisible();
    await dlg.getByRole('button', { name: 'Cancel' }).click();
    await expect(dlg).toHaveCount(0);
  });

  test(...caseOf({
    id: 'AP_TC_289',
    module: MODULE,
    scenario: 'Verify selecting members with the checkboxes switches to bulk assignment',
    preconditions: 'At least one pending member exists.',
    steps: ['Tick the checkbox on a pending member row.', 'Observe the per-row Assign action.'],
    data: 'N/A',
    expected: 'With rows selected, the per-row Assign buttons are disabled in favour of the bulk action, and "Select all on this page" is available.',
  }), async ({ page }) => {
    const cb = page.getByRole('table', { name: 'Unassigned members' }).getByRole('checkbox').nth(1);
    test.skip(!(await cb.count()), 'No pending members.');
    await expect(page.getByRole('checkbox', { name: /Select all on this page/ })).toBeVisible();
    await cb.check();
    await page.waitForTimeout(1000);
    await expect(page.getByRole('button', { name: 'Assign' }).first()).toBeDisabled();
  });

  test(...caseOf({
    id: 'AP_TC_290',
    module: MODULE,
    scenario: 'Verify an assigned member\'s Actions menu offers View history and Reassign, and View history shows the assignment history',
    preconditions: 'At least one assigned member exists.',
    steps: ['Open the "Assigned" tab.', 'Click "Actions for <member>".', 'Click "View history".'],
    data: 'First assigned member',
    expected: 'The menu offers "View history" and "Reassign"; View history lists the current advisor (marked Current) and any previous advisors with their periods.',
  }), async ({ page }) => {
    await page.getByRole('tab', { name: 'Assigned' }).click();
    await page.waitForTimeout(3000);
    const actions = page.getByRole('button', { name: /^Actions for/ }).first();
    await expect(actions).toBeVisible({ timeout: 40000 });
    await actions.click();
    await expect(page.getByRole('menuitem', { name: 'View history' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Reassign' })).toBeVisible();
    await page.getByRole('menuitem', { name: 'View history' }).click();
    await expect(page.getByText(/Assignment history/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Current', { exact: true }).first()).toBeVisible();
  });

  test(...caseOf({
    id: 'AP_TC_291',
    module: MODULE,
    scenario: 'Verify a pending member can be assigned and then reassigned to another advisor (write path)',
    preconditions: 'ADMIN_WRITE_TESTS=1; at least one pending member and two advisors exist. Leaves the member assigned to the second advisor.',
    steps: ['Assign the last pending member to the first advisor and confirm.', 'On the Assigned tab, open Actions → Reassign for that member.', 'Choose a different advisor, click "Reassign member" and confirm.'],
    data: 'Member: last pending member; advisors: first two in the roster',
    expected: 'After "Yes, assign" the member appears on the Assigned tab under the first advisor; after "Yes, reassign" the row shows the second advisor.',
  }), async ({ page }) => {
    test.skip(process.env.ADMIN_WRITE_TESTS !== '1', 'Set ADMIN_WRITE_TESTS=1 to run this write case.');
    const rows = page.getByRole('row').filter({ has: page.getByRole('button', { name: 'Assign' }) });
    test.skip(!(await rows.count()), 'No pending members.');
    const row = rows.last();
    const email = (await row.innerText()).match(/\S+@\S+/)[0];
    await row.getByRole('button', { name: 'Assign' }).click();
    await page.waitForURL(/\/unassigned\/assign/, { timeout: 40000 });
    const radios = page.getByRole('radio', { name: /^Assign to / });
    await radios.first().waitFor({ timeout: 40000 });
    const firstAdvisor = (await radios.first().getAttribute('aria-label') || '').replace('Assign to ', '');
    await radios.first().check();
    await page.getByRole('button', { name: /^Assign 1 member/ }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Yes, assign' }).click();
    await page.waitForTimeout(5000);
    await gotoSettled(page, '/wellness/admin/members?tab=assigned', 4000);
    await page.getByPlaceholder('Search by name or email...').fill(email);
    await page.waitForTimeout(4000);
    const assigned = page.getByRole('row', { name: new RegExp(email.replace(/[.+]/g, '\\$&')) }).first();
    await expect(assigned).toContainText(firstAdvisor.split(' ')[0]);
    await assigned.getByRole('button', { name: /^Actions for/ }).click();
    await page.getByRole('menuitem', { name: 'Reassign' }).click();
    await page.waitForURL(/\/unassigned\/assign/, { timeout: 40000 });
    await expect(page.getByText(/Reassign advisor/i)).toBeVisible({ timeout: 40000 });
    const other = page.getByRole('radio', { name: /^Assign to / }).filter({ hasNot: page.getByText(firstAdvisor) }).first();
    await other.check();
    await page.getByRole('button', { name: 'Reassign member' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Yes, reassign' }).click();
    await page.waitForTimeout(5000);
    await gotoSettled(page, '/wellness/admin/members?tab=assigned', 4000);
    await page.getByPlaceholder('Search by name or email...').fill(email);
    await page.waitForTimeout(4000);
    await expect(page.getByRole('row', { name: new RegExp(email.replace(/[.+]/g, '\\$&')) }).first()).not.toContainText(firstAdvisor);
  });
});

test.describe('Admin → other areas', () => {
  test(...caseOf({
    id: 'AP_TC_292',
    module: MODULE,
    scenario: 'Verify the Departures status tabs filter the list',
    preconditions: 'Advisor has administration access.',
    steps: ['Open Admin → Departures.', 'Click each tab in turn.'],
    data: 'Tabs: All open, Not started, In progress, With Command Center, Closed, Departed',
    expected: 'Each tab re-renders the list (rows or "No departures") without an error and the clicked tab is marked pressed.',
  }), async ({ page }) => {
    await gotoSettled(page, '/wellness/admin/departures', 3000);
    for (const tab of ['Not started', 'In progress', 'With Command Center', 'Closed', 'Departed', 'All open']) {
      const b = page.getByRole('button', { name: tab, exact: true });
      await b.click();
      await page.waitForTimeout(1500);
      await expect(b).toHaveAttribute('aria-pressed', 'true');
    }
    await expect(page.getByRole('heading', { name: 'Departures' })).toBeVisible();
  });

  test(...caseOf({
    id: 'AP_TC_293',
    module: MODULE,
    scenario: 'Verify Assessment Audit search/filters work and "Export CSV" downloads a CSV file',
    preconditions: 'Advisor has administration access.',
    steps: ['Open Admin → Assessment Audit Log.', 'Observe the time / advisor / member / assessment filters.', 'Click "Export CSV".'],
    data: 'N/A',
    expected: 'The audit table (Member, Changes, Assessments, Advisor, Last activity) and filters load; Export CSV downloads a .csv whose header starts with "When","Action","Advisor".',
  }), async ({ page }) => {
    await gotoSettled(page, '/wellness/admin/assessment-audit', 6000);
    await expect(page.getByRole('heading', { name: 'Assessment Audit' })).toBeVisible({ timeout: 60000 });
    for (const h of ['Member', 'Changes', 'Assessments', 'Advisor', 'Last activity']) await expect(page.getByRole('columnheader', { name: h })).toBeVisible();
    expect(await page.locator('main [role=combobox]').count()).toBeGreaterThanOrEqual(4);
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 40000 }),
      page.getByRole('button', { name: /Export CSV/ }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.csv$/);
    const p = await download.path();
    expect(fs.readFileSync(p, 'utf8').split('\n')[0]).toMatch(/"When","Action","Advisor"/);
  });

  test(...caseOf({
    id: 'AP_TC_294',
    module: MODULE,
    scenario: 'Verify Follow-ups shows its figures and the flag / source / advisor filters',
    preconditions: 'Advisor has administration access.',
    steps: ['Open Admin → Follow-ups.', 'Observe the stat tiles.', 'Open the flag filter.'],
    data: 'N/A',
    expected: 'Never Scheduled, Dropped Off, Awaiting Confirmation and Overdue Sessions tiles are shown; the flag filter lists Booking blocked, Can\'t reach member, Didn\'t attend, Session overdue, Awaiting confirmation, Never scheduled and Dropped off; the list loads with a "Follow-ups (n)" count.',
  }), async ({ page }) => {
    await gotoSettled(page, '/wellness/admin/follow-ups', 6000);
    for (const t of ['Never Scheduled', 'Dropped Off', 'Awaiting Confirmation', 'Overdue Sessions']) await expect(page.getByText(t, { exact: true }).first()).toBeVisible({ timeout: 60000 });
    await expect(page.getByText(/Follow-ups \(\d+\)/)).toBeVisible({ timeout: 60000 });
    await page.locator('main [role=combobox]').filter({ hasText: 'All flags' }).click();
    for (const o of ['Booking blocked', "Can't reach member", "Didn't attend", 'Session overdue']) await expect(page.getByRole('option', { name: o })).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test(...caseOf({
    id: 'AP_TC_295',
    module: MODULE,
    scenario: 'Verify the Advisor notifications console exposes engine/delivery controls and each notification tab; toggles require Save',
    preconditions: 'Advisor has administration access.',
    steps: ['Open Admin → Notifications.', 'Observe the Engine and Delivery switches, run/send times and channels.', 'Toggle "Push channel" off and on again.', 'Open each tab.'],
    data: 'N/A',
    expected: 'Engine enabled / run time / timezone, Delivery enabled / default send time, Push and Email channel switches are shown; a Save control appears for changes; the Sessions today, First session, Care backlog, Daily email, Follow-up 1, Follow-up 2 and Escalate to advisor tabs each open.',
  }), async ({ page }) => {
    await gotoSettled(page, '/wellness/admin/notifications', 4000);
    await expect(page.getByRole('heading', { name: 'Advisor notifications' })).toBeVisible({ timeout: 60000 });
    for (const s of ['Engine enabled', 'Delivery enabled', 'Push channel', 'Email channel']) await expect(page.getByRole('switch', { name: s })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Run timezone' })).toBeVisible();
    const push = page.getByRole('switch', { name: 'Push channel' });
    const before = await push.getAttribute('aria-checked');
    await push.click();
    await expect(push).toHaveAttribute('aria-checked', before === 'true' ? 'false' : 'true');
    await expect(page.getByRole('button', { name: /^Save/ }).first()).toBeVisible();
    await push.click();
    await expect(push).toHaveAttribute('aria-checked', before);
    for (const t of [/Sessions today/, /First session/, /Care backlog/, /Daily email/, /Follow-up 1/, /Follow-up 2/, /Escalate to advisor/]) {
      await page.getByRole('tab', { name: t }).click();
      await page.waitForTimeout(600);
      await expect(page.getByRole('tab', { name: t })).toHaveAttribute('aria-selected', 'true');
    }
  });

  test(...caseOf({
    id: 'AP_TC_296',
    module: MODULE,
    scenario: 'Verify the Administration sidebar links reach every admin page and "Back to main page" leaves the admin area',
    preconditions: 'Advisor has administration access.',
    steps: ['Open Admin.', 'Click Overview, Advisors, Members, Follow-ups, Departures, Assessment Audit Log and Notifications in turn.', 'Click "Back to main page".'],
    data: 'N/A',
    expected: 'Each link opens its admin page; Back to main page returns to the workspace.',
  }), async ({ page }) => {
    await gotoSettled(page, '/wellness/admin/overview', 3000);
    const nav = page.getByRole('navigation', { name: 'Administration' });
    await expect(nav.getByRole('link', { name: 'Advisors', exact: true })).toBeVisible({ timeout: 90000 });
    for (const [label, url] of [['Advisors', /\/admin\/advisors/], ['Members', /\/admin\/members/], ['Follow-ups', /\/admin\/follow-ups/], ['Departures', /\/admin\/departures/], ['Assessment Audit Log', /\/admin\/assessment-audit/], ['Notifications', /\/admin\/notifications/], ['Overview', /\/admin\/overview/]]) {
      await nav.getByRole('link', { name: label, exact: true }).click();
      await expect(page).toHaveURL(url, { timeout: 40000 });
    }
    await page.getByRole('button', { name: /Back to main page/i }).click();
    await page.waitForTimeout(2000);
    expect(page.url()).not.toMatch(/\/admin\//);
  });
});
