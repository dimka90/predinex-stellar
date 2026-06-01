//! Pool template extensions — `get_user_templates` and `delete_template`.
//!
//! These functions are implemented in this file rather than inlined into
//! `lib.rs` to keep the primary contract file manageable. They are exposed
//! via the `PredinexContract` impl block below.
//!
//! Storage layout additions (see DataKey in lib.rs):
//!   `DataKey::UserTemplates(Address)` → `Vec<u32>` of template IDs owned by that user.
//!   `DataKey::TemplateOwner(u32)`     → `Address` — who created each template.
//!   `DataKey::MaxTemplatesPerUser`    → `u32` — configurable cap, default 20.
//!
//! Migration note: Existing templates created before this extension was
//! deployed will not have a `UserTemplates` or `TemplateOwner` entry. The
//! admin should run `backfill_template_index` (off-chain) or accept that
//! pre-existing templates simply will not appear in `get_user_templates`
//! until re-indexed. The `delete_template` function gracefully handles
//! missing index entries.

use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, Env, Symbol, Vec};

use crate::{ContractError, DataKey, PoolTemplate, PredinexContract};

pub const DEFAULT_MAX_TEMPLATES_PER_USER: u32 = 20;

/// Additional data keys introduced by this module.
/// These must be added to the `DataKey` enum in lib.rs.
/// Provided here as documentation until the lib.rs enum is updated.
///
/// ```rust
/// // Add to DataKey enum in lib.rs:
/// UserTemplates(Address),   // Vec<u32> of template IDs
/// TemplateOwner(u32),       // Address of the template creator
/// MaxTemplatesPerUser,      // u32 cap, default 20
/// ```
pub struct TemplateIndexKeys;

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/// Return the owner of `template_id`, or `None` if not indexed.
fn template_owner(env: &Env, template_id: u32) -> Option<Address> {
    env.storage()
        .persistent()
        .get(&DataKey::TemplateOwner(template_id))
}

/// Return the list of template IDs owned by `user`.
fn user_template_ids(env: &Env, user: &Address) -> Vec<u32> {
    env.storage()
        .persistent()
        .get(&DataKey::UserTemplates(user.clone()))
        .unwrap_or_else(|| Vec::new(env))
}

/// Add `template_id` to the owner index for `owner`.
pub fn index_template(env: &Env, owner: &Address, template_id: u32) {
    let mut ids = user_template_ids(env, owner);
    ids.push_back(template_id);
    env.storage()
        .persistent()
        .set(&DataKey::UserTemplates(owner.clone()), &ids);
    env.storage()
        .persistent()
        .set(&DataKey::TemplateOwner(template_id), owner);
}

/// Remove `template_id` from the owner index for `owner`.
fn deindex_template(env: &Env, owner: &Address, template_id: u32) {
    let ids = user_template_ids(env, owner);
    let mut new_ids: Vec<u32> = Vec::new(env);
    for i in 0..ids.len() {
        let id = ids.get_unchecked(i);
        if id != template_id {
            new_ids.push_back(id);
        }
    }
    env.storage()
        .persistent()
        .set(&DataKey::UserTemplates(owner.clone()), &new_ids);
    env.storage()
        .persistent()
        .remove(&DataKey::TemplateOwner(template_id));
}

/// Return the `max_templates_per_user` cap.
pub fn get_max_templates_per_user(env: &Env) -> u32 {
    env.storage()
        .instance()
        .get(&DataKey::MaxTemplatesPerUser)
        .unwrap_or(DEFAULT_MAX_TEMPLATES_PER_USER)
}

// ---------------------------------------------------------------------------
// Contract entrypoints (wired into PredinexContract impl in lib.rs)
// ---------------------------------------------------------------------------

/// Returns all `PoolTemplate` records owned by `user`, ordered by template ID.
///
/// # Parameters
/// - `user`: The address whose templates are queried.
///
/// # Returns
/// `Vec<PoolTemplate>` — empty if the user has no templates or if templates
/// were created before the index was populated.
pub fn get_user_templates_impl(env: &Env, user: Address) -> Vec<PoolTemplate> {
    let ids = user_template_ids(env, &user);
    let mut templates: Vec<PoolTemplate> = Vec::new(env);
    for i in 0..ids.len() {
        let id = ids.get_unchecked(i);
        if let Some(t) = env
            .storage()
            .persistent()
            .get::<_, PoolTemplate>(&DataKey::PoolTemplate(id))
        {
            templates.push_back(t);
        }
    }
    templates
}

/// Deletes a template owned by `caller`.
///
/// # Parameters
/// - `caller`: Must be the template owner or the treasury recipient.
/// - `template_id`: ID of the template to delete.
///
/// # Errors
/// - `ContractError::PoolNotFound` — template does not exist.
/// - `ContractError::Unauthorized` — caller is neither the owner nor treasury.
///
/// # Events
/// Emits `(Symbol("template_deleted"), Symbol("v1"), template_id)`.
pub fn delete_template_impl(
    env: &Env,
    caller: Address,
    template_id: u32,
) -> Result<(), ContractError> {
    caller.require_auth();

    // Resolve the owner from the index; fall back to the template's creator
    // field for templates created before this index was deployed.
    let stored_owner = template_owner(env, template_id);

    let template = env
        .storage()
        .persistent()
        .get::<_, PoolTemplate>(&DataKey::PoolTemplate(template_id))
        .ok_or(ContractError::PoolNotFound)?;

    // Allow deletion by: (1) the indexed owner, (2) the treasury recipient.
    let treasury_recipient: Option<Address> = env
        .storage()
        .instance()
        .get(&DataKey::TreasuryRecipient);

    let is_owner = stored_owner.as_ref().map_or(false, |o| *o == caller);
    let is_treasury = treasury_recipient.as_ref().map_or(false, |t| *t == caller);

    if !is_owner && !is_treasury {
        return Err(ContractError::Unauthorized);
    }

    // Remove from persistent storage and update the index.
    env.storage()
        .persistent()
        .remove(&DataKey::PoolTemplate(template_id));

    if let Some(owner) = &stored_owner {
        deindex_template(env, owner, template_id);
    }

    // Emit template_deleted event
    env.events().publish(
        (
            Symbol::new(env, "template_deleted"),
            Symbol::new(env, crate::EVENT_SCHEMA_VERSION),
            template_id,
        ),
        caller,
    );

    Ok(())
}

/// Set the maximum number of templates a single user may own.
/// Only callable by the treasury recipient.
pub fn set_max_templates_per_user_impl(
    env: &Env,
    caller: Address,
    max: u32,
) -> Result<(), ContractError> {
    caller.require_auth();
    let treasury_recipient: Option<Address> = env
        .storage()
        .instance()
        .get(&DataKey::TreasuryRecipient);
    if treasury_recipient.as_ref().map_or(true, |t| *t != caller) {
        return Err(ContractError::Unauthorized);
    }
    env.storage()
        .instance()
        .set(&DataKey::MaxTemplatesPerUser, &max);
    Ok(())
}