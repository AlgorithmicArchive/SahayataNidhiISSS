import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Stepper,
  Step,
  StepLabel,
  Button,
  Paper,
  Chip,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  OutlinedInput,
  Checkbox,
  ListItemText,
  TextField,
  IconButton,
  Alert,
  CircularProgress,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  Divider,
  Stack,
  Autocomplete,
} from "@mui/material";
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Preview as PreviewIcon,
  PlayArrow as RunIcon,
  DragHandle as DragIcon,
  Save as SaveIcon,
  FolderOpen as LoadIcon,
} from "@mui/icons-material";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import axios from "axios";

// API endpoints (adjust base URL as needed)
const API_BASE = "/api";
const METADATA_URL = `${API_BASE}/report-metadata`;
const REPORTS_URL = `${API_BASE}/reports`;
const RUN_REPORT_URL = `${API_BASE}/run-report`;

export default function CreateReports() {
  const [activeStep, setActiveStep] = useState(0);
  const [tables, setTables] = useState([]); // { name, label, columns: [{name, label, type}] }
  const [selectedTables, setSelectedTables] = useState([]);
  const [selectedColumns, setSelectedColumns] = useState([]);
  const [filters, setFilters] = useState([]); // {id, table, column, jsonPath, operator, value}
  const [sortOrder, setSortOrder] = useState([]); // [{table, column, jsonPath, dir}]
  const [reportName, setReportName] = useState("");
  const [reportDescription, setReportDescription] = useState("");
  const [reportId, setReportId] = useState(null); // if editing existing

  const [loading, setLoading] = useState(false);
  const [previewSql, setPreviewSql] = useState("");
  const [result, setResult] = useState([]);
  const [error, setError] = useState("");

  const [savedReports, setSavedReports] = useState([]); // for load dropdown
  const [selectedSavedReport, setSelectedSavedReport] = useState(null);

  const steps = [
    "Select Tables",
    "Choose Columns",
    "Add Filters",
    "Sort",
    "Preview & Run",
  ];

  // ─────────────────────────────────────────────────────────────────────────────
  // Load metadata from backend
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchMetadata();
    fetchSavedReports();
  }, []);

  const fetchMetadata = async () => {
    try {
      const res = await axios.get(METADATA_URL);
      setTables(res.data.tables || []);
    } catch (err) {
      setError("Failed to load metadata");
    }
  };

  const fetchSavedReports = async () => {
    try {
      const res = await axios.get(REPORTS_URL);
      setSavedReports(res.data || []);
    } catch (err) {
      console.error("Failed to load saved reports", err);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Load a saved report definition
  // ─────────────────────────────────────────────────────────────────────────────
  const loadReport = async (id) => {
    try {
      setLoading(true);
      const res = await axios.get(`${REPORTS_URL}/${id}`);
      const report = res.data;
      setReportId(report.id);
      setReportName(report.name);
      setReportDescription(report.description || "");
      setSelectedTables(report.tables.map(t => t.table_name));
      setSelectedColumns(report.columns.map(c => ({
        table: c.table_name,
        name: c.column_name,
        label: c.alias || c.column_name,
        isJson: !!c.json_path,
        jsonPath: c.json_path,
      })));
      setFilters(report.filters.map(f => ({
        id: f.id || Date.now() + Math.random(),
        table: f.table_name,
        column: f.column_name,
        jsonPath: f.json_path || null,
        operator: f.operator,
        value: f.value,
      })));
      setSortOrder(report.sort.map(s => ({
        table: s.table_name,
        column: s.column_name,
        jsonPath: s.json_path,
        dir: s.direction,
      })));
      setActiveStep(0); // reset to first step but keep data
    } catch (err) {
      setError("Failed to load report");
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Save current report
  // ─────────────────────────────────────────────────────────────────────────────
  const saveReport = async () => {
    if (!reportName.trim()) {
      setError("Report name is required");
      return;
    }
    const payload = {
      name: reportName,
      description: reportDescription,
      tables: selectedTables.map(name => ({ table_name: name })),
      columns: selectedColumns.map((col, idx) => ({
        table_name: col.table,
        column_name: col.name,
        json_path: col.isJson ? col.jsonPath : null,
        alias: col.label,
        sort_order: idx,
      })),
      filters: filters.map(f => ({
        table_name: f.table,
        column_name: f.column,
        json_path: f.jsonPath,
        operator: f.operator,
        value: f.value,
      })),
      sort: sortOrder.map((s, idx) => ({
        table_name: s.table,
        column_name: s.column,
        json_path: s.jsonPath,
        direction: s.dir,
        priority: idx,
      })),
    };
    try {
      setLoading(true);
      if (reportId) {
        await axios.put(`${REPORTS_URL}/${reportId}`, payload);
      } else {
        const res = await axios.post(REPORTS_URL, payload);
        setReportId(res.data.id);
      }
      fetchSavedReports(); // refresh list
    } catch (err) {
      setError("Failed to save report");
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Preview SQL (calls backend to generate SQL)
  // ─────────────────────────────────────────────────────────────────────────────
  const handlePreview = async () => {
    setLoading(true);
    setError("");
    try {
      const payload = buildReportPayload();
      const res = await axios.post(`${RUN_REPORT_URL}?preview=true`, payload);
      setPreviewSql(res.data.sql);
    } catch (err) {
      setError(err.response?.data?.message || "Preview failed");
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Run report (get data)
  // ─────────────────────────────────────────────────────────────────────────────
  const handleRun = async () => {
    setLoading(true);
    setError("");
    setResult([]);
    try {
      const payload = buildReportPayload();
      const res = await axios.post(RUN_REPORT_URL, payload);
      setResult(res.data.rows || []);
      setActiveStep(steps.length - 1); // go to results step
    } catch (err) {
      setError(err.response?.data?.message || "Run failed");
    } finally {
      setLoading(false);
    }
  };

  const buildReportPayload = () => ({
    name: reportName,
    description: reportDescription,
    tables: selectedTables.map(name => ({ table_name: name })),
    columns: selectedColumns.map((col, idx) => ({
      table_name: col.table,
      column_name: col.name,
      json_path: col.isJson ? col.jsonPath : null,
      alias: col.label,
      sort_order: idx,
    })),
    filters: filters.map(f => ({
      table_name: f.table,
      column_name: f.column,
      json_path: f.jsonPath,
      operator: f.operator,
      value: f.value,
    })),
    sort: sortOrder.map((s, idx) => ({
      table_name: s.table,
      column_name: s.column,
      json_path: s.jsonPath,
      direction: s.dir,
      priority: idx,
    })),
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Step navigation
  // ─────────────────────────────────────────────────────────────────────────────
  const nextStep = () => setActiveStep((a) => Math.min(a + 1, steps.length - 1));
  const prevStep = () => setActiveStep((a) => Math.max(a - 1, 0));

  // ─────────────────────────────────────────────────────────────────────────────
  // Helper: get all available columns (including JSON expansions)
  // ─────────────────────────────────────────────────────────────────────────────
  const getAvailableColumns = () => {
    return tables
      .filter((t) => selectedTables.includes(t.name))
      .flatMap((t) =>
        t.columns.map((c) => ({
          ...c,
          table: t.name,
          tableLabel: t.label || t.name,
        }))
      );
  };

  // For JSON columns, we might want to offer a way to specify path.
  // In this simplified version, we treat JSON columns as a single selectable item,
  // and if chosen, we prompt for JSON path via a text field in the filter/sort UI.

  // ─────────────────────────────────────────────────────────────────────────────
  // Render functions for each step
  // ─────────────────────────────────────────────────────────────────────────────

  const renderStep0 = () => (
    <Paper sx={{ p: 3 }}>
      <FormControl fullWidth>
        <InputLabel>Select Tables</InputLabel>
        <Select
          multiple
          value={selectedTables}
          onChange={(e) => setSelectedTables(e.target.value)}
          input={<OutlinedInput label="Select Tables" />}
          renderValue={(selected) => (
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
              {selected.map((v) => (
                <Chip
                  key={v}
                  label={tables.find((t) => t.name === v)?.label || v}
                />
              ))}
            </Box>
          )}
        >
          {tables.map((t) => (
            <MenuItem key={t.name} value={t.name}>
              <Checkbox checked={selectedTables.includes(t.name)} />
              <ListItemText primary={t.label || t.name} />
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Paper>
  );

  const renderStep1 = () => {
    const available = getAvailableColumns();
    return (
      <Paper sx={{ p: 3 }}>
        <FormControl fullWidth>
          <InputLabel>Choose Columns</InputLabel>
          <Select
            multiple
            value={selectedColumns}
            onChange={(e) => setSelectedColumns(e.target.value)}
            renderValue={(selected) => (
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                {selected.map((c) => (
                  <Chip
                    key={`${c.table}.${c.name}${c.isJson ? `-${c.jsonPath}` : ""}`}
                    label={c.label || c.name}
                  />
                ))}
              </Box>
            )}
          >
            {available.map((col) => {
              const isSelected = selectedColumns.some(
                (c) => c.table === col.table && c.name === col.name && !c.isJson
              );
              return (
                <MenuItem
                  key={`${col.table}.${col.name}`}
                  value={{
                    table: col.table,
                    name: col.name,
                    label: col.label,
                    isJson: false,
                  }}
                >
                  <Checkbox checked={isSelected} />
                  <ListItemText primary={`${col.tableLabel} → ${col.label || col.name}`} />
                </MenuItem>
              );
            })}
          </Select>
        </FormControl>

        {/* If any JSON column exists, allow manual JSON path input */}
        <Typography variant="body2" sx={{ mt: 2 }}>
          For JSON columns, you can add a custom expression:
        </Typography>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 1 }}>
          <TextField
            label="JSON Path (e.g., $.ApplicantDetails[0].value)"
            size="small"
            value={selectedColumns.find(c => c.isJson)?.jsonPath || ""}
            onChange={(e) => {
              // For simplicity, we'll just update the first JSON column
              const jsonCols = selectedColumns.filter(c => c.isJson);
              if (jsonCols.length > 0) {
                const updated = selectedColumns.map(c =>
                  c.isJson ? { ...c, jsonPath: e.target.value } : c
                );
                setSelectedColumns(updated);
              }
            }}
          />
          <Button
            variant="outlined"
            onClick={() => {
              // Add a dummy JSON column entry
              setSelectedColumns([
                ...selectedColumns,
                {
                  table: "citizen_applications", // example
                  name: "formdetails",
                  label: "Custom JSON",
                  isJson: true,
                  jsonPath: "$.ApplicantDetails[0].value",
                },
              ]);
            }}
          >
            Add JSON Column
          </Button>
        </Stack>
      </Paper>
    );
  };

  const renderStep2 = () => {
    const available = getAvailableColumns();
    return (
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Add Filters
        </Typography>
        {filters.map((f, i) => (
          <Stack
            direction="row"
            spacing={2}
            key={f.id}
            alignItems="center"
            sx={{ mb: 2 }}
          >
            <Select
              value={f.column ? `${f.table}.${f.column}` : ""}
              onChange={(e) => {
                const [table, column] = e.target.value.split(".");
                const newFilters = [...filters];
                newFilters[i].table = table;
                newFilters[i].column = column;
                newFilters[i].operator = "equals";
                newFilters[i].value = "";
                setFilters(newFilters);
              }}
              size="small"
              sx={{ minWidth: 200 }}
            >
              <MenuItem value="">Select Column</MenuItem>
              {available.map((col) => (
                <MenuItem
                  key={`${col.table}.${col.name}`}
                  value={`${col.table}.${col.name}`}
                >
                  {col.tableLabel} → {col.label || col.name}
                </MenuItem>
              ))}
            </Select>

            <Select
              value={f.operator}
              onChange={(e) => {
                const newFilters = [...filters];
                newFilters[i].operator = e.target.value;
                setFilters(newFilters);
              }}
              size="small"
              sx={{ minWidth: 100 }}
            >
              {["equals", "contains", ">", "<", ">=", "<=", "in"].map((op) => (
                <MenuItem key={op} value={op}>
                  {op}
                </MenuItem>
              ))}
            </Select>

            <TextField
              size="small"
              placeholder="Value"
              value={f.value}
              onChange={(e) => {
                const newFilters = [...filters];
                newFilters[i].value = e.target.value;
                setFilters(newFilters);
              }}
            />

            {f.jsonPath !== undefined && (
              <TextField
                size="small"
                placeholder="JSON Path (if JSON column)"
                value={f.jsonPath || ""}
                onChange={(e) => {
                  const newFilters = [...filters];
                  newFilters[i].jsonPath = e.target.value;
                  setFilters(newFilters);
                }}
              />
            )}

            <IconButton
              onClick={() => setFilters(filters.filter((_, idx) => idx !== i))}
            >
              <DeleteIcon />
            </IconButton>
          </Stack>
        ))}

        <Button
          startIcon={<AddIcon />}
          onClick={() =>
            setFilters([
              ...filters,
              {
                id: Date.now().toString(),
                table: "",
                column: "",
                operator: "equals",
                value: "",
                jsonPath: null,
              },
            ])
          }
        >
          Add Filter
        </Button>
      </Paper>
    );
  };

  const renderStep3 = () => {
    const available = getAvailableColumns();
    return (
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Sort Order (drag to reorder)
        </Typography>
        <DragDropContext
          onDragEnd={(result) => {
            if (!result.destination) return;
            const items = Array.from(sortOrder);
            const [moved] = items.splice(result.source.index, 1);
            items.splice(result.destination.index, 0, moved);
            setSortOrder(items);
          }}
        >
          <Droppable droppableId="sort">
            {(provided) => (
              <div {...provided.droppableProps} ref={provided.innerRef}>
                {sortOrder.map((s, i) => {
                  const colLabel = available.find(
                    (c) => c.table === s.table && c.name === s.column
                  )?.label || `${s.table}.${s.column}`;
                  return (
                    <Draggable
                      key={`${s.table}.${s.column}${s.jsonPath || ""}`}
                      draggableId={`${s.table}.${s.column}${s.jsonPath || ""}`}
                      index={i}
                    >
                      {(provided) => (
                        <Box
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            mb: 1,
                            background: "#f5f5f5",
                            p: 1,
                            borderRadius: 1,
                          }}
                        >
                          <span {...provided.dragHandleProps}>
                            <DragIcon />
                          </span>
                          <Typography sx={{ flex: 1, ml: 2 }}>
                            {colLabel}
                            {s.jsonPath && ` (${s.jsonPath})`}
                          </Typography>
                          <Select
                            size="small"
                            value={s.dir}
                            onChange={(e) => {
                              const newOrder = [...sortOrder];
                              newOrder[i].dir = e.target.value;
                              setSortOrder(newOrder);
                            }}
                          >
                            <MenuItem value="ASC">Ascending</MenuItem>
                            <MenuItem value="DESC">Descending</MenuItem>
                          </Select>
                          <IconButton
                            onClick={() =>
                              setSortOrder(
                                sortOrder.filter((_, idx) => idx !== i)
                              )
                            }
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Box>
                      )}
                    </Draggable>
                  );
                })}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>

        <Box sx={{ mt: 2 }}>
          <Select
            displayEmpty
            size="small"
            onChange={(e) => {
              const [table, column] = e.target.value.split(".");
              if (table && column) {
                const exists = sortOrder.some(
                  (s) => s.table === table && s.column === column
                );
                if (!exists) {
                  setSortOrder([
                    ...sortOrder,
                    { table, column, jsonPath: null, dir: "ASC" },
                  ]);
                }
              }
            }}
            renderValue={(selected) =>
              selected ? "Add column to sort" : "Add column to sort"
            }
          >
            <MenuItem value="" disabled>
              Add column to sort
            </MenuItem>
            {available.map((c) => (
              <MenuItem
                key={`${c.table}.${c.name}`}
                value={`${c.table}.${c.name}`}
              >
                {c.tableLabel} → {c.label || c.name}
              </MenuItem>
            ))}
          </Select>
        </Box>
      </Paper>
    );
  };

  const renderStep4 = () => (
    <Paper sx={{ p: 3 }}>
      <TextField
        fullWidth
        label="Report Name"
        value={reportName}
        onChange={(e) => setReportName(e.target.value)}
        sx={{ mb: 2 }}
      />
      <TextField
        fullWidth
        label="Description"
        value={reportDescription}
        onChange={(e) => setReportDescription(e.target.value)}
        sx={{ mb: 3 }}
      />

      <Stack direction="row" spacing={2}>
        <Button
          variant="outlined"
          startIcon={<PreviewIcon />}
          onClick={handlePreview}
          disabled={loading}
        >
          Preview SQL
        </Button>
        <Button
          variant="contained"
          color="success"
          startIcon={<RunIcon />}
          onClick={handleRun}
          disabled={loading || !reportName}
        >
          Run Report
        </Button>
        <Button
          variant="outlined"
          startIcon={<SaveIcon />}
          onClick={saveReport}
          disabled={loading || !reportName}
        >
          Save Report
        </Button>
      </Stack>

      {previewSql && (
        <Box
          sx={{
            mt: 3,
            p: 2,
            background: "#f9f9f9",
            borderRadius: 1,
            fontFamily: "monospace",
            whiteSpace: "pre-wrap",
          }}
        >
          {previewSql}
        </Box>
      )}

      {loading && <CircularProgress sx={{ mt: 3 }} />}

      {result.length > 0 && (
        <TableContainer component={Paper} sx={{ mt: 4 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                {Object.keys(result[0] || {}).map((h) => (
                  <TableCell key={h}>
                    <strong>{h}</strong>
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {result.slice(0, 100).map((row, i) => (
                <TableRow key={i}>
                  {Object.values(row).map((v, j) => (
                    <TableCell key={j}>{String(v)}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {result.length > 100 && (
            <Typography sx={{ p: 2 }}>Showing first 100 rows...</Typography>
          )}
        </TableContainer>
      )}
    </Paper>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // Main render
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <Box sx={{ p: 4, maxWidth: 1200, mx: "auto" }}>
      <Typography variant="h4" gutterBottom>
        Create Dynamic Reports
      </Typography>

      {/* Load existing report dropdown */}
      <Box sx={{ mb: 3, display: "flex", alignItems: "center", gap: 2 }}>
        <Autocomplete
          options={savedReports}
          getOptionLabel={(option) => option.name}
          style={{ width: 300 }}
          renderInput={(params) => (
            <TextField {...params} label="Load saved report" size="small" />
          )}
          onChange={(e, value) => {
            if (value) loadReport(value.id);
          }}
        />
        {reportId && (
          <Chip label={`Editing: ${reportName}`} onDelete={() => {
            setReportId(null);
            setReportName("");
            setReportDescription("");
            setSelectedTables([]);
            setSelectedColumns([]);
            setFilters([]);
            setSortOrder([]);
          }} />
        )}
      </Box>

      <Stepper activeStep={activeStep} sx={{ my: 4 }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
          {error}
        </Alert>
      )}

      {/* Step content */}
      {activeStep === 0 && renderStep0()}
      {activeStep === 1 && renderStep1()}
      {activeStep === 2 && renderStep2()}
      {activeStep === 3 && renderStep3()}
      {activeStep === 4 && renderStep4()}

      {/* Navigation */}
      <Box sx={{ mt: 4, display: "flex", justifyContent: "space-between" }}>
        <Button disabled={activeStep === 0} onClick={prevStep}>
          Back
        </Button>
        {activeStep < steps.length - 1 && (
          <Button
            variant="contained"
            onClick={nextStep}
            disabled={
              (activeStep === 0 && selectedTables.length === 0) ||
              (activeStep === 1 && selectedColumns.length === 0)
            }
          >
            Next
          </Button>
        )}
      </Box>
    </Box>
  );
}