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
  const programId = url.searchParams.get("programId");

  try {
    // Fetch program data from Django backend
    const programData = await fetch(
      `https://bullposter.xyz/api/program-card/${programId}`,
    ).then((res) => {
      if (!res.ok) {
        throw new Error("Failed to fetch program data");
      }
      return res.json();
    });

    const payload: ActionGetResponse = {
      title: "Program Card",
      icon: programData.cardImage, // Use the base64 image data from the backend
      description: `Details of program ${programData.name}`,
      label: "View Program",
      links: {
        actions: [
          {
            href: `/api/actions/program-card-raid/live-raid?programId=${programId}`,
            label: "Live Raid",
          },
          {
            href: `/api/actions/program-card-raid/past-raids?programId=${programId}`,
            label: "Past Raids",
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
