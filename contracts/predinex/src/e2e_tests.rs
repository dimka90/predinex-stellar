#![cfg(test)]
extern crate std;
use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    Address, Env, String,
};

// ── E2E Test Harness ─────────────────────────────────────────────────────────

struct E2eEnv<'a> {
    env: Env,
    client: PredinexContractClient<'a>,
    token: Address,
    freeze_admin: Address,
}

fn setup_e2e() -> E2eEnv<'static> {
    let env = Env::default();
    env.mock_all_auths();

    let token_admin = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract_v2(token_admin.clone());

    let contract_id = env.register(PredinexContract, ());
    let client = PredinexContractClient::new(&env, &contract_id);

    client.initialize(&token_id.address(), &token_admin);

    let freeze_admin = Address::generate(&env);
    client.set_freeze_admin(&token_admin, &freeze_admin);

    let client: PredinexContractClient<'static> = unsafe { core::mem::transmute(client) };

    E2eEnv {
        env,
        client,
        token: token_id.address(),
        freeze_admin,
    }
}

fn mint_e2e(env: &Env, token: &Address, user: &Address, amount: i128) {
    let admin = soroban_sdk::token::StellarAssetClient::new(env, token);
    admin.mint(user, &amount);
}

// ── E2E Test Cases ───────────────────────────────────────────────────────────

/// 1. E2E: Create → Bet (winners + losers) → Settle → Winner claims → Loser gets nothing
#[test]
fn test_e2e_successful_lifecycle() {
    let t = setup_e2e();
    let creator = Address::generate(&t.env);
    let user_a = Address::generate(&t.env);
    let user_b = Address::generate(&t.env);

    let token_client = soroban_sdk::token::Client::new(&t.env, &t.token);

    // Initial balances
    mint_e2e(&t.env, &t.token, &user_a, 1000);
    mint_e2e(&t.env, &t.token, &user_b, 1000);

    // Step 1: Create Pool
    t.env.ledger().with_mut(|li| li.timestamp = 100);
    let pool_id = t.client.create_pool(
        &creator,
        &String::from_str(&t.env, "E2E Pool"),
        &String::from_str(&t.env, "Full lifecycle validation"),
        &String::from_str(&t.env, "Yes"),
        &String::from_str(&t.env, "No"),
        &3600,
    );

    let pool = t.client.get_pool(&pool_id).expect("pool must exist");
    assert_eq!(pool.status, PoolStatus::Open);
    assert_eq!(pool.expiry, 3700);

    // Step 2: Place Bets
    t.client.place_bet(&user_a, &pool_id, &0u32, &500i128, &None::<Address>);
    t.client.place_bet(&user_b, &pool_id, &1u32, &500i128, &None::<Address>);

    // Verify token escrows and pool state
    assert_eq!(token_client.balance(&user_a), 500);
    assert_eq!(token_client.balance(&user_b), 500);
    assert_eq!(token_client.balance(&t.client.address), 1000);

    let pool = t.client.get_pool(&pool_id).expect("pool must exist");
    assert_eq!(pool.total_a, 500);
    assert_eq!(pool.total_b, 500);
    assert_eq!(pool.participant_count, 2);

    // Step 3: Expire & Settle
    t.env.ledger().with_mut(|li| li.timestamp = 3701);
    t.client.settle_pool(&creator, &pool_id, &0u32); // Outcome A wins

    let pool = t.client.get_pool(&pool_id).expect("pool must exist");
    assert!(pool.settled);
    assert_eq!(pool.winning_outcome, Some(0));

    // Step 4: Claim Winnings
    // total = 1000, 2% fee = 20, net = 980. User A has 100% of winning side.
    let winnings = t.client.claim_winnings(&user_a, &pool_id);
    assert_eq!(winnings, 980);
    assert_eq!(token_client.balance(&user_a), 500 + 980); // 1480 total

    // Loser gets nothing / claim fails
    let loser_result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        t.client.claim_winnings(&user_b, &pool_id);
    }));
    assert!(loser_result.is_err(), "loser claim must fail");
    assert_eq!(token_client.balance(&user_b), 500); // untouched

    // Treasury accrual check
    assert_eq!(t.client.get_treasury_balance(), 20);
}

