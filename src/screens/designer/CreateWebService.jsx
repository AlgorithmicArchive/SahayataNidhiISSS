import React, { useState, useEffect, useMemo } from "react";
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
  CircularProgress,
  ListSubheader,
  Divider,
  Alert,
  FormControlLabel,
} from "@mui/material";

import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import axiosInstance from "../../axiosConfig";

import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import HttpIcon from "@mui/icons-material/Http";
import WebhookIcon from "@mui/icons-material/Webhook";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import GavelIcon from "@mui/icons-material/Gavel";
import BlockIcon from "@mui/icons-material/Block";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";

// ----------------------------------------------------------------------
// Trigger Configurations
// ----------------------------------------------------------------------
const TRIGGERS = {
  APPLICATION_SANCTIONED: {
    label: "Application Sanctioned",
    icon: <CheckCircleOutlineIcon />,
    table: "citizen_applications",
    description: "Triggered when a citizen application is sanctioned.",
    includeFormFields: true,
  },
  CORRIGENDUM_SANCTIONED: {
    label: "Corrigendum Sanctioned",
    icon: <GavelIcon />,
    table: "corrigendum",
    description: "Triggered when a corrigendum is sanctioned.",
    includeFormFields: false,
  },
  WITHHELD_APPROVED: {
    label: "Withheld Approved",
    icon: <BlockIcon />,
    table: "withheld_applications",
    description: "Triggered when a withheld application is approved/released.",
    includeFormFields: false,
  },
};

// ----------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------
const parseBool = (value, fallback = true) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() !== "false";
  return fallback;
};

const parseIntSafe = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : fallback;
};

