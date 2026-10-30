import React, { useState, useEffect, useRef } from "react";
import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Typography,
  CircularProgress,
  Grid,
  Paper,
  Container,
  Alert,
} from "@mui/material";
import { toast } from "react-toastify";
import ServerSideTable from "../../components/ServerSideTable";
import axiosInstance from "../../axiosConfig";
import { Assessment, FilterList, ErrorOutline } from "@mui/icons-material";
import GovPageHeader from "../../components/gov/GovPageHeader";

export default function ReportsAdmin() {
  const [district, setDistrict] = useState("");
  const [service, setService] = useState("");
  const [districts, setDistricts] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isTehsil, setIsTehsil] = useState(false);
  const [isButtonDisabled, setIsButtonDisabled] = useState(true);
  const [showTable, setShowTable] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState("");

  const tableRef = useRef(null);

  // Fetch districts and services
  useEffect(() => {
    const fetchDropdowns = async () => {
      setLoading(true);
      setError(null);

      try {
        const districtsRes = await axiosInstance.get("/Base/GetAccessAreas");
        const servicesRes = await axiosInstance.get("/Base/GetServices");

        if (!districtsRes.data.status || !servicesRes.data.status) {
          throw new Error("Failed to fetch districts or services");
        }

        if (districtsRes.data.tehsils) {
          setIsTehsil(true);
          setDistricts(
            districtsRes.data.tehsils.map((d) => ({
              value: d.tehsilid,
              label: d.tehsilname,
            })),
          );
        } else {
          setDistricts(
            districtsRes.data.districts.map((d) => ({
              value: d.districtid,
              label: d.districtname,
            })),
          );
        }

        setServices(
          servicesRes.data.services.map((s) => ({
            value: s.serviceId,
            label: s.serviceName,
          })),
        );
      } catch (err) {
        const message =
          err.response?.data?.message || err.message || "Something went wrong";
        setError(message);
        toast.error(`Error: ${message}`, {
          position: "top-right",
          autoClose: 3000,
          theme: "colored",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchDropdowns();
  }, []);

  const handleDistrictChange = (event) => {
    setDistrict(event.target.value);
    if (service) setIsButtonDisabled(false);
  };

  const handleServiceChange = (event) => {
    setService(event.target.value);
    if (district) setIsButtonDisabled(false);
  };

  const handleGetReports = () => {
    setShowTable(true);
    setSelectedStatus("");
    setTimeout(() => {
      tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  const extraParams = {
    AccessCode: district,
    ServiceId: service,
    StatusType: selectedStatus,
  };

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
          gap: 3,
        }}
      >
        <ErrorOutline sx={{ fontSize: 64, color: "#DC2626" }} />
        <Typography color="error" variant="h6" sx={{ fontWeight: 600 }}>
          {error}
        </Typography>
        <Button
          variant="contained"
          onClick={() => window.location.reload()}
          sx={{
            bgcolor: "#2562E9",
            textTransform: "none",
            fontWeight: 600,
            "&:hover": { bgcolor: "#1D4ED8" },
          }}
        >
          Retry
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ bgcolor: "#F8FAFC", minHeight: "100vh", py: 4 }}>
      <Container maxWidth="xl">
        {/* Page Header - GIGW standard */}
        <GovPageHeader
          title="Admin Reports"
          hindiTitle="प्रशासनिक रिपोर्ट"
          subtitle="Generate and export application reports by region and service"
          icon={<Assessment sx={{ fontSize: 32, color: "primary.main" }} />}
        />

        {/* Filter Card */}
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
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 3 }}>
            <FilterList sx={{ color: "#2562E9" }} />
            <Typography variant="h6" sx={{ fontWeight: 700, color: "#0F172A" }}>
              Report Filters
            </Typography>
          </Box>

          <Grid container spacing={3} alignItems="center">
            <Grid item xs={12} md={5}>
              <FormControl fullWidth>
                <InputLabel>{isTehsil ? "Tehsil" : "District"}</InputLabel>
                <Select
                  value={district}
                  label={isTehsil ? "Tehsil" : "District"}
                  onChange={handleDistrictChange}
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
                    <em>Please Select</em>
                  </MenuItem>
                  {districts.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={5}>
              <FormControl fullWidth>
                <InputLabel>Service</InputLabel>
                <Select
                  value={service}
                  label="Service"
                  onChange={handleServiceChange}
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
                    <em>Please Select</em>
                  </MenuItem>
                  {services.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={2}>
              <Button
                variant="contained"
                fullWidth
                onClick={handleGetReports}
                disabled={isButtonDisabled}
                sx={{
                  py: 1.6,
                  bgcolor: "#2562E9",
                  "&:hover": { bgcolor: "#1D4ED8" },
                  textTransform: "none",
                  fontWeight: 700,
                  fontSize: "1rem",
                  boxShadow: "0 4px 12px rgba(37, 99, 233, 0.2)",
                  "&.Mui-disabled": { bgcolor: "#E2E8F0", color: "#94A3B8" },
                }}
              >
                Generate Reports
              </Button>
            </Grid>
          </Grid>
        </Paper>

        {/* Results Table */}
        {showTable && (
          <Box ref={tableRef}>
            <ServerSideTable
              key={`${district}-${service}-${selectedStatus}`}
              url={`/Admin/GetApplicationsForReports`}
              extraParams={extraParams}
              Title={isTehsil ? "Tehsil Wise Reports" : "District Wise Reports"}
              showDownloadButtons={true}
            />
          </Box>
        )}
      </Container>
    </Box>
  );
}
