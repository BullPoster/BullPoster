import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  ComputeBudgetProgram,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token";
import { Buffer } from "buffer";
import * as borsh from "borsh";
import { sha256 } from "js-sha256";
import BN from "bn.js";

// Define the program ID
export const PROGRAM_ID = new PublicKey(
  "FY9aF1jszyGoABygvsQ28oHfqgyUVZkttzr8Vcx7sLKH",
);

const endpoints = [
  "https://api.devnet.solana.com",
  "https://devnet-rpc.shyft.to?api_key=QU6nR4Sn0RjrTpEU",
  "https://devnet-rpc.shyft.to?api_key=MrpOPjGhO45RmpIq",
  "https://devnet-rpc.shyft.to?api_key=Y4heuXMr81Vo4fKX",
  "https://devnet-rpc.shyft.to?api_key=eUaIgOEEUvcHalKp",
];

async function executeWithFallback(operation) {
  for (const endpoint of endpoints) {
    try {
      const connection = new Connection(endpoint, "confirmed");
      return await operation(connection);
    } catch (error) {
      console.error(`Failed to execute operation with ${endpoint}:`, error);
    }
  }
  throw new Error("Failed to execute operation with any endpoint");
}

export async function getAccountInfo(pubkey) {
  return executeWithFallback((connection) => connection.getAccountInfo(pubkey));
}

