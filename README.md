# RentSafe — Decentralized Rental Deposit Escrow Platform

RentSafe is a decentralized rental deposit escrow platform built on Stellar using Soroban smart contracts. It enables tenants and landlords to lock, manage, and mutually settle rental deposits trustlessly, with arbitrator-backed dispute resolution.

---

## 1. Project Structure

```
.
├── Cargo.toml
├── Cargo.lock
├── .gitignore
├── README.md
├── .env.example
├── .env                  # Generated during setup
├── .github/
│   └── workflows/
│       └── ci.yml        # CI/CD Contracts Pipeline
├── contracts/
│   ├── escrow/           # Escrow contract source and unit/integration tests
│   └── dispute/          # Dispute contract source
├── deployments/
│   └── testnet.json      # Live deployment details (addresses, hashes)
├── docs/
│   ├── ARCHITECTURE.md       # Platform system architecture & Mermaid diagrams
│   ├── CONTRACTS.md          # Storage layout, methods, and event schema
│   ├── INTER_CONTRACT_FLOW.md # Sequence diagram of cross-contract calls
│   └── SECURITY.md           # Security audits, vulnerabilities, and upgrade strategy
└── scripts/
    ├── deploy.sh         # Compiles and deploys WASM files
    ├── initialize.py     # Invokes initialization and links contracts programmatically
    ├── initialize.sh     # Wrapper for initialization python script
    └── upgrade.sh        # Automates WASM updates on-chain
```

---

## 2. Smart Contract Lifecycle

The Escrow contract goes through a strict state machine:
`Created` → `Funded` → `Active` → `SettlementRequested` → `Disputed` → `Resolved` → `Closed`

The Dispute contract follows a linear lifecycle:
`Created` → `Active` → `Resolved`

---

## 3. Live Testnet Deployments

The smart contracts are deployed and initialized on the **Stellar Testnet**:

### Contract Addresses & Explorer Links

| Contract | Address / ID | Explorer Link |
|---|---|---|
| **Escrow Contract** | `CBPI35R5GHDJOVGE6CET2FKDJ2I77KCKOXWQ62NHGQN4YCV3MS7OS2Q7` | [Stellar Expert — Escrow](https://stellar.expert/explorer/testnet/contract/CBPI35R5GHDJOVGE6CET2FKDJ2I77KCKOXWQ62NHGQN4YCV3MS7OS2Q7) |
| **Dispute Contract** | `CCTC5ZQPSXD6DVXNRTJBTJC32PTPAGAWQEBPVKJHQAI5UZVS54TF4BSX` | [Stellar Expert — Dispute](https://stellar.expert/explorer/testnet/contract/CCTC5ZQPSXD6DVXNRTJBTJC32PTPAGAWQEBPVKJHQAI5UZVS54TF4BSX) |

### Transaction Hashes

| Action | Transaction Hash | Explorer Link |
|---|---|---|
| **Deploy Escrow** | `efdf43f5741afb8ab6c7a76da41faf707c39d184173dfb9581e9bbd924489250` | [Explorer Link](https://stellar.expert/explorer/testnet/tx/efdf43f5741afb8ab6c7a76da41faf707c39d184173dfb9581e9bbd924489250) |
| **Deploy Dispute** | `c7365508444432d169a2f7baec854e8f3f6863f730f5d0863bc15689cf9a16e2` | [Explorer Link](https://stellar.expert/explorer/testnet/tx/c7365508444432d169a2f7baec854e8f3f6863f730f5d0863bc15689cf9a16e2) |
| **Init Escrow** | `74721826b6222e6e09ffc1cd8189afbbf6c49fd7f5d23a96c941d7c5553cba03` | [Explorer Link](https://stellar.expert/explorer/testnet/tx/74721826b6222e6e09ffc1cd8189afbbf6c49fd7f5d23a96c941d7c5553cba03) |
| **Init Dispute** | `568ec59b9945d1589d614f948b9dc5dccae61584591b9c7f883022a507925f07` | [Explorer Link](https://stellar.expert/explorer/testnet/tx/568ec59b9945d1589d614f948b9dc5dccae61584591b9c7f883022a507925f07) |
| **Link Contracts** | `3163575b3f37f8d33aaf9c493d473b7e2d4722937568e4d0c4df24c80435b88a` | [Explorer Link](https://stellar.expert/explorer/testnet/tx/3163575b3f37f8d33aaf9c493d473b7e2d4722937568e4d0c4df24c80435b88a) |
| **Tenant Fund (10 XLM)** | `ab5ff9f31d371d840043eb85988efc9615c0c33c9f44beb04a39c5e6e6e16a89` | [Explorer Link](https://stellar.expert/explorer/testnet/tx/ab5ff9f31d371d840043eb85988efc9615c0c33c9f44beb04a39c5e6e6e16a89) |
| **Landlord Activate** | `771ea2b6188f5ecd86952a0b7f73aa2963881c7bb15a03084a84c79669a9589c` | [Explorer Link](https://stellar.expert/explorer/testnet/tx/771ea2b6188f5ecd86952a0b7f73aa2963881c7bb15a03084a84c79669a9589c) |
| **Raise Dispute (Tenant)** | `f7ebc16f1751be9a926521370cec6b904120d61c432a92754f4e1543faf01680` | [Explorer Link](https://stellar.expert/explorer/testnet/tx/f7ebc16f1751be9a926521370cec6b904120d61c432a92754f4e1543faf01680) |
| **Resolve & Payout (3:7 split)** | `bb8d01ca7f814db578adf182831d4b72d4ce006aa8c3330bad21b5e4b1f40469` | [Explorer Link](https://stellar.expert/explorer/testnet/tx/bb8d01ca7f814db578adf182831d4b72d4ce006aa8c3330bad21b5e4b1f40469) |

---

## 4. How to Reproduce

### Dependencies
Ensure you have the Rust toolchain and Stellar CLI installed:
*   Rust: `rustc 1.97.0` (with `wasm32-unknown-unknown` target)
*   Stellar CLI: `stellar 27.0.0`

### Build
To compile the smart contracts:
```bash
stellar contract build
```

### Test
To run the automated contract unit and integration tests:
```bash
cargo test
```

### Local Deploy & Initialize
To run a local deploy and initialization against a standalone quickstart network:
1. Start your local Quickstart container.
2. Deploy the WASM binaries:
   ```bash
   ./scripts/deploy.sh local RENTSAFE_LOCAL
   ```
3. Initialize the contracts:
   ```bash
   # Export role addresses
   export RENTSAFE_LANDLORD_ADDR="GD..."
   export RENTSAFE_TENANT_ADDR="GD..."
   export RENTSAFE_ARBITRATOR_ADDR="GD..."
   
   ./scripts/initialize.sh local
   ```
