# RentSafe Platform Architecture

RentSafe is a decentralized rental deposit escrow platform. It ensures trustless deposit handling between tenants and landlords, utilizing an arbitrator to resolve disputes.

## System Topology Diagram

The following diagram illustrates how actors and components interact with the RentSafe contracts on the Stellar network:

```mermaid
graph TD
    %% Actors
    Tenant[Tenant / User Agent]
    Landlord[Landlord / User Agent]
    Arbitrator[Arbitrator / Platform Admin]

    %% Client Layer
    subgraph Frontend / Client
        Wallet[Stellar Wallet / Freighter]
        dApp[RentSafe Web Application]
    end

    %% Network Layer
    subgraph Stellar Network (Soroban)
        RPC[Stellar RPC Node]
        Escrow[Escrow Smart Contract]
        Dispute[Dispute Smart Contract]
        SAC[Stellar Asset Contract / Token]
    end

    %% Event Logging
    subgraph Observability
        Indexer[Event Indexer / Mercury / Stellar-Core]
        DB[(Platform Database)]
        Notify[Notification Service]
    end

    %% Interactions
    Tenant -->|Signs Tx| Wallet
    Landlord -->|Signs Tx| Wallet
    Arbitrator -->|Signs Tx| Wallet
    Wallet -->|Submits Tx| dApp
    dApp -->|Queries/Submits| RPC
    RPC -->|Executes Call| Escrow
    RPC -->|Executes Call| Dispute

    %% Smart Contract Inter-calls
    Escrow <-->|Inter-contract Calls| Dispute
    Escrow -->|Holds/Transfers Funds| SAC

    %% Event consumption
    RPC -.->|Emits Events| Indexer
    Indexer -->|Syncs| DB
    DB -->|Triggers| Notify
```

## Component Breakdown

1. **User Agents (Tenant, Landlord, Arbitrator)**: Sign on-chain transactions via a Stellar-compatible wallet (e.g., Freighter) using Soroban's native cryptographic signatures.
2. **Stellar RPC Node**: The gateway to the Stellar Network. Relays transactions, estimates fees, and provides contract state queries.
3. **Escrow Smart Contract**: Deployed per lease agreement or acts as an individual agreement coordinator. Holds funds securely and implements the escrow state machine.
4. **Dispute Smart Contract**: Handlers arbitration. Registered to a specific Escrow instance. When activated, it receives evidence hashes and lets the arbitrator decide payouts.
5. **Stellar Asset Contract (SAC)**: Standard token contract (such as native XLM or stablecoins) implementing the token interface. Funds are held directly under the Escrow contract's balance.
6. **Observability Indexer**: Scans Stellar ledgers for contract events published by Escrow and Dispute contracts to update off-chain states and user notifications.
