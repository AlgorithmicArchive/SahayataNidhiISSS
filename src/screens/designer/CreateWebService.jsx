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
} from "@mui/material";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import axiosInstance from "../../axiosConfig";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import HttpIcon from "@mui/icons-material/Http";
import ApiIcon from "@mui/icons-material/Api";

// ----------------------------------------------------------------------
// MappingNode component – syncs internal state with prop changes
// ----------------------------------------------------------------------
const MappingNode = ({
  node,
  path = [],
  onUpdate,
  onAddChild,
  onRemove,
  formFields,
  level = 0,
}) => {
  const [key, setKey] = useState(node.key || "");
  const [value, setValue] = useState(node.value || "");
  const [isObject, setIsObject] = useState(!!node.children);
  const [children, setChildren] = useState(node.children || {});

  // Sync internal state when node prop changes (e.g., after loading saved config)
  useEffect(() => {
    setKey(node.key || "");
    setValue(node.value || "");
    setIsObject(!!node.children);
    setChildren(node.children || {});
  }, [node]);

  const handleKeyChange = (e) => {
    const newKey = e.target.value;
    setKey(newKey);
    onUpdate(path, {
      key: newKey,
      value: isObject ? undefined : value,
      children: isObject ? children : undefined,
    });
  };

  const handleValueChange = (e) => {
    const newValue = e.target.value;
    setValue(newValue);
    onUpdate(path, { key, value: newValue, children: undefined });
  };

  const handleToggle = (e) => {
    const newIsObject = e.target.checked;
    setIsObject(newIsObject);
    setValue("");
    setChildren({});
    onUpdate(path, {
      key,
      value: undefined,
      children: newIsObject ? {} : undefined,
    });
  };

  const handleAddChild = () => {
    const newChildKey = `child_${Object.keys(children).length + Date.now()}`;
    const newChild = {
      key: `key_${Object.keys(children).length + 1}`,
      value: "",
      children: undefined,
    };
    setChildren((prev) => ({ ...prev, [newChildKey]: newChild }));
    onAddChild(path, newChildKey);
  };

  const handleChildUpdate = (childPath, childNode) => {
    const childKey = childPath[childPath.length - 1];
    setChildren((prev) => {
      const newChildren = { ...prev };
      newChildren[childKey] = {
        key: childNode.key,
        value: childNode.value,
        children: childNode.children,
      };
      return newChildren;
    });
    onUpdate(path, {
      key,
      value: isObject ? undefined : value,
      children: { ...children, [childKey]: childNode },
    });
  };

  const handleRemoveChild = (childKey) => {
    const newChildren = { ...children };
    delete newChildren[childKey];
    setChildren(newChildren);
    onUpdate(path, {
      key,
      value: isObject ? undefined : value,
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
      <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
        <TextField
          label="Key"
          value={key}
          onChange={handleKeyChange}
          variant="outlined"
          placeholder="e.g., District"
          size="small"
          sx={{ flex: 1 }}
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
            <IconButton
              onClick={handleAddChild}
              size="small"
              sx={{ color: "primary.main" }}
            >
              <AddIcon />
            </IconButton>
          </Tooltip>
        ) : (
          <FormControl size="small" sx={{ flex: 1 }} variant="outlined">
            <InputLabel id={`field-select-${path.join("-")}`}>
              Form Field
            </InputLabel>
            <Select
              labelId={`field-select-${path.join("-")}`}
              value={value}
              label="Form Field"
              onChange={handleValueChange}
            >
              <MenuItem value="">
                <em>Select a field</em>
              </MenuItem>
              {formFields.map((field) => (
                <MenuItem key={field.id} value={field.name}>
                  {field.label} ({field.name})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
        <Tooltip title="Remove Mapping">
          <IconButton
            onClick={() => onRemove(path)}
            size="small"
            sx={{ color: "error.main" }}
          >
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
// Utility: convert API field mappings to internal format
// ----------------------------------------------------------------------
const convertFromApiFormat = (apiMappings) => {
  const result = {};
  const convertNode = (obj, parentKey) => {
    const nodeKey = `${parentKey}_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 8)}`;
    if (typeof obj === "string") {
      return { key: parentKey, value: obj, children: undefined };
    } else if (typeof obj === "object" && obj !== null) {
      const children = {};
      Object.entries(obj).forEach(([key, value]) => {
        children[
          `child_${key}_${Date.now()}_${Math.random()
            .toString(36)
            .substring(2, 8)}`
        ] = convertNode(value, key);
      });
      return { key: parentKey, value: undefined, children };
    }
    return { key: parentKey, value: "", children: undefined };
  };

  Object.entries(apiMappings).forEach(([key, value]) => {
    result[
      `key_${key}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
    ] = convertNode(value, key);
  });
  return result;
};

// ----------------------------------------------------------------------
// Main Component
// ----------------------------------------------------------------------
export default function CreateWebService() {
  const [services, setServices] = useState([]);
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [formFields, setFormFields] = useState([]);
  const [webServiceConfig, setWebServiceConfig] = useState({
    webServiceId: "",
    webServiceName: "",
    apiEndPoint: "",
    onAction: [],
    fieldMappings: {},
    headers: [],
  });

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

  // Fetch existing config AND form fields when service changes
  useEffect(() => {
    if (!selectedServiceId) {
      setFormFields([]);
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
        const configResponse = await axiosInstance.get(
          `/Designer/GetWebService?serviceId=${selectedServiceId}`
        );
        if (configResponse.data.status && configResponse.data.config) {
          const config = configResponse.data.config;
          setWebServiceConfig({
            webServiceId: config.id || "",
            webServiceName: config.webServiceName || "",
            // Use correct property name and strip quotes if present
            apiEndPoint: config.apiEndpoint ? config.apiEndpoint.replace(/^"|"$/g, '') : "",
            onAction: config.onAction ? JSON.parse(config.onAction) : [],
            fieldMappings: config.fieldMappings
              ? convertFromApiFormat(JSON.parse(config.fieldMappings))
              : {},
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
        const response = await axiosInstance.get(
          `/Designer/GetFormElements?serviceId=${selectedServiceId}`
        );
        if (response.data.status) {
          // Combine section fields and column names
          const sectionFields = Array.isArray(response.data.sections)
            ? response.data.sections.flatMap((section) =>
              (section.fields || []).map((field) => ({
                name: field.name,
                label: field.label,
                sectionName: section.sectionName || "Unknown Section",
              }))
            )
            : [];

          const columnFields = Array.isArray(response.data.columnNames)
            ? response.data.columnNames.map((colName) => ({
              name: colName,
              label: colName,
              sectionName: "Column",
            }))
            : [];

          // Deduplicate by field name
          const uniqueMap = new Map();
          [...sectionFields, ...columnFields].forEach((field) => {
            if (!uniqueMap.has(field.name)) {
              uniqueMap.set(field.name, field);
            }
          });

          // Transform to format expected by MappingNode
          const fields = Array.from(uniqueMap.values()).map((field) => ({
            id: field.name,
            name: field.name,
            label: field.label,
            type: "text",
            path:
              field.sectionName === "Column"
                ? `Column > ${field.label}`
                : `${field.sectionName} > ${field.label}`,
          }));

          setFormFields(fields);
          if (fields.length === 0) {
            toast.warn("No form fields or column names available for this service.");
          }
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

  // Handlers for basic inputs
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setWebServiceConfig((prev) => ({
      ...prev,
      [name]: value,
    }));
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
  // Field mappings management
  // --------------------------------------------------------------------
  const addRootMapping = () => {
    const newKey = `key_${Object.keys(webServiceConfig.fieldMappings).length + Date.now()}`;
    setWebServiceConfig((prev) => ({
      ...prev,
      fieldMappings: {
        ...prev.fieldMappings,
        [newKey]: {
          key: `key_${Object.keys(prev.fieldMappings).length + 1}`,
          value: "",
          children: undefined,
        },
      },
    }));
  };

  const updateMapping = (path, node) => {
    setWebServiceConfig((prev) => {
      const newMappings = JSON.parse(JSON.stringify(prev.fieldMappings));
      let current = newMappings;
      for (let i = 0; i < path.length - 1; i++) {
        current = current[path[i]].children;
      }
      if (path.length > 0) {
        current[path[path.length - 1]] = node;
      }
      return { ...prev, fieldMappings: newMappings };
    });
  };

  const addChild = (path, childKey) => {
    setWebServiceConfig((prev) => {
      const newMappings = JSON.parse(JSON.stringify(prev.fieldMappings));
      let current = newMappings;
      for (const key of path) {
        current = current[key].children;
      }
      current[childKey] = {
        key: `key_${Object.keys(current).length + 1}`,
        value: "",
        children: undefined,
      };
      return { ...prev, fieldMappings: newMappings };
    });
  };

  const removeMapping = (path) => {
    setWebServiceConfig((prev) => {
      const newMappings = JSON.parse(JSON.stringify(prev.fieldMappings));
      let current = newMappings;
      if (path.length === 1) {
        delete newMappings[path[0]];
      } else {
        for (let i = 0; i < path.length - 1; i++) {
          current = current[path[i]].children || {};
        }
        delete current[path[path.length - 1]];
      }
      return { ...prev, fieldMappings: newMappings };
    });
    toast.info(`Removed mapping: ${path.join(".")}`);
  };

  // Validate mappings – now using field.name
  const validateMappings = (mappings) => {
    const fieldNames = new Set();
    const validateNode = (node, nodePath) => {
      if (!node.key.trim()) {
        toast.error(`Empty key at path: ${nodePath.join(".")}`);
        return false;
      }
      if (node.value) {
        if (!formFields.some((f) => f.name === node.value)) {
          toast.error(`Invalid field name at path: ${nodePath.join(".")}`);
          return false;
        }
        if (fieldNames.has(node.value)) {
          toast.error(`Duplicate field name at path: ${nodePath.join(".")}`);
          return false;
        }
        fieldNames.add(node.value);
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
    return fieldNames.size > 0;
  };

  // Convert mappings to API format
  const convertToApiFormat = (mappings) => {
    const result = {};
    const convertNode = (node, target) => {
      if (node.value) {
        target[node.key] = node.value;
      } else if (node.children) {
        target[node.key] = {};
        for (const childNode of Object.values(node.children)) {
          convertNode(childNode, target[node.key]);
        }
      }
    };
    for (const node of Object.values(mappings)) {
      convertNode(node, result);
    }
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
    if (Object.keys(webServiceConfig.fieldMappings).length === 0) {
      toast.error("At least one field mapping is required");
      return;
    }
    if (!validateMappings(webServiceConfig.fieldMappings)) {
      return;
    }

    // ⚠️ TEMPORARY WORKAROUND: If your database column "apiendpoint" is of type JSON,
    // the value must be a valid JSON string. JSON.stringify adds quotes.
    // If you change the column to TEXT, remove JSON.stringify from apiEndPoint.
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
    "Correction",
    "Corrigendum",
    "Amendment",
    "Withheld",
  ];

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
                        <InputLabel id="service-select-label">
                          Select Service
                        </InputLabel>
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
                            <MenuItem
                              key={service.serviceId}
                              value={service.serviceId}
                            >
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
                          <IconButton
                            onClick={() => removeHeader(index)}
                            size="small"
                            color="error"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Box>
                      ))}
                    </Box>
                  )}
                </CardContent>
              </Card>

              {/* Field Mappings Card */}
              <Card variant="outlined" sx={{ mb: 4, borderRadius: 2 }}>
                <CardContent>
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      4. Field Mappings
                    </Typography>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<AddIcon />}
                      onClick={addRootMapping}
                      disabled={!selectedServiceId || formFields.length === 0}
                    >
                      Add Mapping
                    </Button>
                  </Box>
                  {Object.keys(webServiceConfig.fieldMappings).length === 0 ? (
                    <Typography color="text.secondary" sx={{ fontStyle: "italic" }}>
                      No field mappings yet. Click "Add Mapping" to start.
                    </Typography>
                  ) : (
                    Object.entries(webServiceConfig.fieldMappings).map(([key, node]) => (
                      <MappingNode
                        key={key}
                        node={node}
                        path={[key]}
                        onUpdate={updateMapping}
                        onAddChild={addChild}
                        onRemove={removeMapping}
                        formFields={formFields}
                      />
                    ))
                  )}
                </CardContent>
              </Card>

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