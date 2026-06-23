/**
 * example/login.test.ts
 *
 * Full working example of greybox using a local Ollama model.
 *
 * Prerequisites:
 *   1. Build your app:  npx detox build -c ios.sim.debug
 *   2. Start Ollama:    ollama run qwen2.5:7b
 *   3. Run tests:       npx detox test -c ios.sim.debug example/login.test.ts
 *
 * Reports are written to ./test-results/ after the suite finishes.
 */

import {
  Pilot,
  DetoxDriver,
  OllamaPromptHandler,
  ReportBuilder,
} from '../src';

// ── Setup ─────────────────────────────────────────────────────────────────────

const reporter = new ReportBuilder('Login Suite');

const pilot = new Pilot({
  driver: new DetoxDriver(),
  promptHandler: new OllamaPromptHandler({
    model: 'qwen2.5:7b',                    // swap to qwen2.5:14b for higher accuracy
    baseUrl: 'http://localhost:11434',
  }),
  maxRetries: 3,
  cache: true,                              // cache hits skip LLM on repeated runs
});

// ── Suite lifecycle ───────────────────────────────────────────────────────────

beforeAll(async () => {
  // Launch the app fresh once at suite start.
  // Bundle ID / APK path is configured in .detoxrc.js — no need to specify here.
  await device.launchApp({
    newInstance: true,
    // Grant permissions upfront so the supervisor doesn't need to dismiss them
    permissions: { notifications: 'YES', camera: 'NO' },
  });
});

afterAll(() => {
  // Write all report formats to ./test-results/
  // → greybox-report.json
  // → greybox-junit.xml   (GitHub Actions / CircleCI / Azure DevOps)
  // → greybox-report.html (open in browser)
  // → allure-results/            (run `allure generate test-results/allure-results`)
  reporter.writeAll('test-results');
});

beforeEach(async () => {
  // Bring app to foreground and reset JS state without re-launching native modules
  await device.launchApp({ newInstance: false });
  // Start a new pilot session — pass the Jest test name for labelled report entries
  pilot.start(expect.getState().currentTestName ?? 'test');
});

afterEach(() => {
  pilot.end();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Login flow', () => {
  it('should log in with valid credentials', async () => {
    await pilot.perform(
      'tap the sign in button',
      'type "user@example.com" into the email field',
      'type "password123" into the password field',
      'tap the submit button',
    );
    await pilot.check('the home screen is visible');
    await pilot.check('the navigation bar is visible');
  });

  it('should show an error for invalid credentials', async () => {
    await pilot.perform(
      'tap the sign in button',
      'type "bad@example.com" into the email field',
      'type "wrongpass" into the password field',
      'tap the submit button',
    );
    await pilot.check('an error message is visible');
    await pilot.check('we are still on the sign in screen');
  });

  it('should continue as guest', async () => {
    await pilot.perform('tap the continue as guest button');
    await pilot.check('the home screen is visible');
  });

  it('should navigate to the live tab after guest login', async () => {
    await pilot.perform(
      'tap the continue as guest button',
      'tap the live tab in the navigation bar',
    );
    await pilot.check('the live TV screen is visible');
  });
});
