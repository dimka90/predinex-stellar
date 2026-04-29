#![no_std]
extern crate alloc;
use alloc::vec;
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, token, Address, Env, String, Symbol, Vec,
};

mod fuzz_tests;
mod multi_user_tests;
mod pause_tests;
mod protocol_fee_tests;
mod test;

// ── Issue #175: Event schema versioning ──────────────────────────────────────
//
// Every event emitted by this contract uses the same topic layout:
//
//   (Symbol(event_name), Symbol(EVENT_SCHEMA_VERSION), ...identifiers)
//
// Topic position 0 is the event name (e.g. `create_pool`). Topic position 1 is
// always the schema version marker (currently `"v1"`). Subsequent topics carry
// pool / user identifiers as before. Indexers and frontend consumers can
// therefore pin a specific schema version with a positional topic filter, e.g.
// `[["create_pool", "v1"]]`, and reject events whose version they do not yet
// understand instead of silently mis-decoding payloads.
//
// Upgrade rules for future schema changes:
//   * A backward-compatible payload extension (additional optional fields)
//     SHOULD reuse the same version marker.
//   * A breaking change to topics or data shape MUST bump the version marker
//     (e.g. `"v2"`) and be documented in `web/docs/CONTRACT_EVENTS.md`.
//   * The contract MUST never emit two version markers for the same event in
//     the same release; consumers can rely on exactly one version per event.
//
// See `web/docs/CONTRACT_EVENTS.md` for the full per-event schema and the
// upgrade expectations published to consumers.
pub const EVENT_SCHEMA_VERSION: &str = "v1";

/// #191 — Contract state schema version for on-chain compatibility checks.
/// Bumped (e.g. "v2") whenever the persistent state layout changes in a
/// backward-incompatible way. Stored under `DataKey::ContractVersion`.
pub const CONTRACT_STATE_VERSION: &str = "v1";

/// Build the schema-version `Symbol` used as topic position 1 on every event.
fn event_version(env: &Env) -> Symbol {
    Symbol::new(env, EVENT_SCHEMA_VERSION)
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Pool(u32),
    UserBet(u32, Address),
    PoolCounter,
    Token,
    Treasury,
    TreasuryRecipient,
    DelegatedSettler(u32),
    FreezeAdmin,
    /// #179 — per-pool creation fee in stroops. Set by the admin via
    /// `set_creation_fee`; defaults to 0 (no fee) when absent.
    CreationFee,
    /// #167 — protocol fee in basis points. Set by the treasury recipient via
    /// `set_protocol_fee`; defaults to 200 (2%) when absent.
    ProtocolFee,
    /// #158 — per-pool claim / payout progress for winner claims.
    PoolPayoutState(u32),
    /// #195 — floor(bps × pool volume) protocol fee for this market (set at settlement).
    PoolSettlementProtocolFee(u32),
    /// #195 — running total credited to aggregate `Treasury` from this pool (fee + dust).
    PoolTreasuryCredited(u32),
    /// #191 — contract state schema version stored on-chain for compatibility checks.
    ContractVersion,
    /// #176 — who triggered settlement for this pool (Creator or Operator).
    PoolSettlementSource(u32),
}

// #189 — TTL bump policy for persistent storage entries.
// Ledger closes every ~5 seconds on Stellar mainnet: 17,280 ledgers ≈ 1 day.
// Active pool records and user positions are extended to POOL_BUMP_TARGET
// whenever their remaining TTL falls below POOL_BUMP_THRESHOLD.
//
// Assumption: active pools and user positions must survive at least until the
// pool is settled and all participants have claimed. 30 days is a safe upper
// bound for most markets; operators running longer markets should call
// bump-only maintenance transactions before the threshold is reached.
const LEDGERS_PER_DAY: u32 = 17_280;
const POOL_BUMP_TARGET: u32 = LEDGERS_PER_DAY * 30; // extend to 30 days
const POOL_BUMP_THRESHOLD: u32 = LEDGERS_PER_DAY * 25; // trigger bump when < 25 days remain

/// #167 — Protocol fee bounds in basis points.
/// Minimum fee: 0 (0%) — no fee floor, allows fee-free operation.
/// Maximum fee: 1000 (10%) — protects users from excessive fees.
/// Default fee: 200 (2%) — matches the original hard-coded value.
const PROTOCOL_FEE_MIN_BPS: u32 = 0;
const PROTOCOL_FEE_MAX_BPS: u32 = 1000;
const PROTOCOL_FEE_DEFAULT_BPS: u32 = 200;

/// #151 — Minimum pool lifetime in seconds (matches `web/docs/POOL_DURATION.md`).
const MIN_POOL_DURATION_SECS: u64 = 300;
/// #151 — Maximum pool lifetime in seconds (matches web validators / tests).
const MAX_POOL_DURATION_SECS: u64 = 1_000_000;

/// #154 — Maximum length for pool title in bytes.
const MAX_TITLE_LENGTH: u32 = 100;
/// #154 — Maximum length for pool description in bytes.
const MAX_DESCRIPTION_LENGTH: u32 = 1_000;
/// #154 — Maximum length for pool outcome labels in bytes.
const MAX_OUTCOME_LENGTH: u32 = 50;

/// #156 — Typed contract error model. Replaces string panics for all failure
/// paths so SDK consumers can match on a stable error code rather than parsing
/// panic strings, and so error compatibility is preserved across upgrades.
#[contracterror]
#[derive(Clone, Debug, PartialEq)]
pub enum ContractError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    FeeOutOfBounds = 4,
    InvalidBetAmount = 5,
    InvalidOutcome = 6,
    PoolExpired = 7,
    PoolNotExpired = 8,
    PoolNotFound = 9,
    PoolNotOpen = 10,
    PoolAlreadySettled = 11,
    PoolAlreadyVoided = 12,
    PoolAlreadyFrozen = 13,
    PoolAlreadyDisputed = 14,
    PoolIsCancelled = 15,
    PoolIsFrozen = 16,
    PoolIsDisputed = 17,
    PoolNotSettled = 18,
    PoolNotFrozenOrDisputed = 19,
    PoolHasBets = 20,
    PoolCannotBeVoided = 21,
    PoolMustBeSettledToDispute = 22,
    NoBetFound = 23,
    NothingToRefund = 24,
    NoWinningsToClaim = 25,
    InsufficientTreasuryBalance = 26,
    InvalidWithdrawalAmount = 27,
    FreezeAdminNotSet = 28,
    TitleEmpty = 29,
    TitleTooLong = 30,
    DescriptionEmpty = 31,
    DescriptionTooLong = 32,
    OutcomeEmpty = 33,
    OutcomeTooLong = 34,
    DuplicateOutcomeLabels = 35,
    DurationTooShort = 36,
    DurationTooLong = 37,
    FeeMustBeNonNegative = 38,
    StringWhitespaceOnly = 39,
    ExpiryOverflow = 40,
    PoolTotalOverflow = 41,
    UserBetOverflow = 42,
    TreasuryOverflow = 43,
}

/// #176 — Settlement source tag indicating who initiated pool settlement.
/// Stored on-chain alongside the winning outcome so indexers and dashboards
/// can distinguish creator-initiated settlements from delegated-operator ones,
/// and leave a slot open for future oracle paths without a schema bump.
#[derive(Clone, PartialEq, Debug)]
#[contracttype]
pub enum SettlementSource {
    /// Pool creator called `settle_pool` directly.
    Creator,
    /// A delegated operator (assigned via `assign_settler`) called `settle_pool`.
    Operator,
}

/// Explicit lifecycle status for a prediction pool.
///
/// Transitions:
///   Open  ──(cancel_pool)──►  Cancelled  (terminal)
///   Open  ──(void_pool called)──►  Voided
///   Open  ──(expiry reached + settle_pool called)──►  Settled(winning_outcome)
///   Open  ──(freeze_pool called)──►  Frozen
///   Settled  ──(dispute_pool called)──►  Disputed
///   Frozen/Disputed  ──(unfreeze_pool called)──►  Open
///
/// Cancelled, Settled, and Voided are terminal states.
#[derive(Clone, PartialEq, Debug)]
#[contracttype]
pub enum PoolStatus {
    /// Accepting bets; expiry has not yet passed.
    Open,
    /// Betting closed and a winning outcome has been declared.
    Settled(u32),
    /// Creator voided the pool; all participants can claim a full refund.
    Voided,
    /// Pool is temporarily frozen, blocking bets and claims.
    Frozen,
    /// Pool settlement is disputed, blocking claims pending review.
    Disputed,
    /// #160 — Creator cancelled the pool before any bet was placed. Terminal.
    Cancelled,
}

#[derive(Clone)]
#[contracttype]
pub struct Pool {
    pub creator: Address,
    pub title: String,
    pub description: String,
    pub outcome_a_name: String,
    pub outcome_b_name: String,
    pub total_a: i128,
    pub total_b: i128,
    pub participant_count: u32,
    pub settled: bool,
    pub winning_outcome: Option<u32>,
    pub created_at: u64,
    pub expiry: u64,
    /// Current operational status of the pool. Defaults to `Open`.
    pub status: PoolStatus,
}

