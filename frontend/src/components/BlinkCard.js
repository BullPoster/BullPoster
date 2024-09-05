import React, { useState, useEffect } from "react";
import "@dialectlabs/blinks/index.css";
import { Action, Blink, useAction } from "@dialectlabs/blinks";
import { useActionSolanaWalletAdapter } from "@dialectlabs/blinks/hooks/solana";

const BlinkCard = ({ actionApiUrl }) => {
  const [action, setAction] = useState(null);
  const { adapter } = useActionSolanaWalletAdapter(
    "https://api.mainnet-beta.solana.com",
  );
  const { action: fetchedAction } = useAction({ url: actionApiUrl, adapter });

  useEffect(() => {
    setAction(fetchedAction);
  }, [fetchedAction]);

  return action ? (
    <Blink action={action} websiteText={new URL(actionApiUrl).hostname} />
  ) : null;
};

export default BlinkCard;
