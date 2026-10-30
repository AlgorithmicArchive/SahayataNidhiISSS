import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { fetchCertificateDetails } from "../../assets/fetch";
import { Container } from "react-bootstrap";
import {
  Box,
  Button,
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
  CircularProgress,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Checkbox,
  Collapse,
  Card,
  CardContent,
  Divider,
  Chip,
  Avatar,
} from "@mui/material";
import {
  PictureAsPdf,
  AddCircleOutlineSharp,
  RemoveCircleOutlineSharp,
  CheckCircle,
  Cancel,
  Person,
} from "@mui/icons-material";
import { formatKey, runValidations } from "../../assets/formvalidations";
import { Controller, useForm } from "react-hook-form";
import CustomButton from "../../components/CustomButton";
import axiosInstance from "../../axiosConfig";
import BasicModal from "../../components/BasicModal";
import SectionSelectCheckboxes from "../../components/SectionSelectCheckboxes";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import CollapsibleActionHistory from "../../components/officer/CollapsibleActionHistory";
import CollapsibleFormDetails from "../../components/officer/CollapsibleFormDetails";
import { MaterialReactTable } from "material-react-table";
import UserDetailsBasicModal from "../../components/UserDetailsBasicModal";

// ✅ Base name for auto-numbered enclosure labels. The officer can freely edit
//    any of these in the UI, but if they don't, each file gets a unique name
//    like "Legacy Application Document 1", "... 2", etc.
const DEFAULT_LEGACY_ENCLOSURE_NAME = "Legacy Application Document";

// ✅ Find the next available number by inspecting the trailing digits of every
//    existing enclosure name. Prevents collisions when the officer removes one
//    and adds another.
const getNextEnclosureNumber = (entries) => {
  let max = 0;
  entries.forEach((e) => {
    const m = String(e.enclosureName || "").match(/(\d+)\s*$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (Number.isFinite(n) && n > max) max = n;
    }
  });
  return max + 1;
};

const buttonStyles = {
  backgroundColor: "#FFFFFF",
  color: "primary.main",
  textTransform: "none",
  fontSize: "24px",
  fontWeight: 700,
  padding: "8px 16px",
  border: "1px solid",
  borderColor: "primary.main",
  borderRadius: "8px",
  "&:hover": {
    backgroundColor: "#E3F2FD",
    borderColor: "#1565C0",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
  },
};

const commonStyles = {
  "& .MuiOutlinedInput-root": {
    borderColor: "#E0E0E0",
    "&:hover fieldset": { borderColor: "#1976D2" },
    "&.Mui-focused fieldset": { borderColor: "#1976D2", borderWidth: "2px" },
    backgroundColor: "#FAFAFA",
    borderRadius: "8px",
    fontSize: "14px",
  },
  "& .MuiInputLabel-root": {
    color: "#757575",
    "&.Mui-focused": { color: "#1976D2" },
  },
  marginBottom: "16px",
};

const submitButtonStyles = {
  backgroundColor: "#1976D2",
  color: "#FFFFFF",
  textTransform: "none",
  fontSize: "14px",
  fontWeight: 500,
  padding: "8px 16px",
  borderRadius: "8px",
  "&:hover": {
    backgroundColor: "#1565C0",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
  },
  "&:disabled": {
    backgroundColor: "#B0BEC5",
    color: "#FFFFFF",
  },
};

const checkDSCStatus = async () => {
  try {
    const response = await axiosInstance.get("/Officer/GetDSCStatus");
    return response.data;
  } catch (error) {
    console.error("Error checking DSC status:", error);
    return {
      status: false,
      reason: "Failed to connect to the server to verify DSC status.",
    };
  }
};

const PreviousOfficersDetails = ({
  previousOfficersDetails,
  open,
  setOpen,
}) => {
  const getStatusIcon = (status) => {
    if (status?.toLowerCase() === "approved") {
      return <CheckCircle sx={{ color: "#4caf50", mr: 1 }} />;
    } else if (status?.toLowerCase() === "rejected") {
      return <Cancel sx={{ color: "#f44336", mr: 1 }} />;
    } else if (status?.toLowerCase() === "pending") {
      return <Person sx={{ color: "#ff9800", mr: 1 }} />;
    }
    return <Person sx={{ color: "#757575", mr: 1 }} />;
  };

  const getStatusChip = (status) => {
    const statusLower = status?.toLowerCase();
    if (statusLower === "approved") {
      return <Chip label="Approved" color="success" size="small" />;
    } else if (statusLower === "rejected") {
      return <Chip label="Rejected" color="error" size="small" />;
    } else if (statusLower === "pending") {
      return <Chip label="Pending" color="warning" size="small" />;
    }
    return <Chip label={status || "Unknown"} size="small" />;
  };

  if (!previousOfficersDetails || previousOfficersDetails.length === 0) {
    return null;
  }

  return (
    <Box sx={{ width: "100%", mx: "auto", mb: 3 }}>
      <Box sx={{ display: "flex", justifyContent: "center", mb: 2 }}>
        <Tooltip
          title={
            open
              ? "Hide previous officers' details"
              : "Show previous officers' details"
          }
          arrow
        >
          <Button
            onClick={() => setOpen(!open)}
            sx={buttonStyles}
            endIcon={
              open ? <RemoveCircleOutlineSharp /> : <AddCircleOutlineSharp />
            }
            aria-expanded={open}
            aria-label={
              open
                ? "Hide previous officers' details"
                : "Show previous officers' details"
            }
          >
            {open
              ? "Hide Previous Officers' Actions"
              : "Show Previous Officers' Actions"}
          </Button>
        </Tooltip>
      </Box>
      <Collapse in={open} timeout={500}>
        <Box sx={{ width: "100%" }}>
          {previousOfficersDetails.map((officer, index) => (
            <Card
              key={index}
              sx={{
                mb: 2,
                borderRadius: "12px",
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
                "&:hover": {
                  boxShadow: "0 4px 16px rgba(0, 0, 0, 0.12)",
                },
              }}
            >
              <CardContent>
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    mb: 2,
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center" }}>
                    <Avatar
                      sx={{
                        bgcolor: "primary.main",
                        mr: 2,
                        width: 40,
                        height: 40,
                      }}
                    >
                      {officer.officerDesignation?.charAt(0) || "O"}
                    </Avatar>
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        {officer.officerDesignation || "Unknown Officer"}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {officer.officerArea || "Unknown Area"}
                      </Typography>
                    </Box>
                  </Box>
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-end",
                    }}
                  >
                    {getStatusChip(officer.status)}
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ mt: 1 }}
                    >
                      Step {officer.playerIndex + 1}
                    </Typography>
                  </Box>
                </Box>

                <Divider sx={{ my: 2 }} />

                {officer.remarks && (
                  <Box sx={{ mb: 2 }}>
                    <Typography
                      variant="subtitle2"
                      color="primary"
                      sx={{ fontWeight: 600, mb: 1 }}
                    >
                      Remarks
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        p: 1.5,
                        bgcolor: "background.default",
                        borderRadius: "6px",
                        borderLeft: "4px solid",
                        borderColor: "primary.main",
                      }}
                    >
                      {officer.remarks}
                    </Typography>
                  </Box>
                )}

                {(officer.recommendation || officer.recommendationRemarks) && (
                  <Box sx={{ mb: 2 }}>
                    <Typography
                      variant="subtitle2"
                      color="secondary"
                      sx={{ fontWeight: 600, mb: 1 }}
                    >
                      Recommendation
                    </Typography>
                    {officer.recommendation && (
                      <Typography
                        variant="body2"
                        sx={{
                          p: 1.5,
                          bgcolor: "#e8f5e9",
                          borderRadius: "6px",
                          mb: 1,
                        }}
                      >
                        <strong>Decision:</strong> {officer.recommendation}
                      </Typography>
                    )}
                    {officer.recommendationRemarks && (
                      <Typography
                        variant="body2"
                        sx={{
                          p: 1.5,
                          bgcolor: "background.default",
                          borderRadius: "6px",
                          fontStyle: "italic",
                        }}
                      >
                        {officer.recommendationRemarks}
                      </Typography>
                    )}
                  </Box>
                )}

                {officer.additionalDetails &&
                  Object.keys(officer.additionalDetails).length > 0 && (
                    <Box sx={{ mb: 2 }}>
                      <Typography
                        variant="subtitle2"
                        sx={{ fontWeight: 600, mb: 1, color: "text.primary" }}
                      >
                        Additional Details
                      </Typography>
                      {Object.entries(officer.additionalDetails).map(
                        ([key, value]) => {
                          if (!value || String(value).trim() === "")
                            return null;

                          const isDeclaration = key
                            .toLowerCase()
                            .includes("declaration");
                          const formattedKey = key
                            .replace(/([A-Z])/g, " $1")
                            .replace(/_/g, " ")
                            .trim()
                            .replace(/^./, (str) => str.toUpperCase());

                          return (
                            <Box key={key} sx={{ mb: 1.5 }}>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ display: "block", mb: 0.5 }}
                              >
                                {formattedKey}
                              </Typography>
                              <Typography
                                variant="body2"
                                sx={{
                                  p: 1.5,
                                  bgcolor: isDeclaration
                                    ? "#fff3e0"
                                    : "background.default",
                                  borderRadius: "6px",
                                  borderLeft: "3px solid",
                                  borderColor: isDeclaration
                                    ? "warning.main"
                                    : "grey.400",
                                  fontStyle: isDeclaration
                                    ? "italic"
                                    : "normal",
                                  whiteSpace: "pre-wrap",
                                }}
                              >
                                {String(value)}
                              </Typography>
                            </Box>
                          );
                        },
                      )}
                    </Box>
                  )}

                {officer.actionFormFields &&
                  officer.actionFormFields.length > 0 && (
                    <Box>
                      <Typography
                        variant="subtitle2"
                        sx={{ fontWeight: 600, mb: 1, color: "text.primary" }}
                      >
                        Action Form Fields
                      </Typography>
                      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                        {officer.actionFormFields.map((field, fieldIndex) =>
                          field.value && field.label ? (
                            <Chip
                              key={fieldIndex}
                              label={`${field.label}: ${field.value}`}
                              size="small"
                              variant="outlined"
                              sx={{
                                borderColor: "primary.light",
                                color: "text.primary",
                                fontSize: "0.75rem",
                              }}
                            />
                          ) : null,
                        )}
                      </Box>
                    </Box>
                  )}

                {officer.actionDate && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: "block", mt: 2, textAlign: "right" }}
                  >
                    Action taken on:{" "}
                    {new Date(officer.actionDate).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Typography>
                )}
              </CardContent>
            </Card>
          ))}
        </Box>
      </Collapse>
    </Box>
  );
};

