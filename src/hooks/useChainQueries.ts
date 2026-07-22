import { useQuery } from '@tanstack/react-query';
import { AgreementChainService } from '@/services/chain/agreementService';

export function useUserAgreements(walletAddress: string) {
  return useQuery({
    queryKey: ['userAgreements', walletAddress],
    queryFn: () => AgreementChainService.fetchAgreementsForWallet(walletAddress),
    enabled: !!walletAddress,
    refetchInterval: 10000, // Poll every 10 seconds for live updates
  });
}

export function useDashboardMetrics(walletAddress: string) {
  return useQuery({
    queryKey: ['dashboardMetrics', walletAddress],
    queryFn: () => AgreementChainService.fetchLiveDashboardMetrics(walletAddress),
    enabled: !!walletAddress,
    refetchInterval: 10000, // Invalidate/refresh on interval
  });
}

export function usePlatformStats() {
  return useQuery({
    queryKey: ['platformStats'],
    queryFn: () => AgreementChainService.fetchPlatformStats(),
    refetchInterval: 30000, // Poll platform stats every 30 seconds
  });
}
