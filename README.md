# greybox 🤖📱

> Flake belongs in pastry. Not in CI.

> LLM-powered grey-box testing for React Native. Plain English. Detox precision. Zero flake.

[![npm](https://img.shields.io/npm/v/greybox)](https://npmjs.com/package/greybox)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

Write mobile E2E tests in plain English. No test IDs required.

```ts
await pilot.perform('tap the sign in button');
await pilot.perform('type "user@example.com" into the email field');
await pilot.check('the home screen is visible');
```

---

## Why greybox?

| | Appium + Alumnium | Wix Pilot | **greybox** |
|---|---|---|---|
| Sync engine | Appium (flaky on animations) | Detox ✅ | **Detox ✅** |
| Element resolution | XML tree ✅ | Screenshot (VLM) | **XML tree ✅** |
| LLM output | JSON action | Real JS code ✅ | **Real JS code ✅** |
| Cache | ❌ | Snapshot-keyed ✅ | **Semantic tree hash ✅** |
| Local LLM (Ollama) | ❌ | ❌ | **✅** |
| Reporting | ❌ | Basic | **JSON + JUnit XML ✅** |
| Screenshot on failure | ❌ | ✅ | **✅** |
| Autopilot goal mode | ❌ | ✅ | **✅** |

---

## How it works

```
plain English instruction
        ↓
Detox waits for app idle (grey-box sync)
        ↓
device.generateViewHierarchyXml()  ← raw accessibility tree
        ↓
AccessibilityTree (htmlparser2 + raw_id stamping)
        ↓
toPrunedString(hint, maxNodes)     ← intent-aware pruning, ~80 nodes
        ↓
StepCache.get(semanticHash, instruction) → HIT? skip LLM
        ↓ MISS
LLM (Ollama / OpenAI / Bedrock)
  prompt = tree XML + Detox API catalog + step history
  output = real Detox JS code
        ↓
CodeEvaluator.evaluate(code, { element, by, expect, waitFor, device, system })
        ↓
Detox executes: element(by.label('Sign in')).tap()
        ↓
StepReport recorded → JSON + JUnit XML written
```

---

## Installation

```bash
npm install --save-dev greybox
```

**Peer dependencies:**
```bash
npm install --save-dev detox@>=20
```

**For local LLM (recommended):**
```bash
# Install Ollama: https://ollama.ai
ollama pull qwen2.5:7b
```

---

## Quick Start

### 1. Configure Detox

Copy `example/.detoxrc.js` to your project root and update three fields:

```js
// .detoxrc.js
apps: {
  'ios.debug': {
    type: 'ios.app',
    binaryPath: 'ios/build/Build/Products/Debug-iphonesimulator/YourApp.app',
    bundleId: 'com.yourcompany.yourapp',  // ← your bundle ID
    build: 'xcodebuild -workspace ios/YourApp.xcworkspace ...'
  }
}
```

The `bundleId` is the only field greybox cares about — it tells Detox which app to launch. Everything else (LLM, tree parsing) works independently of your app's identity.

### 2. Configure Jest for TypeScript

Copy `example/jest.config.js` to your `e2e/` folder and update `testMatch` to point at your test files.

### 3. Write tests

```ts
// e2e/login.test.ts
import { Pilot, DetoxDriver, OllamaPromptHandler } from 'greybox';

const pilot = new Pilot({
  driver: new DetoxDriver(),
  promptHandler: new OllamaPromptHandler({ model: 'qwen2.5:7b' }),
});

describe('Login', () => {
  beforeEach(async () => {
    await device.launchApp({ newInstance: false });
    pilot.start(expect.getState().currentTestName ?? 'test');
  });

  afterEach(() => pilot.end());

  it('logs in successfully', async () => {
    await pilot.perform(
      'tap the sign in button',
      'type "user@example.com" into the email field',
      'type "password123" into the password field',
      'tap the submit button',
    );
    await pilot.check('the home screen is visible');
  });
});
```

### 3. Run

```bash
npx detox test -c ios.sim.debug
```

---

## API

### `new Pilot(config)`

| Option | Type | Default | Description |
|---|---|---|---|
| `driver` | `FrameworkDriver` | required | Test framework adapter |
| `promptHandler` | `PromptHandler` | required | LLM backend |
| `maxRetries` | `number` | `3` | Retry attempts per step |
| `cache` | `boolean` | `true` | Enable persistent step cache |

### `pilot.start(testName?)`
Call in `beforeEach`. Starts the supervisor and resets step history.

### `pilot.end()`
Call in `afterEach`. Stops the supervisor and finalises the test report.

### `pilot.perform(...instructions)`
Execute one or more natural language actions sequentially.

```ts
await pilot.perform('tap the live tab');
await pilot.perform('tap the first item', 'tap the play button');
```

### `pilot.check(assertion)`
Assert something about the current UI. Throws `AssertionError` on failure.

```ts
await pilot.check('the video player is visible');
await pilot.check('an error banner is not visible');
```

### `pilot.get(query)`
Return a value from the UI.

```ts
const title = await pilot.get('the title of the currently playing show');
```

### `pilot.autopilot(goal, maxSteps?)`
Goal-based mode — the LLM plans and executes steps until the goal is achieved.

```ts
await pilot.autopilot('Log in and navigate to the recordings screen', 10);
```

### `pilot.writeReports(outputDir?)`
Write `greybox-report.json` and `greybox-junit.xml` to `outputDir` (default: `test-results/`).

---

## LLM Handlers

### Ollama (local, recommended for development)

```ts
import { OllamaPromptHandler } from 'greybox';

new OllamaPromptHandler({
  model: 'qwen2.5:7b',      // or qwen2.5:14b for better accuracy
  baseUrl: 'http://localhost:11434',
});
```

### OpenAI / any OpenAI-compatible API

```ts
import { OpenAICompatiblePromptHandler } from 'greybox';

new OpenAICompatiblePromptHandler({
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'gpt-4o-mini',
  // For AWS Bedrock via LiteLLM proxy:
  // baseUrl: 'https://your-litellm-gateway/v1',
});
```

### Custom handler

```ts
import { PromptHandler } from 'greybox';

class MyHandler implements PromptHandler {
  async runPrompt(prompt: string): Promise<string> {
    // Call any LLM API
    return response.text;
  }
}
```

---

## Reporting

```ts
import { ReportBuilder } from 'greybox';

const reporter = new ReportBuilder('My App E2E');

afterAll(() => {
  reporter.writeJson('test-results');   // → test-results/greybox-report.json
  reporter.writeJUnit('test-results'); // → test-results/greybox-junit.xml
});
```

The JUnit XML is compatible with:
- GitHub Actions test summary
- CircleCI test insights
- Allure Framework (via allure-jest)
- Azure DevOps pipelines

---

## Caching

The step cache is stored in `.greybox-cache.json` in your project root.

- **Key**: SHA-256 of semantic tree content (id/label/text/type — not positions) + instruction
- **TTL**: 7 days (configurable via `StepCache`)
- **Cross-run**: Yes — same screen + same instruction = cache hit, no LLM call
- **Team sharing**: Commit the file to version control to share cache across CI and teammates

```ts
// Disable cache for a specific pilot instance
new Pilot({ driver, promptHandler, cache: false });
```

---

## Custom Logger

```ts
import { logger, LoggerDelegate, LogLevel } from 'greybox';

class DatadogLogger implements LoggerDelegate {
  log(level: LogLevel, message: string): void {
    // Send to Datadog, Sentry, etc.
  }
}

logger.setDelegate(new DatadogLogger());
logger.setLevel('debug'); // 'debug' | 'info' | 'warn' | 'error'
```

---

## Handling system dialogs and overlays

The framework does **not** auto-dismiss native alerts or OS permission dialogs. This is intentional — in many apps these are legitimate test steps, not noise to suppress.

Handle them explicitly in your test:

```ts
// iOS system permission dialog
await pilot.perform('tap Allow on the location permission dialog');

// Native UIAlertController
await pilot.perform('tap the Log In button on the alert');

// Google Cast intro overlay
await pilot.perform('tap the OK button on the Cast intro screen');
```

The LLM uses `system.element(by.system.label('Allow'))` from the Detox API catalog for iOS system dialogs that are outside the app hierarchy, and `element(by.label(...)).atIndex(0)` for in-hierarchy alerts.

If your app shows the same overlay on every test run and you want to suppress it automatically, implement it as a `beforeEach`:

```ts
beforeEach(async () => {
  await device.launchApp({ newInstance: false });
  pilot.start(expect.getState().currentTestName ?? 'test');
  // Dismiss the Cast intro if present — app-specific, not part of the framework
  try {
    await element(by.label('OK')).atIndex(0).tap();
  } catch { /* not present, continue */ }
});
```

---

## Contributing a new driver

Implement `FrameworkDriver`:

```ts
import { FrameworkDriver, APICatalog } from 'greybox';

class AppiumDriver implements FrameworkDriver {
  async captureViewHierarchy(): Promise<string> {
    return driver.getPageSource();
  }

  async executeCode(code: string, context: Record<string, unknown>): Promise<unknown> {
    // eval code with your framework globals
  }

  get apiCatalog(): APICatalog {
    return { name: 'Appium', description: '...', context: {}, categories: [] };
  }
}
```

---

## Architecture

```
greybox/src/
  Pilot.ts                    Main orchestrator — perform/check/get/autopilot
  types.ts                    FrameworkDriver, PromptHandler, APICatalog contracts
  tree/
    AccessibilityTree.ts      htmlparser2 + raw_id stamping + scopeToArea pruning
  llm/
    PromptBuilder.ts          Builds LLM prompt from tree + API catalog + history
    CodeEvaluator.ts          eval()s generated JS with framework globals injected
    OllamaPromptHandler.ts    Local Ollama backend
    OpenAICompatiblePromptHandler.ts  OpenAI / Bedrock / Groq etc.
    BedrockPromptHandler.ts   AWS Bedrock native SDK (Claude, Nova, Llama, Mistral)
    AnthropicPromptHandler.ts Anthropic direct SDK
    GeminiPromptHandler.ts    Google Gemini REST
  middleware/
    TokenMiddleware.ts        Intercepts runPrompt(), counts tokens, estimates cost
    DebugMiddleware.ts        Logs full prompt/response behind debug config flag
    TokenCounter.ts           Pricing table, aggregator, per-step/test/suite usage
  cache/
    StepCache.ts              Semantic tree hash → code, persisted to disk
  driver/
    DetoxDriver.ts            Detox implementation of FrameworkDriver
  report/
    index.ts                  StepReport, TestReport, JUnit XML serialiser
    allure.ts                 Allure result file writer
    html.ts                   Self-contained HTML report
  errors/
    index.ts                  PilotError, AssertionError, ElementNotFoundError
  logger/
    index.ts                  Singleton logger, chalk output, pluggable delegate
  retry/
    index.ts                  Configurable retry with backoff
```

---

## Inspired by

- [alumnium-hq/alumnium](https://github.com/alumnium-hq/alumnium) — XML tree parsing approach, `raw_id` stamping, platform normalisation
- [wix-incubator/pilot](https://github.com/wix-incubator/pilot) — LLM code generation pattern, API catalog, logger architecture, autopilot mode

---

## License

MIT
