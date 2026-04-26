import { STACKS_MAINNET, STACKS_TESTNET, StacksNetwork } from "@stacks/network";
import { fetchCallReadOnlyFunction, cvToValue, uintCV, principalCV, ClarityValue } from "@stacks/transactions";
import { getRuntimeConfig } from "./runtime-config";

function getStacksNetwork(): StacksNetwork {
    const cfg = getRuntimeConfig();
    return cfg.network === 'testnet' ? STACKS_TESTNET : STACKS_MAINNET;
}

export interface Pool {
    id: number;
    title: string;
    description: string;
    creator: string;
    outcomeA: string;
    outcomeB: string;
    totalA: number;
    totalB: number;
    settled: boolean;
    winningOutcome: number | undefined;
    expiry: number;
    status: 'active' | 'settled' | 'expired';
}

export async function getPoolCount(): Promise<number> {
    try {
        const cfg = getRuntimeConfig();
        const network: StacksNetwork = getStacksNetwork();
        const result = await fetchCallReadOnlyFunction({
            contractAddress: cfg.contract.address,
            contractName: cfg.contract.name,
            functionName: 'get-pool-count',
            functionArgs: [],
            senderAddress: cfg.contract.address,
            network,
        });

        const value = cvToValue(result);
        return Number(value);
    } catch (e) {
        console.error("Failed to fetch pool count", e);
        return 0;
    }
}

export async function getPool(poolId: number): Promise<Pool | null> {
    try {
        const cfg = getRuntimeConfig();
        const network: StacksNetwork = getStacksNetwork();
        const result = await fetchCallReadOnlyFunction({
            contractAddress: cfg.contract.address,
            contractName: cfg.contract.name,
            functionName: 'get-pool',
            functionArgs: [uintCV(poolId)],
            senderAddress: cfg.contract.address,
            network,
        });

        const value = cvToValue(result, true); // true for readable format
        if (!value) return null;

        // Handle (some {...}) vs (none)
        // cvToValue with readable=true returns null for none, object for some
        return {
            id: poolId,
            title: value.title,
            description: value.description,
            creator: value.creator,
            outcomeA: value['outcome-a-name'],
            outcomeB: value['outcome-b-name'],
            totalA: Number(value['total-a']),
            totalB: Number(value['total-b']),
            settled: value.settled,
            winningOutcome: value['winning-outcome'] ?? undefined,
            expiry: Number(value.expiry ?? 0),
            status: value.settled ? 'settled' : 'active',
        };
    } catch (e) {
        console.error(`Failed to fetch pool ${poolId}`, e);
        return null;
    }
}

export async function getMarkets(filter: 'active' | 'settled' | 'all' = 'all'): Promise<Pool[]> {
    const count = await getPoolCount();
    const pools: Pool[] = [];

    // pool IDs start from 0
    for (let i = 0; i < count; i++) {
        const pool = await getPool(i);
        if (pool) {
            if (filter === 'active' && pool.settled) continue;
            if (filter === 'settled' && !pool.settled) continue;
            pools.push(pool);
        }
    }
    return pools;
}

/** Alias for getMarkets('active') — used by tests */
export async function fetchActivePools(): Promise<Pool[]> {
    try {
        return await getMarkets('active');
    } catch (e) {
        console.error('Failed to fetch active pools', e);
        return [];
    }
}

export async function getTotalVolume(): Promise<number> {
    try {
        const cfg = getRuntimeConfig();
        const network = getStacksNetwork();
        const result = await fetchCallReadOnlyFunction({
            contractAddress: cfg.contract.address,
            contractName: cfg.contract.name,
            functionName: 'get-total-volume',
            functionArgs: [],
            senderAddress: cfg.contract.address,
            network,
        });

        const value = cvToValue(result);
        return Number(value);
    } catch (e) {
        console.error("Error fetching total volume:", e);
        return 0;
    }
}

export interface UserBetData {
    amountA: number;
    amountB: number;
    totalBet: number;
}

