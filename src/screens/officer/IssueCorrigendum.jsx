import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Container,
  TextField,
  Typography,
  MenuItem,
  Select,
  IconButton,
  FormControl,
  InputLabel,
  FormHelperText,
  Grid,
  FormLabel,
  Autocomplete,
  Alert,
  Paper,
  Divider,
  Stack,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import {
  Delete as DeleteIcon,
  EditNote,
  Add,
  PictureAsPdf,
  CheckCircleOutline,
  History,
  UploadFile,
  Description,
  WarningAmber,
  ErrorOutline,
} from "@mui/icons-material";
import ServiceSelectionForm from "../../components/ServiceSelectionForm";
import { fetchServiceList } from "../../assets/fetch";
import axiosInstance from "../../axiosConfig";
import {
  runValidations,
  TransformationFunctionsList,
} from "../../assets/formvalidations";
import { useLocation } from "react-router-dom";
import { MaterialReactTable } from "material-react-table";
import BasicModal from "../../components/BasicModal";

const MaterialTable = ({ columns, data, viewType }) => {
  return (
    <MaterialReactTable
      columns={columns}
      data={data}
      enableColumnActions={false}
      enableColumnFilters={false}
      enablePagination={false}
      enableSorting={false}
      muiTablePaperProps={{
        sx: {
          borderRadius: "8px",
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          boxShadow: "none",
        },
      }}
      muiTableContainerProps={{
        sx: { maxHeight: "600px", background: "#ffffff" },
      }}
      muiTableHeadCellProps={{
        sx: {
          background: "#f8fafc",
          color: "#475569",
          fontWeight: 600,
          fontSize: "0.75rem",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          borderBottom: "1px solid #e2e8f0",
          borderRight: "none",
          py: 1.5,
        },
      }}
      muiTableBodyRowProps={{
        sx: {
          "&:hover": {
            background: "#f8fafc",
            transition: "background-color 0.2s ease",
          },
        },
      }}
      muiTableBodyCellProps={{
        sx: {
          color: "#1e293b",
          background: "transparent",
          fontSize: "0.875rem",
          borderRight: "none",
          borderBottom: "1px solid #f1f5f9",
          py: 1.5,
        },
      }}
      renderEmptyRowsFallback={() => (
        <Box sx={{ textAlign: "center", py: 6, color: "#94a3b8" }}>
          <History sx={{ fontSize: 40, mb: 1, color: "#cbd5e1" }} />
          <Typography
            variant="body1"
            sx={{ fontWeight: 500, color: "#64748b" }}
          >
            No {viewType?.toLowerCase() || "history"} available.
          </Typography>
        </Box>
      )}
    />
  );
};

