#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, token, Address, Env, String, Symbol, contractclient,
};

#[contractclient(name = "DisputeContractClient")]
pub trait DisputeContract {
    fn register_dispute(
        env: Env,
        agreement_id: u64,
        tenant: Address,
        landlord: Address,
        amount: i128,
        reason: String,
    ) -> u64;
}


#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RentalAgreement {
    pub id: u64,
    pub tenant: Address,
    pub landlord: Address,
    pub amount: i128,
    pub state: u32, // 0 = PendingDeposit, 1 = Active, 2 = RefundProposed, 3 = Disputed, 4 = Settled
    pub refund_tenant_amount: i128,
    pub refund_landlord_amount: i128,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Token,
    DisputeContract,
    AgreementCount,
    Agreement(u64),
}

#[contract]
pub struct RentSafeEscrow;

#[contractimpl]
impl RentSafeEscrow {
    // Initialize Escrow Contract
    pub fn initialize(env: Env, admin: Address, token: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("Already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Token, &token);
        env.storage().instance().set(&DataKey::AgreementCount, &0u64);
    }

    // Set the Dispute Contract address (to resolve circular dependency)
    pub fn set_dispute_contract(env: Env, dispute_contract: Address) {
        let admin = env.storage().instance().get::<_, Address>(&DataKey::Admin)
            .unwrap_or_else(|| panic!("Not initialized"));
        admin.require_auth();

        env.storage().instance().set(&DataKey::DisputeContract, &dispute_contract);
    }

    // Create a new rental agreement
    pub fn create_agreement(
        env: Env,
        tenant: Address,
        landlord: Address,
        amount: i128,
    ) -> u64 {
        if amount <= 0 {
            panic!("Amount must be greater than zero");
        }
        tenant.require_auth();

        let mut count = env.storage().instance().get::<_, u64>(&DataKey::AgreementCount).unwrap_or(0);
        count += 1;
        env.storage().instance().set(&DataKey::AgreementCount, &count);

        let agreement = RentalAgreement {
            id: count,
            tenant: tenant.clone(),
            landlord: landlord.clone(),
            amount,
            state: 0, // PendingDeposit
            refund_tenant_amount: 0,
            refund_landlord_amount: 0,
        };

        // Persistent storage for agreement details
        env.storage().persistent().set(&DataKey::Agreement(count), &agreement);
        // Extend TTL to avoid archival
        env.storage().persistent().extend_ttl(&DataKey::Agreement(count), 5000, 100000);

        // Emit Event
        env.events().publish(
            (Symbol::new(&env, "agreement_created"), count),
            (tenant, landlord, amount),
        );

        count
    }

    // Tenant deposits security funds into escrow
    pub fn deposit(env: Env, agreement_id: u64) {
        let mut agreement = env.storage().persistent().get::<_, RentalAgreement>(&DataKey::Agreement(agreement_id))
            .unwrap_or_else(|| panic!("Agreement not found"));

        if agreement.state != 0 {
            panic!("Invalid agreement state for deposit");
        }

        agreement.tenant.require_auth();

        let token_addr = env.storage().instance().get::<_, Address>(&DataKey::Token)
            .unwrap_or_else(|| panic!("Token address not set"));

        let token_client = token::Client::new(&env, &token_addr);
        token_client.transfer(&agreement.tenant, &env.current_contract_address(), &agreement.amount);

        agreement.state = 1; // Active
        env.storage().persistent().set(&DataKey::Agreement(agreement_id), &agreement);

        env.events().publish(
            (Symbol::new(&env, "deposit_locked"), agreement_id),
            (agreement.tenant.clone(), agreement.amount),
        );
    }

    // Landlord proposes a partial deduction or full refund
    pub fn propose_deduction(
        env: Env,
        agreement_id: u64,
        landlord_amount: i128,
        tenant_amount: i128,
    ) {
        let mut agreement = env.storage().persistent().get::<_, RentalAgreement>(&DataKey::Agreement(agreement_id))
            .unwrap_or_else(|| panic!("Agreement not found"));

        if agreement.state != 1 && agreement.state != 2 {
            panic!("Invalid agreement state for proposing refund");
        }

        agreement.landlord.require_auth();

        if landlord_amount + tenant_amount != agreement.amount {
            panic!("Amounts must sum up to the total escrowed deposit");
        }

        // If landlord proposes full refund (landlord_amount = 0), process it immediately!
        if landlord_amount == 0 {
            let token_addr = env.storage().instance().get::<_, Address>(&DataKey::Token)
                .unwrap_or_else(|| panic!("Token address not set"));
            let token_client = token::Client::new(&env, &token_addr);

            token_client.transfer(&env.current_contract_address(), &agreement.tenant, &agreement.amount);

            agreement.state = 4; // Settled
            agreement.refund_tenant_amount = agreement.amount;
            agreement.refund_landlord_amount = 0;
            env.storage().persistent().set(&DataKey::Agreement(agreement_id), &agreement);

            env.events().publish(
                (Symbol::new(&env, "agreement_settled"), agreement_id),
                (agreement.amount, 0i128),
            );
        } else {
            // Propose partial refund
            agreement.state = 2; // RefundProposed
            agreement.refund_tenant_amount = tenant_amount;
            agreement.refund_landlord_amount = landlord_amount;
            env.storage().persistent().set(&DataKey::Agreement(agreement_id), &agreement);

            env.events().publish(
                (Symbol::new(&env, "deduction_proposed"), agreement_id),
                (tenant_amount, landlord_amount),
            );
        }
    }

    // Tenant accepts the landlord's deduction proposal
    pub fn approve_deduction(env: Env, agreement_id: u64) {
        let mut agreement = env.storage().persistent().get::<_, RentalAgreement>(&DataKey::Agreement(agreement_id))
            .unwrap_or_else(|| panic!("Agreement not found"));

        if agreement.state != 2 {
            panic!("No deduction proposed for this agreement");
        }

        agreement.tenant.require_auth();

        let token_addr = env.storage().instance().get::<_, Address>(&DataKey::Token)
            .unwrap_or_else(|| panic!("Token address not set"));
        let token_client = token::Client::new(&env, &token_addr);

        if agreement.refund_tenant_amount > 0 {
            token_client.transfer(&env.current_contract_address(), &agreement.tenant, &agreement.refund_tenant_amount);
        }
        if agreement.refund_landlord_amount > 0 {
            token_client.transfer(&env.current_contract_address(), &agreement.landlord, &agreement.refund_landlord_amount);
        }

        agreement.state = 4; // Settled
        env.storage().persistent().set(&DataKey::Agreement(agreement_id), &agreement);

        env.events().publish(
            (Symbol::new(&env, "deduction_approved"), agreement_id),
            (agreement.refund_tenant_amount, agreement.refund_landlord_amount),
        );
    }

    // Raise a dispute to resolve claims through the Dispute Contract
    pub fn raise_dispute(env: Env, agreement_id: u64, disputer: Address, reason: String) {
        let mut agreement = env.storage().persistent().get::<_, RentalAgreement>(&DataKey::Agreement(agreement_id))
            .unwrap_or_else(|| panic!("Agreement not found"));

        if agreement.state != 1 && agreement.state != 2 {
            panic!("Cannot raise dispute in the current state");
        }

        disputer.require_auth();
        if disputer != agreement.tenant && disputer != agreement.landlord {
            panic!("Disputer must be tenant or landlord");
        }

        let dispute_contract = env.storage().instance().get::<_, Address>(&DataKey::DisputeContract)
            .unwrap_or_else(|| panic!("Dispute contract not set"));

        let dispute_client = DisputeContractClient::new(&env, &dispute_contract);
        let dispute_id = dispute_client.register_dispute(
            &agreement_id,
            &agreement.tenant,
            &agreement.landlord,
            &agreement.amount,
            &reason,
        );

        agreement.state = 3; // Disputed
        env.storage().persistent().set(&DataKey::Agreement(agreement_id), &agreement);

        env.events().publish(
            (Symbol::new(&env, "dispute_raised"), agreement_id),
            (dispute_id, reason),
        );
    }


    // Callback invoked by the Dispute Contract upon resolving
    pub fn resolve_dispute_callback(
        env: Env,
        agreement_id: u64,
        landlord_amount: i128,
        tenant_amount: i128,
    ) {
        let dispute_contract = env.storage().instance().get::<_, Address>(&DataKey::DisputeContract)
            .unwrap_or_else(|| panic!("Dispute contract not set"));

        // Only the dispute contract is authorized to call this resolution callback
        dispute_contract.require_auth();

        let mut agreement = env.storage().persistent().get::<_, RentalAgreement>(&DataKey::Agreement(agreement_id))
            .unwrap_or_else(|| panic!("Agreement not found"));

        if agreement.state != 3 {
            panic!("Agreement is not in dispute status");
        }

        if landlord_amount + tenant_amount != agreement.amount {
            panic!("Amounts must sum up to the total escrowed deposit");
        }

        let token_addr = env.storage().instance().get::<_, Address>(&DataKey::Token)
            .unwrap_or_else(|| panic!("Token address not set"));
        let token_client = token::Client::new(&env, &token_addr);

        if tenant_amount > 0 {
            token_client.transfer(&env.current_contract_address(), &agreement.tenant, &tenant_amount);
        }
        if landlord_amount > 0 {
            token_client.transfer(&env.current_contract_address(), &agreement.landlord, &landlord_amount);
        }

        agreement.state = 4; // Settled
        agreement.refund_tenant_amount = tenant_amount;
        agreement.refund_landlord_amount = landlord_amount;
        env.storage().persistent().set(&DataKey::Agreement(agreement_id), &agreement);

        env.events().publish(
            (Symbol::new(&env, "dispute_resolved"), agreement_id),
            (tenant_amount, landlord_amount),
        );
    }

    // Upgrade contract WASM byte-code (upgradeability strategy)
    pub fn upgrade(env: Env, new_wasm_hash: soroban_sdk::BytesN<32>) {
        let admin = env.storage().instance().get::<_, Address>(&DataKey::Admin)
            .unwrap_or_else(|| panic!("Not initialized"));
        admin.require_auth();

        env.deployer().update_current_contract_wasm(new_wasm_hash);
    }


    // Read methods for frontend integration
    pub fn get_agreement(env: Env, agreement_id: u64) -> RentalAgreement {
        env.storage().persistent().get::<_, RentalAgreement>(&DataKey::Agreement(agreement_id))
            .unwrap_or_else(|| panic!("Agreement not found"))
    }

    pub fn get_agreement_count(env: Env) -> u64 {
        env.storage().instance().get::<_, u64>(&DataKey::AgreementCount).unwrap_or(0)
    }

    pub fn get_token(env: Env) -> Address {
        env.storage().instance().get::<_, Address>(&DataKey::Token).unwrap()
    }

    pub fn get_dispute_contract(env: Env) -> Address {
        env.storage().instance().get::<_, Address>(&DataKey::DisputeContract).unwrap()
    }
}

mod test;

