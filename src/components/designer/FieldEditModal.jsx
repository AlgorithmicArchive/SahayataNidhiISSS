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
  Chip,
  Paper,
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
import SearchIcon from "@mui/icons-material/Search";

// ---------- Helper Functions (unchanged) ----------
const fetchDistricts = async () => {
  try {
    const response = await axiosInstance.get("/Base/GetDistricts");
    const data = await response.data;
    if (data.status) return data.districts;
    return [];
  } catch (error) {
    console.error("Error fetching districts:", error);
    return [];
  }
};

const getSelectableFields = (sections = [], actionForm = []) => {
  const selectableFields = [];
  const processFields = (fields, parentLabel = "", parentFieldName = "") => {
    fields.forEach((field) => {
      if (
        field.name?.toLowerCase().includes("withhold") ||
        field.label?.toLowerCase().includes("withhold")
      )
        return;
      selectableFields.push({
        id: field.name,
        label: parentLabel ? `${parentLabel} > ${field.label}` : field.label,
        options: field.options || [],
        isAdditional: !!parentFieldName,
        type: field.type,
        parentFieldName: parentFieldName || undefined,
      });
      if (field.additionalFields) {
        Object.values(field.additionalFields).forEach((additionalFieldArray) => {
          processFields(
            additionalFieldArray,
            parentLabel ? `${parentLabel} > ${field.label}` : field.label,
            field.name
          );
        });
      }
    });
  };
  if (sections?.length > 0) sections.forEach((s) => processFields(s.fields || []));
  if (actionForm?.length > 0) processFields(actionForm);
  return selectableFields.filter((f) => !f.id.includes("District"));
};

const fetchFormFieldsFromAPI = async (serviceId) => {
  if (!serviceId) return [];
  try {
    const response = await axiosInstance.get(`/Designer/GetFormElements`, {
      params: { serviceId },
    });
    if (response.data.status && response.data.sections) {
      const allFields = [];
      response.data.sections.forEach((section) => {
        if (section.fields && Array.isArray(section.fields)) {
          section.fields.forEach((field) => {
            if (field.name && field.label) {
              allFields.push({
                id: field.name,
                name: field.name,
                label: field.label,
                type: field.type || "text",
                options: field.options || [],
              });
            }
          });
        }
      });
      return allFields;
    }
    return [];
  } catch (error) {
    console.error("Error fetching form fields:", error);
    toast.error("Failed to load form fields");
    return [];
  }
};

const cleanDeclarationData = (fieldData) => {
  if (fieldData.isConsentCheckbox && fieldData.type === "checkbox") {
    const cleanedFields = Array.isArray(fieldData.declarationFields)
      ? fieldData.declarationFields
      : [];
    const sanitizedFields = cleanedFields.map((field) => ({
      id: field.id || field.name,
      name: field.name,
      label: field.label || field.name,
      type: field.type || "text",
      required: field.required || false,
      source: field.source || "form_designer",
    }));
    return {
      ...fieldData,
      declarationFields: sanitizedFields,
      declaration: fieldData.declaration || "",
      isDeclaration: true,
    };
  }
  return fieldData;
};

const DECLARATION_TEMPLATES = [
  {
    id: 1,
    name: "Standard Declaration",
    template:
      "I hereby declare that the information provided in this application is true, correct and complete to the best of my knowledge and belief.",
  },
  {
    id: 2,
    name: "Detailed Declaration",
    template:
      "I hereby solemnly declare that the particulars furnished by me in this application form are true and correct to the best of my knowledge and belief. I understand that any false information provided may lead to rejection of my application and legal action as per applicable laws.",
  },
  {
    id: 3,
    name: "Short Declaration",
    template: "I declare that all information provided herein is accurate and complete.",
  },
  {
    id: 4,
    name: "Legal Declaration",
    template:
      "I do hereby declare that the statements made in this application are true, complete and correct to the best of my knowledge and belief. I am aware that if any of the statements are found to be false or misleading, I will be subject to legal consequences as per prevailing laws.",
  },
  {
    id: 5,
    name: "Customizable Declaration",
    template:
      "I hereby declare that {field1}, {field2} and all other information provided is true to the best of my knowledge.",
  },
];

