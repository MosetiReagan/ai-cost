import { ModelPricing } from '@ai-cost/types';

/**
 * Standard baseline pricing registry per 1,000,000 tokens (USD).
 * Sourced from official provider documentation (OpenAI, Anthropic, Google Gemini).
 */
export const MODEL_CATALOG: ModelPricing[] = [
  // --- OpenAI Models ---
  {
    provider: 'openai',
    model: 'gpt-4o',
    displayName: 'GPT-4o',
    inputCostPerMillion: 2.50,
    outputCostPerMillion: 10.00,
    cachedInputCostPerMillion: 1.25,
    contextWindow: 128000,
    description: 'Flagship multimodal high-intelligence model'
  },
  {
    provider: 'openai',
    model: 'gpt-4o-2024-08-06',
    displayName: 'GPT-4o (2024-08-06)',
    inputCostPerMillion: 2.50,
    outputCostPerMillion: 10.00,
    cachedInputCostPerMillion: 1.25,
    contextWindow: 128000
  },
  {
    provider: 'openai',
    model: 'gpt-4o-mini',
    displayName: 'GPT-4o Mini',
    inputCostPerMillion: 0.15,
    outputCostPerMillion: 0.60,
    cachedInputCostPerMillion: 0.075,
    contextWindow: 128000,
    description: 'Fast, cost-efficient small model for lighter tasks'
  },
  {
    provider: 'openai',
    model: 'gpt-4o-mini-2024-07-18',
    displayName: 'GPT-4o Mini (2024-07-18)',
    inputCostPerMillion: 0.15,
    outputCostPerMillion: 0.60,
    cachedInputCostPerMillion: 0.075,
    contextWindow: 128000
  },
  {
    provider: 'openai',
    model: 'o1',
    displayName: 'o1',
    inputCostPerMillion: 15.00,
    outputCostPerMillion: 60.00,
    cachedInputCostPerMillion: 7.50,
    contextWindow: 200000,
    description: 'Advanced reasoning model for coding and complex logic'
  },
  {
    provider: 'openai',
    model: 'o1-mini',
    displayName: 'o1 Mini',
    inputCostPerMillion: 3.00,
    outputCostPerMillion: 12.00,
    cachedInputCostPerMillion: 1.50,
    contextWindow: 128000,
    description: 'Faster reasoning model specialized in STEM and coding'
  },
  {
    provider: 'openai',
    model: 'o3-mini',
    displayName: 'o3 Mini',
    inputCostPerMillion: 1.10,
    outputCostPerMillion: 4.40,
    cachedInputCostPerMillion: 0.55,
    contextWindow: 200000,
    description: 'High-speed reasoning model with configurable effort'
  },
  {
    provider: 'openai',
    model: 'gpt-4-turbo',
    displayName: 'GPT-4 Turbo',
    inputCostPerMillion: 10.00,
    outputCostPerMillion: 30.00,
    contextWindow: 128000
  },
  {
    provider: 'openai',
    model: 'gpt-3.5-turbo',
    displayName: 'GPT-3.5 Turbo',
    inputCostPerMillion: 0.50,
    outputCostPerMillion: 1.50,
    contextWindow: 16385
  },
  {
    provider: 'openai',
    model: 'text-embedding-3-small',
    displayName: 'Text Embedding 3 Small',
    inputCostPerMillion: 0.02,
    outputCostPerMillion: 0.00,
    contextWindow: 8191
  },
  {
    provider: 'openai',
    model: 'text-embedding-3-large',
    displayName: 'Text Embedding 3 Large',
    inputCostPerMillion: 0.13,
    outputCostPerMillion: 0.00,
    contextWindow: 8191
  },

  // --- Anthropic Models ---
  {
    provider: 'anthropic',
    model: 'claude-3-5-sonnet-latest',
    displayName: 'Claude 3.5 Sonnet',
    inputCostPerMillion: 3.00,
    outputCostPerMillion: 15.00,
    cachedInputCostPerMillion: 0.30,
    contextWindow: 200000,
    description: 'Industry-leading intelligence, coding, and tool use'
  },
  {
    provider: 'anthropic',
    model: 'claude-3-5-sonnet-20241022',
    displayName: 'Claude 3.5 Sonnet (2024-10-22)',
    inputCostPerMillion: 3.00,
    outputCostPerMillion: 15.00,
    cachedInputCostPerMillion: 0.30,
    contextWindow: 200000
  },
  {
    provider: 'anthropic',
    model: 'claude-3-5-haiku-latest',
    displayName: 'Claude 3.5 Haiku',
    inputCostPerMillion: 0.80,
    outputCostPerMillion: 4.00,
    cachedInputCostPerMillion: 0.08,
    contextWindow: 200000,
    description: 'Ultra-fast sub-second model with near-Sonnet capabilities'
  },
  {
    provider: 'anthropic',
    model: 'claude-3-5-haiku-20241022',
    displayName: 'Claude 3.5 Haiku (2024-10-22)',
    inputCostPerMillion: 0.80,
    outputCostPerMillion: 4.00,
    cachedInputCostPerMillion: 0.08,
    contextWindow: 200000
  },
  {
    provider: 'anthropic',
    model: 'claude-3-opus-latest',
    displayName: 'Claude 3 Opus',
    inputCostPerMillion: 15.00,
    outputCostPerMillion: 75.00,
    cachedInputCostPerMillion: 1.50,
    contextWindow: 200000,
    description: 'High-compute model for complex multi-step reasoning'
  },
  {
    provider: 'anthropic',
    model: 'claude-3-haiku-20240307',
    displayName: 'Claude 3 Haiku',
    inputCostPerMillion: 0.25,
    outputCostPerMillion: 1.25,
    contextWindow: 200000
  },

  // --- Google Gemini Models ---
  {
    provider: 'gemini',
    model: 'gemini-1.5-pro',
    displayName: 'Gemini 1.5 Pro',
    inputCostPerMillion: 1.25,
    outputCostPerMillion: 5.00,
    cachedInputCostPerMillion: 0.3125,
    contextWindow: 2000000,
    description: '2M context window for multimodal reasoning and document analysis'
  },
  {
    provider: 'gemini',
    model: 'gemini-1.5-flash',
    displayName: 'Gemini 1.5 Flash',
    inputCostPerMillion: 0.075,
    outputCostPerMillion: 0.30,
    cachedInputCostPerMillion: 0.01875,
    contextWindow: 1000000,
    description: 'High-speed, low-cost multimodal model for high-frequency tasks'
  },
  {
    provider: 'gemini',
    model: 'gemini-1.5-flash-8b',
    displayName: 'Gemini 1.5 Flash 8B',
    inputCostPerMillion: 0.0375,
    outputCostPerMillion: 0.15,
    contextWindow: 1000000
  },
  {
    provider: 'gemini',
    model: 'gemini-2.0-flash',
    displayName: 'Gemini 2.0 Flash',
    inputCostPerMillion: 0.10,
    outputCostPerMillion: 0.40,
    cachedInputCostPerMillion: 0.025,
    contextWindow: 1000000,
    description: 'Next-generation low-latency flagship model'
  },
  {
    provider: 'gemini',
    model: 'gemini-2.0-flash-exp',
    displayName: 'Gemini 2.0 Flash (Experimental)',
    inputCostPerMillion: 0.10,
    outputCostPerMillion: 0.40,
    contextWindow: 1000000
  },

  // --- DeepSeek Models ---
  {
    provider: 'deepseek',
    model: 'deepseek-chat',
    displayName: 'DeepSeek V3',
    inputCostPerMillion: 0.14,
    outputCostPerMillion: 0.28,
    cachedInputCostPerMillion: 0.014,
    contextWindow: 64000,
    description: 'Efficient general-purpose model'
  },
  {
    provider: 'deepseek',
    model: 'deepseek-reasoner',
    displayName: 'DeepSeek R1',
    inputCostPerMillion: 0.55,
    outputCostPerMillion: 2.19,
    cachedInputCostPerMillion: 0.14,
    contextWindow: 64000,
    description: 'High-capability reasoning and math model'
  },

  // --- Ollama / Local Models (Zero direct cost by default) ---
  {
    provider: 'ollama',
    model: 'llama3.3',
    displayName: 'Llama 3.3 (Local)',
    inputCostPerMillion: 0.00,
    outputCostPerMillion: 0.00,
    contextWindow: 128000,
    description: 'Locally self-hosted model via Ollama'
  },
  {
    provider: 'ollama',
    model: 'llama3.1',
    displayName: 'Llama 3.1 (Local)',
    inputCostPerMillion: 0.00,
    outputCostPerMillion: 0.00,
    contextWindow: 128000
  },
  {
    provider: 'ollama',
    model: 'mistral',
    displayName: 'Mistral 7B (Local)',
    inputCostPerMillion: 0.00,
    outputCostPerMillion: 0.00,
    contextWindow: 32000
  },
  {
    provider: 'ollama',
    model: 'deepseek-r1:8b',
    displayName: 'DeepSeek R1 8B (Local)',
    inputCostPerMillion: 0.00,
    outputCostPerMillion: 0.00,
    contextWindow: 64000
  }
];
