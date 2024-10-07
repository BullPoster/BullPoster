import React, { useState, useEffect } from "react";
import "@dialectlabs/blinks/index.css";
import { Action, Blink, useAction } from "@dialectlabs/blinks";
import { useActionSolanaWalletAdapter } from "@dialectlabs/blinks/hooks/solana";

const BlinkCard = ({ actionApiUrl }) => {
  const [action, setAction] = useState(null);
  const { adapter } = useActionSolanaWalletAdapter(
    "https://api.devnet.solana.com",
  );
  const { action: fetchedAction } = useAction({ url: actionApiUrl, adapter });

  console.log("From Action URL:", actionApiUrl);

  useEffect(() => {
    console.log("Fetched Action:", fetchedAction);
    setAction(fetchedAction);
  }, [fetchedAction]);

  return action ? (
    <Blink action={action} websiteText={new URL(actionApiUrl).hostname} />
  ) : null;
};

export default BlinkCard;
