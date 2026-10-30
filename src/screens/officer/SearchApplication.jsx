import GovPageHeader from "../../components/gov/GovPageHeader";
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  CircularProgress,
  Alert,
  Divider,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Tooltip,
} from "@mui/material";
import React, { useState, useEffect, useRef } from "react";
import { toast } from "react-toastify";
import ServiceSelectionForm from "../../components/ServiceSelectionForm";
import axiosInstance from "../../axiosConfig";
import { fetchServiceList } from "../../assets/fetch";
import ServerSideTable from "../../components/ServerSideTable";
import CollapsibleFormDetails from "../../components/officer/CollapsibleFormDetails";
import BasicModal from "../../components/BasicModal";
import SearchIcon from "@mui/icons-material/Search";
import ManageSearchIcon from "@mui/icons-material/ManageSearch";
import ClearIcon from "@mui/icons-material/Clear";
import HistoryIcon from "@mui/icons-material/History";
import DescriptionIcon from "@mui/icons-material/Description";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

const SEARCH_OPTIONS = [
  {
    value: "ReferenceNumber",
    label: "Reference Number",
    placeholder: "e.g. ABC/2024/00123",
  },
  {
    value: "AccountNumber",
    label: "Account Number",
    placeholder: "Enter account number",
  },
];

const statusStyle = (status) => {
  const s = (status || "").toLowerCase();
  if (s === "sanctioned") return { bg: "#D1FAE5", fg: "#065F46" };
  if (s === "rejected") return { bg: "#FEE2E2", fg: "#991B1B" };
  if (s === "pending") return { bg: "#FEF3C7", fg: "#92400E" };
  return { bg: "#E0E7FF", fg: "#3730A3" };
};

// ★ NEW — chip palette for the "Is Withheld" column. Values arrive from the
// backend as "YES" / "NO" / "N/A" (string), so we normalise defensively.
const withheldStyle = (value) => {
  const v = (value || "").trim().toUpperCase();
  if (v === "YES") return { bg: "#FEE2E2", fg: "#991B1B" }; // red-ish
  if (v === "NO") return { bg: "#D1FAE5", fg: "#065F46" }; // green-ish
  return { bg: "#F1F5F9", fg: "#64748B" }; // neutral for "N/A"
};

// Reusable header cell — keeps header styling consistent and readable
const HeaderCell = ({ children, align = "left", width }) => (
  <TableCell
    align={align}
    sx={{
      fontWeight: 700,
      color: "#334155",
      fontSize: "0.72rem",
      letterSpacing: "0.04em",
      textTransform: "uppercase",
      bgcolor: "#F1F5F9",
      borderBottom: "2px solid #E2E8F0",
      whiteSpace: "nowrap",
      py: 1.25,
      width,
    }}
  >
    {children}
  </TableCell>
);

// Body cell — consistent padding + typography for readability
const BodyCell = ({ children, align = "left", sx = {} }) => (
  <TableCell
    align={align}
    sx={{
      fontSize: "0.875rem",
      color: "#1E293B",
      borderBottom: "1px solid #F1F5F9",
      whiteSpace: "nowrap",
      py: 1.25,
      ...sx,
    }}
  >
    {children}
  </TableCell>
);

