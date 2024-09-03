import React from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { del } from '../utils/api';

function ProgramCard({ program, isCreator, onEdit, onDelete, onParticipate, onInitiateRaid }) {
  const { publicKey } = useWallet();

  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  const handleDelete = async () => {
    try {
      await del(`/delete-program/${program.id}`);
      onDelete(program.id);
    } catch (error) {
      console.error('Error deleting program:', error);
      // You might want to show an error message to the user here
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4 shadow-lg">
      <h3 className="text-xl font-semibold text-green-400 mb-2">{program.title}</h3>
      <p className="text-gray-300 mb-4">{program.description}</p>
      <p className="text-sm text-gray-400 mb-2">
        Active Raids: {program.activeRaids}
      </p>
      {program.earnings && (
        <p className="text-sm text-green-400 mb-4">Earnings: {program.earnings.toFixed(2)} SOL</p>
      )}
      {isCreator ? (
        <div className="flex justify-end space-x-2">
          <button
            onClick={() => onEdit(program)}
            className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-1 px-2 rounded text-sm transition duration-300"
          >
            Edit
          </button>
          <button
            onClick={handleDelete}
            className="bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-2 rounded text-sm transition duration-300"
          >
            Delete
          </button>
          <button
            onClick={() => onInitiateRaid(program)}
            className="bg-purple-500 hover:bg-purple-600 text-white font-bold py-1 px-2 rounded text-sm transition duration-300"
          >
            Initiate Raid
          </button>
        </div>
      ) : (
        <button
          onClick={() => onParticipate(program)}
          className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded transition duration-300"
        >
          Join Raid
        </button>
      )}
    </div>
  );
}

export default ProgramCard;