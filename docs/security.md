# Security & Privacy Policy

AI Cost was designed from day one with enterprise security standards:

1. **Zero Raw Content Storage**: Prompts and completions are never stored on disk or in the database by default.
2. **SHA-256 Key Hashing**: Secret API keys (`ac_live_...`) are shown only once upon generation and stored only as salted cryptographic hashes.
3. **Redacted Logs**: Secrets and Authorization headers are stripped before entering logger outputs.
4. **Non-Root Containers**: All Docker images execute under non-privileged users (`node` / `nginx`).