export async function createUserCardTransaction(publicKey) {
  // Derive PDA for user card account
  const userCardSeed = `user_card_${publicKey.toString()}`;
  const hashedSeed = sha256.arrayBuffer(userCardSeed);
  const seed = new Uint8Array(hashedSeed).slice(0, 32);

  const [userCardAccount, _] = await PublicKey.findProgramAddress(
    [seed],
    PROGRAM_ID,
  );

  const [programStateAccount] = await findProgramAddress(
    [Buffer.from("program_state")],
    PROGRAM_ID,
  );

  // Create the instruction
  const createUserCardIx = new TransactionInstruction({
    keys: [
      { pubkey: publicKey, isSigner: true, isWritable: true },
      { pubkey: userCardAccount, isSigner: false, isWritable: true },
      { pubkey: programStateAccount, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data: Buffer.from([8]), // 8 is the instruction number for CreateUserCard
  });

  // Create and return the transaction
  const transaction = new Transaction().add(createUserCardIx);
  return transaction;
}

export async function createAndSendUserCard(publicKey, signTransaction) {
  const transaction = await createUserCardTransaction(publicKey);

  // Add compute budget instruction
  const additionalComputeBudgetInstruction =
    ComputeBudgetProgram.setComputeUnitLimit({
      units: 1_400_000,
    });
  transaction.add(additionalComputeBudgetInstruction);
  transaction.feePayer = publicKey;

  // Obtain the blockhash and last valid block height
  const { blockhash, lastValidBlockHeight } = await executeWithFallback(
    async (connection) => {
      return await connection.getLatestBlockhash();
    },
  );

  transaction.recentBlockhash = blockhash;

  // Sign the transaction (this should not be retried)
  const signedTransaction = await signTransaction(transaction);

  // Send and confirm the transaction (this should not be retried)
  const connection = new Connection(endpoints[0], "confirmed"); // Use the first endpoint for sending the transaction
  const signature = await connection.sendRawTransaction(
    signedTransaction.serialize(),
    {
      skipPreflight: true,
      preflightCommitment: "confirmed",
    },
  );

  await connection.confirmTransaction({
    signature,
    blockhash,
    lastValidBlockHeight,
  });

  return signature;
}

export async function findProgramAddress(seeds, programId) {
  return executeWithFallback((connection) =>
    PublicKey.findProgramAddress(seeds, programId),
  );
}

export async function getProgramState() {
  const [programStatePDA] = await PublicKey.findProgramAddress(
    [Buffer.from("program_state")],
    PROGRAM_ID,
  );
  const accountInfo = await getAccountInfo(programStatePDA);
  return customDeserializeProgramState(accountInfo.data);
}

export async function getProgramRaidProgramsState() {
  const [programRaidProgramsStatePDA] = await PublicKey.findProgramAddress(
    [Buffer.from("program_raid_programs_state")],
    PROGRAM_ID,
  );
  const accountInfo = await getAccountInfo(programRaidProgramsStatePDA);
  return customDeserializeProgramRaidProgramsState(accountInfo.data);
}

export async function getProgramRaidsState() {
  const [programRaidsStatePDA] = await PublicKey.findProgramAddress(
    [Buffer.from("program_raids_state")],
    PROGRAM_ID,
  );
  const accountInfo = await getAccountInfo(programRaidsStatePDA);
  return customDeserializeProgramRaidsState(accountInfo.data);
}

export async function getProgramCompetitionsState() {
  const [programCompetitionsStatePDA] = await PublicKey.findProgramAddress(
    [Buffer.from("program_competitions_state")],
    PROGRAM_ID,
  );
  const accountInfo = await getAccountInfo(programCompetitionsStatePDA);
  return customDeserializeProgramCompetitionsState(accountInfo.data);
}

export async function getLeaderboard() {
  const [leaderboardPDA] = await PublicKey.findProgramAddress(
    [Buffer.from("program_leaderboard_state")],
    PROGRAM_ID,
  );
  const accountInfo = await getAccountInfo(leaderboardPDA);
  return customDeserializeLeaderboard(accountInfo.data);
}

function customDeserializeProgramState(data) {
  let offset = 0;

  function readString() {
    const length = data.readUInt32LE(offset);
    offset += 4;
    const str = data.slice(offset, offset + length).toString("utf8");
    offset += length;
    return str;
  }

  function readU64() {
    const value = new BN(data.slice(offset, offset + 8), "le");
    offset += 8;
    return value;
  }

  return {
    last_seen_raids: readString(),
    registered_programs_count: readU64(),
    registered_users_count: readU64(),
  };
}

function customDeserializeProgramRaidProgramsState(data) {
  let offset = 0;

  function readString() {
    const length = data.readUInt32LE(offset);
    offset += 4;
    const str = data.slice(offset, offset + length).toString("utf8");
    offset += length;
    return str;
  }

  return {
    raid_program_pubkeys: readString(),
  };
}

function customDeserializeProgramRaidsState(data) {
  let offset = 0;

  function readString() {
    const length = data.readUInt32LE(offset);
    offset += 4;
    const str = data.slice(offset, offset + length).toString("utf8");
    offset += length;
    return str;
  }

  return {
    raid_pubkeys: readString(),
  };
}

function customDeserializeProgramCompetitionsState(data) {
  let offset = 0;

  function readString() {
    const length = data.readUInt32LE(offset);
    offset += 4;
    const str = data.slice(offset, offset + length).toString("utf8");
    offset += length;
    return str;
  }

  return {
    competition_pubkeys: readString(),
  };
}

function customDeserializeLeaderboard(data) {
  let offset = 0;

  function readString() {
    const length = data.readUInt32LE(offset);
    offset += 4;
    const str = data.slice(offset, offset + length).toString("utf8");
    offset += length;
    return str;
  }

  return {
    leaderboard_data: readString(),
  };
}

export function customDeserializeRaidProgramCard(data) {
  let offset = 0;

  function readPublicKey() {
    const key = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;
    return key;
  }

  function readString() {
    const length = data.readUInt32LE(offset);
    offset += 4;
    const str = data.slice(offset, offset + length).toString('utf8');
    offset += length;
    return str;
  }

  function readBool() {
    const value = data[offset] !== 0;
    offset += 1;
    return value;
  }

  function readU64() {
    const value = new BN(data.slice(offset, offset + 8), 'le');
    offset += 8;
    return value;
  }

  return {
    raid_program_id: readPublicKey(),
    name: readString(),
    description: readString(),
    user_key: readPublicKey(),
    profile_picture_url: readString(),
    pvp_requests: readString(),
    raids: readString(),
    is_conducting_raid: readBool(),
    active_raid_id: readPublicKey(),
    size: readU64(),
    total_rewards_distributed: readU64(),
    total_raid_wins: readU64(),
    total_raids_partaken: readU64(),
    program_rank: readU64(),
  };
}

export async function createEnrollInProgramTransaction(publicKey, programId) {
  // Derive PDA for user card account
  const userCardSeed = `user_card_${publicKey.toString()}`;
  const hashedSeed = sha256.arrayBuffer(userCardSeed);
  const seed = new Uint8Array(hashedSeed).slice(0, 32);

  const [userCardAccount, _] = await PublicKey.findProgramAddress(
    [seed],
    PROGRAM_ID,
  );

  // Create the instruction
  const enrollInProgramIx = new TransactionInstruction({
    keys: [
      { pubkey: publicKey, isSigner: true, isWritable: true },
      { pubkey: userCardAccount, isSigner: false, isWritable: true },
      { pubkey: new PublicKey(programId), isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data: Buffer.from([7]), // 7 is the instruction number for EnrollInProgram
  });

  // Create and return the transaction
  const transaction = new Transaction().add(enrollInProgramIx);
  return transaction;
}

export async function createAndSendEnrollInProgram(
  publicKey,
  programId,
  signTransaction,
) {
  const transaction = await createEnrollInProgramTransaction(
    publicKey,
    programId,
  );

  // Add compute budget instruction if needed
  const additionalComputeBudgetInstruction =
    ComputeBudgetProgram.setComputeUnitLimit({
      units: 1_400_000,
    });
  transaction.add(additionalComputeBudgetInstruction);
  transaction.feePayer = publicKey;

  // Obtain the blockhash and last valid block height
  const { blockhash, lastValidBlockHeight } = await executeWithFallback(
    async (connection) => {
      return await connection.getLatestBlockhash();
    },
  );

  transaction.recentBlockhash = blockhash;

  // Sign the transaction (this should not be retried)
  const signedTransaction = await signTransaction(transaction);

  // Send and confirm the transaction (this should not be retried)
  const connection = new Connection(endpoints[0], "confirmed"); // Use the first endpoint for sending the transaction
  const signature = await connection.sendRawTransaction(
    signedTransaction.serialize(),
    {
      skipPreflight: true,
      preflightCommitment: "confirmed",
    },
  );

  await connection.confirmTransaction({
    signature,
    blockhash,
    lastValidBlockHeight,
  });

  return signature;
}

export async function updateUserCardTransaction(
  publicKey,
  userEmail,
  userTwitterHandle,
  userDob,
  profilePictureUrl,
) {
  // Derive PDA for user card account
  const userCardSeed = `user_card_${publicKey.toString()}`;
  const hashedSeed = sha256.arrayBuffer(userCardSeed);
  const seed = new Uint8Array(hashedSeed).slice(0, 32);

  const [userCardAccount, _] = await PublicKey.findProgramAddress(
    [seed],
    PROGRAM_ID,
  );

  // Create the instruction
  const updateUserCardIx = new TransactionInstruction({
    keys: [
      { pubkey: publicKey, isSigner: true, isWritable: true },
      { pubkey: userCardAccount, isSigner: false, isWritable: true },
    ],
    programId: PROGRAM_ID,
    data: Buffer.from([
      9, // Instruction number for UpdateUserCard
      ...Buffer.from(userEmail),
      ...Buffer.from(userTwitterHandle),
      ...Buffer.from(userDob),
      ...Buffer.from(profilePictureUrl),
    ]),
  });

  // Create and return the transaction
  const transaction = new Transaction().add(updateUserCardIx);
  return transaction;
}

export async function getUserCard(userPublicKey) {
  // Derive PDA for user card account
  const userCardSeed = `user_card_${userPublicKey.toString()}`;
  const hashedSeed = sha256.arrayBuffer(userCardSeed);
  const seed = new Uint8Array(hashedSeed).slice(0, 32);

  const [userCardAccount, _] = await PublicKey.findProgramAddress(
    [seed],
    PROGRAM_ID,
  );

  // Fetch the account info
  const accountInfo = await getAccountInfo(userCardAccount);

  // If the account doesn't exist, return null
  if (!accountInfo) {
    console.log("User card account does not exist");
    return null;
  }

  console.log("Raw account data length:", accountInfo.data.length);

  // Custom deserialization
  const deserializedData = customDeserializeUserCard(accountInfo.data);
  console.log("Deserialized data:", deserializedData);

  // Manually parse big number fields
  const parsedData = {
    ...deserializedData,
    total_rewards: parseBigNumber(deserializedData.total_rewards).toNumber(),
    participated_raids: parseBigNumber(
      deserializedData.participated_raids,
    ).toNumber(),
    raid_ranking: parseBigNumber(deserializedData.raid_ranking).toNumber(),
    engagement_score: parseBigNumber(
      deserializedData.engagement_score,
    ).toNumber(),
    streaks: parseBigNumber(deserializedData.streaks).toNumber(),
  };

  return new UserCard(parsedData);
}

function customDeserializeUserCard(data) {
  let offset = 0;

  function readPublicKey() {
    const key = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;
    return key;
  }

  function readString() {
    const length = data.readUInt32LE(offset);
    offset += 4;
    const str = data.slice(offset, offset + length).toString("utf8");
    offset += length;
    return str;
  }

  function readBool() {
    const value = data[offset] !== 0;
    offset += 1;
    return value;
  }

  function readU64() {
    const value = new BN(data.slice(offset, offset + 8), "le");
    offset += 8;
    return value;
  }

  return {
    user_pubkey: readPublicKey(),
    owned_programs: readString(),
    enrolled_programs: readString(),
    is_conducting_raid: readBool(),
    user_email: readString(),
    user_dob: readString(),
    user_twitter_handle: readString(),
    total_rewards: readU64(),
    participated_raids: readU64(),
    raid_ranking: readU64(),
    engagement_score: readU64(),
    streaks: readU64(),
    profile_picture_url: readString(),
  };
}

export async function updateUserCard(
  publicKey,
  signTransaction,
  userEmail,
  userTwitterHandle,
  userDob,
  profilePictureUrl,
) {
  const transaction = await updateUserCardTransaction(
    publicKey,
    userEmail,
    userTwitterHandle,
    userDob,
    profilePictureUrl,
  );

  // Add compute budget instruction if needed
  const additionalComputeBudgetInstruction =
    ComputeBudgetProgram.setComputeUnitLimit({
      units: 1_400_000,
    });
  transaction.add(additionalComputeBudgetInstruction);
  transaction.feePayer = publicKey;

  // Obtain the blockhash and last valid block height
  const { blockhash, lastValidBlockHeight } = await executeWithFallback(
    async (connection) => {
      return await connection.getLatestBlockhash();
    },
  );

  transaction.recentBlockhash = blockhash;

  // Sign the transaction (this should not be retried)
  const signedTransaction = await signTransaction(transaction);

  // Send and confirm the transaction (this should not be retried)
  const connection = new Connection(endpoints[0], "confirmed"); // Use the first endpoint for sending the transaction
  const signature = await connection.sendRawTransaction(
    signedTransaction.serialize(),
    {
      skipPreflight: true,
      preflightCommitment: "confirmed",
    },
  );

  await connection.confirmTransaction({
    signature,
    blockhash,
    lastValidBlockHeight,
  });

  return signature;
}

export async function fetchRaidProgramData(raidProgramPubkey) {
  const accountInfo = await getAccountInfo(new PublicKey(raidProgramPubkey));
  return customDeserializeRaidProgramCard(accountInfo.data);
}

export async function fetchRaidData(raidPubkey) {
  const accountInfo = await getAccountInfo(new PublicKey(raidPubkey));
  return deserializeAccountData(RaidCardSchema, RaidCard, accountInfo);
}

export async function fetchCompetitionData(competitionPubkey) {
  const accountInfo = await getAccountInfo(new PublicKey(competitionPubkey));
  return deserializeAccountData(
    CompetitionCardSchema,
    CompetitionCard,
    accountInfo,
  );
}

export async function createRaidProgramTransaction(
  publicKey,
  program,
  tokenMintPda,
) {
  // Raid Program Data Account seed derivation
  const seedString = `raid_program_${publicKey.toBase58()}_${program.name}`;
  const hashedSeed = sha256.arrayBuffer(seedString);
  const seedUint8Array = new Uint8Array(hashedSeed).slice(0, 32);
  const [raidProgramDataAccount] = await findProgramAddress(
    [seedUint8Array],
    PROGRAM_ID,
  );

  const userTokenAccount = await getAssociatedTokenAddress(
    tokenMintPda,
    publicKey,
  );

  // Raid Program Token Account seed derivation
  const raidProgramTokenAccountSeedString = `raid_program_token_account_${raidProgramDataAccount.toBase58()}`;
  const raidProgramTokenAccountHashedSeed = sha256.arrayBuffer(
    raidProgramTokenAccountSeedString,
  );
  const raidProgramTokenAccountSeed = new Uint8Array(
    raidProgramTokenAccountHashedSeed,
  ).slice(0, 32);
  const [raidProgramTokenAccount] = await findProgramAddress(
    [raidProgramTokenAccountSeed],
    PROGRAM_ID,
  );

  const [programStateAccount] = await findProgramAddress(
    [Buffer.from("program_state")],
    PROGRAM_ID,
  );

  const [programRaidProgramsStateAccount] = await findProgramAddress(
    [Buffer.from("program_raid_programs_state")],
    PROGRAM_ID,
  );

  // Derive PDA for user card account
  const userCardSeed = `user_card_${publicKey.toString()}`;
  const userHashedSeed = sha256.arrayBuffer(userCardSeed);
  const userSeed = new Uint8Array(userHashedSeed).slice(0, 32);

  const [userCardAccount, _] = await PublicKey.findProgramAddress(
    [userSeed],
    PROGRAM_ID,
  );

  function serializeString(str) {
    const bytes = Buffer.from(str, "utf8");
    return Buffer.concat([
      Buffer.from(new Uint32Array([bytes.length]).buffer),
      bytes,
    ]);
  }

  const instructionData = Buffer.concat([
    Buffer.from([2]), // Instruction discriminator for CreateRaidProgram
    serializeString(program.name),
    serializeString(program.description),
    serializeString(
      `https://bullposter.xyz/media/program_pfp/${raidProgramDataAccount.toBase58()}.png`,
    ),
  ]);

  const createRaidProgramIx = new TransactionInstruction({
    keys: [
      { pubkey: publicKey, isSigner: true, isWritable: true },
      { pubkey: userTokenAccount, isSigner: false, isWritable: true },
      { pubkey: raidProgramDataAccount, isSigner: false, isWritable: true },
      { pubkey: raidProgramTokenAccount, isSigner: false, isWritable: true },
      { pubkey: programStateAccount, isSigner: false, isWritable: true },
      {
        pubkey: programRaidProgramsStateAccount,
        isSigner: false,
        isWritable: true,
      },
      { pubkey: userCardAccount, isSigner: false, isWritable: true },
      { pubkey: tokenMintPda, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data: instructionData,
  });

  const transaction = new Transaction().add(createRaidProgramIx);
  return { transaction, raidProgramDataAccount };
}

export async function createAndSendRaidProgramTransaction(
  publicKey,
  program,
  tokenMintPda,
  signTransaction,
) {
  const { transaction, raidProgramDataAccount } =
    await createRaidProgramTransaction(publicKey, program, tokenMintPda);

  // Add the compute budget instruction
  const additionalComputeBudgetInstruction =
    ComputeBudgetProgram.setComputeUnitLimit({
      units: 1_400_000,
    });
  transaction.add(additionalComputeBudgetInstruction);
  transaction.feePayer = publicKey;

  // Obtain the blockhash and last valid block height
  const { blockhash, lastValidBlockHeight } = await executeWithFallback(
    async (connection) => {
      return await connection.getLatestBlockhash();
    },
  );

  transaction.recentBlockhash = blockhash;

  // Sign the transaction (this should not be retried)
  const signedTransaction = await signTransaction(transaction);

  // Send and confirm the transaction (this should not be retried)
  const connection = new Connection(endpoints[0], "confirmed"); // Use the first endpoint for sending the transaction
  const signature = await connection.sendRawTransaction(
    signedTransaction.serialize(),
    {
      skipPreflight: true,
      preflightCommitment: "confirmed",
    },
  );

  await connection.confirmTransaction({
    signature,
    blockhash,
    lastValidBlockHeight,
  });

  return { signature, raidProgramDataAccount };
}

export async function createInitiateRaidTransaction(
  publicKey,
  raidProgramPubkey,
  raidType,
  pvpOpponent,
  lastSeenRaids,
) {
  const encoder = new TextEncoder();
  const [programState] = await findProgramAddress(
    [Buffer.from("program_state")],
    PROGRAM_ID,
  );
  const [programRaidsState] = await findProgramAddress(
    [Buffer.from("program_raids_state")],
    PROGRAM_ID,
  );
  const [programCompetitionsState] = await findProgramAddress(
    [Buffer.from("program_competitions_state")],
    PROGRAM_ID,
  );

  const competitionType = raidType === "PvP" ? "PvP" : raidType;

  let sequence;
  if (
    lastSeenRaids &&
    lastSeenRaids[competitionType] &&
    lastSeenRaids[competitionType].sequence
  ) {
    sequence = parseInt(lastSeenRaids[competitionType].sequence, 10);
    if (isNaN(sequence)) {
      console.error(
        "Invalid sequence number:",
        lastSeenRaids[competitionType].sequence,
      );
      sequence = 1;
    }
  } else {
    console.log("No previous sequence found for this competition type");
    sequence = 1;
  }

  let currentCompetitionId;
  let newCompetitionId;
  if (competitionType === "PvP") {
    currentCompetitionId = `${raidProgramPubkey}_${competitionType}_${sequence}_${pvpOpponent}`;
    newCompetitionId = `${raidProgramPubkey}_${competitionType}_${sequence + 1}_${pvpOpponent}`;
  } else {
    currentCompetitionId = `${competitionType}_${sequence}`;
    newCompetitionId = `${competitionType}_${sequence + 1}`;
  }

  const currentSeedBuffer = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(currentCompetitionId),
  );
  const currentSeedUint8Array = new Uint8Array(currentSeedBuffer).slice(0, 32);

  const newSeedBuffer = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(newCompetitionId),
  );
  const newSeedUint8Array = new Uint8Array(newSeedBuffer).slice(0, 32);

  const [currentCompetitionAccount] = await findProgramAddress(
    [currentSeedUint8Array],
    PROGRAM_ID,
  );
  const [newCompetitionAccount] = await findProgramAddress(
    [newSeedUint8Array],
    PROGRAM_ID,
  );

  // Determine raid card accounts
  const currentRaidCardId = `raid_${currentCompetitionId}_${raidProgramPubkey}`;
  const newRaidCardId = `raid_${newCompetitionId}_${raidProgramPubkey}`;

  const currentRaidCardSeedBuffer = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(currentRaidCardId),
  );
  const currentRaidCardSeedUint8Array = new Uint8Array(
    currentRaidCardSeedBuffer,
  ).slice(0, 32);

  const newRaidCardSeedBuffer = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(newRaidCardId),
  );
  const newRaidCardSeedUint8Array = new Uint8Array(newRaidCardSeedBuffer).slice(
    0,
    32,
  );

  const [currentRaidCardAccount] = await findProgramAddress(
    [currentRaidCardSeedUint8Array],
    PROGRAM_ID,
  );
  const [newRaidCardAccount] = await findProgramAddress(
    [newRaidCardSeedUint8Array],
    PROGRAM_ID,
  );

  // Create raid instruction
  const createRaidIx = new TransactionInstruction({
    keys: [
      { pubkey: publicKey, isSigner: true, isWritable: true },
      { pubkey: currentCompetitionAccount, isSigner: false, isWritable: true },
      { pubkey: newCompetitionAccount, isSigner: false, isWritable: true },
      {
        pubkey: new PublicKey(raidProgramPubkey),
        isSigner: false,
        isWritable: true,
      },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: currentRaidCardAccount, isSigner: false, isWritable: true },
      { pubkey: newRaidCardAccount, isSigner: false, isWritable: true },
      { pubkey: programState, isSigner: false, isWritable: true },
      { pubkey: programRaidsState, isSigner: false, isWritable: true },
      { pubkey: programCompetitionsState, isSigner: false, isWritable: true },
    ],
    programId: PROGRAM_ID,
    data: Buffer.from([4, ...Buffer.from(raidType)]), // 4 is the instruction number for CreateRaid
  });

  // Add PvP-specific account if necessary
  if (raidType === "PvP") {
    const challengedProgramAccount = new PublicKey(pvpOpponent);
    createRaidIx.keys.push({
      pubkey: challengedProgramAccount,
      isSigner: false,
      isWritable: false,
    });
  }

  const transaction = new Transaction().add(createRaidIx);
  return {
    transaction,
    currentCompetitionAccount,
    newCompetitionAccount,
    currentRaidCardAccount,
    newRaidCardAccount,
  };
}

export async function createAndSendInitiateRaidTransaction(
  publicKey,
  raidProgramPubkey,
  raidType,
  pvpOpponent,
  lastSeenRaids,
  signTransaction,
) {
  const {
    transaction,
    currentCompetitionAccount,
    newCompetitionAccount,
    currentRaidCardAccount,
    newRaidCardAccount,
  } = await createInitiateRaidTransaction(
    publicKey,
    raidProgramPubkey,
    raidType,
    pvpOpponent,
    lastSeenRaids,
  );

  // Add compute budget instruction
  transaction.add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }),
  );
  transaction.feePayer = publicKey;

  // Obtain the blockhash and last valid block height
  const { blockhash, lastValidBlockHeight } = await executeWithFallback(
    async (connection) => {
      return await connection.getLatestBlockhash();
    },
  );

  transaction.recentBlockhash = blockhash;

  // Sign the transaction (this should not be retried)
  const signedTransaction = await signTransaction(transaction);

  // Send and confirm the transaction (this should not be retried)
  const connection = new Connection(endpoints[0], "confirmed"); // Use the first endpoint for sending the transaction
  const signature = await connection.sendRawTransaction(
    signedTransaction.serialize(),
    {
      skipPreflight: true,
      preflightCommitment: "confirmed",
    },
  );

  await connection.confirmTransaction({
    signature,
    blockhash,
    lastValidBlockHeight,
  });

  return {
    signature,
    currentCompetitionAccount,
    newCompetitionAccount,
    currentRaidCardAccount,
    newRaidCardAccount,
  };
}

