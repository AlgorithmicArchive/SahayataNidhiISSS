import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Container,
  Typography,
  Button,
  Box,
  CircularProgress,
} from "@mui/material";

export default function OfficerChoice() {
  const API_BASE = window.__CONFIG__?.API_URL || ""; // fallback to empty string

  const location = useLocation();
  const navigate = useNavigate();

  const [ssoObj, setSsoObj] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const raw = params.get("sso");

    if (!raw) {
      setLoading(false);
      return;
    }

    try {
      const parsed = JSON.parse(decodeURIComponent(raw));
      setSsoObj(parsed);
    } catch (e) {
      console.error("Failed to parse SSO payload", e);
    } finally {
      setLoading(false);
    }
  }, [location.search]);

  const goToVerification = async (newUserType) => {
    if (!ssoObj) return;

    try {
      setLoading(true);

      const response = await fetch(`${API_BASE}/Home/GetJWTToken`, {
        method: "GET", // or POST — adjust according to your backend
        credentials: "include", // ← added — include cookies if your auth uses them
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch token: ${response.status}`);
      }

      const { token } = await response.json();

      const modified = {
        ...ssoObj,
        UserType: newUserType,
        Token: token, // Optional: if you want to override / refresh token
      };

      const encoded = encodeURIComponent(JSON.stringify(modified));

      navigate(`/verification?sso=${encoded}`);
    } catch (err) {
      console.error("Error in goToVerification:", err);
      alert("Failed to proceed. Please try again.\n" + err.message);
      // Optional: replace alert with toast if you import react-toastify
      // toast.error("Failed to get token: " + err.message, { autoClose: 5000 });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "70vh",
        }}
      >
        <CircularProgress size={60} />
        <Typography sx={{ mt: 3, fontSize: "1.1rem", color: "text.secondary" }}>
          Preparing your session...
        </Typography>
      </Box>
    );
  }

  if (!ssoObj) {
    return (
      <Container maxWidth="sm" sx={{ mt: 8, textAlign: "center" }}>
        <Typography variant="h6" color="error" gutterBottom>
          Invalid or missing SSO data
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Please try logging in again or contact support if the problem persists.
        </Typography>
        <Button
          variant="contained"
          color="primary"
          onClick={() => navigate("/login")}
        >
          Back to Login
        </Button>
      </Container>
    );
  }

  return (
    <Container
      maxWidth="sm"
      sx={{
        mt: 8,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        minHeight: "70vh",
      }}
    >
      <Typography variant="h4" component="h1" fontWeight="bold" gutterBottom>
        Choose Your Role
      </Typography>

      <Typography variant="body1" align="center" sx={{ maxWidth: 480 }}>
        You are authenticated as <strong>{ssoObj.Username || "User"}</strong>.
        <br />
        Please select the role you want to use for this session:
      </Typography>

      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          gap: 3,
          width: "100%",
          maxWidth: 500,
          mt: 2,
        }}
      >
        <Button
          variant="contained"
          size="large"
          onClick={() => goToVerification("Officer")}
          disabled={loading}
          sx={{
            flex: 1,
            py: 2,
            background: "linear-gradient(45deg, #1976d2, #1565c0)",
            fontSize: "1.1rem",
            fontWeight: 600,
          }}
        >
          Login as Officer
        </Button>

        <Button
          variant="outlined"
          size="large"
          onClick={() => goToVerification("Citizen")}
          disabled={loading}
          sx={{
            flex: 1,
            py: 2,
            borderWidth: 2,
            fontSize: "1.1rem",
            fontWeight: 600,
          }}
        >
          Login as Citizen
        </Button>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mt: 4 }}>
        Not sure which role to choose? Contact support for assistance.
      </Typography>
    </Container>
  );
}