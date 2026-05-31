#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, token, Address, Env, String, Symbol, Vec};

mod test;

// Dispute window: 7 days in seconds (configurable in future)
const DISPUTE_WINDOW_SECS: u64 = 7 * 24 * 3600;

// Precision multiplier for LP fee-per-share accumulator (avoids rounding to zero)
const LP_PRECISION: i128 = 1_000_000_000;

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Pool(u32),
    UserBet(u32, Address),
    PoolCounter,
    Token,
    Treasury,
    TreasuryRecipient,
    // LP reward mechanism keys (issue #422)
    LpPool(u32),
    LpProvider(u32, Address),
    // Dispute resolution keys (issue #419)
    Dispute(u32),
    PoolVoided(u32),
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
    pub settled: bool,
    pub winning_outcome: Option<u32>,
    pub created_at: u64,
    pub settled_at: Option<u64>,
    pub expiry: u64,
}

#[derive(Clone)]
#[contracttype]
pub struct UserBet {
    pub amount_a: i128,
    pub amount_b: i128,
    pub total_bet: i128,
}

/// LP pool state stored per pool_id.
#[derive(Clone)]
#[contracttype]
pub struct LpPoolState {
    pub total_shares: i128,
    pub total_deposited: i128,
    /// Accumulated fee per LP share, scaled by LP_PRECISION to preserve precision.
    pub fee_per_share: i128,
}

/// Per-provider LP position for a given pool.
#[derive(Clone)]
#[contracttype]
pub struct LpProviderInfo {
    pub shares: i128,
    /// Snapshot of fee_per_share when this position was last updated.
    pub fee_checkpoint: i128,
    pub deposited: i128,
    pub entry_time: u64,
    /// Rewards already accrued but not yet withdrawn (settled on top-up).
    pub settled_rewards: i128,
}

/// View type returned by get_liquidity_info.
#[derive(Clone)]
#[contracttype]
pub struct LiquidityInfo {
    pub shares: i128,
    pub pending_rewards: i128,
    pub entry_time: u64,
    pub deposited: i128,
}

/// Dispute record stored per pool_id.
#[derive(Clone)]
#[contracttype]
pub struct DisputeInfo {
    pub disputer: Address,
    pub reason: String,
    pub disputed_at: u64,
    pub resolved: bool,
    /// true = original outcome upheld; false = pool voided (refunds issued)
    pub upheld: Option<bool>,
}

#[contract]
pub struct PredinexContract;

#[contractimpl]
impl PredinexContract {
    pub fn initialize(env: Env, token: Address, treasury_recipient: Address) {
        if env.storage().persistent().has(&DataKey::Token) {
            panic!("Already initialized");
        }
        env.storage().persistent().set(&DataKey::Token, &token);
        env.storage()
            .persistent()
            .set(&DataKey::TreasuryRecipient, &treasury_recipient);
        env.storage()
            .persistent()
            .set(&DataKey::Treasury, &0i128);
    }

    pub fn create_pool(
        env: Env,
        creator: Address,
        title: String,
        description: String,
        outcome_a: String,
        outcome_b: String,
        duration: u64,
    ) -> u32 {
        creator.require_auth();

        let pool_id = Self::get_pool_counter(&env);
        let created_at = env.ledger().timestamp();
        let expiry = created_at + duration;

        let pool = Pool {
            creator: creator.clone(),
            title,
            description,
            outcome_a_name: outcome_a,
            outcome_b_name: outcome_b,
            total_a: 0,
            total_b: 0,
            settled: false,
            winning_outcome: None,
            created_at,
            settled_at: None,
            expiry,
        };

        env.storage()
            .persistent()
            .set(&DataKey::Pool(pool_id), &pool);
        env.storage()
            .persistent()
            .set(&DataKey::PoolCounter, &(pool_id + 1));

        env.events()
            .publish((Symbol::new(&env, "create_pool"), pool_id), creator);

        pool_id
    }

