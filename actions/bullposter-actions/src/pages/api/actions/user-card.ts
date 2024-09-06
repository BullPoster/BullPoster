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
  const userId = url.searchParams.get("userId");

  // Fetch user data from Django backend
  const userData = await fetch(
    `https://bullposter.xyz/api/user-card/${userId}`,
  ).then((res) => res.json());

  // Generate user card image
  const userCardImage = await generateCardImage("UserCard", userData);

  const payload: ActionGetResponse = {
    title: "User Profile",
    icon: userCardImage,
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
      message: "Profile viewed successfully!",
    },
  });

  return new Response(JSON.stringify(payload), {
    headers,
  });
};
