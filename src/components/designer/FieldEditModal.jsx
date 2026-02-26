import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  Typography,
  Button,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  FormControl,
  InputLabel,
  Box,
  Autocomplete,
  Chip,
  IconButton,
  Paper,
  Tooltip,
  Alert,
  CircularProgress,
  Grid,
  Radio,
  RadioGroup,
} from "@mui/material";
import {
  validationFunctionsList,
  transformationFunctionsList,
} from "../../assets/formvalidations";
import axiosInstance from "../../axiosConfig";
import { toast } from "react-toastify";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import CloseIcon from "@mui/icons-material/Close";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import SearchIcon from "@mui/icons-material/Search";

// Async function to fetch districts (unchanged)
const fetchDistricts = async () => {
  try {
    const response = await axiosInstance.get("/Base/GetDistricts");
    const data = await response.data;
    if (data.status) {
      return data.districts;
    }
    return [];
  } catch (error) {
    console.error("Error fetching districts:", error);
    return [];
  }
};

// Utility function to collect selectable fields
const getSelectableFields = (sections = [], actionForm = []) => {
  const selectableFields = [];
  const processFields = (fields, parentLabel = "", parentFieldName = "") => {
    fields.forEach((field) => {
      // Exclude fields related to "Can Withhold"
      if (
        field.name?.toLowerCase().includes("withhold") ||
        field.label?.toLowerCase().includes("withhold")
      ) {
        return;
      }
      selectableFields.push({
        id: field.name,
        label: parentLabel ? `${parentLabel} > ${field.label}` : field.label,
        options: field.options || [],
        isAdditional: !!parentFieldName,
        type: field.type,
        parentFieldName: parentFieldName || undefined,
      });
      if (field.additionalFields) {
        Object.values(field.additionalFields).forEach(
          (additionalFieldArray) => {
            processFields(
              additionalFieldArray,
              parentLabel ? `${parentLabel} > ${field.label}` : field.label,
              field.name,
            );
          },
        );
      }
    });
  };
  if (sections?.length > 0) {
    sections.forEach((section) => processFields(section.fields || []));
  }
  if (actionForm?.length > 0) {
    processFields(actionForm);
  }
  return selectableFields.filter((field) => !field.id.includes("District"));
};

// Fetch form fields from API
const fetchFormFieldsFromAPI = async (serviceId) => {
  if (!serviceId) return [];

  try {
    console.log("Fetching form fields from API for service:", serviceId);
    const response = await axiosInstance.get(`/Designer/GetFormElements`, {
      params: { serviceId }
    });

    console.log("API Response:", response.data);

    if (response.data.status && response.data.sections) {
      const allFields = [];
      response.data.sections.forEach(section => {
        if (section.fields && Array.isArray(section.fields)) {
          section.fields.forEach(field => {
            if (field.name && field.label) {
              allFields.push({
                id: field.name,
                name: field.name,
                label: field.label,
                type: field.type || 'text'
              });
            }
          });
        }
      });
      console.log("Extracted form fields:", allFields);
      return allFields;
    }
    return [];
  } catch (error) {
    console.error("Error fetching form fields:", error);
    toast.error("Failed to load form fields");
    return [];
  }
};

// Helper function to clean declaration data
const cleanDeclarationData = (fieldData) => {
  if (fieldData.isConsentCheckbox && fieldData.type === "checkbox") {
    // Ensure declaration fields is always an array
    const cleanedFields = Array.isArray(fieldData.declarationFields)
      ? fieldData.declarationFields
      : [];

    // Clean each field object
    const sanitizedFields = cleanedFields.map(field => ({
      id: field.id || field.name,
      name: field.name,
      label: field.label || field.name,
      type: field.type || 'text',
      required: field.required || false,
      source: field.source || 'form_designer'
    }));

    return {
      ...fieldData,
      declarationFields: sanitizedFields,
      declaration: fieldData.declaration || "",
      isDeclaration: true
    };
  }
  return fieldData;
};

// Predefined declaration templates
const DECLARATION_TEMPLATES = [
  {
    id: 1,
    name: "Standard Declaration",
    template: "I hereby declare that the information provided in this application is true, correct and complete to the best of my knowledge and belief."
  },
  {
    id: 2,
    name: "Detailed Declaration",
    template: "I hereby solemnly declare that the particulars furnished by me in this application form are true and correct to the best of my knowledge and belief. I understand that any false information provided may lead to rejection of my application and legal action as per applicable laws."
  },
  {
    id: 3,
    name: "Short Declaration",
    template: "I declare that all information provided herein is accurate and complete."
  },
  {
    id: 4,
    name: "Legal Declaration",
    template: "I do hereby declare that the statements made in this application are true, complete and correct to the best of my knowledge and belief. I am aware that if any of the statements are found to be false or misleading, I will be subject to legal consequences as per prevailing laws."
  },
  {
    id: 5,
    name: "Customizable Declaration",
    template: "I hereby declare that {field1}, {field2} and all other information provided is true to the best of my knowledge."
  }
];

