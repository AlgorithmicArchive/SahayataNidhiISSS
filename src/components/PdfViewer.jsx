import React from "react";
import { Viewer } from "@react-pdf-viewer/core";
import "@react-pdf-viewer/core/lib/styles/index.css";
import CustomButton from "./CustomButton";
import { downloadFile } from "../assets/downloadFile";

const API_BASE = window.__CONFIG__?.API_URL || "";

const PdfViewer = ({ pdfUrl, path, exportButton = null, width }) => {
  return (
    <div style={{ textAlign: "center", marginTop: 50 }}>
      {exportButton && (
        <CustomButton text="Export PDF" onClick={() => downloadFile(path)} />
      )}

      <div style={{ height: "750px", width: width || "600px", margin: "0 auto" }}>
        <Viewer fileUrl={`${API_BASE}/Base/DisplayFile?filename=${pdfUrl}`} />
      </div>
    </div>
  );
};

export default PdfViewer;