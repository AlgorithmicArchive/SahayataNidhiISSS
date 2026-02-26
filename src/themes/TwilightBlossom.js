import { createTheme } from "@mui/material/styles";

export const GovSoftTheme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#4DA8DA", // Vibrant Blue
    },
    secondary: {
      main: "#80D8C3", // Soft Teal
    },
    background: {
      default: "#F5F5F5", // Light Gray Background
      paper: "#FFFFFF", // White Paper/Card Background
    },
    text: {
      primary: "#212121", // Dark Gray for main text
      secondary: "#757575", // Medium Gray for secondary text
    },
    divider: "#E0E0E0", // Light Divider (adjusted to match background style)
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          margin: 0,
          padding: 0,
          overflowX: "hidden",
          backgroundColor: "transparent", // Ensure body background matches theme
          color: "#333333",
          fontFamily: "'Roboto', 'Segoe UI', sans-serif", // Clean, readable font
        },
        html: {
          margin: 0,
          padding: 0,
          height: "100%",
        },
        "*": {
          boxSizing: "border-box",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          boxShadow: "none",
          backgroundImage: "none",
          backgroundColor: "#F9F7F4", // Override to match soft card background
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none", // Remove uppercase transform
          borderRadius: "8px", // Smooth rounded corners
        },
      },
    },
  },
});
