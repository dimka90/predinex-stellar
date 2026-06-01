//! Contract tests for pool template operations:
//!   create_pool_template → create_pool_from_template → verify pool matches config
//!   get_user_templates → returns correct list
//!   delete_template → removes template; unauthorized deletion rejected
//!   max_templates_per_user cap enforced
//!   template_created and template_deleted events emitted
//!
//! These tests sit alongside the existing unit tests in the contracts/predinex
//! crate and run with `cargo test` without any network access.

#![cfg(test)]
extern crate std;

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Events},
    Address, Env, String, Vec,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn setup() -> (Env, Address, PredinexContractClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();
    let id = env.register(PredinexContract, ());
    let client = PredinexContractClient::new(&env, &id);
    let admin = Address::generate(&env);
    (env, admin, client)
}

fn make_outcomes(env: &Env) -> Vec<String> {
    let mut v = Vec::new(env);
    v.push_back(String::from_str(env, "Yes"));
    v.push_back(String::from_str(env, "No"));
    v
}

// ---------------------------------------------------------------------------
// create_pool_template
// ---------------------------------------------------------------------------

#[test]
fn test_create_pool_template_returns_incrementing_id() {
    let (env, _, client) = setup();
    let owner = Address::generate(&env);

    let id1 = client.create_pool_template(
        &owner,
        &String::from_str(&env, "Daily Sports"),
        &String::from_str(&env, "Standard daily sports market"),
        &make_outcomes(&env),
        &86_400,
        &None,
    );
    let id2 = client.create_pool_template(
        &owner,
        &String::from_str(&env, "Weekly Crypto"),
        &String::from_str(&env, "Weekly crypto price market"),
        &make_outcomes(&env),
        &604_800,
        &None,
    );

    assert_eq!(id1 + 1, id2, "template IDs should be consecutive");
}

#[test]
fn test_create_pool_template_emits_created_event() {
    let (env, _, client) = setup();
    let owner = Address::generate(&env);

    let template_id = client.create_pool_template(
        &owner,
        &String::from_str(&env, "My Template"),
        &String::from_str(&env, "Desc"),
        &make_outcomes(&env),
        &3600,
        &None,
    );

    let events = env.events().all();
    let has_event = events.iter().any(|e| {
        // Topic 0 is the event name symbol
        if let Some(topic) = e.0.get(0) {
            if let Ok(sym) = topic.try_into_val::<Env, Symbol>(&env) {
                return sym == Symbol::new(&env, "pool_template_created");
            }
        }
        false
    });
    assert!(has_event, "pool_template_created event should be emitted");
}

// ---------------------------------------------------------------------------
// create_pool_from_template
// ---------------------------------------------------------------------------

#[test]
fn test_create_pool_from_template_uses_template_defaults() {
    let (env, _, client) = setup();
    let owner = Address::generate(&env);

    let template_id = client.create_pool_template(
        &owner,
        &String::from_str(&env, "Sports Template"),
        &String::from_str(&env, "A reusable sports template"),
        &make_outcomes(&env),
        &7_200,
        &None,
    );

    // No overrides — pool should inherit all template fields
    let pool_id = client.create_pool_from_template(
        &owner,
        &template_id,
        &PoolTemplateOverrides {
            title: None,
            description: None,
            outcomes: None,
            duration: None,
            metadata_uri: None,
        },
    );

    let pool = client.get_pool(&pool_id).expect("pool should exist");
    assert_eq!(pool.creator, owner);
    // Duration-derived expiry should be approximately now + 7200s
    let now = env.ledger().timestamp();
    assert!(
        pool.expires_at >= now + 7_200,
        "pool expiry should reflect template duration"
    );
}

#[test]
fn test_create_pool_from_template_applies_overrides() {
    let (env, _, client) = setup();
    let owner = Address::generate(&env);

    let template_id = client.create_pool_template(
        &owner,
        &String::from_str(&env, "Base Template"),
        &String::from_str(&env, "Base description"),
        &make_outcomes(&env),
        &3_600,
        &None,
    );

    let overridden_title = String::from_str(&env, "Overridden Title");
    let pool_id = client.create_pool_from_template(
        &owner,
        &template_id,
        &PoolTemplateOverrides {
            title: Some(overridden_title.clone()),
            description: None,
            outcomes: None,
            duration: Some(86_400), // override duration
            metadata_uri: None,
        },
    );

    let pool = client.get_pool(&pool_id).expect("pool should exist");
    assert_eq!(pool.title, overridden_title, "overridden title should take effect");

    let now = env.ledger().timestamp();
    assert!(
        pool.expires_at >= now + 86_400,
        "overridden duration should take effect"
    );
}

#[test]
#[should_panic]
fn test_create_pool_from_template_fails_for_nonexistent_template() {
    let (env, _, client) = setup();
    let user = Address::generate(&env);

    client.create_pool_from_template(
        &user,
        &9_999,
        &PoolTemplateOverrides {
            title: None,
            description: None,
            outcomes: None,
            duration: None,
            metadata_uri: None,
        },
    );
}