const MaterialTable = ({ columns, data }) => {
  return (
    <MaterialReactTable
      columns={columns}
      data={data}
      enableColumnActions={false}
      enableColumnFilters={false}
      enablePagination={false}
      enableSorting={false}
      muiTablePaperProps={{
        sx: {
          borderRadius: "12px",
          background: "#ffffff",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
        },
      }}
      muiTableContainerProps={{
        sx: { maxHeight: "600px", background: "#ffffff" },
      }}
      muiTableHeadCellProps={{
        sx: {
          background: "#e6f0fa",
          color: "#1f2937",
          fontWeight: 600,
          fontSize: { xs: 12, md: 14 },
          borderBottom: "2px solid #b3cde0",
          borderRight: "1px solid #b3cde0",
          "&:last-child": { borderRight: "none" },
        },
      }}
      muiTableBodyRowProps={{
        sx: {
          "&:hover": {
            background: "#f8fafc",
            transition: "background-color 0.2s ease",
          },
        },
      }}
      muiTableBodyCellProps={{
        sx: {
          color: "#1f2937",
          background: "#ffffff",
          fontSize: { xs: 12, md: 14 },
          borderRight: "1px solid #b3cde0",
          borderBottom: "1px solid #b3cde0",
          "&:last-child": { borderRight: "none" },
        },
      }}
      renderEmptyRowsFallback={() => (
        <Box
          sx={{
            textAlign: "center",
            py: 4,
            color: "rgb(107, 114, 128)",
            fontSize: { xs: 14, md: 16 },
          }}
        >
          No corrigendum field changes available.
        </Box>
      )}
    />
  );
};

const CollapsibleCorrigendumTable = ({
  title,
  columns,
  data,
  open,
  setOpen,
  onViewPdf,
}) => {
  return (
    <Box sx={{ width: "100%", mx: "auto", mb: 3 }}>
      <Box sx={{ display: "flex", justifyContent: "center", mb: 2 }}>
        <Tooltip
          title={
            open
              ? `Collapse ${title.toLowerCase()}`
              : `Expand ${title.toLowerCase()}`
          }
          arrow
        >
          <Button
            onClick={() => setOpen(!open)}
            sx={buttonStyles}
            endIcon={
              open ? <RemoveCircleOutlineSharp /> : <AddCircleOutlineSharp />
            }
            aria-expanded={open}
            aria-label={open ? `Collapse ${title}` : `Expand ${title}`}
          >
            {open ? `Hide ${title}` : title}
          </Button>
        </Tooltip>
      </Box>
      <Collapse in={open} timeout={500}>
        <Box
          sx={{
            borderRadius: "12px",
            overflow: "hidden",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
          }}
        >
          <MaterialTable columns={columns} data={data} />
        </Box>
      </Collapse>
    </Box>
  );
};

const CollapsibleAttachments = ({
  title,
  files,
  corrigendumType,
  open,
  setOpen,
  onViewPdf,
}) => {
  return (
    <Box sx={{ width: "100%", mx: "auto", mb: 3 }}>
      <Box sx={{ display: "flex", justifyContent: "center", mb: 2 }}>
        <Tooltip
          title={
            open
              ? `Collapse ${title.toLowerCase()}`
              : `Expand ${title.toLowerCase()}`
          }
          arrow
        >
          <Button
            onClick={() => setOpen(!open)}
            sx={buttonStyles}
            endIcon={
              open ? <RemoveCircleOutlineSharp /> : <AddCircleOutlineSharp />
            }
            aria-expanded={open}
            aria-label={open ? `Collapse ${title}` : `Expand ${title}`}
          >
            {open ? `Hide ${title}` : title}
          </Button>
        </Tooltip>
      </Box>
      <Collapse in={open} timeout={500}>
        <Box
          sx={{
            borderRadius: "12px",
            overflow: "hidden",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
            p: 3,
            backgroundColor: "#ffffff",
          }}
        >
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
            {corrigendumType} Attachments
          </Typography>
          {files.length > 0 ? (
            <Box
              sx={{
                display: "flex",
                flexWrap: "wrap",
                gap: 2,
              }}
            >
              {files.map((item, index) => (
                <Button
                  key={index}
                  onClick={() => onViewPdf(item)}
                  variant="outlined"
                  color="primary"
                  startIcon={<PictureAsPdf />}
                  sx={{
                    textTransform: "none",
                    fontWeight: 500,
                    minWidth: 140,
                    border: "1px solid",
                    borderColor: "primary.main",
                    "&:hover": {
                      backgroundColor: "#E3F2FD",
                      borderColor: "#1565C0",
                    },
                  }}
                >
                  View PDF {index + 1}
                </Button>
              ))}
            </Box>
          ) : (
            <Typography
              sx={{
                textAlign: "center",
                color: "rgb(107, 114, 128)",
                py: 4,
                fontSize: { xs: 14, md: 16 },
              }}
            >
              No attachments available.
            </Typography>
          )}
        </Box>
      </Collapse>
    </Box>
  );
};

const processDeclaration = (
  declarationText,
  declarationFields,
  formDetails,
  applicationId,
) => {
  if (!declarationText) return "";

  let processedText = declarationText;

  const fieldsArray = Array.isArray(declarationFields) ? declarationFields : [];

  fieldsArray.forEach((field) => {
    if (!field || !field.name) return;

    const placeholder = `{${field.name}}`;
    let value = "";

    if (formDetails) {
      value = getValueByName(formDetails, field.name);
    }

    if (
      !value &&
      (field.name.toLowerCase().includes("referencenumber") ||
        field.name.toLowerCase().includes("reference") ||
        field.name.toLowerCase().includes("applicationno"))
    ) {
      value = applicationId || "";
    }

    if (!value && field.label) {
      value = `[${field.label}]`;
    } else if (!value) {
      value = `[${field.name}]`;
    }

    if (processedText.includes(placeholder)) {
      processedText = processedText.replace(
        new RegExp(placeholder, "g"),
        value,
      );
    }
  });

  return processedText;
};

