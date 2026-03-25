#![cfg(test)]
use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env};

#[test]
fn test_create_pool() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(None, PredinexContract);
    let client = PredinexContractClient::new(&env, &contract_id);

    let creator = Address::generate(&env);
    let title = String::from_str(&env, "Market 1");
    let description = String::from_str(&env, "Desc 1");
    let outcome_a = String::from_str(&env, "Yes");
    let outcome_b = String::from_str(&env, "No");
    let duration = 3600;

    let pool_id = client.create_pool(
        &creator,
        &title,
        &description,
        &outcome_a,
        &outcome_b,
        &duration,
    );
    assert_eq!(pool_id, 2);

    let pool = client.get_pool(&pool_id).unwrap();
    assert_eq!(pool.creator, creator);
    assert_eq!(pool.title, title);
}

#[test]
fn test_place_bet() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(None, PredinexContract);
    let client = PredinexContractClient::new(&env, &contract_id);

    let token_admin = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token = token::Client::new(&env, &token_id);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_id);

    client.initialize(&token_id.address());

    let creator = Address::generate(&env);
    let user = Address::generate(&env);

    token_admin_client.mint(&user, &1000);

    let title = String::from_str(&env, "Market 1");
    let description = String::from_str(&env, "Desc 1");
    let outcome_a = String::from_str(&env, "Yes");
    let outcome_b = String::from_str(&env, "No");
    let duration = 3600;

    let pool_id = client.create_pool(
        &creator,
        &title,
        &description,
        &outcome_a,
        &outcome_b,
        &duration,
    );

    client.place_bet(&user, &pool_id, &0, &100);

    let pool = client.get_pool(&pool_id).unwrap();
    assert_eq!(pool.total_a, 100);
    assert_eq!(token.balance(&user), 900);
    assert_eq!(token.balance(&contract_id), 100);
}

#[test]
fn test_settle_and_claim() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(None, PredinexContract);
    let client = PredinexContractClient::new(&env, &contract_id);

    let token_admin = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token = token::Client::new(&env, &token_id);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_id);

    client.initialize(&token_id.address());

    let creator = Address::generate(&env);
    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);

    token_admin_client.mint(&user1, &1000);
    token_admin_client.mint(&user2, &1000);

    let title = String::from_str(&env, "Market 1");
    let description = String::from_str(&env, "Desc 1");
    let outcome_a = String::from_str(&env, "Yes");
    let outcome_b = String::from_str(&env, "No");
    let duration = 3600;

    let pool_id = client.create_pool(
        &creator,
        &title,
        &description,
        &outcome_a,
        &outcome_b,
        &duration,
    );

    client.place_bet(&user1, &pool_id, &0, &100);
    client.place_bet(&user2, &pool_id, &1, &100);

    // Settle with outcome 0 (A wins)
    client.settle_pool(&creator, &pool_id, &0);

    let pool = client.get_pool(&pool_id).unwrap();
    assert!(pool.settled);
    assert_eq!(pool.winning_outcome, Some(0));

    // User 1 claims
    let winnings = client.claim_winnings(&user1, &pool_id);

    // Total pool = 200. Fee (2%) = 4. Net = 196.
    // User1 bet 100 on winning outcome (0). Total winners = 100.
    // Share = 100 * 196 / 100 = 196.
    assert_eq!(winnings, 196);
    assert_eq!(token.balance(&user1), 900 + 196);
}
