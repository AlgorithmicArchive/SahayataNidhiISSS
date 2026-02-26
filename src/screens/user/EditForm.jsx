import { Box } from "@mui/material";
import React from "react";
import DynamicScrollableForm from "../../components/form/DynamicScrollableForm";
export default function EditForm() {
  return (
    <Box sx={{ minHeight: "100vh" }}>
      <DynamicScrollableForm mode="edit" />
    </Box>
  );
}
