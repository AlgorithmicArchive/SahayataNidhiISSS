// axiosConfig.js
import axios from "axios";

// Use the same dynamic API_BASE pattern as in your components
const API_BASE = window.__CONFIG__?.API_URL || "";

// Create axios instance with dynamic baseURL
const axiosInstance = axios.create({
  baseURL: API_BASE, // This will now be "https://api.yourdomain.com" or whatever is set
  // Optional: you can add timeout, headers, etc.
  // timeout: 15000,
  // withCredentials: true,    // Uncomment if you use cookies/sessions cross-origin
});

// Request interceptor - adds Bearer token automatically
axiosInstance.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem("token");
    console.log("Adding token to request:", token);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor - handles 401 (unauthorized) globally
// Response interceptor - handles 401 (unauthorized) globally
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      console.error("401 received on:", error.config.url);

      // Clear everything
      sessionStorage.clear();
      localStorage.clear();

      // Clear all cookies
      document.cookie.split(";").forEach((c) => {
        const [name] = c.split("=");
        document.cookie = `${name.trim()}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
      });

      // Force reload to clear any in-memory state
      window.location.reload();
    }
    return Promise.reject(error);
  },
);

export default axiosInstance;
