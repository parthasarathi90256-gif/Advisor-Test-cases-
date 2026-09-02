/**
 * Import the team's live Google Sheet test case document into cases/manual-cases.json.
 *
 *   npm run import
 *
 * The sheet is the source of truth for MANUAL cases. The Excel generator merges
 * these with whatever the automated suite produces, so one document covers both.
 * Re-run this whenever the sheet changes; it overwrites the JSON.
 *
 * Requires the sheet to be link-shared (it is exported via the public CSV endpoint).
 */
const fs = require('fs');
const path = require('path');

const SHEET_ID = process.env.SHEET_ID ||
  '1ktPVhea_h1R4ak1ZyM7UM5rKNeFcyC8l1AHMDiHEHTA';
const GID = process.env.SHEET_GID || '1297079511';
const OUT = path.join(__dirname, '..', 'cases', 'manual-cases.json');

const URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`;

/** RFC4180-ish parser: handles quoted fields containing commas and newlines. */
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// Sheet header -> our field names, matched case-insensitively so a renamed
// header ("Test Steps" vs "Test steps") does not silently drop a column.
const HEADER_MAP = {
  'testcase id': 'id',
  'test case id': 'id',
  'module': 'module',
  'test scenario': 'scenario',
  'preconditions': 'preconditions',
  'test steps': 'steps',
  'test data': 'data',
  'expected result': 'expected',
  'actual result': 'actual',
  'status': 'status',
};

async function main() {
  process.stdout.write(`  Fetching sheet ${SHEET_ID} (gid ${GID})...\n`);

  const res = await fetch(URL, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Sheet fetch failed: HTTP ${res.status}`);

  const text = await res.text();
  if (text.trimStart().startsWith('<')) {
    throw new Error(
      'Got HTML instead of CSV - the sheet is not link-shared.\n' +
      '  In Google Sheets: Share > General access > Anyone with the link (Viewer).'
    );
  }

  const rows = parseCsv(text);
  if (!rows.length) throw new Error('Sheet is empty.');

  const header = rows[0].map((h) => HEADER_MAP[h.trim().toLowerCase()] || null);
  if (!header.includes('id')) {
    throw new Error(`No "Testcase ID" column found. Header was: ${rows[0].join(', ')}`);
  }

  const cases = [];
  let blank = 0;

  for (const row of rows.slice(1)) {
    const rec = {};
    header.forEach((key, i) => { if (key) rec[key] = (row[i] || '').trim(); });

    if (!rec.id) continue;
    // Rows with an ID but no scenario are unwritten placeholders in the sheet.
    if (!rec.scenario) { blank++; continue; }

    cases.push({
      id: rec.id,
      module: rec.module || '',
      scenario: rec.scenario,
      preconditions: rec.preconditions || '',
      steps: rec.steps || '',
      data: rec.data || '',
      expected: rec.expected || '',
      actual: rec.actual || '',
      status: rec.status || 'Not Executed',
      automated: false,
    });
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(cases, null, 2));

  const byStatus = cases.reduce((m, c) => (m[c.status] = (m[c.status] || 0) + 1, m), {});
  console.log(`  Imported ${cases.length} manual cases -> ${path.relative(process.cwd(), OUT)}`);
  console.log(`  Status: ${Object.entries(byStatus).map(([k, v]) => `${k}=${v}`).join('  ')}`);
  if (blank) console.log(`  Skipped ${blank} placeholder rows (ID but no scenario).`);
}

main().catch((err) => {
  console.error(`\n  ${err.message}\n`);
  process.exitCode = 1;
});
