import React, { useEffect, useState } from 'react';
import axiosInstance from '../../axiosConfig';
import {
  Box,
  Paper,
  Typography,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  Button,
  Chip,
  TextField,
  Card,
  CardContent,
  Collapse
} from '@mui/material';
import { FormHelperText } from '@mui/material';
import ServerSideTable from '../../components/ServerSideTable';
import { toast } from 'react-toastify';

export default function Reports() {
  const [officerAccessLevel, setOfficerAccessLevel] = useState(null);
  const [officerAccessCode, setOfficerAccessCode] = useState(null);
  const [officerRole, setOfficerRole] = useState(null);

  // Service state
  const [services, setServices] = useState([]);
  const [selectedService, setSelectedService] = useState('');
  const [loadingServices, setLoadingServices] = useState(false);

  // Report type state
  const [reportTypes, setReportTypes] = useState([]);
  const [selectedReportType, setSelectedReportType] = useState('');
  const [loadingReportTypes, setLoadingReportTypes] = useState(false);

  // Filter states
  const [districts, setDistricts] = useState([]);
  const [tehsils, setTehsils] = useState([]);
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedTehsil, setSelectedTehsil] = useState('');
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingTehsils, setLoadingTehsils] = useState(false);

  // Report specific states - Status Types (static)
  const [statusTypes] = useState([
    { value: "total", label: "Total Applications" },
    { value: "Initiated", label: "Under Process" },
    { value: "Sanctioned", label: "Sanctioned" },
    { value: "Rejected", label: "Rejected" }
  ]);
  const [selectedStatus, setSelectedStatus] = useState('total');

  // Age ranges (shared between AgeWise and PensionTypeWise)
  const [ageRanges, setAgeRanges] = useState([
    { min: 0, max: 59, label: "Below 60" },
    { min: 60, max: 79, label: "60 to 79" },
    { min: 80, max: 999, label: "80 and Above" }
  ]);
  const [showAgeRangeEditor, setShowAgeRangeEditor] = useState(false);
  const [newAgeRange, setNewAgeRange] = useState({ min: 0, max: 0, label: '' });
  const [editingAgeRangeIndex, setEditingAgeRangeIndex] = useState(null);

  // Table refresh trigger
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showReport, setShowReport] = useState(false);
  const [reportParams, setReportParams] = useState({});

  useEffect(() => {
    const fetchOfficerData = async () => {
      try {
        const response = await axiosInstance.get('/Officer/GetOfficerAccessDetails');
        const data = response.data;
        console.log('Fetched officer data:', data);
        setOfficerAccessLevel(data.accessLevel);
        setOfficerAccessCode(data.accessCode);
        setOfficerRole(data.role);
      } catch (error) {
        console.error('Error fetching officer data:', error);
      }
    };
    fetchOfficerData();
  }, []);

  // Fetch services
  useEffect(() => {
    const fetchServices = async () => {
      setLoadingServices(true);
      try {
        const response = await axiosInstance.get('/Base/GetServices');
        if (response.data.status) {
          setServices(response.data.services);
          if (response.data.services.length > 0) {
            setSelectedService(response.data.services[0].serviceId);
          }
        }
      } catch (error) {
        console.error('Error fetching services:', error);
        toast.error('Failed to fetch services');
      } finally {
        setLoadingServices(false);
      }
    };
    fetchServices();
  }, []);

  // Fetch report types
  useEffect(() => {
    const fetchReportTypes = async () => {
      setLoadingReportTypes(true);
      try {
        const response = await axiosInstance.get('/Officer/GetReportTypes');
        if (response.data.status) {
          setReportTypes(response.data.reportTypes);
        }
      } catch (error) {
        console.error('Error fetching report types:', error);
        toast.error('Failed to fetch report types');
      } finally {
        setLoadingReportTypes(false);
      }
    };
    fetchReportTypes();
  }, []);

  // Fetch districts based on access level
  useEffect(() => {
    const fetchDistricts = async () => {
      if (officerAccessLevel === 'Division') {
        setLoadingDistricts(true);
        try {
          const response = await axiosInstance.get('/Base/GetDistricts', {
            params: { division: officerAccessCode }
          });
          if (response.data.status) {
            setDistricts(response.data.districts);
          }
        } catch (error) {
          console.error('Error fetching districts:', error);
        } finally {
          setLoadingDistricts(false);
        }
      } else if (officerAccessLevel === 'District') {
        fetchTehsils(officerAccessCode);
      }
    };

    if (officerAccessLevel) {
      fetchDistricts();
    }
  }, [officerAccessLevel, officerAccessCode]);

  // Fetch tehsils for selected district
  const fetchTehsils = async (districtId) => {
    if (!districtId) return;

    setLoadingTehsils(true);
    try {
      const response = await axiosInstance.get('/Base/GetTeshilForDistrict', {
        params: { districtId: districtId }
      });
      if (response.data.status) {
        setTehsils(response.data.tehsils);
      }
    } catch (error) {
      console.error('Error fetching tehsils:', error);
    } finally {
      setLoadingTehsils(false);
    }
  };

  // Handle district change
  const handleDistrictChange = (event) => {
    const districtId = event.target.value;
    setSelectedDistrict(districtId);
    setSelectedTehsil('');
    fetchTehsils(districtId);
  };

  // Handle report type change
  const handleReportTypeChange = (event) => {
    const newReportType = event.target.value;
    setSelectedReportType(newReportType);
    setShowReport(false);
  };

  // Handle generate report
  const handleGenerateReport = () => {
    if (!selectedReportType) {
      toast.error('Please select a report type');
      return;
    }

    if (!selectedService) {
      toast.error('Please select a service');
      return;
    }

    // Determine filter values based on access level
    let filterValue = null;
    let accessLevel = officerAccessLevel;

    if (officerAccessLevel === 'Division') {
      if (selectedTehsil) {
        filterValue = selectedTehsil;
        accessLevel = 'Tehsil';
      } else if (selectedDistrict) {
        filterValue = selectedDistrict;
        accessLevel = 'District';
      } else {
        filterValue = officerAccessCode;
        accessLevel = 'Division';
      }
    } else if (officerAccessLevel === 'District') {
      if (selectedTehsil) {
        filterValue = selectedTehsil;
        accessLevel = 'Tehsil';
      } else {
        filterValue = officerAccessCode;
        accessLevel = 'District';
      }
    } else if (officerAccessLevel === 'Tehsil') {
      filterValue = officerAccessCode;
      accessLevel = 'Tehsil';
    }

    // Build extra parameters
    const params = {
      accessCode: filterValue,
      serviceId: selectedService,
      accessLevel: accessLevel,
      reportType: selectedReportType
    };

    // Add status filter for reports that need it
    if (selectedReportType === 'AgeWise' ||
      selectedReportType === 'PensionTypeWise' ||
      selectedReportType === 'GenderWise' ||
      selectedReportType === 'DetailedApplications') {
      params.statusType = selectedStatus;
    }

    // Add age ranges for AgeWise and PensionTypeWise reports
    if (selectedReportType === 'AgeWise' || selectedReportType === 'PensionTypeWise') {
      params.ageRanges = JSON.stringify(ageRanges);
    }

    // Add role for DetailedApplications
    if (selectedReportType === 'DetailedApplications') {
      params.role = officerRole;
    }

    setReportParams(params);
    setShowReport(true);
    setRefreshTrigger(prev => prev + 1);
  };

  // Age range management functions
  const addAgeRange = () => {
    if (newAgeRange.min < newAgeRange.max && newAgeRange.label) {
      setAgeRanges([...ageRanges, { ...newAgeRange }]);
      setNewAgeRange({ min: 0, max: 0, label: '' });
    }
  };

  const updateAgeRange = () => {
    if (editingAgeRangeIndex !== null && newAgeRange.min < newAgeRange.max && newAgeRange.label) {
      const updatedRanges = [...ageRanges];
      updatedRanges[editingAgeRangeIndex] = { ...newAgeRange };
      setAgeRanges(updatedRanges);
      setEditingAgeRangeIndex(null);
      setNewAgeRange({ min: 0, max: 0, label: '' });
    }
  };

  const editAgeRange = (index) => {
    setEditingAgeRangeIndex(index);
    setNewAgeRange({ ...ageRanges[index] });
  };

  const removeAgeRange = (index) => {
    setAgeRanges(ageRanges.filter((_, i) => i !== index));
  };

  // Determine which filters to show based on access level
  const renderLocationFilters = () => {
    if (!officerAccessLevel) return null;

    switch (officerAccessLevel) {
      case 'Division':
        return (
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>District</InputLabel>
                <Select
                  value={selectedDistrict}
                  onChange={handleDistrictChange}
                  label="District"
                  disabled={loadingDistricts}
                >
                  <MenuItem value="">
                    <em>Select District</em>
                  </MenuItem>
                  {districts.map((district) => (
                    <MenuItem key={district.districtid} value={district.districtid}>
                      {district.districtname}
                    </MenuItem>
                  ))}
                </Select>
                {loadingDistricts && <FormHelperText>Loading districts...</FormHelperText>}
              </FormControl>
            </Grid>

            {selectedDistrict && (
              <Grid item xs={12} md={4}>
                <FormControl fullWidth>
                  <InputLabel>Tehsil</InputLabel>
                  <Select
                    value={selectedTehsil}
                    onChange={(e) => setSelectedTehsil(e.target.value)}
                    label="Tehsil"
                    disabled={loadingTehsils}
                  >
                    <MenuItem value="">
                      <em>Select Tehsil</em>
                    </MenuItem>
                    {tehsils.map((tehsil) => (
                      <MenuItem key={tehsil.tehsilid} value={tehsil.tehsilid}>
                        {tehsil.tehsilname}
                      </MenuItem>
                    ))}
                  </Select>
                  {loadingTehsils && <FormHelperText>Loading tehsils...</FormHelperText>}
                </FormControl>
              </Grid>
            )}
          </Grid>
        );

      case 'District':
        return (
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Tehsil</InputLabel>
                <Select
                  value={selectedTehsil}
                  onChange={(e) => setSelectedTehsil(e.target.value)}
                  label="Tehsil"
                  disabled={loadingTehsils}
                >
                  <MenuItem value="">
                    <em>Select Tehsil</em>
                  </MenuItem>
                  {tehsils.map((tehsil) => (
                    <MenuItem key={tehsil.tehsilid} value={tehsil.tehsilid}>
                      {tehsil.tehsilname}
                    </MenuItem>
                  ))}
                </Select>
                {loadingTehsils && <FormHelperText>Loading tehsils...</FormHelperText>}
              </FormControl>
            </Grid>
          </Grid>
        );

      case 'Tehsil':
        return (
          <Typography variant="body2" color="textSecondary">
            No location filters available for Tehsil level access
          </Typography>
        );

      default:
        return null;
    }
  };

  // Render additional filters (Status and Age Ranges)
  const renderAdditionalFilters = () => {
    if (!selectedReportType) return null;

    const needsStatusFilter = ['AgeWise', 'PensionTypeWise', 'GenderWise', 'DetailedApplications'].includes(selectedReportType);
    const needsAgeRanges = ['AgeWise', 'PensionTypeWise'].includes(selectedReportType);

    if (!needsStatusFilter && !needsAgeRanges) return null;

    return (
      <Box sx={{ mt: 3 }}>
        {needsStatusFilter && (
          <>
            <Typography variant="subtitle1" gutterBottom>
              Status Filter
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth>
                  <InputLabel>Application Status</InputLabel>
                  <Select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    label="Application Status"
                  >
                    {statusTypes.map((status) => (
                      <MenuItem key={status.value} value={status.value}>
                        {status.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </>
        )}

        {needsAgeRanges && (
          <>
            <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>
              Age Ranges (Dynamic)
            </Typography>
            <Button
              variant="outlined"
              size="small"
              onClick={() => setShowAgeRangeEditor(!showAgeRangeEditor)}
              sx={{ mb: 2 }}
            >
              {showAgeRangeEditor ? 'Hide Range Editor' : 'Edit Age Ranges'}
            </Button>

            <Collapse in={showAgeRangeEditor}>
              <Card variant="outlined" sx={{ mb: 2, p: 2 }}>
                <Typography variant="body2" gutterBottom>
                  {editingAgeRangeIndex !== null ? 'Edit Age Range' : 'Add New Age Range'}
                </Typography>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={3}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Min Age"
                      size="small"
                      value={newAgeRange.min}
                      onChange={(e) => setNewAgeRange({ ...newAgeRange, min: parseInt(e.target.value) || 0 })}
                    />
                  </Grid>
                  <Grid item xs={3}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Max Age"
                      size="small"
                      value={newAgeRange.max}
                      onChange={(e) => setNewAgeRange({ ...newAgeRange, max: parseInt(e.target.value) || 0 })}
                    />
                  </Grid>
                  <Grid item xs={4}>
                    <TextField
                      fullWidth
                      label="Label"
                      size="small"
                      value={newAgeRange.label}
                      onChange={(e) => setNewAgeRange({ ...newAgeRange, label: e.target.value })}
                    />
                  </Grid>
                  <Grid item xs={2}>
                    {editingAgeRangeIndex !== null ? (
                      <Button variant="contained" onClick={updateAgeRange} fullWidth size="small">
                        Update
                      </Button>
                    ) : (
                      <Button variant="contained" onClick={addAgeRange} fullWidth size="small">
                        Add
                      </Button>
                    )}
                  </Grid>
                </Grid>

                <Box sx={{ mt: 2 }}>
                  {ageRanges.map((range, index) => (
                    <Chip
                      key={index}
                      label={`${range.min}-${range.max}: ${range.label}`}
                      onDelete={() => removeAgeRange(index)}
                      onClick={() => editAgeRange(index)}
                      sx={{ mr: 1, mb: 1, cursor: 'pointer' }}
                      size="small"
                    />
                  ))}
                </Box>
              </Card>
            </Collapse>
          </>
        )}
      </Box>
    );
  };

  // Get report title
  const getReportTitle = () => {
    if (!selectedReportType) return 'Reports';
    const reportType = reportTypes.find(r => r.value === selectedReportType);
    const service = services.find(s => s.serviceId === selectedService);
    return reportType ? `${reportType.label} - ${service?.serviceName || ''}` : 'Reports';
  };

  // Get searchable fields based on report type
  const getSearchableFields = () => {
    switch (selectedReportType) {
      case 'AgeWise':
        return ['age_range'];
      case 'PensionTypeWise':
        return ['age_range', 'pensiontype'];
      case 'GenderWise':
        return ['gender'];
      case 'DetailedApplications':
        return ['referencenumber', 'applicant_name', 'districtname', 'tswofficename'];
      default:
        return ['tehsilname'];
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
        <Typography variant="h5" gutterBottom>
          Reports
        </Typography>

        {/* Officer Info */}
        {officerRole && (
          <Typography variant="subtitle1" color="textSecondary" gutterBottom>
            Role: {officerRole} | Level: {officerAccessLevel}
          </Typography>
        )}

        {/* Service Selection */}
        <Box sx={{ mt: 3 }}>
          <Typography variant="h6" gutterBottom>
            Step 1: Select Service
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Service</InputLabel>
                <Select
                  value={selectedService}
                  onChange={(e) => setSelectedService(e.target.value)}
                  label="Service"
                  disabled={loadingServices}
                >
                  {services.map((service) => (
                    <MenuItem key={service.serviceId} value={service.serviceId}>
                      {service.serviceName}
                    </MenuItem>
                  ))}
                </Select>
                {loadingServices && <FormHelperText>Loading services...</FormHelperText>}
              </FormControl>
            </Grid>
          </Grid>
        </Box>

        {/* Report Type Selection */}
        <Box sx={{ mt: 3 }}>
          <Typography variant="h6" gutterBottom>
            Step 2: Select Report Type
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Report Type</InputLabel>
                <Select
                  value={selectedReportType}
                  onChange={handleReportTypeChange}
                  label="Report Type"
                  disabled={loadingReportTypes}
                >
                  <MenuItem value="">
                    <em>Select Report Type</em>
                  </MenuItem>
                  {reportTypes.map((type) => (
                    <MenuItem key={type.value} value={type.value}>
                      {type.label}
                    </MenuItem>
                  ))}
                </Select>
                {loadingReportTypes && <FormHelperText>Loading report types...</FormHelperText>}
              </FormControl>
            </Grid>
          </Grid>
        </Box>

        {/* Filters Section */}
        {selectedReportType && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="h6" gutterBottom>
              Step 3: Apply Filters (Optional)
            </Typography>
            {renderLocationFilters()}
            {renderAdditionalFilters()}
            <Box sx={{ mt: 2 }}>
              <Button
                variant="contained"
                color="primary"
                onClick={handleGenerateReport}
                disabled={!selectedService || !selectedReportType}
                size="large"
              >
                Generate Report
              </Button>
            </Box>
          </Box>
        )}
      </Paper>

      {/* Report Display using ServerSideTable */}
      {showReport && (
        <ServerSideTable
          key={refreshTrigger}
          url="/Officer/GetApplicationsForReport"
          extraParams={reportParams}
          Title={getReportTitle()}
          searchableFields={getSearchableFields()}
          showDownloadButtons={true}
          actionFunctions={{}}
        />
      )}
    </Box>
  );
}