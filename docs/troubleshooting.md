# Troubleshooting

### Gateway returns 401 Unauthorized
Ensure your request includes `Authorization: Bearer ac_live_...` or `x-ai-cost-key: ac_live_...`. You can generate a project key from the **Projects & Keys** tab in the dashboard.

### Database connection issues
If `DATABASE_URL` is unset, AI Cost automatically falls back to the embedded WebAssembly PostgreSQL engine (PGlite) for instant local usage without Docker.
