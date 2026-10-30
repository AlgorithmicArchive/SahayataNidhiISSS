import React, { useState } from "react";
import {
  Box,
  Typography,
  IconButton,
  Popover,
  Chip,
  TextField,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Button,
} from "@mui/material";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import TextFieldsIcon from "@mui/icons-material/TextFields";
import EmailIcon from "@mui/icons-material/Email";
import ListIcon from "@mui/icons-material/List";
import CheckBoxIcon from "@mui/icons-material/CheckBox";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";

export const FIELD_TYPE_META = {
  text: { icon: <TextFieldsIcon fontSize="small" />, label: "Text answer" },
  email: { icon: <EmailIcon fontSize="small" />, label: "Email address" },
  select: { icon: <ListIcon fontSize="small" />, label: "Dropdown choice" },
  checkbox: { icon: <CheckBoxIcon fontSize="small" />, label: "Tick box" },
  file: { icon: <AttachFileIcon fontSize="small" />, label: "File upload" },
  date: { icon: <CalendarMonthIcon fontSize="small" />, label: "Date picker" },
  enclosure: {
    icon: <FolderOpenIcon fontSize="small" />,
    label: "Attachment group",
  },
};

export const TypeBadge = ({ type }) => {
  const meta = FIELD_TYPE_META[type] || FIELD_TYPE_META.text;
  return (
    <Chip
      size="small"
      icon={meta.icon}
      label={meta.label}
      sx={{
        bgcolor: "#EFF6FF",
        color: "#1D4ED8",
        fontWeight: 600,
        fontSize: "0.7rem",
        "& .MuiChip-icon": { color: "#1D4ED8" },
      }}
    />
  );
};

/* Small "?" button that explains a concept in plain words + an example */
export const HelpTip = ({ title, text, example }) => {
  const [anchor, setAnchor] = useState(null);
  return (
    <>
      <IconButton
        size="small"
        onClick={(e) => setAnchor(e.currentTarget)}
        aria-label={`Help: ${title}`}
        sx={{ p: 0.25 }}
      >
        <HelpOutlineIcon sx={{ fontSize: 16, color: "#94A3B8" }} />
      </IconButton>
      <Popover
        open={!!anchor}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        <Box sx={{ p: 2, maxWidth: 320 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            {title}
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
            {text}
          </Typography>
          {example && (
            <Typography
              variant="caption"
              sx={{
                mt: 1,
                display: "block",
                fontStyle: "italic",
                color: "#64748B",
              }}
            >
              Example: {example}
            </Typography>
          )}
        </Box>
      </Popover>
    </>
  );
};

export const WIDTH_OPTIONS = [
  { value: 12, label: "Full width" },
  { value: 6, label: "Half width" },
  { value: 4, label: "One-third width" },
];

/* Shows the citizen exactly what this field will look like on the real form */
export const FieldPreview = ({ field }) => {
  let control;
  switch (field.type) {
    case "select":
      control = (
        <TextField
          select
          fullWidth
          size="small"
          value=""
          InputProps={{ readOnly: true }}
        >
          {(field.options || []).slice(0, 4).map((o) => (
            <MenuItem key={o.value} value={o.value}>
              {o.label}
            </MenuItem>
          ))}
        </TextField>
      );
      break;
    case "checkbox":
      control = field.isConsentCheckbox ? (
        <FormControlLabel
          control={<Checkbox disabled />}
          label={
            <Typography variant="body2">
              {field.declaration || "I agree to the declaration."}
            </Typography>
          }
        />
      ) : (
        <Checkbox disabled />
      );
      break;
    case "file":
      control = (
        <Button
          variant="outlined"
          size="small"
          disabled
          startIcon={<AttachFileIcon />}
        >
          Choose file {field.accept ? `(${field.accept})` : ""}
        </Button>
      );
      break;
    case "date":
      control = (
        <TextField
          size="small"
          fullWidth
          InputProps={{ readOnly: true, placeholder: "DD/MM/YYYY" }}
        />
      );
      break;
    default:
      control = (
        <TextField
          size="small"
          fullWidth
          InputProps={{ readOnly: true, placeholder: "Citizen types here…" }}
        />
      );
  }

  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 2,
        bgcolor: "#F8FAFC",
        border: "1px dashed #CBD5E1",
      }}
    >
      <Typography
        variant="caption"
        sx={{
          color: "#64748B",
          fontWeight: 700,
          display: "block",
          mb: 1,
          letterSpacing: 0.5,
        }}
      >
        PREVIEW — WHAT THE CITIZEN SEES
      </Typography>
      <Typography
        variant="body2"
        sx={{ fontWeight: 600, mb: 1, color: "#0F172A" }}
      >
        {field.label || "Field label"}
        {field.required && <span style={{ color: "#D32F2F" }}> *</span>}
      </Typography>
      {control}
    </Box>
  );
};
