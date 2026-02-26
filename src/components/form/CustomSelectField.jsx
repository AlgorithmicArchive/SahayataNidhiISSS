import React, { forwardRef, useImperativeHandle, useRef } from "react";
import { Box, MenuItem, TextField, Typography, useTheme } from "@mui/material";
import { Controller } from "react-hook-form";

const CustomSelectField = forwardRef(
  (
    {
      label,
      name,
      value = "",
      control,
      options = [],
      placeholder = "Select an option...",
      rules = {},
      errors,
      onChange,
    },
    ref
  ) => {
    const theme = useTheme();
    const selectFieldRef = useRef(null);

    useImperativeHandle(ref, () => ({
      setSelectValue: (value) => {
        if (selectFieldRef.current) {
          selectFieldRef.current.onChange(value);
        }
      },
    }));

    return (
      <Box sx={{ display: "flex", flexDirection: "column", mb: 2 }}>
        <Controller
          name={name}
          control={control}
          rules={rules}
          defaultValue={value}
          render={({ field, fieldState: { error } }) => {
            selectFieldRef.current = field;
            return (
              <TextField
                select
                label={label}
                value={field.value || ""}
                onChange={(e) => {
                  const value = e.target.value;
                  field.onChange(value);
                  if (onChange) onChange(value);
                }}
                error={!!error}
                helperText={error ? error.message : ""}
                fullWidth
                margin="normal"
                InputLabelProps={{
                  shrink: true,
                  sx: {
                    color: theme.palette.text.primary, // #999999
                    "&.Mui-focused": {
                      color: theme.palette.text.primary, // #D2946A
                    },
                  },
                }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    fontSize: "16px",
                    border: error
                      ? `2px solid ${theme.palette.error.main}`
                      : `1px solid ${theme.palette.divider}`, // #D8D8D8
                    borderRadius: "5px",
                    backgroundColor: theme.palette.background.paper, // #F9F7F4
                    color: theme.palette.text.primary, // #333333
                    "&:hover": {
                      borderColor: theme.palette.text.primary, // #D2946A
                    },
                    "&.Mui-focused": {
                      borderColor: theme.palette.text.primary, // #D2946A
                      boxShadow: `0 0 0 2px ${theme.palette.primary.light}`,
                    },
                  },
                  marginBottom: 2,
                }}
              >
                <MenuItem
                  value=""
                  disabled
                  sx={{ color: theme.palette.text.secondary }}
                >
                  {placeholder}
                </MenuItem>
                {options.map((option, index) => (
                  <MenuItem
                    key={index}
                    value={option.value}
                    sx={{
                      color: theme.palette.text.primary,
                      "&:hover": {
                        backgroundColor: theme.palette.primary.light,
                      },
                      "&.Mui-selected": {
                        backgroundColor: theme.palette.primary.main,
                        color: theme.palette.background.paper,
                      },
                    }}
                  >
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
            );
          }}
        />

        {errors?.[name] && (
          <Typography
            variant="body2"
            sx={{ color: theme.palette.error.main, mt: 1 }}
          >
            {errors[name].message}
          </Typography>
        )}
      </Box>
    );
  }
);

export default CustomSelectField;
