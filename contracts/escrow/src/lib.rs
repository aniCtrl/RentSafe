#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, token, Address, BytesN,
    Env, Symbol,
};

#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[contracterror]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    InvalidState = 3,
    NotAuthorized = 4,
    InvalidAmount = 5,
    DisputeContractAlreadySet = 6,
    DisputeContractNotSet = 7,
    ProposedSplitMismatch = 8,
    NoActiveProposal = 9,
}

#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub enum State {
    Created = 0,
    Funded = 1,
    Active = 2,
    SettlementRequested = 3,
    Disputed = 4,
    Resolved = 5,
    Closed = 6,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Landlord,
    Tenant,
    Arbitrator,
    Token,
    Amount,
    DisputeContract,
    State,
    ProposedLandlord,
    ProposedTenant,
    ProposedBy,
}

// External interface definition for Dispute Contract
#[soroban_sdk::contractclient(name = "DisputeClient")]
pub trait DisputeContractInterface {
    fn raise_dispute(env: Env, disputer: Address, evidence_hash: BytesN<32>);
}

#[contract]
pub struct EscrowContract;

#[contractimpl]
impl EscrowContract {
    /// Initialize the Escrow agreement. Can only be called once.
    pub fn initialize(
        env: Env,
        landlord: Address,
        tenant: Address,
        arbitrator: Address,
        token: Address,
        amount: i128,
    ) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::State) {
            return Err(Error::AlreadyInitialized);
        }

        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        env.storage().instance().set(&DataKey::Landlord, &landlord);
        env.storage().instance().set(&DataKey::Tenant, &tenant);
        env.storage().instance().set(&DataKey::Arbitrator, &arbitrator);
        env.storage().instance().set(&DataKey::Token, &token);
        env.storage().instance().set(&DataKey::Amount, &amount);
        env.storage().instance().set(&DataKey::State, &State::Created);

        // Emit Initialization Event
        env.events().publish(
            (symbol_short!("escrow"), symbol_short!("init")),
            (landlord, tenant, arbitrator, token, amount),
        );

        Ok(())
    }

    /// Link the Dispute contract address. Only callable once by the arbitrator.
    pub fn set_dispute_contract(env: Env, dispute_contract: Address) -> Result<(), Error> {
        let state = Self::get_state(&env)?;
        if state != State::Created {
            return Err(Error::InvalidState);
        }

        if env.storage().instance().has(&DataKey::DisputeContract) {
            return Err(Error::DisputeContractAlreadySet);
        }

        let arbitrator = Self::get_arbitrator(&env)?;
        arbitrator.require_auth();

        env.storage().instance().set(&DataKey::DisputeContract, &dispute_contract);

        Ok(())
    }

    /// Fund the escrow. Tenant deposits the amount.
    pub fn fund(env: Env) -> Result<(), Error> {
        let state = Self::get_state(&env)?;
        if state != State::Created {
            return Err(Error::InvalidState);
        }

        let tenant = Self::get_tenant(&env)?;
        tenant.require_auth();

        let token_addr = Self::get_token(&env)?;
        let amount = Self::get_amount(&env)?;

        // Transfer funds from tenant to this contract
        let token_client = token::Client::new(&env, &token_addr);
        token_client.transfer(&tenant, &env.current_contract_address(), &amount);

        // Transition state to Funded
        env.storage().instance().set(&DataKey::State, &State::Funded);

        // Emit Fund Event
        env.events().publish(
            (symbol_short!("escrow"), symbol_short!("funded")),
            (tenant, amount),
        );

        Ok(())
    }

    /// Activate the escrow (lease start). Callable by the landlord.
    pub fn activate(env: Env) -> Result<(), Error> {
        let state = Self::get_state(&env)?;
        if state != State::Funded {
            return Err(Error::InvalidState);
        }

        let landlord = Self::get_landlord(&env)?;
        landlord.require_auth();

        // Transition state to Active
        env.storage().instance().set(&DataKey::State, &State::Active);

        // Emit Activate Event
        env.events().publish(
            (symbol_short!("escrow"), symbol_short!("active")),
            (landlord,),
        );

        Ok(())
    }

    /// Request a mutual settlement split. Called by landlord or tenant.
    pub fn request_settlement(
        env: Env,
        caller: Address,
        landlord_share: i128,
        tenant_share: i128,
    ) -> Result<(), Error> {
        caller.require_auth();

        let landlord = Self::get_landlord(&env)?;
        let tenant = Self::get_tenant(&env)?;

        if caller != landlord && caller != tenant {
            return Err(Error::NotAuthorized);
        }

        let state = Self::get_state(&env)?;
        if state != State::Active && state != State::SettlementRequested {
            return Err(Error::InvalidState);
        }

        let amount = Self::get_amount(&env)?;
        if landlord_share < 0 || tenant_share < 0 || (landlord_share + tenant_share) != amount {
            return Err(Error::ProposedSplitMismatch);
        }

        env.storage().instance().set(&DataKey::ProposedLandlord, &landlord_share);
        env.storage().instance().set(&DataKey::ProposedTenant, &tenant_share);
        env.storage().instance().set(&DataKey::ProposedBy, &caller);
        env.storage().instance().set(&DataKey::State, &State::SettlementRequested);

        // Emit Settlement Proposed Event
        env.events().publish(
            (symbol_short!("escrow"), Symbol::new(&env, "set_prop")),
            (caller, landlord_share, tenant_share),
        );

        Ok(())
    }

    /// Accept the proposed settlement. Called by the counterparty.
    pub fn accept_settlement(env: Env, caller: Address) -> Result<(), Error> {
        caller.require_auth();

        let state = Self::get_state(&env)?;
        if state != State::SettlementRequested {
            return Err(Error::InvalidState);
        }

        let proposed_by: Address = env
            .storage()
            .instance()
            .get(&DataKey::ProposedBy)
            .ok_or(Error::NoActiveProposal)?;

        if caller == proposed_by {
            return Err(Error::NotAuthorized); // Proposer cannot accept their own proposal
        }

        let landlord = Self::get_landlord(&env)?;
        let tenant = Self::get_tenant(&env)?;

        if caller != landlord && caller != tenant {
            return Err(Error::NotAuthorized);
        }

        let landlord_share: i128 = env.storage().instance().get(&DataKey::ProposedLandlord).unwrap();
        let tenant_share: i128 = env.storage().instance().get(&DataKey::ProposedTenant).unwrap();

        // Perform transfers
        let token_addr = Self::get_token(&env)?;
        let token_client = token::Client::new(&env, &token_addr);

        if landlord_share > 0 {
            token_client.transfer(&env.current_contract_address(), &landlord, &landlord_share);
        }
        if tenant_share > 0 {
            token_client.transfer(&env.current_contract_address(), &tenant, &tenant_share);
        }

        // Clean up proposal and close
        env.storage().instance().remove(&DataKey::ProposedLandlord);
        env.storage().instance().remove(&DataKey::ProposedTenant);
        env.storage().instance().remove(&DataKey::ProposedBy);
        env.storage().instance().set(&DataKey::State, &State::Closed);

        // Emit Settlement Accepted Event
        env.events().publish(
            (symbol_short!("escrow"), Symbol::new(&env, "set_acc")),
            (landlord_share, tenant_share),
        );

        Ok(())
    }

    /// Raise a dispute. Callable by landlord or tenant when lease is Active or SettlementRequested.
    pub fn dispute(env: Env, caller: Address, evidence_hash: BytesN<32>) -> Result<(), Error> {
        caller.require_auth();

        let landlord = Self::get_landlord(&env)?;
        let tenant = Self::get_tenant(&env)?;

        if caller != landlord && caller != tenant {
            return Err(Error::NotAuthorized);
        }

        let state = Self::get_state(&env)?;
        if state != State::Active && state != State::SettlementRequested {
            return Err(Error::InvalidState);
        }

        let dispute_contract = env
            .storage()
            .instance()
            .get(&DataKey::DisputeContract)
            .ok_or(Error::DisputeContractNotSet)?;

        // Set state to Disputed
        env.storage().instance().set(&DataKey::State, &State::Disputed);

        // Call the dispute contract to raise the dispute
        let dispute_client = DisputeClient::new(&env, &dispute_contract);
        dispute_client.raise_dispute(&caller, &evidence_hash);

        // Emit Dispute Event
        env.events().publish(
            (symbol_short!("escrow"), symbol_short!("disputed")),
            (caller, evidence_hash),
        );

        Ok(())
    }

    /// Callback function called ONLY by the linked Dispute contract to execute resolution payouts.
    pub fn resolve_dispute(
        env: Env,
        landlord_share: i128,
        tenant_share: i128,
    ) -> Result<(), Error> {
        let state = Self::get_state(&env)?;
        if state != State::Disputed {
            return Err(Error::InvalidState);
        }

        let dispute_contract: Address = env
            .storage()
            .instance()
            .get(&DataKey::DisputeContract)
            .ok_or(Error::DisputeContractNotSet)?;

        // Enforce call authorization from the linked Dispute contract address
        dispute_contract.require_auth();

        let amount = Self::get_amount(&env)?;
        if landlord_share < 0 || tenant_share < 0 || (landlord_share + tenant_share) != amount {
            return Err(Error::ProposedSplitMismatch);
        }

        // Perform transfers
        let token_addr = Self::get_token(&env)?;
        let token_client = token::Client::new(&env, &token_addr);

        if landlord_share > 0 {
            token_client.transfer(&env.current_contract_address(), &Self::get_landlord(&env)?, &landlord_share);
        }
        if tenant_share > 0 {
            token_client.transfer(&env.current_contract_address(), &Self::get_tenant(&env)?, &tenant_share);
        }

        env.storage().instance().set(&DataKey::State, &State::Closed);

        // Emit Resolved Event
        env.events().publish(
            (symbol_short!("escrow"), symbol_short!("resolved")),
            (landlord_share, tenant_share),
        );

        Ok(())
    }

    /// Upgrade the contract WASM. Only callable by the arbitrator.
    pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) -> Result<(), Error> {
        let arbitrator = Self::get_arbitrator(&env)?;
        arbitrator.require_auth();

        env.deployer().update_current_contract_wasm(new_wasm_hash);
        Ok(())
    }

    // Helper views
    pub fn get_state(env: &Env) -> Result<State, Error> {
        env.storage().instance().get(&DataKey::State).ok_or(Error::NotInitialized)
    }

    pub fn get_landlord(env: &Env) -> Result<Address, Error> {
        env.storage().instance().get(&DataKey::Landlord).ok_or(Error::NotInitialized)
    }

    pub fn get_tenant(env: &Env) -> Result<Address, Error> {
        env.storage().instance().get(&DataKey::Tenant).ok_or(Error::NotInitialized)
    }

    pub fn get_arbitrator(env: &Env) -> Result<Address, Error> {
        env.storage().instance().get(&DataKey::Arbitrator).ok_or(Error::NotInitialized)
    }

    pub fn get_token(env: &Env) -> Result<Address, Error> {
        env.storage().instance().get(&DataKey::Token).ok_or(Error::NotInitialized)
    }

    pub fn get_amount(env: &Env) -> Result<i128, Error> {
        env.storage().instance().get(&DataKey::Amount).ok_or(Error::NotInitialized)
    }

    pub fn get_dispute_contract(env: &Env) -> Result<Address, Error> {
        env.storage().instance().get(&DataKey::DisputeContract).ok_or(Error::DisputeContractNotSet)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::Address as _;
    use rentsafe_dispute::DisputeContract;
    use rentsafe_dispute::DisputeContractClient;

    #[test]
    fn test_lifecycle_mutual_settlement() {
        let env = Env::default();
        env.mock_all_auths();

        let landlord = Address::generate(&env);
        let tenant = Address::generate(&env);
        let arbitrator = Address::generate(&env);
        let token_admin = Address::generate(&env);
        
        let token_address = env.register_stellar_asset_contract_v2(token_admin.clone()).address();
        let token_admin_client = token::StellarAssetClient::new(&env, &token_address);
        let token_client = token::Client::new(&env, &token_address);

        let escrow_address = env.register(EscrowContract, ());
        let escrow_client = EscrowContractClient::new(&env, &escrow_address);

        let dispute_address = env.register(DisputeContract, ());
        let dispute_client = DisputeContractClient::new(&env, &dispute_address);

        let amount = 1000_i128;

        // Initialize Escrow
        escrow_client.initialize(&landlord, &tenant, &arbitrator, &token_address, &amount);
        assert_eq!(escrow_client.get_state(), State::Created);

        // Link Dispute Contract
        escrow_client.set_dispute_contract(&dispute_address);
        assert_eq!(escrow_client.get_dispute_contract(), dispute_address);

        // Initialize Dispute Contract
        dispute_client.initialize(&escrow_address, &arbitrator);

        // Mint tokens to Tenant
        token_admin_client.mint(&tenant, &amount);
        assert_eq!(token_client.balance(&tenant), amount);

        // Tenant funds the Escrow
        escrow_client.fund();
        assert_eq!(escrow_client.get_state(), State::Funded);
        assert_eq!(token_client.balance(&escrow_address), amount);

        // Landlord activates
        escrow_client.activate();
        assert_eq!(escrow_client.get_state(), State::Active);

        // Mutual settlement proposal by Landlord (e.g. 400 for landlord, 600 for tenant)
        escrow_client.request_settlement(&landlord, &400, &600);
        assert_eq!(escrow_client.get_state(), State::SettlementRequested);

        // Tenant accepts
        escrow_client.accept_settlement(&tenant);
        assert_eq!(escrow_client.get_state(), State::Closed);

        // Verify balances
        assert_eq!(token_client.balance(&landlord), 400);
        assert_eq!(token_client.balance(&tenant), 600);
        assert_eq!(token_client.balance(&escrow_address), 0);
    }

    #[test]
    fn test_lifecycle_dispute_resolution() {
        let env = Env::default();
        env.mock_all_auths_allowing_non_root_auth();

        let landlord = Address::generate(&env);
        let tenant = Address::generate(&env);
        let arbitrator = Address::generate(&env);
        let token_admin = Address::generate(&env);
        
        let token_address = env.register_stellar_asset_contract_v2(token_admin.clone()).address();
        let token_admin_client = token::StellarAssetClient::new(&env, &token_address);
        let token_client = token::Client::new(&env, &token_address);

        let escrow_address = env.register(EscrowContract, ());
        let escrow_client = EscrowContractClient::new(&env, &escrow_address);

        let dispute_address = env.register(DisputeContract, ());
        let dispute_client = DisputeContractClient::new(&env, &dispute_address);

        let amount = 1000_i128;

        // Init both contracts
        escrow_client.initialize(&landlord, &tenant, &arbitrator, &token_address, &amount);
        escrow_client.set_dispute_contract(&dispute_address);
        dispute_client.initialize(&escrow_address, &arbitrator);

        // Fund
        token_admin_client.mint(&tenant, &amount);
        escrow_client.fund();
        escrow_client.activate();

        // Tenant triggers a dispute
        let evidence_hash = BytesN::from_array(&env, &[1; 32]);
        escrow_client.dispute(&tenant, &evidence_hash);

        // Check states
        assert_eq!(escrow_client.get_state(), State::Disputed);
        assert_eq!(dispute_client.get_state(), rentsafe_dispute::DisputeState::Active);
        assert_eq!(dispute_client.get_evidence_hash(), evidence_hash);

        // Arbitrator resolves (payout 300 to landlord, 700 to tenant)
        dispute_client.resolve(&300, &700);

        // Check states and balances
        assert_eq!(escrow_client.get_state(), State::Closed);
        assert_eq!(dispute_client.get_state(), rentsafe_dispute::DisputeState::Resolved);
        assert_eq!(token_client.balance(&landlord), 300);
        assert_eq!(token_client.balance(&tenant), 700);
        assert_eq!(token_client.balance(&escrow_address), 0);
    }
}
