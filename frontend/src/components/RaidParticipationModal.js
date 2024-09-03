import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { getRaidDetails, participateInRaid } from '../utils/api';

function RaidParticipationModal({ raid, onClose }) {
  const { publicKey } = useWallet();
  const [participationStatus, setParticipationStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [raidDetails, setRaidDetails] = useState(null);

  useEffect(() => {
    fetchRaidDetails();
  }, [raid]);

  const fetchRaidDetails = async () => {
    try {
      const data = await getRaidDetails(raid.id);
      setRaidDetails(data.raid);
    } catch (error) {
      setErrorMessage(`Failed to fetch raid details: ${error.message}`);
    }
  };

  const handleParticipate = async () => {
    setParticipationStatus('loading');
    setErrorMessage('');
    try {
      await participateInRaid({
        raidId: raid.id,
        participantPublicKey: publicKey.toBase58(),
      });
      setParticipationStatus('success');
    } catch (error) {
      setErrorMessage(`Failed to participate: ${error.message}`);
      setParticipationStatus('error');
    }
  };

  if (!raidDetails) {
    return <div className="text-center">Loading raid details...</div>;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg max-w-md w-full p-6">
        <h2 className="text-2xl font-bold mb-4">Join Raid: {raidDetails.title}</h2>
        <p className="text-gray-300 mb-4">{raidDetails.description}</p>
        <div className="mb-4">
          <p className="text-sm text-gray-400">Competition Type: {raidDetails.competitionType}</p>
          <p className="text-sm text-gray-400">Reward Cap: {raidDetails.rewardCap} SOL</p>
          <p className="text-sm text-gray-400">Participants: {raidDetails.participants}</p>
          <p className="text-sm text-gray-400">
            End Time: {new Date(raidDetails.endTime).toLocaleString()}
          </p>
        </div>
        {participationStatus === 'idle' && (
          <button
            onClick={handleParticipate}
            className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded transition duration-300"
          >
            Participate in Raid
          </button>
        )}
        {participationStatus === 'loading' && (
          <p className="text-center text-yellow-400">Joining raid...</p>
        )}
        {participationStatus === 'success' && (
          <p className="text-center text-green-400">Successfully joined the raid!</p>
        )}
        {participationStatus === 'error' && (
          <p className="text-center text-red-400">{errorMessage}</p>
        )}
        <button
          onClick={onClose}
          className="mt-4 w-full bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded transition duration-300"
        >
          Close
        </button>
      </div>
    </div>
  );
}

export default RaidParticipationModal;