export async function deserializeAccountData(schema, classType, accountInfo) {
  return executeWithFallback(() => {
    const deserializedData = borsh.deserialize(
      schema,
      classType,
      accountInfo.data,
    );
    return new classType(deserializedData);
  });
}

function parseBigNumber(value) {
  if (BN.isBN(value)) return value;
  if (typeof value === "number") return new BN(value);
  if (typeof value === "object" && value !== null && "words" in value) {
    return new BN(value.words.reverse());
  }
  return new BN(0);
}

// UserCard class definition
export class UserCard {
  constructor(fields) {
    this.user_pubkey = new PublicKey(fields.user_pubkey);
    this.owned_programs = fields.owned_programs;
    this.enrolled_programs = fields.enrolled_programs;
    this.is_conducting_raid = fields.is_conducting_raid;
    this.user_email = fields.user_email;
    this.user_dob = fields.user_dob;
    this.user_twitter_handle = fields.user_twitter_handle;
    this.total_rewards = fields.total_rewards;
    this.participated_raids = fields.participated_raids;
    this.raid_ranking = fields.raid_ranking;
    this.engagement_score = fields.engagement_score;
    this.streaks = fields.streaks;
    this.profile_picture_url = fields.profile_picture_url;
  }
}

// UserCard schema for borsh serialization/deserialization
export const UserCardSchema = new Map([
  [
    UserCard,
    {
      kind: "struct",
      fields: [
        ["user_pubkey", [32]],
        ["owned_programs", "string"],
        ["enrolled_programs", "string"],
        ["is_conducting_raid", "u8"],
        ["user_email", "string"],
        ["user_dob", "string"],
        ["user_twitter_handle", "string"],
        ["total_rewards", "u64"],
        ["participated_raids", "u64"],
        ["raid_ranking", "u64"],
        ["engagement_score", "u64"],
        ["streaks", "u64"],
        ["profile_picture_url", "string"],
      ],
    },
  ],
]);

