# Configuration Reference

All configuration is controlled via environment variables:

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | None (PGlite) | PostgreSQL connection string |
| `GATEWAY_PORT` | `4000` | Port for the OpenAI-compatible Gateway |
| `API_PORT` | `3001` | Port for the Dashboard REST API |
| `JWT_SECRET` | `...` | Secret key for signing dashboard session tokens |
| `DATA_RETENTION_DAYS` | `90` | Days before request telemetry is purged |
| `FAIL_OPEN` | `true` | Continues proxying traffic if telemetry write fails |
