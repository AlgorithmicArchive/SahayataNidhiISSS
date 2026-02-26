import React from "react";
import { Outlet } from "react-router-dom";
import { Box } from "@mui/material";

export default function UserLayout() {
  return (
    <Box>
      <Outlet />
    </Box>
  );
}
