import axios from "axios";

const API_BASE_URL = "https://bullposter.xyz/api";

export const fetchWithAuth = async (endpoint, options = {}) => {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      credentials: "include",
      headers: {
        ...options.headers,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        const error = await response.json();
        throw new Error(error.error || "An error occurred");
      } else {
        const text = await response.text();
        console.error("Unexpected response:", text);
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    }

    return response.json();
  } catch (error) {
    console.error("API request failed:", error);
    throw error;
  }
};

export const get = (endpoint) => fetchWithAuth(endpoint);
export const post = (endpoint, data) =>
  fetchWithAuth(endpoint, {
    method: "POST",
    body: JSON.stringify(data),
  });
export const put = (endpoint, data) =>
  fetchWithAuth(endpoint, {
    method: "PUT",
    body: JSON.stringify(data),
  });
export const del = (endpoint) =>
  fetchWithAuth(endpoint, {
    method: "DELETE",
  });

export const login = (data) => post("/auth/login/", data);
export const logout = () => post("/auth/logout/");
export const getUserDashboard = (publicKey) =>
  get(`/user-dashboard/${publicKey}/`);
export const getCreatorDashboard = (publicKey) =>
  get(`/creator-dashboard/${publicKey}/`);
export const createProgram = async (formData) => {
  const response = await axios.post("/create-program/", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data;
};
export const updateProgram = async (programId, formData) => {
  const response = await axios.put(`/update-program/${programId}/`, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data;
};
export const deleteProgram = (programId) =>
  del(`/delete-program/${programId}/`);
export const initiateRaid = (programId, data) =>
  post(`/initiate-raid/${programId}/`, data);
export const joinRaid = (raidId) => post(`/join-raid/${raidId}/`);
export const getRaidStatus = (raidId) => get(`/raid-status/${raidId}/`);
export const getAvailablePrograms = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/available-programs/`, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (!Array.isArray(data.programs)) {
      console.error("Received invalid data format:", data);
      throw new Error("Received invalid data from the server");
    }

    return data;
  } catch (error) {
    console.error("Error fetching available programs:", error);
    throw error;
  }
};

export const getPvpRequests = () => get("/pvp-requests/");
export const sendPvpRequest = (data) => post("/send-pvp-request/", data);
export const respondToPvpRequest = (requestId, data) =>
  post(`/respond-to-pvp-request/${requestId}/`, data);
export const getActivePvpCompetitions = () => get("/active-pvp-competitions/");
export const enrollInProgram = (programId) =>
  post("/enroll-in-program/", { program_id: programId });
export const updateEngagementScore = (participationId, data) =>
  post(`/update-engagement-score/${participationId}/`, data);
export const getUserData = () => get("/user-data/");
export const updateUserProfile = (data) => put("/update-profile/", data);
export const getPresaleTransactions = () => get("/presale-transactions/");
export const checkPresaleAccess = () => get("/check-presale-access/");
export const grantPresaleAccess = (data) =>
  post("/grant-presale-access/", data);
export const verifyEmail = (data) => post("/verify-email/", data);
