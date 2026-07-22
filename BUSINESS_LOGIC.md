# Business Logic Reference

## 1. Chain & Wallet Config
- **Supported Chains**: Stellar Testnet (`Test SDF Network ; September 2015`).
- **RPC Endpoints**: `https://soroban-testnet.stellar.org`.
- **Wallet Adapters**: Freighter browser extension connected via `@creit.tech/stellar-wallets-kit`.
- **Wallet Kit Configuration**: Managed as a global static singleton in `src/lib/stellar.ts`, pre-configured to `KitNetworks.TESTNET` using `defaultModules()`.

---

## 2. Contract Interfaces

### Escrow Contract
- **Contract Address (Testnet)**: `CBPI35R5GHDJOVGE6CET2FKDJ2I77KCKOXWQ62NHGQN4YCV3MS7OS2Q7`
- **ABI/Interface Location**: Defined on-chain (retrieved via Soroban RPC simulations). Rust source at `contracts/escrow/src/lib.rs`.
- **Functions called from frontend**:
  1. `get_landlord`
     - **Purpose**: Get the address of the landlord.
     - **Params**: None
     - **Return shape**: `string` (Stellar G-address representation)
  2. `get_tenant`
     - **Purpose**: Get the address of the tenant.
     - **Params**: None
     - **Return shape**: `string` (Stellar G-address representation)
  3. `get_arbitrator`
     - **Purpose**: Get the address of the arbitrator.
     - **Params**: None
     - **Return shape**: `string` (Stellar G-address representation)
  4. `get_token`
     - **Purpose**: Get the token contract ID managing deposits.
     - **Params**: None
     - **Return shape**: `string` (Stellar C-address representation)
  5. `get_amount`
     - **Purpose**: Get the required deposit amount.
     - **Params**: None
     - **Return shape**: `bigint` (Stroops size, i128 on-chain)
  6. `get_state`
     - **Purpose**: Get current lifecycle state index.
     - **Params**: None
     - **Return shape**: `number` (mapped 0-6 corresponding to `STATE_NAMES`)
  7. `get_dispute_contract`
     - **Purpose**: Get linked Dispute contract instance.
     - **Params**: None
     - **Return shape**: `string` (Stellar C-address representation)
  8. `initialize`
     - **Purpose**: Initialize roles and amounts in newly deployed instance.
     - **Params**: `landlord: Address`, `tenant: Address`, `arbitrator: Address`, `token: Address`, `amount: i128`
     - **Return shape**: None (returns success on-chain transaction)
  9. `fund`
     - **Purpose**: Tenant deposits required locked funds into contract.
     - **Params**: None
     - **Return shape**: None (returns success transaction)
  10. `activate`
      - **Purpose**: Landlord activates lease start once deposit is funded.
      - **Params**: None
      - **Return shape**: None (returns success transaction)
  11. `request_settlement`
      - **Purpose**: Landlord or Tenant proposes a payout split.
      - **Params**: `proposer: Address`, `landlord_share: i128`, `tenant_share: i128`
      - **Return shape**: None
  12. `accept_settlement`
      - **Purpose**: Counterparty accepts pending proposed split, executing payouts.
      - **Params**: `acceptor: Address`
      - **Return shape**: None
  13. `dispute`
      - **Purpose**: Tenant or Landlord locks contract and starts callback dispute.
      - **Params**: `disputant: Address`, `evidence_hash: BytesN<32>`
      - **Return shape**: None
  14. `set_dispute_contract`
      - **Purpose**: Arbitrator links the Dispute contract address.
      - **Params**: `dispute_contract: Address`
      - **Return shape**: None

### Dispute Contract
- **Contract Address (Testnet)**: `CCTC5ZQPSXD6DVXNRTJBTJC32PTPAGAWQEBPVKJHQAI5UZVS54TF4BSX`
- **Rust Source**: `contracts/dispute/src/lib.rs`
- **Functions called from frontend**:
  1. `resolve`
     - **Purpose**: Arbitrator resolves the dispute, triggering split execution back on the Escrow contract.
     - **Params**: `landlord_payout: i128`, `tenant_payout: i128`
     - **Return shape**: None

