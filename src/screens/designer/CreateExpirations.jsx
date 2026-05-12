import React, { useState, useEffect, useCallback } from "react";
import {
    Box,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    IconButton,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    FormControlLabel,
    Checkbox,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Grid,
    Chip,
    Typography,
    CircularProgress,
    Tooltip,
    Switch,
} from "@mui/material";
import {
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    Refresh as RefreshIcon,
} from "@mui/icons-material";
import { useForm, Controller } from "react-hook-form";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import axiosInstance from "../../axiosConfig";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const CreateExpirations = () => {
    const [expirationTypes, setExpirationTypes] = useState([]);
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    const {
        control,
        handleSubmit,
        reset,
        watch,
        formState: { errors },
    } = useForm({
        defaultValues: {
            typeCode: "",
            serviceId: null,
            expirationName: "",
            description: "",
            messageTemplate: "",
            basedOnField: false,
            conditionField: "{}",
            valueField: "",
            validityPeriod: "",
            reminderBefore: "",
            stopPaymentOnExpiry: false,
            stopPaymentGracePeriod: "",
            isActive: true,
        },
    });

    const basedOnField = watch("basedOnField");

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [typesRes, servicesRes] = await Promise.all([
                axiosInstance.get("/Designer/GetAll"),
                axiosInstance.get("/Base/GetServices"),
            ]);
            if (typesRes.data.status) setExpirationTypes(typesRes.data.data);
            if (servicesRes.data.status && servicesRes.data.services)
                setServices(servicesRes.data.services);
        } catch (error) {
            console.error("Error fetching data:", error);
            toast.error("Failed to load data.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleOpenDialog = (item = null) => {
        if (item) {
            setEditingItem(item);
            // API returns camelCase (e.g., typeCode, conditionField)
            const conditionFieldStr = item.conditionField || "{}";
            reset({
                typeCode: item.typeCode,
                serviceId: item.serviceId,
                expirationName: item.expirationName,
                description: item.description || "",
                messageTemplate: item.messageTemplate || "",
                basedOnField: item.basedOnField || false,
                conditionField: conditionFieldStr,
                valueField: item.valueField || "",
                validityPeriod: item.validityPeriod || "",
                reminderBefore: item.reminderBefore || "",
                stopPaymentOnExpiry: item.stopPaymentOnExpiry || false,
                stopPaymentGracePeriod: item.stopPaymentGracePeriod || "",
                isActive: item.isActive !== undefined ? item.isActive : true,
            });
        } else {
            setEditingItem(null);
            reset({
                typeCode: "",
                serviceId: null,
                expirationName: "",
                description: "",
                messageTemplate: "",
                basedOnField: false,
                conditionField: "{}",
                valueField: "",
                validityPeriod: "",
                reminderBefore: "",
                stopPaymentOnExpiry: false,
                stopPaymentGracePeriod: "",
                isActive: true,
            });
        }
        setDialogOpen(true);
    };

    const handleCloseDialog = () => {
        setDialogOpen(false);
        setEditingItem(null);
        reset();
    };

    const onSubmit = async (data) => {
        setSubmitting(true);
        try {
            let conditionFieldStr = data.conditionField?.trim() || "{}";
            if (conditionFieldStr !== "{}") {
                try {
                    JSON.parse(conditionFieldStr);
                } catch (e) {
                    toast.error("Invalid JSON in Condition Field");
                    setSubmitting(false);
                    return;
                }
            }

            // 🔥 CRITICAL: Send PascalCase property names to match C# entity
            const payload = {
                TypeCode: data.typeCode,
                ServiceId: data.serviceId,
                ExpirationName: data.expirationName,
                Description: data.description || null,
                MessageTemplate: data.messageTemplate || null,
                BasedOnField: data.basedOnField,
                ConditionField: conditionFieldStr,
                ValueField: data.valueField || null,
                ValidityPeriod: data.validityPeriod || null,
                ReminderBefore: data.reminderBefore || null,
                StopPaymentOnExpiry: data.stopPaymentOnExpiry,
                StopPaymentGracePeriod: data.stopPaymentGracePeriod || null,
                IsActive: data.isActive,
            };

            let response;
            if (editingItem) {
                response = await axiosInstance.put(
                    `/Designer/Update?id=${editingItem.id}`,
                    payload
                );
            } else {
                response = await axiosInstance.post("/Designer/Create", payload);
            }

            if (response.data.status) {
                toast.success(
                    editingItem
                        ? "Expiration type updated successfully"
                        : "Expiration type created successfully"
                );
                handleCloseDialog();
                fetchData();
            } else {
                toast.error(response.data.message || "Operation failed");
            }
        } catch (error) {
            console.error("Error saving:", error);
            if (error.response) {
                console.error("Response data:", error.response.data);
                console.error("Response status:", error.response.status);
                toast.error(error.response.data?.message || `Error ${error.response.status}: Failed to save`);
            } else {
                toast.error("Network error. Please try again.");
            }
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteClick = (item) => {
        setItemToDelete(item);
        setDeleteConfirmOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!itemToDelete) return;
        try {
            const response = await axiosInstance.delete(
                `/Designer/Delete?id=${itemToDelete.id}`
            );
            if (response.data.status) {
                toast.success("Expiration type deleted successfully");
                fetchData();
            } else {
                toast.error(response.data.message || "Delete failed");
            }
        } catch (error) {
            console.error("Error deleting:", error);
            toast.error(error.response?.data?.message || "Failed to delete");
        } finally {
            setDeleteConfirmOpen(false);
            setItemToDelete(null);
        }
    };

    const periodOptions = [
        "1 month",
        "3 months",
        "6 months",
        "1 year",
        "2 years",
        "3 years",
        "5 years",
    ];

    const formatDate = (dateString) => {
        if (!dateString) return "N/A";
        return new Date(dateString).toLocaleString();
    };

    return (
        <Box sx={{ p: 3 }}>
            <ToastContainer position="top-right" autoClose={3000} />
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
                <Typography variant="h4">Expiration Types Management</Typography>
                <Box>
                    <Tooltip title="Refresh">
                        <IconButton onClick={fetchData} sx={{ mr: 1 }}>
                            <RefreshIcon />
                        </IconButton>
                    </Tooltip>
                    <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
                        Add New
                    </Button>
                </Box>
            </Box>

            {loading ? (
                <Box sx={{ display: "flex", justifyContent: "center", p: 5 }}>
                    <CircularProgress />
                </Box>
            ) : (
                <TableContainer component={Paper}>
                    <Table sx={{ minWidth: 650 }}>
                        <TableHead>
                            <TableRow>
                                <TableCell>ID</TableCell>
                                <TableCell>Type Code</TableCell>
                                <TableCell>Expiration Name</TableCell>
                                <TableCell>Service</TableCell>
                                <TableCell>Validity Period</TableCell>
                                <TableCell>Reminder Before</TableCell>
                                <TableCell>Stop Payment</TableCell>
                                <TableCell>Active</TableCell>
                                <TableCell>Created At</TableCell>
                                <TableCell align="center">Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {expirationTypes.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={10} align="center">
                                        No expiration types found. Click "Add New" to create one.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                expirationTypes.map((type) => (
                                    <TableRow key={type.id} hover>
                                        <TableCell>{type.id}</TableCell>
                                        <TableCell>
                                            <Chip label={type.typeCode} size="small" />
                                        </TableCell>
                                        <TableCell>{type.expirationName}</TableCell>
                                        <TableCell>
                                            {type.serviceId
                                                ? services.find((s) => s.serviceId === type.serviceId)?.serviceName ||
                                                type.serviceId
                                                : "-"}
                                        </TableCell>
                                        <TableCell>{type.validityPeriod || "-"}</TableCell>
                                        <TableCell>{type.reminderBefore || "-"}</TableCell>
                                        <TableCell>
                                            {type.stopPaymentOnExpiry ? (
                                                <Chip label="Yes" color="error" size="small" />
                                            ) : (
                                                <Chip label="No" variant="outlined" size="small" />
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {type.isActive ? (
                                                <Chip label="Active" color="success" size="small" />
                                            ) : (
                                                <Chip label="Inactive" color="default" size="small" />
                                            )}
                                        </TableCell>
                                        <TableCell>{formatDate(type.createdAt)}</TableCell>
                                        <TableCell align="center">
                                            <Tooltip title="Edit">
                                                <IconButton onClick={() => handleOpenDialog(type)} color="primary">
                                                    <EditIcon />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="Delete">
                                                <IconButton onClick={() => handleDeleteClick(type)} color="error">
                                                    <DeleteIcon />
                                                </IconButton>
                                            </Tooltip>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth scroll="paper">
                <DialogTitle>{editingItem ? "Edit Expiration Type" : "Create New Expiration Type"}</DialogTitle>
                <form onSubmit={handleSubmit(onSubmit)}>
                    <DialogContent dividers>
                        <Grid container spacing={2}>
                            <Grid item xs={12} md={6}>
                                <Controller
                                    name="typeCode"
                                    control={control}
                                    rules={{ required: "Type Code is required", maxLength: 50 }}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            label="Type Code"
                                            fullWidth
                                            required
                                            error={!!errors.typeCode}
                                            helperText={errors.typeCode?.message}
                                        />
                                    )}
                                />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <Controller
                                    name="expirationName"
                                    control={control}
                                    rules={{ required: "Expiration Name is required" }}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            label="Expiration Name"
                                            fullWidth
                                            required
                                            error={!!errors.expirationName}
                                            helperText={errors.expirationName?.message}
                                        />
                                    )}
                                />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <Controller
                                    name="serviceId"
                                    control={control}
                                    render={({ field }) => (
                                        <FormControl fullWidth>
                                            <InputLabel>Service (Optional)</InputLabel>
                                            <Select
                                                {...field}
                                                value={field.value === null ? "" : field.value}
                                                onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                                                label="Service (Optional)"
                                            >
                                                <MenuItem value="">None</MenuItem>
                                                {services.map((service) => (
                                                    <MenuItem key={service.serviceId} value={service.serviceId}>
                                                        {service.serviceName}
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                    )}
                                />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <Controller
                                    name="validityPeriod"
                                    control={control}
                                    render={({ field }) => (
                                        <FormControl fullWidth>
                                            <InputLabel>Validity Period (Optional)</InputLabel>
                                            <Select
                                                {...field}
                                                value={field.value || ""}
                                                onChange={(e) => field.onChange(e.target.value || null)}
                                                label="Validity Period (Optional)"
                                            >
                                                <MenuItem value="">None</MenuItem>
                                                {periodOptions.map((opt) => (
                                                    <MenuItem key={opt} value={opt}>
                                                        {opt}
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                    )}
                                />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <Controller
                                    name="reminderBefore"
                                    control={control}
                                    render={({ field }) => (
                                        <FormControl fullWidth>
                                            <InputLabel>Reminder Before (Optional)</InputLabel>
                                            <Select
                                                {...field}
                                                value={field.value || ""}
                                                onChange={(e) => field.onChange(e.target.value || null)}
                                                label="Reminder Before (Optional)"
                                            >
                                                <MenuItem value="">None</MenuItem>
                                                {periodOptions.map((opt) => (
                                                    <MenuItem key={opt} value={opt}>
                                                        {opt}
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                    )}
                                />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <Controller
                                    name="stopPaymentGracePeriod"
                                    control={control}
                                    render={({ field }) => (
                                        <FormControl fullWidth>
                                            <InputLabel>Stop Payment Grace Period (Optional)</InputLabel>
                                            <Select
                                                {...field}
                                                value={field.value || ""}
                                                onChange={(e) => field.onChange(e.target.value || null)}
                                                label="Stop Payment Grace Period (Optional)"
                                            >
                                                <MenuItem value="">None</MenuItem>
                                                {periodOptions.map((opt) => (
                                                    <MenuItem key={opt} value={opt}>
                                                        {opt}
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                    )}
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <Controller
                                    name="description"
                                    control={control}
                                    render={({ field }) => (
                                        <TextField {...field} label="Description" fullWidth multiline rows={2} />
                                    )}
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <Typography variant="subtitle2" gutterBottom>
                                    Message Template (Supports HTML)
                                </Typography>
                                <Controller
                                    name="messageTemplate"
                                    control={control}
                                    render={({ field }) => (
                                        <ReactQuill
                                            theme="snow"
                                            value={field.value}
                                            onChange={field.onChange}
                                            placeholder="Dear {ApplicantName}, your {CertificateName} expires on {ExpiryDate}..."
                                            style={{ height: 200, marginBottom: 50 }}
                                        />
                                    )}
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <Controller
                                    name="basedOnField"
                                    control={control}
                                    render={({ field }) => (
                                        <FormControlLabel
                                            control={<Checkbox checked={field.value} onChange={field.onChange} />}
                                            label="Based on Field (Conditional expiration based on application data)"
                                        />
                                    )}
                                />
                            </Grid>
                            {basedOnField && (
                                <>
                                    <Grid item xs={12}>
                                        <Controller
                                            name="conditionField"
                                            control={control}
                                            rules={{
                                                validate: (value) => {
                                                    if (!value || value.trim() === "") return true;
                                                    try {
                                                        JSON.parse(value);
                                                        return true;
                                                    } catch {
                                                        return "Invalid JSON format";
                                                    }
                                                },
                                            }}
                                            render={({ field }) => (
                                                <TextField
                                                    {...field}
                                                    label="Condition Field (JSON)"
                                                    fullWidth
                                                    multiline
                                                    rows={4}
                                                    error={!!errors.conditionField}
                                                    helperText={errors.conditionField?.message || 'Example: {"PensionType": "WOMEN IN DISTRESS"}'}
                                                />
                                            )}
                                        />
                                    </Grid>
                                    <Grid item xs={12}>
                                        <Controller
                                            name="valueField"
                                            control={control}
                                            render={({ field }) => (
                                                <TextField
                                                    {...field}
                                                    label="Value Field"
                                                    fullWidth
                                                    helperText="Field name that contains the expiration value"
                                                />
                                            )}
                                        />
                                    </Grid>
                                </>
                            )}
                            <Grid item xs={12} md={6}>
                                <Controller
                                    name="stopPaymentOnExpiry"
                                    control={control}
                                    render={({ field }) => (
                                        <FormControlLabel
                                            control={<Checkbox checked={field.value} onChange={field.onChange} />}
                                            label="Stop Payment on Expiry"
                                        />
                                    )}
                                />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <Controller
                                    name="isActive"
                                    control={control}
                                    render={({ field }) => (
                                        <FormControlLabel
                                            control={<Switch checked={field.value} onChange={field.onChange} />}
                                            label="Active"
                                        />
                                    )}
                                />
                            </Grid>
                        </Grid>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={handleCloseDialog}>Cancel</Button>
                        <Button type="submit" variant="contained" disabled={submitting}>
                            {submitting ? <CircularProgress size={24} /> : editingItem ? "Update" : "Create"}
                        </Button>
                    </DialogActions>
                </form>
            </Dialog>

            <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
                <DialogTitle>Confirm Delete</DialogTitle>
                <DialogContent>
                    <Typography>
                        Are you sure you want to delete "{itemToDelete?.expirationName}" (Code: {itemToDelete?.typeCode})?
                        This action cannot be undone.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
                    <Button onClick={handleConfirmDelete} color="error" variant="contained">
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default CreateExpirations;