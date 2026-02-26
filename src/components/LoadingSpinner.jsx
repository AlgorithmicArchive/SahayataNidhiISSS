import { Box } from "@mui/material";
import React from "react";
import { Puff, TailSpin } from "react-loader-spinner";

const LoadingSpinner = () => {
  return (
    <Box
      sx={{
        backgroundColor: "background.default",
        position: "fixed",
        top: "0",
        left: "0",
        zIndex: 1000,
        opacity: 0.7,
        width: "100%",
        height: "100%",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <TailSpin color="#00BFFF" height={500} width={"100%"} visible={true} />
    </Box>
  );
};

export default LoadingSpinner;
