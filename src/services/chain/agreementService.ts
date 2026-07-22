import { scValToNative } from '@stellar/stellar-sdk';
import { DEFAULT_DISPUTE_ID, DEFAULT_ESCROW_ID, server } from '@/lib/stellar';
import {
  AgreementRecord,
  DisputeRecord,
  formatStroopsToXlm,
  hasLockedFunds,
} from '@/lib/rentsafe';
import { ContractService } from '../contractService';

export interface PlatformStats {
  tvl: string;
  totalContractsCount: number;
  activeContractsCount: number;
  resolvedContractsCount: number;
  disputeRate: string;
  depositSplitLandlordPct: number;
  depositSplitTenantPct: number;
  tvlHistory: { label: string; amountXlm: number; pct: number }[];
  lastUpdated: number;
}

const HISTORY_LABELS = ['3d', '2d', '1.5d', '1d', 'Live'];

export class AgreementChainService {
  static async fetchAllAgreements(): Promise<AgreementRecord[]> {
    const ids = await ContractService.getAgreementIds();
    const agreements = await Promise.all(
      ids.map(async (agreementId) => {
        try {
          return await ContractService.getAgreementDetails(agreementId);
        } catch (error) {
          console.error(`Failed to fetch agreement ${agreementId}:`, error);
          return null;
        }
      }),
    );

    return agreements.filter((agreement): agreement is AgreementRecord => agreement !== null);
  }

  static async fetchAgreement(agreementId: number | string): Promise<AgreementRecord> {
    return ContractService.getAgreementDetails(agreementId);
  }

  static async fetchAgreementsForWallet(walletAddress: string): Promise<AgreementRecord[]> {
    if (!walletAddress) return [];

    const agreements = await this.fetchAllAgreements();
    const wallet = walletAddress.toLowerCase();

    return agreements
      .filter(
        (agreement) =>
          agreement.landlord.toLowerCase() === wallet ||
          agreement.tenant.toLowerCase() === wallet,
      )
      .sort((a, b) => b.agreementId - a.agreementId);
  }

  static async fetchAgreementDispute(agreementId: number | string): Promise<DisputeRecord | null> {
    return ContractService.getDisputeByAgreement(agreementId);
  }

  static async fetchAllDisputes(): Promise<DisputeRecord[]> {
    const ids = await ContractService.getDisputeIds();
    const latestLedger = await server.getLatestLedger();
    const startLedger = Math.max(1, latestLedger.sequence - 60000);

    type ContractEventRecord = {
      topic?: unknown[];
      topics?: unknown[];
      txHash?: string;
      tx_hash?: string;
      transactionHash?: string;
    };

    let resolvedTxHashes = new Map<number, string>();
    try {
      const response = await (server as unknown as {
        getEvents: (args: {
          startLedger: number;
          filters: Array<{ type: string; contractIds: string[] }>;
          limit: number;
        }) => Promise<{ events?: ContractEventRecord[] }>;
      }).getEvents({
        startLedger,
        filters: [{ type: 'contract', contractIds: [DEFAULT_DISPUTE_ID] }],
        limit: 200,
      });

      resolvedTxHashes = new Map(
        (response.events ?? [])
          .map((event) => {
            const topics = (event.topic || event.topics || []).map((topic) => {
              try {
                return scValToNative(topic as Parameters<typeof scValToNative>[0]);
              } catch {
                return null;
              }
            });
            const action = String(topics[0] ?? '');
            const disputeId = Number(topics[1] ?? 0);
            const txHash = event.txHash || event.tx_hash || event.transactionHash || '';
            return action === 'dispute_resolved' && disputeId > 0 && txHash ? [disputeId, txHash] : null;
          })
          .filter(Boolean) as Array<[number, string]>,
      );
    } catch (error) {
      console.warn('Unable to backfill dispute resolution tx hashes from events:', error);
    }

    const disputes = await Promise.all(
      ids.map(async (disputeId) => {
        try {
          const dispute = await ContractService.getDisputeDetails(disputeId);
          const resolutionTxHash = resolvedTxHashes.get(disputeId);
          return resolutionTxHash ? { ...dispute, resolutionTxHash } : dispute;
        } catch (error) {
          console.error(`Failed to fetch dispute ${disputeId}:`, error);
          return null;
        }
      }),
    );

    return disputes.filter((dispute): dispute is DisputeRecord => dispute !== null).sort((a, b) => b.disputeId - a.disputeId);
  }

