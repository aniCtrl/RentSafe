import { server, NATIVE_XLM_ID, readContractView } from '@/lib/stellar';
import { ContractService } from '../contractService';
import { EscrowInfo } from '@/store/useAppStore';
import { getKnownEscrowIds } from '@/lib/knownEscrows';
import { scValToNative } from '@stellar/stellar-sdk';

/**
 * ARCHITECTURE NOTES:
 * Direct RPC reads from Soroban RPC (via getEvents and contract simulation) are chosen here for the testnet/MVP phase.
 * This removes any external database or indexer dependencies, allowing the frontend to be fully serverless and decentralized.
 * 
 * Future Swap Path to indexed backend:
 * When scaling to production with a high volume of agreements, complex multi-user analytics, or full-text query requirements,
 * this service layer can be modified to call a centralized REST/GraphQL indexer (e.g. Node.js + Express + MongoDB)
 * without modifying any React component markup or hook interface.
 */

// Helper to safely convert BigInt/number to standard XLM string
const formatStroopsToXlm = (stroops: bigint | number | string) => {
  return (Number(stroops) / 10000000).toFixed(2);
};

/** Full platform-wide statistics derived from on-chain events and contract state reads. */
export interface PlatformStats {
  /** Total XLM locked across all contracts in states Funded/Active/SettlementRequested/Disputed (1-4). */
  tvl: string;
  /** Total number of escrow contracts discovered via event scan. */
  totalContractsCount: number;
  /** Contracts currently in states 1-4 (funds still locked). */
  activeContractsCount: number;
  /** Contracts in state 5 (Resolved) or 6 (Closed). */
  resolvedContractsCount: number;
  /** Percentage of all contracts that are currently in a Disputed state (state 4). */
  disputeRate: string;
  /** Landlord share of historical deposit payouts (%). Defaults to 4 when no payout data exists. */
  depositSplitLandlordPct: number;
  /** Tenant share of historical deposit payouts (%). Defaults to 96 when no payout data exists. */
  depositSplitTenantPct: number;
  /**
   * Funded amounts bucketed into 5 equal ledger-range slices across a ~60,000-ledger (≈3-day) window.
   * Labels oldest → newest: ["3d", "2d", "1.5d", "1d", "Live"].
   * `pct` is the bucket's share of the largest bucket (min 5%), useful for proportional bar heights.
   */
  tvlHistory: { label: string; amountXlm: number; pct: number }[];
  /** Unix timestamp (ms) when this snapshot was computed. */
  lastUpdated: number;
}

export class AgreementChainService {
  /**
   * Scans ledger event history to discover all escrow contracts where the user address is a participant (tenant or landlord).
   */
  static async discoverEscrowContractIds(userAddress: string): Promise<string[]> {
    if (!userAddress) return [];

    const discoveredIds = new Set<string>();

    // ─── Source 1: localStorage (immediately available, created by the wizard) ───
    const knownLocal = getKnownEscrowIds(userAddress);
    for (const cid of knownLocal) discoveredIds.add(cid);

    // ─── Source 2: On-chain event scan (discovers contracts from other sessions/devices) ───
    try {
      const latestLedger = await server.getLatestLedger();
      // Look back ~60,000 ledgers (~3 days of testnet history)
      const startLedger = Math.max(1, latestLedger.sequence - 60000);

      // Fetch all 'contract' type events — we filter by topic in JS below.
      // NOTE: Do NOT pass topic ScVal filters via the RPC filter array. The RPC
      // topic filter uses exact XDR byte matching that breaks across SDK versions.
      // Instead we fetch broadly and filter in-process.
      const response = await (server as any).getEvents({
        startLedger,
        filters: [{ type: 'contract' }],
        limit: 200
      });

      for (const evt of response.events) {
        try {
          // Only process escrow initialization events (topics: ['escrow', 'init'])
          const topics: any[] = evt.topic || evt.topics || [];
          const topicStrings = topics.map((t: any) => {
            try { return String(scValToNative(t)); } catch { return ''; }
          });
          if (topicStrings[0] !== 'escrow' || topicStrings[1] !== 'init') continue;

          // Parse event value: (landlord, tenant, arbitrator, token, amount)
          const rawVal = scValToNative(evt.value);
          if (Array.isArray(rawVal) && rawVal.length >= 2) {
            const landlord = String(rawVal[0]);
            const tenant = String(rawVal[1]);
            if (
              landlord.toUpperCase() === userAddress.toUpperCase() ||
              tenant.toUpperCase() === userAddress.toUpperCase()
            ) {
              if (evt.contractId) discoveredIds.add(String(evt.contractId));
            }
          }
        } catch (err) {
          // Skip unparseable events silently
        }
      }
    } catch (error) {
      // Event scan failure is non-fatal — localStorage already seeded the list
      console.warn('Event scan failed (non-fatal):', error);
    }

    return Array.from(discoveredIds);
  }

