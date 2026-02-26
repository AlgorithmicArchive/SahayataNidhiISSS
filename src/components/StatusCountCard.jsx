import React from "react";
import {
  Card,
  CardContent,
  Typography,
  Chip,
  Box,
  Button,
  Tooltip,
} from "@mui/material";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import HourglassTopIcon from "@mui/icons-material/HourglassTop";
import SendIcon from "@mui/icons-material/Send";
import ReplayIcon from "@mui/icons-material/Replay";
import BlockIcon from "@mui/icons-material/Block";
import PersonIcon from "@mui/icons-material/Person";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ListAltIcon from "@mui/icons-material/ListAlt";

// Map status name to icon
const getStatusIcon = (statusName, textColor) => {
  switch (statusName?.toLowerCase()) {
    case "total applications":
      return <ListAltIcon sx={{ color: textColor }} />;
    case "pending":
      return <HourglassTopIcon sx={{ color: textColor }} />;
    case "forwarded":
      return <SendIcon sx={{ color: textColor }} />;
    case "returned":
      return <ReplayIcon sx={{ color: textColor }} />;
    case "rejected":
      return <BlockIcon sx={{ color: textColor }} />;
    case "pending with citizen":
      return <PersonIcon sx={{ color: textColor }} />;
    case "sanctioned":
      return <CheckCircleIcon sx={{ color: textColor }} />;
    default:
      return <ListAltIcon sx={{ color: textColor }} />;
  }
};

// Updated color palette for a sleeker look
const statusColorMap = {
  "total applications": "#e5e7eb",
  pending: "#fef3c7",
  forwarded: "#bfdbfe",
  returned: "#fed7aa",
  rejected: "#f87171",
  "pending with citizen": "#d8b4fe",
  sanctioned: "#86efac",
};

const StatusCountCard = ({
  statusName = "Pending",
  count = 0,
  onClick,
  tooltipText,
  bgColor,
  textColor = "#1f2937",
  sx = {},
}) => {
  const colorKey = statusName.toLowerCase();
  const chipColor = bgColor || statusColorMap[colorKey] || "#e5e7eb";

  return (
    <Tooltip
      title={tooltipText || statusName}
      arrow
      slotProps={{
        tooltip: {
          sx: {
            backgroundColor: "#1f2937",
            color: "#ffffff",
            fontSize: "0.875rem",
            padding: "8px 12px",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.2)",
          },
        },
        arrow: {
          sx: {
            color: "#1f2937",
          },
        },
      }}
    >
      <Card
        onClick={onClick}
        sx={{
          borderRadius: 3,
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
          p: 1.5,
          transition: "all 0.3s ease",
          cursor: onClick ? "pointer" : "default",
          "&:hover": {
            transform: "translateY(-4px)",
            boxShadow: "0 6px 16px rgba(0, 0, 0, 0.12)",
          },
          width: {
            xs: "100%",
            sm: "48%",
            md: "32%",
            lg: "90%",
          },
          bgcolor: "#ffffff",
          ...sx,
        }}
      >
        <CardContent sx={{ paddingBottom: "12px !important" }}>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            mb={1.5}
            flexWrap="wrap"
          >
            <Typography
              variant="subtitle1"
              fontWeight={500}
              sx={{
                fontSize: { xs: "0.875rem", sm: "1rem" },
                color: textColor,
                fontFamily: "'Inter', sans-serif",
              }}
            >
              {statusName}
            </Typography>

            <Chip
              label={getStatusIcon(statusName, textColor)}
              size="small"
              sx={{
                backgroundColor: chipColor,
                color: textColor,
                borderRadius: "8px",
                height: "28px",
                "& .MuiChip-label": {
                  padding: "0 8px",
                },
              }}
            />
          </Box>

          <Typography
            variant="h4"
            sx={{
              color: "#3b82f6",
              fontWeight: 600,
              fontSize: { xs: "1.75rem", sm: "2.25rem", md: "2.5rem" },
              mb: 1,
              fontFamily: "'Inter', sans-serif",
            }}
          >
            {count}
          </Typography>

          <Box display="flex" justifyContent="flex-end" alignItems="center">
            <Button
              size="small"
              endIcon={<ArrowForwardIcon />}
              sx={{
                color: "#3b82f6",
                fontWeight: 500,
                textTransform: "none",
                padding: "4px 8px",
                fontSize: "0.875rem",
                fontFamily: "'Inter', sans-serif",
                "&:hover": {
                  backgroundColor: "rgba(59, 130, 246, 0.1)",
                },
              }}
            >
              View
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Tooltip>
  );
};

export default StatusCountCard;
