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
import { useForm, Controller, useWatch } from "react-hook-form";
import axiosInstance from "../../axiosConfig";
import MessageModal from "../../components/MessageModal";
import ServerSideTable from "../../components/ServerSideTable";
import { UserContext } from "../../UserContext";
import { Add, Edit, ListAlt, LocationCity } from "@mui/icons-material";
import GovPageHeader from "../../components/gov/GovPageHeader";

const extractArray = (data) => {
  if (Array.isArray(data)) return data;
  if (data?.data) return extractArray(data.data);
  if (data?.$values) return data.$values;
  return [];
};

export default function AddOfficeDetails() {
  const { userType, officerAuthorities } = useContext(UserContext);
  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm({
    defaultValues: {
      officeTypeId: "",
      divisionCode: 0,
      districtCode: 0,
      areaNames: "",
      parentOfficeDetailId: "",
    },
  });

  const officeTypeId = useWatch({ control, name: "officeTypeId" });
  const divisionCode = useWatch({ control, name: "divisionCode" });
  const districtCode = useWatch({ control, name: "districtCode" });
  const parentOfficeDetailId = useWatch({
    control,
    name: "parentOfficeDetailId",
  });

  const [offices, setOffices] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [parentCandidates, setParentCandidates] = useState([]);
  const [accessLevel, setAccessLevel] = useState("");

  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingParents, setLoadingParents] = useState(false);
  const [showMsg, setShowMsg] = useState(false);
  const [msg, setMsg] = useState({ title: "", message: "", type: "success" });
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [refresh, setRefresh] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [delId, setDelId] = useState(null);

  const canModify = useMemo(() => {
    return (
      officerAuthorities?.canDirectWithhold ||
      userType === "SeniorOfficer" ||
      userType === "Admin"
    );
  }, [userType, officerAuthorities]);

  const needsParent = useMemo(() => {
    const office = offices.find((o) => o.officeid === officeTypeId);
    return office && office.accesslevel !== "District";
  }, [officeTypeId, offices]);

  useEffect(() => {
    (async () => {
      try {
        const [offRes, divRes] = await Promise.all([
          axiosInstance.get("/Admin/GetOfficesType"),
          axiosInstance.get("/Admin/GetDivisions"),
        ]);
        setOffices(extractArray(offRes.data.officesType));
        const divs = extractArray(divRes.data.divisions);
        setDivisions(
          divs.map((d) => ({
            divisionId: Number(d.value),
            divisionName: d.label,
          })),
        );
      } catch (e) {
        setErrorMsg("Failed to load data.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    const office = offices.find((o) => o.officeid === officeTypeId);
    setAccessLevel(office?.accesslevel || "");
    setValue("districtCode", 0);
    setValue("areaNames", "");
    setValue("parentOfficeDetailId", "");
    setParentCandidates([]);
  }, [officeTypeId, offices, setValue]);

  useEffect(() => {
    if (!divisionCode || divisionCode === 0 || accessLevel === "District") {
      setDistricts([]);
      return;
    }
    setLoadingDistricts(true);
    axiosInstance
      .get(`/Admin/GetDistricts`, {
        params: { divisionId: divisionCode, officeType: officeTypeId },
      })
      .then((res) => setDistricts(extractArray(res.data)))
      .catch(() => setErrorMsg("Failed to load districts."))
      .finally(() => setLoadingDistricts(false));
  }, [divisionCode, officeTypeId, accessLevel]);

  useEffect(() => {
    if (!needsParent || !officeTypeId || !divisionCode) {
      setParentCandidates([]);
      return;
    }

    const fetchParents = async () => {
      setLoadingParents(true);
      try {
        const parentOfficeTypeId = await getParentOfficeTypeId(officeTypeId);
        if (!parentOfficeTypeId) {
          setParentCandidates([]);
          return;
        }
        const params = {
          officeTypeId: parentOfficeTypeId,
          divisionCode: divisionCode,
          districtCode: districtCode || 0,
        };
        const res = await axiosInstance.get("/Admin/GetParentOfficeDetails", {
          params,
        });
        setParentCandidates(extractArray(res.data));
      } catch (err) {
        console.error("Failed to load parent candidates", err);
        setParentCandidates([]);
      } finally {
        setLoadingParents(false);
      }
    };
    fetchParents();
  }, [needsParent, officeTypeId, divisionCode, districtCode]);

  const getParentOfficeTypeId = async (childOfficeTypeId) => {
    const office = offices.find((o) => o.officeid === childOfficeTypeId);
    if (!office) return null;
    switch (office.officenameshort) {
      case "Tehsil":
        return offices.find((o) => o.officenameshort === "District")?.officeid;
      case "Block":
        return offices.find((o) => o.officenameshort === "District")?.officeid;
      case "Ward":
        return offices.find((o) => o.officenameshort === "Municipality")
          ?.officeid;
      case "CDPO":
        return offices.find((o) => o.officenameshort === "DPO")?.officeid;
      default:
        return null;
    }
  };

  const onSubmit = async (data) => {
    if (!data.areaNames.trim()) {
      setErrorMsg("Area name(s) required.");
      return;
    }
    try {
      const fd = new FormData();
      fd.append("OfficeTypeId", data.officeTypeId);
      fd.append("DivisionCode", data.divisionCode);
      fd.append(
        "DistrictCode",
        accessLevel !== "District" ? data.districtCode : 0,
      );
      fd.append("AreaNames", data.areaNames);
      if (data.parentOfficeDetailId) {
        fd.append("ParentOfficeDetailId", data.parentOfficeDetailId);
      }

      const res = await axiosInstance.post("/Admin/AddOfficeDetail", fd);
      if (res.data.status) {
        setMsg({
          title: "Success",
          message: res.data.message,
          type: "success",
        });
        setShowMsg(true);
        setValue("areaNames", "");
        setRefresh((p) => !p);
      } else {
        setErrorMsg(res.data.message);
      }
    } catch (e) {
      setErrorMsg(e.message);
    }
  };

  const handleUpdate = async (data) => {
    if (!editing) return;
    try {
      const fd = new FormData();
      fd.append("OfficeDetailId", editing.officeDetailId);
      fd.append("AreaName", data.areaNames);
      fd.append("DivisionCode", data.divisionCode);
      fd.append(
        "DistrictCode",
        accessLevel !== "District" ? data.districtCode : 0,
      );
      if (data.parentOfficeDetailId) {
        fd.append("ParentOfficeDetailId", data.parentOfficeDetailId);
      }

      const res = await axiosInstance.post("/Admin/UpdateOfficeDetail", fd);
      if (res.data.status) {
        setMsg({ title: "Updated", message: "Saved.", type: "success" });
        setShowMsg(true);
        setEditOpen(false);
        setRefresh((p) => !p);
      } else {
        setErrorMsg(res.data.message);
      }
    } catch (e) {
      setErrorMsg(e.message);
    }
  };

  const handleDelete = async (id) => {
    try {
      const fd = new FormData();
      fd.append("OfficeDetailId", id);
      const res = await axiosInstance.post("/Admin/DeleteOfficeDetail", fd);
      if (res.data.status) {
        setMsg({ title: "Deleted", message: "Done.", type: "success" });
        setShowMsg(true);
        setRefresh((p) => !p);
      } else {
        setErrorMsg(res.data.message);
      }
    } catch (e) {
      setErrorMsg(e.message);
    }
  };

  const columns = useMemo(
    () => [
      { field: "officeDetailId", headerName: "ID", flex: 1 },
      { field: "officeName", headerName: "Office Name", flex: 1 },
      { field: "officeTypeName", headerName: "Office Type", flex: 1 },
      { field: "divisionCode", headerName: "Division Code", flex: 0.5 },
      { field: "districtCode", headerName: "District Code", flex: 0.5 },
      { field: "areacode", headerName: "Area Code", flex: 0.5 },
      { field: "areaName", headerName: "Area Name", flex: 1 },
    ],
    [],
  );

  const actionFns = useMemo(
    () => ({
      UpdateOfficeDetail: (row) => {
        if (!canModify) {
          setErrorMsg("No permission.");
          return;
        }
        const rec = row.original;
        setEditing(rec);
        setValue("officeTypeId", rec.officeTypeId);
        setValue("divisionCode", rec.divisionCode);
        setValue("districtCode", rec.districtCode);
        setValue("areaNames", rec.areaName);
        setValue("parentOfficeDetailId", rec.parentOfficeDetailId || "");
        setEditOpen(true);
      },
      DeleteOfficeDetail: (row) => {
        if (!canModify) {
          setErrorMsg("No permission.");
          return;
        }
        setDelId(row.original.officeDetailId);
        setDelOpen(true);
      },
    }),
    [canModify, setValue],
  );

  if (loading) {
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

  const shouldShowDistrict = accessLevel !== "District" && officeTypeId;
  const shouldShowParent = needsParent && officeTypeId && divisionCode;

  return (
    <Box sx={{ bgcolor: "#F8FAFC", minHeight: "100vh", py: 4 }}>
      <Container maxWidth="lg">
        {/* Page Header - GIGW standard */}
        <GovPageHeader
          title="Office Details Management"
          hindiTitle="कार्यालय विवरण प्रबंधन"
          subtitle="Map hierarchical office areas, divisions, and districts"
          icon={<LocationCity sx={{ fontSize: 32, color: "primary.main" }} />}
        />

        {/* Permission Warning */}
        {!canModify && (
          <Alert
            severity="info"
            sx={{ mb: 3, borderRadius: 2, border: "1px solid #BFDBFE" }}
          >
            <Typography fontWeight={600}>View Only Access</Typography>
            <Typography variant="body2">
              You do not have permission to add, edit, or delete office details.
            </Typography>
          </Alert>
        )}

        {/* Global Inline Errors */}
        {errorMsg && !editOpen && (
          <Alert
            severity="error"
            sx={{ mb: 3, borderRadius: 2, border: "1px solid #FECACA" }}
            onClose={() => setErrorMsg("")}
          >
            {errorMsg}
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
              Add New Office Detail
            </Typography>
          </Box>

          <Box component="form" onSubmit={handleSubmit(onSubmit)}>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6} md={4}>
                <Controller
                  name="officeTypeId"
                  control={control}
                  rules={{ required: "Office Type is required" }}
                  render={({ field }) => (
                    <FormControl fullWidth error={!!errors.officeTypeId}>
                      <InputLabel>Office Type</InputLabel>
                      <Select
                        {...field}
                        label="Office Type"
                        disabled={!canModify}
                      >
                        <MenuItem value="">Select Office Type</MenuItem>
                        {offices.map((o) => (
                          <MenuItem key={o.officeid} value={o.officeid}>
                            {o.officename}
                          </MenuItem>
                        ))}
                      </Select>
                      {errors.officeTypeId && (
                        <Typography
                          color="error"
                          variant="caption"
                          sx={{ mt: 0.5, ml: 1.5 }}
                        >
                          {errors.officeTypeId.message}
                        </Typography>
                      )}
                    </FormControl>
                  )}
                />
              </Grid>

              <Grid item xs={12} sm={6} md={4}>
                <Controller
                  name="divisionCode"
                  control={control}
                  rules={{ required: "Division is required" }}
                  render={({ field }) => (
                    <FormControl fullWidth error={!!errors.divisionCode}>
                      <InputLabel>Division</InputLabel>
                      <Select
                        {...field}
                        label="Division"
                        disabled={!canModify}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      >
                        <MenuItem value={0}>Select Division</MenuItem>
                        {divisions.map((d) => (
                          <MenuItem key={d.divisionId} value={d.divisionId}>
                            {d.divisionName}
                          </MenuItem>
                        ))}
                      </Select>
                      {errors.divisionCode && (
                        <Typography
                          color="error"
                          variant="caption"
                          sx={{ mt: 0.5, ml: 1.5 }}
                        >
                          {errors.divisionCode.message}
                        </Typography>
                      )}
                    </FormControl>
                  )}
                />
              </Grid>

              {shouldShowDistrict && (
                <Grid item xs={12} sm={6} md={4}>
                  <Controller
                    name="districtCode"
                    control={control}
                    rules={{ required: "District is required" }}
                    render={({ field }) => (
                      <FormControl
                        fullWidth
                        error={!!errors.districtCode}
                        disabled={loadingDistricts || !canModify}
                      >
                        <InputLabel>District</InputLabel>
                        <Select
                          {...field}
                          label="District"
                          value={field.value || 0}
                          onChange={(e) =>
                            field.onChange(Number(e.target.value))
                          }
                        >
                          <MenuItem value={0}>Select District</MenuItem>
                          {districts.map((d) => (
                            <MenuItem key={d.districtId} value={d.districtId}>
                              {d.districtName}
                            </MenuItem>
                          ))}
                        </Select>
                        {errors.districtCode && (
                          <Typography
                            color="error"
                            variant="caption"
                            sx={{ mt: 0.5, ml: 1.5 }}
                          >
                            {errors.districtCode.message}
                          </Typography>
                        )}
                      </FormControl>
                    )}
                  />
                </Grid>
              )}

              {shouldShowParent && (
                <Grid item xs={12} sm={6} md={4}>
                  <FormControl
                    fullWidth
                    disabled={loadingParents || !canModify}
                  >
                    <InputLabel>Parent Office Detail</InputLabel>
                    <Select
                      value={parentOfficeDetailId || ""}
                      label="Parent Office Detail"
                      onChange={(e) =>
                        setValue("parentOfficeDetailId", e.target.value)
                      }
                    >
                      <MenuItem value="">None (Root)</MenuItem>
                      {parentCandidates.map((p) => (
                        <MenuItem
                          key={p.officeDetailId}
                          value={p.officeDetailId}
                        >
                          {p.officeName} ({p.areaName})
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              )}

              <Grid
                item
                xs={12}
                sm={shouldShowParent || shouldShowDistrict ? 12 : 6}
                md={shouldShowParent || shouldShowDistrict ? 4 : 4}
              >
                <Controller
                  name="areaNames"
                  control={control}
                  rules={{ required: "Area names are required" }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label={
                        accessLevel === "District"
                          ? "District Names (comma separated)"
                          : "Area Names (comma separated)"
                      }
                      placeholder={
                        accessLevel === "District"
                          ? "e.g. Srinagar, Jammu"
                          : "e.g. Tehsil A, Block B"
                      }
                      error={!!errors.areaNames}
                      helperText={errors.areaNames?.message}
                      disabled={!canModify}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12}>
                <Button
                  type="submit"
                  variant="contained"
                  fullWidth
                  disabled={!canModify}
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
                  Add Office Details
                </Button>
              </Grid>
            </Grid>
          </Box>
        </Paper>

        {/* Existing Details Table */}
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 3 }}>
            <ListAlt sx={{ color: "#2562E9" }} />
            <Typography variant="h6" sx={{ fontWeight: 700, color: "#0F172A" }}>
              Existing Office Details
            </Typography>
          </Box>

          <ServerSideTable
            url="/Admin/GetOfficeDetails"
            Title="Existing Office Details"
            extraParams={{}}
            canSanction={false}
            canHavePool={false}
            pendingApplications={false}
            actionFunctions={actionFns}
            columns={columns}
            refresh={refresh}
            onAction={(fn, row) => actionFns[fn](row)}
            showDownloadButtons={true}
          />
        </Box>

        <MessageModal
          open={showMsg}
          onClose={() => setShowMsg(false)}
          title={msg.title}
          message={msg.message}
          type={msg.type}
        />

        {/* Delete Confirm Dialog */}
        <Dialog
          open={delOpen}
          onClose={() => setDelOpen(false)}
          maxWidth="xs"
          fullWidth
          PaperProps={{ sx: { borderRadius: 3 } }}
        >
          <DialogTitle sx={{ fontWeight: 700, color: "#0F172A" }}>
            Confirm Deletion
          </DialogTitle>
          <DialogContent sx={{ pb: 2 }}>
            <Typography sx={{ color: "#475569" }}>
              Are you sure you want to delete this office detail? This action
              cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3, pt: 0 }}>
            <Button
              onClick={() => setDelOpen(false)}
              sx={{ textTransform: "none", color: "#64748B" }}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                setDelOpen(false);
                await handleDelete(delId);
              }}
              variant="contained"
              sx={{
                textTransform: "none",
                fontWeight: 600,
                bgcolor: "#DC2626",
                "&:hover": { bgcolor: "#B91C1C" },
              }}
            >
              Delete
            </Button>
          </DialogActions>
        </Dialog>

        {/* Edit Office Detail Dialog */}
        <Dialog
          open={editOpen}
          onClose={() => setEditOpen(false)}
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
            <Edit sx={{ color: "#2562E9" }} /> Edit Office Detail
          </DialogTitle>
          <DialogContent sx={{ px: 3, pb: 2, pt: 2 }}>
            {errorMsg && editOpen && (
              <Alert
                severity="error"
                sx={{ mb: 3, borderRadius: 2 }}
                onClose={() => setErrorMsg("")}
              >
                {errorMsg}
              </Alert>
            )}
            <Box
              component="form"
              id="edit-office-detail-form"
              onSubmit={handleSubmit(handleUpdate)}
            >
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <Controller
                    name="divisionCode"
                    control={control}
                    rules={{ required: "Division is required" }}
                    render={({ field }) => (
                      <FormControl fullWidth>
                        <InputLabel>Division</InputLabel>
                        <Select
                          {...field}
                          label="Division"
                          onChange={(e) =>
                            field.onChange(Number(e.target.value))
                          }
                        >
                          <MenuItem value={0}>Select Division</MenuItem>
                          {divisions.map((d) => (
                            <MenuItem key={d.divisionId} value={d.divisionId}>
                              {d.divisionName}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    )}
                  />
                </Grid>

                {accessLevel !== "District" && officeTypeId && (
                  <Grid item xs={12}>
                    <Controller
                      name="districtCode"
                      control={control}
                      rules={{ required: "District is required" }}
                      render={({ field }) => (
                        <FormControl fullWidth>
                          <InputLabel>District</InputLabel>
                          <Select
                            {...field}
                            label="District"
                            value={field.value || 0}
                            onChange={(e) =>
                              field.onChange(Number(e.target.value))
                            }
                          >
                            <MenuItem value={0}>Select District</MenuItem>
                            {districts.map((d) => (
                              <MenuItem key={d.districtId} value={d.districtId}>
                                {d.districtName}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      )}
                    />
                  </Grid>
                )}

                {needsParent && (
                  <Grid item xs={12}>
                    <FormControl fullWidth disabled={loadingParents}>
                      <InputLabel>Parent Office Detail</InputLabel>
                      <Select
                        value={parentOfficeDetailId || ""}
                        label="Parent Office Detail"
                        onChange={(e) =>
                          setValue("parentOfficeDetailId", e.target.value)
                        }
                      >
                        <MenuItem value="">None</MenuItem>
                        {parentCandidates.map((p) => (
                          <MenuItem
                            key={p.officeDetailId}
                            value={p.officeDetailId}
                          >
                            {p.officeName} ({p.areaName})
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                )}

                <Grid item xs={12}>
                  <Controller
                    name="areaNames"
                    control={control}
                    rules={{ required: "Area Name is required" }}
                    render={({ field }) => (
                      <TextField {...field} fullWidth label="Area Name" />
                    )}
                  />
                </Grid>
              </Grid>
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3, pt: 0 }}>
            <Button
              onClick={() => setEditOpen(false)}
              sx={{ textTransform: "none", color: "#64748B" }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="edit-office-detail-form"
              variant="contained"
              sx={{
                textTransform: "none",
                fontWeight: 600,
                bgcolor: "#2562E9",
                "&:hover": { bgcolor: "#1D4ED8" },
              }}
            >
              Update Detail
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Box>
  );
}