  /**
   * Fetches full on-chain details and current balance for a list of contract IDs.
   */
  static async fetchAgreementsForWallet(userAddress: string): Promise<EscrowInfo[]> {
    if (!userAddress) return [];
    const contractIds = await this.discoverEscrowContractIds(userAddress);
    const agreements: EscrowInfo[] = [];

    for (const cid of contractIds) {
      try {
        const details = await ContractService.getEscrowDetails(cid);
        
        // Fetch current locked balance of the contract
        let lockedBalance = '0.00';
        try {
          const balVal = await readContractView(NATIVE_XLM_ID, 'balance', [cid]);
          lockedBalance = formatStroopsToXlm(balVal);
        } catch (balErr) {
          console.error(`Failed to read balance for escrow contract ${cid}:`, balErr);
        }

        // Only include agreements where the user actually matches one of the roles
        if (
          details.landlord.toLowerCase() === userAddress.toLowerCase() ||
          details.tenant.toLowerCase() === userAddress.toLowerCase() ||
          details.arbitrator.toLowerCase() === userAddress.toLowerCase()
        ) {
          agreements.push({
            address: details.address,
            landlord: details.landlord,
            tenant: details.tenant,
            arbitrator: details.arbitrator,
            token: details.token,
            amount: details.amount,
            state: details.state,
            disputeContract: details.disputeContract,
            lockedBalance,
            proposedBy: details.proposedBy
          });
        }
      } catch (err) {
        console.error(`Failed to fetch live escrow details for ${cid}:`, err);
      }
    }

    return agreements;
  }

  /**
   * Computes live summary metrics (TVL, Active Counts, Pending Payouts) from real contract states.
   */
  static async fetchLiveDashboardMetrics(userAddress: string) {
    if (!userAddress) {
      return {
        tvl: '0.00',
        activeCount: 0,
        pendingCount: '0.00'
      };
    }

    const agreements = await this.fetchAgreementsForWallet(userAddress);
    
    let tvlStroops = BigInt(0);
    let pendingStroops = BigInt(0);
    let activeCount = 0;

    for (const agr of agreements) {
      const state = agr.state;
      const amt = agr.amount;

      // TVL sums locked funds in Funded (1), Active (2), SettlementRequested (3), or Disputed (4) states
      if (state >= 1 && state <= 4) {
        tvlStroops += amt;
      }

      // Active count represents agreements currently active (state = 2)
      if (state === 2) {
        activeCount++;
      }

      // Pending Returns represent contracts in SettlementRequested (3)
      if (state === 3) {
        pendingStroops += amt;
      }
    }

    return {
      tvl: formatStroopsToXlm(tvlStroops),
      activeCount,
      pendingCount: formatStroopsToXlm(pendingStroops)
    };
  }