export class RaidProgramCard {
  constructor(fields) {
    this.raid_program_id = new PublicKey(fields.raid_program_id);
    this.name = fields.name;
    this.description = fields.description;
    this.user_key = new PublicKey(fields.user_key);
    this.profile_picture_url = fields.profile_picture_url;
    this.pvp_requests = fields.pvp_requests;
    this.raids = fields.raids;
    this.is_conducting_raid = fields.is_conducting_raid;
    this.active_raid_id = new PublicKey(fields.active_raid_id);
    this.size = fields.size;
    this.total_rewards_distributed = fields.total_rewards_distributed;
    this.total_raid_wins = fields.total_raid_wins;
    this.total_raids_partaken = fields.total_raids_partaken;
    this.program_rank = fields.program_rank;
  }
}

export const RaidProgramCardSchema = new Map([
  [
    RaidProgramCard,
    {
      kind: "struct",
      fields: [
        ["raid_program_id", [32]],
        ["name", "string"],
        ["description", "string"],
        ["user_key", [32]],
        ["profile_picture_url", "string"],
        ["pvp_requests", "string"],
        ["raids", "string"],
        ["is_conducting_raid", "u8"],
        ["active_raid_id", [32]],
        ["size", "u64"],
        ["total_rewards_distributed", "u64"],
        ["total_raid_wins", "u64"],
        ["total_raids_partaken", "u64"],
        ["program_rank", "u64"],
      ],
    },
  ],
]);

