/**
 * Render reports/Aperion-Test-Cases.xlsx to reports/Aperion-Test-Cases.pdf.
 *
 * Same nine columns as the workbook and the team sheet, one row per case,
 * header repeated on every page, Status coloured the same way as the sheet
 * (Pass green, Fail red, Blocked orange, Skipped grey). A summary page comes
 * first: totals, suite result and cases per module.
 *
 *   npm run pdf                      # after `npm test` has refreshed the workbook
 *   node scripts/export-pdf.js out.pdf
 */
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');
const { chromium } = require('@playwright/test');

const XLSX = path.join(__dirname, '..', 'reports', 'Aperion-Test-Cases.xlsx');
const OUT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'reports', 'Aperion-Test-Cases.pdf'));
const HEADER_ROW = 5; // rows 1-4 are the workbook's title block

const text = (v) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') {
    if (v.richText) return v.richText.map((r) => r.text).join('');
    if (v.result !== undefined) return String(v.result);
    if (v.text) return String(v.text);
  }
  return String(v);
};
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');

async function main() {
  if (!fs.existsSync(XLSX)) throw new Error(`${XLSX} not found - run \`npm test\` first.`);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(XLSX);
  const ws = wb.getWorksheet('Test Cases');
  const meta = text(ws.getRow(2).getCell(1).value);
  const header = ws.getRow(HEADER_ROW).values.slice(1).map(text);
  const rows = [];
  for (let r = HEADER_ROW + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const cells = header.map((_, i) => text(row.getCell(i + 1).value));
    if (cells[0]) rows.push(cells);
  }
  const statusIdx = header.indexOf('Status');
  const moduleIdx = header.indexOf('Module');
  const counts = {};
  for (const r of rows) counts[r[statusIdx] || 'Not Executed'] = (counts[r[statusIdx] || 'Not Executed'] || 0) + 1;
  const modules = {};
  for (const r of rows) modules[r[moduleIdx]] = (modules[r[moduleIdx]] || 0) + 1;
  const failed = (counts.Fail || 0) > 0;
  const generated = new Date().toISOString().slice(0, 10);

  const summaryRows = Object.entries(modules).sort((a, b) => b[1] - a[1])
    .map(([m, n]) => `<tr><td>${esc(m)}</td><td class="num">${n}</td></tr>`).join('');
  const statusRows = ['Pass', 'Fail', 'Blocked', 'Skipped', 'Not Executed']
    .map((s) => `<tr><td>${s}</td><td class="num">${counts[s] || 0}</td><td class="num">${rows.length ? Math.round(((counts[s] || 0) / rows.length) * 100) : 0}%</td></tr>`).join('');
  const body = rows.map((r) => `<tr>${r.map((c, i) => `<td class="${i === statusIdx ? 'status ' + (c || '').toLowerCase().replace(/\s+/g, '-') : ''} c${i}">${esc(c)}</td>`).join('')}</tr>`).join('\n');

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Aperion Health - Test Case Document</title>
<style>
  @page { size: A4 landscape; margin: 12mm 10mm 14mm 10mm; }
  body { font-family: "Segoe UI", Arial, Helvetica, sans-serif; font-size: 8.5pt; color: #1b2a30; margin: 0; }
  h1 { font-size: 18pt; margin: 0 0 4px; } h2 { font-size: 13pt; margin: 18px 0 6px; }
  .meta { color: #55666c; font-size: 9pt; margin-bottom: 14px; }
  .tiles { display: flex; gap: 10px; margin: 10px 0 16px; }
  .tile { border: 1px solid #cfd8da; border-radius: 4px; padding: 8px 12px; min-width: 110px; }
  .tile b { display: block; font-size: 16pt; } .tile span { color: #55666c; font-size: 8pt; }
  .result { font-weight: 700; color: ${failed ? '#b23a2b' : '#2e7d4f'}; }
  table { border-collapse: collapse; width: 100%; table-layout: fixed; }
  th, td { border: 1px solid #cfd8da; padding: 4px 5px; vertical-align: top; word-wrap: break-word; overflow-wrap: anywhere; }
  th { background: #1f3864; color: #fff; text-align: left; font-size: 8pt; }
  thead { display: table-header-group; } tr { page-break-inside: avoid; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .summary td { padding: 3px 6px; } .summary { width: auto; min-width: 60%; }
  .c0 { width: 7%; } .c1 { width: 11%; } .c2 { width: 14%; } .c3 { width: 12%; } .c4 { width: 15%; } .c5 { width: 10%; } .c6 { width: 14%; } .c7 { width: 10%; } .c8 { width: 7%; }
  .status { font-weight: 700; text-align: center; }
  .status.pass { background: #ddf2e5; color: #2e7d4f; } .status.fail { background: #f9e1dc; color: #b23a2b; }
  .status.blocked { background: #fbefd7; color: #b7791f; } .status.skipped { background: #e6eef2; color: #55666c; }
  .page-break { page-break-after: always; }
  .footer { color: #55666c; font-size: 8pt; }
</style></head><body>
<h1>Aperion Health - Wellness / Advisor Portal - Test Case Document</h1>
<div class="meta">${esc(meta)}<br>PDF generated ${generated} from reports/Aperion-Test-Cases.xlsx</div>
<div class="tiles">
  <div class="tile"><b>${rows.length}</b><span>Total test cases</span></div>
  <div class="tile"><b>${counts.Pass || 0}</b><span>Pass</span></div>
  <div class="tile"><b>${counts.Fail || 0}</b><span>Fail</span></div>
  <div class="tile"><b>${counts.Skipped || 0}</b><span>Skipped</span></div>
  <div class="tile"><b class="result">${failed ? 'FAILED' : 'PASSED'}</b><span>Suite result</span></div>
</div>
<h2>Results</h2>
<table class="summary"><thead><tr><th>Status</th><th>Cases</th><th>Share</th></tr></thead><tbody>${statusRows}</tbody></table>
<h2>Coverage by module</h2>
<table class="summary"><thead><tr><th>Module</th><th>Cases</th></tr></thead><tbody>${summaryRows}</tbody></table>
<div class="page-break"></div>
<h2>Detailed test cases</h2>
<p class="footer">All text is wrapped within its column. The header repeats on every page.</p>
<table><thead><tr>${header.map((h, i) => `<th class="c${i}">${esc(h)}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table>
</body></html>`;

  const browser = await chromium.launch({ args: ['--disable-gpu', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'load' });
  await page.pdf({
    path: OUT, format: 'A4', landscape: true, printBackground: true,
    margin: { top: '12mm', right: '10mm', bottom: '14mm', left: '10mm' },
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate: '<div style="width:100%;font-size:7pt;color:#55666c;padding:0 10mm;display:flex;justify-content:space-between;"><span>Aperion Health - Wellness / Advisor Portal Test Cases</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>',
  });
  await browser.close();
  console.log(`  PDF written: ${OUT}\n  ${rows.length} cases  (${counts.Pass || 0} pass, ${counts.Fail || 0} fail, ${counts.Skipped || 0} skipped)`);
}

main().catch((err) => { console.error(err.message); process.exitCode = 1; });
