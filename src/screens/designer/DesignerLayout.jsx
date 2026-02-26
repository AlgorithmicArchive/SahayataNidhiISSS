import React from "react";
import { Outlet } from "react-router-dom";
import { Box } from "@mui/material";

export default function UserLayout() {
  return (
    <Box sx={{ minHeight: "90vh" }}>
      <Outlet />
    </Box>
  );
}
