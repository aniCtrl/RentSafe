# RentSafe Platform Security Specification

This document details the security model, risk mitigations, and development best practices implemented in the RentSafe smart contracts.

---

## 1. Authentication & Role-Based Access Control

Soroban employs an explicit cryptographic authorization model. RentSafe utilizes `Address::require_auth()` to enforce permissions for all state-changing operations:

*   **Landlord & Tenant Permissions**: 
    - The tenant's signature is required to deposit funds (`fund()`), propose mutual settlements, or trigger a dispute.
    - The landlord's signature is required to activate the lease (`activate()`), propose mutual settlements, or trigger a dispute.
*   **Arbitrator Permissions**: 
    - The arbitrator's signature is required to link the Dispute contract to the Escrow contract, and to upgrade either contract.
*   **Cross-Contract Access Control**: 
    - The `raise_dispute` function on the Dispute contract checks that the caller is the linked Escrow contract (`escrow_contract.require_auth()`).
    - The `resolve_dispute` function on the Escrow contract checks that the caller is the linked Dispute contract (`dispute_contract.require_auth()`).

---

## 2. Reentrancy & Callback Protections

Soroban contracts execute in a single-threaded environment with nested transaction execution.

*   **Call Stack Reentrancy**: 
    - When the `Dispute` contract calls back into the `Escrow` contract via `resolve_dispute()`, it executes a terminal transition to `Closed`. This state transition is completed inside the same call frame, preventing multiple payout re-entries.
    - The Escrow contract verifies that it is currently in the `Disputed` state. When resolved, the state is immediately set to `Closed` before sending any tokens. This follows the **checks-effects-interactions** pattern.

---

## 3. Integer Overflow Handling

Stellar's token interface and calculations use `i128` to prevent precision loss.

*   **Mathematical Safety**: 
    - Payout splits (`landlord_share + tenant_share == amount`) are checked for additions.
    - Any mathematical addition uses standard Rust checked math or asserts that shares sum to the exact initial deposit amount, preventing overflows.
    - Deposit and payout values are strictly non-negative (`landlord_share >= 0` and `tenant_share >= 0`).

---

## 4. State Archival & Storage Bump Strategy

Soroban relies on rent fee metrics to manage ledger storage growth. Ledger entries can expire if their TTL (Time To Live) is not bumped.

*   **Instance Storage**: 
    - Configuration (addresses, amounts) and the contract state are stored in instance storage. Bumping the contract instance's expiration automatically bumps all configuration data stored within it.
*   **Persistent Storage**: 
    - The Dispute contract stores the dispute evidence hash in persistent storage to accommodate larger payload bounds.
*   **Storage Fee & TTL Bump**:
    - For production deployment, frontend clients or fee-bump operations should call `env.storage().instance().extend_ttl()` periodically to prevent state expiration.

---

## 5. Contract Upgrade Authorization Risks

Contract upgrades are executed via the `upgrade` method on both contracts, which calls `env.deployer().update_current_contract_wasm()`.

*   **Arbitrator Control**: 
    - The `upgrade` function is gated exclusively behind the `arbitrator.require_auth()` check.
*   **Mitigation**:
    - The arbitrator address should ideally represent a multi-signature account or a decentralized governance contract to prevent single-point-of-failure vulnerabilities.