---

## 3. Extracted Hooks/Modules (post Phase 2)

### Hook: `useEscrowContract`
- **File Path**: [useEscrowContract.ts](file:///Users/bahnishikhasingha/Documents/RentSafe/src/hooks/useEscrowContract.ts)
- **Exported Functions**:
  - `connectWallet`: Opens the modal for selecting Freighter wallet connection and saves address.
  - `fetchEscrowInfo`: Simulates calls to read all metadata parameters of target Escrow ID.
  - `executeAction`: Invokes arbitrary write functions on the Escrow contract.
  - `initializeNewAgreement`: Signs and submits contract initialization payload.
  - `setDisputeContractOnEscrow`: Links the Dispute contract instance address.
  - `resolveArbitratorDispute`: Invokes dispute settlement payouts.
- **Inputs**: None
- **Outputs**: State properties (`address`, `balance`, `escrowInfo`, `escrowBalance`, `actionLoading`, `actionTx`, `actionError`, etc.) and handler functions.
- **Side effects**: Pulls native token balance, updates on-chain records, triggers Freighter signing prompts.

---

## 4. Data Fetching / API Layer
- **Endpoints**: Requests are routed through the JSON-RPC server at `https://soroban-testnet.stellar.org`.
- **Auth**: On-chain transactions require digital signature auth from Freighter.
- **Polling**: On-chain submissions poll transaction status using `server.getTransaction` every 2000ms (max 15 attempts) until states resolve to `SUCCESS` or `FAILED`.
- **Caching**: No local caching is implemented. The frontend fetches raw ledger states on mount and after successful transactions to ensure absolute data validity.

---

## 5. State & Data Flow
- **Global State**: Managed within `useEscrowContract` hook. Keep track of:
  - Wallet authentication address and active native balance.
  - Target Escrow contract details (`EscrowInfo`) and its locked token balance.
  - Interactive loader status and transaction hash details.
- **Re-fetches triggers**:
  - Changing target Escrow ID and clicking Inspect.
  - Success verification of any state-altering transaction (`fund`, `activate`, `settle`, `resolve`).

---

## 6. Business Rules & Validation
- **Authentication Guard**: Transaction console buttons are disabled unless the wallet address is connected.
- **Lease State Flow**:
  - Escrow must be in `Created` (0) state to call `fund()`.
  - Escrow must be in `Funded` (1) state to call `activate()`.
  - Escrow must be in `Active` (2) or `SettlementRequested` (3) state to request settlement or file a dispute.
  - Escrow must be in `Disputed` (4) state for Arbitrator resolve payouts to execute.
- **Role Verification**:
  - Only the designated Tenant can fund deposit.
  - Only the designated Landlord can activate lease.
  - Only the designated Arbitrator can link the Dispute contract or resolve dispute payouts.
  - Accept settlement is only permitted for the counterparty (non-proposer) role.

---

## 7. Routes & Page Responsibilities
- **Route `/`**:
  - **Functional Purpose**: Unified portal for managing lifecycle and actions of any RentSafe escrow agreement.
  - **Logic Dependencies**: `src/hooks/useEscrowContract.ts`, `src/lib/stellar.ts`.

---

## 8. Env Vars & Secrets Required
- No backend secrets are required. Frontend operates client-side only. Contract ID configurations are pre-defined as defaults.

---

## 9. Known Gotchas / Edge Cases
- **Browser-only APIs**: The Freighter and wallets-kit dependencies query global `window` and `localStorage` on import. Prerendering the page on the server during Next.js builds crashes unless loaded dynamically with `{ ssr: false }`.
- **RPC Timeouts**: Transaction verification polling might timeout (15 attempts/30 seconds) if the testnet experiences high load.
- **Stroops Conversion**: Soroban represents XLM balances as `i128` integers in Stroops (`1 XLM = 10,000,000 Stroops`). Conversions are multiplied/divided by `10,000,000` before submit/render.