/// Claim status for a user in a specific pool.
///
/// Transitions (winner):
///   NeverBet  ──(place_bet)──►  Claimable  ──(claim_winnings)──►  AlreadyClaimed
/// Transitions (loser):
///   NeverBet  ──(place_bet)──►  NotEligible
/// Transitions (voided pool):
///   NeverBet  ──(place_bet)──►  RefundClaimable  ──(claim_refund)──►  AlreadyClaimed
#[derive(Clone, PartialEq, Debug)]
#[contracttype]
pub enum ClaimStatus {
    /// User has never placed a bet in this pool.
    NeverBet,
    /// Pool is settled, user bet on the winning side, and has not yet claimed.
    Claimable,
    /// Pool is voided, user has a stake, and has not yet claimed a refund.
    RefundClaimable,
    /// User bet on the losing side; no winnings available.
    NotEligible,
    /// User has already claimed (bet record removed).
    AlreadyClaimed,
}

#[derive(Clone)]
#[contracttype]
pub struct UserBet {
    pub amount_a: i128,
    pub amount_b: i128,
    pub total_bet: i128,
}

/// #172 — Position entry returned by `get_user_pools`.
///
/// Fields
/// ------
/// - `pool_id`   – the pool in which the user holds a position
/// - `amount_a`  – user's stake on outcome A
/// - `amount_b`  – user's stake on outcome B
/// - `total_bet` – total tokens staked by the user in this pool
///
/// This struct mirrors `UserBet` but carries the `pool_id` so dashboard
/// consumers can reconstruct the full position model from a single call.
#[derive(Clone)]
#[contracttype]
pub struct UserPoolPosition {
    pub pool_id: u32,
    pub amount_a: i128,
    pub amount_b: i128,
    pub total_bet: i128,
}

/// #159 — Result type returned by `preview_claimable_amount`.
///
/// Variants
/// --------
/// - `Unclaimable`  – pool is not yet settled (or is frozen/disputed/cancelled);
///                    no payout is available regardless of the user's position.
/// - `NeverBet`     – pool is settled but the user has no position (or already claimed).
/// - `NotEligible`  – pool is settled; user bet on the losing side.
/// - `Claimable(i128)` – pool is settled; user bet on the winning side and the
///                    value equals exactly what `claim_winnings` would transfer.
#[derive(Clone, PartialEq, Debug)]
#[contracttype]
pub enum ClaimPreview {
    /// Pool is not in a settled state; payout cannot be computed yet.
    Unclaimable,
    /// User has no active position in this pool (never bet or already claimed).
    NeverBet,
    /// User bet on the losing side; no payout available.
    NotEligible,
    /// User bet on the winning side; value is the exact transferable amount.
    Claimable(i128),
}

/// #158 — Per-pool payout tracking state for reconciliation.
///
/// Tracks cumulative claimed winning stake and paid out amounts
/// across multiple claims to enable fee-on-first-claim and dust-sweep-on-last.
#[derive(Clone, Default, PartialEq)]
#[contracttype]
pub struct PoolPayoutState {
    /// Whether the protocol fee has been credited to treasury for this pool.
    /// The fee is credited only once, on the first winner claim.
    pub fee_credited: bool,
    /// Cumulative winning stake that has been claimed (in terms of the winner's
    /// contribution to the winning side, not the payout amount).
    pub claimed_winning_stake: i128,
    /// Total payout amount that has been distributed to winners.
    pub paid_out: i128,
}

/// Event payload emitted by `claim_winnings`.
///
/// Fields
/// ------
/// - `amount`        – tokens transferred to the claimant
/// - `fee_amount`    – protocol fee credited to treasury (only on first claim)
/// - `winning_outcome` – which outcome was declared the winner (0 or 1)
/// - `total_pool_size` – total tokens in the pool at settlement time
#[derive(Clone)]
#[contracttype]
pub struct ClaimEvent {
    pub amount: i128,
    pub fee_amount: i128,
    pub winning_outcome: u32,
    pub total_pool_size: i128,
}

/// #193 — Global contract configuration returned by `get_config`.
///
/// Provides a single view of all contract configuration values for
/// frontend bootstrapping and diagnostics, replacing multiple reads.
#[derive(Clone)]
#[contracttype]
pub struct ContractConfig {
    /// The token address used for bets and settlements.
    pub token: Address,
    /// The address authorized to receive protocol fees and rotate.
    pub treasury_recipient: Address,
    /// Per-pool creation fee in stroops (0 if not set).
    pub creation_fee: i128,
    /// Protocol fee in basis points (default: 200 = 2%).
    pub protocol_fee_bps: u32,
    /// Event schema version for indexer compatibility.
    pub event_schema_version: Symbol,
    /// #191 — contract state schema version for on-chain compatibility checks.
    pub contract_state_version: Symbol,
}

/// Event payload emitted by `place_bet`.
///
/// Fields
/// ------
/// - `outcome`   – which side was bet on (0 = A, 1 = B)
/// - `amount`    – tokens staked in this single bet
/// - `amount_a`  – user's cumulative stake on outcome A after this bet
/// - `amount_b`  – user's cumulative stake on outcome B after this bet
/// - `total_bet` – user's total exposure in this pool after this bet
///
/// The `amount_a`, `amount_b`, and `total_bet` values are identical to what
/// `get_user_bet` would return immediately after the call, allowing indexers
/// and UI consumers to maintain a local position model from events alone.
#[derive(Clone)]
#[contracttype]
pub struct BetEvent {
    pub outcome: u32,
    pub amount: i128,
    pub total_yes: i128,
    pub total_no: i128,
}

/// #169 — Event payload emitted by `create_pool`.
///
/// Fields
/// ------\n/// - `creator`        – address that created the pool
/// - `expiry`         – unix timestamp when the pool expires
/// - `title`          – short market title
/// - `outcome_a_name` – label for outcome A
/// - `outcome_b_name` – label for outcome B
///
/// This payload allows indexers to populate a lightweight market list entry
/// without performing follow-up reads for every new pool.
#[derive(Clone)]
#[contracttype]
pub struct CreatePoolEvent {
    pub creator: Address,
    pub expiry: u64,
    pub title: String,
    pub outcome_a_name: String,
    pub outcome_b_name: String,
}

/// #195 — Pool-level protocol revenue exposed for analytics and audits.
///
/// `settlement_protocol_fee` is the bps fee amount fixed when the pool is
/// settled (same value emitted on the `settle_pool` event). `treasury_credited`
/// increases as winners claim: protocol fee on the first winner claim, plus
/// payout rounding dust on the final claim — mirroring aggregate `Treasury`.
#[derive(Clone)]
#[contracttype]
pub struct PoolProtocolRevenue {
    pub settlement_protocol_fee: i128,
    pub treasury_credited: i128,
}

/// #176 — Event payload emitted by `settle_pool`, enriched with settlement source metadata.
#[derive(Clone)]
#[contracttype]
pub struct SettlePoolEvent {
    pub caller: Address,
    pub winning_outcome: u32,
    pub winning_side_total: i128,
    pub total_pool_volume: i128,
    pub fee_amount: i128,
    /// Whether the caller was the pool creator or a delegated operator.
    pub source: SettlementSource,
}

/// #194 — Per-pool result returned by `claim_all_winnings`.
#[derive(Clone)]
#[contracttype]
pub struct ClaimAllEntry {
    pub pool_id: u32,
    pub amount: i128,
}

#[contract]
pub struct PredinexContract;

#[contractimpl]
impl PredinexContract {
    pub fn initialize(
        env: Env,
        token: Address,
        treasury_recipient: Address,
    ) -> Result<(), ContractError> {
        if env.storage().persistent().has(&DataKey::Token) {
            return Err(ContractError::AlreadyInitialized);
        }
        env.storage().persistent().set(&DataKey::Token, &token);
        env.storage()
            .persistent()
            .set(&DataKey::TreasuryRecipient, &treasury_recipient);
        env.storage().persistent().set(&DataKey::Treasury, &0i128);
        // #191 — persist the contract state schema version on initialization.
        env.storage().persistent().set(
            &DataKey::ContractVersion,
            &Symbol::new(&env, CONTRACT_STATE_VERSION),
        );
        Ok(())
    }

    /// #179 — Set the per-pool creation fee (in stroops). Only the treasury
    /// recipient may call this so the admin key is the same as the withdrawal
    /// destination, keeping the permission model simple.
    /// Pass 0 to remove the fee requirement.
    pub fn set_creation_fee(env: Env, caller: Address, fee: i128) -> Result<(), ContractError> {
        caller.require_auth();
        let treasury_recipient: Address = env
            .storage()
            .persistent()
            .get(&DataKey::TreasuryRecipient)
            .ok_or(ContractError::NotInitialized)?;
        if caller != treasury_recipient {
            return Err(ContractError::Unauthorized);
        }
        if fee < 0 {
            return Err(ContractError::FeeMustBeNonNegative);
        }
        env.storage().persistent().set(&DataKey::CreationFee, &fee);
        Ok(())
    }