// ---------- DeclarationConfiguration (unchanged) ----------
const DeclarationConfiguration = ({
  formData,
  setFormData,
  serviceId,
  allAvailableFields = [],
}) => {
  const [declarationFields, setDeclarationFields] = useState(
    formData.declarationFields || []
  );
  const [declarationText, setDeclarationText] = useState(formData.declaration || "");
  const [availableFields, setAvailableFields] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [declarationOption, setDeclarationOption] = useState(
    formData.declaration
      ? DECLARATION_TEMPLATES.some((t) => t.template === formData.declaration)
        ? "template"
        : "custom"
      : "template"
  );

  useEffect(() => {
    const usedFieldIds = new Set(declarationFields.map((f) => f.id));
    const filteredFields = allAvailableFields
      .filter((f) => f && !usedFieldIds.has(f.id))
      .map((f) => ({
        id: f.id,
        name: f.name,
        label: f.label || f.name,
        type: f.type || "text",
        source: f.source || "form_designer",
      }));
    setAvailableFields(filteredFields);
  }, [allAvailableFields, declarationFields]);

  useEffect(() => {
    if (formData.isConsentCheckbox) {
      setFormData((prev) => ({
        ...prev,
        declarationFields: declarationFields,
        declaration: declarationText,
        isDeclaration: true,
      }));
    }
  }, [declarationFields, declarationText, setFormData, formData.isConsentCheckbox]);

  const handleTemplateSelect = (template) => {
    setSelectedTemplate(template);
    setDeclarationText(template.template);
    setDeclarationOption("template");
  };

  const handleCustomDeclarationChange = (text) => {
    setDeclarationText(text);
    setSelectedTemplate(null);
    setDeclarationOption("custom");
  };

  const handleAddField = (field) => {
    if (field) {
      const fieldData = allAvailableFields.find((f) => f.id === field.id);
      if (fieldData) {
        const newField = {
          id: fieldData.id,
          name: fieldData.name,
          label: fieldData.label || fieldData.name,
          type: fieldData.type || "text",
          source: fieldData.source || "form_designer",
          required: false,
        };
        const updatedFields = [...declarationFields, newField];
        setDeclarationFields(updatedFields);
        if (declarationOption === "custom") {
          const newText =
            declarationText +
            (declarationText.endsWith(" ") ? "" : " ") +
            `{${fieldData.name}}`;
          setDeclarationText(newText);
        }
      }
    }
  };

  const handleRemoveField = (fieldId) => {
    const updatedFields = declarationFields.filter((field) => field.id !== fieldId);
    setDeclarationFields(updatedFields);
    if (declarationOption === "custom") {
      const regex = new RegExp(`\\{${fieldId}\\}`, "g");
      const newText = declarationText.replace(regex, "").replace(/\s+/g, " ").trim();
      setDeclarationText(newText);
    }
  };

  const handleAddPlaceholder = (fieldName) => {
    const newText =
      declarationText + (declarationText.endsWith(" ") ? "" : " ") + `{${fieldName}}`;
    setDeclarationText(newText);
    setDeclarationOption("custom");
  };

  const filteredFields = availableFields.filter(
    (field) =>
      field.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      field.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Box
      sx={{
        mt: 2,
        p: 3,
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        bgcolor: "background.paper",
      }}
    >
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: "primary.main" }}>
        📝 Declaration Configuration
      </Typography>
      {serviceId && (
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2">
            Select fields from the service form to include in the declaration. Fields will
            appear as {`{fieldName}`} placeholders.
          </Typography>
        </Alert>
      )}
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
                    cursor: "pointer",
                    border: selectedTemplate?.id === template.id ? "2px solid" : "1px solid",
                    borderColor:
                      selectedTemplate?.id === template.id ? "primary.main" : "divider",
                    bgcolor:
                      selectedTemplate?.id === template.id
                        ? "primary.light"
                        : "background.paper",
                    "&:hover": {
                      borderColor: "primary.main",
                      bgcolor: "primary.light",
                    },
                  }}
                  onClick={() => handleTemplateSelect(template)}
                >
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                    {template.name}
                  </Typography>
                  <Typography variant="body2" sx={{ fontStyle: "italic", color: "text.secondary" }}>
                    {template.template}
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
          Add Form Fields to Declaration
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
          <SearchIcon sx={{ mr: 1, color: "action.active" }} />
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
              <Paper sx={{ maxHeight: 200, overflow: "auto", p: 1, mb: 2 }}>
                {filteredFields.slice(0, 10).map((field) => (
                  <Box
                    key={field.id}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      p: 1,
                      mb: 0.5,
                      borderRadius: 1,
                      bgcolor: "grey.50",
                      "&:hover": { bgcolor: "grey.100" },
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
              <Paper sx={{ p: 2, bgcolor: "warning.light", mb: 2 }}>
                <Typography variant="body2">
                  No matching fields found. Try a different search term.
                </Typography>
              </Paper>
            )}
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" sx={{ display: "block", mb: 1, fontWeight: 600 }}>
                Quick Add Common Fields:
              </Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                {availableFields
                  .filter((f) =>
                    ["name", "address", "email", "phone", "dob"].some((term) =>
                      f.name.toLowerCase().includes(term) ||
                      f.label.toLowerCase().includes(term)
                    )
                  )
                  .slice(0, 8)
                  .map((field) => (
                    <Chip
                      key={field.id}
                      label={field.label}
                      size="small"
                      variant="outlined"
                      onClick={() => handleAddField(field)}
                      sx={{ cursor: "pointer" }}
                    />
                  ))}
              </Box>
            </Box>
          </>
        ) : (
          <Paper sx={{ p: 2, bgcolor: "warning.light", mb: 2 }}>
            <Typography variant="body2">
              {serviceId
                ? "No form fields available. The service might not have any form fields configured."
                : "Please select a service first to load form fields."}
            </Typography>
          </Paper>
        )}
      </Box>
      {declarationFields.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
            Selected Fields ({declarationFields.length})
          </Typography>
          <Paper sx={{ p: 2, bgcolor: "grey.50" }}>
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
          Tip: Use {`{fieldName}`} placeholders for selected fields. Click on field chips above
          to insert.
        </Typography>
      </Box>
      {declarationFields.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="caption" sx={{ display: "block", mb: 1, fontWeight: 600 }}>
            Quick Insert Placeholders:
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
            {declarationFields.map((field) => (
              <Chip
                key={field.id}
                label={`{${field.name}}`}
                size="small"
                onClick={() => handleAddPlaceholder(field.name)}
                sx={{ cursor: "pointer" }}
              />
            ))}
          </Box>
        </Box>
      )}
      <Box sx={{ mt: 3, p: 2, bgcolor: "grey.100", borderRadius: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
          Preview:
        </Typography>
        <Paper sx={{ p: 3, bgcolor: "white" }}>
          <Typography variant="body2" sx={{ fontStyle: "italic" }}>
            {declarationFields.reduce((text, field) => {
              return text.replace(
                new RegExp(`\\{${field.name}\\}`, "g"),
                `<strong>[${field.label}]</strong>`
              );
            }, declarationText)}
          </Typography>
        </Paper>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
          {`{fieldName}`} placeholders will be replaced with actual input fields at runtime
        </Typography>
      </Box>
    </Box>
  );
};