export class ProgramStateCard {
  constructor(fields) {
    this.last_seen_raids = fields.last_seen_raids;
    this.registered_programs_count = fields.registered_programs_count;
    this.registered_users_count = fields.registered_users_count;
  }
}

export const ProgramStateCardSchema = new Map([
  [
    ProgramStateCard,
    {
      kind: "struct",
      fields: [
        ["last_seen_raids", "string"],
        ["registered_programs_count", "u64"],
        ["registered_users_count", "u64"],
      ],
    },
  ],
]);

export class ProgramRaidProgramsStateCard {
  constructor(fields) {
    this.raid_program_pubkeys = fields.raid_program_pubkeys;
  }
}

export const ProgramRaidProgramsStateCardSchema = new Map([
  [
    ProgramRaidProgramsStateCard,
    {
      kind: "struct",
      fields: [["raid_program_pubkeys", "string"]],
    },
  ],
]);

export class ProgramRaidsStateCard {
  constructor(fields) {
    this.raid_pubkeys = fields.raid_pubkeys;
  }
}

export const ProgramRaidsStateCardSchema = new Map([
  [
    ProgramRaidsStateCard,
    {
      kind: "struct",
      fields: [["raid_pubkeys", "string"]],
    },
  ],
]);

export class ProgramCompetitionsStateCard {
  constructor(fields) {
    this.competition_pubkeys = fields.competition_pubkeys;
  }
}