// ---------------------------------------------------------------------------
// get_user_templates
// ---------------------------------------------------------------------------

#[test]
fn test_get_user_templates_returns_all_owned_templates() {
    let (env, _, client) = setup();
    let owner = Address::generate(&env);

    let id1 = client.create_pool_template(
        &owner,
        &String::from_str(&env, "Template A"),
        &String::from_str(&env, "Desc A"),
        &make_outcomes(&env),
        &3600,
        &None,
    );
    let id2 = client.create_pool_template(
        &owner,
        &String::from_str(&env, "Template B"),
        &String::from_str(&env, "Desc B"),
        &make_outcomes(&env),
        &7200,
        &None,
    );

    let templates = client.get_user_templates(&owner);
    assert_eq!(templates.len(), 2, "user should own 2 templates");
    assert!(
        templates.iter().any(|t| t.id == id1),
        "Template A should be present"
    );
    assert!(
        templates.iter().any(|t| t.id == id2),
        "Template B should be present"
    );
}

#[test]
fn test_get_user_templates_returns_empty_for_new_user() {
    let (env, _, client) = setup();
    let nobody = Address::generate(&env);

    let templates = client.get_user_templates(&nobody);
    assert_eq!(templates.len(), 0, "new user should have no templates");
}

#[test]
fn test_get_user_templates_does_not_include_other_users_templates() {
    let (env, _, client) = setup();
    let alice = Address::generate(&env);
    let bob = Address::generate(&env);

    client.create_pool_template(
        &alice,
        &String::from_str(&env, "Alice's Template"),
        &String::from_str(&env, "Desc"),
        &make_outcomes(&env),
        &3600,
        &None,
    );

    let bob_templates = client.get_user_templates(&bob);
    assert_eq!(bob_templates.len(), 0, "Bob should not see Alice's templates");
}

// ---------------------------------------------------------------------------
// delete_template
// ---------------------------------------------------------------------------

#[test]
fn test_delete_template_removes_the_template() {
    let (env, _, client) = setup();
    let owner = Address::generate(&env);

    let template_id = client.create_pool_template(
        &owner,
        &String::from_str(&env, "To Delete"),
        &String::from_str(&env, "Desc"),
        &make_outcomes(&env),
        &3600,
        &None,
    );

    client.delete_template(&owner, &template_id);

    // After deletion the template should no longer appear for the owner
    let templates = client.get_user_templates(&owner);
    assert_eq!(templates.len(), 0, "template should be removed after deletion");
}

#[test]
fn test_delete_template_emits_deleted_event() {
    let (env, _, client) = setup();
    let owner = Address::generate(&env);

    let template_id = client.create_pool_template(
        &owner,
        &String::from_str(&env, "Event Template"),
        &String::from_str(&env, "Desc"),
        &make_outcomes(&env),
        &3600,
        &None,
    );

    client.delete_template(&owner, &template_id);

    let events = env.events().all();
    let has_event = events.iter().any(|e| {
        if let Some(topic) = e.0.get(0) {
            if let Ok(sym) = topic.try_into_val::<Env, Symbol>(&env) {
                return sym == Symbol::new(&env, "template_deleted");
            }
        }
        false
    });
    assert!(has_event, "template_deleted event should be emitted");
}

#[test]
#[should_panic]
fn test_delete_template_rejects_unauthorized_caller() {
    let (env, _, client) = setup();
    let owner = Address::generate(&env);
    let attacker = Address::generate(&env);

    let template_id = client.create_pool_template(
        &owner,
        &String::from_str(&env, "Protected"),
        &String::from_str(&env, "Desc"),
        &make_outcomes(&env),
        &3600,
        &None,
    );

    // attacker does not own this template and is not treasury recipient
    client.delete_template(&attacker, &template_id);
}

#[test]
#[should_panic]
fn test_delete_template_fails_for_nonexistent_template() {
    let (env, _, client) = setup();
    let user = Address::generate(&env);
    client.delete_template(&user, &9_999);
}

// ---------------------------------------------------------------------------
// max_templates_per_user cap
// ---------------------------------------------------------------------------

#[test]
#[should_panic]
fn test_max_templates_per_user_cap_is_enforced() {
    let (env, _, client) = setup();
    let owner = Address::generate(&env);

    // Set a very low cap so the test runs quickly
    let treasury = Address::generate(&env);
    // In a real integration test the treasury recipient would be initialised;
    // here we rely on mock_all_auths and the default cap being small enough
    // that creating 21 templates triggers the error.
    for i in 0..=20u32 {
        let title = format!("Template {}", i);
        client.create_pool_template(
            &owner,
            &String::from_str(&env, &title),
            &String::from_str(&env, "Desc"),
            &make_outcomes(&env),
            &3600,
            &None,
        );
    }
    // The 21st call (index 20) must panic with TooManyTemplates
}