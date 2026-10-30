import React from "react";
import {
  Box,
  Typography,
  Breadcrumbs,
  Link as MuiLink,
  Stack,
} from "@mui/material";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import { useNavigate, useLocation } from "react-router-dom";

/**
 * GovPageHeader - Standardized page header used on ALL pages.
 *
 * Provides (per Indian Government website / GIGW conventions):
 *  - A single, consistent H1 page title
 *  - Optional Hindi page title shown below
 *  - Breadcrumb navigation showing the page hierarchy
 *  - Consistent spacing, colors, and an optional leading icon
 *
 * Props:
 *  - title: string (required) - English page title
 *  - hindiTitle: string (optional)
 *  - subtitle: string (optional) - short description of the page purpose
 *  - crumbs: array of { label, path } - breadcrumb trail (last item is current page)
 *  - icon: ReactNode (optional) - leading section icon in a tinted square
 *  - actions: ReactNode (optional) - right-aligned action buttons
 */
const GovPageHeader = ({
  title,
  hindiTitle,
  subtitle,
  crumbs = [],
  icon,
  actions,
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Auto-generate a breadcrumb trail from the URL when none is provided
  const resolvedCrumbs =
    crumbs.length > 0
      ? crumbs
      : location.pathname
          .split("/")
          .filter(Boolean)
          .map((seg, i, arr) => ({
            label: seg.charAt(0).toUpperCase() + seg.slice(1),
            path: "/" + arr.slice(0, i + 1).join("/"),
          }));

  return (
    <Box sx={{ mb: 4 }} role="region" aria-label="Page header">
      {/* Breadcrumbs */}
      {resolvedCrumbs.length > 0 && (
        <Breadcrumbs
          separator={<NavigateNextIcon fontSize="small" />}
          aria-label="Breadcrumb"
          sx={{ mb: 2, fontSize: "0.85rem" }}
        >
          <MuiLink
            component="button"
            variant="body2"
            onClick={() => navigate("/")}
            sx={{ verticalAlign: "baseline" }}
          >
            Home
          </MuiLink>
          {resolvedCrumbs.map((crumb, i) => {
            const isLast = i === resolvedCrumbs.length - 1;
            return isLast ? (
              <Typography key={i} variant="body2" color="text.primary">
                {crumb.label}
              </Typography>
            ) : (
              <MuiLink
                key={i}
                component="button"
                variant="body2"
                onClick={() => navigate(crumb.path)}
                sx={{ verticalAlign: "baseline" }}
              >
                {crumb.label}
              </MuiLink>
            );
          })}
        </Breadcrumbs>
      )}

      <Stack
        direction={{ xs: "column", md: "row" }}
        alignItems={{ xs: "flex-start", md: "center" }}
        justifyContent="space-between"
        spacing={2}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          {icon && (
            <Box
              aria-hidden="true"
              sx={{
                width: 56,
                height: 56,
                borderRadius: 2,
                bgcolor: "#EFF6FF",
                border: "1px solid",
                borderColor: "divider",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {icon}
            </Box>
          )}
          <Box>
            {/* Single consistent H1 per page (GIGW heading hierarchy rule) */}
            <Typography
              variant="h4"
              component="h1"
              sx={{
                fontWeight: 800,
                color: "primary.dark",
                letterSpacing: "-0.5px",
                lineHeight: 1.2,
              }}
            >
              {title}
              {hindiTitle && (
                <Typography
                  component="span"
                  sx={{
                    display: "block",
                    fontSize: "1rem",
                    fontWeight: 500,
                    color: "text.secondary",
                  }}
                >
                  {hindiTitle}
                </Typography>
              )}
            </Typography>
            {subtitle && (
              <Typography
                variant="body1"
                sx={{ color: "text.secondary", mt: 0.5 }}
              >
                {subtitle}
              </Typography>
            )}
          </Box>
        </Box>

        {actions && (
          <Stack direction="row" spacing={1.5} flexShrink={0}>
            {actions}
          </Stack>
        )}
      </Stack>
    </Box>
  );
};

export default GovPageHeader;
