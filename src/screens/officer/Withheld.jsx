import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  CircularProgress,
  TextField,
  Typography,
  FormHelperText,
  MenuItem,
  Alert,
  FormControl,
  InputLabel,
  Select,
  Paper,
  List,
  ListItem,
  ListItemText,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Grid,
  Divider,
  Card,
  CardContent,
  Stack,
  Avatar,
  Breadcrumbs,
  Link,
  Stepper,
  Step,
  StepLabel,
  Badge,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import DeleteIcon from "@mui/icons-material/Delete";
import VisibilityIcon from "@mui/icons-material/Visibility";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import SaveIcon from "@mui/icons-material/Save";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import HistoryIcon from "@mui/icons-material/History";
import DescriptionIcon from "@mui/icons-material/Description";
import HomeIcon from "@mui/icons-material/Home";
import GavelIcon from "@mui/icons-material/Gavel";
import LockIcon from "@mui/icons-material/Lock";
import LockOpenIcon from "@mui/icons-material/LockOpen";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import WarningIcon from "@mui/icons-material/Warning";
import ServiceSelectionForm from "../../components/ServiceSelectionForm";
import { fetchServiceList } from "../../assets/fetch";
import axiosInstance from "../../axiosConfig";
import BasicModal from "../../components/BasicModal";
import { useLocation } from "react-router-dom";

// Styled components for better design
const StyledCard = styled(Card)(({ theme }) => ({
  borderRadius: 16,
  boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
  border: `1px solid ${theme.palette.divider}`,
  transition: "transform 0.2s, box-shadow 0.2s",
  "&:hover": {
    boxShadow: "0 12px 48px rgba(0,0,0,0.12)",
  },
}));

const StyledDropzone = styled(Paper)(({ theme, error }) => ({
  padding: theme.spacing(6),
  textAlign: "center",
  borderStyle: "dashed",
  borderWidth: 2,
  borderColor: error ? theme.palette.error.main : theme.palette.grey[300],
  backgroundColor: error ? theme.palette.error.light : theme.palette.grey[50],
  borderRadius: 12,
  transition: "all 0.3s ease",
  cursor: "pointer",
  "&:hover": {
    borderColor: theme.palette.primary.main,
    backgroundColor: theme.palette.action.hover,
    transform: "translateY(-2px)",
    boxShadow: theme.shadows[4],
  },
}));

