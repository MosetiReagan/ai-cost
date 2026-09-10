# Contributing to AI Cost

Thank you for your interest in contributing to AI Cost! We welcome contributions from developers of all skill levels.

## Development Setup

1. Fork and clone the repository:
   ```bash
   git clone https://github.com/your-username/ai-cost.git
   cd ai-cost
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Seed demo data (optional):
   ```bash
   npm run seed
   ```

4. Run tests:
   ```bash
   npm test
   ```

5. Typecheck & Build:
   ```bash
   npm run typecheck
   npm run build
   ```

## Adding a New Provider

To add a new AI provider (e.g. Groq, Mistral, DeepSeek):
1. Add pricing definitions in `packages/pricing/src/catalog.ts`.
2. Implement provider forwarding and token extraction in `apps/gateway/src/providers/`.
3. Wire the provider into the router in `apps/gateway/src/providers/router.ts`.
4. Add unit and integration tests.
