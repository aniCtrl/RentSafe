import { useQuery } from '@tanstack/react-query';
import { AgreementChainService } from '@/services/chain/agreementService';

export function useUserAgreements(walletAddress: string) {
  return useQuery({
    queryKey: ['userAgreements', walletAddress],
    queryFn: () => AgreementChainService.fetchAgreementsForWallet(walletAddress),
    enabled: !!walletAddress,
    refetchInterval: 10000,
  });
}

export function useDashboardMetrics(walletAddress: string) {
  return useQuery({
    queryKey: ['dashboardMetrics', walletAddress],
    queryFn: () => AgreementChainService.fetchLiveDashboardMetrics(walletAddress),
    enabled: !!walletAddress,
    refetchInterval: 10000,
  });
}

export function usePlatformStats() {
  return useQuery({
    queryKey: ['platformStats'],
    queryFn: () => AgreementChainService.fetchPlatformStats(),
    refetchInterval: 30000,
  });
}

export function useAgreementDetails(agreementId?: number | string | null) {
  return useQuery({
    queryKey: ['agreementDetails', agreementId],
    queryFn: () => AgreementChainService.fetchAgreement(Number(agreementId)),
    enabled: agreementId !== undefined && agreementId !== null && `${agreementId}`.trim().length > 0,
    refetchInterval: 10000,
  });
}

export function useAgreementDispute(agreementId?: number | string | null) {
  return useQuery({
    queryKey: ['agreementDispute', agreementId],
    queryFn: () => AgreementChainService.fetchAgreementDispute(Number(agreementId)),
    enabled: agreementId !== undefined && agreementId !== null && `${agreementId}`.trim().length > 0,
    refetchInterval: 10000,
  });
}

export function useAllDisputes(enabled = true) {
  return useQuery({
    queryKey: ['allDisputes'],
    queryFn: () => AgreementChainService.fetchAllDisputes(),
    enabled,
    refetchInterval: enabled ? 10000 : false,
  });
}
