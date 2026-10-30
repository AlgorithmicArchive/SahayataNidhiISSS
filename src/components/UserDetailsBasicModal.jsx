import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Box, Typography, Button } from "@mui/material";
import CancelIcon from "@mui/icons-material/Cancel";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { Rnd } from "react-rnd";
import PdfViewer from "./PdfViewer";
import ServerSideTable from "./ServerSideTable";
import UserDetailsAccordion from "./UserDetailsAccordion";
import CustomButton from "./CustomButton";

// ★ Same constant PdfViewer uses — must match exactly
const API_BASE = window.__CONFIG__?.API_URL || "";

const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 600;
const GUTTER = 20;

const UserDetailsBasicModal = ({
  open,
  handleClose,
  Title,
  table,
  pdf,
  handleActionButton,
  buttonText = "",
  accordion = null,
  additionalContent = null,
  sx = {},
}) => {
  const rndRef = useRef(null);
  const [mounted, setMounted] = useState(false);
  const [size, setSize] = useState({
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
  });
  const [position, setPosition] = useState({ x: 0, y: 0 });

  // Portal only after client mount
  useEffect(() => setMounted(true), []);

  // Recompute + apply centering whenever the modal opens
  useLayoutEffect(() => {
    if (!open || !mounted || typeof window === "undefined") return;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = Math.min(DEFAULT_WIDTH, vw - GUTTER * 2);
    const h = Math.min(DEFAULT_HEIGHT, vh - GUTTER * 2);
    const x = Math.max(GUTTER, (vw - w) / 2);
    const y = Math.max(GUTTER, (vh - h) / 2);

    setSize({ width: w, height: h });
    setPosition({ x, y });

    rndRef.current?.updatePosition({ x, y });
    rndRef.current?.updateSize({ width: w, height: h });
  }, [open, mounted]);

  // Keep inside viewport on window resize
  useEffect(() => {
    if (!open || !mounted) return;
    const onResize = () => {
      setPosition((p) => ({
        x: Math.min(
          Math.max(p.x, 0),
          Math.max(0, window.innerWidth - size.width),
        ),
        y: Math.min(
          Math.max(p.y, 0),
          Math.max(0, window.innerHeight - size.height),
        ),
      }));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open, mounted, size.width, size.height]);

  if (!open || !mounted) return null;

  // Build the same URL PdfViewer uses, then open it in a new tab.
  const openPdfInNewTab = () => {
    if (!pdf) return;

    // Mirror PdfViewer's "no file" guard so the button is consistent
    const trimmed = pdf.trim();
    const isNoFile =
      trimmed === "" ||
      trimmed.toUpperCase() === "NO FILES" ||
      trimmed.toUpperCase() === "NO FILE";
    if (isNoFile) return;

    const url = `${API_BASE}/Base/DisplayFile?filename=${encodeURIComponent(pdf)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        pointerEvents: "none",
      }}
    >
      <Rnd
        ref={rndRef}
        position={position}
        size={size}
        onDragStop={(e, d) => setPosition({ x: d.x, y: d.y })}
        onResizeStop={(e, dir, el, delta, pos) => {
          setSize({ width: el.offsetWidth, height: el.offsetHeight });
          setPosition(pos);
        }}
        minWidth={400}
        minHeight={300}
        dragHandleClassName="drag-handle"
        style={{
          pointerEvents: "auto",
          boxShadow:
            "0px 11px 15px -7px rgba(0,0,0,0.2), 0px 24px 38px 3px rgba(0,0,0,0.14), 0px 9px 46px 8px rgba(0,0,0,0.12)",
          backgroundColor: "white",
          borderRadius: "8px",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <Box
          className="drag-handle"
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            p: 2,
            borderBottom: "1px solid #e0e0e0",
            cursor: "move",
            bgcolor: "#f5f5f5",
            userSelect: "none",
          }}
        >
          <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
            {Title}
          </Typography>
          <CancelIcon
            color="primary"
            onClick={handleClose}
            onMouseDown={(e) => e.stopPropagation()}
            sx={{
              cursor: "pointer",
              fontSize: "24px",
              "&:hover": { color: "error.main" },
            }}
          />
        </Box>

        <Box sx={{ flex: 1, overflowY: "auto", p: 3, ...sx }}>
          {accordion && (
            <Box sx={{ mb: 2 }}>
              <UserDetailsAccordion applicationId={accordion} />
            </Box>
          )}
          {table != null && (
            <ServerSideTable
              url={table.url}
              extraParams={table.params}
              actionFunctions={{}}
              Title={Title}
            />
          )}
          {pdf != null && (
            <Box>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "flex-end",
                  mb: 1,
                }}
              >
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<OpenInNewIcon />}
                  onClick={openPdfInNewTab}
                >
                  Open PDF in New Tab
                </Button>
              </Box>
              <PdfViewer
                pdfUrl={pdf}
                path={pdf}
                exportButton={true}
                width="100%"
              />
            </Box>
          )}
          {additionalContent && (
            <Box sx={{ mt: 2, mb: 2 }}>{additionalContent}</Box>
          )}
        </Box>

        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 2,
            p: 2,
            borderTop: "1px solid #e0e0e0",
            bgcolor: "#f9f9f9",
          }}
        >
          {handleActionButton && buttonText && (
            <CustomButton text={buttonText} onClick={handleActionButton} />
          )}
          <Button variant="outlined" onClick={handleClose}>
            Close
          </Button>
        </Box>
      </Rnd>
    </div>,
    document.body,
  );
};

export default UserDetailsBasicModal;
