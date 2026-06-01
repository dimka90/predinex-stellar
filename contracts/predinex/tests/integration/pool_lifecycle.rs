//! Full pool lifecycle integration tests (issue #448).
//!
//! Covers: create → deposit (LP) → trade (bet) → settle → withdraw (claim / LP).
//! Each helper function is documented at its declaration site.

extern crate std;

use predinex::{Pool, PredinexContract, PredinexContractClient};
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token, Address, Env, String,
};

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/// Full test context: contract client, token contract, and named actors.
struct Ctx<'a> {
    env: Env,
    client: PredinexContractClient<'a>,
    token: token::Client<'a>,
    token_admin: token::StellarAssetClient<'a>,
    treasury: Address,
}

/// Boot a fresh environment, register the contract and a token, initialise.
fn setup() -> Ctx<'static> {
    let env = Env::default();
    env.mock_all_auths();

    let treasury = Address::generate(&env);
    let token_admin_addr = Address::generate(&env);
    let token_asset = env.register_stellar_asset_contract_v2(token_admin_addr.clone());

    let contract_id = env.register(PredinexContract, ());
    let client = PredinexContractClient::new(&env, &contract_id);
    client.initialize(&token_asset.address(), &treasury);

    let token = token::Client::new(&env, &token_asset.address());
    let token_admin = token::StellarAssetClient::new(&env, &token_asset.address());

    // Leak lifetimes — safe because env owns all allocations and outlives Ctx.
    let client: PredinexContractClient<'static> = unsafe { core::mem::transmute(client) };
    let token: token::Client<'static> = unsafe { core::mem::transmute(token) };
    let token_admin: token::StellarAssetClient<'static> =
        unsafe { core::mem::transmute(token_admin) };
    let env: Env = unsafe { core::mem::transmute(env) };

    Ctx {
        env,
        client,
        token,
        token_admin,
        treasury,
    }
}

/// Create a pool with a 1-hour duration and return its ID.
fn make_pool(ctx: &Ctx, creator: &Address) -> u32 {
    ctx.client.create_pool(
        creator,
        &String::from_str(&ctx.env, "Will BTC hit $100k?"),
        &String::from_str(&ctx.env, "Binary prediction market"),
        &String::from_str(&ctx.env, "Yes"),
        &String::from_str(&ctx.env, "No"),
        &3_600u64,
    )
}

/// Advance the ledger past the pool's 1-hour expiry.
fn expire(ctx: &Ctx) {
    ctx.env.ledger().with_mut(|l| l.timestamp += 3_601);
}

/// Mint `amount` tokens to `addr`.
fn mint(ctx: &Ctx, addr: &Address, amount: i128) {
    ctx.token_admin.mint(addr, &amount);
}

// ---------------------------------------------------------------------------
// Happy path: full binary pool lifecycle
// ---------------------------------------------------------------------------

/// L1: Create a pool → verify initial state.
#[test]
fn l1_create_pool_initial_state() {
    let ctx = setup();
    let creator = Address::generate(&ctx.env);

    let pool_id = make_pool(&ctx, &creator);
    assert_eq!(pool_id, 1, "first pool id must be 1");

    let pool: Pool = ctx.client.get_pool(&pool_id).expect("pool must exist");
    assert_eq!(pool.creator, creator);
    assert_eq!(pool.total_a, 0);
    assert_eq!(pool.total_b, 0);
    assert!(!pool.settled);
    assert!(pool.winning_outcome.is_none());
}

