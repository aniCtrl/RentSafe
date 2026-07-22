#![no_std]

use soroban_sdk::{
    contract, contractclient, contracterror, contractimpl, contracttype, token, Address, BytesN,
    Env, String, Symbol, Vec,
};

#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[contracterror]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    NotAuthorized = 3,
    InvalidAmount = 4,
    InvalidLeaseRange = 5,
    AgreementNotFound = 6,
    InvalidState = 7,
    NoPendingDeduction = 8,
    NoResolutionAvailable = 9,
    InvalidResolution = 10,
    ArithmeticError = 11,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct EscrowConfig {
    pub admin: Address,
    pub dispute_contract: Address,
    pub asset: Address,
}

#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub enum AgreementStatus {
    Created = 0,
    Funded = 1,
    Active = 2,
    RefundRequested = 3,
    DeductionRequested = 4,
    DeductionAccepted = 5,
    DeductionRejected = 6,
    Disputed = 7,
    AwaitingArbitration = 8,
    Settled = 9,
    Closed = 10,
}

#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub enum ResolutionSource {
    FullRefund = 0,
    DeductionAccepted = 1,
    Arbitration = 2,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct Agreement {
    pub id: u64,
    pub landlord: Address,
    pub tenant: Address,
    pub property_details: String,
    pub deposit_amount: i128,
    pub rent_amount: i128,
    pub lease_start: u64,
    pub lease_end: u64,
    pub status: AgreementStatus,
    pub created_at: u64,
    pub funded_at: u64,
    pub has_deduction_request: bool,
    pub deduction_amount: i128,
    pub deduction_reason: String,
    pub deduction_requested_at: u64,
    pub has_dispute: bool,
    pub dispute_id: u64,
    pub has_resolution: bool,
    pub resolution_landlord_amount: i128,
    pub resolution_tenant_amount: i128,
    pub resolution_source: ResolutionSource,
    pub resolution_at: u64,
}

#[derive(Clone)]
#[contracttype]
pub enum EscrowDataKey {
    Config,
    NextAgreementId,
    Agreement(u64),
    AgreementIds,
}

#[contractclient(name = "DisputeRegistryClient")]
pub trait DisputeContractInterface {
    fn register_dispute(
        env: Env,
        agreement_id: u64,
        landlord: Address,
        tenant: Address,
        raised_by: Address,
        reason: String,
    ) -> u64;
    fn submit_evidence(env: Env, dispute_id: u64, submitter: Address, evidence_ref: String);
}

#[contract]
pub struct EscrowContract;

#[contractimpl]
impl EscrowContract {
    pub fn initialize(
        env: Env,
        admin: Address,
        dispute_contract: Address,
        asset: Address,
    ) -> Result<(), Error> {
        if env.storage().instance().has(&EscrowDataKey::Config) {
            return Err(Error::AlreadyInitialized);
        }

        admin.require_auth();

        let config = EscrowConfig {
            admin: admin.clone(),
            dispute_contract: dispute_contract.clone(),
            asset,
        };

        env.storage()
            .instance()
            .set(&EscrowDataKey::Config, &config);
        env.storage()
            .instance()
            .set(&EscrowDataKey::NextAgreementId, &1_u64);
        env.storage()
            .persistent()
            .set(&EscrowDataKey::AgreementIds, &Vec::<u64>::new(&env));

        env.events().publish(
            (Symbol::new(&env, "escrow_initialized"),),
            (admin, dispute_contract),
        );

        Ok(())
    }

    pub fn create_agreement(
        env: Env,
        landlord: Address,
        tenant: Address,
        property_details: String,
        deposit_amount: i128,
        rent_amount: i128,
        lease_start: u64,
        lease_end: u64,
    ) -> Result<u64, Error> {
        Self::require_initialized(&env)?;
        landlord.require_auth();

        if deposit_amount <= 0 || rent_amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        if lease_start >= lease_end {
            return Err(Error::InvalidLeaseRange);
        }

        let id = Self::next_agreement_id(&env);
        let agreement = Agreement {
            id,
            landlord: landlord.clone(),
            tenant: tenant.clone(),
            property_details,
            deposit_amount,
            rent_amount,
            lease_start,
            lease_end,
            status: AgreementStatus::Created,
            created_at: env.ledger().timestamp(),
            funded_at: 0,
            has_deduction_request: false,
            deduction_amount: 0,
            deduction_reason: String::from_str(&env, ""),
            deduction_requested_at: 0,
            has_dispute: false,
            dispute_id: 0,
            has_resolution: false,
            resolution_landlord_amount: 0,
            resolution_tenant_amount: 0,
            resolution_source: ResolutionSource::FullRefund,
            resolution_at: 0,
        };

        Self::save_agreement(&env, &agreement);
        Self::append_agreement_id(&env, id);
        let next_id = id.checked_add(1).ok_or(Error::ArithmeticError)?;
        env.storage()
            .instance()
            .set(&EscrowDataKey::NextAgreementId, &next_id);

        env.events().publish(
            (Symbol::new(&env, "agreement_created"), id),
            (
                landlord,
                tenant,
                agreement.deposit_amount,
                agreement.rent_amount,
            ),
        );

        Ok(id)
    }

