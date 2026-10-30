import React, { useState, useEffect, useRef, useMemo } from "react";
import GovPageHeader from "../../components/gov/GovPageHeader";
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
  Stack,
  Avatar,
  Autocomplete,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import VisibilityIcon from "@mui/icons-material/Visibility";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import SaveIcon from "@mui/icons-material/Save";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import HistoryIcon from "@mui/icons-material/History";
import DescriptionIcon from "@mui/icons-material/Description";
import GavelIcon from "@mui/icons-material/Gavel";
import LockIcon from "@mui/icons-material/Lock";
import LockOpenIcon from "@mui/icons-material/LockOpen";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import WarningIcon from "@mui/icons-material/Warning";
import InfoIcon from "@mui/icons-material/Info";
import FolderSharedIcon from "@mui/icons-material/FolderShared";
import { fetchServiceList } from "../../assets/fetch";
import axiosInstance from "../../axiosConfig";
import BasicModal from "../../components/BasicModal";
import { useLocation, useNavigate } from "react-router-dom";

const pickServiceId = (svc) => {
  if (!svc || typeof svc !== "object") return "";
  const keys = [
    "ServiceId",
    "serviceId",
    "Serviceid",
    "serviceid",
    "ServiceID",
    "serviceID",
    "service_id",
    "SERVICEID",
    "Id",
    "ID",
    "id",
    "Value",
    "value",
  ];
  for (const k of keys) {
    const v = svc[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return "";
};

const pickServiceName = (svc) => {
  if (!svc || typeof svc !== "object") return "";
  const keys = [
    "ServiceName",
    "serviceName",
    "Servicename",
    "servicename",
    "ServiceTitle",
    "serviceTitle",
    "Name",
    "name",
    "Label",
    "label",
    "Text",
    "text",
  ];
  for (const k of keys) {
    const v = svc[k];
    if (v !== undefined && v !== null && v !== "") return String(v);
  }
  return "";
};

export default function Withheld() {
  const location = useLocation();
  const navigate = useNavigate();
  const { applicationId } = location.state || {};
  const [services, setServices] = useState([]);
  const [selectedService, setSelectedService] = useState(null);
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
  const [hasActiveRecord, setHasActiveRecord] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);
  const [canCreate, setCanCreate] = useState(false);
  const [isNewRecordMode, setIsNewRecordMode] = useState(false);
  const [tableData, setTableData] = useState([]);
  const [tableColumns, setTableColumns] = useState([]);
  const [allOfficerFiles, setAllOfficerFiles] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPdfUrl, setSelectedPdfUrl] = useState("");
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [action, setAction] = useState("");
  const [actionOptions, setActionOptions] = useState([]);
  const [application, setApplication] = useState({});
  const [existingFilesToKeep, setExistingFilesToKeep] = useState([]);
  const [canChooseWithheldType, setCanChooseWithheldType] = useState(false);
  const [isFirstOfficer, setIsFirstOfficer] = useState(false);
  const [hasPendingReleaseRequest, setHasPendingReleaseRequest] =
    useState(false);
  const [pendingReleaseFromPlayer, setPendingReleaseFromPlayer] = useState("");
  const [fileError, setFileError] = useState("");
  const [isWithholdingOfficer, setIsWithholdingOfficer] = useState(false);
  const [isLastPlayer, setIsLastPlayer] = useState(false);
  const [canDirectWithheld, setCanDirectWithheld] = useState(false);
  const [canWithhold, setCanWithhold] = useState(false);

  const hasAutoSearchedRef = useRef(false);

  const serviceId = useMemo(() => {
    if (!selectedService) return "";
    const id = pickServiceId(selectedService);
    return id === undefined || id === null ? "" : String(id);
  }, [selectedService]);

  // ─────────────────────────────────────────────────────────────────────
  // Mode derived from BOTH isWithheld AND status === "Approved".
  //
  //   Withheld + Approved       → release mode   (cycle final; submit releases)
  //   Withheld + NOT Approved   → update mode    (cycle still in workflow)
  //   Not withheld              → withhold mode  (create a new cycle)
  //
  // Compare is case-insensitive so "APPROVED" / "approved" both match.
  // Missing status → not approved (safe default).
  // ─────────────────────────────────────────────────────────────────────
  const isApproved =
    String(application?.status ?? "").toLowerCase() === "approved";

  const isAlreadyWithheld = application?.isWithheld === true && isApproved;
  const isReleaseMode = isAlreadyWithheld;

  const canReleaseApprove =
    isWithholdingOfficer || isLastPlayer || canDirectWithheld;
  const canReleaseForward = canWithhold && !isLastPlayer;
  const canPerformRelease = canReleaseApprove || canReleaseForward;

  const releaseAction = canReleaseApprove ? "approve" : "forward";
  const effectiveAction = isReleaseMode ? releaseAction : action;
  const statusDropdownValue = isReleaseMode ? "no" : "yes";

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await fetchServiceList((list) => {
          if (!alive) return;
          const arr = Array.isArray(list) ? list : [];
          setServices(arr);
        });
      } catch (e) {
        console.error("fetchServiceList failed:", e);
        if (alive) setServices([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (applicationId) setReferenceNumber(applicationId);
  }, [applicationId]);

  useEffect(() => {
    if (
      referenceNumber &&
      services.length > 0 &&
      !selectedService &&
      !hasChecked
    ) {
      setSelectedService(services[0]);
    }
  }, [services, referenceNumber, selectedService, hasChecked]);

  useEffect(() => {
    if (
      applicationId &&
      referenceNumber === applicationId &&
      serviceId &&
      services.length > 0 &&
      !hasAutoSearchedRef.current &&
      !loading &&
      !hasChecked
    ) {
      hasAutoSearchedRef.current = true;
      handleCheck();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    applicationId,
    referenceNumber,
    serviceId,
    services,
    loading,
    hasChecked,
  ]);

  useEffect(() => {
    if (!isReleaseMode && actionOptions.length === 1 && !action) {
      setAction(actionOptions[0].value);
    }
  }, [actionOptions, action, isReleaseMode]);

  const scrollToError = () => {
    setTimeout(() => {
      const errorElement = document.querySelector(
        '.MuiAlert-root, [data-error="true"]',
      );
      if (errorElement)
        errorElement.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  };

  // handleCheck uses the composite "Approved && isWithheld" rule for mode,
  // but keeps `currentStateIsWithheld` raw so initialFormData / dirty-check
  // compare like-for-like.
  const handleCheck = async () => {
    if (!referenceNumber.trim()) {
      setError("Please enter a valid Reference Number.");
      return;
    }
    const effectiveServiceId =
      serviceId || String(pickServiceId(services[0]) || "");
    if (!effectiveServiceId || isNaN(parseInt(effectiveServiceId))) {
      setError("Please select a valid Service.");
      return;
    }

    setError("");
    setSuccessMessage("");
    setLoading(true);
    setHasChecked(false);
    setCanCreate(false);
    setIsNewRecordMode(false);
    setApplicationDetails(null);
    setTableData([]);
    setTableColumns([]);
    setAllOfficerFiles([]);
    setModalOpen(false);
    setSelectedPdfUrl("");
    setInitialFormData(null);
    setAction("");
    setActionOptions([]);
    setExistingFilesToKeep([]);
    setHasPendingReleaseRequest(false);
    setPendingReleaseFromPlayer("");
    setCanChooseWithheldType(false);
    setIsFirstOfficer(false);
    setFileError("");
    setHasActiveRecord(false);
    setIsWithholdingOfficer(false);
    setIsLastPlayer(false);
    setCanDirectWithheld(false);
    setCanWithhold(false);

    try {
      const res = await axiosInstance.get("/Officer/GetWithheldApplication", {
        params: { referenceNumber, serviceId: parseInt(effectiveServiceId) },
      });

      if (!res.data.status) {
        setError(res.data.response || "Failed to fetch details.");
        setRecordExists(false);
        setHasActiveRecord(false);
        setCanCreate(false);
        setHasChecked(false);
        return;
      }

      // ─────────────────────────────────────────────────────────────
      // Two distinct values — do NOT collapse them:
      //
      //   currentStateIsWithheld : RAW DB truth (isWithheld only)
      //                            → initialFormData (dirty-check)
      //                            → Application Details card
      //
      //   localIsAlreadyWithheld : isWithheld AND status === "Approved"
      //                            → drives release-vs-update mode
      //                            → drives target value written to form
      // ─────────────────────────────────────────────────────────────
      const currentStateIsWithheld = res.data.application?.isWithheld === true;

      const currentIsApproved =
        String(res.data.application?.status ?? "").toLowerCase() === "approved";

      const localIsAlreadyWithheld =
        currentStateIsWithheld && currentIsApproved;

      setRecordExists(!!res.data.recordExists);
      setHasActiveRecord(!!res.data.hasActiveRecord);
      setCanCreate(res.data.canCreate);
      setHasChecked(true);
      setTableData(res.data.data || []);
      setTableColumns(res.data.columns || []);
      setAllOfficerFiles(res.data.allOfficerFiles || []);
      setActionOptions(res.data.options || []);
      setApplication(res.data.application);
      setIsNewRecordMode(res.data.isNewRecordMode || false);
      setCanChooseWithheldType(res.data.canChooseWithheldType || false);
      setIsFirstOfficer(
        res.data.isFirstOfficer ||
          res.data.application?.isFirstOfficer ||
          false,
      );
      setIsWithholdingOfficer(res.data.isWithholdingOfficer || false);
      setIsLastPlayer(res.data.isLastPlayer || false);
      setCanDirectWithheld(res.data.canDirectWithheld || false);
      setCanWithhold(res.data.canWithhold || false);
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
      if (!Array.isArray(withheldFiles)) withheldFiles = [];

      const prefilledWithheldType = res.data.application?.withheldType || "";
      const prefilledWithheldReason = res.data.isNewRecordMode
        ? ""
        : res.data.application?.withheldReason || "";

      // Target = inverse of RELEASE mode (not of raw isWithheld).
      //   release mode   → "no"  (release)
      //   update mode    → "yes" (stay withheld)
      //   withhold mode  → "yes" (withhold)
      const targetIsWithheld = localIsAlreadyWithheld ? "no" : "yes";

      setFormData({
        withheldType: prefilledWithheldType,
        withheldReason: prefilledWithheldReason,
        files: [],
        isWithheld: targetIsWithheld,
      });
      setExistingFilesToKeep(res.data.isNewRecordMode ? [] : withheldFiles);

      if (res.data.application) {
        // initialFormData always mirrors the RAW current DB state so the
        // dirty-check compares like-for-like.
        setInitialFormData({
          withheldType: prefilledWithheldType,
          withheldReason: prefilledWithheldReason,
          files: res.data.isNewRecordMode ? [] : withheldFiles,
          isWithheld: currentStateIsWithheld ? "yes" : "no",
        });
      }

      const appDetails = res.data.applicationDetails || {};
      setApplicationDetails({
        applicantName: appDetails.applicantName || "N/A",
        parentage: appDetails.parentage || "N/A",
        ro: appDetails["r/o"] || "N/A",
        files: withheldFiles,
        withheldType: res.data.application?.withheldType || "N/A",
        withheldReason: res.data.application?.withheldReason || "N/A",
        isWithheld: res.data.application?.isWithheld ? "Yes" : "No",
      });

      // Auto-select the sole option ONLY when not in release mode
      // (release mode derives its action from canReleaseApprove/Forward).
      if (
        !localIsAlreadyWithheld &&
        Array.isArray(res.data.options) &&
        res.data.options.length === 1
      ) {
        setAction(res.data.options[0].value);
      }

      if (
        res.data.recordExists &&
        res.data.hasActiveRecord &&
        !res.data.canCreate &&
        !res.data.isNewRecordMode
      ) {
        setError(
          res.data.hasPendingReleaseRequest
            ? `There's a pending release request from ${res.data.pendingReleaseFromPlayer}. You are not the current player to handle it.`
            : "You are not authorized to update this withheld application.",
        );
      }
    } catch (err) {
      setError("Failed to fetch details. Please try again.");
      setCanCreate(false);
      setHasChecked(false);
      setHasActiveRecord(false);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files).filter(
      (file) => file.type === "application/pdf",
    );
    setFormData((prev) => ({
      ...prev,
      files: [...prev.files, ...selectedFiles],
    }));
    setFileError("");
  };

  const handleRemoveFile = (fileToRemove) => {
    if (typeof fileToRemove === "string") {
      setExistingFilesToKeep((prev) =>
        prev.filter((file) => file !== fileToRemove),
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

    if (isReleaseMode && !canPerformRelease) {
      setError(
        "You don't have authority to release this application. Please return it to the previous officer.",
      );
      scrollToError();
      return;
    }
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
    if (formData.isWithheld !== "yes" && formData.isWithheld !== "no") {
      setError("Please select Withheld Status.");
      scrollToError();
      return;
    }
    if (!effectiveAction) {
      setError("Please select an action.");
      scrollToError();
      return;
    }

    const totalFiles = existingFilesToKeep.length + formData.files.length;
    if (totalFiles === 0) {
      setFileError("At least one supporting document is required.");
      scrollToError();
      return;
    }

    if (
      hasActiveRecord &&
      !isReleaseMode &&
      !canChooseWithheldType &&
      formData.withheldType !== application?.withheldType
    ) {
      setError("Only the first officer can modify Withheld Type.");
      scrollToError();
      return;
    }
    if (
      hasActiveRecord &&
      initialFormData?.withheldType === "Permanent" &&
      formData.withheldType !== "Permanent"
    ) {
      setError("Withheld Type of a Permanent record cannot be changed.");
      scrollToError();
      return;
    }

    if (hasActiveRecord && initialFormData) {
      const hasFieldChanges =
        formData.withheldType !== initialFormData.withheldType ||
        formData.withheldReason.trim() !== initialFormData.withheldReason ||
        formData.isWithheld !== initialFormData.isWithheld;

      const allCurrentFiles = [
        ...existingFilesToKeep,
        ...formData.files.map((f) => f.name),
      ].sort();
      const allInitialFiles = [
        ...(initialFormData.files || []).map((f) =>
          typeof f === "string" ? f : f.name,
        ),
      ].sort();
      const hasFileChanges = allCurrentFiles.join() !== allInitialFiles.join();

      // ★ NEW — selecting a workflow action (forward / return / approve)
      //   is itself a meaningful change: it advances the record to the
      //   next player or to a final state. Downstream officers are here
      //   to ACT, not to edit fields. Do not block workflow progress on
      //   a no-op field diff — otherwise an officer sitting on the
      //   record with the correct action already selected (e.g. a
      //   Director whose only option is "Approve") can never submit.
      const isWorkflowProgress = !!effectiveAction && actionOptions.length > 0;

      if (!hasFieldChanges && !hasFileChanges && !isWorkflowProgress) {
        setError(
          "No changes detected. Please modify the application details or files to update.",
        );
        scrollToError();
        return;
      }
    }
    setConfirmDialogOpen(true);
  };

  const confirmSave = async () => {
    setConfirmLoading(true);
    try {
      const form = new FormData();
      form.append("ServiceId", serviceId);
      form.append("ReferenceNumber", referenceNumber);
      form.append(
        "IsWithheld",
        formData.isWithheld === "no" ? "false" : "true",
      );
      form.append("WithheldType", formData.withheldType);
      form.append("WithheldReason", formData.withheldReason);
      form.append("Action", effectiveAction);
      if (existingFilesToKeep.length > 0)
        form.append("ExistingFiles", existingFilesToKeep.join(","));
      formData.files.forEach((file) => {
        if (file instanceof File) form.append("Files", file);
      });

      const res = hasActiveRecord
        ? await axiosInstance.post("/Officer/UpdateWithheldApplication", form)
        : await axiosInstance.post("/Officer/CreateWithheldApplication", form);

      setSuccessMessage(
        res.data.message || "Operation completed successfully.",
      );

      setFormData({
        withheldType: "",
        withheldReason: "",
        files: [],
        isWithheld: "yes",
      });
      setInitialFormData(null);
      setReferenceNumber("");
      setRecordExists(false);
      setHasActiveRecord(false);
      setHasChecked(false);
      setCanCreate(false);
      setApplicationDetails(null);
      setError("");
      setTableData([]);
      setTableColumns([]);
      setAllOfficerFiles([]);
      setModalOpen(false);
      setSelectedPdfUrl("");
      setAction("");
      setActionOptions([]);
      setExistingFilesToKeep([]);
      setHasPendingReleaseRequest(false);
      setPendingReleaseFromPlayer("");
      setCanChooseWithheldType(false);
      setIsFirstOfficer(false);
      setFileError("");
      setIsNewRecordMode(false);
      setIsWithholdingOfficer(false);
      setIsLastPlayer(false);
      setCanDirectWithheld(false);
      setCanWithhold(false);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.response?.data?.response ||
          "Failed to save application. Please try again.",
      );
    } finally {
      setConfirmLoading(false);
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
    setSelectedService(null);
    setReferenceNumber("");
    setError("");
    setSuccessMessage("");
    setHasChecked(false);
    setCanCreate(false);
    setRecordExists(false);
    setHasActiveRecord(false);
    setApplicationDetails(null);
    setTableData([]);
    setTableColumns([]);
    setAllOfficerFiles([]);
    setInitialFormData(null);
    setAction("");
    setActionOptions([]);
    setExistingFilesToKeep([]);
    setHasPendingReleaseRequest(false);
    setPendingReleaseFromPlayer("");
    setCanChooseWithheldType(false);
    setIsFirstOfficer(false);
    setFileError("");
    setIsNewRecordMode(false);
    setIsWithholdingOfficer(false);
    setIsLastPlayer(false);
    setCanDirectWithheld(false);
    setCanWithhold(false);
    hasAutoSearchedRef.current = false;
  };

  const formatKey = (key) => {
    if (key === "r/o") return "Residence";
    return key
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  };
  const getWithheldStatusColor = (status) =>
    status === "yes" || status === "Yes" ? "#DC2626" : "#10B981";
  const getWithheldTypeColor = (type) =>
    type === "Permanent" ? "#DC2626" : "#F59E0B";

  return (
    <Box sx={{ bgcolor: "#F8FAFC", minHeight: "100vh", py: 4 }}>
      <Box sx={{ maxWidth: 1400, mx: "auto", px: { xs: 2, md: 4 } }}>
        <GovPageHeader
          title="Withheld Application Management"
          hindiTitle="अधिलंबित आवेदन प्रबंधन"
          subtitle="Manage application withholding status and workflow"
          crumbs={[
            { label: "Dashboard", path: "/officer/home" },
            { label: "Withheld Management", path: "" },
          ]}
        />

        {/* Search Section */}
        <Paper
          elevation={0}
          sx={{
            p: 3,
            mb: 4,
            borderRadius: 3,
            border: "1px solid #E2E8F0",
            bgcolor: "white",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 3 }}>
            <SearchIcon sx={{ color: "#2562E9" }} />
            <Typography variant="h6" sx={{ fontWeight: 700, color: "#0F172A" }}>
              Search Application
            </Typography>
          </Box>
          <Grid container spacing={3}>
            <Grid item xs={12} md={12}>
              <Autocomplete
                fullWidth
                options={services}
                value={selectedService}
                isOptionEqualToValue={(option, value) => option === value}
                getOptionLabel={(option) => {
                  if (!option) return "";
                  const name = pickServiceName(option);
                  if (name) return name;
                  return (
                    option.ServiceId?.toString() ||
                    option.serviceId?.toString() ||
                    option.Serviceid?.toString() ||
                    option.serviceid?.toString() ||
                    option.id?.toString() ||
                    option.Id?.toString() ||
                    JSON.stringify(option)
                  );
                }}
                onChange={(event, newValue) =>
                  setSelectedService(newValue || null)
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Select Service"
                    variant="outlined"
                  />
                )}
                disableClearable
                disabled={loading}
              />
            </Grid>
            <Grid item xs={12} md={12}>
              <TextField
                fullWidth
                label="Reference Number"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="Enter application reference number"
                variant="outlined"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (!loading) handleCheck();
                  }
                }}
              />
            </Grid>
          </Grid>
          <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
            <Button
              variant="contained"
              size="large"
              startIcon={
                loading ? (
                  <CircularProgress size={20} color="inherit" />
                ) : (
                  <SearchIcon />
                )
              }
              onClick={handleCheck}
              disabled={loading || !services.length}
              sx={{
                bgcolor: "#2562E9",
                "&:hover": { bgcolor: "#1D4ED8" },
                textTransform: "none",
                fontWeight: 600,
                px: 4,
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
                textTransform: "none",
                borderColor: "#CBD5E1",
                color: "#475569",
                "&:hover": { borderColor: "#2562E9", color: "#2562E9" },
                px: 4,
              }}
            >
              Clear
            </Button>
          </Stack>
        </Paper>

        {successMessage && (
          <Alert
            severity="success"
            sx={{ mb: 3, borderRadius: 2, border: "1px solid #A7F3D0" }}
            icon={<CheckCircleIcon fontSize="inherit" />}
          >
            <Typography fontWeight={600}>{successMessage}</Typography>
          </Alert>
        )}
        {error && (
          <Alert
            severity="error"
            sx={{ mb: 3, borderRadius: 2, border: "1px solid #FECACA" }}
            icon={<WarningIcon />}
          >
            <Typography fontWeight={600}>{error}</Typography>
          </Alert>
        )}

        {hasChecked && (
          <>
            {applicationDetails && (
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  mb: 4,
                  borderRadius: 3,
                  border: "1px solid #E2E8F0",
                  bgcolor: "white",
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    mb: 3,
                    pb: 2,
                    borderBottom: "1px solid #E2E8F0",
                  }}
                >
                  <DescriptionIcon sx={{ color: "#2562E9" }} />
                  <Typography
                    variant="h6"
                    sx={{ fontWeight: 700, color: "#0F172A" }}
                  >
                    Application Details
                  </Typography>
                </Box>
                <Grid container spacing={2}>
                  {Object.entries(applicationDetails).map(
                    ([key, value]) =>
                      key !== "files" && (
                        <Grid item xs={12} md={6} key={key}>
                          <Paper
                            variant="outlined"
                            sx={{
                              p: 2,
                              borderRadius: 2,
                              bgcolor: "#F8FAFC",
                              border: "1px solid #E2E8F0",
                            }}
                          >
                            <Typography
                              variant="caption"
                              sx={{
                                color: "#64748B",
                                fontWeight: 600,
                                textTransform: "uppercase",
                                letterSpacing: 0.5,
                                display: "block",
                                mb: 0.5,
                              }}
                            >
                              {formatKey(key)}
                            </Typography>
                            <Typography
                              variant="body1"
                              sx={{ fontWeight: 600, color: "#0F172A" }}
                            >
                              {value || "N/A"}
                            </Typography>
                          </Paper>
                        </Grid>
                      ),
                  )}
                </Grid>

                {recordExists && application && (
                  <>
                    <Divider sx={{ my: 3 }} />
                    <Typography
                      variant="h6"
                      sx={{ mb: 2, fontWeight: 700, color: "#0F172A" }}
                    >
                      {isNewRecordMode
                        ? "Previous Withheld Summary"
                        : "Withheld Status Summary"}
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <Paper
                          variant="outlined"
                          sx={{
                            p: 2.5,
                            borderRadius: 2,
                            display: "flex",
                            alignItems: "center",
                            gap: 2,
                            border: `2px solid ${getWithheldTypeColor(application.withheldType)}`,
                          }}
                        >
                          <Avatar
                            sx={{
                              bgcolor: `${getWithheldTypeColor(application.withheldType)}15`,
                              color: getWithheldTypeColor(
                                application.withheldType,
                              ),
                              width: 48,
                              height: 48,
                            }}
                          >
                            {application.withheldType === "Permanent" ? (
                              <LockIcon />
                            ) : (
                              <HistoryIcon />
                            )}
                          </Avatar>
                          <Box>
                            <Typography
                              variant="caption"
                              sx={{ color: "#64748B" }}
                            >
                              Withheld Type
                            </Typography>
                            <Typography
                              variant="h6"
                              sx={{ fontWeight: 700, color: "#0F172A" }}
                            >
                              {application.withheldType === "Permanent"
                                ? "Permanent (Weedout)"
                                : "Temporary"}
                            </Typography>
                          </Box>
                        </Paper>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Paper
                          variant="outlined"
                          sx={{
                            p: 2.5,
                            borderRadius: 2,
                            display: "flex",
                            alignItems: "center",
                            gap: 2,
                            border: `2px solid ${getWithheldStatusColor(application.isWithheld ? "yes" : "no")}`,
                          }}
                        >
                          <Avatar
                            sx={{
                              bgcolor: `${getWithheldStatusColor(application.isWithheld ? "yes" : "no")}15`,
                              color: getWithheldStatusColor(
                                application.isWithheld ? "yes" : "no",
                              ),
                              width: 48,
                              height: 48,
                            }}
                          >
                            {application.isWithheld ? (
                              <LockIcon />
                            ) : (
                              <LockOpenIcon />
                            )}
                          </Avatar>
                          <Box>
                            <Typography
                              variant="caption"
                              sx={{ color: "#64748B" }}
                            >
                              Current Status
                            </Typography>
                            <Typography
                              variant="h6"
                              sx={{ fontWeight: 700, color: "#0F172A" }}
                            >
                              {application.isWithheld
                                ? "Withheld"
                                : "Not Withheld"}
                            </Typography>
                          </Box>
                        </Paper>
                      </Grid>
                    </Grid>
                  </>
                )}

                {existingFilesToKeep.length > 0 && (
                  <>
                    <Divider sx={{ my: 3 }} />
                    <Typography
                      variant="h6"
                      sx={{ mb: 2, fontWeight: 700, color: "#0F172A" }}
                    >
                      Attached Documents
                    </Typography>
                    <Stack
                      direction="row"
                      spacing={1}
                      flexWrap="wrap"
                      useFlexGap
                    >
                      {existingFilesToKeep.map((file, index) => (
                        <Chip
                          key={index}
                          label={file}
                          onClick={() => handleFileClick(file)}
                          onDelete={() => handleRemoveFile(file)}
                          deleteIcon={<DeleteIcon />}
                          icon={<VisibilityIcon />}
                          variant="outlined"
                          sx={{
                            mb: 1,
                            borderRadius: 1,
                            borderColor: "#CBD5E1",
                            "&:hover": {
                              bgcolor: "#F1F5F9",
                              borderColor: "#2562E9",
                            },
                          }}
                        />
                      ))}
                    </Stack>
                  </>
                )}
              </Paper>
            )}

            {tableData.length > 0 && (
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  mb: 4,
                  borderRadius: 3,
                  border: "1px solid #E2E8F0",
                  bgcolor: "white",
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    mb: 3,
                    pb: 2,
                    borderBottom: "1px solid #E2E8F0",
                  }}
                >
                  <HistoryIcon sx={{ color: "#2562E9" }} />
                  <Typography
                    variant="h6"
                    sx={{ fontWeight: 700, color: "#0F172A" }}
                  >
                    Action History
                  </Typography>
                </Box>
                <TableContainer
                  sx={{ borderRadius: 2, border: "1px solid #E2E8F0" }}
                >
                  <Table>
                    <TableHead>
                      <TableRow>
                        {tableColumns.map((column, index) => (
                          <TableCell
                            key={index}
                            sx={{
                              bgcolor: "#E2E8F0",
                              color: "#0F172A",
                              fontWeight: 800,
                              fontSize: "0.85rem",
                              textTransform: "uppercase",
                              letterSpacing: 0.6,
                              py: 2,
                              borderBottom: "2px solid #94A3B8",
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
                            "&:hover": { bgcolor: "#F8FAFC" },
                            "&:nth-of-type(even)": { bgcolor: "#FAFAFA" },
                          }}
                        >
                          {tableColumns.map((column, colIndex) => (
                            <TableCell
                              key={colIndex}
                              sx={{ py: 2, color: "#1E293B" }}
                            >
                              {row[column.accessorKey] || "N/A"}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            )}

            {allOfficerFiles.length > 0 && (
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  mb: 4,
                  borderRadius: 3,
                  border: "1px solid #E2E8F0",
                  bgcolor: "white",
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    mb: 3,
                    pb: 2,
                    borderBottom: "1px solid #E2E8F0",
                  }}
                >
                  <FolderSharedIcon sx={{ color: "#2562E9" }} />
                  <Typography
                    variant="h6"
                    sx={{ fontWeight: 700, color: "#0F172A" }}
                  >
                    Documents Uploaded by Officers ({allOfficerFiles.length})
                  </Typography>
                </Box>
                <TableContainer
                  sx={{ borderRadius: 2, border: "1px solid #E2E8F0" }}
                >
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        {[
                          "File",
                          "Cycle",
                          "Withheld Type",
                          "Status",
                          "Action",
                        ].map((h, i) => (
                          <TableCell
                            key={i}
                            align={h === "Action" ? "right" : "left"}
                            sx={{
                              bgcolor: "#E2E8F0",
                              color: "#0F172A",
                              fontWeight: 800,
                              fontSize: "0.8rem",
                              textTransform: "uppercase",
                              letterSpacing: 0.6,
                              py: 1.5,
                              borderBottom: "2px solid #94A3B8",
                            }}
                          >
                            {h}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {allOfficerFiles.map((row, idx) => (
                        <TableRow
                          key={`${row.withheldId}-${idx}`}
                          hover
                          sx={{ "&:nth-of-type(even)": { bgcolor: "#FAFAFA" } }}
                        >
                          <TableCell sx={{ color: "#1E293B", maxWidth: 360 }}>
                            <Typography
                              variant="body2"
                              sx={{
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                fontWeight: 500,
                              }}
                              title={row.fileName}
                            >
                              {row.fileName}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ color: "#334155", fontWeight: 600 }}>
                            {row.cycleLabel || "N/A"}
                          </TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              label={row.withheldType || "N/A"}
                              color={
                                row.withheldType === "Permanent"
                                  ? "error"
                                  : "warning"
                              }
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              label={row.status || "N/A"}
                              variant="outlined"
                              sx={{ textTransform: "capitalize" }}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Tooltip title="View document">
                              <IconButton
                                size="small"
                                onClick={() => handleFileClick(row.fileName)}
                                sx={{ color: "#2562E9" }}
                              >
                                <VisibilityIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            )}

            {canCreate && (
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
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1.5,
                    mb: 4,
                    pb: 3,
                    borderBottom: "1px solid #E2E8F0",
                  }}
                >
                  <GavelIcon sx={{ color: "#2562E9", fontSize: 32 }} />
                  <Box sx={{ flex: 1 }}>
                    <Typography
                      variant="h5"
                      sx={{ fontWeight: 800, color: "#0F172A", mb: 0.5 }}
                    >
                      {isReleaseMode
                        ? canReleaseApprove
                          ? "Release Withheld Application"
                          : "Request Release (Forward to Next Officer)"
                        : isNewRecordMode
                          ? "Create New Withheld Record"
                          : hasActiveRecord
                            ? "Update Withheld Application"
                            : "Create Withheld Application"}
                    </Typography>
                    <Typography variant="body2" sx={{ color: "#64748B" }}>
                      {isReleaseMode
                        ? "Withheld Type and Status are locked during release. Provide a reason and submit."
                        : isNewRecordMode
                          ? "Previous record is preserved in history. Create a new withhold entry."
                          : isFirstOfficer
                            ? "You are the first officer – you can modify all fields"
                            : "You can only add remarks and take action"}
                    </Typography>
                  </Box>
                </Box>

                {isReleaseMode && (
                  <Alert
                    severity={
                      application?.withheldType === "Permanent"
                        ? "error"
                        : "warning"
                    }
                    icon={
                      application?.withheldType === "Permanent" ? (
                        <WarningIcon />
                      ) : (
                        <LockOpenIcon />
                      )
                    }
                    sx={{ mb: 4, borderRadius: 2 }}
                  >
                    <Typography variant="subtitle2" fontWeight={700}>
                      {hasPendingReleaseRequest
                        ? "Pending Release Request"
                        : canReleaseApprove
                          ? "Release Mode"
                          : "Request-Release Mode"}
                    </Typography>
                    <Typography variant="body2">
                      {hasPendingReleaseRequest
                        ? `A release request from ${pendingReleaseFromPlayer} is pending. ${canReleaseApprove ? "Approving will release the application." : "Forwarding will send it to the next officer."}`
                        : canReleaseApprove
                          ? "This will release the application from withheld status."
                          : "This will create a release request and forward it to the next officer."}{" "}
                      Withheld Type is locked to{" "}
                      <strong>{application?.withheldType}</strong>.
                    </Typography>
                    {application?.withheldType === "Permanent" && (
                      <Typography
                        variant="body2"
                        sx={{ mt: 1, fontWeight: 700, color: "#991B1B" }}
                      >
                        ⚠ Permanent (Weedout) record — releasing it is an
                        exceptional action that will reinstate the applicant.
                      </Typography>
                    )}
                  </Alert>
                )}

                {isReleaseMode && !canPerformRelease && (
                  <Alert
                    severity="error"
                    icon={<WarningIcon />}
                    sx={{ mb: 4, borderRadius: 2 }}
                  >
                    <Typography variant="subtitle2" fontWeight={700}>
                      Insufficient Authority
                    </Typography>
                    <Typography variant="body2">
                      You are the current player but do not have authority to
                      approve or forward a release. Contact the sanctioning
                      officer.
                    </Typography>
                  </Alert>
                )}

                {isNewRecordMode && (
                  <Alert
                    severity="info"
                    icon={<HistoryIcon />}
                    sx={{ mb: 4, borderRadius: 2, border: "1px solid #BFDBFE" }}
                  >
                    <Typography variant="subtitle2" fontWeight={700}>
                      {isAlreadyWithheld
                        ? "New Release Cycle"
                        : "New Withhold Cycle"}
                    </Typography>
                    <Typography variant="body2">
                      {isAlreadyWithheld
                        ? "The application is currently withheld. Submitting will create a new cycle that releases it, while preserving the previous cycle in history."
                        : "The previous withhold cycle is preserved in Action History above. Submitting will create a new withhold cycle."}
                    </Typography>
                  </Alert>
                )}

                {hasPendingReleaseRequest && !isReleaseMode && (
                  <Alert
                    severity="info"
                    sx={{ mb: 4, borderRadius: 2, border: "1px solid #BFDBFE" }}
                    icon={<InfoIcon />}
                  >
                    <Typography variant="subtitle2" fontWeight={700}>
                      Pending Release Request
                    </Typography>
                    <Typography variant="body2">
                      There's a pending release request from{" "}
                      {pendingReleaseFromPlayer}.
                    </Typography>
                  </Alert>
                )}

                <Grid container spacing={3}>
                  {/* Withheld Type */}
                  <Grid item xs={12} md={6}>
                    {isReleaseMode || !canChooseWithheldType ? (
                      <Paper
                        variant="outlined"
                        sx={{
                          p: 2,
                          borderRadius: 2,
                          bgcolor: "#F8FAFC",
                          border: `2px solid ${getWithheldTypeColor(formData.withheldType)}`,
                          height: "100%",
                        }}
                      >
                        <Typography
                          variant="caption"
                          sx={{
                            color: "#64748B",
                            fontWeight: 600,
                            textTransform: "uppercase",
                            letterSpacing: 0.5,
                            display: "block",
                            mb: 1,
                          }}
                        >
                          Withheld Type (Locked)
                        </Typography>
                        <Box
                          sx={{ display: "flex", alignItems: "center", gap: 1 }}
                        >
                          <Chip
                            label={
                              formData.withheldType === "Permanent"
                                ? "Permanent (Weedout)"
                                : formData.withheldType === "Temporary"
                                  ? "Temporary"
                                  : "Not set"
                            }
                            color={
                              formData.withheldType === "Permanent"
                                ? "error"
                                : "warning"
                            }
                            variant="outlined"
                            sx={{ fontWeight: 700 }}
                          />
                          <LockIcon
                            fontSize="small"
                            sx={{ color: "#64748B" }}
                          />
                        </Box>
                      </Paper>
                    ) : (
                      <FormControl fullWidth>
                        <InputLabel>
                          {isNewRecordMode
                            ? "Withheld Type for New Cycle *"
                            : "Withheld Type *"}
                        </InputLabel>
                        <Select
                          label={
                            isNewRecordMode
                              ? "Withheld Type for New Cycle *"
                              : "Withheld Type *"
                          }
                          value={formData.withheldType}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              withheldType: e.target.value,
                            }))
                          }
                        >
                          <MenuItem value="Permanent">
                            Permanent (Weedout)
                          </MenuItem>
                          <MenuItem value="Temporary">Temporary</MenuItem>
                        </Select>
                        <FormHelperText sx={{ mt: 1 }}>
                          {isNewRecordMode
                            ? "🆕 Pre-filled from the previous cycle — change if needed."
                            : formData.withheldType === "Permanent"
                              ? "⚠️ Permanent (Weedout) — release requires confirmation."
                              : "⏳ Application will be temporarily withheld."}
                        </FormHelperText>
                      </FormControl>
                    )}
                  </Grid>

                  {/* Withheld Status — dropdown with one option appropriate to the state */}
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth>
                      <InputLabel>
                        {isReleaseMode
                          ? "Withheld Status (Release Only)"
                          : "Withheld Status (Withhold Only)"}
                      </InputLabel>
                      <Select
                        label={
                          isReleaseMode
                            ? "Withheld Status (Release Only)"
                            : "Withheld Status (Withhold Only)"
                        }
                        value={statusDropdownValue}
                        onChange={() =>
                          setFormData((prev) => ({
                            ...prev,
                            isWithheld: statusDropdownValue,
                          }))
                        }
                      >
                        {isReleaseMode ? (
                          <MenuItem value="no">
                            No – Release from Withheld
                          </MenuItem>
                        ) : (
                          <MenuItem value="yes">Yes – Keep Withheld</MenuItem>
                        )}
                      </Select>
                      {/* ★ CHANGED — three-state helper text so an
                          in-workflow withheld record no longer claims
                          "Application is not currently withheld". */}
                      <FormHelperText sx={{ mt: 1 }}>
                        {isReleaseMode
                          ? "🔓 Application is currently withheld — the only available option is to release it."
                          : application?.isWithheld === true
                            ? "🔒 Application is currently withheld and this cycle is still in the workflow — submission keeps it withheld and moves it to the next officer."
                            : "🔒 Application is not currently withheld — it will be withheld on submit."}
                      </FormHelperText>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12}>
                    <TextField
                      label={
                        isReleaseMode
                          ? "Release Reason *"
                          : "Withheld Reason / Remarks *"
                      }
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
                        isReleaseMode
                          ? "Provide a clear reason for releasing this application."
                          : "Provide a detailed reason for withholding this application."
                      }
                    />
                  </Grid>

                  {/* Action */}
                  <Grid item xs={12} md={6}>
                    {isReleaseMode ? (
                      <FormControl fullWidth>
                        <InputLabel>Action (Release)</InputLabel>
                        <Select
                          label="Action (Release)"
                          value={releaseAction}
                          onChange={() => {}}
                        >
                          <MenuItem value={releaseAction}>
                            <Box
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                              }}
                            >
                              {canReleaseApprove ? (
                                <CheckCircleIcon />
                              ) : (
                                <ArrowForwardIcon />
                              )}
                              <Typography>
                                {canReleaseApprove
                                  ? "Approve Release"
                                  : "Forward Release Request"}
                              </Typography>
                            </Box>
                          </MenuItem>
                        </Select>
                        <FormHelperText sx={{ mt: 1 }}>
                          {canReleaseApprove
                            ? "You have authority to approve the release directly."
                            : "You can only forward this release request to the next officer."}
                        </FormHelperText>
                      </FormControl>
                    ) : (
                      <FormControl fullWidth error={error.includes("action")}>
                        <InputLabel>Select Action *</InputLabel>
                        <Select
                          label="Select Action *"
                          value={action}
                          onChange={(e) => setAction(e.target.value)}
                        >
                          {actionOptions.map((option, index) => (
                            <MenuItem
                              key={index}
                              value={option.value}
                              sx={{ py: 1.5 }}
                            >
                              <Box
                                sx={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 1,
                                }}
                              >
                                {option.value === "forward" ? (
                                  <ArrowForwardIcon />
                                ) : option.value === "return" ? (
                                  <ArrowForwardIcon
                                    sx={{ transform: "rotate(180deg)" }}
                                  />
                                ) : (
                                  <CheckCircleIcon />
                                )}
                                <Typography>{option.label}</Typography>
                              </Box>
                            </MenuItem>
                          ))}
                        </Select>
                        {action && (
                          <FormHelperText sx={{ mt: 1 }}>
                            <Box
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                              }}
                            >
                              {action === "forward" ? (
                                <>
                                  <ArrowForwardIcon
                                    fontSize="small"
                                    color="primary"
                                  />
                                  <Typography variant="body2">
                                    Forward to next officer in workflow
                                  </Typography>
                                </>
                              ) : action === "return" ? (
                                <>
                                  <ArrowForwardIcon
                                    fontSize="small"
                                    color="primary"
                                    sx={{ transform: "rotate(180deg)" }}
                                  />
                                  <Typography variant="body2">
                                    Return to previous officer
                                  </Typography>
                                </>
                              ) : (
                                <>
                                  <CheckCircleIcon
                                    fontSize="small"
                                    color="success"
                                  />
                                  <Typography variant="body2">
                                    Approve the withheld action immediately
                                  </Typography>
                                </>
                              )}
                            </Box>
                          </FormHelperText>
                        )}
                      </FormControl>
                    )}
                  </Grid>

                  <Grid item xs={12}>
                    <Box>
                      <Typography
                        variant="subtitle1"
                        sx={{
                          mb: 2,
                          fontWeight: 700,
                          display: "flex",
                          alignItems: "center",
                          gap: 1,
                          color: "#0F172A",
                        }}
                      >
                        <AttachFileIcon /> Supporting Documents (Required)
                      </Typography>

                      {existingFilesToKeep.length > 0 && (
                        <Box sx={{ mb: 3 }}>
                          <Typography
                            variant="body2"
                            sx={{ color: "#64748B", mb: 1, fontWeight: 600 }}
                          >
                            Current Documents
                          </Typography>
                          <Stack
                            direction="row"
                            spacing={1}
                            flexWrap="wrap"
                            useFlexGap
                          >
                            {existingFilesToKeep.map((file, index) => (
                              <Chip
                                key={index}
                                label={file}
                                onClick={() => handleFileClick(file)}
                                onDelete={() => handleRemoveFile(file)}
                                deleteIcon={<DeleteIcon />}
                                icon={<VisibilityIcon />}
                                variant="outlined"
                                sx={{
                                  mb: 1,
                                  borderRadius: 1,
                                  borderColor: "#CBD5E1",
                                  "&:hover": { bgcolor: "#F1F5F9" },
                                }}
                              />
                            ))}
                          </Stack>
                        </Box>
                      )}

                      <Paper
                        variant="outlined"
                        onClick={() =>
                          document.getElementById("file-upload").click()
                        }
                        data-error={!!fileError}
                        sx={{
                          p: 4,
                          textAlign: "center",
                          borderStyle: "dashed",
                          borderWidth: 2,
                          borderColor: fileError ? "#DC2626" : "#CBD5E1",
                          bgcolor: fileError ? "#FEF2F2" : "#F8FAFC",
                          borderRadius: 2,
                          cursor: "pointer",
                          transition: "all 0.2s",
                          "&:hover": {
                            borderColor: "#2562E9",
                            bgcolor: "#EFF6FF",
                          },
                        }}
                      >
                        <input
                          id="file-upload"
                          type="file"
                          accept="application/pdf"
                          multiple
                          onChange={handleFileChange}
                          style={{ display: "none" }}
                        />
                        <UploadFileIcon
                          sx={{
                            fontSize: 56,
                            color: fileError ? "#DC2626" : "#94A3B8",
                            mb: 2,
                          }}
                        />
                        <Typography
                          variant="h6"
                          sx={{ fontWeight: 600, color: "#0F172A", mb: 1 }}
                        >
                          Click to upload or drag and drop
                        </Typography>
                        <Typography variant="body2" sx={{ color: "#64748B" }}>
                          PDF files only • Maximum file size: 10MB per file
                        </Typography>
                        {fileError && (
                          <Typography
                            variant="body2"
                            sx={{ mt: 2, color: "#DC2626", fontWeight: 600 }}
                          >
                            {fileError}
                          </Typography>
                        )}
                      </Paper>

                      {formData.files.length > 0 && (
                        <Box sx={{ mt: 3 }}>
                          <Typography
                            variant="body2"
                            sx={{ color: "#64748B", mb: 1, fontWeight: 600 }}
                          >
                            New files to upload:
                          </Typography>
                          <Paper
                            variant="outlined"
                            sx={{
                              borderRadius: 2,
                              border: "1px solid #E2E8F0",
                            }}
                          >
                            <List dense>
                              {formData.files.map((file, index) => (
                                <ListItem
                                  key={index}
                                  secondaryAction={
                                    <IconButton
                                      edge="end"
                                      onClick={() => handleRemoveFile(file)}
                                      size="small"
                                      sx={{ color: "#DC2626" }}
                                    >
                                      <DeleteIcon fontSize="small" />
                                    </IconButton>
                                  }
                                  sx={{
                                    py: 1.5,
                                    borderBottom:
                                      index < formData.files.length - 1
                                        ? "1px solid #E2E8F0"
                                        : "none",
                                    "&:hover": { bgcolor: "#F8FAFC" },
                                  }}
                                >
                                  <ListItemText
                                    primary={
                                      <Typography
                                        variant="body2"
                                        sx={{
                                          fontWeight: 500,
                                          color: "#0F172A",
                                        }}
                                      >
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

                  <Grid item xs={12}>
                    <Divider sx={{ my: 3 }} />
                    <Stack
                      direction="row"
                      spacing={2}
                      justifyContent="flex-end"
                    >
                      <Button
                        variant="outlined"
                        onClick={handleClearForm}
                        startIcon={<ClearIcon />}
                        size="large"
                        sx={{
                          textTransform: "none",
                          borderColor: "#CBD5E1",
                          color: "#475569",
                          px: 4,
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="contained"
                        onClick={handleSave}
                        disabled={
                          loading ||
                          !effectiveAction ||
                          (isReleaseMode && !canPerformRelease)
                        }
                        startIcon={
                          loading ? (
                            <CircularProgress size={20} color="inherit" />
                          ) : (
                            <SaveIcon />
                          )
                        }
                        size="large"
                        sx={{
                          bgcolor: isReleaseMode ? "#DC2626" : "#10B981",
                          "&:hover": {
                            bgcolor: isReleaseMode ? "#B91C1C" : "#059669",
                          },
                          textTransform: "none",
                          fontWeight: 700,
                          px: 4,
                          boxShadow: isReleaseMode
                            ? "0 4px 12px rgba(220, 38, 38, 0.3)"
                            : "0 4px 12px rgba(16, 185, 129, 0.3)",
                        }}
                      >
                        {isReleaseMode
                          ? canReleaseApprove
                            ? "Release Application"
                            : "Request Release"
                          : isNewRecordMode
                            ? "Create New Record"
                            : hasActiveRecord
                              ? "Update Application"
                              : "Submit Application"}
                      </Button>
                    </Stack>
                  </Grid>
                </Grid>
              </Paper>
            )}
          </>
        )}

        <BasicModal
          open={modalOpen}
          handleClose={handleModalClose}
          Title="View Document"
          pdf={selectedPdfUrl}
        />

        <Dialog
          open={confirmDialogOpen}
          onClose={() => {
            if (!confirmLoading) setConfirmDialogOpen(false);
          }}
          maxWidth="sm"
          fullWidth
          PaperProps={{ sx: { borderRadius: 3 } }}
        >
          <DialogTitle
            sx={{
              bgcolor: isReleaseMode ? "#B91C1C" : "#2562E9",
              color: "white",
              fontWeight: 700,
              borderTopLeftRadius: 3,
              borderTopRightRadius: 3,
            }}
          >
            {isReleaseMode
              ? canReleaseApprove
                ? "Release Withheld Application"
                : "Request Release (Forward)"
              : isNewRecordMode
                ? "Create New Withheld Record"
                : hasActiveRecord
                  ? "Update Withheld Application"
                  : "Create Withheld Application"}
          </DialogTitle>
          <DialogContent sx={{ p: 4 }}>
            {confirmLoading ? (
              <Stack
                alignItems="center"
                justifyContent="center"
                spacing={2}
                sx={{ py: 6 }}
              >
                <CircularProgress size={56} sx={{ color: "#2562E9" }} />
                <Typography
                  variant="h6"
                  sx={{ fontWeight: 700, color: "#0F172A" }}
                >
                  Submitting...
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: "#64748B", textAlign: "center" }}
                >
                  Please wait while we process your request. Do not close or
                  refresh this window.
                </Typography>
              </Stack>
            ) : (
              <>
                <Typography sx={{ mb: 3, fontWeight: 600, color: "#0F172A" }}>
                  Please confirm the following details before proceeding:
                </Typography>
                <Stack
                  spacing={3}
                  sx={{
                    p: 3,
                    bgcolor: "#F8FAFC",
                    borderRadius: 2,
                    border: "1px solid #E2E8F0",
                  }}
                >
                  <Box>
                    <Typography
                      variant="body2"
                      sx={{ color: "#64748B", fontWeight: 600 }}
                    >
                      Action
                    </Typography>
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        mt: 0.5,
                      }}
                    >
                      {effectiveAction === "forward" ? (
                        <ArrowForwardIcon color="primary" />
                      ) : effectiveAction === "return" ? (
                        <ArrowForwardIcon
                          color="primary"
                          sx={{ transform: "rotate(180deg)" }}
                        />
                      ) : (
                        <CheckCircleIcon color="success" />
                      )}
                      <Typography
                        fontWeight={700}
                        variant="h6"
                        sx={{ color: "#0F172A" }}
                      >
                        {isReleaseMode
                          ? canReleaseApprove
                            ? "Release Application"
                            : "Request Release (Forward)"
                          : effectiveAction === "forward"
                            ? "Forward"
                            : effectiveAction === "return"
                              ? "Return"
                              : "Approve"}
                      </Typography>
                    </Box>
                  </Box>
                  <Box>
                    <Typography
                      variant="body2"
                      sx={{ color: "#64748B", fontWeight: 600 }}
                    >
                      Withheld Type
                    </Typography>
                    <Chip
                      label={
                        formData.withheldType === "Permanent"
                          ? "Permanent (Weedout)"
                          : formData.withheldType === "Temporary"
                            ? "Temporary"
                            : "Not selected"
                      }
                      color={
                        formData.withheldType === "Permanent"
                          ? "error"
                          : "warning"
                      }
                      variant="outlined"
                      sx={{ mt: 1 }}
                    />
                  </Box>
                  <Box>
                    <Typography
                      variant="body2"
                      sx={{ color: "#64748B", fontWeight: 600 }}
                    >
                      Withheld Status
                    </Typography>
                    <Chip
                      label={
                        formData.isWithheld === "yes"
                          ? "Keep Withheld"
                          : canReleaseApprove
                            ? "Release Application"
                            : "Request Release"
                      }
                      color={
                        formData.isWithheld === "yes" ? "error" : "success"
                      }
                      icon={
                        formData.isWithheld === "yes" ? (
                          <LockIcon />
                        ) : (
                          <LockOpenIcon />
                        )
                      }
                      sx={{ mt: 1 }}
                    />
                  </Box>
                  <Box>
                    <Typography
                      variant="body2"
                      sx={{ color: "#64748B", fontWeight: 600 }}
                    >
                      Documents
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{ mt: 1, color: "#0F172A" }}
                    >
                      Total documents:{" "}
                      {existingFilesToKeep.length + formData.files.length}
                    </Typography>
                  </Box>

                  {isReleaseMode && (
                    <Alert
                      severity={
                        application?.withheldType === "Permanent"
                          ? "error"
                          : "warning"
                      }
                      icon={<LockOpenIcon />}
                      sx={{ borderRadius: 2 }}
                    >
                      <Typography variant="subtitle2" fontWeight={700}>
                        {application?.withheldType === "Permanent"
                          ? "Permanent Record Release"
                          : canReleaseApprove
                            ? "Release Action"
                            : "Release Request"}
                      </Typography>
                      <Typography variant="body2">
                        {application?.withheldType === "Permanent"
                          ? "You are releasing a Permanent (Weedout) application. This is an exceptional action and will reinstate the applicant."
                          : canReleaseApprove
                            ? "This will remove the application from withheld status."
                            : "This will forward a release request to the next officer."}
                      </Typography>
                    </Alert>
                  )}

                  {!isReleaseMode &&
                    hasActiveRecord &&
                    application?.isWithheld === false && (
                      <Alert severity="info" sx={{ borderRadius: 2 }}>
                        <Typography variant="subtitle2" fontWeight={600}>
                          Re-withhold Application
                        </Typography>
                        <Typography variant="body2">
                          Application is currently not withheld. This will
                          re-withhold it.
                        </Typography>
                      </Alert>
                    )}

                  {isNewRecordMode && (
                    <Alert severity="info" sx={{ borderRadius: 2 }}>
                      <Typography variant="subtitle2" fontWeight={600}>
                        {isAlreadyWithheld
                          ? "New Release Cycle"
                          : "New Withhold Cycle"}
                      </Typography>
                      <Typography variant="body2">
                        {isAlreadyWithheld
                          ? "This will create a new cycle that releases the application. The previous withheld cycle remains in history."
                          : "This will create a new withhold cycle. The previous cycle remains in history."}
                      </Typography>
                    </Alert>
                  )}
                </Stack>
              </>
            )}
          </DialogContent>
          <DialogActions sx={{ p: 3, borderTop: "1px solid #E2E8F0" }}>
            <Button
              onClick={() => setConfirmDialogOpen(false)}
              disabled={confirmLoading}
              sx={{ textTransform: "none", color: "#64748B", px: 3 }}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmSave}
              variant="contained"
              autoFocus
              disabled={confirmLoading}
              startIcon={
                confirmLoading ? (
                  <CircularProgress size={20} color="inherit" />
                ) : null
              }
              sx={{
                textTransform: "none",
                bgcolor: isReleaseMode ? "#DC2626" : "#2562E9",
                "&:hover": { bgcolor: isReleaseMode ? "#B91C1C" : "#1D4ED8" },
                "&.Mui-disabled": {
                  bgcolor: isReleaseMode ? "#DC2626" : "#2562E9",
                  color: "#FFFFFF",
                  opacity: 0.7,
                },
                fontWeight: 700,
                px: 4,
              }}
            >
              {confirmLoading
                ? "Submitting..."
                : isReleaseMode && canReleaseApprove
                  ? "Confirm & Release"
                  : "Confirm & Submit"}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Box>
  );
}