export async function getUserBet(poolId: number, userAddress: string): Promise<UserBetData | null> {
    try {
        const cfg = getRuntimeConfig();
        const network: StacksNetwork = getStacksNetwork();
        const result = await fetchCallReadOnlyFunction({
            contractAddress: cfg.contract.address,
            contractName: cfg.contract.name,
            functionName: 'get-user-bet',
            functionArgs: [uintCV(poolId), principalCV(userAddress)],
            senderAddress: cfg.contract.address,
            network,
        });

        const value = cvToValue(result, true) as Record<string, unknown> | null;
        if (!value) return null;

        const toNumber = (raw: unknown): number => {
            if (typeof raw === 'number') return raw;
            if (typeof raw === 'string') return Number(raw);
            if (typeof raw === 'bigint') return Number(raw);
            return Number.NaN;
        };

        return {
            amountA: toNumber((value['amount-a'] as { value?: unknown } | undefined)?.value ?? value['amount-a']),
            amountB: toNumber((value['amount-b'] as { value?: unknown } | undefined)?.value ?? value['amount-b']),
            totalBet: toNumber((value['total-bet'] as { value?: unknown } | undefined)?.value ?? value['total-bet']),
        };
    } catch (e) {
        console.error(`Failed to fetch user bet for pool ${poolId}`, e);
        return null;
    }
}

// --- Activity Feed ---

export interface ActivityEvent {
    type: 'bet' | 'pool-creation' | 'settlement' | 'claim';
    poolId?: number;
    poolTitle?: string;
    amount?: number;
    outcome?: number;
    winnerAmount?: number;
}

export interface ActivityItem {
    txId: string;
    type: 'bet-placed' | 'winnings-claimed' | 'pool-created' | 'contract-call';
    functionName: string;
    timestamp: number;
    status: 'success' | 'pending' | 'failed';
    amount?: number;
    poolId?: number;
    poolTitle?: string;
    explorerUrl: string;
    event?: ActivityEvent;
}

type StacksFunctionArg = {
    name?: string;
    repr?: string;
};

type StacksContractCall = {
    contract_id?: string;
    function_name?: string;
    function_args?: StacksFunctionArg[];
};

type StacksSmartContractEvent = {
    type?: string;
    smart_contract_event?: {
        event_name?: string;
        event_data?: Record<string, unknown>;
    };
};

type StacksTransaction = {
    tx_id: string;
    tx_status?: string;
    burn_block_time?: number;
    contract_call?: StacksContractCall;
    events?: StacksSmartContractEvent[];
};

type StacksAddressTransactionsResponse = {
    results?: StacksTransaction[];
};

function isStacksTransaction(value: unknown): value is StacksTransaction {
    if (!value || typeof value !== 'object') return false;
    const record = value as Record<string, unknown>;
    return typeof record.tx_id === 'string';
}

function parseOptionalNumber(raw: unknown): number | undefined {
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
    if (typeof raw === 'string') {
        const n = Number(raw);
        return Number.isFinite(n) ? n : undefined;
    }
    return undefined;
}

function parseOptionalString(raw: unknown): string | undefined {
    if (typeof raw === 'string' && raw.length > 0) return raw;
    return undefined;
}

function parseContractEvents(tx: StacksTransaction): ActivityEvent | undefined {
    const events = tx.events ?? [];
    
    for (const event of events) {
        if (event.type === 'smart_contract_event') {
            const eventData = event.smart_contract_event;
            const eventName = eventData?.event_name;
            
            if (eventName === 'bet-placed') {
                const parsed = eventData?.event_data ?? {};
                return {
                    type: 'bet',
                    poolId: parseOptionalNumber(parsed.pool_id),
                    amount: parseOptionalNumber(parsed.amount),
                    outcome: parseOptionalNumber(parsed.outcome),
                };
            }
            
            if (eventName === 'pool-created') {
                const parsed = eventData?.event_data ?? {};
                return {
                    type: 'pool-creation',
                    poolId: parseOptionalNumber(parsed.pool_id),
                    poolTitle: parseOptionalString(parsed.title),
                };
            }
            
            if (eventName === 'pool-settled') {
                const parsed = eventData?.event_data ?? {};
                return {
                    type: 'settlement',
                    poolId: parseOptionalNumber(parsed.pool_id),
                    outcome: parseOptionalNumber(parsed.winning_outcome),
                };
            }
            
            if (eventName === 'winnings-claimed') {
                const parsed = eventData?.event_data ?? {};
                return {
                    type: 'claim',
                    poolId: parseOptionalNumber(parsed.pool_id),
                    winnerAmount: parseOptionalNumber(parsed.amount),
                };
            }
        }
    }
    
    return undefined;
}

function parseUintRepr(repr: string): number | undefined {
    // Expected: strings like "u1000000" from Clarity uints
    const normalized = repr.startsWith('u') ? repr.slice(1) : repr;
    const n = Number(normalized);
    return Number.isFinite(n) ? n : undefined;
}

