import React, { forwardRef } from 'react';
import { Box, Typography } from '@mui/material';
import { Controller } from 'react-hook-form';
import DatePicker from 'react-datepicker';
import { format, parse } from 'date-fns';
import 'react-datepicker/dist/react-datepicker.css';

export default function CustomDateInput({
  label,
  name,
  control,
  rules = {},
  placeholder = 'DD MMM YYYY',
  defaultDate = null, // Add a defaultDate prop
}) {
  // Helper function to format the date
  const formatDate = (date) => {
    return date ? format(date, 'dd MMM yyyy') : '';
  };

  // Helper function to parse the date
  const parseDate = (value) => {
    return value ? parse(value, 'dd MMM yyyy', new Date()) : null;
  };

  // Custom input component with forwardRef and onChange
  const CustomInput = forwardRef(({ value, onClick, onChange, error }, ref) => (
    <input
      ref={ref}
      value={value}
      onClick={onClick}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        padding: '10px',
        fontSize: '16px',
        border: error ? '2px solid red' : '2px solid #48426D',
        borderRadius: '5px',
        outline: 'none',
        transition: 'border-color 0.3s',
        width: '100%',
        backgroundColor: 'transparent',
        color: '#48426D',
      }}
    />
  ));

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', mb: 2 }}>
      {label && (
        <Typography sx={{ fontWeight: 'bold', mb: 1, color: 'background.default' }}>
          {label}
        </Typography>
      )}

      <Controller
        name={name}
        control={control}
        defaultValue={defaultDate ? formatDate(defaultDate) : null} // Use defaultDate if provided
        rules={rules}
        render={({ field, fieldState: { error } }) => (
          <>
            <DatePicker
              selected={field.value ? parseDate(field.value) : defaultDate} // Set defaultDate if no value
              onChange={(date) => {
                const formattedDate = formatDate(date);
                field.onChange(formattedDate);
              }}
              dateFormat="dd MMM yyyy"
              customInput={
                <CustomInput error={error} value={field.value} onChange={field.onChange} />
              }
              showPopperArrow={true}
              showYearDropdown
              scrollableYearDropdown
              yearDropdownItemNumber={100}
              showMonthDropdown
              dropdownMode="select"
            />
            {error && (
              <Typography variant="body2" sx={{ color: 'red', mt: 1 }}>
                {error.message}
              </Typography>
            )}
          </>
        )}
      />
    </Box>
  );
}