  static async fetchLiveDashboardMetrics(walletAddress: string) {
    if (!walletAddress) {
      return {
        tvl: '0.00',
        activeCount: 0,
        pendingCount: '0.00',
      };
    }

    const agreements = await this.fetchAgreementsForWallet(walletAddress);

    let tvlStroops = BigInt(0);
    let pendingStroops = BigInt(0);
    let activeCount = 0;

    for (const agreement of agreements) {
      if (hasLockedFunds(agreement.status)) {
        tvlStroops += agreement.depositAmount;
      }

      if (agreement.status === 2) {
        activeCount += 1;
      }

      if ([3, 4, 5, 6, 7, 8].includes(agreement.status)) {
        pendingStroops += agreement.depositAmount;
      }
    }

    return {
      tvl: formatStroopsToXlm(tvlStroops),
      activeCount,
      pendingCount: formatStroopsToXlm(pendingStroops),
    };
  }

  static async fetchPlatformStats(): Promise<PlatformStats> {
    const safeDefaults: PlatformStats = {
      tvl: '0.00',
      totalContractsCount: 1,
      activeContractsCount: 0,
      resolvedContractsCount: 0,
      disputeRate: '0.00',
      depositSplitLandlordPct: 0,
      depositSplitTenantPct: 100,
      tvlHistory: HISTORY_LABELS.map((label) => ({ label, amountXlm: 0, pct: 5 })),
      lastUpdated: Date.now(),
    };

    try {
      const agreements = await this.fetchAllAgreements();
      const nowSeconds = Math.floor(Date.now() / 1000);
      const windowSeconds = Math.floor(3.5 * 24 * 60 * 60);
      const bucketSizeSeconds = Math.floor(windowSeconds / HISTORY_LABELS.length);

      let tvlStroops = BigInt(0);
      let activeContractsCount = 0;
      let resolvedContractsCount = 0;
      let disputedCount = 0;
      let totalLandlordResolved = BigInt(0);
      let totalTenantResolved = BigInt(0);
      const buckets = HISTORY_LABELS.map(() => BigInt(0));

      for (const agreement of agreements) {
        if (hasLockedFunds(agreement.status)) {
          tvlStroops += agreement.depositAmount;
          activeContractsCount += 1;
        }

        if (agreement.status === 9 || agreement.status === 10) {
          resolvedContractsCount += 1;
        }

        if (agreement.status === 7 || agreement.status === 8) {
          disputedCount += 1;
        }

        if (agreement.hasResolution) {
          totalLandlordResolved += agreement.resolutionLandlordAmount;
          totalTenantResolved += agreement.resolutionTenantAmount;
        }

        if (agreement.fundedAt > 0 && agreement.fundedAt >= nowSeconds - windowSeconds) {
          const elapsed = Math.max(0, agreement.fundedAt - (nowSeconds - windowSeconds));
          const bucketIndex = Math.min(HISTORY_LABELS.length - 1, Math.floor(elapsed / bucketSizeSeconds));
          buckets[bucketIndex] += agreement.depositAmount;
        }
      }

      const totalResolved = totalLandlordResolved + totalTenantResolved;
      const depositSplitLandlordPct =
        totalResolved > BigInt(0) ? Math.round(Number((totalLandlordResolved * BigInt(100)) / totalResolved)) : 0;
      const depositSplitTenantPct = totalResolved > BigInt(0) ? 100 - depositSplitLandlordPct : 100;
      const maxBucket = buckets.reduce((max, bucket) => (bucket > max ? bucket : max), BigInt(0));
      const divisor = maxBucket > BigInt(0) ? maxBucket : BigInt(1);

      return {
        tvl: formatStroopsToXlm(tvlStroops),
        totalContractsCount: 1,
        activeContractsCount,
        resolvedContractsCount,
        disputeRate: agreements.length > 0 ? ((disputedCount / agreements.length) * 100).toFixed(2) : '0.00',
        depositSplitLandlordPct,
        depositSplitTenantPct,
        tvlHistory: buckets.map((bucket, index) => ({
          label: HISTORY_LABELS[index],
          amountXlm: Number(bucket) / 10000000,
          pct: Math.max(5, Math.round(Number((bucket * BigInt(100)) / divisor))),
        })),
        lastUpdated: Date.now(),
      };
    } catch (error) {
      console.error('Error fetching global platform statistics:', error);
      return safeDefaults;
    }
  }

  static getSharedContractId() {
    return DEFAULT_ESCROW_ID;
  }
}
