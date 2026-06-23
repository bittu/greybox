import { Pilot } from '../src/Pilot';
import type { FrameworkDriver, APICatalog, PromptHandler } from '../src/types';

// ── Mock Driver ──────────────────────────────────────────────────────────────

const MOCK_HIERARCHY = `
<XCUIElementTypeWindow>
  <XCUIElementTypeButton name="loginBtn" label="Log In" enabled="true" visible="true" x="100" y="300" width="200" height="44"/>
  <XCUIElementTypeStaticText name="title" label="Welcome" text="Welcome" enabled="true" visible="true" x="50" y="50" width="300" height="30"/>
</XCUIElementTypeWindow>
`;

class MockDriver implements FrameworkDriver {
  public executedCodes: string[] = [];
  public hierarchyXml = MOCK_HIERARCHY;

  // eslint-disable-next-line @typescript-eslint/require-await
  async captureViewHierarchy(): Promise<string> {
    return this.hierarchyXml;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async executeCode(code: string, _context: Record<string, unknown>): Promise<unknown> {
    this.executedCodes.push(code);
    return undefined;
  }

  get apiCatalog(): APICatalog {
    return {
      name: 'MockFramework',
      description: 'Mock test framework',
      context: {},
      categories: [
        {
          title: 'Actions',
          items: [
            {
              signature: 'tap()',
              description: 'Tap',
              example: "await element(by.id('x')).tap();",
            },
          ],
        },
      ],
    };
  }
}

// ── Mock LLM Handler ─────────────────────────────────────────────────────────

class MockPromptHandler implements PromptHandler {
  public prompts: string[] = [];
  public responses: string[] = [];
  private callIndex = 0;

  constructor(responses: string[]) {
    this.responses = responses;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async runPrompt(prompt: string): Promise<string> {
    this.prompts.push(prompt);
    return this.responses[this.callIndex++] || '```js\n// no-op\n```';
  }
}

// ── Suppress fs for cache/reports ────────────────────────────────────────────
jest.mock('fs', () => ({
  existsSync: () => false,
  readFileSync: () => '{}',
  writeFileSync: () => {},
  mkdirSync: () => {},
}));

describe('Pilot (integration with mocks)', () => {
  it('perform() sends prompt to LLM and executes returned code', async () => {
    const driver = new MockDriver();
    const handler = new MockPromptHandler(["```js\nawait element(by.id('loginBtn')).tap();\n```"]);

    const pilot = new Pilot({ driver, promptHandler: handler, cache: false });
    pilot.start('test-perform');
    await pilot.perform('tap the log in button');
    pilot.end();

    expect(handler.prompts.length).toBe(1);
    expect(handler.prompts[0]).toContain('tap the log in button');
    expect(driver.executedCodes[0]).toBe("await element(by.id('loginBtn')).tap();");
  });

  it('perform() handles multiple instructions sequentially', async () => {
    const driver = new MockDriver();
    const handler = new MockPromptHandler([
      "```js\nawait element(by.id('a')).tap();\n```",
      "```js\nawait element(by.id('b')).tap();\n```",
    ]);

    const pilot = new Pilot({ driver, promptHandler: handler, cache: false });
    pilot.start('test-multi');
    await pilot.perform('first action', 'second action');
    pilot.end();

    expect(driver.executedCodes).toHaveLength(2);
  });

  it('check() sends assertion-style prompt', async () => {
    const driver = new MockDriver();
    const handler = new MockPromptHandler([
      "```js\nawait expect(element(by.id('title'))).toBeVisible();\n```",
    ]);

    const pilot = new Pilot({ driver, promptHandler: handler, cache: false });
    pilot.start('test-check');
    await pilot.check('the welcome title is visible');
    pilot.end();

    expect(handler.prompts[0]).toContain('Assert/verify');
    expect(handler.prompts[0]).toContain('welcome title is visible');
  });

  it('throws PilotError when not started', async () => {
    const driver = new MockDriver();
    const handler = new MockPromptHandler([]);
    const pilot = new Pilot({ driver, promptHandler: handler });

    await expect(pilot.perform('tap')).rejects.toThrow('not running');
  });

  it('throws PilotError on double start', () => {
    const driver = new MockDriver();
    const handler = new MockPromptHandler([]);
    const pilot = new Pilot({ driver, promptHandler: handler });

    pilot.start('test1');
    expect(() => pilot.start('test2')).toThrow('already running');
    pilot.end();
  });

  it('caches results and skips LLM on second call with same tree+instruction', async () => {
    const driver = new MockDriver();
    const handler = new MockPromptHandler([
      "```js\nawait element(by.id('loginBtn')).tap();\n```",
      '```js\nshould not reach here\n```',
    ]);

    const pilot = new Pilot({ driver, promptHandler: handler, cache: true });

    pilot.start('test-cache-1');
    await pilot.perform('tap the log in button');
    pilot.end();

    pilot.start('test-cache-2');
    await pilot.perform('tap the log in button');
    pilot.end();

    // LLM should only have been called once — second time is a cache hit
    expect(handler.prompts.length).toBe(1);
    expect(driver.executedCodes.length).toBe(2); // code executed both times
  });

  it('get() returns a value from code execution', async () => {
    const driver = new MockDriver();
    // eslint-disable-next-line @typescript-eslint/require-await
    driver.executeCode = async (_code: string) => 'Hello World';

    const handler = new MockPromptHandler(["```js\nreturn 'Hello World';\n```"]);

    const pilot = new Pilot({ driver, promptHandler: handler, cache: false });
    pilot.start('test-get');
    const value = await pilot.get('the title text');
    pilot.end();

    expect(value).toBe('Hello World');
  });
});