    /// #179 — Return the current creation fee in stroops (0 if not set).
    pub fn get_creation_fee(env: Env) -> i128 {
        env.storage()
            .persistent()
            .get::<_, i128>(&DataKey::CreationFee)
            .unwrap_or(0)
    }

    /// #167 — Set the protocol fee in basis points.
    ///
    /// Only the treasury recipient may call this. The fee must be within
    /// [PROTOCOL_FEE_MIN_BPS, PROTOCOL_FEE_MAX_BPS] (0–1000 basis points, i.e., 0–10%).
    /// The fee applies to future settlements and claims; existing settled pools
    /// are not affected.
    ///
    /// # Arguments
    /// * `caller` – must be the current treasury recipient
    /// * `fee_bps` – new fee in basis points (1 bp = 0.01%)
    ///
    /// # Panics
    /// * "Unauthorized" – if caller is not the treasury recipient
    /// * "Fee out of bounds" – if fee_bps is outside [0, 1000]
    pub fn set_protocol_fee(env: Env, caller: Address, fee_bps: u32) -> Result<(), ContractError> {
        caller.require_auth();
        let treasury_recipient: Address = env
            .storage()
            .persistent()
            .get(&DataKey::TreasuryRecipient)
            .ok_or(ContractError::NotInitialized)?;
        if caller != treasury_recipient {
            return Err(ContractError::Unauthorized);
        }
        if !(PROTOCOL_FEE_MIN_BPS..=PROTOCOL_FEE_MAX_BPS).contains(&fee_bps) {
            return Err(ContractError::FeeOutOfBounds);
        }
        env.storage()
            .persistent()
            .set(&DataKey::ProtocolFee, &fee_bps);

        env.events()
            .publish((Symbol::new(&env, "protocol_fee_set"),), (caller, fee_bps));
        Ok(())
    }

    /// #166 — Return the current protocol fee in basis points.
    ///
    /// The returned value is the canonical source of truth for fee display
    /// in frontends and analytics. Use `get_protocol_fee` to preview fees
    /// before placing bets or claiming winnings.
    ///
    /// # Returns
    /// The protocol fee in basis points (default: 200 = 2%).
    pub fn get_protocol_fee(env: Env) -> u32 {
        env.storage()
            .persistent()
            .get::<_, u32>(&DataKey::ProtocolFee)
            .unwrap_or(PROTOCOL_FEE_DEFAULT_BPS)
    }

    /// #193 — Return the complete contract configuration in a single call.
    ///
    /// Provides all configuration values needed for frontend bootstrapping
    /// and diagnostics. This replaces multiple individual reads and provides
    /// a stable interface for consumers.
    ///
    /// # Returns
    /// `ContractConfig` with token address, treasury recipient, creation fee,
    /// protocol fee, and event schema version.
    pub fn get_config(env: Env) -> Result<ContractConfig, ContractError> {
        let token: Address = env
            .storage()
            .persistent()
            .get(&DataKey::Token)
            .ok_or(ContractError::NotInitialized)?;
        let treasury_recipient: Address = env
            .storage()
            .persistent()
            .get(&DataKey::TreasuryRecipient)
            .ok_or(ContractError::NotInitialized)?;
        let creation_fee: i128 = env
            .storage()
            .persistent()
            .get::<_, i128>(&DataKey::CreationFee)
            .unwrap_or(0);
        let protocol_fee_bps: u32 = env
            .storage()
            .persistent()
            .get::<_, u32>(&DataKey::ProtocolFee)
            .unwrap_or(PROTOCOL_FEE_DEFAULT_BPS);

        Ok(ContractConfig {
            token,
            treasury_recipient,
            creation_fee,
            protocol_fee_bps,
            event_schema_version: Symbol::new(&env, EVENT_SCHEMA_VERSION),
            contract_state_version: env
                .storage()
                .persistent()
                .get(&DataKey::ContractVersion)
                .unwrap_or(Symbol::new(&env, CONTRACT_STATE_VERSION)),
        })
    }

    /// Normalize a Soroban `String` to a comparable form by converting to
    /// lowercase bytes and stripping leading/trailing ASCII spaces.
    /// Uses a fixed 64-byte stack buffer — outcome labels longer than 64 bytes
    /// are compared on their first 64 bytes only, which is sufficient for
    /// practical market labels.
    fn normalize_outcome(env: &Env, s: &String) -> soroban_sdk::Bytes {
        let len = s.len() as usize;
        let mut raw = vec![0u8; len];
        s.copy_into_slice(&mut raw);
        let copy_len = if len < 64 { len } else { 64 };
        let mut buf = [0u8; 64];
        let mut i = 0usize;
        while i < copy_len {
            buf[i] = raw[i];
            i += 1;
        }

        let mut start = 0usize;
        let mut end = copy_len;
        while start < end && buf[start] == b' ' {
            start += 1;
        }
        while end > start && buf[end - 1] == b' ' {
            end -= 1;
        }

        let mut result = soroban_sdk::Bytes::new(env);
        let mut i = start;
        while i < end {
            let b = buf[i];
            let lower = if b.is_ascii_uppercase() { b + 32 } else { b };
            result.push_back(lower);
            i += 1;
        }
        result
    }

    /// Validate that a string is not empty or whitespace-only.
    fn validate_non_empty_string(s: &String, empty_err: ContractError, ws_err: ContractError) -> Result<(), ContractError> {
        let len = s.len() as usize;
        if len == 0 {
            return Err(empty_err);
        }

        let mut raw = vec![0u8; len];
        s.copy_into_slice(&mut raw);
        let mut has_non_whitespace = false;
        let mut i = 0usize;
        while i < len {
            let b = raw[i];
            if b != b' ' && b != b'\t' && b != b'\n' && b != b'\r' {
                has_non_whitespace = true;
                break;
            }
            i += 1;
        }

        if !has_non_whitespace {
            return Err(ws_err);
        }
        Ok(())
    }

    pub fn create_pool(
        env: Env,
        creator: Address,
        title: String,
        description: String,
        outcome_a: String,
        outcome_b: String,
        duration: u64,
    ) -> Result<u32, ContractError> {
        creator.require_auth();

        Self::validate_non_empty_string(&title, ContractError::TitleEmpty, ContractError::StringWhitespaceOnly)?;
        if title.len() > MAX_TITLE_LENGTH {
            return Err(ContractError::TitleTooLong);
        }

        Self::validate_non_empty_string(&description, ContractError::DescriptionEmpty, ContractError::StringWhitespaceOnly)?;
        if description.len() > MAX_DESCRIPTION_LENGTH {
            return Err(ContractError::DescriptionTooLong);
        }

        Self::validate_non_empty_string(&outcome_a, ContractError::OutcomeEmpty, ContractError::StringWhitespaceOnly)?;
        Self::validate_non_empty_string(&outcome_b, ContractError::OutcomeEmpty, ContractError::StringWhitespaceOnly)?;
        if outcome_a.len() > MAX_OUTCOME_LENGTH || outcome_b.len() > MAX_OUTCOME_LENGTH {
            return Err(ContractError::OutcomeTooLong);
        }

        if duration < MIN_POOL_DURATION_SECS {
            return Err(ContractError::DurationTooShort);
        }

        if Self::normalize_outcome(&env, &outcome_a) == Self::normalize_outcome(&env, &outcome_b) {
            return Err(ContractError::DuplicateOutcomeLabels);
        }

        // #179 — collect creation fee before writing any state so a rejection
        // leaves the contract untouched.
        let creation_fee: i128 = env
            .storage()
            .persistent()
            .get::<_, i128>(&DataKey::CreationFee)
            .unwrap_or(0);

        if creation_fee > 0 {
            let token_address: Address = env
                .storage()
                .persistent()
                .get(&DataKey::Token)
                .ok_or(ContractError::NotInitialized)?;
            let token_client = token::Client::new(&env, &token_address);
            let treasury_recipient: Address = env
                .storage()
                .persistent()
                .get(&DataKey::TreasuryRecipient)
                .ok_or(ContractError::NotInitialized)?;
            token_client.transfer(&creator, &treasury_recipient, &creation_fee);
        }

        let pool_id = Self::get_pool_counter(&env);

        if duration == 0 || duration > MAX_POOL_DURATION_SECS {
            return Err(ContractError::DurationTooLong);
        }

        let created_at = env.ledger().timestamp();
        let expiry = created_at
            .checked_add(duration)
            .ok_or(ContractError::ExpiryOverflow)?;

        let pool = Pool {
            creator: creator.clone(),
            title: title.clone(),
            description,
            outcome_a_name: outcome_a.clone(),
            outcome_b_name: outcome_b.clone(),
            total_a: 0,
            total_b: 0,
            participant_count: 0,
            settled: false,
            winning_outcome: None,
            created_at,
            expiry,
            status: PoolStatus::Open,
        };

        env.storage()
            .persistent()
            .set(&DataKey::Pool(pool_id), &pool);
        // #189 — extend TTL to 30 days at creation time.
        env.storage().persistent().extend_ttl(
            &DataKey::Pool(pool_id),
            POOL_BUMP_THRESHOLD,
            POOL_BUMP_TARGET,
        );

        env.storage()
            .persistent()
            .set(&DataKey::PoolCounter, &(pool_id + 1));

        // #169 — emit enriched create_pool event with expiry and metadata summary
        env.events().publish(
            (Symbol::new(&env, "create_pool"), pool_id),
            CreatePoolEvent {
                creator: creator.clone(),
                expiry,
                title,
                outcome_a_name: outcome_a,
                outcome_b_name: outcome_b,
            },
        );

        Ok(pool_id)
    }

