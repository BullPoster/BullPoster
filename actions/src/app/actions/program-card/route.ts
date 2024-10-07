import { Connection, PublicKey } from "@solana/web3.js";
import { NextResponse } from 'next/server';
import {
  createActionHeaders,
  ActionGetResponse,
  ActionPostResponse,
} from "@solana/actions";
import BN from "bn.js";

const headers = createActionHeaders({
  chainId: "devnet",
  actionVersion: "2.2.1",
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Content-Encoding, Accept-Encoding",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

const connection = new Connection("https://api.devnet.solana.com");

// Define the program ID
const PROGRAM_ID = new PublicKey("FY9aF1jszyGoABygvsQ28oHfqgyUVZkttzr8Vcx7sLKH");

export const GET = async (req: Request) => {
  console.log("GET request received");
  try {
    console.log("Parsing URL");
    const url = new URL(req.url);
    const raidProgramAccountPublicKey = url.searchParams.get(
      "raidProgramAccountPublicKey",
    );
    console.log("raidProgramAccountPublicKey:", raidProgramAccountPublicKey);

    if (!raidProgramAccountPublicKey) {
      console.log("Missing raidProgramAccountPublicKey parameter");
      return new Response(
        JSON.stringify({
          error: "Missing raidProgramAccountPublicKey parameter",
        }),
        {
          status: 400,
          headers: { ...headers, ...corsHeaders },
        },
      );
    }

    console.log("Creating PublicKey");
    const publicKey = new PublicKey(raidProgramAccountPublicKey);

    console.log("Fetching account info");
    const accountInfo = await connection.getAccountInfo(publicKey);
    console.log("Account info received:", accountInfo);

    if (!accountInfo) {
      console.log("Failed to fetch account info");
      throw new Error("Failed to fetch account info");
    }

    console.log("Parsing program data");
    const parsedData = customDeserializeRaidProgramCard(accountInfo.data);
    console.log("Parsed data:", parsedData);

    console.log("Finding program state PDA");
    const [programStatePDA] = await PublicKey.findProgramAddress(
      [Buffer.from("program_state")],
      PROGRAM_ID,
    );
    console.log("Program state PDA:", programStatePDA.toBase58());

    console.log("Fetching program state account info");
    const programStateAccountInfo = await connection.getAccountInfo(programStatePDA);
    console.log("Program state account info received:", programStateAccountInfo);

    if (!programStateAccountInfo) {
      console.log("Failed to fetch program state account info");
      throw new Error("Failed to fetch program state account info");
    }

    console.log("Parsing program state data");
    const programStateData = customDeserializeProgramState(
      programStateAccountInfo.data,
    );
    console.log("Program state data:", programStateData);

    console.log("Preparing data for image generation");
    const imageRequestData = {
      raidProgramAccountPublicKey: raidProgramAccountPublicKey,
      name: parsedData.name,
      description: parsedData.description,
      profilePictureUrl: parsedData.profile_picture_url,
      size: parsedData.size.toNumber(),
      totalRewardsDistributed: parsedData.total_rewards_distributed.toNumber(),
      totalRaidWins: parsedData.total_raid_wins.toNumber(),
      totalRaidsPartaken: parsedData.total_raids_partaken.toNumber(),
      programRank: parsedData.program_rank.toNumber(),
      totalPrograms: programStateData.registered_programs_count.toNumber(),
    };
    console.log("Image request data:", imageRequestData);

    console.log("Fetching image from Django backend");
    const imageResponse = await fetch(`https://bullposter.xyz/api/program-card/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(imageRequestData),
    });

    console.log("Image response status:", imageResponse.status);
    if (!imageResponse.ok) {
      const errorText = await imageResponse.text();
      console.error("Failed to fetch image data. Response:", errorText);
      throw new Error(`Failed to fetch image data: ${imageResponse.status} ${errorText}`);
    }

    const imageData = await imageResponse.json();
    console.log("Image data received:", imageData);

    console.log("Preparing payload");
    const payload: ActionGetResponse = {
      title: "Program Card",
      icon: `https://bullposter.xyz/media/${imageData.cardImage}`,
      description: `${parsedData.description}`,
      label: "View Program",
      links: {
        actions: [
          {
            href: `/actions/enroll?raidProgramAccountPublicKey=${raidProgramAccountPublicKey}`,
            label: "Enroll In Program",
          },
        ],
      },
    };
    console.log("Payload prepared:", payload);

    console.log("Sending response");
    return NextResponse.json(payload, {
      status: 200,
      headers: { ...headers, ...corsHeaders },
    });
  } catch (error) {
    console.error("Error in GET handler:", error);

    let errorMessage = "Unknown error occurred";
    let errorStack = "";

    if (error instanceof Error) {
      errorMessage = error.message;
      errorStack = error.stack || "";
    } else if (typeof error === "string") {
      errorMessage = error;
    }

    console.error("Error message:", errorMessage);
    console.error("Stack trace:", errorStack);

    return NextResponse.json(
      {
        error: "Internal Server Error",
        details: errorMessage,
        stack: errorStack
      },
      { status: 500, headers: { ...headers, ...corsHeaders } },
    );
  }
};

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.account || typeof body.account !== "string") {
      return NextResponse.json(
        { error: "Invalid or missing account in request body" },
        { status: 400, headers: { ...headers, ...corsHeaders } },
      );
    }

    // Here you would typically process the account and create a transaction
    // For this example, we'll just return a dummy response
    const payload: ActionPostResponse = {
      transaction: Buffer.from("dummy transaction").toString("base64"),
      message: "This is a dummy transaction for user profile view",
    };

    return NextResponse.json(payload, {
      status: 200,
      headers: {
        ...headers,
        ...corsHeaders,
      },
    });
  } catch (error) {
    console.error("Error processing POST request:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500, headers: { ...headers, ...corsHeaders } },
    );
  }
}

function customDeserializeRaidProgramCard(data: Buffer) {
  let offset = 0;

  function readPublicKey() {
    if (offset + 32 > data.length) {
      throw new Error(`Buffer overflow when reading PublicKey at offset ${offset}. Buffer length: ${data.length}`);
    }
    const key = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;
    return key;
  }

  function readString() {
    if (offset + 4 > data.length) {
      throw new Error(`Buffer overflow when reading string length at offset ${offset}. Buffer length: ${data.length}`);
    }
    const length = data.readUInt32LE(offset);
    offset += 4;
    if (offset + length > data.length) {
      throw new Error(`Buffer overflow when reading string of length ${length} at offset ${offset}. Buffer length: ${data.length}`);
    }
    const str = data.slice(offset, offset + length).toString('utf8');
    offset += length;
    return str;
  }

  function readBool() {
    if (offset + 1 > data.length) {
      throw new Error(`Buffer overflow when reading boolean at offset ${offset}. Buffer length: ${data.length}`);
    }
    const value = data[offset] !== 0;
    offset += 1;
    return value;
  }

  function readU64() {
    if (offset + 8 > data.length) {
      throw new Error(`Buffer overflow when reading U64 at offset ${offset}. Buffer length: ${data.length}`);
    }
    const value = new BN(data.slice(offset, offset + 8), 'le');
    offset += 8;
    return value;
  }

  try {
    console.log(`Starting deserialization. Buffer length: ${data.length}`);

    const result = {
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

    console.log(`Deserialization completed successfully. Final offset: ${offset}`);
    return result;
  } catch (error) {
    console.error("Error during deserialization:", error);
    throw new Error("Failed to parse program data: " + error);
  }
}

function customDeserializeProgramState(data: Buffer) {
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