    pub fn lock_deposit(env: Env, agreement_id: u64) -> Result<(), Error> {
        let config = Self::get_config(env.clone())?;
        let mut agreement = Self::get_agreement(env.clone(), agreement_id)?;

        if agreement.status != AgreementStatus::Created {
            return Err(Error::InvalidState);
        }

        agreement.tenant.require_auth();

        let token_client = token::Client::new(&env, &config.asset);
        token_client.transfer(
            &agreement.tenant,
            &env.current_contract_address(),
            &agreement.deposit_amount,
        );

        agreement.status = AgreementStatus::Funded;
        agreement.funded_at = env.ledger().timestamp();
        Self::save_agreement(&env, &agreement);

        env.events().publish(
            (Symbol::new(&env, "deposit_locked"), agreement_id),
            (agreement.tenant, agreement.deposit_amount),
        );

        Ok(())
    }

    pub fn request_full_refund(env: Env, agreement_id: u64) -> Result<(), Error> {
        let mut agreement = Self::get_agreement(env.clone(), agreement_id)?;
        agreement.landlord.require_auth();

        Self::promote_funded_to_active(&env, &mut agreement);
        if agreement.status != AgreementStatus::Active {
            return Err(Error::InvalidState);
        }

        agreement.has_resolution = true;
        agreement.resolution_landlord_amount = 0;
        agreement.resolution_tenant_amount = agreement.deposit_amount;
        agreement.resolution_source = ResolutionSource::FullRefund;
        agreement.resolution_at = env.ledger().timestamp();
        agreement.has_deduction_request = false;
        agreement.deduction_amount = 0;
        agreement.deduction_reason = String::from_str(&env, "");
        agreement.deduction_requested_at = 0;
        agreement.status = AgreementStatus::RefundRequested;
        Self::save_agreement(&env, &agreement);

        env.events().publish(
            (Symbol::new(&env, "refund_requested"), agreement_id),
            (agreement.landlord, agreement.deposit_amount),
        );

        Ok(())
    }

    pub fn request_deduction(
        env: Env,
        agreement_id: u64,
        amount: i128,
        reason: String,
    ) -> Result<(), Error> {
        let mut agreement = Self::get_agreement(env.clone(), agreement_id)?;
        agreement.landlord.require_auth();

        Self::promote_funded_to_active(&env, &mut agreement);
        if agreement.status != AgreementStatus::Active {
            return Err(Error::InvalidState);
        }

        if amount <= 0 || amount > agreement.deposit_amount {
            return Err(Error::InvalidAmount);
        }

        agreement.has_deduction_request = true;
        agreement.deduction_amount = amount;
        agreement.deduction_reason = reason.clone();
        agreement.deduction_requested_at = env.ledger().timestamp();
        agreement.has_resolution = false;
        agreement.status = AgreementStatus::DeductionRequested;
        Self::save_agreement(&env, &agreement);

        env.events().publish(
            (Symbol::new(&env, "deduction_requested"), agreement_id),
            (agreement.landlord, amount, reason),
        );

        Ok(())
    }

