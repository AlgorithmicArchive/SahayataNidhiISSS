import React from "react";
import { Box, Link } from "@mui/material";

/**
 * SkipToContent - GIGW mandatory accessibility feature.
 * Provides keyboard users a link to bypass repetitive navigation
 * and jump directly to the main content area.
 */
const SkipToContent = () => (
  <Link
    href="#main-content"
    sx={{
      position: "absolute",
      left: "-9999px",
      top: 0,
      zIndex: (t) => t.zIndex.tooltip + 1,
      px: 3,
      py: 1.5,
      bgcolor: "primary.main",
      color: "primary.contrastText",
      fontWeight: 600,
      borderRadius: "0 0 6px 0",
      textDecoration: "underline !important",
      "&:focus": {
        left: 0,
      },
    }}
  >
    Skip to main content | मुख्य सामग्री पर जाएँ
  </Link>
);

/**
 * PageContainer - Standard content wrapper ensuring consistent
 * page width, padding, and the <main> landmark across all pages.
 */
export const PageContainer = ({ children, sx = {} }) => (
  <Box
    component="main"
    id="main-content"
    tabIndex={-1}
    sx={{
      width: "100%",
      maxWidth: "1200px",
      mx: "auto",
      px: { xs: 2, sm: 3, md: 4 },
      py: { xs: 2, sm: 3 },
      minHeight: "60vh",
      ...sx,
    }}
  >
    {children}
  </Box>
);

export default SkipToContent;
