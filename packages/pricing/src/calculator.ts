import { ModelPricing, CostCalculationResult } from '@ai-cost/types';
import { MODEL_CATALOG } from './catalog.js';

export interface CalculateCostParams {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedTokens?: number;
  customPricing?: ModelPricing[];
}

/**
 * Normalizes model names by stripping version suffixes, dates, or vendor prefixes.
 */
export function normalizeModelName(rawModel: string): string {
  let model = rawModel.trim().toLowerCase();
  
  // Remove provider prefix if passed (e.g. "openai/gpt-4o" -> "gpt-4o")
  if (model.includes('/')) {
    model = model.split('/')[1];
  }

  // Remove tag suffix if passed (e.g. "llama3.3:latest" -> "llama3.3")
  if (model.endsWith(':latest')) {
    model = model.replace(':latest', '');
  }

  return model;
}

/**
 * Finds the matching pricing definition for a given provider and model name.
 */
export function getModelPricing(
  provider: string,
  model: string,
  customPricing: ModelPricing[] = []
): { pricing: ModelPricing; source: 'official' | 'custom' | 'fallback' } {
  const normProvider = provider.trim().toLowerCase();
  const normModel = normalizeModelName(model);

  // 1. Check custom pricing first
  const custom = customPricing.find(
    (p) =>
      p.provider.toLowerCase() === normProvider &&
      normalizeModelName(p.model) === normModel
  );
  if (custom) {
    return { pricing: custom, source: 'custom' };
  }

  // 2. Check catalog exact match
  const exact = MODEL_CATALOG.find(
    (p) =>
      p.provider.toLowerCase() === normProvider &&
      normalizeModelName(p.model) === normModel
  );
  if (exact) {
    return { pricing: exact, source: 'official' };
  }

  // 3. Check catalog prefix/fuzzy match (e.g. "gpt-4o-2024-11-20" -> "gpt-4o")
  const prefixMatch = MODEL_CATALOG.find((p) => {
    const catalogModel = normalizeModelName(p.model);
    return (
      p.provider.toLowerCase() === normProvider &&
      (normModel.startsWith(catalogModel) || catalogModel.startsWith(normModel))
    );
  });
  if (prefixMatch) {
    return { pricing: prefixMatch, source: 'official' };
  }

  // 4. Default fallback: Ollama/local models are $0, unknown cloud models get reasonable default or $0
  const isLocal = normProvider === 'ollama' || normModel.includes('local') || normModel.includes('llama');
  return {
    pricing: {
      provider: normProvider,
      model,
      displayName: model,
      inputCostPerMillion: isLocal ? 0.0 : 1.0,
      outputCostPerMillion: isLocal ? 0.0 : 3.0,
      cachedInputCostPerMillion: isLocal ? 0.0 : 0.5,
      description: isLocal ? 'Local self-hosted model' : 'Unknown model fallback pricing',
      isCustom: false
    },
    source: isLocal ? 'official' : 'fallback'
  };
}

/**
 * Calculates accurate estimated cost for an AI request.
 */
export function calculateCost(params: CalculateCostParams): CostCalculationResult {
  const { provider, model, inputTokens, outputTokens, cachedTokens = 0, customPricing = [] } = params;

  const { pricing, source } = getModelPricing(provider, model, customPricing);

  // Separate regular input tokens from cached input tokens
  const nonCachedInputTokens = Math.max(0, inputTokens - cachedTokens);
  const cachedRate = pricing.cachedInputCostPerMillion ?? (pricing.inputCostPerMillion * 0.5);

  const inputCost = (nonCachedInputTokens / 1_000_000) * pricing.inputCostPerMillion;
  const cachedCost = (cachedTokens / 1_000_000) * cachedRate;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputCostPerMillion;

  const totalCost = inputCost + cachedCost + outputCost;

  return {
    inputCost: Number(inputCost.toFixed(8)),
    outputCost: Number(outputCost.toFixed(8)),
    cachedCost: Number(cachedCost.toFixed(8)),
    totalCost: Number(totalCost.toFixed(8)),
    pricingFound: source !== 'fallback',
    pricingSource: source
  };
}
