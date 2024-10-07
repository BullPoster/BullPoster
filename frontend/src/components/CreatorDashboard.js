import React, { useState, useEffect, useCallback, useRef } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import {
  PROGRAM_ID,
  getUserCard,
  getAccountInfo,
  getProgramState,
  createAndSendRaidProgramTransaction,
  createAndSendInitiateRaidTransaction,
  fetchRaidData,
  fetchCompetitionData,
  fetchRaidProgramData,
} from "../utils/solanaUtils";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import {
  updateProgram,
  deleteProgram,
  respondToPvpRequest,
  uploadProgramPicture,
} from "../utils/api";
import BlinkCard from "./BlinkCard";
import {
  PublicKey,
  Transaction,
  SystemProgram,
  TransactionInstruction,
  ComputeBudgetProgram,
  SYSVAR_RENT_PUBKEY,
  SendTransactionError,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  getAccount,
} from "@solana/spl-token";
import BN from "bn.js";
import { Buffer } from "buffer";
import * as borsh from "borsh";

const REQUIRED_STAKE_AMOUNT = 1000 * 1000000000; // 1000 tokens with 9 decimals

function CreatorDashboard() {
  const { publicKey, signTransaction, connected } = useWallet();
  const { connection } = useConnection();
  const [dashboardData, setDashboardData] = useState(null);
  const [pvpRequests, setPvpRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingProgram, setEditingProgram] = useState(null);
  const [initiatingRaid, setInitiatingRaid] = useState(null);
  const [raidType, setRaidType] = useState("");
  const [pvpOpponent, setPvpOpponent] = useState("");
  const [lastSeenRaids, setLastSeenRaids] = useState({});
  const initiateRaidRef = useRef(null);

  useEffect(() => {
    if (publicKey) {
      fetchDashboardData();
    }
  }, [publicKey]);

  useEffect(() => {
    console.log("dashboardData changed:", dashboardData);
  }, [dashboardData]);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Fetch user card data
      const userCard = await getUserCard(publicKey);
      if (!userCard) {
        throw new Error("User card not found");
      }

      const ownedProgramPubkeys = userCard.owned_programs
        ? userCard.owned_programs.split(",").filter(Boolean)
        : [];
      console.log("Owned program pubkeys:", ownedProgramPubkeys);

      const programsWithDerivedAccounts = await Promise.all(
        ownedProgramPubkeys.map(async (pubkeyStr) => {
          try {
            if (!pubkeyStr || pubkeyStr.trim() === "") {
              console.warn("Empty pubkey string encountered");
              return null;
            }

            console.log("Processing pubkey:", pubkeyStr);
            const pubkey = new PublicKey(pubkeyStr.trim());
            console.log("Fetching program info for pubkey:", pubkeyStr);
            const programInfo = await getAccountInfo(pubkey);

            if (!programInfo) {
              console.warn(`Program info not found for pubkey: ${pubkeyStr}`);
              return null;
            }

            console.log("Deserializing program data for pubkey:", pubkeyStr);
            const programData = await fetchRaidProgramData(pubkeyStr);
            return programData;
          } catch (error) {
            console.error(`Error processing pubkey ${pubkeyStr}:`, error);
            return null;
          }
        }),
      );

      const validPrograms = programsWithDerivedAccounts.filter(
        (program) =>
          program !== null && program.raid_program_id instanceof PublicKey,
      );

      console.log("Valid programs:", validPrograms.length);

      // Fetch raid and competition data for each program
      const updatedPrograms = await Promise.all(
        validPrograms.map(async (program) => {
          try {
            const raids = program.raids
              ? program.raids.split(",").filter(Boolean)
              : [];
            console.log(
              `Fetching raid data for program ${program.raid_program_id.toBase58()}`,
            );

            const raidDataPromises = raids.map((raid) => fetchRaidData(raid));
            const raidData = await Promise.all(raidDataPromises);

            console.log(
              `Fetching competition data for program ${program.raid_program_id.toBase58()}`,
            );
            const competitionDataPromises = raidData
              .filter((raid) => raid && raid.competition_id)
              .map((raid) => fetchCompetitionData(raid.competition_id));
            const competitionData = await Promise.all(competitionDataPromises);

            return {
              ...program,
              raidData,
              competitionData,
            };
          } catch (error) {
            console.error(
              `Error processing program ${program.raid_program_id.toBase58()}:`,
              error,
            );
            return program;
          }
        }),
      );

      setDashboardData({
        programs: updatedPrograms,
      });

      // Fetch last seen raids from program state
      try {
        console.log("Fetching program state");
        const programState = await getProgramState();
        console.log("Program state:", programState);

        let parsedLastSeenRaids = {};
        try {
          parsedLastSeenRaids = programState.last_seen_raids
            ? JSON.parse(programState.last_seen_raids)
            : {};
        } catch (error) {
          console.error("Error parsing last_seen_raids JSON:", error);
        }
        setLastSeenRaids(parsedLastSeenRaids);
      } catch (error) {
        console.error("Error fetching program state:", error);
      }
    } catch (err) {
      console.error("Error in fetchDashboardData:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateProgram = useCallback(
    async (newProgram) => {
      if (!connected || !publicKey) {
        setError("Please connect your wallet first");
        return;
      }

      setIsCreating(true);
      setError(null);

      try {
        const [tokenMintPda] = await PublicKey.findProgramAddress(
          [Buffer.from("pda_token_mint")],
          PROGRAM_ID,
        );

        const { signature, raidProgramDataAccount } =
          await createAndSendRaidProgramTransaction(
            publicKey,
            newProgram,
            tokenMintPda,
            signTransaction,
          );

        // If profile picture is provided, upload it using the API function
        if (newProgram.profile_picture) {
          try {
            await uploadProgramPicture(
              raidProgramDataAccount.toBase58(),
              newProgram.profile_picture,
            );
            console.log("Profile picture uploaded successfully", raidProgramDataAccount.toBase58());
          } catch (uploadError) {
            console.error("Failed to upload profile picture:", uploadError);
            // You might want to show a warning to the user that the picture upload failed
          }
        }

        // Refresh dashboard data to include the new program
        await fetchDashboardData();
      } catch (err) {
        setError(`Failed to create program: ${err.message}`);
      } finally {
        setIsCreating(false);
      }
    },
    [connected, publicKey, signTransaction],
  );

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

  const handleInitiateRaid = async (raidProgramPubkey) => {
    try {
      const { signature, competitionAccount, raidCardAccount } =
        await createAndSendInitiateRaidTransaction(
          publicKey,
          raidProgramPubkey,
          raidType,
          pvpOpponent,
          lastSeenRaids,
          signTransaction,
        );

      // Update UI
      await fetchDashboardData();
      setError(`Raid initiated successfully.`);
    } catch (err) {
      setError(`Failed to initiate raid: ${err.message}`);
    } finally {
      setInitiatingRaid(null);
      setRaidType("");
      setPvpOpponent("");
    }
  };

  const handleRespondToPvpRequest = async (requestId, response) => {
    try {
      await respondToPvpRequest(requestId, { response });
      fetchDashboardData();
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    if (initiatingRaid && initiateRaidRef.current) {
      initiateRaidRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [initiatingRaid]);

  if (isLoading) {
    return <div className="text-center">Loading...</div>;
  }

  if (error) {
    return <div className="text-center text-red-500">Error: {error}</div>;
  }

  return (
    <div className="space-y-8">
      <h2 className="text-3xl font-bold mb-6">Creator Dashboard</h2>

      {error && (
        <div
          className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative"
          role="alert"
        >
          <strong className="font-bold">Error:</strong>
          <span className="block sm:inline"> {error}</span>
        </div>
      )}

      {!connected ? (
        <div className="text-center">
          <p className="mb-4">
            Please connect your wallet to create or manage programs.
          </p>
          <WalletMultiButton />
        </div>
      ) : (
        <>
          {isLoading ? (
            <div className="text-center">
              <div className="spinner"></div>
              <p>Loading your programs...</p>
            </div>
          ) : (
            <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
              <h3 className="text-xl font-semibold mb-4 text-green-400">
                Your Programs
              </h3>
              {console.log("Render - dashboardData:", dashboardData)}
              {console.log("Render - connected:", connected)}
              {console.log("Render - isLoading:", isLoading)}
              {dashboardData &&
                dashboardData.programs &&
                console.log(
                  dashboardData,
                  dashboardData.programs,
                  dashboardData.programs.length,
                )}
              {!dashboardData ||
              !dashboardData.programs ||
              dashboardData.programs.length === 0 ? (
                <p className="text-gray-300">
                  You haven't created any programs yet.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {console.log(
                    "About to map programs:",
                    dashboardData.programs,
                  )}
                  {dashboardData.programs.map((program) => {
                    console.log("Mapping program:", program);
                    const actionApiUrl = `https://bullposter.xyz/actions/program-card?raidProgramAccountPublicKey=${program.raid_program_id.toBase58()}`;
                    console.log("Fetching action from:", actionApiUrl);
                    return (
                      <div key={program.raid_program_id.toString()}>
                        <ProgramCard
                          program={program}
                          onEdit={() => setEditingProgram(program)}
                          onDelete={() =>
                            handleDeleteProgram(program.raid_program_id)
                          }
                          onInitiateRaid={() => setInitiatingRaid(program)}
                          onRespondToPvpRequest={handleRespondToPvpRequest}
                          actionApiUrl={actionApiUrl}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

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
            <div
              ref={initiateRaidRef}
              className="bg-gray-700 rounded-lg p-6 shadow-lg mt-8"
            >
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
                <option value="PvP">PvP</option>
              </select>
              {raidType === "PvP" && (
                <input
                  type="text"
                  value={pvpOpponent}
                  onChange={(e) => setPvpOpponent(e.target.value)}
                  placeholder="Enter opponent's raid programs public key"
                  className="w-full p-2 mb-4 bg-gray-600 text-white rounded"
                />
              )}
              <button
                onClick={() =>
                  handleInitiateRaid(initiatingRaid.raid_program_id)
                }
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
        </>
      )}
    </div>
  );
}

function ProgramCard({
  program,
  onEdit,
  onDelete,
  onInitiateRaid,
  onRespondToPvpRequest,
  actionApiUrl,
}) {
  const pvpRequests = program.pvp_requests
    ? program.pvp_requests.split(",").filter((req) => req !== "")
    : [];

  return (
    <div className="bg-gray-700 rounded-lg p-4 shadow-lg">
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
      {program.raidData && program.raidData.length > 0 ? (
        <div className="mt-4">
          <h5 className="text-sm font-semibold text-green-400">
            Ongoing Raids:
          </h5>
          {program.raidData.map((raid, index) => (
            <div
              key={raid.raid_id.toString()}
              className="mt-2 p-2 bg-gray-600 rounded"
            >
              <p className="text-sm text-white">
                Raid ID: {raid.raid_id.toString().slice(0, 4)}...
                {raid.raid_id.toString().slice(-4)}
              </p>
              {program.competitionData && program.competitionData[index] ? (
                <>
                  <p className="text-sm text-white">
                    Status: {program.competitionData[index].status}
                  </p>
                  <p className="text-sm text-white">
                    Start Time:{" "}
                    {new Date(
                      program.competitionData[index].start_time * 1000,
                    ).toLocaleString()}
                  </p>
                  <p className="text-sm text-white">
                    End Time:{" "}
                    {new Date(
                      program.competitionData[index].end_time * 1000,
                    ).toLocaleString()}
                  </p>
                </>
              ) : (
                <p className="text-sm text-white">
                  Competition data not available
                </p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-white">No ongoing raids</p>
      )}

      {pvpRequests.length > 0 && (
        <div className="mt-4">
          <h5 className="text-sm font-semibold text-green-400">
            Pending PVP Requests:
          </h5>
          {pvpRequests.map((request) => (
            <div key={request} className="mt-2 p-2 bg-gray-600 rounded">
              <p className="text-sm text-white">
                From: {request.slice(0, 4)}...{request.slice(-4)}
              </p>
              <div className="mt-2 flex space-x-2">
                <button
                  onClick={() => onRespondToPvpRequest(request, "accept")}
                  className="bg-green-500 hover:bg-green-600 text-white font-bold py-1 px-2 rounded text-xs transition duration-300"
                >
                  Accept
                </button>
                <button
                  onClick={() => onRespondToPvpRequest(request, "reject")}
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
      </div>
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
  );
}

function ProgramForm({ initialData, onSubmit, onCancel }) {
  const [formData, setFormData] = useState(
    initialData || { name: "", description: "" },
  );
  const [profilePicture, setProfilePicture] = useState(null);
  const [profilePicturePreview, setProfilePicturePreview] = useState(
    initialData?.profile_picture || null,
  );

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type === "image/png") {
      setProfilePicture(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePicturePreview(reader.result);
      };
      reader.readAsDataURL(file);
    } else {
      console.error("Only PNG images are allowed");
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      profile_picture: profilePicture,
    });
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
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300">
            Profile Picture
          </label>
          <div className="flex items-center mt-2">
            {profilePicturePreview && (
              <img
                src={profilePicturePreview}
                alt="Profile Preview"
                className="w-24 h-24 object-cover rounded-full mr-4"
              />
            )}
            <input
              type="file"
              name="profile_picture"
              onChange={handleFileChange}
              accept="image/png"
              className="hidden"
              id="profile_picture_input"
            />
            <label
              htmlFor="profile_picture_input"
              className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded cursor-pointer"
            >
              Choose Image
            </label>
          </div>
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
