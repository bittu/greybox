import * as fs from 'fs';
import * as path from 'path';
import type { SuiteReport } from './index';

export function writeHtmlReport(suite: SuiteReport, outputDir = 'test-results'): string {
  fs.mkdirSync(outputDir, { recursive: true });
  const file = path.join(outputDir, 'greybox-report.html');
  fs.writeFileSync(file, renderHtml(suite));
  return file;
}

function renderHtml(suite: SuiteReport): string {
  const passColor = '#22c55e';
  const failColor = '#ef4444';
  const cacheColor = '#3b82f6';

  const testRows = suite.tests
    .map((test) => {
      const statusColor = test.status === 'passed' ? passColor : failColor;
      const stepRows = test.steps
        .map((step) => {
          const sc = step.status === 'failed' ? failColor : step.fromCache ? cacheColor : passColor;
          const badge = step.fromCache
            ? ' <span style="font-size:10px;background:#3b82f6;color:white;padding:1px 5px;border-radius:3px">CACHED</span>'
            : '';
          const screenshot = step.screenshotPath
            ? `<br><a href="${encodeURIComponent(path.basename(step.screenshotPath))}" target="_blank">📸 screenshot</a>`
            : '';
          const codeBlock = step.code
            ? `<details><summary style="cursor:pointer;color:#6b7280;font-size:11px">show code</summary><pre style="background:#1e1e1e;color:#d4d4d4;padding:8px;border-radius:4px;font-size:11px;overflow:auto">${escHtml(step.code)}</pre></details>`
            : '';
          const err = step.error
            ? `<div style="color:${failColor};font-size:11px;margin-top:4px">⚠ ${escHtml(step.error)}</div>`
            : '';
          return `
        <tr>
          <td style="padding:6px 12px;border-bottom:1px solid #f3f4f6">
            <span style="color:${sc}">●</span>${badge}
            <span style="margin-left:6px">${escHtml(step.instruction)}</span>
            ${err}${codeBlock}${screenshot}
          </td>
          <td style="padding:6px 12px;border-bottom:1px solid #f3f4f6;text-align:right;color:#9ca3af;white-space:nowrap">${step.durationMs}ms</td>
        </tr>`;
        })
        .join('');

      return `
      <div style="border:1px solid #e5e7eb;border-radius:8px;margin-bottom:16px;overflow:hidden">
        <div style="background:${test.status === 'passed' ? '#f0fdf4' : '#fef2f2'};padding:12px 16px;display:flex;justify-content:space-between;align-items:center">
          <span style="font-weight:600">${escHtml(test.testName)}</span>
          <span style="color:${statusColor};font-weight:600;font-size:13px">${test.status.toUpperCase()}</span>
        </div>
        <table style="width:100%;border-collapse:collapse">
          ${stepRows}
          <tr style="background:#f9fafb">
            <td style="padding:6px 12px;color:#9ca3af;font-size:12px">
              ${test.steps.length} step(s) · started ${test.startedAt}
            </td>
            <td style="padding:6px 12px;text-align:right;color:#9ca3af;font-size:12px">${test.totalDurationMs}ms total</td>
          </tr>
        </table>
      </div>`;
    })
    .join('');

  const pct = suite.tests.length ? Math.round((suite.totalPassed / suite.tests.length) * 100) : 0;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escHtml(suite.suiteName)} — greybox report</title>
  <style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;background:#f9fafb;color:#111827}
  .container{max-width:900px;margin:32px auto;padding:0 16px}</style>
</head>
<body>
<div class="container">
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px">
    <span style="font-size:28px">🤖</span>
    <div>
      <h1 style="margin:0;font-size:20px">${escHtml(suite.suiteName)}</h1>
      <div style="color:#6b7280;font-size:13px">greybox · ${suite.generatedAt}</div>
    </div>
    <div style="margin-left:auto;text-align:right">
      <div style="font-size:28px;font-weight:700;color:${pct === 100 ? passColor : failColor}">${pct}%</div>
      <div style="font-size:12px;color:#6b7280">${suite.totalPassed}/${suite.tests.length} passed</div>
    </div>
  </div>
  <div style="display:flex;gap:12px;margin-bottom:24px">
    <div style="background:white;border:1px solid #e5e7eb;border-radius:8px;padding:12px 20px;flex:1;text-align:center">
      <div style="font-size:24px;font-weight:700;color:${passColor}">${suite.totalPassed}</div>
      <div style="font-size:12px;color:#6b7280">Passed</div>
    </div>
    <div style="background:white;border:1px solid #e5e7eb;border-radius:8px;padding:12px 20px;flex:1;text-align:center">
      <div style="font-size:24px;font-weight:700;color:${failColor}">${suite.totalFailed}</div>
      <div style="font-size:12px;color:#6b7280">Failed</div>
    </div>
    <div style="background:white;border:1px solid #e5e7eb;border-radius:8px;padding:12px 20px;flex:1;text-align:center">
      <div style="font-size:24px;font-weight:700;color:#111827">${(suite.totalDurationMs / 1000).toFixed(1)}s</div>
      <div style="font-size:12px;color:#6b7280">Duration</div>
    </div>
  </div>
  ${testRows}
</div>
</body>
</html>`;
}

const escHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