const getValueByName = (data, name) => {
  if (!data || !name) return null;

  if (typeof data !== "object" || data === null) {
    return null;
  }

  if (Array.isArray(data)) {
    for (const field of data) {
      if (field && typeof field === "object" && field.name === name) {
        return (
          field.value || field.File || field.Enclosure || field.Photo || null
        );
      }
      if (
        field &&
        field.additionalFields &&
        typeof field.additionalFields === "object"
      ) {
        for (const additionalFieldArray of Object.values(
          field.additionalFields,
        )) {
          if (Array.isArray(additionalFieldArray)) {
            for (const subField of additionalFieldArray) {
              if (subField && subField.name === name) {
                return subField.value || null;
              }
            }
          }
        }
      }
    }
    return null;
  }

  for (const section of Object.values(data)) {
    if (Array.isArray(section)) {
      for (const field of section) {
        if (field && typeof field === "object" && field.name === name) {
          return (
            field.value || field.File || field.Enclosure || field.Photo || null
          );
        }
        if (
          field &&
          field.additionalFields &&
          typeof field.additionalFields === "object"
        ) {
          for (const additionalFieldArray of Object.values(
            field.additionalFields,
          )) {
            if (Array.isArray(additionalFieldArray)) {
              for (const subField of additionalFieldArray) {
                if (subField && subField.name === name) {
                  return subField.value || null;
                }
              }
            }
          }
        }
      }
    }
  }

  return null;
};