    pub fn place_bet(
        env: Env,
        user: Address,
        pool_id: u32,
        outcome: u32,
        amount: i128,
    ) -> Result<(), ContractError> {
        user.require_auth();

        if amount <= 0 {
            return Err(ContractError::InvalidBetAmount);
        }

        let mut pool = env
            .storage()
            .persistent()
            .get::<_, Pool>(&DataKey::Pool(pool_id))
            .ok_or(ContractError::PoolNotFound)?;

        if pool.status != PoolStatus::Open {
            return Err(ContractError::PoolNotOpen);
        }

        if env.ledger().timestamp() >= pool.expiry {
            return Err(ContractError::PoolExpired);
        }

        if outcome > 1 {
            return Err(ContractError::InvalidOutcome);
        }

        let token_address = env
            .storage()
            .persistent()
            .get::<_, Address>(&DataKey::Token)
            .ok_or(ContractError::NotInitialized)?;
        let token_client = token::Client::new(&env, &token_address);

        token_client.transfer(&user, &env.current_contract_address(), &amount);

        if outcome == 0 {
            pool.total_a = pool
                .total_a
                .checked_add(amount)
                .ok_or(ContractError::PoolTotalOverflow)?;
        } else {
            pool.total_b = pool
                .total_b
                .checked_add(amount)
                .ok_or(ContractError::PoolTotalOverflow)?;
        }

        let mut user_bet = env
            .storage()
            .persistent()
            .get::<_, UserBet>(&DataKey::UserBet(pool_id, user.clone()))
            .unwrap_or(UserBet {
                amount_a: 0,
                amount_b: 0,
                total_bet: 0,
            });

        let is_first_bet = user_bet.total_bet == 0;
        if is_first_bet {
            pool.participant_count += 1;
        }

        env.storage()
            .persistent()
            .set(&DataKey::Pool(pool_id), &pool);
        // #189 — keep pool TTL alive on every write.
        env.storage().persistent().extend_ttl(
            &DataKey::Pool(pool_id),
            POOL_BUMP_THRESHOLD,
            POOL_BUMP_TARGET,
        );

        if outcome == 0 {
            user_bet.amount_a = user_bet
                .amount_a
                .checked_add(amount)
                .ok_or(ContractError::UserBetOverflow)?;
        } else {
            user_bet.amount_b = user_bet
                .amount_b
                .checked_add(amount)
                .ok_or(ContractError::UserBetOverflow)?;
        }
        user_bet.total_bet = user_bet
            .total_bet
            .checked_add(amount)
            .ok_or(ContractError::UserBetOverflow)?;

        env.storage()
            .persistent()
            .set(&DataKey::UserBet(pool_id, user.clone()), &user_bet);
        // #189 — user position must survive at least as long as the pool.
        env.storage().persistent().extend_ttl(
            &DataKey::UserBet(pool_id, user.clone()),
            POOL_BUMP_THRESHOLD,
            POOL_BUMP_TARGET,
        );

        // Calculate totals for the event
        let total_yes = pool.total_a;
        let total_no = pool.total_b;

        env.events().publish(
            (
                Symbol::new(&env, "place_bet"),
                event_version(&env),
                pool_id,
                user,
            ),
            BetEvent {
                outcome,
                amount,
                total_yes,
                total_no,
            },
        );
        Ok(())
    }