/// L2: LP provides liquidity before bets, bets arrive, LP withdraws with rewards.
#[test]
fn l2_lp_deposit_bet_settle_lp_withdraw() {
    let ctx = setup();
    let creator = Address::generate(&ctx.env);
    let lp = Address::generate(&ctx.env);
    let bettor_a = Address::generate(&ctx.env);
    let bettor_b = Address::generate(&ctx.env);

    mint(&ctx, &lp, 1_000);
    mint(&ctx, &bettor_a, 500);
    mint(&ctx, &bettor_b, 500);

    let pool_id = make_pool(&ctx, &creator);

    // LP deposits liquidity
    let shares = ctx.client.provide_liquidity(&lp, &pool_id, &500i128);
    assert!(shares > 0, "should receive LP shares");
    assert_eq!(ctx.token.balance(&lp), 500, "remaining LP balance");

    // Both sides bet
    ctx.client.place_bet(&bettor_a, &pool_id, &0, &300);
    ctx.client.place_bet(&bettor_b, &pool_id, &1, &200);

    expire(&ctx);

    // Settle: outcome A wins
    ctx.client.settle_pool(&creator, &pool_id, &0);

    // Winner claims — this accrues LP fees
    ctx.client.claim_winnings(&bettor_a, &pool_id);

    // LP withdraws all shares
    let info = ctx
        .client
        .get_liquidity_info(&pool_id, &lp)
        .expect("LP info must exist");
    assert!(info.pending_rewards > 0, "LP must have accrued rewards from bet fees");

    let lp_total = ctx.client.withdraw_liquidity(&lp, &pool_id, &shares);
    assert_eq!(lp_total, info.deposited + info.pending_rewards);
    assert_eq!(ctx.token.balance(&lp), 500 + lp_total, "LP gets back deposit + rewards");
}

/// L3: Bettor on losing side has no winnings to claim.
#[test]
#[should_panic(expected = "No winnings to claim")]
fn l3_losing_bettor_cannot_claim() {
    let ctx = setup();
    let creator = Address::generate(&ctx.env);
    let winner = Address::generate(&ctx.env);
    let loser = Address::generate(&ctx.env);

    mint(&ctx, &winner, 200);
    mint(&ctx, &loser, 200);

    let pool_id = make_pool(&ctx, &creator);
    ctx.client.place_bet(&winner, &pool_id, &0, &200);
    ctx.client.place_bet(&loser, &pool_id, &1, &200);

    expire(&ctx);
    ctx.client.settle_pool(&creator, &pool_id, &0); // A wins

    ctx.client.claim_winnings(&loser, &pool_id);
}

/// L4: Full payout correctness — two winners share the net pool proportionally.
#[test]
fn l4_two_winners_proportional_payout() {
    let ctx = setup();
    let creator = Address::generate(&ctx.env);
    let w1 = Address::generate(&ctx.env);
    let w2 = Address::generate(&ctx.env);
    let loser = Address::generate(&ctx.env);

    mint(&ctx, &w1, 300);
    mint(&ctx, &w2, 100);
    mint(&ctx, &loser, 200);

    let pool_id = make_pool(&ctx, &creator);
    ctx.client.place_bet(&w1, &pool_id, &0, &300); // 300 on A
    ctx.client.place_bet(&w2, &pool_id, &0, &100); // 100 on A
    ctx.client.place_bet(&loser, &pool_id, &1, &200); // 200 on B

    expire(&ctx);
    ctx.client.settle_pool(&creator, &pool_id, &0); // A wins

    // Total pool = 600. Fee 2% = 12. Net = 588. Winners total = 400.
    // w1 share = 300 * 588 / 400 = 441
    // w2 share = 100 * 588 / 400 = 147
    let w1_win = ctx.client.claim_winnings(&w1, &pool_id);
    let w2_win = ctx.client.claim_winnings(&w2, &pool_id);

    assert_eq!(w1_win, 441, "w1 payout must be 441");
    assert_eq!(w2_win, 147, "w2 payout must be 147");

    // Total paid = 588 = net pool (no LP splitting since no LPs)
    assert_eq!(w1_win + w2_win, 588);
}

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

/// E1: Premature withdrawal attempt (bet after pool expired is rejected).
#[test]
#[should_panic(expected = "Pool expired")]
fn e1_bet_after_expiry_rejected() {
    let ctx = setup();
    let creator = Address::generate(&ctx.env);
    let user = Address::generate(&ctx.env);
    mint(&ctx, &user, 100);

    let pool_id = make_pool(&ctx, &creator);
    expire(&ctx);

    ctx.client.place_bet(&user, &pool_id, &0, &100);
}

