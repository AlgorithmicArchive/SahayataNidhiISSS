import React, { useContext } from "react";
import { Outlet } from "react-router-dom";
import { Box } from "@mui/material";
import { UserContext } from "../../UserContext";

export default function OfficerLayout() {
  return (
    <Box>
      <Outlet />
    </Box>
  );
}
