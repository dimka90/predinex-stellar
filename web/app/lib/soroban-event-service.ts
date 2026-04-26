/**
 * Soroban Event Service
 *
 * Fetches and maps Soroban contract events from the Stellar RPC / Horizon API
 * into typed ActivityItem objects consumed by the UI.
 *
 * Event schema reference: web/docs/CONTRACT_EVENTS.md
 */

import type { ActivityItem } from './adapters/types';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface SorobanEventServiceConfig {
  /** Soroban RPC URL, e.g. https://soroban-testnet.stellar.org */
  rpcUrl: string;
  /** Stellar explorer base URL for building tx links */
  explorerUrl: string;
  /** Deployed contract ID (Stellar strkey C... format) */
  contractId: string;
}

// ---------------------------------------------------------------------------
// Raw Soroban event shapes (from RPC getEvents response)
// ---------------------------------------------------------------------------

interface RawSorobanEvent {
  /** Hex-encoded ledger sequence + tx index, used as a stable ID */
  id: string;
  /** Ledger close time as Unix timestamp (seconds) */
  ledgerClosedAt?: string;
  /** Ledger sequence number */
  ledger?: number;
  /** Transaction hash */
  txHash?: string;
  /** Decoded topic values as XDR base64 strings or native JS values */
  topic: unknown[];
  /** Decoded data value */
  value: unknown;
  /** Contract ID that emitted the event */
  contractId?: string;
}

interface GetEventsResponse {
  result?: {
    events?: RawSorobanEvent[];
    latestLedger?: number;
  };
  error?: { message: string };
}

// ---------------------------------------------------------------------------
// Typed event payloads (after decoding)
// ---------------------------------------------------------------------------

export type SorobanEventName =
  | 'create_pool'
  | 'place_bet'
  | 'settle_pool'
  | 'claim_winnings'
  | 'fee_collected'
  | 'treasury_withdrawal';

export interface DecodedSorobanEvent {
  name: SorobanEventName;
  poolId?: number;
  user?: string;
  /** Raw token units (i128 stored as number for JS compat) */
  amount?: number;
  outcome?: 0 | 1;
  winnings?: number;
  winningOutcome?: 0 | 1;
  txHash: string;
  timestamp: number;
  ledger?: number;
}

// ---------------------------------------------------------------------------
// Decoding helpers
// ---------------------------------------------------------------------------

/**
 * Soroban RPC returns topic/value as either:
 *  - A plain JS primitive (when the SDK decodes it)
 *  - An object like { type: "symbol", value: "place_bet" }
 *  - An XDR base64 string (raw mode)
 *
 * This helper normalises all three into a plain JS value.
 */
function scValToNative(raw: unknown): unknown {
  if (raw === null || raw === undefined) return undefined;
  if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') return raw;
  if (typeof raw === 'bigint') return Number(raw);

  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    // { type: "symbol" | "u32" | "i128" | "address" | ..., value: ... }
    if ('value' in obj) return scValToNative(obj['value']);
    // { _type: ..., _value: ... } (some SDK versions)
    if ('_value' in obj) return scValToNative(obj['_value']);
  }

  return String(raw);
}

