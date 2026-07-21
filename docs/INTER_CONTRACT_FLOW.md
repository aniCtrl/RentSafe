# RentSafe Inter-Contract Flow

This document details the cross-contract interaction during a dispute lifecycle.

## Dispute to Settlement Sequence

The diagram below shows the sequence of transactions and inter-contract invocations when a dispute is raised by the Tenant and resolved by the Arbitrator.

```mermaid
sequenceDiagram
    autonumber
    actor Tenant
    actor Arbitrator
    participant EscrowContract as Escrow Contract
    participant DisputeContract as Dispute Contract
    participant TokenContract as Stellar Asset Contract

    Note over Tenant, EscrowContract: Pre-requisite: Escrow is Active

    %% 1. Dispute invocation
    Tenant->>EscrowContract: dispute(tenant_auth, tenant_address, evidence_hash)
    Note over EscrowContract: Verify caller is Tenant<br/>Assert state is Active/SettlementRequested
    Note over EscrowContract: Update Escrow state to Disputed

    %% 2. Cross-contract call to Dispute
    critical Call Dispute contract
        EscrowContract->>DisputeContract: raise_dispute(disputer, evidence_hash)
        Note over DisputeContract: Require EscrowContract auth (host-verified)
        Note over DisputeContract: Update Dispute state to Active
        Note over DisputeContract: Store evidence_hash in persistent storage
        DisputeContract-->>EscrowContract: Dispute Raised Event
    end
    EscrowContract-->>Tenant: Escrow Disputed Event

    %% 3. Arbitrator review and resolution
    Note over Arbitrator, DisputeContract: Arbitrator reviews evidence off-chain (using evidence_hash)
    Arbitrator->>DisputeContract: resolve(arbitrator_auth, landlord_share, tenant_share)
    Note over DisputeContract: Verify caller is Arbitrator<br/>Assert state is Active
    Note over DisputeContract: Update Dispute state to Resolved

    %% 4. Callback to Escrow to execute payout
    critical Callback to Escrow
        DisputeContract->>EscrowContract: resolve_dispute(landlord_share, tenant_share)
        Note over EscrowContract: Require DisputeContract auth (host-verified)
        Note over EscrowContract: Update Escrow state to Resolved
        
        %% 5. Token Transfers
        opt Landlord Share > 0
            EscrowContract->>TokenContract: transfer(escrow, landlord, landlord_share)
            TokenContract-->>EscrowContract: success
        end
        opt Tenant Share > 0
            EscrowContract->>TokenContract: transfer(escrow, tenant, tenant_share)
            TokenContract-->>EscrowContract: success
        end
        
        Note over EscrowContract: Update Escrow state to Closed
        EscrowContract-->>DisputeContract: Escrow Closed Event
    end
    DisputeContract-->>Arbitrator: Dispute Resolved Event
```

## Security & Verification Mechanics

1. **Authorization Propagation (Step 4)**: 
   When the `Dispute` contract invokes the `Escrow` contract's `resolve_dispute` function:
   - The `Escrow` contract calls `dispute_contract_address.require_auth()`.
   - Because `Dispute` is the caller (the contract currently executing the invoke call), the Soroban host automatically validates this authorization, ensuring no third party can directly invoke `resolve_dispute`.

2. **State Locks (Step 1)**:
   Once the state is changed to `Disputed` in Step 1, all standard settlement actions in the `Escrow` contract (`request_settlement`, `accept_settlement`) are disabled. The funds are effectively locked until the linked `Dispute` contract returns a resolution.
