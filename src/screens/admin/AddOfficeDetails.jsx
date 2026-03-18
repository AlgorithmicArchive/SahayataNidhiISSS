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
  Checkbox,
  ListItemText,
} from "@mui/material";
import { useForm, Controller, useWatch } from "react-hook-form";
import axiosInstance from "../../axiosConfig";
import MessageModal from "../../components/MessageModal";
import ServerSideTable from "../../components/ServerSideTable";
import { UserContext } from "../../UserContext";

export default function AddOfficeDetails() {
  const { userType, officerAuthorities } = useContext(UserContext);
  const {
    control,
    handleSubmit,
    reset,
    setValue,
    getValues,
    formState: { errors },
  } = useForm({
    defaultValues: {
      officeName: "",
      officeType: "",
      divisionCode: 0,
      districtCode: 0,
      areaCode: [], // always an array (for multi-select consistency)
      areaName: "",
    },
  });

  const divisionCode = useWatch({ control, name: "divisionCode" });
  const districtCode = useWatch({ control, name: "districtCode" });
  const areaCode = useWatch({ control, name: "areaCode" });
  const officeType = useWatch({ control, name: "officeType" });

  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [modalMessage, setModalMessage] = useState({
    title: "",
    message: "",
    type: "success",
  });
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingOfficeDetail, setEditingOfficeDetail] = useState(null);
  const [refreshTable, setRefreshTable] = useState(false);
  const [accessLevel, setAccessLevel] = useState("");
  const [selectedOffice, setSelectedOffice] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  // Fetched data
  const [offices, setOffices] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [tehsils, setTehsils] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [existingOfficeDetails, setExistingOfficeDetails] = useState([]); // for duplicate prevention

  // Loading states for dynamic fetches
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingTehsils, setLoadingTehsils] = useState(false);
  const [loadingBlocks, setLoadingBlocks] = useState(false);

  // Set of used combinations (officeType + areaCode) to hide duplicates
  const [usedCombinations, setUsedCombinations] = useState(new Set());

  // Permission check
  const canModifyOfficeDetails = useMemo(() => {
    return (
      officerAuthorities?.canDirectWithhold ||
      userType === "SeniorOfficer" ||
      userType === "Admin"
    );
  }, [userType, officerAuthorities]);

  // Fetch offices, divisions, and existing office details on mount
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [officesRes, divisionsRes, existingRes] = await Promise.all([
          axiosInstance.get("/Admin/GetOfficesType"),
          axiosInstance.get("/Admin/GetDivisions"),
          axiosInstance.get("/Admin/GetOfficeDetails"),
        ]);

        setOffices(officesRes.data.officesType || []);

        const divs = divisionsRes.data.divisions || [];
        setDivisions(
          divs.map((d) => ({
            divisionId: Number(d.value),
            divisionName: d.label,
          }))
        );

        setExistingOfficeDetails(existingRes.data.data || []);
      } catch (error) {
        setErrorMessage(`Error loading data: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Update used combinations whenever existing details or officeType change
  useEffect(() => {
    if (!officeType) {
      setUsedCombinations(new Set());
      return;
    }
    const keys = new Set(
      existingOfficeDetails
        .filter(d => d.officeType === officeType)
        .map(d => `${d.officeType}_${d.areaCode}`)
    );
    setUsedCombinations(keys);
  }, [existingOfficeDetails, officeType]);

  // Fetch districts when division changes
  useEffect(() => {
    const fetchDistricts = async () => {
      if (!divisionCode || divisionCode === 0) {
        setDistricts([]);
        return;
      }
      setLoadingDistricts(true);
      try {
        const response = await axiosInstance.get(
          `/Admin/GetDistricts`, {
          params: {
            divisionId: divisionCode,
            officeType: officeType || null // Pass the selected office type
          }
        }
        );
        setDistricts(response.data || []);
      } catch (error) {
        setErrorMessage(`Error loading districts: ${error.message}`);
      } finally {
        setLoadingDistricts(false);
      }
    };

    fetchDistricts();
  }, [divisionCode, officeType]); // Add officeType as dependency

  // Fetch tehsils when district changes (if access level is Tehsil)
  useEffect(() => {
    const fetchTehsils = async () => {
      if (!districtCode || districtCode === 0 || accessLevel !== "Tehsil") {
        setTehsils([]);
        return;
      }
      setLoadingTehsils(true);
      try {
        const response = await axiosInstance.get(
          `/Admin/GetTehsils?districtId=${districtCode}`
        );
        setTehsils(response.data || []);
      } catch (error) {
        setErrorMessage(`Error loading tehsils: ${error.message}`);
      } finally {
        setLoadingTehsils(false);
      }
    };

    fetchTehsils();
  }, [districtCode, accessLevel]);

  // Fetch blocks when district changes (if access level is Block)
  useEffect(() => {
    const fetchBlocks = async () => {
      if (!districtCode || districtCode === 0 || accessLevel !== "Block") {
        setBlocks([]);
        return;
      }
      setLoadingBlocks(true);
      try {
        const response = await axiosInstance.get(
          `/Admin/GetBlocks?districtId=${districtCode}`
        );
        setBlocks(response.data || []);
      } catch (error) {
        setErrorMessage(`Error loading blocks: ${error.message}`);
      } finally {
        setLoadingBlocks(false);
      }
    };

    fetchBlocks();
  }, [districtCode, accessLevel]);

  // When office type changes (new entry) – set access level and reset locations
  useEffect(() => {
    if (officeType && !editingOfficeDetail) {
      const office = offices.find((o) => o.officeid === officeType);
      if (office) {
        setSelectedOffice(office);
        setAccessLevel(office.accesslevel);
        resetLocationsBasedOnAccessLevel(office.accesslevel);
      }
    }
  }, [officeType, editingOfficeDetail, offices]);

  // Reset location fields based on access level
  const resetLocationsBasedOnAccessLevel = (level) => {
    setValue("divisionCode", 0);
    setValue("districtCode", 0);
    setValue("areaCode", []);
    setValue("areaName", "");
    setValue("officeName", "");
  };

  // Cascading resets
  useEffect(() => {
    if (divisionCode && divisionCode !== 0) {
      setValue("districtCode", 0);
      setValue("areaCode", []);
      setValue("areaName", "");
      setValue("officeName", "");
    }
  }, [divisionCode, setValue]);

  useEffect(() => {
    if (districtCode && districtCode !== 0) {
      setValue("areaCode", []);
      setValue("areaName", "");
      setValue("officeName", "");
    }
  }, [districtCode, setValue]);

  // Reset form when edit modal closes
  useEffect(() => {
    if (!editModalOpen) {
      reset({
        officeName: "",
        officeType: "",
        divisionCode: 0,
        districtCode: 0,
        areaCode: [],
        areaName: "",
      });
      setEditingOfficeDetail(null);
      setAccessLevel("");
      setSelectedOffice(null);
      setDistricts([]);
      setTehsils([]);
      setBlocks([]);
    }
  }, [editModalOpen, reset]);

  // AUTO‑SET OFFICE NAME with office type prefix (for display only)
  useEffect(() => {
    if (!accessLevel) return;

    const officeTypeObj = offices.find((o) => o.officeid === officeType);
    const typePrefix = officeTypeObj ? officeTypeObj.officetype : "";

    let geoName = "";
    if (accessLevel === "Division" && divisionCode && divisionCode !== 0) {
      const division = divisions.find((d) => d.divisionId === divisionCode);
      geoName = division ? division.divisionName : "";
    } else if (accessLevel === "District" && districtCode && districtCode !== 0) {
      const district = districts.find((d) => d.districtId === districtCode);
      geoName = district ? district.districtName : "";
    } else if (accessLevel === "Tehsil" && areaCode && areaCode.length > 0) {
      geoName = areaCode.length === 1 ?
        (tehsils.find(t => t.tehsilId === areaCode[0])?.tehsilName || "")
        : "Multiple";
    } else if (accessLevel === "Block" && areaCode && areaCode.length > 0) {
      geoName = areaCode.length === 1 ?
        (blocks.find(b => b.blockId === areaCode[0])?.blockName || "")
        : "Multiple";
    }

    const finalName = geoName
      ? typePrefix
        ? `${typePrefix} – ${geoName}`
        : geoName
      : "";
    setValue("officeName", finalName);
  }, [
    accessLevel,
    divisionCode,
    districtCode,
    areaCode,
    officeType,
    offices,
    divisions,
    districts,
    tehsils,
    blocks,
    setValue,
  ]);

  // SET AREA NAME AND AREA CODE consistently for all access levels
  useEffect(() => {
    if (!accessLevel) return;

    if (accessLevel === "Division" && divisionCode && divisionCode !== 0) {
      const division = divisions.find((d) => d.divisionId === divisionCode);
      if (division) {
        setValue("areaCode", [division.divisionId]);
        setValue("areaName", division.divisionName);
      } else {
        setValue("areaCode", []);
        setValue("areaName", "");
      }
    } else if (accessLevel === "District" && districtCode && districtCode !== 0) {
      // For district level, we do NOT set areaCode to district ID – keep as empty array
      // because we want to use the selected district(s) directly for multi-select.
      // areaName is not needed for district-level submission.
      setValue("areaCode", []);
      setValue("areaName", "");
    } else if (accessLevel === "Tehsil" && areaCode && areaCode.length > 0) {
      // areaName will be used for display but not needed for submission
    } else if (accessLevel === "Block" && areaCode && areaCode.length > 0) {
      // same
    } else {
      setValue("areaCode", []);
      setValue("areaName", "");
    }
  }, [
    accessLevel,
    divisionCode,
    districtCode,
    divisions,
    districts,
    setValue,
  ]);

  // Determine if the selected office type is DSWO (for multi-select at district level)
  const isDSWO = useMemo(() => {
    const office = offices.find(o => o.officeid === officeType);
    return office?.officetype === "DSWO"; // adjust exact string as needed
  }, [officeType, offices]);

  // Filtered lists
  const filteredDistricts = districts; // already filtered by division

  // Filter out already used districts (for duplicate prevention)
  const filteredDistrictsUnused = useMemo(() => {
    if (!officeType || !filteredDistricts) return filteredDistricts || [];
    return filteredDistricts.filter(district => {
      const key = `${officeType}_${district.districtId}`;
      return !usedCombinations.has(key);
    });
  }, [filteredDistricts, officeType, usedCombinations]);

  const filteredAreas = accessLevel === "Tehsil" ? tehsils : blocks;

  // Filter out already used areas (duplicate prevention) for Tehsil/Block
  const filteredAreasUnused = useMemo(() => {
    if (!officeType || !filteredAreas) return filteredAreas || [];
    return filteredAreas.filter(area => {
      const id = accessLevel === "Tehsil" ? area.tehsilId : area.blockId;
      const key = `${officeType}_${id}`;
      return !usedCombinations.has(key);
    });
  }, [filteredAreas, officeType, usedCombinations, accessLevel]);

  // ========== FORM SUBMISSION (MULTIPLE) ==========
  const onSubmit = async (data) => {
    // Determine what level we are submitting (District for DSWO, else Tehsil/Block)
    const level = isDSWO ? "District" : accessLevel;

    let itemsToSubmit = [];
    if (level === "District") {
      if (!data.districtCode || data.districtCode.length === 0) {
        setErrorMessage("Please select at least one district.");
        return;
      }
      itemsToSubmit = data.districtCode; // array of district IDs
    } else {
      if (!data.areaCode || data.areaCode.length === 0) {
        setErrorMessage("Please select at least one area.");
        return;
      }
      itemsToSubmit = data.areaCode; // array of tehsil/block IDs
    }

    try {
      const results = await Promise.allSettled(
        itemsToSubmit.map(async (id) => {
          const formData = new FormData();
          formData.append("StateCode", "0");
          formData.append("Divisioncode", data.divisionCode.toString());

          let currentDistrictCode;
          let areaIdToSend;
          let areaName;

          if (level === "District") {
            // DSWO: each submission uses one district, and area code is also the district ID
            currentDistrictCode = id;
            areaIdToSend = id; // <-- changed from 0 to id
            const districtObj = districts.find(d => d.districtId === id);
            areaName = districtObj ? districtObj.districtName : "";
          } else {
            // Tehsil/Block: use the parent district (single value)
            currentDistrictCode = data.districtCode;
            areaIdToSend = id;
            const areaObj = filteredAreas.find(a =>
              accessLevel === "Tehsil" ? a.tehsilId === id : a.blockId === id
            );
            areaName = areaObj
              ? (accessLevel === "Tehsil" ? areaObj.tehsilName : areaObj.blockName)
              : "";
          }

          formData.append("DistrictCode", currentDistrictCode.toString());
          formData.append("AreaCode", areaIdToSend.toString());
          formData.append("AreaName", areaName);

          // Build office name: type prefix + area name (or district name)
          const officeTypeObj = offices.find((o) => o.officeid === data.officeType);
          const typePrefix = officeTypeObj ? officeTypeObj.officetype : "";
          const officeName = typePrefix ? `${typePrefix} – ${areaName}` : areaName;
          formData.append("OfficeName", officeName);
          formData.append("OfficeType", data.officeType.toString());

          return axiosInstance.post("/Admin/AddOfficeDetail", formData);
        })
      );

      const succeeded = results.filter(
        r => r.status === "fulfilled" && r.value.data.status
      );
      const failed = results.filter(
        r => r.status === "rejected" || !r.value?.data?.status
      );

      if (succeeded.length > 0) {
        setModalMessage({
          title: "Add Office Details",
          message: `${succeeded.length} office detail(s) added successfully.` +
            (failed.length > 0 ? ` ${failed.length} failed.` : ""),
          type: succeeded.length > 0 ? "success" : "error",
        });
        setShowMessageModal(true);

        // Clear the multi-select field that was used
        if (level === "District") {
          setValue("districtCode", []);
        } else {
          setValue("areaCode", []);
        }
        setValue("areaName", "");

        setErrorMessage("");
        setRefreshTable((prev) => !prev);

        // Refresh existing office details to update used combinations
        const response = await axiosInstance.get("/Admin/GetOfficeDetails");
        setExistingOfficeDetails(response.data.data || []);
      } else {
        setErrorMessage("All submissions failed.");
      }
    } catch (error) {
      setErrorMessage(`Error: ${error.message}`);
    }
  };
  // ========== UPDATE (SINGLE) ==========
  const handleUpdate = async (data) => {
    if (!editingOfficeDetail) return;

    try {
      const formData = new FormData();
      formData.append(
        "OfficeDetailId",
        editingOfficeDetail.officeDetailId.toString()
      );
      formData.append("StateCode", "0");
      formData.append("Divisioncode", data.divisionCode.toString());
      formData.append("DistrictCode", data.districtCode.toString());
      // areaCode is an array in the form, but for update we assume single
      const singleAreaCode = data.areaCode[0] || 0;
      formData.append("AreaCode", singleAreaCode.toString());
      // areaName must be provided; find it
      let areaName = data.areaName;
      if (accessLevel === "District") {
        // For district level, areaName should be district name
        const districtObj = districts.find(d => d.districtId === data.districtCode);
        areaName = districtObj ? districtObj.districtName : "";
      } else {
        const areaObj = filteredAreas.find(a =>
          accessLevel === "Tehsil" ? a.tehsilId === singleAreaCode : a.blockId === singleAreaCode
        );
        areaName = areaObj
          ? (accessLevel === "Tehsil" ? areaObj.tehsilName : areaObj.blockName)
          : data.areaName;
      }
      formData.append("AreaName", areaName);
      formData.append("OfficeName", data.officeName);
      formData.append("OfficeType", data.officeType.toString());

      const response = await axiosInstance.post(
        "/Admin/UpdateOfficeDetail",
        formData
      );

      if (response.data.status) {
        setModalMessage({
          title: "Update Office Detail",
          message: "Updated Successfully.",
          type: "success",
        });
        setShowMessageModal(true);
        setEditModalOpen(false);
        setRefreshTable((prev) => !prev);
        // Refresh existing details
        const res = await axiosInstance.get("/Admin/GetOfficeDetails");
        setExistingOfficeDetails(res.data.data || []);
      } else {
        setErrorMessage(
          `Update failed: ${response.data.message || "Unknown error"}`
        );
      }
    } catch (error) {
      setErrorMessage(`Error: ${error.message}`);
    }
  };

  // ========== DELETE ==========
  const handleDelete = async (officeDetailId) => {
    try {
      const formData = new FormData();
      formData.append("OfficeDetailId", officeDetailId.toString());

      const response = await axiosInstance.post(
        "/Admin/DeleteOfficeDetail",
        formData
      );

      if (response.data.status) {
        setModalMessage({
          title: "Delete Office Detail",
          message: "Deleted Successfully.",
          type: "success",
        });
        setShowMessageModal(true);
        setRefreshTable((prev) => !prev);
        // Refresh existing details
        const res = await axiosInstance.get("/Admin/GetOfficeDetails");
        setExistingOfficeDetails(res.data.data || []);
      } else {
        setErrorMessage(
          `Delete failed: ${response.data.message || "Unknown error"}`
        );
      }
    } catch (error) {
      setErrorMessage(`Error: ${error.message}`);
    }
  };

  // Action functions for ServerSideTable
  const actionFunctions = {
    UpdateOfficeDetail: (row) => {
      if (!canModifyOfficeDetails) {
        setErrorMessage("No permission to update.");
        return;
      }
      const userdata = row.original;

      // First set officeType and look up accessLevel
      setValue("officeType", userdata.officeType);
      const office = offices.find((o) => o.officeid === userdata.officeType);
      if (office) {
        setAccessLevel(office.accesslevel);
        setSelectedOffice(office);
      }

      // Then set the rest – cascading fetches will happen
      setValue("divisionCode", userdata.divisionCode);
      setValue("districtCode", userdata.districtCode);
      setValue("areaCode", [userdata.areaCode]); // as array
      setValue("areaName", userdata.areaName);
      setValue("officeName", userdata.officeName);

      setEditingOfficeDetail(userdata);
      setEditModalOpen(true);
    },

    DeleteOfficeDetail: (row) => {
      if (!canModifyOfficeDetails) {
        setErrorMessage("No permission to delete.");
        return;
      }
      setDeleteId(row.original.officeDetailId);
      setDeleteConfirmOpen(true);
    },
  };

  // Confirmed delete
  const handleConfirmDelete = async () => {
    if (!deleteId) return;
    setDeleteConfirmOpen(false);
    await handleDelete(deleteId);
    setDeleteId(null);
  };

  // Table columns
  const columns = [
    { field: "officeDetailId", headerName: "ID", flex: 1 },
    { field: "officeName", headerName: "Office Name", flex: 1 },
    { field: "officeType", headerName: "Office Type", flex: 1 },
    { field: "divisionCode", headerName: "Division Code", flex: 0.5 },
    { field: "districtCode", headerName: "District Code", flex: 0.5 },
    { field: "areaCode", headerName: "Area Code", flex: 0.5 },
    { field: "areaName", headerName: "Area Name", flex: 1 },
  ];

  if (isLoading) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
        }}
      >
        <CircularProgress size={60} />
      </Box>
    );
  }

  // Visibility rules
  const shouldShowDivision = accessLevel !== "State";
  const shouldShowDistrict = ["District", "Tehsil", "Block"].includes(accessLevel);
  const shouldShowArea = ["Tehsil", "Block"].includes(accessLevel);

  // Determine loading state for areas
  const isLoadingAreas =
    (accessLevel === "Tehsil" && loadingTehsils) ||
    (accessLevel === "Block" && loadingBlocks);

  return (
    <Container maxWidth="lg" sx={{ py: 8 }}>
      <Typography variant="h4" fontWeight="bold" align="center" gutterBottom>
        Add New Office Details
      </Typography>
      {errorMessage && (
        <Alert severity="error" sx={{ mb: 4 }}>
          {errorMessage}
        </Alert>
      )}

      {/* Add Form */}
      <Box
        sx={{ bgcolor: "white", p: 4, borderRadius: 2, boxShadow: 3, mb: 6 }}
      >
        <form onSubmit={handleSubmit(onSubmit)}>
          <Grid container spacing={3}>
            {/* Office Type */}
            <Grid item xs={12} sm={6}>
              <Controller
                name="officeType"
                control={control}
                rules={{ required: "Office type is required" }}
                render={({ field }) => (
                  <FormControl
                    fullWidth
                    variant="outlined"
                    error={!!errors.officeType}
                  >
                    <InputLabel shrink>Office Type</InputLabel>
                    <Select {...field} label="Office Type">
                      <MenuItem value="">Select Office Type</MenuItem>
                      {offices.map((office) => (
                        <MenuItem key={office.officeid} value={office.officeid}>
                          {office.officetype}
                        </MenuItem>
                      ))}
                    </Select>
                    {errors.officeType && (
                      <Typography color="error" variant="caption">
                        {errors.officeType.message}
                      </Typography>
                    )}
                  </FormControl>
                )}
              />
            </Grid>

            {/* Division dropdown */}
            {shouldShowDivision && (
              <Grid item xs={12} sm={6}>
                <Controller
                  name="divisionCode"
                  control={control}
                  rules={{ required: "Division is required" }}
                  render={({ field }) => (
                    <FormControl
                      fullWidth
                      variant="outlined"
                      error={!!errors.divisionCode}
                    >
                      <InputLabel shrink>Division</InputLabel>
                      <Select
                        {...field}
                        label="Division"
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      >
                        <MenuItem value={0}>Select Division</MenuItem>
                        {divisions.map((div) => (
                          <MenuItem key={div.divisionId} value={div.divisionId}>
                            {div.divisionName}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                />
              </Grid>
            )}

            {/* District dropdown – multi-select for DSWO, single otherwise */}
            {shouldShowDistrict && (
              <Grid item xs={12} sm={6}>
                <Controller
                  name="districtCode"
                  control={control}
                  rules={{ required: "District is required" }}
                  render={({ field }) => (
                    <FormControl
                      fullWidth
                      variant="outlined"
                      error={!!errors.districtCode}
                      disabled={loadingDistricts}
                    >
                      <InputLabel shrink>District</InputLabel>
                      {isDSWO ? (
                        // Multi-select for DSWO
                        <Select
                          {...field}
                          multiple
                          value={Array.isArray(field.value) ? field.value : []}   // ensure array
                          onChange={(e) => field.onChange(e.target.value)}        // e.target.value is already an array
                          renderValue={(selected) => {
                            if (selected.length === 0) return "Select Districts";
                            const names = selected.map(id => {
                              const district = districts.find(d => d.districtId === id);
                              return district ? district.districtName : id;
                            });
                            return names.join(", ");
                          }}
                        >
                          {filteredDistrictsUnused.length === 0 ? (
                            <MenuItem disabled>All districts already added</MenuItem>
                          ) : (
                            filteredDistrictsUnused.map((district) => (
                              <MenuItem key={district.districtId} value={district.districtId}>
                                <Checkbox
                                  checked={
                                    (Array.isArray(field.value) ? field.value : []).includes(district.districtId)
                                  }
                                />
                                <ListItemText primary={district.districtName} />
                              </MenuItem>
                            ))
                          )}
                        </Select>
                      ) : (
                        // Single select for other office types
                        <Select
                          {...field}
                          value={field.value || 0}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        >
                          <MenuItem value={0}>Select District</MenuItem>
                          {loadingDistricts ? (
                            <MenuItem disabled>Loading districts...</MenuItem>
                          ) : (
                            filteredDistrictsUnused.map((dist) => (
                              <MenuItem key={dist.districtId} value={dist.districtId}>
                                {dist.districtName}
                              </MenuItem>
                            ))
                          )}
                        </Select>
                      )}
                    </FormControl>
                  )}
                />
              </Grid>
            )}

            {/* Area multi-select (Tehsil/Block) with duplicate prevention */}
            {shouldShowArea && (
              <Grid item xs={12} sm={6}>
                <Controller
                  name="areaCode"
                  control={control}
                  rules={{ required: "At least one area is required" }}
                  render={({ field }) => (
                    <FormControl
                      fullWidth
                      variant="outlined"
                      error={!!errors.areaCode}
                      disabled={isLoadingAreas}
                    >
                      <InputLabel shrink>{accessLevel}</InputLabel>
                      <Select
                        {...field}
                        multiple
                        value={field.value || []}
                        onChange={(e) => field.onChange(e.target.value)}
                        renderValue={(selected) => {
                          if (selected.length === 0) return `Select ${accessLevel}(s)`;
                          const names = selected.map(id => {
                            const area = filteredAreas.find(a =>
                              accessLevel === "Tehsil" ? a.tehsilId === id : a.blockId === id
                            );
                            return area
                              ? (accessLevel === "Tehsil" ? area.tehsilName : area.blockName)
                              : id;
                          });
                          return names.join(", ");
                        }}
                      >
                        {filteredAreasUnused.length === 0 ? (
                          <MenuItem disabled>All {accessLevel}s already added</MenuItem>
                        ) : (
                          filteredAreasUnused.map((area) => {
                            const id = accessLevel === "Tehsil" ? area.tehsilId : area.blockId;
                            const name = accessLevel === "Tehsil" ? area.tehsilName : area.blockName;
                            return (
                              <MenuItem key={id} value={id}>
                                <Checkbox checked={field.value?.includes(id)} />
                                <ListItemText primary={name} />
                              </MenuItem>
                            );
                          })
                        )}
                      </Select>
                    </FormControl>
                  )}
                />
              </Grid>
            )}

            {/* Office Name (read-only, auto-filled with prefix) */}
            <Grid item xs={12} sm={6}>
              <Controller
                name="officeName"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    label="Office Name (auto-filled)"
                    variant="outlined"
                    InputProps={{ readOnly: true }}
                    InputLabelProps={{ shrink: true }}
                  />
                )}
              />
            </Grid>

            <Grid item xs={12}>
              <Button
                type="submit"
                variant="contained"
                color="primary"
                fullWidth
                sx={{ mt: 3, py: 1.5 }}
                disabled={!canModifyOfficeDetails}
              >
                Add Office Details
              </Button>
            </Grid>
          </Grid>
        </form>
      </Box>

      {/* Table */}
      <ServerSideTable
        url="/Admin/GetOfficeDetails"
        Title="Existing Office Details"
        extraParams={{}}
        canSanction={false}
        canHavePool={false}
        pendingApplications={false}
        actionFunctions={actionFunctions}
        columns={columns}
        refresh={refreshTable}
        onAction={(actionFunction, row) => actionFunctions[actionFunction](row)}
      />

      {/* Message Modal */}
      <MessageModal
        open={showMessageModal}
        onClose={() => setShowMessageModal(false)}
        title={modalMessage.title}
        message={modalMessage.message}
        type={modalMessage.type}
      />

      {/* Delete Confirmation Modal */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this office detail?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)} color="primary">
            Cancel
          </Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Modal (single selection) */}
      <Modal open={editModalOpen} onClose={() => setEditModalOpen(false)}>
        <Box
          sx={{
            bgcolor: "white",
            p: 4,
            borderRadius: 2,
            maxWidth: 600,
            mx: "auto",
            mt: "5%",
            boxShadow: 24,
            maxHeight: "80vh",
            overflowY: "auto",
          }}
        >
          <Typography variant="h5" fontWeight="bold" gutterBottom>
            Edit Office Detail
          </Typography>
          {errorMessage && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {errorMessage}
            </Alert>
          )}

          <form onSubmit={handleSubmit(handleUpdate)}>
            <Grid container spacing={3}>
              {/* Office Type */}
              <Grid item xs={12} sm={6}>
                <Controller
                  name="officeType"
                  control={control}
                  rules={{ required: "Required" }}
                  render={({ field }) => (
                    <FormControl
                      fullWidth
                      variant="outlined"
                      error={!!errors.officeType}
                    >
                      <InputLabel shrink>Office Type</InputLabel>
                      <Select
                        {...field}
                        label="Office Type"
                        onChange={(e) => {
                          field.onChange(e.target.value);
                          const office = offices.find(
                            (o) => o.officeid === e.target.value
                          );
                          if (office) {
                            setAccessLevel(office.accesslevel);
                            setSelectedOffice(office);
                          }
                        }}
                      >
                        <MenuItem value="">Select</MenuItem>
                        {offices.map((office) => (
                          <MenuItem key={office.officeid} value={office.officeid}>
                            {office.officetype}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                />
              </Grid>

              {/* Division dropdown */}
              {shouldShowDivision && (
                <Grid item xs={12} sm={6}>
                  <Controller
                    name="divisionCode"
                    control={control}
                    rules={{ required: "Required" }}
                    render={({ field }) => (
                      <FormControl
                        fullWidth
                        variant="outlined"
                        error={!!errors.divisionCode}
                      >
                        <InputLabel shrink>Division</InputLabel>
                        <Select
                          {...field}
                          label="Division"
                          onChange={(e) =>
                            field.onChange(Number(e.target.value))
                          }
                        >
                          <MenuItem value={0}>Select</MenuItem>
                          {divisions.map((div) => (
                            <MenuItem
                              key={div.divisionId}
                              value={div.divisionId}
                            >
                              {div.divisionName}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    )}
                  />
                </Grid>
              )}

              {/* District dropdown (single select in edit mode) */}
              {shouldShowDistrict && (
                <Grid item xs={12} sm={6}>
                  <Controller
                    name="districtCode"
                    control={control}
                    rules={{ required: "Required" }}
                    render={({ field }) => (
                      <FormControl
                        fullWidth
                        variant="outlined"
                        error={!!errors.districtCode}
                        disabled={loadingDistricts}
                      >
                        <InputLabel shrink>District</InputLabel>
                        <Select
                          {...field}
                          value={field.value || 0}
                          onChange={(e) =>
                            field.onChange(Number(e.target.value))
                          }
                        >
                          <MenuItem value={0}>Select</MenuItem>
                          {loadingDistricts ? (
                            <MenuItem disabled>Loading districts...</MenuItem>
                          ) : (
                            districts.map((dist) => (
                              <MenuItem
                                key={dist.districtId}
                                value={dist.districtId}
                              >
                                {dist.districtName}
                              </MenuItem>
                            ))
                          )}
                        </Select>
                      </FormControl>
                    )}
                  />
                </Grid>
              )}

              {/* Area dropdown (single in edit mode) */}
              {shouldShowArea && (
                <Grid item xs={12} sm={6}>
                  <Controller
                    name="areaCode"
                    control={control}
                    rules={{ required: "Required" }}
                    render={({ field }) => (
                      <FormControl
                        fullWidth
                        variant="outlined"
                        error={!!errors.areaCode}
                        disabled={isLoadingAreas}
                      >
                        <InputLabel shrink>{accessLevel}</InputLabel>
                        <Select
                          {...field}
                          value={field.value?.[0] || 0}
                          onChange={(e) =>
                            field.onChange([Number(e.target.value)])
                          }
                        >
                          <MenuItem value={0}>Select {accessLevel}</MenuItem>
                          {isLoadingAreas ? (
                            <MenuItem disabled>Loading {accessLevel}s...</MenuItem>
                          ) : (
                            filteredAreas.map((area) => {
                              const id =
                                accessLevel === "Tehsil"
                                  ? area.tehsilId
                                  : area.blockId;
                              const name =
                                accessLevel === "Tehsil"
                                  ? area.tehsilName
                                  : area.blockName;
                              return (
                                <MenuItem key={id} value={id}>
                                  {name}
                                </MenuItem>
                              );
                            })
                          )}
                        </Select>
                      </FormControl>
                    )}
                  />
                </Grid>
              )}

              {/* Office Name (read-only, auto-filled with prefix) */}
              <Grid item xs={12} sm={6}>
                <Controller
                  name="officeName"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Office Name (auto-filled)"
                      variant="outlined"
                      InputProps={{ readOnly: true }}
                      InputLabelProps={{ shrink: true }}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12}>
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: 2,
                    mt: 3,
                  }}
                >
                  <Button
                    variant="outlined"
                    onClick={() => setEditModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" variant="contained" color="primary">
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