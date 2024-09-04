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
  const { programId } = req.query;

  // Fetch program data from Django backend
  const programData = await fetch(
    `https://your-django-backend.com/api/program/${programId}`,
  ).then((res) => res.json());

  const payload: ActionGetResponse = {
    title: "Program Card",
    icon: "https://example.com/icon.png",
    description: `Details of program ${programData.name}`,
    label: "View Program",
    links: {
      actions: [
        {
          href: `/api/actions/program-card-raid/${programId}/live-raid`,
          label: "Live Raid",
        },
        {
          href: `/api/actions/program-card-raid/${programId}/past-raids`,
          label: "Past Raids",
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
      message: "Program action performed successfully!",
    },
  });

  return new Response(JSON.stringify(payload), {
    headers,
  });
};
