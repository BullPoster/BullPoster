import {
  ActionPostResponse,
  createActionHeaders,
  createPostResponse,
  ActionGetResponse,
  ActionPostRequest,
} from "@solana/actions";
import { generateCardImage } from "../../../utils/generateImage";

const headers = createActionHeaders({
  chainId: "mainnet", // or chainId: "devnet"
  actionVersion: "2.2.1", // the desired spec version
});

export const GET = async (req: Request) => {
  const url = new URL(req.url);
  const raidId = url.searchParams.get("raidId");

  // Fetch raid data from Django backend
  const raidData = await fetch(
    `https://your-django-backend.com/api/raid/${raidId}`,
  ).then((res) => res.json());

  // Generate raid card image
  const raidCardImage = await generateCardImage("RaidCard", raidData);

  const payload: ActionGetResponse = {
    title: "Raid Card",
    icon: raidCardImage,
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
