import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  OutlinedInput,
  Checkbox,
  ListItemText,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Card,
  CardContent
} from '@mui/material';
import axiosInstance from '../../axiosConfig';

export default function CreateReports() {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedTables, setSelectedTables] = useState([]);
  const [error, setError] = useState('');
  const [selectedTableForColumns, setSelectedTableForColumns] = useState('');
  const [tableColumns, setTableColumns] = useState([]);
  const [loadingColumns, setLoadingColumns] = useState(false);
  const [tabValue, setTabValue] = useState(0);

  // Fetch all tables on component mount
  useEffect(() => {
    fetchTables();
  }, []);

  const fetchTables = async () => {
    setLoading(true);
    try {
      const response = await axiosInstance.get('/Designer/GetTables');
      setTables(response.data);
      setError('');
    } catch (error) {
      console.error('Error fetching tables:', error);
      setError('Failed to fetch tables');
    } finally {
      setLoading(false);
    }
  };

  const fetchTableColumns = async (tableName) => {
    setLoadingColumns(true);
    try {
      const response = await axiosInstance.get(`/Designer/GetTableColumns`, {
        params: { tableName }
      });
      console.log('Columns response:', response.data); // Debug log
      if (response.data.status && response.data.columns) {
        setTableColumns(response.data.columns);
      } else {
        setTableColumns([]);
      }
    } catch (error) {
      console.error('Error fetching columns:', error);
      setError('Failed to fetch table columns');
      setTableColumns([]);
    } finally {
      setLoadingColumns(false);
    }
  };

  const handleTableSelect = (event) => {
    const { value } = event.target;
    const newSelectedTables = typeof value === 'string' ? value.split(',') : value;
    setSelectedTables(newSelectedTables);

    // Reset selected table for columns if it's no longer selected
    if (selectedTableForColumns && !newSelectedTables.includes(selectedTableForColumns)) {
      setSelectedTableForColumns('');
      setTableColumns([]);
      setTabValue(0);
    }
  };

  const handleTableClick = (tableName) => {
    setSelectedTableForColumns(tableName);
    fetchTableColumns(tableName);
    // Find the index of the table in selectedTables to set the tab
    const index = selectedTables.indexOf(tableName);
    setTabValue(index);
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
    const tableName = selectedTables[newValue];
    if (tableName) {
      setSelectedTableForColumns(tableName);
      fetchTableColumns(tableName);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Paper elevation={3} sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          Create Reports
        </Typography>

        <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
          Select tables and view their columns
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Grid container spacing={3}>
          <Grid item xs={12}>
            <FormControl fullWidth>
              <InputLabel>Select Tables</InputLabel>
              <Select
                multiple
                value={selectedTables}
                onChange={handleTableSelect}
                input={<OutlinedInput label="Select Tables" />}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((value) => (
                      <Chip
                        key={value}
                        label={value}
                        onClick={() => handleTableClick(value)}
                        onDelete={() => {
                          const newSelected = selectedTables.filter(t => t !== value);
                          setSelectedTables(newSelected);
                          if (selectedTableForColumns === value) {
                            setSelectedTableForColumns('');
                            setTableColumns([]);
                          }
                        }}
                      />
                    ))}
                  </Box>
                )}
                disabled={loading}
              >
                {tables.map((table) => (
                  <MenuItem key={table} value={table}>
                    <Checkbox checked={selectedTables.indexOf(table) > -1} />
                    <ListItemText primary={table} />
                  </MenuItem>
                ))}
              </Select>
              {loading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                  <CircularProgress size={24} />
                </Box>
              )}
            </FormControl>
          </Grid>

          {/* Display selected tables and their columns */}
          {selectedTables.length > 0 && (
            <Grid item xs={12}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Table Columns
                  </Typography>

                  {selectedTables.length > 1 && (
                    <Tabs
                      value={tabValue}
                      onChange={handleTabChange}
                      sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
                    >
                      {selectedTables.map((table) => (
                        <Tab key={table} label={table} />
                      ))}
                    </Tabs>
                  )}

                  <Box sx={{ mt: 2 }}>
                    {selectedTableForColumns ? (
                      <>
                        <Typography variant="subtitle1" gutterBottom>
                          Columns in <strong>{selectedTableForColumns}</strong>
                        </Typography>

                        {loadingColumns ? (
                          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                            <CircularProgress />
                          </Box>
                        ) : tableColumns.length > 0 ? (
                          <TableContainer component={Paper} variant="outlined">
                            <Table size="small">
                              <TableHead>
                                <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                                  <TableCell><strong>Column Name</strong></TableCell>
                                  <TableCell><strong>Data Type</strong></TableCell>
                                  <TableCell><strong>Nullable</strong></TableCell>
                                  <TableCell><strong>JSON Column</strong></TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {tableColumns.map((column, index) => (
                                  <TableRow key={index}>
                                    <TableCell>{column.name}</TableCell>
                                    <TableCell>{column.type}</TableCell>
                                    <TableCell>{column.nullable ? 'Yes' : 'No'}</TableCell>
                                    <TableCell>{column.isJson ? 'Yes' : 'No'}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        ) : (
                          <Alert severity="info">No columns found for this table</Alert>
                        )}
                      </>
                    ) : (
                      <Alert severity="info">
                        Click on any table chip above to view its columns
                      </Alert>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>
      </Paper>
    </Box>
  );
}