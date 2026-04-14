/**
 * API Service for Management endpoints
 * Handles profiles, vehicles, and driver licenses
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";

// Helper to make API calls with proper headers
async function apiCall(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || `API Error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`API Error [${endpoint}]:`, error);
    throw error;
  }
}

// ============== Citizen Check ==============
export const checkCitizen = async (citizenId) => {
  return apiCall("/management/check-citizen", {
    method: "POST",
    body: JSON.stringify({ citizen_id: citizenId }),
  });
};

// ============== Profiles ==============
export const listProfiles = async () => {
  return apiCall("/management/profiles", {
    method: "GET",
  });
};

export const createProfile = async (profileData) => {
  return apiCall("/management/profiles", {
    method: "POST",
    body: JSON.stringify(profileData),
  });
};

export const updateProfile = async (profileId, updateData) => {
  return apiCall(`/management/profiles/${profileId}`, {
    method: "PATCH",
    body: JSON.stringify(updateData),
  });
};

export const deleteProfile = async (profileId) => {
  return apiCall(`/management/profiles/${profileId}`, {
    method: "DELETE",
  });
};

// ============== Driver Licenses ==============
export const listDriverLicenses = async () => {
  return apiCall("/management/driver-licenses", {
    method: "GET",
  });
};

export const createDriverLicense = async (licenseData) => {
  return apiCall("/management/driver-licenses", {
    method: "POST",
    body: JSON.stringify(licenseData),
  });
};

export const updateDriverLicense = async (licenseId, updateData) => {
  return apiCall(`/management/driver-licenses/${licenseId}`, {
    method: "PATCH",
    body: JSON.stringify(updateData),
  });
};

export const deleteDriverLicense = async (licenseId) => {
  return apiCall(`/management/driver-licenses/${licenseId}`, {
    method: "DELETE",
  });
};

// ============== Vehicles ==============
export const listVehicles = async () => {
  return apiCall("/management/vehicles", {
    method: "GET",
  });
};

export const createVehicle = async (vehicleData) => {
  return apiCall("/management/vehicles", {
    method: "POST",
    body: JSON.stringify(vehicleData),
  });
};

export const updateVehicle = async (vehicleId, updateData) => {
  return apiCall(`/management/vehicles/${vehicleId}`, {
    method: "PATCH",
    body: JSON.stringify(updateData),
  });
};

export const deleteVehicle = async (vehicleId) => {
  return apiCall(`/management/vehicles/${vehicleId}`, {
    method: "DELETE",
  });
};

// ============== Accounts ==============
export const checkAccountByCitizen = async (citizenId) => {
  return apiCall("/management/check-account", {
    method: "POST",
    body: JSON.stringify({ citizen_id: citizenId }),
  });
};

export const resetAccountPassword = async (citizenId, newPassword) => {
  return apiCall("/management/reset-password", {
    method: "POST",
    body: JSON.stringify({ citizen_id: citizenId, new_password: newPassword }),
  });
};
