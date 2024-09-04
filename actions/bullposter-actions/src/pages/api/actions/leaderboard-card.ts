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
  const { competitionId } = req.query;

  // Fetch competition data from Django backend
  const competitionData = await fetch(
    `https://your-django-backend.com/api/competition/${competitionId}`,
  ).then((res) => res.json());

  const payload: ActionGetResponse = {
    title: "Leaderboard",
    icon: "https://example.com/icon.png",
    description: `Leaderboard for competition ${competitionData.name}`,
    label: "View Leaderboard",
    links: {
      actions: [
        {
          href: `/api/actions/leaderboard-blink/${competitionId}/overall-stats`,
          label: "Overall Stats",
        },
        {
          href: `/api/actions/leaderboard-blink/${competitionId}/competition-stats`,
          label: "Competition Stats",
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
      message: "Leaderboard viewed successfully!",
    },
  });

  return new Response(JSON.stringify(payload), {
    headers,
  });
};
