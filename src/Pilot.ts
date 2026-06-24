import type { PilotConfig, StepResult } from './types';
import { AccessibilityTree } from './tree/AccessibilityTree';
import { buildPrompt, extractCode } from './llm/PromptBuilder';
import { StepCache } from './cache/StepCache';
import { logger } from './logger';
import { retry } from './retry';
import type { TestReportBuilder } from './report';
import { ReportBuilder } from './report';
import { AssertionError, CodeEvaluationError, ElementNotFoundError, PilotError } from './errors';
import {
  TokenMiddleware,
  DebugMiddleware,
  TokenUsageCollector,
  formatMetricsSummary,
} from './middleware';
import type { SuiteTokenUsage } from './middleware';

export class Pilot {
  private config: Required<PilotConfig>;
  private history: StepResult[] = [];
  private cache: StepCache;
  private running = false;
  private reportBuilder: ReportBuilder;
  private currentTestReport: TestReportBuilder | null = null;
  private tokenCollector: TokenUsageCollector | null = null;

  constructor(config: PilotConfig) {
    this.config = {
      maxRetries: 3,
      cache: true,
      metrics: undefined as any,
      debug: undefined as any,
      ...config,
    };

    // ── Build middleware chain: debug → token → real handler ─────────────────
    // Order matters: debug wraps outermost so it sees exactly what goes to LLM.
    let handler = this.config.promptHandler;

    if (config.metrics?.enabled) {
      this.tokenCollector = new TokenUsageCollector(config.metrics.model);
      handler = new TokenMiddleware(handler, {
        model: config.metrics.model,
        collector: this.tokenCollector,
      });
    }

    if (config.debug?.enabled) {
      logger.setLevel('debug');
      handler = new DebugMiddleware(handler, {
        logPrompt: config.debug.logPrompt,
        logResponse: config.debug.logResponse,
        truncateAt: config.debug.truncateAt,
        logFile: config.debug.logFile,
      });
    }

    this.config.promptHandler = handler;
    this.cache = new StepCache(this.config.cache);
    this.reportBuilder = new ReportBuilder();
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  /** Call in beforeEach */
  start(testName = 'unnamed'): void {
    if (this.running) throw new PilotError('Pilot is already running. Call end() first.');
    this.running = true;
    this.history = [];
    this.currentTestReport = this.reportBuilder.beginTest(testName);
    this.tokenCollector?.beginTest(testName);
    logger.labeled('STEP').info(`▶ ${testName}`);
  }

  /** Call in afterEach */
  end(): void {
    this.running = false;
    this.currentTestReport?.end('passed');
    this.currentTestReport = null;
    this.tokenCollector?.endTest();

    if (this.config.metrics?.enabled && this.config.metrics.printSummary !== false) {
      const usage = this.tokenCollector?.getCurrentTestUsage();
      if (usage) {
        const fmtCost = (n: number) => (n === 0 ? 'free' : `$${n.toFixed(6)}`);
        logger
          .labeled('METRICS')
          .info(
            `Tokens: ${usage.totals.totalTokens} (in:${usage.totals.promptTokens} out:${usage.totals.completionTokens}) | Cost: ${fmtCost(usage.totals.estimatedCostUsd)}`,
          );
      }
    }
  }

  /** Returns the accumulated token/cost metrics for the full suite. */
  getMetrics(): SuiteTokenUsage | null {
    return this.tokenCollector?.getSuiteUsage() ?? null;
  }

  /** Write reports. Call in afterAll. */
  writeReports(outputDir = 'test-results'): void {
    const jsonFile = this.reportBuilder.writeJson(outputDir);
    const junitFile = this.reportBuilder.writeJUnit(outputDir);
    logger.labeled('SUCCESS').info(`Reports written → ${jsonFile}, ${junitFile}`);

    if (this.config.metrics?.enabled && this.tokenCollector) {
      const suite = this.tokenCollector.getSuiteUsage();
      if (this.config.metrics.printSummary !== false) {
        process.stdout.write(formatMetricsSummary(suite));
      }
      // Also embed metrics in the JSON report
      const fs = require('fs');
      const path = require('path');
      const metricsFile = path.join(outputDir, 'greybox-metrics.json');
      fs.writeFileSync(metricsFile, JSON.stringify(suite, null, 2));
      logger.labeled('METRICS').info(`Metrics written → ${metricsFile}`);
    }
  }

  // ── Public test API ─────────────────────────────────────────────────────────

  /**
   * Perform one or more instructions in plain English.
   * @example
   * await pilot.perform('tap the sign in button');
   * await pilot.perform('type "user@example.com" into the email field', 'tap submit');
   */
  async perform(...instructions: string[]): Promise<void> {
    this.assertRunning();
    for (const instruction of instructions) {
      await this.executeStep(instruction);
    }
  }

  /**
   * Assert something about the current UI. Throws AssertionError on failure.
   * @example
   * await pilot.check('the home screen is visible');
   */
  async check(assertion: string): Promise<void> {
    this.assertRunning();
    await this.executeStep(`Assert/verify: ${assertion}`, true);
  }

  /**
   * Get a value from the current UI.
   * @example
   * const title = await pilot.get('the title of the first item');
   */
  async get(query: string): Promise<unknown> {
    this.assertRunning();
    return this.executeStep(`Return the value of: ${query}`);
  }

  /**
   * Goal-based autopilot — the LLM plans and executes steps until the goal
   * is achieved or maxSteps is reached. Modelled on Pilot's autopilot().
   * @example
   * await pilot.autopilot('Log in and navigate to the Live tab');
   */
  async autopilot(goal: string, maxSteps = 10): Promise<void> {
    this.assertRunning();
    logger.labeled('STEP').info(`🤖 Autopilot goal: ${goal}`);

    for (let step = 1; step <= maxSteps; step++) {
      const xml = await this.config.driver.captureViewHierarchy();
      const tree = new AccessibilityTree(xml);
      const pruned = tree.toPrunedString(goal, 80);

      const planPrompt = `
You are a mobile test automation agent. Your goal is: "${goal}"

Current UI tree:
\`\`\`xml
${pruned}
\`\`\`

Previous steps taken:
${this.history.map((h, i) => `${i + 1}. ${h.instruction}`).join('\n') || 'None'}

Respond with a JSON object:
{
  "goalAchieved": true|false,
  "nextInstruction": "plain English instruction for the next single action, or empty string if done"
}
`.trim();

      const raw = await this.config.promptHandler.runPrompt(planPrompt);
      const json = JSON.parse(raw.replace(/```json|```/g, '').trim()) as {
        goalAchieved: boolean;
        nextInstruction: string;
      };

      if (json.goalAchieved || !json.nextInstruction) {
        logger.labeled('SUCCESS').info(`Autopilot goal achieved in ${step - 1} step(s)`);
        return;
      }

      logger.labeled('STEP').info(`[${step}/${maxSteps}] ${json.nextInstruction}`);
      await this.executeStep(json.nextInstruction);
    }

    throw new PilotError(`Autopilot: goal not achieved within ${maxSteps} steps`);
  }

  // ── Internal execution ──────────────────────────────────────────────────────

  private assertRunning(): void {
    if (!this.running) throw new PilotError('Pilot is not running. Call start() first.');
  }

  private async executeStep(instruction: string, isAssertion = false): Promise<unknown> {
    const stepStart = Date.now();
    const progress = logger.progress('STEP', instruction);

    let code = '';
    let fromCache = false;
    let result: unknown;

    try {
      ({ code, fromCache, result } = await retry(() => this.resolveAndRun(instruction), {
        maxAttempts: this.config.maxRetries,
        backOffMs: 600,
        shouldRetry: (err) =>
          !(err instanceof AssertionError) && !(err instanceof ElementNotFoundError),
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        onRetry: async () => {
          // Scroll before retry in case element is off-screen
          try {
            await this.config.driver.executeCode(
              `await element(by.type('UIScrollView')).atIndex(0).scroll(300, 'down');`,
              {},
            );
          } catch {
            /* non-fatal */
          }
        },
      }));

      if (isAssertion && result === false) {
        throw new AssertionError(`Assertion failed: "${instruction}"`);
      }

      this.history.push({ instruction, code, result });
      progress.succeed(
        `${instruction} (${Date.now() - stepStart}ms${fromCache ? ', cached' : ''})`,
      );

      this.currentTestReport?.recordStep({
        instruction,
        code,
        fromCache,
        status: 'passed',
        durationMs: Date.now() - stepStart,
      });

      // Small settle window after the action — Detox sync drains animation/timers
      // before the next captureViewHierarchy call in the following step.
      await new Promise((r) => setTimeout(r, 200));
      return result;
    } catch (err) {
      const error = err as Error;
      progress.fail(`${instruction} — ${error.message}`);

      // Screenshot on failure
      const screenshotPath = await this.captureFailureScreenshot(instruction);

      this.currentTestReport?.recordStep({
        instruction,
        code,
        fromCache,
        status: 'failed',
        durationMs: Date.now() - stepStart,
        error: error.message,
        screenshotPath,
      });
      this.currentTestReport?.end('failed');
      this.currentTestReport = null;

      throw err;
    }
  }

  private async resolveAndRun(
    instruction: string,
  ): Promise<{ code: string; fromCache: boolean; result: unknown }> {
    const xml = await this.config.driver.captureViewHierarchy();
    const tree = new AccessibilityTree(xml);
    const pruned = tree.toPrunedString(instruction, 80);
    const hash = this.cache.treeHash(pruned);

    let code = this.cache.get(hash, instruction);
    const fromCache = !!code;

    this.tokenCollector?.setCurrentStep(instruction, fromCache);

    if (!code) {
      const prompt = buildPrompt(instruction, pruned, this.config.driver.apiCatalog, this.history);
      const raw = await this.config.promptHandler.runPrompt(prompt);
      code = extractCode(raw);

      if (!code || code.includes("throw new Error('Element not found")) {
        throw new ElementNotFoundError(instruction, code);
      }

      this.cache.set(hash, instruction, code);
      logger.logCode(code);
    } else {
      logger.labeled('CACHE').info(`Hit for: "${instruction}"`);
    }

    let result: unknown;
    try {
      result = await this.config.driver.executeCode(code, {});
    } catch (execErr) {
      throw new CodeEvaluationError(
        `Code execution failed for: "${instruction}"`,
        code,
        execErr as Error,
      );
    }

    console.log('[Pilot][resolveAndRun]', code, fromCache, result);

    return { code, fromCache, result };
  }

  private async captureFailureScreenshot(instruction: string): Promise<string | undefined> {
    try {
      const sanitised = instruction.replace(/[^a-z0-9]/gi, '_').slice(0, 40);
      const result = (await this.config.driver.executeCode(
        `return await device.takeScreenshot('failure_${sanitised}_${Date.now()}');`,
        {},
      )) as string | undefined;
      if (result) logger.labeled('WARN').warn(`Screenshot saved: ${result}`);
      return result ?? undefined;
    } catch {
      return undefined;
    }
  }
}
