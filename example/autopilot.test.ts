/**
 * example/autopilot.test.ts
 *
 * Demonstrates:
 *   - Goal-based autopilot() mode
 *   - All built-in LLM provider options
 *   - Custom logger delegate
 *   - Allure + HTML reporting
 *
 * Run with: npx detox test -c ios.sim.debug example/autopilot.test.ts
 */

import {
  Pilot,
  DetoxDriver,
  OllamaPromptHandler,
  OpenAICompatiblePromptHandler,
  BedrockPromptHandler,
  AnthropicPromptHandler,
  GeminiPromptHandler,
  ReportBuilder,
  logger,
  LoggerDelegate,
  LogLevel,
} from '../src';

// ── Pick your LLM provider ────────────────────────────────────────────────────
// Uncomment the one you want to use.

// Option 1: Local Ollama (free, private, no API key)
const promptHandler = new OllamaPromptHandler({ model: 'qwen2.5:7b' });

// Option 2: OpenAI
// const promptHandler = new OpenAICompatiblePromptHandler({
//   apiKey: process.env.OPENAI_API_KEY!,
//   model: 'gpt-4o-mini',
// });

// Option 3: AWS Bedrock (uses IAM credentials from env / ~/.aws)
// const promptHandler = new BedrockPromptHandler({
//   region: 'us-east-1',
//   modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
// });

// Option 4: Anthropic direct
// const promptHandler = new AnthropicPromptHandler({
//   apiKey: process.env.ANTHROPIC_API_KEY!,
//   model: 'claude-3-haiku-20240307',
// });

// Option 5: Google Gemini
// const promptHandler = new GeminiPromptHandler({
//   apiKey: process.env.GEMINI_API_KEY!,
//   model: 'gemini-1.5-flash',
// });

// ── Custom logger delegate ────────────────────────────────────────────────────
// Optional: redirect logs to your own system (Datadog, Sentry, CloudWatch etc.)
class CILogger implements LoggerDelegate {
  log(level: LogLevel, message: string): void {
    // Strip ANSI colour codes for clean CI output
    const plain = message.replace(/\x1B\[[0-9;]*m/g, '');
    if (level === 'error') process.stderr.write(plain + '\n');
    else process.stdout.write(plain + '\n');
  }
}

// Apply before tests run
logger.setDelegate(new CILogger());
logger.setLevel('debug');   // 'debug' shows generated LLM code per step

// ── Setup ─────────────────────────────────────────────────────────────────────

const reporter = new ReportBuilder('Autopilot Suite');

const pilot = new Pilot({
  driver: new DetoxDriver(),
  promptHandler,
  maxRetries: 4,
  cache: true,
});

beforeAll(async () => {
  await device.launchApp({
    newInstance: true,
    permissions: { notifications: 'YES', camera: 'NO' },
  });
});

afterAll(() => {
  reporter.writeAll('test-results');
});

beforeEach(async () => {
  await device.launchApp({ newInstance: false });
  pilot.start(expect.getState().currentTestName ?? 'test');
});

afterEach(() => {
  pilot.end();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Autopilot goal mode', () => {
  it('should navigate to the live tab as guest', async () => {
    // autopilot() asks the LLM to plan and execute steps until the goal is met.
    // The LLM decides what to tap/type/scroll at each step based on the live UI tree.
    await pilot.autopilot(
      'Continue as a guest user and navigate to the Live TV tab',
      10, // maxSteps — fails if goal not achieved within this many steps
    );
  });

  it('should complete the sign-in flow', async () => {
    await pilot.autopilot(
      'Sign in with email "user@example.com" and password "password123" and reach the home screen',
      8,
    );
  });
});

describe('Mixed mode — manual steps + autopilot', () => {
  it('should play the first VOD item', async () => {
    // Use perform() for deterministic steps you always know upfront
    await pilot.perform('tap the continue as guest button');
    await pilot.check('the home screen is visible');

    // Use autopilot() for the parts where navigation may vary
    await pilot.autopilot(
      'Find the first available VOD content item and tap play',
      6,
    );

    await pilot.check('the video player is visible');
  });
});

describe('get() — extract values from UI', () => {
  it('should read content from the screen', async () => {
    await pilot.perform('tap the continue as guest button');

    // get() returns a value from the live UI
    const firstItemTitle = await pilot.get('the title of the first content item on screen');
    console.log('First item title:', firstItemTitle);

    const tabCount = await pilot.get('how many tabs are in the bottom navigation bar');
    console.log('Tab count:', tabCount);
  });
});