export default function Withheld() {
  const location = useLocation();
  const { applicationId } = location.state || {};
  const [services, setServices] = useState([]);
  const [serviceId, setServiceId] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [formData, setFormData] = useState({
    withheldType: "",
    withheldReason: "",
    files: [],
    isWithheld: "yes",
  });
  const [initialFormData, setInitialFormData] = useState(null);
  const [applicationDetails, setApplicationDetails] = useState(null);
  const [recordExists, setRecordExists] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);
  const [canCreate, setCanCreate] = useState(false);
  const [tableData, setTableData] = useState([]);
  const [tableColumns, setTableColumns] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPdfUrl, setSelectedPdfUrl] = useState("");
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [action, setAction] = useState("");
  const [actionOptions, setActionOptions] = useState([]);
  const [application, setApplication] = useState({});
  const [existingFilesToKeep, setExistingFilesToKeep] = useState([]);
  const [canChooseWithheldType, setCanChooseWithheldType] = useState(false);
  const [canChooseIsWithheld, setCanChooseIsWithheld] = useState(false);
  const [isFirstOfficer, setIsFirstOfficer] = useState(false);
  const [hasPendingReleaseRequest, setHasPendingReleaseRequest] = useState(false);
  const [pendingReleaseFromPlayer, setPendingReleaseFromPlayer] = useState("");
  const [fileError, setFileError] = useState("");

  useEffect(() => {
    fetchServiceList(setServices);
  }, []);

  useEffect(() => {
    if (applicationId) {
      setReferenceNumber(applicationId);
    }
  }, [applicationId]);

  useEffect(() => {
    if (referenceNumber && services.length > 0 && !serviceId && !hasChecked) {
      setServiceId(services[0]?.ServiceId?.toString() || "");
    }
  }, [services, referenceNumber, serviceId, hasChecked]);

  useEffect(() => {
    if (
      referenceNumber &&
      serviceId &&
      services.length > 0 &&
      !hasChecked &&
      !loading
    ) {
      handleCheck();
    }
  }, [referenceNumber, serviceId, services, hasChecked, loading]);

  const handleServiceId = (serviceId) => {
    setServiceId(serviceId);
  };

  const scrollToError = () => {
    setTimeout(() => {
      const errorElement = document.querySelector('.MuiAlert-root, [data-error="true"]');
      if (errorElement) {
        errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  const handleCheck = async () => {
    if (!referenceNumber.trim()) {
      setError("Please enter a valid Reference Number.");
      return;
    }
    if (!serviceId || isNaN(parseInt(serviceId))) {
      setError("Please select a valid Service.");
      return;
    }

    setError("");
    setSuccessMessage("");
    setLoading(true);
    setHasChecked(false);
    setCanCreate(false);
    setApplicationDetails(null);
    setTableData([]);
    setTableColumns([]);
    setModalOpen(false);
    setSelectedPdfUrl("");
    setInitialFormData(null);
    setAction("");
    setActionOptions([]);
    setExistingFilesToKeep([]);
    setHasPendingReleaseRequest(false);
    setPendingReleaseFromPlayer("");
    setCanChooseWithheldType(false);
    setCanChooseIsWithheld(false);
    setIsFirstOfficer(false);
    setFileError("");

    try {
      const res = await axiosInstance.get("/Officer/GetWithheldApplication", {
        params: { referenceNumber, serviceId: parseInt(serviceId) },
      });

      if (!res.data.status) {
        setError(res.data.response || "Failed to fetch details.");
        setRecordExists(false);
        setCanCreate(false);
        setHasChecked(false);
        return;
      }

      setRecordExists(!!res.data.recordExists);
      setCanCreate(res.data.canCreate);
      setHasChecked(true);
      setTableData(res.data.data || []);
      setTableColumns(res.data.columns || []);
      setActionOptions(res.data.options || []);
      setApplication(res.data.application);

      setCanChooseWithheldType(res.data.canChooseWithheldType || false);
      setCanChooseIsWithheld(res.data.canChooseIsWithheld || false);
      setIsFirstOfficer(res.data.application?.isFirstOfficer || false);

      setHasPendingReleaseRequest(res.data.hasPendingReleaseRequest || false);
      setPendingReleaseFromPlayer(res.data.pendingReleaseFromPlayer || "");

      let withheldFiles = res.data.application?.files || [];
      if (typeof withheldFiles === "string") {
        try {
          withheldFiles = JSON.parse(withheldFiles);
        } catch (e) {
          withheldFiles = [];
        }
      }
      if (!Array.isArray(withheldFiles)) {
        withheldFiles = [];
      }

      const defaultIsWithheld = res.data.application?.isWithheld ? "yes" : "no";

      const newFormData = {
        withheldType: res.data.application?.withheldType || "Temporary",
        withheldReason: res.data.application?.withheldReason || "",
        files: [],
        isWithheld: defaultIsWithheld,
      };

      setFormData(newFormData);
      setExistingFilesToKeep(withheldFiles);

      if (res.data.application) {
        setInitialFormData({
          ...newFormData,
          files: withheldFiles,
        });
      }

      let appDetails = res.data.applicationDetails || {};
      setApplicationDetails({
        applicantName: appDetails.applicantName || "N/A",
        parentage: appDetails.parentage || "N/A",
        ro: appDetails["r/o"] || "N/A",
        files: withheldFiles,
        withheldType: res.data.application?.withheldType || "N/A",
        withheldReason: res.data.application?.withheldReason || "N/A",
        isWithheld: res.data.application?.isWithheld ? "Yes" : "No",
      });

      if (res.data.application && !res.data.canCreate) {
        if (res.data.hasPendingReleaseRequest) {
          setError(`There's a pending release request from ${res.data.pendingReleaseFromPlayer}. You are not the current player to handle it.`);
        } else {
          setError("You are not authorized to update this withheld application.");
        }
      }

    } catch (err) {
      setError("Failed to fetch details. Please try again.");
      setCanCreate(false);
      setHasChecked(false);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files).filter(
      (file) => file.type === "application/pdf"
    );
    setFormData((prev) => ({
      ...prev,
      files: [...prev.files, ...selectedFiles],
    }));
    setFileError(""); // Clear any file error when adding files
  };

  const handleRemoveFile = (fileToRemove) => {
    if (typeof fileToRemove === "string") {
      setExistingFilesToKeep((prev) =>
        prev.filter((file) => file !== fileToRemove)
      );
    } else {
      setFormData((prev) => ({
        ...prev,
        files: prev.files.filter((file) => file.name !== fileToRemove.name),
      }));
    }
  };

  const handleFileClick = (fileName) => {
    setSelectedPdfUrl(`${fileName}`);
    setModalOpen(true);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setSelectedPdfUrl("");
  };

  const handleSave = async () => {
    setError("");
    setFileError("");

    // Validation
    if (!formData.withheldType) {
      setError("Please select a Withheld Type.");
      scrollToError();
      return;
    }
    if (!formData.withheldReason.trim()) {
      setError("Please provide a Withheld Reason.");
      scrollToError();
      return;
    }
    if (!formData.isWithheld) {
      setError("Please select Withheld Status.");
      scrollToError();
      return;
    }
    if (!action) {
      setError("Please select an action.");
      scrollToError();
      return;
    }

    // File validation - at least one document required
    const totalFiles = existingFilesToKeep.length + formData.files.length;
    if (totalFiles === 0) {
      setFileError("At least one supporting document is required.");
      scrollToError();
      return;
    }

    // First officer validation
    if (recordExists && !canChooseWithheldType && formData.withheldType !== application?.withheldType) {
      setError("Only the first officer can modify Withheld Type.");
      scrollToError();
      return;
    }

    if (recordExists && !canChooseIsWithheld && formData.isWithheld !== (application?.isWithheld ? "yes" : "no")) {
      setError("Only the first officer can modify Withheld Status.");
      scrollToError();
      return;
    }

    // Permanent withheld validation
    if (recordExists && initialFormData?.withheldType === "Permanent") {
      if (formData.withheldType !== "Permanent" || formData.isWithheld === "no") {
        setError("Permanent withheld applications cannot be modified or released.");
        scrollToError();
        return;
      }
    }

    // Check for changes if updating
    if (recordExists && initialFormData) {
      const hasFieldChanges =
        formData.withheldType !== initialFormData.withheldType ||
        formData.withheldReason.trim() !== initialFormData.withheldReason ||
        formData.isWithheld !== initialFormData.isWithheld;

      const allCurrentFiles = [
        ...existingFilesToKeep,
        ...formData.files.map((file) => file.name),
      ].sort();

      const allInitialFiles = [
        ...(initialFormData.files || []).map((file) =>
          typeof file === "string" ? file : file.name
        )
      ].sort();

      const hasFileChanges = allCurrentFiles.join() !== allInitialFiles.join();

      if (!hasFieldChanges && !hasFileChanges) {
        setError("No changes detected. Please modify the application details or files to update.");
        scrollToError();
        return;
      }
    }

    setConfirmDialogOpen(true);
  };

  const confirmSave = async () => {
    try {
      const form = new FormData();
      form.append("ServiceId", serviceId);
      form.append("ReferenceNumber", referenceNumber);
      form.append("IsWithheld", formData.isWithheld === "yes" ? "true" : "false");
      form.append("WithheldType", formData.withheldType);
      form.append("WithheldReason", formData.withheldReason);
      form.append("Action", action);

      if (existingFilesToKeep.length > 0) {
        form.append("ExistingFiles", existingFilesToKeep.join(","));
      }

      formData.files.forEach((file) => {
        if (file instanceof File) {
          form.append("Files", file);
        }
      });

      let res;
      if (recordExists) {
        res = await axiosInstance.post(
          "/Officer/UpdateWithheldApplication",
          form,
        );
      } else {
        res = await axiosInstance.post(
          "/Officer/CreateWithheldApplication",
          form,
        );
      }

      setSuccessMessage(res.data.message || "Operation completed successfully.");

      // Reset form
      setFormData({
        withheldType: "",
        withheldReason: "",
        files: [],
        isWithheld: "yes",
      });
      setInitialFormData(null);
      setServiceId("");
      setReferenceNumber("");
      setRecordExists(false);
      setHasChecked(false);
      setCanCreate(false);
      setApplicationDetails(null);
      setError("");
      setTableData([]);
      setTableColumns([]);
      setModalOpen(false);
      setSelectedPdfUrl("");
      setAction("");
      setActionOptions([]);
      setExistingFilesToKeep([]);
      setHasPendingReleaseRequest(false);
      setPendingReleaseFromPlayer("");
      setCanChooseWithheldType(false);
      setCanChooseIsWithheld(false);
      setIsFirstOfficer(false);
      setFileError("");

      setTimeout(() => setSuccessMessage(""), 5000);
    } catch (err) {
      setError(
        err.response?.data?.message ||
        err.response?.data?.response ||
        "Failed to save application. Please try again."
      );
      setTimeout(() => setError(""), 5000);
    } finally {
      setConfirmDialogOpen(false);
    }
  };

  const handleClearForm = () => {
    setFormData({
      withheldType: "",
      withheldReason: "",
      files: [],
      isWithheld: "yes",
    });
    setServiceId("");
    setReferenceNumber("");
    setError("");
    setSuccessMessage("");
    setHasChecked(false);
    setCanCreate(false);
    setRecordExists(false);
    setApplicationDetails(null);
    setTableData([]);
    setTableColumns([]);
    setInitialFormData(null);
    setAction("");
    setActionOptions([]);
    setExistingFilesToKeep([]);
    setHasPendingReleaseRequest(false);
    setPendingReleaseFromPlayer("");
    setCanChooseWithheldType(false);
    setCanChooseIsWithheld(false);
    setIsFirstOfficer(false);
    setFileError("");
  };

  const formatKey = (key) => {
    if (key === "r/o") return "Residence";
    return key
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  };

  const getWithheldStatusColor = (status) => {
    return status === "yes" || status === "Yes" ? "error" : "success";
  };

  const getWithheldTypeColor = (type) => {
    return type === "Permanent" ? "error" : "warning";
  };

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1400, mx: "auto" }}>
      {/* Header with Breadcrumbs */}
      <Box sx={{ mb: 4 }}>
        <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 2 }}>
          <Link
            underline="hover"
            color="inherit"
            href="/dashboard"
            sx={{ display: 'flex', alignItems: 'center' }}
          >
            <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
            Dashboard
          </Link>
          <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center' }}>
            <GavelIcon sx={{ mr: 1 }} />
            Withheld Management
          </Typography>
        </Breadcrumbs>

        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Avatar
            sx={{
              bgcolor: 'primary.main',
              mr: 2,
              width: 64,
              height: 64,
            }}
          >
            <GavelIcon sx={{ fontSize: 32 }} />
          </Avatar>
          <Box>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 800,
                background: 'linear-gradient(45deg, #1976d2 30%, #21CBF3 90%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                mb: 0.5,
              }}
            >
              Withheld Application Management
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Manage application withholding status and workflow
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Search Section */}
      <StyledCard sx={{ mb: 4 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h6" sx={{
            mb: 3,
            fontWeight: 700,
            color: 'primary.main',
            display: 'flex',
            alignItems: 'center',
            gap: 1
          }}>
            <SearchIcon />
            Search Application
          </Typography>

          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <ServiceSelectionForm
                  services={services}
                  value={serviceId}
                  onServiceSelect={handleServiceId}
                />
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Reference Number"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="Enter application reference number"
                variant="outlined"
                InputProps={{
                  sx: { borderRadius: 2 }
                }}
              />
            </Grid>
          </Grid>

          <Stack direction="row" spacing={2} sx={{ mt: 4 }}>
            <Button
              variant="contained"
              size="large"
              startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SearchIcon />}
              onClick={handleCheck}
              disabled={loading || !services.length}
              sx={{
                px: 4,
                py: 1.5,
                borderRadius: 2,
                fontWeight: 600,
              }}
            >
              {loading ? "Searching..." : "Search Application"}
            </Button>
            <Button
              variant="outlined"
              size="large"
              startIcon={<ClearIcon />}
              onClick={handleClearForm}
              sx={{
                borderRadius: 2,
                px: 4,
                py: 1.5
              }}
            >
              Clear
            </Button>
          </Stack>
        </CardContent>
      </StyledCard>

      {/* Messages */}
      {successMessage && (
        <Alert
          severity="success"
          sx={{
            mb: 3,
            borderRadius: 2,
            boxShadow: 1,
          }}
          icon={<CheckCircleIcon fontSize="inherit" />}
        >
          <Typography fontWeight={600}>{successMessage}</Typography>
        </Alert>
      )}

      {error && (
        <Alert
          severity="error"
          sx={{
            mb: 3,
            borderRadius: 2,
            boxShadow: 1,
          }}
          icon={<WarningIcon />}
        >
          <Typography fontWeight={600}>{error}</Typography>
        </Alert>
      )}

      {hasChecked && (
        <>
          {/* Application Details */}
          {applicationDetails && (
            <StyledCard sx={{ mb: 4 }}>
              <CardContent sx={{ p: 4 }}>
                <Box sx={{
                  display: 'flex',
                  alignItems: 'center',
                  mb: 3,
                  pb: 2,
                  borderBottom: '2px solid',
                  borderColor: 'divider'
                }}>
                  <DescriptionIcon sx={{ mr: 2, color: 'primary.main', fontSize: 28 }} />
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    Application Details
                  </Typography>
                </Box>

                <Grid container spacing={3}>
                  {Object.entries(applicationDetails).map(
                    ([key, value]) =>
                      key !== "files" && (
                        <Grid item xs={12} md={6} key={key}>
                          <Paper
                            variant="outlined"
                            sx={{
                              p: 2.5,
                              borderRadius: 2,
                              height: '100%',
                              bgcolor: 'grey.50',
                            }}
                          >
                            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                              {formatKey(key)}
                            </Typography>
                            <Typography variant="body1" fontWeight={600}>
                              {value || "N/A"}
                            </Typography>
                          </Paper>
                        </Grid>
                      )
                  )}
                </Grid>

                {/* Withheld Status Summary */}
                {recordExists && application && (
                  <>
                    <Divider sx={{ my: 4 }} />
                    <Typography variant="h6" sx={{ mb: 3, fontWeight: 700 }}>
                      Withheld Status Summary
                    </Typography>
                    <Grid container spacing={3}>
                      <Grid item xs={12} md={6}>
                        <Paper
                          variant="outlined"
                          sx={{
                            p: 3,
                            borderRadius: 2,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 2,
                            bgcolor: 'background.paper',
                          }}
                        >
                          <Avatar
                            sx={{
                              bgcolor: getWithheldTypeColor(application.withheldType) + '.light',
                              color: getWithheldTypeColor(application.withheldType) + '.dark',
                              width: 48,
                              height: 48,
                            }}
                          >
                            {application.withheldType === "Permanent" ? <LockIcon /> : <HistoryIcon />}
                          </Avatar>
                          <Box>
                            <Typography variant="caption" color="text.secondary">
                              Withheld Type
                            </Typography>
                            <Typography variant="h6" fontWeight={700}>
                              {application.withheldType === "Permanent" ? "Permanent (Weedout)" : "Temporary"}
                            </Typography>
                          </Box>
                        </Paper>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Paper
                          variant="outlined"
                          sx={{
                            p: 3,
                            borderRadius: 2,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 2,
                            bgcolor: 'background.paper',
                          }}
                        >
                          <Avatar
                            sx={{
                              bgcolor: getWithheldStatusColor(application.isWithheld ? "yes" : "no") + '.light',
                              color: getWithheldStatusColor(application.isWithheld ? "yes" : "no") + '.dark',
                              width: 48,
                              height: 48,
                            }}
                          >
                            {application.isWithheld ? <LockIcon /> : <LockOpenIcon />}
                          </Avatar>
                          <Box>
                            <Typography variant="caption" color="text.secondary">
                              Current Status
                            </Typography>
                            <Typography variant="h6" fontWeight={700}>
                              {application.isWithheld ? "Withheld" : "Not Withheld"}
                            </Typography>
                          </Box>
                        </Paper>
                      </Grid>
                    </Grid>
                  </>
                )}

                {/* Attached Documents */}
                {existingFilesToKeep.length > 0 && (
                  <>
                    <Divider sx={{ my: 4 }} />
                    <Typography variant="h6" sx={{ mb: 3, fontWeight: 700 }}>
                      Attached Documents
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      {existingFilesToKeep.map((file, index) => (
                        <Badge
                          key={index}
                          color="primary"
                          variant="dot"
                          invisible={!file}
                        >
                          <Chip
                            label={file}
                            onClick={() => handleFileClick(file)}
                            onDelete={() => handleRemoveFile(file)}
                            deleteIcon={<DeleteIcon />}
                            icon={<VisibilityIcon />}
                            variant="outlined"
                            sx={{
                              mb: 1,
                              borderRadius: 1,
                              '&:hover': {
                                bgcolor: 'action.hover',
                              }
                            }}
                          />
                        </Badge>
                      ))}
                    </Stack>
                  </>
                )}
              </CardContent>
            </StyledCard>
          )}

          {/* Action History */}
          {tableData.length > 0 && (
            <StyledCard sx={{ mb: 4 }}>
              <CardContent sx={{ p: 4 }}>
                <Box sx={{
                  display: 'flex',
                  alignItems: 'center',
                  mb: 3,
                  pb: 2,
                  borderBottom: '2px solid',
                  borderColor: 'divider'
                }}>
                  <HistoryIcon sx={{ mr: 2, color: 'primary.main', fontSize: 28 }} />
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    Action History
                  </Typography>
                </Box>
                <TableContainer sx={{
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: 'background.paper',
                }}>
                  <Table>
                    <TableHead>
                      <TableRow sx={{ bgcolor: 'grey.50' }}>
                        {tableColumns.map((column, index) => (
                          <TableCell
                            key={index}
                            sx={{
                              fontWeight: 700,
                              color: 'text.primary',
                              py: 2,
                              borderBottom: '2px solid',
                              borderColor: 'divider'
                            }}
                          >
                            {column.header}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {tableData.map((row, index) => (
                        <TableRow
                          key={index}
                          hover
                          sx={{
                            '&:nth-of-type(even)': { bgcolor: 'action.hover' },
                            '&:hover': { bgcolor: 'action.selected' }
                          }}
                        >
                          {tableColumns.map((column, colIndex) => (
                            <TableCell key={colIndex} sx={{ py: 2 }}>
                              {row[column.accessorKey] || "N/A"}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </StyledCard>
          )}

          {/* Withheld Form */}
          {canCreate && (
            <StyledCard>
              <CardContent sx={{ p: 4 }}>
                <Box sx={{
                  display: 'flex',
                  alignItems: 'center',
                  mb: 4,
                  pb: 3,
                  borderBottom: '2px solid',
                  borderColor: 'divider'
                }}>
                  <GavelIcon sx={{ mr: 2, color: 'primary.main', fontSize: 32 }} />
                  <Box>
                    <Typography variant="h5" sx={{ fontWeight: 800, mb: 0.5 }}>
                      {recordExists ? "Update Withheld Application" : "Create Withheld Application"}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {isFirstOfficer
                        ? "You are the first officer – You can modify all fields"
                        : "You can only add remarks and take action"}
                    </Typography>
                  </Box>
                </Box>

                {hasPendingReleaseRequest && (
                  <Alert severity="info" sx={{ mb: 4, borderRadius: 2 }}>
                    <Typography variant="subtitle2" fontWeight={600}>
                      Pending Release Request
                    </Typography>
                    <Typography variant="body2">
                      There's a pending release request from {pendingReleaseFromPlayer}.
                      You can approve or forward this request.
                    </Typography>
                  </Alert>
                )}

                {/* Stepper */}
                <Stepper activeStep={1} alternativeLabel sx={{ mb: 6 }}>
                  <Step>
                    <StepLabel>Search & Verify</StepLabel>
                  </Step>
                  <Step>
                    <StepLabel>Withheld Details</StepLabel>
                  </Step>
                  <Step>
                    <StepLabel>Review & Submit</StepLabel>
                  </Step>
                </Stepper>

                <Grid container spacing={4}>
                  {/* Withheld Type */}
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth>
                      <InputLabel>Withheld Type *</InputLabel>
                      <Select
                        label="Withheld Type *"
                        value={formData.withheldType}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            withheldType: e.target.value,
                          }))
                        }
                        disabled={!canChooseWithheldType}
                        sx={{ borderRadius: 2 }}
                      >
                        <MenuItem value="Permanent">Permanent (Weedout)</MenuItem>
                        <MenuItem value="Temporary">Temporary</MenuItem>
                      </Select>
                      <FormHelperText>
                        {!canChooseWithheldType
                          ? "🔒 Only the first officer can modify this field"
                          : formData.withheldType === "Permanent"
                            ? "⚠️ Application will be permanently withheld (Cannot be released)"
                            : "⏳ Application will be temporarily withheld"}
                      </FormHelperText>
                    </FormControl>
                  </Grid>

                  {/* Is Withheld */}
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth>
                      <InputLabel>Withheld Status *</InputLabel>
                      <Select
                        label="Withheld Status *"
                        value={formData.isWithheld}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            isWithheld: e.target.value,
                          }))
                        }
                        disabled={!canChooseIsWithheld}
                        sx={{ borderRadius: 2 }}
                      >
                        <MenuItem value="yes">Yes – Keep Withheld</MenuItem>
                        <MenuItem value="no">No – Remove from Withheld</MenuItem>
                      </Select>
                      <FormHelperText>
                        {!canChooseIsWithheld
                          ? "🔒 Only the first officer can modify this field"
                          : formData.isWithheld === "yes"
                            ? "🔒 Application will remain/be withheld"
                            : "🔓 Application will be released from withheld"}
                      </FormHelperText>
                    </FormControl>
                  </Grid>

                  {/* Withheld Reason */}
                  <Grid item xs={12}>
                    <TextField
                      label="Withheld Reason / Remarks *"
                      fullWidth
                      multiline
                      rows={4}
                      value={formData.withheldReason}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          withheldReason: e.target.value,
                        }))
                      }
                      helperText={
                        recordExists && application?.isWithheld === false
                          ? "Application is currently NOT withheld. This will re-withhold it."
                          : "Provide detailed reason for withholding or remarks for action"
                      }
                      sx={{
                        '& .MuiOutlinedInput-root': { borderRadius: 2 }
                      }}
                    />
                  </Grid>

                  {/* Action Selection */}
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth error={error.includes("action")}>
                      <InputLabel>Select Action *</InputLabel>
                      <Select
                        label="Select Action *"
                        value={action}
                        onChange={(e) => setAction(e.target.value)}
                        sx={{ borderRadius: 2 }}
                      >
                        {actionOptions.map((option, index) => (
                          <MenuItem key={index} value={option.value} sx={{ py: 1.5 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              {option.value === "forward" ? <ArrowForwardIcon /> : <CheckCircleIcon />}
                              <Typography>{option.label}</Typography>
                            </Box>
                          </MenuItem>
                        ))}
                      </Select>
                      {action && (
                        <FormHelperText>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                            {action === "forward" ? (
                              <>
                                <ArrowForwardIcon fontSize="small" />
                                <Typography variant="body2">
                                  Forward to next officer in workflow
                                </Typography>
                              </>
                            ) : (
                              <>
                                <CheckCircleIcon fontSize="small" color="success" />
                                <Typography variant="body2">
                                  Approve the withheld action immediately
                                </Typography>
                              </>
                            )}
                          </Box>
                        </FormHelperText>
                      )}
                    </FormControl>
                  </Grid>

                  {/* File Upload - Mandatory */}
                  <Grid item xs={12}>
                    <Box>
                      <Typography variant="subtitle1" sx={{ mb: 3, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <AttachFileIcon />
                        Supporting Documents (Required)
                      </Typography>

                      {existingFilesToKeep.length > 0 && (
                        <Box sx={{ mb: 4 }}>
                          <Typography variant="body2" color="text.secondary" gutterBottom>
                            Current Documents
                          </Typography>
                          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                            {existingFilesToKeep.map((file, index) => (
                              <Chip
                                key={index}
                                label={file}
                                onClick={() => handleFileClick(file)}
                                onDelete={() => handleRemoveFile(file)}
                                deleteIcon={<DeleteIcon />}
                                icon={<VisibilityIcon />}
                                variant="outlined"
                                sx={{ mb: 1, borderRadius: 1 }}
                              />
                            ))}
                          </Stack>
                        </Box>
                      )}

                      <StyledDropzone
                        error={!!fileError}
                        onClick={() => document.getElementById('file-upload').click()}
                        data-error={!!fileError}
                      >
                        <input
                          id="file-upload"
                          type="file"
                          accept="application/pdf"
                          multiple
                          onChange={handleFileChange}
                          style={{ display: 'none' }}
                        />
                        <UploadFileIcon sx={{
                          fontSize: 64,
                          color: fileError ? 'error.main' : 'grey.400',
                          mb: 2,
                        }} />
                        <Typography variant="h6" gutterBottom fontWeight={600}>
                          Click to upload or drag and drop
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          PDF files only • Maximum file size: 10MB per file
                        </Typography>
                        {fileError && (
                          <Typography variant="body2" color="error" sx={{ mt: 2, fontWeight: 600 }}>
                            {fileError}
                          </Typography>
                        )}
                      </StyledDropzone>

                      {formData.files.length > 0 && (
                        <Box sx={{ mt: 4 }}>
                          <Typography variant="body2" color="text.secondary" gutterBottom>
                            New files to upload:
                          </Typography>
                          <Paper variant="outlined" sx={{ borderRadius: 2 }}>
                            <List dense>
                              {formData.files.map((file, index) => (
                                <ListItem
                                  key={index}
                                  secondaryAction={
                                    <IconButton
                                      edge="end"
                                      onClick={() => handleRemoveFile(file)}
                                      size="small"
                                      sx={{ color: 'error.main' }}
                                    >
                                      <DeleteIcon fontSize="small" />
                                    </IconButton>
                                  }
                                  sx={{
                                    py: 1.5,
                                    borderBottom: index < formData.files.length - 1 ? '1px solid' : 'none',
                                    borderColor: 'divider',
                                    '&:hover': { bgcolor: 'action.hover' }
                                  }}
                                >
                                  <ListItemText
                                    primary={
                                      <Typography variant="body2" fontWeight={500}>
                                        {file.name}
                                      </Typography>
                                    }
                                    secondary={`${(file.size / 1024 / 1024).toFixed(2)} MB`}
                                  />
                                </ListItem>
                              ))}
                            </List>
                          </Paper>
                        </Box>
                      )}
                    </Box>
                  </Grid>

                  {/* Form Actions */}
                  <Grid item xs={12}>
                    <Divider sx={{ my: 2 }} />
                    <Stack direction="row" spacing={2} justifyContent="flex-end">
                      <Button
                        variant="outlined"
                        onClick={handleClearForm}
                        startIcon={<ClearIcon />}
                        size="large"
                        sx={{ borderRadius: 2, px: 4 }}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="contained"
                        onClick={handleSave}
                        disabled={loading || !action}
                        startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                        size="large"
                        sx={{ borderRadius: 2, px: 4, fontWeight: 600 }}
                      >
                        {recordExists ? "Update Application" : "Submit Application"}
                      </Button>
                    </Stack>
                  </Grid>
                </Grid>
              </CardContent>
            </StyledCard>
          )}
        </>
      )}

      {/* Modals */}
      <BasicModal
        open={modalOpen}
        handleClose={handleModalClose}
        Title="View Document"
        pdf={selectedPdfUrl}
      />

      <Dialog
        open={confirmDialogOpen}
        onClose={() => setConfirmDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{
          bgcolor: 'primary.main',
          color: 'white',
          fontWeight: 700,
          borderTopLeftRadius: 3,
          borderTopRightRadius: 3,
        }}>
          {recordExists ? "Update Withheld Application" : "Create Withheld Application"}
        </DialogTitle>
        <DialogContent sx={{ p: 4 }}>
          <Typography sx={{ mb: 3, fontWeight: 600 }}>
            Please confirm the following details before proceeding:
          </Typography>

          <Stack spacing={3} sx={{
            p: 3,
            bgcolor: 'grey.50',
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
          }}>
            <Box>
              <Typography variant="body2" color="text.secondary">Action</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                {action === "forward" ? <ArrowForwardIcon color="primary" /> : <CheckCircleIcon color="success" />}
                <Typography fontWeight={700} variant="h6">
                  {action === "forward" ? "Forward" : "Approve"}
                </Typography>
              </Box>
            </Box>

            <Box>
              <Typography variant="body2" color="text.secondary">Withheld Type</Typography>
              <Chip
                label={formData.withheldType === "Permanent" ? "Permanent (Weedout)" : "Temporary"}
                color={formData.withheldType === "Permanent" ? "error" : "warning"}
                variant="outlined"
                sx={{ mt: 1 }}
              />
            </Box>

            <Box>
              <Typography variant="body2" color="text.secondary">Withheld Status</Typography>
              <Chip
                label={formData.isWithheld === "yes" ? "Keep Withheld" : "Release Application"}
                color={formData.isWithheld === "yes" ? "error" : "success"}
                icon={formData.isWithheld === "yes" ? <LockIcon /> : <LockOpenIcon />}
                sx={{ mt: 1 }}
              />
            </Box>

            <Box>
              <Typography variant="body2" color="text.secondary">Documents</Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                Total documents: {existingFilesToKeep.length + formData.files.length}
              </Typography>
            </Box>

            {formData.isWithheld === "no" && (
              <Alert severity="warning" icon={<LockOpenIcon />}>
                <Typography variant="subtitle2" fontWeight={600}>
                  Release Action
                </Typography>
                <Typography variant="body2">
                  This will remove the application from withheld status
                </Typography>
              </Alert>
            )}

            {recordExists && application?.isWithheld === false && (
              <Alert severity="info">
                <Typography variant="subtitle2" fontWeight={600}>
                  Re-withhold Application
                </Typography>
                <Typography variant="body2">
                  Application is currently NOT withheld. This will re-withhold it.
                </Typography>
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3, borderTop: '1px solid', borderColor: 'divider' }}>
          <Button
            onClick={() => setConfirmDialogOpen(false)}
            color="inherit"
            sx={{ borderRadius: 2, px: 3 }}
          >
            Cancel
          </Button>
          <Button
            onClick={confirmSave}
            variant="contained"
            autoFocus
            sx={{ borderRadius: 2, px: 4, fontWeight: 600 }}
          >
            Confirm & Submit
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}