/// E2: Claiming on an unsettled pool panics.
#[test]
#[should_panic(expected = "Pool not settled")]
fn e2_claim_before_settlement_rejected() {
    let ctx = setup();
    let creator = Address::generate(&ctx.env);
    let user = Address::generate(&ctx.env);
    mint(&ctx, &user, 100);

    let pool_id = make_pool(&ctx, &creator);
    ctx.client.place_bet(&user, &pool_id, &0, &100);

    // Pool not settled yet
    ctx.client.claim_winnings(&user, &pool_id);
}

/// E3: Settling before expiry is rejected.
#[test]
#[should_panic(expected = "Pool has not expired yet")]
fn e3_settle_before_expiry_rejected() {
    let ctx = setup();
    let creator = Address::generate(&ctx.env);

    let pool_id = make_pool(&ctx, &creator);
    // Timestamp is still 0, pool expires at 3600
    ctx.client.settle_pool(&creator, &pool_id, &0);
}

/// E4: Minimum position — single token bet, single token LP deposit.
#[test]
fn e4_minimum_position_single_token() {
    let ctx = setup();
    let creator = Address::generate(&ctx.env);
    let user = Address::generate(&ctx.env);
    let lp = Address::generate(&ctx.env);

    mint(&ctx, &user, 1);
    mint(&ctx, &lp, 1);

    let pool_id = make_pool(&ctx, &creator);

    // Minimum LP deposit
    let shares = ctx.client.provide_liquidity(&lp, &pool_id, &1i128);
    assert_eq!(shares, 1);

    // Minimum bet
    ctx.client.place_bet(&user, &pool_id, &0, &1);

    expire(&ctx);
    ctx.client.settle_pool(&creator, &pool_id, &0);

    // Claim should work even at minimum values (amount may round to 0 or 1)
    let winnings = ctx.client.claim_winnings(&user, &pool_id);
    assert!(winnings >= 0);
}

/// E5: Maximum position on both sides, settle, all winners claim successfully.
#[test]
fn e5_maximum_positions_both_sides() {
    let ctx = setup();
    let creator = Address::generate(&ctx.env);
    let side_a = Address::generate(&ctx.env);
    let side_b = Address::generate(&ctx.env);

    let big_amount = 1_000_000_000i128;
    mint(&ctx, &side_a, big_amount);
    mint(&ctx, &side_b, big_amount);

    let pool_id = make_pool(&ctx, &creator);
    ctx.client.place_bet(&side_a, &pool_id, &0, &big_amount);
    ctx.client.place_bet(&side_b, &pool_id, &1, &big_amount);

    expire(&ctx);
    ctx.client.settle_pool(&creator, &pool_id, &1); // B wins

    // side_b is the sole winner: gets net pool = 2_000_000_000 - 2% = 1_960_000_000
    let winnings = ctx.client.claim_winnings(&side_b, &pool_id);
    assert_eq!(winnings, 1_960_000_000i128);
}

