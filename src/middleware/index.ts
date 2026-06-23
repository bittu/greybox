export { TokenMiddleware } from './TokenMiddleware';
export { DebugMiddleware } from './DebugMiddleware';
export { TokenUsageCollector, estimateTokens, estimateCost, getPricing } from './TokenCounter';
export type {
  TokenUsage,
  StepTokenUsage,
  TestTokenUsage,
  SuiteTokenUsage,
  ModelPrice,
} from './TokenCounter';

/**
 * Format a SuiteTokenUsage into a human-readable summary table.
 * Printed automatically when metrics: true is set in PilotConfig.
 */
import type { SuiteTokenUsage, TestTokenUsage } from './TokenCounter';

export function formatMetricsSummary(suite: SuiteTokenUsage): string {
  const fmtCost = (n: number) => (n === 0 ? 'free (local)' : `$${n.toFixed(6)}`);

  const divider = '─'.repeat(72);

  const testRows = suite.tests
    .map((t: TestTokenUsage) => {
      const stepRows = t.steps
        .map(
          (s) =>
            `  ${s.fromCache ? '[CACHE] ' : '        '}${s.instruction.slice(0, 45).padEnd(45)} ` +
            `in:${String(s.promptTokens).padStart(5)} out:${String(s.completionTokens).padStart(4)} ` +
            `${s.exact ? '' : '~'}${fmtCost(s.estimatedCostUsd).padStart(16)} ${s.durationMs}ms`,
        )
        .join('\n');

      return [
        `  TEST: ${t.testName}`,
        stepRows,
        `  ${''.padEnd(68, '─')}`,
        `  TOTAL  in:${String(t.totals.promptTokens).padStart(5)} out:${String(t.totals.completionTokens).padStart(4)} ` +
          `${fmtCost(t.totals.estimatedCostUsd).padStart(16)}`,
      ].join('\n');
    })
    .join('\n\n');

  return [
    '',
    divider,
    `  🤖 greybox — Token & Cost Report`,
    `  Model: ${suite.model}`,
    divider,
    testRows,
    divider,
    `  SUITE TOTAL`,
    `  Prompt tokens:     ${suite.totals.promptTokens}`,
    `  Completion tokens: ${suite.totals.completionTokens}`,
    `  Total tokens:      ${suite.totals.totalTokens}`,
    `  Estimated cost:    ${fmtCost(suite.totals.estimatedCostUsd)}`,
    `  Cache hits:        ${suite.cacheHits} (saved ~${fmtCost(suite.cacheSavingsUsd)})`,
    `  Cache misses:      ${suite.cacheMisses}`,
    divider,
    '',
  ].join('\n');
}
