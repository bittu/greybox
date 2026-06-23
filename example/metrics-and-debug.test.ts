/**
 * example/metrics-and-debug.test.ts
 *
 * Demonstrates the metrics (token/cost) and debug middleware.
 *
 * Run with: npx detox test -c ios.sim.debug example/metrics-and-debug.test.ts
 *
 * After the run you will find:
 *   test-results/greybox-metrics.json  — full token/cost breakdown
 *   test-results/greybox-report.html   — visual HTML report
 *   test-results/debug.log                    — full prompt/response log
 */

import {
  Pilot,
  DetoxDriver,
  OllamaPromptHandler,
  ReportBuilder,
  formatMetricsSummary,
} from '../src';

// ── Pilot with metrics + debug both enabled ───────────────────────────────────

const pilot = new Pilot({
  driver: new DetoxDriver(),

  promptHandler: new OllamaPromptHandler({ model: 'qwen2.5:7b' }),

  maxRetries: 3,
  cache: true,

  // Token counting + cost estimation
  metrics: {
    enabled: true,
    // Must match the model name used above so the pricing table is looked up correctly.
    // For local Ollama models the cost is always $0 — but token counts are still tracked.
    model: 'qwen2.5:7b',
    // Print the summary table to stdout after writeReports(). Default: true
    printSummary: true,
  },

  // Verbose LLM logging — disable in CI, enable locally when debugging flaky steps
  debug: {
    enabled: true,
    logPrompt: true,       // log the full prompt sent to the LLM
    logResponse: true,     // log the full raw LLM response
    truncateAt: 1500,      // truncate at 1500 chars in console; 0 = no truncation
    logFile: 'test-results/debug.log',  // also write to file (appended each run)
  },
});

const reporter = new ReportBuilder('Metrics Demo Suite');

// ── Lifecycle ─────────────────────────────────────────────────────────────────

beforeAll(async () => {
  await device.launchApp({
    newInstance: true,
    permissions: { notifications: 'YES', camera: 'NO' },
  });
});

afterAll(() => {
  // writeAll() triggers writeReports() internally which:
  //  1. Prints the token/cost summary table to stdout
  //  2. Writes test-results/greybox-metrics.json
  //  3. Writes test-results/greybox-report.json
  //  4. Writes test-results/greybox-junit.xml
  //  5. Writes test-results/greybox-report.html
  //  6. Writes test-results/allure-results/
  reporter.writeAll('test-results');

  // You can also access metrics programmatically
  const metrics = pilot.getMetrics();
  if (metrics) {
    console.log('\n--- Programmatic metrics access ---');
    console.log('Total tokens:', metrics.totals.totalTokens);
    console.log('Total cost:  $' + metrics.totals.estimatedCostUsd.toFixed(6));
    console.log('Cache hits:  ', metrics.cacheHits);
    console.log('Cache misses:', metrics.cacheMisses);
    console.log('Cache saved: $' + metrics.cacheSavingsUsd.toFixed(6));

    // Per-test breakdown
    for (const test of metrics.tests) {
      console.log(`\n  ${test.testName}`);
      for (const step of test.steps) {
        const cached = step.fromCache ? '[CACHED] ' : '         ';
        console.log(`    ${cached}${step.instruction.slice(0, 50).padEnd(50)} | tokens: ${step.totalTokens}`);
      }
    }

    // Or print the formatted table
    console.log(formatMetricsSummary(metrics));
  }
});

beforeEach(async () => {
  await device.launchApp({ newInstance: false });
  pilot.start(expect.getState().currentTestName ?? 'test');
});

afterEach(() => {
  pilot.end();
  // Per-test token usage is logged automatically after end() when printSummary: true
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Metrics demo', () => {
  it('first run — LLM called, tokens tracked, results cached', async () => {
    await pilot.perform('tap the continue as guest button');
    await pilot.check('the home screen is visible');
    // These steps hit the LLM — tokens are counted, code is cached
  });

  it('second run — cache hits, zero LLM tokens, zero cost', async () => {
    await pilot.perform('tap the continue as guest button');
    await pilot.check('the home screen is visible');
    // Same screen + same instruction → cache hits → 0 tokens used
  });

  it('new step — LLM called again for unfamiliar instruction', async () => {
    await pilot.perform(
      'tap the continue as guest button',
      'tap the live tab in the navigation bar',
    );
    await pilot.check('the live screen is visible');
  });
});
