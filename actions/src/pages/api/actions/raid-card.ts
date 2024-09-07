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
  const raidId = url.searchParams.get("raidId");

  try {
    // Fetch raid data from Django backend
    const raidData = await fetch(
      `https://bullposter.xyz/api/raid-card/${raidId}`,
    ).then((res) => {
      if (!res.ok) {
        throw new Error("Failed to fetch raid data");
      }
      return res.json();
    });

    const payload: ActionGetResponse = {
      title: "Raid Card",
      icon: raidData.cardImage, // Use the base64 image data from the backend
      description: `Details of raid ${raidData.name}`,
      label: "View Raid",
      links: {
        actions: [
          {
            href: `/api/actions/raid-card/join?raidId=${raidId}`,
            label: "Join Raid",
          },
          {
            href: `/api/actions/raid-card/burn?raidId=${raidId}`,
            label: "Burn Tokens",
            parameters: [
              {
                name: "amount",
                label: "Enter amount to burn",
                type: "number",
                required: true,
              },
            ],
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
