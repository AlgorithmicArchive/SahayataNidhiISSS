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
  Modal,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import { useForm, Controller, useWatch } from "react-hook-form";
import axiosInstance from "../../axiosConfig";
import MessageModal from "../../components/MessageModal";
import ServerSideTable from "../../components/ServerSideTable";
import { UserContext } from "../../UserContext";

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

  // Determine if current office type is a child (needs parent)
  const needsParent = useMemo(() => {
    const office = offices.find((o) => o.officeid === officeTypeId);
    return office && office.accesslevel !== "District"; // District is top-level
  }, [officeTypeId, offices]);

  // Fetch offices and divisions
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
          }))
        );
      } catch (e) {
        setErrorMsg("Failed to load data.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Set access level when office type changes
  useEffect(() => {
    const office = offices.find((o) => o.officeid === officeTypeId);
    setAccessLevel(office?.accesslevel || "");
    setValue("districtCode", 0);
    setValue("areaNames", "");
    setValue("parentOfficeDetailId", "");
    setParentCandidates([]);
  }, [officeTypeId, offices, setValue]);

  // Fetch districts when division changes (for non-district levels)
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

  // Fetch parent office details when office type, division, district change
  useEffect(() => {
    if (!needsParent || !officeTypeId || !divisionCode) {
      setParentCandidates([]);
      return;
    }

    // For child offices, we need to find parent offices of the immediate higher level.
    // Parent type depends on current office type (e.g., for Tehsil, parent is District office).
    // We'll call an API that returns office details of the appropriate parent type.
    const fetchParents = async () => {
      setLoadingParents(true);
      try {
        // Determine parent office type id – this mapping should be defined in backend or config.
        // Example: Tehsil -> District, Block -> District, Ward -> Municipality, etc.
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
        const res = await axiosInstance.get("/Admin/GetParentOfficeDetails", { params });
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

  // Helper to get parent office type id – you can store this in a config table
  const getParentOfficeTypeId = async (childOfficeTypeId) => {
    // For demonstration, assume a simple mapping:
    // You should replace with a backend call to get the hierarchical parent.
    const office = offices.find(o => o.officeid === childOfficeTypeId);
    if (!office) return null;
    switch (office.officenameshort) {
      case "Tehsil": return offices.find(o => o.officenameshort === "District")?.officeid;
      case "Block": return offices.find(o => o.officenameshort === "District")?.officeid;
      case "Ward": return offices.find(o => o.officenameshort === "Municipality")?.officeid;
      case "CDPO": return offices.find(o => o.officenameshort === "DPO")?.officeid;
      default: return null;
    }
  };

  // Submit add
  const onSubmit = async (data) => {
    if (!data.areaNames.trim()) {
      setErrorMsg("Area name(s) required.");
      return;
    }
    try {
      const fd = new FormData();
      fd.append("OfficeTypeId", data.officeTypeId);
      fd.append("DivisionCode", data.divisionCode);
      if (accessLevel !== "District") {
        fd.append("DistrictCode", data.districtCode);
      } else {
        fd.append("DistrictCode", 0);
      }
      fd.append("AreaNames", data.areaNames);
      if (data.parentOfficeDetailId) {
        fd.append("ParentOfficeDetailId", data.parentOfficeDetailId);
      }

      const res = await axiosInstance.post("/Admin/AddOfficeDetail", fd);
      if (res.data.status) {
        setMsg({ title: "Success", message: res.data.message, type: "success" });
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

  // Submit update (similar changes needed)
  const handleUpdate = async (data) => {
    if (!editing) return;
    try {
      const fd = new FormData();
      fd.append("OfficeDetailId", editing.officeDetailId);
      fd.append("AreaName", data.areaNames);
      fd.append("DivisionCode", data.divisionCode);
      if (accessLevel !== "District") {
        fd.append("DistrictCode", data.districtCode);
      } else {
        fd.append("DistrictCode", 0);
      }
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

  // Delete (unchanged)
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

  // Columns & actionFns (same as before)
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
    []
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
    [canModify, setValue]
  );

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" mt={10}>
        <CircularProgress />
      </Box>
    );
  }

  const shouldShowDivision = true;
  const shouldShowDistrict = accessLevel !== "District" && officeTypeId;
  const shouldShowParent = needsParent && officeTypeId && divisionCode;

  return (
    <Container maxWidth="lg" sx={{ py: 8 }}>
      <Typography variant="h4" align="center" gutterBottom>
        Add / Edit Office Details
      </Typography>
      {errorMsg && (
        <Alert severity="error" sx={{ mb: 4 }}>
          {errorMsg}
        </Alert>
      )}

      {/* ADD FORM */}
      <Box sx={{ bgcolor: "white", p: 4, borderRadius: 2, boxShadow: 3, mb: 6 }}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <Grid container spacing={3}>
            {/* Office Type */}
            <Grid item xs={12} sm={4}>
              <Controller
                name="officeTypeId"
                control={control}
                rules={{ required: "Required" }}
                render={({ field }) => (
                  <FormControl fullWidth error={!!errors.officeTypeId}>
                    <InputLabel shrink>Office Type</InputLabel>
                    <Select {...field} label="Office Type">
                      <MenuItem value="">Select</MenuItem>
                      {offices.map((o) => (
                        <MenuItem key={o.officeid} value={o.officeid}>
                          {o.officename}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              />
            </Grid>

            {/* Division */}
            {shouldShowDivision && (
              <Grid item xs={12} sm={4}>
                <Controller
                  name="divisionCode"
                  control={control}
                  rules={{ required: "Division required" }}
                  render={({ field }) => (
                    <FormControl fullWidth error={!!errors.divisionCode}>
                      <InputLabel shrink>Division</InputLabel>
                      <Select
                        {...field}
                        label="Division"
                        onChange={(e) => field.onChange(Number(e.target.value))}
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
            )}

            {/* District (for non-District levels) */}
            {shouldShowDistrict && (
              <Grid item xs={12} sm={4}>
                <Controller
                  name="districtCode"
                  control={control}
                  rules={{ required: "District required" }}
                  render={({ field }) => (
                    <FormControl fullWidth error={!!errors.districtCode} disabled={loadingDistricts}>
                      <InputLabel shrink>District</InputLabel>
                      <Select
                        {...field}
                        value={field.value || 0}
                        onChange={(e) => field.onChange(Number(e.target.value))}
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

            {/* Parent Office Detail (for child offices) */}
            {shouldShowParent && (
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth disabled={loadingParents}>
                  <InputLabel shrink>Parent Office Detail</InputLabel>
                  <Select
                    value={control._formValues.parentOfficeDetailId || ""}
                    onChange={(e) => setValue("parentOfficeDetailId", e.target.value)}
                  >
                    <MenuItem value="">None (Root)</MenuItem>
                    {parentCandidates.map((p) => (
                      <MenuItem key={p.officeDetailId} value={p.officeDetailId}>
                        {p.officeName} ({p.areaName})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            )}

            {/* Area Names */}
            <Grid item xs={12} sm={4}>
              <Controller
                name="areaNames"
                control={control}
                rules={{ required: "Required" }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    label={
                      accessLevel === "District"
                        ? "District Names (comma separated)"
                        : "Area Names (comma separated)"
                    }
                    variant="outlined"
                    placeholder={
                      accessLevel === "District"
                        ? "e.g. Delhi, Mumbai"
                        : "e.g. Tehsil A, Block B"
                    }
                    error={!!errors.areaNames}
                    helperText={errors.areaNames?.message}
                    InputLabelProps={{ shrink: true }}
                  />
                )}
              />
            </Grid>

            <Grid item xs={12}>
              <Button type="submit" variant="contained" fullWidth disabled={!canModify}>
                Add Office Details
              </Button>
            </Grid>
          </Grid>
        </form>
      </Box>

      {/* TABLE */}
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
      />

      <MessageModal
        open={showMsg}
        onClose={() => setShowMsg(false)}
        title={msg.title}
        message={msg.message}
        type={msg.type}
      />

      {/* Delete Confirm */}
      <Dialog open={delOpen} onClose={() => setDelOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>Delete this office detail?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDelOpen(false)}>Cancel</Button>
          <Button
            onClick={async () => {
              setDelOpen(false);
              await handleDelete(delId);
            }}
            color="error"
            variant="contained"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* EDIT MODAL */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)}>
        <Box
          sx={{
            bgcolor: "white",
            p: 4,
            borderRadius: 2,
            maxWidth: 600,
            mx: "auto",
            mt: "5%",
            boxShadow: 24,
          }}
        >
          <Typography variant="h5" gutterBottom>
            Edit Office Detail
          </Typography>
          <form onSubmit={handleSubmit(handleUpdate)}>
            <Grid container spacing={3}>
              {/* Division */}
              <Grid item xs={12}>
                <Controller
                  name="divisionCode"
                  control={control}
                  rules={{ required: "Division required" }}
                  render={({ field }) => (
                    <FormControl fullWidth>
                      <InputLabel shrink>Division</InputLabel>
                      <Select
                        {...field}
                        label="Division"
                        onChange={(e) => field.onChange(Number(e.target.value))}
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

              {/* District (if editable) */}
              {accessLevel !== "District" && officeTypeId && (
                <Grid item xs={12}>
                  <Controller
                    name="districtCode"
                    control={control}
                    rules={{ required: "District required" }}
                    render={({ field }) => (
                      <FormControl fullWidth>
                        <InputLabel shrink>District</InputLabel>
                        <Select
                          {...field}
                          value={field.value || 0}
                          onChange={(e) => field.onChange(Number(e.target.value))}
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

              {/* Parent (if child) */}
              {needsParent && (
                <Grid item xs={12}>
                  <FormControl fullWidth disabled={loadingParents}>
                    <InputLabel shrink>Parent Office Detail</InputLabel>
                    <Select
                      value={control._formValues.parentOfficeDetailId || ""}
                      onChange={(e) => setValue("parentOfficeDetailId", e.target.value)}
                    >
                      <MenuItem value="">None</MenuItem>
                      {parentCandidates.map((p) => (
                        <MenuItem key={p.officeDetailId} value={p.officeDetailId}>
                          {p.officeName} ({p.areaName})
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              )}

              {/* Area Name */}
              <Grid item xs={12}>
                <Controller
                  name="areaNames"
                  control={control}
                  rules={{ required: "Required" }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Area Name"
                      variant="outlined"
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12}>
                <Box display="flex" justifyContent="flex-end" gap={2}>
                  <Button onClick={() => setEditOpen(false)}>Cancel</Button>
                  <Button type="submit" variant="contained">
                    Update
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </form>
        </Box>
      </Modal>
    </Container>
  );
}