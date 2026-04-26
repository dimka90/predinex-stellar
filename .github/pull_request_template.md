<!-- #242 — PR template for contract, frontend, and docs changes. -->

## Summary

<!-- One paragraph: what changed and why. Link the relevant issue(s). -->

Closes #

## Scope

- [ ] Contract (`contracts/`)
- [ ] Frontend / web (`web/`)
- [ ] Docs (`docs/`)
- [ ] CI / repo tooling (`.github/`)

## Testing

<!-- Describe how you verified the change. -->

- [ ] `cargo test` passes (contract changes)
- [ ] `npm run test -- --run` passes (web changes)
- [ ] `npm run lint` and `npm run build` pass (web changes)
- [ ] Manual smoke test on testnet / local node

## Migration risk

<!-- Does this change storage layout, event names, or public API surface? -->

- [ ] No migration needed
- [ ] Migration steps documented below

<details>
<summary>Migration notes (if applicable)</summary>

<!-- Describe data migration, contract upgrade, or config changes. -->

</details>

## Contract considerations

<!-- Complete if `contracts/` files are modified. -->

- [ ] Storage keys unchanged or migration documented
- [ ] New events follow the existing `snake_case` naming convention
- [ ] Auth checks and error codes reviewed
- [ ] Benchmark / resource usage not regressed

## Docs impact

- [ ] README updated (if user-facing behaviour changed)
- [ ] `CHANGELOG.md` entry added (if applicable)
- [ ] No docs update needed
