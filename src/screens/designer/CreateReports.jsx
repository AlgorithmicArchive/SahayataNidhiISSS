import React, { useState, useEffect, useCallback } from "react";
import GovPageHeader from "../../components/gov/GovPageHeader";
import {
  Box, Paper, Typography, Grid, FormControl, InputLabel, Select,
  MenuItem, Checkbox, CircularProgress, Alert, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Card, CardContent,
  Button, TextField, IconButton, Dialog, DialogTitle, DialogContent,
  DialogActions, Stack, Chip, Tabs, Tab, Divider
} from "@mui/material";
import axiosInstance from "../../axiosConfig";
import {
  Add as AddIcon, Delete as DeleteIcon, Save as SaveIcon,
  Visibility as VisibilityIcon, Edit as EditIcon, Check as CheckIcon
} from "@mui/icons-material";
import { toast } from "react-toastify";

const OPERATORS = ["eq", "neq", "gt", "gte", "lt", "lte", "contains", "starts", "ends"];

const STANDARD_FIELDS = [
  { label: "Reference Number", column: "referencenumber", type: "text", isDate: false, group: "Standard" },
  // Applicant name lives in the flattened form JSON, not a table column.
  { label: "Applicant Name", jsonPath: "formdetails_flat->>'ApplicantName'", type: "text", isDate: false, group: "Standard" },
  { label: "Status", column: "status", type: "text", isDate: false, group: "Standard", values: ["Initiated", "Sanctioned", "Rejected"] },
  { label: "Application Date", column: "created_at", type: "date", isDate: true, group: "Standard" },
  // Last Status values are workflow-level (lowercase, service-specific) — filled live from the DB.
  { label: "Last Status", column: "latest_wf_status", type: "text", isDate: false, group: "Standard" },
  { label: "Last Status Designation", column: "latest_wf_designation", type: "text", isDate: false, group: "Standard" },
  { label: "Last Action Date", column: "latest_wf_completed_at", type: "date", isDate: true, group: "Standard" },
];

const INPUT_BG = {
  bgcolor: "white",
  "& .MuiOutlinedInput-notchedOutline": { borderColor: "#E2E8F0" },
  "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#2562E9" },
  "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#2562E9" },
};

// ══════════════════════════════════════════════════════════════
//  Sub-components (defined OUTSIDE to prevent focus loss on re-render)
// ══════════════════════════════════════════════════════════════