/// 2. E2E: Create → Bet → Void → All claim refunds
#[test]
fn test_e2e_void_and_refund() {
    let t = setup_e2e();
    let creator = Address::generate(&t.env);
    let user_a = Address::generate(&t.env);
    let user_b = Address::generate(&t.env);

    let token_client = soroban_sdk::token::Client::new(&t.env, &t.token);

    mint_e2e(&t.env, &t.token, &user_a, 1000);
    mint_e2e(&t.env, &t.token, &user_b, 1000);

    // Step 1: Create Pool
    let pool_id = t.client.create_pool(
        &creator,
        &String::from_str(&t.env, "Void Pool"),
        &String::from_str(&t.env, "Void validation"),
        &String::from_str(&t.env, "Yes"),
        &String::from_str(&t.env, "No"),
        &3600,
    );

    // Step 2: Bet
    t.client.place_bet(&user_a, &pool_id, &0u32, &300i128, &None::<Address>);
    t.client.place_bet(&user_b, &pool_id, &1u32, &400i128, &None::<Address>);

    // Step 3: Void Pool (Creator only)
    t.client.void_pool(&creator, &pool_id);

    let pool = t.client.get_pool(&pool_id).unwrap();
    assert_eq!(pool.status, PoolStatus::Voided);

    // Step 4: Claim Refunds
    let refund_a = t.client.claim_refund(&user_a, &pool_id);
    let refund_b = t.client.claim_refund(&user_b, &pool_id);

    assert_eq!(refund_a, 300);
    assert_eq!(refund_b, 400);

    // Verify original balances restored exactly with 0 fees taken
    assert_eq!(token_client.balance(&user_a), 1000);
    assert_eq!(token_client.balance(&user_b), 1000);
    assert_eq!(token_client.balance(&t.client.address), 0);
}

/// 3. E2E: Create → Bet → Settle → Dispute → Unfreeze → Claim
#[test]
fn test_e2e_dispute_unfreeze_claim() {
    let t = setup_e2e();
    let creator = Address::generate(&t.env);
    let user_a = Address::generate(&t.env);
    let user_b = Address::generate(&t.env);

    mint_e2e(&t.env, &t.token, &user_a, 1000);
    mint_e2e(&t.env, &t.token, &user_b, 1000);

    // Step 1: Create Pool & Bet
    let pool_id = t.client.create_pool(
        &creator,
        &String::from_str(&t.env, "Dispute Pool"),
        &String::from_str(&t.env, "Dispute validation"),
        &String::from_str(&t.env, "Yes"),
        &String::from_str(&t.env, "No"),
        &3600,
    );
    t.client.place_bet(&user_a, &pool_id, &0u32, &500i128, &None::<Address>);
    t.client.place_bet(&user_b, &pool_id, &1u32, &500i128, &None::<Address>);

    // Step 2: Settle
    t.env.ledger().with_mut(|li| li.timestamp = 3701);
    t.client.settle_pool(&creator, &pool_id, &0u32);

    // Step 3: Dispute Pool
    t.client.dispute_pool(&t.freeze_admin, &pool_id);

    let pool = t.client.get_pool(&pool_id).unwrap();
    assert_eq!(pool.status, PoolStatus::Disputed);

    // Attempted claims must block/panic while disputed
    let claim_fail = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        t.client.claim_winnings(&user_a, &pool_id);
    }));
    assert!(claim_fail.is_err(), "claims must block on disputed pools");

    // Step 4: Unfreeze
    t.client.unfreeze_pool(&t.freeze_admin, &pool_id);

    let pool = t.client.get_pool(&pool_id).unwrap();
    assert_eq!(pool.status, PoolStatus::Open); // Returns to Open

    // Re-settle to enable claims again
    t.client.settle_pool(&creator, &pool_id, &0u32);

    // Step 5: Claim
    let winnings = t.client.claim_winnings(&user_a, &pool_id);
    assert_eq!(winnings, 980);
}

/// 4. E2E: Pool cancellation before bets
#[test]
fn test_e2e_pool_cancellation_before_bets() {
    let t = setup_e2e();
    let creator = Address::generate(&t.env);

    t.env.ledger().with_mut(|li| li.timestamp = 100);

    // Step 1: Create Scheduled Pool
    let pool_id = t.client.schedule_pool(
        &creator,
        &String::from_str(&t.env, "Scheduled Pool"),
        &String::from_str(&t.env, "Future event"),
        &String::from_str(&t.env, "Yes"),
        &String::from_str(&t.env, "No"),
        &3600,
        &200, // Open at timestamp 200
    );

    let pool = t.client.get_pool(&pool_id).unwrap();
    assert_eq!(pool.status, PoolStatus::Scheduled(200));

    // Step 2: Cancel Scheduled Pool (no bets can exist yet)
    t.client.cancel_scheduled_pool(&creator, &pool_id);

    let pool = t.client.get_pool(&pool_id).unwrap();
    assert_eq!(pool.status, PoolStatus::Cancelled);

    // Attempting to activate the cancelled pool must fail
    t.env.ledger().with_mut(|li| li.timestamp = 201);
    let activate_result = t.client.try_activate_scheduled_pool(&pool_id);
    assert_eq!(activate_result, Err(Ok(ContractError::PoolNotOpen)));
}
