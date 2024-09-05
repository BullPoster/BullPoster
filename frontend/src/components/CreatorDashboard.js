import React, { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  getCreatorDashboard,
  createProgram,
  updateProgram,
  deleteProgram,
  initiateRaid,
  sendPvpRequest,
  getPvpRequests,
  respondToPvpRequest,
} from "../utils/api";
import BlinkCard from "./BlinkCard";

function CreatorDashboard() {
  const { publicKey } = useWallet();
  const [dashboardData, setDashboardData] = useState(null);
  const [pvpRequests, setPvpRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingProgram, setEditingProgram] = useState(null);
  const [initiatingRaid, setInitiatingRaid] = useState(null);
  const [raidType, setRaidType] = useState("");
  const [pvpOpponent, setPvpOpponent] = useState("");

  useEffect(() => {
    if (publicKey) {
      fetchDashboardData();
    }
  }, [publicKey]);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [dashboardData, pvpRequestsData] = await Promise.all([
        getCreatorDashboard(publicKey.toBase58()),
        getPvpRequests(),
      ]);
      setDashboardData(dashboardData);
      setPvpRequests(pvpRequestsData.pvp_requests);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateProgram = async (newProgram) => {
    try {
      await createProgram(newProgram);
      fetchDashboardData();
      setIsCreating(false);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUpdateProgram = async (updatedProgram) => {
    try {
      await updateProgram(updatedProgram.id, updatedProgram);
      fetchDashboardData();
      setEditingProgram(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteProgram = async (programId) => {
    try {
      await deleteProgram(programId);
      fetchDashboardData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleInitiateRaid = async (programId) => {
    if (raidType === "pvp") {
      if (!pvpOpponent) {
        setError("Please select a PVP opponent");
        return;
      }
      try {
        await sendPvpRequest({
          challenger_program_id: programId,
          challenged_public_key: pvpOpponent,
        });
        setError("PVP request sent successfully");
      } catch (err) {
        setError(err.message);
      }
    } else {
      try {
        await initiateRaid(programId, { competition_type: raidType });
        fetchDashboardData();
      } catch (err) {
        setError(err.message);
      }
    }
    setInitiatingRaid(null);
    setRaidType("");
    setPvpOpponent("");
  };

  const handleRespondToPvpRequest = async (requestId, response) => {
    try {
      await respondToPvpRequest(requestId, { response });
      fetchDashboardData();
    } catch (err) {
      setError(err.message);
    }
  };

  if (isLoading) {
    return <div className="text-center">Loading...</div>;
  }

  if (error) {
    return <div className="text-center text-red-500">Error: {error}</div>;
  }

  return (
    <div className="space-y-8">
      <h2 className="text-3xl font-bold mb-6">Creator Dashboard</h2>

      <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
        <h3 className="text-xl font-semibold mb-4 text-green-400">
          Your Programs
        </h3>
        {dashboardData.programs.length === 0 ? (
          <p className="text-gray-300">You haven't created any programs yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {dashboardData.programs.map((program) => (
              <ProgramCard
                key={program.id}
                program={program}
                onEdit={() => setEditingProgram(program)}
                onDelete={() => handleDeleteProgram(program.id)}
                onInitiateRaid={() => setInitiatingRaid(program)}
                pvpRequests={pvpRequests.filter(
                  (req) => req.challenged_program_id === program.id,
                )}
                onRespondToPvpRequest={handleRespondToPvpRequest}
              />
            ))}
          </div>
        )}
      </div>

      {!isCreating && !editingProgram && (
        <button
          onClick={() => setIsCreating(true)}
          className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded transition duration-300"
        >
          Create New Program
        </button>
      )}

      {(isCreating || editingProgram) && (
        <ProgramForm
          initialData={editingProgram}
          onSubmit={isCreating ? handleCreateProgram : handleUpdateProgram}
          onCancel={() => {
            setIsCreating(false);
            setEditingProgram(null);
          }}
        />
      )}

      {initiatingRaid && (
        <div className="bg-gray-700 rounded-lg p-6 shadow-lg mt-8">
          <h3 className="text-xl font-semibold mb-4 text-green-400">
            Initiate Raid
          </h3>
          <select
            value={raidType}
            onChange={(e) => setRaidType(e.target.value)}
            className="w-full p-2 mb-4 bg-gray-600 text-white rounded"
          >
            <option value="">Select Raid Type</option>
            <option value="4-program">4 Programs</option>
            <option value="6-program">6 Programs</option>
            <option value="12-program">12 Programs</option>
            <option value="24-program">24 Programs</option>
            <option value="pvp">PVP</option>
          </select>
          {raidType === "pvp" && (
            <input
              type="text"
              value={pvpOpponent}
              onChange={(e) => setPvpOpponent(e.target.value)}
              placeholder="Enter opponent's public key"
              className="w-full p-2 mb-4 bg-gray-600 text-white rounded"
            />
          )}
          <button
            onClick={() => handleInitiateRaid(initiatingRaid.id)}
            className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded transition duration-300"
            disabled={initiatingRaid.is_conducting_raid}
          >
            Initiate Raid
          </button>
          <button
            onClick={() => {
              setInitiatingRaid(null);
              setRaidType("");
              setPvpOpponent("");
            }}
            className="ml-4 bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded transition duration-300"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

function ProgramCard({
  program,
  onEdit,
  onDelete,
  onInitiateRaid,
  pvpRequests,
  onRespondToPvpRequest,
}) {
  const actionApiUrl = `https://bullposter.xyz/actions/program-card-raid?programId=${program.id}`;

  return (
    <div className="bg-gray-700 rounded-lg p-4 shadow-lg">
      <h4 className="text-lg font-semibold text-white">{program.name}</h4>
      <p className="text-gray-300 text-sm mb-2">{program.description}</p>
      <p className="text-sm text-gray-400 mb-1">Size: {program.size}</p>
      <p className="text-sm text-gray-400 mb-2">
        Rewards Distributed: {program.total_rewards_distributed} SOL
      </p>
      <div className="flex justify-end space-x-2">
        <button
          onClick={onEdit}
          className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-1 px-2 rounded text-sm transition duration-300"
        >
          Edit
        </button>
        <button
          onClick={onDelete}
          className="bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-2 rounded text-sm transition duration-300"
        >
          Delete
        </button>
        <button
          onClick={onInitiateRaid}
          className="bg-purple-500 hover:bg-purple-600 text-white font-bold py-1 px-2 rounded text-sm transition duration-300"
          disabled={program.is_conducting_raid}
        >
          {program.is_conducting_raid ? "Raid in Progress" : "Initiate Raid"}
        </button>
      </div>
      {pvpRequests.length > 0 && (
        <div className="mt-4">
          <h5 className="text-sm font-semibold text-green-400">
            Pending PVP Requests:
          </h5>
          {pvpRequests.map((request) => (
            <div key={request.id} className="mt-2 p-2 bg-gray-600 rounded">
              <p className="text-sm text-white">
                From: {request.challenger.slice(0, 4)}...
                {request.challenger.slice(-4)}
              </p>
              <div className="mt-2 flex space-x-2">
                <button
                  onClick={() => onRespondToPvpRequest(request.id, "accept")}
                  className="bg-green-500 hover:bg-green-600 text-white font-bold py-1 px-2 rounded text-xs transition duration-300"
                >
                  Accept
                </button>
                <button
                  onClick={() => onRespondToPvpRequest(request.id, "reject")}
                  className="bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-2 rounded text-xs transition duration-300"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="mt-4">
        <BlinkCard actionApiUrl={actionApiUrl} />
        <div className="mt-2">
          <input
            type="text"
            value={actionApiUrl}
            readOnly
            className="w-full p-2 bg-gray-600 text-white rounded"
          />
          <button
            onClick={() => navigator.clipboard.writeText(actionApiUrl)}
            className="w-full mt-2 bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded"
          >
            Copy URL
          </button>
        </div>
      </div>
    </div>
  );
}

function ProgramForm({ initialData, onSubmit, onCancel }) {
  const [formData, setFormData] = useState(
    initialData || { name: "", description: "" },
  );

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="bg-gray-700 rounded-lg p-6 shadow-lg mt-8">
      <h3 className="text-xl font-semibold mb-4 text-green-400">
        {initialData ? "Edit Program" : "Create New Program"}
      </h3>
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300">
            Program Name
          </label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md bg-gray-600 border-gray-500 text-white"
            required
          />
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300">
            Description
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md bg-gray-600 border-gray-500 text-white"
            rows="3"
            required
          ></textarea>
        </div>
        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={onCancel}
            className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded transition duration-300"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded transition duration-300"
          >
            {initialData ? "Update Program" : "Create Program"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default CreatorDashboard;
