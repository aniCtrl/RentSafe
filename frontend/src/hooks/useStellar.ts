import { useMemo } from 'react';
import { useWalletStore } from '../state/useWalletStore';
import { StellarService } from '../services/stellar';

export function useStellar() {
  const network = useWalletStore((state) => state.network);
  return useMemo(() => new StellarService(network), [network]);
}
