const { test, expect, caseOf } = require('../support/testcase');
const { gotoSettled, hydrated } = require('../support/portal');
const path = require('path');
const fs = require('fs');
const os = require('os');

const MODULE = 'Advisor Portal → Members → Member Profile';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==', 'base64');
const pngPath = path.join(os.tmpdir(), 'aperion-qa-document.png');
fs.writeFileSync(pngPath, PNG);

// A member with session history, documents and chat history in the dev data.
const MEMBER = process.env.TEST_PROFILE_MEMBER || 'Anthony Stark';

/** Open the member's profile from the Members list and return its base URL (/wellness/members/:id). */
async function openProfile(page) {
  await gotoSettled(page, '/wellness/members', 3000);
  await page.getByPlaceholder('Search by name or email...').fill(MEMBER);
  await page.waitForTimeout(3000);
  await page.getByRole('row', { name: new RegExp(MEMBER) }).first().getByRole('button', { name: 'View' }).click();
  await page.waitForURL(/\/wellness\/members\/[^/]+/, { timeout: 40000 });
  await hydrated(page, page.locator('main'));
  return page.url().replace(/\/wellness\/members\/([^/]+).*/, '/wellness/members/$1');
}

const section = async (page, base, slug, minChars = 20) => {
  await gotoSettled(page, `${base}/${slug}`, 3000);
  await hydrated(page, page.locator('main'), minChars);
};