  /**
   * Fetches global platform-wide statistics from discoverable contract instances.
   *
   * Single broad event scan (limit: 200) collects:
   *   - escrow:init    → contract IDs for the full discovery set
   *   - escrow:funded  → [tenant_address, amount_i128] — amounts bucketed by ledger for tvlHistory
   *   - escrow:set_acc → [landlord_share_i128, tenant_share_i128] — payout split accumulators
   *   - escrow:resolved→ same structure — payout split accumulators
   *
   * After the scan, up to 50 unique contracts are queried for current state to compute
   * activeContractsCount, resolvedContractsCount, TVL, and disputeRate.
   */
  static async fetchPlatformStats(): Promise<PlatformStats> {
    // Safe defaults returned on any unrecoverable error
    const safeDefaults: PlatformStats = {
      tvl: '0.00',
      totalContractsCount: 0,
      activeContractsCount: 0,
      resolvedContractsCount: 0,
      disputeRate: '0.00',
      depositSplitLandlordPct: 4,
      depositSplitTenantPct: 96,
      tvlHistory: [
        { label: '3d',   amountXlm: 0, pct: 5 },
        { label: '2d',   amountXlm: 0, pct: 5 },
        { label: '1.5d', amountXlm: 0, pct: 5 },
        { label: '1d',   amountXlm: 0, pct: 5 },
        { label: 'Live', amountXlm: 0, pct: 5 },
      ],
      lastUpdated: Date.now(),
    };

    try {
      // ── 1. Determine ledger window ──────────────────────────────────────────
      const latestLedger = await server.getLatestLedger();
      const startLedger  = Math.max(1, latestLedger.sequence - 60000);

      // 5 equal buckets across a 60,000-ledger window
      const bucketSize = Math.floor(60000 / 5); // 12,000 ledgers per bucket

      // ── 2. Broad event scan ─────────────────────────────────────────────────
      const response = await (server as any).getEvents({
        startLedger,
        filters: [{ type: 'contract' }],
        limit: 200,
      });

      const uniqueCids         = new Set<string>();
      const tvlBuckets: bigint[]  = [BigInt(0), BigInt(0), BigInt(0), BigInt(0), BigInt(0)];
      let   totalLandlordStroops   = BigInt(0);
      let   totalTenantStroops     = BigInt(0);

      for (const evt of response.events) {
        try {
          const topics: any[] = evt.topic || evt.topics || [];
          const topicStrings  = topics.map((t: any) => {
            try { return String(scValToNative(t)); } catch { return ''; }
          });

          const ns     = topicStrings[0]; // should be 'escrow'
          const action = topicStrings[1]; // init | funded | set_acc | resolved | …
          if (ns !== 'escrow') continue;

          // ── escrow:init — discover contract IDs ──────────────────────────
          if (action === 'init') {
            if (evt.contractId) uniqueCids.add(String(evt.contractId));
            continue;
          }

          // ── escrow:funded — [tenant_address, amount_i128] ────────────────
          if (action === 'funded') {
            const rawVal = scValToNative(evt.value);
            if (Array.isArray(rawVal) && rawVal.length >= 2) {
              const amountRaw = rawVal[1];
              const amount    = BigInt(
                typeof amountRaw === 'bigint' ? amountRaw : String(amountRaw)
              );
              // Bucket index clamped to [0, 4]
              const bucketIdx = Math.min(
                4,
                Math.floor((evt.ledger - startLedger) / bucketSize)
              );
              tvlBuckets[bucketIdx] += amount;
            }
            continue;
          }

          // ── escrow:set_acc / escrow:resolved — [landlord_share, tenant_share] ──
          if (action === 'set_acc' || action === 'resolved') {
            const rawVal = scValToNative(evt.value);
            if (Array.isArray(rawVal) && rawVal.length >= 2) {
              const lRaw = rawVal[0];
              const tRaw = rawVal[1];
              totalLandlordStroops += BigInt(
                typeof lRaw === 'bigint' ? lRaw : String(lRaw)
              );
              totalTenantStroops += BigInt(
                typeof tRaw === 'bigint' ? tRaw : String(tRaw)
              );
            }
            continue;
          }
        } catch {
          // Skip any unparseable event silently
        }
      }

      // ── 3. Per-contract state queries (max 50 to avoid timeout) ───────────
      //
      // State enum: Created=0, Funded=1, Active=2, SettlementRequested=3,
      //             Disputed=4, Resolved=5, Closed=6
      const cidsToQuery = Array.from(uniqueCids).slice(0, 50);

      let globalTvlStroops      = BigInt(0);
      let activeContractsCount  = 0;
      let resolvedContractsCount = 0;
      let disputedContractsCount = 0;

      for (const cid of cidsToQuery) {
        try {
          const details = await ContractService.getEscrowDetails(cid);
          const { state, amount } = details;

          if (state >= 1 && state <= 4) {
            globalTvlStroops += amount;
            activeContractsCount++;
          }
          if (state === 5 || state === 6) {
            resolvedContractsCount++;
          }
          if (state === 4) {
            disputedContractsCount++;
          }
        } catch (err) {
          console.error(`Failed to scan contract ${cid} for platform stats:`, err);
        }
      }

      const totalContractsCount = uniqueCids.size;

      // ── 4. Dispute rate ────────────────────────────────────────────────────
      const disputeRate =
        totalContractsCount > 0
          ? ((disputedContractsCount / totalContractsCount) * 100).toFixed(2)
          : '0.00';

      // ── 5. Deposit-split percentages ───────────────────────────────────────
      const totalPayouts = totalLandlordStroops + totalTenantStroops;
      let depositSplitLandlordPct: number;
      let depositSplitTenantPct: number;

      if (totalPayouts > BigInt(0)) {
        depositSplitLandlordPct = Math.round(
          Number((totalLandlordStroops * BigInt(100)) / totalPayouts)
        );
        depositSplitTenantPct = 100 - depositSplitLandlordPct;
      } else {
        depositSplitLandlordPct = 4;
        depositSplitTenantPct   = 96;
      }

      // ── 6. TVL history buckets ─────────────────────────────────────────────
      const tvlLabels: string[] = ['3d', '2d', '1.5d', '1d', 'Live'];
      const maxBucket = tvlBuckets.reduce(
        (max, b) => (b > max ? b : max),
        BigInt(0)
      );
      // Guard against all-zero buckets so we never divide by zero
      const divisor = maxBucket > BigInt(0) ? maxBucket : BigInt(1);

      const tvlHistory = tvlBuckets.map((bucket, i) => ({
        label:     tvlLabels[i],
        amountXlm: Number(bucket) / 10_000_000,
        pct:       Math.max(5, Math.round(Number(bucket * BigInt(100) / divisor))),
      }));

      return {
        tvl: formatStroopsToXlm(globalTvlStroops),
        totalContractsCount,
        activeContractsCount,
        resolvedContractsCount,
        disputeRate,
        depositSplitLandlordPct,
        depositSplitTenantPct,
        tvlHistory,
        lastUpdated: Date.now(),
      };
    } catch (error) {
      console.error('Error fetching global platform statistics:', error);
      return { ...safeDefaults, lastUpdated: Date.now() };
    }
  }
}