    /// #160 — Cancel a pool before it is settled.
    ///
    /// Only the pool creator may call this, and only while both outcome totals
    /// remain at zero (i.e. no participant has entered the pool). Once cancelled
    /// the pool transitions to the `Cancelled` terminal state; it cannot be
    /// settled, voided, or bet into afterward. A `cancel_pool` event is emitted
    /// so indexers and the UI can update their state immediately.
    pub fn cancel_pool(env: Env, creator: Address, pool_id: u32) -> Result<(), ContractError> {
    /// Only the pool creator may call this, and only while the pool is still open.
    /// Once cancelled the pool transitions to the `Cancelled` terminal state; it cannot be
    /// settled, voided, or bet into afterward. Participants can claim refunds of their
    /// original bet amounts. A `cancel_pool` event is emitted so indexers and the UI
    /// can update their state immediately.
    pub fn cancel_pool(env: Env, creator: Address, pool_id: u32) {
        creator.require_auth();

        let mut pool = env
            .storage()
            .persistent()
            .get::<_, Pool>(&DataKey::Pool(pool_id))
            .ok_or(ContractError::PoolNotFound)?;

        if creator != pool.creator {
            return Err(ContractError::Unauthorized);
        }

        if pool.status != PoolStatus::Open {
            return Err(ContractError::PoolNotOpen);
        }

        if pool.total_a > 0 || pool.total_b > 0 {
            return Err(ContractError::PoolHasBets);
        }

        pool.status = PoolStatus::Cancelled;
        env.storage()
            .persistent()
            .set(&DataKey::Pool(pool_id), &pool);
        // #189 — cancelled pool must stay accessible for refund claims.
        env.storage().persistent().extend_ttl(
            &DataKey::Pool(pool_id),
            POOL_BUMP_THRESHOLD,
            POOL_BUMP_TARGET,
        );

        env.events().publish(
            (
                Symbol::new(&env, "cancel_pool"),
                event_version(&env),
                pool_id,
            ),
            creator,
        );
        Ok(())
    }

    /// Assign a delegated settler for a pool. Only the pool creator can call this.
    pub fn assign_settler(
        env: Env,
        creator: Address,
        pool_id: u32,
        settler: Address,
    ) -> Result<(), ContractError> {
        creator.require_auth();

        let pool = env
            .storage()
            .persistent()
            .get::<_, Pool>(&DataKey::Pool(pool_id))
            .ok_or(ContractError::PoolNotFound)?;

        if creator != pool.creator {
            return Err(ContractError::Unauthorized);
        }

        env.storage()
            .persistent()
            .set(&DataKey::DelegatedSettler(pool_id), &settler);

        env.events().publish(
            (
                Symbol::new(&env, "assign_settler"),
                event_version(&env),
                pool_id,
            ),
            (creator, settler),
        );
        Ok(())
    }

    /// Get the delegated settler for a pool, if one has been assigned.
    pub fn get_delegated_settler(env: Env, pool_id: u32) -> Option<Address> {
        env.storage()
            .persistent()
            .get(&DataKey::DelegatedSettler(pool_id))
    }

    pub fn settle_pool(
        env: Env,
        caller: Address,
        pool_id: u32,
        winning_outcome: u32,
    ) -> Result<(), ContractError> {
        caller.require_auth();

        let mut pool = env
            .storage()
            .persistent()
            .get::<_, Pool>(&DataKey::Pool(pool_id))
            .ok_or(ContractError::PoolNotFound)?;

        let delegated_settler: Option<Address> = env
            .storage()
            .persistent()
            .get(&DataKey::DelegatedSettler(pool_id));

        // #176 — determine the settlement source before the auth check so we
        // can record it on-chain and in the event without a second read.
        let source = if caller == pool.creator {
            SettlementSource::Creator
        } else if delegated_settler.as_ref().map(|s| s == &caller).unwrap_or(false) {
            SettlementSource::Operator
        } else {
            return Err(ContractError::Unauthorized);
        };

        if pool.status != PoolStatus::Open {
            return Err(ContractError::PoolAlreadySettled);
        }

        if env.ledger().timestamp() < pool.expiry {
            return Err(ContractError::PoolNotExpired);
        }

        if winning_outcome > 1 {
            return Err(ContractError::InvalidOutcome);
        }

        pool.status = PoolStatus::Settled(winning_outcome);
        pool.settled = true;
        pool.winning_outcome = Some(winning_outcome);

        // #171 — compute totals for the enriched settlement event.
        // #167 — use configurable protocol fee instead of hard-coded 2%.
        let winning_side_total = if winning_outcome == 0 {
            pool.total_a
        } else {
            pool.total_b
        };
        let total_pool_volume = pool.total_a + pool.total_b;
        let fee_bps = Self::get_protocol_fee(env.clone()) as i128;
        let fee_amount = (total_pool_volume * fee_bps) / 10000;

        env.storage()
            .persistent()
            .set(&DataKey::Pool(pool_id), &pool);
        // #195 — record the market's protocol fee for pool-level reporting.
        env.storage()
            .persistent()
            .set(&DataKey::PoolSettlementProtocolFee(pool_id), &fee_amount);
        env.storage().persistent().extend_ttl(
            &DataKey::PoolSettlementProtocolFee(pool_id),
            POOL_BUMP_THRESHOLD,
            POOL_BUMP_TARGET,
        );
        // #176 — persist the settlement source so it can be queried off-chain
        // without replaying event history.
        env.storage()
            .persistent()
            .set(&DataKey::PoolSettlementSource(pool_id), &source);
        env.storage().persistent().extend_ttl(
            &DataKey::PoolSettlementSource(pool_id),
            POOL_BUMP_THRESHOLD,
            POOL_BUMP_TARGET,
        );
        // #189 — keep pool accessible for claim operations after settlement.
        env.storage().persistent().extend_ttl(
            &DataKey::Pool(pool_id),
            POOL_BUMP_THRESHOLD,
            POOL_BUMP_TARGET,
        );

        // #176 — emit enriched settlement event including source metadata.
        env.events().publish(
            (
                Symbol::new(&env, "settle_pool"),
                event_version(&env),
                pool_id,
            ),
            SettlePoolEvent {
                caller,
                winning_outcome,
                winning_side_total,
                total_pool_volume,
                fee_amount,
                source,
            },
        );
        Ok(())
    }

    /// #176 — Return the settlement source for a pool, or `None` if not yet settled.
    pub fn get_settlement_source(env: Env, pool_id: u32) -> Option<SettlementSource> {
        env.storage()
            .persistent()
            .get(&DataKey::PoolSettlementSource(pool_id))
    }

    /// Mark a pool as void. Only the creator may call this before the pool is
    /// settled or already voided. Once voided, users call `claim_refund` to
    /// recover their original stakes in full.
    pub fn void_pool(env: Env, caller: Address, pool_id: u32) -> Result<(), ContractError> {
        caller.require_auth();

        let mut pool = env
            .storage()
            .persistent()
            .get::<_, Pool>(&DataKey::Pool(pool_id))
            .ok_or(ContractError::PoolNotFound)?;

        if caller != pool.creator {
            return Err(ContractError::Unauthorized);
        }

        match pool.status {
            PoolStatus::Open => {}
            PoolStatus::Voided => return Err(ContractError::PoolAlreadyVoided),
            PoolStatus::Cancelled => return Err(ContractError::PoolIsCancelled),
            _ => return Err(ContractError::PoolCannotBeVoided),
        }

        pool.status = PoolStatus::Voided;
        env.storage()
            .persistent()
            .set(&DataKey::Pool(pool_id), &pool);
        // #189 — voided pool must stay accessible for refund claims.
        env.storage().persistent().extend_ttl(
            &DataKey::Pool(pool_id),
            POOL_BUMP_THRESHOLD,
            POOL_BUMP_TARGET,
        );

        env.events().publish(
            (Symbol::new(&env, "void_pool"), event_version(&env), pool_id),
            caller,
        );
        Ok(())
    }

    /// Refund a user's original stake from a voided or cancelled pool. No fee is taken.
    /// The bet entry is removed after the refund to prevent double-claims.
    pub fn claim_refund(env: Env, user: Address, pool_id: u32) -> Result<i128, ContractError> {
        user.require_auth();

        let pool = env
            .storage()
            .persistent()
            .get::<_, Pool>(&DataKey::Pool(pool_id))
            .ok_or(ContractError::PoolNotFound)?;

        if pool.status != PoolStatus::Voided {
            return Err(ContractError::PoolNotSettled);
        if pool.status != PoolStatus::Voided && pool.status != PoolStatus::Cancelled {
            panic!("Pool not voided or cancelled");
        }

        let user_bet = env
            .storage()
            .persistent()
            .get::<_, UserBet>(&DataKey::UserBet(pool_id, user.clone()))
            .ok_or(ContractError::NoBetFound)?;

        let refund = user_bet.total_bet;
        if refund == 0 {
            return Err(ContractError::NothingToRefund);
        }

        let token_address = env
            .storage()
            .persistent()
            .get::<_, Address>(&DataKey::Token)
            .ok_or(ContractError::NotInitialized)?;
        let token_client = token::Client::new(&env, &token_address);

        token_client.transfer(&env.current_contract_address(), &user, &refund);

        env.storage()
            .persistent()
            .remove(&DataKey::UserBet(pool_id, user.clone()));

        env.events().publish(
            (
                Symbol::new(&env, "claim_refund"),
                event_version(&env),
                pool_id,
                user,
            ),
            refund,
        );

        Ok(refund)
    }

    /// Claim winnings from a settled pool.
    ///
    /// # Atomicity note (#200)
    /// Soroban transactions are fully atomic: if any step panics the entire
    /// transaction is rolled back, so treasury state and token balances can
    /// never diverge due to a partial execution. The ordering below is
    /// nevertheless chosen to be defensively correct in isolation:
    ///
    ///   1. All reads and validations (no mutations yet).
    ///   2. Token transfer to the winner — if this fails, no state has changed.
    ///   3. Update the per-pool payout state (#158) so reconciliation holds.
    ///   4. Treasury ledger update — fee credited *once* per pool, plus the
    ///      payout-rounding dust on the final claim.
    ///   5. Remove the bet record — prevents any future duplicate-claim attempt.
    ///   6. Emit events — always last so they reflect final committed state.
    ///
    /// # Payout rounding policy (#158)
    /// Per-claim payout is computed via integer floor division:
    ///
    ///     winnings = floor(user_winning_bet * net_pool_balance / pool_winning_total)
    ///
    /// where `net_pool_balance = total_pool_balance - fee` and
    /// `fee = floor(total_pool_balance * 2 / 100)`. Because every claim rounds
    /// down, the sum of winner payouts can be up to `n_winners - 1` token
    /// units below `net_pool_balance`. That residual ("payout dust") is
    /// **swept to the treasury** on the claim that brings the cumulative
    /// claimed winning stake up to `pool_winning_total` (i.e. the final
    /// winner). The 2 % protocol fee is credited to the treasury only on the
    /// **first** claim. After every winner has claimed:
    ///
    ///     total_pool_balance == fee + payout_dust + sum(payouts)
    ///     contract_balance_attributable_to_pool == fee + payout_dust
    ///                                           == treasury_credit_for_pool
    ///
    /// See `web/docs/PAYOUT_ROUNDING.md` for indexer / UI guidance.
    pub fn claim_winnings(env: Env, user: Address, pool_id: u32) -> Result<i128, ContractError> {
        user.require_auth();

        let pool = env
            .storage()
            .persistent()
            .get::<_, Pool>(&DataKey::Pool(pool_id))
            .ok_or(ContractError::PoolNotFound)?;

        let winning_outcome = match pool.status {
            PoolStatus::Settled(outcome) => outcome,
            PoolStatus::Frozen => return Err(ContractError::PoolIsFrozen),
            PoolStatus::Disputed => return Err(ContractError::PoolIsDisputed),
            PoolStatus::Cancelled => return Err(ContractError::PoolIsCancelled),
            _ => return Err(ContractError::PoolNotSettled),
        };

        let user_bet = env
            .storage()
            .persistent()
            .get::<_, UserBet>(&DataKey::UserBet(pool_id, user.clone()))
            .ok_or(ContractError::NoBetFound)?;

        let user_winning_bet = if winning_outcome == 0 {
            user_bet.amount_a
        } else {
            user_bet.amount_b
        };

        if user_winning_bet == 0 {
            return Err(ContractError::NoWinningsToClaim);
        }

        let pool_winning_total = if winning_outcome == 0 {
            pool.total_a
        } else {
            pool.total_b
        };
        let total_pool_balance = pool.total_a + pool.total_b;

        let fee_bps = Self::get_protocol_fee(env.clone()) as i128;
        let fee = (total_pool_balance * fee_bps) / 10000;
        let net_pool_balance = total_pool_balance - fee;

        let winnings = (user_winning_bet * net_pool_balance) / pool_winning_total;

        // #158 — load (or default) the per-pool payout state and figure out
        // (a) whether this is the first claim (so we credit the fee), and
        // (b) whether this is the final claim (so we sweep payout dust).
        // Decide both *before* any mutation so the math is straightforward.
        let mut payout_state: PoolPayoutState = env
            .storage()
            .persistent()
            .get(&DataKey::PoolPayoutState(pool_id))
            .unwrap_or_default();

        let is_first_claim = !payout_state.fee_credited;
        let new_claimed_winning_stake = payout_state.claimed_winning_stake + user_winning_bet;
        let new_paid_out = payout_state.paid_out + winnings;
        let is_final_claim = new_claimed_winning_stake == pool_winning_total;

        // The dust is the residual of the floor-division payouts. By
        // construction it is non-negative and strictly less than `n_winners`
        // token units. It is swept to the treasury exclusively on the final
        // claim so reconciliation `total_pool_balance == fee + dust + sum(payouts)`
        // holds the moment the last winner withdraws.
        let payout_dust: i128 = if is_final_claim {
            net_pool_balance - new_paid_out
        } else {
            0
        };

        // Step 2: transfer tokens to the winner first. If the transfer fails the
        // transaction reverts and treasury/bet state remain unchanged.
        let token_address = env
            .storage()
            .persistent()
            .get::<_, Address>(&DataKey::Token)
            .ok_or(ContractError::NotInitialized)?;
        let token_client = token::Client::new(&env, &token_address);
        token_client.transfer(&env.current_contract_address(), &user, &winnings);

        // Step 3–4: credit the treasury ledger only after the transfer succeeds.
        // The protocol fee is added once (on the first claim) and payout dust on
        // the final claim — both remain in the contract token balance.
        let treasury_delta = (if is_first_claim { fee } else { 0 }) + payout_dust;
        if treasury_delta > 0 {
            let current_treasury: i128 = env
                .storage()
                .persistent()
                .get(&DataKey::Treasury)
                .unwrap_or(0);
            let next_treasury = current_treasury
                .checked_add(treasury_delta)
                .ok_or(ContractError::TreasuryOverflow)?;
            env.storage()
                .persistent()
                .set(&DataKey::Treasury, &next_treasury);

            // #195 — per-pool attribution must move in lockstep with aggregate Treasury.
            let credit_key = DataKey::PoolTreasuryCredited(pool_id);
            let prev_pool_credit: i128 = env.storage().persistent().get(&credit_key).unwrap_or(0);
            let next_pool_credit = prev_pool_credit
                .checked_add(treasury_delta)
                .ok_or(ContractError::TreasuryOverflow)?;
            env.storage()
                .persistent()
                .set(&credit_key, &next_pool_credit);
            env.storage().persistent().extend_ttl(
                &credit_key,
                POOL_BUMP_THRESHOLD,
                POOL_BUMP_TARGET,
            );
        }

        payout_state.claimed_winning_stake = new_claimed_winning_stake;
        payout_state.paid_out = new_paid_out;
        if is_first_claim {
            payout_state.fee_credited = true;
        }
        let payout_key = DataKey::PoolPayoutState(pool_id);
        env.storage().persistent().set(&payout_key, &payout_state);
        env.storage()
            .persistent()
            .extend_ttl(&payout_key, POOL_BUMP_THRESHOLD, POOL_BUMP_TARGET);

        // Step 5: remove the bet record to prevent duplicate claims.
        env.storage()
            .persistent()
            .remove(&DataKey::UserBet(pool_id, user.clone()));

        // Step 5: emit events in final committed state.
        env.events().publish(
            (Symbol::new(&env, "claim_winnings"), pool_id, user),
            ClaimEvent {
                amount: winnings,
                fee_amount: fee,
                winning_outcome,
                total_pool_size: total_pool_balance,
            },
        );

        Ok(winnings)
    }

    /// #194 — Claim winnings from multiple settled pools in a single transaction.
    ///
    /// Iterates `pool_ids` and calls the same logic as `claim_winnings` for each
    /// pool where the user has an eligible unclaimed position. Pools where the user
    /// has no position, already claimed, or is not eligible are silently skipped so
    /// a partial batch never reverts the whole transaction.
    ///
    /// Returns a vec of `ClaimAllEntry` (pool_id + amount transferred) for every
    /// pool from which tokens were actually sent. An empty vec means nothing was
    /// claimable. The list is capped at 20 pool IDs per call to bound compute costs.
    pub fn claim_all_winnings(
        env: Env,
        user: Address,
        pool_ids: Vec<u32>,
    ) -> Result<Vec<ClaimAllEntry>, ContractError> {
        user.require_auth();

        let token_address = env
            .storage()
            .persistent()
            .get::<_, Address>(&DataKey::Token)
            .ok_or(ContractError::NotInitialized)?;
        let token_client = token::Client::new(&env, &token_address);

        let mut results = Vec::new(&env);
        let cap = if pool_ids.len() > 20 { 20 } else { pool_ids.len() };

        for i in 0..cap {
            let pool_id = pool_ids.get(i).unwrap();

            let pool: Pool = match env
                .storage()
                .persistent()
                .get(&DataKey::Pool(pool_id))
            {
                Some(p) => p,
                None => continue,
            };

            let winning_outcome = match pool.status {
                PoolStatus::Settled(o) => o,
                _ => continue,
            };

            let user_bet: UserBet = match env
                .storage()
                .persistent()
                .get(&DataKey::UserBet(pool_id, user.clone()))
            {
                Some(b) => b,
                None => continue,
            };

            let user_winning_bet = if winning_outcome == 0 {
                user_bet.amount_a
            } else {
                user_bet.amount_b
            };

            if user_winning_bet == 0 {
                continue;
            }

            let pool_winning_total = if winning_outcome == 0 {
                pool.total_a
            } else {
                pool.total_b
            };
            let total_pool_balance = pool.total_a + pool.total_b;
            let fee_bps = Self::get_protocol_fee(env.clone()) as i128;
            let fee = (total_pool_balance * fee_bps) / 10000;
            let net_pool_balance = total_pool_balance - fee;
            let winnings = (user_winning_bet * net_pool_balance) / pool_winning_total;

            let mut payout_state: PoolPayoutState = env
                .storage()
                .persistent()
                .get(&DataKey::PoolPayoutState(pool_id))
                .unwrap_or_default();

            let is_first_claim = !payout_state.fee_credited;
            let new_claimed_winning_stake = payout_state.claimed_winning_stake + user_winning_bet;
            let new_paid_out = payout_state.paid_out + winnings;
            let is_final_claim = new_claimed_winning_stake == pool_winning_total;
            let payout_dust: i128 = if is_final_claim {
                net_pool_balance - new_paid_out
            } else {
                0
            };

            token_client.transfer(&env.current_contract_address(), &user, &winnings);

            let treasury_delta = (if is_first_claim { fee } else { 0 }) + payout_dust;
            if treasury_delta > 0 {
                let current_treasury: i128 = env
                    .storage()
                    .persistent()
                    .get(&DataKey::Treasury)
                    .unwrap_or(0);
                let next_treasury = current_treasury
                    .checked_add(treasury_delta)
                    .ok_or(ContractError::TreasuryOverflow)?;
                env.storage()
                    .persistent()
                    .set(&DataKey::Treasury, &next_treasury);

                let credit_key = DataKey::PoolTreasuryCredited(pool_id);
                let prev_pool_credit: i128 =
                    env.storage().persistent().get(&credit_key).unwrap_or(0);
                let next_pool_credit = prev_pool_credit
                    .checked_add(treasury_delta)
                    .ok_or(ContractError::TreasuryOverflow)?;
                env.storage()
                    .persistent()
                    .set(&credit_key, &next_pool_credit);
                env.storage().persistent().extend_ttl(
                    &credit_key,
                    POOL_BUMP_THRESHOLD,
                    POOL_BUMP_TARGET,
                );
            }

            payout_state.claimed_winning_stake = new_claimed_winning_stake;
            payout_state.paid_out = new_paid_out;
            if is_first_claim {
                payout_state.fee_credited = true;
            }
            let payout_key = DataKey::PoolPayoutState(pool_id);
            env.storage().persistent().set(&payout_key, &payout_state);
            env.storage().persistent().extend_ttl(
                &payout_key,
                POOL_BUMP_THRESHOLD,
                POOL_BUMP_TARGET,
            );

            env.storage()
                .persistent()
                .remove(&DataKey::UserBet(pool_id, user.clone()));

            env.events().publish(
                (
                    Symbol::new(&env, "claim_winnings"),
                    pool_id,
                    user.clone(),
                ),
                ClaimEvent {
                    amount: winnings,
                    fee_amount: fee,
                    winning_outcome,
                    total_pool_size: total_pool_balance,
                },
            );

            results.push_back(ClaimAllEntry { pool_id, amount: winnings });
        }

        Ok(results)
    }

    /// #158 — Return the per-pool payout-tracking state, or `None` if the
    /// pool has not yet had any winners claim. Useful for indexers and UI
    /// previews that want to display pending dust or check whether the
    /// protocol fee has been credited yet.
    pub fn get_pool_payout_state(env: Env, pool_id: u32) -> Option<PoolPayoutState> {
        env.storage()
            .persistent()
            .get(&DataKey::PoolPayoutState(pool_id))
    }

    /// #195 — Return per-pool protocol fee (fixed at settlement) and cumulative
    /// treasury credits from this pool (fee + payout dust), for analytics and audits.
    pub fn get_pool_protocol_revenue(env: Env, pool_id: u32) -> PoolProtocolRevenue {
        let fee_key = DataKey::PoolSettlementProtocolFee(pool_id);
        let credit_key = DataKey::PoolTreasuryCredited(pool_id);
        if env.storage().persistent().has(&fee_key) {
            env.storage()
                .persistent()
                .extend_ttl(&fee_key, POOL_BUMP_THRESHOLD, POOL_BUMP_TARGET);
        }
        if env.storage().persistent().has(&credit_key) {
            env.storage().persistent().extend_ttl(
                &credit_key,
                POOL_BUMP_THRESHOLD,
                POOL_BUMP_TARGET,
            );
        }
        let settlement_protocol_fee: i128 = env.storage().persistent().get(&fee_key).unwrap_or(0);
        let treasury_credited: i128 = env.storage().persistent().get(&credit_key).unwrap_or(0);
        PoolProtocolRevenue {
            settlement_protocol_fee,
            treasury_credited,
        }
    }

    pub fn get_treasury_balance(env: Env) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Treasury)
            .unwrap_or(0)
    }

