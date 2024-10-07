const API_BASE_URL = "https://bullposter.xyz/api";

export const fetchWithAuth = async (endpoint, options = {}) => {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      credentials: "include",
      headers: {
        ...options.headers,
        "Content-Type": options.headers?.["Content-Type"] || "application/json",
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

export const uploadProgramPicture = async (
  raidProgramAccountPublicKey,
  profilePicture,
) => {
  const formData = new FormData();
  formData.append("raidProgramAccountPublicKey", raidProgramAccountPublicKey);
  formData.append("profile_picture", profilePicture);

  const response = await fetch(`${API_BASE_URL}/upload-program-picture/`, {
    method: "POST",
    body: formData,
    credentials: "include",
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to upload program picture");
  }

  return response.json();
};

export const uploadProfilePicture = async (file) => {
  const formData = new FormData();
  formData.append("profile_picture", file);

  const response = await fetch(`${API_BASE_URL}/upload-profile-picture/`, {
    method: "POST",
    body: formData,
    credentials: "include",
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to upload profile picture");
  }

  return response.json();
};

export const updateProgram = async (programId, programData) => {
  const formData = new FormData();
  formData.append("name", programData.name);
  formData.append("description", programData.description);
  if (programData.profile_picture) {
    formData.append("profile_picture", programData.profile_picture);
  }

  const response = await fetch(`${API_BASE_URL}/update-program/${programId}/`, {
    method: "PUT",
    body: formData,
    credentials: "include",
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to update program");
  }

  return response.json();
};
export const deleteProgram = (programId) =>
  del(`/delete-program/${programId}/`);
export const joinRaid = (raidId) => post(`/join-raid/${raidId}/`);
export const respondToPvpRequest = (requestId, data) =>
  post(`/respond-to-pvp-request/${requestId}/`, data);
export const getPresaleTransactions = () => get("/presale-transactions/");
export const checkPresaleAccess = () => get("/check-presale-access/");
export const grantPresaleAccess = (data) =>
  post("/grant-presale-access/", data);
export const verifyEmail = (data) => post("/verify-email/", data);
