import { createTheme } from "@mui/material/styles";

/* ============================================================
   GIGW-Aligned Government Design Tokens
   - Primary: Deep Government Navy (WCAG AA on white)
   - Secondary: India Saffron (#FF9933) - used sparingly for accents
   - Success/Chakra Green (#138808)
   - All text/background pairs meet WCAG 2.1 AA contrast (>= 4.5:1)
   ============================================================ */
export const GovSoftTheme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#17418F", // Deep Government Navy (contrast on white: 8.6:1)
      dark: "#0E2A5C",
      light: "#3D63B0",
      contrastText: "#FFFFFF",
    },
    secondary: {
      main: "#C75B00", // Darkened India Saffron for AA-compliant text usage
      light: "#FF9933",
      dark: "#8A3E00",
      contrastText: "#FFFFFF",
    },
    success: {
      main: "#138808", // India Green
      contrastText: "#FFFFFF",
    },
    error: {
      main: "#B3261E",
      contrastText: "#FFFFFF",
    },
    warning: {
      main: "#9A5B00",
      contrastText: "#FFFFFF",
    },
    info: {
      main: "#0B5FA5",
      contrastText: "#FFFFFF",
    },
    background: {
      default: "#F5F7FA", // Light Gray Background
      paper: "#FFFFFF", // White Paper/Card Background
    },
    text: {
      primary: "#1A202C", // Near-black for maximum readability
      secondary: "#4A5568", // Medium Gray (AA compliant on white/light gray)
    },
    divider: "#D9E2EC",
  },
  typography: {
    fontFamily:
      "'Noto Sans', 'Roboto', 'Segoe UI', 'Noto Sans Devanagari', sans-serif",
    h1: { fontWeight: 700 },
    h2: { fontWeight: 700 },
    h3: { fontWeight: 700 },
    h4: { fontWeight: 700 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
    button: { fontWeight: 600 },
  },
  shape: { borderRadius: 6 },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          margin: 0,
          padding: 0,
          overflowX: "hidden",
          backgroundColor: "#F5F7FA",
          color: "#1A202C",
          fontFamily: "'Noto Sans', 'Roboto', 'Segoe UI', sans-serif",
          lineHeight: 1.6, // GIGW: comfortable line spacing for readability
        },
        html: {
          margin: 0,
          padding: 0,
          height: "100%",
        },
        "*": {
          boxSizing: "border-box",
        },
        /* GIGW / WCAG 2.4.7: Highly visible keyboard focus indicator */
        "a:focus-visible, button:focus-visible, [role='button']:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible, [tabindex]:focus-visible":
          {
            outline: "3px solid #FF9933",
            outlineOffset: "2px",
            borderRadius: "2px",
          },
        /* Respect user motion preferences (WCAG 2.3.3) */
        "@media (prefers-reduced-motion: reduce)": {
          "*": {
            animationDuration: "0.01ms !important",
            animationIterationCount: "1 !important",
            transitionDuration: "0.01ms !important",
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          backgroundColor: "#FFFFFF",
          border: "1px solid #D9E2EC",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none", // Sentence case per GIGW writing style
          borderRadius: "6px",
          minHeight: "44px", // Touch-target accessibility
        },
        containedPrimary: {
          "&:hover": { backgroundColor: "#0E2A5C" },
        },
      },
    },
    MuiLink: {
      styleOverrides: {
        root: {
          // GIGW: links must be distinguishable by more than color alone
          textDecoration: "underline",
          "&:hover": { textDecorationThickness: "2px" },
        },
      },
    },
    // ✅ Global autoComplete="off" for all TextField components
    MuiTextField: {
      defaultProps: {
        autoComplete: "off",
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          backgroundColor: "#17418F",
          color: "#FFFFFF",
          fontWeight: 600,
        },
      },
    },
  },
});

