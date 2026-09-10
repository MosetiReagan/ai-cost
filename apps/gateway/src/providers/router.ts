import { ProviderResult, ForwardContext } from './types.js';
import { forwardOpenAI } from './openai.js';
import { forwardAnthropic } from './anthropic.js';
import { forwardGemini } from './gemini.js';
import { forwardOllama } from './ollama.js';

export type SupportedProvider = 'openai' | 'anthropic' | 'gemini' | 'ollama';

export function resolveProvider(model: string, explicitProvider?: string): SupportedProvider {
  if (explicitProvider) {
    const p = explicitProvider.trim().toLowerCase();
    if (['openai', 'anthropic', 'gemini', 'ollama'].includes(p)) {
      return p as SupportedProvider;
    }
  }

  const m = model.toLowerCase();
  if (m.startsWith('anthropic/') || m.includes('claude')) {
    return 'anthropic';
  }
  if (m.startsWith('gemini/') || m.includes('gemini')) {
    return 'gemini';
  }
  if (m.startsWith('ollama/') || m.includes('llama') || m.includes('mistral') || m.includes('deepseek-r1:')) {
    return 'ollama';
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
