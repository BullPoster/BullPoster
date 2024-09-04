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
     const url = new URL(req.url);
     const userId = url.searchParams.get('userId');

     if (!userId) {
       return new Response(JSON.stringify({ error: 'User ID is required' }), {
         status: 400,
         headers,
       });
     }

     // Fetch user data from Django backend
     const userData = await fetch(`https://your-django-backend.com/api/user/${userId}`).then(res => res.json());

     const payload: ActionGetResponse = {
       title: "User Card",
       icon: 'https://example.com/icon.png',
       description: `Profile of user ${userData.name}`,
       label: "View Profile",
       links: {
         actions: [
           {
             href: `/api/actions/user-card?userId=${userId}&action=live-raid`,
             label: 'Live Raid',
           },
           {
             href: `/api/actions/user-card?userId=${userId}&action=past-raids`,
             label: 'View Past Raids',
           },
           {
             href: `/api/actions/user-card?userId=${userId}&action=enrolled-programs`,
             label: 'Enrolled Programs',
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
         transaction: 'transaction-data',
         message: "Profile viewed successfully!",
       },
     });

     return new Response(JSON.stringify(payload), {
       headers,
     });
   };
