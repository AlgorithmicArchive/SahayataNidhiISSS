// CustomCheckbox.jsx
import React from 'react';
import { Box, Typography, Checkbox, FormControlLabel } from '@mui/material';
import { Controller } from 'react-hook-form';

export default function CustomCheckbox({
  label,
  name,
  value, // The specific value of this checkbox item
  control,
  rules = {},
}) {
  if (!control) {
    console.error('CustomCheckbox requires a valid control prop from react-hook-form.');
    return null; // Prevent rendering if control is not provided
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
      <Controller
        name={name}
        control={control}
        rules={rules}
        render={({ field, fieldState: { error } }) => {
          const handleChange = (e) => {
            const isChecked = e.target.checked;
            const currentValue = field.value || [];
            // Toggle the checkbox value in the array
            const newValue = isChecked
              ? [...currentValue, value]
              : currentValue.filter((item) => item !== value);
            field.onChange(newValue);
          };

          return (
            <Box>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={field.value ? field.value.includes(value) : false} // Use false if field.value is undefined
                    onChange={handleChange}
                    sx={{
                      color: '#888', // Default unchecked color
                      '&.Mui-checked': {
                        color: '#48426D', // Color when checked
                      },
                    }}
                  />
                }
                label={label}
                sx={{
                  // Style the label text
                  '.MuiFormControlLabel-label': {
                    color: '#48426D', // Label text color
                    fontWeight: field.value?.includes(value) ? 'bold' : 'normal', // Bold when checked
                  },
                }}
              />
              {error && (
                <Typography variant="body2" sx={{ color: 'red', mt: 1 }}>
                  {error.message}
                </Typography>
              )}
            </Box>
          );
        }}
      />
    </Box>
  );
}
