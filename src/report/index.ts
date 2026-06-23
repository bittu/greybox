import * as fs from 'fs';
import * as path from 'path';

// ── Types ────────────────────────────────────────────────────────────────────

export type StepStatus = 'passed' | 'failed' | 'cached';

export interface StepReport {
  instruction: string;
  status: StepStatus;
  /** LLM-generated code that was executed */
  code: string;
  /** Whether the code came from cache */
  fromCache: boolean;
  durationMs: number;
  error?: string;
  /** Path to screenshot taken on failure */
  screenshotPath?: string;
}

export interface TestReport {
  testName: string;
  status: 'passed' | 'failed';
  steps: StepReport[];
  totalDurationMs: number;
  startedAt: string;
}

export interface SuiteReport {
  suiteName: string;
  tests: TestReport[];
  totalPassed: number;
  totalFailed: number;
  totalDurationMs: number;
  generatedAt: string;
}

// ── ReportBuilder ─────────────────────────────────────────────────────────────

export class ReportBuilder {
  private tests: TestReport[] = [];
  private suiteName: string;
  private suiteStart = Date.now();

  constructor(suiteName = 'greybox') {
    this.suiteName = suiteName;
  }

  beginTest(testName: string): TestReportBuilder {
    return new TestReportBuilder(testName, (report) => {
      this.tests.push(report);
    });
  }

  build(): SuiteReport {
    return {
      suiteName: this.suiteName,
      tests: this.tests,
      totalPassed: this.tests.filter((t) => t.status === 'passed').length,
      totalFailed: this.tests.filter((t) => t.status === 'failed').length,
      totalDurationMs: Date.now() - this.suiteStart,
      generatedAt: new Date().toISOString(),
    };
  }

  /** Write JSON report */
  writeJson(outputDir = 'test-results'): string {
    const report = this.build();
    fs.mkdirSync(outputDir, { recursive: true });
    const file = path.join(outputDir, 'greybox-report.json');
    fs.writeFileSync(file, JSON.stringify(report, null, 2));
    return file;
  }

  /** Write JUnit XML — compatible with GitHub Actions, CircleCI, Azure DevOps */
  writeJUnit(outputDir = 'test-results'): string {
    const report = this.build();
    fs.mkdirSync(outputDir, { recursive: true });
    const file = path.join(outputDir, 'greybox-junit.xml');
    fs.writeFileSync(file, toJUnit(report));
    return file;
  }

  /** Write Allure result files — run `allure generate` afterwards to get the visual report */
  writeAllure(outputDir = 'test-results/allure-results'): void {
    const { writeAllureResults } = require('./allure');
    writeAllureResults(this.build(), outputDir);
  }

  /** Write self-contained HTML report */
  writeHtml(outputDir = 'test-results'): string {
    const { writeHtmlReport } = require('./html');
    return writeHtmlReport(this.build(), outputDir);
  }

  /** Write all report formats at once */
  writeAll(outputDir = 'test-results'): void {
    this.writeJson(outputDir);
    this.writeJUnit(outputDir);
    this.writeHtml(outputDir);
    this.writeAllure(`${outputDir}/allure-results`);
  }
}

// ── TestReportBuilder ─────────────────────────────────────────────────────────

export class TestReportBuilder {
  private steps: StepReport[] = [];
  private start = Date.now();
  private done = false;

  constructor(
    private readonly testName: string,
    private readonly onDone: (r: TestReport) => void,
  ) {}

  recordStep(step: Omit<StepReport, 'durationMs'> & { durationMs: number }): void {
    this.steps.push(step);
  }

  end(status: 'passed' | 'failed'): void {
    if (this.done) return;
    this.done = true;
    this.onDone({
      testName: this.testName,
      status,
      steps: this.steps,
      totalDurationMs: Date.now() - this.start,
      startedAt: new Date(this.start).toISOString(),
    });
  }
}

// ── JUnit serialiser ──────────────────────────────────────────────────────────

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function toJUnit(suite: SuiteReport): string {
  const totalTests = suite.tests.length;
  const failures = suite.totalFailed;
  const time = (suite.totalDurationMs / 1000).toFixed(3);

  const testCases = suite.tests
    .map((t) => {
      const tTime = (t.totalDurationMs / 1000).toFixed(3);
      const steps = t.steps
        .map(
          (s) =>
            `  [${s.status.toUpperCase()}${s.fromCache ? '/CACHED' : ''}] ${s.instruction} (${s.durationMs}ms)`,
        )
        .join('\n');

      const failure =
        t.status === 'failed'
          ? `<failure message="${escape(t.steps.find((s) => s.error)?.error ?? 'Test failed')}">${escape(steps)}</failure>`
          : '';

      const screenshot = t.steps.find((s) => s.screenshotPath)?.screenshotPath;
      const props = screenshot
        ? `<properties><property name="screenshot" value="${escape(screenshot)}"/></properties>`
        : '';

      return `  <testcase name="${escape(t.testName)}" time="${tTime}">${props}${failure ? `\n    ${failure}\n  ` : ''}</testcase>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="${escape(suite.suiteName)}" tests="${totalTests}" failures="${failures}" time="${time}" timestamp="${suite.generatedAt}">
${testCases}
</testsuite>`;
}
