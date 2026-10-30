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
import { Add, Edit, ListAlt, Business } from "@mui/icons-material";
import GovPageHeader from "../../components/gov/GovPageHeader";

export default function AddOffices() {
  const { userType, officerAuthorities } = useContext(UserContext);
  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm({
    defaultValues: {
      officeName: "",
      officeNameShort: "",
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
  const [editingOffice, setEditingOffice] = useState(null);
  const [refreshTable, setRefreshTable] = useState(false);

  const canModifyOffices = useMemo(() => {
    return (
      officerAuthorities?.canDirectWithhold ||
      userType === "SeniorOfficer" ||
      userType === "Admin"
    );
  }, [userType, officerAuthorities]);

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
        if (!details) {
          throw new Error("Invalid officer details");
        }
        if (details.Department === undefined || details.Department === null) {
          throw new Error(
            "Department information not found in officer details",
          );
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

  useEffect(() => {
    if (!editModalOpen) {
      reset({ officeName: "", officeNameShort: "", accessLevel: "" });
      setEditingOffice(null);
    }
  }, [editModalOpen, reset]);

  const onSubmit = async (data) => {
    try {
      const formData = new FormData();
      formData.append("OfficeName", data.officeName);
      formData.append("OfficeNameShort", data.officeNameShort);
      formData.append("AccessLevel", data.accessLevel);
      formData.append("DepartmentId", departmentId.toString());

      const response = await axiosInstance.post("/Admin/AddOffice", formData);

      if (response.data.status) {
        setModalMessage({
          title: "Add Office",
          message: "Office Added Successfully.",
          type: "success",
        });
        setShowMessageModal(true);
        reset();
        setErrorMessage("");
        setRefreshTable((prev) => !prev);
      } else {
        setErrorMessage(
          `Failed to add office: ${response.data.message || "Unknown error"}`,
        );
      }
    } catch (error) {
      setErrorMessage(`Error creating office: ${error.message}`);
    }
  };

  const handleUpdate = async (data) => {
    if (!editingOffice) return;
    try {
      const formData = new FormData();
      formData.append("OfficeId", editingOffice.officeId);
      formData.append("OfficeName", data.officeName);
      formData.append("OfficeNameShort", data.officeNameShort);
      formData.append("AccessLevel", data.accessLevel);
      formData.append("DepartmentId", departmentId.toString());

      const response = await axiosInstance.post(
        "/Admin/UpdateOffice",
        formData,
      );

      if (response.data.status) {
        setModalMessage({
          title: "Update Office",
          message: "Office Updated Successfully.",
          type: "success",
        });
        setShowMessageModal(true);
        setEditModalOpen(false);
        setRefreshTable((prev) => !prev);
      } else {
        setErrorMessage(
          `Failed to update office: ${response.data.message || "Unknown error"}`,
        );
      }
    } catch (error) {
      setErrorMessage(`Error updating office: ${error.message}`);
    }
  };

  const handleDelete = async (officeId) => {
    if (!window.confirm("Are you sure you want to delete this office?")) return;
    try {
      const formData = new FormData();
      formData.append("OfficeId", officeId);
      const response = await axiosInstance.post(
        "/Admin/DeleteOffice",
        formData,
      );

      if (response.data.status) {
        setModalMessage({
          title: "Delete Office",
          message: "Office Deleted Successfully.",
          type: "success",
        });
        setShowMessageModal(true);
        setRefreshTable((prev) => !prev);
      } else {
        setErrorMessage(
          `Failed to delete office: ${response.data.message || "Unknown error"}`,
        );
      }
    } catch (error) {
      setErrorMessage(`Error deleting office: ${error.message}`);
    }
  };

  const actionFunctions = {
    UpdateOffice: (row) => {
      if (!canModifyOffices) {
        setErrorMessage("You do not have permission to update offices.");
        return;
      }
      const userdata = row.original;
      setEditingOffice(userdata);
      setValue("officeName", userdata.officeName);
      setValue("officeNameShort", userdata.officeNameShort);
      setValue("accessLevel", userdata.accessLevel);
      setEditModalOpen(true);
    },
    DeleteOffice: (row) => {
      if (!canModifyOffices) {
        setErrorMessage("You do not have permission to delete offices.");
        return;
      }
      handleDelete(row.original.officeId);
    },
  };

  const columns = [
    { field: "officeId", headerName: "ID", flex: 1 },
    { field: "officeName", headerName: "Office Name", flex: 1 },
    { field: "officeNameShort", headerName: "Short Name", flex: 1 },
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

  if (errorMessage && departmentId === null && !editModalOpen) {
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
          title="Office Management"
          hindiTitle="कार्यालय प्रबंधन"
          subtitle="Create and manage departmental offices and their jurisdiction levels"
          icon={<Business sx={{ fontSize: 32, color: "primary.main" }} />}
        />

        {/* Permission Warning */}
        {!canModifyOffices && (
          <Alert
            severity="info"
            sx={{ mb: 3, borderRadius: 2, border: "1px solid #BFDBFE" }}
          >
            <Typography fontWeight={600}>View Only Access</Typography>
            <Typography variant="body2">
              You do not have permission to add, edit, or delete offices.
            </Typography>
          </Alert>
        )}

        {/* Global Inline Errors */}
        {errorMessage && departmentId !== null && !editModalOpen && (
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
              Add New Office
            </Typography>
          </Box>

          <Box component="form" onSubmit={handleSubmit(onSubmit)}>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="officeName"
                  control={control}
                  rules={{ required: "Office name is required" }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Office Name"
                      error={!!errors.officeName}
                      helperText={errors.officeName?.message}
                      disabled={!canModifyOffices || departmentId === null}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="officeNameShort"
                  control={control}
                  rules={{ required: "Short name is required" }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Short Name"
                      error={!!errors.officeNameShort}
                      helperText={errors.officeNameShort?.message}
                      disabled={!canModifyOffices || departmentId === null}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
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
                        disabled={!canModifyOffices || departmentId === null}
                      >
                        <MenuItem value="">Select Access Level</MenuItem>
                        <MenuItem value="State">State</MenuItem>
                        <MenuItem value="Division">Division</MenuItem>
                        <MenuItem value="District">District</MenuItem>
                        <MenuItem value="Tehsil">Tehsil</MenuItem>
                        <MenuItem value="Block">Block</MenuItem>
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
                  disabled={!canModifyOffices || departmentId === null}
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
                  Add Office
                </Button>
              </Grid>
            </Grid>
          </Box>
        </Paper>

        {/* Existing Offices Table */}
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 3 }}>
            <ListAlt sx={{ color: "#2562E9" }} />
            <Typography variant="h6" sx={{ fontWeight: 700, color: "#0F172A" }}>
              Existing Offices
            </Typography>
          </Box>

          <ServerSideTable
            url="/Admin/GetOffices"
            Title="Existing Offices"
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
          key="officeAction"
          open={showMessageModal}
          onClose={() => setShowMessageModal(false)}
        />

        {/* Edit Office Dialog */}
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
            <Edit sx={{ color: "#2562E9" }} /> Edit Office
          </DialogTitle>
          <DialogContent sx={{ px: 3, pb: 2, pt: 2 }}>
            {errorMessage && editModalOpen && (
              <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
                {errorMessage}
              </Alert>
            )}
            <Box
              component="form"
              id="edit-office-form"
              onSubmit={handleSubmit(handleUpdate)}
            >
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <Controller
                    name="officeName"
                    control={control}
                    rules={{ required: "Office name is required" }}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label="Office Name"
                        error={!!errors.officeName}
                        helperText={errors.officeName?.message}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Controller
                    name="officeNameShort"
                    control={control}
                    rules={{ required: "Short name is required" }}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label="Short Name"
                        error={!!errors.officeNameShort}
                        helperText={errors.officeNameShort?.message}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
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
                          <MenuItem value="Block">Block</MenuItem>
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
              form="edit-office-form"
              variant="contained"
              sx={{
                textTransform: "none",
                fontWeight: 600,
                bgcolor: "#2562E9",
                "&:hover": { bgcolor: "#1D4ED8" },
              }}
            >
              Update Office
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Box>
  );
}
