/**
 * Shared Advisor Portal helpers for the extended specs.
 *
 * Everything here was verified by hand against the portal build on
 * 2026-09-17: locators, the booking rules (a member can hold only one
 * session of a type per calendar day, Sundays and past days are not
 * bookable), the session pipeline (Scheduled -> Waiting for member ->
 * In progress -> Wrapping up -> Completed) and the clinical workflow
 * step layouts.
 */
const { expect } = require('@playwright/test');

/** Navigate and let the client-side fetches land. Pages hydrate slowly on a dev build. */
async function gotoSettled(page, path, extraMs = 2500) {
  await page.goto(path);
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(extraMs);
}

/** Wait until an element's text is non-trivial (list/table hydrated). */
async function hydrated(page, locator, minChars = 50, maxSec = 90) {
  for (let i = 0; i < maxSec; i++) {
    const t = (await locator.innerText().catch(() => '')).trim();
    if (t.length >= minChars && !/^loading/i.test(t)) return;
    await page.waitForTimeout(1000);
  }
}

// Members this dev environment is safe to book test sessions against. Booking
// walks the list until it finds one for whom the requested type is still free today.
const TEST_MEMBERS = (process.env.TEST_MEMBERS || 'Bruce Banner,Brian Peterson,Harry Potter,James Lee,Gwen Stacy,Daniel Thompson,Jack Sparrow,John Wick,Donald Taylor,Emily Anderson,Tom Jerry')
  .split(',').map((s) => s.trim()).filter(Boolean);

const SESSION_TYPES = ['Health Assessment', 'Pre Visit Session', 'Post-Visit Session', 'Wellness Check-in', 'Annual Road Map'];

/** A session-list row (the whole row is an ARIA button named "<time> <member> <type> ... <status> ..."). */
function sessionRow(page, member, type, status) {
  const re = new RegExp(`${member}.*${type.replace(/-/g, '.')}`);
  const rows = page.getByRole('button', { name: re });
  return status ? rows.filter({ hasText: status }).first() : rows.first();
}

/** Search the Sessions page for a member and return the matching row. */
async function findSessionRow(page, member, type, status) {
  await gotoSettled(page, '/wellness/sessions', 3000);
  await page.getByPlaceholder(/Search member, session type/i).fill(member);
  await page.waitForTimeout(3000);
  const row = sessionRow(page, member, type, status);
  await expect(row, `no ${type} row for ${member} with status ${status}`).toBeVisible({ timeout: 20000 });
  return row;
}

async function openBookingDialog(page) {
  const button = page.getByRole('button', { name: 'Schedule Session' }).first();
  await expect(button).toBeEnabled({ timeout: 60000 });
  const dialog = page.getByRole('dialog', { name: 'Book a session' });
  // The header mounts before the page is interactive; a click that lands too
  // early is swallowed, so retry once if nothing opened.
  for (let attempt = 0; attempt < 3 && !(await dialog.isVisible().catch(() => false)); attempt++) {
    await button.click();
    await dialog.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
  }
  await expect(dialog).toBeVisible();
  return dialog;
}

/**
 * Book a session. Tries each candidate member until the type is still
 * available for today; returns { member } or throws when every candidate is
 * exhausted (a real, self-inflicted-by-reruns constraint - callers test.skip on it).
 */
async function bookSession(page, { type, meeting = 'Phone', members = TEST_MEMBERS, description = '' }) {
  await gotoSettled(page, '/wellness/sessions', 3000);
  const dialog = await openBookingDialog(page);
  for (const member of members) {
    await dialog.getByRole('combobox', { name: 'Member *' }).click();
    const opt = page.getByRole('option', { name: member }).first();
    if (!(await opt.count())) { await page.keyboard.press('Escape'); continue; }
    await opt.click();
    await dialog.getByRole('combobox', { name: 'Session type *' }).click();
    await page.waitForTimeout(1500); // availability is looked up asynchronously
    const typeOpt = page.getByRole('option', { name: type, exact: true });
    const free = (await typeOpt.count()) > 0 && (await typeOpt.getAttribute('aria-disabled')) !== 'true';
    if (!free) { await page.keyboard.press('Escape'); continue; }
    await typeOpt.click();
    if (meeting === 'Phone') {
      await dialog.getByRole('button', { name: 'Phone', exact: true }).click();
    } else {
      await dialog.getByRole('button', { name: 'Generate Zoom link' }).click();
      await expect(dialog.getByText(/zoom\.us/)).toBeVisible({ timeout: 30000 });
    }
    if (description) await dialog.getByRole('textbox', { name: 'Description' }).fill(description);
    const submit = dialog.getByRole('button', { name: 'Schedule Session' });
    await expect(submit).toBeEnabled();
    await submit.click();
    await page.waitForTimeout(5000);
    return { member };
  }
  throw new Error(`no test member has "${type}" free today - rerun another day`);
}

