import { NextRequest, NextResponse } from "next/server";
import { createActionHeaders, ActionPostResponse } from "@solana/actions";
import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
} from "@solana/web3.js";
import crypto from "crypto";

const headers = createActionHeaders({
  chainId: "devnet",
  actionVersion: "2.2.1",
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, Content-Encoding, Accept-Encoding",
};

const PROGRAM_ID = new PublicKey(
  "CCSgM1PutSAQKYvkfuweL8Wt1mgET2VjAtg4YVnjXJ88",
);

const deriveEnrollmentPDA = async (
  raidProgramId: PublicKey,
  userPublicKey: PublicKey,
) => {
  const encoder = new TextEncoder();
  const seedString = `enrollment_${raidProgramId.toBase58()}_${userPublicKey.toBase58()}`;
  const seedBuffer = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(seedString),
  );
  const seedUint8Array = new Uint8Array(seedBuffer).slice(0, 32);
  const [enrollmentPDA] = await PublicKey.findProgramAddress(
    [seedUint8Array],
    PROGRAM_ID,
  );
  return enrollmentPDA;
};

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { account } = body;
  const raidProgramAccountPublicKey = request.nextUrl.searchParams.get(
    "raidProgramAccountPublicKey",
  );

  // Connect to Solana devnet with multiple fallback endpoints
  const endpoints = [
    "https://api.devnet.solana.com",
    "https://devnet-rpc.shyft.to?api_key=QU6nR4Sn0RjrTpEU",
    "https://devnet-rpc.shyft.to?api_key=MrpOPjGhO45RmpIq",
    "https://devnet-rpc.shyft.to?api_key=Y4heuXMr81Vo4fKX",
    "https://devnet-rpc.shyft.to?api_key=eUaIgOEEUvcHalKp",
  ];

  let connection;
  let recentBlockhash;

  for (const endpoint of endpoints) {
    try {
      connection = new Connection(endpoint, "confirmed");
      const { blockhash } = await connection.getLatestBlockhash();
      recentBlockhash = blockhash;
      break;
    } catch (error) {
      console.error(`Failed to connect to ${endpoint}:`, error);
    }
  }

  if (!connection || !recentBlockhash) {
    throw new Error("Failed to connect to any Solana endpoint");
  }

  if (!account || !raidProgramAccountPublicKey) {
    return NextResponse.json(
      { error: "Account and Raid Program Account Public Key are required" },
      { status: 400, headers: { ...headers, ...corsHeaders } },
    );
  }

  const userPubkey = new PublicKey(account);
  const raidProgramPubkey = new PublicKey(raidProgramAccountPublicKey);

  // Derive PDA for enrollment account
  const enrollmentAccountPDA = await deriveEnrollmentPDA(
    raidProgramPubkey,
    userPubkey,
  );

  // Create the enrollment instruction
  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: userPubkey, isSigner: true, isWritable: true },
      { pubkey: raidProgramPubkey, isSigner: false, isWritable: false },
      { pubkey: enrollmentAccountPDA, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data: Buffer.from([7]), // Instruction index for enroll_in_program
  });

  // Create a new transaction and add the instruction
  const transaction = new Transaction().add(instruction);

  // Set the recent blockhash and fee payer
  transaction.recentBlockhash = recentBlockhash;
  transaction.feePayer = userPubkey;

  // Serialize the transaction
  const serializedTransaction = transaction.serialize({
    requireAllSignatures: false,
    verifySignatures: false,
  });

  console.error("Transaction Serialized", serializedTransaction);

  const payload: ActionPostResponse = {
    transaction: serializedTransaction.toString("base64"),
    message: `Please sign this transaction to enroll in the raid program: ${raidProgramAccountPublicKey}`,
  };

  return NextResponse.json(payload, {
    status: 200,
    headers: { ...headers, ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}
