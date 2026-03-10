import React, { useState, useEffect } from 'react';
import {
  Container, Typography, Box, Button, FormControl, InputLabel, Select, MenuItem,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  Modal, TextField, IconButton, CircularProgress, Alert
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import DragIndicator from '@mui/icons-material/DragIndicator';
import { DndContext, closestCenter, useSensor, useSensors, PointerSensor } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import axiosInstance from '../../axiosConfig';
import { toast } from 'react-toastify';

// Reuse SortableItem from your letter component
const SortableItem = ({ id, children, disabled }) => { /* ... */ };

export default function CreateReports() {
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState('');
  const [columns, setColumns] = useState([]);
  const [reportColumns, setReportColumns] = useState([]); // configured columns
  const [loadingColumns, setLoadingColumns] = useState(false);
  const [previewData, setPreviewData] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState(-1);
  const [columnConfig, setColumnConfig] = useState({ columnName: '', alias: '', jsonKey: '' });
  const [jsonKeys, setJsonKeys] = useState([]);

  // Fetch tables on mount
  useEffect(() => {
    axiosInstance.get('/Reports/GetTables').then(res => setTables(res.data));
  }, []);

  // Fetch columns when table changes
  useEffect(() => {
    if (!selectedTable) {
      setColumns([]);
      setReportColumns([]);
      return;
    }
    setLoadingColumns(true);
    axiosInstance.get(`/Reports/GetColumns?tableName=${selectedTable}`)
      .then(res => {
        setColumns(res.data);
        setReportColumns([]);
        setPreviewData([]);
      })
      .catch(() => toast.error('Failed to load columns'))
      .finally(() => setLoadingColumns(false));
  }, [selectedTable]);

  // Open modal to add/edit column
  const openModal = (index = -1) => {
    if (index === -1) {
      setColumnConfig({ columnName: '', alias: '', jsonKey: '' });
      setJsonKeys([]);
    } else {
      const col = reportColumns[index];
      setColumnConfig(col);
      if (col.isJson) {
        // fetch json keys for this column (you might have stored them earlier)
        const original = columns.find(c => c.columnName === col.columnName);
        setJsonKeys(original?.jsonKeys || []);
      } else {
        setJsonKeys([]);
      }
    }
    setEditingIndex(index);
    setModalOpen(true);
  };

  const closeModal = () => setModalOpen(false);

  const saveColumn = () => {
    if (!columnConfig.columnName) {
      toast.error('Please select a column');
      return;
    }
    const originalCol = columns.find(c => c.columnName === columnConfig.columnName);
    const isJson = originalCol?.dataType?.includes('json');
    if (isJson && !columnConfig.jsonKey) {
      toast.error('Please select a JSON key');
      return;
    }

    const newColumn = {
      ...columnConfig,
      isJson,
      dataType: originalCol.dataType,
    };

    const updated = [...reportColumns];
    if (editingIndex === -1) {
      updated.push(newColumn);
    } else {
      updated[editingIndex] = newColumn;
    }
    setReportColumns(updated);
    closeModal();
  };

  const removeColumn = (index) => {
    setReportColumns(reportColumns.filter((_, i) => i !== index));
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      const oldIndex = reportColumns.findIndex(c => c.columnName === active.id);
      const newIndex = reportColumns.findIndex(c => c.columnName === over.id);
      const newColumns = [...reportColumns];
      const [moved] = newColumns.splice(oldIndex, 1);
      newColumns.splice(newIndex, 0, moved);
      setReportColumns(newColumns);
    }
  };

  // Fetch preview data
  const fetchPreview = async () => {
    if (!selectedTable || reportColumns.length === 0) return;
    try {
      const response = await axiosInstance.post('/Reports/GenerateReport', {
        tableName: selectedTable,
        columns: reportColumns,
        limit: 10
      });
      setPreviewData(response.data);
    } catch (error) {
      toast.error('Failed to load preview');
    }
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  return (
    <Box sx={{ p: 3, bgcolor: 'grey.100', minHeight: '100vh' }}>
      <Container maxWidth="lg" sx={{ bgcolor: 'white', borderRadius: 2, boxShadow: 3, p: 4 }}>
        <Typography variant="h4" gutterBottom>Create Report</Typography>

        {/* Table selection */}
        <FormControl fullWidth sx={{ mb: 3 }}>
          <InputLabel>Select Table</InputLabel>
          <Select value={selectedTable} onChange={(e) => setSelectedTable(e.target.value)} label="Select Table">
            <MenuItem value="" disabled>Select a table</MenuItem>
            {tables.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
          </Select>
        </FormControl>

        {/* Column configuration area */}
        <Typography variant="h6" sx={{ mt: 4, mb: 2 }}>Report Columns</Typography>
        {loadingColumns && <CircularProgress />}
        {!loadingColumns && selectedTable && (
          <>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={reportColumns.map(c => c.columnName)} strategy={verticalListSortingStrategy}>
                {reportColumns.map((col, index) => (
                  <SortableItem key={col.columnName} id={col.columnName} disabled={false}>
                    {(listeners) => (
                      <Box sx={{ display: 'flex', alignItems: 'center', p: 2, bgcolor: 'grey.50', borderRadius: 1, mb: 2, boxShadow: 1 }}>
                        <IconButton {...listeners} sx={{ cursor: 'grab' }}><DragIndicator /></IconButton>
                        <Box sx={{ flex: 1, ml: 2 }}>
                          <Typography variant="body1">
                            {col.alias || col.columnName} {col.isJson && `→ ${col.jsonKey}`}
                          </Typography>
                        </Box>
                        <Button size="small" onClick={() => openModal(index)} sx={{ mr: 1 }}>Edit</Button>
                        <IconButton onClick={() => removeColumn(index)} color="error"><DeleteIcon /></IconButton>
                      </Box>
                    )}
                  </SortableItem>
                ))}
              </SortableContext>
            </DndContext>

            <Button variant="contained" startIcon={<AddIcon />} onClick={() => openModal()}>
              Add Column
            </Button>
          </>
        )}

        {/* Preview and Generate */}
        {reportColumns.length > 0 && (
          <Box sx={{ mt: 4 }}>
            <Button variant="contained" color="primary" onClick={fetchPreview} sx={{ mr: 2 }}>
              Preview
            </Button>
            <Button variant="contained" color="success">
              Generate Report
            </Button>

            {previewData.length > 0 && (
              <TableContainer component={Paper} sx={{ mt: 3 }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      {reportColumns.map(col => (
                        <TableCell key={col.columnName}>{col.alias || col.columnName}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {previewData.map((row, idx) => (
                      <TableRow key={idx}>
                        {reportColumns.map(col => (
                          <TableCell key={col.columnName}>{row[col.alias || col.columnName]}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        )}

        {/* Column Configuration Modal */}
        <Modal open={modalOpen} onClose={closeModal}>
          <Box sx={{ ...modalStyle }}>
            <Typography variant="h5" sx={{ mb: 3 }}>Configure Column</Typography>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Column</InputLabel>
              <Select
                value={columnConfig.columnName}
                onChange={(e) => {
                  const colName = e.target.value;
                  const col = columns.find(c => c.columnName === colName);
                  setColumnConfig({ columnName: colName, alias: '', jsonKey: '' });
                  setJsonKeys(col?.jsonKeys || []);
                }}
                label="Column"
              >
                {columns.map(col => (
                  <MenuItem key={col.columnName} value={col.columnName}>
                    {col.columnName} ({col.dataType})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              fullWidth
              label="Alias (optional)"
              value={columnConfig.alias}
              onChange={(e) => setColumnConfig({ ...columnConfig, alias: e.target.value })}
              sx={{ mb: 2 }}
            />

            {jsonKeys.length > 0 && (
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>JSON Key</InputLabel>
                <Select
                  value={columnConfig.jsonKey}
                  onChange={(e) => setColumnConfig({ ...columnConfig, jsonKey: e.target.value })}
                  label="JSON Key"
                >
                  {jsonKeys.map(key => <MenuItem key={key} value={key}>{key}</MenuItem>)}
                </Select>
              </FormControl>
            )}

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 3 }}>
              <Button onClick={closeModal}>Cancel</Button>
              <Button variant="contained" onClick={saveColumn}>Save</Button>
            </Box>
          </Box>
        </Modal>
      </Container>
    </Box>
  );
}

const modalStyle = {
  position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
  width: 600, bgcolor: 'background.paper', borderRadius: 2, boxShadow: 24, p: 4,
};