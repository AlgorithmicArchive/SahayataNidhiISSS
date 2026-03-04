import React, { useState, useEffect } from "react";
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
  IconButton,
  Tooltip,
  Switch,
  Chip,
  Grid,
  Card,
  CardContent,
  CircularProgress,
} from "@mui/material";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import axiosInstance from "../../axiosConfig";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import HttpIcon from "@mui/icons-material/Http";
import ApiIcon from "@mui/icons-material/Api";

// ----------------------------------------------------------------------
// MappingNode component – updated for the new structure
// ----------------------------------------------------------------------
const MappingNode = ({ node, path = [], onUpdate, onAddChild, onRemove, formFields, level = 0 }) => {
  const [key, setKey] = useState(node.key || "");
  const [mapping, setMapping] = useState(node.mapping || null);
  const [isObject, setIsObject] = useState(!!node.children);
  const [children, setChildren] = useState(node.children || {});

  useEffect(() => {
    setKey(node.key || "");
    setMapping(node.mapping || null);
    setIsObject(!!node.children);
    setChildren(node.children || {});
  }, [node]);

  const handleKeyChange = (e) => {
    const newKey = e.target.value;
    setKey(newKey);
    onUpdate(path, {
      key: newKey,
      mapping: isObject ? undefined : mapping,
      children: isObject ? children : undefined,
    });
  };

  const updateMapping = (newMapping) => {
    setMapping(newMapping);
    onUpdate(path, {
      key,
      mapping: newMapping,
      children: undefined,
    });
  };

  const handleFieldSelect = (fieldName) => {
    const field = formFields.find(f => f.name === fieldName);
    if (!field) return;
    // Auto‑set type and column based on the field's section
    const sourceType = field.section === "Column" ? "column" : "json";
    const sourceColumn = field.section === "Column" ? "" : field.section; // you might map section to actual column name
    updateMapping({
      sourceField: fieldName,
      sourceType,
      sourceColumn,
    });
  };

  const handleToggle = (e) => {
    const newIsObject = e.target.checked;
    setIsObject(newIsObject);
    setMapping(null);
    setChildren({});
    onUpdate(path, {
      key,
      mapping: undefined,
      children: newIsObject ? {} : undefined,
    });
  };

  const handleAddChild = () => {
    const newChildKey = `child_${Object.keys(children).length + Date.now()}`;
    const newChild = {
      key: `key_${Object.keys(children).length + 1}`,
      mapping: undefined,
      children: undefined,
    };
    setChildren((prev) => ({ ...prev, [newChildKey]: newChild }));
    onAddChild(path, newChildKey);
  };

  const handleChildUpdate = (childPath, childNode) => {
    const childKey = childPath[childPath.length - 1];
    setChildren((prev) => {
      const newChildren = { ...prev };
      newChildren[childKey] = childNode;
      return newChildren;
    });
    onUpdate(path, {
      key,
      mapping: undefined,
      children: { ...children, [childKey]: childNode },
    });
  };

  const handleRemoveChild = (childKey) => {
    const newChildren = { ...children };
    delete newChildren[childKey];
    setChildren(newChildren);
    onUpdate(path, {
      key,
      mapping: undefined,
      children: newChildren,
    });
  };

  return (
    <Box
      sx={{
        ml: level * 3,
        mb: 2,
        p: 1.5,
        borderLeft: level > 0 ? "3px solid" : "none",
        borderLeftColor: level > 0 ? "primary.light" : "transparent",
        bgcolor: level % 2 === 0 ? "background.paper" : "grey.50",
        borderRadius: 1,
      }}
    >
      <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start", flexWrap: "wrap" }}>
        <TextField
          label="Key"
          value={key}
          onChange={handleKeyChange}
          variant="outlined"
          placeholder="e.g., sanctionedAt"
          size="small"
          sx={{ flex: 1, minWidth: 150 }}
        />
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 120 }}>
          <Typography variant="body2" color="text.secondary">
            Value
          </Typography>
          <Switch
            checked={isObject}
            onChange={handleToggle}
            size="small"
            color="primary"
          />
          <Typography variant="body2" color="text.secondary">
            Object
          </Typography>
        </Box>
        {isObject ? (
          <Tooltip title="Add Child Key">
            <IconButton onClick={handleAddChild} size="small" sx={{ color: "primary.main" }}>
              <AddIcon />
            </IconButton>
          </Tooltip>
        ) : (
          <>
            <FormControl size="small" sx={{ flex: 2, minWidth: 200 }} variant="outlined">
              <InputLabel id={`field-select-${path.join("-")}`}>Source Field</InputLabel>
              <Select
                labelId={`field-select-${path.join("-")}`}
                value={mapping?.sourceField || ""}
                label="Source Field"
                onChange={(e) => handleFieldSelect(e.target.value)}
              >
                <MenuItem value="">
                  <em>Select a field</em>
                </MenuItem>
                {formFields.map((field) => (
                  <MenuItem key={field.id} value={field.name}>
                    {field.label} ({field.name}) {field.section && `[${field.section}]`}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ width: 100 }} variant="outlined">
              <InputLabel id={`type-select-${path.join("-")}`}>Type</InputLabel>
              <Select
                labelId={`type-select-${path.join("-")}`}
                value={mapping?.sourceType || "json"}
                label="Type"
                onChange={(e) => updateMapping({ ...mapping, sourceType: e.target.value })}
              >
                <MenuItem value="column">column</MenuItem>
                <MenuItem value="json">json</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Column"
              value={mapping?.sourceColumn || ""}
              onChange={(e) => updateMapping({ ...mapping, sourceColumn: e.target.value })}
              size="small"
              placeholder="e.g., WorkFlow"
              sx={{ flex: 1, minWidth: 150 }}
            />
          </>
        )}
        <Tooltip title="Remove Mapping">
          <IconButton onClick={() => onRemove(path)} size="small" sx={{ color: "error.main" }}>
            <DeleteIcon />
          </IconButton>
        </Tooltip>
      </Box>
      {isObject &&
        Object.entries(children).map(([childKey, childNode]) => (
          <MappingNode
            key={childKey}
            node={childNode}
            path={[...path, childKey]}
            onUpdate={handleChildUpdate}
            onAddChild={onAddChild}
            onRemove={() => handleRemoveChild(childKey)}
            formFields={formFields}
            level={level + 1}
          />
        ))}
    </Box>
  );
};