function extractPoolInfo(args: StacksFunctionArg[]): { amount?: number; poolId?: number } {
    let amount: number | undefined;
    let poolId: number | undefined;

    for (const arg of args) {
        if (arg.name === 'amount' && arg.repr) {
            amount = parseUintRepr(arg.repr);
        }
        if (arg.name === 'pool-id' && arg.repr) {
            poolId = parseUintRepr(arg.repr);
        }
    }
    
    return { amount, poolId };
}

/**
 * Injectable configuration for getUserActivity, enabling test isolation.
 */
export interface ActivityConfig {
    /** Base URL for the Stacks API, e.g. https://api.testnet.hiro.so */
    apiBaseUrl: string;
    /** Explorer base URL used to build transaction links */
    explorerUrl: string;
    /** Contract address used to filter Predinex transactions */
    contractAddress: string;
}

/**
 * Fetches recent on-chain activity for a user address by querying the
 * Stacks blockchain API for contract-call transactions targeting the
 * Predinex contract. Uses contract events when available for richer data.
 *
 * @param userAddress - Stacks principal to query
 * @param limit       - Maximum number of transactions to fetch (default 20)
 * @param config      - Optional injectable config; falls back to module-level constants
 */
export async function getUserActivity(
    userAddress: string,
    limit: number = 20,
    config?: Partial<ActivityConfig>
): Promise<ActivityItem[]> {
    try {
        // Use injected config when provided (enables test isolation), otherwise fall back to runtime config
        let explorerBase: string;
        let apiBaseUrl: string;
        let contractAddress: string;

        if (config && config.apiBaseUrl && config.contractAddress) {
            // Guard: if explorerUrl is missing/empty, bail out early
            if (!config.explorerUrl) return [];
            explorerBase = config.explorerUrl;
            apiBaseUrl = config.apiBaseUrl;
            contractAddress = config.contractAddress;
        } else {
            const cfg = getRuntimeConfig();
            explorerBase = cfg.api.explorerUrl;
            apiBaseUrl = cfg.api.coreApiUrl;
            contractAddress = cfg.contract.address;
        }

        const url = `${apiBaseUrl}/extended/v1/address/${userAddress}/transactions?limit=${limit}&type=contract_call`;
        const response = await fetch(url);

        if (!response.ok) {
            console.error(`Stacks API error: ${response.status}`);
            return [];
        }

        const data: unknown = await response.json();
        const dataRecord = (data && typeof data === 'object' ? (data as Record<string, unknown>) : {}) as Record<
            string,
            unknown
        >;
        const maybeResults = dataRecord['results'];
        const results = Array.isArray(maybeResults) ? maybeResults.filter(isStacksTransaction) : [];

        const predinexTxs = results.filter((tx) => {
            const callInfo = tx.contract_call;
            return typeof callInfo?.contract_id === 'string' && callInfo.contract_id.includes(contractAddress);
        });

        return predinexTxs.map((tx): ActivityItem => {
            const callInfo = tx.contract_call;
            const fnName: string = callInfo?.function_name || 'unknown';

            let type: ActivityItem['type'] = 'contract-call';
            if (fnName === 'place-bet') type = 'bet-placed';
            else if (fnName === 'claim-winnings') type = 'winnings-claimed';
            else if (fnName === 'create-pool') type = 'pool-created';

            let status: ActivityItem['status'] = 'pending';
            if (tx.tx_status === 'success') status = 'success';
            else if (tx.tx_status === 'abort_by_response' || tx.tx_status === 'abort_by_post_condition') status = 'failed';

            // Parse contract events for richer data
            const event = parseContractEvents(tx);

            // Extract amount from function args if available
            const args: StacksFunctionArg[] = callInfo?.function_args ?? [];
            const { amount, poolId } = extractPoolInfo(args);

            return {
                txId: tx.tx_id,
                type,
                functionName: fnName,
                timestamp: tx.burn_block_time ?? Math.floor(Date.now() / 1000),
                status,
                amount: event?.amount || event?.winnerAmount || amount,
                poolId: event?.poolId || poolId,
                poolTitle: event?.poolTitle,
                explorerUrl: `${explorerBase}/txid/${tx.tx_id}`,
                event,
            };
        });
    } catch (e) {
        console.error('Failed to fetch user activity', e);
        return [];
    }
}
