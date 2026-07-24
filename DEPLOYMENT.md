# RentSafe Smart Contract Deployment Guide

This guide details the step-by-step process for building, deploying, initializing, and upgrading the RentSafe smart contracts on the Stellar Testnet.

---

## 1. Prerequisites

Before starting, ensure you have the following installed and configured:

### 1.1. Install Stellar CLI
The Stellar CLI is required to interact with the Stellar network. Install it using Cargo (Rust's package manager):

```bash
cargo install --locked stellar-cli
```

> [!NOTE]
> **Important version note:** Older guides recommended using `--features opt` to enable contract optimization. From version 22+ (including the current `v27.0.0`), the CLI features have been reorganized. The optimization library dependencies (`wasm-opt`) are now grouped under the `additional-libs` feature, which is enabled **by default**. 
>
> If you encounter compilation issues with system dependencies (e.g., `libdbus` or `libudev`), you can install the CLI with:
> ```bash
> cargo install --locked stellar-cli --no-default-features
> ```

Verify the installation:
```bash
stellar --version
```

### 1.2. Set Up a Deployer Account
Generate a new developer identity/alias (e.g., `rentsafe-deployer`) on the Stellar Testnet:
```bash
stellar keys generate rentsafe-deployer --network testnet
```

### 1.3. Fund the Deployer Account
Fund your newly generated address using Friendbot:
```bash
stellar keys fund rentsafe-deployer --network testnet
```
You can verify the account public key and balance:
```bash
stellar keys public-key rentsafe-deployer
```

---

## 2. Step-by-Step Testnet Deployment

We use the repository's custom scripts inside the `scripts/` directory to build, deploy, and generate contract metadata.

### 2.1. Run the Deployment Script
Run the `deploy.sh` script to build the contracts and deploy them to the Stellar Testnet using the `rentsafe-deployer` identity:
```bash
./scripts/deploy.sh testnet rentsafe-deployer
```

#### What This Script Does:
1. Compiles both `rentsafe_escrow` and `rentsafe_dispute` contracts into WebAssembly (WASM).
2. Deploys the bytecode to the Stellar Testnet.
3. Automatically computes SHA-256 hashes for both compiled WASM binaries.
4. Records the contract addresses and WASM hashes to `deployments/testnet.json`.

---

## 3. Initializing and Wiring Inter-Contract Dependency

The Escrow and Dispute contracts refer to each other. They must be initialized in two phases. We automate this configuration using `initialize.sh` (which wraps `initialize.py`).

### 3.1. Generate the Platform Admin Wallet
Before initializing, you must define who owns the platform. Generate a dedicated platform admin wallet:
```bash
./scripts/generate-platform-wallet.sh rentsafe-admin
```
This script:
1. Generates and funds the `rentsafe-admin` identity.
2. Extracts the public key and secret keys.
3. Stores `RENTSAFE_PLATFORM_ADDRESS` and `RENTSAFE_PLATFORM_SECRET_KEY` in your local `.env`.

### 3.2. Run the Initialization Script
With the deployment metadata created in step 2 and the platform address created in step 3.1, run:
```bash
./scripts/initialize.sh testnet rentsafe-deployer
```

#### What This Script Does:
1. Invokes the `initialize` method on the Dispute contract, passing the admin address and linking it to the Escrow contract.
2. Invokes the `initialize` method on the Escrow contract, passing the admin address, linking it to the Dispute contract, and setting the native XLM token asset contract address (`CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` for Stellar Testnet).
3. Saves the transaction hashes in `deployments/testnet.json`.
4. Programmatically updates contract ID placeholders in your local `.env`, `.env.example`, and `README.md`.

---

## 4. Capturing Contract Addresses and Transaction Hashes

Once deployment and initialization are complete, the output details are stored permanently in `deployments/testnet.json`. 

Open `deployments/testnet.json` to capture:
* **Escrow Contract Address**: Located under `"escrow"."address"`.
* **Dispute Contract Address**: Located under `"dispute"."address"`.
* **Escrow Initialization Tx Hash**: Located under `"interactions"."init_escrow_tx"`.
* **Dispute Initialization Tx Hash**: Located under `"interactions"."init_dispute_tx"`.

---

## 5. Environment Variables Configuration

To run the application, configure your local environment variables in `.env`.

### 5.1. Exactly Which Variables Need to be Set:

| Env Variable | Meaning / Description | Example Value | Where to Get Value |
| :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_ESCROW_CONTRACT_ID` | Address of the deployed Escrow Registry smart contract | `CDMI23JKHYAH46C...` | `deployments/testnet.json` |
| `NEXT_PUBLIC_DISPUTE_CONTRACT_ID` | Address of the deployed Dispute Registry smart contract | `CD7FXU24BREXPOC...` | `deployments/testnet.json` |
| `STELLAR_NETWORK` | Target Stellar network environment | `testnet` | Set to `testnet` or `public` |
| `RENTSAFE_PLATFORM_ADDRESS` | Public key of the platform admin/arbitrator entity | `GA2C5CQ45P36CQ5...` | Generated in step 3.1 |
| `RENTSAFE_PLATFORM_SECRET_KEY` | Secret key of the platform admin (kept local/gitignored) | `SCLTZBM4PFXT7SU...` | Generated in step 3.1 |

---

## 6. Template Mapping and Frontend Integration

### 6.1. Mapping to `.env.example`
The `.env.example` file serves as a reference template for developers. It defines the keys but leaves values blank (or provides default testnet RPC fallbacks). 

```ini
# Core Contract IDs (generated during deploy/init)
NEXT_PUBLIC_ESCROW_CONTRACT_ID={{ESCROW_CONTRACT_ID}}
NEXT_PUBLIC_DISPUTE_CONTRACT_ID={{DISPUTE_CONTRACT_ID}}

# Network settings
STELLAR_NETWORK=testnet

# Platform Configurations
RENTSAFE_PLATFORM_ADDRESS=
```

### 6.2. Mapping to Frontend Runtime Env
In the Next.js frontend, variables prefixed with `NEXT_PUBLIC_` are bundled into the client-side JavaScript. 
Inside the codebase, they are read dynamically:
* `process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ID` maps to the contract client in `src/lib/stellar.ts`.
* `process.env.NEXT_PUBLIC_DISPUTE_CONTRACT_ID` maps to the dispute interface in `src/lib/stellar.ts`.

> [!TIP]
> Any edits to these environment variables require a restart of the dev server:
> ```bash
> npm run dev
> ```

---

## 7. Contract Upgrades

If you modify smart contract Rust code and need to swap WASM bytecode on-chain:
```bash
./scripts/upgrade.sh testnet <CONTRACT_ID> <PATH_TO_WASM> <ADMIN_IDENTITY_ALIAS>
```

*Example:*
```bash
./scripts/upgrade.sh testnet CDMI23JK... target/wasm32v1-none/release/rentsafe_escrow.wasm rentsafe-admin
```

The script will install the new WASM binary, extract its hash, and invoke the contract's secure `upgrade` method, authorizing the swap via the storage-backed admin role.