    pub fn place_bet(env: Env, user: Address, pool_id: u32, outcome: u32, amount: i128) {
        user.require_auth();

        if amount <= 0 {
            panic!("Invalid bet amount");
        }

        let mut pool = env
            .storage()
            .persistent()
            .get::<_, Pool>(&DataKey::Pool(pool_id))
            .expect("Pool not found");

        if pool.settled {
            panic!("Pool already settled");
        }

        if env.ledger().timestamp() >= pool.expiry {
            panic!("Pool expired");
        }

        if outcome > 1 {
            panic!("Invalid outcome");
        }

        let token_address = env
            .storage()
            .persistent()
            .get::<_, Address>(&DataKey::Token)
            .expect("Not initialized");
        let token_client = token::Client::new(&env, &token_address);

        token_client.transfer(&user, &env.current_contract_address(), &amount);

        if outcome == 0 {
            pool.total_a += amount;
        } else {
            pool.total_b += amount;
        }

        env.storage()
            .persistent()
            .set(&DataKey::Pool(pool_id), &pool);

        let mut user_bet = env
            .storage()
            .persistent()
            .get::<_, UserBet>(&DataKey::UserBet(pool_id, user.clone()))
            .unwrap_or(UserBet {
                amount_a: 0,
                amount_b: 0,
                total_bet: 0,
            });

        if outcome == 0 {
            user_bet.amount_a += amount;
        } else {
            user_bet.amount_b += amount;
        }
        user_bet.total_bet += amount;

        env.storage()
            .persistent()
            .set(&DataKey::UserBet(pool_id, user.clone()), &user_bet);

        env.events().publish(
            (Symbol::new(&env, "place_bet"), pool_id, user),
            (outcome, amount),
        );
    }

    pub fn settle_pool(env: Env, caller: Address, pool_id: u32, winning_outcome: u32) {
        caller.require_auth();

        let mut pool = env
            .storage()
            .persistent()
            .get::<_, Pool>(&DataKey::Pool(pool_id))
            .expect("Pool not found");

        if caller != pool.creator {
            panic!("Unauthorized");
        }

        if pool.settled {
            panic!("Already settled");
        }

        if env.ledger().timestamp() < pool.expiry {
            panic!("Pool has not expired yet");
        }

        if winning_outcome > 1 {
            panic!("Invalid outcome");
        }

        pool.settled = true;
        pool.winning_outcome = Some(winning_outcome);
        pool.settled_at = Some(env.ledger().timestamp());

        env.storage()
            .persistent()
            .set(&DataKey::Pool(pool_id), &pool);

        env.events()
            .publish((Symbol::new(&env, "settle_pool"), pool_id), winning_outcome);
    }

    pub fn claim_winnings(env: Env, user: Address, pool_id: u32) -> i128 {
        user.require_auth();

        let pool = env
            .storage()
            .persistent()
            .get::<_, Pool>(&DataKey::Pool(pool_id))
            .expect("Pool not found");

        if !pool.settled {
            panic!("Pool not settled");
        }

        // Block claims while a dispute is pending resolution (issue #419)
        let dispute: Option<DisputeInfo> = env
            .storage()
            .persistent()
            .get(&DataKey::Dispute(pool_id));
        if let Some(ref d) = dispute {
            if !d.resolved {
                panic!("Pool is under dispute");
            }
        }

        let user_bet = env
            .storage()
            .persistent()
            .get::<_, UserBet>(&DataKey::UserBet(pool_id, user.clone()))
            .expect("No bet found");

        let token_address = env
            .storage()
            .persistent()
            .get::<_, Address>(&DataKey::Token)
            .expect("Not initialized");
        let token_client = token::Client::new(&env, &token_address);

        // Handle voided pool: return the user's full bet as a refund (issue #419)
        let voided: bool = env
            .storage()
            .persistent()
            .get(&DataKey::PoolVoided(pool_id))
            .unwrap_or(false);
        if voided {
            let refund = user_bet.amount_a + user_bet.amount_b;
            if refund == 0 {
                panic!("No bet to refund");
            }
            token_client.transfer(&env.current_contract_address(), &user, &refund);
            env.storage()
                .persistent()
                .remove(&DataKey::UserBet(pool_id, user.clone()));
            env.events().publish(
                (Symbol::new(&env, "claim_refund"), pool_id, user),
                refund,
            );
            return refund;
        }

        let winning_outcome = pool.winning_outcome.expect("No winning outcome");

        let user_winning_bet = if winning_outcome == 0 {
            user_bet.amount_a
        } else {
            user_bet.amount_b
        };

        if user_winning_bet == 0 {
            panic!("No winnings to claim");
        }

        let pool_winning_total = if winning_outcome == 0 {
            pool.total_a
        } else {
            pool.total_b
        };
        let total_pool_balance = pool.total_a + pool.total_b;

        let total_fee = (total_pool_balance * 2) / 100;
        let net_pool_balance = total_pool_balance - total_fee;

        let winnings = (user_winning_bet * net_pool_balance) / pool_winning_total;

        // Security fix (issue #447): charge this user only their proportional
        // share of the fee rather than the full pool fee on every claim, which
        // would over-credit the treasury when multiple winners exist.
        let user_fee = (user_winning_bet * total_fee) / pool_winning_total;

        // Split fee with LPs if the pool has active LP shares (issue #422).
        // 50 % stays in treasury; 50 % accrues to LP fee-per-share accumulator.
        let lp_state_opt: Option<LpPoolState> = env
            .storage()
            .persistent()
            .get(&DataKey::LpPool(pool_id));

        let (treasury_fee, lp_fee) = match &lp_state_opt {
            Some(state) if state.total_shares > 0 => {
                let lp = user_fee / 2;
                (user_fee - lp, lp)
            }
            _ => (user_fee, 0i128),
        };

        if lp_fee > 0 {
            if let Some(mut state) = lp_state_opt {
                state.fee_per_share += lp_fee * LP_PRECISION / state.total_shares;
                env.storage()
                    .persistent()
                    .set(&DataKey::LpPool(pool_id), &state);
            }
        }

        let current_treasury: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Treasury)
            .unwrap_or(0);
        env.storage()
            .persistent()
            .set(&DataKey::Treasury, &(current_treasury + treasury_fee));

