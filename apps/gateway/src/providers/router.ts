import { MODEL_CATALOG } from '@ai-cost/pricing';
import { ProviderResult, ForwardContext } from './types.js';
import { forwardOpenAI } from './openai.js';
import { forwardAnthropic } from './anthropic.js';
import { forwardGemini } from './gemini.js';
import { forwardOllama } from './ollama.js';

export type SupportedProvider = 'openai' | 'anthropic' | 'gemini' | 'ollama';

const PROVIDER_BY_MODEL = new Map<string, SupportedProvider>();
for (const entry of MODEL_CATALOG) {
  if (['openai', 'anthropic', 'gemini', 'ollama'].includes(entry.provider)) {
    PROVIDER_BY_MODEL.set(entry.model.toLowerCase(), entry.provider as SupportedProvider);
  }
}

export function resolveProvider(model: string, explicitProvider?: string): SupportedProvider {
  if (explicitProvider) {
    const p = explicitProvider.trim().toLowerCase();
    if (['openai', 'anthropic', 'gemini', 'ollama'].includes(p)) {
      return p as SupportedProvider;
    }
    throw new Error(`Unknown provider: ${explicitProvider}. Supported: openai, anthropic, gemini, ollama`);
  }

  const lower = model.toLowerCase();

  // 1. Exact catalog match
  if (PROVIDER_BY_MODEL.has(lower)) {
    return PROVIDER_BY_MODEL.get(lower)!;
  }

  // 2. Explicit provider prefix
  if (lower.startsWith('anthropic/')) return 'anthropic';
  if (lower.startsWith('gemini/')) return 'gemini';
  if (lower.startsWith('ollama/')) return 'ollama';
  if (lower.startsWith('openai/')) return 'openai';

  // 3. Longest prefix catalog match (handles dated snapshots e.g. gpt-4o-2024-08-06)
  let bestMatch: { provider: SupportedProvider; length: number } | null = null;
  for (const [catalogModel, provider] of PROVIDER_BY_MODEL.entries()) {
    if (lower.startsWith(catalogModel) && catalogModel.length > (bestMatch?.length ?? 0)) {
      bestMatch = { provider, length: catalogModel.length };
    }
  }
  if (bestMatch) {
    return bestMatch.provider;
  }

  return 'openai';
}

export async function forwardToProvider(
  provider: SupportedProvider,
  ctx: ForwardContext
): Promise<ProviderResult> {
  switch (provider) {
    case 'anthropic':
      return forwardAnthropic(ctx);
    case 'gemini':
      return forwardGemini(ctx);
    case 'ollama':
      return forwardOllama(ctx);
    case 'openai':
    default:
      return forwardOpenAI(ctx);
  }
}
