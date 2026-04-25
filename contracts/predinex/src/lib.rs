#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, token, Address, Env, String, Symbol, Vec};

mod test;

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Pool(u32),
    UserBet(u32, Address),
    PoolCounter,
    Token,
    Treasury,
    TreasuryRecipient,
}

/// Explicit lifecycle status for a prediction pool.
///
/// Transitions:
///   Open  ──(expiry reached + settle_pool called)──►  Settled(winning_outcome)
///
/// Future terminal states (Cancelled, Voided, Paused) can be added here
/// without ambiguity, because status is the single source of truth.
#[derive(Clone, PartialEq)]
#[contracttype]
pub enum PoolStatus {
    /// Accepting bets; expiry has not yet passed.
    Open,
    /// Betting closed and a winning outcome has been declared.
    /// The inner value is the winning outcome index (0 or 1).
    Settled(u32),
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
    /// Single explicit lifecycle status — replaces the former `settled: bool`,
    /// `winning_outcome: Option<u32>`, and `settled_at: Option<u64>` fields.
    pub status: PoolStatus,
    pub created_at: u64,
    pub expiry: u64,
}

#[derive(Clone)]
#[contracttype]
pub struct UserBet {
    pub amount_a: i128,
    pub amount_b: i128,
    pub total_bet: i128,
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
        env.storage().persistent().set(&DataKey::TreasuryRecipient, &treasury_recipient);
        env.storage().persistent().set(&DataKey::Treasury, &0i128);
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
            status: PoolStatus::Open,
            created_at,
            expiry,
        };

        env.storage()
            .persistent()
            .set(&DataKey::Pool(pool_id), &pool);
        env.storage()
            .persistent()
            .set(&DataKey::PoolCounter, &(pool_id + 1));

        env.events()
            .publish((Symbol::new(&env, "create_pool"), pool_id), (creator, Symbol::new(&env, "Open")));

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

        if pool.status != PoolStatus::Open {
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

        if pool.status != PoolStatus::Open {
            panic!("Already settled");
        }

        if env.ledger().timestamp() < pool.expiry {
            panic!("Pool has not expired yet");
        }

        if winning_outcome > 1 {
            panic!("Invalid outcome");
        }

        pool.status = PoolStatus::Settled(winning_outcome);

        env.storage()
            .persistent()
            .set(&DataKey::Pool(pool_id), &pool);

        env.events()
            .publish((Symbol::new(&env, "settle_pool"), pool_id), (winning_outcome, Symbol::new(&env, "Settled")));
    }

    pub fn claim_winnings(env: Env, user: Address, pool_id: u32) -> i128 {
        user.require_auth();

        let pool = env
            .storage()
            .persistent()
            .get::<_, Pool>(&DataKey::Pool(pool_id))
            .expect("Pool not found");

        let winning_outcome = match pool.status {
            PoolStatus::Settled(outcome) => outcome,
            _ => panic!("Pool not settled"),
        };

        let user_bet = env
            .storage()
            .persistent()
            .get::<_, UserBet>(&DataKey::UserBet(pool_id, user.clone()))
            .expect("No bet found");

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

        let fee = (total_pool_balance * 2) / 100;
        let net_pool_balance = total_pool_balance - fee;

        let winnings = (user_winning_bet * net_pool_balance) / pool_winning_total;

        let current_treasury: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Treasury)
            .unwrap_or(0);
        env.storage()
            .persistent()
            .set(&DataKey::Treasury, &(current_treasury + fee));

        env.events().publish(
            (Symbol::new(&env, "fee_collected"), pool_id),
            fee,
        );

        let token_address = env
            .storage()
            .persistent()
            .get::<_, Address>(&DataKey::Token)
            .expect("Not initialized");
        let token_client = token::Client::new(&env, &token_address);

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

        token_client.transfer(&env.current_contract_address(), &treasury_recipient, &amount);

        env.storage()
            .persistent()
            .set(&DataKey::Treasury, &(current_treasury - amount));

        env.events().publish(
            (Symbol::new(&env, "treasury_withdrawal"), treasury_recipient),
            amount,
        );
    }

    pub fn get_pool(env: Env, pool_id: u32) -> Option<Pool> {
        env.storage().persistent().get(&DataKey::Pool(pool_id))
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
