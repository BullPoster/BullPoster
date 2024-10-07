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
  const competitionId = searchParams.get('competitionId');

  if (!competitionId) {
    return NextResponse.json({ error: "competitionId is required" }, { status: 400, headers: { ...headers, ...corsHeaders } });
  }

  try {
    const response = await fetch(`https://bullposter.xyz/api/leaderboard-card/${competitionId}`, {
      headers: { "Accept-Encoding": "gzip, deflate, br" },
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const competitionData = await response.json();

    const payload: ActionGetResponse = {
      title: "Leaderboard",
      icon: competitionData.icon || "https://example.com/default-icon.png",
      description: `Leaderboard for competition ${competitionData.name}`,
      label: "View Leaderboard",
      links: {
        actions: [
          { href: `/actions/leaderboard-blink/overall-stats?competitionId=${competitionId}`, label: "Overall Stats" },
          { href: `/actions/leaderboard-blink/competition-stats?competitionId=${competitionId}`, label: "Competition Stats" },
        ],
      },
    };

    return NextResponse.json(payload, { 
      status: 200, 
      headers: { ...headers, ...corsHeaders, "Content-Encoding": "gzip" } 
    });
  } catch (error) {
    console.error("Error fetching competition data:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500, headers: { ...headers, ...corsHeaders } });
  }
}
