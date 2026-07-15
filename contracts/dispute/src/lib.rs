#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, Address, Env, String, Symbol, contractclient,
};

#[contractclient(name = "EscrowContractClient")]
pub trait EscrowContract {
    fn resolve_dispute_callback(
        env: Env,
        agreement_id: u64,
        landlord_amount: i128,
        tenant_amount: i128,
    );
}


#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Dispute {
    pub id: u64,
    pub agreement_id: u64,
    pub tenant: Address,
    pub landlord: Address,
    pub amount: i128,
    pub reason: String,
    pub state: u32, // 0 = Open, 1 = Resolved
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    EscrowContract,
    DisputeCount,
    Dispute(u64),
}

#[contract]
pub struct RentSafeDispute;

#[contractimpl]
impl RentSafeDispute {
    // Initialize Dispute Contract
    pub fn initialize(env: Env, admin: Address, escrow_contract: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("Already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::EscrowContract, &escrow_contract);
        env.storage().instance().set(&DataKey::DisputeCount, &0u64);
    }

    // Register a new dispute (Can only be called by the Escrow Contract)
    pub fn register_dispute(
        env: Env,
        agreement_id: u64,
        tenant: Address,
        landlord: Address,
        amount: i128,
        reason: String,
    ) -> u64 {
        let escrow_contract = env.storage().instance().get::<_, Address>(&DataKey::EscrowContract)
            .unwrap_or_else(|| panic!("Escrow contract address not set"));

        // Authorize that caller is the escrow contract
        escrow_contract.require_auth();

        let mut count = env.storage().instance().get::<_, u64>(&DataKey::DisputeCount).unwrap_or(0);
        count += 1;
        env.storage().instance().set(&DataKey::DisputeCount, &count);

        let dispute = Dispute {
            id: count,
            agreement_id,
            tenant,
            landlord,
            amount,
            reason: reason.clone(),
            state: 0, // Open
        };

        env.storage().persistent().set(&DataKey::Dispute(count), &dispute);
        env.storage().persistent().extend_ttl(&DataKey::Dispute(count), 5000, 100000);

        // Emit Dispute Registered Event
        env.events().publish(
            (Symbol::new(&env, "dispute_registered"), count),
            (agreement_id, amount, reason),
        );

        count
    }

    // Resolve an active dispute (Can only be called by the Admin/Arbiter)
    pub fn resolve_dispute(
        env: Env,
        dispute_id: u64,
        landlord_amount: i128,
        tenant_amount: i128,
    ) {
        let admin = env.storage().instance().get::<_, Address>(&DataKey::Admin)
            .unwrap_or_else(|| panic!("Not initialized"));
        admin.require_auth();

        let mut dispute = env.storage().persistent().get::<_, Dispute>(&DataKey::Dispute(dispute_id))
            .unwrap_or_else(|| panic!("Dispute not found"));

        if dispute.state != 0 {
            panic!("Dispute is already resolved");
        }

        if landlord_amount + tenant_amount != dispute.amount {
            panic!("Refund parts must equal the total dispute amount");
        }

        let escrow_contract = env.storage().instance().get::<_, Address>(&DataKey::EscrowContract)
            .unwrap_or_else(|| panic!("Escrow contract address not set"));

        // Trigger Escrow contract's callback to distribute funds
        let escrow_client = EscrowContractClient::new(&env, &escrow_contract);
        escrow_client.resolve_dispute_callback(&dispute.agreement_id, &landlord_amount, &tenant_amount);

        dispute.state = 1; // Resolved
        env.storage().persistent().set(&DataKey::Dispute(dispute_id), &dispute);

        // Emit Dispute Resolved Event
        env.events().publish(
            (Symbol::new(&env, "dispute_resolved_admin"), dispute_id),
            (tenant_amount, landlord_amount),
        );
    }

    // Upgrade contract WASM byte-code
    pub fn upgrade(env: Env, new_wasm_hash: soroban_sdk::BytesN<32>) {
        let admin = env.storage().instance().get::<_, Address>(&DataKey::Admin)
            .unwrap_or_else(|| panic!("Not initialized"));
        admin.require_auth();

        env.deployer().update_current_contract_wasm(new_wasm_hash);
    }


    // Read methods
    pub fn get_dispute(env: Env, dispute_id: u64) -> Dispute {
        env.storage().persistent().get::<_, Dispute>(&DataKey::Dispute(dispute_id))
            .unwrap_or_else(|| panic!("Dispute not found"))
    }

    pub fn get_dispute_count(env: Env) -> u64 {
        env.storage().instance().get::<_, u64>(&DataKey::DisputeCount).unwrap_or(0)
    }

    pub fn get_escrow_contract(env: Env) -> Address {
        env.storage().instance().get::<_, Address>(&DataKey::EscrowContract).unwrap()
    }
}
