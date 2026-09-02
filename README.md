# Aperion Testcases — record manual passes into automated specs

Do your manual test round in a browser; Playwright writes the spec as you click.
Login is always by hand — no OTP is ever stored, scripted, or bypassed here.

Portal: `https://dev.aperion.health` (member + advisor ship from one deployment).

---

## One-time setup

```bash
cd C:\codebase\Testcases
npm install
npx playwright install chromium
```

## Step 1 — capture the session (once a day)

```bash
npm run auth
```

A browser opens on `/login`. **Log in by hand, real OTP.** Land on the dashboard,
then close the browser. Your session is saved to `auth/auth.json` (git-ignored).

## Step 2 — record a test case

```bash
npm run record
```

Two windows open:

- the **browser**, already logged in — no OTP, straight into the feature
- the **Playwright Inspector**, writing code as you click

Do your manual test case normally. To turn an "Expected Result" into a real
check, use the Inspector toolbar:

| Button | Inserts |
|---|---|
| Assert visibility | `await expect(locator).toBeVisible()` |
| Assert text | `await expect(locator).toHaveText('...')` |
| Assert value | `await expect(locator).toHaveValue('...')` |
| Pick locator | copies a locator without recording a click |

Copy the generated code into `tests/`, or record straight to a file:

```bash
npm run record:to tests/care-plan.spec.js
```

## Step 3 — clean it up

The recorder gives you a **draft**. Four edits turn it into a real test:

1. **Name it after your manual case** — `test('TC-042: member views active care plan', ...)`
2. **Add the assertions it missed** — recorders under-assert badly.
3. **Delete the noise** — stray clicks, dead navigations, duplicate `goto`.
4. **Pull out hardcoded data** — names, dates, IDs into variables or `.env`.

<details>
<summary>Before / after</summary>

Recorded:
```js
await page.goto('https://dev.aperion.health/member/dashboard');
await page.getByRole('link', { name: 'Care Plan' }).click();
await page.getByText('Active Plan').click();
await page.getByRole('button').nth(3).click();
```

Cleaned:
```js
test('TC-042: member views active care plan', async ({ page }) => {
  await page.goto('/member/dashboard');
  await page.getByRole('link', { name: 'Care Plan' }).click();
  await page.getByText('Active Plan').click();

  await expect(page.getByTestId('plan-name')).toHaveText('Diabetes Care 2026');
  await expect(page.getByTestId('coach-name')).toBeVisible();
});
```
</details>

## Step 4 — run them

```bash
npm test          # headless
npm run test:headed
npm run report    # HTML report with traces/screenshots of failures
```

## Step 5 — the Excel test case document

```bash
npm run import           # pull the team's Google Sheet -> cases/manual-cases.json
npm test                 # run the suite; writes console + HTML report + Excel
```

Output: `reports/Aperion-Test-Cases.xlsx` (`npm run excel` is an alias for `npm test`).

### One document, two sources

The sheet has the columns exactly:

`Testcase ID | Module | Test Scenario | Preconditions | Test steps | Test Data |
Expected Result | Actual Result | Status`

and the generated workbook uses those same nine, so it is a drop-in replacement rather
than a competing format. It merges:

- **Manual cases** - imported from the sheet by `npm run import`. Sheet order is kept.
- **Automated cases** - from the Playwright run.

When an automated test uses a **case ID that already exists in the sheet**, the run
result replaces that row's Status and Actual Result - that case is now automated and a
human no longer fills it in. Automated cases with new IDs are appended at the end.

So the migration path is: pick a manual case, record it, give the test that case's ID,
and the row flips from hand-maintained to run-maintained with nothing else to update.

Point it at a different sheet or tab with `SHEET_ID` / `SHEET_GID`. The sheet must be
link-shared (Share > Anyone with the link > Viewer) for the export to work.

All three reporters live in `playwright.config.js`, so every run refreshes all of them.
Do **not** pass `--reporter` on the command line - it REPLACES that list, which silently
stops the HTML report updating and leaves you reading a stale one.

Columns match the existing Aperion test case documents:

`Test Case ID | Module | Feature / Function | Test Scenario | Preconditions | Test Steps |
Test Data | Expected Result | Actual Result | Status | Priority | Test Type | Automated |
Remarks / Notes`

Plus a **Summary** sheet: pass/fail counts, overall result, and cases per module.

The sheet is built for hand-editing too — frozen header, autofilter, wrapped text,
Status and Priority dropdowns, and conditional colouring that recolours when you change
a Status yourself (Pass green, Fail red, Blocked orange, Skipped grey).

### Where the columns come from

You write the document fields once, on the test itself, using `caseOf()`:

```js
const { test, expect, caseOf } = require('../support/testcase');

test(...caseOf({
  id: 'TC-MEM-001',
  module: 'Care Plan',
  feature: 'View active care plan',
  scenario: 'Member can open and read their active care plan',
  preconditions: 'Logged in as a member with an active plan.',
  steps: [                       // arrays become "1) ... 2) ..." in the cell
    'Click "Care Plan" in the sidebar.',
    'Select the active plan card.',
  ],
  data: 'Plan: Diabetes Care 2026',
  expected: 'Plan name, start date and coach are displayed.',
  priority: 'High',              // High | Medium | Low
  type: 'Functional',
  remarks: '',
}), async ({ page }) => {
  // ...paste your recorded body here...
});
```

Use `test.skip(...caseOf({ ... }), ...)` to park a case - it still gets a row in the
sheet, marked Skipped.

`caseOf()` is spread into `test()` rather than wrapping it, so Playwright still
attributes each test to your spec file. A helper that calls `test()` internally makes
every test report its location as the helper, which breaks report links.

`Status` and `Actual Result` are the only columns you never write — they come from the
run. A pass writes "As expected."; a failure writes the assertion error.

So the full loop is: **record → paste into `caseOf()` → `npm run excel`**, and the
spreadsheet is a by-product of the tests rather than a second thing to maintain.

A plain `test()` still appears in the sheet, just with empty metadata columns.

---

## About the session

Auth lives in `localStorage`, not cookies: `aperion_token` lasts **15 min**,
`aperion_refresh_token` lasts **24 h**. A cold page load validates only the access
token, so a raw `auth.json` would go stale in 15 minutes.

`scripts/refresh-auth.js` runs before every record and every test run. It posts the
saved refresh token to `/api/v1/auth/refresh` — the same call the portal itself makes
every ~14 min — and swaps the fresh access token back into `auth.json`. That makes one
manual login last a working day.

It is session maintenance, not a bypass: it cannot create a session and cannot outlive
the 24 h cap. When the cap is hit you get a clear warning and re-run `npm run auth`.
Opt out with `APERION_NO_AUTO_REFRESH=1`.

**Not in this repo, ever:** OTP codes, passwords, dev bypass flags. If a run needs a
login, a human does it.

## Layout

```
auth/auth.json        saved session (git-ignored)
scripts/              refresh-auth.js, global-setup.js
support/testcase.js   caseOf() - test + its document fields in one place
reporters/            excel-reporter.js - writes the .xlsx
reports/              Aperion-Test-Cases.xlsx
tests/                your specs; 00-auth-smoke checks the session first
pages/                page objects, once a flow is used by 3+ tests
playwright.config.js  baseURL, storageState, trace/screenshot on failure
```
