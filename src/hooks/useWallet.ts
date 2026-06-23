import { useState, useEffect, useCallback } from 'react';
import { BrowserProvider } from 'ethers';
import { RITUAL_TESTNET } from '@/lib/ritual';

declare global {
  interface Window {
    ethereum?: {
      isMetaMask?: boolean;
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
      selectedAddress: string | null;
    };
  }
}

export interface WalletState {
  address: string | null;
  balance: string;
  chainId: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  isCorrectNetwork: boolean;
}

export function useWallet() {
  const [wallet, setWallet] = useState<WalletState>({
    address: null,
    balance: '0',
    chainId: null,
    isConnected: false,
    isConnecting: false,
    isCorrectNetwork: false,
  });

  const checkNetwork = useCallback((chainIdHex: string | null) => {
    if (!chainIdHex) return false;
    const chainId = parseInt(chainIdHex, 16);
    return chainId === parseInt(RITUAL_TESTNET.chainId, 16);
  }, []);

  const updateBalance = useCallback(async (address: string) => {
    if (!window.ethereum) return '0';
    try {
      const provider = new BrowserProvider(window.ethereum);
      const balance = await provider.getBalance(address);
      return (Number(balance) / 1e18).toFixed(4);
    } catch {
      return '0';
    }
  }, []);

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      window.open('https://metamask.io/download/', '_blank');
      return;
    }

    setWallet(prev => ({ ...prev, isConnecting: true }));

    try {
      // Request account access
      const accounts = (await window.ethereum.request({
        method: 'eth_requestAccounts',
      })) as string[];

      const address = accounts[0];
      const chainId = (await window.ethereum.request({
        method: 'eth_chainId',
      })) as string;

      // Switch to Ritual testnet if not on it
      if (!checkNetwork(chainId)) {
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: RITUAL_TESTNET.chainId }],
          });
        } catch (switchError: unknown) {
          const err = switchError as { code: number };
          if (err.code === 4902) {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [RITUAL_TESTNET],
            });
          } else {
            throw switchError;
          }
        }
      }

      const balance = await updateBalance(address);
      const finalChainId = (await window.ethereum.request({
        method: 'eth_chainId',
      })) as string;

      setWallet({
        address,
        balance,
        chainId: finalChainId,
        isConnected: true,
        isConnecting: false,
        isCorrectNetwork: checkNetwork(finalChainId),
      });
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      setWallet(prev => ({ ...prev, isConnecting: false }));
    }
  }, [checkNetwork, updateBalance]);

  const disconnect = useCallback(() => {
    setWallet({
      address: null,
      balance: '0',
      chainId: null,
      isConnected: false,
      isConnecting: false,
      isCorrectNetwork: false,
    });
  }, []);

  const switchToRitual = useCallback(async () => {
    if (!window.ethereum) return;
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: RITUAL_TESTNET.chainId }],
      });
    } catch (switchError: unknown) {
      const err = switchError as { code: number };
      if (err.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [RITUAL_TESTNET],
        });
      }
    }
  }, []);

  // Listen for account and chain changes
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = async (...args: unknown[]) => {
      const accounts = args[0] as string[];
      if (accounts.length === 0) {
        disconnect();
      } else {
        const address = accounts[0];
        const balance = await updateBalance(address);
        setWallet(prev => ({
          ...prev,
          address,
          balance,
        }));
      }
    };

    const handleChainChanged = async (...args: unknown[]) => {
      const chainId = args[0] as string;
      if (wallet.address) {
        const balance = await updateBalance(wallet.address);
        setWallet(prev => ({
          ...prev,
          chainId,
          balance,
          isCorrectNetwork: checkNetwork(chainId),
        }));
      }
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    // Check if already connected
    if (window.ethereum.selectedAddress) {
      (async () => {
        const address = window.ethereum.selectedAddress!;
        const chainId = (await window.ethereum.request({
          method: 'eth_chainId',
        })) as string;
        const balance = await updateBalance(address);

        setWallet({
          address,
          balance,
          chainId,
          isConnected: true,
          isConnecting: false,
          isCorrectNetwork: checkNetwork(chainId),
        });
      })();
    }

    return () => {
      window.ethereum?.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum?.removeListener('chainChanged', handleChainChanged);
    };
  }, [wallet.address, checkNetwork, disconnect, updateBalance]);

  return { wallet, connect, disconnect, switchToRitual };
}