    pub fn respond_to_deduction(env: Env, agreement_id: u64, accept: bool) -> Result<(), Error> {
        let mut agreement = Self::get_agreement(env.clone(), agreement_id)?;
        agreement.tenant.require_auth();

        if agreement.status != AgreementStatus::DeductionRequested {
            return Err(Error::InvalidState);
        }

        if !agreement.has_deduction_request {
            return Err(Error::NoPendingDeduction);
        }

        if accept {
            agreement.has_resolution = true;
            agreement.resolution_landlord_amount = agreement.deduction_amount;
            agreement.resolution_tenant_amount = agreement
                .deposit_amount
                .checked_sub(agreement.deduction_amount)
                .ok_or(Error::ArithmeticError)?;
            agreement.resolution_source = ResolutionSource::DeductionAccepted;
            agreement.resolution_at = env.ledger().timestamp();
            agreement.status = AgreementStatus::DeductionAccepted;
            env.events().publish(
                (Symbol::new(&env, "deduction_accepted"), agreement_id),
                (agreement.tenant.clone(), agreement.deduction_amount),
            );
        } else {
            agreement.has_resolution = false;
            agreement.status = AgreementStatus::DeductionRejected;
            env.events().publish(
                (Symbol::new(&env, "deduction_rejected"), agreement_id),
                (agreement.tenant.clone(), agreement.deduction_amount),
            );
        }

        Self::save_agreement(&env, &agreement);
        Ok(())
    }

    pub fn raise_dispute(
        env: Env,
        agreement_id: u64,
        raised_by: Address,
        reason: String,
        evidence_ref: String,
    ) -> Result<u64, Error> {
        let config = Self::get_config(env.clone())?;
        let mut agreement = Self::get_agreement(env.clone(), agreement_id)?;

        raised_by.require_auth();
        if raised_by != agreement.landlord && raised_by != agreement.tenant {
            return Err(Error::NotAuthorized);
        }

        if agreement.status != AgreementStatus::DeductionRejected {
            return Err(Error::InvalidState);
        }

        agreement.status = AgreementStatus::Disputed;
        Self::save_agreement(&env, &agreement);

        let dispute_client = DisputeRegistryClient::new(&env, &config.dispute_contract);
        let dispute_id = dispute_client.register_dispute(
            &agreement_id,
            &agreement.landlord,
            &agreement.tenant,
            &raised_by,
            &reason,
        );
        dispute_client.submit_evidence(&dispute_id, &raised_by, &evidence_ref);

        agreement.has_dispute = true;
        agreement.dispute_id = dispute_id;
        agreement.status = AgreementStatus::AwaitingArbitration;
        Self::save_agreement(&env, &agreement);

        env.events().publish(
            (Symbol::new(&env, "dispute_raised"), agreement_id),
            (dispute_id, raised_by, reason, evidence_ref),
        );

        Ok(dispute_id)
    }

    pub fn settle(env: Env, agreement_id: u64) -> Result<(), Error> {
        let mut agreement = Self::get_agreement(env.clone(), agreement_id)?;
        if !agreement.has_resolution {
            return Err(Error::NoResolutionAvailable);
        }

        match agreement.status {
            AgreementStatus::RefundRequested | AgreementStatus::DeductionAccepted => {
                Self::disburse(
                    &env,
                    &agreement,
                    agreement.resolution_landlord_amount,
                    agreement.resolution_tenant_amount,
                )?;
                agreement.status = AgreementStatus::Settled;
                agreement.has_deduction_request = false;
                agreement.deduction_amount = 0;
                agreement.deduction_reason = String::from_str(&env, "");
                agreement.deduction_requested_at = 0;
                Self::save_agreement(&env, &agreement);
                Self::emit_settled(
                    &env,
                    agreement_id,
                    agreement.resolution_landlord_amount,
                    agreement.resolution_tenant_amount,
                    agreement.resolution_source,
                );
                Ok(())
            }
            _ => Err(Error::InvalidState),
        }
    }

    pub fn resolve_dispute_callback(
        env: Env,
        agreement_id: u64,
        landlord_amount: i128,
        tenant_amount: i128,
    ) -> Result<(), Error> {
        let config = Self::get_config(env.clone())?;
        config.dispute_contract.require_auth();

        let mut agreement = Self::get_agreement(env.clone(), agreement_id)?;
        if agreement.status != AgreementStatus::AwaitingArbitration
            && agreement.status != AgreementStatus::Disputed
        {
            return Err(Error::InvalidState);
        }

        let total_amount = landlord_amount
            .checked_add(tenant_amount)
            .ok_or(Error::ArithmeticError)?;

        if landlord_amount < 0
            || tenant_amount < 0
            || total_amount != agreement.deposit_amount
        {
            return Err(Error::InvalidResolution);
        }

        Self::disburse(&env, &agreement, landlord_amount, tenant_amount)?;

        agreement.has_resolution = true;
        agreement.resolution_landlord_amount = landlord_amount;
        agreement.resolution_tenant_amount = tenant_amount;
        agreement.resolution_source = ResolutionSource::Arbitration;
        agreement.resolution_at = env.ledger().timestamp();
        agreement.status = AgreementStatus::Settled;
        agreement.has_deduction_request = false;
        agreement.deduction_amount = 0;
        agreement.deduction_reason = String::from_str(&env, "");
        agreement.deduction_requested_at = 0;
        Self::save_agreement(&env, &agreement);

        env.events().publish(
            (Symbol::new(&env, "dispute_resolved"), agreement_id),
            (landlord_amount, tenant_amount),
        );
        Self::emit_settled(
            &env,
            agreement_id,
            landlord_amount,
            tenant_amount,
            ResolutionSource::Arbitration,
        );

        Ok(())
    }

    pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) -> Result<(), Error> {
        let config = Self::get_config(env.clone())?;
        config.admin.require_auth();
        env.deployer().update_current_contract_wasm(new_wasm_hash);
        Ok(())
    }

    pub fn get_config(env: Env) -> Result<EscrowConfig, Error> {
        env.storage()
            .instance()
            .get(&EscrowDataKey::Config)
            .ok_or(Error::NotInitialized)
    }

    pub fn get_agreement(env: Env, agreement_id: u64) -> Result<Agreement, Error> {
        env.storage()
            .persistent()
            .get(&EscrowDataKey::Agreement(agreement_id))
            .ok_or(Error::AgreementNotFound)
    }

    pub fn get_agreement_ids(env: Env) -> Result<Vec<u64>, Error> {
        Self::require_initialized(&env)?;
        Ok(env
            .storage()
            .persistent()
            .get(&EscrowDataKey::AgreementIds)
            .unwrap_or(Vec::new(&env)))
    }

    pub fn get_agreement_parties(env: Env, agreement_id: u64) -> Result<(Address, Address), Error> {
        let agreement = Self::get_agreement(env, agreement_id)?;
        Ok((agreement.landlord, agreement.tenant))
    }

    fn require_initialized(env: &Env) -> Result<(), Error> {
        if env.storage().instance().has(&EscrowDataKey::Config) {
            Ok(())
        } else {
            Err(Error::NotInitialized)
        }
    }

    fn next_agreement_id(env: &Env) -> u64 {
        env.storage()
            .instance()
            .get(&EscrowDataKey::NextAgreementId)
            .unwrap_or(1_u64)
    }

    fn append_agreement_id(env: &Env, agreement_id: u64) {
        let mut ids: Vec<u64> = env
            .storage()
            .persistent()
            .get(&EscrowDataKey::AgreementIds)
            .unwrap_or(Vec::new(env));
        ids.push_back(agreement_id);
        env.storage()
            .persistent()
            .set(&EscrowDataKey::AgreementIds, &ids);
    }

    fn save_agreement(env: &Env, agreement: &Agreement) {
        env.storage()
            .persistent()
            .set(&EscrowDataKey::Agreement(agreement.id), agreement);
    }

    fn promote_funded_to_active(env: &Env, agreement: &mut Agreement) {
        if agreement.status == AgreementStatus::Funded {
            agreement.status = AgreementStatus::Active;
            env.events().publish(
                (Symbol::new(env, "agreement_active"), agreement.id),
                (agreement.landlord.clone(), agreement.tenant.clone()),
            );
        }
    }

    fn disburse(
        env: &Env,
        agreement: &Agreement,
        landlord_amount: i128,
        tenant_amount: i128,
    ) -> Result<(), Error> {
        let total_amount = landlord_amount
            .checked_add(tenant_amount)
            .ok_or(Error::ArithmeticError)?;

        if landlord_amount < 0
            || tenant_amount < 0
            || total_amount != agreement.deposit_amount
        {
            return Err(Error::InvalidResolution);
        }

        let config = Self::get_config(env.clone())?;
        let token_client = token::Client::new(env, &config.asset);

        if landlord_amount > 0 {
            token_client.transfer(
                &env.current_contract_address(),
                &agreement.landlord,
                &landlord_amount,
            );
        }

        if tenant_amount > 0 {
            token_client.transfer(
                &env.current_contract_address(),
                &agreement.tenant,
                &tenant_amount,
            );
        }

        Ok(())
    }

    fn emit_settled(
        env: &Env,
        agreement_id: u64,
        landlord_amount: i128,
        tenant_amount: i128,
        source: ResolutionSource,
    ) {
        env.events().publish(
            (Symbol::new(env, "settled"), agreement_id),
            (landlord_amount, tenant_amount, source),
        );
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use rentsafe_dispute::{DisputeContract, DisputeContractClient, DisputeStatus};
    use soroban_sdk::testutils::{Address as _, MockAuth, MockAuthInvoke};
    use soroban_sdk::IntoVal;

    #[test]
    fn test_create_agreement_and_lock_deposit_access_control() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let landlord = Address::generate(&env);
        let tenant = Address::generate(&env);
        let token_admin = Address::generate(&env);

        let token_address = env
            .register_stellar_asset_contract_v2(token_admin.clone())
            .address();
        let token_admin_client = token::StellarAssetClient::new(&env, &token_address);
        let token_client = token::Client::new(&env, &token_address);

        let escrow_address = env.register(EscrowContract, ());
        let dispute_address = env.register(DisputeContract, ());
        let escrow_client = EscrowContractClient::new(&env, &escrow_address);
        let dispute_client = DisputeContractClient::new(&env, &dispute_address);

        env.mock_all_auths_allowing_non_root_auth();
        escrow_client.initialize(&admin, &dispute_address, &token_address);
        dispute_client.initialize(&admin, &escrow_address);

        let agreement_id = escrow_client.create_agreement(
            &landlord,
            &tenant,
            &String::from_str(&env, "221B Baker Street"),
            &1_000,
            &2_500,
            &10,
            &20,
        );

        let agreement = escrow_client.get_agreement(&agreement_id);
        assert_eq!(agreement.status, AgreementStatus::Created);

        token_admin_client.mint(&tenant, &1_000);

        env.set_auths(&[MockAuth {
            address: &landlord,
            invoke: &MockAuthInvoke {
                contract: &escrow_address,
                fn_name: "lock_deposit",
                args: (agreement_id,).into_val(&env),
                sub_invokes: &[],
            },
        }
        .into()]);
        let unauthorized = escrow_client.try_lock_deposit(&agreement_id);
        assert!(unauthorized.is_err());

        env.mock_all_auths();
        escrow_client.lock_deposit(&agreement_id);
        let funded = escrow_client.get_agreement(&agreement_id);
        assert_eq!(funded.status, AgreementStatus::Funded);
        assert_eq!(token_client.balance(&escrow_address), 1_000);
    }

    #[test]
    fn test_request_deduction_accept_and_settle_happy_path() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let landlord = Address::generate(&env);
        let tenant = Address::generate(&env);
        let token_admin = Address::generate(&env);

        let token_address = env
            .register_stellar_asset_contract_v2(token_admin.clone())
            .address();
        let token_admin_client = token::StellarAssetClient::new(&env, &token_address);
        let token_client = token::Client::new(&env, &token_address);

        let escrow_address = env.register(EscrowContract, ());
        let dispute_address = env.register(DisputeContract, ());
        let escrow_client = EscrowContractClient::new(&env, &escrow_address);
        let dispute_client = DisputeContractClient::new(&env, &dispute_address);

        env.mock_all_auths_allowing_non_root_auth();
        escrow_client.initialize(&admin, &dispute_address, &token_address);
        dispute_client.initialize(&admin, &escrow_address);

        let agreement_id = escrow_client.create_agreement(
            &landlord,
            &tenant,
            &String::from_str(&env, "Dock 9"),
            &1_000,
            &2_000,
            &10,
            &20,
        );

        token_admin_client.mint(&tenant, &1_000);
        escrow_client.lock_deposit(&agreement_id);
        escrow_client.request_deduction(
            &agreement_id,
            &300,
            &String::from_str(&env, "Painting repairs"),
        );

        let requested = escrow_client.get_agreement(&agreement_id);
        assert_eq!(requested.status, AgreementStatus::DeductionRequested);

        escrow_client.respond_to_deduction(&agreement_id, &true);
        let accepted = escrow_client.get_agreement(&agreement_id);
        assert_eq!(accepted.status, AgreementStatus::DeductionAccepted);

        escrow_client.settle(&agreement_id);
        let settled = escrow_client.get_agreement(&agreement_id);
        assert_eq!(settled.status, AgreementStatus::Settled);
        assert_eq!(token_client.balance(&landlord), 300);
        assert_eq!(token_client.balance(&tenant), 700);
        assert_eq!(token_client.balance(&escrow_address), 0);
    }

    #[test]
    fn test_full_round_trip_dispute_resolution() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let landlord = Address::generate(&env);
        let tenant = Address::generate(&env);
        let token_admin = Address::generate(&env);

        let token_address = env
            .register_stellar_asset_contract_v2(token_admin.clone())
            .address();
        let token_admin_client = token::StellarAssetClient::new(&env, &token_address);
        let token_client = token::Client::new(&env, &token_address);

        let escrow_address = env.register(EscrowContract, ());
        let dispute_address = env.register(DisputeContract, ());
        let escrow_client = EscrowContractClient::new(&env, &escrow_address);
        let dispute_client = DisputeContractClient::new(&env, &dispute_address);

        env.mock_all_auths_allowing_non_root_auth();
        escrow_client.initialize(&admin, &dispute_address, &token_address);
        dispute_client.initialize(&admin, &escrow_address);

        let agreement_id = escrow_client.create_agreement(
            &landlord,
            &tenant,
            &String::from_str(&env, "Ocean View"),
            &1_000,
            &2_200,
            &10,
            &20,
        );

        token_admin_client.mint(&tenant, &1_000);
        escrow_client.lock_deposit(&agreement_id);
        escrow_client.request_deduction(
            &agreement_id,
            &400,
            &String::from_str(&env, "Broken window"),
        );
        escrow_client.respond_to_deduction(&agreement_id, &false);

        let dispute_id = escrow_client.raise_dispute(
            &agreement_id,
            &tenant,
            &String::from_str(&env, "Damage amount disputed"),
            &String::from_str(&env, "ipfs://tenant-photo-proof"),
        );

        let agreement = escrow_client.get_agreement(&agreement_id);
        assert_eq!(agreement.status, AgreementStatus::AwaitingArbitration);
        assert!(agreement.has_dispute);
        assert_eq!(agreement.dispute_id, dispute_id);

        let dispute = dispute_client.get_dispute(&dispute_id);
        assert_eq!(dispute.status, DisputeStatus::EvidenceSubmitted);
        assert_eq!(dispute.agreement_id, agreement_id);
        assert_eq!(dispute.evidence.len(), 1);

        env.mock_all_auths_allowing_non_root_auth();
        dispute_client.resolve_dispute(&dispute_id, &250, &750);

        let settled = escrow_client.get_agreement(&agreement_id);
        let resolved_dispute = dispute_client.get_dispute(&dispute_id);

        assert_eq!(settled.status, AgreementStatus::Settled);
        assert_eq!(resolved_dispute.status, DisputeStatus::Resolved);
        assert_eq!(token_client.balance(&landlord), 250);
        assert_eq!(token_client.balance(&tenant), 750);
        assert_eq!(token_client.balance(&escrow_address), 0);
    }

    #[test]
    fn test_create_agreement_bug_reproduce() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let landlord = Address::from_string(&String::from_str(&env, "GDR3SRDLBF4AIB2MPJMKH7CGZS66ODLUE7CGBJB3A4J6JSZ5FMHNN7C5"));
        let tenant = Address::from_string(&String::from_str(&env, "GBQI7VAINDSJQCVABBIRZOL3WQD3L6PEGE76BBVRV5STJ5RIMZZCASJL"));
        let token_address = Address::generate(&env);
        let dispute_address = Address::generate(&env);

        let escrow_address = env.register(EscrowContract, ());
        let escrow_client = EscrowContractClient::new(&env, &escrow_address);

        env.mock_all_auths_allowing_non_root_auth();
        escrow_client.initialize(&admin, &dispute_address, &token_address);

        let _agreement_id = escrow_client.create_agreement(
            &landlord,
            &tenant,
            &String::from_str(&env, "hi"),
            &100_000_000,
            &10_000_000,
            &1785196800,
            &1785369599,
        );
    }

    #[test]
    #[should_panic(expected = "HostError: Error(Contract, #2)")]
    fn test_create_agreement_uninitialized_panics() {
        let env = Env::default();
        let landlord = Address::generate(&env);
        let tenant = Address::generate(&env);

        let escrow_address = env.register(EscrowContract, ());
        let escrow_client = EscrowContractClient::new(&env, &escrow_address);

        escrow_client.create_agreement(
            &landlord,
            &tenant,
            &String::from_str(&env, "hi"),
            &100,
            &10,
            &10,
            &20,
        );
    }
}
