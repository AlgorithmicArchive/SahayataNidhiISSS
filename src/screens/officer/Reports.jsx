import React, { useEffect, useState, useRef, useMemo } from "react";
import GovPageHeader from "../../components/gov/GovPageHeader";
import axiosInstance from "../../axiosConfig";
import {
  Box,
  Paper,
  Typography,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  Button,
  Chip,
  TextField,
  Card,
  CardContent,
  Divider,
  Container,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import { FormHelperText } from "@mui/material";
import ServerSideTable from "../../components/ServerSideTable";
import DynamicReportRunner from "../../components/DynamicReportRunner";
import { toast } from "react-toastify";

import {
  Assessment,
  FilterList,
  LocationCity,
  Category,
  CalendarToday,
  PlayArrow,
  Info,
} from "@mui/icons-material";

export default function Reports() {
  const [officerAccessLevel, setOfficerAccessLevel] = useState(null);
  const [officerAccessCode, setOfficerAccessCode] = useState(null);
  const [officerRole, setOfficerRole] = useState(null);

  // Service state
  const [services, setServices] = useState([]);
  const [selectedService, setSelectedService] = useState("");
  const [loadingServices, setLoadingServices] = useState(false);

  // Report type state
  const [reportTypes, setReportTypes] = useState([]);
  const [selectedReportType, setSelectedReportType] = useState("");
  const [loadingReportTypes, setLoadingReportTypes] = useState(false);

  // Active template filters (from template definition)
  const [activeTemplateFilters, setActiveTemplateFilters] = useState([]);
  const [filterInputValues, setFilterInputValues] = useState({});

  // Location filter states
  const [districts, setDistricts] = useState([]);
  const [tehsils, setTehsils] = useState([]);
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [selectedTehsil, setSelectedTehsil] = useState("");
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingTehsils, setLoadingTehsils] = useState(false);

  // Submission-date filter states
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Sanction-date filter states (only for DetailedApplications)
  const [sanctionFromDate, setSanctionFromDate] = useState("");
  const [sanctionToDate, setSanctionToDate] = useState("");

  // ── Which date filter is active. Only one at a time. ─────────────
  //    "submission" (default) | "sanction"
  const [dateFilterType, setDateFilterType] = useState("submission");

  // Status filter (static)
  const [statusTypes] = useState([
    { value: "total", label: "Total Applications" },
    { value: "Initiated", label: "Under Process" },
    { value: "Sanctioned", label: "Sanctioned" },
    { value: "Rejected", label: "Rejected" },
  ]);
  const [selectedStatus, setSelectedStatus] = useState("total");

  // Table refresh trigger
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showReport, setShowReport] = useState(false);
  const [reportParams, setReportParams] = useState({});

  // Ref for auto-scrolling to the table
  const tableRef = useRef(null);

  const emptyActionFunctions = useMemo(() => ({}), []);

  useEffect(() => {
    const fetchOfficerData = async () => {
      try {
        const response = await axiosInstance.get(
          "/Officer/GetOfficerAccessDetails",
        );
        const data = response.data;
        setOfficerAccessLevel(data.accessLevel);
        setOfficerAccessCode(data.accessCode);
        setOfficerRole(data.role);
      } catch (error) {
        console.error("Error fetching officer data:", error);
      }
    };
    fetchOfficerData();
  }, []);

  // Fetch services
  useEffect(() => {
    const fetchServices = async () => {
      setLoadingServices(true);
      try {
        const response = await axiosInstance.get("/Base/GetServices");
        if (response.data.status) {
          setServices(response.data.services);
          if (response.data.services.length > 0) {
            setSelectedService(response.data.services[0].serviceId);
          }
        }
      } catch (error) {
        console.error("Error fetching services:", error);
        toast.error("Failed to fetch services");
      } finally {
        setLoadingServices(false);
      }
    };
    fetchServices();
  }, []);

  // Fetch report types
  useEffect(() => {
    const fetchReportTypes = async () => {
      setLoadingReportTypes(true);
      try {
        const response = await axiosInstance.get("/Officer/GetReportTypes");
        if (response.data.status) {
          setReportTypes(response.data.reportTypes);
        }
      } catch (error) {
        console.error("Error fetching report types:", error);
        toast.error("Failed to fetch report types");
      } finally {
        setLoadingReportTypes(false);
      }
    };
    fetchReportTypes();
  }, []);

  // Fetch districts based on access level
  useEffect(() => {
    const fetchDistricts = async () => {
      if (officerAccessLevel === "Division") {
        setLoadingDistricts(true);
        try {
          const response = await axiosInstance.get("/Base/GetDistricts", {
            params: { division: officerAccessCode },
          });
          if (response.data.status) {
            setDistricts(response.data.districts);
          }
        } catch (error) {
          console.error("Error fetching districts:", error);
        } finally {
          setLoadingDistricts(false);
        }
      } else if (officerAccessLevel === "District") {
        fetchTehsils(officerAccessCode);
      }
    };

    if (officerAccessLevel) {
      fetchDistricts();
    }
  }, [officerAccessLevel, officerAccessCode]);

  // Fetch tehsils for selected district
  const fetchTehsils = async (districtId) => {
    if (!districtId) return;

    setLoadingTehsils(true);
    try {
      const response = await axiosInstance.get("/Base/GetTeshilForDistrict", {
        params: { districtId: districtId },
      });
      if (response.data.status) {
        setTehsils(response.data.tehsils);
      }
    } catch (error) {
      console.error("Error fetching tehsils:", error);
    } finally {
      setLoadingTehsils(false);
    }
  };

  // Handle district change
  const handleDistrictChange = (event) => {
    const districtId = event.target.value;
    setSelectedDistrict(districtId);
    setSelectedTehsil("");
    fetchTehsils(districtId);
  };

  // Handle report type change
  const handleReportTypeChange = (event) => {
    const newReportType = event.target.value;
    setSelectedReportType(newReportType);
    setShowReport(false);

    // Reset sanction-related state when leaving DetailedApplications
    if (newReportType !== "DetailedApplications") {
      setSanctionFromDate("");
      setSanctionToDate("");
      setDateFilterType("submission");
    }
  };

  // ── Toggle between submission / sanction date filter ─────────────
  const handleDateFilterTypeChange = (event, newValue) => {
    // Prevent deselecting the only active option
    if (!newValue) return;
    setDateFilterType(newValue);

    // Clear the panel we're switching away from so its values don't
    // accidentally get submitted later.
    if (newValue === "submission") {
      setSanctionFromDate("");
      setSanctionToDate("");
    } else {
      setFromDate("");
      setToDate("");
    }
  };

  // Validate the active date range before generating the report
  const validateDateRange = () => {
    if (dateFilterType === "submission") {
      if (fromDate && toDate && fromDate > toDate) {
        toast.error("'From Date' cannot be later than 'To Date'.");
        return false;
      }
    } else if (dateFilterType === "sanction") {
      if (
        sanctionFromDate &&
        sanctionToDate &&
        sanctionFromDate > sanctionToDate
      ) {
        toast.error(
          "'Sanction From Date' cannot be later than 'Sanction To Date'.",
        );
        return false;
      }
    }
    return true;
  };

  // Handle generate report
  const handleGenerateReport = () => {
    if (!selectedReportType) {
      toast.error("Please select a report type");
      return;
    }
    if (!selectedService) {
      toast.error("Please select a service");
      return;
    }
    if (!validateDateRange()) return;

    let filterValue = officerAccessCode;
    let accessLevel = officerAccessLevel;

    if (officerAccessLevel === "Division") {
      if (selectedTehsil) {
        filterValue = selectedTehsil;
        accessLevel = "Tehsil";
      } else if (selectedDistrict) {
        filterValue = selectedDistrict;
        accessLevel = "District";
      } else {
        filterValue = officerAccessCode;
        accessLevel = "Division";
      }
    } else if (officerAccessLevel === "District") {
      if (selectedTehsil) {
        filterValue = selectedTehsil;
        accessLevel = "Tehsil";
      } else {
        filterValue = officerAccessCode;
        accessLevel = "District";
      }
    } else if (officerAccessLevel === "Tehsil") {
      filterValue = officerAccessCode;
      accessLevel = "Tehsil";
    }

    const params = {
      accessCode: filterValue,
      serviceId: selectedService,
      accessLevel: accessLevel,
      reportType: selectedReportType,
    };

    if (
      selectedReportType === "AgeWise" ||
      selectedReportType === "PensionTypeWise" ||
      selectedReportType === "GenderWise" ||
      selectedReportType === "DetailedApplications"
    ) {
      params.statusType = selectedStatus;
    }

    if (selectedReportType === "DetailedApplications") {
      params.role = officerRole;
    }

    // ── Only the ACTIVE date filter is sent ──────────────────────
    if (dateFilterType === "submission") {
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;
    } else if (
      dateFilterType === "sanction" &&
      selectedReportType === "DetailedApplications"
    ) {
      if (sanctionFromDate) params.sanctionFromDate = sanctionFromDate;
      if (sanctionToDate) params.sanctionToDate = sanctionToDate;
    }

    console.log("🚀 Report Params being sent to API:", params);

    setReportParams(params);
    setShowReport(true);
    setRefreshTrigger((prev) => prev + 1);

    setTimeout(() => {
      if (tableRef.current) {
        tableRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 150);
  };

  // Determine which filters to show based on access level
  const renderLocationFilters = () => {
    if (!officerAccessLevel) return null;

    switch (officerAccessLevel) {
      case "Division":
        return (
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>District</InputLabel>
                <Select
                  value={selectedDistrict}
                  onChange={handleDistrictChange}
                  label="District"
                  disabled={loadingDistricts}
                  sx={{
                    bgcolor: "white",
                    "& .MuiOutlinedInput-notchedOutline": {
                      borderColor: "#E2E8F0",
                    },
                    "&:hover .MuiOutlinedInput-notchedOutline": {
                      borderColor: "#2562E9",
                    },
                    "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                      borderColor: "#2562E9",
                    },
                  }}
                >
                  <MenuItem value="">
                    <em>Select District</em>
                  </MenuItem>
                  {districts.map((district) => (
                    <MenuItem
                      key={district.districtid}
                      value={district.districtid}
                    >
                      {district.districtname}
                    </MenuItem>
                  ))}
                </Select>
                {loadingDistricts && (
                  <FormHelperText>Loading districts...</FormHelperText>
                )}
              </FormControl>
            </Grid>

            {selectedDistrict && (
              <Grid item xs={12} md={4}>
                <FormControl fullWidth>
                  <InputLabel>Tehsil</InputLabel>
                  <Select
                    value={selectedTehsil}
                    onChange={(e) => setSelectedTehsil(e.target.value)}
                    label="Tehsil"
                    disabled={loadingTehsils}
                    sx={{
                      bgcolor: "white",
                      "& .MuiOutlinedInput-notchedOutline": {
                        borderColor: "#E2E8F0",
                      },
                      "&:hover .MuiOutlinedInput-notchedOutline": {
                        borderColor: "#2562E9",
                      },
                      "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                        borderColor: "#2562E9",
                      },
                    }}
                  >
                    <MenuItem value="">
                      <em>Select Tehsil</em>
                    </MenuItem>
                    {tehsils.map((tehsil) => (
                      <MenuItem key={tehsil.tehsilid} value={tehsil.tehsilid}>
                        {tehsil.tehsilname}
                      </MenuItem>
                    ))}
                  </Select>
                  {loadingTehsils && (
                    <FormHelperText>Loading tehsils...</FormHelperText>
                  )}
                </FormControl>
              </Grid>
            )}
          </Grid>
        );

      case "District":
        return (
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Tehsil</InputLabel>
                <Select
                  value={selectedTehsil}
                  onChange={(e) => setSelectedTehsil(e.target.value)}
                  label="Tehsil"
                  disabled={loadingTehsils}
                  sx={{
                    bgcolor: "white",
                    "& .MuiOutlinedInput-notchedOutline": {
                      borderColor: "#E2E8F0",
                    },
                    "&:hover .MuiOutlinedInput-notchedOutline": {
                      borderColor: "#2562E9",
                    },
                    "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                      borderColor: "#2562E9",
                    },
                  }}
                >
                  <MenuItem value="">
                    <em>Select Tehsil</em>
                  </MenuItem>
                  {tehsils.map((tehsil) => (
                    <MenuItem key={tehsil.tehsilid} value={tehsil.tehsilid}>
                      {tehsil.tehsilname}
                    </MenuItem>
                  ))}
                </Select>
                {loadingTehsils && (
                  <FormHelperText>Loading tehsils...</FormHelperText>
                )}
              </FormControl>
            </Grid>
          </Grid>
        );

      case "Tehsil":
        return (
          <Alert
            severity="info"
            icon={<Info />}
            sx={{ bgcolor: "#EFF6FF", border: "1px solid #BFDBFE" }}
          >
            Reports will be generated for your assigned Tehsil area only.
          </Alert>
        );

      default:
        return null;
    }
  };

  // Submission OR Sanction date filters — only one at a time
  const renderDateFilters = () => {
    // Sanction date is only meaningful for DetailedApplications
    const showDateFilterToggle = selectedReportType === "DetailedApplications";

    const dateInputSx = {
      "& .MuiOutlinedInput-root": {
        bgcolor: "white",
        "& fieldset": { borderColor: "#E2E8F0" },
        "&:hover fieldset": { borderColor: "#2562E9" },
        "&.Mui-focused fieldset": { borderColor: "#2562E9" },
      },
    };

    return (
      <Box sx={{ mt: 3 }}>
        {/* ── Filter type toggle (only for DetailedApplications) ───── */}
        {showDateFilterToggle && (
          <Box sx={{ mb: 3 }}>
            <Typography
              variant="subtitle2"
              sx={{ mb: 1, fontWeight: 600, color: "#475569" }}
            >
              Date Filter
            </Typography>
            <ToggleButtonGroup
              value={dateFilterType}
              exclusive
              onChange={handleDateFilterTypeChange}
              size="small"
              sx={{
                bgcolor: "white",
                "& .MuiToggleButton-root": {
                  textTransform: "none",
                  fontWeight: 600,
                  px: 2.5,
                  py: 0.75,
                  borderColor: "#E2E8F0",
                  color: "#475569",
                  "&.Mui-selected": {
                    bgcolor: "#EFF6FF",
                    color: "#2562E9",
                    borderColor: "#2562E9",
                    "&:hover": { bgcolor: "#DBEAFE" },
                  },
                },
              }}
            >
              <ToggleButton value="submission">Submission Date</ToggleButton>
              <ToggleButton value="sanction">Sanction Date</ToggleButton>
            </ToggleButtonGroup>
          </Box>
        )}

        {/* ── Submission Date panel ───────────────────────────────── */}
        {dateFilterType === "submission" && (
          <>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
              <CalendarToday sx={{ fontSize: 18, color: "#64748B" }} />
              <Typography
                variant="subtitle2"
                sx={{ fontWeight: 600, color: "#475569" }}
              >
                Submission Date
              </Typography>
              <Typography variant="caption" sx={{ color: "#94A3B8", ml: 0.5 }}>
                (Optional)
              </Typography>
            </Box>
            <Grid container spacing={3}>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  type="date"
                  label="From Date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={dateInputSx}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  type="date"
                  label="To Date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  inputProps={{ min: fromDate || undefined }}
                  error={Boolean(fromDate && toDate && fromDate > toDate)}
                  helperText={
                    fromDate && toDate && fromDate > toDate
                      ? "'To Date' must be on or after 'From Date'"
                      : ""
                  }
                  sx={dateInputSx}
                />
              </Grid>
              {(fromDate || toDate) && (
                <Grid item xs={12} md={2} sx={{ display: "flex" }}>
                  <Button
                    variant="text"
                    onClick={() => {
                      setFromDate("");
                      setToDate("");
                    }}
                    sx={{
                      textTransform: "none",
                      color: "#64748B",
                      "&:hover": { color: "#DC2626", bgcolor: "#FEF2F2" },
                      alignSelf: "center",
                    }}
                  >
                    Clear Dates
                  </Button>
                </Grid>
              )}
            </Grid>
          </>
        )}

        {/* ── Sanction Date panel ─────────────────────────────────── */}
        {dateFilterType === "sanction" &&
          selectedReportType === "DetailedApplications" && (
            <>
              <Box
                sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}
              >
                <CalendarToday sx={{ fontSize: 18, color: "#64748B" }} />
                <Typography
                  variant="subtitle2"
                  sx={{ fontWeight: 600, color: "#475569" }}
                >
                  Sanction Date
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ color: "#94A3B8", ml: 0.5 }}
                >
                  (Optional — applies to Sanctioned applications only)
                </Typography>
              </Box>
              <Grid container spacing={3}>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    type="date"
                    label="Sanction From"
                    value={sanctionFromDate}
                    onChange={(e) => setSanctionFromDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    sx={dateInputSx}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    type="date"
                    label="Sanction To"
                    value={sanctionToDate}
                    onChange={(e) => setSanctionToDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    inputProps={{ min: sanctionFromDate || undefined }}
                    error={Boolean(
                      sanctionFromDate &&
                      sanctionToDate &&
                      sanctionFromDate > sanctionToDate,
                    )}
                    helperText={
                      sanctionFromDate &&
                      sanctionToDate &&
                      sanctionFromDate > sanctionToDate
                        ? "'Sanction To' must be on or after 'Sanction From'"
                        : ""
                    }
                    sx={dateInputSx}
                  />
                </Grid>
                {(sanctionFromDate || sanctionToDate) && (
                  <Grid item xs={12} md={2} sx={{ display: "flex" }}>
                    <Button
                      variant="text"
                      onClick={() => {
                        setSanctionFromDate("");
                        setSanctionToDate("");
                      }}
                      sx={{
                        textTransform: "none",
                        color: "#64748B",
                        "&:hover": { color: "#DC2626", bgcolor: "#FEF2F2" },
                        alignSelf: "center",
                      }}
                    >
                      Clear Sanction Dates
                    </Button>
                  </Grid>
                )}
              </Grid>
            </>
          )}
      </Box>
    );
  };

  // Render additional filters (Status only)
  const renderAdditionalFilters = () => {
    if (!selectedReportType) return null;

    const needsStatusFilter = [
      "AgeWise",
      "PensionTypeWise",
      "GenderWise",
      "DetailedApplications",
    ].includes(selectedReportType);

    if (!needsStatusFilter) return null;

    return (
      <Box sx={{ mt: 3 }}>
        <Typography
          variant="subtitle2"
          sx={{ mb: 2, fontWeight: 600, color: "#475569" }}
        >
          Application Status
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                label="Status"
                sx={{
                  bgcolor: "white",
                  "& .MuiOutlinedInput-notchedOutline": {
                    borderColor: "#E2E8F0",
                  },
                  "&:hover .MuiOutlinedInput-notchedOutline": {
                    borderColor: "#2562E9",
                  },
                  "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                    borderColor: "#2562E9",
                  },
                }}
              >
                {statusTypes.map((status) => (
                  <MenuItem key={status.value} value={status.value}>
                    {status.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Box>
    );
  };

  // Get report title
  const getReportTitle = () => {
    if (!selectedReportType) return "Reports";
    const reportType = reportTypes.find((r) => r.value === selectedReportType);
    const service = services.find((s) => s.serviceId === selectedService);
    return reportType
      ? `${reportType.label} - ${service?.serviceName || ""}`
      : "Reports";
  };

  // Searchable fields per report type
  // ── UPDATED: DetailedApplications now includes mobile_number and the two
  //    new date columns so the user can search them in the on-screen grid.
  const searchableFields = useMemo(() => {
    switch (selectedReportType) {
      case "AgeWise":
        return ["age_range"];
      case "PensionTypeWise":
        return ["age_range", "pensiontype"];
      case "GenderWise":
        return ["gender"];
      case "DetailedApplications":
        return [
          "referencenumber",
          "applicant_name",
          "mobile_number",
          "districtname",
          "tswofficename",
          "submission_date",
          "sanctioned_date",
        ];
      default:
        return ["tehsilname"];
    }
  }, [selectedReportType]);

  return (
    <Box sx={{ bgcolor: "#F8FAFC", minHeight: "100vh", py: 4 }}>
      <Container maxWidth="xl">
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1 }}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: 2,
                bgcolor: "#EFF6FF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Assessment sx={{ fontSize: 28, color: "#2562E9" }} />
            </Box>
            <Box>
              <GovPageHeader
                title="Reports Dashboard"
                hindiTitle="रिपोर्ट डैशबोर्ड"
                crumbs={[
                  { label: "Officer", path: "/officer/home" },
                  { label: "Reports", path: "" },
                ]}
              />
              <Typography variant="body2" sx={{ color: "#64748B" }}>
                Generate comprehensive reports and analytics for your assigned
                area
              </Typography>
            </Box>
          </Box>
          {officerRole && (
            <Box sx={{ mt: 2, display: "flex", gap: 1 }}>
              <Chip
                label={`Role: ${officerRole}`}
                size="small"
                sx={{ bgcolor: "#DBEAFE", color: "#1E40AF", fontWeight: 600 }}
              />
              <Chip
                label={`Access: ${officerAccessLevel}`}
                size="small"
                sx={{ bgcolor: "#D1FAE5", color: "#065F46", fontWeight: 600 }}
              />
            </Box>
          )}
        </Box>

        {/* Configuration Card */}
        <Paper
          elevation={0}
          sx={{
            p: 4,
            mb: 4,
            borderRadius: 3,
            border: "1px solid #E2E8F0",
            bgcolor: "white",
          }}
        >
          <Box sx={{ mb: 4 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
              <Category sx={{ color: "#2562E9" }} />
              <Typography
                variant="h6"
                sx={{ fontWeight: 700, color: "#0F172A" }}
              >
                Step 1: Select Service
              </Typography>
            </Box>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Service</InputLabel>
                  <Select
                    value={selectedService}
                    onChange={(e) => setSelectedService(e.target.value)}
                    label="Service"
                    disabled={loadingServices}
                    sx={{
                      bgcolor: "white",
                      "& .MuiOutlinedInput-notchedOutline": {
                        borderColor: "#E2E8F0",
                      },
                      "&:hover .MuiOutlinedInput-notchedOutline": {
                        borderColor: "#2562E9",
                      },
                      "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                        borderColor: "#2562E9",
                      },
                    }}
                  >
                    {services.map((service) => (
                      <MenuItem
                        key={service.serviceId}
                        value={service.serviceId}
                      >
                        {service.serviceName}
                      </MenuItem>
                    ))}
                  </Select>
                  {loadingServices && (
                    <FormHelperText>Loading services...</FormHelperText>
                  )}
                </FormControl>
              </Grid>
            </Grid>
          </Box>

          <Divider sx={{ my: 3 }} />

          <Box sx={{ mb: 4 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
              <FilterList sx={{ color: "#2562E9" }} />
              <Typography
                variant="h6"
                sx={{ fontWeight: 700, color: "#0F172A" }}
              >
                Step 2: Select Report Type
              </Typography>
            </Box>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Report Type</InputLabel>
                  <Select
                    value={selectedReportType}
                    onChange={handleReportTypeChange}
                    label="Report Type"
                    disabled={loadingReportTypes}
                    sx={{
                      bgcolor: "white",
                      "& .MuiOutlinedInput-notchedOutline": {
                        borderColor: "#E2E8F0",
                      },
                      "&:hover .MuiOutlinedInput-notchedOutline": {
                        borderColor: "#2562E9",
                      },
                      "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                        borderColor: "#2562E9",
                      },
                    }}
                  >
                    <MenuItem value="">
                      <em>Select Report Type</em>
                    </MenuItem>
                    {reportTypes.map((type) => (
                      <MenuItem key={type.value} value={type.value}>
                        {type.label}
                      </MenuItem>
                    ))}
                  </Select>
                  {loadingReportTypes && (
                    <FormHelperText>Loading report types...</FormHelperText>
                  )}
                </FormControl>
              </Grid>
            </Grid>
          </Box>

          {selectedReportType && (
            <>
              <Divider sx={{ my: 3 }} />
              <Box>
                <Box
                  sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}
                >
                  <LocationCity sx={{ color: "#2562E9" }} />
                  <Typography
                    variant="h6"
                    sx={{ fontWeight: 700, color: "#0F172A" }}
                  >
                    Step 3: Apply Filters
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ color: "#64748B", ml: 1 }}
                  >
                    (Optional)
                  </Typography>
                </Box>
                {renderLocationFilters()}
                {renderDateFilters()}
                {renderAdditionalFilters()}

                <Box
                  sx={{ mt: 4, display: "flex", justifyContent: "flex-end" }}
                >
                  <Button
                    variant="contained"
                    onClick={handleGenerateReport}
                    disabled={!selectedService || !selectedReportType}
                    size="large"
                    startIcon={<PlayArrow />}
                    sx={{
                      bgcolor: "#10B981",
                      textTransform: "none",
                      fontWeight: 700,
                      px: 4,
                      py: 1.5,
                      fontSize: "1rem",
                      "&:hover": { bgcolor: "#059669" },
                      "&.Mui-disabled": {
                        bgcolor: "#D1FAE5",
                        color: "#6EE7B7",
                      },
                      boxShadow: "0 4px 12px rgba(16, 185, 129, 0.3)",
                    }}
                  >
                    Generate Report
                  </Button>
                </Box>
              </Box>
            </>
          )}
        </Paper>

        {/* Report Display */}
        {showReport && (
          <Box sx={{ mt: 4 }} ref={tableRef}>
            <ServerSideTable
              key={refreshTrigger}
              url="/Officer/GetApplicationsForReport"
              extraParams={reportParams}
              Title={getReportTitle()}
              searchableFields={searchableFields}
              showDownloadButtons={true}
              actionFunctions={emptyActionFunctions}
            />
          </Box>
        )}
      </Container>
    </Box>
  );
}
