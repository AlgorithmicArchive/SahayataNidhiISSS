import React from 'react';
import { Outlet } from 'react-router-dom';
import { Box } from '@mui/material';

export default function AdminLayout() {
  return (
    <Box sx={{width:'100%',padding:0}} >
      <Outlet />
    </Box>
  );
}
