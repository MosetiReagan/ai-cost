import { describe, it, expect } from 'vitest';
import { calculateCost, getModelPricing, normalizeModelName } from '../src/index.js';

describe('Pricing Engine', () => {
  it('calculates cost for GPT-4o correctly', () => {
    // GPT-4o: $2.50 / 1M input, $10.00 / 1M output
    // 1,000 input tokens = $0.0025
    // 500 output tokens = $0.0050
    // Total = $0.0075
    const res = calculateCost({
      provider: 'openai',
      model: 'gpt-4o',
      inputTokens: 1000,
      outputTokens: 500
    });

    expect(res.pricingFound).toBe(true);
    expect(res.pricingSource).toBe('official');
    expect(res.inputCost).toBe(0.0025);
    expect(res.outputCost).toBe(0.005);
    expect(res.totalCost).toBe(0.0075);
  });

  it('calculates prompt caching discount for Claude 3.5 Sonnet', () => {
    // Claude 3.5 Sonnet: $3.00 / 1M input, $0.30 / 1M cached input, $15.00 / 1M output
    // 10,000 total input tokens of which 8,000 are cached
    // 2,000 non-cached = 2000/1M * 3.00 = $0.006
    // 8,000 cached = 8000/1M * 0.30 = $0.0024
    // 1,000 output = 1000/1M * 15.00 = $0.015
    // Total = 0.006 + 0.0024 + 0.015 = $0.0234
    const res = calculateCost({
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-latest',
      inputTokens: 10000,
      cachedTokens: 8000,
      outputTokens: 1000
    });

    expect(res.pricingFound).toBe(true);
    expect(res.inputCost).toBe(0.006);
    expect(res.cachedCost).toBe(0.0024);
    expect(res.outputCost).toBe(0.015);
    expect(res.totalCost).toBe(0.0234);
  });

  it('calculates Gemini 1.5 Flash correctly', () => {
    // Gemini 1.5 Flash: $0.075 / 1M input, $0.30 / 1M output
    // 100,000 input tokens = $0.0075
    // 10,000 output tokens = $0.003
    // Total = $0.0105
    const res = calculateCost({
      provider: 'gemini',
      model: 'gemini-1.5-flash',
      inputTokens: 100000,
      outputTokens: 10000
    });

    expect(res.pricingFound).toBe(true);
    expect(res.totalCost).toBe(0.0105);
  });

  it('calculates local Ollama models as $0.00', () => {
    const res = calculateCost({
      provider: 'ollama',
      model: 'llama3.3',
      inputTokens: 5000,
      outputTokens: 2000
    });

    expect(res.pricingSource).toBe('official');
    expect(res.totalCost).toBe(0);
  });

  it('honors custom model pricing override', () => {
    const custom = [
      {
        provider: 'custom-corp',
        model: 'fine-tuned-model',
        displayName: 'Custom Fine-Tuned Model',
        inputCostPerMillion: 4.00,
        outputCostPerMillion: 12.00,
        isCustom: true
      }
    ];

    const res = calculateCost({
      provider: 'custom-corp',
      model: 'fine-tuned-model',
      inputTokens: 1000000,
      outputTokens: 1000000,
      customPricing: custom
    });

    expect(res.pricingFound).toBe(true);
    expect(res.pricingSource).toBe('custom');
    expect(res.inputCost).toBe(4.00);
    expect(res.outputCost).toBe(12.00);
    expect(res.totalCost).toBe(16.00);
  });

  it('normalizes model names with dates and vendor prefixes', () => {
    expect(normalizeModelName('openai/gpt-4o')).toBe('gpt-4o');
    expect(normalizeModelName('llama3.3:latest')).toBe('llama3.3');
    
    const { pricing } = getModelPricing('openai', 'gpt-4o-2024-08-06');
    expect(pricing.model).toBe('gpt-4o-2024-08-06');
  });
});
