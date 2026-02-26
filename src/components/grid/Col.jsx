// Col.jsx
import React from 'react';
import { Box } from '@mui/material';

const Col = ({
  children,
  xs = 12,
  sm = false,
  md = false,
  lg = false,
  xl = false,
  ...props
}) => {
  // Define the width based on the props
  const getWidth = () => {
    const breakpoints = { xs, sm, md, lg, xl };
    let width = 100; // Default to 100%

    for (const [key, value] of Object.entries(breakpoints)) {
      if (value) {
        width = (value / 12) * 100;
      }
    }

    return `${width}%`;
  };

  return (
    <Box
      sx={{
        flexBasis: getWidth(),
        maxWidth: getWidth(),
        padding: 1, // Adjust padding as needed
      }}
      {...props}
    >
      {children}
    </Box>
  );
};

export default Col;
