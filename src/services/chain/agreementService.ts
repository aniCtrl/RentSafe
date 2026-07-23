import { scValToNative } from '@stellar/stellar-sdk';
import { DEFAULT_DISPUTE_ID, DEFAULT_ESCROW_ID, server } from '@/lib/stellar';
import {
  AgreementRecord,
  DisputeRecord,
  formatStroopsToXlm,
  hasLockedFunds,
} from '@/lib/rentsafe';
import { ContractService } from '../contractService';

export interface TvlBucket {
  label: string;
  amountXlm: number;
  pct: number;
  count: number;
  fromTimestamp: number;
  toTimestamp: number;
}

export interface PlatformStats {
  tvl: string;
  totalContractsCount: number;
  activeContractsCount: number;
  resolvedContractsCount: number;
  disputeRate: string;
  depositSplitLandlordPct: number;
  depositSplitTenantPct: number;
  tvlHistory: TvlBucket[];
  timeWindowLabel: string;
  lastUpdated: number;
}

const DEFAULT_HOURLY_LABELS = ['-12h', '-10h', '-8h', '-6h', '-4h', '-2h', 'Now'];

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
    const startLedger = Math.max(1, latestLedger.sequence - 15000);

    let resolvedTxHashes: Map<number, string> = new Map();
    try {
      const response = await server.getEvents({
        startLedger,
        filters: [{ type: 'contract', contractIds: [DEFAULT_DISPUTE_ID] }],
        limit: 200,
      });

      resolvedTxHashes = new Map(
        response.events
          .map((event) => {
            const topics = event.topic.map((topic) => {
              try {
                return scValToNative(topic);
              } catch {
                return null;
              }
            });
            const action = String(topics[0] ?? '');
            const disputeId = Number(topics[1] ?? 0);
            const txHash = event.txHash || '';
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
      tvlHistory: DEFAULT_HOURLY_LABELS.map((label) => ({
        label,
        amountXlm: 0,
        pct: 0,
        count: 0,
        fromTimestamp: 0,
        toTimestamp: 0,
      })),
      timeWindowLabel: '12 Hours',
      lastUpdated: Date.now(),
    };

    try {
      const agreements = await this.fetchAllAgreements();
      const nowSeconds = Math.floor(Date.now() / 1000);

      let tvlStroops = BigInt(0);
      let activeContractsCount = 0;
      let resolvedContractsCount = 0;
      let disputedCount = 0;
      let totalLandlordResolved = BigInt(0);
      let totalTenantResolved = BigInt(0);

      const fundedAgreements = agreements.filter((a) => a.fundedAt > 0);
      const fundedTimestamps = fundedAgreements.map((a) => a.fundedAt);

      const earliestFunded =
        fundedTimestamps.length > 0
          ? Math.min(...fundedTimestamps)
          : nowSeconds - 12 * 3600;

      const timespanSeconds = Math.max(3600, nowSeconds - earliestFunded);

      const totalMinutes = Math.max(1, Math.round(timespanSeconds / 60));
      const totalHours = Math.round(timespanSeconds / 3600);

      let bucketCount: number;
      let bucketSizeSeconds: number;
      let labels: string[];
      let windowLabel: string;

      if (totalMinutes <= 180) {
        bucketCount = Math.min(8, Math.max(3, Math.round(totalMinutes / 15)));
        bucketSizeSeconds = Math.ceil(timespanSeconds / bucketCount);
        labels = Array.from({ length: bucketCount }, (_, i) => {
          const mins = Math.round(((bucketCount - 1 - i) * bucketSizeSeconds) / 60);
          return i === bucketCount - 1 ? 'Now' : `-${mins}m`;
        });
        windowLabel = totalMinutes < 60
          ? `${totalMinutes} Min`
          : `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`;
      } else {
        bucketCount = Math.min(8, Math.max(5, Math.round(totalHours / 2)));
        bucketSizeSeconds = Math.ceil(timespanSeconds / bucketCount);
        labels = Array.from({ length: bucketCount }, (_, i) => {
          const h = Math.round(((bucketCount - 1 - i) * bucketSizeSeconds) / 3600);
          return i === bucketCount - 1 ? 'Now' : `-${h}h`;
        });
        windowLabel = totalHours < 48 ? `${totalHours} Hours` : `${Math.round(totalHours / 24)} Days`;
      }

      const windowStartSeconds = nowSeconds - bucketCount * bucketSizeSeconds;
      const bucketsStroops = new Array(bucketCount).fill(BigInt(0));
      const bucketCounts = new Array(bucketCount).fill(0);

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

        if (agreement.fundedAt > 0) {
          const elapsed = Math.max(0, agreement.fundedAt - windowStartSeconds);
          const bucketIndex = Math.min(bucketCount - 1, Math.floor(elapsed / bucketSizeSeconds));
          bucketsStroops[bucketIndex] += agreement.depositAmount;
          bucketCounts[bucketIndex] += 1;
        }
      }

      const totalResolved = totalLandlordResolved + totalTenantResolved;
      const depositSplitLandlordPct =
        totalResolved > BigInt(0) ? Math.round(Number((totalLandlordResolved * BigInt(100)) / totalResolved)) : 0;
      const depositSplitTenantPct = totalResolved > BigInt(0) ? 100 - depositSplitLandlordPct : 100;
      const maxBucket = bucketsStroops.reduce((max, bucket) => (bucket > max ? bucket : max), BigInt(0));

      const divisor = maxBucket > BigInt(0) ? maxBucket : BigInt(1);

      return {
        tvl: formatStroopsToXlm(tvlStroops),
        totalContractsCount: 1,
        activeContractsCount,
        resolvedContractsCount,
        disputeRate: agreements.length > 0 ? ((disputedCount / agreements.length) * 100).toFixed(2) : '0.00',
        depositSplitLandlordPct,
        depositSplitTenantPct,
        tvlHistory: bucketsStroops.map((stroops, index) => ({
          label: labels[index],
          amountXlm: Number(stroops) / 10_000_000,
          pct: maxBucket > BigInt(0) ? Math.round(Number((stroops * BigInt(100)) / divisor)) : 0,
          count: bucketCounts[index],
          fromTimestamp: windowStartSeconds + index * bucketSizeSeconds,
          toTimestamp: index === bucketCount - 1 ? nowSeconds : windowStartSeconds + (index + 1) * bucketSizeSeconds,
        })),
        timeWindowLabel: windowLabel,
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