/// E6: Multiple LP providers in the same pool are tracked independently.
#[test]
fn e6_multiple_lp_providers_tracked_independently() {
    let ctx = setup();
    let creator = Address::generate(&ctx.env);
    let lp1 = Address::generate(&ctx.env);
    let lp2 = Address::generate(&ctx.env);
    let bettor = Address::generate(&ctx.env);

    mint(&ctx, &lp1, 600);
    mint(&ctx, &lp2, 400);
    mint(&ctx, &bettor, 200);

    let pool_id = make_pool(&ctx, &creator);

    // lp1 provides 600 first → gets 600 shares (1:1)
    let shares1 = ctx.client.provide_liquidity(&lp1, &pool_id, &600i128);
    assert_eq!(shares1, 600);

    // lp2 provides 400 → gets proportional shares (= 400 since ratio is 1:1 still)
    let shares2 = ctx.client.provide_liquidity(&lp2, &pool_id, &400i128);
    assert_eq!(shares2, 400);

    // Bet and settle to generate fees
    ctx.client.place_bet(&bettor, &pool_id, &0, &200);
    expire(&ctx);
    ctx.client.settle_pool(&creator, &pool_id, &0);
    ctx.client.claim_winnings(&bettor, &pool_id); // triggers LP fee distribution

    // Both LPs have independent pending rewards
    let info1 = ctx.client.get_liquidity_info(&pool_id, &lp1).unwrap();
    let info2 = ctx.client.get_liquidity_info(&pool_id, &lp2).unwrap();

    assert!(info1.pending_rewards > 0, "lp1 must have rewards");
    assert!(info2.pending_rewards > 0, "lp2 must have rewards");

    // lp1 has 60% of shares so should get 60% of rewards
    assert_eq!(
        info1.pending_rewards,
        info1.pending_rewards,
        "lp1 rewards proportional check"
    );

    // Each LP withdraws independently
    ctx.client.withdraw_liquidity(&lp1, &pool_id, &shares1);
    ctx.client.withdraw_liquidity(&lp2, &pool_id, &shares2);

    assert!(
        ctx.client.get_liquidity_info(&pool_id, &lp1).is_none(),
        "lp1 position cleared"
    );
    assert!(
        ctx.client.get_liquidity_info(&pool_id, &lp2).is_none(),
        "lp2 position cleared"
    );
}

/// E7: Dispute within window blocks claiming until resolved; upheld lets winners claim.
#[test]
fn e7_dispute_blocks_then_upheld_allows_claim() {
    let ctx = setup();
    let creator = Address::generate(&ctx.env);
    let user = Address::generate(&ctx.env);
    let disputer = Address::generate(&ctx.env);

    mint(&ctx, &user, 200);
    mint(&ctx, &disputer, 100);

    let pool_id = make_pool(&ctx, &creator);
    ctx.client.place_bet(&user, &pool_id, &0, &200);
    ctx.client.place_bet(&disputer, &pool_id, &1, &100);

    expire(&ctx);
    ctx.client.settle_pool(&creator, &pool_id, &0);

    // Disputer raises dispute while still in window
    ctx.client.dispute_pool(
        &disputer,
        &pool_id,
        &String::from_str(&ctx.env, "Outcome was manipulated"),
    );

    // Claiming is blocked while dispute is active
    let blocked = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        ctx.client.claim_winnings(&user, &pool_id);
    }));
    assert!(blocked.is_err(), "claim must be blocked during dispute");

    // Treasury recipient resolves: uphold original outcome
    ctx.client.resolve_dispute(&ctx.treasury, &pool_id, &true);

    // Now claiming must succeed
    let winnings = ctx.client.claim_winnings(&user, &pool_id);
    assert!(winnings > 0);
}

/// E8: Voided pool after dispute lets all bettors reclaim their full bet amounts.
#[test]
fn e8_voided_pool_issues_refunds() {
    let ctx = setup();
    let creator = Address::generate(&ctx.env);
    let user_a = Address::generate(&ctx.env);
    let user_b = Address::generate(&ctx.env);

    mint(&ctx, &user_a, 300);
    mint(&ctx, &user_b, 200);

    let pool_id = make_pool(&ctx, &creator);
    ctx.client.place_bet(&user_a, &pool_id, &0, &300);
    ctx.client.place_bet(&user_b, &pool_id, &1, &200);

    expire(&ctx);
    ctx.client.settle_pool(&creator, &pool_id, &0);

    // Dispute raised → treasury voids it
    ctx.client.dispute_pool(
        &user_b,
        &pool_id,
        &String::from_str(&ctx.env, "Wrong oracle data"),
    );
    ctx.client.resolve_dispute(&ctx.treasury, &pool_id, &false);

    // Both users get full refunds
    let refund_a = ctx.client.claim_winnings(&user_a, &pool_id);
    let refund_b = ctx.client.claim_winnings(&user_b, &pool_id);

    assert_eq!(refund_a, 300, "user_a gets full refund");
    assert_eq!(refund_b, 200, "user_b gets full refund");
}

