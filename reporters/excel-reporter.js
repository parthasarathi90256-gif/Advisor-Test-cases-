/**
 * Playwright reporter that emits the team's QA test case document (.xlsx).
 *
 * Columns match the live Google Sheet exactly (9 columns), so this file is a
 * drop-in replacement for it rather than a second, competing format.
 *
 * It merges two sources into one document:
 *   - MANUAL cases from cases/manual-cases.json (`npm run import` pulls the sheet)
 *   - AUTOMATED cases from this Playwright run
 *
 * When an automated test carries an ID that already exists in the sheet, the run
 * result wins - that case has been automated, so its Status and Actual Result now
 * come from the suite instead of a human. Sheet order is preserved; automated
 * cases with new IDs are appended.
 */
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const OUT = process.env.EXCEL_OUT ||
  path.join(__dirname, '..', 'reports', 'Aperion-Test-Cases.xlsx');
const MANUAL = path.join(__dirname, '..', 'cases', 'manual-cases.json');

// Exactly the live sheet's header row.
const COLUMNS = [
  { header: 'Testcase ID',     key: 'id',            width: 14 },
  { header: 'Module',          key: 'module',        width: 26 },
  { header: 'Test Scenario',   key: 'scenario',      width: 48 },
  { header: 'Preconditions',   key: 'preconditions', width: 38 },
  { header: 'Test steps',      key: 'steps',         width: 52 },
  { header: 'Test Data',       key: 'data',          width: 30 },
  { header: 'Expected Result', key: 'expected',      width: 48 },
  { header: 'Actual Result',   key: 'actual',        width: 40 },
  { header: 'Status',          key: 'status',        width: 14 },
];

const STATUS_COL = COLUMNS.findIndex((c) => c.key === 'status') + 1;
const STATUSES = ['Pass', 'Fail', 'Blocked', 'Skipped', 'Not Executed'];

const STATUS_OF = {
  passed: 'Pass',
  failed: 'Fail',
  timedOut: 'Fail',
  interrupted: 'Blocked',
  skipped: 'Skipped',
};

const FILL = {
  Pass:           'FFD9EAD3',
  Fail:           'FFF4CCCC',
  Blocked:        'FFFCE5CD',
  Skipped:        'FFEFEFEF',
  'Not Executed': 'FFF3F3F3',
};

const HEADER_BG = 'FF1F3864';
const TITLE_BG = 'FF2E5C9A';
const BORDER = { style: 'thin', color: { argb: 'FFB7B7B7' } };

// Playwright colours error output with ANSI escapes; strip them for Excel.
const ANSI = new RegExp(String.fromCharCode(27) + '\\[[0-9;]*m', 'g');

/** "AP_TC_07: member search works" -> { id, scenario } */
function splitTitle(title) {
  const m = /^\s*([A-Za-z][A-Za-z0-9_-]*[_-]\d+)\s*[:–-]\s*(.+)$/.exec(title);
  return m ? { id: m[1], scenario: m[2].trim() } : { id: '', scenario: title.trim() };
}

function annotationsOf(test) {
  const out = {};
  for (const a of test.annotations || []) {
    if (a.type && a.description !== undefined) out[a.type] = a.description;
  }
  return out;
}

/** Error text is long and noisy; keep the useful head of it. */
function actualFrom(result) {
  if (!result) return '';
  if (result.status === 'passed') return 'As expected.';
  if (result.status === 'skipped') return 'Not run.';
  const raw = (result.errors || []).map((e) => e.message || '').join('\n') ||
    (result.error && result.error.message) || '';
  return raw.replace(ANSI, '').trim()
    .split('\n').filter((l) => l.trim()).slice(0, 6).join('\n').slice(0, 1200);
}

function loadManual() {
  if (!fs.existsSync(MANUAL)) return [];
  try {
    return JSON.parse(fs.readFileSync(MANUAL, 'utf8'));
  } catch (err) {
    console.warn(`  Could not read ${MANUAL}: ${err.message}`);
    return [];
  }
}

class ExcelReporter {
  constructor(options = {}) {
    this.out = options.outputFile ? path.resolve(options.outputFile) : OUT;
    this.results = new Map();
    this.allTests = [];
    this.executed = false;
  }

  onBegin(config, suite) {
    this.allTests = suite.allTests();
  }

