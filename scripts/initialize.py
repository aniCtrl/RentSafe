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

    # Gather roles
    admin = os.getenv("RENTSAFE_PLATFORM_ADDRESS") or "GBKEWLPR74ZPGJV7PGQAEMMKUQ4N35JD4SC23CCHNKYZRKIQA7NSVMKT"
    token = os.getenv("RENTSAFE_TOKEN_ADDR") or "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC" # Native XLM SAC on testnet

    print("--------------------------------------------------")
    print(f"Initializing RentSafe Contracts on {network}")
    print(f"Escrow:     {escrow_id}")
    print(f"Dispute:    {dispute_id}")
    print(f"Platform:   {admin}")
    print(f"Token:      {token}")
    print("--------------------------------------------------")

    # 1. Initialize Dispute
    print("Invoking Dispute initialize()...")
    init_dispute_tx = run_cmd([
        "stellar", "contract", "invoke",
        "--id", dispute_id,
        "--source-account", "RENTSAFE_PLATFORM",
        "--network", network,
        "--", "initialize",
        "--admin", admin,
        "--escrow_contract", escrow_id
    ])

    # 2. Initialize Escrow
    print("Invoking Escrow initialize()...")
    init_escrow_tx = run_cmd([
        "stellar", "contract", "invoke",
        "--id", escrow_id,
        "--source-account", "RENTSAFE_PLATFORM",
        "--network", network,
        "--", "initialize",
        "--admin", admin,
        "--dispute_contract", dispute_id,
        "--asset", token
    ])

    # Save transaction details back to deployments file
    meta["roles"] = {
        "admin": admin,
        "asset": token
    }
    meta["interactions"] = {
        "init_dispute_tx": init_dispute_tx,
        "init_escrow_tx": init_escrow_tx
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
