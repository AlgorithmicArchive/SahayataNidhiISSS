import React from "react";
import {
  Box,
  Button,
  TextField,
  IconButton,
  Paper,
  Tooltip,
  Typography,
  FormControlLabel,
  Checkbox,
} from "@mui/material";
import { Row } from "react-bootstrap";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  DndContext,
  closestCenter,
  useSensor,
  useSensors,
  PointerSensor,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import SortableField from "./SortableField";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import AddIcon from "@mui/icons-material/Add";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteIcon from "@mui/icons-material/Delete";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import { HelpTip } from "./uxHelpers";

const SortableSection = ({
  section,
  onAddField,
  onEditSectionName,
  onToggleFullRow,
  onEditField,
  onAdditonalModal,
  onUpdateSectionFields,
  onFieldChange,
  onRemoveField,
  onDuplicateSection,
  onRemoveSection,
  onAddSectionAfter,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: section.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  const fieldSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleFieldDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = section.fields.findIndex((f) => f.id === active.id);
    const newIndex = section.fields.findIndex((f) => f.id === over.id);
    onUpdateSectionFields(
      section.id,
      arrayMove(section.fields, oldIndex, newIndex),
    );
  };

  return (
    <Paper
      ref={setNodeRef}
      style={style}
      elevation={0}
      sx={{
        mb: 3,
        p: 3,
        borderRadius: 2,
        bgcolor: "#F8FAFC",
        border: "1px solid #E2E8F0",
        transition: "all .2s",
        "&:hover": {
          borderColor: "#93C5FD",
          boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
        },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
        <Tooltip title="Drag to reorder this section">
          <IconButton
            {...attributes}
            {...listeners}
            sx={{ mr: 1, cursor: "grab" }}
          >
            <DragIndicatorIcon sx={{ color: "#94A3B8" }} />
          </IconButton>
        </Tooltip>
        <TextField
          value={section.section}
          onChange={(e) =>
            section.editable && onEditSectionName(section.id, e.target.value)
          }
          fullWidth
          disabled={!section.editable}
          variant="outlined"
          size="small"
          sx={{
            "& .MuiOutlinedInput-root": {
              bgcolor: "white",
              borderRadius: 1,
              "& fieldset": { borderColor: "#CBD5E1" },
              "&:hover fieldset": { borderColor: "#2562E9" },
            },
            "& .MuiInputBase-input": { fontWeight: 700, color: "#0F172A" },
          }}
        />
        {section.editable && (
          <Box sx={{ ml: 1, display: "flex", gap: 0.5 }}>
            <Tooltip title="Make a copy of this section with all its fields">
              <IconButton
                onClick={(e) => {
                  e.stopPropagation();
                  onDuplicateSection(section.id);
                }}
                sx={{ "&:hover": { bgcolor: "#EFF6FF", color: "#2562E9" } }}
              >
                <ContentCopyIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete this section and all its fields">
              <IconButton
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveSection(section.id);
                }}
                sx={{ "&:hover": { bgcolor: "#FEF2F2", color: "#DC2626" } }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        )}
      </Box>

      <Box
        sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 2, pl: 6 }}
      >
        <FormControlLabel
          control={
            <Checkbox
              checked={section.fullRow || false}
              onChange={() => onToggleFullRow(section.id)}
              size="small"
            />
          }
          label={
            <Typography variant="body2">
              Place this section on its own row
            </Typography>
          }
          sx={{ m: 0 }}
        />
        <HelpTip
          title="Own row"
          text="Turn this on when the section should not sit side-by-side with the next one on the citizen's form."
        />
      </Box>

      <Box sx={{ display: "flex", gap: 1, mb: 2, flexWrap: "wrap" }}>
        <Button
          variant="contained"
          size="small"
          onClick={() => onAddField(section.id)}
          startIcon={<AddIcon />}
          sx={{
            bgcolor: "#2562E9",
            textTransform: "none",
            fontWeight: 600,
            "&:hover": { bgcolor: "#1D4ED8" },
          }}
        >
          Add field
        </Button>
        <Button
          variant="outlined"
          size="small"
          onClick={() => onAddSectionAfter(section.id)}
          startIcon={<AddCircleOutlineIcon />}
          sx={{
            textTransform: "none",
            fontWeight: 600,
            borderColor: "#CBD5E1",
            color: "#334155",
            "&:hover": { borderColor: "#2562E9", color: "#2562E9" },
          }}
        >
          Insert section below
        </Button>
      </Box>

      {section.fields.length === 0 ? (
        <Box
          sx={{
            textAlign: "center",
            py: 3,
            border: "1px dashed #CBD5E1",
            borderRadius: 2,
            bgcolor: "#fff",
          }}
        >
          <Typography variant="body2" sx={{ color: "#64748B" }}>
            This section has no fields yet. Click <b>"Add field"</b> to
            create the first one.
          </Typography>
        </Box>
      ) : (
        <DndContext
          sensors={fieldSensors}
          collisionDetection={closestCenter}
          onDragEnd={handleFieldDragEnd}
        >
          <SortableContext
            items={section.fields.map((f) => f.id)}
            strategy={verticalListSortingStrategy}
          >
            <Row>
              {section.fields.map((field) => (
                <SortableField
                  key={field.id}
                  field={field}
                  sectionId={section.id}
                  onEditField={onEditField}
                  onAdditonalModal={onAdditonalModal}
                  onFieldChange={onFieldChange}
                  onRemoveField={onRemoveField}
                />
              ))}
            </Row>
          </SortableContext>
        </DndContext>
      )}
    </Paper>
  );
};

export default SortableSection;
