import React, { useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  Modal,
  FormControlLabel,
  Checkbox,
  Typography,
  InputLabel,
  Select,
  FormControl,
  MenuItem,
  Grid,
  Divider,
  TextField,
  IconButton,
  Paper,
  Tooltip,
  Chip,
  Autocomplete,
  CircularProgress,
  Alert,
} from "@mui/material";
import FieldEditModal from "./FieldEditModal";
import AdditionalFieldsModal from "./AdditionalFieldsModal";
import SortableField from "./SortableField";
import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { toast } from "react-toastify";
import axiosInstance from "../../axiosConfig";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import CloseIcon from "@mui/icons-material/Close";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import EditIcon from "@mui/icons-material/Edit";
import RefreshIcon from "@mui/icons-material/Refresh";

// Helper function to clean declaration data
const cleanDeclarationData = (fieldData) => {
  if (fieldData.isConsentCheckbox && fieldData.type === "checkbox") {
    return {
      ...fieldData,
      isConsentCheckbox: true,
      isDeclaration: true,
      declaration: fieldData.declaration || "",
      declarationFields: Array.isArray(fieldData.declarationFields)
        ? fieldData.declarationFields.map(f => ({
          id: f.id || f.name,
          name: f.name,
          label: f.label || f.name,
          type: f.type || 'text',
          required: f.required || false
        }))
        : [],
    };
  }
  return fieldData;
};

// Sanitize action form with declaration support
const sanitizeActionForm = (actionForm) => {
  return (actionForm || []).map((field) => {
    const sanitizedField = {
      ...field,
      // Ensure declaration data is preserved
      isConsentCheckbox: field.isConsentCheckbox || false,
      isDeclaration: field.isDeclaration || false,
      declaration: field.declaration || "",
      declarationFields: Array.isArray(field.declarationFields) ? field.declarationFields : [],
      editable: field.editable ?? true,
    };

    if (field.options) {
      sanitizedField.options = field.options;
    }

    if (field.dependentOptions) {
      sanitizedField.dependentOptions = Object.fromEntries(
        Object.entries(field.dependentOptions).map(([key, opts]) => [
          key,
          opts,
        ])
      );
    }

    // Recursively sanitize additionalFields
    if (field.additionalFields) {
      sanitizedField.additionalFields = Object.fromEntries(
        Object.entries(field.additionalFields).map(([key, fields]) => [
          key,
          fields.map(f => cleanDeclarationData(f))
        ])
      );
    }

    return sanitizedField;
  });
};

// Helper functions
const formatColumnLabel = (columnName) => {
  if (!columnName) return "";
  return columnName
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^./, str => str.toUpperCase())
    .trim();
};

const shouldSkipField = (fieldName) => {
  if (!fieldName) return true;
  const lowerName = fieldName.toLowerCase();
  const skipPatterns = [
    'id$', '^created', '^updated', '^deleted',
    'password', 'token', 'hash', 'salt', 'secret', 'withhold'
  ];
  return skipPatterns.some(pattern => new RegExp(pattern).test(lowerName));
};

