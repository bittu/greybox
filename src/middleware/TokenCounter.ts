// ── Token estimation ──────────────────────────────────────────────────────────
// Uses the same rule-of-thumb as tiktoken cl100k: ~4 chars per token.
// Good enough for cost estimation; not byte-perfect.
export const estimateTokens = (text: string): number => Math.ceil(text.length / 4);

// ── Pricing table ─────────────────────────────────────────────────────────────
// Prices in USD per 1 000 tokens (input / output).
// Update as providers change their pricing.
export interface ModelPrice {
  inputPer1k: number;
  outputPer1k: number;
}

const PRICING: Record<string, ModelPrice> = {
  // OpenAI
  'gpt-4o': { inputPer1k: 0.005, outputPer1k: 0.015 },
  'gpt-4o-mini': { inputPer1k: 0.00015, outputPer1k: 0.0006 },
  'gpt-4-turbo': { inputPer1k: 0.01, outputPer1k: 0.03 },
  'gpt-3.5-turbo': { inputPer1k: 0.0005, outputPer1k: 0.0015 },

  // Anthropic
  'claude-3-haiku-20240307': { inputPer1k: 0.00025, outputPer1k: 0.00125 },
  'claude-3-5-sonnet-20241022': { inputPer1k: 0.003, outputPer1k: 0.015 },
  'claude-3-opus-20240229': { inputPer1k: 0.015, outputPer1k: 0.075 },

  // AWS Bedrock (Anthropic on Bedrock — slightly different pricing)
  'anthropic.claude-3-haiku-20240307-v1:0': { inputPer1k: 0.00025, outputPer1k: 0.00125 },
  'anthropic.claude-3-5-sonnet-20241022-v2:0': { inputPer1k: 0.003, outputPer1k: 0.015 },

  // AWS Bedrock (Amazon Nova)
  'amazon.nova-lite-v1:0': { inputPer1k: 0.00006, outputPer1k: 0.00024 },
  'amazon.nova-micro-v1:0': { inputPer1k: 0.000035, outputPer1k: 0.00014 },
  'amazon.nova-pro-v1:0': { inputPer1k: 0.0008, outputPer1k: 0.0032 },

  // Google Gemini
  'gemini-1.5-flash': { inputPer1k: 0.000075, outputPer1k: 0.0003 },
  'gemini-1.5-pro': { inputPer1k: 0.00125, outputPer1k: 0.005 },
  'gemini-2.0-flash': { inputPer1k: 0.0001, outputPer1k: 0.0004 },

  // Groq (OpenAI-compatible)
  'llama3-70b-8192': { inputPer1k: 0.00059, outputPer1k: 0.00079 },
  'mixtral-8x7b-32768': { inputPer1k: 0.00027, outputPer1k: 0.00027 },

  // Ollama / local — zero cost
  'qwen2.5:7b': { inputPer1k: 0, outputPer1k: 0 },
  'qwen2.5:14b': { inputPer1k: 0, outputPer1k: 0 },
  'llama3:8b': { inputPer1k: 0, outputPer1k: 0 },
  'llama3:70b': { inputPer1k: 0, outputPer1k: 0 },
};

export const getPricing = (model: string): ModelPrice => {
  // Exact match first
  if (PRICING[model]) return PRICING[model];
  // Prefix match for Bedrock model ARNs / versioned names
  const key = Object.keys(PRICING).find((k) => model.startsWith(k));
  return key ? PRICING[key] : { inputPer1k: 0, outputPer1k: 0 };
};

export const estimateCost = (model: string, inputTokens: number, outputTokens: number): number => {
  const price = getPricing(model);
  return (inputTokens / 1000) * price.inputPer1k + (outputTokens / 1000) * price.outputPer1k;
};

// ── Token usage records ───────────────────────────────────────────────────────

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  /** true when count came from the API response, false when estimated */
  exact: boolean;
}

export interface StepTokenUsage extends TokenUsage {
  instruction: string;
  fromCache: boolean;
  durationMs: number;
}

export interface TestTokenUsage {
  testName: string;
  steps: StepTokenUsage[];
  totals: TokenUsage;
}

export interface SuiteTokenUsage {
  model: string;
  tests: TestTokenUsage[];
  totals: TokenUsage;
  cacheHits: number;
  cacheMisses: number;
  cacheSavingsUsd: number; // estimated savings from cache hits
}

// ── Aggregator ────────────────────────────────────────────────────────────────

export class TokenUsageCollector {
  private model: string;
  private tests: TestTokenUsage[] = [];
  private currentTest: TestTokenUsage | null = null;
  private currentStepInstruction = '';
  private currentStepFromCache = false;
  private cacheHits = 0;
  private cacheMisses = 0;

  constructor(model: string) {
    this.model = model;
  }

  beginTest(testName: string): void {
    this.currentTest = { testName, steps: [], totals: zero() };
  }

  /** Called by Pilot before each LLM call with context about the current step */
  setCurrentStep(instruction: string, fromCache: boolean): void {
    this.currentStepInstruction = instruction;
    this.currentStepFromCache = fromCache;
  }

  /** Called by TokenMiddleware after each runPrompt() completes */
  recordStepTokens(usage: TokenUsage & { durationMs: number }): void {
    if (!this.currentTest) return;
    const step: StepTokenUsage = {
      ...usage,
      instruction: this.currentStepInstruction,
      fromCache: this.currentStepFromCache,
    };
    this.currentTest.steps.push(step);
    this.currentTest.totals = add(this.currentTest.totals, step);
    if (this.currentStepFromCache) this.cacheHits++;
    else this.cacheMisses++;
  }

  recordStep(step: StepTokenUsage): void {
    if (!this.currentTest) return;
    this.currentTest.steps.push(step);
    this.currentTest.totals = add(this.currentTest.totals, step);
    if (step.fromCache) this.cacheHits++;
    else this.cacheMisses++;
  }

  endTest(): void {
    if (!this.currentTest) return;
    this.tests.push(this.currentTest);
    this.currentTest = null;
  }

  getSuiteUsage(): SuiteTokenUsage {
    const totals = this.tests.reduce((acc, t) => add(acc, t.totals), zero());
    const avgCostPerCall = this.cacheMisses > 0 ? totals.estimatedCostUsd / this.cacheMisses : 0;
    const cacheSavingsUsd = avgCostPerCall * this.cacheHits;

    return {
      model: this.model,
      tests: this.tests,
      totals,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      cacheSavingsUsd,
    };
  }

  getCurrentTestUsage(): TestTokenUsage | null {
    return this.currentTest;
  }
}

const zero = (): TokenUsage => ({
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
  estimatedCostUsd: 0,
  exact: true,
});

const add = (a: TokenUsage, b: TokenUsage): TokenUsage => ({
  promptTokens: a.promptTokens + b.promptTokens,
  completionTokens: a.completionTokens + b.completionTokens,
  totalTokens: a.totalTokens + b.totalTokens,
  estimatedCostUsd: a.estimatedCostUsd + b.estimatedCostUsd,
  exact: a.exact && b.exact,
});
