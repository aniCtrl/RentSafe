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
    ProposalNotFound = 9,
    ProposalNotPending = 10,
    ProposalNotCurrent = 11,
    PendingProposalExists = 12,
    InvalidProposalReason = 13,
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

/// A participant-proposed split kept separately so existing dispute records
/// remain decodable when the contract is upgraded.
#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct MutualResolution {
    pub landlord_amount: i128,
    pub tenant_amount: i128,
    pub proposed_by: Address,
    pub proposed_at: u64,
    pub resolved: bool,
    pub resolved_at: u64,
}

#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub enum SettlementProposalStatus {
    Pending = 0,
    Accepted = 1,
    Rejected = 2,
    Superseded = 3,
}

/// A versioned participant proposal. Proposals are kept separately from the
/// legacy MutualResolution value so existing deployed records remain readable.
#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct SettlementProposal {
    pub id: u64,
    pub dispute_id: u64,
    pub proposer: Address,
    pub landlord_amount: i128,
    pub tenant_amount: i128,
    pub reason: String,
    pub proposed_at: u64,
    pub responded_at: u64,
    pub status: SettlementProposalStatus,
}

#[derive(Clone)]
#[contracttype]
pub enum DisputeDataKey {
    Config,
    NextDisputeId,
    Dispute(u64),
    DisputeIds,
    DisputeByAgreement(u64),
    MutualResolution(u64),
    NextSettlementProposalId,
    SettlementProposal(u64),
    SettlementProposalIds(u64),
    CurrentSettlementProposal(u64),
    Role(Address, Symbol),
}

#[contractclient(name = "EscrowRegistryClient")]
pub trait EscrowContractInterface {
    fn get_agreement_deposit(env: Env, agreement_id: u64) -> i128;
    fn resolve_dispute_callback(
        env: Env,
        agreement_id: u64,
        landlord_amount: i128,
        tenant_amount: i128,
    );
}