// ----------------------------------------------------------------------
// Utility: convert API field mappings (action‑keyed object) to internal format
// ----------------------------------------------------------------------
const convertFromApiFormat = (apiMappings) => {
  const result = {};
  const convertNode = (obj, parentKey) => {
    const nodeKey = `${parentKey}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    if (typeof obj === "string") {
      // Old format fallback – treat as column type (or you could discard)
      return {
        key: parentKey,
        mapping: {
          sourceField: obj,
          sourceType: "column",
          sourceColumn: "",
        },
      };
    } else if (typeof obj === "object" && obj !== null) {
      // Check if it's a leaf with field/type/respectiveColumn
      if (obj.hasOwnProperty("field") && obj.hasOwnProperty("type") && obj.hasOwnProperty("respectiveColumn")) {
        return {
          key: parentKey,
          mapping: {
            sourceField: obj.field,
            sourceType: obj.type,
            sourceColumn: obj.respectiveColumn,
          },
        };
      } else {
        // It's a nested object (children)
        const children = {};
        Object.entries(obj).forEach(([key, value]) => {
          children[`child_${key}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`] = convertNode(value, key);
        });
        return { key: parentKey, children };
      }
    }
    return { key: parentKey, mapping: { sourceField: "", sourceType: "json", sourceColumn: "" } };
  };

  Object.entries(apiMappings).forEach(([action, mapping]) => {
    const actionMappings = {};
    Object.entries(mapping).forEach(([key, value]) => {
      actionMappings[`key_${key}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`] = convertNode(value, key);
    });
    result[action] = actionMappings;
  });
  return result;
};

// ----------------------------------------------------------------------
// Main Component
// ----------------------------------------------------------------------
export default function CreateWebService() {
  const [services, setServices] = useState([]);
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [formFields, setFormFields] = useState([]);            // base form fields
  const [actionFields, setActionFields] = useState({});        // fields keyed by action (Corrigendum, Withheld)
  const [loadingActionFields, setLoadingActionFields] = useState(false);
  const [webServiceConfig, setWebServiceConfig] = useState({
    webServiceId: "",
    webServiceName: "",
    apiEndPoint: "",
    onAction: [],
    fieldMappings: {},        // { "Sanction": {...}, "Corrigendum": {...}, "Withheld": {...} }
    headers: [],
  });

  // Actions that get their own mapping card
  const specialActions = ["Sanction", "Corrigendum", "Withheld"];

  // Configuration per action: whether to include base form fields in the dropdown
  const actionConfig = {
    Sanction: { includeBaseFields: true },
    Corrigendum: { includeBaseFields: false },
    Withheld: { includeBaseFields: false },
  };

  // Fetch services on mount
  useEffect(() => {
    async function fetchServices() {
      try {
        const response = await axiosInstance.get("/Base/GetServices");
        if (response.data.status && response.data.services) {
          setServices(response.data.services);
        } else {
          toast.error("Failed to fetch services: No services found");
        }
      } catch (err) {
        console.error("Fetch services error:", err);
        toast.error("Error fetching services");
      }
    }
    fetchServices();
  }, []);

  // --------------------------------------------------------------------
  // Fetch existing web service config AND form fields when service changes
  // --------------------------------------------------------------------
  useEffect(() => {
    if (!selectedServiceId) {
      setFormFields([]);
      setActionFields({});
      setWebServiceConfig({
        webServiceId: "",
        webServiceName: "",
        apiEndPoint: "",
        onAction: [],
        fieldMappings: {},
        headers: [],
      });
      return;
    }

    async function fetchWebServiceConfig() {
      try {
        const configResponse = await axiosInstance.get(`/Designer/GetWebService?serviceId=${selectedServiceId}`);
        if (configResponse.data.status && configResponse.data.config) {
          const config = configResponse.data.config;
          let parsedFieldMappings = {};
          try {
            const raw = JSON.parse(config.fieldMappings || "{}");
            // If stored format is flat (old), wrap it under "Sanction" or keep as is?
            // For safety, we check if any of the special action keys exist. If not, we assume it's a flat mapping.
            if (raw && typeof raw === "object") {
              const hasSpecialKey = specialActions.some(action => raw[action] !== undefined);
              if (!hasSpecialKey && Object.keys(raw).length > 0) {
                // Assume flat mapping – assign it to "Sanction" (or whichever action is selected later)
                parsedFieldMappings = { Sanction: raw };
              } else {
                parsedFieldMappings = raw;
              }
            }
          } catch (e) {
            parsedFieldMappings = {};
          }

          setWebServiceConfig({
            webServiceId: config.id || "",
            webServiceName: config.webServiceName || "",
            apiEndPoint: config.apiEndpoint ? config.apiEndpoint.replace(/^"|"$/g, '') : "",
            onAction: config.onAction ? JSON.parse(config.onAction) : [],
            fieldMappings: convertFromApiFormat(parsedFieldMappings),
            headers: config.headers ? JSON.parse(config.headers) : [],
          });
        } else {
          setWebServiceConfig({
            webServiceId: "",
            webServiceName: "",
            apiEndPoint: "",
            onAction: [],
            fieldMappings: {},
            headers: [],
          });
          toast.info("No existing configuration found for this service");
        }
      } catch (err) {
        console.error("Fetch web service config error:", err);
        toast.error("Error fetching web service configuration");
        setWebServiceConfig({
          webServiceId: "",
          webServiceName: "",
          apiEndPoint: "",
          onAction: [],
          fieldMappings: {},
          headers: [],
        });
      }
    }

    // Fetch form elements from dedicated endpoint
    async function fetchFormElements() {
      try {
        const response = await axiosInstance.get(`/Designer/GetFormElements?serviceId=${selectedServiceId}`);
        if (response.data.status) {
          // Combine section fields and column names
          const sectionFields = Array.isArray(response.data.sections)
            ? response.data.sections.flatMap((section) =>
              (section.fields || []).map((field) => ({
                name: field.name,
                label: field.label,
                section: section.sectionName || "Unknown Section",
              }))
            )
            : [];

          const columnFields = Array.isArray(response.data.columnNames)
            ? response.data.columnNames.map((colName) => ({
              name: colName,
              label: colName,
              section: "Column",
            }))
            : [];

          // Deduplicate by field name
          const uniqueMap = new Map();
          [...sectionFields, ...columnFields].forEach((field) => {
            if (!uniqueMap.has(field.name)) {
              uniqueMap.set(field.name, field);
            }
          });

          const fields = Array.from(uniqueMap.values()).map((field) => ({
            id: field.name,
            name: field.name,
            label: field.label,
            type: "text",
            path: field.section === "Column" ? `Column > ${field.label}` : `${field.section} > ${field.label}`,
            section: field.section,
          }));

          setFormFields(fields);
        } else {
          toast.error(response.data.message || "Failed to load form fields");
          setFormFields([]);
        }
      } catch (err) {
        console.error("Fetch form elements error:", err);
        toast.error("Error loading form fields");
        setFormFields([]);
      }
    }

    fetchWebServiceConfig();
    fetchFormElements();
  }, [selectedServiceId]);

  // --------------------------------------------------------------------
  // Fetch action‑specific fields for all selected special actions
  // --------------------------------------------------------------------
  useEffect(() => {
    if (!selectedServiceId) {
      setActionFields({});
      return;
    }

    const selectedActions = webServiceConfig.onAction || [];
    const actionsToFetch = selectedActions.filter(action =>
      specialActions.includes(action)
    );

    if (actionsToFetch.length === 0) {
      setActionFields({});
      return;
    }

    const fetchActionFields = async () => {
      setLoadingActionFields(true);
      try {
        const promises = actionsToFetch.map(action =>
          axiosInstance.get(`/Designer/GetActionFields`, {
            params: { actionTaken: action }
          })
        );

        const results = await Promise.all(promises);
        const fieldsByAction = {};
        results.forEach((res, index) => {
          const action = actionsToFetch[index];
          const rawFields = res.data.fields || [];
          const transformed = rawFields.map(f => ({
            id: f.name,
            name: f.name,
            label: f.label,
            type: "text",
            path: `${f.section || "Action"} > ${f.label}`,
            section: f.section || "Action",
          }));
          fieldsByAction[action] = transformed;
        });

        setActionFields(fieldsByAction);
      } catch (err) {
        console.error("Error fetching action fields:", err);
        toast.error("Could not load fields for selected actions");
      } finally {
        setLoadingActionFields(false);
      }
    };

    fetchActionFields();
  }, [selectedServiceId, webServiceConfig.onAction]);

  // Combine base fields and action fields for a given action, respecting config
  const getAllFieldsForAction = (action) => {
    const config = actionConfig[action] || { includeBaseFields: false };
    const base = config.includeBaseFields ? formFields : [];
    const actionSpecific = actionFields[action] || [];
    const combined = [...base, ...actionSpecific];
    // Deduplicate by field name (base first)
    const unique = Array.from(new Map(combined.map(f => [f.name, f])).values());
    return unique;
  };

  // Handlers for basic inputs
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setWebServiceConfig((prev) => ({ ...prev, [name]: value }));
  };

  // --------------------------------------------------------------------
  // Headers management
  // --------------------------------------------------------------------
  const addHeader = () => {
    setWebServiceConfig((prev) => ({
      ...prev,
      headers: [...prev.headers, { key: "", value: "" }],
    }));
  };

  const updateHeader = (index, field, newValue) => {
    setWebServiceConfig((prev) => {
      const updated = [...prev.headers];
      updated[index] = { ...updated[index], [field]: newValue };
      return { ...prev, headers: updated };
    });
  };

  const removeHeader = (index) => {
    setWebServiceConfig((prev) => ({
      ...prev,
      headers: prev.headers.filter((_, i) => i !== index),
    }));
  };

  // --------------------------------------------------------------------
  // Field mappings management – per action
  // --------------------------------------------------------------------
  const addRootMappingForAction = (action) => {
    setWebServiceConfig((prev) => {
      const currentMappings = prev.fieldMappings[action] || {};
      const newKey = `key_${Object.keys(currentMappings).length + Date.now()}`;
      return {
        ...prev,
        fieldMappings: {
          ...prev.fieldMappings,
          [action]: {
            ...currentMappings,
            [newKey]: {
              key: `key_${Object.keys(currentMappings).length + 1}`,
              mapping: null,
              children: undefined,
            },
          },
        },
      };
    });
  };

  const updateMappingForAction = (action, path, node) => {
    setWebServiceConfig((prev) => {
      const actionMappings = JSON.parse(JSON.stringify(prev.fieldMappings[action] || {}));
      let current = actionMappings;
      for (let i = 0; i < path.length - 1; i++) {
        current = current[path[i]].children;
      }
      if (path.length > 0) {
        current[path[path.length - 1]] = node;
      }
      return {
        ...prev,
        fieldMappings: {
          ...prev.fieldMappings,
          [action]: actionMappings,
        },
      };
    });
  };

  const addChildForAction = (action, path, childKey) => {
    setWebServiceConfig((prev) => {
      const actionMappings = JSON.parse(JSON.stringify(prev.fieldMappings[action] || {}));
      let current = actionMappings;
      for (const key of path) {
        current = current[key].children;
      }
      current[childKey] = {
        key: `key_${Object.keys(current).length + 1}`,
        mapping: null,
        children: undefined,
      };
      return {
        ...prev,
        fieldMappings: {
          ...prev.fieldMappings,
          [action]: actionMappings,
        },
      };
    });
  };

  const removeMappingForAction = (action, path) => {
    setWebServiceConfig((prev) => {
      const actionMappings = JSON.parse(JSON.stringify(prev.fieldMappings[action] || {}));
      let current = actionMappings;
      if (path.length === 1) {
        delete actionMappings[path[0]];
      } else {
        for (let i = 0; i < path.length - 1; i++) {
          current = current[path[i]].children || {};
        }
        delete current[path[path.length - 1]];
      }
      return {
        ...prev,
        fieldMappings: {
          ...prev.fieldMappings,
          [action]: actionMappings,
        },
      };
    });
    toast.info(`Removed mapping from ${action}: ${path.join(".")}`);
  };

  // Validate mappings per action
  const validateMappingsForAction = (action, mappings) => {
    const allFields = getAllFieldsForAction(action);
    const validateNode = (node, nodePath) => {
      if (!node.key.trim()) {
        toast.error(`${action}: Empty key at path: ${nodePath.join(".")}`);
        return false;
      }
      if (node.mapping) {
        const { sourceField, sourceType, sourceColumn } = node.mapping;
        if (!sourceField) {
          toast.error(`${action}: Missing source field at path: ${nodePath.join(".")}`);
          return false;
        }
        if (!sourceType) {
          toast.error(`${action}: Missing source type at path: ${nodePath.join(".")}`);
          return false;
        }
        // Optionally validate that sourceField exists in allFields
        if (!allFields.some(f => f.name === sourceField)) {
          toast.error(`${action}: Invalid source field '${sourceField}' at path: ${nodePath.join(".")}`);
          return false;
        }
        // sourceColumn can be empty if type is 'column'? Adjust as needed.
      }
      if (node.children) {
        for (const [childKey, childNode] of Object.entries(node.children)) {
          if (!validateNode(childNode, [...nodePath, childKey])) {
            return false;
          }
        }
      }
      return true;
    };
    for (const [key, node] of Object.entries(mappings)) {
      if (!validateNode(node, [key])) return false;
    }
    return true;
  };

  // Convert mappings to API format (action‑keyed object) with the new structure
  const convertToApiFormat = (mappingsByAction) => {
    const result = {};
    const convertNode = (node, target) => {
      if (node.mapping) {
        target[node.key] = {
          field: node.mapping.sourceField,
          type: node.mapping.sourceType,
          respectiveColumn: node.mapping.sourceColumn,
        };
      } else if (node.children) {
        target[node.key] = {};
        for (const childNode of Object.values(node.children)) {
          convertNode(childNode, target[node.key]);
        }
      }
    };

    Object.entries(mappingsByAction).forEach(([action, actionMappings]) => {
      const actionResult = {};
      for (const node of Object.values(actionMappings)) {
        convertNode(node, actionResult);
      }
      result[action] = actionResult;
    });
    return result;
  };

  // Save configuration
  const handleSave = async () => {
    if (!selectedServiceId) {
      toast.error("Please select a service");
      return;
    }
    if (!webServiceConfig.apiEndPoint.trim()) {
      toast.error("API endpoint is required");
      return;
    }
    if (webServiceConfig.onAction.length === 0) {
      toast.error("Please select at least one action");
      return;
    }

    // Validate each selected special action has mappings and they are valid
    const selectedSpecial = webServiceConfig.onAction.filter(a => specialActions.includes(a));
    for (const action of selectedSpecial) {
      const mappings = webServiceConfig.fieldMappings[action] || {};
      if (Object.keys(mappings).length === 0) {
        toast.error(`Please add at least one field mapping for ${action}`);
        return;
      }
      if (!validateMappingsForAction(action, mappings)) {
        return;
      }
    }

    const payload = {
      webServiceId: webServiceConfig.webServiceId,
      serviceId: selectedServiceId,
      webServiceName: webServiceConfig.webServiceName,
      apiEndPoint: JSON.stringify(webServiceConfig.apiEndPoint),
      onAction: JSON.stringify(webServiceConfig.onAction),
      fieldMappings: JSON.stringify(convertToApiFormat(webServiceConfig.fieldMappings)),
      headers: JSON.stringify(webServiceConfig.headers),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const formdata = new FormData();
    Object.keys(payload).forEach((key) => {
      formdata.append(key, payload[key]);
    });

    try {
      const response = await axiosInstance.post("/Designer/SaveWebService", formdata);
      if (response.data.status) {
        toast.success("Web service configuration saved successfully!");
        setWebServiceConfig({
          webServiceId: "",
          webServiceName: "",
          apiEndPoint: "",
          onAction: [],
          fieldMappings: {},
          headers: [],
        });
        setSelectedServiceId("");
      } else {
        toast.error(response.data.message || "Failed to save configuration");
      }
    } catch (err) {
      console.error("Save configuration error:", err);
      toast.error(err.response?.data?.message || "Error saving configuration");
    }
  };

  const actionOptions = [
    "Submission",
    "Rejection",
    "Sanction",
    "Corrigendum",
    "Amendment",
    "Withheld",
  ];

  // Selected actions that should have mapping cards
  const selectedSpecialActions = webServiceConfig.onAction.filter(a => specialActions.includes(a));

  return (
    <Box sx={{ bgcolor: "grey.100", minHeight: "100vh", py: 4 }}>
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        pauseOnHover
        theme="colored"
      />
      <Grid container justifyContent="center">
        <Grid item xs={12} md={10} lg={8}>
          <Paper
            elevation={3}
            sx={{
              borderRadius: 3,
              overflow: "hidden",
              background: "linear-gradient(145deg, #ffffff 0%, #f5f7fa 100%)",
            }}
          >
            {/* Header */}
            <Box
              sx={{
                p: 4,
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                color: "white",
              }}
            >
              <Typography variant="h4" sx={{ fontWeight: 700 }}>
                <ApiIcon sx={{ mr: 1, verticalAlign: "middle" }} />
                Web Service Configuration
              </Typography>
              <Typography variant="subtitle1" sx={{ mt: 1, opacity: 0.9 }}>
                Connect your service to external APIs with custom mappings and headers
              </Typography>
            </Box>

            <Box sx={{ p: 4 }}>
              {/* Service & Basic Info Card */}
              <Card variant="outlined" sx={{ mb: 4, borderRadius: 2 }}>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
                    1. Service & Basic Info
                  </Typography>
                  <Grid container spacing={3}>
                    <Grid item xs={12}>
                      <FormControl fullWidth variant="outlined">
                        <InputLabel id="service-select-label">Select Service</InputLabel>
                        <Select
                          labelId="service-select-label"
                          value={selectedServiceId}
                          label="Select Service"
                          onChange={(e) => setSelectedServiceId(e.target.value)}
                        >
                          <MenuItem value="">
                            <em>Select a service</em>
                          </MenuItem>
                          {services.map((service) => (
                            <MenuItem key={service.serviceId} value={service.serviceId}>
                              {service.serviceName}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Web Service Name"
                        name="webServiceName"
                        value={webServiceConfig.webServiceName}
                        onChange={handleInputChange}
                        variant="outlined"
                        placeholder="e.g., Payment Gateway"
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="API Endpoint"
                        name="apiEndPoint"
                        value={webServiceConfig.apiEndPoint}
                        onChange={handleInputChange}
                        variant="outlined"
                        placeholder="https://api.example.com/endpoint"
                        InputProps={{
                          startAdornment: <HttpIcon sx={{ mr: 1, color: "action.active" }} />,
                        }}
                      />
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>

              {/* Actions Card */}
              <Card variant="outlined" sx={{ mb: 4, borderRadius: 2 }}>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
                    2. Trigger Actions
                  </Typography>
                  <FormControl fullWidth variant="outlined">
                    <InputLabel id="action-select-label">Actions</InputLabel>
                    <Select
                      labelId="action-select-label"
                      name="onAction"
                      multiple
                      value={webServiceConfig.onAction}
                      onChange={handleInputChange}
                      label="Actions"
                      renderValue={(selected) => (
                        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                          {selected.map((value) => (
                            <Chip key={value} label={value} size="small" />
                          ))}
                        </Box>
                      )}
                    >
                      {actionOptions.map((action) => (
                        <MenuItem key={action} value={action}>
                          {action}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </CardContent>
              </Card>

              {/* Headers Card */}
              <Card variant="outlined" sx={{ mb: 4, borderRadius: 2 }}>
                <CardContent>
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      3. HTTP Headers
                    </Typography>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<AddIcon />}
                      onClick={addHeader}
                      disabled={!selectedServiceId}
                    >
                      Add Header
                    </Button>
                  </Box>
                  {webServiceConfig.headers.length === 0 ? (
                    <Typography color="text.secondary" sx={{ fontStyle: "italic" }}>
                      No headers added. Click "Add Header" to include API keys or custom headers.
                    </Typography>
                  ) : (
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      {webServiceConfig.headers.map((header, index) => (
                        <Box key={index} sx={{ display: "flex", gap: 2, alignItems: "center" }}>
                          <TextField
                            label="Header Key"
                            value={header.key}
                            onChange={(e) => updateHeader(index, "key", e.target.value)}
                            placeholder="e.g., X-API-Key"
                            size="small"
                            sx={{ flex: 1 }}
                          />
                          <TextField
                            label="Header Value"
                            value={header.value}
                            onChange={(e) => updateHeader(index, "value", e.target.value)}
                            placeholder="your-api-key"
                            size="small"
                            sx={{ flex: 1 }}
                          />
                          <IconButton onClick={() => removeHeader(index)} size="small" color="error">
                            <DeleteIcon />
                          </IconButton>
                        </Box>
                      ))}
                    </Box>
                  )}
                </CardContent>
              </Card>

              {/* Field Mappings – separate card per selected special action */}
              {loadingActionFields && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
                  <CircularProgress size={20} />
                  <Typography variant="body2" color="text.secondary">
                    Loading action‑specific fields...
                  </Typography>
                </Box>
              )}

              {selectedSpecialActions.length === 0 ? (
                <Card variant="outlined" sx={{ mb: 4, borderRadius: 2 }}>
                  <CardContent>
                    <Typography color="text.secondary" sx={{ fontStyle: "italic" }}>
                      Select Sanction, Corrigendum, or Withheld actions to configure field mappings.
                    </Typography>
                  </CardContent>
                </Card>
              ) : (
                selectedSpecialActions.map((action) => (
                  <Card key={action} variant="outlined" sx={{ mb: 4, borderRadius: 2 }}>
                    <CardContent>
                      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                          {action} Field Mappings
                        </Typography>
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<AddIcon />}
                          onClick={() => addRootMappingForAction(action)}
                          disabled={!selectedServiceId || getAllFieldsForAction(action).length === 0}
                        >
                          Add Mapping
                        </Button>
                      </Box>

                      {Object.keys(webServiceConfig.fieldMappings[action] || {}).length === 0 ? (
                        <Typography color="text.secondary" sx={{ fontStyle: "italic" }}>
                          No field mappings for {action}. Click "Add Mapping" to start.
                        </Typography>
                      ) : (
                        Object.entries(webServiceConfig.fieldMappings[action] || {}).map(([key, node]) => (
                          <MappingNode
                            key={key}
                            node={node}
                            path={[key]}
                            onUpdate={(path, node) => updateMappingForAction(action, path, node)}
                            onAddChild={(path, childKey) => addChildForAction(action, path, childKey)}
                            onRemove={(path) => removeMappingForAction(action, path)}
                            formFields={getAllFieldsForAction(action)}
                          />
                        ))
                      )}
                    </CardContent>
                  </Card>
                ))
              )}

              {/* Save Button */}
              <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                <Button
                  variant="contained"
                  size="large"
                  onClick={handleSave}
                  sx={{
                    px: 6,
                    py: 1.5,
                    borderRadius: 2,
                    textTransform: "none",
                    fontWeight: 600,
                    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                    "&:hover": {
                      background: "linear-gradient(135deg, #5a67d8 0%, #6b46a0 100%)",
                      transform: "translateY(-2px)",
                      boxShadow: "0 6px 12px rgba(102,126,234,0.3)",
                    },
                    transition: "all 0.2s",
                  }}
                >
                  Save Configuration
                </Button>
              </Box>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}