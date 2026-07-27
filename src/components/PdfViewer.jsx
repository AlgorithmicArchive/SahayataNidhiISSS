import React, { useState, useEffect } from "react";
import { Viewer } from "@react-pdf-viewer/core";
import "@react-pdf-viewer/core/lib/styles/index.css";
import CustomButton from "./CustomButton";
import { downloadFile } from "../assets/downloadFile";

const API_BASE = window.__CONFIG__?.API_URL || "";

const PdfViewer = ({ pdfUrl, path, exportButton = null, width }) => {
  const [fileExists, setFileExists] = useState(null);

  useEffect(() => {
    // Treat null, undefined, empty string, "NO FILES", or "NO FILE" as no document
    const isNoFile =
      !pdfUrl ||
      pdfUrl.trim() === "" ||
      pdfUrl.trim().toUpperCase() === "NO FILES" ||
      pdfUrl.trim().toUpperCase() === "NO FILE";

    if (isNoFile) {
      setFileExists(false);
      return;
    }

    const checkFile = async () => {
      try {
        const response = await fetch(
          `${API_BASE}/Base/DisplayFile?filename=${encodeURIComponent(pdfUrl)}`,
          { method: "HEAD" },
        );
        setFileExists(response.ok);
      } catch {
        setFileExists(false);
      }
    };

    checkFile();
  }, [pdfUrl]);

  if (fileExists === null) {
    return <div style={{ textAlign: "center", marginTop: 50 }}>Loading...</div>;
  }

  if (fileExists === false) {
    return (
      <div style={{ textAlign: "center", marginTop: 50 }}>
        {exportButton && (
          <CustomButton text="Export PDF" onClick={() => downloadFile(path)} />
        )}
        <div
          style={{
            height: "750px",
            width: width || "600px",
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "2px dashed #ccc",
            borderRadius: "8px",
            color: "#888",
            fontSize: "18px",
            fontWeight: "500",
          }}
        >
          NO DOCUMENT AVAILABLE
        </div>
      </div>
    );
  }

  return (
    <div style={{ textAlign: "center", marginTop: 50 }}>
      {exportButton && (
        <CustomButton text="Export PDF" onClick={() => downloadFile(path)} />
      )}

      <div
        style={{ height: "750px", width: width || "600px", margin: "0 auto" }}
      >
        <Viewer
          fileUrl={`${API_BASE}/Base/DisplayFile?filename=${encodeURIComponent(pdfUrl)}`}
        />
      </div>
    </div>
  );
};

export default PdfViewer;
