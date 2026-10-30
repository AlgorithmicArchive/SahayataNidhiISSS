import React, { useEffect, useState } from "react";
import {
  Box,
  Container,
  Grid,
  Button,
  Typography,
  Paper,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
} from "@mui/material";
import { Webhook, Search } from "@mui/icons-material";
import axiosInstance from "../../axiosConfig";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import ServerSideTable from "../../components/ServerSideTable";

// Helper to format JSON strings for the modal
const formatJson = (str) => {
  if (!str) return "Empty";
  try {
    return JSON.stringify(JSON.parse(str), null, 2);
  } catch {
    return str;
  }
};

export default function WebServiceLogs() {
  // Filters State
  const [services, setServices] = useState([]);
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [webServices, setWebServices] = useState([]);

  // Dropdown selection vs Active Table selection
  const [selectedWebServiceId, setSelectedWebServiceId] = useState("");
  const [activeWebServiceId, setActiveWebServiceId] = useState(""); // Passed to table

  // Table State
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Modal State
  const [openDetailModal, setOpenDetailModal] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  // 1. Fetch Services on Mount
  useEffect(() => {
    const fetchServices = async () => {
      try {
        const response = await axiosInstance.get("/Base/GetServices");
        if (response.data.status && response.data.services) {
          setServices(response.data.services);
        }
      } catch (err) {
        console.error(err);
        toast.error("Error fetching services");
      }
    };
    fetchServices();
  }, []);

  // 2. Fetch WebServices when Service changes
  useEffect(() => {
    if (!selectedServiceId) {
      setWebServices([]);
      setSelectedWebServiceId("");
      setActiveWebServiceId(""); // Clear table
      return;
    }

    const fetchWebServices = async () => {
      try {
        const response = await axiosInstance.get(
          `/Base/GetWebServices?serviceId=${selectedServiceId}`,
        );
        if (response.data.status) {
          const list = response.data.configs || [];
          setWebServices(list);
          setSelectedWebServiceId("");
          setActiveWebServiceId(""); // Clear table when service changes
        }
      } catch (err) {
        console.error(err);
        toast.error("Error fetching web services");
      }
    };
    fetchWebServices();
  }, [selectedServiceId]);

  // 3. Handle "Get Logs" Button Click
  const handleGetLogsClick = () => {
    if (!selectedWebServiceId) {
      toast.error("Please select a Web Service first.");
      return;
    }
    setActiveWebServiceId(selectedWebServiceId);
    setRefreshTrigger((prev) => prev + 1); // Force table refetch
  };

  // 4. Action Functions for ServerSideTable
  const actionFunctions = {
    viewLogDetails: async (row) => {
      const logId = row.original.id;
      setIsDetailLoading(true);
      setSelectedLog(null);
      setOpenDetailModal(true);
      try {
        const response = await axiosInstance.get("/Base/GetWebServiceLogById", {
          params: { id: logId },
        });
        if (response.data.status) {
          setSelectedLog(response.data.data);
        } else {
          toast.error("Failed to fetch log details");
          setOpenDetailModal(false);
        }
      } catch (error) {
        console.error(error);
        toast.error("Error fetching log details");
        setOpenDetailModal(false);
      } finally {
        setIsDetailLoading(false);
      }
    },

    // ✅ NEW: Manual Resend Function
    resendRequest: async (row) => {
      const logId = row.original.id;
      if (
        !window.confirm(
          "Are you sure you want to manually resend this exact request payload?",
        )
      )
        return;

      try {
        const formData = new FormData();
        formData.append("logId", logId);
        const response = await axiosInstance.post(
          "/Base/ResendWebServiceRequest",
          formData,
        );

        if (response.data.status) {
          toast.success(
            response.data.message || "Request resent successfully!",
          );
        } else {
          toast.error(response.data.message || "Request failed to send.");
        }

        // Refresh the table to show the newly created log entry
        setRefreshTrigger((prev) => prev + 1);
      } catch (error) {
        console.error(error);
        toast.error("Error resending request.");
      }
    },
  };

  return (
    <Box sx={{ bgcolor: "#F8FAFC", minHeight: "100vh", py: 4 }}>
      <Container maxWidth="xl">
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1 }}>
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: 2,
                bgcolor: "#EFF6FF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Webhook sx={{ fontSize: 32, color: "#2562E9" }} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 800,
                  color: "#0F172A",
                  letterSpacing: "-0.5px",
                }}
              >
                Web Service Execution Logs
              </Typography>
              <Typography variant="body1" sx={{ color: "#64748B" }}>
                Monitor outgoing web service requests, responses, and retry
                attempts.
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Filters Card */}
        <Paper
          elevation={0}
          sx={{
            p: 3,
            borderRadius: 3,
            border: "1px solid #E2E8F0",
            mb: 3,
            bgcolor: "white",
          }}
        >
          <Grid container spacing={3} alignItems="center">
            <Grid item xs={12} sm={5}>
              <FormControl fullWidth>
                <InputLabel>Select Service</InputLabel>
                <Select
                  value={selectedServiceId}
                  label="Select Service"
                  onChange={(e) => setSelectedServiceId(e.target.value)}
                >
                  <MenuItem value="">
                    <em>Select a service</em>
                  </MenuItem>
                  {services.map((service) => (
                    <MenuItem key={service.serviceId} value={service.serviceId}>
                      {service.serviceName}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={5}>
              <FormControl fullWidth disabled={!selectedServiceId}>
                <InputLabel>Select Web Service</InputLabel>
                <Select
                  value={selectedWebServiceId}
                  label="Select Web Service"
                  onChange={(e) => setSelectedWebServiceId(e.target.value)}
                >
                  <MenuItem value="">
                    <em>Select a web service</em>
                  </MenuItem>
                  {webServices.map((ws) => (
                    <MenuItem key={ws.id} value={ws.id.toString()}>
                      {ws.webServiceName || `Webhook ${ws.id}`}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={2}>
              <Button
                variant="contained"
                fullWidth
                onClick={handleGetLogsClick}
                disabled={!selectedWebServiceId}
                startIcon={<Search />}
                sx={{
                  bgcolor: "#2562E9",
                  "&:hover": { bgcolor: "#1D4ED8" },
                  textTransform: "none",
                  fontWeight: 600,
                  py: 1.5,
                  height: "56px",
                }}
              >
                Get Logs
              </Button>
            </Grid>
          </Grid>
        </Paper>

        {/* ✅ ServerSideTable Integration - Only renders after Get Logs is clicked */}
        {activeWebServiceId && (
          <ServerSideTable
            url="/Base/GetWebServiceLogs"
            extraParams={{ webserviceId: activeWebServiceId }}
            actionFunctions={actionFunctions}
            refreshTrigger={refreshTrigger}
            Title="Execution Logs"
            searchableFields={["referenceNumber", "triggerName"]}
            showDownloadButtons={true}
          />
        )}

        {/* Detail Modal */}
        <Dialog
          open={openDetailModal}
          onClose={() => setOpenDetailModal(false)}
          maxWidth="md"
          fullWidth
          PaperProps={{ sx: { borderRadius: 3, overflow: "hidden" } }}
        >
          <DialogTitle
            sx={{
              bgcolor: "#F8FAFC",
              borderBottom: "1px solid #E2E8F0",
              py: 2,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Webhook sx={{ color: "#2562E9" }} />
              <Typography variant="h6" fontWeight={700} color="#0F172A">
                Execution Details
              </Typography>
            </Box>
          </DialogTitle>
          <DialogContent dividers sx={{ bgcolor: "#FFFFFF", p: 3 }}>
            {isDetailLoading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
                <CircularProgress sx={{ color: "#2562E9" }} />
              </Box>
            ) : selectedLog ? (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <Paper
                  variant="outlined"
                  sx={{ p: 2, bgcolor: "#F8FAFC", borderRadius: 2 }}
                >
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <Typography
                        variant="caption"
                        color="#64748B"
                        fontWeight={600}
                      >
                        Request URL
                      </Typography>
                      <Typography
                        variant="body2"
                        fontWeight={600}
                        sx={{ wordBreak: "break-all", color: "#0F172A" }}
                      >
                        <span style={{ color: "#2562E9" }}>
                          {selectedLog.requestMethod}
                        </span>{" "}
                        {selectedLog.requestUrl}
                      </Typography>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Typography
                        variant="caption"
                        color="#64748B"
                        fontWeight={600}
                      >
                        Status Code
                      </Typography>
                      <Typography
                        variant="body2"
                        fontWeight={700}
                        color={
                          selectedLog.isSuccess ? "success.main" : "error.main"
                        }
                      >
                        {selectedLog.responseStatusCode || "N/A"}
                      </Typography>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Typography
                        variant="caption"
                        color="#64748B"
                        fontWeight={600}
                      >
                        Duration
                      </Typography>
                      <Typography
                        variant="body2"
                        fontWeight={700}
                        color="#0F172A"
                      >
                        {selectedLog.durationMs} ms
                      </Typography>
                    </Grid>
                  </Grid>
                </Paper>

                {selectedLog.errorMessage && (
                  <Alert
                    severity="error"
                    sx={{ borderRadius: 2, border: "1px solid #FECACA" }}
                  >
                    <Typography fontWeight={700} sx={{ mb: 0.5 }}>
                      Exception / Error:
                    </Typography>
                    <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                      {selectedLog.errorMessage}
                    </Typography>
                  </Alert>
                )}

                <Box>
                  <Typography
                    variant="subtitle1"
                    fontWeight={700}
                    sx={{ mb: 1, color: "#0F172A" }}
                  >
                    Request Payload
                  </Typography>
                  <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                    <Typography
                      variant="caption"
                      fontWeight={700}
                      color="#64748B"
                      sx={{ textTransform: "uppercase", letterSpacing: 1 }}
                    >
                      Headers
                    </Typography>
                    <Box
                      component="pre"
                      sx={{
                        bgcolor: "#F1F5F9",
                        p: 1.5,
                        borderRadius: 1,
                        fontSize: "0.75rem",
                        overflowX: "auto",
                        mb: 2,
                        fontFamily: "monospace",
                        color: "#334155",
                        maxHeight: 150,
                      }}
                    >
                      {formatJson(selectedLog.requestHeaders)}
                    </Box>
                    <Typography
                      variant="caption"
                      fontWeight={700}
                      color="#64748B"
                      sx={{ textTransform: "uppercase", letterSpacing: 1 }}
                    >
                      Body
                    </Typography>
                    <Box
                      component="pre"
                      sx={{
                        bgcolor: "#F1F5F9",
                        p: 1.5,
                        borderRadius: 1,
                        fontSize: "0.75rem",
                        overflowX: "auto",
                        fontFamily: "monospace",
                        color: "#334155",
                        maxHeight: 250,
                      }}
                    >
                      {formatJson(selectedLog.requestBody)}
                    </Box>
                  </Paper>
                </Box>

                <Box>
                  <Typography
                    variant="subtitle1"
                    fontWeight={700}
                    sx={{ mb: 1, color: "#0F172A" }}
                  >
                    Response Payload
                  </Typography>
                  <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                    <Typography
                      variant="caption"
                      fontWeight={700}
                      color="#64748B"
                      sx={{ textTransform: "uppercase", letterSpacing: 1 }}
                    >
                      Headers
                    </Typography>
                    <Box
                      component="pre"
                      sx={{
                        bgcolor: "#F1F5F9",
                        p: 1.5,
                        borderRadius: 1,
                        fontSize: "0.75rem",
                        overflowX: "auto",
                        mb: 2,
                        fontFamily: "monospace",
                        color: "#334155",
                        maxHeight: 150,
                      }}
                    >
                      {formatJson(selectedLog.responseHeaders)}
                    </Box>
                    <Typography
                      variant="caption"
                      fontWeight={700}
                      color="#64748B"
                      sx={{ textTransform: "uppercase", letterSpacing: 1 }}
                    >
                      Body
                    </Typography>
                    <Box
                      component="pre"
                      sx={{
                        bgcolor: "#F1F5F9",
                        p: 1.5,
                        borderRadius: 1,
                        fontSize: "0.75rem",
                        overflowX: "auto",
                        fontFamily: "monospace",
                        color: "#334155",
                        maxHeight: 250,
                      }}
                    >
                      {formatJson(selectedLog.responseBody)}
                    </Box>
                  </Paper>
                </Box>
              </Box>
            ) : null}
          </DialogContent>
          <DialogActions
            sx={{ p: 2, borderTop: "1px solid #E2E8F0", bgcolor: "#F8FAFC" }}
          >
            <Button
              onClick={() => setOpenDetailModal(false)}
              variant="contained"
              sx={{
                textTransform: "none",
                bgcolor: "#2562E9",
                "&:hover": { bgcolor: "#1D4ED8" },
                fontWeight: 600,
                px: 3,
              }}
            >
              Close
            </Button>
          </DialogActions>
        </Dialog>

        <ToastContainer position="top-right" autoClose={3000} theme="colored" />
      </Container>
    </Box>
  );
}
