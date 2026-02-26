import React from "react";
import {
  Box,
  Button,
  TextField,
  IconButton,
  Paper,
  Tooltip,
  Typography,
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

const SortableSection = ({
  section,
  onAddField,
  onEditSectionName,
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
    useSortable({
      id: section.id,
    });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const fieldSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleFieldDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = section.fields.findIndex((f) => f.id === active.id);
    const newIndex = section.fields.findIndex((f) => f.id === over.id);
    const newFields = arrayMove(section.fields, oldIndex, newIndex);
    onUpdateSectionFields(section.id, newFields);
  };

  return (
    <Paper
      ref={setNodeRef}
      elevation={2}
      sx={{
        mb: 3,
        p: 3,
        borderRadius: 2,
        bgcolor: "grey.50",
        border: "1px solid",
        borderColor: "grey.200",
        "&:hover": {
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          borderColor: "primary.main",
        },
        transition: "all 0.2s ease-in-out",
      }}
      style={style}
    >
      <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
        <Tooltip title="Drag to reorder">
          <IconButton
            {...attributes}
            {...listeners}
            sx={{ mr: 1, cursor: "grab" }}
          >
            <DragIndicatorIcon sx={{ color: "grey.600" }} />
          </IconButton>
        </Tooltip>
        <TextField
          value={section.section}
          onChange={(e) => {
            if (section.editable) {
              onEditSectionName(section.id, e.target.value);
            }
          }}
          fullWidth
          disabled={!section.editable}
          variant="outlined"
          size="small"
          sx={{
            "& .MuiOutlinedInput-root": {
              bgcolor: "white",
              borderRadius: 1,
              "& fieldset": { borderColor: "grey.300" },
              "&:hover fieldset": { borderColor: "primary.main" },
              "&.Mui-disabled fieldset": { borderColor: "grey.300" },
            },
            "& .MuiInputBase-input": {
              fontWeight: "bold",
              color: "grey.800",
            },
          }}
        />
        {section.editable && (
          <Box sx={{ ml: 2, display: "flex", gap: 1 }}>
            <Tooltip title="Duplicate Section">
              <IconButton
                onClick={(e) => {
                  e.stopPropagation();
                  onDuplicateSection(section.id);
                }}
                sx={{
                  bgcolor: "info.light",
                  "&:hover": { bgcolor: "info.main", color: "white" },
                  transition: "all 0.2s ease-in-out",
                }}
              >
                <ContentCopyIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Remove Section">
              <IconButton
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveSection(section.id);
                }}
                sx={{
                  bgcolor: "error.light",
                  "&:hover": { bgcolor: "error.main", color: "white" },
                  transition: "all 0.2s ease-in-out",
                }}
              >
                <DeleteIcon />
              </IconButton>
            </Tooltip>
          </Box>
        )}
      </Box>

      <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
        <Button
          variant="contained"
          size="small"
          onClick={() => onAddField(section.id)}
          startIcon={<AddIcon />}
          sx={{
            bgcolor: "primary.dark",
            color: "white",
            textTransform: "none",
            fontWeight: "bold",
            borderRadius: 1,
            "&:hover": {
              bgcolor: "primary.main",
              transform: "translateY(-2px)",
              boxShadow: "0 4px 8px rgba(0,0,0,0.2)",
            },
            transition: "all 0.2s ease-in-out",
          }}
        >
          Add Field
        </Button>
        <Button
          variant="contained"
          size="small"
          onClick={() => onAddSectionAfter(section.id)}
          startIcon={<AddCircleOutlineIcon />}
          sx={{
            bgcolor: "secondary.dark",
            color: "white",
            textTransform: "none",
            fontWeight: "bold",
            borderRadius: 1,
            "&:hover": {
              bgcolor: "secondary.main",
              transform: "translateY(-2px)",
              boxShadow: "0 4px 8px rgba(0,0,0,0.2)",
            },
            transition: "all 0.2s ease-in-out",
          }}
        >
          Add Section After
        </Button>
      </Box>

      {section.fields.length === 0 ? (
        <Typography sx={{ color: "grey.600", textAlign: "center", py: 2 }}>
          No fields added yet. Click "Add Field" to start.
        </Typography>
      ) : (
        <DndContext
          sensors={fieldSensors}
          collisionDetection={closestCenter}
          onDragEnd={handleFieldDragEnd}
        >
          <SortableContext
            items={section.fields.map((field) => field.id)}
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
