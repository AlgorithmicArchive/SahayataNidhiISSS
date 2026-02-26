import React from "react";
import { Box, TextField, Typography } from "@mui/material";
import { Controller } from "react-hook-form";

export default function CustomInputField({
  label,
  name,
  value = "",
  type = "text",
  control,
  placeholder = "Enter text...",
  rules = {},
  onChange,
  onBlur,
  maxLength,
  minLength,
}) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", mb: 2 }}>
      {label && (
        <Typography
          sx={{
            mb: 1,
            color: "text.primary", // from theme
            fontSize: 14,
          }}
        >
          {label}
        </Typography>
      )}

      <Controller
        name={name}
        control={control}
        defaultValue={value}
        rules={rules}
        render={({ field, fieldState: { error } }) => (
          <TextField
            {...field}
            type={type}
            placeholder={placeholder}
            variant="outlined"
            fullWidth
            error={!!error}
            helperText={error ? error.message : ""}
            onChange={(e) => {
              field.onChange(e);
              if (onChange) onChange(e);
            }}
            onBlur={onBlur}
            InputProps={{
              sx: {
                fontSize: "16px",
                borderRadius: "5px",
                backgroundColor: "background.paper", // soft input background
                color: "text.primary",
                border: error ? "2px solid red" : "1px solid", // use theme border color
                borderColor: error ? "error.main" : "divider",
                "& input::placeholder": {
                  color: "text.secondary", // theme-based placeholder
                },
                "&:hover": {
                  borderColor: "primary.main",
                },
                "&.Mui-focused": {
                  borderColor: "primary.main",
                },
                boxShadow: "none",
                padding: 0,
              },
              inputProps: {
                maxLength,
              },
            }}
          />
        )}
      />
    </Box>
  );
}