        if treasury_fee > 0 {
            env.events()
                .publish((Symbol::new(&env, "fee_collected"), pool_id), treasury_fee);
        }

        token_client.transfer(&env.current_contract_address(), &user, &winnings);

        env.storage()
            .persistent()
            .remove(&DataKey::UserBet(pool_id, user.clone()));

        env.events().publish(
            (Symbol::new(&env, "claim_winnings"), pool_id, user),
            winnings,
        );

        winnings
    }

    // =========================================================================
    // Issue #422 — Liquidity provider reward mechanism
    // =========================================================================

    /// Deposit `amount` tokens into pool `pool_id` as liquidity.
    /// Returns the number of LP shares minted.
    pub fn provide_liquidity(
        env: Env,
        provider: Address,
        pool_id: u32,
        amount: i128,
    ) -> i128 {
        provider.require_auth();

        if amount <= 0 {
            panic!("Invalid amount");
        }

        // Pool must exist
        let _pool = env
            .storage()
            .persistent()
            .get::<_, Pool>(&DataKey::Pool(pool_id))
            .expect("Pool not found");

        let token_address = env
            .storage()
            .persistent()
            .get::<_, Address>(&DataKey::Token)
            .expect("Not initialized");
        let token_client = token::Client::new(&env, &token_address);

        let mut lp_state = env
            .storage()
            .persistent()
            .get::<_, LpPoolState>(&DataKey::LpPool(pool_id))
            .unwrap_or(LpPoolState {
                total_shares: 0,
                total_deposited: 0,
                fee_per_share: 0,
            });

        // First LP gets 1:1 shares; subsequent LPs get proportional shares.
        let shares = if lp_state.total_shares == 0 {
            amount
        } else {
            amount * lp_state.total_shares / lp_state.total_deposited
        };

        if shares <= 0 {
            panic!("Shares too small");
        }

        token_client.transfer(&provider, &env.current_contract_address(), &amount);

        // If the provider already has a position, settle their pending rewards
        // before adjusting shares so they don't lose accrued fees.
        let lp_info = match env
            .storage()
            .persistent()
            .get::<_, LpProviderInfo>(&DataKey::LpProvider(pool_id, provider.clone()))
        {
            Some(mut existing) => {
                let pending = (lp_state.fee_per_share - existing.fee_checkpoint)
                    * existing.shares
                    / LP_PRECISION;
                existing.settled_rewards += pending;
                existing.fee_checkpoint = lp_state.fee_per_share;
                existing.shares += shares;
                existing.deposited += amount;
                existing
            }
            None => LpProviderInfo {
                shares,
                fee_checkpoint: lp_state.fee_per_share,
                deposited: amount,
                entry_time: env.ledger().timestamp(),
                settled_rewards: 0,
            },
        };

        env.storage()
            .persistent()
            .set(&DataKey::LpProvider(pool_id, provider.clone()), &lp_info);

        lp_state.total_shares += shares;
        lp_state.total_deposited += amount;
        env.storage()
            .persistent()
            .set(&DataKey::LpPool(pool_id), &lp_state);

        env.events().publish(
            (Symbol::new(&env, "liquidity_provided"), pool_id, provider),
            (amount, shares),
        );

        shares
    }

    /// Burn `shares` LP shares and withdraw proportional principal + accrued rewards.
    /// Returns total tokens transferred (principal + rewards).
    pub fn withdraw_liquidity(
        env: Env,
        provider: Address,
        pool_id: u32,
        shares: i128,
    ) -> i128 {
        provider.require_auth();

        if shares <= 0 {
            panic!("Invalid shares");
        }

        let mut lp_info = env
            .storage()
            .persistent()
            .get::<_, LpProviderInfo>(&DataKey::LpProvider(pool_id, provider.clone()))
            .expect("No liquidity position");

        if shares > lp_info.shares {
            panic!("Insufficient shares");
        }

        let mut lp_state = env
            .storage()
            .persistent()
            .get::<_, LpPoolState>(&DataKey::LpPool(pool_id))
            .expect("LP pool state not found");

        // Principal proportional to burned shares
        let principal = shares * lp_state.total_deposited / lp_state.total_shares;

        // Accrued rewards for the burned portion
        let unsettled = (lp_state.fee_per_share - lp_info.fee_checkpoint) * shares / LP_PRECISION;
        // Pro-rated share of previously settled rewards
        let settled_portion = lp_info.settled_rewards * shares / lp_info.shares;
        let rewards = unsettled + settled_portion;

        let total_out = principal + rewards;

        let token_address = env
            .storage()
            .persistent()
            .get::<_, Address>(&DataKey::Token)
            .expect("Not initialized");
        let token_client = token::Client::new(&env, &token_address);
        token_client.transfer(&env.current_contract_address(), &provider, &total_out);

        // Update or remove the provider's position
        lp_state.total_shares -= shares;
        lp_state.total_deposited -= principal;

        if shares == lp_info.shares {
            env.storage()
                .persistent()
                .remove(&DataKey::LpProvider(pool_id, provider.clone()));
        } else {
            lp_info.shares -= shares;
            lp_info.deposited -= principal;
            lp_info.settled_rewards -= settled_portion;
            // Checkpoint stays at current value; remaining shares earn from here
            lp_info.fee_checkpoint = lp_state.fee_per_share;
            env.storage()
                .persistent()
                .set(&DataKey::LpProvider(pool_id, provider.clone()), &lp_info);
        }

        env.storage()
            .persistent()
            .set(&DataKey::LpPool(pool_id), &lp_state);

        env.events().publish(
            (Symbol::new(&env, "liquidity_withdrawn"), pool_id, provider),
            (principal, rewards),
        );

        total_out
    }

    /// Returns shares, pending rewards, entry time, and deposited amount for
    /// `provider` in `pool_id`. Returns None if no position exists.
    pub fn get_liquidity_info(
        env: Env,
        pool_id: u32,
        provider: Address,
    ) -> Option<LiquidityInfo> {
        let lp_info = env
            .storage()
            .persistent()
            .get::<_, LpProviderInfo>(&DataKey::LpProvider(pool_id, provider))?;

        let fee_per_share = env
            .storage()
            .persistent()
            .get::<_, LpPoolState>(&DataKey::LpPool(pool_id))
            .map(|s| s.fee_per_share)
            .unwrap_or(0);

        let unsettled =
            (fee_per_share - lp_info.fee_checkpoint) * lp_info.shares / LP_PRECISION;
        let pending_rewards = lp_info.settled_rewards + unsettled;

        Some(LiquidityInfo {
            shares: lp_info.shares,
            pending_rewards,
            entry_time: lp_info.entry_time,
            deposited: lp_info.deposited,
        })
    }

    // =========================================================================
    // Issue #419 — Pool dispute resolution mechanism
    // =========================================================================

    /// Raise a dispute for `pool_id` within DISPUTE_WINDOW_SECS of settlement.
    pub fn dispute_pool(env: Env, caller: Address, pool_id: u32, reason: String) {
        caller.require_auth();

        let pool = env
            .storage()
            .persistent()
            .get::<_, Pool>(&DataKey::Pool(pool_id))
            .expect("Pool not found");

        if !pool.settled {
            panic!("Pool not settled");
        }

        let settled_at = pool.settled_at.expect("Missing settled_at");

        if env.ledger().timestamp() > settled_at + DISPUTE_WINDOW_SECS {
            panic!("Dispute window expired");
        }

        // Only one dispute per pool
        if env
            .storage()
            .persistent()
            .has(&DataKey::Dispute(pool_id))
        {
            panic!("Dispute already exists");
        }

        let dispute = DisputeInfo {
            disputer: caller.clone(),
            reason,
            disputed_at: env.ledger().timestamp(),
            resolved: false,
            upheld: None,
        };

        env.storage()
            .persistent()
            .set(&DataKey::Dispute(pool_id), &dispute);

        env.events()
            .publish((Symbol::new(&env, "pool_disputed"), pool_id), caller);
    }

    /// Resolve the dispute for `pool_id`.
    /// Only callable by the treasury recipient.
    /// `upheld` = true → original outcome stands; false → pool is voided (full refunds).
    pub fn resolve_dispute(env: Env, caller: Address, pool_id: u32, upheld: bool) {
        caller.require_auth();

        let treasury_recipient: Address = env
            .storage()
            .persistent()
            .get(&DataKey::TreasuryRecipient)
            .expect("Treasury recipient not set");

        if caller != treasury_recipient {
            panic!("Unauthorized");
        }

        let mut dispute = env
            .storage()
            .persistent()
            .get::<_, DisputeInfo>(&DataKey::Dispute(pool_id))
            .expect("No dispute found");

        if dispute.resolved {
            panic!("Dispute already resolved");
        }

        dispute.resolved = true;
        dispute.upheld = Some(upheld);

        env.storage()
            .persistent()
            .set(&DataKey::Dispute(pool_id), &dispute);

        if !upheld {
            // Void the pool so claim_winnings issues refunds instead of payouts
            env.storage()
                .persistent()
                .set(&DataKey::PoolVoided(pool_id), &true);
        }

        env.events().publish(
            (Symbol::new(&env, "dispute_resolved"), pool_id),
            upheld,
        );
    }

    /// Returns the dispute record for `pool_id`, or None if no dispute exists.
    pub fn get_pool_dispute(env: Env, pool_id: u32) -> Option<DisputeInfo> {
        env.storage().persistent().get(&DataKey::Dispute(pool_id))
    }

    // =========================================================================
    // Treasury helpers (unchanged)
    // =========================================================================

    pub fn get_treasury_balance(env: Env) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Treasury)
            .unwrap_or(0)
    }

    pub fn get_treasury_recipient(env: Env) -> Option<Address> {
        env.storage().persistent().get(&DataKey::TreasuryRecipient)
    }

    pub fn withdraw_treasury(env: Env, caller: Address, amount: i128) {
        caller.require_auth();

        let treasury_recipient: Address = env
            .storage()
            .persistent()
            .get(&DataKey::TreasuryRecipient)
            .expect("Treasury recipient not set");

        if caller != treasury_recipient {
            panic!("Unauthorized");
        }

        let current_treasury: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Treasury)
            .unwrap_or(0);

        if amount > current_treasury {
            panic!("Insufficient treasury balance");
        }

        let token_address = env
            .storage()
            .persistent()
            .get::<_, Address>(&DataKey::Token)
            .expect("Not initialized");
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
            (Symbol::new(&env, "treasury_withdrawal"), treasury_recipient),
            amount,
        );
    }

    // =========================================================================
    // Pool read helpers (unchanged)
    // =========================================================================

    pub fn get_pool(env: Env, pool_id: u32) -> Option<Pool> {
        env.storage().persistent().get(&DataKey::Pool(pool_id))
    }

    pub fn get_pool_count(env: Env) -> u32 {
        env.storage()
            .persistent()
            .get(&DataKey::PoolCounter)
            .unwrap_or(1)
    }

    /// Returns pools from start_id up to count pools (max 100).
    pub fn get_pools_batch(env: Env, start_id: u32, count: u32) -> Vec<Option<Pool>> {
        let mut pools = Vec::new(&env);
        let max_id = Self::get_pool_count(&env);
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

    fn get_pool_counter(env: &Env) -> u32 {
        env.storage()
            .persistent()
            .get(&DataKey::PoolCounter)
            .unwrap_or(1)
    }

    pub fn get_user_bet(env: Env, pool_id: u32, user: Address) -> Option<UserBet> {
        env.storage()
            .persistent()
            .get(&DataKey::UserBet(pool_id, user))
    }
}
