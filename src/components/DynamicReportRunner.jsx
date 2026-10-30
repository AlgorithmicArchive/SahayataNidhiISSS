import React, { useState, useEffect, useMemo } from "react";
import {
  Box, Paper, Typography, FormControl, InputLabel, Select, MenuItem,
  TextField, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, CircularProgress, Alert, Stack, Divider, Chip
} from "@mui/material";
import axiosInstance from "../axiosConfig";
import { toast } from "react-toastify";

const parseMaybe = (v) => {
  if (!v) return [];
  if (typeof v === "string") {
    try { return JSON.parse(v) || []; } catch { return []; }
  }
  return v;
};

/**
 * Officer-facing dynamic report runner — Service-first flow.
 * 1) Pick a Service → 2) Pick a report for that service → 3) Fill filters → 4) Run.
 * Templates without a bound service (serviceId == null) appear when no service is chosen.
 */
export default function DynamicReportRunner() {
  const [services, setServices] = useState([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [selectedService, setSelectedService] = useState("");
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [activeTemplate, setActiveTemplate] = useState(null);
  const [filterValues, setFilterValues] = useState({});
  const [fieldValues, setFieldValues] = useState({}); // filterKey -> distinct values from DB
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);

  // Load services upfront (needed for the Service dropdown)
  useEffect(() => {
    (async () => {
      setLoadingServices(true);
      try {
        const res = await axiosInstance.get("/Base/GetServices");
        if (res.data?.status) {
          // Handle both {services: [...]} (admin) and {Services: [...]} (officer) shapes
          const svc = res.data.services || res.data.Services || [];
          setServices(svc);
        }
      } catch (err) {
        console.error("Error loading services:", err);
      } finally {
        setLoadingServices(false);
      }
    })();
  }, []);

  // Load templates — optionally filtered by serviceId
  const loadTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const params = selectedService ? `?serviceId=${selectedService}` : "";
      const res = await axiosInstance.get(`/Officer/GetDynamicReportTemplates${params}`);
      if (res.data?.status) setTemplates(res.data.data || []);
    } catch (err) {
      console.error("Error loading report templates:", err);
    } finally {
      setLoadingTemplates(false);
    }
  };

  // Reload templates when selected service changes
  useEffect(() => {
    setSelectedId("");
    setActiveTemplate(null);
    setFilterValues({});
    setResult(null);
    loadTemplates();
  }, [selectedService]);

  const handleServiceChange = (e) => {
    setSelectedService(e.target.value);
  };

  const handleSelect = (e) => {
    const id = e.target.value;
    setSelectedId(id);
    setResult(null);
    setFilterValues({});
    setFieldValues({});
    const tpl = templates.find((t) => String(t.id) === String(id));
    const parsed = tpl ? { ...tpl, filters: parseMaybe(tpl.filters) } : null;
    setActiveTemplate(parsed);
    if (parsed) fetchFilterValues(parsed);
  };

  // Populate each select-filter's dropdown with the real, distinct values from the
  // DB (correct case, no typos) — scoped to the template's service.
  const fetchFilterValues = async (tpl) => {
    const selectFilters = (tpl.filters || []).filter(
      (f) => f.inputType === "select" && !(f.lookup === "services" || f.field === "serviceid")
    );
    if (selectFilters.length === 0) return;
    const map = {};
    await Promise.all(
      selectFilters.map(async (f) => {
        const key = f.paramKey || f.jsonPath || f.field;
        try {
          const res = await axiosInstance.get("/Officer/GetReportFieldValues", {
            params: {
              serviceId: tpl.serviceId || undefined,
              field: f.field || undefined,
              jsonPath: f.jsonPath || undefined,
            },
          });
          if (res.data?.status && Array.isArray(res.data.values) && res.data.values.length) {
            map[key] = res.data.values;
          }
        } catch (err) {
          console.error("Error loading filter values:", err);
        }
      })
    );
    setFieldValues(map);
  };

  const handleRun = async () => {
    if (!selectedId) {
      toast.warning("Please select a report first");
      return;
    }
    setRunning(true);
    setResult(null);
    try {
      const entries = Object.entries(filterValues).filter(
        ([, v]) => v !== "" && v !== null && v !== undefined
      );
      const filterJson = entries.length ? JSON.stringify(Object.fromEntries(entries)) : null;
      const res = await axiosInstance.get("/Officer/RunDynamicReport", {
        params: { templateId: selectedId, filterJson }
      });
      if (res.data?.status) {
        setResult(res.data);
        if (!res.data.data || res.data.data.length === 0) {
          toast.info("Report ran successfully - no records found");
        }
      } else {
        toast.error(res.data?.message || "Failed to run report");
      }
    } catch (err) {
      console.error("Error running report:", err);
      toast.error("Error running report: " + (err.response?.data?.message || err.message));
    } finally {
      setRunning(false);
    }
  };

  // Service dropdown options
  const serviceOptions = useMemo(() => services.map((s) => ({
    value: String(s.serviceId || s.ServiceId),
    label: s.serviceName || s.ServiceName,
  })), [services]);

  // Templates grouped by service binding
  const filteredTemplates = useMemo(() => {
    if (!selectedService) {
      // Show global/advanced templates (serviceId == null) when no service chosen
      return templates.filter((t) => !t.serviceId);
    }
    // Show templates bound to the selected service
    return templates.filter((t) => String(t.serviceId) === String(selectedService));
  }, [templates, selectedService]);

  return (
    <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom>Dynamic Reports</Typography>
      <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
        Pick a service, then choose a report template and any filter values to generate the report.
      </Typography>

      {/* Step 1: Service selector */}
      <FormControl fullWidth sx={{ mb: 3 }}>
        <InputLabel>Select a Service</InputLabel>
        <Select
          value={selectedService}
          onChange={handleServiceChange}
          label="Select a Service"
          disabled={loadingServices}
          sx={{ ...INPUT_BG }}
        >
          <MenuItem value=""><em>All Services (advanced/global reports)</em></MenuItem>
          {loadingServices && <MenuItem disabled><CircularProgress size={20} /></MenuItem>}
          {serviceOptions.map((s) => (
            <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>
          ))}
        </Select>
        {selectedService && (
          <Chip
            label={serviceOptions.find((s) => s.value === selectedService)?.label || selectedService}
            size="small"
            sx={{ mt: 1 }}
            color="primary"
          />
        )}
      </FormControl>

      <Divider sx={{ mb: 3 }} />

      {/* Step 2: Report Template selector */}
      <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
        {selectedService ? `Reports for ${serviceOptions.find((s) => s.value === selectedService)?.label}` : "Global / Advanced Reports (no service bound)"}
      </Typography>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mb: 3 }}>
        <FormControl fullWidth>
          <InputLabel>Report Template</InputLabel>
          <Select
            value={selectedId}
            onChange={handleSelect}
            label="Report Template"
            disabled={loadingTemplates || filteredTemplates.length === 0}
          >
            <MenuItem value=""><em>— Select a report —</em></MenuItem>
            {loadingTemplates && <MenuItem disabled><CircularProgress size={20} /></MenuItem>}
            {filteredTemplates.length === 0 && !loadingTemplates && (
              <MenuItem disabled><em>No reports found for this service</em></MenuItem>
            )}
            {filteredTemplates.map((t) => (
              <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button
          variant="contained"
          onClick={handleRun}
          disabled={running || !selectedId}
          startIcon={running ? <CircularProgress size={18} /> : null}
        >
          Generate Report
        </Button>
      </Stack>

      {/* Filters */}
      {activeTemplate?.filters?.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>
            Filters
          </Typography>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            {activeTemplate.filters.map((f, i) => {
              // Skip hidden/internal filters
              if (f.inputType === "hidden") return null;

              // The filter key used in filterValues should match what the backend expects
              // Priority: paramKey (for date ranges) > jsonPath > field
              const key = f.paramKey || f.jsonPath || f.field;
              const label = f.label || key;
              const t = f.inputType || "text";
              const val = filterValues[key] ?? "";
              const set = (v) => setFilterValues({ ...filterValues, [key]: v });

              if (t === "select") {
                const isServices = f.lookup === "services" || f.field === "serviceid";
                // Prefer live distinct values from the DB; fall back to any baked-in values.
                const live = fieldValues[key];
                const baseValues = Array.isArray(live) && live.length
                  ? live
                  : (Array.isArray(f.values) ? f.values : null);
                const options = isServices
                  ? services
                  : (Array.isArray(f.options) ? f.options : (baseValues ? baseValues.map(v => ({ value: v, label: v })) : []));
                return (
                  <Box key={i} sx={{ minWidth: 220 }}>
                    <FormControl size="small" fullWidth>
                      <InputLabel>{label}</InputLabel>
                      <Select
                        value={val}
                        onChange={(e) => set(e.target.value)}
                        label={label}
                      >
                        <MenuItem value=""><em>Select {label}</em></MenuItem>
                        {options.map((opt) => (
                          <MenuItem
                            key={opt.value ?? opt.serviceId ?? opt}
                            value={opt.value ?? opt.serviceId ?? opt}
                          >
                            {opt.label ?? opt.serviceName ?? opt}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Box>
                );
              }

              return (
                <TextField
                  key={i}
                  size="small"
                  label={label}
                  type={t === "date" ? "date" : t === "number" ? "number" : "text"}
                  InputLabelProps={t === "date" ? { shrink: true } : undefined}
                  value={val}
                  onChange={(e) => set(e.target.value)}
                  sx={{ minWidth: 200 }}
                />
              );
            })}
          </Stack>
        </Box>
      )}

      {/* Result */}
      {result && result.data?.length === 0 && (
        <Alert severity="info">No records found for the selected filters.</Alert>
      )}

      {result && result.data?.length > 0 && (
        <Box>
          <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 480 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  {result.columns?.map((c) => (
                    <TableCell key={c.accessorKey}>{c.header}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {result.data.map((row, i) => (
                  <TableRow key={i}>
                    {result.columns?.map((c) => (
                      <TableCell key={c.accessorKey}>
                        {row[c.accessorKey] === null || row[c.accessorKey] === undefined
                          ? ""
                          : String(row[c.accessorKey])}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: "block" }}>
            Total records: {result.totalRecords}
          </Typography>
        </Box>
      )}
    </Paper>
  );
}

// Shared input style for the runner
const INPUT_BG = {
  bgcolor: "white",
  "& .MuiOutlinedInput-notchedOutline": { borderColor: "#E2E8F0" },
  "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#2562E9" },
  "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#2562E9" },
};