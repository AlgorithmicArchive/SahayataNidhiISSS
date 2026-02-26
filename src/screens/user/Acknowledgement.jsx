import React, { useEffect, useState } from "react";
import axios from "axios";
import { fetchAcknowledgement } from "../../assets/fetch";
import { Box, CircularProgress, Typography } from "@mui/material";
import PdfViewer from "../../components/PdfViewer";
import { useLocation } from "react-router-dom";
import LoadingSpinner from "../../components/LoadingSpinner";

export default function Acknowledgement() {
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
  const [path, setPath] = useState("");
  const [loading, setLoading] = useState(true);

  const { state } = useLocation();
  const applicationId = state?.applicationId;

  useEffect(() => {
    console.log("Acknowledgement component mounted", applicationId);
    if (!applicationId) return;
    console.log("Fetching PDF for applicationId:", applicationId);
    const getPdfBlob = async () => {
      try {
        const fileName =
          applicationId.replace(/\//g, "_") + "Acknowledgement.pdf";
        console.log("Generated fileName:", fileName);
        setPath(fileName);
        setPdfBlobUrl(fileName); // or use URL.createObjectURL if needed
      } catch (error) {
        console.error("Error loading PDF:", error);
      } finally {
        setLoading(false);
      }
    };

    getPdfBlob();
  }, [applicationId]);

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
        padding: 3,
        marginTop: "100px",
        width: "100%",
      }}
    >
      {loading ? (
        <Box
          sx={{
            width: "100%",
            height: "100vh",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            bgcolor: "#f8f9fa",
          }}
        >
          <CircularProgress size={60} />
        </Box>
      ) : (
        <>
          <Typography variant="h2" gutterBottom>
            Acknowledgement
          </Typography>
          {pdfBlobUrl ? (
            <Box sx={{ width: "80%" }}>
              <PdfViewer
                pdfUrl={pdfBlobUrl}
                path={path}
                exportButton={true}
                width={"80%"}
              />
            </Box>
          ) : (
            <Typography variant="body1">Unable to load PDF.</Typography>
          )}
        </>
      )}
    </Box>
  );
}
