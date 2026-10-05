import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  withCredentials: true,

  // No timeout for Render free server + Brevo
  timeout: 0,
});

api.interceptors.request.use((config) => {
  const token =
    localStorage.getItem("nagarsetu_token") ||
    localStorage.getItem("civicfix_token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const serverMessage = error.response?.data?.message;
    const isNetworkError = error.message === "Network Error" || !error.response;

    const message =
      serverMessage ||
      (isNetworkError
        ? "Network Error: Unable to connect to backend server at http://localhost:8080. Please ensure the backend is running."
        : error.message) ||
      "Something went wrong. Please try again.";

    return Promise.reject(new Error(message));
  }
);

export default api;