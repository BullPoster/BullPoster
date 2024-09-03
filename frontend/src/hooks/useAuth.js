import { useState, useCallback, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { login as loginApi, logout as logoutApi } from '../utils/api';

const useAuth = () => {
  const { publicKey } = useWallet();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState(null);

  const login = useCallback(async () => {
    if (!publicKey) {
      throw new Error('Wallet not connected');
    }
    try {
      console.log('Attempting login with public key:', publicKey.toString()); // Debug log
      const response = await loginApi({ publicKey: publicKey.toString() });
      console.log('Login response:', response); // Debug log
      setIsAuthenticated(response.isAuthenticated);
      setError(null);
    } catch (err) {
      console.error('Login error:', err);
      setError(err.message || 'An unexpected error occurred');
      setIsAuthenticated(false);
    }
  }, [publicKey]);

  const logout = useCallback(async () => {
    try {
      await logoutApi();
      setIsAuthenticated(false);
      setError(null);
    } catch (err) {
      console.error('Logout error:', err);
      setError(err.message || 'An unexpected error occurred');
    }
  }, []);

  useEffect(() => {
    if (publicKey && !isAuthenticated) {
      login().catch(console.error);
    } else if (!publicKey && isAuthenticated) {
      logout().catch(console.error);
    }
  }, [publicKey, isAuthenticated, login, logout]);

  return { isAuthenticated, login, logout, error };
};

export default useAuth;