// Declaration Configuration Component - RESTORED ORIGINAL DESIGN
const DeclarationConfiguration = ({
  formData,
  setFormData,
  serviceId,
  allAvailableFields = []
}) => {
  const [declarationFields, setDeclarationFields] = useState(formData.declarationFields || []);
  const [declarationText, setDeclarationText] = useState(formData.declaration || "");
  const [availableFields, setAvailableFields] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [declarationOption, setDeclarationOption] = useState(
    formData.declaration ? (DECLARATION_TEMPLATES.some(t => t.template === formData.declaration) ? "template" : "custom") : "template"
  );

  // Filter out fields that are already selected
  useEffect(() => {
    const usedFieldIds = new Set(declarationFields.map(f => f.id));
    const filteredFields = allAvailableFields
      .filter(f => f && !usedFieldIds.has(f.id))
      .map(f => ({
        id: f.id,
        name: f.name,
        label: f.label || f.name,
        type: f.type || 'text',
        source: f.source || 'form_designer'
      }));

    setAvailableFields(filteredFields);
  }, [allAvailableFields, declarationFields]);

  // Update parent form data when declaration changes
  useEffect(() => {
    if (formData.isConsentCheckbox) {
      setFormData(prev => ({
        ...prev,
        declarationFields: declarationFields,
        declaration: declarationText,
        isDeclaration: true
      }));
    }
  }, [declarationFields, declarationText, setFormData, formData.isConsentCheckbox]);

  // Handle template selection
  const handleTemplateSelect = (template) => {
    setSelectedTemplate(template);
    setDeclarationText(template.template);
    setDeclarationOption("template");
  };

  // Handle custom declaration change
  const handleCustomDeclarationChange = (text) => {
    setDeclarationText(text);
    setSelectedTemplate(null);
    setDeclarationOption("custom");
  };

  // Handle adding a field to declaration
  const handleAddField = (field) => {
    if (field) {
      const fieldData = allAvailableFields.find(f => f.id === field.id);
      if (fieldData) {
        const newField = {
          id: fieldData.id,
          name: fieldData.name,
          label: fieldData.label || fieldData.name,
          type: fieldData.type || 'text',
          source: fieldData.source || 'form_designer',
          required: false
        };

        const updatedFields = [...declarationFields, newField];
        setDeclarationFields(updatedFields);

        // Add placeholder to declaration text if using custom
        if (declarationOption === "custom") {
          const newText = declarationText + (declarationText.endsWith(' ') ? '' : ' ') + `{${fieldData.name}}`;
          setDeclarationText(newText);
        }
      }
    }
  };

  // Handle removing a field from declaration
  const handleRemoveField = (fieldId) => {
    const updatedFields = declarationFields.filter(field => field.id !== fieldId);
    setDeclarationFields(updatedFields);

    // Remove placeholder from declaration text if using custom
    if (declarationOption === "custom") {
      const regex = new RegExp(`\\{${fieldId}\\}`, 'g');
      const newText = declarationText.replace(regex, '').replace(/\s+/g, ' ').trim();
      setDeclarationText(newText);
    }
  };

  // Handle adding placeholder to custom text
  const handleAddPlaceholder = (fieldName) => {
    const newText = declarationText + (declarationText.endsWith(' ') ? '' : ' ') + `{${fieldName}}`;
    setDeclarationText(newText);
    setDeclarationOption("custom");
  };

  // Filter available fields based on search
  const filteredFields = availableFields.filter(field =>
    field.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    field.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Box sx={{ mt: 2, p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper' }}>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: 'primary.main' }}>
        📝 Declaration Configuration
      </Typography>

      {/* Service Info */}
      {serviceId && (
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2">
            Select fields from the service form to include in the declaration. Fields will appear as {`{fieldName}`} placeholders.
          </Typography>
        </Alert>
      )}

      {/* Declaration Type Selection */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
          Declaration Type
        </Typography>
        <RadioGroup
          value={declarationOption}
          onChange={(e) => setDeclarationOption(e.target.value)}
          row
        >
          <FormControlLabel value="template" control={<Radio />} label="Use Template" />
          <FormControlLabel value="custom" control={<Radio />} label="Custom Declaration" />
        </RadioGroup>
      </Box>

      {/* Template Selection */}
      {declarationOption === "template" && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
            Select a Template
          </Typography>
          <Grid container spacing={2}>
            {DECLARATION_TEMPLATES.map((template) => (
              <Grid item xs={12} key={template.id}>
                <Paper
                  elevation={selectedTemplate?.id === template.id ? 3 : 1}
                  sx={{
                    p: 2,
                    cursor: 'pointer',
                    border: selectedTemplate?.id === template.id ? '2px solid' : '1px solid',
                    borderColor: selectedTemplate?.id === template.id ? 'primary.main' : 'divider',
                    bgcolor: selectedTemplate?.id === template.id ? 'primary.light' : 'background.paper',
                    '&:hover': {
                      borderColor: 'primary.main',
                      bgcolor: 'primary.light'
                    }
                  }}
                  onClick={() => handleTemplateSelect(template)}
                >
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                    {template.name}
                  </Typography>
                  <Typography variant="body2" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
                    {template.template}
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* Field Selection */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
          Add Form Fields to Declaration
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <SearchIcon sx={{ mr: 1, color: 'action.active' }} />
          <TextField
            fullWidth
            size="small"
            placeholder="Search form fields..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            variant="outlined"
          />
        </Box>

        {allAvailableFields.length > 0 ? (
          <>
            {filteredFields.length > 0 ? (
              <Paper sx={{ maxHeight: 200, overflow: 'auto', p: 1, mb: 2 }}>
                {filteredFields.slice(0, 10).map((field) => (
                  <Box
                    key={field.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      p: 1,
                      mb: 0.5,
                      borderRadius: 1,
                      bgcolor: 'grey.50',
                      '&:hover': { bgcolor: 'grey.100' }
                    }}
                  >
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {field.label}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {field.name} • {field.type}
                      </Typography>
                    </Box>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => handleAddField(field)}
                    >
                      Add
                    </Button>
                  </Box>
                ))}
              </Paper>
            ) : (
              <Paper sx={{ p: 2, bgcolor: 'warning.light', mb: 2 }}>
                <Typography variant="body2">
                  No matching fields found. Try a different search term.
                </Typography>
              </Paper>
            )}

            {/* Quick add chips */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" sx={{ display: 'block', mb: 1, fontWeight: 600 }}>
                Quick Add Common Fields:
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {availableFields
                  .filter(f => ['name', 'address', 'email', 'phone', 'dob'].some(
                    term => f.name.toLowerCase().includes(term) || f.label.toLowerCase().includes(term)
                  ))
                  .slice(0, 8)
                  .map((field) => (
                    <Chip
                      key={field.id}
                      label={field.label}
                      size="small"
                      variant="outlined"
                      onClick={() => handleAddField(field)}
                      sx={{ cursor: 'pointer' }}
                    />
                  ))}
              </Box>
            </Box>
          </>
        ) : (
          <Paper sx={{ p: 2, bgcolor: 'warning.light', mb: 2 }}>
            <Typography variant="body2">
              {serviceId ?
                "No form fields available. The service might not have any form fields configured."
                : "Please select a service first to load form fields."}
            </Typography>
          </Paper>
        )}
      </Box>

      {/* Selected Fields */}
      {declarationFields.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
            Selected Fields ({declarationFields.length})
          </Typography>
          <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
            <Grid container spacing={1}>
              {declarationFields.map((field) => (
                <Grid item key={field.id}>
                  <Chip
                    label={`${field.label} ({${field.name}})`}
                    onDelete={() => handleRemoveField(field.id)}
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                </Grid>
              ))}
            </Grid>
          </Paper>
        </Box>
      )}

      {/* Declaration Text Editor */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
          {declarationOption === "template" ? "Selected Declaration" : "Custom Declaration"}
        </Typography>
        <TextField
          fullWidth
          multiline
          rows={4}
          value={declarationText}
          onChange={(e) => handleCustomDeclarationChange(e.target.value)}
          placeholder="Enter your declaration text here. Use {fieldName} to insert field placeholders."
          sx={{ mb: 1 }}
        />
        <Typography variant="caption" color="text.secondary">
          Tip: Use {`{fieldName}`} placeholders for selected fields. Click on field chips above to insert.
        </Typography>
      </Box>

      {/* Quick Placeholder Insert */}
      {declarationFields.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="caption" sx={{ display: 'block', mb: 1, fontWeight: 600 }}>
            Quick Insert Placeholders:
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {declarationFields.map((field) => (
              <Chip
                key={field.id}
                label={`{${field.name}}`}
                size="small"
                onClick={() => handleAddPlaceholder(field.name)}
                sx={{ cursor: 'pointer' }}
              />
            ))}
          </Box>
        </Box>
      )}

      {/* Preview */}
      <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.100', borderRadius: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
          Preview:
        </Typography>
        <Paper sx={{ p: 3, bgcolor: 'white' }}>
          <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
            {declarationFields.reduce((text, field) => {
              return text.replace(
                new RegExp(`\\{${field.name}\\}`, 'g'),
                `<strong>[${field.label}]</strong>`
              );
            }, declarationText)}
          </Typography>
        </Paper>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          {`{fieldName}`} placeholders will be replaced with actual input fields at runtime
        </Typography>
      </Box>
    </Box>
  );
};

const FieldEditModal = ({
  selectedField,
  sections = [],
  actionForm = [],
  onClose,
  updateField,
  serviceId,
  availableFormFields = [],
}) => {
  const [dependentOn, setDependentOn] = useState(
    selectedField?.dependentOn || "",
  );
  const [formData, setFormData] = useState({
    id: selectedField?.id || `field-${Date.now()}`,
    type: selectedField?.type || "text",
    label: selectedField?.label || "New Field",
    name: selectedField?.name || `NewField_${Date.now()}`,
    minLength: selectedField?.minLength ?? 5,
    maxLength: selectedField?.maxLength ?? 50,
    options: Array.isArray(selectedField?.options) ? selectedField.options : [],
    span: selectedField?.span ?? 12,
    validationFunctions: Array.isArray(selectedField?.validationFunctions)
      ? selectedField.validationFunctions
      : [],
    transformationFunctions: Array.isArray(
      selectedField?.transformationFunctions,
    )
      ? selectedField.transformationFunctions
      : [],
    accept: selectedField?.accept || "",
    editable: selectedField?.editable ?? true,
    value: selectedField?.value ?? undefined,
    optionsType:
      selectedField?.optionsType ||
      (selectedField?.type === "select" ? "independent" : ""),
    dependentOn: selectedField?.dependentOn || "",
    dependentOptions: selectedField?.dependentOptions || {},
    isDependentEnclosure: selectedField?.isDependentEnclosure || false,
    dependentField: selectedField?.dependentField || "",
    dependentValues: selectedField?.dependentValues || [],
    checkboxLayout: selectedField?.checkboxLayout || "vertical",
    isConsentCheckbox: selectedField?.isConsentCheckbox ?? false,
    declaration: selectedField?.declaration || "",
    required: selectedField?.required ?? false,
    isCheckboxDependent: selectedField?.isCheckboxDependent ?? false,
    checkboxDependentOn: selectedField?.checkboxDependentOn || "",
    checkboxDependentValue: selectedField?.checkboxDependentValue || "",
    isDeclaration: selectedField?.isDeclaration || false,
    declarationFields: Array.isArray(selectedField?.declarationFields)
      ? selectedField.declarationFields
      : [],
  });

  const [optionInputText, setOptionInputText] = useState(
    formData.options.map((opt) => opt.label).join(";"),
  );
  const initialIsDependentMaxLength =
    typeof selectedField?.maxLength === "object" &&
    selectedField?.maxLength?.dependentOn;
  const [isDependentMaxLength, setIsDependentMaxLength] = useState(
    initialIsDependentMaxLength,
  );

  const [dependentOptionInputs, setDependentOptionInputs] = useState({});
  const [availableFields, setAvailableFields] = useState(availableFormFields);
  const [isFetchingFormFields, setIsFetchingFormFields] = useState(false);

  const isWorkflowContext = sections.length === 0 && actionForm.length > 0;
  const selectableFields = getSelectableFields(sections, actionForm);
  const filteredSelectableFields = selectableFields.filter(
    (field) => field.id !== selectedField?.name,
  );

  // Fetch form fields if not provided by parent
  useEffect(() => {
    async function fetchFields() {
      if (serviceId && availableFormFields.length === 0) {
        setIsFetchingFormFields(true);
        const fields = await fetchFormFieldsFromAPI(serviceId);
        setAvailableFields(fields);
        setIsFetchingFormFields(false);
      } else if (availableFormFields.length > 0) {
        setAvailableFields(availableFormFields);
      }
    }
    fetchFields();
  }, [serviceId, availableFormFields]);

  // Handle declaration data when consent checkbox changes
  useEffect(() => {
    if (!formData.isConsentCheckbox && formData.type === "checkbox") {
      setFormData((prev) => ({
        ...prev,
        declaration: "",
        isDeclaration: false,
        declarationFields: [],
      }));
    } else if (formData.isConsentCheckbox && formData.type === "checkbox") {
      setFormData((prev) => ({
        ...prev,
        isDeclaration: true,
      }));
    }
  }, [formData.isConsentCheckbox, formData.type]);

  const handleDistrictCheckboxChange = async (e) => {
    const checked = e.target.checked;
    if (checked) {
      const districts = await fetchDistricts();
      const districtOptions = districts.map((d) => ({
        value: d.districtId,
        label: d.districtName,
      }));
      setFormData((prev) => ({
        ...prev,
        options: [
          { value: "Please Select", label: "Please Select" },
          ...districtOptions,
        ],
        optionsType: "independent",
      }));
      setOptionInputText(districtOptions.map((opt) => opt.label).join(";"));
    } else {
      setFormData((prev) => ({ ...prev, options: [], optionsType: "" }));
      setOptionInputText("");
    }
  };

  const validateField = (fieldData) => {
    if (
      fieldData.label?.toLowerCase().includes("withhold") ||
      fieldData.name?.toLowerCase().includes("withhold")
    ) {
      toast.error("Field label or name cannot include 'withhold'.");
      return false;
    }
    return true;
  };

  const saveChanges = () => {
    if (!validateField(formData)) {
      return;
    }

    // Clean and prepare the field object
    let finalFormData = {
      ...formData,
      options: formData.isConsentCheckbox ? [] : formData.options,
      optionsType: formData.isConsentCheckbox ? "" : formData.optionsType,
      dependentOn: formData.isConsentCheckbox ? "" : formData.dependentOn,
      dependentOptions: formData.isConsentCheckbox ? {} : formData.dependentOptions,
      isCheckboxDependent:
        formData.type === "checkbox" ? formData.isCheckboxDependent : false,
      checkboxDependentOn:
        formData.type === "checkbox" && formData.isCheckboxDependent
          ? formData.checkboxDependentOn
          : "",
      checkboxDependentValue:
        formData.type === "checkbox" && formData.isCheckboxDependent
          ? formData.checkboxDependentValue
          : "",
    };

    // Only include declaration data for consent checkboxes
    if (formData.type === "checkbox" && formData.isConsentCheckbox) {
      finalFormData = {
        ...finalFormData,
        isDeclaration: true,
        declaration: formData.declaration || "",
        declarationFields: Array.isArray(formData.declarationFields)
          ? formData.declarationFields
          : [],
      };
    } else {
      delete finalFormData.declaration;
      delete finalFormData.declarationFields;
      delete finalFormData.isDeclaration;
    }

    // Clean up any empty arrays or undefined values
    if (finalFormData.declarationFields && finalFormData.declarationFields.length === 0) {
      delete finalFormData.declarationFields;
    }

    if (!finalFormData.declaration || finalFormData.declaration.trim() === '') {
      delete finalFormData.declaration;
    }

    // Apply final cleaning
    finalFormData = cleanDeclarationData(finalFormData);

    console.log("Saving field with declaration data:", {
      name: finalFormData.name,
      hasDeclaration: !!finalFormData.declaration,
      declarationLength: finalFormData.declaration?.length || 0,
      declarationFieldsCount: finalFormData.declarationFields?.length || 0
    });

    updateField(finalFormData);
    onClose();
  };

  return (
    <Dialog
      open={true}
      onClose={onClose}
      aria-labelledby="form-dialog-title"
      PaperProps={{ style: { width: '90%', maxWidth: 800 } }}
    >
      <DialogTitle id="form-dialog-title">Edit Field Properties</DialogTitle>
      <DialogContent>
        {filteredSelectableFields.length === 0 &&
          (formData.type === "select" || formData.type === "checkbox") && (
            <Typography color="error" sx={{ marginBottom: 2 }}>
              No fields available for dependency. Please ensure the form
              contains other fields.
            </Typography>
          )}
        <TextField
          fullWidth
          label="Field Label"
          value={formData.label}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, label: e.target.value }))
          }
          margin="dense"
        />
        <TextField
          fullWidth
          label="Field Name"
          value={formData.name}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, name: e.target.value }))
          }
          margin="dense"
        />
        <TextField
          fullWidth
          label="Minimum Length"
          type="number"
          value={formData.minLength}
          onChange={(e) =>
            setFormData((prev) => ({
              ...prev,
              minLength: parseInt(e.target.value, 10) || 0,
            }))
          }
          margin="dense"
        />
        <Box sx={{ marginTop: 2 }}>
          <Typography variant="body2">Maximum Length</Typography>
          {!isWorkflowContext && (
            <FormControlLabel
              control={
                <Checkbox
                  checked={isDependentMaxLength}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setIsDependentMaxLength(checked);
                    setFormData((prev) => ({
                      ...prev,
                      maxLength: checked ? { dependentOn: "" } : 50,
                    }));
                  }}
                />
              }
              label="Dependent Maximum Length"
            />
          )}
          {isDependentMaxLength && !isWorkflowContext ? (
            <>
              <FormControl fullWidth margin="dense">
                <InputLabel id="maxLength-dependent-on-label">
                  Dependent Field
                </InputLabel>
                <Select
                  labelId="maxLength-dependent-on-label"
                  value={formData.maxLength.dependentOn || ""}
                  label="Dependent Field"
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      maxLength: {
                        ...prev.maxLength,
                        dependentOn: e.target.value,
                      },
                    }))
                  }
                >
                  <MenuItem value="">
                    <em>Select a field</em>
                  </MenuItem>
                  {filteredSelectableFields.map((field) => (
                    <MenuItem key={field.id} value={field.id}>
                      {field.label} ({field.type})
                      {field.isAdditional && " [Additional]"}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              {formData.maxLength.dependentOn && (
                <>
                  {(() => {
                    const dependentFieldId = formData.maxLength.dependentOn;
                    const selectedField = selectableFields.find(
                      (field) => field.id === dependentFieldId,
                    );
                    if (selectedField?.options?.length > 0) {
                      return selectedField.options.map((option) => (
                        <TextField
                          key={option.value}
                          fullWidth
                          label={`Maximum Length for ${option.label}`}
                          type="number"
                          value={formData.maxLength?.[option.value] || ""}
                          onChange={(e) => {
                            const newValue = parseInt(e.target.value, 10) || 0;
                            setFormData((prev) => ({
                              ...prev,
                              maxLength: {
                                ...prev.maxLength,
                                [option.value]: newValue,
                              },
                            }));
                          }}
                          margin="dense"
                        />
                      ));
                    }
                    return (
                      <TextField
                        fullWidth
                        label="Maximum Length Condition"
                        value={formData.maxLength?.condition || ""}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            maxLength: {
                              ...prev.maxLength,
                              condition: e.target.value,
                            },
                          }))
                        }
                        margin="dense"
                        placeholder="e.g., 'Not empty' for text fields"
                      />
                    );
                  })()}
                </>
              )}
            </>
          ) : (
            <TextField
              fullWidth
              label="Maximum Length"
              type="number"
              value={formData.maxLength}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  maxLength: parseInt(e.target.value, 10) || 50,
                }))
              }
              margin="dense"
            />
          )}
        </Box>
        <TextField
          fullWidth
          label="Span (Grid)"
          type="number"
          value={formData.span}
          onChange={(e) =>
            setFormData((prev) => ({
              ...prev,
              span: parseInt(e.target.value, 10) || 12,
            }))
          }
          margin="dense"
        />
        <Typography variant="body2" sx={{ marginTop: 1 }}>
          Field Type
        </Typography>
        <FormControl fullWidth margin="dense">
          <InputLabel id="field-type-label">Field Type</InputLabel>
          <Select
            labelId="field-type-label"
            value={formData.type}
            label="Field Type"
            onChange={(e) => {
              const newType = e.target.value;
              setFormData((prev) => ({
                ...prev,
                type: newType,
                options:
                  newType === "select"
                    ? [{ value: "Please Select", label: "Please Select" }]
                    : [],
                optionsType: newType === "select" ? "independent" : "",
                isConsentCheckbox:
                  newType === "checkbox" ? prev.isConsentCheckbox : false,
                declaration:
                  newType === "checkbox" && prev.isConsentCheckbox
                    ? prev.declaration
                    : "",
                isDeclaration:
                  newType === "checkbox" && prev.isConsentCheckbox
                    ? prev.isDeclaration
                    : false,
                declarationFields:
                  newType === "checkbox" && prev.isConsentCheckbox
                    ? prev.declarationFields
                    : [],
                accept:
                  newType === "file" ||
                    (newType === "select" && prev.isDependentEnclosure)
                    ? prev.accept
                    : "",
                isCheckboxDependent:
                  newType === "checkbox" ? prev.isCheckboxDependent : false,
                checkboxDependentOn:
                  newType === "checkbox" ? prev.checkboxDependentOn : "",
                checkboxDependentValue:
                  newType === "checkbox" ? prev.checkboxDependentValue : "",
              }));
            }}
          >
            <MenuItem value="text">Text</MenuItem>
            <MenuItem value="email">Email</MenuItem>
            <MenuItem value="select">Select</MenuItem>
            <MenuItem value="checkbox">Checkbox</MenuItem>
            <MenuItem value="file">File</MenuItem>
            <MenuItem value="date">Date</MenuItem>
            <MenuItem value="enclosure">Enclosure</MenuItem>
          </Select>
        </FormControl>

        {/* Checkbox-specific configuration */}
        {formData.type === "checkbox" && (
          <>
            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.isConsentCheckbox}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setFormData((prev) => ({
                      ...prev,
                      isConsentCheckbox: checked,
                      options: checked ? [] : prev.options,
                      optionsType: checked ? "" : prev.optionsType,
                      dependentOn: checked ? "" : prev.dependentOn,
                      dependentOptions: checked ? {} : prev.dependentOptions,
                      declaration: checked ? prev.declaration : "",
                      isDeclaration: checked,
                      declarationFields: checked ? prev.declarationFields : [],
                    }));
                    if (checked) {
                      setOptionInputText("");
                      setDependentOn("");
                    }
                  }}
                />
              }
              label="Single Consent Checkbox (True/False)"
            />

            {/* Declaration Configuration for Consent Checkbox */}
            {formData.isConsentCheckbox && (
              <>
                <DeclarationConfiguration
                  formData={formData}
                  setFormData={setFormData}
                  serviceId={serviceId}
                  allAvailableFields={availableFields}
                />
                {isFetchingFormFields && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
                    <CircularProgress size={16} />
                    <Typography variant="caption">Loading form fields...</Typography>
                  </Box>
                )}
              </>
            )}

            {/* Checkbox Dependency Configuration */}
            {!isWorkflowContext && (
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.isCheckboxDependent}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setFormData((prev) => ({
                        ...prev,
                        isCheckboxDependent: checked,
                        checkboxDependentOn: checked
                          ? prev.checkboxDependentOn
                          : "",
                        checkboxDependentValue: checked
                          ? prev.checkboxDependentValue
                          : "",
                      }));
                    }}
                  />
                }
                label="Make Checkbox Dependent on Another Field"
              />
            )}

            {/* Checkbox Dependency Fields */}
            {formData.isCheckboxDependent && !isWorkflowContext && (
              <>
                <FormControl fullWidth margin="dense">
                  <InputLabel id="checkbox-dependent-on-label">
                    Dependent On Field
                  </InputLabel>
                  <Select
                    labelId="checkbox-dependent-on-label"
                    value={formData.checkboxDependentOn}
                    label="Dependent On Field"
                    onChange={(e) => {
                      const newDependentOn = e.target.value;
                      setFormData((prev) => ({
                        ...prev,
                        checkboxDependentOn: newDependentOn,
                        checkboxDependentValue: "", // Reset dependent value when field changes
                      }));
                    }}
                  >
                    <MenuItem value="">
                      <em>Select a field</em>
                    </MenuItem>
                    {filteredSelectableFields
                      .filter((field) => field.type === "select") // Only show select fields
                      .map((field) => (
                        <MenuItem key={field.id} value={field.id}>
                          {field.label} ({field.type})
                          {field.isAdditional && " [Additional]"}
                        </MenuItem>
                      ))}
                  </Select>
                </FormControl>

                {formData.checkboxDependentOn && (
                  <FormControl fullWidth margin="dense">
                    <InputLabel id="checkbox-dependent-value-label">
                      Show When Selected Value Is
                    </InputLabel>
                    <Select
                      labelId="checkbox-dependent-value-label"
                      value={formData.checkboxDependentValue}
                      label="Show When Selected Value Is"
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          checkboxDependentValue: e.target.value,
                        }))
                      }
                    >
                      <MenuItem value="">
                        <em>Select a value</em>
                      </MenuItem>
                      {(() => {
                        const selectedField = selectableFields.find(
                          (field) => field.id === formData.checkboxDependentOn,
                        );
                        return (
                          selectedField?.options?.map((option) => (
                            <MenuItem key={option.value} value={option.value}>
                              {option.label}
                            </MenuItem>
                          )) || []
                        );
                      })()}
                    </Select>
                  </FormControl>
                )}
              </>
            )}

            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.required}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      required: e.target.checked,
                    }))
                  }
                />
              }
              label="Required Field"
            />

            <FormControlLabel
              control={<Checkbox onChange={handleDistrictCheckboxChange} />}
              label="Is District"
            />
          </>
        )}

        {/* Select-specific configuration */}
        {formData.type === "select" && (
          <>
            <FormControl fullWidth margin="dense">
              <InputLabel id="options-type-label">Options Type</InputLabel>
              <Select
                labelId="options-type-label"
                value={formData.optionsType || ""}
                label="Options Type"
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    optionsType: e.target.value,
                    dependentOn:
                      e.target.value === "dependent" ? dependentOn : "",
                    dependentOptions:
                      e.target.value === "dependent" ? {} : undefined,
                    options:
                      e.target.value === "independent" ? [] : prev.options,
                  }))
                }
              >
                <MenuItem value="">Please Select</MenuItem>
                <MenuItem value="independent">Independent</MenuItem>
                {sections && <MenuItem value="dependent">Dependent</MenuItem>}
              </Select>
            </FormControl>
            {formData.optionsType === "independent" && (
              <TextField
                fullWidth
                label="Options (semicolon-separated)"
                value={optionInputText}
                onChange={(e) => setOptionInputText(e.target.value)}
                onBlur={() => {
                  const newOptions = optionInputText
                    .split(";")
                    .map((optStr) => {
                      const cleaned = optStr.trim();
                      if (cleaned.toLowerCase().includes("withhold")) {
                        toast.error("Options cannot include 'withhold'.");
                        return null;
                      }
                      return cleaned
                        ? { value: cleaned, label: cleaned }
                        : null;
                    })
                    .filter((opt) => opt !== null);
                  setFormData((prev) => ({ ...prev, options: newOptions }));
                }}
                margin="dense"
                placeholder="Type options separated by semicolons, e.g., Option 1;Option 2 with space;Option 3"
                helperText="Use semicolons (;) to separate options. Spaces are preserved in option labels and values."
              />
            )}
            {formData.optionsType === "dependent" && !isWorkflowContext && (
              <>
                <FormControl fullWidth margin="dense">
                  <InputLabel id="dependent-on-label">Dependent On</InputLabel>
                  <Select
                    labelId="dependent-on-label"
                    value={dependentOn || ""}
                    label="Dependent On"
                    onChange={(e) => {
                      const newDependentOn = e.target.value;
                      setDependentOn(newDependentOn);
                      setFormData((prev) => ({
                        ...prev,
                        dependentOn: newDependentOn,
                        dependentOptions: newDependentOn
                          ? {}
                          : prev.dependentOptions,
                      }));
                    }}
                  >
                    <MenuItem value="">
                      <em>Select a field</em>
                    </MenuItem>
                    {filteredSelectableFields
                      .filter(
                        (field, index, self) =>
                          index === self.findIndex((f) => f.id === field.id),
                      )
                      .map((field) => (
                        <MenuItem key={field.id} value={field.id}>
                          {field.label} ({field.type})
                          {field.isAdditional && " [Additional]"}
                        </MenuItem>
                      ))}
                  </Select>
                </FormControl>
                {dependentOn && (
                  <>
                    {(() => {
                      const selectedField = selectableFields.find(
                        (field) => field.id === dependentOn,
                      );
                      if (selectedField?.options?.length > 0) {
                        return selectedField.options.map((option) => (
                          <TextField
                            key={option.value}
                            fullWidth
                            label={`Options for ${option.label} (semicolon-separated)`}
                            value={
                              dependentOptionInputs[option.value] ??
                              (formData.dependentOptions?.[option.value]
                                ? formData.dependentOptions[option.value]
                                  .map((opt) => opt.label)
                                  .join(";")
                                : "")
                            }
                            onChange={(e) => {
                              const input = e.target.value;
                              setDependentOptionInputs((prev) => ({
                                ...prev,
                                [option.value]: input,
                              }));

                              const newOptions = input
                                .split(";")
                                .map((optStr) => {
                                  const cleaned = optStr.trim();
                                  if (
                                    cleaned.toLowerCase().includes("withhold")
                                  ) {
                                    toast.error(
                                      "Options cannot include 'withhold'.",
                                    );
                                    return null;
                                  }
                                  return cleaned
                                    ? { value: cleaned, label: cleaned }
                                    : null;
                                })
                                .filter(Boolean);

                              setFormData((prev) => ({
                                ...prev,
                                dependentOptions: {
                                  ...prev.dependentOptions,
                                  [option.value]: newOptions,
                                },
                              }));
                            }}
                            margin="dense"
                            placeholder="Type options separated by semicolons..."
                            helperText="Use semicolons (;) to separate options. Spaces are preserved..."
                          />
                        ));
                      }
                      return (
                        <TextField
                          fullWidth
                          label={`Dependent Options for ${selectedField?.label || "Selected Field"
                            } (semicolon-separated)`}
                          value={
                            formData.dependentOptions?.["default"]
                              ? formData.dependentOptions["default"]
                                .map((opt) => opt.label)
                                .join(";")
                              : ""
                          }
                          onChange={(e) => {
                            const newOptions = e.target.value
                              .split(";")
                              .map((optStr) => {
                                const cleaned = optStr.trim();
                                if (
                                  cleaned.toLowerCase().includes("withhold")
                                ) {
                                  toast.error(
                                    "Options cannot include 'withhold'.",
                                  );
                                  return null;
                                }
                                return cleaned
                                  ? { value: cleaned, label: cleaned }
                                  : null;
                              })
                              .filter((opt) => opt !== null);
                            setFormData((prev) => ({
                              ...prev,
                              dependentOptions: {
                                ...prev.dependentOptions,
                                default: newOptions,
                              },
                            }));
                          }}
                          margin="dense"
                          placeholder="Type options separated by semicolons, e.g., Sub-option 1;Sub-option 2 with space;Sub-option 3"
                          helperText="Use semicolons (;) to separate options. Spaces are preserved in option labels and values."
                        />
                      );
                    })()}
                  </>
                )}
              </>
            )}
            <FormControlLabel
              control={<Checkbox onChange={handleDistrictCheckboxChange} />}
              label="Is District"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.required}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      required: e.target.checked,
                    }))
                  }
                />
              }
              label="Required Field"
            />
            {formData.type === "select" && formData.isDependentEnclosure && (
              <TextField
                fullWidth
                label="File Type Allowed"
                value={formData.accept}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, accept: e.target.value }))
                }
                margin="dense"
                placeholder="e.g., image/*, .pdf"
                helperText="Specify accepted file types, e.g., image/*, .pdf, .doc"
              />
            )}
          </>
        )}

        {formData.type === "enclosure" && (
          <>
            {!isWorkflowContext && (
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.isDependentEnclosure || false}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        isDependentEnclosure: e.target.checked,
                        dependentField: e.target.checked ? "" : null,
                        dependentValues: e.target.checked ? [] : null,
                      }))
                    }
                  />
                }
                label="Is Dependent on Another Field?"
              />
            )}
            {formData.isDependentEnclosure && !isWorkflowContext && (
              <>
                <FormControl fullWidth margin="dense">
                  <InputLabel id="dependent-field-label">
                    Dependent Field
                  </InputLabel>
                  <Select
                    labelId="dependent-field-label"
                    value={formData.dependentField || ""}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        dependentField: e.target.value,
                        dependentValues: [],
                      }))
                    }
                  >
                    <MenuItem value="">
                      <em>Select a field</em>
                    </MenuItem>
                    {filteredSelectableFields.map((field) => (
                      <MenuItem key={field.id} value={field.id}>
                        {field.label} ({field.type})
                        {field.isAdditional && " [Additional]"}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                {formData.dependentField && (
                  <FormControl fullWidth margin="dense">
                    <InputLabel id="dependent-values-label">
                      Dependent Values (Select Multiple)
                    </InputLabel>
                    {(() => {
                      const selectedField = selectableFields.find(
                        (field) => field.id === formData.dependentField,
                      );
                      if (selectedField?.options?.length > 0) {
                        return (
                          <Select
                            labelId="dependent-values-label"
                            multiple
                            value={formData.dependentValues || []}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                dependentValues: e.target.value,
                              }))
                            }
                            renderValue={(selected) =>
                              selected
                                .map(
                                  (val) =>
                                    selectedField.options.find(
                                      (opt) => opt.value === val,
                                    )?.label,
                                )
                                .filter((label) => label)
                                .join(";")
                            }
                          >
                            {selectedField.options.map((option) => (
                              <MenuItem key={option.value} value={option.value}>
                                {option.label}
                              </MenuItem>
                            ))}
                          </Select>
                        );
                      }
                      return (
                        <TextField
                          fullWidth
                          label="Condition for Dependent Field"
                          value={formData.dependentValues?.[0] || ""}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              dependentValues: [e.target.value],
                            }))
                          }
                          margin="dense"
                          placeholder="e.g., 'Not empty' for text fields"
                        />
                      );
                    })()}
                  </FormControl>
                )}
              </>
            )}
            <TextField
              fullWidth
              label="Default Options (semicolon-separated)"
              value={optionInputText}
              onChange={(e) => setOptionInputText(e.target.value)}
              onBlur={() => {
                const newOptions = optionInputText
                  .split(";")
                  .map((optStr) => {
                    const cleaned = optStr.trim();
                    if (cleaned.toLowerCase().includes("withhold")) {
                      toast.error("Options cannot include 'withhold'.");
                      return null;
                    }
                    return cleaned ? { value: cleaned, label: cleaned } : null;
                  })
                  .filter((opt) => opt !== null);
                setFormData((prev) => ({ ...prev, options: newOptions }));
              }}
              margin="dense"
              placeholder="Type options separated by semicolons, e.g., Option 1;Option 2 with space;Option 3"
              helperText="Use semicolons (;) to separate options. Spaces are preserved in option labels and values."
            />
            <TextField
              fullWidth
              label="File Type Allowed"
              value={formData.accept}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, accept: e.target.value }))
              }
              margin="dense"
              placeholder="e.g., image/*, .pdf"
              helperText="Specify accepted file types, e.g., image/*, .pdf, .doc"
            />
          </>
        )}
        {formData.type === "file" && (
          <TextField
            fullWidth
            label="File Type Allowed"
            value={formData.accept}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, accept: e.target.value }))
            }
            margin="dense"
            placeholder="e.g., image/*, .pdf"
            helperText="Specify accepted file types, e.g., image/*, .pdf, .doc"
          />
        )}
        <Typography variant="body2" sx={{ marginTop: 2 }}>
          Validation Functions
        </Typography>
        {validationFunctionsList.map((func) => (
          <FormControlLabel
            key={func.id}
            control={
              <Checkbox
                checked={formData.validationFunctions.includes(func.id)}
                onChange={(e) => {
                  let updatedValidations = [...formData.validationFunctions];
                  if (e.target.checked) {
                    updatedValidations.push(func.id);
                  } else {
                    updatedValidations = updatedValidations.filter(
                      (id) => id !== func.id,
                    );
                  }
                  setFormData((prev) => ({
                    ...prev,
                    validationFunctions: updatedValidations,
                  }));
                }}
              />
            }
            label={func.label}
          />
        ))}
        <Typography variant="body2" sx={{ marginTop: 2 }}>
          Transformation Functions
        </Typography>
        {transformationFunctionsList.map((func) => (
          <FormControlLabel
            key={func.id}
            control={
              <Checkbox
                checked={formData.transformationFunctions.includes(func.id)}
                onChange={(e) => {
                  let updatedTransformations = [
                    ...formData.transformationFunctions,
                  ];
                  if (e.target.checked) {
                    updatedTransformations.push(func.id);
                  } else {
                    updatedTransformations = updatedTransformations.filter(
                      (id) => id !== func.id,
                    );
                  }
                  setFormData((prev) => ({
                    ...prev,
                    transformationFunctions: updatedTransformations,
                  }));
                }}
              />
            }
            label={func.label}
          />
        ))}
        <Button
          fullWidth
          variant="contained"
          onClick={saveChanges}
          sx={{ marginTop: 2 }}
        >
          Save Changes
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default FieldEditModal;