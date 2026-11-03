import React, { useState, useEffect, useMemo } from "react";
import GovPageHeader from "../../components/gov/GovPageHeader";
import {
  Container,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  IconButton,
  Box,
  Modal,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Paper,
  Checkbox,
  FormControlLabel,
  FormGroup,
  TextField,
  Chip,
  Divider,
  Tooltip,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import { Col, Row } from "react-bootstrap";
import axiosInstance from "../../axiosConfig";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// ─────────────────────────────────────────────────────────
// Condition helpers
// ─────────────────────────────────────────────────────────
const OPERATORS = [
  { value: "equals", label: "Equals", needsValue: true },
  { value: "notEquals", label: "Not Equals", needsValue: true },
  { value: "contains", label: "Contains", needsValue: true },
  { value: "in", label: "In (comma-separated)", needsValue: true },
  { value: "notIn", label: "Not In (comma-separated)", needsValue: true },
  { value: "isEmpty", label: "Is Empty", needsValue: false },
  { value: "isNotEmpty", label: "Is Not Empty", needsValue: false },
];

const operatorNeedsValue = (op) =>
  OPERATORS.find((o) => o.value === op)?.needsValue ?? true;

const emptyVisibility = () => ({ logic: "AND", conditions: [] });

const hasActiveVisibility = (v) =>
  v && Array.isArray(v.conditions) && v.conditions.length > 0;

const isGroupShape = (f) =>
  typeof f === "object" && f !== null && Array.isArray(f.fields);

const isSingleFieldObject = (f) =>
  typeof f === "object" &&
  f !== null &&
  !Array.isArray(f.fields) &&
  typeof f.name === "string";

const isDuplicateField = (f, name) => {
  if (typeof f === "string") return f === name;
  if (isGroupShape(f)) return f.fields.includes(name);
  if (isSingleFieldObject(f)) return f.name === name;
  return false;
};

const Corrections = () => {
  const [services, setServices] = useState([]);
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [formFields, setFormFields] = useState([]);
  const [correctionFields, setCorrectionFields] = useState([]);
  const [corrigendumFields, setCorrigendumFields] = useState([]);
  const [amendmentFields, setAmendmentFields] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalFieldNames, setModalFieldNames] = useState([]);
  const [modalFieldIndex, setModalFieldIndex] = useState(-1);
  const [modalType, setModalType] = useState("");
  const [groupLabel, setGroupLabel] = useState("");
  const [isGroup, setIsGroup] = useState(false);
  const [modalVisibility, setModalVisibility] = useState(emptyVisibility());

  // ── Flattened field options (name + label + section + type + options) ──
  const fieldOptions = useMemo(() => {
    const out = [];
    for (const section of formFields) {
      for (const f of section.fields || []) {
        out.push({
          name: f.name,
          label: f.label,
          section: section.sectionName,
          type: f.type || "text",
          options: Array.isArray(f.options) ? f.options : [],
        });
      }
    }
    return out;
  }, [formFields]);

  // Helper: locate the option label for a given field/value pair
  const optionLabelFor = (fieldName, value) => {
    const f = fieldOptions.find((x) => x.name === fieldName);
    const opt = f?.options?.find((o) => String(o.value) === String(value));
    return opt?.label || value;
  };

  // ── Fetch services + form fields ──
  useEffect(() => {
    const fetchServices = async () => {
      try {
        const response = await axiosInstance.get("/Base/GetServices");
        if (response.data.status && response.data.services) {
          setServices(response.data.services);
        } else {
          toast.error("No services found.");
        }
      } catch (error) {
        console.error("Error fetching services:", error);
        toast.error("Failed to load services.");
      }
    };

    const fetchFormFields = async () => {
      if (!selectedServiceId) {
        setFormFields([]);
        return;
      }
      try {
        const response = await axiosInstance.get("/Designer/GetFormElements", {
          params: { serviceId: selectedServiceId },
        });
        if (response.data.status && response.data.sections) {
          setFormFields(response.data.sections);
        } else {
          setFormFields([]);
          toast.error("No form fields found for this service.");
        }
      } catch (error) {
        console.error("Error fetching form fields:", error);
        setFormFields([]);
        toast.error("Failed to load form fields.");
      }
    };

    fetchServices();
    fetchFormFields();
  }, [selectedServiceId]);

  // ── Fetch document fields ──
  useEffect(() => {
    if (!selectedServiceId) {
      setCorrectionFields([]);
      setCorrigendumFields([]);
      setAmendmentFields([]);
      setSelectedType("");
      return;
    }

    const fetchDocumentFields = async () => {
      try {
        const response = await axiosInstance.get(
          "/Designer/GetDocumentFields",
          {
            params: { serviceId: selectedServiceId },
          },
        );
        if (response.data.status && response.data.documentFields) {
          const { correction, corrigendum, amendment } =
            response.data.documentFields;
          setCorrectionFields(correction || []);
          setCorrigendumFields(corrigendum || []);
          setAmendmentFields(amendment || []);
          toast.success("Document fields loaded successfully.");
        } else {
          setCorrectionFields([]);
          setCorrigendumFields([]);
          setAmendmentFields([]);
          toast.info("No existing document fields found for this service.");
        }
      } catch (error) {
        console.error("Error fetching document fields:", error);
        setCorrectionFields([]);
        setCorrigendumFields([]);
        setAmendmentFields([]);
        toast.error("Failed to load document fields.");
      }
    };

    fetchDocumentFields();
  }, [selectedServiceId]);

  // ─────────────────────────────────────────────────────────
  // Modal open/close
  // ─────────────────────────────────────────────────────────
  const openModalForAdd = (type, group = false) => {
    setModalType(type);
    setModalFieldIndex(-1);
    setModalFieldNames([]);
    setGroupLabel("");
    setIsGroup(group);
    setModalVisibility(emptyVisibility());
    setModalOpen(true);
  };

  const openModalForEdit = (type, index, field) => {
    setModalType(type);
    setModalFieldIndex(index);

    if (isGroupShape(field)) {
      setIsGroup(true);
      setModalFieldNames(field.fields);
      setGroupLabel(field.label || "");
      setModalVisibility(field.visibilityCondition || emptyVisibility());
    } else if (isSingleFieldObject(field)) {
      setIsGroup(false);
      setModalFieldNames([field.name]);
      setGroupLabel("");
      setModalVisibility(field.visibilityCondition || emptyVisibility());
    } else {
      setIsGroup(false);
      setModalFieldNames([field]);
      setGroupLabel("");
      setModalVisibility(emptyVisibility());
    }

    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setGroupLabel("");
    setIsGroup(false);
    setModalVisibility(emptyVisibility());
  };

  const handleCheckboxChange = (fieldName) => {
    setModalFieldNames((prev) =>
      prev.includes(fieldName)
        ? prev.filter((name) => name !== fieldName)
        : [...prev, fieldName],
    );
  };

  const handleSelectAllSection = (sectionFields, isChecked) => {
    setModalFieldNames((prev) => {
      if (isChecked) {
        const newFields = sectionFields
          .map((field) => field.name)
          .filter((name) => !prev.includes(name));
        return [...prev, ...newFields];
      } else {
        return prev.filter(
          (name) => !sectionFields.some((field) => field.name === name),
        );
      }
    });
  };

  // ─────────────────────────────────────────────────────────
  // Visibility condition editor helpers
  // ─────────────────────────────────────────────────────────
  const addCondition = () => {
    setModalVisibility((v) => ({
      ...v,
      conditions: [
        ...v.conditions,
        { field: "", operator: "equals", value: "" },
      ],
    }));
  };

  const updateCondition = (idx, patch) => {
    setModalVisibility((v) => ({
      ...v,
      conditions: v.conditions.map((c, i) =>
        i === idx ? { ...c, ...patch } : c,
      ),
    }));
  };

  const removeCondition = (idx) => {
    setModalVisibility((v) => ({
      ...v,
      conditions: v.conditions.filter((_, i) => i !== idx),
    }));
  };

  const clearConditions = () => setModalVisibility(emptyVisibility());

  // ─────────────────────────────────────────────────────────
  // Save modal
  // ─────────────────────────────────────────────────────────
  const saveModal = () => {
    if (modalFieldNames.length === 0) {
      toast.error("Please select at least one field.");
      return;
    }
    if (isGroup && !groupLabel.trim()) {
      toast.error("Please provide a group label.");
      return;
    }

    const validConditions = modalVisibility.conditions.filter(
      (c) => c.field && c.field.trim() !== "",
    );

    const hasPartialRow = modalVisibility.conditions.some(
      (c) =>
        (!c.field || c.field.trim() === "") && (c.value || "").trim() !== "",
    );
    if (hasPartialRow) {
      toast.error("Every visibility condition needs a field selected.");
      return;
    }

    const visibility = validConditions.length
      ? { logic: modalVisibility.logic, conditions: validConditions }
      : null;

    let fieldEntry;
    if (isGroup) {
      fieldEntry = { label: groupLabel, fields: modalFieldNames };
      if (visibility) fieldEntry.visibilityCondition = visibility;
    } else if (visibility) {
      const def = fieldOptions.find((f) => f.name === modalFieldNames[0]);
      fieldEntry = {
        name: modalFieldNames[0],
        label: def?.label || modalFieldNames[0],
        visibilityCondition: visibility,
      };
    } else {
      fieldEntry = modalFieldNames[0];
    }

    const updateFields = (currentFields, type) => {
      const newFields = [...currentFields];
      if (modalFieldIndex === -1) {
        const duplicates = modalFieldNames.filter((name) =>
          newFields.some((f) => isDuplicateField(f, name)),
        );
        if (duplicates.length > 0) {
          toast.error(
            `The following fields are already added to ${type}: ${duplicates.join(
              ", ",
            )}`,
          );
          return null;
        }
        newFields.push(fieldEntry);
      } else {
        if (!isGroup && modalFieldNames.length > 1) {
          toast.error("Please select only one field for editing.");
          return null;
        }
        newFields[modalFieldIndex] = fieldEntry;
      }
      return newFields;
    };

    if (modalType === "Correction") {
      const updated = updateFields(correctionFields, "Correction");
      if (updated) setCorrectionFields(updated);
    } else if (modalType === "Corrigendum") {
      const updated = updateFields(corrigendumFields, "Corrigendum");
      if (updated) setCorrigendumFields(updated);
    } else if (modalType === "Amendment") {
      const updated = updateFields(amendmentFields, "Amendment");
      if (updated) setAmendmentFields(updated);
    }
    closeModal();
  };

  const handleRemoveField = (type, index) => {
    if (type === "Correction") {
      setCorrectionFields(correctionFields.filter((_, i) => i !== index));
    } else if (type === "Corrigendum") {
      setCorrigendumFields(corrigendumFields.filter((_, i) => i !== index));
    } else if (type === "Amendment") {
      setAmendmentFields(amendmentFields.filter((_, i) => i !== index));
    }
  };

  const handleGenerateJson = () => {
    const jsonOutput = {
      documentType: selectedType,
      fields:
        selectedType === "Correction"
          ? correctionFields
          : selectedType === "Corrigendum"
            ? corrigendumFields
            : amendmentFields,
    };
    console.log(JSON.stringify(jsonOutput, null, 2));
    return jsonOutput;
  };

  const saveDocumentFields = async () => {
    if (!selectedServiceId || !selectedType) {
      toast.error("Please select a service and document type.");
      return;
    }

    const jsonOutput = handleGenerateJson();
    const formData = new FormData();
    formData.append("serviceId", selectedServiceId);
    formData.append("documentType", jsonOutput.documentType);
    formData.append("fields", JSON.stringify(jsonOutput.fields));

    try {
      const response = await axiosInstance.post(
        "/Designer/SaveDocumentFields",
        formData,
      );
      if (response.data.status) {
        toast.success("Document fields saved successfully!");
      } else {
        toast.error("Failed to save document fields.");
      }
    } catch (error) {
      console.error("Error saving document fields:", error);
      toast.error("An error occurred while saving document fields.");
    }
  };

  // ─────────────────────────────────────────────────────────
  // Rendering helpers
  // ─────────────────────────────────────────────────────────
  const formatVisibility = (v) => {
    if (!hasActiveVisibility(v)) return "";
    const parts = v.conditions.map((c) => {
      const op = OPERATORS.find((o) => o.value === c.operator);
      const label =
        fieldOptions.find((f) => f.name === c.field)?.label || c.field;

      if (!op?.needsValue) return `${label} ${op?.label.toLowerCase()}`;

      // Multi-value operators render each option label
      if (c.operator === "in" || c.operator === "notIn") {
        const vals = (c.value || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .map((v) => optionLabelFor(c.field, v))
          .join(", ");
        return `${label} ${op?.label.toLowerCase()} "${vals}"`;
      }

      return `${label} ${op?.label.toLowerCase()} "${optionLabelFor(
        c.field,
        c.value,
      )}"`;
    });
    return `Hidden unless ${parts.join(` ${v.logic} `)}`;
  };

  const renderVisibilityChip = (v) => (
    <Chip
      icon={<VisibilityOffIcon />}
      label={formatVisibility(v)}
      size="small"
      color="warning"
      variant="outlined"
      sx={{ mt: 1, fontSize: 11, height: 22, maxWidth: "100%" }}
    />
  );

  const renderFieldCell = (field) => {
    if (isGroupShape(field)) {
      return (
        <>
          <Typography sx={{ fontWeight: "bold" }}>{field.label}</Typography>
          <Box sx={{ pl: 2 }}>
            {field.fields.map((fieldName, idx) => (
              <Typography key={idx} sx={{ fontSize: 12 }}>
                {fieldOptions.find((f) => f.name === fieldName)?.label ||
                  fieldName}
              </Typography>
            ))}
          </Box>
          {hasActiveVisibility(field.visibilityCondition) &&
            renderVisibilityChip(field.visibilityCondition)}
        </>
      );
    }
    if (isSingleFieldObject(field)) {
      return (
        <>
          <Typography sx={{ fontSize: 12 }}>
            {field.label || field.name}
          </Typography>
          {hasActiveVisibility(field.visibilityCondition) &&
            renderVisibilityChip(field.visibilityCondition)}
        </>
      );
    }
    return (
      <Typography sx={{ fontSize: 12 }}>
        {fieldOptions.find((f) => f.name === field)?.label || field}
      </Typography>
    );
  };

  const renderFieldsTable = (type, fields) => (
    <Box sx={{ mb: 4 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        {type} Fields
      </Typography>
      <TableContainer component={Paper} sx={{ mb: 2 }}>
        <Table>
          <TableBody>
            {fields.length > 0 ? (
              fields.map((field, index) => (
                <TableRow key={`${type}-${index}`}>
                  <TableCell sx={{ border: "1px solid #ccc", fontSize: 12 }}>
                    {renderFieldCell(field)}
                  </TableCell>
                  <TableCell sx={{ border: "1px solid #ccc", fontSize: 12 }}>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => openModalForEdit(type, index, field)}
                      sx={{ mr: 1 }}
                      disabled={!selectedServiceId || !selectedType}
                    >
                      Edit
                    </Button>
                    <IconButton
                      onClick={() => handleRemoveField(type, index)}
                      color="error"
                      size="small"
                      disabled={!selectedServiceId || !selectedType}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={2} sx={{ textAlign: "center" }}>
                  No fields configured for {type}.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <Box sx={{ display: "flex", gap: 2 }}>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => openModalForAdd(type, false)}
          sx={{ bgcolor: "blue.500" }}
          disabled={!selectedServiceId || !selectedType}
        >
          Add Single Field
        </Button>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => openModalForAdd(type, true)}
          sx={{ bgcolor: "blue.500" }}
          disabled={!selectedServiceId || !selectedType}
        >
          Add Group
        </Button>
      </Box>
    </Box>
  );

  // ─────────────────────────────────────────────────────────
  // Value input renderer — picks a dropdown when the field
  // is a select with real options, otherwise free text.
  // ─────────────────────────────────────────────────────────
  const renderConditionValueInput = (condition, idx) => {
    if (!operatorNeedsValue(condition.operator)) return null;

    const fieldDef = fieldOptions.find((f) => f.name === condition.field);
    const isSelectType = fieldDef?.type === "select";
    const rawOptions = fieldDef?.options || [];
    // "Please Select" is a UI placeholder, not a meaningful condition value
    const usableOptions = rawOptions.filter(
      (o) => String(o.value).trim() !== "" && o.value !== "Please Select",
    );

    const isMulti =
      condition.operator === "in" || condition.operator === "notIn";

    // ── Select field with real options → use dropdown ──
    if (isSelectType && usableOptions.length > 0) {
      if (isMulti) {
        const selectedArray = (condition.value || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);

        // Preserve any previously saved values that no longer exist as options
        const combinedOptions = [...usableOptions];
        selectedArray.forEach((v) => {
          if (!combinedOptions.some((o) => String(o.value) === String(v))) {
            combinedOptions.push({ value: v, label: v });
          }
        });

        return (
          <FormControl size="small" sx={{ flex: "1 1 220px", minWidth: 220 }}>
            <InputLabel>Value(s)</InputLabel>
            <Select
              multiple
              label="Value(s)"
              value={selectedArray}
              onChange={(e) => {
                const joined = e.target.value.join(", ");
                updateCondition(idx, { value: joined });
              }}
              renderValue={(sel) =>
                sel
                  .map(
                    (v) =>
                      combinedOptions.find((o) => String(o.value) === String(v))
                        ?.label || v,
                  )
                  .join(", ")
              }
            >
              {combinedOptions.map((o) => (
                <MenuItem key={o.value} value={o.value}>
                  {o.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        );
      }

      // Single-select
      const hasMatch = usableOptions.some(
        (o) => String(o.value) === String(condition.value),
      );
      const displayOptions =
        hasMatch || !condition.value
          ? usableOptions
          : [
              ...usableOptions,
              { value: condition.value, label: condition.value },
            ];

      return (
        <TextField
          select
          size="small"
          label="Value"
          value={condition.value || ""}
          onChange={(e) => updateCondition(idx, { value: e.target.value })}
          sx={{ flex: "1 1 180px", minWidth: 180 }}
        >
          <MenuItem value="" disabled>
            Select value…
          </MenuItem>
          {displayOptions.map((o) => (
            <MenuItem key={o.value} value={o.value}>
              {o.label}
            </MenuItem>
          ))}
        </TextField>
      );
    }

    // ── Free text fallback (non-select fields, or select with no options yet) ──
    return (
      <TextField
        size="small"
        label="Value"
        placeholder={isMulti ? "value1, value2" : "Enter value"}
        value={condition.value}
        onChange={(e) => updateCondition(idx, { value: e.target.value })}
        sx={{ flex: "1 1 180px", minWidth: 180 }}
        helperText={
          isSelectType && usableOptions.length === 0
            ? "This select has no options; type a value."
            : idx === 0
              ? "Raw value, not label"
              : " "
        }
      />
    );
  };

  // ─────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────
  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "grey.100", p: 3 }}>
      <Container
        maxWidth="lg"
        sx={{ bgcolor: "white", borderRadius: 2, boxShadow: 3, p: 4 }}
      >
        <Row>
          <Col md={12}>
            <GovPageHeader
              title="Configure Document Fields"
              hindiTitle="दस्तावेज़ फ़ील्ड कॉन्फ़िगर करें"
            />
            <Box sx={{ mb: 4 }}>
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel id="service-select-label">
                  Select Service
                </InputLabel>
                <Select
                  labelId="service-select-label"
                  value={selectedServiceId}
                  label="Select Service"
                  onChange={(e) => setSelectedServiceId(e.target.value)}
                >
                  <MenuItem value="" disabled>
                    Select a Service
                  </MenuItem>
                  {services.map((service) => (
                    <MenuItem key={service.serviceId} value={service.serviceId}>
                      {service.serviceName}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel id="type-select-label">
                  Select Document Type
                </InputLabel>
                <Select
                  labelId="type-select-label"
                  value={selectedType}
                  label="Select Document Type"
                  onChange={(e) => setSelectedType(e.target.value)}
                  disabled={!selectedServiceId}
                >
                  <MenuItem value="" disabled>
                    Select a Document Type
                  </MenuItem>
                  <MenuItem value="Correction">Correction</MenuItem>
                  <MenuItem value="Corrigendum">Corrigendum</MenuItem>
                  <MenuItem value="Amendment">Document Updation</MenuItem>
                </Select>
              </FormControl>
            </Box>
            {selectedType && (
              <>
                {renderFieldsTable(
                  selectedType,
                  selectedType === "Correction"
                    ? correctionFields
                    : selectedType === "Corrigendum"
                      ? corrigendumFields
                      : amendmentFields,
                )}
                <Box sx={{ display: "flex", gap: 2 }}>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={handleGenerateJson}
                    disabled={!selectedServiceId || !selectedType}
                  >
                    Generate JSON
                  </Button>
                  <Button
                    variant="contained"
                    color="success"
                    onClick={saveDocumentFields}
                    disabled={!selectedServiceId || !selectedType}
                  >
                    Save Document Fields
                  </Button>
                </Box>
              </>
            )}
          </Col>
        </Row>

        {/* ───────────────── Modal ───────────────── */}
        <Modal open={modalOpen} onClose={closeModal}>
          <Box
            sx={{
              bgcolor: "white",
              p: 4,
              borderRadius: 2,
              maxWidth: 720,
              mx: "auto",
              marginTop: "20px",
              boxShadow: 24,
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            <Typography variant="h5" sx={{ mb: 3 }}>
              Configure {modalType} {isGroup ? "Group" : "Field"}
              {modalFieldIndex === -1 ? "s" : ""}
            </Typography>

            {isGroup && (
              <TextField
                fullWidth
                label="Group Label"
                value={groupLabel}
                onChange={(e) => setGroupLabel(e.target.value)}
                sx={{ mb: 3 }}
                error={!groupLabel.trim() && modalFieldNames.length > 0}
                helperText={
                  !groupLabel.trim() && modalFieldNames.length > 0
                    ? "Group label is required"
                    : ""
                }
              />
            )}

            {formFields.length > 0 ? (
              <FormGroup sx={{ mb: 3, maxHeight: 320, overflowY: "auto" }}>
                {formFields.map((section, sectionIndex) => (
                  <Box key={`section-${sectionIndex}`} sx={{ mb: 2 }}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={section.fields.every((field) =>
                            modalFieldNames.includes(field.name),
                          )}
                          onChange={(e) =>
                            handleSelectAllSection(
                              section.fields,
                              e.target.checked,
                            )
                          }
                          disabled={modalFieldIndex !== -1 && !isGroup}
                        />
                      }
                      label={
                        <Typography
                          variant="subtitle1"
                          sx={{ fontWeight: "bold" }}
                        >
                          {section.sectionName}
                        </Typography>
                      }
                    />
                    <Box sx={{ pl: 4 }}>
                      {section.fields.map((field, fieldIndex) => (
                        <FormControlLabel
                          key={`${field.name}-${fieldIndex}`}
                          control={
                            <Checkbox
                              checked={modalFieldNames.includes(field.name)}
                              onChange={() => handleCheckboxChange(field.name)}
                              disabled={
                                modalFieldIndex !== -1 &&
                                !isGroup &&
                                !modalFieldNames.includes(field.name)
                              }
                            />
                          }
                          label={field.label}
                        />
                      ))}
                    </Box>
                  </Box>
                ))}
              </FormGroup>
            ) : (
              <Typography sx={{ mb: 3, color: "text.secondary" }}>
                No fields available for this service. Please ensure the service
                has configured fields.
              </Typography>
            )}

            <Divider sx={{ my: 3 }} />

            {/* ── Visibility condition editor ── */}
            <Box sx={{ mb: 3 }}>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  mb: 1,
                }}
              >
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Visibility Condition (optional)
                </Typography>
                {modalVisibility.conditions.length > 0 && (
                  <Button size="small" onClick={clearConditions}>
                    Clear all
                  </Button>
                )}
              </Box>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                Show this {isGroup ? "group" : "field"} only when the condition
                below holds. Leave empty to always show.
              </Typography>

              {modalVisibility.conditions.length > 1 && (
                <Box
                  sx={{ mt: 2, display: "flex", alignItems: "center", gap: 1 }}
                >
                  <Typography variant="body2">Match</Typography>
                  <TextField
                    select
                    size="small"
                    value={modalVisibility.logic}
                    onChange={(e) =>
                      setModalVisibility((v) => ({
                        ...v,
                        logic: e.target.value,
                      }))
                    }
                    sx={{ width: 110 }}
                  >
                    <MenuItem value="AND">ALL (AND)</MenuItem>
                    <MenuItem value="OR">ANY (OR)</MenuItem>
                  </TextField>
                  <Typography variant="body2">of the following:</Typography>
                </Box>
              )}

              <Box sx={{ mt: 2 }}>
                {modalVisibility.conditions.map((c, idx) => (
                  <Box
                    key={idx}
                    sx={{
                      display: "flex",
                      gap: 1,
                      alignItems: "flex-start",
                      mb: 1,
                      flexWrap: "wrap",
                    }}
                  >
                    <TextField
                      select
                      size="small"
                      label="Field"
                      value={c.field}
                      onChange={(e) =>
                        updateCondition(idx, {
                          field: e.target.value,
                          // Reset value if the new field's options don't include
                          // the current value, otherwise stale values linger.
                          ...(c.value &&
                          !fieldOptions
                            .find((f) => f.name === e.target.value)
                            ?.options?.some(
                              (o) => String(o.value) === String(c.value),
                            )
                            ? { value: "" }
                            : {}),
                        })
                      }
                      sx={{ flex: "1 1 200px", minWidth: 200 }}
                    >
                      <MenuItem value="" disabled>
                        Select field…
                      </MenuItem>
                      {fieldOptions.map((f) => (
                        <MenuItem key={f.name} value={f.name}>
                          {f.label} ({f.name})
                        </MenuItem>
                      ))}
                    </TextField>

                    <TextField
                      select
                      size="small"
                      label="Operator"
                      value={c.operator}
                      onChange={(e) =>
                        updateCondition(idx, {
                          operator: e.target.value,
                          ...(operatorNeedsValue(e.target.value)
                            ? {}
                            : { value: "" }),
                        })
                      }
                      sx={{ width: 170 }}
                    >
                      {OPERATORS.map((o) => (
                        <MenuItem key={o.value} value={o.value}>
                          {o.label}
                        </MenuItem>
                      ))}
                    </TextField>

                    {renderConditionValueInput(c, idx)}

                    <Tooltip title="Remove condition">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => removeCondition(idx)}
                        sx={{ mt: 0.5 }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                ))}

                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={addCondition}
                  sx={{ mt: 1, textTransform: "none" }}
                >
                  Add Condition
                </Button>
              </Box>
            </Box>

            <Box
              sx={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 2,
                mt: 2,
              }}
            >
              <Button variant="outlined" onClick={closeModal}>
                Cancel
              </Button>
              <Button
                variant="contained"
                onClick={saveModal}
                disabled={
                  modalFieldNames.length === 0 ||
                  (isGroup && !groupLabel.trim())
                }
              >
                Save
              </Button>
            </Box>
          </Box>
        </Modal>
      </Container>
      <ToastContainer position="top-right" autoClose={3000} />
    </Box>
  );
};

export default Corrections;
