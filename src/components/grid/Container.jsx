// Container.jsx
import React from "react";
import { Box } from "@mui/material";

const Container = ({ children, maxWidth = "lg", ...props }) => {
  const maxWidthValue = {
    xs: "100%",
    sm: 600,
    md: 900,
    lg: 1200,
    xl: 1536,
  }[maxWidth];

  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: maxWidthValue,
        margin: "0 auto",
        padding: 2,
      }}
      {...props}
    >
      {children}
    </Box>
  );
};

export default Container;