    /// #164 — Return the amount currently withdrawable from the treasury.
    ///
    /// This is the single source of truth for withdrawal eligibility. The
    /// frontend should call this method instead of reimplementing the
    /// validation logic from `withdraw_treasury`. If future versions introduce
    /// reserved balances or per-pool accounting rules, this method will be
    /// updated in lockstep with `withdraw_treasury` so callers remain correct
    /// without any off-chain changes.
    ///
    /// A withdrawal of any amount `a` where `0 < a <= get_withdrawable_treasury()`
    /// is guaranteed to pass the balance check in `withdraw_treasury`.
    pub fn get_withdrawable_treasury(env: Env) -> i128 {
        env.storage()
            .persistent()
            .get::<_, i128>(&DataKey::Treasury)
            .unwrap_or(0)
    }

    pub fn get_treasury_recipient(env: Env) -> Option<Address> {
        env.storage().persistent().get(&DataKey::TreasuryRecipient)
    }

    /// Rotate the treasury recipient address. Only callable by the current treasury recipient.
    /// Emits an event with both old and new addresses for audit trail.
    pub fn rotate_treasury_recipient(
        env: Env,
        caller: Address,
        new_recipient: Address,
    ) -> Result<(), ContractError> {
        caller.require_auth();

        let current_recipient: Address = env
            .storage()
            .persistent()
            .get(&DataKey::TreasuryRecipient)
            .ok_or(ContractError::NotInitialized)?;

        if caller != current_recipient {
            return Err(ContractError::Unauthorized);
        }

        env.storage()
            .persistent()
            .set(&DataKey::TreasuryRecipient, &new_recipient);

        env.events().publish(
            (
                Symbol::new(&env, "treasury_recipient_rotated"),
                event_version(&env),
            ),
            (current_recipient, new_recipient),
        );
        Ok(())
    }

