# Testnet deployments

Automated by `.github/workflows/deploy-testnet.yml` on every push to `main` that
touches `contracts/**`, plus manual `workflow_dispatch` runs.

Each successful deploy posts a summary on the associated PR with the contract ID,
deploy/initialize transaction hashes, and smoke-test result. The same data is
attached to the workflow run as the `deployment-manifest` artifact
(`deployment.json`, retained 90 days).

This file is intentionally kept short — the workflow is the source of truth.
Search for "Testnet deploy" PR comments or download recent deployment manifests
to find the current and recent contract IDs.

| Network | XLM token (SAC) |
| --- | --- |
| testnet | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` |

## Required secrets

| Name | Required | Purpose |
| --- | --- | --- |
| `STELLAR_TESTNET_SECRET_KEY` | Yes | Deployer key (S…). Becomes the contract treasury. |
| `SLACK_WEBHOOK_URL` | Optional | Slack notification on success/failure. |
| `DISCORD_WEBHOOK_URL` | Optional | Discord notification on success/failure. |

When a webhook secret is absent the corresponding notification step is skipped
without failing the workflow.

## Smoke coverage

The workflow exercises:

1. `stellar contract build` and `stellar contract optimize`.
2. Contract deploy + `initialize(token, treasury_recipient)`.
3. `get_pool_count` (before).
4. `create_pool(...)` with fixture args.
5. `get_pool_count` (after) — must equal `before + 1`.

`place_bet` and `settle` are not yet covered in CI; running them would require a
second funded testnet key and a short-expiry pool with a synthetic wait, which is
deferred to a follow-up. The deployer key alone is enough for the current path.

See `rollback.md` for what to do when a deploy lands a broken contract.
