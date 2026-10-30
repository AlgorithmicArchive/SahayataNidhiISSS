import React, { useEffect, useState, useContext, useMemo } from "react";
import {
  Box,
  Container,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Paper,
} from "@mui/material";
import { useForm, Controller } from "react-hook-form";
import axiosInstance from "../../axiosConfig";
import MessageModal from "../../components/MessageModal";
import ServerSideTable from "../../components/ServerSideTable";
import { UserContext } from "../../UserContext";
import { Add, Edit, ListAlt, AdminPanelSettings } from "@mui/icons-material";
import GovPageHeader from "../../components/gov/GovPageHeader";

export default function AddDesignations() {
  const { userType, officerAuthorities } = useContext(UserContext);
  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm({
    defaultValues: {
      designation: "",
      designationShort: "",
      accessLevel: "",
    },
  });

  const [departmentId, setDepartmentId] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [modalMessage, setModalMessage] = useState({
    title: "",
    message: "",
    type: "success",
  });
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingDesignation, setEditingDesignation] = useState(null);
  const [refreshTable, setRefreshTable] = useState(false);

  // Check if user has permission to update/delete
  const canModifyDesignations = useMemo(() => {
    return (
      officerAuthorities?.canDirectWithhold ||
      userType === "SeniorOfficer" ||
      userType === "Admin"
    );
  }, [userType, officerAuthorities]);

  // Fetch current officer's details to get DepartmentId
  useEffect(() => {
    const fetchOfficerDetails = async () => {
      setIsLoading(true);
      try {
        const response = await axiosInstance.get(
          "/Admin/GetCurrentAdminDetails",
        );
        if (!response.data || !response.data.additionalDetails) {
          throw new Error("Officer data is missing");
        }

        const details = JSON.parse(response.data.additionalDetails);
        if (!details || !details.Department) {
          throw new Error("Invalid officer details");
        }

        setDepartmentId(details.Department);
      } catch (error) {
        setErrorMessage(`Error loading officer data: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOfficerDetails();
  }, []);

  // Reset form when edit modal closes
  useEffect(() => {
    if (!editModalOpen) {
      reset({ designation: "", designationShort: "", accessLevel: "" });
      setEditingDesignation(null);
    }
  }, [editModalOpen, reset]);

  // Handle form submission for adding a designation
  const onSubmit = async (data) => {
    try {
      const formData = new FormData();
      formData.append("Designation", data.designation);
      formData.append("DesignationShort", data.designationShort);
      formData.append("AccessLevel", data.accessLevel);
      formData.append("DepartmentId", departmentId.toString());

      const response = await axiosInstance.post(
        "/Admin/AddDesignation",
        formData,
      );

      if (response.data.status) {
        setModalMessage({
          title: "Add Designation",
          message: "Designation Added Successfully.",
          type: "success",
        });
        setShowMessageModal(true);
        reset();
        setErrorMessage("");
        setRefreshTable((prev) => !prev);
      } else {
        setErrorMessage(
          `Failed to add designation: ${response.data.message || "Unknown error"}`,
        );
      }
    } catch (error) {
      setErrorMessage(`Error creating designation: ${error.message}`);
    }
  };

  // Handle update designation
  const handleUpdate = async (data) => {
    if (!editingDesignation) return;

    try {
      const formData = new FormData();
      formData.append("DesignationId", editingDesignation.designationId);
      formData.append("Designation", data.designation);
      formData.append("DesignationShort", data.designationShort);
      formData.append("AccessLevel", data.accessLevel);
      formData.append("DepartmentId", departmentId.toString());

      const response = await axiosInstance.post(
        "/Admin/UpdateDesignation",
        formData,
      );

      if (response.data.status) {
        setModalMessage({
          title: "Update Designation",
          message: "Designation Updated Successfully.",
          type: "success",
        });
        setShowMessageModal(true);
        setEditModalOpen(false);
        setRefreshTable((prev) => !prev);
      } else {
        setErrorMessage(
          `Failed to update designation: ${response.data.message || "Unknown error"}`,
        );
      }
    } catch (error) {
      setErrorMessage(`Error updating designation: ${error.message}`);
    }
  };

  // Handle delete designation
  const handleDelete = async (designationId) => {
    if (!window.confirm("Are you sure you want to delete this designation?"))
      return;

    try {
      const formData = new FormData();
      formData.append("DesignationId", designationId);

      const response = await axiosInstance.post(
        "/Admin/DeleteDesignation",
        formData,
      );

      if (response.data.status) {
        setModalMessage({
          title: "Delete Designation",
          message: "Designation Deleted Successfully.",
          type: "success",
        });
        setShowMessageModal(true);
        setRefreshTable((prev) => !prev);
      } else {
        setErrorMessage(
          `Failed to delete designation: ${response.data.message || "Unknown error"}`,
        );
      }
    } catch (error) {
      setErrorMessage(`Error deleting designation: ${error.message}`);
    }
  };

  // Action functions for ServerSideTable
  const actionFunctions = {
    UpdateDesignation: (row) => {
      if (!canModifyDesignations) {
        setErrorMessage("You do not have permission to update designations.");
        return;
      }
      const userdata = row.original;
      setEditingDesignation(userdata);
      setValue("designation", userdata.designation);
      setValue("designationShort", userdata.designationShort);
      setValue("accessLevel", userdata.accessLevel);
      setEditModalOpen(true);
    },
    DeleteDesignation: (row) => {
      if (!canModifyDesignations) {
        setErrorMessage("You do not have permission to delete designations.");
        return;
      }
      handleDelete(row.original.designationId);
    },
  };

  // Table columns
  const columns = [
    { field: "designationId", headerName: "ID", flex: 1 },
    { field: "designation", headerName: "Designation", flex: 1 },
    { field: "designationShort", headerName: "Short Name", flex: 1 },
    { field: "accessLevel", headerName: "Access Level", flex: 1 },
  ];

  if (isLoading) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
          bgcolor: "#F8FAFC",
        }}
      >
        <CircularProgress size={60} sx={{ color: "#2562E9" }} />
      </Box>
    );
  }

  if (errorMessage && !departmentId && !editModalOpen) {
    return (
      <Box sx={{ bgcolor: "#F8FAFC", minHeight: "100vh", py: 8 }}>
        <Container maxWidth="md">
          <Alert
            severity="error"
            sx={{ borderRadius: 2, border: "1px solid #FECACA" }}
          >
            <Typography fontWeight={600}>{errorMessage}</Typography>
          </Alert>
        </Container>
      </Box>
    );
  }

  return (
    <Box sx={{ bgcolor: "#F8FAFC", minHeight: "100vh", py: 4 }}>
      <Container maxWidth="lg">
        {/* Page Header - GIGW standard */}
        <GovPageHeader
          title="Designation Management"
          hindiTitle="पदनाम प्रबंधन"
          subtitle="Create and manage officer designations and access levels"
          icon={
            <AdminPanelSettings sx={{ fontSize: 32, color: "primary.main" }} />
          }
        />

        {/* Permission Warning */}
        {!canModifyDesignations && (
          <Alert
            severity="info"
            sx={{ mb: 3, borderRadius: 2, border: "1px solid #BFDBFE" }}
          >
            <Typography fontWeight={600}>View Only Access</Typography>
            <Typography variant="body2">
              You do not have permission to add, edit, or delete designations.
            </Typography>
          </Alert>
        )}

        {/* Global Inline Errors */}
        {errorMessage && departmentId && !editModalOpen && (
          <Alert
            severity="error"
            sx={{ mb: 3, borderRadius: 2, border: "1px solid #FECACA" }}
          >
            {errorMessage}
          </Alert>
        )}

        {/* Add Form Card */}
        <Paper
          elevation={0}
          sx={{
            p: 4,
            mb: 4,
            borderRadius: 3,
            border: "1px solid #E2E8F0",
            bgcolor: "white",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 3 }}>
            <Add sx={{ color: "#2562E9" }} />
            <Typography variant="h6" sx={{ fontWeight: 700, color: "#0F172A" }}>
              Add New Designation
            </Typography>
          </Box>

          <Box component="form" onSubmit={handleSubmit(onSubmit)}>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={4}>
                <Controller
                  name="designation"
                  control={control}
                  rules={{ required: "Designation is required" }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Designation"
                      error={!!errors.designation}
                      helperText={errors.designation?.message}
                      disabled={!canModifyDesignations}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <Controller
                  name="designationShort"
                  control={control}
                  rules={{ required: "Short name is required" }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Short Name"
                      error={!!errors.designationShort}
                      helperText={errors.designationShort?.message}
                      disabled={!canModifyDesignations}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <Controller
                  name="accessLevel"
                  control={control}
                  rules={{ required: "Access level is required" }}
                  render={({ field }) => (
                    <FormControl fullWidth error={!!errors.accessLevel}>
                      <InputLabel>Access Level</InputLabel>
                      <Select
                        {...field}
                        label="Access Level"
                        disabled={!canModifyDesignations}
                      >
                        <MenuItem value="">Select Access Level</MenuItem>
                        <MenuItem value="State">State</MenuItem>
                        <MenuItem value="Division">Division</MenuItem>
                        <MenuItem value="District">District</MenuItem>
                        <MenuItem value="Tehsil">Tehsil</MenuItem>
                      </Select>
                      {errors.accessLevel && (
                        <Typography
                          color="error"
                          variant="caption"
                          sx={{ mt: 0.5, ml: 1.5 }}
                        >
                          {errors.accessLevel.message}
                        </Typography>
                      )}
                    </FormControl>
                  )}
                />
              </Grid>
              <Grid item xs={12}>
                <Button
                  type="submit"
                  variant="contained"
                  fullWidth
                  disabled={!canModifyDesignations}
                  sx={{
                    mt: 1,
                    py: 1.5,
                    fontSize: "1rem",
                    fontWeight: 700,
                    textTransform: "none",
                    bgcolor: "#2562E9",
                    "&:hover": { bgcolor: "#1D4ED8" },
                    boxShadow: "0 4px 12px rgba(37, 99, 233, 0.2)",
                  }}
                >
                  Add Designation
                </Button>
              </Grid>
            </Grid>
          </Box>
        </Paper>

        {/* Existing Designations Table */}
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 3 }}>
            <ListAlt sx={{ color: "#2562E9" }} />
            <Typography variant="h6" sx={{ fontWeight: 700, color: "#0F172A" }}>
              Existing Designations
            </Typography>
          </Box>

          <ServerSideTable
            url="/Admin/GetDesignations"
            Title="Existing Designations"
            extraParams={{}}
            canSanction={false}
            canHavePool={false}
            pendingApplications={false}
            actionFunctions={actionFunctions}
            columns={columns}
            refresh={refreshTable}
            onAction={(actionFunction, row) =>
              actionFunctions[actionFunction](row)
            }
            showDownloadButtons={true}
          />
        </Box>

        {/* Success Message Modal */}
        <MessageModal
          title={modalMessage.title}
          message={modalMessage.message}
          type={modalMessage.type}
          key="designationAction"
          open={showMessageModal}
          onClose={() => setShowMessageModal(false)}
        />

        {/* Edit Designation Dialog */}
        <Dialog
          open={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          maxWidth="sm"
          fullWidth
          PaperProps={{ sx: { borderRadius: 3 } }}
        >
          <DialogTitle
            sx={{
              fontWeight: 700,
              color: "#0F172A",
              display: "flex",
              alignItems: "center",
              gap: 1,
              pb: 1,
            }}
          >
            <Edit sx={{ color: "#2562E9" }} /> Edit Designation
          </DialogTitle>
          <DialogContent sx={{ px: 3, pb: 2, pt: 2 }}>
            {errorMessage && editModalOpen && (
              <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
                {errorMessage}
              </Alert>
            )}
            <Box
              component="form"
              id="edit-designation-form"
              onSubmit={handleSubmit(handleUpdate)}
            >
              <Grid container spacing={3}>
                <Grid item xs={12} sm={4}>
                  <Controller
                    name="designation"
                    control={control}
                    rules={{ required: "Designation is required" }}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label="Designation"
                        error={!!errors.designation}
                        helperText={errors.designation?.message}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Controller
                    name="designationShort"
                    control={control}
                    rules={{ required: "Short name is required" }}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label="Short Name"
                        error={!!errors.designationShort}
                        helperText={errors.designationShort?.message}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Controller
                    name="accessLevel"
                    control={control}
                    rules={{ required: "Access level is required" }}
                    render={({ field }) => (
                      <FormControl fullWidth error={!!errors.accessLevel}>
                        <InputLabel>Access Level</InputLabel>
                        <Select {...field} label="Access Level">
                          <MenuItem value="">Select Access Level</MenuItem>
                          <MenuItem value="State">State</MenuItem>
                          <MenuItem value="Division">Division</MenuItem>
                          <MenuItem value="District">District</MenuItem>
                          <MenuItem value="Tehsil">Tehsil</MenuItem>
                        </Select>
                        {errors.accessLevel && (
                          <Typography
                            color="error"
                            variant="caption"
                            sx={{ mt: 0.5, ml: 1.5 }}
                          >
                            {errors.accessLevel.message}
                          </Typography>
                        )}
                      </FormControl>
                    )}
                  />
                </Grid>
              </Grid>
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3, pt: 0 }}>
            <Button
              onClick={() => setEditModalOpen(false)}
              sx={{ textTransform: "none", color: "#64748B" }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="edit-designation-form"
              variant="contained"
              sx={{
                textTransform: "none",
                fontWeight: 600,
                bgcolor: "#2562E9",
                "&:hover": { bgcolor: "#1D4ED8" },
              }}
            >
              Update Designation
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Box>
  );
}
