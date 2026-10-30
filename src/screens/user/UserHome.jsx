import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Avatar,
  Button,
  CircularProgress,
  Divider,
  Tooltip,
  IconButton,
  Paper,
} from "@mui/material";
import {
  Edit,
  Visibility,
  VisibilityOff,
  Email,
  Phone,
  Person,
  Description,
  WarningAmber,
} from "@mui/icons-material";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import axiosInstance from "../../axiosConfig";
import { useNavigate } from "react-router-dom";

export default function UserHome() {
  const [userDetails, setUserDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileUrl, setProfileUrl] = useState("/assets/images/profile.jpg");
  const [showEmail, setShowEmail] = useState(false);
  const [showMobileNumber, setShowMobileNumber] = useState(false);

  const navigate = useNavigate();

  async function GetUserDetails() {
    try {
      const response = await axiosInstance.get("/User/GetUserDetails");
      setUserDetails(response.data);
      setProfileUrl(
        response.data.profile
          ? `/Base/DisplayFile?fileName=${response.data.profile}`
          : "/assets/images/profile.jpg",
      );
    } catch (error) {
      toast.error("Failed to load user details. Please try again.", {
        position: "top-center",
        autoClose: 3000,
        theme: "colored",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    GetUserDetails();
  }, []);

  const maskEmail = (email) => {
    if (!email) return "N/A";
    const [localPart, domain] = email.split("@");
    let maskedLocal;
    if (localPart.length > 5) {
      const middleLength = localPart.length - 4;
      maskedLocal =
        localPart.slice(0, 2) + "*".repeat(middleLength) + localPart.slice(-2);
    } else {
      maskedLocal =
        localPart.slice(0, 2) + "*".repeat(Math.max(localPart.length - 2, 1));
    }
    const domainParts = domain.split(".");
    const maskedDomain = domainParts
      .map((part, index) =>
        index === 0 ? part[0] + "*".repeat(Math.max(part.length - 1, 1)) : part,
      )
      .join(".");
    return `${maskedLocal}@${maskedDomain}`;
  };

  const maskMobileNumber = (mobileNumber) => {
    if (!mobileNumber) return "N/A";
    if (mobileNumber.length <= 4) return "*".repeat(mobileNumber.length);
    const middleLength = mobileNumber.length - 4;
    return (
      mobileNumber.slice(0, 2) +
      "*".repeat(middleLength) +
      mobileNumber.slice(-2)
    );
  };

  if (loading) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "80vh",
          bgcolor: "#F8FAFC",
        }}
      >
        <CircularProgress sx={{ color: "#2562E9" }} />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "#F8FAFC",
        py: { xs: 4, md: 8 },
        px: 2,
      }}
    >
      <Paper
        elevation={0}
        sx={{
          maxWidth: 600,
          mx: "auto",
          borderRadius: 3,
          border: "1px solid #E2E8F0",
          overflow: "hidden",
          bgcolor: "#FFFFFF",
        }}
      >
        {/* Premium Cover Banner */}
        <Box
          sx={{
            height: 140,
            background: "linear-gradient(135deg, #2562E9 0%, #1E40AF 100%)",
            position: "relative",
          }}
        />

        {/* Profile Header */}
        <Box sx={{ px: { xs: 3, sm: 4 }, pb: 3, mt: -6 }}>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              mb: 3,
              flexWrap: "wrap",
              gap: 2,
            }}
          >
            <Avatar
              src={profileUrl}
              alt={userDetails?.name}
              sx={{
                width: 120,
                height: 120,
                border: "4px solid #FFFFFF",
                boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                bgcolor: "#E2E8F0",
              }}
            />
          </Box>

          <Typography variant="h5" sx={{ fontWeight: 700, color: "#0F172A" }}>
            {userDetails?.name || "Unknown User"}
          </Typography>
          <Typography variant="body2" sx={{ color: "#64748B", mt: 0.5 }}>
            {userDetails?.location || "Jammu & Kashmir"}
          </Typography>
        </Box>

        <Divider />

        {/* Dashboard-Style Stat Cards */}
        <Box
          sx={{
            p: { xs: 3, sm: 4 },
            display: "flex",
            gap: 2,
            flexDirection: { xs: "column", sm: "row" },
          }}
        >
          <StatCard
            title="Initiated"
            value={userDetails?.initiated ?? 0}
            color="#10B582"
            icon={<Description />}
            onClick={() => navigate("/user/initiated")}
          />
          <StatCard
            title="Incomplete"
            value={userDetails?.incomplete ?? 0}
            color="#F59E0B"
            icon={<WarningAmber />}
            onClick={() => navigate("/user/incomplete")}
          />
        </Box>

        <Divider />

        {/* Contact Information */}
        <Box sx={{ p: { xs: 3, sm: 4 } }}>
          <Typography
            variant="overline"
            sx={{
              color: "#64748B",
              fontWeight: 600,
              letterSpacing: 1,
              mb: 2,
              display: "block",
            }}
          >
            Contact Information
          </Typography>

          <InfoRow
            icon={<Person />}
            label="Username"
            value={userDetails?.username || "N/A"}
          />
          <InfoRow
            icon={<Email />}
            label="Email Address"
            value={
              showEmail ? userDetails?.email : maskEmail(userDetails?.email)
            }
            action={
              <Tooltip title={showEmail ? "Hide Email" : "Show Email"} arrow>
                <IconButton
                  size="small"
                  onClick={() => setShowEmail(!showEmail)}
                  sx={{ color: "#64748B" }}
                >
                  {showEmail ? (
                    <VisibilityOff fontSize="small" />
                  ) : (
                    <Visibility fontSize="small" />
                  )}
                </IconButton>
              </Tooltip>
            }
          />
          <InfoRow
            icon={<Phone />}
            label="Mobile Number"
            value={
              showMobileNumber
                ? userDetails?.mobilenumber
                : maskMobileNumber(userDetails?.mobilenumber)
            }
            action={
              <Tooltip
                title={showMobileNumber ? "Hide Number" : "Show Number"}
                arrow
              >
                <IconButton
                  size="small"
                  onClick={() => setShowMobileNumber(!showMobileNumber)}
                  sx={{ color: "#64748B" }}
                >
                  {showMobileNumber ? (
                    <VisibilityOff fontSize="small" />
                  ) : (
                    <Visibility fontSize="small" />
                  )}
                </IconButton>
              </Tooltip>
            }
          />
        </Box>
      </Paper>

      <ToastContainer
        position="top-center"
        toastStyle={{
          background: "#FFFFFF",
          color: "#0F172A",
          borderRadius: "8px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          border: "1px solid #E2E8F0",
          fontSize: "0.9rem",
        }}
      />
    </Box>
  );
}

