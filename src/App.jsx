import React, { useContext, useEffect, useState, useCallback } from "react";
import { BrowserRouter as Router, useNavigate } from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";
import {
  CssBaseline,
  Box,
  CircularProgress,
  Typography,
  Fade,
} from "@mui/material";
import { GovSoftTheme } from "./themes/TwilightBlossom";
import RoutesComponent from "./components/RoutesComponent";
import Header from "./components/Header";
import SkipToContent from "./components/gov/SkipToContent";
import { UserProvider, UserContext } from "./UserContext";
import ScrollToTop from "./components/ScrollToTop";
import TranslationWatcher from "./components/TranslationWatcher";
import Footer from "./components/Footer";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { jwtDecode } from "jwt-decode";
import { sessionHub } from "./services/sessionHub";
import axiosInstance from "./axiosConfig"; // ✅ Added for auth

const App = () => (
  <ThemeProvider theme={GovSoftTheme}>
    <UserProvider>
      <CssBaseline />
      <Router>
        {/* GIGW: keyboard users can skip repetitive navigation */}
        <SkipToContent />
        <ScrollToTop />
        <TranslationWatcher />
        <Header />
        <MainContent />
        <Footer />
      </Router>
    </UserProvider>
  </ThemeProvider>
);

const MainContent = () => {
  const {
    token,
    userType,
    verified,
    setToken,
    setUserType,
    setUsername,
    setProfile,
    setVerified,
    setDesignation,
    setDepartment,
    setUserId,
    setTokenExpiry,
    setActualUserType,
  } = useContext(UserContext);

  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [ssoLoading, setSsoLoading] = useState(false);
  const navigate = useNavigate();

  /* -------------------------------------------------
     Helpers (memoized to prevent unnecessary re-renders)
  ------------------------------------------------- */
  const logoutAll = useCallback(() => {
    setToken(null);
    setUserType(null);
    setActualUserType(null);
    setUsername(null);
    setProfile(null);
    setVerified(false);
    setDesignation(null);
    setDepartment(null);
    setUserId(null);
    setTokenExpiry(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    sessionStorage.clear();
    toast.error("Session expired. Please log in again.");
    navigate("/");
  }, [
    navigate,
    setToken,
    setUserType,
    setActualUserType,
    setUsername,
    setProfile,
    setVerified,
    setDesignation,
    setDepartment,
    setUserId,
    setTokenExpiry,
  ]);

  const redirectByUserType = useCallback(() => {
    const routes = {
      Citizen: "/user/home",
      user: "/user/home",
      Officer: "/officer/home",
      Admin: "/admin/home",
      Designer: "/designer/dashboard",
      Viewer: "/viewer/home",
    };
    navigate(routes[userType] || "/user/home");
  }, [userType, navigate]);

  /* -------------------------------------------------
     SignalR: Real-time session management
  ------------------------------------------------- */
  useEffect(() => {
    if (!token) return;

    let mounted = true;

    const connectSignalR = async () => {
      try {
        await sessionHub.start(token);
        if (!mounted) return;

        sessionHub.setForceLogoutHandler((data) => {
          toast.warning(data.message || "Your session was terminated.");
          logoutAll();
        });
      } catch (err) {
        console.error("SignalR connection failed:", err);
      }
    };

    connectSignalR();

    return () => {
      mounted = false;
      sessionHub.stop();
    };
  }, [token, logoutAll]); // ✅ Added logoutAll to deps

  /* -------------------------------------------------
     1. SSO ?sso= handling
  ------------------------------------------------- */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ssoParam = params.get("sso");

    if (ssoParam) {
      setSsoLoading(true);
      try {
        const data = JSON.parse(decodeURIComponent(ssoParam));

        if (data.status && data.token && data.userType) {
          localStorage.setItem("token", data.token);
          localStorage.setItem("user", JSON.stringify(data));

          setToken(data.token);
          const viewType = data.userType === "user" ? "Citizen" : data.userType;
          setUserType(viewType);

          const original = data.actualUserType || data.userType;
          setActualUserType(original);
          sessionStorage.setItem("actualUserType", original);

          setUsername(data.username);
          setUserId(data.userId);
          setDesignation(data.designation || "");
          if (data.department) setDepartment(data.department);
          setProfile(data.profile || "/assets/images/profile.jpg");
          setVerified(true);

          toast.success("Logged in with JanParichay!");
        } else {
          throw new Error("Invalid SSO payload");
        }
      } catch (err) {
        console.error("SSO parse error:", err);
        toast.error("SSO login failed.");
        setSsoLoading(false);
      }
    } else {
      setSsoLoading(false);
    }
  }, [
    setToken,
    setUserType,
    setActualUserType,
    setUsername,
    setUserId,
    setDesignation,
    setDepartment,
    setProfile,
    setVerified,
  ]); // ✅ Added deps

  /* -------------------------------------------------
     2. Redirect after SSO context is ready
  ------------------------------------------------- */
  useEffect(() => {
    if (userType && ssoLoading) {
      navigate("/", { replace: true });
      redirectByUserType();
      setSsoLoading(false);
    }
  }, [userType, ssoLoading, navigate, redirectByUserType]); // ✅ Added deps

  /* -------------------------------------------------
     3. Token expiry handling
  ------------------------------------------------- */
  useEffect(() => {
    if (token) {
      try {
        const { exp } = jwtDecode(token);
        const expMs = exp * 1000;
        const now = Date.now();
        const until = expMs - now;

        if (until <= 0) {
          logoutAll();
        } else {
          setTokenExpiry(expMs);
          const t = setTimeout(logoutAll, until);
          return () => clearTimeout(t);
        }
      } catch {
        logoutAll();
      }
    } else {
      setTokenExpiry(null);
    }
  }, [token, logoutAll, setTokenExpiry]); // ✅ Added deps

  /* -------------------------------------------------
     4. Initial load – validate persisted token
  ------------------------------------------------- */
  useEffect(() => {
    const first = sessionStorage.getItem("initialLoad") === null;
    if (first && token && !ssoLoading) {
      (async () => {
        try {
          // ✅ Use axiosInstance instead of raw fetch
          const r = await axiosInstance.get("/Home/ValidateJWTToken");
          if (r.data?.status) {
            if (!verified) navigate("/verification");
            else redirectByUserType();
          }
        } catch (e) {
          console.error("Token validation failed:", e);
          logoutAll(); // ✅ Logout on validation failure
        } finally {
          sessionStorage.setItem("initialLoad", "false");
          setIsInitialLoad(false);
        }
      })();
    } else {
      sessionStorage.setItem("initialLoad", "false");
      setIsInitialLoad(false);
    }
  }, [
    token,
    userType,
    verified,
    navigate,
    ssoLoading,
    redirectByUserType,
    logoutAll,
  ]); // ✅ Added deps

  /* -------------------------------------------------
     Render
  ------------------------------------------------- */
  if (ssoLoading) {
    return (
      <Fade in={true} timeout={300}>
        <Box
          sx={{
            width: "100vw",
            height: "100vh",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            gap: 3,
            background: "linear-gradient(135deg, #F4F9FF 0%, #F9F3EC 100%)",
          }}
        >
          <Box
            sx={{
              width: 80,
              height: 80,
              borderRadius: "50%",
              bgcolor: "primary.main",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 8px 24px rgba(37, 98, 233, 0.3)",
              animation: "pulse 2s ease-in-out infinite",
            }}
          >
            <CircularProgress sx={{ color: "white" }} size={40} />
          </Box>
          <Typography
            variant="h6"
            sx={{ fontWeight: 600, color: "text.primary" }}
          >
            Completing JanParichay Login
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Please wait while we verify your credentials...
          </Typography>
          <style>{`
            @keyframes pulse {
              0%, 100% { transform: scale(1); opacity: 1; }
              50% { transform: scale(1.05); opacity: 0.9; }
            }
          `}</style>
        </Box>
      </Fade>
    );
  }

  return (
    <Box
      component="main"
      id="main-content"
      tabIndex={-1}
      sx={{ width: "100%", minHeight: "100vh" }}
    >
      <RoutesComponent />
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        pauseOnHover
        theme="colored"
      />
    </Box>
  );
};

export default App;
