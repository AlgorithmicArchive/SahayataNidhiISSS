import React from "react";
import { Col } from "react-bootstrap";
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Tooltip,
  Button,
  Chip,
} from "@mui/material";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import { TypeBadge, FieldPreview } from "./uxHelpers";

const SortableField = ({
  field,
  sectionId,
  onEditField,
  onAdditonalModal,
  onFieldChange,
  onRemoveField,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: field.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  const additionalCount = Object.values(field.additionalFields || {}).reduce(
    (n, arr) => n + (arr?.length || 0),
    0,
  );
  const supportsFollowUps =
    (field.type === "select" || field.type === "enclosure") &&
    (field.options || []).length > 0;

  return (
    <Col xs={12} md={field.span || 12}>
      <Paper
        ref={setNodeRef}
        style={style}
        elevation={0}
        sx={{
          p: 2,
          mb: 2,
          borderRadius: 2,
          border: "1px solid #E2E8F0",
          bgcolor: "#fff",
          transition: "all .2s",
          "&:hover": {
            borderColor: "#93C5FD",
            boxShadow: "0 4px 12px rgba(37,99,235,0.08)",
          },
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
          <Tooltip title="Drag to reorder this field">
            <IconButton
              size="small"
              {...attributes}
              {...listeners}
              sx={{ cursor: "grab" }}
              aria-label="Drag to reorder field"
            >
              <DragIndicatorIcon fontSize="small" sx={{ color: "#94A3B8" }} />
            </IconButton>
          </Tooltip>
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 700,
              color: "#0F172A",
              flex: 1,
              wordBreak: "break-word",
            }}
          >
            {field.label}
          </Typography>
          <TypeBadge type={field.type} />
        </Box>

        <FieldPreview field={field} />

        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            mt: 1.5,
            flexWrap: "wrap",
          }}
        >
          <Tooltip title="Change the label, answer type, rules and settings">
            <Button
              size="small"
              startIcon={<EditIcon />}
              onClick={() => onEditField(field)}
              sx={{ textTransform: "none", fontWeight: 600 }}
            >
              Edit
            </Button>
          </Tooltip>

          <Tooltip
            title={
              supportsFollowUps
                ? "Extra fields that appear ONLY when the citizen picks a specific option in this dropdown."
                : "Available only for dropdown fields that have options."
            }
          >
            <span>
              <Button
                size="small"
                variant="outlined"
                startIcon={<AccountTreeOutlinedIcon />}
                disabled={!supportsFollowUps}
                onClick={() => onAdditonalModal(field)}
                sx={{ textTransform: "none", fontWeight: 600 }}
              >
                Follow-up fields
                {additionalCount > 0 && (
                  <Chip
                    size="small"
                    label={additionalCount}
                    sx={{
                      ml: 0.75,
                      height: 18,
                      fontSize: "0.7rem",
                      bgcolor: "#10B582",
                      color: "#fff",
                      "& .MuiChip-label": { px: 1 },
                    }}
                  />
                )}
              </Button>
            </span>
          </Tooltip>

          <Tooltip title="Remove this field from the form">
            <IconButton
              size="small"
              color="error"
              onClick={() => onRemoveField(sectionId, field.id)}
              aria-label={`Remove ${field.label}`}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Paper>
    </Col>
  );
};

export default SortableField;
