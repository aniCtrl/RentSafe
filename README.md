# RentSafe — Decentralized Rental Deposit Escrow Platform

RentSafe is a production-grade, decentralized rental deposit escrow platform built on Stellar using Soroban smart contracts. It enables tenants and landlords to lock, manage, and mutually settle rental deposits trustlessly, with arbitrator-backed dispute resolution. All values in the UI are formatted in native **XLM** with secondary USD conversion tooltips.

---

## 1. Project Architecture

The codebase contains the full smart contract workspace (Rust) and the Next.js frontend application (TypeScript + Tailwind v4 + Zustand + React Query):

```
.
├── Cargo.toml
├── Cargo.lock
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── tailwind.config.ts
├── .github/
│   └── workflows/
│       └── ci.yml             # Github Actions CI pipeline (Node build, tests, Cargo check)
├── contracts/
│   ├── escrow/                # Rental Escrow smart contract (fund, activate, settle, dispute)
│   └── dispute/               # Dispute arbitration smart contract
├── deployments/
│   └── testnet.json           # Live testnet deployed contract IDs and hashes
├── scripts/
│   ├── deploy.sh              # Build and deploy script compiling WASMs to testnet
│   ├── initialize.py          # Invokes initialize() and set_dispute_contract()
│   ├── initialize.sh          # Shell wrapper to invoke the initialize python script
│   └── upgrade.sh             # Upgrades compiled WASM code hash on-chain
├── src/
│   ├── app/                   # Next.js App Router (Landing, Dashboard panel, Create form)
│   ├── bindings/              # Auto-generated TS bindings client for contracts
│   ├── components/            # Reusable UI elements (WalletConnectModal, ActivityFeed, etc.)
│   ├── hooks/                 # Custom React hooks (useEventStream)
│   ├── lib/                   # Base configurations (stellar client, JSON-RPC view handlers)
│   ├── services/              # Client-side contract interaction layer (ContractService)
│   └── store/                 # State management layer (Zustand session store)
```

---

## 2. Smart Contract Lifecycle

The Escrow contract strictly coordinates the lease security deposit state machine:
`Created` (0) $\rightarrow$ `Funded` (1) $\rightarrow$ `Active` (2) $\rightarrow$ `SettlementRequested` (3) $\rightarrow$ `Disputed` (4) $\rightarrow$ `Resolved` (5) $\rightarrow$ `Closed` (6)

* **Created**: Escrow initialized with landlord, tenant, arbitrator, token, and target deposit size.
* **Funded**: Tenant locks target deposit size inside the contract instance.
* **Active**: Landlord activates the lease upon key handover. Funds remain locked.
* **SettlementRequested**: A payout split (e.g. damages deduction) is proposed by either landlord or tenant.
* **Disputed**: Raised by a counterparty rejecting a proposed split. Payout authority is locked and delegated to the Arbitrator.
* **Resolved**: Arbitrator submits custom split distributions to close the dispute.
* **Closed**: Funds are unlocked and paid out to landlords and tenants.

---

## 3. Live Testnet Deployments

The smart contracts are deployed and initialized on the **Stellar Testnet**:

| Contract | Address / ID | Explorer Link |
|---|---|---|
| **Escrow Contract** | `CCFATHQC6KASED4FK3V4IYSTN2ODHFC2AW635BXUD66OLPVICA2WN3AG` | [Stellar Expert — Escrow](https://stellar.expert/explorer/testnet/contract/CCFATHQC6KASED4FK3V4IYSTN2ODHFC2AW635BXUD66OLPVICA2WN3AG) |
| **Dispute Contract** | `CAEPHREYA4AFHY3TVFC2PM5ARRAMNHYLJZQOBX6255T5ASEE3BBQ5KHO` | [Stellar Expert — Dispute](https://stellar.expert/explorer/testnet/contract/CAEPHREYA4AFHY3TVFC2PM5ARRAMNHYLJZQOBX6255T5ASEE3BBQ5KHO) |

### Active Role Configurations (Testnet):
* **Landlord**: `GBFJINJRIR3JOEOZCNWLSF3B5VENKG2RAGVT4WY4J6AHW32UU2GF3TW3`
* **Tenant**: `GB4TTRCTXZ3RNNB6COSWVFWXNPUYWVHX7GI63Z7OC2KYR4BS5W54WAHF`
* **Arbitrator**: `GAKY5EWWOETAUQQZJPSW3OD5R2N46BE7G24PAHSHLGYLZGTMOLWE7BXT`
* **Token Address**: `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` (Native XLM SAC Contract)

---

## 4. How to Reproduce

### Prerequisites
*   Rust: `rustc` with `wasm32-unknown-unknown` target.
*   Stellar CLI: `stellar 27.0.0` or later.
*   Node.js: `v20` or later.

---

### Step 1: Smart Contracts Build & Test
1. Compile the smart contracts:
   ```bash
   stellar contract build
   ```
2. Run the automated contract unit tests:
   ```bash
   cargo test
   ```

---

### Step 2: Deployment (Stellar Testnet)
1. Deploy contracts and generate WASM build hashes:
   ```bash
   ./scripts/deploy.sh testnet RENTSAFE_TESTNET
   ```
2. Initialize and link dispute mechanisms on-chain:
   ```bash
   export RENTSAFE_LANDLORD_ADDR="GBFJINJRIR3JOEOZCNWLSF3B5VENKG2RAGVT4WY4J6AHW32UU2GF3TW3"
   export RENTSAFE_TENANT_ADDR="GB4TTRCTXZ3RNNB6COSWVFWXNPUYWVHX7GI63Z7OC2KYR4BS5W54WAHF"
   export RENTSAFE_ARBITRATOR_ADDR="GAKY5EWWOETAUQQZJPSW3OD5R2N46BE7G24PAHSHLGYLZGTMOLWE7BXT"
   
   python3 scripts/initialize.py testnet
   ```

---

### Step 3: Frontend Client Integration
The Next.js client is optimized for production-grade dynamic browser actions:
1. Install dependencies:
   ```bash
   npm install --legacy-peer-deps
   ```
2. Run the unit test suite:
   ```bash
   npm run test
   ```
3. Run the Next.js development server:
   ```bash
   npm run dev
   ```
4. Compile the static application build:
   ```bash
   npm run build
   ```

---

## 5. Architecture Notes

### Direct RPC Reads (Testnet/MVP Phase)
To keep the application highly decentralized, serverless, and direct, we read contract states and discover user agreements by querying events (`getEvents`) directly from the Soroban RPC endpoint. This removes any database sync lags and indexer dependency.

### Scaling & Swap Path (Production Phase)
If platform traffic scales significantly, query volume increases, or advanced search features (such as searching by landlord name/metadata) are needed, we can swap the service layer implementation (`src/services/chain/agreementService.ts`) for an indexer-backed API client (e.g. built using Node.js + Express + MongoDB/PostgreSQL). Because all widgets, pages, and timelines interface with the service and hook abstractions rather than calling the Soroban RPC directly, this database integration will require zero changes to component layouts.

