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
      if (!response.data?.status) {
        throw new Error("Failed to fetch banks");
      }
      const banks = (response.data.data || [])
        .map((bank) => {
          const id =
            bank.id ?? bank.bankid ?? bank.bankId ?? bank.Bankid ?? bank.BankId;
          const name =
            bank.bankname ??
            bank.bankName ??
            bank.Bankname ??
            bank.BankName ??
            bank.name ??
            bank.Name;
          if (name === undefined || name === null) return null;
          const value = name;
          return { value: String(value), label: String(name) };
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
        if (applicationType) {
          setType(applicationType);
        }
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

  const findFieldConfigRaw = useCallback(
    (fieldName, fieldType = "text", parsedFormElements = null) => {
      parsedFormElements = parsedFormElements || formElements;
      for (const section of parsedFormElements) {
        for (const field of section.fields) {
          if (field.name === fieldName) {
            return {
              ...field,
              type: field.type || fieldType,
              validationFunctions: field.validationFunctions || [],
              transformationFunctions: field.transformationFunctions || [],
              additionalFields: field.additionalFields || {},
              conditionalAdditionalFields:
                field.conditionalAdditionalFields || {},
              options: field.options || [
                { label: "Please Select", value: "Please Select" },
              ],
              accept: field.accept || ".pdf",
              allowSameAsOldValue: field.allowSameAsOldValue || false,
            };
          }
          for (const key in field.additionalFields) {
            const additional = field.additionalFields[key];
            const found = additional.find((f) => f.name === fieldName);
            if (found)
              return {
                ...found,
                type: found.type || fieldType,
                validationFunctions: found.validationFunctions || [],
                transformationFunctions: found.transformationFunctions || [],
                additionalFields: found.additionalFields || {},
                conditionalAdditionalFields:
                  found.conditionalAdditionalFields || {},
                options: found.options || [
                  { label: "Please Select", value: "Please Select" },
                ],
                accept: found.accept || ".pdf",
                allowSameAsOldValue: found.allowSameAsOldValue || false,
              };
          }
          for (const key in field.conditionalAdditionalFields) {
            const conditional = field.conditionalAdditionalFields[key];
            const found = conditional.find((f) => f.name === fieldName);
            if (found)
              return {
                ...found,
                type: found.type || fieldType,
                validationFunctions: found.validationFunctions || [],
                transformationFunctions: found.transformationFunctions || [],
                additionalFields: found.additionalFields || {},
                conditionalAdditionalFields:
                  found.conditionalAdditionalFields || {},
                options: found.options || [
                  { label: "Please Select", value: "Please Select" },
                ],
                accept: found.accept || ".pdf",
                allowSameAsOldValue: found.allowSameAsOldValue || false,
              };
          }
        }
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
        return {
          ...config,
          type: "select",
          options: bankOptions,
        };
      }
      return config;
    },
    [findFieldConfigRaw, bankOptions],
  );

  const normalizeDetails = useCallback(
    (formDetails, parsedFormElements = null) => {
      if (!formDetails || typeof formDetails !== "object") return [];
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
      Object.entries(formDetails).forEach(([sectionName, section]) => {
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
      for (const field of fields) {
        if (field.name === fieldName) return field.type;
        if (
          field.additionalFields &&
          Object.keys(field.additionalFields).length > 0
        ) {
          for (const key in field.additionalFields) {
            const nestedFields = field.additionalFields[key];
            const result = searchFields(nestedFields);
            if (result) return result;
          }
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

  const validateUdidNumber = useCallback(
    async (udidNumber, referenceNumber) => {
      try {
        const response = await axiosInstance.get(
          "/Officer/GetIfSameUdidNumber",
          { params: { referenceNumber, udidNumber } },
        );
        const data = response.data;
        if (data.status) return null;
        else
          return (
            data.message ||
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
    async (field, value, formData, referenceNumber) => {
      const fieldConfig = findFieldConfig(field.name);
      const skipSameValueCheckFields = [
        "UdidCardNumber",
        "KindOfDisability",
        "PercentageOfDisability",
      ];
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
      const sameValue =
        fieldConfig.type === "date"
          ? isSameDate(value, field.oldValue)
          : value === field.oldValue;
      if (
        !skipSameValueCheckFields.includes(field.name) &&
        !fieldConfig.allowSameAsOldValue &&
        sameValue
      )
        return {
          transformedValue: value,
          error: "New value cannot be the same as old value",
        };
      const validationResult = await runValidations(
        {
          ...fieldConfig,
          validationFunctions: fieldConfig.validationFunctions || [],
        },
        value,
        formData,
        referenceNumber,
      );
      if (field.name === "IfscCode") {
        const isInvalid =
          (typeof validationResult === "object" &&
            validationResult !== null &&
            validationResult.status === false) ||
          typeof validationResult === "string";
        if (isInvalid) {
          return { transformedValue: value, error: null };
        }
      }
      if (validationResult !== true)
        return { transformedValue: value, error: validationResult };
      if (field.name === "UdidCardNumber" && value) {
        const udidValidationResult = await validateUdidNumber(
          value,
          referenceNumber,
        );
        if (udidValidationResult !== null)
          return { transformedValue: value, error: udidValidationResult };
      }
      return { transformedValue: value, error: null };
    },
    [findFieldConfig, validateUdidNumber],
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

  const validateSupportingDocument = useCallback((field, allFields) => {
    if (field.groupId) {
      const groupIndices = allFields
        .map((f, i) => (f.groupId === field.groupId ? i : -1))
        .filter((i) => i !== -1);
      const lastIndex = groupIndices[groupIndices.length - 1];
      const currentIndex = allFields.indexOf(field);
      if (lastIndex !== currentIndex) {
        return null;
      }
    }
    if (!field.supportingDocument) {
      return field.groupId
        ? "Supporting document is required for this group of fields."
        : "Supporting document is required for this field.";
    }
    return null;
  }, []);

  const validateType = useCallback((value) => {
    return ["Corrigendum", "Correction"].includes(value)
      ? null
      : "Please select a valid type (Corrigendum, Correction)";
  }, []);

  const revalidateAllFields = useCallback(
    async (
      updatedFields,
      formData,
      referenceNumber,
      validateRemarksAndFiles = false,
    ) => {
      const newErrors = {};
      for (const field of updatedFields) {
        if (field.newValue) {
          const { error } = await validateField(
            field,
            field.newValue,
            formData,
            referenceNumber,
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
                formData,
                referenceNumber,
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

  function toYMD(input) {
    if (!input) return null;
    const s = String(input).trim();
    let m;
    if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)))
      return { year: +m[1], month: +m[2], day: +m[3] };
    if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)))
      return { year: +m[3], month: +m[2], day: +m[1] };
    return null;
  }

  function isSameDate(a, b) {
    const x = toYMD(a);
    const y = toYMD(b);
    if (!x || !y) return false;
    return x.year === y.year && x.month === y.month && x.day === y.day;
  }

  const getFormDetailValue = useCallback((fieldName, details) => {
    if (!details || typeof details !== "object") return null;
    for (const section of Object.values(details)) {
      if (Array.isArray(section)) {
        for (const item of section) {
          if (item.name === fieldName) return item.value;
          if (Array.isArray(item.additionalFields)) {
            for (const addField of item.additionalFields) {
              if (addField.name === fieldName) return addField.value;
            }
          }
        }
      }
    }
    return null;
  }, []);

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
          } catch (error) {
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

        const mappedAllowedFields = result.allowedForDetails
          .filter((item) => {
            if (item.label === "UDID" || item.name === "UDID") {
              const pensionType = getFormDetailValue(
                "PensionType",
                result.formDetails,
              );
              const kindOfDisability = getFormDetailValue(
                "KindOfDisability",
                result.formDetails,
              );

              return (
                pensionType === "PHYSICALLY CHALLENGED PERSON" &&
                kindOfDisability === "TEMPORARY"
              );
            }
            return true;
          })
          .map((item) => {
            if (item.isGroup)
              return {
                label: item.label,
                name: item.name || item.label,
                isGroup: true,
                fields: item.fields,
                value: `group|${item.label}`,
              };
            else
              return {
                label: item.label,
                name: item.name,
                type: item.type || "text",
                isGroup: false,
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
        if (
          (isEdit || result.existingCorrigendumId) &&
          result.corrigendumFields
        ) {
          let corrigendumFieldsData =
            typeof result.corrigendumFields === "string"
              ? JSON.parse(result.corrigendumFields)
              : result.corrigendumFields;
          let index = 0;
          for (const [name, fieldData] of Object.entries(
            corrigendumFieldsData,
          )) {
            if (name === "Files") continue;
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
                if (
                  subFieldData.new_value &&
                  fieldConfig.conditionalAdditionalFields?.[
                    subFieldData.new_value
                  ]
                ) {
                  const conditionalFields =
                    fieldConfig.conditionalAdditionalFields[
                      subFieldData.new_value
                    ];
                  for (const condField of conditionalFields) {
                    const condFormDetail = normalizeDetails(
                      result.formDetails,
                    ).find((item) => item.name === condField.name);
                    const condOldValue = condFormDetail
                      ? condFormDetail.oldValue || ""
                      : "";
                    newCorrigendumFields.push({
                      label: condField.label || condField.name,
                      name: condField.name,
                      oldValue: condOldValue,
                      newValue:
                        subFieldData.additional_values[condField.name] ||
                        (condField.type === "enclosure" ? null : ""),
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
                      groupId: name,
                    });
                  }
                }
                newCorrigendumFields.push(newField);
                const { error } = await validateField(
                  newField,
                  newField.newValue,
                  formData,
                  result.application.ReferenceNumber,
                );
                newErrors[index] = error;
                index++;
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
              if (
                fieldData.new_value &&
                fieldConfig.conditionalAdditionalFields?.[fieldData.new_value]
              ) {
                const conditionalFields =
                  fieldConfig.conditionalAdditionalFields[fieldData.new_value];
                for (const condField of conditionalFields) {
                  const condFormDetail = normalizeDetails(
                    result.formDetails,
                  ).find((item) => item.name === condField.name);
                  const condOldValue = condFormDetail
                    ? condFormDetail.oldValue || ""
                    : "";
                  newCorrigendumFields.push({
                    label: condField.label || condField.name,
                    name: condField.name,
                    oldValue: condOldValue,
                    newValue:
                      fieldData.additional_values[condField.name] ||
                      (condField.type === "enclosure" ? null : ""),
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
                  });
                }
              }
              newCorrigendumFields.push(newField);
              const { error } = await validateField(
                newField,
                newField.newValue,
                formData,
                result.application.ReferenceNumber,
              );
              newErrors[index] = error;
              index++;
            }
          }
        }
        setCorrigendumFields(newCorrigendumFields);
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
    getFormDetailValue,
  ]);

  const findNestedFieldValue = (formDetails, fieldName) => {
    if (formDetails && typeof formDetails === "object") {
      for (const [sectionName, section] of Object.entries(formDetails)) {
        if (!Array.isArray(section)) continue;
        for (const field of section) {
          if (field.name === fieldName) return field.value ?? field.File ?? "";
          if (field.additionalFields) {
            const searchAdditional = (fields, depth = 1) => {
              for (const sub of fields) {
                if (sub.name === fieldName) return sub.value ?? sub.File ?? "";
                if (sub.additionalFields) {
                  const nested = searchAdditional(
                    sub.additionalFields,
                    depth + 1,
                  );
                  if (nested) return nested;
                }
              }
              return null;
            };
            const nestedValue = searchAdditional(field.additionalFields);
            if (nestedValue) return nestedValue;
          }
        }
      }
    }
    return "";
  };

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
        if (!skipStateUpdate) {
          const tempUpdated = [...corrigendumFields];
          tempUpdated[index].newValue = transformedValue;

          // FIX: Include fields from BOTH additionalFields and conditionalAdditionalFields
          // so they are added as standalone fields instead of inline.
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
              validateField(
                newField,
                newField.newValue,
                formData,
                referenceNumber,
              ).then(({ error }) => {
                setErrors((prev) => ({ ...prev, [newField.name]: error }));
              });
            }
          });
          let newCorrigendumFields = tempUpdated.filter(
            (_, i) => !fieldsToRemove.includes(i),
          );
          newCorrigendumFields = [...newCorrigendumFields, ...fieldsToAdd];
          setCorrigendumFields(newCorrigendumFields);
          validateField(
            field,
            transformedValue,
            formData,
            referenceNumber,
          ).then(({ error }) => {
            setErrors((prev) => ({ ...prev, [field.name]: error }));
          });
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
      const fieldConfig = findFieldConfig(field.name, field.type || "text");
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
    formData,
    referenceNumber,
    revalidateAllFields,
  ]);

  const handleDeleteField = useCallback(
    (index) => {
      const updatedFields = corrigendumFields.filter((_, i) => i !== index);
      setCorrigendumFields(updatedFields);
      setRenderKey((prev) => prev + 1);
      revalidateAllFields(updatedFields, formData, referenceNumber, true).then(
        (newErrors) => {
          setErrors(newErrors);
        },
      );
    },
    [corrigendumFields, formData, referenceNumber, revalidateAllFields],
  );

  const handleSupportingDocumentChange = (index, file) => {
    const updated = [...corrigendumFields];
    updated[index].supportingDocument = file;
    setCorrigendumFields(updated);
    setErrors((prev) => ({ ...prev, [`${updated[index].name}-doc`]: null }));
  };

  const handleRemoveSupportingDocument = (index) => {
    const updated = [...corrigendumFields];
    updated[index].supportingDocument = null;
    setCorrigendumFields(updated);
    setErrors((prev) => ({
      ...prev,
      [`${updated[index].name}-doc`]: validateSupportingDocument(
        updated[index],
        updated,
      ),
    }));
  };

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

  const handleTypeChange = useCallback(
    (e) => {
      const newType = e.target.value;
      if (!isEdit && !isInitialLoad && type !== newType) {
        resetFormState();
        setType(newType);
      } else setType(newType);
    },
    [isEdit, isInitialLoad, type, resetFormState],
  );

  const handleTypeBlur = useCallback(() => {
    setTouched((prev) => ({ ...prev, type: true }));
    const error = validateType(type);
    setErrors((prev) => ({ ...prev, type: error }));
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
    return corrigendumFields.reduce((acc, field) => {
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
        supporting_document: field.supportingDocument
          ? typeof field.supportingDocument === "string"
            ? field.supportingDocument
            : field.supportingDocument.name
          : null,
      };
      return acc;
    }, {});
  }, [corrigendumFields]);

  const handleSubmitDocumentChange = useCallback(async () => {
    if (!type) {
      setErrors((prev) => ({
        ...prev,
        type: "Please select a type (Corrigendum or Correction)",
      }));
      return;
    }
    if (corrigendumFields.length === 0) {
      setErrors((prev) => ({
        ...prev,
        corrigendumFields: `Please add at least one field to submit the ${type.toLowerCase()}.`,
      }));
      return;
    }
    setTouched((prev) => ({ ...prev, remarks: true, type: true }));
    const newErrors = await revalidateAllFields(
      corrigendumFields,
      formData,
      referenceNumber,
      true,
    );
    setErrors(newErrors);

    const missingGroupDoc = corrigendumFields.some((field) => {
      if (field.groupId) {
        const groupIndices = corrigendumFields
          .map((f, i) => (f.groupId === field.groupId ? i : -1))
          .filter((i) => i !== -1);
        const lastIndex = groupIndices[groupIndices.length - 1];
        return (
          lastIndex === corrigendumFields.indexOf(field) &&
          !field.supportingDocument
        );
      }
      return !field.supportingDocument;
    });

    const hasEmptyNewValue = corrigendumFields.some((field) => !field.newValue);
    const hasValidationErrors = Object.values(newErrors).some(
      (error) => error !== null && error !== undefined,
    );

    if (missingGroupDoc) {
      setErrors((prev) => ({
        ...prev,
        corrigendumFields: `All fields or groups must have a supporting document uploaded.`,
      }));
      return;
    }
    if (hasEmptyNewValue) {
      setErrors((prev) => ({
        ...prev,
        corrigendumFields: `Please fill in all new values before submitting the ${type.toLowerCase()}.`,
      }));
      return;
    }
    if (hasValidationErrors) {
      setErrors((prev) => ({
        ...prev,
        corrigendumFields: `Please correct all validation errors before submitting the ${type.toLowerCase()}.`,
      }));
      return;
    }
    setLoading(true);
    setResponseMessage({ message: "", type: "" });
    try {
      const corrigendumObject = generateCorrigendumObject();
      try {
        JSON.parse(JSON.stringify(corrigendumObject));
      } catch (error) {
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
          field.supportingDocument &&
          typeof field.supportingDocument !== "string"
        )
          formDataToSend.append(
            `fieldSupportingDocuments[${field.name}]`,
            field.supportingDocument,
          );
      });
      const response = await axiosInstance.post(
        "/Officer/SubmitDocumentChange",
        formDataToSend,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      if (response.data.status) {
        setSuccessDetails({
          message: response.data.message || `${type} submitted successfully!`,
          referenceNumber: referenceNumber,
          type: type,
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
    formData,
    referenceNumber,
    remarks,
    serviceId,
    existingCorrigendumId,
    generateCorrigendumObject,
    resetFormState,
    revalidateAllFields,
    validateSupportingDocument,
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
                  const error = validateType(newValue);
                  setErrors((prev) => ({ ...prev, type: error }));
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
                    const groupIndices = corrigendumFields
                      .map((f, i) => (f.groupId === field.groupId ? i : -1))
                      .filter((i) => i !== -1);
                    return (
                      groupIndices.length > 0 &&
                      groupIndices[groupIndices.length - 1] === index
                    );
                  })()
                : true;

              return (
                <Paper
                  key={`${field.name}-${index}`}
                  elevation={0}
                  sx={{
                    p: 3,
                    mb: 3,
                    borderRadius: 2,
                    border: "1px solid #E2E8F0",
                    borderLeft: `4px solid ${hasError ? "#DC2626" : "#2562E9"}`,
                    bgcolor: "#FFFFFF",
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
                          {field.supportingDocument
                            ? "Change Document"
                            : "Upload Document"}
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
                        {field.supportingDocument && (
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
                                  field.supportingDocument,
                                  typeof field.supportingDocument === "string",
                                )
                              }
                            >
                              {typeof field.supportingDocument === "string"
                                ? field.supportingDocument
                                : field.supportingDocument.name}
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
                    // If this field is already a standalone field in corrigendumFields, don't render it inline
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
    </Box>
  );
}
