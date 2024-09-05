import React, { useState, useEffect } from "react";
import { getUserData, updateUserProfile } from "../utils/api";

const Profile = () => {
  const [userData, setUserData] = useState(null);
  const [email, setEmail] = useState("");
  const [twitter, setTwitter] = useState("");
  const [profilePicture, setProfilePicture] = useState(null);
  const [dob, setDob] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    setIsLoading(true);
    try {
      const data = await getUserData();
      setUserData(data);
      setEmail(data.email || "");
      setTwitter(data.twitter || "");
      setProfilePicture(data.profilePicture || "");
      setDob(data.dob || "");
    } catch (err) {
      setError("Failed to fetch user data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await updateUserProfile({
        email,
        twitter,
        dob,
        profilePicture,
      });
      setUserData({
        ...userData,
        email,
        twitter,
        dob,
        profilePicture,
      });
      setError(null);
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

  return (
    <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
      <h2 className="text-2xl font-bold mb-4 text-green-400">
        Profile Settings
      </h2>
      <form onSubmit={handleSubmit} className="space-y-4">
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
            onChange={(e) => setProfilePicture(e.target.files[0])}
            className="mt-1 block w-full text-white"
          />
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
