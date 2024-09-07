import { createActionHeaders, ActionGetResponse } from "@solana/actions";

const headers = createActionHeaders({
  chainId: "mainnet", // or chainId: "devnet"
  actionVersion: "2.2.1", // the desired spec version
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, Content-Encoding, Accept-Encoding",
};

export const GET = async (req: Request) => {
  const url = new URL(req.url);
  const competitionId = url.searchParams.get("competitionId");

  try {
    // Fetch competition data from Django backend
    const competitionData = await fetch(
      `https://bullposter.xyz/api/leaderboard-card/${competitionId}`,
    ).then((res) => {
      if (!res.ok) {
        throw new Error("Failed to fetch competition data");
      }
      return res.json();
    });

    const payload: ActionGetResponse = {
      title: "Leaderboard",
      icon: "https://example.com/icon.png",
      description: `Leaderboard for competition ${competitionData.name}`,
      label: "View Leaderboard",
      links: {
        actions: [
          {
            href: `/api/actions/leaderboard-blink/overall-stats?competitionId=${competitionId}`,
            label: "Overall Stats",
          },
          {
            href: `/api/actions/leaderboard-blink/competition-stats?competitionId=${competitionId}`,
            label: "Competition Stats",
          },
        ],
      },
    };

    return new Response(JSON.stringify(payload), {
      headers: { ...headers, ...corsHeaders },
    });
  } catch (error) {
    const typedError = error as Error;
    return new Response(JSON.stringify({ error: typedError.message }), {
      status: 500,
      headers: { ...headers, ...corsHeaders },
    });
  }
};

export const OPTIONS = async () => {
  return new Response(null, {
    headers: corsHeaders,
  });
};

export const POST = async () => {
  const payload = {};
  return new Response(JSON.stringify(payload), {
    headers: { ...headers, ...corsHeaders },
  });
};
