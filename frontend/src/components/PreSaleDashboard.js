import React, { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { getPresaleTransactions } from "../utils/api";
import { getUserCard } from "../utils/solanaUtils";

const PreSaleDashboard = () => {
  const { publicKey } = useWallet();
  const [userData, setUserData] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (publicKey) {
      fetchUserData();
      fetchTransactions();
    }
  }, [publicKey]);

  const fetchUserData = async () => {
    try {
      const data = await getUserCard();
      setUserData(data);
    } catch (error) {
      console.error("Error fetching user data:", error);
    }
  };

  const fetchTransactions = async () => {
    try {
      const data = await getPresaleTransactions();
      setTransactions(data);
    } catch (error) {
      console.error("Error fetching transactions:", error);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <h1 className="text-4xl font-bold mb-8 text-center text-green-400">
        Pre-sale Dashboard
      </h1>
      <div className="bg-gray-800 rounded-lg p-6 shadow-lg mb-8">
        <h2 className="text-2xl font-bold mb-4 text-green-400">
          Wallet Information
        </h2>
        <p className="text-gray-300">
          Your Pre-sale Solana Address:{" "}
          {userData ? userData.presale_public_key : "Loading..."}
        </p>
        <p className="text-gray-300">
          Your BullPoster Pre-sale Token Holdings:{" "}
          {userData ? userData.presaleTokens : 0}
        </p>
        {transactions.length > 0 && (
          <>
            <h3 className="text-xl font-bold mt-6 mb-2 text-green-400">
              Transaction History
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-700">
                <thead>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      SOL Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      BullPoster Tokens
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Type
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {transactions.map((tx, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-300">
                        {new Date(tx.date).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-300">
                        {tx.solAmount}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-300">
                        {tx.tokenAmount}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-300">
                        {tx.type}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
      <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
        <h2 className="text-2xl font-bold mb-4 text-green-400">
          KYC Information
        </h2>
        <p className="text-gray-300">KYC feature is coming soon.</p>
      </div>
    </div>
  );
};

export default PreSaleDashboard;
