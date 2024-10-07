import React, { useState, useEffect } from "react";

const PresaleTracker = () => {
  const [tokensSold, setTokensSold] = useState(0);
  const [totalTokens] = useState(1000000);
  const [error, setError] = useState(null);

  //  useEffect(() => {
  //    const fetchTokensSold = async () => {
  //      try {
  //        const response = await fetch(
  //          "https://bullposter.xyz/api/presale-status/",
  //        );
  //        if (!response.ok) {
  //          throw new Error(`HTTP error! status: ${response.status}`);
  //        }
  //        const data = await response.json();
  //        if (data.status === "success") {
  //          setTokensSold(data.tokens_sold);
  //        } else {
  //          setError("Failed to fetch presale status");
  //        }
  //      } catch (error) {
  //        console.error("Error fetching pre-sale status:", error);
  //        setError("Failed to fetch presale status");
  //      }
  //    };
  //
  //    fetchTokensSold();
  //    const interval = setInterval(fetchTokensSold, 60000);
  //
  //    return () => clearInterval(interval);
  //  }, []);

  if (error) {
    return <div className="text-red-500">Error: {error}</div>;
  }

  const progressPercentage = (tokensSold / totalTokens) * 100;

  return (
    <div className="bg-black rounded-lg p-4 shadow-lg mb-8 border border-green">
      <h3 className="text-lg font-semibold mb-2 text-green">
        Pre-sale Progress
      </h3>
      <div className="w-full bg-gray-700 rounded-full h-2.5">
        <div
          className="bg-green h-2.5 rounded-full"
          style={{ width: `${progressPercentage}%` }}
        ></div>
      </div>
      <p className="mt-2 text-white">
        {tokensSold.toLocaleString()} / {totalTokens.toLocaleString()}{" "}
        BullPoster Tokens Sold
      </p>
    </div>
  );
};

export default PresaleTracker;
