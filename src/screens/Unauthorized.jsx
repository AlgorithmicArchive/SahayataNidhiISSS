import { Container, Typography } from "@mui/material";
import React from "react";

export default function Unauthorized() {
  return (
    <Container
      sx={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Typography sx={{ fontSize: 48, fontWeight: "bold" }}>
        Unauthorized Access
      </Typography>
    </Container>
  );
}
