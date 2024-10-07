import { NextResponse } from 'next/server';
import { createActionHeaders, ActionGetResponse } from "@solana/actions";

const headers = createActionHeaders({
  chainId: "mainnet",
  actionVersion: "2.2.1",
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Content-Encoding, Accept-Encoding",
};

export async function OPTIONS() {
  return NextResponse.json({}, { status: 204, headers: corsHeaders });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raidId = searchParams.get('raidId');

  if (!raidId) {
    return NextResponse.json({ error: "raidId is required" }, { status: 400, headers: { ...headers, ...corsHeaders } });
  }

  try {
    const response = await fetch(`https://bullposter.xyz/api/raid-card/${raidId}`, {
      headers: { "Accept-Encoding": "gzip, deflate, br" },
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const raidData = await response.json();

    const payload: ActionGetResponse = {
      title: "Raid Card",
      icon: raidData.cardImage,
      description: `Details of raid ${raidData.name}`,
      label: "View Raid",
      links: {
        actions: [
          { href: `/actions/raid-card/join?raidId=${raidId}`, label: "Join Raid" },
          { 
            href: `/actions/raid-card/burn?raidId=${raidId}`,
            label: "Burn Tokens",
            parameters: [
              { name: "amount", label: "Enter amount to burn", type: "number", required: true },
            ],
          },
        ],
      },
    };

    return NextResponse.json(payload, { 
      status: 200, 
      headers: { ...headers, ...corsHeaders, "Content-Encoding": "gzip" } 
    });
  } catch (error) {
    console.error("Error fetching raid data:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500, headers: { ...headers, ...corsHeaders } });
  }
}
