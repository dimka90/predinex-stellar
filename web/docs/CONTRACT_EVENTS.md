# Contract Event Schemas

This document is the canonical reference for every event emitted by the Predinex Soroban smart contract (`contracts/predinex/src/lib.rs`). Frontend developers and indexer consumers should rely on this document rather than reverse-engineering event payloads from the contract source.

---

## Overview

The contract uses Soroban's `env.events().publish(topics, data)` API. Each event carries:

| Field    | Description                                                   |
|----------|---------------------------------------------------------------|
| `topics` | A tuple of `Symbol` (event name) and additional identifiers   |
| `data`   | The event payload — a single value or a tuple                 |

All events are emitted on the **Stellar testnet** during development and the **Stellar mainnet** for production. Use a Soroban event filter or a horizon endpoint to subscribe.

---

## Events

### 1. `create_pool`

Emitted when a new prediction market (pool) is created.

**Trigger:** `PredinexContract::create_pool`

**Topics tuple:**
```
(Symbol("create_pool"), pool_id: u32)
```

**Data:**
```
creator: Address
```

**Full TypeScript shape:**
```ts
interface CreatePoolEvent {
  topics: [eventName: string, poolId: number];
  data: {
    creator: string; // Stellar address of the pool creator
  };
}
```

**Example (decoded):**
```json
{
  "topics": ["create_pool", 42],
  "data": "GBXXX...CREATOR_ADDRESS"
}
```

---

### 2. `place_bet`

Emitted when a user places a bet on an outcome.

**Trigger:** `PredinexContract::place_bet`

**Topics tuple:**
```
(Symbol("place_bet"), pool_id: u32, user: Address)
```

**Data tuple:**
```
(outcome: u32, amount: i128)
```

| Field     | Type    | Values             | Description                          |
|-----------|---------|--------------------|--------------------------------------|
| `outcome` | `u32`   | `0` = A, `1` = B   | Which outcome was bet on             |
| `amount`  | `i128`  | positive integer   | Token amount in the contract's base unit |

**Full TypeScript shape:**
```ts
interface PlaceBetEvent {
  topics: [eventName: string, poolId: number, user: string];
  data: {
    outcome: 0 | 1;  // 0 = Outcome A, 1 = Outcome B
    amount: bigint;  // raw token units (not human-readable)
  };
}
```

**Example (decoded):**
```json
{
  "topics": ["place_bet", 42, "GBXXX...USER_ADDRESS"],
  "data": [0, 5000000]
}
```

---

### 3. `settle_pool`

Emitted when the pool creator settles a market by declaring the winning outcome.

**Trigger:** `PredinexContract::settle_pool`

**Topics tuple:**
```
(Symbol("settle_pool"), pool_id: u32)
```

**Data:**
```
winning_outcome: u32
```

| Field             | Type   | Values            | Description                      |
|-------------------|--------|-------------------|----------------------------------|
| `winning_outcome` | `u32`  | `0` = A, `1` = B  | Which outcome won the market     |

**Full TypeScript shape:**
```ts
interface SettlePoolEvent {
  topics: [eventName: string, poolId: number];
  data: {
    winningOutcome: 0 | 1;
  };
}
```

**Example (decoded):**
```json
{
  "topics": ["settle_pool", 42],
  "data": 1
}
```

---

### 4. `claim_winnings`

Emitted when a winner claims their share of the pool.

**Trigger:** `PredinexContract::claim_winnings`

**Topics tuple:**
```
(Symbol("claim_winnings"), pool_id: u32, user: Address)
```

**Data:**
```
winnings: i128
```

| Field      | Type    | Description                                                  |
|------------|---------|--------------------------------------------------------------|
| `winnings` | `i128`  | Net payout transferred to the user (after the 2 % protocol fee) |

**Full TypeScript shape:**
```ts
interface ClaimWinningsEvent {
  topics: [eventName: string, poolId: number, user: string];
  data: {
    winnings: bigint;  // net payout in raw token units
  };
}
```

**Example (decoded):**
```json
{
  "topics": ["claim_winnings", 42, "GBXXX...USER_ADDRESS"],
  "data": 9800000
}
```

---

## Parsing guide for frontend / indexers

### Topic structure

Soroban publishes topics as a `Vec<Val>`. The first element is always a `Symbol` carrying the event name. Subsequent elements carry typed identifiers.

```ts
// Minimal helper — adapt to your Soroban SDK version
function parseEventTopic(raw: SorobanEvent): { name: string; poolId: number; user?: string } {
  const [nameVal, poolIdVal, userVal] = raw.topic;
  return {
    name: scValToNative(nameVal) as string,
    poolId: Number(scValToNative(poolIdVal)),
    user: userVal ? String(scValToNative(userVal)) : undefined,
  };
}
```

### Amount units

`amount` and `winnings` are raw token units in `i128`. To convert to the human-readable token amount divide by the token's decimal factor (typically `10^7` for XLM-derived tokens):

```ts
const DECIMAL_FACTOR = 10_000_000n; // 7 decimals

function toHuman(raw: bigint): string {
  return (Number(raw) / Number(DECIMAL_FACTOR)).toFixed(7);
}
```

### Outcome mapping

| Value | Meaning   |
|-------|-----------|
| `0`   | Outcome A (`pool.outcome_a_name`) |
| `1`   | Outcome B (`pool.outcome_b_name`) |

Outcome labels are stored on the `Pool` struct, not in the event. Always look up the `Pool` to display a human-readable name.

---

## Horizon event subscription

```ts
import { Server } from "@stellar/stellar-sdk/rpc";

const server = new Server("https://soroban-testnet.stellar.org");

// Subscribe to all events for a contract
const events = await server.getEvents({
  startLedger: 0,
  filters: [
    {
      type: "contract",
      contractIds: [CONTRACT_ID],
      topics: [["create_pool", "place_bet", "settle_pool", "claim_winnings"]],
    },
  ],
});
```

---

## Changelog

| Version | Change                         |
|---------|--------------------------------|
| v0.1    | Initial event schema documented |

> This document must be updated whenever a new event is added to the contract or an existing event's topics/data structure changes. See [CONTRACT_VERSIONING.md](./CONTRACT_VERSIONING.md) for the full migration process.