const PlayerEditModal = ({
  player,
  onClose,
  onSave,
  players,
  serviceId,
  services,
}) => {
  const fieldCounter = useRef(0);

  const [editedPlayer, setEditedPlayer] = useState({
    ...player,
    accessLevel: player.accessLevel || "",
    canHavePool: player.canHavePool || false,
    canManageBankFiles: player.canManageBankFiles || false,
    canWithhold: player.canWithhold || false,
    canValidateAadhaar: player.canValidateAadhaar || false,
    canDirectWithheld: player.canDirectWithheld || false,
    actionForm: sanitizeActionForm(player.actionForm || []),
    customPermissions: player.customPermissions || [],
  });

  const [actionFormOptions, setActionFormOptions] = useState(() => {
    const saved = player.actionFormOptions || {};
    const getCustomPermState = () => {
      if (saved.customPermissions) return saved.customPermissions;
      if (!player.customPermissions) return {};
      return player.customPermissions
        .filter((p) => p.enabled)
        .reduce((acc, p) => ({ ...acc, [p.name]: true }), {});
    };
    return {
      canForwardToPlayer: saved.canForwardToPlayer ?? player.canForwardToPlayer,
      canSanction: saved.canSanction ?? player.canSanction,
      canReturnToPlayer: saved.canReturnToPlayer ?? player.canReturnToPlayer,
      canReturnToCitizen: saved.canReturnToCitizen ?? player.canReturnToCitizen,
      canReject: saved.canReject ?? player.canReject,
      canWithhold: saved.canWithhold ?? player.canWithhold,
      canDirectWithheld: saved.canDirectWithheld ?? (player.canDirectWithheld || false),
      customPermissions: getCustomPermState(),
    };
  });

  const [isFieldModalOpen, setIsFieldModalOpen] = useState(false);
  const [selectedField, setSelectedField] = useState(null);
  const [designations, setDesignations] = useState([]);
  const [isLoadingDesignations, setIsLoadingDesignations] = useState(true);
  const [formFields, setFormFields] = useState([]);
  const [isFetchingFormFields, setIsFetchingFormFields] = useState(false);
  const [hasFetchedFormFields, setHasFetchedFormFields] = useState(false);
  const [isAdditionalModalOpen, setIsAdditionalModalOpen] = useState(false);
  const [fieldForAdditionalModal, setFieldForAdditionalModal] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const getServiceInfo = () => {
    if (!serviceId || !services || !Array.isArray(services)) {
      return { serviceName: "Unknown Service", departmentId: null };
    }

    const service = services.find((s) => s.ServiceId === serviceId);
    if (service) {
      return {
        serviceName: service.serviceName || "Unknown Service",
        departmentId: service.departmentId || service.departmentId,
      };
    }

    const serviceAlt = services.find((s) => s.serviceId === serviceId);
    if (serviceAlt) {
      return {
        serviceName: serviceAlt.serviceName || "Unknown Service",
        departmentId: serviceAlt.departmentId,
      };
    }

    return { serviceName: "Unknown Service", departmentId: null };
  };

  const { serviceName, departmentId } = getServiceInfo();

  useEffect(() => {
    async function getDesignations() {
      if (!departmentId) {
        setIsLoadingDesignations(false);
        return;
      }
      try {
        const response = await axiosInstance.get(`/Base/GetDesignations`, {
          params: { departmentId: departmentId },
        });
        if (response.data.status && response.data.designations) {
          setDesignations(response.data.designations);
        } else {
          toast.error("Failed to load designations");
        }
      } catch (error) {
        console.error("Error fetching designations:", error);
        toast.error("Error loading designations");
      } finally {
        setIsLoadingDesignations(false);
      }
    }
    getDesignations();
  }, [departmentId]);

  // Fetch form fields
  useEffect(() => {
    async function fetchFormFields() {
      if (!serviceId) {
        setFormFields([]);
        setHasFetchedFormFields(false);
        return;
      }

      try {
        setIsFetchingFormFields(true);
        const response = await axiosInstance.get(`/Designer/GetFormElements`, {
          params: { serviceId }
        });

        if (response.data.status) {
          const allFields = [];
          const fieldMap = new Map();

          // Extract fields from sections
          if (response.data.sections && Array.isArray(response.data.sections)) {
            response.data.sections.forEach(section => {
              if (section.fields && Array.isArray(section.fields)) {
                section.fields.forEach(field => {
                  if (field.name && field.label) {
                    const fieldData = {
                      id: field.name,
                      name: field.name,
                      label: field.label,
                      type: field.type || 'text',
                      source: 'form_designer'
                    };

                    if (!fieldMap.has(field.name)) {
                      fieldMap.set(field.name, fieldData);
                      allFields.push(fieldData);
                    }
                  }
                });
              }
            });
          }

          // Extract fields from columnNames
          if (response.data.columnNames && Array.isArray(response.data.columnNames)) {
            response.data.columnNames.forEach(columnName => {
              if (shouldSkipField(columnName)) return;

              const label = formatColumnLabel(columnName);
              const fieldData = {
                id: columnName,
                name: columnName,
                label: label,
                type: 'text',
                source: 'application_table'
              };

              if (!fieldMap.has(columnName)) {
                fieldMap.set(columnName, fieldData);
                allFields.push(fieldData);
              }
            });
          }

          setFormFields(allFields);
          setHasFetchedFormFields(true);

          if (allFields.length === 0) {
            toast.warning("No form fields found for this service");
          }
        } else {
          toast.warning("No form fields found for this service");
          setFormFields([]);
        }
      } catch (error) {
        console.error("Error fetching form fields:", error);
        toast.error("Failed to load form fields");
        setFormFields([]);
      } finally {
        setIsFetchingFormFields(false);
      }
    }

    fetchFormFields();
  }, [serviceId]);

  const handleRefreshFormFields = async () => {
    if (!serviceId) {
      toast.warning("Please select a service first");
      return;
    }

    try {
      setIsFetchingFormFields(true);
      const response = await axiosInstance.get(`/Designer/GetFormElements`, {
        params: { serviceId }
      });

      if (response.data.status) {
        const allFields = [];
        const fieldMap = new Map();

        if (response.data.sections && Array.isArray(response.data.sections)) {
          response.data.sections.forEach(section => {
            if (section.fields && Array.isArray(section.fields)) {
              section.fields.forEach(field => {
                if (field.name && field.label) {
                  const fieldData = {
                    id: field.name,
                    name: field.name,
                    label: field.label,
                    type: field.type || 'text',
                    source: 'form_designer'
                  };

                  if (!fieldMap.has(field.name)) {
                    fieldMap.set(field.name, fieldData);
                    allFields.push(fieldData);
                  }
                }
              });
            }
          });
        }

        if (response.data.columnNames && Array.isArray(response.data.columnNames)) {
          response.data.columnNames.forEach(columnName => {
            if (shouldSkipField(columnName)) return;

            const label = formatColumnLabel(columnName);
            const fieldData = {
              id: columnName,
              name: columnName,
              label: label,
              type: 'text',
              source: 'application_table'
            };

            if (!fieldMap.has(columnName)) {
              fieldMap.set(columnName, fieldData);
              allFields.push(fieldData);
            }
          });
        }

        setFormFields(allFields);
        toast.success(`Refreshed ${allFields.length} fields`);
      }
    } catch (error) {
      console.error("Error refreshing form fields:", error);
      toast.error("Failed to refresh form fields");
    } finally {
      setIsFetchingFormFields(false);
    }
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = editedPlayer.actionForm.findIndex((f) => f.id === active.id);
    const newIndex = editedPlayer.actionForm.findIndex((f) => f.id === over.id);

    setEditedPlayer((prev) => ({
      ...prev,
      actionForm: arrayMove(prev.actionForm, oldIndex, newIndex),
    }));
  };

  const handleChange = (field, value) => {
    if (field === "canCorrigendum" && value) {
      const other = players.find(
        (p) => p.playerId !== editedPlayer.playerId && p.canCorrigendum
      );
      if (other) {
        toast.error(`Another player (${other.designation}) already has Can Corrigendum authority.`);
        return;
      }
    }
    if (field === "canManageBankFiles" && value) {
      const other = players.find(
        (p) => p.playerId !== editedPlayer.playerId && p.canManageBankFiles
      );
      if (other) {
        toast.error(`Another player (${other.designation}) already has Can Manage Bank Files authority.`);
        return;
      }
    }
    if (field === "canValidateAadhaar" && value) {
      const other = players.find(
        (p) => p.playerId !== editedPlayer.playerId && p.canValidateAadhaar
      );
      if (other) {
        toast.error(`Another player (${other.designation}) already has Can Validate Aadhaar authority.`);
        return;
      }
    }

    if (field.startsWith("custom_")) {
      setEditedPlayer((prev) => ({
        ...prev,
        customPermissions: prev.customPermissions.map((perm) =>
          perm.name === field ? { ...perm, enabled: value } : perm
        ),
      }));
      return;
    }

    if (field === "designation" && value) {
      const selected = designations.find((des) => des.designation === value);
      if (selected) {
        setEditedPlayer((prev) => ({
          ...prev,
          designation: value,
          accessLevel: selected.accessLevel || "",
        }));
        return;
      }
    }

    setEditedPlayer((prev) => ({ ...prev, [field]: value }));
  };

  const handleActionFormOptionChange = (field, value) => {
    if (field.startsWith("custom_")) {
      setActionFormOptions((prev) => ({
        ...prev,
        customPermissions: {
          ...prev.customPermissions,
          [field]: value,
        },
      }));
    } else {
      setActionFormOptions((prev) => ({ ...prev, [field]: value }));
    }
  };

  const selectAllPermissions = () => {
    setEditedPlayer((prev) => ({
      ...prev,
      canSanction: true,
      canReturnToPlayer: true,
      canReturnToCitizen: true,
      canForwardToPlayer: true,
      canReject: true,
      canPull: true,
      canHavePool: true,
      canCorrigendum: true,
      canManageBankFiles: true,
      canWithhold: true,
      canValidateAadhaar: true,
      canDirectWithheld: true,
      customPermissions: (prev.customPermissions || []).map((p) => ({
        ...p,
        enabled: true,
      })),
    }));
  };

  const deselectAllPermissions = () => {
    setEditedPlayer((prev) => ({
      ...prev,
      canSanction: false,
      canReturnToPlayer: false,
      canReturnToCitizen: false,
      canForwardToPlayer: false,
      canReject: false,
      canPull: false,
      canHavePool: false,
      canCorrigendum: false,
      canManageBankFiles: false,
      canWithhold: false,
      canValidateAadhaar: false,
      canDirectWithheld: false,
      customPermissions: (prev.customPermissions || []).map((p) => ({
        ...p,
        enabled: false,
      })),
    }));
  };

  const selectAllActionFormOptions = () => {
    setActionFormOptions({
      canSanction: editedPlayer.canSanction,
      canReturnToPlayer: editedPlayer.canReturnToPlayer,
      canReturnToCitizen: editedPlayer.canReturnToCitizen,
      canForwardToPlayer: editedPlayer.canForwardToPlayer,
      canReject: editedPlayer.canReject,
      canWithhold: editedPlayer.canWithhold,
      canDirectWithheld: editedPlayer.canDirectWithheld || false,
      customPermissions: (editedPlayer.customPermissions || [])
        .filter((p) => p.enabled)
        .reduce((acc, p) => ({ ...acc, [p.name]: true }), {}),
    });
  };

  const deselectAllActionFormOptions = () => {
    setActionFormOptions({
      canSanction: false,
      canReturnToPlayer: false,
      canReturnToCitizen: false,
      canForwardToPlayer: false,
      canReject: false,
      canWithhold: false,
      canDirectWithheld: false,
      customPermissions: {},
    });
  };

  const addActionFormField = () => {
    fieldCounter.current += 1;
    const newField = {
      id: `custom-field-${fieldCounter.current}`,
      type: "text",
      label: "New Field",
      name: `NewField_${fieldCounter.current}`,
      minLength: 5,
      maxLength: 50,
      options: [],
      span: 12,
      validationFunctions: [],
      transformationFunctions: [],
      additionalFields: {},
      accept: "",
      isDeclaration: false,
      declaration: "",
      declarationFields: [],
      editable: true,
      isConsentCheckbox: false,
    };
    setEditedPlayer((prev) => ({
      ...prev,
      actionForm: [...prev.actionForm, newField],
    }));
  };

  const handleEditField = (field) => {
    setSelectedField({
      ...field,
      editable: field.editable ?? true,
      sectionId: "actionForm",
    });
    setIsFieldModalOpen(true);
  };

  const handleAdditionalModal = (field) => {
    setFieldForAdditionalModal(field);
    setIsAdditionalModalOpen(true);
  };

  // NEW: Handle field updates from AdditionalFieldsModal
  const handleFieldUpdateFromAdditional = (updatedField) => {
    console.log("PlayerEditModal received updated field:", {
      id: updatedField.id,
      name: updatedField.name,
      isConsentCheckbox: updatedField.isConsentCheckbox,
      hasDeclaration: !!updatedField.declaration,
      declarationFields: updatedField.declarationFields?.length
    });

    // Clean the field data
    const cleanedField = cleanDeclarationData(updatedField);

    // Update the field in actionForm
    const updatedActionForm = editedPlayer.actionForm.map(f =>
      f.id === cleanedField.id ? cleanedField : f
    );

    setEditedPlayer(prev => ({
      ...prev,
      actionForm: sanitizeActionForm(updatedActionForm)
    }));

    toast.success("Field updated successfully");
  };

  const handleRemoveField = (fieldId) => {
    setEditedPlayer((prev) => ({
      ...prev,
      actionForm: prev.actionForm.filter((f) => f.id !== fieldId),
    }));
  };

  // UPDATED: Handle field updates with declaration data
  const updateField = (updatedField) => {
    console.log("PlayerEditModal updateField called:", {
      id: updatedField.id,
      name: updatedField.name,
      type: updatedField.type,
      isConsentCheckbox: updatedField.isConsentCheckbox,
      hasDeclaration: !!updatedField.declaration,
      declarationFields: updatedField.declarationFields?.length
    });

    // Clean the field data
    const cleanedField = cleanDeclarationData(updatedField);

    // Update the field in actionForm
    const updatedActionForm = editedPlayer.actionForm.map(f =>
      f.id === cleanedField.id ? cleanedField : f
    );

    setEditedPlayer(prev => ({
      ...prev,
      actionForm: sanitizeActionForm(updatedActionForm)
    }));

    setIsFieldModalOpen(false);
    setSelectedField(null);

    console.log("Field updated successfully:", {
      hasDeclaration: !!cleanedField.declaration,
      declarationLength: cleanedField.declaration?.length,
      fieldsCount: cleanedField.declarationFields?.length
    });
  };

  const generateActionFormOptions = () => {
    const options = [];
    if (actionFormOptions.canForwardToPlayer && editedPlayer.canForwardToPlayer) {
      let label = "Forward to Player";
      if (editedPlayer.nextPlayerId !== null) {
        const next = players.find((p) => p.playerId === editedPlayer.nextPlayerId);
        if (next?.designation) label = `Forward to ${next.designation}`;
      }
      options.push({ value: "Forward", label });
    }
    if (actionFormOptions.canSanction && editedPlayer.canSanction)
      options.push({ value: "Sanction", label: "Sanction" });
    if (actionFormOptions.canReturnToPlayer && editedPlayer.canReturnToPlayer) {
      let label = "Return to Player";
      if (editedPlayer.prevPlayerId !== null) {
        const prev = players.find((p) => p.playerId === editedPlayer.prevPlayerId);
        if (prev?.designation) label = `Return to ${prev.designation}`;
      }
      options.push({ value: "ReturnToPlayer", label });
    }
    if (actionFormOptions.canReturnToCitizen && editedPlayer.canReturnToCitizen)
      options.push({ value: "ReturnToCitizen", label: "Return to Citizen" });
    if (actionFormOptions.canReject && editedPlayer.canReject)
      options.push({ value: "Reject", label: "Reject" });
    if (actionFormOptions.canWithhold && editedPlayer.canWithhold)
      options.push({ value: "Withhold", label: "Withhold" });
    if (actionFormOptions.canDirectWithheld && editedPlayer.canDirectWithheld)
      options.push({ value: "DirectWithheld", label: "Direct Withheld" });

    editedPlayer.customPermissions?.forEach((perm) => {
      if (perm.enabled && actionFormOptions.customPermissions?.[perm.name]) {
        options.push({
          value: perm.name.replace("custom_", ""),
          label: perm.label,
        });
      }
    });

    return options;
  };

  const handleSave = () => {
    const actionOptions = generateActionFormOptions();

    let updatedActionForm = editedPlayer.actionForm.map((field) =>
      field.name === "defaultAction"
        ? { ...field, options: actionOptions, label: "Action" }
        : field
    );

    if (!updatedActionForm.some((f) => f.name === "defaultAction")) {
      updatedActionForm = [
        ...updatedActionForm,
        {
          id: `default-action-${Date.now()}`,
          type: "select",
          label: "Action",
          name: "defaultAction",
          minLength: 0,
          maxLength: 0,
          options: actionOptions,
          span: 12,
          validationFunctions: [],
          transformationFunctions: [],
          additionalFields: {},
          accept: "",
          isDeclaration: false,
          declaration: "",
          declarationFields: [],
          editable: true,
          isConsentCheckbox: false,
        },
      ];
    }

    const finalPlayer = {
      ...editedPlayer,
      actionFormOptions,
      actionForm: sanitizeActionForm(updatedActionForm),
    };

    // Debug: Check declaration data before saving
    console.log("PlayerEditModal saving player with declaration data:");
    finalPlayer.actionForm.forEach((field, index) => {
      if (field.type === "checkbox" && field.isConsentCheckbox) {
        console.log(`Field ${index}:`, {
          name: field.name,
          isConsentCheckbox: field.isConsentCheckbox,
          declaration: field.declaration?.substring(0, 50),
          declarationFields: field.declarationFields?.length
        });
      }
    });

    onSave(finalPlayer);
    onClose();
  };

  return (
    <Modal open onClose={onClose}>
      <Box
        sx={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: { xs: "90%", md: 1000 },
          maxHeight: "90vh",
          overflowY: "auto",
          bgcolor: "background.paper",
          boxShadow: 24,
          p: 4,
          borderRadius: 2,
        }}
      >
        <Typography variant="h5" sx={{ mb: 3, fontWeight: 600, color: "primary.main" }}>
          Edit Player
        </Typography>

        {serviceId && (
          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body2">
              <strong>Service:</strong> {serviceName}
            </Typography>
            <Typography variant="body2">
              <strong>Service ID:</strong> {serviceId}
            </Typography>
            {hasFetchedFormFields && (
              <Typography variant="body2">
                <strong>Available Form Fields:</strong> {formFields.length} fields loaded
              </Typography>
            )}
          </Alert>
        )}

        {isLoadingDesignations ? (
          <Typography>Loading designations...</Typography>
        ) : (
          <FormControl fullWidth margin="normal" sx={{ mb: 2 }}>
            <InputLabel>Designation</InputLabel>
            <Select
              label="Designation"
              value={editedPlayer.designation || ""}
              onChange={(e) => handleChange("designation", e.target.value)}
            >
              <MenuItem value=""><em>Select Designation</em></MenuItem>
              {designations.map((des, i) => (
                <MenuItem key={i} value={des.designation}>
                  {des.designation} ({des.accessLevel})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Access Level: {editedPlayer.accessLevel || "Not selected"}
        </Typography>

        <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>Permissions</Typography>
        <Divider sx={{ mb: 2 }} />
        <Grid container spacing={1} sx={{ pl: 2 }}>
          {[
            { key: "canSanction", label: "Can Sanction" },
            { key: "canReturnToPlayer", label: "Can Return to Player" },
            { key: "canReturnToCitizen", label: "Can Return to Citizen" },
            { key: "canForwardToPlayer", label: "Can Forward to Player" },
            { key: "canReject", label: "Can Reject" },
            { key: "canPull", label: "Can Pull" },
            { key: "canHavePool", label: "Can Bulk Applications" },
            { key: "canCorrigendum", label: "Can Corrigendum" },
            { key: "canManageBankFiles", label: "Can Manage Bank Files" },
            { key: "canWithhold", label: "Can Withhold" },
            { key: "canValidateAadhaar", label: "Can Validate Aadhaar" },
            { key: "canDirectWithheld", label: "Can Direct Withheld" },
          ].map((p) => (
            <Grid item xs={6} key={p.key}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={!!editedPlayer[p.key]}
                    onChange={(e) => handleChange(p.key, e.target.checked)}
                  />
                }
                label={p.label}
              />
            </Grid>
          ))}
          {editedPlayer.customPermissions?.map((perm) => (
            <Grid item xs={6} key={perm.name}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={perm.enabled}
                    onChange={(e) => handleChange(perm.name, e.target.checked)}
                  />
                }
                label={perm.label}
              />
            </Grid>
          ))}
        </Grid>
        <Box sx={{ display: "flex", gap: 2, mt: 2, mb: 3 }}>
          <Button variant="outlined" onClick={selectAllPermissions}>
            Select All
          </Button>
          <Button variant="outlined" onClick={deselectAllPermissions}>
            Deselect All
          </Button>
        </Box>

        <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>Action Form Options</Typography>
        <Divider sx={{ mb: 2 }} />
        <Grid container spacing={1} sx={{ pl: 2 }}>
          {[
            { key: "canSanction", label: "Include Sanction", enabled: editedPlayer.canSanction },
            { key: "canReturnToPlayer", label: "Include Return to Player", enabled: editedPlayer.canReturnToPlayer },
            { key: "canReturnToCitizen", label: "Include Return to Citizen", enabled: editedPlayer.canReturnToCitizen },
            { key: "canForwardToPlayer", label: "Include Forward to Player", enabled: editedPlayer.canForwardToPlayer },
            { key: "canReject", label: "Include Reject", enabled: editedPlayer.canReject },
            { key: "canWithhold", label: "Include Withhold", enabled: editedPlayer.canWithhold },
            { key: "canDirectWithheld", label: "Include Direct Withheld", enabled: editedPlayer.canDirectWithheld },
          ].map((opt) => (
            <Grid item xs={6} key={opt.key}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={!!actionFormOptions[opt.key]}
                    onChange={(e) => handleActionFormOptionChange(opt.key, e.target.checked)}
                    disabled={!opt.enabled}
                  />
                }
                label={opt.label}
              />
            </Grid>
          ))}
          {editedPlayer.customPermissions?.map((perm) => (
            <Grid item xs={6} key={perm.name}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={!!actionFormOptions.customPermissions?.[perm.name]}
                    onChange={(e) => handleActionFormOptionChange(perm.name, e.target.checked)}
                    disabled={!perm.enabled}
                  />
                }
                label={`Include ${perm.label}`}
              />
            </Grid>
          ))}
        </Grid>
        <Box sx={{ display: "flex", gap: 2, mt: 2, mb: 3 }}>
          <Button variant="outlined" onClick={selectAllActionFormOptions}>
            Select All
          </Button>
          <Button variant="outlined" onClick={deselectAllActionFormOptions}>
            Deselect All
          </Button>
        </Box>

        <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>Action Form Fields</Typography>
        <Divider sx={{ mb: 2 }} />
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={editedPlayer.actionForm.map((f) => f.id)}
            strategy={verticalListSortingStrategy}
          >
            {editedPlayer.actionForm.length > 0 ? (
              editedPlayer.actionForm.map((field) => (
                <SortableField
                  key={field.id}
                  id={field.id}
                  field={{ ...field, editable: field.editable ?? true }}
                  sectionId="actionForm"
                  onEditField={handleEditField}
                  onAdditonalModal={handleAdditionalModal}
                  onFieldChange={() => { }}
                  onRemoveField={handleRemoveField}
                />
              ))
            ) : (
              <Typography color="text.secondary">No fields added yet.</Typography>
            )}
          </SortableContext>
        </DndContext>

        <Button variant="contained" onClick={addActionFormField} sx={{ mt: 2 }}>
          Add Field
        </Button>

        <Box sx={{ mt: 4, display: "flex", justifyContent: "flex-end", gap: 2 }}>
          <Button variant="contained" onClick={handleSave}>
            Save
          </Button>
          <Button variant="outlined" onClick={onClose}>
            Cancel
          </Button>
        </Box>

        {isFieldModalOpen && selectedField && (
          <FieldEditModal
            selectedField={selectedField}
            sections={[{ fields: editedPlayer.actionForm }]}
            actionForm={editedPlayer.actionForm}
            onClose={() => {
              setIsFieldModalOpen(false);
              setSelectedField(null);
            }}
            updateField={updateField}
            serviceId={serviceId}
            availableFormFields={formFields}
          />
        )}

        {isAdditionalModalOpen && fieldForAdditionalModal && (
          <AdditionalFieldsModal
            sections={[{ fields: editedPlayer.actionForm }]}
            selectedField={fieldForAdditionalModal}
            banks={[]}
            onClose={() => {
              setIsAdditionalModalOpen(false);
              setFieldForAdditionalModal(null);
            }}
            updateField={updateField}
            onFieldUpdate={handleFieldUpdateFromAdditional}
            serviceId={serviceId}
            availableFormFields={formFields}
          />
        )}
      </Box>
    </Modal>
  );
};

export default PlayerEditModal;