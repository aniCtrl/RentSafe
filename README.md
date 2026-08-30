<p align="center">
  <img src="src/app/icon.svg" alt="RentSafe Logo" width="96" height="96"/>
</p>

<p align="center">
  <strong>RentSafe — Production-Grade, Decentralized Rental Deposit Escrow Platform</strong><br/>
  <em>A trustless, decentralized security deposit escrow platform built on Stellar & Soroban, replacing opaque manual agreements with secure on-chain contract coordination.</em>
</p>

<p align="center">
  <a href="https://stellar.expert/explorer/testnet/contract/CAUQOF5U6PUWNBZYWUAWBMYXQNPBXUQQWH3EHO6GQMUFKKNFQBWKXEUD"><img src="https://img.shields.io/badge/EscrowContract-Testnet-blue?logo=stellar" alt="EscrowContract"/></a>
  <a href="https://stellar.expert/explorer/testnet/contract/CARBWEU5IF6Q4DJQHNJJOLFG57WXPWIIU5KUPMN2VRADO6GUSRAGKG3W"><img src="https://img.shields.io/badge/DisputeContract-Testnet-blue?logo=stellar" alt="DisputeContract"/></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-brightgreen" alt="License"/></a>
  <img src="https://img.shields.io/badge/tests-passing-brightgreen" alt="Tests"/>
  <img src="https://img.shields.io/badge/build-passing-brightgreen" alt="Build"/>
</p>

---

## Table of Contents