export default function UserDetails() {
  const location = useLocation();
  const navigate = useNavigate();
  const { applicationId, notaction } = location.state || {};

  const isLegacyApplication = (applicationId || "").startsWith("JK-SW-PNS");

  const [formDetails, setFormDetails] = useState({});
  const [actionForm, setActionForm] = useState([]);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [previousOfficersOpen, setPreviousOfficersOpen] = useState(false);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState("");
  const [pdfBlob, setPdfBlob] = useState(null);
  const [isSignedPdf, setIsSignedPdf] = useState(false);
  const [loading, setLoading] = useState(true);
  const [buttonLoading, setButtonLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [certificateDetails, setCertificateDetails] = useState(null);
  const [isSanctionLetter, setIsSanctionLetter] = useState(false);
  const [pendingFormData, setPendingFormData] = useState(null);
  const [hasPending, setHaspending] = useState(false);
  const [canTakeAction, setCanTakeAction] = useState(true);
  const [currentOfficerDetails, setCurrentOfficerDetails] = useState(null);
  const [lastActionTaken, setLastActionTaken] = useState(null);
  const [signingMethod, setSigningMethod] = useState("dsc");
  const [esignPageNo, setEsignPageNo] = useState(1);
  const [esignSignPosition, setEsignSignPosition] = useState("1");
  const [esignUserName, setEsignUserName] = useState("");
  const [pollInterval, setPollInterval] = useState(null);
  const [previousOfficer, setPreviousOfficer] = useState("");
  const [previousOfficersDetails, setPreviousOfficersDetails] = useState([]);
  const [corrigendumData, setCorrigendumData] = useState(null);
  const [corrigendumOpen, setCorrigendumOpen] = useState(false);
  const [attachmentsOpen, setAttachmentsOpen] = useState(false);
  const [dynamicDeclaration, setDynamicDeclaration] = useState(null);

  // ✅ Legacy document upload state — array of { id, file, enclosureName }
  const [legacyDocEntries, setLegacyDocEntries] = useState([]);
  const [legacyDocUploading, setLegacyDocUploading] = useState(false);

  const {
    control,
    handleSubmit,
    watch,
    getValues,
    setValue,
    formState: { errors },
    unregister,
  } = useForm({ mode: "onChange" });

  const watchedDefaultAction = watch("defaultAction");
  const watchedRecommendation = watch("Recommendation");

  const isForward = watchedDefaultAction === "Forward";
  const isRecommendedForSanction =
    watchedRecommendation === "Recommended for Sanction";

  // ✅ Derived from state — updates automatically when currentOfficerDetails
  //    is populated by the loadDetails effect.
  const isTSWO =
    currentOfficerDetails?.designation === "Tehsil Social Welfare Officer";

  useEffect(() => {
    console.log(
      "isSanctionLetter:",
      isSanctionLetter,
      "isSignedPdf:",
      isSignedPdf,
    );
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [pdfUrl, pollInterval, isSanctionLetter, isSignedPdf]);

  // Clear the upload entries when the officer leaves Forward or changes the
  // recommendation away from "Recommended for Sanction"
  useEffect(() => {
    if (!isForward || !isRecommendedForSanction) {
      setLegacyDocEntries([]);
    }
  }, [isForward, isRecommendedForSanction]);

  useEffect(() => {
    async function loadDetails() {
      setLoading(true);
      try {
        const response = await axiosInstance.get("/Officer/GetUserDetails", {
          params: { applicationId },
        });

        if (response.data.error) {
          toast.error(response.data.error, {
            position: "top-center",
            autoClose: 3000,
            theme: "colored",
          });
          return;
        }

        setFormDetails(response.data.list);
        setHaspending(response.data.hasPending);
        setPreviousOfficer(response.data.previousOfficer || "");
        setCanTakeAction(response.data.canTakeAction || false);

        setPreviousOfficersDetails(response.data.previousOfficersDetails || []);

        if (response.data.corrigendum) {
          setCorrigendumData(response.data.corrigendum);
        }

        if (response.data.currentOfficerDetails) {
          setCurrentOfficerDetails(response.data.currentOfficerDetails);
          const actionFormData = response.data.currentOfficerDetails.actionForm;
          if (actionFormData) {
            let processedActionForm = Array.isArray(actionFormData)
              ? actionFormData
              : [];

            const officerDesignation =
              response.data.currentOfficerDetails?.designation || "";

            const isTSWOLocal =
              officerDesignation === "Tehsil Social Welfare Officer";
            const isLegacy = isLegacyApplication;

            // ✅ Legacy applications: remove "Return to Citizen" from the
            //    defaultAction dropdown entirely.
            if (isLegacy) {
              processedActionForm = processedActionForm.map((field) => {
                if (field.name !== "defaultAction" || field.type !== "select") {
                  return field;
                }
                const filteredOptions = (field.options || []).filter(
                  (opt) =>
                    String(opt.value).toLowerCase() !== "returntocitizen" &&
                    String(opt.label).toLowerCase() !== "return to citizen",
                );
                return { ...field, options: filteredOptions };
              });
            }

            // ✅ TSWO + legacy: append "Reject" to the defaultAction dropdown
            if (isTSWOLocal && isLegacy) {
              processedActionForm = processedActionForm.map((field) => {
                if (field.name !== "defaultAction" || field.type !== "select") {
                  return field;
                }

                const existing = field.options || [];
                const alreadyHasReject = existing.some(
                  (opt) =>
                    String(opt.value).toLowerCase() === "reject" ||
                    String(opt.label).toLowerCase() === "reject",
                );

                if (alreadyHasReject) return field;

                return {
                  ...field,
                  options: [...existing, { value: "Reject", label: "Reject" }],
                };
              });
            }

            setActionForm(processedActionForm);

            const defaultActionField = actionFormData.find(
              (field) => field.name === "defaultAction",
            );

            if (defaultActionField?.additionalFields?.Forward) {
              const declarationField =
                defaultActionField.additionalFields.Forward.find(
                  (field) => field.isConsentCheckbox && field.isDeclaration,
                );
              if (declarationField) {
                setDynamicDeclaration({
                  declaration: declarationField.declaration,
                  declarationFields: declarationField.declarationFields,
                  fieldId: declarationField.id,
                });
              }
            }
          }
        }
      } catch (error) {
        console.error("Error fetching user details:", error);
        toast.error("Failed to load user details. Please try again.", {
          position: "top-center",
          autoClose: 3000,
          theme: "colored",
        });
      } finally {
        setLoading(false);
      }
    }
    if (applicationId) loadDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId]);

  const handleViewPdf = (url) => {
    setPdfUrl(url);
    setIsSignedPdf(false);
    setPdfModalOpen(true);
  };

  const handleGenerateUserDetailsPdf = async () => {
    setButtonLoading(true);
    try {
      const response = await axiosInstance.get(
        "/Officer/GenerateUserDetailsPdf",
        {
          params: { applicationId },
          responseType: "blob",
        },
      );

      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${applicationId}_UserDetails.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("PDF downloaded successfully!", {
        position: "top-center",
        autoClose: 3000,
        theme: "colored",
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Failed to generate PDF. Please try again.", {
        position: "top-center",
        autoClose: 3000,
        theme: "colored",
      });
    } finally {
      setButtonLoading(false);
    }
  };

  async function signPdf(pdfBlob, pin, serialNumber) {
    const formData = new FormData();
    formData.append("pdf", pdfBlob, "document.pdf");
    formData.append("pin", pin);
    if (serialNumber) {
      formData.append("serial_number", serialNumber);
    }
    formData.append(
      "original_path",
      applicationId.replace(/\//g, "_") + "SanctionLetter.pdf",
    );
    try {
      const response = await fetch("http://localhost:8000/sign", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Signing failed: ${errorText}`);
      }
      return await response.blob();
    } catch (error) {
      throw new Error(
        "Error signing PDF: " +
          error.message +
          " Check if Desktop App is started.",
      );
    }
  }

  // ✅ Validate one or more legacy PDFs. The enclosure name is auto-assigned
  //    with a running number (1, 2, 3, …) so the default name never collides.
  //    The officer can edit each name later.
  const handleLegacyFilesAdd = async (files) => {
    if (!files || files.length === 0) return;

    const validEntries = [];

    for (const file of files) {
      const ext = `.${file.name.split(".").pop().toLowerCase()}`;
      if (ext !== ".pdf") {
        toast.error(`"${file.name}" skipped — only PDF files are allowed.`, {
          position: "top-center",
          autoClose: 3000,
          theme: "colored",
        });
        continue;
      }

      try {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("fileType", "pdf");
        fd.append("legacyDocument", "true");

        const res = await axiosInstance.post("/Base/Validate", fd);

        if (!res.data?.isValid) {
          toast.error(
            `"${file.name}": ${res.data?.errorMessage || "Invalid file."}`,
            {
              position: "top-center",
              autoClose: 4000,
              theme: "colored",
            },
          );
          continue;
        }

        // Placeholder — the real numbered name is assigned in the setter below.
        validEntries.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          file,
          enclosureName: "",
        });
      } catch (err) {
        console.error("Legacy file validation failed:", err);
        toast.error(`"${file.name}": Could not validate the file.`, {
          position: "top-center",
          autoClose: 3000,
          theme: "colored",
        });
      }
    }

    if (validEntries.length === 0) return;

    setLegacyDocEntries((prev) => {
      const existing = new Set(
        prev.map((e) => `${e.file.name}__${e.file.size}`),
      );
      const merged = [...prev];
      let nextNum = getNextEnclosureNumber(prev);
      validEntries.forEach((e) => {
        const key = `${e.file.name}__${e.file.size}`;
        if (!existing.has(key)) {
          merged.push({
            ...e,
            enclosureName: `${DEFAULT_LEGACY_ENCLOSURE_NAME} ${nextNum}`,
          });
          nextNum += 1;
          existing.add(key);
        }
      });
      return merged;
    });
  };

  const updateLegacyEntryName = (id, newName) => {
    setLegacyDocEntries((prev) =>
      prev.map((entry) =>
        entry.id === id ? { ...entry, enclosureName: newName } : entry,
      ),
    );
  };

  const removeLegacyEntry = (id) => {
    setLegacyDocEntries((prev) => prev.filter((entry) => entry.id !== id));
  };

  const checkDesktopApp = async () => {
    try {
      const response = await fetch("http://localhost:8000/");
      if (!response.ok) {
        toast.error("Desktop application is not running.", {
          position: "top-center",
          autoClose: 3000,
          theme: "colored",
        });
        return false;
      }
      return true;
    } catch (error) {
      toast.error(
        "Please start the USB Token PDF Signer desktop application.",
        {
          position: "top-center",
          autoClose: 3000,
          theme: "colored",
        },
      );
      return false;
    }
  };

  const fetchCertificates = async (pin) => {
    const formData = new FormData();
    formData.append("pin", pin);
    const response = await fetch("http://localhost:8000/certificates", {
      method: "POST",
      body: formData,
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  };

  const handlePinSubmit = async () => {
    if (!pin) {
      toast.error("Please enter the USB token PIN.", {
        position: "top-center",
        autoClose: 3000,
        theme: "colored",
      });
      return;
    }

    setButtonLoading(true);
    try {
      const certificates = await fetchCertificates(pin);
      if (!certificates || certificates.length === 0) {
        throw new Error("No certificates found on the USB token.");
      }

      const selectedCertificate = certificates[0];

      const expiration = new Date(certificateDetails.expirationDate);
      const now = new Date();
      if (expiration < now) {
        toast.error("The registered certificate has expired.", {
          position: "top-center",
          autoClose: 3000,
          theme: "colored",
        });
        return;
      }

      const normalizeSerial = (v) =>
        String(v ?? "")
          .replace(/\s+/g, "")
          .replace(/-/g, "")
          .toUpperCase();

      const dbSerial = normalizeSerial(certificateDetails.serial_number);
      const tokenSerial = normalizeSerial(selectedCertificate.serial_number);
      const tokenHex = normalizeSerial(selectedCertificate.serial_number_hex);
      const tokenInt = String(selectedCertificate.serial_number_int ?? "");

      let isMatch = false;

      if (dbSerial === tokenSerial) {
        isMatch = true;
      }

      if (!isMatch && dbSerial === tokenHex) {
        isMatch = true;
      }

      if (!isMatch) {
        try {
          const dbAsInt = parseInt(dbSerial, 16);
          if (!isNaN(dbAsInt) && dbAsInt.toString() === tokenInt) {
            isMatch = true;
          }
        } catch (e) {}
      }

      if (!isMatch) {
        try {
          const dbAsDecimal = parseInt(dbSerial, 10);
          if (!isNaN(dbAsDecimal) && dbAsDecimal.toString() === tokenInt) {
            isMatch = true;
          }
        } catch (e) {}
      }

      if (!isMatch && dbSerial.length % 2 === 0 && dbSerial.length > 0) {
        try {
          let decoded = "";
          for (let i = 0; i < dbSerial.length; i += 2) {
            decoded += String.fromCharCode(parseInt(dbSerial.substr(i, 2), 16));
          }
          if (/^\d+$/.test(decoded) && decoded === tokenInt) {
            isMatch = true;
          }
        } catch (e) {}
      }

      if (!isMatch) {
        toast.error("Not the registered certificate.", {
          position: "top-center",
          autoClose: 3000,
          theme: "colored",
        });
        return;
      }

      const signedBlob = await signPdf(
        pdfBlob,
        pin,
        selectedCertificate.serial_number_hex,
      );

      const updateFormData = new FormData();
      updateFormData.append("signedPdf", signedBlob, "signed.pdf");
      updateFormData.append("applicationId", applicationId);
      const updateResponse = await axiosInstance.post(
        "/Officer/UpdatePdf",
        updateFormData,
      );

      if (!updateResponse.data.status) {
        throw new Error(
          "Failed to update PDF on server: " +
            (updateResponse.data.response || "Unknown error"),
        );
      }

      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      setPdfUrl(updateResponse.data.path);
      setPdfModalOpen(false);
      setTimeout(() => {
        setPdfBlob(null);
        setIsSignedPdf(true);
        setConfirmOpen(false);
        setPdfModalOpen(true);
      }, 100);

      if (pendingFormData) {
        await handleFinalSubmit(pendingFormData);
        setPendingFormData(null);
      }
    } catch (error) {
      console.error("Signing error:", error);
      toast.error("Error signing PDF: " + error.message, {
        position: "top-center",
        autoClose: 3000,
        theme: "colored",
      });
    } finally {
      setButtonLoading(false);
      setPin("");
    }
  };

  const handleSign = async () => {
    if (signingMethod === "dsc") {
      const isAppRunning = await checkDesktopApp();
      if (!isAppRunning) return;
      setConfirmOpen(true);
    } else if (signingMethod === "esign") {
      if (
        !esignUserName ||
        esignPageNo < 1 ||
        !["1", "2"].includes(esignSignPosition)
      ) {
        toast.error(
          "Please provide valid eSign details (Username, Page Number, Sign Position).",
          {
            position: "top-center",
            autoClose: 3000,
            theme: "colored",
          },
        );
        return;
      }

      setButtonLoading(true);
      let popup = null;
      try {
        const formData = new FormData();
        formData.append("applicationId", applicationId);
        formData.append("pdfBlob", pdfBlob, "sanction_letter.pdf");
        formData.append("userName", esignUserName);
        formData.append("signPosition", esignSignPosition);
        formData.append("pageNo", esignPageNo);

        const response = await axiosInstance.post(
          "/Officer/PrepareEsign",
          formData,
        );

        if (!response.data.status) {
          throw new Error(response.data.message || "Failed to prepare eSign");
        }

        const htmlEscape = (str) => {
          if (!str) return "";
          return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
        };

        const htmlEscapedXml = htmlEscape(response.data.signedXml);
        const escapedUrl = htmlEscape(response.data.clientrequestURL);
        const escapedUsername = htmlEscape(response.data.username);
        const escapedUserId = htmlEscape(response.data.userId);
        const escapedTxnId = htmlEscape(response.data.txnId);

        popup = window.open("", "eSignPopup", "width=800,height=600");
        if (!popup) {
          toast.error("Popup blocked. Please allow popups and try again.", {
            position: "top-center",
            autoClose: 3000,
            theme: "colored",
          });
          return;
        }

        popup.document.open();
        popup.document.write(`
                <!DOCTYPE html>
                <html>
                    <head>
                        <title>eSign Gateway</title>
                    </head>
                    <body>
                        <form id="esignForm" name="esignForm" action="https://esigngw.jk.gov.in/eSign21/acceptClient" method="post" enctype="multipart/form-data">
                            <input type="hidden" name="xml" value="${htmlEscapedXml}" />
                            <input type="hidden" name="clientrequestURL" value="${escapedUrl}" />
                            <input type="hidden" name="username" value="${escapedUsername}" />
                            <input type="hidden" name="userId" value="${escapedUserId}" />
                            <input type="hidden" name="txn" value="${escapedTxnId}" />
                        </form>
                        <script>
                            document.getElementById('esignForm').submit();
                        </script>
                    </body>
                </html>
            `);
        popup.document.close();

        const interval = setInterval(async () => {
          try {
            const statusRes = await axiosInstance.get(
              `/Officer/CheckESignStatus?applicationId=${applicationId}`,
            );
            if (statusRes.data.success) {
              clearInterval(interval);
              setPollInterval(null);
              setPdfUrl(statusRes.data.path);
              setIsSignedPdf(true);
              setPdfModalOpen(true);
              if (popup && !popup.closed) {
                popup.close();
              }
              if (pendingFormData) {
                await handleFinalSubmit(pendingFormData);
                setPendingFormData(null);
              }
              toast.success("eSign completed successfully!", {
                position: "top-center",
                autoClose: 3000,
                theme: "colored",
              });
            }
          } catch (err) {
            console.error("Polling error:", err);
            clearInterval(interval);
            setPollInterval(null);
            if (popup && !popup.closed) {
              popup.close();
            }
            toast.error("Error checking eSign status: " + err.message, {
              position: "top-center",
              autoClose: 3000,
              theme: "colored",
            });
          }
        }, 5000);
        setPollInterval(interval);

        setTimeout(() => {
          if (pollInterval) {
            clearInterval(pollInterval);
            setPollInterval(null);
            if (popup && !popup.closed) {
              popup.close();
            }
            toast.error("eSign process timed out. Please try again.", {
              position: "top-center",
              autoClose: 3000,
              theme: "colored",
            });
          }
        }, 900000);
      } catch (error) {
        console.error("eSign preparation error:", error);
        if (popup && !popup.closed) {
          popup.close();
        }
        toast.error("eSign preparation error: " + error.message, {
          position: "top-center",
          autoClose: 3000,
          theme: "colored",
        });
      } finally {
        setButtonLoading(false);
      }
    }
  };

  const sanctionAction = async () => {
    try {
      const response = await axiosInstance.get("/Officer/GetSanctionLetter", {
        params: { applicationId },
      });
      const result = response.data;
      if (!result.status) {
        throw new Error(result.response || "Something went wrong");
      }
      const pdfResponse = await axiosInstance.get(`/Base/DisplayFile`, {
        params: { filename: result.path },
        responseType: "blob",
      });
      const newPdfBlob = new Blob([pdfResponse.data], {
        type: "application/pdf",
      });

      setPdfBlob(newPdfBlob);
      setPdfUrl(result.path);
      setIsSignedPdf(false);
      setIsSanctionLetter(true);
      setPdfModalOpen(true);
    } catch (error) {
      console.error("Sanction action error:", error);
      toast.error("Error fetching sanction letter: " + error.message, {
        position: "top-center",
        autoClose: 3000,
        theme: "colored",
      });
    }
  };

  const handleFinalSubmit = async (data) => {
    const formData = new FormData();
    formData.append("applicationId", applicationId);

    const defaultAction = data.defaultAction || "";
    formData.append("defaultAction", defaultAction);

    const remarks = data.Remarks || data.remarks || "";
    formData.append("remarks", remarks);

    const additionalDetails = {};

    for (const [key, value] of Object.entries(data)) {
      if (key === "defaultAction" || key === "Remarks" || key === "remarks")
        continue;

      if (value == null) {
        additionalDetails[key] = "";
        continue;
      }

      let cleanedValue = value;

      if (value instanceof File) {
        formData.append(key, value);
        cleanedValue = value.name || "";
      } else if (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
      ) {
        cleanedValue = { ...value };
        ["file", "File", "Enclosure", "Photo"].forEach((fileProp) => {
          if (
            cleanedValue[fileProp] &&
            cleanedValue[fileProp] instanceof File
          ) {
            formData.append(key, cleanedValue[fileProp]);
            cleanedValue[fileProp] = cleanedValue[fileProp].name || "";
          }
        });
      } else if (Array.isArray(value)) {
        cleanedValue = value;
      } else {
        cleanedValue = value;
      }

      additionalDetails[key] = cleanedValue;
    }

    if (additionalDetails.Remarks) {
      delete additionalDetails.Remarks;
    }
    if (additionalDetails.remarks) {
      delete additionalDetails.remarks;
    }

    formData.append("additionalDetails", JSON.stringify(additionalDetails));

    // ✅ Legacy officer documents — required when Forward + Recommended for
    //    Sanction on a legacy app by a TSWO officer.
    const isForwardAction =
      String(data.defaultAction || "").toLowerCase() === "forward";
    const recommendation = data.Recommendation || data.recommendation || "";
    const isRecommendedForSanctionLocal =
      recommendation === "Recommended for Sanction";

    const needsLegacyDocs =
      isForwardAction &&
      isLegacyApplication &&
      isTSWO &&
      isRecommendedForSanctionLocal;

    if (needsLegacyDocs) {
      if (legacyDocEntries.length === 0) {
        toast.error(
          "Please upload at least one PDF as a Legacy Application Document.",
          {
            position: "top-center",
            autoClose: 4000,
            theme: "colored",
          },
        );
        setButtonLoading(false);
        return;
      }

      const hasEmptyName = legacyDocEntries.some(
        (entry) => !entry.enclosureName?.trim(),
      );
      if (hasEmptyName) {
        toast.error("Every uploaded PDF must have an enclosure name.", {
          position: "top-center",
          autoClose: 4000,
          theme: "colored",
        });
        setButtonLoading(false);
        return;
      }

      // ✅ Guard against duplicates — two files with the same enclosure name
      //    would collide on the backend.
      const nameSet = new Set();
      const hasDuplicates = legacyDocEntries.some((entry) => {
        const key = entry.enclosureName.trim().toLowerCase();
        if (nameSet.has(key)) return true;
        nameSet.add(key);
        return false;
      });
      if (hasDuplicates) {
        toast.error("Each uploaded PDF must have a unique enclosure name.", {
          position: "top-center",
          autoClose: 4000,
          theme: "colored",
        });
        setButtonLoading(false);
        return;
      }

      legacyDocEntries.forEach((entry, idx) => {
        formData.append(`legacyDocument_${idx}`, entry.file);
        formData.append(
          `legacyDocumentName_${idx}`,
          entry.enclosureName.trim(),
        );
      });
    }

    console.log("FORM DATA TO CHECK DOCUMENTS", formData);

    try {
      const { data: result } = await axiosInstance.post(
        "/Officer/HandleAction",
        formData,
      );

      if (!result.status) {
        throw new Error(result.response || "Something went wrong");
      }

      setCanTakeAction(false);

      const actionField = actionForm.find(
        (field) => field.name === "defaultAction",
      );
      const actionLabel =
        actionField?.options.find((option) => option.value === defaultAction)
          ?.label || defaultAction;

      setLastActionTaken(actionLabel);

      toast.success("Action completed successfully! Redirecting...", {
        position: "top-center",
        autoClose: 2000,
        theme: "colored",
      });

      setTimeout(() => {
        navigate(-1);
      }, 4000);
    } catch (error) {
      console.error("Submission error:", error);
      toast.error("Error processing request: " + error.message, {
        position: "top-center",
        autoClose: 3000,
        theme: "colored",
      });
    } finally {
      setButtonLoading(false);
    }
  };

  const onSubmit = async (data) => {
    const defaultAction = data.defaultAction?.toLowerCase();
    setButtonLoading(true);

    if (defaultAction === "sanction") {
      const dscCheck = await checkDSCStatus();

      if (!dscCheck.status) {
        toast.error(
          `Cannot proceed with Sanction: ${dscCheck.reason || "Your DSC is not valid or pending."}`,
          {
            position: "top-center",
            autoClose: 6000,
            theme: "colored",
          },
        );
        setButtonLoading(false);
        return;
      }

      const certDetails = await fetchCertificateDetails();
      if (!certDetails) {
        toast.error(
          "You have not registered a DSC, so you can't sanction this application.",
          {
            position: "top-center",
            autoClose: 3000,
            theme: "colored",
          },
        );
        setButtonLoading(false);
        return;
      }

      setCertificateDetails(certDetails);
      setPendingFormData(data);
      await sanctionAction();
      setButtonLoading(false);
      return;
    }

    await handleFinalSubmit(data);
  };

  const handleModalClose = () => {
    setPdfModalOpen(false);
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setPdfUrl("");
    setPdfBlob(null);
    setIsSignedPdf(false);
    setIsSanctionLetter(false);
    setEsignUserName("");
    setEsignPageNo(1);
    setEsignSignPosition("1");
    if (pollInterval) clearInterval(pollInterval);
    setPollInterval(null);
  };

  const renderField = (field, sectionIndex) => {
    switch (field.type) {
      case "text":
      case "email":
      case "date":
      case "number":
        return (
          <Controller
            key={field.name}
            name={field.name}
            control={control}
            defaultValue=""
            rules={{
              required: field.required ? `${field.label} is required` : false,
              validate: async (value) =>
                await runValidations(field, value, getValues()),
            }}
            render={({ field: { onChange, value, ref } }) => (
              <TextField
                type={field.type}
                id={field.id}
                label={field.label}
                value={value || ""}
                onChange={onChange}
                inputRef={ref}
                error={Boolean(errors[field.name])}
                helperText={errors[field.name]?.message}
                fullWidth
                margin="normal"
                inputProps={{
                  maxLength: field.validationFunctions?.includes(
                    "specificLength",
                  )
                    ? field.maxLength
                    : undefined,
                }}
                sx={commonStyles}
                aria-describedby={`field-${field.id}-error`}
              />
            )}
          />
        );
      case "file":
        return (
          <Controller
            key={field.name}
            name={field.name}
            control={control}
            defaultValue={null}
            rules={{
              required: field.required ? `${field.label} is required` : false,
              validate: async (value) => await runValidations(field, value),
            }}
            render={({ field: { onChange, ref } }) => (
              <FormControl
                fullWidth
                margin="normal"
                error={Boolean(errors[field.name])}
                sx={commonStyles}
              >
                <Tooltip title={`Upload ${field.label}`} arrow>
                  <Button
                    variant="contained"
                    component="label"
                    sx={submitButtonStyles}
                    aria-label={`Upload ${field.label}`}
                  >
                    {field.label}
                    <input
                      type="file"
                      hidden
                      onChange={(e) => onChange(e.target.files[0])}
                      ref={ref}
                      accept={field.accept || "*/*"}
                    />
                  </Button>
                </Tooltip>
                <FormHelperText sx={{ color: "error.main" }}>
                  {errors[field.name]?.message}
                </FormHelperText>
              </FormControl>
            )}
          />
        );
      case "select":
        return (
          <Controller
            key={field.name}
            name={field.name}
            control={control}
            defaultValue="Please Select"
            rules={{
              validate: async (value) => {
                if (field.required && value === "Please Select") {
                  return "Please select a valid option.";
                }
                return await runValidations(field, value, getValues());
              },
            }}
            render={({ field: { onChange, value, ref } }) => {
              let options =
                field.optionsType === "dependent" && field.dependentOn
                  ? field.dependentOptions?.[watch(field.dependentOn)] || []
                  : field.options || [];
              const selectOptions = [
                { value: "Please Select", label: "Please Select" },
                ...options,
              ];
              return (
                <>
                  <FormControl
                    fullWidth
                    margin="normal"
                    error={Boolean(errors[field.name])}
                    sx={commonStyles}
                  >
                    <InputLabel id={`${field.id}-label`}>
                      {field.label}
                    </InputLabel>
                    <Select
                      labelId={`${field.id}-label`}
                      id={field.id}
                      value={value || "Please Select"}
                      label={field.label}
                      onChange={(e) => {
                        onChange(e);
                        if (field.additionalFields) {
                          Object.keys(field.additionalFields).forEach((key) => {
                            if (key !== e.target.value) {
                              field.additionalFields[key].forEach(
                                (additionalField) => {
                                  const nestedFieldName =
                                    additionalField.name ||
                                    `${field.name}_${additionalField.id}`;
                                  unregister(nestedFieldName, {
                                    keepValue: false,
                                  });
                                },
                              );
                            }
                          });
                        }
                      }}
                      inputRef={ref}
                      sx={{ color: "#212121" }}
                      aria-describedby={`field-${field.id}-error`}
                    >
                      {selectOptions.map((option) => (
                        <MenuItem
                          key={`${field.name}-${option.value}`}
                          value={option.value}
                        >
                          {option.label}
                        </MenuItem>
                      ))}
                    </Select>
                    <FormHelperText sx={{ color: "error.main" }}>
                      {errors[field.name]?.message}
                    </FormHelperText>
                  </FormControl>
                  {field.additionalFields && field.additionalFields[value] && (
                    <Box sx={{ mt: 2 }}>
                      {field.additionalFields[value].map((additionalField) => {
                        const additionalFieldName =
                          additionalField.name ||
                          `${field.name}_${additionalField.id}`;

                        if (
                          additionalField.type === "checkbox" &&
                          additionalField.isDeclaration
                        ) {
                          const declarationText = getDeclarationText();
                          return (
                            <Controller
                              key={additionalField.id}
                              name={additionalFieldName}
                              control={control}
                              defaultValue=""
                              rules={{
                                validate: (value) => {
                                  if (!value) {
                                    return "You must confirm the declaration to proceed.";
                                  }
                                  return true;
                                },
                              }}
                              render={({ field: { onChange, value } }) => (
                                <FormControl
                                  fullWidth
                                  margin="normal"
                                  error={Boolean(errors[additionalFieldName])}
                                  sx={commonStyles}
                                >
                                  <FormControlLabel
                                    control={
                                      <Checkbox
                                        checked={value === declarationText}
                                        onChange={(e) => {
                                          onChange(
                                            e.target.checked
                                              ? declarationText
                                              : "",
                                          );
                                        }}
                                        color="primary"
                                      />
                                    }
                                    label={
                                      <Typography variant="body2">
                                        {declarationText}
                                      </Typography>
                                    }
                                  />
                                  <FormHelperText sx={{ color: "error.main" }}>
                                    {errors[additionalFieldName]?.message}
                                  </FormHelperText>
                                </FormControl>
                              )}
                            />
                          );
                        }

                        return (
                          <Box key={additionalField.id} sx={{ mb: 2 }}>
                            <InputLabel
                              htmlFor={additionalField.id}
                              sx={{ color: "#757575", mb: 1 }}
                            >
                              {additionalField.label}
                            </InputLabel>
                            {renderField(
                              { ...additionalField, name: additionalFieldName },
                              sectionIndex,
                            )}
                          </Box>
                        );
                      })}
                    </Box>
                  )}
                </>
              );
            }}
          />
        );
      case "enclosure":
        return (
          <Controller
            key={field.name}
            name={field.name}
            control={control}
            defaultValue={{
              selected: field.options[0]?.value || "",
              file: null,
            }}
            rules={{
              validate: async (value) =>
                await runValidations(field, value, getValues()),
            }}
            render={({ field: { onChange, value, ref } }) => (
              <Box sx={{ mb: 2 }}>
                <FormControl
                  fullWidth
                  margin="normal"
                  error={Boolean(errors[field.name]?.selected)}
                  sx={commonStyles}
                >
                  <InputLabel id={`${field.id}_select-label`}>
                    {field.label}
                  </InputLabel>
                  <Select
                    labelId={`${field.id}_select-label`}
                    id={`${field.id}_select`}
                    value={value?.selected || ""}
                    label={field.label}
                    onChange={(e) =>
                      onChange({ ...value, selected: e.target.value })
                    }
                    inputRef={ref}
                    sx={{ color: "#212121" }}
                    aria-describedby={`field-${field.id}-error`}
                  >
                    {field.options.map((option) => (
                      <MenuItem
                        key={`${field.name}-${option.value}`}
                        value={option.value}
                      >
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                  <FormHelperText sx={{ color: "error.main" }}>
                    {errors[field.name]?.selected?.message}
                  </FormHelperText>
                </FormControl>
                <FormControl
                  fullWidth
                  margin="normal"
                  error={Boolean(errors[field.name]?.file)}
                  sx={commonStyles}
                >
                  <Tooltip title="Upload enclosure file" arrow>
                    <Button
                      variant="contained"
                      component="label"
                      sx={{ ...submitButtonStyles, mt: 2 }}
                      disabled={!value?.selected}
                      aria-label={`Upload ${field.label} file`}
                    >
                      Upload File
                      <input
                        type="file"
                        hidden
                        onChange={(e) =>
                          onChange({ ...value, file: e.target.files[0] })
                        }
                        accept={field.accept || "*/*"}
                      />
                    </Button>
                  </Tooltip>
                  <FormHelperText sx={{ color: "error.main" }}>
                    {errors[field.name]?.file?.message}
                  </FormHelperText>
                </FormControl>
              </Box>
            )}
          />
        );
      case "textarea":
        return (
          <Controller
            key={field.name}
            name={field.name}
            control={control}
            defaultValue=""
            rules={{
              required: field.required ? `${field.label} is required` : false,
              validate: async (value) =>
                await runValidations(field, value, getValues()),
            }}
            render={({ field: { onChange, value, ref } }) => (
              <TextField
                id={field.id}
                label={field.label}
                value={value || ""}
                onChange={onChange}
                inputRef={ref}
                error={Boolean(errors[field.name])}
                helperText={errors[field.name]?.message}
                fullWidth
                margin="normal"
                multiline
                rows={field.rows || 4}
                sx={commonStyles}
                aria-describedby={`field-${field.id}-error`}
              />
            )}
          />
        );
      default:
        console.warn(`Unsupported field type: ${field.type}`, field);
        return null;
    }
  };

  const getDeclarationText = () => {
    try {
      if (dynamicDeclaration) {
        return processDeclaration(
          dynamicDeclaration.declaration,
          dynamicDeclaration.declarationFields,
          formDetails,
          applicationId,
        );
      }
    } catch (error) {
      console.error("Error processing declaration:", error);
      return "Error loading declaration. Please refresh the page.";
    }
  };

  if (loading) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
          backgroundColor: "#F5F5F5",
        }}
      >
        <CircularProgress color="primary" aria-label="Loading user details" />
      </Box>
    );
  }

  return (
    <Container
      style={{
        maxWidth: "80%",
        padding: "0",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        paddingTop: "24px",
        paddingBottom: "24px",
      }}
    >
      <Box
        sx={{
          width: "100%",
          maxWidth: "100%",
          bgcolor: "#FFFFFF",
          borderRadius: "12px",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
          p: 4,
          transition: "transform 0.3s ease-in-out",
          "&:hover": {
            transform: "translateY(-4px)",
          },
        }}
        role="main"
        aria-labelledby="user-details-title"
      >
        <CollapsibleFormDetails
          formDetails={formDetails}
          formatKey={formatKey}
          detailsOpen={detailsOpen}
          setDetailsOpen={setDetailsOpen}
          onViewPdf={handleViewPdf}
          applicationId={applicationId}
        />

        <CollapsibleActionHistory
          detailsOpen={historyOpen}
          setDetailsOpen={setHistoryOpen}
          applicationId={applicationId}
        />

        <PreviousOfficersDetails
          previousOfficersDetails={previousOfficersDetails}
          open={previousOfficersOpen}
          setOpen={setPreviousOfficersOpen}
        />

        {corrigendumData &&
          corrigendumData.fieldChanges &&
          corrigendumData.fieldChanges.length > 0 && (
            <CollapsibleCorrigendumTable
              title={`Application details Updated`}
              columns={[
                { accessorKey: "sno", header: "S.No." },
                { accessorKey: "formField", header: "Description" },
                { accessorKey: "oldvalue", header: "As Existing" },
                {
                  accessorKey: "newvalue",
                  header:
                    corrigendumData.corrigendumType === "Amendment"
                      ? "As Updated"
                      : "As Corrected",
                },
              ]}
              data={corrigendumData.fieldChanges}
              open={corrigendumOpen}
              setOpen={setCorrigendumOpen}
              onViewPdf={handleViewPdf}
            />
          )}

        {corrigendumData &&
          corrigendumData.files &&
          corrigendumData.fieldChanges.length > 0 &&
          corrigendumData.files.length > 0 && (
            <CollapsibleAttachments
              title={`Application Details Updated Attachments`}
              files={corrigendumData.files}
              corrigendumType={corrigendumData.corrigendumType}
              open={attachmentsOpen}
              setOpen={setAttachmentsOpen}
              onViewPdf={handleViewPdf}
            />
          )}

        <Box sx={{ display: "flex", justifyContent: "center", my: 4 }}>
          <CustomButton
            text="Generate User Details PDF"
            sx={{ ...submitButtonStyles, width: { xs: "100%", sm: "auto" } }}
            disabled={buttonLoading}
            startIcon={
              buttonLoading && <CircularProgress size={20} color="inherit" />
            }
            onClick={handleGenerateUserDetailsPdf}
            aria-label="Generate user details PDF"
          />
        </Box>

        {canTakeAction ? (
          <>
            {!notaction && !hasPending && (
              <>
                <Typography
                  variant="h5"
                  sx={{
                    fontWeight: 600,
                    color: "primary.main",
                    textAlign: "center",
                    mt: detailsOpen ? 6 : 4,
                    mb: 4,
                  }}
                >
                  Action Form
                </Typography>

                <Box
                  sx={{
                    bgcolor: "background.paper",
                    borderRadius: "12px",
                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
                    p: 3,
                    maxWidth: "600px",
                    mx: "auto",
                  }}
                >
                  <form onSubmit={handleSubmit(onSubmit)} autoComplete="off">
                    {actionForm.length > 0 ? (
                      actionForm.map((field, index) => {
                        const selectedValue =
                          field.type === "select" ? watch(field.name) : null;
                        return (
                          <Box key={index} sx={{ mb: 2 }}>
                            {renderField(field, index)}

                            {field.type === "select" &&
                              field.name === "defaultAction" &&
                              selectedValue === "ReturnToCitizen" && (
                                <Controller
                                  name="returnFields"
                                  control={control}
                                  defaultValue={[]}
                                  rules={{
                                    validate: (value) =>
                                      value.length > 0 ||
                                      "Select at least one user detail field.",
                                  }}
                                  render={({ field: { onChange, value } }) => (
                                    <Box
                                      sx={{
                                        border: "1px solid #E0E0E0",
                                        borderRadius: "8px",
                                        maxHeight: "200px",
                                        overflowY: "auto",
                                        p: 2,
                                        mt: 2,
                                      }}
                                    >
                                      <Typography
                                        variant="subtitle2"
                                        sx={{ color: "#757575", mb: 1 }}
                                      >
                                        Select Fields to Return
                                      </Typography>
                                      <SectionSelectCheckboxes
                                        formDetails={formDetails}
                                        control={control}
                                        name="returnFields"
                                        value={value}
                                        onChange={onChange}
                                        formatKey={formatKey}
                                      />
                                      {errors.returnFields && (
                                        <FormHelperText
                                          sx={{ color: "error.main" }}
                                        >
                                          {errors.returnFields.message}
                                        </FormHelperText>
                                      )}
                                    </Box>
                                  )}
                                />
                              )}

                            {/* ✅ Legacy multi-document upload — shown only when
                                Action = Forward AND Recommendation = "Recommended
                                for Sanction" AND app is legacy AND officer is TSWO.
                                At least one PDF is required and each file carries
                                its own officer-editable enclosure name. */}
                            {field.name === "defaultAction" &&
                              isForward &&
                              isRecommendedForSanction &&
                              isLegacyApplication &&
                              isTSWO && (
                                <Box
                                  sx={{
                                    mt: 3,
                                    p: 2,
                                    border: "1px dashed #1976D2",
                                    borderRadius: "8px",
                                    bgcolor: "#F3F8FF",
                                  }}
                                >
                                  <Typography
                                    variant="subtitle1"
                                    sx={{
                                      fontWeight: 600,
                                      color: "primary.main",
                                      mb: 2,
                                    }}
                                  >
                                    Add Citizen Documents{" "}
                                    <span style={{ color: "#B3261E" }}>*</span>
                                  </Typography>

                                  <FormControl
                                    fullWidth
                                    margin="normal"
                                    sx={commonStyles}
                                    disabled={legacyDocUploading}
                                  >
                                    <Button
                                      variant="contained"
                                      component="label"
                                      sx={submitButtonStyles}
                                      disabled={legacyDocUploading}
                                    >
                                      Add Document
                                      <input
                                        type="file"
                                        hidden
                                        accept=".pdf"
                                        multiple
                                        onChange={(e) => {
                                          const files = Array.from(
                                            e.target.files || [],
                                          );
                                          handleLegacyFilesAdd(files);
                                          e.target.value = "";
                                        }}
                                      />
                                    </Button>
                                  </FormControl>

                                  {legacyDocEntries.length === 0 ? (
                                    <Typography
                                      sx={{
                                        fontSize: "0.85rem",
                                        color: "#B3261E",
                                        mt: 1,
                                      }}
                                    >
                                      At least one PDF must be uploaded.
                                    </Typography>
                                  ) : (
                                    <Box sx={{ mt: 1 }}>
                                      {legacyDocEntries.map((entry) => {
                                        const isNameEmpty =
                                          !entry.enclosureName?.trim();
                                        return (
                                          <Box
                                            key={entry.id}
                                            sx={{
                                              bgcolor: "#FFFFFF",
                                              border: "1px solid #E0E0E0",
                                              borderRadius: "8px",
                                              p: 1.5,
                                              mb: 1,
                                            }}
                                          >
                                            <Box
                                              sx={{
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "space-between",
                                                mb: 1,
                                              }}
                                            >
                                              <Typography
                                                variant="body2"
                                                sx={{
                                                  overflow: "hidden",
                                                  textOverflow: "ellipsis",
                                                  whiteSpace: "nowrap",
                                                  maxWidth: "75%",
                                                }}
                                              >
                                                📄 {entry.file.name}
                                              </Typography>
                                              <Button
                                                size="small"
                                                onClick={() =>
                                                  removeLegacyEntry(entry.id)
                                                }
                                                sx={{
                                                  minWidth: 0,
                                                  color: "#B3261E",
                                                  textTransform: "none",
                                                }}
                                                disabled={legacyDocUploading}
                                              >
                                                Remove
                                              </Button>
                                            </Box>

                                            <TextField
                                              label="Enclosure Name"
                                              value={entry.enclosureName}
                                              onChange={(e) =>
                                                updateLegacyEntryName(
                                                  entry.id,
                                                  e.target.value,
                                                )
                                              }
                                              fullWidth
                                              size="small"
                                              margin="normal"
                                              sx={commonStyles}
                                              disabled={legacyDocUploading}
                                              required
                                              error={isNameEmpty}
                                              helperText={
                                                isNameEmpty
                                                  ? "Enclosure name is required"
                                                  : ""
                                              }
                                            />
                                          </Box>
                                        );
                                      })}
                                    </Box>
                                  )}

                                  <Typography
                                    sx={{
                                      fontSize: "0.8rem",
                                      color: "#4A5568",
                                      mt: 1,
                                    }}
                                  >
                                    Accepted type: <strong>.pdf</strong> (up to
                                    1 MB each).
                                  </Typography>
                                </Box>
                              )}
                          </Box>
                        );
                      })
                    ) : (
                      <Typography
                        sx={{ textAlign: "center", color: "#B0BEC5", py: 4 }}
                      >
                        No action form fields available.
                      </Typography>
                    )}
                    <Box sx={{ display: "flex", justifyContent: "center" }}>
                      <CustomButton
                        text="Take Action"
                        sx={{ ...submitButtonStyles, width: "100%", mt: 3 }}
                        disabled={buttonLoading}
                        startIcon={
                          buttonLoading && (
                            <CircularProgress size={20} color="inherit" />
                          )
                        }
                        type="submit"
                        aria-label="Submit action form"
                      />
                    </Box>
                  </form>
                </Box>
              </>
            )}
            {(notaction || hasPending) && (
              <Typography
                sx={{ textAlign: "center", color: "#e23535ff", py: 4 }}
              >
                You cannot take action right now.{" "}
                {hasPending &&
                  "Current application is under correction process."}
              </Typography>
            )}
          </>
        ) : (
          <Typography variant="subtitle1" color="success" textAlign="center">
            {lastActionTaken
              ? `Application ${lastActionTaken}`
              : "Action Taken Successfully."}
          </Typography>
        )}

        <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
          <DialogTitle>Enter USB Token PIN</DialogTitle>
          <DialogContent>
            <Typography>
              Please enter the PIN for your USB token to sign the document.
            </Typography>
            <TextField
              type="password"
              label="USB Token PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              fullWidth
              margin="normal"
              sx={commonStyles}
              aria-label="USB Token PIN"
              inputProps={{ "aria-describedby": "pin-helper-text" }}
            />
            <FormHelperText id="pin-helper-text">
              Required to sign the document.
            </FormHelperText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConfirmOpen(false)} aria-label="Cancel">
              Cancel
            </Button>
            <Button
              onClick={handlePinSubmit}
              color="primary"
              disabled={buttonLoading || !pin}
              aria-label="Submit PIN"
            >
              Submit
            </Button>
          </DialogActions>
        </Dialog>

        <UserDetailsBasicModal
          open={pdfModalOpen}
          handleClose={handleModalClose}
          handleActionButton={
            isSanctionLetter && !isSignedPdf ? handleSign : null
          }
          buttonText={isSanctionLetter && !isSignedPdf ? "Sign PDF" : null}
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
          additionalContent={
            isSanctionLetter && !isSignedPdf ? (
              <Box sx={{ mt: 2, mb: 2 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Select Signing Method
                </Typography>
                <FormControl fullWidth margin="normal" sx={commonStyles}>
                  <InputLabel id="signing-method-label">
                    Signing Method
                  </InputLabel>
                  <Select
                    labelId="signing-method-label"
                    value={signingMethod}
                    label="Signing Method"
                    onChange={(e) => setSigningMethod(e.target.value)}
                  >
                    <MenuItem value="dsc">DSC (USB Token)</MenuItem>
                  </Select>
                </FormControl>
                {signingMethod === "esign" && (
                  <>
                    <TextField
                      label="User Name for eSign"
                      value={esignUserName}
                      onChange={(e) => setEsignUserName(e.target.value)}
                      fullWidth
                      margin="normal"
                      sx={commonStyles}
                      error={!esignUserName}
                      helperText={!esignUserName ? "User Name is required" : ""}
                    />
                    <TextField
                      type="number"
                      label="Page Number"
                      value={esignPageNo}
                      onChange={(e) => setEsignPageNo(parseInt(e.target.value))}
                      fullWidth
                      margin="normal"
                      sx={commonStyles}
                      inputProps={{ min: 1 }}
                      error={esignPageNo < 1}
                      helperText={
                        esignPageNo < 1 ? "Page number must be at least 1" : ""
                      }
                    />
                    <FormControl fullWidth margin="normal" sx={commonStyles}>
                      <InputLabel id="sign-position-label">
                        Sign Position
                      </InputLabel>
                      <Select
                        labelId="sign-position-label"
                        value={esignSignPosition}
                        label="Sign Position"
                        onChange={(e) => setEsignSignPosition(e.target.value)}
                      >
                        <MenuItem value="1">Left</MenuItem>
                        <MenuItem value="2">Right</MenuItem>
                      </Select>
                    </FormControl>
                  </>
                )}
              </Box>
            ) : null
          }
        />
      </Box>
      <ToastContainer />
    </Container>
  );
}