function SelectedColumnsPanel({ selectedColumns, updateColumnLabel, updateColumnFormat, removeColumn, mode }) {
  if (selectedColumns.length === 0) return null;
  return (
    <Card variant="outlined" sx={{ mt: 2 }}>
      <CardContent>
        <Typography variant="subtitle1" gutterBottom fontWeight={600}>
          Selected Columns ({selectedColumns.length})
        </Typography>
        <TableContainer variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Column</TableCell>
                <TableCell>Display Label</TableCell>
                <TableCell>Format</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {selectedColumns.map((col, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontFamily: "monospace", fontSize: "0.8rem" }}>
                      {col.jsonPath || col.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <TextField size="small" value={col.label || ""}
                      onChange={(e) => updateColumnLabel(i, e.target.value)}
                      variant="outlined" placeholder="Display header" />
                  </TableCell>
                  <TableCell>
                    <FormControl size="small" sx={{ minWidth: 110 }}>
                      <Select value={col.format || ""}
                        onChange={(e) => updateColumnFormat(i, e.target.value)} displayEmpty>
                        <MenuItem value="">None</MenuItem>
                        <MenuItem value="date">Date</MenuItem>
                        <MenuItem value="currency">Currency</MenuItem>
                        <MenuItem value="number">Number</MenuItem>
                      </Select>
                    </FormControl>
                  </TableCell>
                  <TableCell>
                    <IconButton color="error" size="small" onClick={() => removeColumn(i)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
}

function FiltersPanel({ selectedFilters, mode, updateFilterJsonFlag, updateFilter, removeFilter, availableFields }) {
  return (
    <Card variant="outlined" sx={{ mt: 2 }}>
      <CardContent>
        <Typography variant="subtitle1" gutterBottom fontWeight={600}>Filters</Typography>
        {selectedFilters.map((f, i) => {
          const isJson = !!f.jsonPath;
          const fieldKey = isJson ? "jsonPath" : "field";
          // Find the field definition for dropdown values
          const fieldDef = availableFields?.find((af) => (af.jsonPath || af.column) === f[fieldKey] || af.label === f.label);
          return (
            <Box key={i} sx={{ p: 1.5, mb: 1, borderRadius: 1, bgcolor: "#FAFBFC", border: "1px solid #E2E8F0" }}>
              <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems="center">
                {mode === "advanced" && (
                  <FormControl size="small" sx={{ minWidth: 130 }}>
                    <InputLabel>Type</InputLabel>
                    <Select value={f.field === "serviceid" ? "service" : isJson ? "json" : "table"}
                      onChange={(e) => { const v = e.target.value; if (v === "json") updateFilterJsonFlag(i, true); else if (v === "table") updateFilterJsonFlag(i, false); }}
                      label="Type">
                      <MenuItem value="table">Table column</MenuItem>
                      <MenuItem value="json">JSON field</MenuItem>
                    </Select>
                  </FormControl>
                )}
                {mode === "advanced" ? (
                  <TextField size="small" sx={{ minWidth: 160 }} label={isJson ? "JSON Path" : "Field"}
                    value={f[fieldKey] || ""} onChange={(e) => updateFilter(i, fieldKey, e.target.value)}
                    placeholder={isJson ? "col->>'field'" : "e.g. status_id"} disabled={f.field === "serviceid"} />
                ) : (
                  <Chip label={f.label} size="small" sx={{ fontWeight: 600, height: 30 }} />
                )}
                <FormControl size="small" sx={{ minWidth: 90 }}>
                  <InputLabel>Op</InputLabel>
                  <Select value={f.operator || "eq"} onChange={(e) => updateFilter(i, "operator", e.target.value)} label="Op">
                    {OPERATORS.map((op) => <MenuItem key={op} value={op}>{op}</MenuItem>)}
                  </Select>
                </FormControl>
                <TextField size="small" sx={{ minWidth: 90 }} label="Input"
                  value={f.inputType || "text"} disabled />
                {f.dataType === "date" && <Chip label="Date" size="small" color="info" />}
                {f.paramKey && <Chip label={f.paramKey === "from" ? "From" : "To"} size="small" color={f.paramKey === "from" ? "primary" : "secondary"} />}
                {fieldDef?.values && mode !== "advanced" ? (
                  <FormControl key={`default-${i}`} size="small" sx={{ minWidth: 160 }}>
                    <InputLabel>Default</InputLabel>
                    <Select value={f.defaultValue || ""} onChange={(e) => updateFilter(i, "defaultValue", e.target.value)} label="Default">
                      <MenuItem value=""><em>Any</em></MenuItem>
                      {fieldDef.values.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                    </Select>
                  </FormControl>
                ) : (
                  <TextField size="small" sx={{ minWidth: 90 }} label="Default"
                    value={f.field === "serviceid" ? "" : (f.defaultValue || "")}
                    onChange={(e) => updateFilter(i, "defaultValue", e.target.value)}
                    disabled={f.field === "serviceid"} />
                )}
                <IconButton color="error" size="small" onClick={() => removeFilter(i)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Stack>
            </Box>
          );
        })}
        {selectedFilters.length === 0 && <Alert severity="info" sx={{ mt: 1 }}>No filters added. The report will return all rows.</Alert>}
      </CardContent>
    </Card>
  );
}

function NameAndSavePanel({ reportName, setReportName, reportDescription, setReportDescription, saving, editingTemplate, handleSave, handlePreview, resetForm }) {
  return (
    <Box sx={{ mt: 3 }}>
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <TextField fullWidth label="Report Name *" value={reportName}
            onChange={(e) => setReportName(e.target.value)} disabled={saving} />
        </Grid>
        <Grid item xs={12}>
          <TextField fullWidth label="Description" value={reportDescription}
            onChange={(e) => setReportDescription(e.target.value)}
            disabled={saving} multiline rows={2} />
        </Grid>
        <Grid item xs={12}>
          <Stack direction="row" spacing={2}>
            <Button variant="contained"
              startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
              onClick={handleSave} disabled={saving}>
              {editingTemplate ? "Update Report" : "Save Report"}
            </Button>
            <Button variant="outlined" startIcon={<VisibilityIcon />}
              onClick={handlePreview} disabled={!editingTemplate}>
              Preview
            </Button>
            {editingTemplate && (
              <Button variant="outlined" color="inherit" onClick={resetForm}>New Report</Button>
            )}
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
}

// ══════════════════════════════════════════════════════════════
//  Main component
// ══════════════════════════════════════════════════════════════

export default function CreateReports() {
  // ── Shared state ──
  const [reportName, setReportName] = useState("");
  const [reportDescription, setReportDescription] = useState("");
  const [selectedColumns, setSelectedColumns] = useState([]);
  const [selectedFilters, setSelectedFilters] = useState([]);
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [filterValues, setFilterValues] = useState({});

  // ── Mode ──
  const [mode, setMode] = useState("simple");

  // ── Simple mode state ──
  const [services, setServices] = useState([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [selectedService, setSelectedService] = useState("");
  const [availableFields, setAvailableFields] = useState([]);
  const [loadingFields, setLoadingFields] = useState(false);
  const [simpleFilterField, setSimpleFilterField] = useState("");
  const [simpleFilterOperator, setSimpleFilterOperator] = useState("eq");
  const [simpleFilterAsRange, setSimpleFilterAsRange] = useState(false);
  const [simpleFilterValue, setSimpleFilterValue] = useState("");
  const [simpleFieldValues, setSimpleFieldValues] = useState([]); // live distinct values for the picked field
  const [loadingSimpleValues, setLoadingSimpleValues] = useState(false);

  // ── Advanced mode state ──
  const [tables, setTables] = useState([]);
  const [loadingTables, setLoadingTables] = useState(false);
  const [selectedTable, setSelectedTable] = useState("");
  const [tableColumns, setTableColumns] = useState([]);
  const [loadingColumns, setLoadingColumns] = useState(false);
  const [error, setError] = useState("");
  const [jsonColumnName, setJsonColumnName] = useState("");
  const [jsonServiceId, setJsonServiceId] = useState("");
  const [jsonFields, setJsonFields] = useState([]);
  const [loadingJsonFields, setLoadingJsonFields] = useState(false);
  const [jsonManualPath, setJsonManualPath] = useState("");
  const [jsonManualLabel, setJsonManualLabel] = useState("");

  // ── Init ──
  useEffect(() => { loadTemplates(); fetchServices(); fetchTables(); }, []);

  const fetchServices = async () => {
    setLoadingServices(true);
    try {
      const res = await axiosInstance.get("/Base/GetServices");
      if (res.data.status) setServices(res.data.services || res.data.Services || []);
    } catch (err) { console.error("Error fetching services:", err); }
    finally { setLoadingServices(false); }
  };

  const fetchTables = async () => {
    setLoadingTables(true);
    try { const res = await axiosInstance.get("/Designer/GetTables"); setTables(res.data || []); }
    catch (err) { console.error("Error fetching tables:", err); }
    finally { setLoadingTables(false); }
  };

  const loadTemplates = async () => {
    setLoadingTemplates(true);
    try { const res = await axiosInstance.get("/Designer/GetReportTemplates"); if (res.data.status) setTemplates(res.data.data || []); }
    catch (err) { console.error(err); toast.error("Failed to load report templates"); }
    finally { setLoadingTemplates(false); }
  };

  // ══════════════════════════════════════════════════════════════
  //  SIMPLE MODE handlers
  // ══════════════════════════════════════════════════════════════

  const handleServiceChange = useCallback(async (e) => {
    const svcId = e.target.value;
    setSelectedService(svcId);
    setSelectedColumns([]);
    setSelectedFilters([]);
    if (!svcId) { setAvailableFields([]); return; }
    setLoadingFields(true);
    try {
      const res = await axiosInstance.get("/Designer/GetFormElements", { params: { serviceId: svcId } });
      const sections = res.data?.sections || [];
      const formFields = sections
        .flatMap((s) => s.fields || [])
        .filter((f) => f.name && f.label)
        .map((f) => ({
          label: f.label, jsonPath: `formdetails_flat->>'${f.name}'`,
          type: "text", isDate: false, group: "Form Fields",
        }));
      setAvailableFields([...STANDARD_FIELDS, ...formFields]);
    } catch (err) {
      console.error("Error loading form fields:", err);
      toast.error("Could not load form fields");
      setAvailableFields([...STANDARD_FIELDS]);
    } finally { setLoadingFields(false); }
  }, []);

  const toggleSimpleColumn = useCallback((field) => {
    const key = field.jsonPath || field.column;
    setSelectedColumns((prev) => {
      const exists = prev.some((c) => (c.jsonPath || c.name) === key);
      if (exists) return prev.filter((c) => (c.jsonPath || c.name) !== key);
      if (field.jsonPath) {
        return [...prev, { name: "formdetails_flat", label: field.label, type: "text", jsonPath: field.jsonPath, format: null }];
      } else {
        return [...prev, { name: field.column, label: field.label, type: field.type || "text", jsonPath: null, format: null }];
      }
    });
  }, []);

  const isFieldSelected = useCallback((field) => {
    const key = field.jsonPath || field.column;
    return selectedColumns.some((c) => (c.jsonPath || c.name) === key);
  }, [selectedColumns]);

  // Fetch the real distinct values for the picked filter field (scoped to the
  // chosen service) so the designer picks values that actually exist — correct
  // case, no typos. Skipped for date fields.
  const fetchSimpleFieldValues = useCallback(async (fieldKey) => {
    setSimpleFieldValues([]);
    if (!fieldKey || !selectedService) return;
    const field = availableFields.find((af) => (af.jsonPath || af.column) === fieldKey);
    if (!field || field.isDate) return;
    setLoadingSimpleValues(true);
    try {
      const res = await axiosInstance.get("/Designer/GetReportFieldValues", {
        params: {
          serviceId: selectedService,
          field: field.column || undefined,
          jsonPath: field.jsonPath || undefined,
        },
      });
      if (res.data?.status && Array.isArray(res.data.values)) setSimpleFieldValues(res.data.values);
    } catch (err) {
      console.error("Error loading field values:", err);
    } finally {
      setLoadingSimpleValues(false);
    }
  }, [selectedService, availableFields]);

  const addSimpleFilter = useCallback(() => {
    if (!simpleFilterField) return toast.warning("Pick a field first");
    const field = availableFields.find((af) => (af.jsonPath || af.column) === simpleFilterField);
    if (!field) return;

    if (field.isDate && simpleFilterAsRange) {
      setSelectedFilters((prev) => [...prev, {
        field: field.column || null, jsonPath: field.jsonPath || null,
        operator: "gte", label: field.label + " (From)",
        inputType: "date", dataType: "date",
        defaultValue: "", lookup: null, paramKey: "from"
      }, {
        field: field.column || null, jsonPath: field.jsonPath || null,
        operator: "lte", label: field.label + " (To)",
        inputType: "date", dataType: "date",
        defaultValue: "", lookup: null, paramKey: "to"
      }]);
      toast.success(`Added date range: ${field.label}`);
    } else {
      // Bake the live distinct values (fallback to any hardcoded field.values) so the
      // officer gets a dropdown of real values and the filter renders as a select.
      const bakedValues = simpleFieldValues.length ? simpleFieldValues : (field.values || null);
      const inputType = field.isDate ? "date" : bakedValues ? "select" : "text";
      setSelectedFilters((prev) => [...prev, {
        field: field.column || null, jsonPath: field.jsonPath || null,
        operator: simpleFilterOperator, label: field.label,
        inputType, dataType: field.type || "text",
        defaultValue: simpleFilterValue || "", lookup: null, paramKey: "",
        values: bakedValues
      }]);
      toast.success(`Added filter: ${field.label}`);
    }
    setSimpleFilterField(""); setSimpleFilterOperator("eq"); setSimpleFilterAsRange(false); setSimpleFilterValue(""); setSimpleFieldValues([]);
  }, [simpleFilterField, availableFields, simpleFilterOperator, simpleFilterAsRange, simpleFilterValue, simpleFieldValues]);

  // ══════════════════════════════════════════════════════════════
  //  ADVANCED MODE handlers
  // ══════════════════════════════════════════════════════════════

  const fetchTableColumns = useCallback(async (tableName) => {
    if (!tableName) return;
    setLoadingColumns(true);
    try {
      const response = await axiosInstance.get("/Designer/GetTableColumns", { params: { tableName } });
      if (response.data.status && response.data.columns) {
        setTableColumns(response.data.columns);
        const jsonCols = response.data.columns.filter((c) => c.isJson);
        const preferred = jsonCols.find((c) => /flat/i.test(c.name)) || jsonCols[0];
        setJsonColumnName(preferred ? preferred.name : "");
      } else { setTableColumns([]); setJsonColumnName(""); }
    } catch (err) { console.error("Error fetching columns:", err); setTableColumns([]); }
    finally { setLoadingColumns(false); }
  }, []);

  const handleTableChange = useCallback((event) => {
    const tableName = event.target.value;
    setSelectedTable(tableName); setSelectedColumns([]); setSelectedFilters([]);
    setJsonFields([]); setJsonServiceId("");
    if (tableName) fetchTableColumns(tableName);
  }, [fetchTableColumns]);

  const toggleColumn = useCallback((col) => {
    setSelectedColumns((prev) => {
      const exists = prev.some(c => c.name === col.name);
      if (exists) return prev.filter(c => c.name !== col.name);
      return [...prev, { name: col.name, label: col.name, type: col.type, jsonPath: null, format: null }];
    });
  }, []);

  const loadJsonFields = useCallback(async () => {
    if (!jsonColumnName) return toast.warning("Pick a JSON column below first");
    if (!jsonServiceId) return toast.warning("Enter a service ID to load its fields");
    setLoadingJsonFields(true);
    try {
      const res = await axiosInstance.get("/Designer/GetFormElements", { params: { serviceId: jsonServiceId } });
      const fields = (res.data?.sections || []).flatMap((s) => s.fields || []);
      setJsonFields(fields);
      if (fields.length === 0) toast.info("No form fields returned for this service");
    } catch (err) { console.error(err); toast.error("Could not load form fields"); }
    finally { setLoadingJsonFields(false); }
  }, [jsonColumnName, jsonServiceId]);

  const addJsonPathColumn = useCallback((fieldName, fieldLabel) => {
    if (!jsonColumnName) return toast.warning("Pick a JSON column below first");
    const jsonPath = `${jsonColumnName}->>'${fieldName}'`;
    setSelectedColumns((prev) => {
      if (prev.some((c) => c.jsonPath === jsonPath)) { toast.warning("Already added"); return prev; }
      return [...prev, { name: jsonColumnName, label: fieldLabel || fieldName, type: "text", jsonPath, format: null }];
    });
    toast.success(`Added column "${fieldLabel || fieldName}"`);
  }, [jsonColumnName]);

  const addManualJsonColumn = useCallback(() => {
    if (!jsonColumnName) return toast.warning("Pick a JSON column below first");
    const raw = jsonManualPath.trim();
    if (!raw) return toast.warning("Enter a JSON field name or path");
    const jsonPath = raw.includes("->>") ? raw : `${jsonColumnName}->>'${raw}'`;
    setSelectedColumns((prev) => {
      if (prev.some((c) => c.jsonPath === jsonPath)) { toast.warning("Already added"); return prev; }
      return [...prev, { name: jsonColumnName, label: jsonManualLabel || raw, type: "text", jsonPath, format: null }];
    });
    setJsonManualPath(""); setJsonManualLabel("");
  }, [jsonColumnName, jsonManualPath, jsonManualLabel]);

  const updateFilterJsonFlag = useCallback((index, checked) => {
    setSelectedFilters((prev) => {
      const f = [...prev];
      if (checked) { f[index] = { ...f[index], jsonPath: f[index].jsonPath || f[index].field, field: null }; }
      else { f[index] = { ...f[index], field: f[index].jsonPath, jsonPath: null }; }
      return f;
    });
  }, []);

  const updateColumnLabel = useCallback((index, newLabel) => {
    setSelectedColumns((prev) => { const c = [...prev]; c[index].label = newLabel; return c; });
  }, []);
  const updateColumnFormat = useCallback((index, format) => {
    setSelectedColumns((prev) => { const c = [...prev]; c[index].format = format || null; return c; });
  }, []);
  const removeColumn = useCallback((index) => {
    setSelectedColumns((prev) => { const c = [...prev]; c.splice(index, 1); return c; });
  }, []);
  const updateFilter = useCallback((index, key, value) => {
    setSelectedFilters((prev) => { const f = [...prev]; f[index][key] = value; return f; });
  }, []);
  const removeFilter = useCallback((index) => {
    setSelectedFilters((prev) => { const f = [...prev]; f.splice(index, 1); return f; });
  }, []);

  const resetForm = useCallback(() => {
    setEditingTemplate(null); setReportName(""); setReportDescription("");
    setSelectedColumns([]); setSelectedFilters([]);
    setSelectedTable(""); setSelectedService(""); setAvailableFields([]);
    setTableColumns([]); setJsonFields([]); setJsonServiceId("");
    setSimpleFilterField(""); setSimpleFilterValue(""); setSimpleFieldValues([]);
  }, []);

  const handleSave = useCallback(async () => {
    if (!reportName.trim()) return toast.warning("Please enter a report name");
    if (mode === "simple" && !selectedService) return toast.warning("Please select a service");
    if (mode === "advanced" && !selectedTable) return toast.warning("Please select a base table");
    if (selectedColumns.length === 0) return toast.warning("Please select at least one column");
    setSaving(true);
    try {
      const payload = {
        id: editingTemplate?.id || 0,
        name: reportName, description: reportDescription,
        tableName: mode === "simple" ? "citizen_applications" : selectedTable,
        serviceId: mode === "simple" ? selectedService : null,
        columns: JSON.stringify(selectedColumns),
        filters: selectedFilters.length > 0 ? JSON.stringify(selectedFilters) : null,
        createdBy: ""
      };
      const res = await axiosInstance.post("/Designer/SaveReportTemplate", payload);
      if (res.data.status) { toast.success(res.data.message || "Saved"); resetForm(); loadTemplates(); }
      else toast.error(res.data.message || "Save failed");
    } catch (err) { console.error(err); toast.error("Error saving report template"); }
    finally { setSaving(false); }
  }, [reportName, reportDescription, selectedColumns, selectedFilters, editingTemplate, mode, selectedService, selectedTable, resetForm]);

  const loadTemplateById = useCallback(async (id) => {
    try {
      const res = await axiosInstance.get(`/Designer/GetReportTemplateById?id=${id}`);
      if (res.data.status) {
        const t = res.data.data;
        setEditingTemplate(t); setReportName(t.name); setReportDescription(t.description);
        setSelectedColumns(t.columns || []); setSelectedFilters(t.filters || []);
        if (t.serviceId) {
          setMode("simple"); setSelectedTable(""); setSelectedService(String(t.serviceId));
          handleServiceChange({ target: { value: String(t.serviceId) } });
        } else {
          setMode("advanced"); setSelectedService("");
          setSelectedTable(t.tableName || ""); if (t.tableName) fetchTableColumns(t.tableName);
        }
      }
    } catch (err) { console.error(err); toast.error("Failed to load template"); }
  }, [handleServiceChange, fetchTableColumns]);

  const handlePreview = useCallback(async () => {
    if (!editingTemplate?.id) { toast.warning("Please save the report template first"); return; }
    setPreviewLoading(true); setPreviewData(null);
    try {
      const filterJson = Object.keys(filterValues).length > 0 ? JSON.stringify(filterValues) : null;
      const res = await axiosInstance.get(`/Designer/ExecuteReportTemplate`, { params: { templateId: editingTemplate.id, filterJson } });
      if (res.data.status) { setPreviewData(res.data); setPreviewOpen(true); }
      else toast.error(res.data.message || "Preview failed");
    } catch (err) { console.error(err); toast.error("Error loading preview"); }
    finally { setPreviewLoading(false); }
  }, [editingTemplate, filterValues]);

  const handleDeleteTemplate = useCallback(async (id) => {
    if (!window.confirm("Delete this report template?")) return;
    try { await axiosInstance.delete(`/Designer/DeleteReportTemplate?id=${id}`); toast.success("Template deleted"); loadTemplates(); }
    catch (err) { console.error(err); toast.error("Failed to delete template"); }
  }, []);

  // ══════════════════════════════════════════════════════════════
  //  SIMPLE MODE JSX
  // ══════════════════════════════════════════════════════════════

  const SimpleBuilder = () => (
    <Box>
      {/* Step 1: Service */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle1" fontWeight={700} gutterBottom>Step 1: Select a Service</Typography>
        <FormControl fullWidth>
          <InputLabel>Service *</InputLabel>
          <Select value={selectedService} onChange={handleServiceChange} label="Service *" disabled={loadingServices} sx={INPUT_BG}>
            <MenuItem value=""><em>Select a service</em></MenuItem>
            {loadingServices && <MenuItem disabled><CircularProgress size={20} /></MenuItem>}
            {services.map((s) => (
              <MenuItem key={s.serviceId || s.ServiceId} value={String(s.serviceId || s.ServiceId)}>
                {s.serviceName || s.ServiceName}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* Step 2: Columns */}
      {selectedService && (
        <Box sx={{ mb: 3 }}>
          <Divider sx={{ mb: 2 }} />
          <Typography variant="subtitle1" fontWeight={700} gutterBottom>Step 2: Choose Columns</Typography>
          {loadingFields ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}><CircularProgress /></Box>
          ) : (
            <>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                <Typography variant="caption" sx={{ color: "#64748B" }}>Click fields to add them as report columns:</Typography>
                <Chip label={`${selectedColumns.length} selected`} size="small" sx={{ height: 20 }} />
              </Box>
              <Typography variant="caption" sx={{ color: "#64748B", fontWeight: 600, display: "block", mb: 1 }}>Standard Fields</Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }}>
                {STANDARD_FIELDS.map((f, idx) => {
                  const sel = isFieldSelected(f);
                  return (
                    <Button key={idx} size="small" variant={sel ? "contained" : "outlined"} color={sel ? "success" : "primary"}
                      disabled={sel} onClick={() => toggleSimpleColumn(f)}
                      startIcon={sel ? <CheckIcon fontSize="small" /> : <AddIcon fontSize="small" />}
                      sx={{ textTransform: "none" }}>{f.label}</Button>
                  );
                })}
              </Box>
              {availableFields.filter((f) => f.jsonPath).length > 0 && (
                <>
                  <Typography variant="caption" sx={{ color: "#64748B", fontWeight: 600, display: "block", mb: 1 }}>Form Fields</Typography>
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                    {availableFields.filter((f) => f.jsonPath).map((f, idx) => {
                      const sel = isFieldSelected(f);
                      return (
                        <Button key={idx} size="small" variant={sel ? "contained" : "outlined"} color={sel ? "success" : "primary"}
                          disabled={sel} onClick={() => toggleSimpleColumn(f)}
                          startIcon={sel ? <CheckIcon fontSize="small" /> : <AddIcon fontSize="small" />}
                          sx={{ textTransform: "none" }}>{f.label}</Button>
                      );
                    })}
                  </Box>
                </>
              )}
            </>
          )}
          <SelectedColumnsPanel selectedColumns={selectedColumns} updateColumnLabel={updateColumnLabel}
            updateColumnFormat={updateColumnFormat} removeColumn={removeColumn} mode={mode} />
        </Box>
      )}

      {/* Step 3: Filters */}
      {selectedService && (
        <Box sx={{ mb: 3 }}>
          <Divider sx={{ mb: 2 }} />
          <Typography variant="subtitle1" fontWeight={700} gutterBottom>Step 3: Add Filters</Typography>
          <Typography variant="caption" sx={{ color: "#64748B", display: "block", mb: 2 }}>
            Pick a field and operator. For date fields, check "Date range" for From/To pickers.
          </Typography>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="center" sx={{ mb: 2 }}>
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel>Field</InputLabel>
              <Select value={simpleFilterField} onChange={(e) => {
                setSimpleFilterField(e.target.value);
                setSimpleFilterAsRange(false); setSimpleFilterValue("");
                fetchSimpleFieldValues(e.target.value);
              }} label="Field">
                <MenuItem value=""><em>Select a field</em></MenuItem>
                {availableFields.map((f, idx) => (
                  <MenuItem key={idx} value={f.jsonPath || f.column}>{f.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 100 }}>
              <InputLabel>Operator</InputLabel>
              <Select value={simpleFilterOperator} onChange={(e) => setSimpleFilterOperator(e.target.value)} label="Operator">
                {OPERATORS.map((op) => <MenuItem key={op} value={op}>{op}</MenuItem>)}
              </Select>
            </FormControl>
            {/* Value input: dropdown of real values (live from DB, fallback to any hardcoded); text otherwise */}
            {(() => {
              const selField = availableFields.find((af) => (af.jsonPath || af.column) === simpleFilterField);
              const liveVals = simpleFieldValues.length ? simpleFieldValues : (selField?.values || null);
              if (selField && !selField.isDate && loadingSimpleValues) {
                return (
                  <FormControl key="value-loading" size="small" sx={{ minWidth: 160 }} disabled>
                    <InputLabel>Value</InputLabel>
                    <Select value="" label="Value"
                      startAdornment={<CircularProgress size={16} sx={{ mr: 1 }} />}>
                      <MenuItem value=""><em>Loading…</em></MenuItem>
                    </Select>
                  </FormControl>
                );
              }
              if (selField && !selField.isDate && liveVals) {
                return (
                  <FormControl key="value-select" size="small" sx={{ minWidth: 160 }}>
                    <InputLabel>Value</InputLabel>
                    <Select value={simpleFilterValue} onChange={(e) => setSimpleFilterValue(e.target.value)} label="Value">
                      <MenuItem value=""><em>Any</em></MenuItem>
                      {liveVals.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                    </Select>
                  </FormControl>
                );
              }
              return (
                <TextField key="value-text" size="small" sx={{ minWidth: 160 }} label="Value (optional)"
                  value={simpleFilterValue} onChange={(e) => setSimpleFilterValue(e.target.value)}
                  placeholder="e.g. Sanctioned" />
              );
            })()}
            {availableFields.find((af) => (af.jsonPath || af.column) === simpleFilterField)?.isDate && (
              <>
                <Checkbox checked={simpleFilterAsRange}
                  onChange={(e) => setSimpleFilterAsRange(e.target.checked)} />
                <Typography variant="body2">Date range (From / To)</Typography>
              </>
            )}
            <Button variant="contained" size="small" startIcon={<AddIcon />}
              onClick={addSimpleFilter} disabled={!simpleFilterField}>
              Add Filter
            </Button>
          </Stack>
          <FiltersPanel selectedFilters={selectedFilters} mode={mode} updateFilterJsonFlag={updateFilterJsonFlag}
            updateFilter={updateFilter} removeFilter={removeFilter} availableFields={availableFields} />
        </Box>
      )}

      {selectedService && <NameAndSavePanel reportName={reportName} setReportName={setReportName}
        reportDescription={reportDescription} setReportDescription={setReportDescription} saving={saving}
        editingTemplate={editingTemplate} handleSave={handleSave} handlePreview={handlePreview} resetForm={resetForm} />}
    </Box>
  );

  // ══════════════════════════════════════════════════════════════
  //  ADVANCED MODE JSX
  // ══════════════════════════════════════════════════════════════

  const AdvancedBuilder = () => (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle1" fontWeight={700} gutterBottom>Step 1: Select Base Table</Typography>
        <FormControl fullWidth>
          <InputLabel>Base Table *</InputLabel>
          <Select value={selectedTable} onChange={handleTableChange} label="Base Table *" sx={INPUT_BG}>
            <MenuItem value="">-- Select a table --</MenuItem>
            {loadingTables && <MenuItem disabled><CircularProgress size={20} /></MenuItem>}
            {tables.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
          </Select>
        </FormControl>
        {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
      </Box>

      {selectedTable && (
        <Card variant="outlined" sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>Columns in {selectedTable}</Typography>
            {loadingColumns ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}><CircularProgress /></Box>
            ) : (
              <TableContainer variant="outlined">
                <Table size="small">
                  <TableHead><TableRow><TableCell>Pick</TableCell><TableCell>Column</TableCell><TableCell>Type</TableCell><TableCell>Nullable</TableCell><TableCell>JSON</TableCell></TableRow></TableHead>
                  <TableBody>
                    {tableColumns.map((col) => (
                      <TableRow key={col.name}>
                        <TableCell><Checkbox checked={selectedColumns.some(c => c.name === col.name)} onChange={() => toggleColumn(col)} /></TableCell>
                        <TableCell>{col.name}</TableCell><TableCell>{col.type}</TableCell>
                        <TableCell>{col.nullable ? "Yes" : "No"}</TableCell><TableCell>{col.isJson ? "Yes" : "No"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            {tableColumns.filter((c) => c.isJson).length > 0 && (
              <Box sx={{ mt: 3, pt: 2, borderTop: "1px dashed #E2E8F0" }}>
                <Typography variant="subtitle1" gutterBottom>Pick fields from a JSON column</Typography>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} sm={4}>
                    <FormControl size="small" fullWidth>
                      <InputLabel>JSON Column</InputLabel>
                      <Select value={jsonColumnName} onChange={(e) => setJsonColumnName(e.target.value)} label="JSON Column">
                        {tableColumns.filter((c) => c.isJson).map((c) => <MenuItem key={c.name} value={c.name}>{c.name}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField size="small" fullWidth type="number" label="Service ID (to load fields)"
                      value={jsonServiceId} onChange={(e) => setJsonServiceId(e.target.value)} />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Button variant="outlined" size="small" onClick={loadJsonFields}
                      disabled={loadingJsonFields || !jsonColumnName}>
                      {loadingJsonFields ? "Loading..." : "Load Fields"}
                    </Button>
                  </Grid>
                </Grid>
                {jsonFields.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                      <Typography variant="caption" sx={{ color: "#64748B" }}>Click to add:</Typography>
                      <Chip label={`${jsonFields.filter((f) => selectedColumns.some((c) => c.jsonPath === `${jsonColumnName}->>'${f.name}'`)).length} added`} size="small" sx={{ height: 20 }} />
                    </Box>
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                      {jsonFields.map((f, idx) => {
                        const jp = jsonColumnName ? `${jsonColumnName}->>'${f.name}'` : "";
                        const added = !!jp && selectedColumns.some((c) => c.jsonPath === jp);
                        return (
                          <Button key={idx} size="small" variant={added ? "contained" : "outlined"}
                            color={added ? "success" : "primary"} disabled={added}
                            onClick={() => addJsonPathColumn(f.name, f.label)}
                            startIcon={added ? <CheckIcon fontSize="small" /> : <AddIcon fontSize="small" />}
                            sx={{ textTransform: "none", fontSize: "0.7rem" }}>{f.label || f.name}</Button>
                        );
                      })}
                    </Box>
                  </Box>
                )}
                <Grid container spacing={2} alignItems="center" sx={{ mt: 2 }}>
                  <Grid item xs={12} sm={4}><TextField size="small" fullWidth label="Field name / path"
                    value={jsonManualPath} onChange={(e) => setJsonManualPath(e.target.value)} /></Grid>
                  <Grid item xs={12} sm={4}><TextField size="small" fullWidth label="Display label"
                    value={jsonManualLabel} onChange={(e) => setJsonManualLabel(e.target.value)} /></Grid>
                  <Grid item xs={12} sm={4}><Button variant="contained" size="small" onClick={addManualJsonColumn} startIcon={<AddIcon />}>Add JSON Field</Button></Grid>
                </Grid>
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      <SelectedColumnsPanel selectedColumns={selectedColumns} updateColumnLabel={updateColumnLabel}
        updateColumnFormat={updateColumnFormat} removeColumn={removeColumn} mode={mode} />
      <FiltersPanel selectedFilters={selectedFilters} mode={mode} updateFilterJsonFlag={updateFilterJsonFlag}
        updateFilter={updateFilter} removeFilter={removeFilter} availableFields={availableFields} />
      <NameAndSavePanel reportName={reportName} setReportName={setReportName}
        reportDescription={reportDescription} setReportDescription={setReportDescription} saving={saving}
        editingTemplate={editingTemplate} handleSave={handleSave} handlePreview={handlePreview} resetForm={resetForm} />
    </Box>
  );

  // ══════════════════════════════════════════════════════════════
  //  RENDER
  // ══════════════════════════════════════════════════════════════

  return (
    <Box sx={{ bgcolor: "#F8FAFC", minHeight: "100vh", py: 3 }}>
      <Box sx={{ maxWidth: "xl", mx: "auto", px: 3 }}>
        <Box sx={{ mb: 3 }}>
          <GovPageHeader title="Create Reports" hindiTitle="रिपोर्ट बनाएँ"
            crumbs={[{ label: "Designer", path: "/designer/dashboard" }, { label: "Create Reports", path: "" }]} />
          <Typography variant="body2" sx={{ color: "#64748B" }}>
            Create dynamic report templates that officers can run. Pick a service and choose friendly field names — no database knowledge needed.
          </Typography>
        </Box>

        <Paper elevation={0} sx={{ mb: 3, border: "1px solid #E2E8F0", borderRadius: 2, overflow: "hidden" }}>
          <Tabs value={mode} onChange={(e, v) => setMode(v)} sx={{ borderBottom: "1px solid #E2E8F0" }}>
            <Tab label="By Service (Recommended)" value="simple" />
            <Tab label="Advanced: by Table" value="advanced" />
          </Tabs>
        </Paper>

        <Paper elevation={0} sx={{ p: 4, border: "1px solid #E2E8F0", borderRadius: 2, bgcolor: "white" }}>
          {mode === "simple" ? <SimpleBuilder /> : <AdvancedBuilder />}
        </Paper>

        {/* Saved Templates */}
        <Paper elevation={0} sx={{ p: 4, mt: 3, border: "1px solid #E2E8F0", borderRadius: 2, bgcolor: "white" }}>
          <Typography variant="h6" gutterBottom>Saved Report Templates</Typography>
          {loadingTemplates && <CircularProgress size={24} />}
          {!loadingTemplates && templates.length === 0 && <Alert severity="info">No report templates saved yet.</Alert>}
          {!loadingTemplates && templates.length > 0 && (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell><TableCell>Description</TableCell>
                    <TableCell>Service</TableCell><TableCell>Table</TableCell>
                    <TableCell>Created</TableCell><TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {templates.map((t) => {
                    const svc = services.find((s) => String(s.serviceId || s.ServiceId) === String(t.serviceId));
                    return (
                      <TableRow key={t.id}>
                        <TableCell>{t.name}</TableCell><TableCell>{t.description}</TableCell>
                        <TableCell>{svc ? (svc.serviceName || svc.ServiceName) : (t.serviceId ? `ID: ${t.serviceId}` : "Global")}</TableCell>
                        <TableCell>{t.tableName}</TableCell>
                        <TableCell>{new Date(t.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <IconButton size="small" onClick={() => loadTemplateById(t.id)}><EditIcon fontSize="small" /></IconButton>
                          <IconButton size="small" color="error" onClick={() => handleDeleteTemplate(t.id)}><DeleteIcon fontSize="small" /></IconButton>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      </Box>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>Report Preview</DialogTitle>
        <DialogContent>
          {previewLoading && <CircularProgress />}
          {previewData && (
            <div>
              <Typography variant="subtitle2" gutterBottom>{previewData.totalRecords} records found</Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead><TableRow>{previewData.columns?.map((c) => <TableCell key={c.accessorKey}>{c.header}</TableCell>)}</TableRow></TableHead>
                  <TableBody>
                    {previewData.data?.slice(0, 50).map((row, i) => (
                      <TableRow key={i}>{previewData.columns?.map((c) => <TableCell key={c.accessorKey}>{row[c.accessorKey]?.toString() || ""}</TableCell>)}</TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              {previewData.data?.length > 50 && <Typography variant="caption" color="textSecondary">Showing first 50 of {previewData.totalRecords} records</Typography>}
            </div>
          )}
        </DialogContent>
        <DialogActions><Button onClick={() => setPreviewOpen(false)}>Close</Button></DialogActions>
      </Dialog>
    </Box>
  );
}