- [1. Product Overview & Problem Statement](#1-product-overview--problem-statement)
- [2. Architecture](#2-architecture)
- [3. Smart Contract Design](#3-smart-contract-design)
  - [3.1 RentSafe Escrow Registry (`rentsafe-escrow`)](#31-rentsafe-escrow-registry-rentsafe-escrow)
  - [3.2 RentSafe Dispute Registry (`rentsafe-dispute`)](#32-rentsafe-dispute-registry-rentsafe-dispute)
- [4. Inter-Contract Communication Flow](#4-inter-contract-communication-flow)
- [5. Features & Tech Stack](#5-features--tech-stack)
- [6. Local Development Setup](#6-local-development-setup)
- [7. CI/CD & Deployment](#7-cicd--deployment)
  - [7.1 Automated CI & Testing (Pull Requests & Pushes)](#71-automated-ci--testing-pull-requests--pushes)
  - [7.2 Automated Deploy (merge to main)](#72-automated-deploy-merge-to-main)
  - [7.3 Contract Deployment (Manual — One-Time or After WASM Change)](#73-contract-deployment-manual--one-time-or-after-wasm-change)
- [8. Security Considerations](#8-security-considerations)
- [9. Screenshots](#9-screenshots)
  - [9.1 Desktop View](#91-desktop-view)
  - [9.2 Mobile Responsive View](#92-mobile-responsive-view)
  - [9.3 CI/CD Workflow](#93-cicd-workflow)
  - [9.4 Automated Testing](#94-automated-testing)
  - [9.5 Active Usage Proof](#95-active-usage-proof)
- [10. Contract Addresses & On-Chain Verification](#10-contract-addresses--on-chain-verification)
- [11. Feedback & Responses](#11-feedback--responses)
- [12. Next Phase Improvements Based on User Feedback](#12-next-phase-improvements-based-on-user-feedback)
  - [12.1 Feedback-Driven Improvements](#121-feedback-driven-improvements)
  - [12.2 Next Phase Evolution Roadmap](#122-next-phase-evolution-roadmap)
- [13. Resources & Links](#13-resources--links)
- [Contributing](#contributing)
- [License](#license)

---

## 1. Product Overview & Problem Statement

Traditional rental deposit schemes are plagued by inefficiency, high transaction costs, lack of transparency, and unilateral hold-ups. Tenants frequently struggle to recover security deposits at lease termination, while landlords face complex administrative burdens, exposure to deposit disputes, and manual payout coordination.

**RentSafe** provides a trustless, decentralized security deposit escrow platform built on the Stellar network:

| Pain point | RentSafe solution |
|---|---|
| Unilateral deposit withholding | Deposits are locked securely into the multi-agreement escrow contract, preventing landlord hold-ups. |
| High transaction & admin fees | Leveraging Stellar's high speed and extremely low fees for all agreement transitions. |
| Opaque deposit custody | Funds are custodied transparently on-chain, visible to both parties at all times. |
| Complex, slow refund payouts | Single-click release or refund triggers immediate on-chain settlement. |
| Unresolved deposit disputes | On-chain dispute resolution with evidence submission and structured landlord-tenant negotiation. |
| Endless settlement back-and-forth | Versioned settlement proposals let either participant reject, counter, or accept a current split before funds move. |
| Siloed/opaque dispute rulings | Every evidence reference, proposal, response, and final split is logged on-chain. |

---

## 2. Architecture

The RentSafe frontend is a Next.js single-page application that queries the live ledger state directly from the Soroban RPC network, eliminating the need for private backend databases.

```mermaid
graph TD
    A[User Browser] -->|Interacts| B[Next.js Frontend App]
    B -->|Local State Management| C[Zustand Session Store & React Query]
    B -->|Requests Signatures| D[Stellar Wallets Kit]
    D -->|Connects to Extensions| E[Freighter / xBull / Albedo / Ledger]
    C -->|Queries State & Simulates Tx| F[Stellar SDK / Soroban RPC]
    F -->|Fetches Events & Submits Tx| G[Stellar Testnet Ledger]
    G -->|Executes Bytecode| H[Soroban Smart Contracts]
    H --> H1[Escrow Registry Contract]
    H --> H2[Dispute Registry Contract]
    H1 -.->|Inter-contract Calls| H2
    B -->|Live events & saved activity| I[Activity Feed & Notifications]
    I -->|Device-local persistence| C
    B -.->|Optional external evidence helper| J[User-managed Google Drive]
    J -.->|User pastes share link into reference field| B
```

RentSafe does not upload or store evidence files. Users may manage photos or documents in their own Google Drive and submit only the resulting share URL in the existing on-chain evidence reference field.

---

## 3. Smart Contract Design

RentSafe implements a multi-agreement registry model under unique `u64` IDs.

### 3.1 RentSafe Escrow Registry (`rentsafe-escrow`)

**Purpose**: Hosts configuration mapping, manages agreement registries, locks deposit funds, and triggers on-chain disbursements.

**Address**: [`CAUQOF5U6PUWNBZYWUAWBMYXQNPBXUQQWH3EHO6GQMUFKKNFQBWKXEUD`](https://stellar.expert/explorer/testnet/contract/CAUQOF5U6PUWNBZYWUAWBMYXQNPBXUQQWH3EHO6GQMUFKKNFQBWKXEUD)

#### Storage Model

| Key | Storage tier | Type | Description |
|---|---|---|---|
| `Config` | Instance | `EscrowConfig` | Holds configurations (Native XLM asset contract, Dispute contract, Admin list) |
| `NextAgreementId` | Instance | `u64` | Auto-incrementing agreement ID |
| `Agreement(u64)` | Persistent | `Agreement` | Struct mapping unique ID to agreement state (landlord, tenant, deposit, rent, dates, status) |
| `AgreementIds` | Persistent | `Vec<u64>` | Running list of all registered agreement IDs |
| `Role(Address, Symbol)` | Persistent | `Symbol` | Role authorization map |

#### Public Functions
`initialize` · `has_role` · `add_admin` · `remove_admin` · `create_agreement` · `lock_deposit` · `request_full_refund` · `request_deduction` · `respond_to_deduction` · `raise_dispute` · `settle` · `resolve_dispute_callback` · `get_config` · `get_agreement` · `get_agreement_deposit` · `get_agreement_parties` · `get_agreement_ids` · `upgrade`

---

### 3.2 RentSafe Dispute Registry (`rentsafe-dispute`)

**Purpose**: Manages dispute records linked to agreements, gathers chronological evidence references from participants, and supports structured landlord-tenant settlement negotiation.

**Address**: [`CARBWEU5IF6Q4DJQHNJJOLFG57WXPWIIU5KUPMN2VRADO6GUSRAGKG3W`](https://stellar.expert/explorer/testnet/contract/CARBWEU5IF6Q4DJQHNJJOLFG57WXPWIIU5KUPMN2VRADO6GUSRAGKG3W)

#### Storage Model

| Key | Storage tier | Type | Description |
|---|---|---|---|
| `Config` | Instance | `DisputeConfig` | Linked Escrow address and super-admin |
| `Dispute(u64)` | Persistent | `Dispute` | Struct storing dispute details, status, splits, and evidence references |
| `DisputeIds` | Persistent | `Vec<u64>` | Running list of all dispute IDs |
| `SettlementProposal(u64)` | Persistent | `SettlementProposal` | Versioned landlord/tenant payout proposal with status, reason, and timestamps |
| `SettlementProposalIds(u64)` | Persistent | `Vec<u64>` | Ordered proposal history for each dispute |
| `CurrentSettlementProposal(u64)` | Persistent | `u64` | Points to the one pending proposal that can receive a response |
| `Role(Address, Symbol)` | Persistent | `Symbol` | Administrative authorization metadata |

#### Public Functions
`initialize` · `has_role` · `add_admin` · `remove_admin` · `register_dispute` · `submit_evidence` · `propose_mutual_resolution` · `create_settlement_proposal` · `accept_settlement_proposal` · `reject_settlement_proposal` · `counter_settlement_proposal` · `get_config` · `get_dispute` · `get_dispute_by_agreement` · `get_mutual_resolution` · `get_settlement_proposal` · `get_current_settlement_proposal` · `get_settlement_proposals` · `get_dispute_ids` · `upgrade`

---

## 4. Inter-Contract Communication Flow

During a dispute resolution, the Escrow and Dispute contracts coordinate actions to secure the funds and lock states until resolved.

```mermaid
flowchart TD
    A["Landlord creates agreement"] --> B["Tenant locks deposit"]
    B --> C["Lease ends and landlord requests a deduction"]
    C --> D["Tenant rejects deduction"]
    D --> E["Escrow opens dispute in Dispute contract"]
    E --> F["Landlord and tenant submit evidence"]
    F --> G["Either participant creates a settlement proposal"]
    G --> H{"Counterparty accepts proposal?"}
    H -->|No| I["Reject or counter proposal - funds remain locked"]
    I --> G
    H -->|Yes| J["Dispute contract calls Escrow callback"]
    J --> K["Escrow verifies payouts equal locked deposit"]
    K --> L["Escrow transfers XLM to landlord and tenant"]
    L --> M["Agreement workflow complete - no further participant action"]
```

Settlement negotiation is participant-controlled: either landlord or tenant may create a proposal, while only the other participant may reject, counter, or accept the current proposal. Every proposal records its split, proposer, status, optional reason, and timestamps. Only acceptance by the counterparty calls the escrow settlement callback; all payout amounts must add up to the locked deposit. After the payout, the frontend marks the agreement workflow complete and shows that no further action is required.

---

## 5. Features & Tech Stack

### Tech Stack Table

| Layer | Technology | Description |
|---|---|---|
| **Smart Contracts** | Rust, Soroban SDK | Secure, gas-efficient on-chain contract logic |
| **Frontend Framework** | Next.js 16 (App Router), React 19 | Responsive web application with fast rendering |
| **State Management** | Zustand, React Query | Persistent session states and synchronized server/chain caches |
| **Wallet Protocol** | `@creit.tech/stellar-wallets-kit` | Multi-wallet connector supporting Freighter, xBull, and Albedo |
| **Blockchain Client** | `@stellar/stellar-sdk` | Interface library to execute RPC simulations and build transactions |
| **Styles & Theme** | Vanilla CSS, Outfit Font | Premium aesthetic featuring glassmorphism and custom micro-animations |

### Current Workflow Capabilities

- **Agreement lifecycle**: Create an agreement, lock the tenant deposit, manage move-out refunds or deductions, and settle the escrow on-chain.
- **Evidence-backed disputes**: Landlord and tenant can submit multiple evidence references. Evidence files remain in user-managed external services; RentSafe stores only references.
- **Negotiated mutual settlement**: Either participant can create a payout proposal. The other participant can accept, reject, or counter it, with a complete on-chain proposal history.
- **Activity and notifications**: Live contract events, wallet-scoped notifications, transaction hashes, and saved device-local activity help participants track the lifecycle.

---

## 6. Local Development Setup

### 1. Clone & Install
```bash
git clone https://github.com/aniCtrl/RentSafe.git
cd RentSafe
npm install --legacy-peer-deps
```

### 2. Configure Environment Variables
Create a local `.env` file in the root directory:
```bash
cp .env.example .env
```
Populate the contract IDs and addresses. Refer to [DEPLOYMENT.md](file:///Users/bahnishikhasingha/Documents/RentSafe/DEPLOYMENT.md) for details on how to generate these variables.

### 3. Run Frontend Locally
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the application.

---

## 7. CI/CD & Deployment

### 7.1 Automated CI & Testing (Pull Requests & Pushes)
We configure automated CI/CD workflows on GitHub Actions (`.github/workflows/pr-checks.yml`):
* **Rust Smart Contract Unit Tests**: Executes `cargo test` on all Soroban smart contracts.
* **Frontend Component & Integration Tests**: Executes `npm run test` using Vitest across UI components and user flow routines.
* **Linting & Type Safety**: Runs `npm run lint` and TypeScript compilation checks.

### 7.2 Automated Deploy (merge to main)
* **Deploy to Vercel** (`deploy.yml`): Automatically builds and deploys the Next.js frontend to production on Vercel upon a merge to `main`.

### 7.3 Contract Deployment (Manual — One-Time or After WASM Change)
Contracts are deployed and initialized on the Stellar Testnet in one step using the pure-bash deployment script:
```bash
./scripts/deploy.sh testnet rentsafe-deployer-live rentsafe-admin-live
```
For a detailed step-by-step walkthrough, see **[DEPLOYMENT.md](file:///Users/bahnishikhasingha/Documents/RentSafe/DEPLOYMENT.md)**.

---

## 8. Security Considerations

* **Role-Based Access Control (RBAC)**: Critical operations (such as resolving disputes or upgrading contract bytecode) require explicit authorization. The addresses are validated against storage-backed role values rather than static configurations.
* **Upgrade Authority**: Upgrades of contract code can only be authorized by an address possessing the `admin` role.
* **Negotiated settlement safeguards**: Only the landlord or tenant can participate in negotiation. Proposals must split exactly the locked deposit, and creating, rejecting, or countering a proposal cannot release funds.
* **External evidence references**: Google Drive is an optional user-managed workflow. RentSafe does not authenticate to Google, call the Drive API, upload files, or store evidence files.
* **Known Limitations**:
  * This is a testnet demo application. Real financial assets should not be stored.
  * Local storage is utilized to persist session configurations; users should clear local storage when using public terminals.

---

## 9. Screenshots

### 9.1 Desktop View

<table border="0">
  <tr>
    <td width="50%" align="center">
      <p><b>Landing Page</b></p>
      <img src="screenshots/RentSafe_Screenshots/desktop_landing.png" alt="Landing Page" />
    </td>
    <td width="50%" align="center">
      <p><b>Dashboard Overview</b></p>
      <img src="screenshots/RentSafe_Screenshots/desktop_dashboard.png" alt="Dashboard Overview" />
    </td>
  </tr>
  <tr>
    <td width="50%" align="center">
      <p><b>Create Agreement (Step 1)</b></p>
      <img src="screenshots/RentSafe_Screenshots/desktop_create_step_1.png" alt="Create Agreement Step 1" />
    </td>
    <td width="50%" align="center">
      <p><b>Create Agreement (Step 2)</b></p>
      <img src="screenshots/RentSafe_Screenshots/desktop_create_step_2.png" alt="Create Agreement Step 2" />
    </td>
  </tr>
  <tr>
    <td width="50%" align="center">
      <p><b>Create Agreement (Step 3)</b></p>
      <img src="screenshots/RentSafe_Screenshots/desktop_create_step_3.png" alt="Create Agreement Step 3" />
    </td>
    <td width="50%" align="center">
      <p><b>Inspect Escrow &amp; Agreement</b></p>
      <img src="screenshots/RentSafe_Screenshots/desktop_inspect.png" alt="Inspect Agreement" />
    </td>
  </tr>
  <tr>
    <td width="50%" align="center">
      <p><b>Analytics &amp; Metrics</b></p>
      <img src="screenshots/RentSafe_Screenshots/desktop_analytics.png" alt="Analytics View" />
    </td>
    <td width="50%" align="center">
      <p><b>On-Chain Activity Feed</b></p>
      <img src="screenshots/RentSafe_Screenshots/desktop_activity.png" alt="Activity Feed" />
    </td>
  </tr>
  <tr>
    <td width="50%" align="center">
      <p><b>Settings &amp; Configuration</b></p>
      <img src="screenshots/RentSafe_Screenshots/desktop_settings.png" alt="Settings View" />
    </td>
    <td width="50%" align="center">
      <p><b>Transaction Center</b></p>
      <img src="screenshots/RentSafe_Screenshots/desktop_transaction.png" alt="Transaction Center" />
    </td>
  </tr>
</table>

### 9.2 Mobile View

<table border="0">
  <tr>
    <td width="50%" align="center">
      <p><b>Mobile Landing Page</b></p>
      <img src="screenshots/RentSafe_Screenshots/mobile_landing.png" alt="Mobile Landing Page" />
    </td>
    <td width="50%" align="center">
      <p><b>Mobile Dashboard</b></p>
      <img src="screenshots/RentSafe_Screenshots/mobile_dashboard.png" alt="Mobile Dashboard" />
    </td>
  </tr>
  <tr>
    <td width="50%" align="center">
      <p><b>Create Agreement (Step 1)</b></p>
      <img src="screenshots/RentSafe_Screenshots/mobile_create_step_1.png" alt="Mobile Create Step 1" />
    </td>
    <td width="50%" align="center">
      <p><b>Create Agreement (Step 2)</b></p>
      <img src="screenshots/RentSafe_Screenshots/mobile_create_step_2.png" alt="Mobile Create Step 2" />
    </td>
  </tr>
  <tr>
    <td width="50%" align="center">
      <p><b>Create Agreement (Step 3)</b></p>
      <img src="screenshots/RentSafe_Screenshots/mobile_create_step_3.png" alt="Mobile Create Step 3" />
    </td>
    <td width="50%" align="center">
      <p><b>Inspect Escrow &amp; Agreement</b></p>
      <img src="screenshots/RentSafe_Screenshots/mobile_inpect.png" alt="Mobile Inspect Agreement" />
    </td>
  </tr>
  <tr>
    <td width="50%" align="center">
      <p><b>Mobile Analytics</b></p>
      <img src="screenshots/RentSafe_Screenshots/mobile_analytics.png" alt="Mobile Analytics" />
    </td>
    <td width="50%" align="center">
      <p><b>Mobile Activity Feed</b></p>
      <img src="screenshots/RentSafe_Screenshots/mobile_activity.png" alt="Mobile Activity Feed" />
    </td>
  </tr>
  <tr>
    <td width="50%" align="center">
      <p><b>Mobile Settings</b></p>
      <img src="screenshots/RentSafe_Screenshots/mobile_settings.png" alt="Mobile Settings" />
    </td>
    <td width="50%" align="center">
      <p><b>Mobile Navigation Menu</b></p>
      <img src="screenshots/RentSafe_Screenshots/mobile_more_menu.png" alt="Mobile Navigation Menu" />
    </td>
  </tr>
</table>

### 9.3 CI/CD Workflow

<table border="0">
  <tr>
    <td width="100%" align="center">
      <p><b>GitHub Actions Workflow</b></p>
      <img src="screenshots/RentSafe_Screenshots/ci-cd.png" alt="GitHub Actions CI/CD Pipeline" />
    </td>
  </tr>
</table>

### 9.4 Automated Testing

<table border="0">
  <tr>
    <td width="50%" align="center">
      <p><b>Soroban Contract Tests (Cargo)</b></p>
      <img src="screenshots/RentSafe_Screenshots/cargo-test.png" alt="Cargo Contract Tests" />
    </td>
    <td width="50%" align="center">
      <p><b>Frontend Unit &amp; Integration Tests (Vitest)</b></p>
      <img src="screenshots/RentSafe_Screenshots/vitest-test.png" alt="Vitest Frontend Tests" />
    </td>
  </tr>
</table>

### 9.5 Active Usage Proof

The following captures show the RentSafe Activity Feed populated with on-chain agreement activity from the Stellar Testnet. Each activity card exposes the agreement participants, ledger number, transaction reference, and a copy control for transaction details.

<table border="0">
  <tr>
    <td width="50%" align="center">
      <p><b>Activity Feed Capture 1</b></p>
      <img src="screenshots/RentSafe_Screenshots/activity-feed-1.png" alt="Active usage proof showing the RentSafe activity feed, capture 1" />
    </td>
    <td width="50%" align="center">
      <p><b>Activity Feed Capture 2</b></p>
      <img src="screenshots/RentSafe_Screenshots/activity-feed-2.png" alt="Active usage proof showing the RentSafe activity feed, capture 2" />
    </td>
  </tr>
  <tr>
    <td width="50%" align="center">
      <p><b>Activity Feed Capture 3</b></p>
      <img src="screenshots/RentSafe_Screenshots/activity-feed-3.png" alt="Active usage proof showing the RentSafe activity feed, capture 3" />
    </td>
    <td width="50%" align="center">
      <p><b>Activity Feed Capture 4</b></p>
      <img src="screenshots/RentSafe_Screenshots/activity-feed-4.png" alt="Active usage proof showing the RentSafe activity feed, capture 4" />
    </td>
  </tr>
  <tr>
    <td width="50%" align="center">
      <p><b>Activity Feed Capture 5</b></p>
      <img src="screenshots/RentSafe_Screenshots/activity-feed-5.png" alt="Active usage proof showing the RentSafe activity feed, capture 5" />
    </td>
    <td width="50%" align="center">
      <p><b>Activity Feed Capture 6</b></p>
      <img src="screenshots/RentSafe_Screenshots/activity-feed-6.png" alt="Active usage proof showing the RentSafe activity feed, capture 6" />
    </td>
  </tr>
  <tr>
    <td width="50%" align="center">
      <p><b>Activity Feed Capture 7</b></p>
      <img src="screenshots/RentSafe_Screenshots/activity-feed-7.png" alt="Active usage proof showing the RentSafe activity feed, capture 7" />
    </td>
    <td width="50%" align="center">
      <p><b>Activity Feed Capture 8</b></p>
      <img src="screenshots/RentSafe_Screenshots/activity-feed-8.png" alt="Active usage proof showing the RentSafe activity feed, capture 8" />
    </td>
  </tr>
  <tr>
    <td width="50%" align="center">
      <p><b>Activity Feed Capture 9</b></p>
      <img src="screenshots/RentSafe_Screenshots/activity-feed-9.png" alt="Active usage proof showing the RentSafe activity feed, capture 9" />
    </td>
    <td width="50%" align="center">
      <p><b>Activity Feed Capture 10</b></p>
      <img src="screenshots/RentSafe_Screenshots/activity-feed-10.png" alt="Active usage proof showing the RentSafe activity feed, capture 10" />
    </td>
  </tr>
</table>

---

## 10. Contract Addresses & On-Chain Verification

### Deployed Contracts (Stellar Testnet)

| Contract | Address | Explorer |
|---|---|---|
| **RentSafe Escrow** | `CAUQOF5U6PUWNBZYWUAWBMYXQNPBXUQQWH3EHO6GQMUFKKNFQBWKXEUD` | [StellarExpert ↗](https://stellar.expert/explorer/testnet/contract/CAUQOF5U6PUWNBZYWUAWBMYXQNPBXUQQWH3EHO6GQMUFKKNFQBWKXEUD) |
| **RentSafe Dispute** | `CARBWEU5IF6Q4DJQHNJJOLFG57WXPWIIU5KUPMN2VRADO6GUSRAGKG3W` | [StellarExpert ↗](https://stellar.expert/explorer/testnet/contract/CARBWEU5IF6Q4DJQHNJJOLFG57WXPWIIU5KUPMN2VRADO6GUSRAGKG3W) |
| **Native XLM SAC** | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` | [StellarExpert ↗](https://stellar.expert/explorer/testnet/contract/CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC) |

#### RentSafe Escrow

| Action | Transaction Hash | Explorer |
|---|---|---|
| WASM Upload | `6ffc390e0db860159f5ddb71d968c3fe9f96c44f6cc38713567562f4ca73b97f` | [View ↗](https://stellar.expert/explorer/testnet/tx/6ffc390e0db860159f5ddb71d968c3fe9f96c44f6cc38713567562f4ca73b97f) |
| Contract Instantiate | `6ffc390e0db860159f5ddb71d968c3fe9f96c44f6cc38713567562f4ca73b97f` | [View ↗](https://stellar.expert/explorer/testnet/tx/6ffc390e0db860159f5ddb71d968c3fe9f96c44f6cc38713567562f4ca73b97f) |
| `initialize()` | `6ffc390e0db860159f5ddb71d968c3fe9f96c44f6cc38713567562f4ca73b97f` | [View ↗](https://stellar.expert/explorer/testnet/tx/6ffc390e0db860159f5ddb71d968c3fe9f96c44f6cc38713567562f4ca73b97f) |
| WASM Upload (deposit validation compatibility) | `50af26f48fc33e5fd5e55423e9ea25d25b843bb0cb291607530c01714ebb7b79` | [View ↗](https://stellar.expert/explorer/testnet/tx/50af26f48fc33e5fd5e55423e9ea25d25b843bb0cb291607530c01714ebb7b79) |
| WASM Upgrade (deposit validation compatibility) | `7eb3d301cdee057f21bcc6a9e4b831601efe9714edb2a23f8fec270d2e33247b` | [View ↗](https://stellar.expert/explorer/testnet/tx/7eb3d301cdee057f21bcc6a9e4b831601efe9714edb2a23f8fec270d2e33247b) |

#### RentSafe Dispute

| Action | Transaction Hash | Explorer |
|---|---|---|
| WASM Upload | `04664e169f848bc20e4dfc9e42cad0db73838ef0437cb3d9203fec2d4417f127` | [View ↗](https://stellar.expert/explorer/testnet/tx/04664e169f848bc20e4dfc9e42cad0db73838ef0437cb3d9203fec2d4417f127) |
| Contract Instantiate | `04664e169f848bc20e4dfc9e42cad0db73838ef0437cb3d9203fec2d4417f127` | [View ↗](https://stellar.expert/explorer/testnet/tx/04664e169f848bc20e4dfc9e42cad0db73838ef0437cb3d9203fec2d4417f127) |
| `initialize()` | `04664e169f848bc20e4dfc9e42cad0db73838ef0437cb3d9203fec2d4417f127` | [View ↗](https://stellar.expert/explorer/testnet/tx/04664e169f848bc20e4dfc9e42cad0db73838ef0437cb3d9203fec2d4417f127) |
| WASM Upload (mutual settlement) | `f3182eef472c33049fa7d925772da47f9976de5e2325d9ca9ff53bb321246e58` | [View ↗](https://stellar.expert/explorer/testnet/tx/f3182eef472c33049fa7d925772da47f9976de5e2325d9ca9ff53bb321246e58) |
| WASM Upgrade | `a7a63795dccdea7d4336dae3def5d111d868fdb26eb92e2f5d5fd8658af01117` | [View ↗](https://stellar.expert/explorer/testnet/tx/a7a63795dccdea7d4336dae3def5d111d868fdb26eb92e2f5d5fd8658af01117) |
| WASM Upload (negotiated settlement) | `81139993ec27149a5233fc9711b3194e0e1a028ff3a78fb00892bce9db9a6011` | [View ↗](https://stellar.expert/explorer/testnet/tx/81139993ec27149a5233fc9711b3194e0e1a028ff3a78fb00892bce9db9a6011) |
| WASM Upgrade (negotiated settlement) | `598ea7f6a79607eb0e7fbcc1868de23cc10ed81bb2caada8653c8e38688e1645` | [View ↗](https://stellar.expert/explorer/testnet/tx/598ea7f6a79607eb0e7fbcc1868de23cc10ed81bb2caada8653c8e38688e1645) |

### WASM Hashes

| Contract | WASM Hash |
|---|---|
| RentSafe Escrow | `68432e5b5a235cbfe0efb2165e059b290cf4f19067e72def8eb9d9447764ab5f` |
| RentSafe Dispute | `3ad562a9c361c694c9e9aa26eb555cde7f53b2821c553b790d7c07d818a7d595` |

---

## 11. Feedback & Responses

We appreciate your feedback and suggestions! Please use the following links to interact with our feedback portal:

* 📝 Submit Feedback (Google Form): [Feedback Form ↗](https://forms.gle/9kgwCvEcJr4hvvYd7)
* 📊 View Responses (Google Sheet): [Feedback Responses Sheet ↗](https://docs.google.com/spreadsheets/d/1PlGtF8OtwOwdY3nCmEYgWXrRbYSZYEyaFGaA2K1ocdE/edit?usp=sharing)

---

## 12. Next Phase Improvements Based on User Feedback

The feedback portal contains 16 user responses with an average product rating of **4.88/5**. The table below records the actionable feedback and how it has shaped RentSafe’s current improvements and next phase. Personal email addresses and wallet addresses are masked or omitted for privacy.

### 12.1 Feedback-Driven Improvements

| User & Feedback | Category | Status & Action Taken | Related Commit(s) |
|---|---|---|---|
| **Sandipan Singh** (`personal@...`)<br>“Implement dark mode - light mode theme switch.” | Theme & Accessibility | ✅ **Implemented:** Added persistent light/dark theme preferences, accessible theme treatment, dark-palette balancing, and scrollbar styling. | [69bb39d](https://github.com/aniCtrl/RentSafe/commit/69bb39dca3fd92a9553a4007544060617801715b) · [6ece89b](https://github.com/aniCtrl/RentSafe/commit/6ece89b44dd6559e9dd64268688bbb20e786f451) · [2073a9a](https://github.com/aniCtrl/RentSafe/commit/2073a9a286785f729e7a0e1f690c580450d876a9) |
| **Uma Singh** (`umasingh9732@...`)<br>“Adding a step-by-step dispute process would help users better understand what’s happening at each stage.” | Dispute Transparency | ✅ **Implemented:** Added a guided dispute lifecycle timeline and clearer participant-driven settlement guidance. | [83974f2](https://github.com/aniCtrl/RentSafe/commit/83974f2163aa5881d1ed1d53e2bdf434fcf2ba87) · [53e3dc2](https://github.com/aniCtrl/RentSafe/commit/53e3dc223b2039da317534a68a719446b6f42a86) · [0603f72](https://github.com/aniCtrl/RentSafe/commit/0603f7214387a2b16e8caa30b8e192fc6d4302cc) |
| **Monoj Singh** (`monojsingh9732@...`)<br>“Adding an in-app notifications for important actions would improve the user experience.” | Notifications & Activity | ✅ **Implemented:** Centralized wallet-scoped lifecycle alerts and added the activity feed so agreement and transaction events are easier to follow. | [0462be6](https://github.com/aniCtrl/RentSafe/commit/0462be645b8648e42a9ef8bac4664ded9be83853) · [bdbc87b](https://github.com/aniCtrl/RentSafe/commit/bdbc87b790eaaa38769abb950353b4f69332be51) |
| **Jatin Kumar Lahori** (`tourtravelsmotherindia@...`)<br>“The UI is clean, minimal, and easy to use. I think there’s still some room to improve the overall UI/UX.” | UI/UX Refinement | 🔄 **In progress:** Continued improving responsive layouts, inspection screens, analytics, transaction surfaces, and accessible interaction states. | [7ac96b9](https://github.com/aniCtrl/RentSafe/commit/7ac96b9e70420232eba5196243e65de338682339) · [8e9b939](https://github.com/aniCtrl/RentSafe/commit/8e9b939aa58a313d99bec2dd2008b2bc43f7037f) · [20106d5](https://github.com/aniCtrl/RentSafe/commit/20106d56c990020e4d49aff600a5e23038fe1d98) |
| **Ashu** (`atulashu38@...`)<br>“Adding a few subtle animations and smoother transitions would make the app feel even more polished.” | UI/UX Polish | 📋 **Planned:** Add lightweight transitions for page changes, cards, notifications, and transaction states while respecting `prefers-reduced-motion`. | Baseline: [accessible UI foundation](https://github.com/aniCtrl/RentSafe/commit/69bb39dca3fd92a9553a4007544060617801715b) · implementation commit to be added when shipped |
| **Rohit Ghosh** (`ghoshrohit669@...`)<br>“Good UI and app flow, keep it up scale it.” | Product Growth & Reliability | 📋 **Planned:** Use feedback trends and on-chain usage data to prioritize onboarding clarity, activity pagination, notification relevance, mobile polish, and regression coverage as adoption grows. | Foundation: [real-time on-chain analytics](https://github.com/aniCtrl/RentSafe/commit/36fd55db5515d7e036c05e9612f4492bda4e3568) · [retry and testing infrastructure](https://github.com/aniCtrl/RentSafe/commit/59cc8e32aed8b258c3199d255f81812d21c1ac74) |
| **Shakshi Kotwala, Divya Prasad, Swastika Shaw, Sk Jishan Uddin, Rimanshu Pratap Singh, Amitabh Dey, Rishi Dey, Pritam Dey, Pritu Pop & Sujan Mandal**<br>“Smooth experience,” “UI is intuitive,” “The platform is easy to use,” and “Great experience with RentSafe!” | General UX Validation | ⭐ **Positive validation:** The 4–5 star reviews confirm that the core agreement, wallet, dispute, and activity workflows are understandable. The next phase will preserve this simplicity while expanding capability carefully. | [bdbc87b](https://github.com/aniCtrl/RentSafe/commit/bdbc87b790eaaa38769abb950353b4f69332be51) · [7ac96b9](https://github.com/aniCtrl/RentSafe/commit/7ac96b9e70420232eba5196243e65de338682339) |

### 12.2 Next Phase Evolution Roadmap

Based on the collected feedback, the next phase of RentSafe will focus on:

- **Smoother motion and interaction polish:** Add subtle page, card, notification, and transaction transitions with reduced-motion support and mobile performance checks.
- **Clearer onboarding:** Make wallet connection, agreement creation, role context, and first-time actions easier to understand without adding unnecessary steps.
- **More transparent dispute resolution:** Continue improving timeline states, evidence visibility, settlement proposal history, and next-action guidance for both participants.
- **Scalable activity and notifications:** Add filtering or pagination for high-volume activity feeds and keep alerts relevant to the connected wallet and agreement lifecycle.
- **Analytics-led iteration:** Use on-chain usage data and future feedback exports to prioritize improvements, monitor adoption, and expand regression tests before shipping new workflows.

The positive reviews consistently describe RentSafe as clean, intuitive, smooth, and easy to use. The roadmap preserves those strengths while turning the recurring improvement requests into traceable engineering work.

---

## 13. Resources & Links

| Resource | Link |
|---|---|
| 🌐 Live demo (Stellar Testnet interface) | [https://rentsafe-nxx.vercel.app ↗](https://rentsafe-nxx.vercel.app/) |
| 🎥 Demo video | [Demo Video ↗](https://youtu.be/bns8_eZlySA) |
| 📊 Project presentation | [RentSafe presentation ↗](https://docs.google.com/presentation/d/1mdldsK3rnfybWS1wU4gfg-9FZPGlkGhm/edit?usp=sharing&ouid=102605250448316194106&rtpof=true&sd=true) |
| 📄 Project PDF | [RentSafe PDF ↗](https://drive.google.com/file/d/1PF3TvVq4ISnfx8TrPudd2O06vRVw57gI/view?usp=sharing) |
| 🧪 Testnet faucet | [Stellar Laboratory Friendbot](https://laboratory.stellar.org/#account-creator?network=testnet) |
| 📖 Stellar docs | [developers.stellar.org](https://developers.stellar.org) |
| 🔍 Contract explorer | [StellarExpert Testnet](https://stellar.expert/explorer/testnet) |

---

## Contributing

Fork the repo and create a feature branch.
Follow the Conventional Commits specification for all commit messages.
Run `cargo fmt`, `cargo clippy`, and `npm run lint` before pushing.
Open a PR — the `pr-checks` workflow must pass before review.

---

## License

Distributed under the MIT License. See `LICENSE` for more information.
