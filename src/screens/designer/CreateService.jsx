import React, { useState, useEffect, useRef } from "react";
import {
  Box,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Typography,
  Paper,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Alert,
  Tooltip,
} from "@mui/material";
import { Col, Row, Container } from "react-bootstrap";
import {
  DndContext,
  closestCenter,
  useSensor,
  useSensors,
  PointerSensor,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import SortableSection from "../../components/designer/SortableSections";
import FieldEditModal from "../../components/designer/FieldEditModal";
import AdditionalFieldsModal from "../../components/designer/AdditionalFieldsModal";
import { defaultFormConfig } from "../../assets/dummyData";
import axiosInstance from "../../axiosConfig";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import SaveIcon from "@mui/icons-material/Save";
import UndoIcon from "@mui/icons-material/Undo";
import AddIcon from "@mui/icons-material/Add";
import SettingsIcon from "@mui/icons-material/Settings";
import BuildIcon from "@mui/icons-material/Build";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import ChecklistIcon from "@mui/icons-material/Checklist";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import RestoreIcon from "@mui/icons-material/Restore";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";

// ==================== Normalizers (unchanged) ====================
const normalizeField = (field, timestamp = Date.now(), banks = []) => ({
  id:
    field.id ||
    `field-${timestamp}-${Math.random().toString(36).substring(2, 9)}`,
  type: field.type || "text",
  label: field.label || "New Field",
  name: field.name || `NewField_${timestamp}`,
  minLength: field.minLength !== undefined ? field.minLength : 5,
  maxLength: field.maxLength !== undefined ? field.maxLength : 50,
  options:
    field.name === "BankName" && banks.length > 0
      ? [
          { value: "Please Select", label: "Please Select" },
          ...banks.map((bank) => ({ value: bank.id, label: bank.bankName })),
        ]
      : Array.isArray(field.options)
        ? field.options
        : [],
  span: field.span !== undefined ? field.span : 12,
  validationFunctions: Array.isArray(field.validationFunctions)
    ? field.validationFunctions
    : [],
  transformationFunctions: Array.isArray(field.transformationFunctions)
    ? field.transformationFunctions
    : [],
  additionalFields: normalizeAdditionalFields(
    field.additionalFields || {},
    timestamp,
    banks,
  ),
  accept: field.accept || "",
  editable: field.editable !== undefined ? field.editable : true,
  value: field.value || undefined,
  dependentOn: field.dependentOn || undefined,
  dependentOptions: field.dependentOptions || undefined,
  dependentTable: field.dependentTable || "",
  isDependentEnclosure: field.isDependentEnclosure || false,
  dependentField: field.dependentField || undefined,
  dependentValues: Array.isArray(field.dependentValues)
    ? field.dependentValues
    : [],
  isConsentCheckbox: field.isConsentCheckbox ?? false,
  checkboxLayout: field.checkboxLayout || "vertical",
  declaration: field.declaration || "",
  sectionId: field.sectionId || undefined,
  optionsType: field.optionsType || "independent",
  isOfficeField:
    field.isOfficeField !== undefined ? field.isOfficeField : false,
  officeTypeId: field.officeTypeId !== undefined ? field.officeTypeId : null,
  enableConditionalVisibility: field.enableConditionalVisibility || false,
  conditionalField: field.conditionalField || "",
  conditionalValues: field.conditionalValues || [],
  enableValueDependency: field.enableValueDependency || false,
  valueDependentOn: field.valueDependentOn || "",
  dateGreaterThanConfig: field.dateGreaterThanConfig || null,
});

const normalizeAdditionalFields = (additionalFields, timestamp, banks) => {
  const normalized = {};
  Object.keys(additionalFields).forEach((option) => {
    normalized[option] = (additionalFields[option] || []).map((field) =>
      normalizeField(field, timestamp, banks),
    );
  });
  return normalized;
};

const normalizeSections = (sections, banks = []) => {
  return sections.map((section) => ({
    ...section,
    id: section.id || `section-${Date.now()}`,
    section: section.section || `Section ${sections.length + 1}`,
    fields: (section.fields || []).map((field) =>
      normalizeField({ ...field, sectionId: section.id }, Date.now(), banks),
    ),
    editable: section.editable !== undefined ? section.editable : true,
    fullRow: section.fullRow || false,
  }));
};

export default function CreateService() {
  // ---------- Core state ----------
  const [sections, setSections] = useState(
    normalizeSections(defaultFormConfig),
  );
  const [services, setServices] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [banks, setBanks] = useState([]);
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [serviceName, setServiceName] = useState("");
  const [serviceNameShort, setServiceNameShort] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedField, setSelectedField] = useState(null);
  const [isAdditionalModalOpen, setIsAdditionalModalOpen] = useState(false);

  // ---------- NEW: Draft & dirty tracking state ----------
  const [dirty, setDirty] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState(null);
  const [pendingDraft, setPendingDraft] = useState(null);
  const skipDirty = useRef(true);
  const draftKey = (id) => `isss-form-draft-${id || "new"}`;

  // ---------- Initial data fetch ----------
  useEffect(() => {
    async function fetchData() {
      try {
        const [servicesResponse, departmentsResponse] = await Promise.all([
          axiosInstance.get("/Base/GetServices"),
          axiosInstance.get("/Base/GetDepartments"),
        ]);
        if (servicesResponse.data.status && servicesResponse.data.services) {
          setServices(servicesResponse.data.services);
        } else {
          toast.error("Failed to fetch services");
        }
        if (
          departmentsResponse.data.status &&
          departmentsResponse.data.departments
        ) {
          setDepartments(departmentsResponse.data.departments);
        } else {
          toast.error("Failed to fetch departments");
        }
      } catch (err) {
        toast.error("Failed to fetch data");
      }
    }
    fetchData();
  }, []);

  // ---------- NEW: Mark dirty on any edit (skip right after loading a service) ----------
  useEffect(() => {
    if (skipDirty.current) {
      skipDirty.current = false;
      return;
    }
    setDirty(true);
  }, [sections, serviceName, serviceNameShort, departmentId]);

  // ---------- NEW: Auto-save draft to localStorage (debounced 800ms) ----------
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(
          draftKey(selectedServiceId),
          JSON.stringify({
            sections,
            serviceName,
            serviceNameShort,
            departmentId,
            savedAt: new Date().toISOString(),
          }),
        );
        setDraftSavedAt(new Date());
      } catch (e) {
        console.error("Failed to save draft:", e);
      }
    }, 800);
    return () => clearTimeout(t);
  }, [
    sections,
    serviceName,
    serviceNameShort,
    departmentId,
    selectedServiceId,
  ]);

  // ---------- NEW: Warn before closing tab with unsaved work ----------
  useEffect(() => {
    const handler = (e) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  // ---------- NEW: Draft helpers ----------
  const checkDraft = (serviceId, loadedSections) => {
    try {
      const raw = localStorage.getItem(draftKey(serviceId));
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (JSON.stringify(draft.sections) !== JSON.stringify(loadedSections)) {
        setPendingDraft(draft);
      }
    } catch (e) {
      console.error("Failed to parse draft:", e);
    }
  };

  const restoreDraft = () => {
    if (!pendingDraft) return;
    setSections(normalizeSections(pendingDraft.sections, banks));
    setServiceName(pendingDraft.serviceName || "");
    setServiceNameShort(pendingDraft.serviceNameShort || "");
    setDepartmentId(pendingDraft.departmentId || "");
    setPendingDraft(null);
    setDirty(true);
    toast.info("Draft restored.", { position: "top-center", autoClose: 1500 });
  };

  const discardDraft = () => {
    localStorage.removeItem(draftKey(selectedServiceId));
    setPendingDraft(null);
    toast.info("Draft discarded. Showing last saved version.", {
      position: "top-center",
      autoClose: 2000,
    });
  };

  // ---------- Service change handler ----------
  const handleServiceChange = async (e) => {
    const serviceId = e.target.value;
    setSelectedServiceId(serviceId);

    if (serviceId === "") {
      const defaultSections = normalizeSections(defaultFormConfig, banks);
      setSections(defaultSections);
      setServiceName("");
      setServiceNameShort("");
      setDepartmentId("");
      setBanks([]);
      skipDirty.current = true;
      setDirty(false);
      checkDraft("", defaultSections);
      return;
    }

    const service = services.find((s) => s.serviceId === serviceId);
    if (service) {
      setServiceName(service.serviceName || "");
      setServiceNameShort(service.nameShort || "");
      setDepartmentId(service.departmentId || "");

      let banksResponse;
      try {
        banksResponse = await axiosInstance.get("/Base/GetBanks");
        if (banksResponse.data.status && banksResponse.data.data) {
          setBanks(banksResponse.data.data);
        } else {
          toast.error("Failed to fetch banks");
          setBanks([]);
        }
      } catch (err) {
        console.error("Error fetching banks:", err);
        toast.error("Failed to fetch banks");
        setBanks([]);
      }

      let loadedSections;
      if (service.formElement) {
        try {
          const config = JSON.parse(service.formElement);
          loadedSections = normalizeSections(
            config,
            banksResponse?.data.data || [],
          );
        } catch (err) {
          console.error("Error parsing formElements:", err);
          toast.error("Invalid form data format.");
          loadedSections = normalizeSections(
            defaultFormConfig,
            banksResponse?.data.data || [],
          );
        }
      } else {
        loadedSections = normalizeSections(
          defaultFormConfig,
          banksResponse?.data.data || [],
        );
      }

      setSections(loadedSections);
      skipDirty.current = true;
      setDirty(false);
      checkDraft(serviceId, loadedSections);
    }
  };

  // ---------- Section operations ----------
  const handleAddSection = () => {
    const newSection = {
      id: `section-${sections.length + 1}`,
      section: `Section ${sections.length + 1}`,
      fields: [],
      editable: true,
      fullRow: false,
    };
    setSections((prev) => [...prev, newSection]);
  };

  const handleAddSectionAfter = (sectionId) => {
    const index = sections.findIndex((section) => section.id === sectionId);
    if (index === -1) return;
    const newSection = {
      id: `section-${Date.now()}`,
      section: `Section ${sections.length + 1}`,
      fields: [],
      editable: true,
      fullRow: false,
    };
    const newSections = [
      ...sections.slice(0, index + 1),
      newSection,
      ...sections.slice(index + 1),
    ];
    setSections(newSections);
  };

  const handleDuplicateSection = (sectionId) => {
    const sectionToDuplicate = sections.find(
      (section) => section.id === sectionId,
    );
    if (sectionToDuplicate) {
      const newSection = {
        ...sectionToDuplicate,
        id: `section-${sections.length + 1}`,
        section: `${sectionToDuplicate.section} Copy`,
        fullRow: sectionToDuplicate.fullRow,
        fields: sectionToDuplicate.fields.map((field) =>
          normalizeField(
            {
              ...field,
              id: `field-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            },
            Date.now(),
            banks,
          ),
        ),
      };
      setSections((prev) => [...prev, newSection]);
    }
  };

  const handleRemoveSection = (sectionId) => {
    setSections((prev) => prev.filter((section) => section.id !== sectionId));
  };

  const handleToggleFullRow = (sectionId) => {
    setSections((prev) =>
      prev.map((section) =>
        section.id === sectionId
          ? { ...section, fullRow: !section.fullRow }
          : section,
      ),
    );
  };

  // ---------- Field operations ----------
  const handleAddField = (sectionId) => {
    const newField = {
      id: `field-${Date.now()}`,
      type: "text",
      label: "New Field",
      name: `NewField_${Date.now()}`,
      minLength: 5,
      maxLength: 50,
      options: [],
      span: 12,
      validationFunctions: [],
      transformationFunctions: [],
      additionalFields: {},
      accept: "",
      editable: true,
      value: undefined,
      dependentOn: undefined,
      dependentOptions: undefined,
      dependentTable: "",
      isDependentEnclosure: false,
      dependentField: undefined,
      dependentValues: [],
      isConsentCheckbox: false,
      checkboxLayout: "vertical",
      declaration: "",
      sectionId,
      optionsType: "independent",
      isOfficeField: false,
      officeTypeId: null,
      enableConditionalVisibility: false,
      conditionalField: "",
      conditionalValues: [],
      enableValueDependency: false,
      valueDependentOn: "",
    };
    setSections((prev) =>
      prev.map((section) =>
        section.id === sectionId
          ? { ...section, fields: [...section.fields, newField] }
          : section,
      ),
    );
  };

  const handleSectionNameChange = (sectionId, newName) => {
    setSections((prev) =>
      prev.map((section) =>
        section.id === sectionId ? { ...section, section: newName } : section,
      ),
    );
  };

  const handleUpdateSectionFields = (sectionId, newFields) => {
    setSections((prev) =>
      prev.map((section) =>
        section.id === sectionId ? { ...section, fields: newFields } : section,
      ),
    );
  };

  // ---------- Save to server ----------
  const handleLogForm = async () => {
    const formdata = new FormData();
    if (!serviceName || !serviceNameShort || !departmentId) {
      toast.error(
        "Please provide Service Name, Service Name Short, and select a Department.",
        { position: "top-center" },
      );
      return;
    }
    formdata.append("serviceName", serviceName);
    formdata.append("serviceNameShort", serviceNameShort);
    formdata.append("departmentId", departmentId);
    formdata.append("serviceId", selectedServiceId);
    formdata.append("formElement", JSON.stringify(sections));

    try {
      const response = await axiosInstance.post(
        "/Designer/FormElement",
        formdata,
      );
      const result = response.data;
      if (result.status) {
        toast.success(
          selectedServiceId
            ? "Service updated successfully!"
            : "New service created successfully!",
          { position: "top-center" },
        );
        setDirty(false);
        localStorage.removeItem(draftKey(selectedServiceId));

        if (!selectedServiceId) {
          setServiceName("");
          setServiceNameShort("");
          setDepartmentId("");
          setSections(normalizeSections(defaultFormConfig, banks));
          setSelectedServiceId("");
          setBanks([]);
        }

        const servicesResponse = await axiosInstance.get("/Base/GetServices");
        if (servicesResponse.data.status && servicesResponse.data.services) {
          setServices(servicesResponse.data.services);
        }
      } else {
        toast.error(result.response || "Failed to save service.", {
          position: "top-center",
        });
      }
    } catch (err) {
      console.error(err);
      toast.error("An unexpected error occurred.", { position: "top-center" });
    }
  };

  // ---------- Field update / removal ----------
  const updateField = (updatedField) => {
    setSections((prev) => {
      if (updatedField.sectionId) {
        return prev.map((section) =>
          section.id === updatedField.sectionId
            ? {
                ...section,
                fields: section.fields.map((field) =>
                  field.id === updatedField.id
                    ? normalizeField(updatedField, Date.now(), banks)
                    : field,
                ),
              }
            : section,
        );
      } else {
        return prev.map((section) =>
          section.fields.some((field) => field.id === updatedField.id)
            ? {
                ...section,
                fields: section.fields.map((field) =>
                  field.id === updatedField.id
                    ? normalizeField(updatedField, Date.now(), banks)
                    : field,
                ),
              }
            : section,
        );
      }
    });
  };

  const handleRemoveField = (sectionId, fieldId) => {
    setSections((prev) =>
      prev.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              fields: section.fields.filter((field) => field.id !== fieldId),
            }
          : section,
      ),
    );
  };

  const updateFieldValue = (sectionId, fieldId, newValue) => {
    setSections((prevSections) =>
      prevSections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              fields: section.fields.map((field) =>
                field.id === fieldId ? { ...field, value: newValue } : field,
              ),
            }
          : section,
      ),
    );
  };

  // ---------- Modal handlers ----------
  const handleEditField = (field) => {
    setSelectedField({
      ...field,
      sectionId: sections.find((section) =>
        section.fields.some((f) => f.id === field.id),
      )?.id,
    });
    setIsModalOpen(true);
  };

  const handleAdditionalModal = (field) => {
    setSelectedField(field);
    setIsAdditionalModalOpen(true);
  };

  // ---------- DnD ----------
  const sectionSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleSectionDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sections.findIndex((s) => s.id === active.id);
    const newIndex = sections.findIndex((s) => s.id === over.id);
    setSections((prev) => arrayMove(prev, oldIndex, newIndex));
  };

  // ---------- Discard unsaved changes ----------
  const handleDiscardChanges = () => {
    if (selectedServiceId === "") {
      setSections(normalizeSections(defaultFormConfig, banks));
      setServiceName("");
      setServiceNameShort("");
      setDepartmentId("");
    } else {
      // Re-trigger service change to reload from server
      handleServiceChange({ target: { value: selectedServiceId } });
    }
    setDirty(false);
    toast.info("Changes discarded.", {
      position: "top-center",
      autoClose: 1500,
    });
  };

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <Container
      fluid
      sx={{ bgcolor: "#F8FAFC", minHeight: "100vh", py: 4, pb: 12 }}
    >
      <Paper
        elevation={0}
        sx={{
          maxWidth: 1400,
          mx: "auto",
          borderRadius: 3,
          overflow: "hidden",
          bgcolor: "white",
          border: "1px solid #E2E8F0",
        }}
      >
        {/* ==================== Header ==================== */}
        <Box
          sx={{
            p: { xs: 3, md: 4 },
            background: "linear-gradient(135deg, #2562E9 0%, #1E40AF 100%)",
            color: "white",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <Box sx={{ position: "relative", zIndex: 1 }}>
            <Box
              sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}
            >
              <BuildIcon sx={{ fontSize: 32 }} />
              <Typography
                variant="h4"
                sx={{ fontWeight: 800, letterSpacing: "-0.5px" }}
              >
                Form Builder
              </Typography>
            </Box>
            <Typography variant="body1" sx={{ opacity: 0.9, maxWidth: 700 }}>
              Design the fields citizens see when they apply for a service.
              Add sections, arrange fields, and set rules — changes are
              auto-saved to this device.
            </Typography>
          </Box>
        </Box>

        {/* ==================== Main content ==================== */}
        <Box sx={{ p: { xs: 2, md: 4 } }}>
          <Row>
            {/* ========== LEFT: Configuration Panel ========== */}
            <Col lg={3} md={12} xs={12}>
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  borderRadius: 2,
                  bgcolor: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                  height: "100%",
                }}
              >
                <Box
                  sx={{ display: "flex", alignItems: "center", gap: 1, mb: 3 }}
                >
                  <SettingsIcon sx={{ color: "#2562E9" }} />
                  <Typography
                    variant="h6"
                    sx={{ fontWeight: 700, color: "#0F172A" }}
                  >
                    Service Settings
                  </Typography>
                </Box>

                <Box
                  sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}
                >
                  <FormControl fullWidth variant="outlined">
                    <InputLabel id="service-select-label">
                      Choose a service to edit
                    </InputLabel>
                    <Select
                      labelId="service-select-label"
                      value={selectedServiceId}
                      label="Choose a service to edit"
                      onChange={handleServiceChange}
                      sx={{
                        bgcolor: "white",
                        borderRadius: 1,
                        "& .MuiOutlinedInput-notchedOutline": {
                          borderColor: "#CBD5E1",
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
                        <em>➕ Create a new service</em>
                      </MenuItem>
                      {services.map((service) => (
                        <MenuItem
                          key={service.serviceId}
                          value={service.serviceId}
                        >
                          {service.serviceName}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <TextField
                    fullWidth
                    label="Service Name (shown to citizens)"
                    value={serviceName}
                    onChange={(e) => setServiceName(e.target.value)}
                    variant="outlined"
                    helperText="e.g., Application for JK-ISSS Pension"
                    FormHelperTextProps={{
                      sx: { fontSize: "0.75rem", color: "#64748B" },
                    }}
                    sx={{
                      "& .MuiOutlinedInput-root": {
                        bgcolor: "white",
                        "& fieldset": { borderColor: "#CBD5E1" },
                        "&:hover fieldset": { borderColor: "#2562E9" },
                        "&.Mui-focused fieldset": { borderColor: "#2562E9" },
                      },
                    }}
                  />

                  <TextField
                    fullWidth
                    label="Short Name (internal use)"
                    value={serviceNameShort}
                    onChange={(e) => setServiceNameShort(e.target.value)}
                    variant="outlined"
                    helperText="e.g., JK-ISSS (no spaces)"
                    FormHelperTextProps={{
                      sx: { fontSize: "0.75rem", color: "#64748B" },
                    }}
                    sx={{
                      "& .MuiOutlinedInput-root": {
                        bgcolor: "white",
                        "& fieldset": { borderColor: "#CBD5E1" },
                        "&:hover fieldset": { borderColor: "#2562E9" },
                        "&.Mui-focused fieldset": { borderColor: "#2562E9" },
                      },
                    }}
                  />

                  <FormControl fullWidth variant="outlined">
                    <InputLabel id="department-select-label">
                      Which department owns this?
                    </InputLabel>
                    <Select
                      labelId="department-select-label"
                      value={departmentId}
                      label="Which department owns this?"
                      onChange={(e) => setDepartmentId(e.target.value)}
                      sx={{
                        bgcolor: "white",
                        borderRadius: 1,
                        "& .MuiOutlinedInput-notchedOutline": {
                          borderColor: "#CBD5E1",
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
                        <em>Select a department</em>
                      </MenuItem>
                      {departments.map((department) => (
                        <MenuItem
                          key={department.departmentid}
                          value={department.departmentid}
                        >
                          {department.departmentname}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <Divider sx={{ my: 1 }} />

                  <Button
                    variant="outlined"
                    onClick={handleAddSection}
                    startIcon={<AddIcon />}
                    sx={{
                      py: 1.5,
                      borderRadius: 1,
                      textTransform: "none",
                      fontWeight: 600,
                      borderColor: "#CBD5E1",
                      color: "#334155",
                      "&:hover": {
                        borderColor: "#2562E9",
                        color: "#2562E9",
                        bgcolor: "#EFF6FF",
                      },
                    }}
                  >
                    Add a new section
                  </Button>

                  <Alert
                    severity="info"
                    icon={<InfoOutlinedIcon fontSize="small" />}
                    sx={{
                      bgcolor: "#EFF6FF",
                      border: "1px solid #BFDBFE",
                      "& .MuiAlert-message": { fontSize: "0.8rem" },
                    }}
                  >
                    <b>Tip:</b> Your work is auto-saved to this device every
                    second. Press <b>Save Service</b> at the bottom of the page
                    when you're done.
                  </Alert>
                </Box>
              </Paper>
            </Col>

            {/* ========== RIGHT: Form Builder Canvas ========== */}
            <Col lg={9} md={12} xs={12}>
              <Paper
                elevation={0}
                sx={{
                  p: { xs: 2, md: 3 },
                  borderRadius: 2,
                  bgcolor: "white",
                  border: "1px solid #E2E8F0",
                  maxHeight: "75vh",
                  overflowY: "auto",
                  "&::-webkit-scrollbar": { width: "8px" },
                  "&::-webkit-scrollbar-thumb": {
                    background: "#CBD5E1",
                    borderRadius: "4px",
                  },
                  "&::-webkit-scrollbar-track": { background: "#F1F5F9" },
                }}
              >
                <Box
                  sx={{ display: "flex", alignItems: "center", gap: 1, mb: 3 }}
                >
                  <ChecklistIcon sx={{ color: "#2562E9" }} />
                  <Typography
                    variant="h5"
                    sx={{ fontWeight: 700, color: "#0F172A" }}
                  >
                    Your Form Sections
                  </Typography>
                  <Chip
                    size="small"
                    label={`${sections.length} section${sections.length !== 1 ? "s" : ""}`}
                    sx={{
                      ml: 1,
                      bgcolor: "#F1F5F9",
                      color: "#475569",
                      fontWeight: 600,
                      fontSize: "0.75rem",
                    }}
                  />
                </Box>

                <Typography variant="body2" sx={{ color: "#64748B", mb: 3 }}>
                  Drag sections to reorder them. Each section becomes a group of
                  fields on the citizen's form.
                </Typography>

                {sections.length === 0 ? (
                  <Box
                    sx={{
                      textAlign: "center",
                      py: 8,
                      px: 3,
                      border: "2px dashed #CBD5E1",
                      borderRadius: 2,
                      bgcolor: "#F8FAFC",
                    }}
                  >
                    <FolderOpenIcon
                      sx={{ fontSize: 56, color: "#CBD5E1", mb: 2 }}
                    />
                    <Typography
                      variant="h6"
                      sx={{ fontWeight: 600, color: "#475569", mb: 1 }}
                    >
                      No sections yet
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{ color: "#64748B", mb: 3 }}
                    >
                      A section is a group of related fields (for example,
                      "Personal Details" or "Bank Information").
                    </Typography>
                    <Button
                      variant="contained"
                      startIcon={<AddIcon />}
                      onClick={handleAddSection}
                      sx={{
                        bgcolor: "#2562E9",
                        textTransform: "none",
                        fontWeight: 600,
                        "&:hover": { bgcolor: "#1D4ED8" },
                      }}
                    >
                      Add your first section
                    </Button>
                  </Box>
                ) : (
                  <DndContext
                    sensors={sectionSensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleSectionDragEnd}
                  >
                    <SortableContext
                      items={sections.map((section) => section.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {sections.map((section) => (
                        <SortableSection
                          key={section.id}
                          section={section}
                          banks={banks}
                          onAddField={handleAddField}
                          onEditSectionName={handleSectionNameChange}
                          onToggleFullRow={handleToggleFullRow}
                          onEditField={handleEditField}
                          onAdditonalModal={handleAdditionalModal}
                          onUpdateSectionFields={handleUpdateSectionFields}
                          onFieldChange={updateFieldValue}
                          onRemoveField={handleRemoveField}
                          onDuplicateSection={handleDuplicateSection}
                          onRemoveSection={handleRemoveSection}
                          onAddSectionAfter={handleAddSectionAfter}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                )}
              </Paper>
            </Col>
          </Row>
        </Box>
      </Paper>

      {/* ==================== Sticky Save Bar ==================== */}
      <Box
        sx={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          bgcolor: "rgba(255, 255, 255, 0.97)",
          backdropFilter: "blur(8px)",
          borderTop: "1px solid #E2E8F0",
          boxShadow: "0 -4px 16px rgba(0, 0, 0, 0.08)",
          px: { xs: 2, md: 4 },
          py: 1.5,
        }}
      >
        <Box
          sx={{
            maxWidth: 1400,
            mx: "auto",
            display: "flex",
            alignItems: "center",
            gap: 2,
            flexWrap: "wrap",
          }}
        >
          {/* Status indicator */}
          {dirty ? (
            <Chip
              size="small"
              color="warning"
              label="Unsaved changes"
              sx={{ fontWeight: 600, fontSize: "0.8rem" }}
            />
          ) : (
            <Chip
              size="small"
              color="success"
              variant="outlined"
              label="All changes saved"
              sx={{ fontWeight: 600, fontSize: "0.8rem" }}
            />
          )}

          {/* Draft save time */}
          <Typography variant="caption" sx={{ color: "#64748B" }}>
            Draft auto-saved on this device
            {draftSavedAt ? ` at ${draftSavedAt.toLocaleTimeString()}` : ""}
          </Typography>

          <Box sx={{ flex: 1 }} />

          {/* Discard button */}
          <Tooltip title="Revert all changes to the last saved version">
            <span>
              <Button
                size="small"
                startIcon={<UndoIcon />}
                disabled={!dirty}
                onClick={handleDiscardChanges}
                sx={{
                  textTransform: "none",
                  fontWeight: 600,
                  color: "#64748B",
                  "&:hover": { bgcolor: "#F1F5F9", color: "#0F172A" },
                }}
              >
                Discard changes
              </Button>
            </span>
          </Tooltip>

          {/* Save button */}
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleLogForm}
            disabled={!serviceName || !serviceNameShort || !departmentId}
            sx={{
              textTransform: "none",
              fontWeight: 700,
              bgcolor: "#10B582",
              px: 4,
              "&:hover": { bgcolor: "#059669" },
              "&.Mui-disabled": { bgcolor: "#D1FAE5", color: "#6EE7B7" },
              boxShadow: "0 2px 8px rgba(16, 181, 130, 0.3)",
            }}
          >
            Save Service
          </Button>
        </Box>
      </Box>

      {/* ==================== Resume Draft Dialog ==================== */}
      <Dialog open={!!pendingDraft} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <RestoreIcon sx={{ color: "#F59E0B" }} />
          Resume your unsaved work?
        </DialogTitle>
        <DialogContent>
          <Typography
            variant="body2"
            sx={{ color: "#475569", lineHeight: 1.7 }}
          >
            A draft of this form was saved on this device at{" "}
            <b>
              {pendingDraft && new Date(pendingDraft.savedAt).toLocaleString()}
            </b>
            .
            <br />
            Do you want to continue from that draft, or start from the last
            saved version?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button
            onClick={discardDraft}
            startIcon={<DeleteOutlineIcon />}
            sx={{ textTransform: "none", color: "#64748B" }}
          >
            Start from saved version
          </Button>
          <Button
            variant="contained"
            onClick={restoreDraft}
            startIcon={<RestoreIcon />}
            sx={{
              textTransform: "none",
              fontWeight: 700,
              bgcolor: "#2562E9",
              "&:hover": { bgcolor: "#1D4ED8" },
            }}
          >
            Resume draft
          </Button>
        </DialogActions>
      </Dialog>

      {/* ==================== Modals ==================== */}
      {isModalOpen && selectedField && (
        <FieldEditModal
          selectedField={selectedField}
          sections={sections}
          banks={banks}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedField(null);
          }}
          updateField={updateField}
          sx={{
            bgcolor: "white",
            borderRadius: 2,
            boxShadow: 24,
            p: 4,
            maxWidth: 600,
            mx: "auto",
            mt: "10%",
            "& .MuiButton-root": {
              borderRadius: 1,
              textTransform: "none",
              fontWeight: "bold",
            },
          }}
        />
      )}

      {isAdditionalModalOpen && selectedField && (
        <AdditionalFieldsModal
          sections={sections}
          selectedField={selectedField}
          banks={banks}
          onClose={() => {
            setIsAdditionalModalOpen(false);
            setSelectedField(null);
          }}
          updateField={updateField}
          sx={{
            bgcolor: "white",
            borderRadius: 2,
            boxShadow: 24,
            p: 4,
            maxWidth: 600,
            mx: "auto",
            mt: "10%",
            "& .MuiButton-root": {
              borderRadius: 1,
              textTransform: "none",
              fontWeight: "bold",
            },
          }}
        />
      )}

      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        pauseOnHover
        theme="colored"
      />
    </Container>
  );
}