test.describe('Member profile', () => {
  let base;
  test.beforeEach(async ({ page }) => { base = await openProfile(page); });

  test(...caseOf({
    id: 'AP_TC_216',
    module: MODULE,
    scenario: 'Verify the member profile header and section navigation',
    preconditions: 'Advisor is logged in; the member is on the advisor\'s caseload.',
    steps: ['Open Members, search the member and click View.', 'Observe the header and the left navigation.'],
    data: `Member: ${MEMBER}`,
    expected: 'The header shows the member name, status, Back to Members, Schedule session and Message; the navigation lists Chart, Journey, Wellness Profile, Care Plans, Health Plan, Dependents, Sessions, Documents, Chat History, Call History and Advisor History.',
  }), async ({ page }) => {
    await expect(page).toHaveURL(/\/chart$/);
    await expect(page.getByRole('button', { name: /Back to Members/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Schedule session/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Message/i })).toBeVisible();
    const nav = page.getByRole('complementary');
    for (const s of ['Chart', 'Journey', 'Wellness Profile', 'Care Plans', 'Health Plan', 'Dependents', 'Sessions', 'Documents', 'Chat History', 'Call History', 'Advisor History']) {
      await expect(nav.getByRole('button', { name: s, exact: true })).toBeVisible();
    }
  });

  test(...caseOf({
    id: 'AP_TC_217',
    module: MODULE,
    scenario: 'Verify the Chart section shows Personal Information, dependents count and last visit',
    preconditions: 'Advisor is on the member profile.',
    steps: ['Observe the Chart section.'],
    data: `Member: ${MEMBER}`,
    expected: 'Personal Information (name, email, phone, DOB, gender, employer, member since, address) plus Dependents and Last visit summaries are shown.',
  }), async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Personal Information' })).toBeVisible();
    const main = page.locator('main');
    for (const t of ['First name', 'Last name', 'Email', 'Phone', 'Date of birth', 'Gender', 'Employer', 'Member since', 'Address', 'Dependents', 'Last visit']) {
      await expect(main.getByText(t, { exact: false }).first()).toBeVisible();
    }
  });

  test(...caseOf({
    id: 'AP_TC_218',
    module: MODULE,
    scenario: 'Verify the Journey section switches between Classic and Enhanced views',
    preconditions: 'Advisor is on the member profile.',
    steps: ['Open Journey.', 'Click "Enhanced".', 'Click "Classic".'],
    data: 'N/A',
    expected: 'Both views render (timeline or "Nothing completed yet" empty state) with the toggle reflecting the selection.',
  }), async ({ page }) => {
    await section(page, base, 'journey');
    const group = page.getByRole('group', { name: 'Journey view' });
    await expect(group.getByRole('button', { name: 'Classic' })).toHaveAttribute('aria-pressed', 'true');
    await group.getByRole('button', { name: 'Enhanced' }).click();
    await expect(group.getByRole('button', { name: 'Enhanced' })).toHaveAttribute('aria-pressed', 'true');
    await group.getByRole('button', { name: 'Classic' }).click();
    await expect(group.getByRole('button', { name: 'Classic' })).toHaveAttribute('aria-pressed', 'true');
  });

  test(...caseOf({
    id: 'AP_TC_219',
    module: MODULE,
    scenario: 'Verify the Care Plans section loads (plans or empty state)',
    preconditions: 'Advisor is on the member profile.',
    steps: ['Open Care Plans.'],
    data: 'N/A',
    expected: 'The section renders either the member\'s treatment plans or "No care plans", without an error.',
  }), async ({ page }) => {
    await section(page, base, 'care-plans');
    await expect(page.locator('main').getByText(/care plans?/i).first()).toBeVisible();
  });

  test(...caseOf({
    id: 'AP_TC_220',
    module: MODULE,
    scenario: 'Verify the Health Plan section shows the member\'s insurance plan details',
    preconditions: 'Advisor is on the member profile of a member with a health plan.',
    steps: ['Open Health Plan.'],
    data: `Member: ${MEMBER}`,
    expected: 'Plan name, carrier, status, Member ID, Group number, Plan code, Network, Coverage tier and Effective date are shown.',
  }), async ({ page }) => {
    await section(page, base, 'health-plan');
    const main = page.locator('main');
    for (const t of ['Member ID', 'Group number', 'Plan code', 'Network', 'Coverage tier', 'Effective date']) {
      await expect(main.getByText(t, { exact: false }).first()).toBeVisible();
    }
  });

  test(...caseOf({
    id: 'AP_TC_221',
    module: MODULE,
    scenario: 'Verify the Dependents section lists each dependent with relationship, date of birth and gender',
    preconditions: 'Advisor is on the member profile of a member with dependents.',
    steps: ['Open Dependents.'],
    data: `Member: ${MEMBER}`,
    expected: 'Each dependent row shows a name, relationship (e.g. Parent / Child), DOB and gender.',
  }), async ({ page }) => {
    await section(page, base, 'dependents');
    await expect(page.locator('main').getByText(/Parent|Child|Spouse/).first()).toBeVisible();
    await expect(page.locator('main').getByText(/\d\d\/\d\d\/\d{4}/).first()).toBeVisible();
    await expect(page.locator('main').getByText(/Male|Female/).first()).toBeVisible();
  });

  test(...caseOf({
    id: 'AP_TC_222',
    module: MODULE,
    scenario: 'Verify the Sessions section shows the five advisory sessions in order plus the Care Scheduler table',
    preconditions: 'Advisor is on the member profile.',
    steps: ['Open Sessions.', 'Observe the Advisory Sessions table and the Care Scheduler table.'],
    data: 'N/A',
    expected: 'Advisory Sessions lists Health Assessment, Pre Visit Session, Post-Visit Session, Wellness Check-in and Annual Road Map (in that order) with sortable Session / Scheduled / Status columns and per-row actions; the Care Scheduler table lists appointments with Mark complete actions.',
  }), async ({ page }) => {
    await section(page, base, 'sessions', 80);
    const table = page.getByRole('table', { name: 'Advisory sessions' });
    await expect(table).toBeVisible({ timeout: 40000 });
    const names = (await table.getByRole('row').allInnerTexts()).slice(1).map((t) => t.split('\n')[1] || t.split('\n')[0]);
    expect(names.join(' > ')).toMatch(/Health Assessment.*Pre Visit Session.*Post-Visit Session.*Wellness Check-in.*Annual Road Map/s);
    for (const h of ['Session', 'Scheduled', 'Status']) await expect(table.getByRole('columnheader', { name: h }).getByRole('button')).toBeVisible();
    await expect(page.getByRole('table', { name: 'Care appointments' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mark complete' }).first()).toBeVisible();
  });

  test(...caseOf({
    id: 'AP_TC_223',
    module: MODULE,
    scenario: 'Verify "Schedule" on an unscheduled session type opens the booking dialog with the member pre-selected',
    preconditions: 'Advisor is on the member\'s Sessions section with at least one "Not Scheduled" session.',
    steps: ['Click "Schedule" on a Not Scheduled row.', 'Observe the dialog.', 'Close it.'],
    data: 'N/A',
    expected: 'The "Book a session" dialog opens with Member already set to this member.',
  }), async ({ page }) => {
    await section(page, base, 'sessions', 80);
    const btn = page.getByRole('table', { name: 'Advisory sessions' }).getByRole('button', { name: 'Schedule', exact: true }).first();
    test.skip(!(await btn.count()), 'Every session type is already scheduled for this member.');
    await btn.click();
    const dialog = page.getByRole('dialog', { name: 'Book a session' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('combobox', { name: 'Member *' })).toContainText(MEMBER);
    await dialog.getByRole('button', { name: 'Close' }).click();
  });

  test(...caseOf({
    id: 'AP_TC_224',
    module: MODULE,
    scenario: 'NEGATIVE - Verify "Skip" on a session requires a reason before it can be confirmed',
    preconditions: 'Advisor is on the member\'s Sessions section with a skippable session.',
    steps: ['Click "Skip" on a Not Scheduled row.', 'Observe the Skip Session modal with the Reason blank.', 'Click "Keep Session".'],
    data: 'Reason: (blank)',
    expected: 'The Skip Session modal explains a note is required; "Skip Session" is disabled until a reason is typed; Keep Session closes it without changes.',
  }), async ({ page }) => {
    await section(page, base, 'sessions', 80);
    const skip = page.getByRole('table', { name: 'Advisory sessions' }).getByRole('button', { name: 'Skip', exact: true }).first();
    test.skip(!(await skip.count()), 'No skippable session for this member.');
    await skip.click();
    await expect(page.getByText(/A note explaining why is required/i)).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole('button', { name: 'Skip Session' })).toBeDisabled();
    await page.getByPlaceholder(/Why is this session being skipped/i).fill('reason');
    await expect(page.getByRole('button', { name: 'Skip Session' })).toBeEnabled();
    await page.getByRole('button', { name: 'Keep Session' }).click();
    await expect(page.getByText(/A note explaining why is required/i)).toHaveCount(0);
  });

  test(...caseOf({
    id: 'AP_TC_225',
    module: MODULE,
    scenario: 'Verify "Reschedule" on an overdue session opens the Edit session panel with the member locked',
    preconditions: 'Advisor is on the member\'s Sessions section with an Overdue session.',
    steps: ['Click "Reschedule" on an Overdue row.', 'Observe the Edit session panel.', 'Cancel.'],
    data: 'N/A',
    expected: 'An "Edit session" panel opens with Member disabled, the session type pre-filled, a date picker, times, meeting type and Save changes.',
  }), async ({ page }) => {
    await section(page, base, 'sessions', 80);
    const btn = page.getByRole('table', { name: 'Advisory sessions' }).getByRole('button', { name: 'Reschedule' }).first();
    test.skip(!(await btn.count()), 'No overdue session for this member.');
    await btn.click();
    await expect(page.getByText('Edit session')).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Member *' })).toBeDisabled();
    // Known gap on the current build: the type is blank when rescheduling an overdue session from the profile.
    await expect(page.getByRole('combobox', { name: /Session type/ })).not.toHaveText(/^\s*$/);
    await expect(page.getByRole('button', { name: 'Save changes' })).toBeVisible();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  });

  test(...caseOf({
    id: 'AP_TC_226',
    module: MODULE,
    scenario: 'Verify the advisor can upload a document to the member\'s Documents',
    preconditions: 'Advisor is on the member\'s Documents section.',
    steps: ['Click "Upload".', 'Choose a PNG and a category.', 'Confirm the upload.'],
    data: 'File: 1x1 PNG',
    expected: 'The document count increases and the new file is listed as uploaded by the advisor.',
  }), async ({ page }) => {
    await section(page, base, 'documents');
    const before = parseInt(((await page.locator('main').innerText()).match(/(\d+) documents?/) || [0, '0'])[1], 10);
    await page.getByRole('button', { name: 'Upload' }).click();
    await page.locator('input[type=file]').last().setInputFiles(pngPath);
    await page.waitForTimeout(1500);
    for (const c of await page.getByRole('combobox').all()) {
      if (await c.isVisible() && /select|choose|category/i.test(await c.innerText().catch(() => ''))) { await c.click(); await page.getByRole('option').first().click(); }
    }
    const resp = page.waitForResponse((r) => /\/documents/.test(r.url()) && r.request().method() === 'POST', { timeout: 40000 });
    await page.getByRole('button', { name: /^(Upload|Add|Save|Submit)( \d+ (file|document)s?)?$/ }).last().click();
    expect((await resp).status()).toBeLessThan(300);
    await page.reload();
    await hydrated(page, page.locator('main'));
    const after = parseInt(((await page.locator('main').innerText()).match(/(\d+) documents?/) || [0, '0'])[1], 10);
    expect(after).toBeGreaterThan(before);
    await expect(page.locator('main').getByText(/Uploaded by advisor/i).first()).toBeVisible();
  });

  test(...caseOf({
    id: 'AP_TC_227',
    module: MODULE,
    scenario: 'Verify a document can be previewed from the Documents section',
    preconditions: 'Advisor is on the member\'s Documents section with at least one document.',
    steps: ['Click "Preview" on a document.'],
    data: 'N/A',
    expected: 'A preview opens (dialog or viewer) without an application error.',
  }), async ({ page }) => {
    await section(page, base, 'documents');
    const preview = page.getByRole('button', { name: 'Preview' }).first();
    test.skip(!(await preview.count()), 'No documents for this member.');
    await preview.click();
    await page.waitForTimeout(3000);
    const opened = (await page.getByRole('dialog').count()) > 0 || (await page.locator('iframe, embed, img[src*="document"], img[src*="preview"]').count()) > 0
      || (await page.getByRole('button', { name: /Close|Download/ }).count()) > 0;
    expect(opened, 'no preview surface appeared').toBeTruthy();
  });

  test(...caseOf({
    id: 'AP_TC_228',
    module: MODULE,
    scenario: 'Verify Chat History lists on-demand conversations and opens a transcript',
    preconditions: 'Advisor is on the profile of a member with chat history.',
    steps: ['Open Chat History.', 'Click a conversation entry.'],
    data: `Member: ${MEMBER}`,
    expected: 'Conversations are listed with date, status and duration; clicking one shows its transcript.',
  }), async ({ page }) => {
    await section(page, base, 'chat-history');
    await expect(page.getByRole('heading', { name: 'Chat History' })).toBeVisible();
    const entry = page.locator('main').getByRole('button').first();
    test.skip(!(await entry.count()), 'No chat history for this member.');
    await entry.click();
    await expect(page.locator('main').getByText(/Transcript/i).first()).toBeVisible({ timeout: 15000 });
  });

  test(...caseOf({
    id: 'AP_TC_229',
    module: MODULE,
    scenario: 'Verify Call History loads (calls or "No call history" empty state)',
    preconditions: 'Advisor is on the member profile.',
    steps: ['Open Call History.'],
    data: 'N/A',
    expected: 'The Call History heading is shown with either call entries or the "No call history" empty state.',
  }), async ({ page }) => {
    await section(page, base, 'call-history');
    await expect(page.getByRole('heading', { name: 'Call History' })).toBeVisible();
    await expect(page.locator('main').getByText(/call history|On-Demand advisor calls/i).first()).toBeVisible();
  });

  test(...caseOf({
    id: 'AP_TC_230',
    module: MODULE,
    scenario: 'Verify Advisor History shows the current advisor and previous assignments',
    preconditions: 'Advisor is on the member profile.',
    steps: ['Open Advisor History.'],
    data: 'N/A',
    expected: 'The current advisor is marked "Current" with the assignment period; previous advisors (if any) list their period and reason.',
  }), async ({ page }) => {
    await section(page, base, 'advisor-history');
    await expect(page.getByRole('heading', { name: /Advisor history/i })).toBeVisible();
    await expect(page.locator('main').getByText('Current', { exact: true }).first()).toBeVisible();
    await expect(page.locator('main').getByText(/\d\d\/\d\d\/\d{4} — (now|\d\d\/\d\d\/\d{4})/).first()).toBeVisible();
  });
});
