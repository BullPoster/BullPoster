import React, { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { PROGRAM_ID, getUserCard, updateUserCard } from "../utils/solanaUtils";
import { uploadProfilePicture } from "../utils/api";
import BlinkCard from "./BlinkCard";
import { sha256 } from "js-sha256";

const Profile = () => {
  const { publicKey, signTransaction } = useWallet();
  const [userData, setUserData] = useState(null);
  const [userCardPubkey, setuserCardPubkey] = useState("");
  const [email, setEmail] = useState("");
  const [twitter, setTwitter] = useState("");
  const [profilePicture, setProfilePicture] = useState(null);
  const [profilePicturePreview, setProfilePicturePreview] = useState(null);
  const [dob, setDob] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    setIsLoading(true);
    try {
      const userCard = await getUserCard(publicKey);
      // Derive PDA for user card account
      const userCardSeed = `user_card_${publicKey.toBase58()}`;
      const hashedSeed = sha256.arrayBuffer(userCardSeed);
      const seed = new Uint8Array(hashedSeed).slice(0, 32);

      const [userCardAccount, _] = await PublicKey.findProgramAddress(
        [seed],
        PROGRAM_ID,
      );

      console.log(userCardAccount);
      setUserData(userCard);
      setuserCardPubkey(userCardAccount.toBase58());
      setEmail(userCard.user_email || "");
      setTwitter(userCard.user_twitter_handle || "");
      setDob(userCard.user_dob || "");
      setProfilePicturePreview(
        userCard.profile_picture_url ||
          "https://bullposter.xyz/media/user_pfp/default.png",
      );
    } catch (err) {
      setError("Failed to fetch user data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type === "image/png") {
      setProfilePicture(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePicturePreview(reader.result);
      };
      reader.readAsDataURL(file);
    } else {
      setError("Only PNG images are allowed");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const signature = await updateUserCard(
        publicKey,
        signTransaction,
        email,
        twitter,
        dob,
        profilePicture
          ? await uploadProfilePicture(profilePicture)
          : userData.profile_picture_url,
      );
      console.log("User card updated. Transaction signature:", signature);
      setError(null);
      fetchUserData(); // Refresh user data after update
    } catch (err) {
      setError("Failed to update profile");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <div className="text-center">Loading...</div>;
  }

  if (error) {
    return <div className="text-center text-red-500">{error}</div>;
  }

  const userCardApiUrl = `https://bullposter.xyz/actions/user-card?userId=${userCardPubkey}`;
  console.log("User Card API URL:", userCardApiUrl); // Add logging
  return (
    <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
      <h2 className="text-2xl font-bold mb-4 text-green-400">
        Profile Settings
      </h2>
      <div className="mt-8">
        <h3 className="text-xl font-semibold mb-4 text-green-400">User Card</h3>
        <div className="flex justify-center">
          <div className="w-full max-w-sm">
            {" "}
            {/* Adjusted to max-w-sm for consistency */}
            <BlinkCard actionApiUrl={userCardApiUrl} />
          </div>
        </div>
        <div className="mt-2 flex justify-center">
          <div className="w-full max-w-sm">
            {" "}
            {/* Matching width for consistency */}
            <input
              type="text"
              value={userCardApiUrl}
              readOnly
              className="w-full p-2 bg-gray-700 text-white rounded"
            />
            <button
              onClick={() => navigator.clipboard.writeText(userCardApiUrl)}
              className="w-full mt-2 bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded"
            >
              Copy URL
            </button>
          </div>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4 mt-8">
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-300"
          >
            Email
          </label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full rounded-md bg-gray-700 border-gray-600 text-white focus:border-green-500 focus:ring-green-500"
            required
          />
        </div>
        <div>
          <label
            htmlFor="twitter"
            className="block text-sm font-medium text-gray-300"
          >
            Twitter Handle
          </label>
          <input
            type="text"
            id="twitter"
            value={twitter}
            onChange={(e) => setTwitter(e.target.value)}
            className="mt-1 block w-full rounded-md bg-gray-700 border-gray-600 text-white focus:border-green-500 focus:ring-green-500"
          />
        </div>
        <div>
          <label
            htmlFor="dob"
            className="block text-sm font-medium text-gray-300"
          >
            Date of Birth
          </label>
          <input
            type="date"
            id="dob"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            className="mt-1 block w-full rounded-md bg-gray-700 border-gray-600 text-white focus:border-green-500 focus:ring-green-500"
          />
        </div>
        <div className="flex items-center">
          {profilePicturePreview && (
            <div className="mr-4">
              <img
                src={profilePicturePreview}
                alt="Profile Preview"
                className="w-24 h-24 object-cover rounded-full"
              />
            </div>
          )}
          <div>
            <label
              htmlFor="profile_picture"
              className="block text-sm font-medium text-gray-300"
            >
              Profile Picture
            </label>
            <input
              type="file"
              id="profile_picture"
              accept="image/png"
              onChange={handleFileChange}
              className="hidden"
            />
            <label
              htmlFor="profile_picture"
              className="mt-1 block w-full bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded cursor-pointer text-center"
            >
              Choose Image
            </label>
          </div>
        </div>
        <button
          type="submit"
          className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded transition duration-300"
          disabled={isLoading}
        >
          {isLoading ? "Updating..." : "Update Profile"}
        </button>
      </form>
    </div>
  );
};

export default Profile;