// ----------------------------------------------------------------------
// MappingNode component (Native Select - Bulletproof Fix)
// ----------------------------------------------------------------------
const MappingNode = ({
  node,
  path = [],
  onUpdate,
  onAddChild,
  onRemove,
  availableSources,
  level = 0,
}) => {
  const key = node.key || "";
  const mapping = node.mapping || null;
  const isObject = !!node.children;
  const children = node.children || {};

  const groupedSources = useMemo(() => {
    const groups = {};
    availableSources.forEach((src) => {
      if (!groups[src.group]) groups[src.group] = [];
      groups[src.group].push(src);
    });
    return groups;
  }, [availableSources]);

  const handleKeyChange = (e) => {
    const newKey = e.target.value;
    onUpdate(path, {
      key: newKey,
      mapping: isObject ? undefined : mapping,
      children: isObject ? children : undefined,
    });
  };

  const updateMapping = (newMapping) => {
    onUpdate(path, { key, mapping: newMapping, children: undefined });
  };

  const getCurrentSourceValue = () => {
    if (!mapping || !mapping.sourceField) return "";
    if (mapping.sourceType === "column") return `col:${mapping.sourceField}`;
    if (mapping.sourceType === "lookup")
      return `lookup:${mapping.lookupTable || ""}:${mapping.sourceField}`;
    return `form:${mapping.sourceField}`;
  };

  const handleToggle = (e) => {
    const newIsObject = e.target.checked;
    onUpdate(path, {
      key,
      mapping: undefined,
      children: newIsObject ? {} : undefined,
    });
  };

  const handleAddChild = () => {
    const newChildKey = `child_${Object.keys(children).length + Date.now()}`;
    onAddChild(path, newChildKey);
  };

  const handleChildUpdate = (childPath, childNode) => {
    const childKey = childPath[childPath.length - 1];
    onUpdate(path, {
      key,
      mapping: undefined,
      children: { ...children, [childKey]: childNode },
    });
  };

  const handleRemoveChild = (childKey) => {
    const newChildren = { ...children };
    delete newChildren[childKey];
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
        p: 2,
        borderLeft: level > 0 ? "3px solid #2562E9" : "none",
        bgcolor: level % 2 === 0 ? "#FFFFFF" : "#F8FAFC",
        borderRadius: 2,
        border: "1px solid #E2E8F0",
      }}
    >
      <Box
        sx={{
          display: "flex",
          gap: 2,
          alignItems: "flex-start",
          flexWrap: "wrap",
        }}
      >
        <TextField
          label="JSON Key"
          value={key}
          onChange={handleKeyChange}
          placeholder="e.g., sanctionedAt"
          size="small"
          sx={{ flex: 1, minWidth: 150 }}
        />

        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            minWidth: 120,
            mt: 1,
          }}
        >
          <Typography
            variant="body2"
            color={isObject ? "#2562E9" : "#64748B"}
            fontWeight={600}
          >
            Value
          </Typography>

          <Switch
            checked={isObject}
            onChange={handleToggle}
            size="small"
            color="primary"
          />

          <Typography
            variant="body2"
            color={isObject ? "#64748B" : "#2562E9"}
            fontWeight={600}
          >
            Object
          </Typography>
        </Box>

        {isObject ? (
          <Tooltip title="Add Child Key">
            <IconButton
              onClick={handleAddChild}
              size="small"
              sx={{ color: "#2562E9", mt: 0.5 }}
            >
              <AddIcon />
            </IconButton>
          </Tooltip>
        ) : (
          <FormControl
            size="small"
            sx={{ flex: 2, minWidth: 250 }}
            variant="outlined"
          >
            <InputLabel shrink>Map to Source Column / Field</InputLabel>
            <Select
              native // ✅ Bypasses MUI's buggy custom menu entirely
              value={getCurrentSourceValue()}
              onChange={(e) => {
                const val = e.target.value;
                if (!val) return;
                const selected = availableSources.find((s) => s.value === val);
                if (selected) {
                  updateMapping({
                    sourceField: selected.sourceField,
                    sourceType: selected.sourceType,
                    sourceColumn: selected.sourceColumn,
                    lookupTable: selected.lookupTable || "",
                  });
                }
              }}
              label="Map to Source Column / Field"
            >
              <option value="">Select a source</option>
              {Object.entries(groupedSources).map(([group, items]) => (
                <optgroup key={group} label={group}>
                  {items.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </FormControl>
        )}

        <Tooltip title="Remove Mapping">
          <IconButton
            onClick={() => onRemove(path)}
            size="small"
            sx={{ color: "#DC2626", mt: 0.5 }}
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
            availableSources={availableSources}
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
  if (!apiMappings || typeof apiMappings !== "object") return {};

  const result = {};

  const convertNode = (obj, parentKey) => {
    const nodeKey = `${parentKey}_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 8)}`;

    if (typeof obj === "string") {
      return {
        key: parentKey,
        mapping: { sourceField: obj, sourceType: "column", sourceColumn: "" },
      };
    }

    if (typeof obj === "object" && obj !== null) {
      if (
        obj.hasOwnProperty("field") &&
        obj.hasOwnProperty("type") &&
        obj.hasOwnProperty("respectiveColumn")
      ) {
        return {
          key: parentKey,
          mapping: {
            sourceField: obj.field,
            sourceType: obj.type,
            sourceColumn: obj.respectiveColumn,
            lookupTable: obj.lookupTable || "",
          },
        };
      }

      const children = {};

      Object.entries(obj).forEach(([key, value]) => {
        children[
          `child_${key}_${Date.now()}_${Math.random()
            .toString(36)
            .substring(2, 8)}`
        ] = convertNode(value, key);
      });

      return { key: parentKey, children };
    }

    return {
      key: parentKey,
      mapping: { sourceField: "", sourceType: "json", sourceColumn: "" },
    };
  };

  Object.entries(apiMappings).forEach(([action, mapping]) => {
    const actionMappings = {};

    Object.entries(mapping).forEach(([key, value]) => {
      actionMappings[
        `key_${key}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
      ] = convertNode(value, key);
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

  const [webServicesList, setWebServicesList] = useState([]);
  const [selectedWebServiceId, setSelectedWebServiceId] = useState(null);
  const [formFields, setFormFields] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tableColumns, setTableColumns] = useState([]);

  const [webServiceConfig, setWebServiceConfig] = useState({
    id: "",
    webServiceName: "",
    apiEndPoint: "",
    triggerEvent: "",
    fieldMappings: {},
    headers: [],
    retryEnabled: true,
    maxAttempts: 3,
    retryDelaySeconds: 5,
  });

  // --------------------------------------------------------------------
  // Fetch table columns based on selected trigger
  // --------------------------------------------------------------------
  useEffect(() => {
    if (
      !webServiceConfig.triggerEvent ||
      !TRIGGERS[webServiceConfig.triggerEvent]
    ) {
      setTableColumns([]);
      return;
    }

    const tableName = TRIGGERS[webServiceConfig.triggerEvent].table;

    async function fetchColumns() {
      try {
        const response = await axiosInstance.get(
          `/Designer/GetTableColumns?tableName=${tableName}`,
        );

        if (response.data.status) {
          setTableColumns(response.data.columns);
        } else {
          setTableColumns([]);
        }
      } catch (err) {
        console.error("Error fetching table columns", err);
        setTableColumns([]);
      }
    }

    fetchColumns();
  }, [webServiceConfig.triggerEvent]);

  // --------------------------------------------------------------------
  // Fetch services
  // --------------------------------------------------------------------
  useEffect(() => {
    async function fetchServices() {
      try {
        const response = await axiosInstance.get("/Base/GetServices");

        if (response.data.status && response.data.services) {
          setServices(response.data.services);
        }
      } catch (err) {
        toast.error("Error fetching services");
      }
    }

    fetchServices();
  }, []);

  // --------------------------------------------------------------------
  // Fetch web services and form fields when selected service changes
  // --------------------------------------------------------------------
  useEffect(() => {
    if (!selectedServiceId) {
      setWebServicesList([]);
      setSelectedWebServiceId(null);
      setFormFields([]);
      return;
    }

    async function fetchData() {
      setLoading(true);

      try {
        const formRes = await axiosInstance.get(
          `/Designer/GetFormElements?serviceId=${selectedServiceId}`,
        );

        if (formRes.data.status) {
          const sectionFields = Array.isArray(formRes.data.sections)
            ? formRes.data.sections.flatMap((section) =>
                (section.fields || []).map((field) => ({
                  name: field.name,
                  label: field.label,
                  section: section.sectionName || "Unknown",
                })),
              )
            : [];

          const uniqueMap = new Map();

          sectionFields.forEach((field) => {
            if (!uniqueMap.has(field.name)) uniqueMap.set(field.name, field);
          });

          setFormFields(
            Array.from(uniqueMap.values()).map((f) => ({
              id: f.name,
              name: f.name,
              label: f.label,
              section: f.section,
            })),
          );
        }

        const wsRes = await axiosInstance.get(
          `/Designer/GetWebServices?serviceId=${selectedServiceId}`,
        );

        let list = [];

        if (wsRes.data.status) {
          list =
            wsRes.data.configs ||
            (wsRes.data.config ? [wsRes.data.config] : []);
        }

        setWebServicesList(list);

        if (list.length > 0) {
          loadWebService(list[0]);
        } else {
          createNewWebService();
        }
      } catch (err) {
        console.error(err);
        toast.error("Error fetching data");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedServiceId]);

  // --------------------------------------------------------------------
  // Load existing web service
  // --------------------------------------------------------------------
  const loadWebService = (ws) => {
    setSelectedWebServiceId(ws.id);

    let parsedFieldMappings = {};

    try {
      parsedFieldMappings = JSON.parse(ws.fieldMappings || "{}");
    } catch (e) {
      parsedFieldMappings = {};
    }

    let parsedHeaders = [];

    try {
      parsedHeaders = ws.headers ? JSON.parse(ws.headers) : [];
    } catch (e) {
      parsedHeaders = [];
    }

    const triggerMap = {
      Sanction: "APPLICATION_SANCTIONED",
      Corrigendum: "CORRIGENDUM_SANCTIONED",
      Withheld: "WITHHELD_APPROVED",
      Submission: "APPLICATION_SANCTIONED",
      Rejection: "APPLICATION_SANCTIONED",
      Amendment: "CORRIGENDUM_SANCTIONED",
    };

    let rawTrigger = "";

    try {
      rawTrigger = ws.onAction ? JSON.parse(ws.onAction)[0] || "" : "";
    } catch (e) {
      rawTrigger = ws.onAction || "";
    }

    const mappedTrigger = triggerMap[rawTrigger] || rawTrigger;

    const migratedMappings = {};

    Object.entries(parsedFieldMappings).forEach(([key, value]) => {
      const newKey = triggerMap[key] || key;
      migratedMappings[newKey] = value;
    });

    setWebServiceConfig({
      id: ws.id || "",
      webServiceName: ws.webServiceName || "",
      apiEndPoint: ws.apiEndpoint ? ws.apiEndpoint.replace(/^"|"$/g, "") : "",
      triggerEvent: mappedTrigger,
      fieldMappings: convertFromApiFormat(migratedMappings),
      headers: parsedHeaders,
      retryEnabled: parseBool(ws.retryEnabled, true),
      maxAttempts: parseIntSafe(ws.maxAttempts, 3),
      retryDelaySeconds: parseIntSafe(ws.retryDelaySeconds, 5),
    });
  };

  // --------------------------------------------------------------------
  // Create new web service
  // --------------------------------------------------------------------
  const createNewWebService = () => {
    setSelectedWebServiceId("new_" + Date.now());

    setWebServiceConfig({
      id: "",
      webServiceName: "",
      apiEndPoint: "",
      triggerEvent: "",
      fieldMappings: {},
      headers: [],
      retryEnabled: true,
      maxAttempts: 3,
      retryDelaySeconds: 5,
    });
  };

  // --------------------------------------------------------------------
  // Available mapping sources
  // --------------------------------------------------------------------
  const availableSources = useMemo(() => {
    const trigger = webServiceConfig.triggerEvent;

    if (!trigger || !TRIGGERS[trigger]) return [];

    const config = TRIGGERS[trigger];
    const sources = [];

    if (tableColumns.length > 0) {
      tableColumns.forEach((col) => {
        sources.push({
          value: `col:${col.name}`,
          label: `${col.name} (${col.type})`,
          group: `Table: ${config.table}`,
          sourceType: "column",
          sourceColumn: col.name,
          sourceField: col.name,
        });
      });
    }

    if (config.includeFormFields && formFields.length > 0) {
      formFields.forEach((f) => {
        sources.push({
          value: `form:${f.name}`,
          label: f.label,
          group: "Form Fields (JSON)",
          sourceType: "json",
          sourceColumn: f.section,
          sourceField: f.name,
        });
      });
    }

    const lookups = [
      {
        field: "District",
        table: "district",
        label: "District Name (via District ID)",
      },
      {
        field: "Tehsil",
        table: "tehsil",
        label: "Tehsil Name (via Tehsil ID)",
      },
      {
        field: "division",
        table: "division",
        label: "Division Name (via Division ID)",
      },
    ];

    lookups.forEach((lookup) => {
      sources.push({
        value: `lookup:${lookup.table}:${lookup.field}`,
        label: lookup.label,
        group: "Database Lookups (ID → Name)",
        sourceType: "lookup",
        lookupTable: lookup.table,
        sourceField: lookup.field,
        sourceColumn: "",
      });
    });

    return sources;
  }, [webServiceConfig.triggerEvent, formFields, tableColumns]);

  // --------------------------------------------------------------------
  // Input handlers
  // --------------------------------------------------------------------
  const handleInputChange = (e) => {
    const { name, value } = e.target;

    setWebServiceConfig((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleRetryInputChange = (e) => {
    const { name, type, checked, value } = e.target;

    const newValue =
      type === "checkbox"
        ? checked
        : type === "number"
          ? value === ""
            ? ""
            : Number(value)
          : value;

    setWebServiceConfig((prev) => ({
      ...prev,
      [name]: newValue,
    }));
  };

  const addHeader = () =>
    setWebServiceConfig((prev) => ({
      ...prev,
      headers: [...prev.headers, { key: "", value: "", showValue: false }],
    }));

  const updateHeader = (index, field, newValue) => {
    setWebServiceConfig((prev) => {
      const updated = [...prev.headers];
      updated[index] = { ...updated[index], [field]: newValue };

      return {
        ...prev,
        headers: updated,
      };
    });
  };

  const removeHeader = (index) =>
    setWebServiceConfig((prev) => ({
      ...prev,
      headers: prev.headers.filter((_, i) => i !== index),
    }));

  // --------------------------------------------------------------------
  // Mapping handlers
  // --------------------------------------------------------------------
  const addRootMapping = () => {
    const trigger = webServiceConfig.triggerEvent;
    if (!trigger) return;

    setWebServiceConfig((prev) => {
      const currentMappings = prev.fieldMappings[trigger] || {};

      const newKey = `key_${Object.keys(currentMappings).length + Date.now()}`;

      return {
        ...prev,
        fieldMappings: {
          ...prev.fieldMappings,
          [trigger]: {
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

  const updateMapping = (path, node) => {
    const trigger = webServiceConfig.triggerEvent;

    setWebServiceConfig((prev) => {
      const actionMappings = JSON.parse(
        JSON.stringify(prev.fieldMappings[trigger] || {}),
      );

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
          [trigger]: actionMappings,
        },
      };
    });
  };

  const addChild = (path, childKey) => {
    const trigger = webServiceConfig.triggerEvent;

    setWebServiceConfig((prev) => {
      const actionMappings = JSON.parse(
        JSON.stringify(prev.fieldMappings[trigger] || {}),
      );

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
          [trigger]: actionMappings,
        },
      };
    });
  };

  const removeMapping = (path) => {
    const trigger = webServiceConfig.triggerEvent;

    setWebServiceConfig((prev) => {
      const actionMappings = JSON.parse(
        JSON.stringify(prev.fieldMappings[trigger] || {}),
      );

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
          [trigger]: actionMappings,
        },
      };
    });
  };

  // --------------------------------------------------------------------
  // Convert internal mapping format to API format
  // --------------------------------------------------------------------
  const convertToApiFormat = (mappingsByAction) => {
    const result = {};

    const convertNode = (node, target) => {
      if (node.mapping) {
        target[node.key] = {
          field: node.mapping.sourceField,
          type: node.mapping.sourceType,
          respectiveColumn: node.mapping.sourceColumn,
          ...(node.mapping.lookupTable
            ? { lookupTable: node.mapping.lookupTable }
            : {}),
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

  // --------------------------------------------------------------------
  // Save
  // --------------------------------------------------------------------
  const handleSave = async () => {
    if (!selectedServiceId) {
      return toast.error("Please select a service");
    }

    if (!webServiceConfig.apiEndPoint.trim()) {
      return toast.error("API endpoint is required");
    }

    if (!webServiceConfig.triggerEvent) {
      return toast.error("Please select a Trigger Event");
    }

    const trigger = webServiceConfig.triggerEvent;
    const mappings = webServiceConfig.fieldMappings[trigger] || {};

    const maxAttempts = Number(webServiceConfig.maxAttempts);
    const retryDelaySeconds = Number(webServiceConfig.retryDelaySeconds);

    if (webServiceConfig.retryEnabled) {
      if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
        return toast.error("Max attempts must be at least 1");
      }

      if (!Number.isInteger(retryDelaySeconds) || retryDelaySeconds < 0) {
        return toast.error("Retry delay cannot be negative");
      }
    }

    const payload = {
      id: webServiceConfig.id,
      serviceId: selectedServiceId,
      webServiceName: webServiceConfig.webServiceName,
      apiEndPoint: webServiceConfig.apiEndPoint.trim(),
      onAction: JSON.stringify([trigger]),
      fieldMappings: JSON.stringify(
        convertToApiFormat({ [trigger]: mappings }),
      ),
      headers: JSON.stringify(webServiceConfig.headers),
      retryEnabled: String(webServiceConfig.retryEnabled),
      maxAttempts: String(webServiceConfig.retryEnabled ? maxAttempts : 1),
      retryDelaySeconds: String(
        webServiceConfig.retryEnabled ? retryDelaySeconds : 0,
      ),
    };

    const formdata = new FormData();

    Object.keys(payload).forEach((key) => {
      formdata.append(key, payload[key]);
    });

    try {
      const response = await axiosInstance.post(
        "/Designer/SaveWebService",
        formdata,
      );

      if (response.data.status) {
        toast.success("Web service saved successfully!");

        const wsRes = await axiosInstance.get(
          `/Designer/GetWebServices?serviceId=${selectedServiceId}`,
        );

        if (wsRes.data.status) {
          const list =
            wsRes.data.configs ||
            (wsRes.data.config ? [wsRes.data.config] : []);

          setWebServicesList(list);

          if (list.length > 0) {
            loadWebService(list[list.length - 1]);
          }
        }
      } else {
        toast.error(response.data.message || "Failed to save");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error saving configuration");
    }
  };

  // --------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------
  return (
    <Box sx={{ bgcolor: "#F8FAFC", minHeight: "100vh", py: 4 }}>
      <ToastContainer position="top-right" autoClose={3000} theme="colored" />

      <Box sx={{ maxWidth: 1200, mx: "auto", px: 3 }}>
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1 }}>
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: 2,
                bgcolor: "#EFF6FF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <WebhookIcon sx={{ fontSize: 32, color: "#2562E9" }} />
            </Box>

            <Box>
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 800,
                  color: "#0F172A",
                  letterSpacing: "-0.5px",
                }}
              >
                Web Service Configuration
              </Typography>

              <Typography variant="body1" sx={{ color: "#64748B" }}>
                Map external API payloads to internal database tables and form
                fields
              </Typography>
            </Box>
          </Box>
        </Box>

        <Paper
          elevation={0}
          sx={{
            p: 4,
            borderRadius: 3,
            border: "1px solid #E2E8F0",
            bgcolor: "white",
          }}
        >
          {/* Service Selection */}
          <FormControl fullWidth sx={{ mb: 4 }}>
            <InputLabel>Select Service</InputLabel>
            <Select
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

          {/* Web Services Tabs */}
          {selectedServiceId && (
            <Box
              sx={{
                mb: 4,
                display: "flex",
                gap: 1,
                flexWrap: "wrap",
                alignItems: "center",
                borderBottom: "1px solid #E2E8F0",
                pb: 2,
              }}
            >
              {webServicesList.map((ws) => (
                <Chip
                  key={ws.id}
                  label={ws.webServiceName || `Webhook ${ws.id}`}
                  onClick={() => loadWebService(ws)}
                  color={selectedWebServiceId === ws.id ? "primary" : "default"}
                  variant={
                    selectedWebServiceId === ws.id ? "filled" : "outlined"
                  }
                  sx={{ fontWeight: 600 }}
                />
              ))}

              <Button
                startIcon={<AddIcon />}
                onClick={createNewWebService}
                variant="outlined"
                size="small"
                sx={{
                  textTransform: "none",
                  borderColor: "#CBD5E1",
                  color: "#475569",
                }}
              >
                New Web Service
              </Button>
            </Box>
          )}

          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
              <CircularProgress />
            </Box>
          ) : selectedServiceId && selectedWebServiceId ? (
            <Grid container spacing={4}>
              {/* Basic Info & Trigger */}
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Web Service Name"
                  name="webServiceName"
                  value={webServiceConfig.webServiceName}
                  onChange={handleInputChange}
                  placeholder="e.g., Payment Gateway"
                  sx={{ mb: 3 }}
                />

                <TextField
                  fullWidth
                  label="API Endpoint"
                  name="apiEndPoint"
                  value={webServiceConfig.apiEndPoint}
                  onChange={handleInputChange}
                  placeholder="https://api.example.com/endpoint"
                  InputProps={{
                    startAdornment: (
                      <HttpIcon sx={{ mr: 1, color: "#94A3B8" }} />
                    ),
                  }}
                  sx={{ mb: 3 }}
                />

                <FormControl fullWidth>
                  <InputLabel>Trigger Event</InputLabel>
                  <Select
                    name="triggerEvent"
                    value={webServiceConfig.triggerEvent}
                    label="Trigger Event"
                    onChange={handleInputChange}
                  >
                    <MenuItem value="">
                      <em>Select Trigger</em>
                    </MenuItem>

                    {Object.entries(TRIGGERS).map(([key, val]) => (
                      <MenuItem key={key} value={key}>
                        <Box
                          sx={{ display: "flex", alignItems: "center", gap: 1 }}
                        >
                          {val.icon} {val.label}
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>

                  {webServiceConfig.triggerEvent &&
                    TRIGGERS[webServiceConfig.triggerEvent] && (
                      <Alert severity="info" sx={{ mt: 2, borderRadius: 2 }}>
                        <Typography variant="caption" fontWeight={600}>
                          Source Table:{" "}
                          <code>
                            {TRIGGERS[webServiceConfig.triggerEvent].table}
                          </code>
                        </Typography>

                        <Typography variant="caption" display="block">
                          {TRIGGERS[webServiceConfig.triggerEvent].description}
                        </Typography>
                      </Alert>
                    )}
                </FormControl>

                {/* Retry Policy */}
                <Paper
                  variant="outlined"
                  sx={{
                    p: 2,
                    mt: 3,
                    borderRadius: 2,
                    border: "1px solid #E2E8F0",
                    bgcolor: "#F8FAFC",
                  }}
                >
                  <Typography
                    variant="subtitle2"
                    fontWeight={700}
                    sx={{ mb: 1 }}
                  >
                    Retry Policy
                  </Typography>

                  <FormControlLabel
                    control={
                      <Switch
                        checked={webServiceConfig.retryEnabled}
                        onChange={handleRetryInputChange}
                        name="retryEnabled"
                        color="primary"
                      />
                    }
                    label="Enable automatic retry on failure"
                  />

                  <Grid container spacing={2} sx={{ mt: 0.5 }}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        type="number"
                        label="Max Attempts"
                        name="maxAttempts"
                        value={webServiceConfig.maxAttempts}
                        onChange={handleRetryInputChange}
                        disabled={!webServiceConfig.retryEnabled}
                        helperText="Total attempts including first request"
                        inputProps={{ min: 1, max: 20 }}
                        size="small"
                      />
                    </Grid>

                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        type="number"
                        label="Delay Between Attempts (seconds)"
                        name="retryDelaySeconds"
                        value={webServiceConfig.retryDelaySeconds}
                        onChange={handleRetryInputChange}
                        disabled={!webServiceConfig.retryEnabled}
                        helperText="Wait time before next attempt"
                        inputProps={{ min: 0, max: 3600 }}
                        size="small"
                      />
                    </Grid>
                  </Grid>
                </Paper>
              </Grid>

              {/* Headers */}
              <Grid item xs={12} md={6}>
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    mb: 2,
                  }}
                >
                  <Typography
                    variant="h6"
                    sx={{ fontWeight: 700, color: "#0F172A" }}
                  >
                    HTTP Headers
                  </Typography>

                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={addHeader}
                    sx={{ textTransform: "none" }}
                  >
                    Add
                  </Button>
                </Box>

                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                    maxHeight: 330,
                    overflowY: "auto",
                    pr: 1,
                  }}
                >
                  {webServiceConfig.headers.map((header, index) => (
                    <Box
                      key={index}
                      sx={{ display: "flex", gap: 1, alignItems: "center" }}
                    >
                      <TextField
                        label="Key"
                        value={header.key}
                        onChange={(e) =>
                          updateHeader(index, "key", e.target.value)
                        }
                        size="small"
                        sx={{ flex: 1 }}
                      />

                      <TextField
                        label="Value"
                        type={header.showValue ? "text" : "password"}
                        value={header.value}
                        onChange={(e) =>
                          updateHeader(index, "value", e.target.value)
                        }
                        size="small"
                        sx={{ flex: 1 }}
                        InputProps={{
                          endAdornment: (
                            <IconButton
                              size="small"
                              onClick={() =>
                                updateHeader(
                                  index,
                                  "showValue",
                                  !header.showValue,
                                )
                              }
                              edge="end"
                              aria-label="toggle header value visibility"
                              sx={{ mr: 0.5 }}
                            >
                              {header.showValue ? (
                                <VisibilityOffIcon fontSize="small" />
                              ) : (
                                <VisibilityIcon fontSize="small" />
                              )}
                            </IconButton>
                          ),
                        }}
                      />

                      <IconButton
                        onClick={() => removeHeader(index)}
                        size="small"
                        sx={{ color: "#DC2626" }}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  ))}

                  {webServiceConfig.headers.length === 0 && (
                    <Typography
                      variant="body2"
                      color="#94A3B8"
                      sx={{ fontStyle: "italic" }}
                    >
                      No headers added.
                    </Typography>
                  )}
                </Box>
              </Grid>

              {/* Field Mappings */}
              {webServiceConfig.triggerEvent &&
                TRIGGERS[webServiceConfig.triggerEvent] && (
                  <Grid item xs={12}>
                    <Divider sx={{ my: 2 }} />

                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        mb: 3,
                      }}
                    >
                      <Typography
                        variant="h6"
                        sx={{ fontWeight: 700, color: "#0F172A" }}
                      >
                        Payload Mapping (
                        {TRIGGERS[webServiceConfig.triggerEvent].label})
                      </Typography>

                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={addRootMapping}
                        sx={{
                          textTransform: "none",
                          bgcolor: "#2562E9",
                          "&:hover": { bgcolor: "#1D4ED8" },
                        }}
                      >
                        Add Root Key
                      </Button>
                    </Box>

                    {Object.keys(
                      webServiceConfig.fieldMappings[
                        webServiceConfig.triggerEvent
                      ] || {},
                    ).length === 0 ? (
                      <Paper
                        variant="outlined"
                        sx={{
                          p: 4,
                          textAlign: "center",
                          bgcolor: "#F8FAFC",
                          border: "2px dashed #CBD5E1",
                        }}
                      >
                        <Typography color="#64748B">
                          No mappings defined. Click "Add Root Key" to start
                          building your JSON payload.
                        </Typography>
                      </Paper>
                    ) : (
                      Object.entries(
                        webServiceConfig.fieldMappings[
                          webServiceConfig.triggerEvent
                        ] || {},
                      ).map(([key, node]) => (
                        <MappingNode
                          key={key}
                          node={node}
                          path={[key]}
                          onUpdate={updateMapping}
                          onAddChild={addChild}
                          onRemove={removeMapping}
                          availableSources={availableSources}
                        />
                      ))
                    )}
                  </Grid>
                )}

              {/* Save Button */}
              <Grid item xs={12}>
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "flex-end",
                    mt: 4,
                    pt: 3,
                    borderTop: "1px solid #E2E8F0",
                  }}
                >
                  <Button
                    variant="contained"
                    size="large"
                    onClick={handleSave}
                    sx={{
                      px: 6,
                      py: 1.5,
                      bgcolor: "#10B981",
                      "&:hover": { bgcolor: "#059669" },
                      textTransform: "none",
                      fontWeight: 700,
                      boxShadow: "0 4px 12px rgba(16, 185, 129, 0.3)",
                    }}
                  >
                    Save Configuration
                  </Button>
                </Box>
              </Grid>
            </Grid>
          ) : (
            <Box sx={{ textAlign: "center", py: 8 }}>
              <Typography color="#94A3B8">
                Select a service above to configure web services.
              </Typography>
            </Box>
          )}
        </Paper>
      </Box>
    </Box>
  );
}
