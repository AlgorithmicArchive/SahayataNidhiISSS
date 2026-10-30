import React, { useEffect, useState } from "react";
import {
  Box,
  FormControl,
  FormHelperText,
  Button,
  Autocomplete,
  TextField,
  Typography,
  InputAdornment,
  CircularProgress,
} from "@mui/material";
import { useForm, Controller } from "react-hook-form";
import MiscellaneousServicesIcon from "@mui/icons-material/MiscellaneousServices";
import SearchIcon from "@mui/icons-material/Search";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";

/**
 * ServiceSelectionForm - GIGW-themed service selector used across officer screens.
 *
 * Props:
 *  - services: array of { label, value }
 *  - errors: react-hook-form style errors object (errors.Service)
 *  - onServiceSelect: (serviceId) => void
 *  - value: optional preselected serviceId
 */
const ServiceSelectionForm = ({ services, errors, onServiceSelect, value }) => {
  const { control, handleSubmit, setValue } = useForm();
  const [selectedValue, setSelectedValue] = useState(null);

  const onSubmit = (data) => {
    if (data.Service) {
      onServiceSelect(data.Service.value);
    }
  };

  useEffect(() => {
    if (services.length === 1) {
      // Only one service: select automatically
      const defaultService = services[0];
      setSelectedValue(defaultService);
      setValue("Service", defaultService);
      handleSubmit(onSubmit)();
    } else if (selectedValue === null) {
      // Try to preselect the value passed by the parent (e.g. an active service)
      const match =
        value != null
          ? services.find((s) => String(s.value) === String(value))
          : undefined;
      if (match) {
        setSelectedValue(match);
        setValue("Service", match);
      } else {
        setSelectedValue(null);
        setValue("Service", null);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [services]);

  const hasError = Boolean(errors?.Service);

  return (
    <Box
      component="form"
      onSubmit={handleSubmit(onSubmit)}
      sx={{
        margin: "0 auto",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          mb: 2.5,
        }}
      >
        <Box
          sx={{
            width: 46,
            height: 46,
            borderRadius: 2,
            bgcolor: "#EFF6FF",
            border: "1px solid #D9E2EC",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <MiscellaneousServicesIcon sx={{ fontSize: 28, color: "#17418F" }} />
        </Box>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700, color: "#0F172A" }}>
            Select Service
          </Typography>
          <Typography variant="body2" sx={{ color: "#4A5568" }}>
            Choose a service to view its applications and actions
          </Typography>
        </Box>
      </Box>

      <FormControl fullWidth margin="normal" error={hasError}>
        <Controller
          name="Service"
          control={control}
          rules={{
            required: "Please select a service",
            validate: (val) => val !== null || "Please select a service",
          }}
          render={({
            field: { onChange, ...field },
            fieldState: { error },
          }) => (
            <Autocomplete
              {...field}
              value={selectedValue}
              onChange={(event, newValue) => {
                setSelectedValue(newValue);
                onChange(newValue);
              }}
              options={services}
              getOptionLabel={(option) => option.label || ""}
              isOptionEqualToValue={(option, optVal) =>
                option.value === optVal?.value
              }
              loading={services.length === 0}
              noOptionsText="No services available"
              clearText="Clear"
              openText="Open"
              closeText="Close"
              loadingText={
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <CircularProgress size={18} color="primary" />
                  <span>Loading services...</span>
                </Box>
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Service"
                  placeholder="Search or select a service"
                  error={Boolean(error || hasError)}
                  helperText={error?.message || errors?.Service?.message}
                  variant="outlined"
                  InputProps={{
                    ...params.InputProps,
                    startAdornment: (
                      <>
                        <InputAdornment position="start">
                          <SearchIcon sx={{ color: "#17418F" }} />
                        </InputAdornment>
                        {params.InputProps.startAdornment}
                      </>
                    ),
                  }}
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      borderRadius: "10px",
                      backgroundColor: "#FFFFFF",
                      "& fieldset": { borderColor: "#D9E2EC" },
                      "&:hover fieldset": { borderColor: "#3D63B0" },
                      "&.Mui-focused fieldset": {
                        borderColor: "#17418F",
                        boxShadow: "0 0 0 3px rgba(23, 65, 143, 0.15)",
                      },
                      "&.Mui-error fieldset": { borderColor: "#B3261E" },
                    },
                    "& .MuiInputLabel-root": {
                      "&.Mui-focused": { color: "#17418F" },
                    },
                  }}
                />
              )}
            />
          )}
        />
        {hasError && !errors.Service?.message && (
          <FormHelperText sx={{ ml: 1.75 }}>
            This field is required
          </FormHelperText>
        )}
      </FormControl>

      {services.length > 1 && (
        <Button
          type="submit"
          variant="contained"
          disabled={!selectedValue}
          endIcon={<ArrowForwardIcon />}
          sx={{
            mt: 3,
            minWidth: 220,
            background: "linear-gradient(135deg, #17418F 0%, #2561E8 100%)",
            color: "#FFFFFF",
            fontWeight: 600,
            fontSize: "1rem",
            borderRadius: "10px",
            py: 1.2,
            margin: "0 auto",
            textTransform: "none",
            "&:hover": {
              background: "linear-gradient(135deg, #0E2A5C 0%, #17418F 100%)",
            },
            "&.Mui-disabled": {
              background: "#E2E8F0",
              color: "#94A3B8",
            },
          }}
        >
          Get Details
        </Button>
      )}
    </Box>
  );
};

export default ServiceSelectionForm;