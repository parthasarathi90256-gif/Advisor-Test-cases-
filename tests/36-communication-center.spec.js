const { test, expect, caseOf } = require('../support/testcase');
const { gotoSettled, hydrated } = require('../support/portal');

const MODULE = 'Advisor Portal → Messages';

// The Communication Center is a three-pane messaging screen: delivery stats on
// top, channel tabs (In-app chat / Email / SMS), a member list on the left, the
// thread + composer in the middle and a member overview panel on the right.
const MEMBER = process.env.TEST_MESSAGE_MEMBER || 'Bruce Banner';

test.describe('Communication Center', () => {
  test.beforeEach(async ({ page }) => {
    await gotoSettled(page, '/wellness/messages', 4000);
    await hydrated(page, page.locator('main'), 200);
  });

  test(...caseOf({
    id: 'AP_TC_153',
    module: MODULE,
    scenario: 'Verify the Communication Center loads delivery stats, channel tabs and the member list',
    preconditions: 'Advisor is logged in with at least one assigned member.',
    steps: ['Open Communication Center from the sidebar.', 'Observe the stat tiles, channel tabs, search box and member list.'],
    data: 'N/A',
    expected: 'The Communication Center heading is shown with Emails Sent Today, SMS Sent Today, Delivered and '
      + 'Failed Deliveries tiles, the In-app chat / Email / SMS tabs, a member search box and at least one member entry.',
  }), async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Communication Center' })).toBeVisible();
    for (const t of ['Emails Sent Today', 'SMS Sent Today', 'Delivered', 'Failed Deliveries']) {
      await expect(page.getByText(t, { exact: true }).first()).toBeVisible();
    }
    for (const tab of ['In-app chat', 'Email', 'SMS']) {
      await expect(page.getByRole('button', { name: tab, exact: true })).toBeVisible();
    }
    await expect(page.getByPlaceholder(/Search members/i)).toBeVisible();
    await expect(page.getByRole('button', { name: new RegExp(MEMBER) }).first()).toBeVisible();
  });

  test(...caseOf({
    id: 'AP_TC_154',
    module: MODULE,
    scenario: 'Verify the Email and SMS channel tabs switch the member list and empty states',
    preconditions: 'Advisor is on the Communication Center page.',
    steps: ['Click the "Email" tab and observe the list.', 'Click the "SMS" tab and observe the list.', 'Click "In-app chat" to return.'],
    data: 'Channels: In-app chat, Email, SMS',
    expected: 'Each tab re-renders the member list for that channel (e.g. "No email sent" / "No SMS sent" per member) '
      + 'and the thread pane shows the channel-specific empty state until a member is selected.',
  }), async ({ page }) => {
    await page.getByRole('button', { name: 'Email', exact: true }).click();
    await page.waitForTimeout(1500);
    await expect(page.getByText(/No email(s)? sent/i).first()).toBeVisible();
    await page.getByRole('button', { name: 'SMS', exact: true }).click();
    await page.waitForTimeout(1500);
    await expect(page.getByText(/No SMS (sent|thread)/i).first()).toBeVisible();
    await page.getByRole('button', { name: 'In-app chat', exact: true }).click();
    await page.waitForTimeout(1500);
    await expect(page.getByRole('button', { name: new RegExp(MEMBER) }).first()).toBeVisible();
  });

  test(...caseOf({
    id: 'AP_TC_155',
    module: MODULE,
    scenario: 'Verify selecting a member opens the in-app chat thread with a composer',
    preconditions: 'Advisor is on the Communication Center page (In-app chat tab).',
    steps: ['Click a member in the list.', 'Observe the thread pane and the member overview panel.'],
    data: `Member: ${MEMBER}`,
    expected: 'The thread pane opens for that member with a "Message…" composer whose Send button is disabled while '
      + 'empty, and the right-hand panel shows the member\'s details (name, age, contact).',
  }), async ({ page }) => {
    await page.getByRole('button', { name: new RegExp(`^\\w\\w ${MEMBER}`) }).first().click();
    await page.waitForTimeout(3000);
    const composer = page.getByRole('textbox', { name: /Message/ });
    await expect(composer).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeDisabled();
    await expect(page.getByText(MEMBER, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/^Age \d+/).first()).toBeVisible();
  });

  test(...caseOf({
    id: 'AP_TC_156',
    module: MODULE,
    scenario: 'NEGATIVE - Verify searching members for an unknown name empties the member list',
    preconditions: 'Advisor is on the Communication Center page with members listed.',
    steps: ['Type a name that cannot match into "Search members or messages…".', 'Observe the member list.'],
    data: 'Search term: "zzzzz-no-such-recipient"',
    expected: 'No member entries remain in the list and the page does not error.',
  }), async ({ page }) => {
    const before = await page.getByRole('button', { name: /No messages yet|No email sent|No SMS sent/ }).count();
    expect(before).toBeGreaterThan(0);
    await page.getByPlaceholder(/Search members/i).fill('zzzzz-no-such-recipient');
    await page.waitForTimeout(2500);
    expect(await page.getByRole('button', { name: /No messages yet/ }).count()).toBe(0);
    await expect(page.getByRole('heading', { name: 'Communication Center' })).toBeVisible();
  });

  test(...caseOf({
    id: 'AP_TC_273',
    module: MODULE,
    scenario: 'Verify the advisor can send an in-app chat message to a member',
    preconditions: 'Advisor is on the Communication Center page.',
    steps: ['Select a member in the In-app chat tab.', 'Type a message in the composer.', 'Click Send.'],
    data: `Member: ${MEMBER}; Message: "Automated test message - please ignore."`,
    expected: 'Send becomes enabled once text is entered; after sending, the message appears in the thread.',
  }), async ({ page }) => {
    await page.getByRole('button', { name: new RegExp(`^\\w\\w ${MEMBER}`) }).first().click();
    await page.waitForTimeout(3000);
    const composer = page.getByRole('textbox', { name: /Message/ });
    await composer.fill('Automated test message - please ignore.');
    const send = page.getByRole('button', { name: 'Send', exact: true });
    await expect(send).toBeEnabled();
    await send.click();
    await expect(page.locator('main').getByText('Automated test message - please ignore.').first()).toBeVisible({ timeout: 15000 });
  });

  test(...caseOf({
    id: 'AP_TC_274',
    module: MODULE,
    scenario: 'Verify the advisor can send an Email to a member from the Email tab',
    preconditions: 'Advisor is on the Communication Center page.',
    steps: ['Open the "Email" tab and select a member.', 'Enter a Subject and body.', 'Click "Send email".'],
    data: `Member: ${MEMBER}; Subject: "Automated test email"`,
    expected: '"Send email" is disabled until subject and body are filled; after sending, the thread shows the email as sent.',
  }), async ({ page }) => {
    await page.getByRole('button', { name: 'Email', exact: true }).click();
    await page.waitForTimeout(1500);
    await page.getByRole('button', { name: new RegExp(`^\\w\\w ${MEMBER}`) }).first().click();
    await page.waitForTimeout(3000);
    const send = page.getByRole('button', { name: 'Send email' });
    await expect(send).toBeDisabled();
    await page.getByRole('textbox', { name: 'Subject' }).fill('Automated test email');
    await page.getByRole('textbox', { name: /Write your email/ }).fill('Automated test email body - please ignore.');
    await expect(send).toBeEnabled();
    await send.click();
    await expect(page.locator('main').getByText('Automated test email').first()).toBeVisible({ timeout: 15000 });
  });

  test(...caseOf({
    id: 'AP_TC_275',
    module: MODULE,
    scenario: 'Verify the advisor can send an SMS to a member from the SMS tab',
    preconditions: 'Advisor is on the Communication Center page; member has a phone number.',
    steps: ['Open the "SMS" tab and select a member.', 'Type the text.', 'Click Send.'],
    data: `Member: ${MEMBER}; Text: "Automated test SMS - please ignore."`,
    expected: 'The SMS composer sends the text and it appears in the thread with a delivery status.',
  }), async ({ page }) => {
    await page.getByRole('button', { name: 'SMS', exact: true }).click();
    await page.waitForTimeout(1500);
    await page.getByRole('button', { name: new RegExp(`^\\w\\w ${MEMBER}`) }).first().click();
    await page.waitForTimeout(3000);
    const box = page.locator('main').getByRole('textbox').last();
    await box.fill('Automated test SMS - please ignore.');
    const send = page.locator('main').getByRole('button', { name: /^Send/ }).last();
    await expect(send).toBeEnabled();
    await send.click();
    await expect(page.locator('main').getByText('Automated test SMS - please ignore.').first()).toBeVisible({ timeout: 15000 });
  });

  test(...caseOf({
    id: 'AP_TC_276',
    module: MODULE,
    scenario: 'Verify the member overview panel shows caseload and channel totals',
    preconditions: 'Advisor is on the Communication Center page.',
    steps: ['Open the "SMS" tab.', 'Observe the right-hand overview panel.'],
    data: 'N/A',
    expected: 'The panel shows "Members contacted", "SMS sent", "Failed" and a Caseload block with "Assigned members".',
  }), async ({ page }) => {
    await page.getByRole('button', { name: 'SMS', exact: true }).click();
    await page.waitForTimeout(1500);
    for (const t of [/Members contacted/i, /SMS sent/i, /Failed/i, /Assigned members/i]) {
      await expect(page.locator('main').getByText(t).first()).toBeVisible();
    }
  });
});
