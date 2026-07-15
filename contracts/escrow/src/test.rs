#![cfg(test)]
use super::*;
use soroban_sdk::{
    testutils::Address as _,
    token, Address, Env, String,
};
use rentsafe_dispute::{RentSafeDispute, RentSafeDisputeClient};


#[test]
fn test_escrow_lifecycle() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let tenant = Address::generate(&env);
    let landlord = Address::generate(&env);

    // Deploy Token
    let token_admin = Address::generate(&env);
    let token_address = env.register_stellar_asset_contract(token_admin);
    let token_client = token::StellarAssetClient::new(&env, &token_address);
    let token = token::Client::new(&env, &token_address);

    // Mint some tokens to tenant
    token_client.mint(&tenant, &1000);

    // Deploy Escrow Contract
    let escrow_id = env.register_contract(None, RentSafeEscrow);
    let escrow_client = RentSafeEscrowClient::new(&env, &escrow_id);

    // Deploy Dispute Contract
    let dispute_id = env.register_contract(None, RentSafeDispute);
    let dispute_client = RentSafeDisputeClient::new(&env, &dispute_id);

    // Initialize both contracts
    escrow_client.initialize(&admin, &token_address);
    dispute_client.initialize(&admin, &escrow_id);
    escrow_client.set_dispute_contract(&dispute_id);

    // Create Agreement
    let agreement_id = escrow_client.create_agreement(&tenant, &landlord, &500);
    assert_eq!(agreement_id, 1);

    let agreement = escrow_client.get_agreement(&agreement_id);
    assert_eq!(agreement.state, 0); // PendingDeposit
    assert_eq!(agreement.amount, 500);

    // Deposit
    escrow_client.deposit(&agreement_id);
    assert_eq!(token.balance(&escrow_id), 500);
    assert_eq!(token.balance(&tenant), 500);

    let agreement = escrow_client.get_agreement(&agreement_id);
    assert_eq!(agreement.state, 1); // Active

    // Propose Deduction: 100 for Landlord, 400 for Tenant
    escrow_client.propose_deduction(&agreement_id, &100, &400);
    let agreement = escrow_client.get_agreement(&agreement_id);
    assert_eq!(agreement.state, 2); // RefundProposed
    assert_eq!(agreement.refund_landlord_amount, 100);
    assert_eq!(agreement.refund_tenant_amount, 400);

    // Approve Deduction
    escrow_client.approve_deduction(&agreement_id);
    assert_eq!(token.balance(&escrow_id), 0);
    assert_eq!(token.balance(&tenant), 900); // 500 + 400 refund
    assert_eq!(token.balance(&landlord), 100); // 100 claim

    let agreement = escrow_client.get_agreement(&agreement_id);
    assert_eq!(agreement.state, 4); // Settled
}

#[test]
fn test_dispute_resolution() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let tenant = Address::generate(&env);
    let landlord = Address::generate(&env);

    // Deploy Token
    let token_admin = Address::generate(&env);
    let token_address = env.register_stellar_asset_contract(token_admin);
    let token_client = token::StellarAssetClient::new(&env, &token_address);
    let token = token::Client::new(&env, &token_address);

    // Mint some tokens to tenant
    token_client.mint(&tenant, &1000);

    // Deploy Escrow Contract
    let escrow_id = env.register_contract(None, RentSafeEscrow);
    let escrow_client = RentSafeEscrowClient::new(&env, &escrow_id);

    // Deploy Dispute Contract
    let dispute_id = env.register_contract(None, RentSafeDispute);
    let dispute_client = RentSafeDisputeClient::new(&env, &dispute_id);

    // Initialize both contracts
    escrow_client.initialize(&admin, &token_address);
    dispute_client.initialize(&admin, &escrow_id);
    escrow_client.set_dispute_contract(&dispute_id);

    // Create & Deposit
    let agreement_id = escrow_client.create_agreement(&tenant, &landlord, &500);
    escrow_client.deposit(&agreement_id);

    // Raise Dispute
    let reason = String::from_str(&env, "Landlord refusing to refund key deposit");
    escrow_client.raise_dispute(&agreement_id, &tenant, &reason);


    let agreement = escrow_client.get_agreement(&agreement_id);
    assert_eq!(agreement.state, 3); // Disputed

    assert_eq!(dispute_client.get_dispute_count(), 1);
    let dispute = dispute_client.get_dispute(&1);
    assert_eq!(dispute.agreement_id, agreement_id);
    assert_eq!(dispute.amount, 500);
    assert_eq!(dispute.state, 0); // Open

    // Resolve dispute: 200 for landlord, 300 for tenant
    dispute_client.resolve_dispute(&1, &200, &300);

    let dispute = dispute_client.get_dispute(&1);
    assert_eq!(dispute.state, 1); // Resolved

    assert_eq!(token.balance(&escrow_id), 0);
    assert_eq!(token.balance(&tenant), 800); // 500 + 300
    assert_eq!(token.balance(&landlord), 200);

    let agreement = escrow_client.get_agreement(&agreement_id);
    assert_eq!(agreement.state, 4); // Settled
}

#[test]
#[should_panic(expected = "Amounts must sum up to the total escrowed deposit")]
fn test_invalid_deduction_sum() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let tenant = Address::generate(&env);
    let landlord = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let token_address = env.register_stellar_asset_contract(token_admin);

    let escrow_id = env.register_contract(None, RentSafeEscrow);
    let escrow_client = RentSafeEscrowClient::new(&env, &escrow_id);

    escrow_client.initialize(&admin, &token_address);

    let token_client = token::StellarAssetClient::new(&env, &token_address);
    token_client.mint(&tenant, &1000);

    let agreement_id = escrow_client.create_agreement(&tenant, &landlord, &500);
    escrow_client.deposit(&agreement_id);

    // Propose invalid sum (e.g. 200 + 200 = 400 instead of 500)
    escrow_client.propose_deduction(&agreement_id, &200, &200);
}