  onTestEnd(test, result) {
    this.executed = true;
    this.results.set(test.id, result);
  }

  async onEnd(runResult) {
    // 1. Automated cases from this run, keyed by test case ID.
    const automated = new Map();
    for (const t of this.allTests) {
      const { id, scenario } = splitTitle(t.title);
      const a = annotationsOf(t);
      const result = this.results.get(t.id);
      const row = {
        id,
        module: a.module || '',
        scenario,
        preconditions: a.preconditions || '',
        steps: a.steps || '',
        data: a.data || '',
        expected: a.expected || '',
        actual: actualFrom(result),
        status: result ? (STATUS_OF[result.status] || 'Not Executed') : 'Not Executed',
        automated: true,
      };
      if (id) automated.set(id, row);
      else automated.set(`__untitled_${automated.size}`, row);
    }

    // 2. Sheet order first; an automated case with the same ID replaces the
    //    manual row, but keeps the manual text where the test does not supply it.
    const rows = [];
    const used = new Set();
    for (const m of loadManual()) {
      const auto = automated.get(m.id);
      if (auto) {
        used.add(m.id);
        rows.push({
          ...m,
          module: auto.module || m.module,
          scenario: auto.scenario || m.scenario,
          preconditions: auto.preconditions || m.preconditions,
          steps: auto.steps || m.steps,
          data: auto.data || m.data,
          expected: auto.expected || m.expected,
          actual: auto.actual,
          status: auto.status,
          automated: true,
        });
      } else {
        rows.push(m);
      }
    }
    // 3. Automated cases that are not in the sheet yet.
    for (const [id, row] of automated) if (!used.has(id)) rows.push(row);

    await this.write(rows, runResult);

    const auto = rows.filter((r) => r.automated).length;
    console.log(
      `\n  Test case document written: ${this.out}\n` +
      `  ${rows.length} cases  (${auto} automated, ${rows.length - auto} manual)`
    );
  }