/** Cancel a scheduled session with a reason. */
async function cancelSession(page, row, reason = 'Automated test cleanup.') {
  await row.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByPlaceholder(/reason for cancellation/i).fill(reason);
  await page.getByRole('button', { name: 'Cancel Session', exact: true }).click();
  await page.waitForTimeout(3000);
}

/** Scheduled -> Start -> Waiting for member -> Member Joined (opens the assessment). */
async function startAndJoin(page, member, type) {
  const row = await findSessionRow(page, member, type, 'Scheduled');
  await row.getByRole('button', { name: 'Start', exact: true }).click();
  await page.waitForTimeout(2500);
  const confirm = page.getByRole('button', { name: 'Start session' });
  if (await confirm.count()) await confirm.click();
  await page.waitForTimeout(3000);
  const waiting = await findSessionRow(page, member, type, /Waiting for member/);
  await waiting.getByRole('button', { name: 'Member Joined' }).click();
  await page.waitForURL((u) => /\/wellness\/sessions\/[^/]+\//.test(u.pathname), { timeout: 60000 });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(5000);
}

// ---- Clinical workflow driver ------------------------------------------------

const firstLine = (e) => (e && e.message ? e.message : String(e)).split('\n')[0].slice(0, 60);

/** Fill whatever is empty on the current step with plausible values. */
async function fillStep(page) {
  const main = page.locator('main');
  let n = 0;
  try {
    // Physical measurements carry a BMI plausibility check - keep them realistic.
    for (const [re, v] of [[/Height \(feet\)/, '5'], [/Height \(inches\)/, '8'], [/Weight \(lbs\)/, '170']]) {
      const s = main.getByRole('spinbutton', { name: re }).first();
      if (await s.count() && await s.isVisible() && !(await s.isDisabled())) { await s.fill(v); n++; }
    }
    for (const s of await main.getByRole('spinbutton').all()) {
      try {
        if (!(await s.isVisible()) || await s.isDisabled() || (await s.inputValue()) !== '') continue;
        const label = (await s.getAttribute('aria-label') || '').toLowerCase();
        const v = /systolic/.test(label) ? '120' : /diastolic/.test(label) ? '80' : /pulse/.test(label) ? '72'
          : /score|phq|audit/.test(label) ? '5' : /age|year/.test(label) ? '30' : /%|a1c/.test(label) ? '5.5' : '10';
        await s.fill(v); n++;
      } catch { /* detached mid-render - next control */ }
    }
    for (const t of await main.getByRole('textbox').all()) {
      try {
        if (!(await t.isVisible()) || await t.isDisabled()) continue;
        const label = (await t.getAttribute('aria-label') || await t.getAttribute('placeholder') || '').toLowerCase();
        if (/search/.test(label) || (await t.inputValue()) !== '') continue;
        await t.fill(/date/.test(label) ? '09/17/2026' : 'Automated test entry.'); n++;
      } catch { /* next */ }
    }
    for (const c of await main.getByRole('combobox').all()) {
      try {
        if (!(await c.isVisible()) || await c.isDisabled()) continue;
        if (!/select|choose|^$|—/i.test((await c.innerText()).trim())) continue;
        await c.click(); await page.waitForTimeout(400);
        const o = page.getByRole('option').first();
        if (await o.count()) { await o.click(); n++; } else await page.keyboard.press('Escape');
      } catch { /* next */ }
    }
    for (const g of await main.getByRole('radiogroup').all()) {
      try {
        if (!(await g.isVisible()) || (await g.getByRole('radio', { checked: true }).count()) > 0) continue;
        await g.getByRole('radio').first().check({ force: true }); n++;
      } catch { /* next */ }
    }
    // Rating scales (Annual Road Map feedback) - one "7" per scale.
    for (const b of await main.getByRole('button', { name: '7', exact: true }).all()) { await b.click().catch(() => {}); }
  } catch { /* keep going with what was filled */ }
  return n;
}

/**
 * Card-style steps (screening plans, risk assessments): visit every category tab
 * and every item chip, fill it and "Save & next" until the step's continue enables.
 */
async function saveEveryItem(page) {
  const main = page.locator('main');
  const names = () => main.getByRole('button').evaluateAll((bs) => bs.filter((b) => b.offsetParent !== null).map((b) => (b.innerText || '').trim().replace(/\s+/g, ' ')));
  const all = await names();
  const cats = all.filter((t) => /\s\d+$/.test(t));
  for (const cat of cats.length ? cats : ['']) {
    if (cat) { await main.getByRole('button', { name: cat, exact: true }).click(); await page.waitForTimeout(1500); }
    const now = await names();
    const lastCat = Math.max(...cats.map((c) => now.lastIndexOf(c)), -1);
    const end = now.indexOf('Scroll left') > -1 ? now.indexOf('Scroll left') : now.length;
    const chips = now.slice(lastCat + 1, end).filter((t) => t && !/^(Scroll|Skip|Save|Previous|Confirm|Remove|Clear|Back|History|End Meeting|Collapse|Open calendar|\d\d )/.test(t));
    for (const chip of chips) {
      try {
        await main.getByRole('button', { name: chip, exact: true }).first().click();
        await page.waitForTimeout(1000);
        await fillStep(page);
        const save = main.getByRole('button', { name: 'Save & next' }).first();
        if (await save.count() && await save.isEnabled()) { await save.click(); await page.waitForTimeout(1800); }
      } catch { /* next chip */ }
    }
  }
}

async function advance(page) {
  for (const name of ['Confirm & continue', 'Save & Continue', 'Save & continue', 'Continue', 'Next']) {
    const b = page.locator('main').getByRole('button', { name, exact: true }).last();
    if (await b.count() && await b.isVisible() && await b.isEnabled()) { await b.click(); await page.waitForTimeout(3500); return name; }
  }
  return null;
}

/**
 * Drive the currently open workflow through every step to its completion
 * button ("Complete Session" / "Complete assessment"). Returns the step
 * headings seen. Throws with the step name when it cannot advance.
 */
async function completeWorkflow(page, maxSteps = 30) {
  const seen = [];
  for (let i = 0; i < maxSteps; i++) {
    const step = (await page.locator('main h2').first().innerText().catch(() => '')).trim();
    const complete = page.locator('main').getByRole('button', { name: /^(Complete Session|Complete assessment|Complete Assessment)$/ }).last();
    if (await complete.count() && await complete.isVisible()) {
      await fillStep(page);
      if (await complete.isEnabled()) {
        await complete.click(); await page.waitForTimeout(3000);
        const confirm = page.getByRole('button', { name: /^(Yes|Confirm|Complete)/ }).last();
        if (await confirm.count() && await confirm.isVisible()) { await confirm.click(); await page.waitForTimeout(4000); }
        return seen;
      }
    }
    await fillStep(page);
    let clicked = await advance(page);
    if (!clicked) { await saveEveryItem(page); clicked = await advance(page); }
    seen.push(step);
    if (!clicked) throw new Error(`cannot advance from workflow step "${step}"`);
    if (seen.length > 3 && seen.slice(-3).every((s) => s === step)) throw new Error(`stuck on workflow step "${step}"`);
  }
  throw new Error('workflow did not reach its completion button');
}

/** Book + start + join + complete one full session of a type. Returns { member, steps }. */
async function runFullSession(page, type) {
  const { member } = await bookSession(page, { type, meeting: 'Phone' });
  await startAndJoin(page, member, type);
  const steps = await completeWorkflow(page);
  return { member, steps };
}

module.exports = {
  gotoSettled, hydrated, TEST_MEMBERS, SESSION_TYPES, sessionRow, findSessionRow, openBookingDialog,
  bookSession, cancelSession, startAndJoin, fillStep, saveEveryItem, completeWorkflow, runFullSession, firstLine,
};
