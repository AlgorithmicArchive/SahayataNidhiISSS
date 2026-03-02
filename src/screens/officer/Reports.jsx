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
  Card,
  CardContent,
  TextField,
} from "@mui/material";
import { toast } from "react-toastify";
import { Container, Row, Col } from "react-bootstrap";
import styled from "@emotion/styled";
import ServerSideTable from "../../components/ServerSideTable";
import axiosInstance from "../../axiosConfig";

const StyledCard = styled(Card)`
  background: linear-gradient(135deg, #ffffff, #f8f9fa);
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  &:hover {
    transform: translateY(-5px);
    box-shadow: 0 6px 25px rgba(0, 0, 0, 0.15);
  }
`;

const StyledButton = styled(Button)`
  background: linear-gradient(45deg, #1976d2, #2196f3);
  padding: 12px 24px;
  font-weight: 600;
  border-radius: 8px;
  text-transform: none;
  &:hover {
    background: linear-gradient(45deg, #1565c0, #1976d2);
    transform: scale(1.05);
  }
  &:disabled {
    background: #cccccc;
    color: #666666;
  }
`;

export default function Reports() {
  const [district, setDistrict] = useState("");               // kept but no longer used
  const [service, setService] = useState("");
  const [districts, setDistricts] = useState([]);            // kept but not rendered
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isTehsil, setIsTehsil] = useState(false);           // kept but not used
  const [isButtonDisabled, setIsButtonDisabled] = useState(true);
  const [showTable, setShowTable] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState("");
  const [reportType, setReportType] = useState("TehsilWise");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [applicationStatusList] = useState([
    { value: "", label: "All Statuses" },
    { value: "pending", label: "Pending" },
    { value: "forwarded", label: "Forwarded" },
    { value: "returned", label: "Returned" },
    { value: "returntoedit", label: "Return to Edit" },
    { value: "sanctioned", label: "Sanctioned" },
    { value: "rejected", label: "Rejected" },
  ]);

  const tableRef = useRef(null);

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
              })),
            );
          } else {
            setDistricts(
              districtsRes.data.districts.map((d) => ({
                value: d.districtId,
                label: d.districtName,
              })),
            );
          }
          setServices(
            servicesRes.data.services.map((s) => ({
              value: s.serviceId,
              label: s.serviceName,
            })),
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

  // 🔁 Updated button disable logic – district no longer required
  useEffect(() => {
    if (reportType === "AgeWise" || reportType === "PensionTypeWise") {
      // Need service + both dates
      setIsButtonDisabled(!(service && startDate && endDate));
    } else if (reportType === "DetailedApplications") {
      // Only service needed
      setIsButtonDisabled(!service);
    } else {
      // TehsilWise, GenderWise – only service needed (district removed)
      setIsButtonDisabled(!service);
    }
  }, [service, reportType, startDate, endDate]);   // district removed from deps

  const handleDistrictChange = (event) => {
    setDistrict(event.target.value);
  };

  const handleServiceChange = (event) => {
    setService(event.target.value);
  };

  const handleReportTypeChange = (event) => {
    setReportType(event.target.value);
    setStartDate("");
    setEndDate("");
    setSelectedStatus("");
    setShowTable(false);
  };

  const handleStartDateChange = (event) => {
    setStartDate(event.target.value);
  };

  const handleEndDateChange = (event) => {
    setEndDate(event.target.value);
  };

  const handleStatusChange = (event) => {
    setSelectedStatus(event.target.value);
  };

  const handleGetReports = () => {
    if (reportType === "AgeWise" || reportType === "PensionTypeWise") {
      if (!startDate || !endDate) {
        toast.error(
          "Please select both start and end dates for this report type.",
          { position: "top-right", autoClose: 3000 }
        );
        return;
      }
      if (new Date(startDate) > new Date(endDate)) {
        toast.error("Start date cannot be later than end date.", {
          position: "top-right",
          autoClose: 3000,
        });
        return;
      }
    }
    setShowTable(true);
    setTimeout(() => {
      tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  const getColumnsForReportType = () => {
    switch (reportType) {
      case "AgeWise":
        return [
          { accessorKey: "age", header: "Age" },
          { accessorKey: "countOfApplicants", header: "Beneficiary Count" }
        ];
      case "PensionTypeWise":
        return [
          { accessorKey: "age", header: "Age" },
          { accessorKey: "pensionType", header: "Pension Type" },
          { accessorKey: "countOfApplicants", header: "Beneficiary Count" }
        ];
      case "GenderWise":
        return [
          { accessorKey: "gender", header: "Gender" },
          { accessorKey: "countOfApplicants", header: "Beneficiary Count" }
        ];
      case "TehsilWise":
        return [
          { accessorKey: "tehsilName", header: "Tehsil Name" },
          { accessorKey: "totalApplicationsSubmitted", header: "Total Applications Received" },
          { accessorKey: "totalApplicationsPending", header: "Total Applications Pending" },
          { accessorKey: "totalApplicationsReturnToEdit", header: "Pending With Citizens" },
          { accessorKey: "totalApplicationsSanctioned", header: "Total Sanctioned" },
          { accessorKey: "totalApplicationsRejected", header: "Total Rejected" },
        ];
      case "DetailedApplications":
      default:
        return [
          { accessorKey: "districtname", header: "District" },
          { accessorKey: "tswofficename", header: "TSWO Office" },
          { accessorKey: "application_status", header: "Application Status" },
          { accessorKey: "application_pending_with", header: "Application Pending With" },
          { accessorKey: "referencenumber", header: "Reference Number" },
          { accessorKey: "applicant_name", header: "Applicant Name" },
          { accessorKey: "parentage", header: "Parentage" },
          { accessorKey: "account_number", header: "Account Number" },
          { accessorKey: "ifsc_code", header: "IFSC Code" },
          { accessorKey: "bank_name", header: "Bank Name" },
          { accessorKey: "branch_name", header: "Branch Name" },
        ];
    }
  };

  // 🎯 Only include AccessCode if a district is actually selected (which never happens now)
  const extraParams = {
    ServiceId: service,
    StatusType: selectedStatus || null,
    ReportType: reportType,
    ...((reportType !== "DetailedApplications" && district) && { AccessCode: district }),
    ...((reportType === "AgeWise" || reportType === "PensionTypeWise") && {
      StartDate: startDate,
      EndDate: endDate,
    }),
  };

  if (loading) {
    return (
      <Box sx={{ width: "100%", height: "100vh", display: "flex", justifyContent: "center", alignItems: "center", bgcolor: "#f8f9fa" }}>
        <CircularProgress size={60} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ width: "100%", height: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", bgcolor: "#f8f9fa" }}>
        <Typography color="error" variant="h6" sx={{ mb: 2 }}>
          {error}
        </Typography>
        <StyledButton variant="contained" onClick={() => window.location.reload()}>
          Retry
        </StyledButton>
      </Box>
    );
  }

  return (
    <Box sx={{ width: "100%", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", p: { xs: 3, md: 5 }, bgcolor: "#f8f9fa" }}>
      <Typography variant="h4" sx={{ mb: 5, fontWeight: 700, color: "#2d3748", fontFamily: "'Inter', sans-serif" }}>
        Reports
      </Typography>

      <Container>
        <Row className="mb-4 justify-content-center">
          {/* 🚫 District/Tehsil dropdown removed – commented out as requested */}
          {/* {reportType !== "DetailedApplications" && (
            <Col xs={12} md={4} lg={3}>
              <FormControl fullWidth sx={{ mb: { xs: 2, md: 0 } }}>
                <InputLabel id="district-select-label">
                  {isTehsil ? "Tehsil" : "District"}
                </InputLabel>
                <Select
                  labelId="district-select-label"
                  value={district}
                  label={isTehsil ? "Tehsil" : "District"}
                  onChange={handleDistrictChange}
                  sx={{ bgcolor: "#fff", borderRadius: "8px" }}
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
            </Col>
          )} */}

          <Col xs={12} md={4} lg={3}>
            <FormControl fullWidth sx={{ mb: { xs: 2, md: 0 } }}>
              <InputLabel id="service-select-label">Service</InputLabel>
              <Select
                labelId="service-select-label"
                value={service}
                label="Service"
                onChange={handleServiceChange}
                sx={{ bgcolor: "#fff", borderRadius: "8px" }}
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
          </Col>

          <Col xs={12} md={4} lg={3}>
            <FormControl fullWidth>
              <InputLabel id="report-type-label">Report Type</InputLabel>
              <Select
                labelId="report-type-label"
                value={reportType}
                label="Report Type"
                onChange={handleReportTypeChange}
                sx={{ bgcolor: "#fff", borderRadius: "8px" }}
              >
                <MenuItem value="AgeWise">Age Wise</MenuItem>
                <MenuItem value="PensionTypeWise">Pension Type Wise</MenuItem>
                <MenuItem value="GenderWise">Gender Wise</MenuItem>
                <MenuItem value="TehsilWise">Tehsil Wise</MenuItem>
                <MenuItem value="DetailedApplications">Detailed Applications</MenuItem>
              </Select>
            </FormControl>
          </Col>
        </Row>

        {(reportType === "AgeWise" || reportType === "PensionTypeWise") && (
          <Row className="mb-4 justify-content-center">
            <Col xs={12} md={4} lg={3}>
              <TextField
                fullWidth
                label="Submission Start Date"
                type="date"
                value={startDate}
                onChange={handleStartDateChange}
                InputLabelProps={{ shrink: true }}
                sx={{ bgcolor: "#fff", borderRadius: "8px" }}
              />
            </Col>
            <Col xs={12} md={4} lg={3}>
              <TextField
                fullWidth
                label="Submission End Date"
                type="date"
                value={endDate}
                onChange={handleEndDateChange}
                InputLabelProps={{ shrink: true }}
                sx={{ bgcolor: "#fff", borderRadius: "8px" }}
              />
            </Col>
          </Row>
        )}

        {reportType === "DetailedApplications" && (
          <Row className="mb-4 justify-content-center">
            <Col xs={12} md={4} lg={3}>
              <FormControl fullWidth>
                <InputLabel id="status-select-label">Application Status</InputLabel>
                <Select
                  labelId="status-select-label"
                  value={selectedStatus}
                  label="Application Status"
                  onChange={handleStatusChange}
                  sx={{ bgcolor: "#fff", borderRadius: "8px" }}
                >
                  {applicationStatusList.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Col>
          </Row>
        )}

        <Row className="mb-5 justify-content-center">
          <Col xs="auto">
            <StyledButton variant="contained" onClick={handleGetReports} disabled={isButtonDisabled}>
              Generate Reports
            </StyledButton>
          </Col>
        </Row>

        {showTable && (
          <Row ref={tableRef} className="mt-5">
            <Col xs={12}>
              <StyledCard>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 3, fontWeight: 600, color: "#2d3748" }}>
                    {reportType === "DetailedApplications" ? "Detailed Applications Report" : "Application Reports"}
                  </Typography>
                  <ServerSideTable
                    key={`${district}-${service}-${selectedStatus}-${reportType}-${startDate}-${endDate}`}
                    url={`/Officer/GetApplicationsForReports`}
                    Title={"Reports"}
                    extraParams={extraParams}
                    columns={getColumnsForReportType()}
                  />
                </CardContent>
              </StyledCard>
            </Col>
          </Row>
        )}
      </Container>
    </Box>
  );
}