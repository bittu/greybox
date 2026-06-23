// ── Driver contract ──────────────────────────────────────────────────────────

/**
 * A FrameworkDriver abstracts the underlying test automation framework.
 * Implement this to plug in Detox, Appium, Playwright etc.
 */
export interface FrameworkDriver {
  /** Capture the raw XML accessibility tree from the running app */
  captureViewHierarchy(): Promise<string>;

  /** Execute a JS code string in the context of the framework's globals */
  executeCode(code: string, context: Record<string, unknown>): Promise<unknown>;

  /** The full set of APIs exposed to the LLM for code generation */
  readonly apiCatalog: APICatalog;
}

// ── API Catalog (from Pilot's pattern) ───────────────────────────────────────

export interface APICatalog {
  name: string;
  description: string;
  /** Framework globals injected into eval context: element, by, expect, device … */
  context: Record<string, unknown>;
  categories: APICatalogCategory[];
}

export interface APICatalogCategory {
  title: string;
  items: APICatalogItem[];
}

export interface APICatalogItem {
  signature: string;
  description: string;
  example: string;
  guidelines?: string[];
}

// ── LLM Handler contract ─────────────────────────────────────────────────────

/**
 * A PromptHandler abstracts the LLM backend.
 * Implement this for Ollama, OpenAI, Bedrock, etc.
 */
export interface PromptHandler {
  /** Send a prompt and return the LLM's text response */
  runPrompt(prompt: string): Promise<string>;
}

// ── Tree types (from Alumnium's pattern) ─────────────────────────────────────

export interface TreeNode {
  rawId: number;
  tag: string;
  attrs: Record<string, string>;
  children: TreeNode[];
}

// ── Cache ────────────────────────────────────────────────────────────────────

export interface CacheEntry {
  treeHash: string;
  instruction: string;
  code: string;
  timestamp: number;
}

// ── Pilot config ─────────────────────────────────────────────────────────────

export interface DebugConfig {
  /** Enable verbose LLM prompt/response logging. Default: false */
  enabled: boolean;
  /** Log full prompt text. Default: true */
  logPrompt?: boolean;
  /** Log full LLM response. Default: true */
  logResponse?: boolean;
  /** Truncate prompt/response at N chars in logs. 0 = no limit. Default: 2000 */
  truncateAt?: number;
  /** Also write debug logs to this file path */
  logFile?: string;
}

export interface MetricsConfig {
  /** Enable token counting and cost estimation. Default: false */
  enabled: boolean;
  /**
   * The model name used for cost lookup.
   * Must match a key in the pricing table (or be a local Ollama model for free).
   * e.g. 'gpt-4o-mini', 'claude-3-haiku-20240307', 'qwen2.5:7b'
   */
  model: string;
  /** Print the metrics summary table after writeReports(). Default: true */
  printSummary?: boolean;
}

export interface PilotConfig {
  driver: FrameworkDriver;
  promptHandler: PromptHandler;
  /** Max retries per step. Default: 3 */
  maxRetries?: number;
  /** Enable persistent cache. Default: true */
  cache?: boolean;
  /** Enable token/cost metrics middleware */
  metrics?: MetricsConfig;
  /** Enable debug logging middleware */
  debug?: DebugConfig;
}

export interface StepResult {
  instruction: string;
  code: string;
  result: unknown;
  fromCache?: boolean;
}
