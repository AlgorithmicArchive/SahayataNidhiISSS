import React, { useState, useEffect, useContext } from "react";
import {
  Container,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  TextField,
  Button,
  Box,
  CircularProgress,
  Alert,
  IconButton,
  Chip,
  Divider,
  Grid,
  Paper,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import axiosInstance from "../../axiosConfig";
import { UserContext } from "../../UserContext";

const LIMIT_TYPES = ["All Time", "Yearly", "Monthly", "Weekly", "Daily"];

export default function SubmissionLimitations() {
  const { userType, officerAuthorities } = useContext(UserContext);
  const [services, setServices] = useState([]);
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [config, setConfig] = useState({
    isLimited: false,
    limits: [],
  });
  const [isFetchingServices, setIsFetchingServices] = useState(false);
  const [isFetchingConfig, setIsFetchingConfig] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const canSaveConfig = userType === "Designer";

  // Fetch services
  useEffect(() => {
    const fetchServices = async () => {
      setIsFetchingServices(true);
      setFetchError("");
      try {
        const response = await axiosInstance.get("/Base/GetServices");
        if (response.data.status && Array.isArray(response.data.services)) {
          setServices(response.data.services);
        } else {
          setServices([]);
          setFetchError("No services found.");
          toast.error("No services found.");
        }
      } catch (error) {
        console.error("Error fetching services:", error);
        setFetchError("Failed to load services.");
        toast.error("Failed to load services.");
      } finally {
        setIsFetchingServices(false);
      }
    };

    fetchServices();
  }, []);

  // Fetch config when service selected
  useEffect(() => {
    if (!selectedServiceId) {
      setConfig({ isLimited: false, limits: [] });
      setFetchError("");
      return;
    }

    const fetchConfig = async () => {
      setIsFetchingConfig(true);
      setFetchError("");
      try {
        const response = await axiosInstance.get("/Designer/GetServiceConfig", {
          params: { serviceId: selectedServiceId },
        });
        if (response.data.status && response.data.config) {
          // Ensure limits array exists
          const loadedConfig = {
            isLimited: response.data.config.isLimited ?? false,
            limits: response.data.config.limits || [],
          };
          setConfig(loadedConfig);
          toast.success("Configuration loaded successfully.");
        } else {
          setConfig({ isLimited: false, limits: [] });
          toast.info("No existing configuration found for this service.");
        }
      } catch (error) {
        console.error("Error fetching configuration:", error);
        setConfig({ isLimited: false, limits: [] });
        setFetchError("Failed to load configuration.");
        toast.error("Failed to load configuration.");
      } finally {
        setIsFetchingConfig(false);
      }
    };

    fetchConfig();
  }, [selectedServiceId]);

  const handleToggleLimited = (checked) => {
    setConfig((prev) => {
      if (!checked) {
        return { isLimited: false, limits: [] };
      }
      return { ...prev, isLimited: true };
    });
  };

  const handleAddLimit = () => {
    const usedTypes = config.limits.map((l) => l.limitType);
    const availableTypes = LIMIT_TYPES.filter((t) => !usedTypes.includes(t));

    if (availableTypes.length === 0) {
      toast.warning("All limit types are already in use.");
      return;
    }

    setConfig((prev) => ({
      ...prev,
      limits: [...prev.limits, { limitType: availableTypes[0], limitCount: 1 }],
    }));
  };

  const handleUpdateLimit = (index, field, value) => {
    setConfig((prev) => {
      const newLimits = [...prev.limits];
      newLimits[index] = { ...newLimits[index], [field]: value };
      return { ...prev, limits: newLimits };
    });
  };

  const handleDeleteLimit = (index) => {
    setConfig((prev) => ({
      ...prev,
      limits: prev.limits.filter((_, i) => i !== index),
    }));
  };

  const getAvailableTypesForRule = (currentIndex) => {
    const usedTypes = config.limits
      .filter((_, i) => i !== currentIndex)
      .map((l) => l.limitType);
    return LIMIT_TYPES.filter((t) => !usedTypes.includes(t));
  };

  const handleSaveConfig = async () => {
    if (!selectedServiceId) {
      toast.error("Please select a service.");
      return;
    }

    if (config.isLimited && config.limits.length === 0) {
      toast.error("Please add at least one limit rule.");
      return;
    }

    // Client-side validation
    for (const rule of config.limits) {
      if (!rule.limitType) {
        toast.error("Please select a limit type for all rules.");
        return;
      }
      if (rule.limitCount <= 0) {
        toast.error(
          `Limit count for ${rule.limitType} must be greater than zero.`,
        );
        return;
      }
    }

    setIsSaving(true);
    const formData = new FormData();
    formData.append("serviceId", selectedServiceId);
    formData.append("submissionLimitConfig", JSON.stringify(config));

    try {
      const response = await axiosInstance.post(
        "/Designer/SaveServiceConfig",
        formData,
      );
      if (response.data.status) {
        toast.success("Configuration saved successfully!");
      } else {
        toast.error(
          "Failed to save configuration: " +
            (response.data.message || "Unknown error"),
        );
      }
    } catch (error) {
      console.error("Error saving configuration:", error);
      toast.error(
        error.response?.data?.message ||
          "An error occurred while saving the configuration.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "grey.100", p: 3 }}>
      <Container
        maxWidth="md"
        sx={{
          bgcolor: "white",
          borderRadius: 2,
          boxShadow: 3,
          p: 4,
        }}
      >
        <Typography
          variant="h4"
          sx={{ color: "grey.800", mb: 4, fontWeight: "bold" }}
        >
          Configure Submission Limits
        </Typography>

        {/* Service Selection */}
        {isFetchingServices ? (
          <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
            <CircularProgress size={20} sx={{ mr: 2 }} />
            <Typography variant="body2">Loading services...</Typography>
          </Box>
        ) : fetchError && !selectedServiceId ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {fetchError}
          </Alert>
        ) : (
          <FormControl fullWidth sx={{ mb: 3 }}>
            <InputLabel id="service-select-label">Select Service</InputLabel>
            <Select
              labelId="service-select-label"
              value={selectedServiceId}
              label="Select Service"
              onChange={(e) => setSelectedServiceId(e.target.value)}
            >
              <MenuItem value="" disabled>
                Select a Service
              </MenuItem>
              {services.length > 0 ? (
                services.map((service) => (
                  <MenuItem key={service.serviceId} value={service.serviceId}>
                    {service.serviceName}
                  </MenuItem>
                ))
              ) : (
                <MenuItem disabled>No services available</MenuItem>
              )}
            </Select>
          </FormControl>
        )}

        {/* Config Section */}
        {selectedServiceId && (
          <>
            {isFetchingConfig ? (
              <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                <CircularProgress size={20} sx={{ mr: 2 }} />
                <Typography variant="body2">
                  Loading configuration...
                </Typography>
              </Box>
            ) : fetchError ? (
              <Alert severity="error" sx={{ mb: 2 }}>
                {fetchError}
              </Alert>
            ) : (
              <>
                {/* Permission Warning */}
                {!canSaveConfig && (
                  <Alert severity="warning" sx={{ mb: 2 }}>
                    You do not have permission to configure submission limits.
                    Please contact an administrator or log in as a Designer.
                  </Alert>
                )}

                {/* Enable Limits Toggle */}
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={config.isLimited}
                      onChange={(e) => handleToggleLimited(e.target.checked)}
                      disabled={!canSaveConfig}
                    />
                  }
                  label="Enable Submission Limits"
                  sx={{ mb: 2 }}
                />

                {/* Limit Rules */}
                {config.isLimited && (
                  <Box sx={{ mb: 3 }}>
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        mb: 2,
                      }}
                    >
                      <Typography variant="h6" sx={{ fontWeight: "medium" }}>
                        Limit Rules
                      </Typography>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={handleAddLimit}
                        disabled={
                          !canSaveConfig ||
                          config.limits.length >= LIMIT_TYPES.length
                        }
                      >
                        Add Rule
                      </Button>
                    </Box>

                    {config.limits.length === 0 && (
                      <Alert severity="info" sx={{ mb: 2 }}>
                        No limit rules configured. Click "Add Rule" to create
                        one.
                      </Alert>
                    )}

                    {config.limits.map((rule, index) => (
                      <Paper
                        key={index}
                        elevation={1}
                        sx={{
                          p: 2,
                          mb: 2,
                          borderLeft: 4,
                          borderColor: "primary.main",
                        }}
                      >
                        <Grid container spacing={2} alignItems="center">
                          <Grid item xs={12} sm={5}>
                            <FormControl fullWidth size="small">
                              <InputLabel>Limit Type</InputLabel>
                              <Select
                                value={rule.limitType}
                                label="Limit Type"
                                onChange={(e) =>
                                  handleUpdateLimit(
                                    index,
                                    "limitType",
                                    e.target.value,
                                  )
                                }
                                disabled={!canSaveConfig}
                              >
                                <MenuItem value="" disabled>
                                  Select Type
                                </MenuItem>
                                {getAvailableTypesForRule(index).map((type) => (
                                  <MenuItem key={type} value={type}>
                                    {type}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          </Grid>

                          <Grid item xs={12} sm={5}>
                            <TextField
                              label="Limit Count"
                              type="number"
                              value={rule.limitCount}
                              onChange={(e) =>
                                handleUpdateLimit(
                                  index,
                                  "limitCount",
                                  Math.max(1, parseInt(e.target.value) || 0),
                                )
                              }
                              fullWidth
                              size="small"
                              inputProps={{ min: 1 }}
                              disabled={!canSaveConfig}
                            />
                          </Grid>

                          <Grid item xs={12} sm={2}>
                            <IconButton
                              color="error"
                              onClick={() => handleDeleteLimit(index)}
                              disabled={!canSaveConfig}
                              size="small"
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Grid>
                        </Grid>

                        <Box sx={{ mt: 1 }}>
                          <Chip
                            label={`Max ${rule.limitCount} application${rule.limitCount !== 1 ? "s" : ""} per ${rule.limitType.toLowerCase()}`}
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                        </Box>
                      </Paper>
                    ))}

                    {/* Summary */}
                    {config.limits.length > 0 && (
                      <Alert severity="success" sx={{ mt: 2 }}>
                        <Typography
                          variant="subtitle2"
                          sx={{ fontWeight: "bold", mb: 0.5 }}
                        >
                          Active Limits:
                        </Typography>
                        {config.limits.map((rule, idx) => (
                          <Typography key={idx} variant="body2">
                            • {rule.limitType}: {rule.limitCount} application
                            {rule.limitCount !== 1 ? "s" : ""}
                          </Typography>
                        ))}
                      </Alert>
                    )}
                  </Box>
                )}

                {/* Save Button */}
                <Button
                  variant="contained"
                  color="success"
                  onClick={handleSaveConfig}
                  disabled={
                    isSaving ||
                    !canSaveConfig ||
                    !selectedServiceId ||
                    (config.isLimited && config.limits.length === 0)
                  }
                  sx={{ mt: 2 }}
                >
                  {isSaving ? (
                    <CircularProgress size={24} color="inherit" />
                  ) : (
                    "Save Configuration"
                  )}
                </Button>
              </>
            )}
          </>
        )}

        <ToastContainer position="top-right" autoClose={3000} />
      </Container>
    </Box>
  );
}
