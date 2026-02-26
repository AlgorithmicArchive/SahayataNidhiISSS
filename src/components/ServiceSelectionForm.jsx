import React, { useEffect, useState } from "react";
import {
  Box,
  FormControl,
  FormHelperText,
  Button,
  Autocomplete,
  TextField,
} from "@mui/material";
import { useForm, Controller } from "react-hook-form";

const ServiceSelectionForm = ({ services, errors, onServiceSelect }) => {
  const { control, handleSubmit, setValue } = useForm();
  const [selectedValue, setSelectedValue] = useState(null);

  const onSubmit = (data) => {
    if (data.Service) {
      onServiceSelect(data.Service.value);
    }
  };

  useEffect(() => {
    console.log("Services", services)
    if (services.length === 1) {
      // Only one service: select automatically
      const defaultService = services[0];
      setSelectedValue(defaultService);
      setValue("Service", defaultService);
      handleSubmit(onSubmit)();
    } else if (selectedValue === null) {
      // More than one service: reset to null
      setSelectedValue(null);
      setValue("Service", null);
    }
  }, [services]);

  return (
    <Box
      component="form"
      onSubmit={handleSubmit(onSubmit)}
      sx={{
        margin: "0 auto",
        color: "primary.main",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      <FormControl fullWidth margin="normal" error={!!errors?.Service}>
        <Controller
          name="Service"
          control={control}
          rules={{
            required: "This field is required",
            validate: value => value !== null || "Please select a service"
          }}
          render={({ field: { onChange, value, ...field }, fieldState: { error } }) => (
            <Autocomplete
              {...field}
              value={selectedValue}
              onChange={(event, newValue) => {
                setSelectedValue(newValue);
                onChange(newValue);
              }}
              options={services}
              getOptionLabel={(option) => option.label || ""}
              isOptionEqualToValue={(option, value) => option.value === value?.value}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Select Service"
                  error={!!error}
                  helperText={error?.message}
                  variant="outlined"
                />
              )}
              noOptionsText="No services available"
              clearText="Clear"
              openText="Open"
              closeText="Close"
              loadingText="Loading..."
              sx={{
                '& .MuiAutocomplete-inputRoot': {
                  padding: '8.5px 14px',
                }
              }}
            />
          )}
        />
        {errors?.Service && (
          <FormHelperText sx={{ ml: 1.75 }}>{errors.Service.message}</FormHelperText>
        )}
      </FormControl>

      {services.length > 1 && (
        <Button
          type="submit"
          variant="contained"
          color="primary"
          sx={{
            mt: 2,
            width: "20%",
            background: "linear-gradient(to bottom right, #2561E8, #1F43B4)",
            color: "background.paper",
            margin: "0 auto",
            fontSize: 24,
          }}
          disabled={!selectedValue}
        >
          Get Details
        </Button>
      )}
    </Box>
  );
};

export default ServiceSelectionForm;