export const ProgramCompetitionsStateCardSchema = new Map([
  [
    ProgramCompetitionsStateCard,
    {
      kind: "struct",
      fields: [["competition_pubkeys", "string"]],
    },
  ],
]);

export class ProgramLeaderboardStateCard {
  constructor(fields) {
    this.leaderboard_data = fields.leaderboard_data;
  }
}

export const ProgramLeaderboardStateCardSchema = new Map([
  [
    ProgramLeaderboardStateCard,
    {
      kind: "struct",
      fields: [["leaderboard_data", "string"]],
    },
  ],
]);

export class RaidHistory {
  constructor(fields) {
    this.history = fields.history;
  }
}

export const RaidHistorySchema = new Map([
  [
    RaidHistory,
    {
      kind: "struct",
      fields: [["history", "string"]],
    },
  ],
]);

// RaidCard class definition
export class RaidCard {
  constructor(fields) {
    this.competition_id = new PublicKey(fields.competition_id);
    this.raid_program_id = new PublicKey(fields.raid_program_id);
    this.raid_id = new PublicKey(fields.raid_id);
  }
}

// RaidCard schema for borsh serialization/deserialization
export const RaidCardSchema = new Map([
  [
    RaidCard,
    {
      kind: "struct",
      fields: [
        ["competition_id", [32]],
        ["raid_program_id", [32]],
        ["raid_id", [32]],
      ],
    },
  ],
]);