// ==================== Sub-Components ====================

const StatCard = ({ title, value, color, icon, onClick }) => (
  <Paper
    elevation={0}
    onClick={onClick}
    sx={{
      flex: 1,
      p: 2.5,
      borderRadius: 2,
      border: "1px solid #E2E8F0",
      cursor: "pointer",
      transition: "all 0.2s ease",
      "&:hover": {
        borderColor: color,
        boxShadow: `0 4px 12px ${color}20`,
        transform: "translateY(-2px)",
      },
    }}
  >
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5 }}>
      <Box
        sx={{
          p: 1,
          borderRadius: 1.5,
          bgcolor: `${color}15`,
          color: color,
          display: "flex",
        }}
      >
        {icon}
      </Box>
      <Typography variant="body2" sx={{ color: "#64748B", fontWeight: 500 }}>
        {title}
      </Typography>
    </Box>
    <Typography variant="h4" sx={{ fontWeight: 700, color: "#0F172A" }}>
      {value}
    </Typography>
  </Paper>
);

const InfoRow = ({ icon, label, value, action }) => (
  <Box
    sx={{
      display: "flex",
      alignItems: "center",
      py: 2,
      borderBottom: "1px solid #F1F5F9",
      "&:last-child": { borderBottom: "none" },
    }}
  >
    <Box sx={{ color: "#94A3B8", mr: 2, display: "flex" }}>{icon}</Box>
    <Box sx={{ flex: 1 }}>
      <Typography
        variant="caption"
        sx={{
          color: "#94A3B8",
          fontWeight: 500,
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        {label}
      </Typography>
      <Typography
        variant="body1"
        sx={{ color: "#0F172A", fontWeight: 500, wordBreak: "break-word" }}
      >
        {value || "N/A"}
      </Typography>
    </Box>
    {action && <Box sx={{ ml: 2 }}>{action}</Box>}
  </Box>
);
