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
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { SortableItem } from './SortableItem'; // Your existing SortableItem
import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/Edit";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import { toast } from "react-toastify";

// Function to normalize a field, preserving existing values INCLUDING DECLARATION
const normalizeField = (field) => {
  const normalized = {
    id: field.id || `field-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
    isDependentEnclosure: field.isDependentEnclosure ?? false,
    dependentField: field.dependentField ?? undefined,
    dependentValues: Array.isArray(field.dependentValues)
      ? field.dependentValues
      : [],
    optionsType: field.optionsType || (field.type === "select" ? "independent" : ""),
    // NEW: Declaration properties
    isConsentCheckbox: field.isConsentCheckbox || false,
    isDeclaration: field.isDeclaration || false,
    declaration: field.declaration || "",
    declarationFields: Array.isArray(field.declarationFields) ? field.declarationFields : [],
  };
  return normalized;
};

// Function to normalize additionalFields recursively
const normalizeAdditionalFields = (additionalFields) => {
  const normalized = {};
  Object.keys(additionalFields).forEach((option) => {
    normalized[option] = (additionalFields[option] || []).map((field) =>
      normalizeField(field)
    );
  });
  return normalized;
};

// Helper function to clean declaration data
const cleanDeclarationData = (fieldData) => {
  if (fieldData.isConsentCheckbox && fieldData.type === "checkbox") {
    return {
      ...fieldData,
      isConsentCheckbox: true,
      isDeclaration: true,
      declaration: fieldData.declaration || "",
      declarationFields: Array.isArray(fieldData.declarationFields)
        ? fieldData.declarationFields.map(f => ({
          id: f.id || f.name,
          name: f.name,
          label: f.label || f.name,
          type: f.type || 'text',
          required: f.required || false
        }))
        : [],
    };
  }
  return fieldData;
};

const AdditionalFieldsModal = ({
  sections,
  selectedField,
  onClose,
  updateField,
  onFieldUpdate, // NEW: Callback to parent for field updates
  isNested = false,
  serviceId,
  availableFormFields = [],
}) => {
  const [localAdditionalFields, setLocalAdditionalFields] = useState(
    normalizeAdditionalFields(selectedField.additionalFields || {})
  );
  const [selectedOption, setSelectedOption] = useState(
    selectedField.options && selectedField.options.length > 0
      ? selectedField.options[0].value
      : ""
  );
  const [editingField, setEditingField] = useState(null);
  const [nestedFieldToEdit, setNestedFieldToEdit] = useState(null);
  const [activeId, setActiveId] = useState(null);

  // Configure sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px delay before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    console.log("AdditionalFieldsModal - Initial selectedField:", {
      id: selectedField.id,
      name: selectedField.name,
      hasAdditionalFields: !!selectedField.additionalFields,
      isConsentCheckbox: selectedField.isConsentCheckbox,
      declaration: selectedField.declaration?.substring(0, 50)
    });

    setLocalAdditionalFields(
      normalizeAdditionalFields(selectedField.additionalFields || {})
    );
  }, [selectedField]);

  const handleOptionChange = (e) => {
    setSelectedOption(e.target.value);
  };

  const addAdditionalField = () => {
    const newField = {
      id: `field-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: "text",
      label: "New Field",
      name: `NewField_${Date.now()}`,
      minLength: 5,
      maxLength: 50,
      options: [],
      span: 12,
      validationFunctions: [],
      transformationFunctions: [],
      additionalFields: {},
      accept: "",
      editable: true,
      value: undefined,
      dependentOn: undefined,
      dependentOptions: undefined,
      isDependentEnclosure: false,
      dependentField: undefined,
      dependentValues: [],
      // NEW: Default declaration properties
      isConsentCheckbox: false,
      isDeclaration: false,
      declaration: "",
      declarationFields: [],
    };
    setLocalAdditionalFields((prev) => ({
      ...prev,
      [selectedOption]: prev[selectedOption]
        ? [...prev[selectedOption], newField]
        : [newField],
    }));
  };

  const removeAdditionalField = (fieldId) => {
    setLocalAdditionalFields((prev) => ({
      ...prev,
      [selectedOption]: (prev[selectedOption] || []).filter(
        (field) => field.id !== fieldId
      ),
    }));
  };

  const handleEditField = (field) => {
    console.log("Editing field in AdditionalFieldsModal:", {
      id: field.id,
      name: field.name,
      isConsentCheckbox: field.isConsentCheckbox,
      hasDeclaration: !!field.declaration
    });

    setEditingField({
      ...field,
      parentOption: selectedOption,
      // Ensure declaration properties are included
      isConsentCheckbox: field.isConsentCheckbox || false,
      isDeclaration: field.isDeclaration || false,
      declaration: field.declaration || "",
      declarationFields: Array.isArray(field.declarationFields) ? field.declarationFields : []
    });
  };

  const handleAddNestedFields = (field) => {
    setNestedFieldToEdit(field);
  };

  // UPDATED: Handle field updates with declaration data
  const handleSaveField = (updatedField) => {
    console.log("AdditionalFieldsModal - Field updated with:", {
      id: updatedField.id,
      name: updatedField.name,
      type: updatedField.type,
      isConsentCheckbox: updatedField.isConsentCheckbox,
      hasDeclaration: !!updatedField.declaration,
      declarationFieldsCount: updatedField.declarationFields?.length || 0
    });

    // Clean the field data
    const cleanedField = cleanDeclarationData(updatedField);

    setLocalAdditionalFields((prev) => {
      const updatedFields = {
        ...prev,
        [selectedOption]: (prev[selectedOption] || []).map((field) =>
          field.id === cleanedField.id ? normalizeField(cleanedField) : field
        ),
      };

      console.log("Updated localAdditionalFields after save:", {
        option: selectedOption,
        fields: updatedFields[selectedOption]?.map(f => ({
          id: f.id,
          name: f.name,
          isConsentCheckbox: f.isConsentCheckbox
        }))
      });

      return updatedFields;
    });

    // Notify parent component about the update
    if (onFieldUpdate) {
      console.log("Calling onFieldUpdate with:", cleanedField);
      onFieldUpdate(cleanedField);
    }

    setEditingField(null);
    toast.success("Field updated successfully");
  };

  const handleSaveNestedFields = (updatedNestedField) => {
    const cleanedField = cleanDeclarationData(updatedNestedField);

    setLocalAdditionalFields((prev) => {
      const updatedFields = {
        ...prev,
        [selectedOption]: (prev[selectedOption] || []).map((field) => {
          if (field.id === cleanedField.id) {
            return normalizeField(cleanedField);
          }
          if (field.additionalFields) {
            const updatedAdditionalFields = Object.fromEntries(
              Object.entries(field.additionalFields).map(
                ([option, nestedFields]) => [
                  option,
                  nestedFields.map((nestedField) =>
                    nestedField.id === cleanedField.id
                      ? normalizeField(cleanedField)
                      : nestedField
                  ),
                ]
              )
            );
            return { ...field, additionalFields: updatedAdditionalFields };
          }
          return field;
        }),
      };
      return updatedFields;
    });

    if (onFieldUpdate) {
      onFieldUpdate(cleanedField);
    }

    setNestedFieldToEdit(null);
    toast.success("Nested field updated");
  };

  // Drag and Drop handlers using @dnd-kit
  const handleDragStart = (event) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const currentFields = localAdditionalFields[selectedOption] || [];
      const oldIndex = currentFields.findIndex(
        (field) => field.id === active.id
      );
      const newIndex = currentFields.findIndex(
        (field) => field.id === over?.id
      );

      if (oldIndex !== -1 && newIndex !== -1) {
        const newFields = arrayMove(currentFields, oldIndex, newIndex);
        setLocalAdditionalFields((prev) => ({
          ...prev,
          [selectedOption]: newFields,
        }));
      }
    }

    setActiveId(null);
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  const handleSave = () => {
    const updatedAdditionalFields = normalizeAdditionalFields(
      localAdditionalFields
    );
    const updatedField = {
      ...selectedField,
      additionalFields: updatedAdditionalFields,
    };

    console.log("AdditionalFieldsModal saving final data:", {
      fieldId: updatedField.id,
      fieldName: updatedField.name,
      additionalFieldsCount: Object.keys(updatedAdditionalFields).length,
      declarationFields: Object.values(updatedAdditionalFields).flat().filter(f =>
        f.isConsentCheckbox
      ).map(f => ({
        name: f.name,
        declaration: f.declaration?.substring(0, 50)
      }))
    });

    // Use onFieldUpdate if available, otherwise use updateField
    if (onFieldUpdate) {
      onFieldUpdate(updatedField);
    } else {
      updateField(updatedField);
    }

    onClose();
    toast.success("Additional fields saved successfully");
  };

  // Get the active field for DragOverlay
  const activeField = activeId
    ? (localAdditionalFields[selectedOption] || []).find(
      (field) => field.id === activeId
    )
    : null;

  // Render a single field item
  const renderFieldItem = (field) => (
    <Paper
      elevation={1}
      sx={{
        mb: 2,
        p: 2,
        borderRadius: 1,
        backgroundColor: field.isConsentCheckbox ? 'primary.light' : 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <DragIndicatorIcon sx={{ color: 'action.active' }} />
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {field.label} ({field.type})
              {field.isConsentCheckbox && " 📝 Declaration"}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {field.name}
              {field.declaration && ` | ${field.declaration.substring(0, 50)}...`}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            size="small"
            onClick={() => handleEditField(field)}
            startIcon={<EditIcon />}
          >
            Edit
          </Button>
          <Button
            variant="outlined"
            size="small"
            onClick={() => handleAddNestedFields(field)}
          >
            Nested
          </Button>
          <Button
            variant="outlined"
            size="small"
            color="error"
            onClick={() => removeAdditionalField(field.id)}
          >
            Remove
          </Button>
        </Box>
      </Box>

      {/* Show declaration preview */}
      {field.isConsentCheckbox && field.declaration && (
        <Box sx={{ mt: 1, p: 1, bgcolor: 'background.default', borderRadius: 1 }}>
          <Typography variant="caption" sx={{ fontStyle: 'italic' }}>
            Declaration: {field.declaration.substring(0, 100)}...
          </Typography>
        </Box>
      )}

      {field.additionalFields && (
        <Box sx={{ marginLeft: 2, mt: 1 }}>
          <Typography variant="body2" sx={{ mb: 1, fontWeight: 'bold' }}>
            Nested Additional Fields:
          </Typography>
          {Object.entries(field.additionalFields).map(
            ([option, nestedFields]) => (
              <Box key={option} sx={{ mb: 1 }}>
                <Typography
                  variant="body2"
                  sx={{ fontWeight: "bold", color: 'primary.main' }}
                >
                  {option}:
                </Typography>
                {nestedFields.map((nestedField) => (
                  <Paper
                    key={nestedField.id}
                    sx={{
                      p: 1,
                      mt: 0.5,
                      ml: 2,
                      bgcolor: nestedField.isConsentCheckbox ? 'primary.light' : 'grey.50',
                    }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <Typography variant="body2">
                        {nestedField.label} ({nestedField.type})
                        {nestedField.isConsentCheckbox && " 📝"}
                      </Typography>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => handleEditField(nestedField)}
                      >
                        Edit
                      </Button>
                    </Box>
                  </Paper>
                ))}
              </Box>
            )
          )}
        </Box>
      )}
    </Paper>
  );

  return (
    <Dialog open={true} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Typography variant="h6">
            {isNested ? "Nested Additional Fields" : "Additional Properties"}
          </Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Alert severity="info" sx={{ mb: 2 }}>
          Configure additional fields that appear based on the selected action.
          Declaration checkboxes configured here will be properly saved with all declaration data.
        </Alert>

        <Typography variant="subtitle1" sx={{ mb: 2 }}>
          Select an option to configure additional fields:
        </Typography>
        <Select
          fullWidth
          margin="dense"
          value={selectedOption}
          onChange={handleOptionChange}
        >
          {selectedField.options.map((item) => (
            <MenuItem key={item.value} value={item.value}>
              {item.label}
            </MenuItem>
          ))}
        </Select>

        <Box sx={{ mt: 3 }}>
          <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold' }}>
            Additional Fields for Option: {selectedOption}
          </Typography>

          {/* Debug info */}
          {localAdditionalFields[selectedOption]?.some(f => f.isConsentCheckbox) && (
            <Alert severity="success" sx={{ mb: 2 }}>
              Contains {localAdditionalFields[selectedOption]?.filter(f => f.isConsentCheckbox).length}
              declaration field(s) with saved data
            </Alert>
          )}

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <SortableContext
              items={localAdditionalFields[selectedOption]?.map(f => f.id) || []}
              strategy={verticalListSortingStrategy}
            >
              <Box sx={{ maxHeight: '400px', overflowY: 'auto' }}>
                {(localAdditionalFields[selectedOption] || []).map(
                  (field) => (
                    <SortableItem key={field.id} id={field.id}>
                      {renderFieldItem(field)}
                    </SortableItem>
                  )
                )}
              </Box>
            </SortableContext>
            <DragOverlay>
              {activeField ? (
                <Paper
                  elevation={3}
                  sx={{
                    p: 2,
                    borderRadius: 1,
                    backgroundColor: activeField.isConsentCheckbox ? 'primary.light' : 'background.paper',
                    border: '2px solid',
                    borderColor: 'primary.main',
                    cursor: "grabbing",
                    transform: "rotate(3deg)",
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <DragIndicatorIcon sx={{ color: 'primary.main' }} />
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {activeField.label} ({activeField.type})
                      {activeField.isConsentCheckbox && " 📝 Declaration"}
                    </Typography>
                  </Box>
                </Paper>
              ) : null}
            </DragOverlay>
          </DndContext>

          <Button
            variant="contained"
            onClick={addAdditionalField}
            sx={{ mt: 2 }}
            fullWidth
          >
            Add Additional Field
          </Button>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave}>
          Save Changes
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
          onFieldUpdate={onFieldUpdate} // Pass onFieldUpdate to nested modal
          isNested={true}
          serviceId={serviceId}
          availableFormFields={availableFormFields}
        />
      )}
    </Dialog>
  );
};

export default AdditionalFieldsModal;