import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  CircularProgress,
} from "@mui/material";
import { toast } from "react-toastify";
import { Container } from "react-bootstrap";
import ServerSideTable from "../../components/ServerSideTable";
import axiosInstance from "../../axiosConfig";
import SftpModal from "../../components/SftpModal";

export default function BankFile() {
  const [district, setDistrict] = useState("");
  const [service, setService] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [districts, setDistricts] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isTehsil, setIsTehsil] = useState(false);
  const [isButtonDisabled, setIsButtonDisabled] = useState(true);
  const [showTable, setShowTable] = useState(false);
  const [open, setOpen] = useState(false);


  const currentDate = new Date();
  const currentMonth = currentDate.getMonth(); // 0-indexed
  const currentYear = currentDate.getFullYear();

  // Show only current and previous month
  const visibleMonths = [currentMonth - 1, currentMonth].filter((m) => m >= 0);

  const monthOptions = visibleMonths.map((m) => ({
    value: m + 1,
    label: new Date(0, m).toLocaleString("default", { month: "long" }),
  }));

  const yearOptions = [currentYear - 1, currentYear];

  useEffect(() => {
    const fetchDropdowns = async () => {
      setLoading(true);
      setError(null);
      try {
        const [districtsRes, servicesRes] = await Promise.all([
          axiosInstance.get(`/Base/GetAccessAreas`),
          axiosInstance.get(`/Base/GetServices`),
        ]);

        if (districtsRes.data.status && servicesRes.data.status) {
          if (districtsRes.data.tehsils) {
            setIsTehsil(true);
            setDistricts(
              districtsRes.data.tehsils.map((d) => ({
                value: d.tehsilId,
                label: d.tehsilName,
              }))
            );
          } else {
            setDistricts(
              districtsRes.data.districts.map((d) => ({
                value: d.districtId,
                label: d.districtName,
              }))
            );
          }
          setServices(
            servicesRes.data.services.map((s) => ({
              value: s.serviceId,
              label: s.serviceName,
            }))
          );
        } else {
          throw new Error("Failed to fetch districts or services");
        }
      } catch (err) {
        setError(err.message);
        toast.error(`Error: ${err.message}`, {
          position: "top-right",
          autoClose: 3000,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchDropdowns();
  }, []);

  useEffect(() => {
    if (district && service && month && year) {
      setIsButtonDisabled(false);
    } else {
      setIsButtonDisabled(true);
    }
  }, [district, service, month, year]);

  const handleDistrictChange = (event) => {
    setDistrict(event.target.value);
    setShowTable(false);
  };

  const handleServiceChange = (event) => {
    setService(event.target.value);
    setShowTable(false);
  };

  const handleMonthChange = (event) => {
    setMonth(event.target.value);
    setShowTable(false);
  };

  const handleYearChange = (event) => {
    setYear(event.target.value);
    setShowTable(false);
  };

  const handleGetTable = () => {
    setShowTable(true);
  };

  const handleCreateBankFile = async () => {
    try {
      const response = await axiosInstance.get(`/Officer/ExportBankFileCsv`, {
        params: {
          AccessCode: district,
          ServiceId: service,
          Month: month,
          Year: year,
          type: "Sanctioned",
        },
        responseType: "blob", // Needed for file download
      });

      // Extract filename from Content-Disposition header
      const disposition = response.headers["content-disposition"];
      let filename = "BankFile.csv"; // fallback

      if (disposition && disposition.indexOf("filename=") !== -1) {
        const match = disposition.match(/filename="?(.+?)"?$/);
        if (match?.[1]) {
          filename = match[1];
        }
      }

      // Create Blob & Download
      const blob = new Blob([response.data], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      toast.success("Bank file downloaded successfully", {
        position: "top-right",
        autoClose: 3000,
      });
    } catch (error) {
      toast.error(`Error downloading bank file: ${error.message}`, {
        position: "top-right",
        autoClose: 3000,
      });
    }
  };

  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);

  const extraParams = {
    ServiceId: service,
    AccessCode: district,
    type: "Sanctioned",
    Month: month,
    Year: year,
  };

  if (loading) {
    return (
      <Box
        sx={{
          width: "100%",
          height: { xs: "100vh", lg: "70vh" },
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          bgcolor: "#f5f5f5",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box
        sx={{
          width: "100%",
          height: { xs: "100vh", lg: "70vh" },
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          bgcolor: "#f5f5f5",
        }}
      >
        <Typography color="error" variant="h6">
          {error}
        </Typography>
        <Button
          variant="contained"
          onClick={() => window.location.reload()}
          sx={{ mt: 2 }}
        >
          Retry
        </Button>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        width: "100%",
        minHeight: { xs: "auto", lg: "100vh" },
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        p: { xs: 2, md: 4 },
      }}
    >
      <Typography
        variant="h5"
        sx={{ mb: 4, fontWeight: "bold", color: "#333333" }}
      >
        Bank File Management
      </Typography>

      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: 3,
          width: "100%",
          maxWidth: "700px",
          mb: 4,
        }}
      >
        {/* District/Tehsil Dropdown */}
        <FormControl fullWidth>
          <InputLabel id="district-select-label">
            {isTehsil ? "Tehsil" : "District"}
          </InputLabel>
          <Select
            labelId="district-select-label"
            value={district}
            label={isTehsil ? "Tehsil" : "District"}
            onChange={handleDistrictChange}
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

        {/* Service Dropdown */}
        <FormControl fullWidth>
          <InputLabel id="service-select-label">Service</InputLabel>
          <Select
            labelId="service-select-label"
            value={service}
            label="Service"
            onChange={handleServiceChange}
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

        {/* Month Dropdown */}
        <FormControl fullWidth>
          <InputLabel id="month-select-label">Month</InputLabel>
          <Select
            labelId="month-select-label"
            value={month}
            label="Month"
            onChange={handleMonthChange}
          >
            <MenuItem value="">
              <em>Please Select</em>
            </MenuItem>
            {monthOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Year Dropdown */}
        <FormControl fullWidth>
          <InputLabel id="year-select-label">Year</InputLabel>
          <Select
            labelId="year-select-label"
            value={year}
            label="Year"
            onChange={handleYearChange}
          >
            <MenuItem value="">
              <em>Please Select</em>
            </MenuItem>
            {yearOptions.map((option) => (
              <MenuItem key={option} value={option}>
                {option}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      <Box sx={{ display: "flex", gap: 2, mb: 4 }}>
        <Button
          variant="contained"
          color="primary"
          onClick={handleGetTable}
          disabled={isButtonDisabled}
        >
          Check Records
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={handleCreateBankFile}
          disabled={isButtonDisabled}
        >
          Create Bank File
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={handleOpen}
          disabled={isButtonDisabled}
        >
          Send Bank File
        </Button>
      </Box>

      {showTable && (
        <Container>
          <ServerSideTable
            key={`${service}-${district}-${month}-${year}`}
            url="/Officer/GetRecordsForBankFile"
            extraParams={extraParams}
            Title={"Bank File"}
          />
        </Container>
      )}

      <SftpModal
        open={open}
        handleClose={handleClose}
        serviceId={service}
        districtId={district}
        month={month}
        year={year}
        type={"Sanctioned"}
      />
    </Box>
  );
}
