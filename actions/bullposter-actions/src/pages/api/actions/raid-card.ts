import {
  ActionPostResponse,
  createActionHeaders,
  createPostResponse,
  ActionGetResponse,
  ActionPostRequest,
} from "@solana/actions";

const headers = createActionHeaders({
  chainId: "mainnet", // or chainId: "devnet"
  actionVersion: "2.2.1", // the desired spec version
});

export const GET = async (req: Request) => {
  const { raidId } = req.query;

  // Fetch raid data from Django backend
  const raidData = await fetch(
    `https://your-django-backend.com/api/raid/${raidId}`,
  ).then((res) => res.json());

  const payload: ActionGetResponse = {
    title: "Raid Card",
    icon: "https://example.com/icon.png",
    description: `Details of raid ${raidData.name}`,
    label: "View Raid",
    links: {
      actions: [
        {
          href: `/api/actions/raid-card/${raidId}/join`,
          label: "Join Raid",
        },
        {
          href: `/api/actions/raid-card/${raidId}/burn`,
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
    headers,
  });
};

export const OPTIONS = GET;

export const POST = async (req: Request) => {
  const body: ActionPostRequest = await req.json();

  // Insert transaction logic here

  const payload: ActionPostResponse = await createPostResponse({
    fields: {
      transaction: "transaction-data",
      message: "Raid action performed successfully!",
    },
  });

  return new Response(JSON.stringify(payload), {
    headers,
  });
};