  async write(rows, runResult) {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Aperion QA';
    wb.created = new Date();

    const ws = wb.addWorksheet('Test Cases', {
      views: [{ state: 'frozen', ySplit: 5, xSplit: 1 }],
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });

    const lastCol = COLUMNS.length;
    ws.columns = COLUMNS.map((c) => ({ key: c.key, width: c.width }));

    const counts = STATUSES.reduce((m, s) => {
      m[s] = rows.filter((r) => r.status === s).length;
      return m;
    }, {});
    const autoCount = rows.filter((r) => r.automated).length;

    // --- Title block -------------------------------------------------------
    ws.mergeCells(1, 1, 1, lastCol);
    const title = ws.getCell('A1');
    title.value = 'Aperion Health - Wellness / Advisor Portal - Test Case Document';
    title.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
    title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TITLE_BG } };
    title.alignment = { vertical: 'middle', horizontal: 'center' };
    ws.getRow(1).height = 30;

    ws.mergeCells(2, 1, 2, lastCol);
    ws.getCell('A2').value = [
      `Generated: ${new Date().toISOString().slice(0, 10)}`,
      `Total Test Cases: ${rows.length}`,
      `Automated: ${autoCount}`,
      `Manual: ${rows.length - autoCount}`,
      `Pass: ${counts.Pass}`,
      `Fail: ${counts.Fail}`,
    ].join('     |     ');
    ws.getCell('A2').font = { size: 10, color: { argb: 'FF444444' } };

    ws.mergeCells(3, 1, 3, lastCol);
    ws.getCell('A3').value =
      'Manual cases are imported from the team sheet (npm run import). Automated cases are filled in '
      + 'by the Playwright suite - where an automated test reuses a case ID, its run result replaces '
      + 'the manual Status and Actual Result. Status is a dropdown; colours follow the value.';
    ws.getCell('A3').font = { italic: true, size: 10, color: { argb: 'FF666666' } };

    // --- Header ------------------------------------------------------------
    const HEADER_ROW = 5;
    const header = ws.getRow(HEADER_ROW);
    COLUMNS.forEach((c, i) => {
      const cell = header.getCell(i + 1);
      cell.value = c.header;
      cell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = { top: BORDER, left: BORDER, bottom: BORDER, right: BORDER };
    });
    header.height = 26;

    // --- Data --------------------------------------------------------------
    rows.forEach((r, idx) => {
      const row = ws.getRow(HEADER_ROW + 1 + idx);
      COLUMNS.forEach((c, i) => {
        const cell = row.getCell(i + 1);
        cell.value = r[c.key] || '';
        cell.alignment = { vertical: 'top', wrapText: true };
        cell.border = { top: BORDER, left: BORDER, bottom: BORDER, right: BORDER };
        cell.font = { size: 10 };
        if (idx % 2 === 1) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAFAFA' } };
        }
      });
      row.getCell(1).font = { size: 10, bold: true };
      row.getCell(STATUS_COL).alignment = { vertical: 'middle', horizontal: 'center' };
    });

    const firstData = HEADER_ROW + 1;
    const lastData = HEADER_ROW + rows.length;

    if (rows.length) {
      ws.autoFilter = {
        from: { row: HEADER_ROW, column: 1 },
        to: { row: HEADER_ROW, column: lastCol },
      };

      const letter = ws.getColumn(STATUS_COL).letter;
      for (let r = firstData; r <= lastData; r++) {
        ws.getCell(`${letter}${r}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`"${STATUSES.join(',')}"`],
          showErrorMessage: true,
          errorTitle: 'Invalid status',
          error: `Pick one of: ${STATUSES.join(', ')}`,
        };
      }

      ws.addConditionalFormatting({
        ref: `${letter}${firstData}:${letter}${lastData}`,
        rules: STATUSES.map((s, i) => ({
          type: 'containsText',
          operator: 'containsText',
          text: s,
          priority: i + 1,
          style: {
            fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: FILL[s] } },
            font: { bold: true },
          },
        })),
      });
    }

    this.summarySheet(wb, rows, counts, runResult);

    fs.mkdirSync(path.dirname(this.out), { recursive: true });
    await wb.xlsx.writeFile(this.out);
  }

  summarySheet(wb, rows, counts, runResult) {
    const ws = wb.addWorksheet('Summary');
    ws.columns = [{ width: 40 }, { width: 14 }, { width: 12 }];

    ws.mergeCells('A1:C1');
    const t = ws.getCell('A1');
    t.value = 'Summary';
    t.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
    t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TITLE_BG } };
    t.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 24;

    const total = rows.length || 1;
    const pct = (n) => `${Math.round((n / total) * 100)}%`;
    const add = (label, value, p) => {
      const row = ws.addRow([label, value, p]);
      row.getCell(2).alignment = { horizontal: 'center' };
      row.getCell(3).alignment = { horizontal: 'center' };
      return row;
    };

    ws.addRow([]);
    add('Total test cases', rows.length, '100%').font = { bold: true };
    STATUSES.forEach((s) => {
      const n = counts[s] || 0;
      add(s, n, pct(n)).getCell(1).fill =
        { type: 'pattern', pattern: 'solid', fgColor: { argb: FILL[s] } };
    });

    ws.addRow([]);
    const auto = rows.filter((r) => r.automated).length;
    add('Automated', auto, pct(auto)).font = { bold: true };
    add('Manual', rows.length - auto, pct(rows.length - auto));

    ws.addRow([]);
    add('Suite result', this.executed
      ? (runResult && runResult.status === 'passed' ? 'PASSED' : 'FAILED')
      : 'NOT RUN', '').font = { bold: true };

    // Coverage by module, so gaps and automation progress are visible.
    const byModule = {};
    rows.forEach((r) => {
      const k = (r.module || '(unset)').trim();
      byModule[k] = byModule[k] || { total: 0, auto: 0, fail: 0 };
      byModule[k].total++;
      if (r.automated) byModule[k].auto++;
      if (r.status === 'Fail') byModule[k].fail++;
    });

    ws.addRow([]);
    const h = ws.addRow(['Module', 'Cases', 'Automated']);
    [1, 2, 3].forEach((n) => { h.getCell(n).font = { bold: true }; });
    Object.entries(byModule)
      .sort((a, b) => b[1].total - a[1].total)
      .forEach(([m, v]) => {
        const row = add(m, v.total, v.auto);
        if (v.fail) row.getCell(1).font = { color: { argb: 'FFCC0000' } };
      });
  }
}

module.exports = ExcelReporter;
