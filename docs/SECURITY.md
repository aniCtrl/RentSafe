# RentSafe Platform Security Specification

This document describes the security guarantees used by the RentSafe frontend and Soroban contracts.

## 1. Authentication and Access Control

Soroban uses cryptographic authorization through `Address::require_auth()` for state-changing operations.

- The landlord signs agreement creation, deduction requests, and their settlement proposals.
- The tenant signs deposit locking, deduction responses, evidence submissions, and their settlement proposals.
- Both participants may raise disputes and submit evidence for their linked dispute.
- Only the other participant can accept, reject, or counter the current proposal.
- The linked Escrow contract is the only caller authorized to register a dispute in the Dispute contract.
- The linked Dispute contract is the only caller authorized to invoke the Escrow settlement callback.
- Contract administration and upgrades remain protected by the existing admin authorization in the deployed contracts.

## 2. Funds and Settlement Guarantees

- The deposit stays in the Escrow contract throughout evidence submission and negotiation.
- Creating, rejecting, or countering a proposal does not transfer funds.
- Proposal payouts must be non-negative and must add up exactly to the locked deposit.
- A response must reference the current pending proposal. Rejected and superseded proposals cannot be accepted later.
- The Escrow contract validates its state and payout total before transferring XLM.

## 3. Cross-Contract Callback Protection

The Dispute contract records the accepted proposal, then calls `resolve_dispute_callback` on the linked Escrow contract. Escrow verifies the caller is the configured Dispute contract and rejects direct unauthorized settlement attempts.

## 4. Integer and Storage Safety

- Payout values use Soroban `i128` values and checked arithmetic.
- Deposit and payout values cannot be negative.
- Evidence references and proposal reasons are bounded by the contract model.
- Agreement, dispute, evidence, and proposal records are stored on-chain in Soroban storage.

## 5. External Evidence References

RentSafe does not upload or store evidence files. Users manage files in an external service such as Google Drive and submit only a URL, hash, or short description as the on-chain evidence reference.
