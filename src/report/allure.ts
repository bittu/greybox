import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import type { SuiteReport, StepReport } from './index';

/**
 * Writes Allure-compatible result files to outputDir.
 * After running tests, generate the report with:
 *   npx allure generate test-results/allure-results --clean -o allure-report
 *   npx allure open allure-report
 */
export function writeAllureResults(
  suite: SuiteReport,
  outputDir = 'test-results/allure-results',
): void {
  fs.mkdirSync(outputDir, { recursive: true });

  for (const test of suite.tests) {
    const uuid = crypto.randomUUID();
    const result = {
      uuid,
      name: test.testName,
      status: test.status === 'passed' ? 'passed' : 'failed',
      stage: 'finished',
      start: new Date(test.startedAt).getTime(),
      stop: new Date(test.startedAt).getTime() + test.totalDurationMs,
      labels: [
        { name: 'suite', value: suite.suiteName },
        { name: 'framework', value: 'greybox' },
        { name: 'language', value: 'TypeScript' },
      ],
      steps: test.steps.map((s) => toAllureStep(s)),
      attachments: test.steps
        .filter((s) => s.screenshotPath)
        .map((s) => ({
          name: 'failure-screenshot',
          source: path.basename(s.screenshotPath!),
          type: 'image/png',
        })),
      statusDetails:
        test.status === 'failed'
          ? { message: test.steps.find((s) => s.error)?.error ?? 'Test failed' }
          : undefined,
    };

    fs.writeFileSync(path.join(outputDir, `${uuid}-result.json`), JSON.stringify(result, null, 2));

    // Copy screenshots into allure-results so they resolve
    for (const step of test.steps) {
      if (step.screenshotPath && fs.existsSync(step.screenshotPath)) {
        fs.copyFileSync(
          step.screenshotPath,
          path.join(outputDir, path.basename(step.screenshotPath)),
        );
      }
    }
  }
}

function toAllureStep(step: StepReport) {
  return {
    name: step.instruction,
    status: step.status === 'failed' ? 'failed' : 'passed',
    stage: 'finished',
    start: 0,
    stop: step.durationMs,
    parameters: [{ name: 'cached', value: String(step.fromCache) }],
    attachments: step.screenshotPath
      ? [{ name: 'screenshot', source: path.basename(step.screenshotPath), type: 'image/png' }]
      : [],
    statusDetails: step.error ? { message: step.error } : undefined,
    steps: [
      {
        name: 'Generated code',
        status: step.status === 'failed' ? 'failed' : 'passed',
        stage: 'finished',
        start: 0,
        stop: 0,
        parameters: [{ name: 'code', value: step.code.slice(0, 500) }],
        attachments: [],
        steps: [],
      },
    ],
  };
}
