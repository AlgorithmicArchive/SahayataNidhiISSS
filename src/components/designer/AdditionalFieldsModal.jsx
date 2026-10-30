import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Select,
  MenuItem,
  Box,
  Typography,
  Alert,
  IconButton,
  Paper,
  Breadcrumbs,
  Link,
} from "@mui/material";
import FieldEditModal from "./FieldEditModal";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { SortableItem } from "./SortableItem";
import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/Edit";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import AddIcon from "@mui/icons-material/Add";
import { toast } from "react-toastify";

const normalizeField = (field) => ({
  id:
    field.id ||
    `field-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  type: field.type || "text",
  label: field.label || "New Field",
  name: field.name || `NewField_${Date.now()}`,
  minLength: field.minLength ?? 5,
  maxLength: field.maxLength ?? 50,
  options: Array.isArray(field.options) ? field.options : [],
  span: field.span ?? 12,
  validationFunctions: Array.isArray(field.validationFunctions)
    ? field.validationFunctions
    : [],
  transformationFunctions: Array.isArray(field.transformationFunctions)
    ? field.transformationFunctions
    : [],
  additionalFields: normalizeAdditionalFields(field.additionalFields || {}),
  accept: field.accept || "",
  editable: field.editable ?? true,
  value: field.value ?? undefined,
  dependentOn: field.dependentOn ?? undefined,
  dependentOptions: field.dependentOptions ?? undefined,
  dependentTable: field.dependentTable ?? "",
  isDependentEnclosure: field.isDependentEnclosure ?? false,
  dependentField: field.dependentField ?? undefined,
  dependentValues: Array.isArray(field.dependentValues)
    ? field.dependentValues
    : [],
  optionsType:
    field.optionsType || (field.type === "select" ? "independent" : ""),
  isConsentCheckbox: field.isConsentCheckbox || false,
  isDeclaration: field.isDeclaration || false,
  declaration: field.declaration || "",
  declarationFields: Array.isArray(field.declarationFields)
    ? field.declarationFields
    : [],
  enableValueDependency: field.enableValueDependency || false,
  valueDependentOn: field.valueDependentOn || "",
  isOfficeField:
    field.isOfficeField !== undefined ? field.isOfficeField : false,
  officeTypeId: field.officeTypeId !== undefined ? field.officeTypeId : null,
  enableConditionalVisibility: field.enableConditionalVisibility || false,
  conditionalField: field.conditionalField || "",
  conditionalValues: field.conditionalValues || [],
});

const normalizeAdditionalFields = (additionalFields) => {
  const normalized = {};
  Object.keys(additionalFields).forEach((option) => {
    normalized[option] = (additionalFields[option] || []).map((f) =>
      normalizeField(f),
    );
  });
  return normalized;
};

const AdditionalFieldsModal = ({
  sections,
  selectedField,
  onClose,
  updateField,
  onFieldUpdate,
  isNested = false,
  serviceId,
  availableFormFields = [],
}) => {
  const [localAdditionalFields, setLocalAdditionalFields] = useState(
    normalizeAdditionalFields(selectedField.additionalFields || {}),
  );
  const [selectedOption, setSelectedOption] = useState(
    selectedField.options?.length > 0 ? selectedField.options[0].value : "",
  );
  const [editingField, setEditingField] = useState(null);
  const [nestedFieldToEdit, setNestedFieldToEdit] = useState(null);
  const [activeId, setActiveId] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  useEffect(() => {
    setLocalAdditionalFields(
      normalizeAdditionalFields(selectedField.additionalFields || {}),
    );
  }, [selectedField]);

  /* 🔥 THE FIX: every change is pushed to the parent form IMMEDIATELY.
     No separate "Save" needed in this modal anymore. */
  const pushToParent = (next) => {
    setLocalAdditionalFields(next);
    const updated = {
      ...selectedField,
      additionalFields: normalizeAdditionalFields(next),
    };
    if (onFieldUpdate) onFieldUpdate(updated);
    else updateField(updated);
  };

  const addAdditionalField = () => {
    const newField = normalizeField({
      label: "New field",
      name: `NewField_${Date.now()}`,
    });
    pushToParent({
      ...localAdditionalFields,
      [selectedOption]: [
        ...(localAdditionalFields[selectedOption] || []),
        newField,
      ],
    });
    toast.info("field added — edit it or press Done when finished.", {
      position: "top-center",
      autoClose: 2000,
    });
  };

  const removeAdditionalField = (fieldId) => {
    pushToParent({
      ...localAdditionalFields,
      [selectedOption]: (localAdditionalFields[selectedOption] || []).filter(
        (f) => f.id !== fieldId,
      ),
    });
  };

  const handleSaveField = (updatedField) => {
    pushToParent({
      ...localAdditionalFields,
      [selectedOption]: (localAdditionalFields[selectedOption] || []).map(
        (f) => (f.id === updatedField.id ? normalizeField(updatedField) : f),
      ),
    });
    setEditingField(null);
  };

  const handleSaveNestedFields = (updatedNestedField) => {
    pushToParent({
      ...localAdditionalFields,
      [selectedOption]: (localAdditionalFields[selectedOption] || []).map(
        (f) => {
          if (f.id === updatedNestedField.id)
            return normalizeField(updatedNestedField);
          if (f.additionalFields) {
            return {
              ...f,
              additionalFields: Object.fromEntries(
                Object.entries(f.additionalFields).map(([opt, nested]) => [
                  opt,
                  nested.map((n) =>
                    n.id === updatedNestedField.id
                      ? normalizeField(updatedNestedField)
                      : n,
                  ),
                ]),
              ),
            };
          }
          return f;
        },
      ),
    });
    setNestedFieldToEdit(null);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;
    const current = localAdditionalFields[selectedOption] || [];
    const oldIndex = current.findIndex((f) => f.id === active.id);
    const newIndex = current.findIndex((f) => f.id === over.id);
    if (oldIndex !== -1 && newIndex !== -1) {
      pushToParent({
        ...localAdditionalFields,
        [selectedOption]: arrayMove(current, oldIndex, newIndex),
      });
    }
  };

  const activeField = activeId
    ? (localAdditionalFields[selectedOption] || []).find(
        (f) => f.id === activeId,
      )
    : null;
  const currentFields = localAdditionalFields[selectedOption] || [];

  const renderFieldItem = (field) => (
    <Paper
      elevation={0}
      sx={{
        mb: 2,
        p: 2,
        borderRadius: 2,
        bgcolor: field.isConsentCheckbox ? "#EFF6FF" : "#fff",
        border: "1px solid #E2E8F0",
      }}
    >
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 1,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <DragIndicatorIcon sx={{ color: "#94A3B8" }} />
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {field.label}{" "}
              <Typography
                component="span"
                variant="caption"
                sx={{ color: "#64748B" }}
              >
                ({field.type})
              </Typography>
              {field.isConsentCheckbox && " • consent text"}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {field.name}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button
            variant="outlined"
            size="small"
            onClick={() =>
              setEditingField({ ...field, parentOption: selectedOption })
            }
            startIcon={<EditIcon />}
            sx={{ textTransform: "none" }}
          >
            Edit
          </Button>
          <Button
            variant="outlined"
            size="small"
            onClick={() => setNestedFieldToEdit(field)}
            sx={{ textTransform: "none" }}
          >
            Sub-fields
          </Button>
          <Button
            variant="outlined"
            size="small"
            color="error"
            onClick={() => removeAdditionalField(field.id)}
            sx={{ textTransform: "none" }}
          >
            Remove
          </Button>
        </Box>
      </Box>
      {field.isConsentCheckbox && field.declaration && (
        <Box sx={{ mt: 1, p: 1, bgcolor: "#F8FAFC", borderRadius: 1 }}>
          <Typography variant="caption" sx={{ fontStyle: "italic" }}>
            Consent text: {field.declaration.substring(0, 100)}…
          </Typography>
        </Box>
      )}
    </Paper>
  );

  return (
    <Dialog open={true} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <Box>
            <Breadcrumbs sx={{ mb: 0.5 }}>
              <Typography variant="caption" color="text.secondary">
                {isNested ? "Sub-fields" : "Follow-up fields"}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {selectedField.label}
              </Typography>
              <Typography variant="caption" sx={{ fontWeight: 700 }}>
                Option: "{selectedOption}"
              </Typography>
            </Breadcrumbs>
            <Typography variant="h6">Follow-up fields</Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Alert severity="info" sx={{ mb: 2 }}>
          These extra fields appear on the citizen's form{" "}
          <b>only when they choose "{selectedOption}"</b>. Changes are applied
          instantly — just press <b>Done</b> when finished.
        </Alert>

        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          When the citizen chooses:
        </Typography>
        <Select
          fullWidth
          size="small"
          value={selectedOption}
          onChange={(e) => setSelectedOption(e.target.value)}
          sx={{ mb: 3 }}
        >
          {selectedField.options.map((item) => (
            <MenuItem key={item.value} value={item.value}>
              {item.label}
            </MenuItem>
          ))}
        </Select>

        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>
          Extra fields for "{selectedOption}" ({currentFields.length})
        </Typography>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={(e) => setActiveId(e.active.id)}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          <SortableContext
            items={currentFields.map((f) => f.id)}
            strategy={verticalListSortingStrategy}
          >
            <Box sx={{ maxHeight: 400, overflowY: "auto", pr: 1 }}>
              {currentFields.length === 0 ? (
                <Box
                  sx={{
                    textAlign: "center",
                    py: 3,
                    border: "1px dashed #CBD5E1",
                    borderRadius: 2,
                  }}
                >
                  <Typography variant="body2" sx={{ color: "#64748B" }}>
                    No extra fields yet for this option.
                  </Typography>
                </Box>
              ) : (
                currentFields.map((field) => (
                  <SortableItem key={field.id} id={field.id}>
                    {renderFieldItem(field)}
                  </SortableItem>
                ))
              )}
            </Box>
          </SortableContext>
          <DragOverlay>
            {activeField ? (
              <Paper
                elevation={4}
                sx={{
                  p: 2,
                  borderRadius: 2,
                  border: "2px solid #2562E9",
                  bgcolor: "#fff",
                  cursor: "grabbing",
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {activeField.label}
                </Typography>
              </Paper>
            ) : null}
          </DragOverlay>
        </DndContext>

        <Button
          variant="outlined"
          fullWidth
          startIcon={<AddIcon />}
          onClick={addAdditionalField}
          sx={{ mt: 2, textTransform: "none", fontWeight: 600 }}
        >
          Add extra field
        </Button>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          variant="contained"
          onClick={onClose}
          sx={{ textTransform: "none", fontWeight: 700, px: 4 }}
        >
          Done
        </Button>
      </DialogActions>

      {editingField && (
        <FieldEditModal
          selectedField={editingField}
          sections={sections}
          onClose={() => setEditingField(null)}
          updateField={handleSaveField}
          serviceId={serviceId}
          availableFormFields={availableFormFields}
        />
      )}
      {nestedFieldToEdit && (
        <AdditionalFieldsModal
          sections={sections}
          selectedField={nestedFieldToEdit}
          onClose={() => setNestedFieldToEdit(null)}
          updateField={handleSaveNestedFields}
          onFieldUpdate={onFieldUpdate}
          isNested={true}
          serviceId={serviceId}
          availableFormFields={availableFormFields}
        />
      )}
    </Dialog>
  );
};

export default AdditionalFieldsModal;
