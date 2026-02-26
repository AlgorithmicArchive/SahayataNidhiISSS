// Row.jsx
import React from 'react';
import { Box } from '@mui/material';

const Row = ({ children, align = 'stretch', justify = 'flex-start', ...props }) => {
  return (
    <Box
      display="flex"
      flexDirection="row"
      alignItems={align}
      justifyContent={justify}
      flexWrap="wrap"
      {...props}
    >
      {children}
    </Box>
  );
};

export default Row;