// ========== MAIN COMPONENT ==========
const FieldEditModal = ({
  selectedField,
  sections = [],
  actionForm = [],
  onClose,
  updateField,
  serviceId,
  availableFormFields = [],
}) => {
  const [dependentOn, setDependentOn] = useState(selectedField?.dependentOn || "");
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
    transformationFunctions: Array.isArray(selectedField?.transformationFunctions)
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
    isOfficeField: selectedField?.isOfficeField !== undefined ? selectedField.isOfficeField : false,
    officeTypeId: selectedField?.officeTypeId !== undefined ? selectedField.officeTypeId : "",
    // Universal dependency (same logic as enclosure)
    enableConditionalVisibility: selectedField?.enableConditionalVisibility || false,
    conditionalField: selectedField?.conditionalField || "",
    conditionalValues: selectedField?.conditionalValues || [],
  });

  const [optionInputText, setOptionInputText] = useState(
    formData.options.map((opt) => opt.label).join(";")
  );

  // ---------- Dependency Flags ----------
  const initialIsDependentMinLength =
    typeof selectedField?.minLength === "object" &&
    selectedField?.minLength?.dependentOn;
  const [isDependentMinLength, setIsDependentMinLength] = useState(
    initialIsDependentMinLength
  );
  const [secondaryMinLengthDependentOn, setSecondaryMinLengthDependentOn] = useState(
    typeof selectedField?.minLength === "object"
      ? selectedField.minLength.secondaryDependentOn || ""
      : ""
  );

  const initialIsDependentMaxLength =
    typeof selectedField?.maxLength === "object" &&
    selectedField?.maxLength?.dependentOn;
  const [isDependentMaxLength, setIsDependentMaxLength] = useState(
    initialIsDependentMaxLength
  );
  const [secondaryMaxLengthDependentOn, setSecondaryMaxLengthDependentOn] = useState(
    typeof selectedField?.maxLength === "object"
      ? selectedField.maxLength.secondaryDependentOn || ""
      : ""
  );

  const [dependentOptionInputs, setDependentOptionInputs] = useState({});
  const [availableFields, setAvailableFields] = useState(availableFormFields);
  const [isFetchingFormFields, setIsFetchingFormFields] = useState(false);

  const [officeTypes, setOfficeTypes] = useState([]);
  const [loadingOfficeTypes, setLoadingOfficeTypes] = useState(false);

  const isWorkflowContext = sections.length === 0 && actionForm.length > 0;
  const selectableFields = getSelectableFields(sections, actionForm);
  const filteredSelectableFields = selectableFields.filter(
    (field) => field.id !== selectedField?.name
  );

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

  useEffect(() => {
    const fetchOfficeTypes = async () => {
      setLoadingOfficeTypes(true);
      try {
        const response = await axiosInstance.get("/Base/GetOfficesType");
        setOfficeTypes(response.data.officesType || []);
      } catch (error) {
        console.error("Error fetching office types:", error);
        toast.error("Failed to load office types");
      } finally {
        setLoadingOfficeTypes(false);
      }
    };
    fetchOfficeTypes();
  }, []);

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
        options: [{ value: "Please Select", label: "Please Select" }, ...districtOptions],
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
    if (!validateField(formData)) return;

    let finalFormData = {
      ...formData,
      options: formData.isConsentCheckbox ? [] : formData.options,
      optionsType: formData.isConsentCheckbox ? "" : formData.optionsType,
      dependentOn: formData.isConsentCheckbox ? "" : formData.dependentOn,
      dependentOptions: formData.isConsentCheckbox ? {} : formData.dependentOptions,
      isCheckboxDependent: formData.type === "checkbox" ? formData.isCheckboxDependent : false,
      checkboxDependentOn:
        formData.type === "checkbox" && formData.isCheckboxDependent
          ? formData.checkboxDependentOn
          : "",
      checkboxDependentValue:
        formData.type === "checkbox" && formData.isCheckboxDependent
          ? formData.checkboxDependentValue
          : "",
      isOfficeField: formData.isOfficeField,
      officeTypeId: formData.isOfficeField ? formData.officeTypeId : undefined,
      // Universal dependency (same as enclosure)
      enableConditionalVisibility: formData.enableConditionalVisibility,
      conditionalField: formData.enableConditionalVisibility ? formData.conditionalField : "",
      conditionalValues: formData.enableConditionalVisibility ? formData.conditionalValues : [],
    };

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

    if (finalFormData.declarationFields?.length === 0) delete finalFormData.declarationFields;
    if (!finalFormData.declaration?.trim()) delete finalFormData.declaration;

    finalFormData = cleanDeclarationData(finalFormData);
    updateField(finalFormData);
    onClose();
  };

  // ---------- Shared Helper: Render Primary Option Configuration Panel ----------
  const renderPrimaryConfigPanel = (
    lengthObject,
    setLengthObject,
    primaryFieldId,
    secondaryFieldId,
    label = "Value"
  ) => {
    const primaryField = selectableFields.find((f) => f.id === primaryFieldId);
    const secondaryField = selectableFields.find((f) => f.id === secondaryFieldId);

    if (!primaryField || !secondaryField) return null;

    const primaryOptions = primaryField.options || [];
    const secondaryOptions = secondaryField.options || [];

    if (primaryOptions.length === 0) {
      return (
        <Alert severity="warning" sx={{ mt: 2 }}>
          The primary field must have defined options.
        </Alert>
      );
    }

    const getPrimaryConfig = (primaryValue) => {
      const config = lengthObject?.primaryConfig?.[primaryValue] || {};
      return {
        useSecondary: config.useSecondary || false,
        singleValue: config.singleValue || "",
        secondaryValues: config.secondaryValues || {},
      };
    };

    return (
      <Box sx={{ mt: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Configure {label.toLowerCase()} for each option:
        </Typography>
        {primaryOptions.map((primOpt) => {
          const config = getPrimaryConfig(primOpt.value);
          const useSecondary = config.useSecondary;

          return (
            <Paper key={primOpt.value} sx={{ p: 2, mb: 2, bgcolor: "grey.50" }}>
              <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mr: 2 }}>
                  {primOpt.label}
                </Typography>
                {secondaryOptions.length > 0 && (
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={useSecondary}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setLengthObject((prev) => ({
                            ...prev,
                            primaryConfig: {
                              ...prev.primaryConfig,
                              [primOpt.value]: {
                                ...prev.primaryConfig?.[primOpt.value],
                                useSecondary: checked,
                              },
                            },
                          }));
                        }}
                      />
                    }
                    label={`Use secondary field (${secondaryField.label})`}
                  />
                )}
              </Box>

              {!useSecondary ? (
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  label={`${label} for ${primOpt.label}`}
                  value={config.singleValue}
                  onChange={(e) => {
                    const newVal = parseInt(e.target.value, 10) || 0;
                    setLengthObject((prev) => ({
                      ...prev,
                      primaryConfig: {
                        ...prev.primaryConfig,
                        [primOpt.value]: {
                          ...prev.primaryConfig?.[primOpt.value],
                          singleValue: newVal,
                        },
                      },
                    }));
                  }}
                  inputProps={{ min: 0 }}
                />
              ) : (
                <Grid container spacing={2}>
                  {secondaryOptions.map((secOpt) => (
                    <Grid item xs={6} sm={4} key={secOpt.value}>
                      <TextField
                        fullWidth
                        size="small"
                        type="number"
                        label={`For ${secOpt.label}`}
                        value={config.secondaryValues?.[secOpt.value] || ""}
                        onChange={(e) => {
                          const newVal = parseInt(e.target.value, 10) || 0;
                          setLengthObject((prev) => ({
                            ...prev,
                            primaryConfig: {
                              ...prev.primaryConfig,
                              [primOpt.value]: {
                                ...prev.primaryConfig?.[primOpt.value],
                                secondaryValues: {
                                  ...prev.primaryConfig?.[primOpt.value]?.secondaryValues,
                                  [secOpt.value]: newVal,
                                },
                              },
                            },
                          }));
                        }}
                        inputProps={{ min: 0 }}
                      />
                    </Grid>
                  ))}
                </Grid>
              )}
            </Paper>
          );
        })}
      </Box>
    );
  };

  return (
    <Dialog
      open={true}
      onClose={onClose}
      aria-labelledby="form-dialog-title"
      PaperProps={{ style: { width: "90%", maxWidth: 900 } }}
    >
      <DialogTitle id="form-dialog-title">Edit Field Properties</DialogTitle>
      <DialogContent>
        {/* Basic Information */}
        <Typography variant="h6" sx={{ mt: 1, mb: 1 }}>
          Basic Information
        </Typography>
        <TextField
          fullWidth
          label="Field Label"
          value={formData.label}
          onChange={(e) => setFormData((prev) => ({ ...prev, label: e.target.value }))}
          margin="dense"
        />
        <TextField
          fullWidth
          label="Field Name"
          value={formData.name}
          onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
          margin="dense"
        />

        {/* Field Type & Span */}
        <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>
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
                isConsentCheckbox: newType === "checkbox" ? prev.isConsentCheckbox : false,
                declaration:
                  newType === "checkbox" && prev.isConsentCheckbox ? prev.declaration : "",
                isDeclaration:
                  newType === "checkbox" && prev.isConsentCheckbox ? prev.isDeclaration : false,
                declarationFields:
                  newType === "checkbox" && prev.isConsentCheckbox
                    ? prev.declarationFields
                    : [],
                accept:
                  newType === "file" || (newType === "select" && prev.isDependentEnclosure)
                    ? prev.accept
                    : "",
                isCheckboxDependent: newType === "checkbox" ? prev.isCheckboxDependent : false,
                checkboxDependentOn: newType === "checkbox" ? prev.checkboxDependentOn : "",
                checkboxDependentValue: newType === "checkbox" ? prev.checkboxDependentValue : "",
                isOfficeField: prev.isOfficeField,
                officeTypeId: prev.officeTypeId,
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
        <TextField
          fullWidth
          label="Span (Grid)"
          type="number"
          value={formData.span}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, span: parseInt(e.target.value, 10) || 12 }))
          }
          margin="dense"
        />

        {/* Office Field Configuration */}
        <Box sx={{ mt: 2, p: 2, bgcolor: "grey.50", borderRadius: 1 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>
            Office Field Configuration
          </Typography>
          <FormControlLabel
            control={
              <Checkbox
                checked={formData.isOfficeField}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setFormData((prev) => ({
                    ...prev,
                    isOfficeField: checked,
                    officeTypeId: checked ? prev.officeTypeId : "",
                  }));
                }}
              />
            }
            label="This field is for an Office"
          />
          {formData.isOfficeField && (
            <FormControl fullWidth margin="dense">
              <InputLabel id="office-type-label">Office Type</InputLabel>
              <Select
                labelId="office-type-label"
                value={formData.officeTypeId}
                label="Office Type"
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, officeTypeId: e.target.value }))
                }
                disabled={loadingOfficeTypes}
              >
                <MenuItem value="">
                  <em>Select Office Type</em>
                </MenuItem>
                {loadingOfficeTypes ? (
                  <MenuItem disabled>Loading...</MenuItem>
                ) : (
                  officeTypes.map((office) => (
                    <MenuItem key={office.officeid} value={office.officeid}>
                      {office.officename || office.officenameshort || `Office ${office.officeid}`}
                    </MenuItem>
                  ))
                )}
              </Select>
            </FormControl>
          )}
        </Box>

        {/* Length Constraints */}
        <Box sx={{ mt: 2, border: "1px solid #e0e0e0", borderRadius: 1, p: 2 }}>
          <Typography variant="h6">Length Constraints</Typography>

          {/* ---------- MINIMUM LENGTH SECTION ---------- */}
          <Box sx={{ mt: 1 }}>
            <Typography variant="body2" fontWeight="bold">
              Minimum Length
            </Typography>
            {!isWorkflowContext && (
              <FormControlLabel
                control={
                  <Checkbox
                    checked={isDependentMinLength}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setIsDependentMinLength(checked);
                      if (!checked) {
                        setFormData((prev) => ({ ...prev, minLength: 5 }));
                        setSecondaryMinLengthDependentOn("");
                      } else {
                        setFormData((prev) => ({
                          ...prev,
                          minLength: { dependentOn: "" },
                        }));
                      }
                    }}
                  />
                }
                label="Use Dependent Rules"
              />
            )}
            {isDependentMinLength && !isWorkflowContext ? (
              <Box sx={{ mt: 1 }}>
                <FormControl fullWidth margin="dense">
                  <InputLabel>Primary Dependent Field</InputLabel>
                  <Select
                    value={
                      typeof formData.minLength === "object"
                        ? formData.minLength.dependentOn || ""
                        : ""
                    }
                    label="Primary Dependent Field"
                    onChange={(e) => {
                      const newPrimary = e.target.value;
                      setFormData((prev) => ({
                        ...prev,
                        minLength: {
                          dependentOn: newPrimary,
                          secondaryDependentOn: "",
                        },
                      }));
                      setSecondaryMinLengthDependentOn("");
                    }}
                  >
                    <MenuItem value="">
                      <em>Select a field</em>
                    </MenuItem>
                    {filteredSelectableFields.map((field) => (
                      <MenuItem key={field.id} value={field.id}>
                        {field.label} ({field.type})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                {typeof formData.minLength === "object" &&
                  formData.minLength.dependentOn && (
                    <>
                      <FormControl fullWidth margin="dense">
                        <InputLabel>Secondary Dependent Field (Optional)</InputLabel>
                        <Select
                          value={secondaryMinLengthDependentOn}
                          label="Secondary Dependent Field (Optional)"
                          onChange={(e) => {
                            const newSecondary = e.target.value;
                            setSecondaryMinLengthDependentOn(newSecondary);
                            setFormData((prev) => ({
                              ...prev,
                              minLength: {
                                ...prev.minLength,
                                secondaryDependentOn: newSecondary || undefined,
                              },
                            }));
                          }}
                        >
                          <MenuItem value="">
                            <em>None</em>
                          </MenuItem>
                          {filteredSelectableFields
                            .filter((f) => f.id !== formData.minLength.dependentOn)
                            .map((field) => (
                              <MenuItem key={field.id} value={field.id}>
                                {field.label} ({field.type})
                              </MenuItem>
                            ))}
                        </Select>
                      </FormControl>
                      {!secondaryMinLengthDependentOn ? (
                        <>
                          {(() => {
                            const primaryField = selectableFields.find(
                              (f) => f.id === formData.minLength.dependentOn
                            );
                            if (primaryField?.options?.length > 0) {
                              return primaryField.options.map((option) => (
                                <TextField
                                  key={option.value}
                                  fullWidth
                                  label={`Minimum Length for ${option.label}`}
                                  type="number"
                                  value={formData.minLength?.[option.value] || ""}
                                  onChange={(e) => {
                                    const newValue = parseInt(e.target.value, 10) || 0;
                                    setFormData((prev) => ({
                                      ...prev,
                                      minLength: {
                                        ...prev.minLength,
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
                                label="Minimum Length Condition"
                                value={formData.minLength?.condition || ""}
                                onChange={(e) =>
                                  setFormData((prev) => ({
                                    ...prev,
                                    minLength: {
                                      ...prev.minLength,
                                      condition: e.target.value,
                                    },
                                  }))
                                }
                                margin="dense"
                                placeholder="e.g., 'Not empty'"
                              />
                            );
                          })()}
                        </>
                      ) : (
                        renderPrimaryConfigPanel(
                          formData.minLength,
                          (updater) =>
                            setFormData((prev) => ({
                              ...prev,
                              minLength:
                                typeof updater === "function"
                                  ? updater(prev.minLength)
                                  : updater,
                            })),
                          formData.minLength.dependentOn,
                          secondaryMinLengthDependentOn,
                          "Minimum Length"
                        )
                      )}
                    </>
                  )}
              </Box>
            ) : (
              <TextField
                fullWidth
                label="Minimum Length"
                type="number"
                value={typeof formData.minLength === "number" ? formData.minLength : 5}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    minLength: parseInt(e.target.value, 10) || 0,
                  }))
                }
                margin="dense"
              />
            )}
          </Box>

          {/* ---------- MAXIMUM LENGTH SECTION ---------- */}
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" fontWeight="bold">
              Maximum Length
            </Typography>
            {!isWorkflowContext && (
              <FormControlLabel
                control={
                  <Checkbox
                    checked={isDependentMaxLength}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setIsDependentMaxLength(checked);
                      if (!checked) {
                        setFormData((prev) => ({ ...prev, maxLength: 50 }));
                        setSecondaryMaxLengthDependentOn("");
                      } else {
                        setFormData((prev) => ({
                          ...prev,
                          maxLength: { dependentOn: "" },
                        }));
                      }
                    }}
                  />
                }
                label="Use Dependent Rules"
              />
            )}
            {isDependentMaxLength && !isWorkflowContext ? (
              <Box sx={{ mt: 1 }}>
                <FormControl fullWidth margin="dense">
                  <InputLabel>Primary Dependent Field</InputLabel>
                  <Select
                    value={
                      typeof formData.maxLength === "object"
                        ? formData.maxLength.dependentOn || ""
                        : ""
                    }
                    label="Primary Dependent Field"
                    onChange={(e) => {
                      const newPrimary = e.target.value;
                      setFormData((prev) => ({
                        ...prev,
                        maxLength: {
                          dependentOn: newPrimary,
                          secondaryDependentOn: "",
                        },
                      }));
                      setSecondaryMaxLengthDependentOn("");
                    }}
                  >
                    <MenuItem value="">
                      <em>Select a field</em>
                    </MenuItem>
                    {filteredSelectableFields.map((field) => (
                      <MenuItem key={field.id} value={field.id}>
                        {field.label} ({field.type})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                {typeof formData.maxLength === "object" &&
                  formData.maxLength.dependentOn && (
                    <>
                      <FormControl fullWidth margin="dense">
                        <InputLabel>Secondary Dependent Field (Optional)</InputLabel>
                        <Select
                          value={secondaryMaxLengthDependentOn}
                          label="Secondary Dependent Field (Optional)"
                          onChange={(e) => {
                            const newSecondary = e.target.value;
                            setSecondaryMaxLengthDependentOn(newSecondary);
                            setFormData((prev) => ({
                              ...prev,
                              maxLength: {
                                ...prev.maxLength,
                                secondaryDependentOn: newSecondary || undefined,
                              },
                            }));
                          }}
                        >
                          <MenuItem value="">
                            <em>None</em>
                          </MenuItem>
                          {filteredSelectableFields
                            .filter((f) => f.id !== formData.maxLength.dependentOn)
                            .map((field) => (
                              <MenuItem key={field.id} value={field.id}>
                                {field.label} ({field.type})
                              </MenuItem>
                            ))}
                        </Select>
                      </FormControl>
                      {!secondaryMaxLengthDependentOn ? (
                        <>
                          {(() => {
                            const primaryField = selectableFields.find(
                              (f) => f.id === formData.maxLength.dependentOn
                            );
                            if (primaryField?.options?.length > 0) {
                              return primaryField.options.map((option) => (
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
                                placeholder="e.g., 'Not empty'"
                              />
                            );
                          })()}
                        </>
                      ) : (
                        renderPrimaryConfigPanel(
                          formData.maxLength,
                          (updater) =>
                            setFormData((prev) => ({
                              ...prev,
                              maxLength:
                                typeof updater === "function"
                                  ? updater(prev.maxLength)
                                  : updater,
                            })),
                          formData.maxLength.dependentOn,
                          secondaryMaxLengthDependentOn,
                          "Maximum Length"
                        )
                      )}
                    </>
                  )}
              </Box>
            ) : (
              <TextField
                fullWidth
                label="Maximum Length"
                type="number"
                value={typeof formData.maxLength === "number" ? formData.maxLength : 50}
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
        </Box>

        {/* Universal Field Dependency (same as enclosure logic) */}
        <Box sx={{ mt: 2, border: "1px solid #e0e0e0", borderRadius: 1, p: 2 }}>
          <Typography variant="h6">Field Dependency</Typography>
          <FormControlLabel
            control={
              <Checkbox
                checked={formData.enableConditionalVisibility}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    enableConditionalVisibility: e.target.checked,
                    conditionalField: e.target.checked ? prev.conditionalField : "",
                    conditionalValues: e.target.checked ? prev.conditionalValues : [],
                  }))
                }
              />
            }
            label="This field depends on another field"
          />

          {formData.enableConditionalVisibility && (
            <>
              <FormControl fullWidth margin="dense">
                <InputLabel>Depending on Field</InputLabel>
                <Select
                  value={formData.conditionalField}
                  label="Depending on Field"
                  onChange={(e) => {
                    const newField = e.target.value;
                    setFormData((prev) => ({
                      ...prev,
                      conditionalField: newField,
                      conditionalValues: [],
                    }));
                  }}
                >
                  <MenuItem value="">
                    <em>Select a field</em>
                  </MenuItem>
                  {filteredSelectableFields
                    .filter((f) => f.id !== selectedField?.name)
                    .map((field) => (
                      <MenuItem key={field.id} value={field.id}>
                        {field.label} ({field.type})
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>

              {formData.conditionalField && (
                <FormControl fullWidth margin="dense">
                  <InputLabel>Show when field value is one of</InputLabel>
                  <Select
                    multiple
                    value={formData.conditionalValues || []}
                    label="Show when field value is one of"
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        conditionalValues: e.target.value,
                      }))
                    }
                    renderValue={(selected) =>
                      selected
                        .map((val) => {
                          const depField = selectableFields.find(
                            (f) => f.id === formData.conditionalField
                          );
                          const option = depField?.options.find((opt) => opt.value === val);
                          return option ? option.label : val;
                        })
                        .join(", ")
                    }
                  >
                    {(() => {
                      const depField = selectableFields.find(
                        (f) => f.id === formData.conditionalField
                      );
                      if (!depField?.options?.length) {
                        return (
                          <MenuItem disabled>
                            <em>No options available</em>
                          </MenuItem>
                        );
                      }
                      return depField.options.map((opt) => (
                        <MenuItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </MenuItem>
                      ));
                    })()}
                  </Select>
                  <Typography variant="caption" sx={{ mt: 1 }}>
                    If no values are selected, the field will always be shown.
                  </Typography>
                </FormControl>
              )}
            </>
          )}
        </Box>

        {/* Validation & Transformation Functions */}
        <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>
          Validation Functions
        </Typography>
        <Grid container spacing={1}>
          {validationFunctionsList.map((func) => (
            <Grid item xs={6} sm={4} key={func.id}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.validationFunctions.includes(func.id)}
                    onChange={(e) => {
                      let updated = [...formData.validationFunctions];
                      if (e.target.checked) updated.push(func.id);
                      else updated = updated.filter((id) => id !== func.id);
                      setFormData((prev) => ({ ...prev, validationFunctions: updated }));
                    }}
                  />
                }
                label={func.label}
              />
            </Grid>
          ))}
        </Grid>

        <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>
          Transformation Functions
        </Typography>
        <Grid container spacing={1}>
          {transformationFunctionsList.map((func) => (
            <Grid item xs={6} sm={4} key={func.id}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.transformationFunctions.includes(func.id)}
                    onChange={(e) => {
                      let updated = [...formData.transformationFunctions];
                      if (e.target.checked) updated.push(func.id);
                      else updated = updated.filter((id) => id !== func.id);
                      setFormData((prev) => ({ ...prev, transformationFunctions: updated }));
                    }}
                  />
                }
                label={func.label}
              />
            </Grid>
          ))}
        </Grid>

        {/* Checkbox Options Group */}
        {formData.type === "checkbox" && (
          <>
            <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>
              Checkbox Options
            </Typography>
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
            {formData.isConsentCheckbox && (
              <>
                <DeclarationConfiguration
                  formData={formData}
                  setFormData={setFormData}
                  serviceId={serviceId}
                  allAvailableFields={availableFields}
                />
                {isFetchingFormFields && (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 2 }}>
                    <CircularProgress size={16} />
                    <Typography variant="caption">Loading form fields...</Typography>
                  </Box>
                )}
              </>
            )}
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
                        checkboxDependentOn: checked ? prev.checkboxDependentOn : "",
                        checkboxDependentValue: checked ? prev.checkboxDependentValue : "",
                      }));
                    }}
                  />
                }
                label="Make Checkbox Dependent on Another Field"
              />
            )}
            {formData.isCheckboxDependent && !isWorkflowContext && (
              <>
                <FormControl fullWidth margin="dense">
                  <InputLabel id="checkbox-dependent-on-label">Dependent On Field</InputLabel>
                  <Select
                    labelId="checkbox-dependent-on-label"
                    value={formData.checkboxDependentOn}
                    label="Dependent On Field"
                    onChange={(e) => {
                      const newDependentOn = e.target.value;
                      setFormData((prev) => ({
                        ...prev,
                        checkboxDependentOn: newDependentOn,
                        checkboxDependentValue: "",
                      }));
                    }}
                  >
                    <MenuItem value="">
                      <em>Select a field</em>
                    </MenuItem>
                    {filteredSelectableFields
                      .filter((field) => field.type === "select")
                      .map((field) => (
                        <MenuItem key={field.id} value={field.id}>
                          {field.label} ({field.type})
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
                          (f) => f.id === formData.checkboxDependentOn
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
                    setFormData((prev) => ({ ...prev, required: e.target.checked }))
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

        {/* Select Options Group */}
        {formData.type === "select" && (
          <>
            <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>
              Select Options
            </Typography>
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
                    dependentOn: e.target.value === "dependent" ? dependentOn : "",
                    dependentOptions: e.target.value === "dependent" ? {} : undefined,
                    options: e.target.value === "independent" ? [] : prev.options,
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
                      return cleaned ? { value: cleaned, label: cleaned } : null;
                    })
                    .filter((opt) => opt !== null);
                  setFormData((prev) => ({ ...prev, options: newOptions }));
                }}
                margin="dense"
                placeholder="Type options separated by semicolons"
                helperText="Use semicolons (;) to separate options."
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
                        dependentOptions: newDependentOn ? {} : prev.dependentOptions,
                      }));
                    }}
                  >
                    <MenuItem value="">
                      <em>Select a field</em>
                    </MenuItem>
                    {filteredSelectableFields.map((field) => (
                      <MenuItem key={field.id} value={field.id}>
                        {field.label} ({field.type})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                {dependentOn && (
                  <>
                    {(() => {
                      const selectedField = selectableFields.find((f) => f.id === dependentOn);
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
                                  if (cleaned.toLowerCase().includes("withhold")) {
                                    toast.error("Options cannot include 'withhold'.");
                                    return null;
                                  }
                                  return cleaned ? { value: cleaned, label: cleaned } : null;
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
                                if (cleaned.toLowerCase().includes("withhold")) {
                                  toast.error("Options cannot include 'withhold'.");
                                  return null;
                                }
                                return cleaned ? { value: cleaned, label: cleaned } : null;
                              })
                              .filter((opt) => opt !== null);
                            setFormData((prev) => ({
                              ...prev,
                              dependentOptions: { ...prev.dependentOptions, default: newOptions },
                            }));
                          }}
                          margin="dense"
                          placeholder="Type options separated by semicolons..."
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
                    setFormData((prev) => ({ ...prev, required: e.target.checked }))
                  }
                />
              }
              label="Required Field"
            />
          </>
        )}

        {/* Enclosure / File specifics */}
        {formData.type === "enclosure" && (
          <>
            <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>
              Enclosure Options
            </Typography>
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
                  <InputLabel id="dependent-field-label">Dependent Field</InputLabel>
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
                        (f) => f.id === formData.dependentField
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
                                    selectedField.options.find((opt) => opt.value === val)?.label
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
                          placeholder="e.g., 'Not empty'"
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
              placeholder="Type options separated by semicolons"
            />
            <TextField
              fullWidth
              label="File Type Allowed"
              value={formData.accept}
              onChange={(e) => setFormData((prev) => ({ ...prev, accept: e.target.value }))}
              margin="dense"
              placeholder="e.g., image/*, .pdf"
            />
          </>
        )}
        {formData.type === "file" && (
          <TextField
            fullWidth
            label="File Type Allowed"
            value={formData.accept}
            onChange={(e) => setFormData((prev) => ({ ...prev, accept: e.target.value }))}
            margin="dense"
            placeholder="e.g., image/*, .pdf"
          />
        )}

        {/* Save Button */}
        <Button
          fullWidth
          variant="contained"
          onClick={saveChanges}
          sx={{ marginTop: 3 }}
        >
          Save Changes
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default FieldEditModal;