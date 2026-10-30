import GovPageHeader from "../../components/gov/GovPageHeader";
import {
  Box,
  Typography,
  CircularProgress,
  Container,
  Button,
  Grid,
  Paper,
  Avatar,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import React, { useEffect, useState, useRef, useContext } from "react";
import PeopleIcon from "@mui/icons-material/People";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import AssignmentIcon from "@mui/icons-material/Assignment";
import MiscellaneousServicesIcon from "@mui/icons-material/MiscellaneousServices";
import VerifiedUserIcon from "@mui/icons-material/VerifiedUser";
import DashboardIcon from "@mui/icons-material/Dashboard";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import axiosInstance from "../../axiosConfig";
import ServerSideTable from "../../components/ServerSideTable";
import { ArrowRightAlt } from "@mui/icons-material";
import { UserContext } from "../../UserContext";

// Recharts imports (replaces chart.js for consistency)
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

// Define card data with modern enterprise colors
const cardData = [
  {
    title: "Registered Officers",
    icon: <PeopleIcon />,
    color: "#2562E9", // Royal Blue
    dataKey: "totalOfficers",
    type: "Officer",
  },
  {
    title: "Registered Citizens",
    icon: <PersonAddIcon />,
    color: "#DB2777", // Pink
    dataKey: "totalRegisteredUsers",
    type: "Citizen",
  },
  {
    title: "Applications Received",
    icon: <AssignmentIcon />,
    color: "#F59E0B", // Amber
    dataKey: "totalApplicationsSubmitted",
    type: "Applications",
  },
  {
    title: "Active Services",
    icon: <MiscellaneousServicesIcon />,
    color: "#10B981", // Emerald
    dataKey: "totalServices",
    type: "Services",
  },
  {
    title: "DSC Validations",
    icon: <VerifiedUserIcon />,
    color: "#8B5CF6", // Violet
    dataKey: "pendingDscCount",
    type: "DSC",
  },
];

// Error Boundary Component
class ErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box
          sx={{
            p: 8,
            textAlign: "center",
            bgcolor: "#F8FAFC",
            minHeight: "50vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Typography
            variant="h5"
            sx={{ color: "#DC2626", fontWeight: 700, mb: 2 }}
          >
            Something went wrong.
          </Typography>
          <Typography variant="body1" sx={{ color: "#64748B", mb: 3 }}>
            Please try refreshing the page.
          </Typography>
          <Button
            variant="contained"
            onClick={() => window.location.reload()}
            sx={{ bgcolor: "#2562E9" }}
          >
            Refresh Page
          </Button>
        </Box>
      );
    }
    return this.props.children;
  }
}