export default function SearchApplication() {
  const [services, setServices] = useState([]);
  const [serviceId, setServiceId] = useState("");
  const [officerRole, setOfficerRole] = useState("");
  const [officerArea, setOfficerArea] = useState("");

  const [searchBy, setSearchBy] = useState("ReferenceNumber");
  const [searchValue, setSearchValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [responseMessage, setResponseMessage] = useState("");

  const [searchResults, setSearchResults] = useState([]);
  const [searchedCriteria, setSearchedCriteria] = useState({
    serviceId: "",
    searchBy: "",
    searchValue: "",
  });

  const [selectedApplication, setSelectedApplication] = useState(null);
  const [formDetails, setFormDetails] = useState({});
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState("");
  const [isSignedPdf, setIsSignedPdf] = useState(false);

  const detailsSectionRef = useRef(null);

  useEffect(() => {
    const fetchServices = async () => {
      setLoading(true);
      setError(null);
      try {
        await fetchServiceList(setServices, setOfficerRole, setOfficerArea);
      } catch {
        setError("Failed to load services.");
        toast.error("Failed to load services. Please try again.", {
          position: "top-right",
          autoClose: 3000,
          theme: "colored",
        });
      } finally {
        setLoading(false);
      }
    };
    fetchServices();
  }, []);

  useEffect(() => {
    if (pdfModalOpen) window.scrollTo({ top: 0, behavior: "instant" });
  }, [pdfModalOpen]);

  const handleViewPdf = (url) => {
    setPdfUrl(url);
    setIsSignedPdf(false);
    setPdfModalOpen(true);
  };

  const handleModalClose = () => {
    setPdfModalOpen(false);
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setPdfUrl("");
    setIsSignedPdf(false);
  };

  const resetResults = () => {
    setSearchResults([]);
    setSelectedApplication(null);
    setFormDetails({});
    setResponseMessage("");
    setError(null);
  };

  const handleClear = () => {
    setServiceId("");
    setSearchBy("ReferenceNumber");
    setSearchValue("");
    resetResults();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !loading) handleSearch();
  };

  const handleSearch = async () => {
    if (!serviceId) {
      toast.error("Please select a service.", {
        position: "top-right",
        autoClose: 3000,
        theme: "colored",
      });
      return;
    }
    if (!searchValue.trim()) {
      toast.error("Please enter a value to search.", {
        position: "top-right",
        autoClose: 3000,
        theme: "colored",
      });
      return;
    }

    setLoading(true);
    setError(null);
    setResponseMessage("");
    setSelectedApplication(null);
    setFormDetails({});
    setSearchResults([]);

    try {
      const response = await axiosInstance.get("/Officer/SearchApplication", {
        params: {
          Serviceid: serviceId,
          SearchBy: searchBy,
          SearchValue: searchValue.trim(),
        },
      });

      if (response.data.status) {
        const apps = response.data.applications || [];
        setSearchResults(apps);
        setSearchedCriteria({
          serviceId,
          searchBy,
          searchValue: searchValue.trim(),
        });
        toast.success(
          `${apps.length} application${apps.length === 1 ? "" : "s"} found!`,
          { position: "top-right", autoClose: 2500, theme: "colored" },
        );
      } else {
        setResponseMessage(
          response.data.message ||
            "No application found matching your criteria.",
        );
      }
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        "An unexpected error occurred.";
      setError(msg);
      toast.error(msg, {
        position: "top-right",
        autoClose: 3000,
        theme: "colored",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleActionClick = async (row) => {
    if (
      selectedApplication?.referenceNumber === row.referenceNumber &&
      Object.keys(formDetails).length > 0
    ) {
      detailsSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      return;
    }

    setSelectedApplication(row);
    setFormDetails({});
    setDetailsLoading(true);
    setDetailsOpen(false);

    setTimeout(() => {
      detailsSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 50);

    try {
      const response = await axiosInstance.get(
        "/Officer/GetApplicationDetails",
        {
          params: {
            ReferenceNumber: row.referenceNumber,
            Serviceid: searchedCriteria.serviceId,
          },
        },
      );
      if (response.data.status) {
        setFormDetails(response.data.formDetailsToken);
      } else {
        toast.error(response.data.message || "Failed to load details.", {
          position: "top-right",
          autoClose: 3000,
          theme: "colored",
        });
        setSelectedApplication(null);
      }
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Failed to load application details.",
        { position: "top-right", autoClose: 3000, theme: "colored" },
      );
      setSelectedApplication(null);
    } finally {
      setDetailsLoading(false);
    }
  };

  const serviceName =
    services.find(
      (s) => String(s.serviceid) === String(searchedCriteria.serviceId),
    )?.servicename || "";

  const searchOption =
    SEARCH_OPTIONS.find((o) => o.value === searchBy) || SEARCH_OPTIONS[0];

  return (
    <Box sx={{ bgcolor: "#F8FAFC", minHeight: "100vh", py: 4 }}>
      <Box sx={{ maxWidth: 1400, mx: "auto", px: { xs: 2, md: 4 } }}>
        {/* ── Header ─────────────────────────────────────────────── */}
        <Box sx={{ mb: 3 }}>
          <GovPageHeader
            title="Search Applications"
            hindiTitle="आवेदन खोजें"
            crumbs={[
              { label: "Officer", path: "/officer/home" },
              { label: "Search Applications", path: "" },
            ]}
          />

          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mt: 1 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 1.5,
                bgcolor: "#EFF6FF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <ManageSearchIcon sx={{ fontSize: 22, color: "#2562E9" }} />
            </Box>
            <Typography variant="body2" sx={{ color: "#64748B" }}>
              {officerRole && officerArea
                ? `${officerRole} • ${officerArea}`
                : "Find and review citizen applications across your jurisdiction"}
            </Typography>
          </Box>
        </Box>

        {/* ── Search panel ───────────────────────────────────────── */}
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2.5, md: 3 },
            mb: 3,
            borderRadius: 3,
            border: "1px solid #E2E8F0",
            bgcolor: "white",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2.5 }}>
            <SearchIcon sx={{ color: "#2562E9", fontSize: 20 }} />
            <Typography
              variant="subtitle1"
              sx={{ fontWeight: 700, color: "#0F172A" }}
            >
              Search Criteria
            </Typography>
          </Box>

          <Stack spacing={2}>
            <ServiceSelectionForm
              services={services}
              errors={error ? { serviceId: error } : {}}
              onServiceSelect={setServiceId}
            />

            <Box
              sx={{
                display: "flex",
                gap: 2,
                flexDirection: { xs: "column", sm: "row" },
                alignItems: { xs: "stretch", sm: "flex-start" },
              }}
            >
              <FormControl
                variant="outlined"
                disabled={loading}
                sx={{
                  minWidth: { sm: 220 },
                  flex: { xs: "1 1 auto", sm: "0 0 220px" },
                }}
              >
                <InputLabel id="search-by-label">Search By</InputLabel>
                <Select
                  labelId="search-by-label"
                  label="Search By"
                  value={searchBy}
                  onChange={(e) => setSearchBy(e.target.value)}
                  sx={{
                    bgcolor: "white",
                    "& fieldset": { borderColor: "#E2E8F0" },
                    "&:hover fieldset": { borderColor: "#2562E9" },
                    "&.Mui-focused fieldset": { borderColor: "#2562E9" },
                  }}
                >
                  {SEARCH_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                label={searchOption.label}
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                onKeyDown={handleKeyDown}
                fullWidth
                variant="outlined"
                placeholder={searchOption.placeholder}
                disabled={loading}
                sx={{
                  flex: 1,
                  "& .MuiOutlinedInput-root": {
                    bgcolor: "white",
                    "& fieldset": { borderColor: "#E2E8F0" },
                    "&:hover fieldset": { borderColor: "#2562E9" },
                    "&.Mui-focused fieldset": { borderColor: "#2562E9" },
                  },
                }}
              />
            </Box>
          </Stack>

          <Divider sx={{ my: 2.5 }} />

          <Stack
            direction="row"
            spacing={1.5}
            justifyContent="flex-end"
            flexWrap="wrap"
            useFlexGap
          >
            <Button
              variant="outlined"
              onClick={handleClear}
              disabled={loading}
              startIcon={<ClearIcon />}
              sx={{
                textTransform: "none",
                fontWeight: 600,
                px: 2.5,
                py: 1,
                borderColor: "#E2E8F0",
                color: "#475569",
                "&:hover": { borderColor: "#94A3B8", bgcolor: "#F8FAFC" },
              }}
            >
              Clear
            </Button>

            <Button
              variant="contained"
              onClick={handleSearch}
              disabled={loading}
              startIcon={
                loading ? (
                  <CircularProgress size={18} color="inherit" />
                ) : (
                  <SearchIcon />
                )
              }
              sx={{
                bgcolor: "#2562E9",
                "&:hover": { bgcolor: "#1D4ED8" },
                textTransform: "none",
                fontWeight: 600,
                px: 3,
                py: 1,
                boxShadow: "0 4px 12px rgba(37, 99, 233, 0.2)",
              }}
            >
              {loading ? "Searching..." : "Search Application"}
            </Button>
          </Stack>
        </Paper>

        {/* ── Alerts ─────────────────────────────────────────────── */}
        {responseMessage && (
          <Alert
            severity="warning"
            sx={{
              mb: 3,
              borderRadius: 2,
              border: "1px solid #FDE68A",
              "& .MuiAlert-icon": { color: "#D97706" },
            }}
          >
            <Typography fontWeight={600}>{responseMessage}</Typography>
          </Alert>
        )}

        {error && (
          <Alert
            severity="error"
            onClose={() => setError(null)}
            sx={{ mb: 3, borderRadius: 2, border: "1px solid #FECACA" }}
          >
            <Typography fontWeight={600}>{error}</Typography>
          </Alert>
        )}

        {/* ── Results table ─────────────────────────────────────── */}
        {searchResults.length > 0 && (
          <Paper
            elevation={0}
            sx={{
              mb: 3,
              borderRadius: 3,
              border: "1px solid #E2E8F0",
              bgcolor: "white",
              overflow: "hidden",
            }}
          >
            <Box
              sx={{
                px: 3,
                py: 1.75,
                borderBottom: "1px solid #E2E8F0",
                bgcolor: "#F8FAFC",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 1,
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <DescriptionIcon sx={{ color: "#2562E9", fontSize: 20 }} />
                <Typography
                  variant="subtitle1"
                  sx={{ fontWeight: 700, color: "#0F172A" }}
                >
                  Matching Applications ({searchResults.length})
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ color: "#64748B" }}>
                {serviceName && <>Service: {serviceName}</>}
                {searchedCriteria.searchValue && (
                  <>
                    {" "}
                    •{" "}
                    {searchedCriteria.searchBy === "ReferenceNumber"
                      ? "Ref"
                      : "Acct"}
                    : {searchedCriteria.searchValue}
                  </>
                )}
              </Typography>
            </Box>

            {/* Horizontal scroll keeps 11 columns readable on any width */}
            <TableContainer sx={{ maxHeight: 520 }}>
              <Table size="small" stickyHeader sx={{ minWidth: 1400 }}>
                <TableHead>
                  <TableRow>
                    <HeaderCell width={60}>S.No</HeaderCell>
                    <HeaderCell width={200}>Reference Number</HeaderCell>
                    <HeaderCell width={180}>Applicant Name</HeaderCell>
                    <HeaderCell width={160}>Account Number</HeaderCell>
                    <HeaderCell width={140}>IFSC Code</HeaderCell>
                    <HeaderCell width={130}>Date of Birth</HeaderCell>
                    <HeaderCell width={130}>District</HeaderCell>
                    <HeaderCell width={130}>Tehsil</HeaderCell>
                    <HeaderCell width={110}>Status</HeaderCell>
                    <HeaderCell width={110} align="center">
                      Is Withheld
                    </HeaderCell>
                    <HeaderCell width={130} align="center">
                      Action
                    </HeaderCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {searchResults.map((row, idx) => {
                    const s = statusStyle(row.status);
                    const w = withheldStyle(row.isWithheld);
                    const isActive =
                      selectedApplication?.referenceNumber ===
                      row.referenceNumber;

                    return (
                      <TableRow
                        key={row.referenceNumber}
                        hover
                        sx={{
                          bgcolor: isActive ? "#EFF6FF" : "inherit",
                          cursor: "pointer",
                          "&:hover": {
                            bgcolor: isActive ? "#DBEAFE" : "#F8FAFC",
                          },
                        }}
                        onClick={() => handleActionClick(row)}
                      >
                        <BodyCell sx={{ color: "#64748B", fontWeight: 600 }}>
                          {idx + 1}
                        </BodyCell>

                        <BodyCell sx={{ fontWeight: 600, color: "#0F172A" }}>
                          {row.referenceNumber}
                        </BodyCell>

                        <BodyCell>{row.applicantName || "—"}</BodyCell>

                        <BodyCell
                          sx={{
                            fontFamily:
                              '"Roboto Mono", "SF Mono", Consolas, monospace',
                            fontSize: "0.8125rem",
                            color: "#0F172A",
                          }}
                        >
                          {row.accountNumber || "—"}
                        </BodyCell>

                        <BodyCell
                          sx={{
                            fontFamily:
                              '"Roboto Mono", "SF Mono", Consolas, monospace',
                            fontSize: "0.8125rem",
                            color: "#0F172A",
                          }}
                        >
                          {row.ifcCode || "—"}
                        </BodyCell>

                        <BodyCell
                          sx={{
                            fontFamily:
                              '"Roboto Mono", "SF Mono", Consolas, monospace',
                            fontSize: "0.8125rem",
                            color: "#0F172A",
                          }}
                        >
                          {row.datofBirth || "—"}
                        </BodyCell>

                        <BodyCell sx={{ color: "#475569" }}>
                          {row.districtName || "—"}
                        </BodyCell>

                        <BodyCell sx={{ color: "#475569" }}>
                          {row.tehsilName || "—"}
                        </BodyCell>

                        <BodyCell>
                          <Chip
                            size="small"
                            label={row.status || "—"}
                            sx={{
                              bgcolor: s.bg,
                              color: s.fg,
                              fontWeight: 700,
                              fontSize: 11.5,
                              height: 24,
                            }}
                          />
                        </BodyCell>

                        {/* ★ NEW — Is Withheld */}
                        <BodyCell align="center">
                          <Chip
                            size="small"
                            label={row.isWithheld || "N/A"}
                            sx={{
                              bgcolor: w.bg,
                              color: w.fg,
                              fontWeight: 700,
                              fontSize: 11.5,
                              height: 24,
                              minWidth: 56,
                            }}
                          />
                        </BodyCell>

                        <BodyCell align="center">
                          <Tooltip title="View citizen details and action history">
                            <Button
                              size="small"
                              variant="contained"
                              disableElevation
                              startIcon={<PlayArrowIcon fontSize="small" />}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleActionClick(row);
                              }}
                              sx={{
                                textTransform: "none",
                                fontWeight: 700,
                                fontSize: 12,
                                bgcolor: isActive ? "#1D4ED8" : "#2562E9",
                                "&:hover": { bgcolor: "#1D4ED8" },
                                minWidth: 100,
                                boxShadow: "0 2px 6px rgba(37, 99, 233, 0.25)",
                              }}
                            >
                              Action
                            </Button>
                          </Tooltip>
                        </BodyCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        )}

        {/* ── Details section ───────────────────────────────────── */}
        {selectedApplication && (
          <Box
            ref={detailsSectionRef}
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: 2.5,
              scrollMarginTop: "16px",
            }}
          >
            <Paper
              elevation={0}
              sx={{
                p: 2,
                borderRadius: 3,
                border: "1px solid #E2E8F0",
                borderLeft: "4px solid #10B981",
                bgcolor: "white",
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                flexWrap: "wrap",
              }}
            >
              <CheckCircleIcon sx={{ color: "#10B981" }} />
              <Typography
                variant="body2"
                sx={{
                  color: "#10B981",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  fontSize: "0.75rem",
                }}
              >
                Selected Application
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: "#475569", fontWeight: 600 }}
              >
                Ref: {selectedApplication.referenceNumber}
                {selectedApplication.applicantName && (
                  <> • Applicant: {selectedApplication.applicantName}</>
                )}
              </Typography>

              {/* ★ NEW — withheld status chip on the selection banner */}
              {selectedApplication.isWithheld &&
                selectedApplication.isWithheld !== "N/A" && (
                  <Chip
                    size="small"
                    label={
                      selectedApplication.isWithheld === "YES"
                        ? "Currently Withheld"
                        : "Not Withheld"
                    }
                    sx={{
                      bgcolor:
                        selectedApplication.isWithheld === "YES"
                          ? "#FEE2E2"
                          : "#D1FAE5",
                      color:
                        selectedApplication.isWithheld === "YES"
                          ? "#991B1B"
                          : "#065F46",
                      fontWeight: 700,
                      fontSize: 11,
                      height: 22,
                    }}
                  />
                )}
            </Paper>

            <Paper
              elevation={0}
              sx={{
                borderRadius: 3,
                border: "1px solid #E2E8F0",
                bgcolor: "white",
                overflow: "hidden",
              }}
            >
              <Box
                sx={{
                  px: 3,
                  py: 1.75,
                  borderBottom: "1px solid #E2E8F0",
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  bgcolor: "#F8FAFC",
                }}
              >
                <DescriptionIcon sx={{ color: "#2562E9", fontSize: 20 }} />
                <Typography
                  variant="subtitle1"
                  sx={{ fontWeight: 700, color: "#0F172A" }}
                >
                  Citizen Details
                </Typography>
                {detailsLoading && (
                  <CircularProgress
                    size={16}
                    sx={{ ml: 1, color: "#2562E9" }}
                  />
                )}
              </Box>

              <Box sx={{ p: { xs: 2, md: 2.5 } }}>
                {detailsLoading ? (
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      py: 6,
                      gap: 1.5,
                    }}
                  >
                    <CircularProgress size={26} sx={{ color: "#2562E9" }} />
                    <Typography sx={{ color: "#64748B" }}>
                      Loading application details…
                    </Typography>
                  </Box>
                ) : Object.keys(formDetails).length > 0 ? (
                  <CollapsibleFormDetails
                    applicationId={selectedApplication.referenceNumber}
                    detailsOpen={detailsOpen}
                    formDetails={formDetails}
                    setDetailsOpen={setDetailsOpen}
                    onViewPdf={handleViewPdf}
                  />
                ) : (
                  <Typography
                    sx={{ color: "#94A3B8", textAlign: "center", py: 4 }}
                  >
                    No details available.
                  </Typography>
                )}
              </Box>
            </Paper>

            {!detailsLoading && Object.keys(formDetails).length > 0 && (
              <Paper
                elevation={0}
                sx={{
                  borderRadius: 3,
                  border: "1px solid #E2E8F0",
                  bgcolor: "white",
                  overflow: "hidden",
                }}
              >
                <Box
                  sx={{
                    px: 3,
                    py: 1.75,
                    borderBottom: "1px solid #E2E8F0",
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    bgcolor: "#F8FAFC",
                  }}
                >
                  <HistoryIcon sx={{ color: "#2562E9", fontSize: 20 }} />
                  <Typography
                    variant="subtitle1"
                    sx={{ fontWeight: 700, color: "#0F172A" }}
                  >
                    Action History
                  </Typography>
                </Box>

                <Box sx={{ p: { xs: 1, md: 2 } }}>
                  <ServerSideTable
                    key={selectedApplication.referenceNumber}
                    url={"/Officer/GetApplicationHistory"}
                    extraParams={{
                      ApplicationId: selectedApplication.referenceNumber,
                    }}
                    actionFunctions={{}}
                    Title={""}
                    showDownloadButtons={true}
                  />
                </Box>
              </Paper>
            )}
          </Box>
        )}

        {/* ── PDF modal ─────────────────────────────────────────── */}
        <BasicModal
          open={pdfModalOpen}
          handleClose={handleModalClose}
          handleActionButton={null}
          buttonText={null}
          Title={isSignedPdf ? "Signed Document" : "Document Preview"}
          pdf={pdfUrl}
          sx={{
            "& .MuiDialog-paper": {
              width: { xs: "90%", md: "80%" },
              maxWidth: "800px",
              height: "80vh",
              borderRadius: "12px",
            },
          }}
        />
      </Box>
    </Box>
  );
}
