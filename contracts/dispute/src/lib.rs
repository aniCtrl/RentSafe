#![no_std]

use soroban_sdk::{
    contract, contractclient, contracterror, contractimpl, contracttype, Address, BytesN, Env,
    String, Symbol, Vec,
};

#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[contracterror]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    NotAuthorized = 3,
    InvalidState = 4,
    DisputeNotFound = 5,
    DisputeAlreadyExists = 6,
    InvalidOutcome = 7,
    InvalidParticipant = 8,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct DisputeConfig {
    pub admin: Address,
    pub escrow_contract: Address,
}

#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub enum DisputeStatus {
    Open = 0,
    EvidenceSubmitted = 1,
    Resolved = 2,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct EvidenceEntry {
    pub submitter: Address,
    pub evidence_ref: String,
    pub submitted_at: u64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct DisputeRecord {
    pub id: u64,
    pub agreement_id: u64,
    pub landlord: Address,
    pub tenant: Address,
    pub raised_by: Address,
    pub reason: String,
    pub status: DisputeStatus,
    pub created_at: u64,
    pub evidence: Vec<EvidenceEntry>,
    pub has_outcome: bool,
    pub outcome_landlord_amount: i128,
    pub outcome_tenant_amount: i128,
    pub outcome_resolved_at: u64,
}

#[derive(Clone)]
#[contracttype]
pub enum DisputeDataKey {
    Config,
    NextDisputeId,
    Dispute(u64),
    DisputeIds,
    DisputeByAgreement(u64),
}

#[contractclient(name = "EscrowRegistryClient")]
pub trait EscrowContractInterface {
    fn resolve_dispute_callback(
        env: Env,
        agreement_id: u64,
        landlord_amount: i128,
        tenant_amount: i128,
    );
}

#[contract]
pub struct DisputeContract;

#[contractimpl]
impl DisputeContract {
    pub fn initialize(env: Env, admin: Address, escrow_contract: Address) -> Result<(), Error> {
        if env.storage().instance().has(&DisputeDataKey::Config) {
            return Err(Error::AlreadyInitialized);
        }

        admin.require_auth();

        let config = DisputeConfig {
            admin: admin.clone(),
            escrow_contract: escrow_contract.clone(),
        };

        env.storage()
            .instance()
            .set(&DisputeDataKey::Config, &config);
        env.storage()
            .instance()
            .set(&DisputeDataKey::NextDisputeId, &1_u64);
        env.storage()
            .persistent()
            .set(&DisputeDataKey::DisputeIds, &Vec::<u64>::new(&env));

        env.events().publish(
            (Symbol::new(&env, "dispute_initialized"),),
            (admin, escrow_contract),
        );

        Ok(())
    }

    pub fn register_dispute(
        env: Env,
        agreement_id: u64,
        landlord: Address,
        tenant: Address,
        raised_by: Address,
        reason: String,
    ) -> Result<u64, Error> {
        let config = Self::get_config(env.clone())?;
        config.escrow_contract.require_auth();

        if env
            .storage()
            .persistent()
            .has(&DisputeDataKey::DisputeByAgreement(agreement_id))
        {
            return Err(Error::DisputeAlreadyExists);
        }

        if raised_by != landlord && raised_by != tenant {
            return Err(Error::InvalidParticipant);
        }

        let dispute_id = Self::next_dispute_id(&env);
        let dispute = DisputeRecord {
            id: dispute_id,
            agreement_id,
            landlord,
            tenant,
            raised_by: raised_by.clone(),
            reason: reason.clone(),
            status: DisputeStatus::Open,
            created_at: env.ledger().timestamp(),
            evidence: Vec::new(&env),
            has_outcome: false,
            outcome_landlord_amount: 0,
            outcome_tenant_amount: 0,
            outcome_resolved_at: 0,
        };

        Self::save_dispute(&env, &dispute);
        Self::append_dispute_id(&env, dispute_id);
        env.storage().persistent().set(
            &DisputeDataKey::DisputeByAgreement(agreement_id),
            &dispute_id,
        );
        env.storage()
            .instance()
            .set(&DisputeDataKey::NextDisputeId, &(dispute_id + 1));

        env.events().publish(
            (Symbol::new(&env, "dispute_registered"), dispute_id),
            (agreement_id, raised_by, reason),
        );

        Ok(dispute_id)
    }

    pub fn submit_evidence(
        env: Env,
        dispute_id: u64,
        submitter: Address,
        evidence_ref: String,
    ) -> Result<(), Error> {
        submitter.require_auth();

        let mut dispute = Self::get_dispute(env.clone(), dispute_id)?;
        if dispute.status != DisputeStatus::Open
            && dispute.status != DisputeStatus::EvidenceSubmitted
        {
            return Err(Error::InvalidState);
        }

        if submitter != dispute.landlord && submitter != dispute.tenant {
            return Err(Error::InvalidParticipant);
        }

        dispute.evidence.push_back(EvidenceEntry {
            submitter: submitter.clone(),
            evidence_ref: evidence_ref.clone(),
            submitted_at: env.ledger().timestamp(),
        });
        dispute.status = DisputeStatus::EvidenceSubmitted;
        Self::save_dispute(&env, &dispute);

        env.events().publish(
            (Symbol::new(&env, "evidence_submitted"), dispute_id),
            (submitter, evidence_ref),
        );

        Ok(())
    }

    pub fn resolve_dispute(
        env: Env,
        dispute_id: u64,
        landlord_amount: i128,
        tenant_amount: i128,
    ) -> Result<(), Error> {
        let config = Self::get_config(env.clone())?;
        config.admin.require_auth();

        if landlord_amount < 0 || tenant_amount < 0 {
            return Err(Error::InvalidOutcome);
        }

        let mut dispute = Self::get_dispute(env.clone(), dispute_id)?;
        if dispute.status != DisputeStatus::Open
            && dispute.status != DisputeStatus::EvidenceSubmitted
        {
            return Err(Error::InvalidState);
        }

        dispute.status = DisputeStatus::Resolved;
        dispute.has_outcome = true;
        dispute.outcome_landlord_amount = landlord_amount;
        dispute.outcome_tenant_amount = tenant_amount;
        dispute.outcome_resolved_at = env.ledger().timestamp();
        Self::save_dispute(&env, &dispute);

        let escrow_client = EscrowRegistryClient::new(&env, &config.escrow_contract);
        escrow_client.resolve_dispute_callback(
            &dispute.agreement_id,
            &landlord_amount,
            &tenant_amount,
        );

        env.events().publish(
            (Symbol::new(&env, "dispute_resolved"), dispute_id),
            (dispute.agreement_id, landlord_amount, tenant_amount),
        );

        Ok(())
    }

    pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) -> Result<(), Error> {
        let config = Self::get_config(env.clone())?;
        config.admin.require_auth();
        env.deployer().update_current_contract_wasm(new_wasm_hash);
        Ok(())
    }

    pub fn get_config(env: Env) -> Result<DisputeConfig, Error> {
        env.storage()
            .instance()
            .get(&DisputeDataKey::Config)
            .ok_or(Error::NotInitialized)
    }

    pub fn get_dispute(env: Env, dispute_id: u64) -> Result<DisputeRecord, Error> {
        env.storage()
            .persistent()
            .get(&DisputeDataKey::Dispute(dispute_id))
            .ok_or(Error::DisputeNotFound)
    }

    pub fn get_dispute_ids(env: Env) -> Result<Vec<u64>, Error> {
        Self::require_initialized(&env)?;
        Ok(env
            .storage()
            .persistent()
            .get(&DisputeDataKey::DisputeIds)
            .unwrap_or(Vec::new(&env)))
    }

    pub fn get_dispute_by_agreement(env: Env, agreement_id: u64) -> Result<Option<u64>, Error> {
        Self::require_initialized(&env)?;
        Ok(env
            .storage()
            .persistent()
            .get(&DisputeDataKey::DisputeByAgreement(agreement_id)))
    }

    fn require_initialized(env: &Env) -> Result<(), Error> {
        if env.storage().instance().has(&DisputeDataKey::Config) {
            Ok(())
        } else {
            Err(Error::NotInitialized)
        }
    }

    fn next_dispute_id(env: &Env) -> u64 {
        env.storage()
            .instance()
            .get(&DisputeDataKey::NextDisputeId)
            .unwrap_or(1_u64)
    }

    fn save_dispute(env: &Env, dispute: &DisputeRecord) {
        env.storage()
            .persistent()
            .set(&DisputeDataKey::Dispute(dispute.id), dispute);
    }

    fn append_dispute_id(env: &Env, dispute_id: u64) {
        let mut ids: Vec<u64> = env
            .storage()
            .persistent()
            .get(&DisputeDataKey::DisputeIds)
            .unwrap_or(Vec::new(env));
        ids.push_back(dispute_id);
        env.storage()
            .persistent()
            .set(&DisputeDataKey::DisputeIds, &ids);
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::{contract, contractimpl};

    #[derive(Clone)]
    #[contracttype]
    enum StubKey {
        Landlord,
        Tenant,
        LastAgreementId,
        LastLandlordAmount,
        LastTenantAmount,
    }

    #[contract]
    struct StubEscrow;

    #[contractimpl]
    impl StubEscrow {
        pub fn initialize(env: Env, landlord: Address, tenant: Address) {
            env.storage().instance().set(&StubKey::Landlord, &landlord);
            env.storage().instance().set(&StubKey::Tenant, &tenant);
        }

        pub fn get_agreement_parties(env: Env, _agreement_id: u64) -> (Address, Address) {
            let landlord: Address = env.storage().instance().get(&StubKey::Landlord).unwrap();
            let tenant: Address = env.storage().instance().get(&StubKey::Tenant).unwrap();
            (landlord, tenant)
        }

        pub fn resolve_dispute_callback(
            env: Env,
            agreement_id: u64,
            landlord_amount: i128,
            tenant_amount: i128,
        ) {
            env.storage()
                .instance()
                .set(&StubKey::LastAgreementId, &agreement_id);
            env.storage()
                .instance()
                .set(&StubKey::LastLandlordAmount, &landlord_amount);
            env.storage()
                .instance()
                .set(&StubKey::LastTenantAmount, &tenant_amount);
        }

        pub fn get_last_callback(env: Env) -> (u64, i128, i128) {
            (
                env.storage()
                    .instance()
                    .get(&StubKey::LastAgreementId)
                    .unwrap_or(0_u64),
                env.storage()
                    .instance()
                    .get(&StubKey::LastLandlordAmount)
                    .unwrap_or(0_i128),
                env.storage()
                    .instance()
                    .get(&StubKey::LastTenantAmount)
                    .unwrap_or(0_i128),
            )
        }
    }

    #[test]
    fn test_register_dispute_only_callable_by_linked_escrow() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let landlord = Address::generate(&env);
        let tenant = Address::generate(&env);

        let escrow_address = env.register(StubEscrow, ());
        let escrow_client = StubEscrowClient::new(&env, &escrow_address);
        let dispute_address = env.register(DisputeContract, ());
        let dispute_client = DisputeContractClient::new(&env, &dispute_address);

        env.mock_all_auths_allowing_non_root_auth();
        escrow_client.initialize(&landlord, &tenant);
        dispute_client.initialize(&admin, &escrow_address);

        env.set_auths(&[]);
        let outsider = Address::generate(&env);
        let result = dispute_client.try_register_dispute(
            &1_u64,
            &landlord,
            &tenant,
            &outsider,
            &String::from_str(&env, "Unauthorized call"),
        );
        assert!(result.is_err());
    }

    #[test]
    fn test_resolve_dispute_round_trip_to_escrow_callback() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let landlord = Address::generate(&env);
        let tenant = Address::generate(&env);

        let escrow_address = env.register(StubEscrow, ());
        let escrow_client = StubEscrowClient::new(&env, &escrow_address);
        let dispute_address = env.register(DisputeContract, ());
        let dispute_client = DisputeContractClient::new(&env, &dispute_address);

        env.mock_all_auths_allowing_non_root_auth();
        escrow_client.initialize(&landlord, &tenant);
        dispute_client.initialize(&admin, &escrow_address);
        let dispute_id = dispute_client.register_dispute(
            &7_u64,
            &landlord,
            &tenant,
            &landlord,
            &String::from_str(&env, "Deductions contested"),
        );
        dispute_client.submit_evidence(
            &dispute_id,
            &tenant,
            &String::from_str(&env, "ipfs://tenant-evidence"),
        );

        env.mock_all_auths_allowing_non_root_auth();
        dispute_client.resolve_dispute(&dispute_id, &250_i128, &750_i128);

        let dispute = dispute_client.get_dispute(&dispute_id);
        let callback = escrow_client.get_last_callback();
        assert_eq!(dispute.status, DisputeStatus::Resolved);
        assert!(dispute.has_outcome);
        assert_eq!(callback, (7_u64, 250_i128, 750_i128));
    }
}