export default function IssueDocumentChange() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [serviceId, setServiceId] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [type, setType] = useState("");
  const [canIssue, setCanIssue] = useState(false);
  const [formDetailsFields, setFormDetailsFields] = useState([]);
  const [formDetails, setFormDetails] = useState({});
  const [formElements, setFormElements] = useState([]);
  const [corrigendumFields, setCorrigendumFields] = useState([]);
  const [groupSupportingDocuments, setGroupSupportingDocuments] = useState({});
  const [removedFields, setRemovedFields] = useState({});
  const [selectedField, setSelectedField] = useState("");
  const [remarks, setRemarks] = useState("");
  const [wordCount, setWordCount] = useState(0);
  const MAX_WORDS = 50;
  const [errors, setErrors] = useState({});
  const [formData, setFormData] = useState({});
  const [touched, setTouched] = useState({ remarks: false, type: false });
  const [nextOfficer, setNextOfficer] = useState("");
  const [columns, setColumns] = useState([]);
  const [data, setData] = useState([]);
  const [isEdit, setIsEdit] = useState(false);
  const [responseMessage, setResponseMessage] = useState({
    message: "",
    type: "",
  });
  const [openModal, setOpenModal] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [allowedFormFields, setAllowedFormFields] = useState([]);
  const [renderKey, setRenderKey] = useState(0);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [successDetails, setSuccessDetails] = useState({
    message: "",
    referenceNumber: "",
    type: "",
  });
  const [existingCorrigendumId, setExistingCorrigendumId] = useState(null);
  const [canEditExisting, setCanEditExisting] = useState(false);

  const [validationPopup, setValidationPopup] = useState({
    open: false,
    items: [],
  });
  const [highlightedField, setHighlightedField] = useState(null);
  const highlightTimer = useRef(null);

  useEffect(() => {
    return () => {
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
    };
  }, []);

  const [bankOptions, setBankOptions] = useState([
    { label: "Please Select", value: "Please Select" },
  ]);

  const location = useLocation();
  const { ReferenceNumber, ServiceId, applicationId, applicationType } =
    location.state || {};

  const fieldNames = [
    { name: "District", childname: "Tehsil", respectiveTable: "Tehsil" },
    {
      name: "PresentDistrict",
      childname: {
        Urban: ["PresentTehsil", "PresentMuncipality"],
        Rural: ["PresentTehsil", "PresentBlock"],
      },
      respectiveTable: {
        Urban: ["TehsilAll", "Muncipality"],
        Rural: ["TehsilAll", "Block"],
      },
    },
    {
      name: "PermanentDistrict",
      childname: {
        Urban: ["PermanentTehsil", "PermanentMuncipality"],
        Rural: ["PermanentTehsil", "PermanentBlock"],
      },
      respectiveTable: {
        Urban: ["TehsilAll", "Muncipality"],
        Rural: ["TehsilAll", "Block"],
      },
    },
    {
      name: "PresentMuncipality",
      childname: "PresentWardNo",
      respectiveTable: "Ward",
    },
    {
      name: "PermanentMuncipality",
      childname: "PermanentWardNo",
      respectiveTable: "Ward",
    },
    {
      name: "PresentBlock",
      childname: "PresentHalqaPanchayat",
      respectiveTable: "HalqaPanchayat",
    },
    {
      name: "PermanentBlock",
      childname: "PermanentHalqaPanchayat",
      respectiveTable: "HalqaPanchayat",
    },
    {
      name: "PresentHalqaPanchayat",
      childname: "PresentVillage",
      respectiveTable: "Village",
    },
    {
      name: "PermanentHalqaPanchayat",
      childname: "PermanentVillage",
      respectiveTable: "Village",
    },
  ];

  const canEditDocument = !existingCorrigendumId || canEditExisting;

  const fetchBanks = useCallback(async () => {
    try {
      const response = await axiosInstance.get("/Base/GetBanks");
      if (!response.data?.status) throw new Error("Failed to fetch banks");
      const banks = (response.data.data || [])
        .map((bank) => {
          const name =
            bank.bankname ??
            bank.bankName ??
            bank.Bankname ??
            bank.BankName ??
            bank.name ??
            bank.Name;
          if (name === undefined || name === null) return null;
          return { value: String(name), label: String(name) };
        })
        .filter(Boolean);
      setBankOptions([
        { label: "Please Select", value: "Please Select" },
        ...banks,
      ]);
    } catch (error) {
      console.error("Error fetching banks:", error);
    }
  }, []);

  const resetFormState = useCallback(() => {
    setCanIssue(false);
    setFormDetailsFields([]);
    setFormElements([]);
    setCorrigendumFields([]);
    setGroupSupportingDocuments({});
    setRemovedFields({});
    setSelectedField("");
    setRemarks("");
    setWordCount(0);
    setErrors({});
    setFormData({});
    setTouched({ remarks: false, type: false });
    setNextOfficer("");
    setColumns([]);
    setData([]);
    setResponseMessage({ message: "", type: "" });
    setExistingCorrigendumId(null);
    setCanEditExisting(false);
    setValidationPopup({ open: false, items: [] });
    setHighlightedField(null);
  }, []);

  const handleStartNew = useCallback(() => {
    setShowSuccessMessage(false);
    setSuccessDetails({ message: "", referenceNumber: "", type: "" });
    resetFormState();
  }, [resetFormState]);

  useEffect(() => {
    if (
      existingCorrigendumId &&
      (referenceNumber || ReferenceNumber) &&
      (serviceId || ServiceId)
    ) {
      handleCheckIfDocumentChange();
    }
  }, [existingCorrigendumId]);

  useEffect(() => {
    const loadInitialData = async () => {
      setIsInitialLoad(true);
      try {
        await fetchServiceList(setServices);
        await fetchBanks();
      } catch (error) {
        console.error("Failed to load services:", error);
      }
      if (ReferenceNumber && ServiceId) {
        setReferenceNumber(ReferenceNumber);
        setServiceId(ServiceId);
        if (applicationId) {
          setIsEdit(true);
          setExistingCorrigendumId(applicationId);
        }
        if (applicationType) setType(applicationType);
        await handleCheckIfDocumentChange();
        setIsInitialLoad(false);
      } else {
        setIsInitialLoad(false);
      }
    };
    loadInitialData();
  }, []);

  const handleAreaChange = useCallback(
    async (corrigendumIndex, changedFieldName, value) => {
      try {
        const match = fieldNames.find((f) => f.name === changedFieldName);
        if (!match) return;
        const pleaseSelectOption = [
          { label: "Please Select", value: "Please Select" },
        ];
        if (value === "Please Select") {
          let childFieldNames =
            typeof match.childname === "object"
              ? match.childname.Urban || match.childname.Rural || []
              : [match.childname];
          if (!Array.isArray(childFieldNames))
            childFieldNames = [childFieldNames];
          childFieldNames.forEach((childFieldName) => {
            setFormElements((prevSections) => {
              const newSections = JSON.parse(JSON.stringify(prevSections));
              const sectionName = changedFieldName.includes("Present")
                ? "Present Address Details"
                : changedFieldName.includes("Permanent")
                  ? "Permanent Address Details"
                  : "Location";
              const sectionIndex = newSections.findIndex(
                (s) => s.section === sectionName,
              );
              if (sectionIndex === -1) return prevSections;
              newSections[sectionIndex].fields = newSections[
                sectionIndex
              ].fields.map((f) => {
                if (f.name === childFieldName)
                  return { ...f, options: pleaseSelectOption };
                if (f.additionalFields) {
                  const updatedAdditionalFields = {};
                  if (f.additionalFields.Urban)
                    updatedAdditionalFields.Urban =
                      f.additionalFields.Urban.map((af) =>
                        af.name === childFieldName
                          ? { ...af, options: pleaseSelectOption }
                          : af,
                      );
                  if (f.additionalFields.Rural)
                    updatedAdditionalFields.Rural =
                      f.additionalFields.Rural.map((af) =>
                        af.name === childFieldName
                          ? { ...af, options: pleaseSelectOption }
                          : af,
                      );
                  return {
                    ...f,
                    additionalFields: {
                      ...f.additionalFields,
                      ...updatedAdditionalFields,
                    },
                  };
                }
                return f;
              });
              return newSections;
            });
            setCorrigendumFields((prevFields) => {
              const updatedFields = JSON.parse(JSON.stringify(prevFields));
              const childIndex = updatedFields.findIndex(
                (f) => f.name === childFieldName,
              );
              if (childIndex !== -1) {
                updatedFields[childIndex] = {
                  ...updatedFields[childIndex],
                  options: pleaseSelectOption,
                  newValue: "Please Select",
                };
                handleNewValueChange(childIndex, "Please Select", null, true);
              }
              return updatedFields;
            });
            setCorrigendumFields((prevFields) => {
              const updatedFields = JSON.parse(JSON.stringify(prevFields));
              const currentFieldIndex = updatedFields.findIndex(
                (f, i) => i === corrigendumIndex,
              );
              if (
                currentFieldIndex !== -1 &&
                updatedFields[currentFieldIndex].additionalValues
              ) {
                updatedFields[currentFieldIndex].additionalValues = {
                  ...updatedFields[currentFieldIndex].additionalValues,
                  [childFieldName]: "Please Select",
                };
                handleNewValueChange(
                  currentFieldIndex,
                  "Please Select",
                  childFieldName,
                  true,
                );
              }
              return updatedFields;
            });
          });
          setRenderKey((prev) => prev + 1);
          return;
        }
        const sectionName = changedFieldName.includes("Present")
          ? "Present Address Details"
          : changedFieldName.includes("Permanent")
            ? "Permanent Address Details"
            : "Location";
        const sectionIndex = formElements.findIndex(
          (s) => s.section === sectionName,
        );
        if (sectionIndex === -1) return;
        const addressTypeKey = changedFieldName.includes("Present")
          ? "PresentAddressType"
          : changedFieldName.includes("Permanent")
            ? "PermanentAddressType"
            : null;
        const addressType = addressTypeKey
          ? formData[addressTypeKey] || "Urban"
          : "Urban";
        let childFieldNames =
          typeof match.childname === "object"
            ? match.childname[addressType] || []
            : [match.childname];
        if (!Array.isArray(childFieldNames))
          childFieldNames = [childFieldNames];
        let tableNames =
          typeof match.respectiveTable === "object"
            ? match.respectiveTable[addressType] || []
            : [match.respectiveTable];
        if (!Array.isArray(tableNames)) tableNames = [tableNames];
        if (!childFieldNames.length || !tableNames.length) return;
        for (let i = 0; i < childFieldNames.length; i++) {
          const childFieldName = childFieldNames[i];
          const tableName = tableNames[i];
          const response = await axiosInstance.get(
            `/Base/GetAreaList?table=${tableName}&parentId=${value}`,
          );
          const areaList = response.data?.data || [];
          const uniqueOptions = [];
          const seenValues = new Set();
          areaList.forEach((item) => {
            const optionValue = item.id ?? item.value;
            if (!seenValues.has(optionValue)) {
              seenValues.add(optionValue);
              uniqueOptions.push({
                value: optionValue,
                label: item.name ?? item.label,
              });
            }
          });
          const newOptions = [
            { label: "Please Select", value: "Please Select" },
            ...uniqueOptions,
          ];
          setFormElements((prevSections) => {
            const newSections = JSON.parse(JSON.stringify(prevSections));
            newSections[sectionIndex].fields = newSections[
              sectionIndex
            ].fields.map((f) => {
              if (f.name === childFieldName)
                return { ...f, options: newOptions };
              if (f.additionalFields) {
                const updatedAdditionalFields = {};
                if (f.additionalFields.Urban)
                  updatedAdditionalFields.Urban = f.additionalFields.Urban.map(
                    (af) =>
                      af.name === childFieldName
                        ? { ...af, options: newOptions }
                        : af,
                  );
                if (f.additionalFields.Rural)
                  updatedAdditionalFields.Rural = f.additionalFields.Rural.map(
                    (af) =>
                      af.name === childFieldName
                        ? { ...af, options: newOptions }
                        : af,
                  );
                return {
                  ...f,
                  additionalFields: {
                    ...f.additionalFields,
                    ...updatedAdditionalFields,
                  },
                };
              }
              return f;
            });
            return newSections;
          });
          setCorrigendumFields((prevFields) => {
            const updatedFields = JSON.parse(JSON.stringify(prevFields));
            const childIndex = updatedFields.findIndex(
              (f) => f.name === childFieldName,
            );
            if (childIndex !== -1) {
              const currentChildValue =
                updatedFields[childIndex].newValue || "";
              const isValueValid = newOptions.some(
                (option) =>
                  option.value.toString() === currentChildValue.toString(),
              );
              updatedFields[childIndex] = {
                ...updatedFields[childIndex],
                options: newOptions,
                newValue: isValueValid ? currentChildValue : "Please Select",
              };
              if (!isValueValid)
                handleNewValueChange(childIndex, "Please Select", null, true);
            }
            return updatedFields;
          });
          setCorrigendumFields((prevFields) => {
            const updatedFields = JSON.parse(JSON.stringify(prevFields));
            const currentFieldIndex = updatedFields.findIndex(
              (f, idx) => idx === corrigendumIndex,
            );
            if (
              currentFieldIndex !== -1 &&
              updatedFields[currentFieldIndex].additionalFields?.[
                updatedFields[currentFieldIndex].newValue
              ]
            ) {
              const addChildIndex = updatedFields[
                currentFieldIndex
              ].additionalFields[
                updatedFields[currentFieldIndex].newValue
              ].findIndex((af) => af.name === childFieldName);
              if (addChildIndex !== -1) {
                updatedFields[currentFieldIndex].additionalFields[
                  updatedFields[currentFieldIndex].newValue
                ][addChildIndex].options = newOptions;
                const currentChildValue =
                  updatedFields[currentFieldIndex].additionalValues[
                    childFieldName
                  ] || "";
                const isValueValid = newOptions.some(
                  (option) =>
                    option.value.toString() === currentChildValue.toString(),
                );
                if (
                  currentChildValue &&
                  currentChildValue !== "Please Select" &&
                  !isValueValid
                ) {
                  updatedFields[currentFieldIndex].additionalValues[
                    childFieldName
                  ] = "Please Select";
                  handleNewValueChange(
                    currentFieldIndex,
                    "Please Select",
                    childFieldName,
                    true,
                  );
                }
              }
            }
            return updatedFields;
          });
        }
        setRenderKey((prev) => prev + 1);
      } catch (error) {
        console.error("Error in handleAreaChange:", error);
        setResponseMessage({
          message: "Failed to fetch area list. Please try again.",
          type: "error",
        });
      }
    },
    [formElements, formData, corrigendumFields],
  );

  // ─────────────────────────────────────────────────────────
  // Recursive field-config lookup
  // ─────────────────────────────────────────────────────────
  const findFieldConfigRaw = useCallback(
    (fieldName, fieldType = "text", parsedFormElements = null) => {
      parsedFormElements = parsedFormElements || formElements;

      const buildConfig = (field) => ({
        ...field,
        type: field.type || fieldType,
        validationFunctions: field.validationFunctions || [],
        transformationFunctions: field.transformationFunctions || [],
        additionalFields: field.additionalFields || {},
        conditionalAdditionalFields: field.conditionalAdditionalFields || {},
        options: field.options || [
          { label: "Please Select", value: "Please Select" },
        ],
        accept: field.accept || ".pdf",
        allowSameAsOldValue: field.allowSameAsOldValue || false,
      });

      const searchFields = (fields) => {
        if (!Array.isArray(fields)) return null;
        for (const field of fields) {
          if (field.name === fieldName) return buildConfig(field);
          for (const key in field.additionalFields || {}) {
            const found = searchFields(field.additionalFields[key]);
            if (found) return found;
          }
          for (const key in field.conditionalAdditionalFields || {}) {
            const found = searchFields(field.conditionalAdditionalFields[key]);
            if (found) return found;
          }
        }
        return null;
      };

      for (const section of parsedFormElements) {
        const found = searchFields(section.fields);
        if (found) return found;
      }

      return {
        label: fieldName,
        name: fieldName,
        type: fieldType,
        editable: true,
        validationFunctions: [],
        transformationFunctions: [],
        additionalFields: {},
        conditionalAdditionalFields: {},
        options: [{ label: "Please Select", value: "Please Select" }],
        accept: fieldType === "enclosure" ? ".pdf" : undefined,
        allowSameAsOldValue: fieldName === "percentageOfDisability",
      };
    },
    [formElements],
  );

  const findFieldConfig = useCallback(
    (fieldName, fieldType = "text", parsedFormElements = null) => {
      const config = findFieldConfigRaw(
        fieldName,
        fieldType,
        parsedFormElements,
      );
      if (fieldName === "BankName" && bankOptions.length > 1) {
        return { ...config, type: "select", options: bankOptions };
      }
      return config;
    },
    [findFieldConfigRaw, bankOptions],
  );

  const normalizeDetails = useCallback(
    (formDetailsArg, parsedFormElements = null) => {
      if (!formDetailsArg || typeof formDetailsArg !== "object") return [];
      const sourceElements = parsedFormElements || formElements;
      const allFields = [];
      const shouldIncludeField = (config) =>
        config && config.editable !== false;
      const pushField = (item, sectionName, config) => {
        const field = {
          label: item.label || item.name,
          name: item.name,
          section: sectionName,
        };
        if (config.type === "enclosure") {
          field.oldValue = item.File?.file || item.File || "";
          field.value = item.File?.file || item.File || null;
        } else {
          field.oldValue = item.value?.toString() || "";
          field.value = item.value?.toString() || "";
        }
        allFields.push(field);
      };
      Object.entries(formDetailsArg).forEach(([sectionName, section]) => {
        if (!Array.isArray(section)) return;
        section.forEach((item) => {
          const fieldType = getFieldTypeByName(sourceElements, item.name);
          const fieldConfig = findFieldConfig(
            item.name,
            fieldType || "text",
            formElements,
          );
          if (!shouldIncludeField(fieldConfig)) return;
          pushField(item, sectionName, fieldConfig);
          if (Array.isArray(item.additionalFields)) {
            item.additionalFields.forEach((addField) => {
              const addFieldConfig = findFieldConfig(
                addField.name,
                addField.type || "text",
                formElements,
              );
              if (!shouldIncludeField(addFieldConfig)) return;
              const additionalField = {
                label: addField.label || addField.name,
                name: addField.name,
                section: sectionName,
              };
              if (addFieldConfig.type === "enclosure") {
                additionalField.oldValue =
                  addField.File?.file || addField.File || "";
                additionalField.value =
                  addField.File?.file || addField.File || null;
              } else {
                additionalField.oldValue = addField.value?.toString() || "";
                additionalField.value = addField.value?.toString() || "";
              }
              allFields.push(additionalField);
            });
          }
        });
      });
      return allFields;
    },
    [findFieldConfig, formElements],
  );

  function getFieldTypeByName(jsonData, fieldName) {
    function searchFields(fields) {
      if (!Array.isArray(fields)) return null;
      for (const field of fields) {
        if (field.name === fieldName) return field.type;
        for (const key in field.additionalFields || {}) {
          const result = searchFields(field.additionalFields[key]);
          if (result) return result;
        }
        for (const key in field.conditionalAdditionalFields || {}) {
          const result = searchFields(field.conditionalAdditionalFields[key]);
          if (result) return result;
        }
      }
      return null;
    }
    for (const section of jsonData) {
      const result = searchFields(section.fields);
      if (result) return result;
    }
    return null;
  }

  const applyTransformations = useCallback((value, transformationFunctions) => {
    let transformedValue = value || "";
    for (const transformFn of transformationFunctions || []) {
      if (TransformationFunctionsList[transformFn])
        transformedValue =
          TransformationFunctionsList[transformFn](transformedValue);
    }
    return transformedValue;
  }, []);

  // Group supporting-document helpers
  const getGroupAnchorField = useCallback((fields, groupId) => {
    const groupIndices = fields
      .map((f, i) => (f.groupId === groupId ? i : -1))
      .filter((i) => i !== -1);
    if (!groupIndices.length) return null;
    return fields[groupIndices[groupIndices.length - 1]];
  }, []);

  const getFieldSupportingDocument = useCallback(
    (field) => {
      if (!field) return null;
      if (field.groupId) return groupSupportingDocuments[field.groupId] || null;
      return field.supportingDocument || null;
    },
    [groupSupportingDocuments],
  );

  // ─────────────────────────────────────────────────────────
  // Deep formDetails lookup — returns undefined when the field
  // does NOT exist (as opposed to findNestedFieldValue, which
  // returns "" for not-found). Needed by visibility evaluation
  // to distinguish "field empty" from "field missing".
  // ─────────────────────────────────────────────────────────
  const findFormDetailValueDeep = useCallback((details, fieldName) => {
    if (!details || typeof details !== "object") return undefined;

    const search = (fields) => {
      if (!Array.isArray(fields)) return undefined;
      for (const f of fields) {
        if (f.name === fieldName) return f.value ?? f.File ?? "";
        if (Array.isArray(f.additionalFields)) {
          const hit = search(f.additionalFields);
          if (hit !== undefined) return hit;
        }
        if (Array.isArray(f.conditionalAdditionalFields)) {
          const hit = search(f.conditionalAdditionalFields);
          if (hit !== undefined) return hit;
        }
      }
      return undefined;
    };

    for (const section of Object.values(details)) {
      if (!Array.isArray(section)) continue;
      const hit = search(section);
      if (hit !== undefined) return hit;
    }
    return undefined;
  }, []);

  // ─────────────────────────────────────────────────────────
  // Visibility condition evaluator
  // ─────────────────────────────────────────────────────────
  const evaluateVisibilityCondition = useCallback(
    (condition, formDetailsArg) => {
      if (
        !condition ||
        !Array.isArray(condition.conditions) ||
        condition.conditions.length === 0
      )
        return true;

      const checkOne = (c) => {
        const actual = findFormDetailValueDeep(formDetailsArg, c.field);
        const expected = c.value ?? "";
        const a = String(actual ?? "");
        const e = String(expected ?? "");

        switch (c.operator) {
          case "equals":
            return a === e;
          case "notEquals":
            return a !== e;
          case "contains":
            return a.toLowerCase().includes(e.toLowerCase());
          case "in":
            return e
              .split(",")
              .map((s) => s.trim())
              .includes(a);
          case "notIn":
            return !e
              .split(",")
              .map((s) => s.trim())
              .includes(a);
          case "isEmpty":
            return a.trim() === "" || a === "undefined" || a === "null";
          case "isNotEmpty":
            return !(a.trim() === "" || a === "undefined" || a === "null");
          default:
            return true;
        }
      };

      return condition.logic === "OR"
        ? condition.conditions.some(checkOne)
        : condition.conditions.every(checkOne);
    },
    [findFormDetailValueDeep],
  );

  // ─────────────────────────────────────────────────────────
  // Same-as-old dynamic policy
  // ─────────────────────────────────────────────────────────
  const isValueSameAsOld = useCallback(
    (field, value) => {
      const cfg = findFieldConfig(field.name);
      if (cfg.type === "date") {
        const toYMD = (s) => {
          if (!s) return null;
          const str = String(s).trim();
          let m;
          if ((m = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)))
            return { y: +m[1], m: +m[2], d: +m[3] };
          if ((m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)))
            return { y: +m[3], m: +m[2], d: +m[1] };
          return null;
        };
        const a = toYMD(value);
        const b = toYMD(field.oldValue);
        if (!a || !b) return String(value) === String(field.oldValue);
        return a.y === b.y && a.m === b.m && a.d === b.d;
      }
      if (cfg.type === "enclosure") {
        if (value instanceof File && field.oldValue?.file)
          return value.name === field.oldValue.file;
        if (value instanceof File) return value.name === (field.oldValue || "");
        return value === field.oldValue;
      }
      return String(value ?? "").trim() === String(field.oldValue ?? "").trim();
    },
    [findFieldConfig],
  );

  const isEmptyNewValue = (f) => {
    if (f.newValue === null || f.newValue === undefined) return true;
    if (typeof f.newValue === "string" && f.newValue.trim() === "") return true;
    if (f.newValue === "Please Select") return true;
    return false;
  };

  const isFieldActuallyChanging = useCallback(
    (f) => !isEmptyNewValue(f) && !isValueSameAsOld(f, f.newValue),
    [isValueSameAsOld],
  );

  const shouldAllowSameAsOldValue = useCallback(
    (field, allFields) => {
      const cfg = findFieldConfig(field.name);

      if (cfg.allowSameAsOldValue === true) return true;

      if (
        field.oldValue === null ||
        field.oldValue === undefined ||
        (typeof field.oldValue === "string" && field.oldValue.trim() === "")
      )
        return true;

      if (field.type === "enclosure" && field.newValue instanceof File)
        return true;

      const others = allFields || [];

      if (field.groupId) {
        const siblingChanging = others.some(
          (f) =>
            f !== field &&
            f.groupId === field.groupId &&
            isFieldActuallyChanging(f),
        );
        if (siblingChanging) return true;
      }

      const childNames = new Set([
        ...(cfg.additionalFields?.[field.newValue] || []).map((c) => c.name),
        ...(cfg.conditionalAdditionalFields?.[field.newValue] || []).map(
          (c) => c.name,
        ),
      ]);
      if (childNames.size > 0) {
        const childChanging = others.some(
          (f) => childNames.has(f.name) && isFieldActuallyChanging(f),
        );
        if (childChanging) return true;
      }

      const parentChanging = others.some((parent) => {
        if (parent === field) return false;
        const parentCfg = findFieldConfig(parent.name);
        const names = [
          ...Object.values(parentCfg.additionalFields || {}).flat(),
          ...Object.values(parentCfg.conditionalAdditionalFields || {}).flat(),
        ].map((c) => c.name);
        return names.includes(field.name) && isFieldActuallyChanging(parent);
      });
      if (parentChanging) return true;

      const driverName = cfg.valueDependentOn || cfg.dependentOn;
      if (driverName) {
        const driver = others.find((f) => f.name === driverName);
        if (driver && isFieldActuallyChanging(driver)) return true;
      }

      const effDoc = field.groupId
        ? groupSupportingDocuments[field.groupId]
        : field.supportingDocument;
      if (effDoc && typeof effDoc !== "string") return true;

      if (cfg.isDependentEnclosure === true) return true;

      return false;
    },
    [findFieldConfig, isFieldActuallyChanging, groupSupportingDocuments],
  );

  const validateUdidNumber = useCallback(
    async (udidNumber, referenceNumberArg) => {
      try {
        const response = await axiosInstance.get(
          "/Officer/GetIfSameUdidNumber",
          { params: { referenceNumber: referenceNumberArg, udidNumber } },
        );
        if (response.data.status) return null;
        return (
          response.data.message ||
          "UDID Number doesn't match the existing one in the record."
        );
      } catch (error) {
        return (
          error.response?.data?.message ||
          "Error validating UDID number. Please try again."
        );
      }
    },
    [],
  );

  const validateField = useCallback(
    async (
      field,
      value,
      formDataArg,
      referenceNumberArg,
      allFields,
      opts = {},
    ) => {
      const fieldConfig = findFieldConfig(
        field.name,
        "text",
        opts.formElementsOverride,
      );

      if (fieldConfig.type === "enclosure") {
        if (value && field.oldValue?.file && value.name === field.oldValue.file)
          return {
            transformedValue: value,
            error: "New file cannot be the same as the old file",
          };
        if (value) {
          if (!(value instanceof File))
            return { transformedValue: value, error: "Invalid file format" };
          const validTypes = fieldConfig.accept
            ? fieldConfig.accept.split(",").map((t) => t.trim())
            : [".pdf"];
          const fileExtension = value.name
            ? `.${value.name.split(".").pop().toLowerCase()}`
            : "";
          if (!validTypes.includes(fileExtension))
            return {
              transformedValue: value,
              error: `File must be one of: ${validTypes.join(", ")}`,
            };
          if (value.size > 5 * 1024 * 1024)
            return { transformedValue: value, error: "File size exceeds 5MB" };
        }
        return { transformedValue: value, error: null };
      }

      // Dynamic reverse-transition check (defense in depth)
      const reversePolicy = fieldConfig.reverseTransitionPolicy;
      if (reversePolicy && reversePolicy.allowed !== true) {
        const oldUpper = String(field.oldValue || "")
          .trim()
          .toUpperCase();
        const newUpper = String(value || "")
          .trim()
          .toUpperCase();
        if (oldUpper === "PERMANENT" && newUpper === "TEMPORARY") {
          return {
            transformedValue: value,
            error:
              reversePolicy.message ||
              "This value cannot be reverted to its previous state.",
          };
        }
      }

      if (!opts.skipSameValueCheck) {
        const same = isValueSameAsOld(field, value);
        if (same && !shouldAllowSameAsOldValue(field, allFields || [])) {
          return {
            transformedValue: value,
            error: "New value cannot be the same as old value",
          };
        }
      }

      const validationResult = await runValidations(
        {
          ...fieldConfig,
          validationFunctions: fieldConfig.validationFunctions || [],
        },
        value,
        formDataArg,
        referenceNumberArg,
      );

      if (field.name === "IfscCode") {
        const isInvalid =
          (typeof validationResult === "object" &&
            validationResult !== null &&
            validationResult.status === false) ||
          typeof validationResult === "string";
        if (isInvalid) return { transformedValue: value, error: null };
      }

      if (validationResult !== true)
        return { transformedValue: value, error: validationResult };

      if (field.name === "UdidCardNumber" && value) {
        const udidValidationResult = await validateUdidNumber(
          value,
          referenceNumberArg,
        );
        if (udidValidationResult !== null)
          return { transformedValue: value, error: udidValidationResult };
      }

      return { transformedValue: value, error: null };
    },
    [
      findFieldConfig,
      isValueSameAsOld,
      shouldAllowSameAsOldValue,
      validateUdidNumber,
    ],
  );

  const validateRemarks = useCallback((value) => {
    if (!value.trim()) return "Remarks are required";
    const words = value
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0);
    if (words.length > MAX_WORDS)
      return `Remarks exceed the maximum of ${MAX_WORDS} words`;
    return null;
  }, []);

  const validateSupportingDocument = useCallback(
    (field, allFields) => {
      if (!field.groupId) {
        return field.supportingDocument
          ? null
          : "Supporting document is required for this field.";
      }

      const anchor = getGroupAnchorField(allFields || [], field.groupId);
      if (!anchor || anchor.name !== field.name) return null;

      const hasGroupDoc =
        !!groupSupportingDocuments[field.groupId] ||
        (allFields || []).some(
          (f) => f.groupId === field.groupId && !!f.supportingDocument,
        );

      return hasGroupDoc
        ? null
        : "Supporting document is required for this group of fields.";
    },
    [groupSupportingDocuments, getGroupAnchorField],
  );

  const validateType = useCallback((value) => {
    return ["Corrigendum", "Correction"].includes(value)
      ? null
      : "Please select a valid type (Corrigendum, Correction)";
  }, []);

  const revalidateAllFields = useCallback(
    async (
      updatedFields,
      formDataArg,
      referenceNumberArg,
      validateRemarksAndFiles = false,
    ) => {
      const newErrors = {};
      for (const field of updatedFields) {
        if (field.newValue) {
          const { error } = await validateField(
            field,
            field.newValue,
            formDataArg,
            referenceNumberArg,
            updatedFields,
          );
          newErrors[field.name] = error;

          const docError = validateSupportingDocument(field, updatedFields);
          newErrors[`${field.name}-doc`] = docError;

          for (const additionalFieldName in field.additionalValues) {
            const additionalFieldConfig = (
              field.additionalFields[field.newValue] || []
            ).find((f) => f.name === additionalFieldName);
            if (additionalFieldConfig) {
              const validationResult = await runValidations(
                {
                  ...additionalFieldConfig,
                  validationFunctions:
                    additionalFieldConfig.validationFunctions || [],
                },
                field.additionalValues[additionalFieldName],
                formDataArg,
                referenceNumberArg,
              );
              newErrors[`${field.name}-${additionalFieldName}`] =
                validationResult === true ? null : validationResult;
            }
          }
        }
      }
      if (validateRemarksAndFiles) {
        newErrors.remarks = validateRemarks(remarks);
        newErrors.type = validateType(type);
      }
      return newErrors;
    },
    [
      validateField,
      validateRemarks,
      validateType,
      validateSupportingDocument,
      remarks,
      type,
    ],
  );

  const collectValidationErrors = useCallback(
    (errs) => {
      const items = [];
      const push = (key, label, message) => items.push({ key, label, message });

      if (errs?.type) push("type", "Document Change Type", errs.type);
      if (errs?.remarks) push("remarks", "Officer Remarks", errs.remarks);
      if (errs?.corrigendumFields)
        push("__top", "Submission", errs.corrigendumFields);

      corrigendumFields.forEach((field) => {
        const label = field.label || field.name;

        if (errs?.[field.name]) push(field.name, label, errs[field.name]);

        if (errs?.[`${field.name}-doc`])
          push(
            field.name,
            `${label} — Supporting Document`,
            errs[`${field.name}-doc`],
          );

        const addFields = field.additionalFields?.[field.newValue] || [];
        addFields.forEach((af) => {
          const ek = `${field.name}-${af.name}`;
          if (errs?.[ek])
            push(field.name, `${label} → ${af.label || af.name}`, errs[ek]);
        });
      });

      return items;
    },
    [corrigendumFields],
  );

  const scrollToField = useCallback((fieldName) => {
    if (
      !fieldName ||
      fieldName === "type" ||
      fieldName === "remarks" ||
      fieldName === "__top"
    )
      return;

    setHighlightedField(fieldName);
    const el = document.querySelector(
      `[data-field-name="${CSS.escape(fieldName)}"]`,
    );
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });

    if (highlightTimer.current) clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => setHighlightedField(null), 2500);
  }, []);

  // ─────────────────────────────────────────────────────────
  // Deep formDetails lookup — returns "" when not found
  // (used by the removedFields effect and handleNewValueChange)
  // ─────────────────────────────────────────────────────────
  const findNestedFieldValue = (formDetailsArg, fieldName) => {
    if (!formDetailsArg || typeof formDetailsArg !== "object") return "";

    const searchFields = (fields) => {
      if (!Array.isArray(fields)) return null;
      for (const sub of fields) {
        if (sub.name === fieldName) return sub.value ?? sub.File ?? "";
        if (sub.additionalFields) {
          const nested = searchFields(sub.additionalFields);
          if (nested !== null && nested !== undefined) return nested;
        }
        if (sub.conditionalAdditionalFields) {
          const nested = searchFields(sub.conditionalAdditionalFields);
          if (nested !== null && nested !== undefined) return nested;
        }
      }
      return null;
    };

    for (const section of Object.values(formDetailsArg)) {
      if (!Array.isArray(section)) continue;
      const result = searchFields(section);
      if (result !== null && result !== undefined) return result;
    }
    return "";
  };

  // ─────────────────────────────────────────────────────────
  // Dynamic RemovedFields derivation
  // ─────────────────────────────────────────────────────────
  const findBucketKey = (obj, key) => {
    if (!obj || !key) return null;
    if (Object.prototype.hasOwnProperty.call(obj, key)) return key;
    const lower = String(key).toLowerCase();
    for (const k of Object.keys(obj)) {
      if (k.toLowerCase() === lower) return k;
    }
    return null;
  };

  useEffect(() => {
    const nextRemovedFields = {};

    corrigendumFields.forEach((parentField) => {
      const oldValue = String(parentField.oldValue || "");
      const newValue = String(parentField.newValue || "");

      if (!oldValue || !newValue || oldValue === newValue) return;

      const oldKey = findBucketKey(parentField.additionalFields, oldValue);
      const newKey = findBucketKey(parentField.additionalFields, newValue);
      const oldCondKey = findBucketKey(
        parentField.conditionalAdditionalFields,
        oldValue,
      );
      const newCondKey = findBucketKey(
        parentField.conditionalAdditionalFields,
        newValue,
      );

      const oldChildren = [
        ...(oldKey ? parentField.additionalFields[oldKey] : []),
        ...(oldCondKey
          ? parentField.conditionalAdditionalFields[oldCondKey]
          : []),
      ];
      const newChildren = [
        ...(newKey ? parentField.additionalFields[newKey] : []),
        ...(newCondKey
          ? parentField.conditionalAdditionalFields[newCondKey]
          : []),
      ];

      const newChildNames = new Set(newChildren.map((c) => c.name));

      oldChildren.forEach((child) => {
        if (newChildNames.has(child.name)) return;
        if (nextRemovedFields[child.name]) return;

        const oldChildValue = findNestedFieldValue(formDetails, child.name);

        nextRemovedFields[child.name] = {
          oldValue: oldChildValue,
          label: child.label || child.name,
          reason: `${parentField.label || parentField.name} changed from "${oldValue}" to "${newValue}"`,
        };
      });
    });

    setRemovedFields((prev) => {
      const merged = { ...nextRemovedFields };
      Object.keys(merged).forEach((name) => {
        if (!merged[name].oldValue && prev[name]?.oldValue) {
          merged[name].oldValue = prev[name].oldValue;
        }
      });
      return merged;
    });
  }, [corrigendumFields, formDetails]);

  const handleCheckIfDocumentChange = useCallback(async () => {
    if (!existingCorrigendumId && !type) {
      if (!applicationType)
        setErrors((prev) => ({
          ...prev,
          type: "Please select a type (Corrigendum or Correction)",
        }));
      return;
    }
    if (!existingCorrigendumId && (!referenceNumber || !serviceId)) {
      setResponseMessage({
        message: "Please provide both reference number and service.",
        type: "error",
      });
      return;
    }
    setLoading(true);
    setResponseMessage({ message: "", type: "" });
    try {
      const params = existingCorrigendumId
        ? {
            referenceNumber: ReferenceNumber || referenceNumber,
            serviceId: ServiceId || serviceId,
            applicationId: existingCorrigendumId,
            type: type || applicationType,
          }
        : { referenceNumber, serviceId, type: type || applicationType };
      const response = await axiosInstance.get(
        "/Officer/GetApplicationForCorrigendum",
        { params },
      );
      const result = response.data;
      if (result.status) {
        let parsedFormElements = [];
        if (typeof result.formElements === "string") {
          try {
            parsedFormElements = JSON.parse(result.formElements);
          } catch {
            setResponseMessage({
              message: "Invalid form elements data from server.",
              type: "error",
            });
            setCanIssue(false);
            setLoading(false);
            return;
          }
        } else if (Array.isArray(result.formElements))
          parsedFormElements = result.formElements;
        else {
          setResponseMessage({
            message: "Unexpected form elements format from server.",
            type: "error",
          });
          setCanIssue(false);
          setLoading(false);
          return;
        }
        setFormElements(parsedFormElements);
        setFormDetailsFields(
          normalizeDetails(result.formDetails, parsedFormElements),
        );
        setFormDetails(result.formDetails || {});
        const canIssueNow =
          result.canEdit ||
          result.isCurrentOfficer ||
          (result.corrigendumType === type && !result.existingCorrigendumId);
        setCanIssue(canIssueNow);
        if (result.existingCorrigendumId) {
          setIsEdit(true);
          setExistingCorrigendumId(result.existingCorrigendumId);
          setCanEditExisting(result.canEdit);
        } else if (existingCorrigendumId) {
          setIsEdit(false);
          setCanEditExisting(false);
        } else {
          setIsEdit(false);
          setCanEditExisting(true);
        }
        setNextOfficer(result.nextOfficer);

        // ─────────────────────────────────────────────────────────
        // 1) Prefer visibilityCondition that the backend forwarded.
        // 2) If the backend dropped it, fetch Documentfields directly
        //    from /Designer/GetDocumentFields and merge by label/name.
        //    This is required because the backend's allowedForDetails
        //    rebuilds each item and may not carry visibilityCondition.
        // ─────────────────────────────────────────────────────────
        const anyConditionPresent = (result.allowedForDetails || []).some(
          (i) => i.visibilityCondition || i.visibility_condition,
        );

        const docVisibilityByKey = {};
        if (!anyConditionPresent) {
          const effectiveServiceId = ServiceId || serviceId;
          const effectiveType =
            type || applicationType || result.corrigendumType;

          try {
            const docRes = await axiosInstance.get(
              "/Designer/GetDocumentFields",
              { params: { serviceId: effectiveServiceId } },
            );
            if (docRes.data.status && docRes.data.documentFields) {
              const list = docRes.data.documentFields[effectiveType] || [];
              for (const entry of list) {
                if (
                  entry &&
                  typeof entry === "object" &&
                  !Array.isArray(entry)
                ) {
                  const key = entry.label || entry.name;
                  const cond =
                    entry.visibilityCondition ||
                    entry.visibility_condition ||
                    null;
                  if (key && cond) docVisibilityByKey[key] = cond;
                }
              }
            }
          } catch (e) {
            // ignore — fall back to whatever the backend sent
          }
        }

        const mergedItems = (result.allowedForDetails || []).map((item) => {
          const key = item.label || item.name;
          const backendCond =
            item.visibilityCondition || item.visibility_condition || null;
          const visibility = backendCond || docVisibilityByKey[key] || null;
          return { ...item, __visibility: visibility };
        });

        const visibleItems = mergedItems.filter((item) =>
          evaluateVisibilityCondition(item.__visibility, result.formDetails),
        );

        const mappedAllowedFields = visibleItems.map((item) => {
          const visibility = item.__visibility;

          if (item.isGroup || Array.isArray(item.fields)) {
            return {
              label: item.label,
              name: item.name || item.label,
              isGroup: true,
              fields: item.fields,
              visibilityCondition: visibility,
              value: `group|${item.label}`,
            };
          }
          return {
            label: item.label,
            name: item.name,
            type: item.type || "text",
            isGroup: false,
            visibilityCondition: visibility,
            value: `${item.label}|${item.name}`,
          };
        });
        setAllowedFormFields(mappedAllowedFields);

        if (isEdit || result.existingCorrigendumId) {
          setColumns(result.columns || []);
          setData(result.data || []);
          setType(result.corrigendumType || type || applicationType);
          const words = result.remarks
            ? result.remarks
                .trim()
                .split(/\s+/)
                .filter((word) => word.length > 0)
            : [];
          setWordCount(words.length);
          setRemarks(result.remarks || "");
        }
        let newCorrigendumFields = [];
        let newErrors = {};
        let hydratedRemovals = {};
        if (
          (isEdit || result.existingCorrigendumId) &&
          result.corrigendumFields
        ) {
          let corrigendumFieldsData =
            typeof result.corrigendumFields === "string"
              ? JSON.parse(result.corrigendumFields)
              : result.corrigendumFields;

          if (corrigendumFieldsData.RemovedFields) {
            for (const [name, info] of Object.entries(
              corrigendumFieldsData.RemovedFields,
            )) {
              hydratedRemovals[name] = {
                oldValue: info.old_value || "",
                label: info.label || name,
                reason: info.reason || "Removed by this corrigendum",
              };
            }
          }

          for (const [name, fieldData] of Object.entries(
            corrigendumFieldsData,
          )) {
            if (name === "Files" || name === "RemovedFields") continue;
            const isGroup =
              typeof fieldData === "object" && !fieldData.new_value;
            if (isGroup) {
              for (const [subName, subFieldData] of Object.entries(fieldData)) {
                const fieldConfig = findFieldConfig(
                  subName,
                  subFieldData.type || "text",
                  parsedFormElements,
                );
                const formDetail = normalizeDetails(result.formDetails).find(
                  (item) => item.name === subName,
                );
                let oldValue = formDetail ? formDetail.oldValue : "";
                if (fieldConfig.type === "enclosure") {
                  oldValue = formDetail
                    ? formDetail.oldValue
                    : { file: null, label: subName };
                }
                const newField = {
                  label: formDetail ? formDetail.label : subName,
                  name: subName,
                  oldValue,
                  newValue:
                    subFieldData.new_value ||
                    (fieldConfig.type === "enclosure" ? null : ""),
                  additionalValues: subFieldData.additional_values || {},
                  type: fieldConfig.type,
                  options: fieldConfig.options || [
                    { label: "Please Select", value: "Please Select" },
                  ],
                  validationFunctions: fieldConfig.validationFunctions || [],
                  transformationFunctions:
                    fieldConfig.transformationFunctions || [],
                  additionalFields: fieldConfig.additionalFields || {},
                  conditionalAdditionalFields:
                    fieldConfig.conditionalAdditionalFields || {},
                  accept: fieldConfig.accept || ".pdf",
                  supportingDocument: subFieldData.supporting_document || null,
                  groupId: name,
                };
                newCorrigendumFields.push(newField);
                const { error } = await validateField(
                  newField,
                  newField.newValue,
                  formData,
                  result.application.ReferenceNumber,
                  newCorrigendumFields,
                  {
                    skipSameValueCheck: true,
                    formElementsOverride: parsedFormElements,
                  },
                );
                newErrors[newField.name] = error;
              }
            } else {
              const fieldConfig = findFieldConfig(
                name,
                fieldData.type || "text",
                parsedFormElements,
              );
              const formDetail = normalizeDetails(result.formDetails).find(
                (item) => item.name === name,
              );
              let oldValue = formDetail ? formDetail.oldValue : "";
              if (fieldConfig.type === "enclosure") {
                oldValue = formDetail
                  ? formDetail.oldValue
                  : { file: null, label: name };
              }
              const newField = {
                label: formDetail ? formDetail.label : name,
                name,
                oldValue,
                newValue:
                  fieldData.new_value ||
                  (fieldConfig.type === "enclosure" ? null : ""),
                additionalValues: fieldData.additional_values || {},
                type: fieldConfig.type,
                options: fieldConfig.options || [
                  { label: "Please Select", value: "Please Select" },
                ],
                validationFunctions: fieldConfig.validationFunctions || [],
                transformationFunctions:
                  fieldConfig.transformationFunctions || [],
                additionalFields: fieldConfig.additionalFields || {},
                conditionalAdditionalFields:
                  fieldConfig.conditionalAdditionalFields || {},
                accept: fieldConfig.accept || ".pdf",
                supportingDocument: fieldData.supporting_document || null,
              };
              newCorrigendumFields.push(newField);
              const { error } = await validateField(
                newField,
                newField.newValue,
                formData,
                result.application.ReferenceNumber,
                newCorrigendumFields,
                {
                  skipSameValueCheck: true,
                  formElementsOverride: parsedFormElements,
                },
              );
              newErrors[newField.name] = error;
            }
          }
        }

        const newGroupDocs = {};
        newCorrigendumFields.forEach((f) => {
          if (f.groupId && f.supportingDocument) {
            if (!newGroupDocs[f.groupId])
              newGroupDocs[f.groupId] = f.supportingDocument;
            f.supportingDocument = null;
          }
        });

        setGroupSupportingDocuments(newGroupDocs);
        setCorrigendumFields(newCorrigendumFields);
        setRemovedFields(hydratedRemovals);
        setErrors(newErrors);

        const newFormData = {};
        normalizeDetails(result.formDetails).forEach((item) => {
          newFormData[item.name] = item.value || (item.File ? item.File : "");
        });
        setFormData(newFormData);
        if (result.existingCorrigendumId) {
          if (result.canEdit)
            setResponseMessage({
              message: `Found an existing ${type.toLowerCase()} at your level. You can now edit and forward it.`,
              type: "info",
            });
          else
            setResponseMessage({
              message: `Found an existing ${type.toLowerCase()}. You can view but not edit it.`,
              type: "warning",
            });
        } else if (existingCorrigendumId) {
          setResponseMessage({
            message: `No existing ${type.toLowerCase()} found with the provided ID. You can create a new one.`,
            type: "warning",
          });
          setIsEdit(false);
          setExistingCorrigendumId(null);
          setCanEditExisting(false);
        } else {
          setResponseMessage({
            message: `Application found. You can issue a ${type.toLowerCase()}.`,
            type: "success",
          });
        }
      } else {
        setResponseMessage({
          message:
            result.message || `No application found for the provided details.`,
          type: "error",
        });
      }
    } catch (error) {
      console.error(`Error in handleCheckIf${type}:`, error);
      setResponseMessage({
        message:
          error.response?.data?.message ||
          `Error checking application for ${type.toLowerCase()}. Please try again.`,
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [
    type,
    existingCorrigendumId,
    referenceNumber,
    serviceId,
    ReferenceNumber,
    ServiceId,
    normalizeDetails,
    findFieldConfig,
    isEdit,
    formData,
    validateField,
    applicationType,
    evaluateVisibilityCondition,
  ]);

  const handleNewValueChange = useCallback(
    (index, value, additionalFieldName = null, skipStateUpdate = false) => {
      const field = corrigendumFields[index];
      if (!field) return;
      let transformedValue;
      const changedFieldName = additionalFieldName || field.name;
      const changedField = additionalFieldName
        ? (field.additionalFields[field.newValue] || []).find(
            (f) => f.name === additionalFieldName,
          )
        : field;
      if (!changedField) return;
      if (additionalFieldName) {
        const additionalFieldConfig = (
          field.additionalFields[field.newValue] || []
        ).find((f) => f.name === additionalFieldName);
        if (!additionalFieldConfig) return;
        transformedValue = applyTransformations(
          value,
          additionalFieldConfig.transformationFunctions,
        );
        if (additionalFieldConfig.type === "select") {
          const validOptions = additionalFieldConfig.options || [];
          if (
            value !== "" &&
            value !== "Please Select" &&
            !validOptions.some(
              (opt) => opt.value.toString() === value.toString(),
            )
          )
            return;
        }
        if (!skipStateUpdate) {
          const tempUpdated = [...corrigendumFields];
          tempUpdated[index].additionalValues = {
            ...tempUpdated[index].additionalValues,
            [additionalFieldName]: transformedValue,
          };
          setCorrigendumFields(tempUpdated);
          runValidations(
            {
              ...additionalFieldConfig,
              validationFunctions:
                additionalFieldConfig.validationFunctions || [],
            },
            transformedValue,
            formData,
            referenceNumber,
          ).then((validationResult) => {
            setErrors((prev) => ({
              ...prev,
              [`${field.name}-${additionalFieldName}`]:
                validationResult === true ? null : validationResult,
            }));
          });
        }
      } else {
        transformedValue = applyTransformations(
          value,
          field.transformationFunctions,
        );
        if (field.type === "select") {
          const validOptions = field.options || [];
          if (
            value !== "" &&
            value !== "Please Select" &&
            !validOptions.some(
              (opt) => opt.value.toString() === value.toString(),
            )
          )
            return;
        }

        // Dynamic reverse-transition guard (defense in depth)
        const reverseCfg = findFieldConfig(field.name).reverseTransitionPolicy;
        if (reverseCfg && reverseCfg.allowed !== true) {
          const oldUpper = String(field.oldValue || "")
            .trim()
            .toUpperCase();
          const newUpper = String(value || "")
            .trim()
            .toUpperCase();
          if (oldUpper === "PERMANENT" && newUpper === "TEMPORARY") {
            setErrors((prev) => ({
              ...prev,
              [field.name]:
                reverseCfg.message ||
                "This value cannot be reverted to its previous state.",
            }));
            return;
          }
        }

        if (!skipStateUpdate) {
          const tempUpdated = [...corrigendumFields];
          tempUpdated[index].newValue = transformedValue;

          const additionalFieldsList =
            field.additionalFields?.[transformedValue] || [];
          const conditionalFieldsList =
            field.conditionalAdditionalFields?.[transformedValue] || [];
          const conditionalFields = [
            ...additionalFieldsList,
            ...conditionalFieldsList,
          ];

          const existingConditionalFieldNames = corrigendumFields.map(
            (f) => f.name,
          );
          const fieldsToAdd = [];
          const fieldsToRemove = [];
          corrigendumFields.forEach((f, i) => {
            if (
              i !== index &&
              (field.additionalFields || field.conditionalAdditionalFields) &&
              (Object.values(field.additionalFields || {})
                .flat()
                .some((cf) => cf.name === f.name) ||
                Object.values(field.conditionalAdditionalFields || {})
                  .flat()
                  .some((cf) => cf.name === f.name)) &&
              !conditionalFields.some((cf) => cf.name === f.name)
            )
              fieldsToRemove.push(i);
          });
          conditionalFields.forEach((condField) => {
            if (!existingConditionalFieldNames.includes(condField.name)) {
              const oldValue = findNestedFieldValue(
                formDetails,
                condField.name,
              );
              const newField = {
                label: condField.label || condField.name,
                name: condField.name,
                oldValue,
                newValue: condField.type === "enclosure" ? null : "",
                additionalValues: {},
                type: condField.type || "text",
                options: condField.options || [
                  { label: "Please Select", value: "Please Select" },
                ],
                validationFunctions: condField.validationFunctions || [],
                transformationFunctions:
                  condField.transformationFunctions || [],
                additionalFields: condField.additionalFields || {},
                conditionalAdditionalFields:
                  condField.conditionalAdditionalFields || {},
                accept: condField.accept || ".pdf",
                supportingDocument: null,
                groupId: field.groupId || null,
              };
              fieldsToAdd.push(newField);
            }
          });
          let newCorrigendumFields = tempUpdated.filter(
            (_, i) => !fieldsToRemove.includes(i),
          );
          newCorrigendumFields = [...newCorrigendumFields, ...fieldsToAdd];
          setCorrigendumFields(newCorrigendumFields);
          revalidateAllFields(
            newCorrigendumFields,
            { ...formData, [changedFieldName]: transformedValue },
            referenceNumber,
            true,
          ).then((newErrors) => {
            setErrors(newErrors);
          });
        }
      }
      setFormData((prev) => ({
        ...prev,
        [changedFieldName]: transformedValue,
      }));
      if (
        changedField &&
        changedField.type === "select" &&
        /district|tehsil|muncipality|ward|block|halqapanchayat|village/i.test(
          changedFieldName,
        )
      )
        handleAreaChange(index, changedFieldName, transformedValue);
    },
    [
      corrigendumFields,
      applyTransformations,
      handleAreaChange,
      formDetails,
      revalidateAllFields,
      formData,
      referenceNumber,
      findFieldConfig,
    ],
  );

  const handleNewValueBlur = useCallback(
    async (index, value, additionalFieldName = null) => {
      const updated = [...corrigendumFields];
      const field = updated[index];
      if (!field) return;
      let error;
      if (additionalFieldName) {
        const additionalFieldConfig = (
          field.additionalFields[field.newValue] || []
        ).find((f) => f.name === additionalFieldName);
        if (!additionalFieldConfig) return;
        const validationResult = await runValidations(
          {
            ...additionalFieldConfig,
            validationFunctions:
              additionalFieldConfig.validationFunctions || [],
          },
          field.additionalValues[additionalFieldName],
          formData,
          referenceNumber,
        );
        error = validationResult === true ? null : validationResult;
        setErrors((prev) => ({
          ...prev,
          [`${field.name}-${additionalFieldName}`]: error,
        }));
      } else {
        const result = await validateField(
          field,
          field.newValue,
          formData,
          referenceNumber,
          updated,
        );
        error = result.error;
        setErrors((prev) => ({ ...prev, [field.name]: error }));
      }
      const newErrors = await revalidateAllFields(
        updated,
        formData,
        referenceNumber,
        true,
      );
      setErrors(newErrors);
    },
    [
      corrigendumFields,
      formData,
      referenceNumber,
      validateField,
      revalidateAllFields,
    ],
  );

  const handleAddCorrigendumField = useCallback(() => {
    if (!selectedField) {
      setErrors((prev) => ({
        ...prev,
        selectedField: "Please select a field to add.",
      }));
      return;
    }
    const selectedOption = allowedFormFields.find(
      (f) => f.value === selectedField,
    );
    if (!selectedOption) {
      setErrors((prev) => ({
        ...prev,
        selectedField: "Invalid field selected.",
      }));
      return;
    }
    const newFields = [];

    const addFieldToCorrigendum = (field, groupId = null) => {
      if (corrigendumFields.some((f) => f.name === field.name)) return;
      const formDetail = formDetailsFields.find((d) => d.name === field.name);
      const inferredType =
        field.type || getFieldTypeByName(formElements, field.name) || "text";
      const fieldConfig = findFieldConfig(field.name, inferredType);
      if (!fieldConfig) return;

      let oldValue = formDetail ? formDetail.oldValue : "";
      if (fieldConfig.type === "enclosure") {
        oldValue = formDetail
          ? formDetail.oldValue
          : { file: null, label: field.name };
      }

      newFields.push({
        label: fieldConfig.label || field.label || field.name,
        name: field.name,
        oldValue,
        newValue: fieldConfig.type === "enclosure" ? null : "",
        additionalValues: {},
        type: fieldConfig.type,
        options: fieldConfig.options || [
          { label: "Please Select", value: "Please Select" },
        ],
        maxLength: fieldConfig.maxLength || null,
        validationFunctions: fieldConfig.validationFunctions || [],
        transformationFunctions: fieldConfig.transformationFunctions || [],
        additionalFields: fieldConfig.additionalFields || {},
        accept: fieldConfig.accept || ".pdf",
        supportingDocument: null,
        groupId: groupId,
      });
    };

    if (selectedOption.isGroup) {
      selectedOption.fields.forEach((f) =>
        addFieldToCorrigendum(f, selectedOption.name || selectedOption.label),
      );
    } else {
      addFieldToCorrigendum(selectedOption);
    }

    if (newFields.length > 0) {
      setCorrigendumFields((prev) => [...prev, ...newFields]);
      revalidateAllFields(
        [...corrigendumFields, ...newFields],
        formData,
        referenceNumber,
      ).then((newErrors) => setErrors(newErrors));
    }
    setSelectedField("");
    setErrors((prev) => ({ ...prev, selectedField: null }));
  }, [
    selectedField,
    allowedFormFields,
    corrigendumFields,
    formDetailsFields,
    findFieldConfig,
    formElements,
    formData,
    referenceNumber,
    revalidateAllFields,
  ]);

  const handleDeleteField = useCallback(
    (index) => {
      const deletedField = corrigendumFields[index];
      const updatedFields = corrigendumFields.filter((_, i) => i !== index);

      if (deletedField?.groupId) {
        const groupStillExists = updatedFields.some(
          (f) => f.groupId === deletedField.groupId,
        );
        if (!groupStillExists) {
          setGroupSupportingDocuments((prev) => {
            const next = { ...prev };
            delete next[deletedField.groupId];
            return next;
          });
        }
      }

      setCorrigendumFields(updatedFields);
      setRenderKey((prev) => prev + 1);
      revalidateAllFields(updatedFields, formData, referenceNumber, true).then(
        (newErrors) => setErrors(newErrors),
      );
    },
    [corrigendumFields, formData, referenceNumber, revalidateAllFields],
  );

  const handleSupportingDocumentChange = useCallback(
    (index, file) => {
      const field = corrigendumFields[index];
      if (!field) return;

      if (field.groupId) {
        setGroupSupportingDocuments((prev) => ({
          ...prev,
          [field.groupId]: file,
        }));
        setErrors((prev) => {
          const next = { ...prev };
          corrigendumFields.forEach((f) => {
            if (f.groupId === field.groupId) delete next[`${f.name}-doc`];
          });
          return next;
        });
      } else {
        const updated = [...corrigendumFields];
        updated[index].supportingDocument = file;
        setCorrigendumFields(updated);
        setErrors((prev) => ({ ...prev, [`${field.name}-doc`]: null }));
      }
    },
    [corrigendumFields],
  );

  const handleRemoveSupportingDocument = useCallback(
    (index) => {
      const field = corrigendumFields[index];
      if (!field) return;

      if (field.groupId) {
        setGroupSupportingDocuments((prev) => {
          const next = { ...prev };
          delete next[field.groupId];
          return next;
        });
        setErrors((prev) => ({
          ...prev,
          [`${field.name}-doc`]:
            "Supporting document is required for this group of fields.",
        }));
      } else {
        const updated = [...corrigendumFields];
        updated[index].supportingDocument = null;
        setCorrigendumFields(updated);
        setErrors((prev) => ({
          ...prev,
          [`${field.name}-doc`]: validateSupportingDocument(
            updated[index],
            updated,
          ),
        }));
      }
    },
    [corrigendumFields, validateSupportingDocument],
  );

  const handleRemarksChange = useCallback((e) => {
    const value = e.target.value;
    const words = value
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0);
    if (words.length <= MAX_WORDS) {
      setRemarks(value);
      setWordCount(words.length);
    }
  }, []);

  const handleRemarksBlur = useCallback(() => {
    setTouched((prev) => ({ ...prev, remarks: true }));
    const error = validateRemarks(remarks);
    setErrors((prev) => ({ ...prev, remarks: error }));
  }, [remarks, validateRemarks]);

  const handleTypeBlur = useCallback(() => {
    setTouched((prev) => ({ ...prev, type: true }));
    setErrors((prev) => ({ ...prev, type: validateType(type) }));
  }, [type, validateType]);

  const handleServiceChange = useCallback(
    (newServiceId) => {
      if (!isEdit && !isInitialLoad && serviceId !== newServiceId) {
        resetFormState();
        setServiceId(newServiceId);
      } else setServiceId(newServiceId);
    },
    [isEdit, isInitialLoad, serviceId, resetFormState],
  );

  const handleReferenceNumberChange = useCallback(
    (e) => {
      const newReferenceNumber = e.target.value;
      if (!isEdit && !isInitialLoad && referenceNumber !== newReferenceNumber) {
        resetFormState();
        setReferenceNumber(newReferenceNumber);
      } else setReferenceNumber(newReferenceNumber);
    },
    [isEdit, isInitialLoad, referenceNumber, resetFormState],
  );

  const handleViewFile = useCallback((file, isServerFile = false) => {
    let url;
    if (isServerFile) {
      url = `/Uploads/${file}`;
      setSelectedFileName(file);
    } else {
      url = URL.createObjectURL(file);
      setSelectedFileName(file.name);
    }
    setOpenModal(true);
    return () => {
      if (!isServerFile && url) URL.revokeObjectURL(url);
    };
  }, []);

  const handleCloseModal = useCallback(() => {
    setOpenModal(false);
    setSelectedFileName("");
  }, []);

  const generateCorrigendumObject = useCallback(() => {
    const anchorByGroup = {};
    corrigendumFields.forEach((f) => {
      if (f.groupId) anchorByGroup[f.groupId] = f.name;
    });

    const result = corrigendumFields.reduce((acc, field) => {
      let supportingDocValue = null;

      if (field.groupId) {
        if (anchorByGroup[field.groupId] === field.name) {
          const doc = groupSupportingDocuments[field.groupId];
          if (doc)
            supportingDocValue = typeof doc === "string" ? doc : doc.name;
        }
      } else if (field.supportingDocument) {
        supportingDocValue =
          typeof field.supportingDocument === "string"
            ? field.supportingDocument
            : field.supportingDocument.name;
      }

      acc[field.name] = {
        old_value:
          field.type === "enclosure" ? field.oldValue || "" : field.oldValue,
        new_value:
          field.type === "enclosure"
            ? field.newValue
              ? field.newValue.name
              : null
            : field.newValue,
        additional_values: field.additionalValues || {},
        supporting_document: supportingDocValue,
      };
      return acc;
    }, {});

    if (Object.keys(removedFields).length > 0) {
      result.RemovedFields = Object.entries(removedFields).reduce(
        (acc, [name, info]) => {
          acc[name] = {
            old_value: info.oldValue || "",
            label: info.label || name,
            reason: info.reason || "Removed by this corrigendum",
          };
          return acc;
        },
        {},
      );
    }

    return result;
  }, [corrigendumFields, groupSupportingDocuments, removedFields]);

  const handleSubmitDocumentChange = useCallback(async () => {
    const preflight = [];
    if (!type) {
      preflight.push({
        key: "type",
        label: "Document Change Type",
        message: "Please select a type (Corrigendum or Correction).",
      });
    }
    if (corrigendumFields.length === 0) {
      preflight.push({
        key: "__top",
        label: "Fields",
        message: `Please add at least one field to submit the ${(
          type || "document change"
        ).toLowerCase()}.`,
      });
    }
    if (preflight.length > 0) {
      setValidationPopup({ open: true, items: preflight });
      return;
    }

    setTouched((prev) => ({ ...prev, remarks: true, type: true }));
    const newErrors = await revalidateAllFields(
      corrigendumFields,
      formData,
      referenceNumber,
      true,
    );
    const merged = { ...newErrors };

    const groupHasDoc = {};
    corrigendumFields.forEach((f) => {
      if (f.groupId) {
        if (groupHasDoc[f.groupId] === undefined)
          groupHasDoc[f.groupId] = false;
        if (groupSupportingDocuments[f.groupId]) groupHasDoc[f.groupId] = true;
        if (f.supportingDocument) groupHasDoc[f.groupId] = true;
      }
    });

    const missingGroupDoc = corrigendumFields.some((field) => {
      if (field.groupId) return !groupHasDoc[field.groupId];
      return !field.supportingDocument;
    });
    const hasEmptyNewValue = corrigendumFields.some((f) => !f.newValue);
    const hasValidationErrors = Object.values(newErrors).some(
      (error) => error !== null && error !== undefined,
    );

    if (missingGroupDoc && !merged.corrigendumFields) {
      merged.corrigendumFields =
        "All fields or groups must have a supporting document uploaded.";
    } else if (
      hasEmptyNewValue &&
      !missingGroupDoc &&
      !merged.corrigendumFields
    ) {
      merged.corrigendumFields = `Please fill in all new values before submitting the ${type.toLowerCase()}.`;
    } else if (
      hasValidationErrors &&
      !missingGroupDoc &&
      !hasEmptyNewValue &&
      !merged.corrigendumFields
    ) {
      merged.corrigendumFields = `Please correct all validation errors before submitting the ${type.toLowerCase()}.`;
    }

    setErrors(merged);

    const items = collectValidationErrors(merged);
    if (items.length > 0) {
      setValidationPopup({ open: true, items });
      return;
    }

    setLoading(true);
    setResponseMessage({ message: "", type: "" });
    try {
      const corrigendumObject = generateCorrigendumObject();
      try {
        JSON.parse(JSON.stringify(corrigendumObject));
      } catch {
        setResponseMessage({
          message: `Invalid ${type.toLowerCase()} fields format.`,
          type: "error",
        });
        setLoading(false);
        return;
      }
      const formDataToSend = new FormData();
      formDataToSend.append("referenceNumber", referenceNumber);
      formDataToSend.append("remarks", remarks);
      formDataToSend.append("serviceId", serviceId);
      formDataToSend.append("type", type);
      formDataToSend.append(
        "corrigendumFields",
        JSON.stringify(corrigendumObject),
      );
      if (existingCorrigendumId)
        formDataToSend.append("applicationId", existingCorrigendumId);

      corrigendumFields.forEach((field) => {
        if (
          !field.groupId &&
          field.supportingDocument &&
          typeof field.supportingDocument !== "string"
        ) {
          formDataToSend.append(
            `fieldSupportingDocuments[${field.name}]`,
            field.supportingDocument,
          );
        }
      });

      const anchorByGroup = {};
      corrigendumFields.forEach((f) => {
        if (f.groupId) anchorByGroup[f.groupId] = f.name;
      });
      Object.entries(groupSupportingDocuments).forEach(([groupId, doc]) => {
        const anchorName = anchorByGroup[groupId];
        if (!anchorName) return;
        if (doc && typeof doc !== "string") {
          formDataToSend.append(`fieldSupportingDocuments[${anchorName}]`, doc);
        }
      });

      const response = await axiosInstance.post(
        "/Officer/SubmitDocumentChange",
        formDataToSend,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      if (response.data.status) {
        setSuccessDetails({
          message: response.data.message || `${type} submitted successfully!`,
          referenceNumber,
          type,
        });
        setShowSuccessMessage(true);
        setTimeout(() => {
          resetFormState();
          setReferenceNumber("");
          setServiceId("");
          setType("");
          setIsEdit(false);
          setFormDetailsFields([]);
          setFormElements([]);
          setAllowedFormFields([]);
          setExistingCorrigendumId(null);
        }, 100);
      } else {
        setResponseMessage({
          message:
            response.data.message || `Failed to submit ${type.toLowerCase()}.`,
          type: "error",
        });
      }
    } catch (error) {
      setResponseMessage({
        message:
          error.response?.data?.message ||
          `Error submitting ${type.toLowerCase()}. Please try again.`,
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [
    type,
    corrigendumFields,
    groupSupportingDocuments,
    formData,
    referenceNumber,
    remarks,
    serviceId,
    existingCorrigendumId,
    generateCorrigendumObject,
    resetFormState,
    revalidateAllFields,
    collectValidationErrors,
    removedFields,
  ]);

  if (loading) {
    return (
      <Box
        sx={{
          width: "100%",
          height: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          bgcolor: "#F8FAFC",
        }}
      >
        <CircularProgress size={60} sx={{ color: "#2562E9" }} />
      </Box>
    );
  }

  if (showSuccessMessage) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: "#F8FAFC",
          p: 3,
        }}
      >
        <Paper
          sx={{
            p: 6,
            maxWidth: 500,
            width: "100%",
            textAlign: "center",
            borderRadius: 3,
            border: "1px solid #E2E8F0",
          }}
        >
          <Box
            sx={{
              width: 80,
              height: 80,
              borderRadius: "50%",
              bgcolor: "#D1FAE5",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              mx: "auto",
              mb: 3,
            }}
          >
            <CheckCircleOutline sx={{ fontSize: 48, color: "#059669" }} />
          </Box>
          <Typography
            variant="h5"
            sx={{ fontWeight: 700, color: "#0F172A", mb: 1 }}
          >
            {successDetails.type} Submitted Successfully
          </Typography>
          <Typography variant="body1" sx={{ color: "#475569", mb: 3 }}>
            {successDetails.message}
          </Typography>
          <Divider sx={{ my: 3 }} />
          <Stack
            direction="row"
            justifyContent="space-between"
            sx={{ mb: 1.5 }}
          >
            <Typography variant="body2" color="text.secondary">
              Reference Number:
            </Typography>
            <Typography variant="body2" fontWeight={600}>
              {successDetails.referenceNumber}
            </Typography>
          </Stack>
          <Stack direction="row" justifyContent="space-between" sx={{ mb: 3 }}>
            <Typography variant="body2" color="text.secondary">
              Type:
            </Typography>
            <Typography variant="body2" fontWeight={600}>
              {successDetails.type}
            </Typography>
          </Stack>
          <Button
            variant="contained"
            fullWidth
            onClick={handleStartNew}
            sx={{
              bgcolor: "#2562E9",
              "&:hover": { bgcolor: "#1D4ED8" },
              textTransform: "none",
              fontWeight: 600,
              py: 1.5,
              borderRadius: 2,
            }}
          >
            Submit Another {successDetails.type || "Document Change"}
          </Button>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ bgcolor: "#F8FAFC", minHeight: "100vh", py: 4 }}>
      <Container maxWidth="lg">
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1 }}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: 2,
                bgcolor: "#EFF6FF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <EditNote sx={{ fontSize: 28, color: "#2562E9" }} />
            </Box>
            <Box>
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 800,
                  color: "#0F172A",
                  letterSpacing: "-0.5px",
                }}
              >
                {isEdit || existingCorrigendumId
                  ? `Edit ${type}`
                  : `Issue ${type || "Corrigendum/Correction"}`}
              </Typography>
              <Typography variant="body2" sx={{ color: "#64748B" }}>
                Update application details and forward for approval
              </Typography>
            </Box>
          </Box>
        </Box>

        <Paper
          elevation={0}
          sx={{
            p: 3,
            mb: 4,
            borderRadius: 3,
            border: "1px solid #E2E8F0",
            bgcolor: "white",
          }}
        >
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={4}>
              <ServiceSelectionForm
                services={services}
                value={serviceId}
                onServiceSelect={handleServiceChange}
                disabled={isEdit || existingCorrigendumId}
              />
            </Grid>
            <Grid item xs={4}>
              <Autocomplete
                value={type}
                onChange={(event, newValue) => {
                  if (!isEdit && !isInitialLoad && type !== newValue) {
                    resetFormState();
                    setType(newValue);
                  } else setType(newValue);
                  setTouched((prev) => ({ ...prev, type: true }));
                  setErrors((prev) => ({
                    ...prev,
                    type: validateType(newValue),
                  }));
                }}
                onBlur={handleTypeBlur}
                options={["Corrigendum", "Correction"]}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Document Change Type"
                    error={!!errors.type}
                    helperText={errors.type}
                    variant="outlined"
                  />
                )}
                disabled={isEdit || existingCorrigendumId}
                clearOnEscape
                clearOnBlur
              />
            </Grid>
            <Grid item xs={4}>
              <TextField
                name="referenceNumber"
                label="Reference Number"
                value={referenceNumber}
                onChange={handleReferenceNumberChange}
                fullWidth
                disabled={isEdit || existingCorrigendumId}
                sx={{ "& .MuiOutlinedInput-root": { bgcolor: "white" } }}
              />
            </Grid>
          </Grid>
          {!existingCorrigendumId && (
            <Box sx={{ mt: 3, display: "flex", justifyContent: "flex-end" }}>
              <Button
                variant="contained"
                onClick={handleCheckIfDocumentChange}
                disabled={
                  loading || isEdit || !type || !referenceNumber || !serviceId
                }
                startIcon={
                  loading ? (
                    <CircularProgress size={20} color="inherit" />
                  ) : (
                    <Description />
                  )
                }
                sx={{
                  bgcolor: "#2562E9",
                  "&:hover": { bgcolor: "#1D4ED8" },
                  textTransform: "none",
                  fontWeight: 600,
                  px: 4,
                }}
              >
                Check Application
              </Button>
            </Box>
          )}
        </Paper>

        {responseMessage.message && (
          <Alert
            severity={
              responseMessage.type === "error"
                ? "error"
                : responseMessage.type === "warning"
                  ? "warning"
                  : responseMessage.type === "info"
                    ? "info"
                    : "success"
            }
            sx={{ mb: 4, borderRadius: 2 }}
          >
            {responseMessage.message}
          </Alert>
        )}

        {(isEdit || existingCorrigendumId) && data.length > 0 && (
          <Paper
            elevation={0}
            sx={{
              p: 3,
              mb: 4,
              borderRadius: 3,
              border: "1px solid #E2E8F0",
              bgcolor: "white",
            }}
          >
            <Typography
              variant="h6"
              sx={{
                fontWeight: 700,
                color: "#0F172A",
                mb: 2,
                display: "flex",
                alignItems: "center",
                gap: 1,
              }}
            >
              <History sx={{ color: "#64748B" }} /> {type} History
            </Typography>
            <MaterialTable
              columns={columns}
              data={data}
              viewType={`${type} History`}
            />
          </Paper>
        )}

        {canIssue && (
          <Paper
            key={renderKey}
            elevation={0}
            sx={{
              p: 4,
              mb: 4,
              borderRadius: 3,
              border: "1px solid #E2E8F0",
              bgcolor: "white",
            }}
          >
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                mb: 3,
                flexWrap: "wrap",
                gap: 2,
              }}
            >
              <Typography
                variant="h5"
                sx={{ fontWeight: 700, color: "#0F172A" }}
              >
                Form Details
              </Typography>
              <Chip
                label={`Ref: ${referenceNumber}`}
                color="primary"
                variant="outlined"
              />
            </Box>

            {canEditDocument && (
              <Paper
                sx={{
                  p: 2,
                  mb: 4,
                  bgcolor: "#F8FAFC",
                  border: "1px dashed #CBD5E1",
                  borderRadius: 2,
                  display: "flex",
                  gap: 2,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <FormControl
                  sx={{ minWidth: 250, flex: 1 }}
                  error={!!errors.selectedField}
                >
                  <InputLabel>Select a field to change</InputLabel>
                  <Select
                    value={selectedField}
                    onChange={(e) => setSelectedField(e.target.value)}
                    label="Select a field to change"
                    disabled={!canEditDocument}
                    sx={{ bgcolor: "white" }}
                  >
                    <MenuItem value="" disabled>
                      Select a field
                    </MenuItem>
                    {allowedFormFields
                      .filter(
                        (item) =>
                          !corrigendumFields.some((f) => f.name === item.name),
                      )
                      .map((item) => (
                        <MenuItem key={item.value} value={item.value}>
                          {item.label}
                        </MenuItem>
                      ))}
                  </Select>
                  {errors.selectedField && (
                    <FormHelperText>{errors.selectedField}</FormHelperText>
                  )}
                </FormControl>
                <Button
                  variant="contained"
                  onClick={handleAddCorrigendumField}
                  disabled={!canEditDocument || !selectedField}
                  startIcon={<Add />}
                  sx={{
                    bgcolor: "#10B981",
                    "&:hover": { bgcolor: "#059669" },
                    textTransform: "none",
                    fontWeight: 600,
                    height: 56,
                  }}
                >
                  Add Field
                </Button>
              </Paper>
            )}

            {formDetailsFields.length === 0 && canIssue && (
              <Alert severity="warning" sx={{ mb: 3 }}>
                No editable fields available for this application.
              </Alert>
            )}

            {Object.keys(removedFields).length > 0 && (
              <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                  The following field(s) will be removed from the application:
                </Typography>
                {Object.entries(removedFields).map(([name, info]) => (
                  <Typography key={name} variant="body2">
                    • <strong>{info.label}</strong> — old value:{" "}
                    <em>{info.oldValue || "N/A"}</em> ({info.reason})
                  </Typography>
                ))}
                <Typography
                  variant="caption"
                  sx={{ display: "block", mt: 1, color: "text.secondary" }}
                >
                  Their historical values are preserved in this corrigendum's
                  record.
                </Typography>
              </Alert>
            )}

            {errors.corrigendumFields && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {errors.corrigendumFields}
              </Alert>
            )}

            {corrigendumFields.map((field, index) => {
              const hasError =
                errors[field.name] || errors[`${field.name}-doc`];

              const isLastInGroup = field.groupId
                ? (() => {
                    const anchor = getGroupAnchorField(
                      corrigendumFields,
                      field.groupId,
                    );
                    return anchor?.name === field.name;
                  })()
                : true;

              const groupDoc = getFieldSupportingDocument(field);
              const isHighlighted = highlightedField === field.name;

              return (
                <Paper
                  key={`${field.name}-${index}`}
                  data-field-name={field.name}
                  elevation={0}
                  sx={{
                    p: 3,
                    mb: 3,
                    borderRadius: 2,
                    border: "1px solid #E2E8F0",
                    borderLeft: `4px solid ${hasError ? "#DC2626" : "#2562E9"}`,
                    bgcolor: "#FFFFFF",
                    boxShadow: isHighlighted
                      ? "0 0 0 3px #FBBF24, 0 0 20px rgba(251, 191, 36, 0.35)"
                      : "none",
                    transition: "box-shadow 0.35s ease",
                    scrollMarginTop: "96px",
                  }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      mb: 2,
                    }}
                  >
                    <Typography
                      variant="h6"
                      sx={{ fontWeight: 600, color: "#0F172A" }}
                    >
                      {field.label}
                    </Typography>
                    {canEditDocument && (
                      <IconButton
                        color="error"
                        size="small"
                        onClick={() => handleDeleteField(index)}
                        sx={{ "&:hover": { bgcolor: "#FEE2E2" } }}
                      >
                        <DeleteIcon />
                      </IconButton>
                    )}
                  </Box>
                  <Divider sx={{ mb: 3 }} />
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                      <Typography
                        variant="caption"
                        sx={{
                          color: "#64748B",
                          fontWeight: 600,
                          textTransform: "uppercase",
                          mb: 1,
                          display: "block",
                        }}
                      >
                        Current Value
                      </Typography>
                      {field.type === "enclosure" ? (
                        field.oldValue ? (
                          <Button
                            variant="outlined"
                            onClick={() => handleViewFile(field.oldValue, true)}
                            startIcon={<PictureAsPdf />}
                            fullWidth
                            sx={{
                              textTransform: "none",
                              borderColor: "#CBD5E1",
                              color: "#334155",
                              justifyContent: "flex-start",
                            }}
                          >
                            View Current Document
                          </Button>
                        ) : (
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{
                              p: 2,
                              bgcolor: "#F8FAFC",
                              borderRadius: 1,
                              border: "1px solid #E2E8F0",
                            }}
                          >
                            No document
                          </Typography>
                        )
                      ) : (
                        <TextField
                          value={field.oldValue || "N/A"}
                          InputProps={{ readOnly: true }}
                          fullWidth
                          variant="outlined"
                          sx={{
                            "& .MuiInputBase-root": { bgcolor: "#F8FAFC" },
                          }}
                        />
                      )}
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Typography
                        variant="caption"
                        sx={{
                          color: "#64748B",
                          fontWeight: 600,
                          textTransform: "uppercase",
                          mb: 1,
                          display: "block",
                        }}
                      >
                        New Value
                      </Typography>
                      {field.type === "select" ? (
                        (() => {
                          const opts = field.options || [];
                          const hasCurrent =
                            !field.newValue ||
                            field.newValue === "" ||
                            opts.some(
                              (o) => String(o.value) === String(field.newValue),
                            );
                          const displayOptions = hasCurrent
                            ? opts
                            : [
                                ...opts,
                                {
                                  value: field.newValue,
                                  label: String(field.newValue),
                                },
                              ];
                          return (
                            <FormControl fullWidth error={!!errors[field.name]}>
                              <Select
                                value={field.newValue || ""}
                                onChange={(e) =>
                                  handleNewValueChange(index, e.target.value)
                                }
                                onBlur={() =>
                                  handleNewValueBlur(index, field.newValue)
                                }
                                disabled={!canEditDocument}
                              >
                                {displayOptions.map((option) => (
                                  <MenuItem
                                    key={option.value}
                                    value={option.value}
                                  >
                                    {option.label}
                                  </MenuItem>
                                ))}
                              </Select>
                              {errors[field.name] && (
                                <FormHelperText>
                                  {errors[field.name]}
                                </FormHelperText>
                              )}
                            </FormControl>
                          );
                        })()
                      ) : field.type === "date" ? (
                        <TextField
                          type="date"
                          value={field.newValue || ""}
                          onChange={(e) =>
                            handleNewValueChange(index, e.target.value)
                          }
                          onBlur={() =>
                            handleNewValueBlur(index, field.newValue)
                          }
                          fullWidth
                          InputLabelProps={{ shrink: true }}
                          error={!!errors[field.name]}
                          helperText={errors[field.name]}
                          disabled={!canEditDocument}
                        />
                      ) : field.type === "enclosure" ? (
                        <Button
                          variant="outlined"
                          component="label"
                          startIcon={<UploadFile />}
                          fullWidth
                          sx={{
                            textTransform: "none",
                            borderColor: errors[field.name]
                              ? "#DC2626"
                              : "#2562E9",
                            color: errors[field.name] ? "#DC2626" : "#2562E9",
                            py: 1.5,
                          }}
                        >
                          {field.newValue
                            ? field.newValue.name
                            : "Upload New Document"}
                          <input
                            type="file"
                            hidden
                            accept={field.accept || ".pdf"}
                            onChange={(e) =>
                              handleNewValueChange(index, e.target.files[0])
                            }
                            disabled={!canEditDocument}
                          />
                        </Button>
                      ) : (
                        <TextField
                          value={field.newValue || ""}
                          onChange={(e) =>
                            handleNewValueChange(index, e.target.value)
                          }
                          onBlur={() =>
                            handleNewValueBlur(index, field.newValue)
                          }
                          fullWidth
                          inputProps={{ maxLength: field.maxLength }}
                          error={!!errors[field.name]}
                          helperText={errors[field.name]}
                          disabled={!canEditDocument}
                        />
                      )}
                    </Grid>
                  </Grid>

                  {isLastInGroup && (
                    <Box
                      sx={{
                        mt: 3,
                        p: 2,
                        bgcolor: "#F8FAFC",
                        borderRadius: 2,
                        border: `1px dashed ${errors[`${field.name}-doc`] ? "#DC2626" : "#CBD5E1"}`,
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{
                          color: "#475569",
                          fontWeight: 600,
                          textTransform: "uppercase",
                          mb: 1.5,
                          display: "block",
                        }}
                      >
                        Supporting Document{" "}
                        {field.groupId
                          ? "(Required for this group)"
                          : "(Required)"}
                      </Typography>
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 2,
                          flexWrap: "wrap",
                        }}
                      >
                        <Button
                          variant="contained"
                          component="label"
                          startIcon={<UploadFile />}
                          disabled={!canEditDocument}
                          color={
                            errors[`${field.name}-doc`] ? "error" : "primary"
                          }
                          sx={{ textTransform: "none", fontWeight: 600 }}
                        >
                          {groupDoc ? "Change Document" : "Upload Document"}
                          <input
                            type="file"
                            accept=".pdf"
                            hidden
                            onChange={(e) =>
                              handleSupportingDocumentChange(
                                index,
                                e.target.files[0],
                              )
                            }
                          />
                        </Button>
                        {groupDoc && (
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 1,
                            }}
                          >
                            <Typography
                              variant="body2"
                              sx={{
                                color: "#2562E9",
                                cursor: "pointer",
                                textDecoration: "underline",
                                fontWeight: 500,
                              }}
                              onClick={() =>
                                handleViewFile(
                                  groupDoc,
                                  typeof groupDoc === "string",
                                )
                              }
                            >
                              {typeof groupDoc === "string"
                                ? groupDoc
                                : groupDoc.name}
                            </Typography>
                            {canEditDocument && (
                              <IconButton
                                color="error"
                                size="small"
                                onClick={() =>
                                  handleRemoveSupportingDocument(index)
                                }
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            )}
                          </Box>
                        )}
                      </Box>
                      {errors[`${field.name}-doc`] && (
                        <FormHelperText error sx={{ mt: 1 }}>
                          {errors[`${field.name}-doc`]}
                        </FormHelperText>
                      )}
                    </Box>
                  )}

                  {field.additionalFields[field.newValue]?.map((addField) => {
                    if (
                      corrigendumFields.some((f) => f.name === addField.name)
                    ) {
                      return null;
                    }
                    return (
                      <Box
                        key={addField.name}
                        sx={{ mt: 3, pt: 3, borderTop: "1px dashed #E2E8F0" }}
                      >
                        <Typography
                          variant="caption"
                          sx={{
                            color: "#64748B",
                            fontWeight: 600,
                            textTransform: "uppercase",
                            mb: 2,
                            display: "block",
                          }}
                        >
                          Conditional Field: {addField.label || addField.name}
                        </Typography>
                        <Grid container spacing={3}>
                          <Grid item xs={12} md={6}>
                            <Typography
                              variant="caption"
                              sx={{
                                color: "#94A3B8",
                                fontWeight: 500,
                                mb: 0.5,
                                display: "block",
                              }}
                            >
                              Current
                            </Typography>
                            <TextField
                              value={
                                findNestedFieldValue(
                                  formDetails,
                                  addField.name,
                                ) || "N/A"
                              }
                              InputProps={{ readOnly: true }}
                              fullWidth
                              variant="outlined"
                              size="small"
                              sx={{
                                "& .MuiInputBase-root": { bgcolor: "#F8FAFC" },
                              }}
                            />
                          </Grid>
                          <Grid item xs={12} md={6}>
                            <Typography
                              variant="caption"
                              sx={{
                                color: "#94A3B8",
                                fontWeight: 500,
                                mb: 0.5,
                                display: "block",
                              }}
                            >
                              New
                            </Typography>
                            {addField.type === "select" ? (
                              <FormControl
                                fullWidth
                                size="small"
                                error={
                                  !!errors[`${field.name}-${addField.name}`]
                                }
                              >
                                <Select
                                  value={
                                    field.additionalValues[addField.name] || ""
                                  }
                                  onChange={(e) =>
                                    handleNewValueChange(
                                      index,
                                      e.target.value,
                                      addField.name,
                                    )
                                  }
                                  onBlur={() =>
                                    handleNewValueBlur(
                                      index,
                                      field.additionalValues[addField.name],
                                      addField.name,
                                    )
                                  }
                                  disabled={!canEditDocument}
                                >
                                  {addField.options.map((option) => (
                                    <MenuItem
                                      key={option.value}
                                      value={option.value}
                                    >
                                      {option.label}
                                    </MenuItem>
                                  ))}
                                </Select>
                                {errors[`${field.name}-${addField.name}`] && (
                                  <FormHelperText>
                                    {errors[`${field.name}-${addField.name}`]}
                                  </FormHelperText>
                                )}
                              </FormControl>
                            ) : addField.type === "date" ? (
                              <TextField
                                type="date"
                                size="small"
                                value={
                                  field.additionalValues[addField.name] || ""
                                }
                                onChange={(e) =>
                                  handleNewValueChange(
                                    index,
                                    e.target.value,
                                    addField.name,
                                  )
                                }
                                onBlur={() =>
                                  handleNewValueBlur(
                                    index,
                                    field.additionalValues[addField.name],
                                    addField.name,
                                  )
                                }
                                fullWidth
                                InputLabelProps={{ shrink: true }}
                                error={
                                  !!errors[`${field.name}-${addField.name}`]
                                }
                                helperText={
                                  errors[`${field.name}-${addField.name}`]
                                }
                                disabled={!canEditDocument}
                              />
                            ) : addField.type === "enclosure" ? (
                              <Button
                                variant="outlined"
                                component="label"
                                size="small"
                                startIcon={<UploadFile />}
                                fullWidth
                                sx={{ textTransform: "none" }}
                              >
                                Upload
                                <input
                                  type="file"
                                  hidden
                                  accept={addField.accept || ".pdf"}
                                  onChange={(e) =>
                                    handleNewValueChange(
                                      index,
                                      e.target.files[0],
                                      addField.name,
                                    )
                                  }
                                  disabled={!canEditDocument}
                                />
                              </Button>
                            ) : (
                              <TextField
                                size="small"
                                value={
                                  field.additionalValues[addField.name] || ""
                                }
                                onChange={(e) =>
                                  handleNewValueChange(
                                    index,
                                    e.target.value,
                                    addField.name,
                                  )
                                }
                                onBlur={() =>
                                  handleNewValueBlur(
                                    index,
                                    field.additionalValues[addField.name],
                                    addField.name,
                                  )
                                }
                                fullWidth
                                error={
                                  !!errors[`${field.name}-${addField.name}`]
                                }
                                helperText={
                                  errors[`${field.name}-${addField.name}`]
                                }
                                disabled={!canEditDocument}
                              />
                            )}
                          </Grid>
                        </Grid>
                      </Box>
                    );
                  })}
                </Paper>
              );
            })}

            <Box sx={{ mt: 4, position: "relative" }}>
              <Typography
                variant="h6"
                sx={{ fontWeight: 600, color: "#0F172A", mb: 2 }}
              >
                Officer Remarks
              </Typography>
              <TextField
                name="remarks"
                label="Reason for change / Remarks"
                value={remarks}
                onChange={handleRemarksChange}
                onBlur={handleRemarksBlur}
                multiline
                rows={4}
                fullWidth
                error={!!errors.remarks}
                helperText={errors.remarks || ""}
                disabled={!canEditDocument}
              />
              <Typography
                variant="caption"
                sx={{
                  position: "absolute",
                  bottom: errors.remarks ? 24 : 8,
                  right: 14,
                  color:
                    wordCount > MAX_WORDS
                      ? "error.main"
                      : wordCount > MAX_WORDS * 0.8
                        ? "warning.main"
                        : "text.secondary",
                  fontWeight: 500,
                  bgcolor: "white",
                  px: 0.5,
                }}
              >
                {wordCount}/{MAX_WORDS} words
              </Typography>
            </Box>

            <BasicModal
              open={openModal}
              Title="Document Preview"
              handleClose={handleCloseModal}
              pdf={selectedFileName}
            />

            {canEditDocument && corrigendumFields.length > 0 && (
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "flex-end",
                  mt: 4,
                  pt: 3,
                  borderTop: "1px solid #E2E8F0",
                }}
              >
                <Button
                  variant="contained"
                  onClick={handleSubmitDocumentChange}
                  disabled={loading}
                  size="large"
                  sx={{
                    bgcolor: "#10B981",
                    "&:hover": { bgcolor: "#059669" },
                    textTransform: "none",
                    fontWeight: 700,
                    px: 6,
                    py: 1.5,
                    fontSize: "1rem",
                    boxShadow: "0 4px 12px rgba(16, 185, 129, 0.3)",
                  }}
                >
                  {loading ? (
                    <CircularProgress size={24} color="inherit" />
                  ) : (
                    `Forward ${type} to ${nextOfficer || "Next Officer"}`
                  )}
                </Button>
              </Box>
            )}
          </Paper>
        )}
      </Container>

      <Dialog
        open={validationPopup.open}
        onClose={() => setValidationPopup({ open: false, items: [] })}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            fontWeight: 700,
          }}
        >
          <WarningAmber sx={{ color: "#D97706" }} />
          Cannot forward {type || "document change"}
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
            Please resolve the following{" "}
            {validationPopup.items.length === 1
              ? "issue"
              : `${validationPopup.items.length} issues`}{" "}
            before submitting. Click any item to jump to the field.
          </Typography>
          <List dense disablePadding>
            {validationPopup.items.map((item, i) => (
              <ListItem key={`${item.key}-${i}`} disablePadding>
                <ListItemButton
                  onClick={() => {
                    setValidationPopup({ open: false, items: [] });
                    setTimeout(() => scrollToField(item.key), 120);
                  }}
                  sx={{ borderRadius: 1, alignItems: "flex-start" }}
                >
                  <ListItemIcon sx={{ minWidth: 32, mt: 0.5 }}>
                    <ErrorOutline color="error" fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary={item.label}
                    secondary={item.message}
                    primaryTypographyProps={{
                      fontWeight: 600,
                      fontSize: "0.875rem",
                    }}
                    secondaryTypographyProps={{ fontSize: "0.75rem" }}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={() => setValidationPopup({ open: false, items: [] })}
            variant="contained"
            sx={{ textTransform: "none", fontWeight: 600 }}
          >
            Got it
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
