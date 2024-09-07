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
  const userId = url.searchParams.get("userId");

  try {
    // Fetch user data from Django backend
    const userData = await fetch(
      `https://bullposter.xyz/api/user-card/${userId}`,
    ).then((res) => {
      if (!res.ok) {
        throw new Error("Failed to fetch user data");
      }
      return res.json();
    });

    // Constructing the response payload
    const payload: ActionGetResponse = {
      title: "User Profile",
      icon: userData.cardImage, // Use the base64 image data from the backend
      description: `Profile of user ${userData.username}`,
      label: "View Profile",
      links: {
        actions: [
          {
            href: `/api/actions/user-card/live-raid?userId=${userId}`,
            label: "Live Raid",
          },
          {
            href: `/api/actions/user-card/past-raids?userId=${userId}`,
            label: "View Past Raids",
          },
          {
            href: `/api/actions/user-card/enrolled-programs?userId=${userId}`,
            label: "Enrolled Programs",
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
