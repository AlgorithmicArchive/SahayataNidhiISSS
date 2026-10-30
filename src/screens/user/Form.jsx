import { Box } from "@mui/material";
import React from "react";
import DynamicScrollableForm from "../../components/form/DynamicScrollableForm";

export default function Form() {
  return (
    <Box
      sx={{
        width: "100%",
        minHeight: { xs: "180vh", lg: "90vh" }, // Use min-height to ensure at least full viewport height
        display: { xs: "flex" },
        justifyContent: { xs: "center" }, // Center content vertically
        alignItems: { xs: "center", lg: "start" }, // Center content horizontally
        boxSizing: "border-box",
        background:
          "linear-gradient(to bottom right, #f4f9ff 0%, #f9f3ec 100%)",
      }}
    >
      <DynamicScrollableForm data={{}} />
    </Box>
  );
}
