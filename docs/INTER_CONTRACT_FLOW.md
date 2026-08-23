# RentSafe Inter-Contract Flow

This document describes the participant-driven dispute and settlement flow.

## Agreement to Settlement Sequence

```mermaid
sequenceDiagram
    actor Landlord
    actor Tenant
    participant Escrow as Escrow Registry Contract
    participant Dispute as Dispute Registry Contract
    participant Token as Stellar Asset Contract

    Landlord->>Escrow: create_agreement(...)
    Tenant->>Escrow: lock_deposit(agreement_id)
    Note over Escrow: Deposit is held by the escrow contract
    Landlord->>Escrow: request_deduction(agreement_id, amount, reason)
    Tenant->>Escrow: respond_to_deduction(agreement_id, false)
    Escrow->>Dispute: register_dispute(agreement_id, landlord, tenant)
    Escrow->>Dispute: submit_evidence(dispute_id, raised_by, evidence_ref)
    Note over Escrow: Funds remain locked during the dispute

    Landlord->>Dispute: submit_evidence(dispute_id, evidence_ref)
    Tenant->>Dispute: submit_evidence(dispute_id, evidence_ref)
    Landlord->>Dispute: create_settlement_proposal(dispute_id, split, reason)
    Note over Dispute: One current proposal is pending a response

    loop Negotiation rounds
        Tenant->>Dispute: reject or counter the current proposal
        Note over Dispute: Rejection keeps history and moves no funds
        Tenant->>Dispute: counter_settlement_proposal(dispute_id, proposal_id, split, reason)
        Note over Dispute: Countered proposal becomes superseded and a new proposal becomes current
        Landlord->>Dispute: accept, reject, or counter the current proposal
    end

    Tenant->>Dispute: accept_settlement_proposal(dispute_id, proposal_id)
    Dispute->>Escrow: resolve_dispute_callback(agreement_id, landlord_amt, tenant_amt)
    Note over Escrow: Verify payouts equal the locked deposit
    Escrow->>Token: transfer(escrow, landlord, landlord_amt)
    Escrow->>Token: transfer(escrow, tenant, tenant_amt)
    Note over Escrow: Agreement is settled and the escrow balance is distributed
```

## Important Guarantees

1. Only the landlord or tenant can create, respond to, or counter a proposal for their dispute.
2. Proposal creation, rejection, and counter-offers never release escrow funds.
3. A proposal can only be accepted while it is the current pending proposal and by the other participant.
4. The final landlord and tenant payouts must add up exactly to the locked deposit.
5. Only the accepted participant proposal triggers the Dispute-to-Escrow settlement callback.
