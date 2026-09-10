# Spend Alerts & Budgets

AI Cost provides proactive spend alerting to prevent accidental budget overruns, unexpected token runaway spikes, and elevated error conditions.

---

## Alert Triggers

AI Cost monitors your traffic patterns in real-time and triggers alerts across several conditions:

| Alert Type | Severity | Description | Default Threshold |
| :--- | :--- | :--- | :--- |
| **`budget_threshold`** | `warning` | Project spend has reached the configured warning percentage of monthly budget | Configurable (e.g. 80%) |
| **`budget_threshold`** | `critical` | Project spend has met or exceeded 100% of the monthly budget | 100% |
| **`error_spike`** | `warning` | Downstream provider error rate exceeded 5% over recent requests | 5.0% |
| **`expensive_model_dominance`** | `info` | High-cost reasoning models consume over 50% of total spend | 50% spend share |

---

## Configuring Project Budgets

Budgets can be configured per project either via the Dashboard UI (**Budgets & Alerts** tab) or programmatically via the REST API:

### REST API

```bash
curl -X POST http://localhost:3001/api/budgets \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "proj_123",
    "monthlyBudgetUsd": 500.0,
    "alertThresholdPercent": 80
  }'
```

---

## Non-Blocking Policy

By design, **AI Cost does not automatically terminate or reject production customer traffic** when a budget cap is reached, unless explicitly configured to fail-closed. 

In production systems, silent truncation of AI features can cause cascading customer-facing outages. Instead, AI Cost immediately flags the budget as `exceeded`, triggers a critical spend alert in the dashboard, and notifies operations.

---

## Managing and Resolving Alerts

Active alerts can be acknowledged and resolved directly from the **Budgets & Spend Alerts** view in the dashboard, or through the API:

```bash
curl -X POST http://localhost:3001/api/alerts/<alertId>/resolve
```
