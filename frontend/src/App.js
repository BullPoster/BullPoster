import React, { useState, useMemo, useEffect } from 'react';
import { ConnectionProvider, WalletProvider, useWallet } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';
import Navbar from './components/Navbar';
import UserDashboard from './components/UserDashboard';
import CreatorDashboard from './components/CreatorDashboard';
import PreSaleDashboard from './components/PreSaleDashboard';
import Profile from './components/Profile';
import DashboardToggle from './components/DashboardToggle';
import useAuth from './hooks/useAuth';
import PresaleTracker from './components/PresaleTracker';
import PresaleNotification from './components/PresaleNotification';
import PresaleAccessOverlay from './components/PresaleAccessOverlay';
import { checkPresaleAccess } from './utils/api';

require('@solana/wallet-adapter-react-ui/styles.css');

function AppContent() {
  const [activeDashboard, setActiveDashboard] = useState('user');
  const { publicKey } = useWallet();
  const { isAuthenticated, login, error } = useAuth();
  const [showPresaleAccess, setShowPresaleAccess] = useState(false);
  const [hasPresaleAccess, setHasPresaleAccess] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      checkPresaleAccessStatus();
    }
  }, [isAuthenticated]);

	const checkPresaleAccessStatus = async () => {
	  try {
		const response = await checkPresaleAccess();
		setHasPresaleAccess(response.has_access);
		if (response.has_access) {
		  setShowPresaleAccess(false);
		}
	  } catch (error) {
		console.error('Error checking presale access:', error);
		setHasPresaleAccess(false);
	  }
	};

  const handleLogin = async () => {
    try {
      await login();
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  const handlePresaleAccess = () => {
    if (!isAuthenticated || !hasPresaleAccess) {
      setShowPresaleAccess(true);
    } else {
      setActiveDashboard('presale');
    }
  };

  const renderDashboard = () => {
    switch (activeDashboard) {
      case 'user':
        return <UserDashboard />;
      case 'creator':
        return <CreatorDashboard />;
      case 'presale':
        return hasPresaleAccess ? <PreSaleDashboard /> : <UserDashboard />;
      case 'profile':
        return <Profile />;
      default:
        return <UserDashboard />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-black text-white">
      <Navbar />
      <PresaleNotification onAccessClick={handlePresaleAccess} />
      <PresaleTracker />
      <main className="flex-grow container mx-auto px-4 py-8 flex flex-col justify-center">
        {error && (
          <div className="bg-red-500 text-white p-4 rounded mb-4">
            Error: {error}
          </div>
        )}
        {!publicKey ? (
          <div className="flex flex-col items-center justify-center">
            <h1 className="text-4xl font-bold mb-8 text-green">Welcome to BullPoster</h1>
            <WalletMultiButton className="bg-green hover:bg-opacity-80 text-black font-bold py-2 px-4 rounded transition duration-300" />
          </div>
        ) : isAuthenticated ? (
          <>
            <div className="flex justify-center mb-8">
              <DashboardToggle 
                activeDashboard={activeDashboard} 
                setActiveDashboard={setActiveDashboard}
                hasPresaleAccess={hasPresaleAccess}
              />
            </div>
            {renderDashboard()}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center">
            <p className="text-xl mb-4">Please log in to access the dashboard.</p>
            <button 
              onClick={handleLogin}
              className="bg-green hover:bg-opacity-80 text-black font-bold py-2 px-4 rounded transition duration-300"
            >
              Log In
            </button>
          </div>
        )}
      </main>
      {showPresaleAccess && !hasPresaleAccess && (
        <PresaleAccessOverlay 
          onClose={() => setShowPresaleAccess(false)}
          onAccessGranted={() => {
            setHasPresaleAccess(true);
            setShowPresaleAccess(false);
            setActiveDashboard('presale');
          }}
        />
      )}
    </div>
  );
}

function App() {
  const network = WalletAdapterNetwork.Devnet;
  const endpoint = useMemo(() => clusterApiUrl(network), [network]);
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter({ network }),
    ],
    [network]
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <AppContent />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

export default App;