// CompetitionCard class definition
export class CompetitionCard {
  constructor(fields) {
    this.competition_id = new PublicKey(fields.competition_id);
    this.competition_type = fields.competition_type;
    this.start_time = fields.start_time;
    this.end_time = fields.end_time;
    this.total_rewards_distributed = fields.total_rewards_distributed;
    this.status = fields.status;
    this.enrolled_programs = fields.enrolled_programs;
    this.required_programs = fields.required_programs;
    this.challenger_program_id = fields.challenger_program_id
      ? new PublicKey(fields.challenger_program_id)
      : null;
    this.challenged_program_id = fields.challenged_program_id
      ? new PublicKey(fields.challenged_program_id)
      : null;
    this.start_expiration = fields.start_expiration;
  }
}

// CompetitionCard schema for borsh serialization/deserialization
export const CompetitionCardSchema = new Map([
  [
    CompetitionCard,
    {
      kind: "struct",
      fields: [
        ["competition_id", [32]],
        ["competition_type", "string"],
        ["start_time", "u64"],
        ["end_time", "u64"],
        ["total_rewards_distributed", "u64"],
        ["status", "string"],
        ["enrolled_programs", "string"],
        ["required_programs", "u64"],
        ["challenger_program_id", { kind: "option", type: [32] }],
        ["challenged_program_id", { kind: "option", type: [32] }],
        ["start_expiration", { kind: "option", type: "u64" }],
      ],
    },
  ],
]);
