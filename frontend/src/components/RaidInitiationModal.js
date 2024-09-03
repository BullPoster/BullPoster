import React, { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { post } from '../utils/api';

function RaidInitiationModal({ program, onClose, onInitiate }) {
  const { publicKey } = useWallet();
  const [competitionType, setCompetitionType] = useState('pvp');
  const [rewardCap, setRewardCap] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const data = await post('/initiate-raid', {
        programId: program.id,
        competitionType,
        rewardCap: parseFloat(rewardCap),
        creatorPublicKey: publicKey.toBase58(),
      });

      onInitiate(data.raid);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg max-w-md w-full p-6">
        <h2 className="text-2xl font-bold mb-4">Initiate Raid for {program.title}</h2>
        {error && <p className="text-red-500 mb-4">{error}</p>}
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Competition Type
            </label>
            <select
              value={competitionType}
              onChange={(e) => setCompetitionType(e.target.value)}
              className="w-full bg-gray-700 text-white rounded px-3 py-2"
            >
              <option value="pvp">PvP</option>
              <option value="4-program">4 Programs</option>
              <option value="6-program">6 Programs</option>
              <option value="12-program">12 Programs</option>
              <option value="24-program">24 Programs</option>
            </select>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Reward Cap (SOL)
            </label>
            <input
              type="number"
              value={rewardCap}
              onChange={(e) => setRewardCap(e.target.value)}
              className="w-full bg-gray-700 text-white rounded px-3 py-2"
              step="0.01"
              min="0"
              required
            />
          </div>
          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={onClose}
              className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded"
              disabled={isLoading}
            >
              {isLoading ? 'Initiating...' : 'Initiate Raid'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default RaidInitiationModal;