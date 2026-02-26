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
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor - handles 401 (unauthorized) globally
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    // If we get 401 → token likely expired/invalid → clear session & redirect to login
    if (error.response && error.response.status === 401) {
      sessionStorage.removeItem("token");
      sessionStorage.removeItem("userType");
      // Optional: clear more items if needed
      // sessionStorage.removeItem("username");
      // sessionStorage.removeItem("profile");

      // Redirect to login page
      window.location.href = "/login";
    }

    // Let the component handle other errors normally
    return Promise.reject(error);
  },
);

export default axiosInstance;
