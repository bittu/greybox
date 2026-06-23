import {
  estimateTokens,
  estimateCost,
  getPricing,
  TokenUsageCollector,
} from '../src/middleware/TokenCounter';

describe('TokenCounter', () => {
  it('estimateTokens approximates at ~4 chars per token', () => {
    expect(estimateTokens('hello world')).toBe(3); // 11 / 4 = 2.75, ceil = 3
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens('a'.repeat(100))).toBe(25);
  });

  it('getPricing returns correct pricing for known models', () => {
    const price = getPricing('gpt-4o-mini');
    expect(price.inputPer1k).toBe(0.00015);
    expect(price.outputPer1k).toBe(0.0006);
  });

  it('getPricing returns zero for Ollama models', () => {
    const price = getPricing('qwen2.5:7b');
    expect(price.inputPer1k).toBe(0);
    expect(price.outputPer1k).toBe(0);
  });

  it('getPricing returns zero for unknown models', () => {
    const price = getPricing('unknown-model-xyz');
    expect(price.inputPer1k).toBe(0);
    expect(price.outputPer1k).toBe(0);
  });

  it('estimateCost calculates correctly', () => {
    const cost = estimateCost('gpt-4o-mini', 1000, 500);
    // (1000/1000)*0.00015 + (500/1000)*0.0006 = 0.00015 + 0.0003 = 0.00045
    expect(cost).toBeCloseTo(0.00045, 6);
  });

  it('estimateCost returns 0 for local models', () => {
    expect(estimateCost('qwen2.5:7b', 5000, 2000)).toBe(0);
  });
});

describe('TokenUsageCollector', () => {
  it('aggregates tokens across steps and tests', () => {
    const collector = new TokenUsageCollector('gpt-4o-mini');

    collector.beginTest('test 1');
    collector.setCurrentStep('tap button', false);
    collector.recordStepTokens({
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
      estimatedCostUsd: 0.001,
      exact: true,
      durationMs: 200,
    });
    collector.endTest();

    const suite = collector.getSuiteUsage();
    expect(suite.model).toBe('gpt-4o-mini');
    expect(suite.tests).toHaveLength(1);
    expect(suite.totals.promptTokens).toBe(100);
    expect(suite.totals.completionTokens).toBe(50);
    expect(suite.cacheMisses).toBe(1);
    expect(suite.cacheHits).toBe(0);
  });

  it('tracks cache hits vs misses', () => {
    const collector = new TokenUsageCollector('qwen2.5:7b');

    collector.beginTest('test cache');
    collector.setCurrentStep('step 1', false);
    collector.recordStepTokens({
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
      estimatedCostUsd: 0,
      exact: true,
      durationMs: 100,
    });
    collector.setCurrentStep('step 2', true);
    collector.recordStepTokens({
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      estimatedCostUsd: 0,
      exact: true,
      durationMs: 5,
    });
    collector.endTest();

    const suite = collector.getSuiteUsage();
    expect(suite.cacheHits).toBe(1);
    expect(suite.cacheMisses).toBe(1);
  });
});