    pub fn withdraw_treasury(env: Env, caller: Address, amount: i128) -> Result<(), ContractError> {
        caller.require_auth();

        let treasury_recipient: Address = env
            .storage()
            .persistent()
            .get(&DataKey::TreasuryRecipient)
            .ok_or(ContractError::NotInitialized)?;

        if caller != treasury_recipient {
            return Err(ContractError::Unauthorized);
        }

        if amount <= 0 {
            return Err(ContractError::InvalidWithdrawalAmount);
        }

        let current_treasury: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Treasury)
            .unwrap_or(0);

        if amount > current_treasury {
            return Err(ContractError::InsufficientTreasuryBalance);
        }

        let token_address = env
            .storage()
            .persistent()
            .get::<_, Address>(&DataKey::Token)
            .ok_or(ContractError::NotInitialized)?;
        let token_client = token::Client::new(&env, &token_address);

        token_client.transfer(
            &env.current_contract_address(),
            &treasury_recipient,
            &amount,
        );

        env.storage()
            .persistent()
            .set(&DataKey::Treasury, &(current_treasury - amount));

        env.events().publish(
            (Symbol::new(&env, "treasury_withdrawn"), event_version(&env)),
            (caller.clone(), treasury_recipient, amount),
        );
        Ok(())
    }

    /// Set (or replace) the freeze admin address. Only callable by the treasury recipient.
    pub fn set_freeze_admin(
        env: Env,
        caller: Address,
        freeze_admin: Address,
    ) -> Result<(), ContractError> {
        caller.require_auth();

        let treasury_recipient: Address = env
            .storage()
            .persistent()
            .get(&DataKey::TreasuryRecipient)
            .ok_or(ContractError::NotInitialized)?;

        if caller != treasury_recipient {
            return Err(ContractError::Unauthorized);
        }

        env.storage()
            .persistent()
            .set(&DataKey::FreezeAdmin, &freeze_admin);

        env.events().publish(
            (Symbol::new(&env, "freeze_admin_set"), event_version(&env)),
            freeze_admin,
        );
        Ok(())
    }

    /// Freeze a pool, blocking new bets and claim payouts.
    /// Callable only by the freeze admin.
    pub fn freeze_pool(env: Env, caller: Address, pool_id: u32) -> Result<(), ContractError> {
        caller.require_auth();
        Self::require_freeze_admin(&env, &caller)?;

        let mut pool = env
            .storage()
            .persistent()
            .get::<_, Pool>(&DataKey::Pool(pool_id))
            .ok_or(ContractError::PoolNotFound)?;

        if pool.status == PoolStatus::Frozen {
            return Err(ContractError::PoolAlreadyFrozen);
        }

        pool.status = PoolStatus::Frozen;
        env.storage()
            .persistent()
            .set(&DataKey::Pool(pool_id), &pool);
        env.storage().persistent().extend_ttl(
            &DataKey::Pool(pool_id),
            POOL_BUMP_THRESHOLD,
            POOL_BUMP_TARGET,
        );

        env.events().publish(
            (
                Symbol::new(&env, "pool_frozen"),
                event_version(&env),
                pool_id,
            ),
            caller,
        );
        Ok(())
    }

    /// Mark a settled pool as disputed, blocking claim payouts pending review.
    /// Callable only by the freeze admin.
    pub fn dispute_pool(env: Env, caller: Address, pool_id: u32) -> Result<(), ContractError> {
        caller.require_auth();
        Self::require_freeze_admin(&env, &caller)?;

        let mut pool = env
            .storage()
            .persistent()
            .get::<_, Pool>(&DataKey::Pool(pool_id))
            .ok_or(ContractError::PoolNotFound)?;

        if !matches!(pool.status, PoolStatus::Settled(_)) {
            return Err(ContractError::PoolMustBeSettledToDispute);
        }

        if pool.status == PoolStatus::Disputed {
            return Err(ContractError::PoolAlreadyDisputed);
        }

        pool.status = PoolStatus::Disputed;
        env.storage()
            .persistent()
            .set(&DataKey::Pool(pool_id), &pool);
        env.storage().persistent().extend_ttl(
            &DataKey::Pool(pool_id),
            POOL_BUMP_THRESHOLD,
            POOL_BUMP_TARGET,
        );

        env.events().publish(
            (
                Symbol::new(&env, "pool_disputed"),
                event_version(&env),
                pool_id,
            ),
            caller,
        );
        Ok(())
    }

    /// Unfreeze a frozen or disputed pool, restoring it to Open status.
    /// Callable only by the freeze admin.
    pub fn unfreeze_pool(env: Env, caller: Address, pool_id: u32) -> Result<(), ContractError> {
        caller.require_auth();
        Self::require_freeze_admin(&env, &caller)?;

        let mut pool = env
            .storage()
            .persistent()
            .get::<_, Pool>(&DataKey::Pool(pool_id))
            .ok_or(ContractError::PoolNotFound)?;

        if pool.status != PoolStatus::Frozen && pool.status != PoolStatus::Disputed {
            return Err(ContractError::PoolNotFrozenOrDisputed);
        }

        pool.status = PoolStatus::Open;
        env.storage()
            .persistent()
            .set(&DataKey::Pool(pool_id), &pool);
        env.storage().persistent().extend_ttl(
            &DataKey::Pool(pool_id),
            POOL_BUMP_THRESHOLD,
            POOL_BUMP_TARGET,
        );

        env.events().publish(
            (
                Symbol::new(&env, "pool_unfrozen"),
                event_version(&env),
                pool_id,
            ),
            caller,
        );
        Ok(())
    }

    /// Return pool data and extend its TTL on every read so active pools stay
    /// accessible throughout their lifecycle. (#189)
    pub fn get_pool(env: Env, pool_id: u32) -> Option<Pool> {
        let pool: Option<Pool> = env.storage().persistent().get(&DataKey::Pool(pool_id));
        if pool.is_some() {
            env.storage().persistent().extend_ttl(
                &DataKey::Pool(pool_id),
                POOL_BUMP_THRESHOLD,
                POOL_BUMP_TARGET,
            );
        }
        pool
    }

    pub fn get_pool_count(env: Env) -> u32 {
        env.storage()
            .persistent()
            .get(&DataKey::PoolCounter)
            .unwrap_or(1)
    }

    /// Get a batch of pools for pagination-friendly listing.
    /// Returns pools from start_id up to count pools (or fewer if some don't exist).
    pub fn get_pools_batch(env: Env, start_id: u32, count: u32) -> Vec<Option<Pool>> {
        let mut pools = Vec::new(&env);
        let max_id = Self::get_pool_count(env.clone());

        let effective_count = if count > 100 { 100 } else { count };

        for i in 0..effective_count {
            let pool_id = start_id + i;
            if pool_id >= max_id {
                break;
            }
            let pool = env.storage().persistent().get(&DataKey::Pool(pool_id));
            pools.push_back(pool);
        }

        pools
    }

    /// #172 — Scan a bounded range of pools and return all positions the user
    /// holds within that range.
    ///
    /// The scan checks pools `[start_id, start_id + count)` and returns a
    /// `UserPoolPosition` entry for each pool where the user has an active bet
    /// record. Claimed positions are not included because the bet record is
    /// removed after a successful claim.
    ///
    /// The result is capped at 100 pools per call to bound compute costs.
    /// Callers should paginate with successive `start_id` values to walk the
    /// full pool space.
    ///
    /// # Arguments
    /// * `user`     – the address whose positions are queried
    /// * `start_id` – first pool ID to scan (inclusive)
    /// * `count`    – number of pool IDs to scan; capped at 100
    ///
    /// # Returns
    /// A `Vec<UserPoolPosition>` containing one entry per pool where `user` has
    /// an unclaimed position. The entries appear in ascending `pool_id` order.
    /// An empty vec means the user has no open positions in the scanned range.
    pub fn get_user_pools(
        env: Env,
        user: Address,
        start_id: u32,
        count: u32,
    ) -> Vec<UserPoolPosition> {
        let mut result = Vec::new(&env);
        let max_id = Self::get_pool_count(env.clone());
        let effective_count = if count > 100 { 100 } else { count };

        for i in 0..effective_count {
            let pool_id = start_id + i;
            if pool_id >= max_id {
                break;
            }
            let key = DataKey::UserBet(pool_id, user.clone());
            if let Some(bet) = env.storage().persistent().get::<_, UserBet>(&key) {
                // #189 — extend position TTL on read so dashboard queries keep entries alive.
                env.storage()
                    .persistent()
                    .extend_ttl(&key, POOL_BUMP_THRESHOLD, POOL_BUMP_TARGET);
                result.push_back(UserPoolPosition {
                    pool_id,
                    amount_a: bet.amount_a,
                    amount_b: bet.amount_b,
                    total_bet: bet.total_bet,
                });
            }
        }

        result
    }

    fn get_pool_counter(env: &Env) -> u32 {
        env.storage()
            .persistent()
            .get(&DataKey::PoolCounter)
            .unwrap_or(1)
    }

    fn require_freeze_admin(env: &Env, caller: &Address) -> Result<(), ContractError> {
        let freeze_admin: Address = env
            .storage()
            .persistent()
            .get(&DataKey::FreezeAdmin)
            .ok_or(ContractError::FreezeAdminNotSet)?;
        if caller != &freeze_admin {
            return Err(ContractError::Unauthorized);
        }
        Ok(())
    }

    /// Return the user's bet record and extend its TTL on every read. (#189)
    pub fn get_user_bet(env: Env, pool_id: u32, user: Address) -> Option<UserBet> {
        let key = DataKey::UserBet(pool_id, user);
        let bet: Option<UserBet> = env.storage().persistent().get(&key);
        if bet.is_some() {
            env.storage()
                .persistent()
                .extend_ttl(&key, POOL_BUMP_THRESHOLD, POOL_BUMP_TARGET);
        }
        bet
    }

    /// Return the claim status for `user` in `pool_id`.
    ///
    /// | Pool state  | Bet record present?        | Result            |
    /// |-------------|----------------------------|-------------------|
    /// | Any         | No                         | NeverBet or AlreadyClaimed* |
    /// | Open        | Yes                        | NotEligible (not yet settleable) |
    /// | Settled(w)  | Yes, bet on winning side   | Claimable         |
    /// | Settled(w)  | Yes, bet on losing side    | NotEligible       |
    /// | Voided      | Yes                        | RefundClaimable   |
    /// | Cancelled   | Yes                        | RefundClaimable   |
    /// | Any         | No (was removed by claim)  | AlreadyClaimed**  |
    ///
    /// */**  Once a claim is made the bet record is deleted, so the method
    /// returns `AlreadyClaimed` when the pool is settled/voided but no record
    /// exists — distinguishing it from `NeverBet` (pool still open/cancelled).
    pub fn get_claim_status(env: Env, pool_id: u32, user: Address) -> ClaimStatus {
        let pool = match env
            .storage()
            .persistent()
            .get::<_, Pool>(&DataKey::Pool(pool_id))
        {
            Some(p) => p,
            None => return ClaimStatus::NeverBet,
        };

        let bet: Option<UserBet> = env
            .storage()
            .persistent()
            .get(&DataKey::UserBet(pool_id, user));

        match pool.status {
            PoolStatus::Cancelled => match bet {
                Some(_) => ClaimStatus::RefundClaimable,
                None => ClaimStatus::AlreadyClaimed,
            },
            PoolStatus::Voided => match bet {
                Some(_) => ClaimStatus::RefundClaimable,
                None => ClaimStatus::AlreadyClaimed,
            },
            PoolStatus::Settled(winning_outcome) => match bet {
                None => ClaimStatus::AlreadyClaimed,
                Some(b) => {
                    let winning_stake = if winning_outcome == 0 {
                        b.amount_a
                    } else {
                        b.amount_b
                    };
                    if winning_stake > 0 {
                        ClaimStatus::Claimable
                    } else {
                        ClaimStatus::NotEligible
                    }
                }
            },
            _ => match bet {
                Some(_) => ClaimStatus::NotEligible,
                None => ClaimStatus::NeverBet,
            },
        }
    }

    /// #159 — Read-only payout preview for a user in a given pool.
    ///
    /// Returns a `ClaimPreview` that the frontend can use to display the
    /// claimable amount or explain why nothing is claimable, without
    /// reimplementing payout logic off-chain.
    ///
    /// The `Claimable(amount)` value is computed with the same formula used by
    /// `claim_winnings`, so the preview is always exact for settled pools.
    ///
    /// | Pool status          | Bet record          | Result              |
    /// |----------------------|---------------------|---------------------|
    /// | Open / Frozen /      | any                 | Unclaimable         |
    /// | Disputed             |                     |                     |
    /// | Cancelled            | absent / claimed    | NeverBet            |
    /// | Cancelled            | present             | Claimable(total_bet)|
    /// | Voided               | absent / claimed    | NeverBet            |
    /// | Voided               | present             | Claimable(total_bet)|
    /// | Settled(w)           | absent / claimed    | NeverBet            |
    /// | Settled(w)           | losing side only    | NotEligible         |
    /// | Settled(w)           | winning side > 0    | Claimable(amount)   |
    pub fn preview_claimable_amount(env: Env, pool_id: u32, user: Address) -> ClaimPreview {
        let pool = match env
            .storage()
            .persistent()
            .get::<_, Pool>(&DataKey::Pool(pool_id))
        {
            Some(p) => p,
            None => return ClaimPreview::Unclaimable,
        };

        let winning_outcome = match pool.status {
            PoolStatus::Settled(outcome) => outcome,
            PoolStatus::Voided | PoolStatus::Cancelled => {
                // For voided/cancelled pools, return the user's total bet as refund
                let bet: UserBet = match env
                    .storage()
                    .persistent()
                    .get(&DataKey::UserBet(pool_id, user))
                {
                    Some(b) => b,
                    None => return ClaimPreview::NeverBet,
                };
                return ClaimPreview::Claimable(bet.total_bet);
            }
            _ => return ClaimPreview::Unclaimable,
        };

        let bet: UserBet = match env
            .storage()
            .persistent()
            .get(&DataKey::UserBet(pool_id, user))
        {
            Some(b) => b,
            None => return ClaimPreview::NeverBet,
        };

        let user_winning_bet = if winning_outcome == 0 {
            bet.amount_a
        } else {
            bet.amount_b
        };

        if user_winning_bet == 0 {
            return ClaimPreview::NotEligible;
        }

        let pool_winning_total = if winning_outcome == 0 {
            pool.total_a
        } else {
            pool.total_b
        };
        let total_pool_balance = pool.total_a + pool.total_b;
        let fee_bps = Self::get_protocol_fee(env.clone()) as i128;
        let fee = (total_pool_balance * fee_bps) / 10000;
        let net_pool_balance = total_pool_balance - fee;
        let amount = (user_winning_bet * net_pool_balance) / pool_winning_total;

        ClaimPreview::Claimable(amount)
    }

    pub fn get_participant_count(env: Env, pool_id: u32) -> u32 {
        env.storage()
            .persistent()
            .get::<_, Pool>(&DataKey::Pool(pool_id))
            .map(|p| p.participant_count)
            .unwrap_or(0)
    }
}
