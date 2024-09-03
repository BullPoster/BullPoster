import React from 'react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useWallet } from '@solana/wallet-adapter-react';

function Navbar() {
  const { publicKey } = useWallet();

  return (
    <nav className="bg-black text-white p-4">
      <div className="container mx-auto flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <img src="./logo.png" alt="BullPoster" className="h-12 w-auto transition-opacity duration-300" />
        </div>
        <div className="flex items-center space-x-4">
          {publicKey && (
            <div className="text-sm mr-4">
              Connected: {publicKey.toBase58().slice(0, 4)}...{publicKey.toBase58().slice(-4)}
            </div>
          )}
          <WalletMultiButton className="!bg-green-500 hover:!bg-green-600 !transition-colors !duration-300" />
        </div>
      </div>
    </nav>
  );
}

export default Navbar;