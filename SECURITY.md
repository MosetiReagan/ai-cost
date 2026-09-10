# Security Policy

## Reporting Security Issues

The AI Cost team takes security seriously. If you discover a vulnerability or security issue, please do **NOT** open a public issue on GitHub.

Instead, please report security issues privately to:
`security@aicost.dev` (or via private GitHub vulnerability reporting).

We will acknowledge receipt within 48 hours and provide a fix or mitigation promptly.

## Sensitive Content Policy

By default, the AI Cost Gateway:
- **Never logs or persists raw prompt or completion text**.
- Securely hashes all API keys using SHA-256 before writing to storage.
- Automatically redacts authorization tokens, credentials, and secrets from all diagnostic logs.