const MAX_PROPOSAL_REASON_LEN: u32 = 280;

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

        // Grant initial roles to the admin address
        let admin_role = Symbol::new(&env, "admin");
        let arb_role = Symbol::new(&env, "arbitrator");
        Self::grant_role(&env, &admin, &admin_role);
        Self::grant_role(&env, &admin, &arb_role);

        env.events().publish(
            (Symbol::new(&env, "dispute_initialized"),),
            (admin, escrow_contract),
        );

        Ok(())
    }

    // Role helper functions (public check)
    pub fn has_role(env: Env, address: Address, role: Symbol) -> bool {
        env.storage()
            .persistent()
            .has(&DisputeDataKey::Role(address, role))
    }

    fn grant_role(env: &Env, address: &Address, role: &Symbol) {
        env.storage()
            .persistent()
            .set(&DisputeDataKey::Role(address.clone(), role.clone()), &true);
    }

    fn revoke_role(env: &Env, address: &Address, role: &Symbol) {
        env.storage()
            .persistent()
            .remove(&DisputeDataKey::Role(address.clone(), role.clone()));
    }

    // Admin role configuration endpoints
    pub fn add_arbitrator(env: Env, admin_caller: Address, arbitrator: Address) -> Result<(), Error> {
        admin_caller.require_auth();
        if !Self::has_role(env.clone(), admin_caller, Symbol::new(&env, "admin")) {
            return Err(Error::NotAuthorized);
        }
        let arb_role = Symbol::new(&env, "arbitrator");
        Self::grant_role(&env, &arbitrator, &arb_role);
        Ok(())
    }

    pub fn remove_arbitrator(env: Env, admin_caller: Address, arbitrator: Address) -> Result<(), Error> {
        admin_caller.require_auth();
        if !Self::has_role(env.clone(), admin_caller, Symbol::new(&env, "admin")) {
            return Err(Error::NotAuthorized);
        }
        let arb_role = Symbol::new(&env, "arbitrator");
        Self::revoke_role(&env, &arbitrator, &arb_role);
        Ok(())
    }

    pub fn add_admin(env: Env, admin_caller: Address, new_admin: Address) -> Result<(), Error> {
        admin_caller.require_auth();
        if !Self::has_role(env.clone(), admin_caller, Symbol::new(&env, "admin")) {
            return Err(Error::NotAuthorized);
        }
        let admin_role = Symbol::new(&env, "admin");
        Self::grant_role(&env, &new_admin, &admin_role);
        Ok(())
    }

    pub fn remove_admin(env: Env, admin_caller: Address, old_admin: Address) -> Result<(), Error> {
        admin_caller.require_auth();
        if !Self::has_role(env.clone(), admin_caller, Symbol::new(&env, "admin")) {
            return Err(Error::NotAuthorized);
        }
        let admin_role = Symbol::new(&env, "admin");
        Self::revoke_role(&env, &old_admin, &admin_role);
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

    /// Propose a mutual settlement, or accept an identical proposal from the
    /// other participant. The escrow callback performs the final split and
    /// validates that it equals the locked deposit.
    pub fn propose_mutual_resolution(
        env: Env,
        caller: Address,
        dispute_id: u64,
        landlord_amount: i128,
        tenant_amount: i128,
    ) -> Result<(), Error> {
        caller.require_auth();

        if landlord_amount < 0 || tenant_amount < 0 {
            return Err(Error::InvalidOutcome);
        }

        let mut dispute = Self::get_dispute(env.clone(), dispute_id)?;
        if dispute.status != DisputeStatus::Open
            && dispute.status != DisputeStatus::EvidenceSubmitted
        {
            return Err(Error::InvalidState);
        }

        if caller != dispute.landlord && caller != dispute.tenant {
            return Err(Error::InvalidParticipant);
        }

        let key = DisputeDataKey::MutualResolution(dispute_id);
        if let Some(existing) = env.storage().persistent().get::<_, MutualResolution>(&key) {
            if existing.landlord_amount == landlord_amount
                && existing.tenant_amount == tenant_amount
                && existing.proposed_by != caller
            {
                dispute.status = DisputeStatus::Resolved;
                dispute.has_outcome = true;
                dispute.outcome_landlord_amount = landlord_amount;
                dispute.outcome_tenant_amount = tenant_amount;
                dispute.outcome_resolved_at = env.ledger().timestamp();
                Self::save_dispute(&env, &dispute);

                let resolved = MutualResolution {
                    landlord_amount,
                    tenant_amount,
                    proposed_by: existing.proposed_by,
                    proposed_at: existing.proposed_at,
                    resolved: true,
                    resolved_at: env.ledger().timestamp(),
                };
                env.storage().persistent().set(&key, &resolved);

                let config = Self::get_config(env.clone())?;
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
                return Ok(());
            }
        }

        let proposal = MutualResolution {
            landlord_amount,
            tenant_amount,
            proposed_by: caller.clone(),
            proposed_at: env.ledger().timestamp(),
            resolved: false,
            resolved_at: 0,
        };
        env.storage().persistent().set(&key, &proposal);

        env.events().publish(
            (Symbol::new(&env, "mutual_resolution_proposed"), dispute_id),
            (caller, landlord_amount, tenant_amount),
        );

        Ok(())
    }

    /// Create the first proposal in a negotiated settlement. A proposal only
    /// changes dispute-contract storage; escrow is called only after the other
    /// participant accepts the current proposal.
    pub fn create_settlement_proposal(
        env: Env,
        caller: Address,
        dispute_id: u64,
        landlord_amount: i128,
        tenant_amount: i128,
        reason: String,
    ) -> Result<u64, Error> {
        caller.require_auth();

        let dispute = Self::get_active_dispute(env.clone(), dispute_id)?;
        Self::require_participant(&dispute, &caller)?;
        if Self::get_current_settlement_proposal(env.clone(), dispute_id).is_some() {
            return Err(Error::PendingProposalExists);
        }
        Self::validate_settlement_split(&env, &dispute, landlord_amount, tenant_amount, &reason)?;

        let proposal_id = Self::next_settlement_proposal_id(&env);
        let next_id = proposal_id.checked_add(1).ok_or(Error::InvalidOutcome)?;
        let proposal = SettlementProposal {
            id: proposal_id,
            dispute_id,
            proposer: caller.clone(),
            landlord_amount,
            tenant_amount,
            reason: reason.clone(),
            proposed_at: env.ledger().timestamp(),
            responded_at: 0,
            status: SettlementProposalStatus::Pending,
        };

        Self::save_settlement_proposal(&env, &proposal);
        Self::append_settlement_proposal_id(&env, dispute_id, proposal_id);
        env.storage().persistent().set(
            &DisputeDataKey::CurrentSettlementProposal(dispute_id),
            &proposal_id,
        );
        env.storage()
            .instance()
            .set(&DisputeDataKey::NextSettlementProposalId, &next_id);

        env.events().publish(
            (
                Symbol::new(&env, "settlement_proposal_created"),
                dispute_id,
                proposal_id,
            ),
            (caller, landlord_amount, tenant_amount, reason),
        );

        Ok(proposal_id)
    }

    /// Accept the current proposal from the other participant and settle the
    /// dispute. This is the only negotiation action that calls escrow.
    pub fn accept_settlement_proposal(
        env: Env,
        caller: Address,
        dispute_id: u64,
        proposal_id: u64,
    ) -> Result<(), Error> {
        caller.require_auth();

        let dispute = Self::get_active_dispute(env.clone(), dispute_id)?;
        let mut proposal =
            Self::get_current_proposal_for_response(&env, &dispute, &caller, proposal_id)?;
        Self::validate_settlement_split(
            &env,
            &dispute,
            proposal.landlord_amount,
            proposal.tenant_amount,
            &proposal.reason,
        )?;

        let resolved_at = env.ledger().timestamp();
        proposal.status = SettlementProposalStatus::Accepted;
        proposal.responded_at = resolved_at;
        Self::save_settlement_proposal(&env, &proposal);
        env.storage()
            .persistent()
            .remove(&DisputeDataKey::CurrentSettlementProposal(dispute_id));

        let mut resolved_dispute = dispute;
        resolved_dispute.status = DisputeStatus::Resolved;
        resolved_dispute.has_outcome = true;
        resolved_dispute.outcome_landlord_amount = proposal.landlord_amount;
        resolved_dispute.outcome_tenant_amount = proposal.tenant_amount;
        resolved_dispute.outcome_resolved_at = resolved_at;
        Self::save_dispute(&env, &resolved_dispute);

        // Keep the legacy read endpoint useful for clients during the staged
        // frontend migration, without using it as the source of proposal history.
        let legacy_resolution = MutualResolution {
            landlord_amount: proposal.landlord_amount,
            tenant_amount: proposal.tenant_amount,
            proposed_by: proposal.proposer.clone(),
            proposed_at: proposal.proposed_at,
            resolved: true,
            resolved_at,
        };
        env.storage().persistent().set(
            &DisputeDataKey::MutualResolution(dispute_id),
            &legacy_resolution,
        );

        let config = Self::get_config(env.clone())?;
        let escrow_client = EscrowRegistryClient::new(&env, &config.escrow_contract);
        escrow_client.resolve_dispute_callback(
            &resolved_dispute.agreement_id,
            &proposal.landlord_amount,
            &proposal.tenant_amount,
        );

        env.events().publish(
            (
                Symbol::new(&env, "settlement_proposal_accepted"),
                dispute_id,
                proposal_id,
            ),
            (caller, proposal.landlord_amount, proposal.tenant_amount),
        );
        env.events().publish(
            (Symbol::new(&env, "dispute_resolved"), dispute_id),
            (
                resolved_dispute.agreement_id,
                proposal.landlord_amount,
                proposal.tenant_amount,
            ),
        );

        Ok(())
    }

    /// Reject the current proposal without touching escrow. The rejected
    /// proposal can be followed by a fresh proposal from either participant.
    pub fn reject_settlement_proposal(
        env: Env,
        caller: Address,
        dispute_id: u64,
        proposal_id: u64,
    ) -> Result<(), Error> {
        caller.require_auth();

        let dispute = Self::get_active_dispute(env.clone(), dispute_id)?;
        let mut proposal =
            Self::get_current_proposal_for_response(&env, &dispute, &caller, proposal_id)?;
        proposal.status = SettlementProposalStatus::Rejected;
        proposal.responded_at = env.ledger().timestamp();
        Self::save_settlement_proposal(&env, &proposal);
        env.storage()
            .persistent()
            .remove(&DisputeDataKey::CurrentSettlementProposal(dispute_id));

        env.events().publish(
            (
                Symbol::new(&env, "settlement_proposal_rejected"),
                dispute_id,
                proposal_id,
            ),
            (caller, proposal.proposer),
        );

        Ok(())
    }

    /// Replace the current proposal with a counter-offer atomically. The
    /// previous proposal becomes immutable history and cannot be accepted.
    pub fn counter_settlement_proposal(
        env: Env,
        caller: Address,
        dispute_id: u64,
        proposal_id: u64,
        landlord_amount: i128,
        tenant_amount: i128,
        reason: String,
    ) -> Result<u64, Error> {
        caller.require_auth();

        let dispute = Self::get_active_dispute(env.clone(), dispute_id)?;
        let mut previous =
            Self::get_current_proposal_for_response(&env, &dispute, &caller, proposal_id)?;
        Self::validate_settlement_split(&env, &dispute, landlord_amount, tenant_amount, &reason)?;

        let now = env.ledger().timestamp();
        previous.status = SettlementProposalStatus::Superseded;
        previous.responded_at = now;
        Self::save_settlement_proposal(&env, &previous);

        let counter_id = Self::next_settlement_proposal_id(&env);
        let next_id = counter_id.checked_add(1).ok_or(Error::InvalidOutcome)?;
        let counter = SettlementProposal {
            id: counter_id,
            dispute_id,
            proposer: caller.clone(),
            landlord_amount,
            tenant_amount,
            reason: reason.clone(),
            proposed_at: now,
            responded_at: 0,
            status: SettlementProposalStatus::Pending,
        };
        Self::save_settlement_proposal(&env, &counter);
        Self::append_settlement_proposal_id(&env, dispute_id, counter_id);
        env.storage().persistent().set(
            &DisputeDataKey::CurrentSettlementProposal(dispute_id),
            &counter_id,
        );
        env.storage()
            .instance()
            .set(&DisputeDataKey::NextSettlementProposalId, &next_id);

        env.events().publish(
            (
                Symbol::new(&env, "settlement_proposal_countered"),
                dispute_id,
                proposal_id,
            ),
            (caller, counter_id, landlord_amount, tenant_amount, reason),
        );

        Ok(counter_id)
    }

    pub fn resolve_dispute(
        env: Env,
        caller: Address,
        dispute_id: u64,
        landlord_amount: i128,
        tenant_amount: i128,
    ) -> Result<(), Error> {
        caller.require_auth();
        if !Self::has_role(env.clone(), caller, Symbol::new(&env, "arbitrator")) {
            return Err(Error::NotAuthorized);
        }

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

        let config = Self::get_config(env.clone())?;
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

    pub fn upgrade(env: Env, caller: Address, new_wasm_hash: BytesN<32>) -> Result<(), Error> {
        caller.require_auth();
        if !Self::has_role(env.clone(), caller, Symbol::new(&env, "admin")) {
            return Err(Error::NotAuthorized);
        }
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

    pub fn get_mutual_resolution(env: Env, dispute_id: u64) -> Option<MutualResolution> {
        env.storage()
            .persistent()
            .get(&DisputeDataKey::MutualResolution(dispute_id))
    }

    pub fn get_settlement_proposal(
        env: Env,
        proposal_id: u64,
    ) -> Result<SettlementProposal, Error> {
        env.storage()
            .persistent()
            .get(&DisputeDataKey::SettlementProposal(proposal_id))
            .ok_or(Error::ProposalNotFound)
    }

    pub fn get_current_settlement_proposal(
        env: Env,
        dispute_id: u64,
    ) -> Option<SettlementProposal> {
        let proposal_id = env
            .storage()
            .persistent()
            .get::<_, u64>(&DisputeDataKey::CurrentSettlementProposal(dispute_id))?;
        env.storage()
            .persistent()
            .get(&DisputeDataKey::SettlementProposal(proposal_id))
    }

    pub fn get_settlement_proposals(env: Env, dispute_id: u64) -> Vec<SettlementProposal> {
        let ids: Vec<u64> = env
            .storage()
            .persistent()
            .get(&DisputeDataKey::SettlementProposalIds(dispute_id))
            .unwrap_or(Vec::new(&env));
        let mut proposals = Vec::new(&env);
        for proposal_id in ids.iter() {
            if let Some(proposal) = env
                .storage()
                .persistent()
                .get(&DisputeDataKey::SettlementProposal(proposal_id))
            {
                proposals.push_back(proposal);
            }
        }
        proposals
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

    fn get_active_dispute(env: Env, dispute_id: u64) -> Result<DisputeRecord, Error> {
        let dispute = Self::get_dispute(env, dispute_id)?;
        if dispute.status != DisputeStatus::Open
            && dispute.status != DisputeStatus::EvidenceSubmitted
        {
            return Err(Error::InvalidState);
        }
        Ok(dispute)
    }

    fn require_participant(dispute: &DisputeRecord, caller: &Address) -> Result<(), Error> {
        if caller != &dispute.landlord && caller != &dispute.tenant {
            return Err(Error::InvalidParticipant);
        }
        Ok(())
    }

    fn validate_settlement_split(
        env: &Env,
        dispute: &DisputeRecord,
        landlord_amount: i128,
        tenant_amount: i128,
        reason: &String,
    ) -> Result<(), Error> {
        if landlord_amount < 0 || tenant_amount < 0 {
            return Err(Error::InvalidOutcome);
        }
        if reason.len() > MAX_PROPOSAL_REASON_LEN {
            return Err(Error::InvalidProposalReason);
        }

        let total_amount = landlord_amount
            .checked_add(tenant_amount)
            .ok_or(Error::InvalidOutcome)?;
        let config = Self::get_config(env.clone())?;
        let escrow_client = EscrowRegistryClient::new(env, &config.escrow_contract);
        let deposit_amount = escrow_client.get_agreement_deposit(&dispute.agreement_id);
        if total_amount != deposit_amount {
            return Err(Error::InvalidOutcome);
        }
        Ok(())
    }

    fn get_current_proposal_for_response(
        env: &Env,
        dispute: &DisputeRecord,
        caller: &Address,
        proposal_id: u64,
    ) -> Result<SettlementProposal, Error> {
        Self::require_participant(dispute, caller)?;
        let current_id = env
            .storage()
            .persistent()
            .get::<_, u64>(&DisputeDataKey::CurrentSettlementProposal(dispute.id))
            .ok_or(Error::ProposalNotCurrent)?;
        if current_id != proposal_id {
            return Err(Error::ProposalNotCurrent);
        }

        let proposal = env
            .storage()
            .persistent()
            .get::<_, SettlementProposal>(&DisputeDataKey::SettlementProposal(proposal_id))
            .ok_or(Error::ProposalNotFound)?;
        if proposal.status != SettlementProposalStatus::Pending {
            return Err(Error::ProposalNotPending);
        }
        if proposal.proposer == *caller {
            return Err(Error::InvalidParticipant);
        }
        Ok(proposal)
    }

    fn next_settlement_proposal_id(env: &Env) -> u64 {
        env.storage()
            .instance()
            .get(&DisputeDataKey::NextSettlementProposalId)
            .unwrap_or(1_u64)
    }

    fn save_settlement_proposal(env: &Env, proposal: &SettlementProposal) {
        env.storage()
            .persistent()
            .set(&DisputeDataKey::SettlementProposal(proposal.id), proposal);
    }

    fn append_settlement_proposal_id(env: &Env, dispute_id: u64, proposal_id: u64) {
        let mut ids: Vec<u64> = env
            .storage()
            .persistent()
            .get(&DisputeDataKey::SettlementProposalIds(dispute_id))
            .unwrap_or(Vec::new(env));
        ids.push_back(proposal_id);
        env.storage()
            .persistent()
            .set(&DisputeDataKey::SettlementProposalIds(dispute_id), &ids);
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

        pub fn get_agreement_deposit(_env: Env, _agreement_id: u64) -> i128 {
            1_000_i128
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
        dispute_client.resolve_dispute(&admin, &dispute_id, &250_i128, &750_i128);

        let dispute = dispute_client.get_dispute(&dispute_id);
        let callback = escrow_client.get_last_callback();
        assert_eq!(dispute.status, DisputeStatus::Resolved);
        assert!(dispute.has_outcome);
        assert_eq!(callback, (7_u64, 250_i128, 750_i128));
    }

    #[test]
    fn test_mutual_resolution_requires_both_participants() {
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
            &9_u64,
            &landlord,
            &tenant,
            &landlord,
            &String::from_str(&env, "Agree on a fair split"),
        );
        dispute_client.submit_evidence(
            &dispute_id,
            &tenant,
            &String::from_str(&env, "ipfs://tenant-evidence"),
        );

        dispute_client.propose_mutual_resolution(&landlord, &dispute_id, &250_i128, &750_i128);
        let pending = dispute_client.get_mutual_resolution(&dispute_id).unwrap();
        assert!(!pending.resolved);
        assert_eq!(dispute_client.get_dispute(&dispute_id).status, DisputeStatus::EvidenceSubmitted);

        dispute_client.propose_mutual_resolution(&tenant, &dispute_id, &250_i128, &750_i128);
        let resolved = dispute_client.get_mutual_resolution(&dispute_id).unwrap();
        let dispute = dispute_client.get_dispute(&dispute_id);
        assert!(resolved.resolved);
        assert_eq!(dispute.status, DisputeStatus::Resolved);
        assert_eq!(escrow_client.get_last_callback(), (9_u64, 250_i128, 750_i128));
    }

    #[test]
    fn test_rbac_grant_revoke_arbitrator() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let escrow_address = Address::generate(&env);

        let dispute_address = env.register(DisputeContract, ());
        let dispute_client = DisputeContractClient::new(&env, &dispute_address);

        env.mock_all_auths_allowing_non_root_auth();
        dispute_client.initialize(&admin, &escrow_address);

        // Check initial role of admin is arbitrator and admin
        assert!(dispute_client.has_role(&admin, &Symbol::new(&env, "admin")));
        assert!(dispute_client.has_role(&admin, &Symbol::new(&env, "arbitrator")));

        let other_user = Address::generate(&env);
        assert!(!dispute_client.has_role(&other_user, &Symbol::new(&env, "arbitrator")));

        // Admin adds other_user as arbitrator
        dispute_client.add_arbitrator(&admin, &other_user);
        assert!(dispute_client.has_role(&other_user, &Symbol::new(&env, "arbitrator")));

        // Other user attempts to add someone else as arbitrator - should fail because they are not admin
        let third_user = Address::generate(&env);
        let fail_res = dispute_client.try_add_arbitrator(&other_user, &third_user);
        assert!(fail_res.is_err());

        // Admin removes other_user as arbitrator
        dispute_client.remove_arbitrator(&admin, &other_user);
        assert!(!dispute_client.has_role(&other_user, &Symbol::new(&env, "arbitrator")));
    }

    #[test]
    fn test_rbac_unauthorized_resolve_dispute() {
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

        // Try to resolve dispute with an unauthorized account
        let intruder = Address::generate(&env);
        let result = dispute_client.try_resolve_dispute(&intruder, &dispute_id, &250_i128, &750_i128);
        assert!(result.is_err());

        // Now resolve with authorized admin/arbitrator
        dispute_client.resolve_dispute(&admin, &dispute_id, &250_i128, &750_i128);
        let dispute = dispute_client.get_dispute(&dispute_id);
        assert_eq!(dispute.status, DisputeStatus::Resolved);
    }
}