function toNumber(raw: unknown): number | undefined {
  const v = scValToNative(raw);
  if (v === undefined || v === null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function toString(raw: unknown): string | undefined {
  const v = scValToNative(raw);
  if (typeof v === 'string' && v.length > 0) return v;
  return undefined;
}

/**
 * Decode a raw Soroban event into a typed DecodedSorobanEvent.
 * Returns null if the event name is unrecognised or topics are malformed.
 */
export function decodeSorobanEvent(raw: RawSorobanEvent): DecodedSorobanEvent | null {
  const topics = raw.topic ?? [];
  if (topics.length === 0) return null;

  const name = toString(topics[0]) as SorobanEventName | undefined;
  if (!name) return null;

  const txHash = raw.txHash ?? raw.id ?? '';
  const timestamp = raw.ledgerClosedAt
    ? Math.floor(new Date(raw.ledgerClosedAt).getTime() / 1000)
    : Math.floor(Date.now() / 1000);

  const base: DecodedSorobanEvent = { name, txHash, timestamp, ledger: raw.ledger };

  switch (name) {
    case 'create_pool': {
      // topics: [name, pool_id], data: creator
      base.poolId = toNumber(topics[1]);
      return base;
    }

    case 'place_bet': {
      // topics: [name, pool_id, user], data: (outcome, amount)
      base.poolId = toNumber(topics[1]);
      base.user = toString(topics[2]);
      // data is a tuple [outcome, amount]
      const data = raw.value;
      if (Array.isArray(data)) {
        const outcome = toNumber(data[0]);
        base.outcome = (outcome === 0 || outcome === 1) ? outcome : undefined;
        base.amount = toNumber(data[1]);
      } else if (data && typeof data === 'object') {
        const d = data as Record<string, unknown>;
        const outcome = toNumber(d['outcome'] ?? d[0]);
        base.outcome = (outcome === 0 || outcome === 1) ? outcome : undefined;
        base.amount = toNumber(d['amount'] ?? d[1]);
      }
      return base;
    }

    case 'settle_pool': {
      // topics: [name, pool_id], data: winning_outcome
      base.poolId = toNumber(topics[1]);
      const wo = toNumber(raw.value);
      base.winningOutcome = (wo === 0 || wo === 1) ? wo : undefined;
      return base;
    }

    case 'claim_winnings': {
      // topics: [name, pool_id, user], data: winnings
      base.poolId = toNumber(topics[1]);
      base.user = toString(topics[2]);
      base.winnings = toNumber(raw.value);
      return base;
    }

    case 'fee_collected':
    case 'treasury_withdrawal':
      // Not surfaced in the activity feed
      return null;

    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Event → ActivityItem mapper
// ---------------------------------------------------------------------------

/**
 * Maps a decoded Soroban event to the ActivityItem UI model.
 * Returns null for event types that don't map to a user-visible activity.
 */
export function mapEventToActivityItem(
  event: DecodedSorobanEvent,
  explorerUrl: string
): ActivityItem | null {
  const txUrl = `${explorerUrl}/tx/${event.txHash}`;

  switch (event.name) {
    case 'place_bet':
      return {
        txId: event.txHash,
        type: 'bet-placed',
        functionName: 'place_bet',
        timestamp: event.timestamp,
        status: 'success',
        amount: event.amount,
        poolId: event.poolId,
        explorerUrl: txUrl,
        event: {
          type: 'bet',
          poolId: event.poolId,
          amount: event.amount,
          outcome: event.outcome,
        },
      };

    case 'claim_winnings':
      return {
        txId: event.txHash,
        type: 'winnings-claimed',
        functionName: 'claim_winnings',
        timestamp: event.timestamp,
        status: 'success',
        amount: event.winnings,
        poolId: event.poolId,
        explorerUrl: txUrl,
        event: {
          type: 'claim',
          poolId: event.poolId,
          winnerAmount: event.winnings,
        },
      };

    case 'create_pool':
      return {
        txId: event.txHash,
        type: 'pool-created',
        functionName: 'create_pool',
        timestamp: event.timestamp,
        status: 'success',
        poolId: event.poolId,
        explorerUrl: txUrl,
        event: {
          type: 'pool-creation',
          poolId: event.poolId,
        },
      };

    case 'settle_pool':
      return {
        txId: event.txHash,
        type: 'contract-call',
        functionName: 'settle_pool',
        timestamp: event.timestamp,
        status: 'success',
        poolId: event.poolId,
        explorerUrl: txUrl,
        event: {
          type: 'settlement',
          poolId: event.poolId,
          outcome: event.winningOutcome,
        },
      };

    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Main service function
// ---------------------------------------------------------------------------

/**
 * Fetches Soroban contract events for a specific user address and maps them
 * into ActivityItem objects for the UI.
 *
 * Queries the Soroban RPC `getEvents` method, filtering by contract ID and
 * the user's address in the topic list (for place_bet and claim_winnings).
 *
 * @param userAddress - Stellar address (G... strkey) of the user
 * @param limit       - Maximum number of activity items to return
 * @param config      - Injectable service config (enables test isolation)
 */
export async function getUserActivityFromSoroban(
  userAddress: string,
  limit: number = 20,
  config: SorobanEventServiceConfig
): Promise<ActivityItem[]> {
  const { rpcUrl, explorerUrl, contractId } = config;

  if (!rpcUrl || !explorerUrl || !contractId) return [];

  try {
    // Use getEvents RPC method — filter by contract, user-relevant event names
    const body = {
      jsonrpc: '2.0',
      id: 1,
      method: 'getEvents',
      params: {
        filters: [
          {
            type: 'contract',
            contractIds: [contractId],
            // Filter for events where the user address appears in topics
            // (place_bet and claim_winnings include user in topic[2])
            topics: [
              ['place_bet', 'claim_winnings', 'create_pool', 'settle_pool'],
            ],
          },
        ],
        pagination: { limit },
      },
    };

    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.error(`Soroban RPC error: ${response.status}`);
      return [];
    }

    const json: GetEventsResponse = await response.json();

    if (json.error) {
      console.error('Soroban RPC returned error:', json.error.message);
      return [];
    }

    const rawEvents: RawSorobanEvent[] = json.result?.events ?? [];

    const items: ActivityItem[] = [];

    for (const raw of rawEvents) {
      const decoded = decodeSorobanEvent(raw);
      if (!decoded) continue;

      // Filter to events relevant to this user:
      // - place_bet / claim_winnings must have user in topics
      // - create_pool / settle_pool are included if the user is the creator
      //   (we can't filter server-side without an indexer, so we include all
      //    and let the UI decide; for user-specific feeds the hook can filter)
      const isUserEvent =
        decoded.user === userAddress ||
        decoded.name === 'create_pool' ||
        decoded.name === 'settle_pool';

      if (!isUserEvent) continue;

      const item = mapEventToActivityItem(decoded, explorerUrl);
      if (item) items.push(item);
    }

    // Sort newest first
    items.sort((a, b) => b.timestamp - a.timestamp);

    return items.slice(0, limit);
  } catch (e) {
    console.error('Failed to fetch Soroban activity events:', e);
    return [];
  }
}