// Modern Recharts Bar Chart
const DashboardChart = ({ data }) => {
  const chartData = [
    { name: "Officers", value: data.totalOfficers || 0, color: "#2562E9" },
    {
      name: "Citizens",
      value: data.totalRegisteredUsers || 0,
      color: "#DB2777",
    },
    {
      name: "Applications",
      value: data.totalApplicationsSubmitted || 0,
      color: "#F59E0B",
    },
    { name: "Services", value: data.totalServices || 0, color: "#10B981" },
  ];

  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart
        data={chartData}
        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="#E2E8F0"
          vertical={false}
        />
        <XAxis
          dataKey="name"
          tick={{ fill: "#64748B", fontSize: 12, fontWeight: 600 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: "#64748B", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: "#F8FAFC" }}
          contentStyle={{
            borderRadius: 8,
            border: "1px solid #E2E8F0",
            boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
          }}
        />
        <Bar dataKey="value" radius={[8, 8, 0, 0]} barSize={60}>
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

export default function AdminHome() {
  const [dashboardData, setDashboardData] = useState({
    totalOfficers: 0,
    totalRegisteredUsers: 0,
    totalApplicationsSubmitted: 0,
    totalServices: 0,
    pendingDscCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showTable, setShowTable] = useState(false);
  const [url, setUrl] = useState("");
  const [listType, setListType] = useState("");
  const tableRef = useRef(null);

  const { department } = useContext(UserContext);

  const actionFunctions = {
    ValidateOfficer: async (row) => {
      const userdata = row.original;
      const formdata = new FormData();
      formdata.append("username", userdata.username);
      try {
        const response = await axiosInstance.post(
          "/Admin/ValidateOfficer",
          formdata,
        );
        if (response.data.status) {
          toast.success("Officer validated successfully!", {
            position: "top-right",
            theme: "colored",
          });
        } else {
          toast.error("Validation failed.", {
            position: "top-right",
            theme: "colored",
          });
        }
      } catch (error) {
        toast.error("An error occurred while validating officer.", {
          position: "top-right",
          theme: "colored",
        });
      }
    },
    ApproveDSC: async (row) => {
      const data = row.original;
      const formData = new FormData();
      formData.append("certificateId", data.certificateId);
      formData.append("action", "APPROVED");
      try {
        const response = await axiosInstance.post("/Admin/ReviewDSC", formData);
        if (response.data.status) {
          toast.success(response.data.message || "DSC approved successfully!", {
            position: "top-right",
            theme: "colored",
          });
        } else {
          toast.error(response.data.message || "Approval failed.", {
            position: "top-right",
            theme: "colored",
          });
        }
      } catch (error) {
        toast.error("An error occurred while approving DSC.", {
          position: "top-right",
          theme: "colored",
        });
      }
    },
    RejectDSC: async (row) => {
      const data = row.original;
      const formData = new FormData();
      formData.append("certificateId", data.certificateId);
      formData.append("action", "REJECTED");
      try {
        const response = await axiosInstance.post("/Admin/ReviewDSC", formData);
        if (response.data.status) {
          toast.success(response.data.message || "DSC rejected successfully!", {
            position: "top-right",
            theme: "colored",
          });
        } else {
          toast.error(response.data.message || "Rejection failed.", {
            position: "top-right",
            theme: "colored",
          });
        }
      } catch (error) {
        toast.error("An error occurred while rejecting DSC.", {
          position: "top-right",
          theme: "colored",
        });
      }
    },
  };

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const response = await axiosInstance.get(
          "/Admin/GetDetailsForDashboard",
        );
        setDashboardData(response.data);
        setError(null);
      } catch (err) {
        console.error("Error fetching dashboard data:", err);
        setError("Failed to load dashboard data");
        toast.error("Failed to load dashboard data", {
          position: "top-right",
          theme: "colored",
        });
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

  const handleCardClick = (type) => {
    if (type === "Officer") setUrl("/Admin/GetOfficersList");
    else if (type === "Citizen") setUrl("/Admin/GetUsersList");
    else if (type === "Applications") setUrl("/Admin/GetApplicationsList");
    else if (type === "Services") setUrl("/Admin/GetServices");
    else if (type === "DSC") setUrl("/Admin/GetPendingDSCList");

    setListType(type === "DSC" ? "Pending DSC Validations" : type);
    setShowTable(true);

    requestAnimationFrame(() => {
      if (tableRef.current) {
        tableRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        setTimeout(() => {
          if (tableRef.current)
            tableRef.current.scrollIntoView({
              behavior: "smooth",
              block: "start",
            });
        }, 500);
      }
    });
  };

  const renderStatCard = (card, index) => (
    <Grid item xs={12} sm={6} md={4} lg={2.4} key={index}>
      <Paper
        elevation={0}
        onClick={() => handleCardClick(card.type)}
        sx={{
          p: 3,
          borderRadius: 2,
          border: "1px solid #E2E8F0",
          borderLeft: `4px solid ${card.color}`,
          cursor: "pointer",
          transition: "all 0.2s ease",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          "&:hover": {
            borderColor: card.color,
            boxShadow: `0 4px 12px ${alpha(card.color, 0.15)}`,
            transform: "translateY(-2px)",
          },
        }}
      >
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            mb: 2,
          }}
        >
          <Typography
            variant="body2"
            sx={{
              color: "#64748B",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: 0.5,
              fontSize: "0.75rem",
            }}
          >
            {card.title}
          </Typography>
          <Avatar
            sx={{
              bgcolor: `${card.color}15`,
              color: card.color,
              width: 40,
              height: 40,
            }}
          >
            {React.cloneElement(card.icon, { sx: { fontSize: 22 } })}
          </Avatar>
        </Box>

        <Box>
          <Typography
            variant="h4"
            sx={{ fontWeight: 800, color: "#0F172A", lineHeight: 1, mb: 2 }}
          >
            {(dashboardData[card.dataKey] || 0).toLocaleString("en-IN")}
          </Typography>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              color: card.color,
              fontWeight: 600,
              fontSize: "0.875rem",
            }}
          >
            View Details <ArrowRightAlt sx={{ fontSize: 16 }} />
          </Box>
        </Box>
      </Paper>
    </Grid>
  );

  if (loading) {
    return (
      <Box
        sx={{
          width: "100%",
          height: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          bgcolor: "#F8FAFC",
        }}
      >
        <CircularProgress size={60} sx={{ color: "#2562E9" }} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box
        sx={{
          width: "100%",
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          bgcolor: "#F8FAFC",
          gap: 2,
        }}
      >
        <Typography color="error" variant="h6" sx={{ fontWeight: 600 }}>
          {error}
        </Typography>
        <Button
          variant="contained"
          onClick={() => window.location.reload()}
          sx={{ bgcolor: "#2562E9", textTransform: "none", fontWeight: 600 }}
        >
          Retry
        </Button>
      </Box>
    );
  }

  return (
    <ErrorBoundary>
      <Box sx={{ bgcolor: "#F8FAFC", minHeight: "100vh", pb: 8 }}>
        {/* Authoritative Header */}
        <Box
          sx={{
            bgcolor: "#0F172A",
            color: "white",
            py: { xs: 4, md: 6 },
            mb: 6,
            borderBottom: "4px solid #2562E9",
          }}
        >
          <Container maxWidth="xl">
            <GovPageHeader title={`${department || "Admin"} Dashboard`} />
            <Typography
              variant="body1"
              sx={{ color: "#94A3B8", mt: 1, fontWeight: 500 }}
            >
              System-wide analytics and management overview
            </Typography>
          </Container>
        </Box>

        <Container maxWidth="xl">
          {/* Overview Title */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 3 }}>
            <DashboardIcon sx={{ color: "#2562E9" }} />
            <Typography variant="h5" sx={{ fontWeight: 700, color: "#0F172A" }}>
              Dashboard Overview
            </Typography>
          </Box>

          {/* Stat Cards */}
          <Grid container spacing={3} sx={{ mb: 6 }}>
            {cardData.map((card, index) => renderStatCard(card, index))}
          </Grid>

          {/* Chart Section */}
          <Paper
            elevation={0}
            sx={{
              p: 4,
              mb: 6,
              borderRadius: 3,
              border: "1px solid #E2E8F0",
              bgcolor: "white",
            }}
          >
            <Typography
              variant="h6"
              sx={{ fontWeight: 700, color: "#0F172A", mb: 3 }}
            >
              System Metrics
            </Typography>
            <DashboardChart data={dashboardData} />
          </Paper>

          {/* Table Section */}
          {showTable && (
            <Box ref={tableRef}>
              <ServerSideTable
                key={listType}
                url={url}
                extraParams={{}}
                actionFunctions={actionFunctions}
                Title={listType}
                showDownloadButtons={true}
              />
            </Box>
          )}
        </Container>

        <ToastContainer position="top-right" autoClose={3000} theme="colored" />
      </Box>
    </ErrorBoundary>
  );
}