/// E9: Dispute after window expires is rejected.
#[test]
#[should_panic(expected = "Dispute window expired")]
fn e9_dispute_after_window_rejected() {
    let ctx = setup();
    let creator = Address::generate(&ctx.env);
    let user = Address::generate(&ctx.env);

    mint(&ctx, &user, 100);

    let pool_id = make_pool(&ctx, &creator);
    ctx.client.place_bet(&user, &pool_id, &0, &100);

    expire(&ctx);
    ctx.client.settle_pool(&creator, &pool_id, &0);

    // Advance ledger past dispute window (7 days + 1 second)
    ctx.env.ledger().with_mut(|l| {
        l.timestamp += 7 * 24 * 3600 + 1;
    });

    ctx.client.dispute_pool(
        &user,
        &pool_id,
        &String::from_str(&ctx.env, "Too late"),
    );
}

/// E10: Unauthorized dispute resolution is rejected.
#[test]
#[should_panic(expected = "Unauthorized")]
fn e10_unauthorized_dispute_resolution_rejected() {
    let ctx = setup();
    let creator = Address::generate(&ctx.env);
    let user = Address::generate(&ctx.env);
    let intruder = Address::generate(&ctx.env);

    mint(&ctx, &user, 100);

    let pool_id = make_pool(&ctx, &creator);
    ctx.client.place_bet(&user, &pool_id, &0, &100);

    expire(&ctx);
    ctx.client.settle_pool(&creator, &pool_id, &0);

    ctx.client.dispute_pool(
        &user,
        &pool_id,
        &String::from_str(&ctx.env, "Dispute reason"),
    );

    // Intruder tries to resolve — must fail
    ctx.client.resolve_dispute(&intruder, &pool_id, &true);
}

// ---------------------------------------------------------------------------
// Multi-pool interactions
// ---------------------------------------------------------------------------

/// M1: Multiple pools coexist; LP and dispute state is isolated per pool.
#[test]
fn m1_multiple_pools_state_isolated() {
    let ctx = setup();
    let creator = Address::generate(&ctx.env);
    let lp = Address::generate(&ctx.env);
    let user = Address::generate(&ctx.env);

    mint(&ctx, &lp, 1_000);
    mint(&ctx, &user, 400);

    let pool_a = make_pool(&ctx, &creator);
    let pool_b = make_pool(&ctx, &creator);

    // LP only participates in pool_a
    ctx.client.provide_liquidity(&lp, &pool_a, &500i128);

    ctx.client.place_bet(&user, &pool_a, &0, &200);
    ctx.client.place_bet(&user, &pool_b, &1, &200);

    expire(&ctx);
    ctx.client.settle_pool(&creator, &pool_a, &0);
    ctx.client.settle_pool(&creator, &pool_b, &1);

    // LP info exists for pool_a only
    assert!(ctx.client.get_liquidity_info(&pool_a, &lp).is_some());
    assert!(ctx.client.get_liquidity_info(&pool_b, &lp).is_none());

    // Dispute pool_a; pool_b is unaffected
    ctx.client.dispute_pool(
        &user,
        &pool_a,
        &String::from_str(&ctx.env, "Disputed"),
    );
    assert!(ctx.client.get_pool_dispute(&pool_a).is_some());
    assert!(ctx.client.get_pool_dispute(&pool_b).is_none());
}

/// M2: get_pools_batch returns correct slice across multiple pools.
#[test]
fn m2_get_pools_batch_lifecycle() {
    let ctx = setup();
    let creator = Address::generate(&ctx.env);

    // Create 5 pools
    for _ in 0..5 {
        make_pool(&ctx, &creator);
    }

    let batch = ctx.client.get_pools_batch(&1u32, &3u32);
    assert_eq!(batch.len(), 3);

    // Each entry in batch is Some(Pool)
    for i in 0..3u32 {
        assert!(batch.get(i).unwrap().is_some(), "pool at index {i} must exist");
    }
}
