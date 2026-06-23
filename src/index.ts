// ── Main class ───────────────────────────────────────────────────────────────
export { Pilot } from './Pilot';

// ── Drivers ──────────────────────────────────────────────────────────────────
export { DetoxDriver } from './driver/DetoxDriver';

// ── LLM Handlers ─────────────────────────────────────────────────────────────
export { OllamaPromptHandler } from './llm/OllamaPromptHandler';
export { OpenAICompatiblePromptHandler } from './llm/OpenAICompatiblePromptHandler';
export { BedrockPromptHandler } from './llm/BedrockPromptHandler';
export { AnthropicPromptHandler } from './llm/AnthropicPromptHandler';
export { GeminiPromptHandler } from './llm/GeminiPromptHandler';
export type { BedrockConfig } from './llm/BedrockPromptHandler';
export type { AnthropicConfig } from './llm/AnthropicPromptHandler';
export type { GeminiConfig } from './llm/GeminiPromptHandler';
export type { OllamaConfig } from './llm/OllamaPromptHandler';
export type { OpenAICompatibleConfig } from './llm/OpenAICompatiblePromptHandler';

// ── Reporting ────────────────────────────────────────────────────────────────
export { ReportBuilder, TestReportBuilder } from './report';
export { writeAllureResults } from './report/allure';
export { writeHtmlReport } from './report/html';
export type { StepReport, TestReport, SuiteReport, StepStatus } from './report';

// ── Middleware ──────────────────────────────────────────────────────────────────
export {
  TokenMiddleware,
  DebugMiddleware,
  TokenUsageCollector,
  formatMetricsSummary,
  estimateTokens,
  estimateCost,
  getPricing,
} from './middleware';
export type {
  TokenUsage,
  StepTokenUsage,
  TestTokenUsage,
  SuiteTokenUsage,
  ModelPrice,
} from './middleware';
export type { MetricsConfig, DebugConfig } from './types';

// ── Errors ───────────────────────────────────────────────────────────────────
export { PilotError, CodeEvaluationError, AssertionError, ElementNotFoundError } from './errors';

// ── Logger ───────────────────────────────────────────────────────────────────
export { logger, Logger } from './logger';
export type { LogLevel, LoggerDelegate } from './logger';

// ── Tree (advanced / custom driver use) ──────────────────────────────────────
export { AccessibilityTree } from './tree/AccessibilityTree';

// ── Cache ────────────────────────────────────────────────────────────────────
export { StepCache } from './cache/StepCache';

// ── Supervisor (optional, app-specific — not exported from core) ─────────────
// If your app needs automatic overlay/alert dismissal, import directly:
// import { Supervisor } from 'greybox/src/supervisor/Supervisor';

// ── Types ────────────────────────────────────────────────────────────────────
export type {
  FrameworkDriver,
  PromptHandler,
  APICatalog,
  APICatalogCategory,
  APICatalogItem,
  PilotConfig,
  StepResult,
  TreeNode,
  CacheEntry,
} from './types';
