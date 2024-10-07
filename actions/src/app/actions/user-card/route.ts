import { NextResponse } from "next/server";
import {
  createActionHeaders,
  ActionGetResponse,
  ActionPostResponse,
} from "@solana/actions";
import { Connection, PublicKey } from "@solana/web3.js";
import BN from "bn.js";

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
  "FY9aF1jszyGoABygvsQ28oHfqgyUVZkttzr8Vcx7sLKH",
);
const connection = new Connection("https://api.devnet.solana.com");

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json(
      { error: "userId is required" },
      { status: 400, headers: { ...headers, ...corsHeaders } },
    );
  }

  try {
    const userPubkey = new PublicKey(userId);
    const userData = await getUserCardData(userPubkey);
    console.log("Finding program state PDA");
    const [programStatePDA] = await PublicKey.findProgramAddress(
      [Buffer.from("program_state")],
      PROGRAM_ID,
    );
    console.log("Program state PDA:", programStatePDA.toBase58());

    console.log("Fetching program state account info");
    const programStateAccountInfo =
      await connection.getAccountInfo(programStatePDA);
    console.log(
      "Program state account info received:",
      programStateAccountInfo,
    );

    if (!programStateAccountInfo) {
      console.log("Failed to fetch program state account info");
      throw new Error("Failed to fetch program state account info");
    }

    console.log("Parsing program state data");
    const programState = customDeserializeProgramState(
      programStateAccountInfo.data,
    );
    console.log("Program state data:", programState);

    // Prepare data for POST request
    const postData = {
      username: userPubkey.toString(),
      profilePicture: userData.profile_picture_url,
      ranking: userData.raid_ranking.toNumber().toString(),
      totalUsers: programState.registered_users_count.toNumber().toString(),
      totalRewards: userData.total_rewards.toNumber().toString(),
      participatedRaids: userData.participated_raids.toNumber().toString(),
      engagementScore: userData.engagement_score.toNumber().toString(),
    };

    // Make POST request to the API
    const response = await fetch(`https://bullposter.xyz/api/user-card/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(postData),
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const apiData = await response.json();

    const payload: ActionGetResponse = {
      title: "User Card",
      icon: `https://bullposter.xyz/media/${apiData.cardImage}`,
      description: `Profile of user ${userPubkey.toString()}`,
      label: "View Profile",
      /* links: {
        actions: [
          {
            href: `/actions/user-card/live-raid?userId=${userId}`,
            label: "Live Raid",
          },
          {
            href: `/actions/user-card/past-raids?userId=${userId}`,
            label: "View Past Raids",
          },
          {
            href: `/actions/user-card/enrolled-programs?userId=${userId}`,
            label: "Enrolled Programs",
          },
        ],
      }, */
    };

    return NextResponse.json(payload, {
      status: 200,
      headers: { ...headers, ...corsHeaders },
    });
  } catch (error) {
    console.error("Error fetching user data:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500, headers: { ...headers, ...corsHeaders } },
    );
  }
}

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

function customDeserializeUserCard(data: Buffer) {
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

async function getUserCardData(pubkey: PublicKey) {
  const accountInfo = await connection.getAccountInfo(pubkey);
  if (!accountInfo) {
    throw new Error("User card account not found");
  }

  return customDeserializeUserCard(accountInfo.data);
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
