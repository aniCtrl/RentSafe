#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, Address, BytesN, Env,
};

#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[contracterror]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    InvalidState = 3,
    NotAuthorized = 4,
    InvalidSplit = 5,
}

#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub enum DisputeState {
    Created = 0,
    Active = 1,
    Resolved = 2,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    EscrowContract,
    Arbitrator,
    State,
    EvidenceHash,
    Disputer,
}

// Client definition to call back into Escrow
#[soroban_sdk::contractclient(name = "EscrowClient")]
pub trait EscrowContractInterface {
    fn resolve_dispute(env: Env, landlord_share: i128, tenant_share: i128) -> Result<(), u32>;
}

#[contract]
pub struct DisputeContract;

#[contractimpl]
impl DisputeContract {
    /// Initialize the Dispute contract. Links the Escrow contract and the Arbitrator.
    pub fn initialize(
        env: Env,
        escrow_contract: Address,
        arbitrator: Address,
    ) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::State) {
            return Err(Error::AlreadyInitialized);
        }

        env.storage().instance().set(&DataKey::EscrowContract, &escrow_contract);
        env.storage().instance().set(&DataKey::Arbitrator, &arbitrator);
        env.storage().instance().set(&DataKey::State, &DisputeState::Created);

        Ok(())
    }

    /// Raise a dispute. This is triggered by the Escrow contract.
    pub fn raise_dispute(
        env: Env,
        disputer: Address,
        evidence_hash: BytesN<32>,
    ) -> Result<(), Error> {
        let escrow = Self::get_escrow(&env)?;
        
        // Enforce that only the linked Escrow contract can invoke this
        escrow.require_auth();

        let state = Self::get_state(&env)?;
        if state != DisputeState::Created {
            return Err(Error::InvalidState);
        }

        env.storage().instance().set(&DataKey::Disputer, &disputer);
        env.storage().instance().set(&DataKey::State, &DisputeState::Active);

        // Store evidence hash in persistent storage (longer-lived, larger metadata size footprint)
        env.storage().persistent().set(&DataKey::EvidenceHash, &evidence_hash);

        // Emit Dispute Raised Event
        env.events().publish(
            (symbol_short!("dispute"), symbol_short!("raised")),
            (escrow, disputer, evidence_hash),
        );

        Ok(())
    }

    /// Resolve the dispute. Called by the designated arbitrator.
    pub fn resolve(
        env: Env,
        landlord_share: i128,
        tenant_share: i128,
    ) -> Result<(), Error> {
        let state = Self::get_state(&env)?;
        if state != DisputeState::Active {
            return Err(Error::InvalidState);
        }

        let arbitrator = Self::get_arbitrator(&env)?;
        arbitrator.require_auth();

        // Transition state to Resolved
        env.storage().instance().set(&DataKey::State, &DisputeState::Resolved);

        // Call back to Escrow contract to execute payout
        let escrow = Self::get_escrow(&env)?;
        let escrow_client = EscrowClient::new(&env, &escrow);

        // Call Escrow resolve_dispute and handle error propagation
        if let Err(_) = escrow_client.resolve_dispute(&landlord_share, &tenant_share) {
            return Err(Error::InvalidSplit);
        }

        // Emit Dispute Resolved Event
        env.events().publish(
            (symbol_short!("dispute"), symbol_short!("resolved")),
            (arbitrator, landlord_share, tenant_share),
        );

        Ok(())
    }

    // Helper views
    pub fn get_state(env: &Env) -> Result<DisputeState, Error> {
        env.storage().instance().get(&DataKey::State).ok_or(Error::NotInitialized)
    }

    pub fn get_escrow(env: &Env) -> Result<Address, Error> {
        env.storage().instance().get(&DataKey::EscrowContract).ok_or(Error::NotInitialized)
    }

    pub fn get_arbitrator(env: &Env) -> Result<Address, Error> {
        env.storage().instance().get(&DataKey::Arbitrator).ok_or(Error::NotInitialized)
    }

    pub fn get_disputer(env: &Env) -> Result<Address, Error> {
        env.storage().instance().get(&DataKey::Disputer).ok_or(Error::NotInitialized)
    }

    pub fn get_evidence_hash(env: &Env) -> Result<BytesN<32>, Error> {
        env.storage().persistent().get(&DataKey::EvidenceHash).ok_or(Error::NotInitialized)
    }
}
