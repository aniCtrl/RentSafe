#!/usr/bin/env python3
import json
import os
import subprocess
import sys

def run_cmd(args):
    print(f"Running: {' '.join(args)}")
    result = subprocess.run(args, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"Error: {result.stderr}")
        sys.exit(result.returncode)
    print(result.stdout)
    return result.stdout.strip()

def main():
    network = "testnet"
    if len(sys.argv) > 1:
        network = sys.argv[1]

    metadata_path = f"deployments/{network}.json"
    if not os.path.exists(metadata_path):
        print(f"Error: Metadata file {metadata_path} not found. Run deploy script first.")
        sys.exit(1)

    with open(metadata_path, "r") as f:
        meta = json.load(f)

    escrow_id = meta["escrow"]["address"]
    dispute_id = meta["dispute"]["address"]

    # Gather role addresses
    landlord = os.getenv("RENTSAFE_LANDLORD_ADDR") or meta.get("roles", {}).get("landlord")
    tenant = os.getenv("RENTSAFE_TENANT_ADDR") or meta.get("roles", {}).get("tenant")
    arbitrator = os.getenv("RENTSAFE_ARBITRATOR_ADDR") or meta.get("roles", {}).get("arbitrator")
    token = os.getenv("RENTSAFE_TOKEN_ADDR") or "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC" # Native XLM SAC on testnet
    amount = os.getenv("RENTSAFE_AMOUNT") or "100000000" # 10 XLM

    if not landlord or not tenant or not arbitrator:
        print("Error: Landlord, Tenant, and Arbitrator addresses must be specified.")
        print("Please set RENTSAFE_LANDLORD_ADDR, RENTSAFE_TENANT_ADDR, and RENTSAFE_ARBITRATOR_ADDR.")
        sys.exit(1)

    print("--------------------------------------------------")
    print(f"Initializing RentSafe Contracts on {network}")
    print(f"Escrow:     {escrow_id}")
    print(f"Dispute:    {dispute_id}")
    print(f"Landlord:   {landlord}")
    print(f"Tenant:     {tenant}")
    print(f"Arbitrator: {arbitrator}")
    print(f"Token:      {token}")
    print(f"Amount:     {amount}")
    print("--------------------------------------------------")

    # 1. Initialize Escrow
    print("Invoking Escrow initialize()...")
    init_escrow_tx = run_cmd([
        "stellar", "contract", "invoke",
        "--id", escrow_id,
        "--source-account", "RENTSAFE_TESTNET",
        "--network", network,
        "--", "initialize",
        "--landlord", landlord,
        "--tenant", tenant,
        "--arbitrator", arbitrator,
        "--token", token,
        "--amount", amount
    ])

    # 2. Initialize Dispute
    print("Invoking Dispute initialize()...")
    init_dispute_tx = run_cmd([
        "stellar", "contract", "invoke",
        "--id", dispute_id,
        "--source-account", "RENTSAFE_TESTNET",
        "--network", network,
        "--", "initialize",
        "--escrow_contract", escrow_id,
        "--arbitrator", arbitrator
    ])

    # 3. Link Dispute in Escrow
    print("Invoking Escrow set_dispute_contract()...")
    link_tx = run_cmd([
        "stellar", "contract", "invoke",
        "--id", escrow_id,
        "--source-account", "RENTSAFE_ARBITRATOR",
        "--network", network,
        "--", "set_dispute_contract",
        "--dispute_contract", dispute_id
    ])

    # Save transaction details back to deployments file
    meta["roles"] = {
        "deployer": "GBSJ6OLI3XRFWDWJJBW6C3H2EXKMFQQVFEKYNV6DHHGM5FHYJ3M7MM5Y",
        "landlord": landlord,
        "tenant": tenant,
        "arbitrator": arbitrator
    }
    meta["interactions"] = {
        "init_escrow_tx": init_escrow_tx,
        "init_dispute_tx": init_dispute_tx,
        "link_tx": link_tx
    }

    with open(metadata_path, "w") as f:
        json.dump(meta, f, indent=2)

    # 4. Update files programmatically
    print("Updating configuration files & README...")
    update_file_placeholders(".env", escrow_id, dispute_id, network)
    update_file_placeholders(".env.example", escrow_id, dispute_id, network)
    update_readme_placeholders("README.md", escrow_id, dispute_id, network)

    print("Initialization completed successfully!")

def update_file_placeholders(filepath, escrow_id, dispute_id, network):
    if not os.path.exists(filepath):
        # Generate default .env from .env.example template if it does not exist
        if filepath == ".env":
            content = f"NEXT_PUBLIC_ESCROW_CONTRACT_ID={escrow_id}\nNEXT_PUBLIC_DISPUTE_CONTRACT_ID={dispute_id}\nSTELLAR_NETWORK={network}\n"
            with open(filepath, "w") as f:
                f.write(content)
            return
        return

    with open(filepath, "r") as f:
        content = f.read()

    content = content.replace("{{ESCROW_CONTRACT_ID}}", escrow_id)
    content = content.replace("{{DISPUTE_CONTRACT_ID}}", dispute_id)
    
    # Also support replacing existing values if run repeatedly
    import re
    content = re.sub(r"NEXT_PUBLIC_ESCROW_CONTRACT_ID=.*", f"NEXT_PUBLIC_ESCROW_CONTRACT_ID={escrow_id}", content)
    content = re.sub(r"NEXT_PUBLIC_DISPUTE_CONTRACT_ID=.*", f"NEXT_PUBLIC_DISPUTE_CONTRACT_ID={dispute_id}", content)

    with open(filepath, "w") as f:
        f.write(content)

def update_readme_placeholders(filepath, escrow_id, dispute_id, network):
    if not os.path.exists(filepath):
        return

    with open(filepath, "r") as f:
        content = f.read()

    # Replaces placeholders in Markdown table or links
    content = content.replace("{{ESCROW_CONTRACT_ID}}", escrow_id)
    content = content.replace("{{DISPUTE_CONTRACT_ID}}", dispute_id)

    with open(filepath, "w") as f:
        f.write(content)

if __name__ == "__main__":
    main()
