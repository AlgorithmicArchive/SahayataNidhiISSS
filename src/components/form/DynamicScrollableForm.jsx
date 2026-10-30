import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
import {
  runValidations,
  TransformationFunctionsList,
} from "../../assets/formvalidations";
import {
  Box,
  Checkbox,
  FormControlLabel,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Button,
  Typography,
  Divider,
  IconButton,
  Alert,
  FormLabel,
  FormGroup,
  CircularProgress,
  Grid2 as Grid,
  Autocomplete,
  Backdrop,
} from "@mui/material";
import { Col, Row } from "react-bootstrap";
import { fetchFormDetails, GetServiceContent } from "../../assets/fetch";
import { useLocation, useNavigate } from "react-router-dom";
import axiosInstance from "../../axiosConfig";
import PersonIcon from "@mui/icons-material/Person";
import HomeIcon from "@mui/icons-material/Home";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import CloseIcon from "@mui/icons-material/CloseOutlined";
import MessageModal from "../MessageModal";
import LoadingSpinner from "../LoadingSpinner";
import { toast, ToastContainer } from "react-toastify";
import OtpModal from "../OtpModal";
import { CheckCircle, Delete, FileDownload } from "@mui/icons-material";
import { LocalizationProvider, DatePicker } from "@mui/x-date-pickers";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { format, parse } from "date-fns";
import { se } from "date-fns/locale";

const sectionIconMap = {
  Location: <LocationOnIcon sx={{ fontSize: 36, color: "#0B5FA5" }} />,
  "Applicant Details": <PersonIcon sx={{ fontSize: 36, color: "#C75B00" }} />,
  "Present Address Details": (
    <HomeIcon sx={{ fontSize: 36, color: "#17418F" }} />
  ),
  "Permanent Address Details": (
    <HomeIcon sx={{ fontSize: 36, color: "#17418F" }} />
  ),
  "Bank Details": (
    <AccountBalanceIcon sx={{ fontSize: 36, color: "#9A5B00" }} />
  ),
  Documents: <InsertDriveFileIcon sx={{ fontSize: 36, color: "#138808" }} />,
};

// ── Normalise whatever `runValidations` returns into either `true`
// or a string error message that React Hook Form understands.
const normalizeValidationResult = (result) => {
  if (result === undefined || result === true) return true;
  if (typeof result === "string") return result;
  if (result && typeof result === "object") {
    if (
      result.status === true ||
      result.valid === true ||
      result.isValid === true
    ) {
      return true;
    }
    return (
      result.message ||
      result.error ||
      "Validation failed. Please check the value."
    );
  }
  return true;
};

// Helper function to collect currently rendered fields
const collectRenderedFields = (formSections, formData) => {
  const renderedFields = new Set();

  formSections.forEach((section) => {
    section.fields.forEach((field) => {
      if (field.type === "enclosure") {
        if (
          !field.isDependentEnclosure ||
          (field.isDependentEnclosure &&
            field.dependentValues.includes(formData[field.dependentField]))
        ) {
          renderedFields.add(`${field.name}_select`);
          renderedFields.add(`${field.name}_file`);
        }
      } else {
        renderedFields.add(field.name);
      }

      if (field.additionalFields) {
        const selectedValue = formData[field.name] || "";
        const additionalFields = field.additionalFields[selectedValue] || [];
        additionalFields.forEach((af) => {
          const nestedFieldName = af.name || `${field.name}_${af.id}`;
          renderedFields.add(nestedFieldName);
          if (af.type === "enclosure") {
            renderedFields.add(`${nestedFieldName}_select`);
            renderedFields.add(`${nestedFieldName}_file`);
          }
          if (af.additionalFields) {
            const nestedSelectedValue = formData[nestedFieldName] || "";
            const nestedAdditionalFields =
              af.additionalFields[nestedSelectedValue] || [];
            nestedAdditionalFields.forEach((nestedAf) => {
              const nestedNestedFieldName =
                nestedAf.name || `${nestedFieldName}_${nestedAf.id}`;
              renderedFields.add(nestedNestedFieldName);
              if (nestedAf.type === "enclosure") {
                renderedFields.add(`${nestedNestedFieldName}_select`);
                renderedFields.add(`${nestedNestedFieldName}_file`);
              }
            });
          }
        });
      }
    });
  });

  return Array.from(renderedFields);
};

// Helper function to flatten the nested formDetails structure
const flattenFormDetails = (nestedDetails) => {
  const flat = {};
  function recurse(fields) {
    fields.forEach((field) => {
      if (field.hasOwnProperty("Enclosure")) {
        flat[field.name] = {
          selected: field.Enclosure || "",
          file: field.File || "",
        };
      } else {
        if ("value" in field) flat[field.name] = field.value;
        if ("File" in field && field.File) flat[field.name] = field.File;
      }

      if (field.additionalFields) {
        const branches = Array.isArray(field.additionalFields)
          ? field.additionalFields
          : Object.values(field.additionalFields).flat();

        recurse(
          branches.map((af) => ({
            ...af,
            name: af.name || `${field.name}_${af.id}`,
          })),
        );
      }
    });
  }

  Object.values(nestedDetails).forEach((fields) => recurse(fields));
  return flat;
};

// Helper function to sanitize form sections
const sanitizeFormSections = (sections) => {
  return sections.map((section) => ({
    ...section,
    fields: section.fields.map((field) => {
      if (field.options) {
        const seenValues = new Set();
        const uniqueOptions = field.options.filter((option) => {
          if (seenValues.has(option.value)) {
            console.warn(
              `Duplicate option value found: ${option.value} in field ${field.name}`,
            );
            return false;
          }
          seenValues.add(option.value);
          return true;
        });
        return { ...field, options: uniqueOptions };
      }
      if (field.additionalFields) {
        const sanitizedAdditionalFields = {};
        Object.entries(field.additionalFields).forEach(([key, fields]) => {
          sanitizedAdditionalFields[key] = fields.map((af) => {
            if (af.options) {
              const seenValues = new Set();
              const uniqueOptions = af.options.filter((option) => {
                if (seenValues.has(option.value)) {
                  console.warn(
                    `Duplicate option value found: ${option.value} in additional field ${af.name}`,
                  );
                  return false;
                }
                seenValues.add(option.value);
                return true;
              });
              return { ...af, options: uniqueOptions };
            }
            return af;
          });
        });
        return { ...field, additionalFields: sanitizedAdditionalFields };
      }
      return field;
    }),
  }));
};

const isEmptyBranchValue = (v) =>
  v === "" ||
  v === null ||
  v === undefined ||
  v === "Please Select" ||
  v === "placeholder";

// ── Normalise `additionalDetails.returnFields` ────────────────────────────
const normalizeReturnFields = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.warn("Failed to parse returnFields:", value, e);
      return [];
    }
  }
  return [];
};

const DynamicScrollableForm = ({ mode = "new", data }) => {
  const {
    control,
    handleSubmit,
    trigger,
    watch,
    getValues,
    setValue,
    reset,
    unregister,
    clearErrors,
    formState: { errors, dirtyFields },
  } = useForm({
    mode: "onBlur",
    reValidateMode: "onBlur",
    shouldUnregister: false,
    defaultValues: {},
  });

  const [formSections, setFormSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [buttonLoading, setButtonLoading] = useState(false);
  const [referenceNumber, setReferenceNumber] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [initialData, setInitialData] = useState(null);
  const [additionalDetails, setAdditionalDetails] = useState(null);
  const [messageModalOpen, setMessageModalOpen] = useState(false);
  const [aadhaarNumber, setAadhaarNumber] = useState("");
  const [applicantImagePreview, setApplicantImagePreview] = useState(
    "/assets/images/profile.jpg",
  );
  const [aadhaarValid, setAadhaarValid] = useState(false);
  const [otpModal, setOtpModal] = useState(false);
  const [emailAlertModalOpen, setEmailAlertModalOpen] = useState(false);
  const [ifscPrefix, setIfscPrefix] = useState("");
  const [isBranchNameReadonly, setIsBranchNameReadonly] = useState(true);
  const [imageValidation, setImageValidation] = useState(false);

  const [DependableFields, setDependableFields] = useState([]);
  const navigate = useNavigate();
  const location = useLocation();

  const hasRunRef = useRef(false);
  const watchedDependableValues = useWatch({ control, name: DependableFields });
  const isBackspacePressed = useRef(false);
  const formRef = useRef(null);
  const formSectionsRef = useRef(formSections);

  const branchManuallyEnteredRef = useRef(false);

  // ── Guarded setValue ──────────────────────────────────────────────────
  // Refuses to blank out `BranchName` in three cases:
  //   1. The user typed it manually (all modes).
  //   2. ★ EDIT MODE ONLY: BranchName is a non-returnable field
  //      (`isFieldDisabled("BranchName")` is true) — the citizen's
  //      original value must survive an IFSC / BankName change on
  //      this page because the officer isn't allowed to edit it.
  //
  // Any other write goes straight through. New / incomplete modes
  // are unaffected by guard #2.
  const guardedSetValue = useCallback(
    (name, value, options) => {
      if (name === "BranchName" && isEmptyBranchValue(value)) {
        // Guard #1 — user-typed value (all modes)
        if (branchManuallyEnteredRef.current) return;

        // Guard #2 — EDIT MODE ONLY: BranchName is disabled
        if (mode === "edit") {
          const isBranchReadonly =
            additionalDetails &&
            additionalDetails.returnFields &&
            !DependableFields.includes("BranchName");
          if (isBranchReadonly) return;
        }
      }
      return setValue(name, value, options);
    },
    [setValue, mode, additionalDetails, DependableFields],
  );

  const isSubmittingRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    formSectionsRef.current = formSections;
  }, [formSections]);

  const applicantImageFile = watch("ApplicantImage");

  // ========== SAME AS PRESENT SYNC LOGIC ==========
  const sameAsPresentChecked = useWatch({ control, name: "SameAsPresent" });
  const [presentFieldNames, setPresentFieldNames] = useState([]);
  const [permanentFieldMap, setPermanentFieldMap] = useState({});
  const isSyncingRef = useRef(false);

  const findFieldInSection = (section, fieldName) => {
    let found = section.fields.find((f) => f.name === fieldName);
    if (found) return found;

    const searchAdditional = (fieldsArray) => {
      if (!fieldsArray) return null;
      for (let f of fieldsArray) {
        if (f.name === fieldName) return f;
        if (f.additionalFields) {
          for (let key in f.additionalFields) {
            const subFound = searchAdditional(f.additionalFields[key]);
            if (subFound) return subFound;
          }
        }
      }
      return null;
    };

    for (let key in section.fields) {
      const field = section.fields[key];
      if (field.additionalFields) {
        for (let subKey in field.additionalFields) {
          const subFound = searchAdditional(field.additionalFields[subKey]);
          if (subFound) return subFound;
        }
      }
    }
    return null;
  };

  useEffect(() => {
    const presentSection = formSections.find(
      (s) => s.section === "Present Address Details",
    );
    const permanentSection = formSections.find(
      (s) => s.section === "Permanent Address Details",
    );

    if (!presentSection || !permanentSection) return;

    const collectFieldNames = (fields, prefix = "") => {
      let names = [];
      fields.forEach((field) => {
        names.push(prefix + field.name);
        if (field.additionalFields) {
          const additionalFieldArrays = Object.values(field.additionalFields);
          additionalFieldArrays.forEach((arr) => {
            if (Array.isArray(arr)) {
              names = names.concat(collectFieldNames(arr, prefix));
            }
          });
        }
      });
      return names;
    };

    const presentNames = collectFieldNames(presentSection.fields);
    const permanentNames = collectFieldNames(permanentSection.fields);

    const mapping = {};
    presentNames.forEach((pName) => {
      const permName = pName.replace(/^Present/, "Permanent");
      if (permanentNames.includes(permName)) {
        mapping[pName] = permName;
      } else {
        const possibleMatch = permanentNames.find((p) => p === permName);
        if (possibleMatch) mapping[pName] = possibleMatch;
      }
    });

    setPresentFieldNames(presentNames);
    setPermanentFieldMap(mapping);
  }, [formSections]);

  const watchedPresentValuesArray =
    useWatch({ control, name: presentFieldNames }) || [];
  const watchedPresentValues = useMemo(() => {
    const obj = {};
    presentFieldNames.forEach((name, idx) => {
      obj[name] = watchedPresentValuesArray[idx];
    });
    return obj;
  }, [presentFieldNames, watchedPresentValuesArray]);

  useEffect(() => {
    if (!sameAsPresentChecked || isSyncingRef.current) return;

    isSyncingRef.current = true;
    try {
      presentFieldNames.forEach((presentName) => {
        const permName = permanentFieldMap[presentName];
        if (!permName) return;

        const presentValue = watchedPresentValues[presentName];
        const currentPermValue = getValues(permName);

        if (presentValue !== currentPermValue) {
          setValue(permName, presentValue, {
            shouldDirty: true,
            shouldValidate: false,
          });
        }
      });
    } finally {
      isSyncingRef.current = false;
    }
  }, [
    sameAsPresentChecked,
    presentFieldNames,
    watchedPresentValues,
    permanentFieldMap,
    getValues,
    setValue,
  ]);
  // ========== END SYNC LOGIC ==========

  // Effect to manage non-rendered fields
  useEffect(() => {
    if (!formSections.length) return;

    formSections.forEach((section) => {
      section.fields.forEach((field) => {
        if (
          field.type === "select" &&
          field.dependentOn &&
          field.dependentOptions &&
          Object.keys(field.dependentOptions).length > 0
        ) {
          if (field.name === "BranchName" && branchManuallyEnteredRef.current) {
            return;
          }

          const parentValue = watch(field.dependentOn);
          const options =
            field.dependentOptions[parentValue] || field.options || [];
          const currentValue = getValues(field.name);

          if (
            options.length > 0 &&
            currentValue &&
            currentValue !== "Please Select"
          ) {
            const isValueValid = options.some(
              (opt) => opt.value.toString() === currentValue.toString(),
            );
            if (!isValueValid) {
              setValue(field.name, "Please Select", { shouldValidate: true });
            }
          } else if (
            options.length === 0 &&
            currentValue &&
            currentValue !== "Please Select"
          ) {
            setValue(field.name, "Please Select", { shouldValidate: true });
          }
        }

        if (field.additionalFields) {
          const selectedValue = watch(field.name);
          const additionalFields = field.additionalFields[selectedValue] || [];
          additionalFields.forEach((af) => {
            if (
              af.type === "select" &&
              af.dependentOn &&
              af.dependentOptions &&
              Object.keys(af.dependentOptions).length > 0
            ) {
              const parentValue = watch(af.dependentOn);
              const options =
                af.dependentOptions[parentValue] || af.options || [];
              const currentValue = getValues(af.name);
              if (
                options.length > 0 &&
                currentValue &&
                currentValue !== "Please Select"
              ) {
                const isValueValid = options.some(
                  (opt) => opt.value.toString() === currentValue.toString(),
                );
                if (!isValueValid) {
                  setValue(af.name, "Please Select", { shouldValidate: true });
                }
              } else if (
                options.length === 0 &&
                currentValue &&
                currentValue !== "Please Select"
              ) {
                setValue(af.name, "Please Select", { shouldValidate: true });
              }
            }
          });
        }

        if (
          field.type === "enclosure" &&
          field.isDependentEnclosure &&
          field.dependentField &&
          field.dependentValues?.length > 0
        ) {
          const watchedValue = getValues(field.dependentField);
          const shouldShow = field.dependentValues.includes(watchedValue);
          const selectFieldName = `${field.name}_select`;
          const fileFieldName = `${field.name}_file`;

          if (!shouldShow) {
            setValue(selectFieldName, "", { shouldValidate: false });
            setValue(fileFieldName, null, { shouldValidate: false });
            clearErrors([selectFieldName, fileFieldName]);
          } else if (
            shouldShow &&
            initialData?.[field.name] &&
            (getValues(selectFieldName) === "" ||
              getValues(fileFieldName) == null)
          ) {
            setValue(selectFieldName, initialData[field.name].selected || "", {
              shouldValidate: !isFieldDisabled(field.name),
            });
            if (initialData[field.name].file) {
              setDefaultFile(
                fileFieldName,
                initialData[field.name].file,
                false,
              );
            } else {
              setValue(fileFieldName, null, {
                shouldValidate: !isFieldDisabled(field.name),
              });
            }
            clearErrors([selectFieldName, fileFieldName]);
          }
        }
      });
    });
  }, [
    formSections,
    getValues,
    setValue,
    initialData,
    watch,
    clearErrors,
    JSON.stringify(watchedDependableValues),
  ]);

  const districtOptionsLoaded = useRef(new Set());

  function isDocumentInData(fieldName, flatDetails) {
    return Object.keys(flatDetails).includes(fieldName);
  }

  const getDependableFields = (formSections, returnFields, flatDetails) => {
    const dependencies = new Set();

    // Recurse through a field and every nested additionalField,
    // regardless of whether the parent matched returnFields.
    const collectFromField = (field, effectiveName) => {
      const name = effectiveName || field.name;
      if (!name) return;

      // A field is dependable if its own name is in returnFields,
      // or one of its dependent parents is (so the toggle / chain
      // that reveals it stays available).
      if (
        returnFields.includes(name) ||
        (field.dependentOn && returnFields.includes(field.dependentOn)) ||
        (field.valueDependentOn &&
          returnFields.includes(field.valueDependentOn))
      ) {
        dependencies.add(name);
      }

      // Walk additionalFields branches (both array and object shapes).
      if (field.additionalFields) {
        const branches = Array.isArray(field.additionalFields)
          ? field.additionalFields
          : Object.values(field.additionalFields).flat();

        branches.forEach((af) => {
          if (!af) return;
          const afName = af.name || `${name}_${af.id}`;
          collectFromField(af, afName);
        });
      }
    };

    formSections.forEach((section) => {
      section.fields.forEach((field) => {
        // Enclosure logic — unchanged
        if (
          field.type === "enclosure" &&
          field.isDependentEnclosure &&
          !isDocumentInData(field.name, flatDetails)
        ) {
          dependencies.add(field.name);
        }

        collectFromField(field, field.name);
      });
    });

    return Array.from(dependencies);
  };

  const isFieldDisabled = (fieldName, fieldType = null) => {
    if (
      mode === "edit" &&
      additionalDetails &&
      additionalDetails.returnFields
    ) {
      return !DependableFields.includes(fieldName);
    }
    return false;
  };

  const setDefaultFile = async (fieldName, path, setPreview = null) => {
    try {
      if (!path || typeof path !== "string") {
        console.warn(`No valid URL provided for ${fieldName}`);
        if (setPreview) setApplicantImagePreview("/assets/images/profile.jpg");
        return;
      }
      const response = await fetch(`/Base/DisplayFile?fileName=${path}`);
      if (!response.ok)
        throw new Error(`Failed to fetch file for ${fieldName}`);
      const blob = await response.blob();
      const fileName = path.split("/").pop() || `${fieldName}_file`;
      const file = new File([blob], fileName, { type: blob.type });
      setValue(fieldName, file, { shouldValidate: true });
      if (setPreview) {
        setApplicantImagePreview(`/Base/DisplayFile?fileName=${path}`);
      }
    } catch (error) {
      console.error(`Error setting default file for ${fieldName}:`, error);
      if (setPreview) setApplicantImagePreview("/assets/images/profile.jpg");
    }
  };

  const setAreas = (formDetails) => {
    Object.keys(formDetails).forEach((key, sectionIndex) => {
      const section = formDetails[key];
      section.forEach((item) => {
        if (
          /district|tehsil|muncipality|ward|block|halqapanchayat|village/i.test(
            item.name,
          )
        ) {
          handleAreaChange(sectionIndex, item, item.value);
        }
      });
    });
  };

  useEffect(() => {
    if (applicantImageFile && applicantImageFile instanceof File) {
      const objectUrl = URL.createObjectURL(applicantImageFile);
      setValue("ApplicantImage", applicantImageFile, { shouldValidate: true });
      setApplicantImagePreview(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    } else if (
      mode === "edit" &&
      initialData?.ApplicantImage &&
      typeof initialData.ApplicantImage === "string"
    ) {
      setDefaultFile("ApplicantImage", initialData.ApplicantImage, true);
    } else if (data != null) {
      const flatDetails = flattenFormDetails(data);
      setDefaultFile("ApplicantImage", flatDetails.ApplicantImage, true);
    }
  }, [applicantImageFile, initialData, mode, data, setValue]);

  useEffect(() => {
    return () => {
      districtOptionsLoaded.current.clear();
      hasRunRef.current = false;
      isSyncingRef.current = false;
    };
  }, []);

  // ==========================================
  // 🌟 NEW HELPER FUNCTIONS FOR AREA LOADING
  // ==========================================
  const isEmptyVal = (v) =>
    v === undefined ||
    v === null ||
    v === "" ||
    v === "Please Select" ||
    v === "placeholder";

  const collectAreaFieldsToLoad = (sections, flat) => {
    const result = [];

    const walk = (fields, sectionIdx, parentName) => {
      fields.forEach((f) => {
        const name = f.name || `${parentName}_${f.id}`;
        const savedVal = flat[name];

        if (!isEmptyVal(savedVal)) {
          let parentKey = null;
          if (
            f.enableValueDependency &&
            f.valueDependentOn &&
            f.dependentTable
          ) {
            parentKey = f.valueDependentOn;
          } else if (
            f.dependentOn &&
            f.dependentTable &&
            (!f.dependentOptions ||
              Object.keys(f.dependentOptions).length === 0)
          ) {
            parentKey = f.dependentOn;
          }
          if (parentKey) {
            result.push({
              sectionIdx,
              field: { ...f, name },
              parentName: parentKey,
              parentValue: flat[parentKey],
            });
          }
        }

        if (f.additionalFields) {
          const nested = Array.isArray(f.additionalFields)
            ? f.additionalFields
            : Object.values(f.additionalFields).flat();
          walk(nested, sectionIdx, name);
        }
      });
    };

    sections.forEach((s, i) => walk(s.fields, i, ""));
    return result;
  };

  const loadAreaOptionsForSavedData = async (sections, flat, isActive) => {
    const items = collectAreaFieldsToLoad(sections, flat).filter(
      (i) => !isEmptyVal(i.parentValue),
    );

    if (!items.length) {
      console.log("ℹ️ No area fields to load options for");
      return;
    }

    console.log(
      "🚀 Loading options for fields:",
      items.map((i) => i.field.name),
    );

    const loaded = await Promise.all(
      items.map(async (item) => {
        let table = item.field.dependentTable;
        let extra = "";
        if (item.field.isOfficeField && item.field.officeTypeId) {
          table = "OfficeDetails";
          extra = `&officeTypeId=${item.field.officeTypeId}&isOfficeField=true`;
        }
        try {
          const res = await axiosInstance.get(
            `/Base/GetAreaList?table=${table}&parentId=${item.parentValue}${extra}`,
          );
          const list = res.data?.data || [];
          return {
            name: item.field.name,
            options: [
              { label: "Please Select", value: "Please Select" },
              ...list.map((x) => ({
                value: x.id ?? x.value,
                label: x.name ?? x.label,
              })),
            ],
          };
        } catch (e) {
          console.error(`Options fetch failed for ${item.field.name}`, e);
          return null;
        }
      }),
    );

    if (!isActive()) return;

    const optionsByName = Object.fromEntries(
      loaded.filter(Boolean).map((l) => [l.name, l.options]),
    );

    console.log("✅ Loaded options for:", Object.keys(optionsByName));

    const applyOptions = (fields, parentName = "") =>
      fields.map((f) => {
        const name = f.name || `${parentName}_${f.id}`;
        let next = optionsByName[name]
          ? { ...f, options: optionsByName[name] }
          : f;
        if (f.additionalFields && !Array.isArray(f.additionalFields)) {
          const na = {};
          Object.keys(f.additionalFields).forEach((k) => {
            na[k] = applyOptions(f.additionalFields[k], name);
          });
          next = { ...next, additionalFields: na };
        }
        return next;
      });

    setFormSections((prev) =>
      prev.map((s) => ({ ...s, fields: applyOptions(s.fields) })),
    );

    items.forEach((i) => {
      if (optionsByName[i.field.name]) {
        setValue(i.field.name, flat[i.field.name], { shouldValidate: false });
      }
    });

    console.log("✅ Area options population complete!");
  };
  // ==========================================

  useEffect(() => {
    let isMounted = true;

    async function loadForm() {
      try {
        const { ServiceId, referenceNumber } = location.state || {};
        let config = [];
        let updatedConfig = [];

        setSelectedServiceId(ServiceId);
        if (referenceNumber) {
          setReferenceNumber(referenceNumber);
        }

        const result = await GetServiceContent(ServiceId);
        if (result && result.status && isMounted) {
          try {
            console.log("Raw formElement from API:", result.formelement);
            config = JSON.parse(result.formelement);
            updatedConfig = sanitizeFormSections(config);

            const bankOptions = await fetchBanks();
            updatedConfig = updatedConfig.map((section) => {
              if (section.section === "Bank Details") {
                return {
                  ...section,
                  fields: section.fields.map((field) => {
                    if (field.name === "BankName") {
                      return { ...field, options: bankOptions };
                    }
                    if (
                      field.name === "BranchName" ||
                      field.name === "IfscCode"
                    ) {
                      return {
                        ...field,
                        options: [
                          { label: "Please Select", value: "Please Select" },
                        ],
                      };
                    }
                    return field;
                  }),
                };
              }
              return section;
            });

            setFormSections(updatedConfig);

            if (mode === "edit" || mode === "incomplete") {
              const documentsSection = updatedConfig.find(
                (section) => section.section === "Documents",
              );
              let otherDocuments = [];

              if (mode === "edit" && referenceNumber) {
                const { formDetails } = await fetchFormDetails(referenceNumber);
                otherDocuments =
                  formDetails?.Documents?.filter(
                    (doc) => doc.label === "Other Document",
                  ) || [];
              } else if (mode === "incomplete" && data?.Documents) {
                otherDocuments = data.Documents.filter(
                  (doc) => doc.label === "Other Document",
                );
              }

              if (documentsSection && otherDocuments.length > 0) {
                const newFields = otherDocuments.map((doc, idx) => {
                  const newId = doc.name || `field-${Date.now()}-${idx}`;
                  return {
                    id: newId,
                    type: "enclosure",
                    label: doc.label || "Other Document",
                    name: doc.name || `CustomDocument_${newId}`,
                    minLength: 5,
                    maxLength: 50,
                    options: [],
                    span: 6,
                    validationFunctions: ["notEmpty", "validateFile"],
                    transformationFunctions: [],
                    additionalFields: {},
                    accept: ".pdf",
                    editable: true,
                    dependentOptions: {},
                    isDependentEnclosure: false,
                    dependentValues: [],
                    isConsentCheckbox: false,
                    checkboxLayout: "vertical",
                    declaration: "",
                    defaultValue: {
                      selected: doc.Enclosure || "",
                      file: doc.File || null,
                    },
                  };
                });
                documentsSection.fields = [
                  ...documentsSection.fields,
                  ...newFields,
                ];
              }
              setFormSections(updatedConfig);
            } else {
              setFormSections(updatedConfig);
            }
          } catch (err) {
            console.error("Error parsing formElements:", err);
            if (isMounted) setFormSections([]);
          }
        }

        // ==========================================
        // HANDLE INCOMPLETE / EDIT MODE WITH REF NUMBER
        // ==========================================
        if (
          (mode === "incomplete" || mode === "edit") &&
          referenceNumber &&
          isMounted
        ) {
          const { formDetails, additionalDetails } =
            await fetchFormDetails(referenceNumber);

          setAdditionalDetails(additionalDetails);

          const flatDetails = flattenFormDetails(formDetails);
          setInitialData(flatDetails);

          const resetData = {
            ...flatDetails,
            ...Object.keys(flatDetails).reduce((acc, key) => {
              if (
                flatDetails[key] &&
                typeof flatDetails[key] === "object" &&
                "selected" in flatDetails[key]
              ) {
                acc[`${key}_select`] = flatDetails[key].selected || "";
                acc[`${key}_file`] = flatDetails[key].file || null;
                setDefaultFile(`${key}_file`, flatDetails[key].file, false);
              }
              return acc;
            }, {}),
          };

          const returnFields = normalizeReturnFields(
            additionalDetails?.returnFields,
          );
          const dependableFields = getDependableFields(
            config,
            returnFields,
            flatDetails,
          );
          setDependableFields(dependableFields);

          reset(resetData);

          if (mode === "edit" || mode === "incomplete") {
            const value = getValues("AadharNumber");
            if (value && value.length > 0) {
              setAadhaarValid(true);
            }
          }

          await loadAreaOptionsForSavedData(
            updatedConfig,
            flatDetails,
            () => isMounted,
          );
        } else if (
          mode === "incomplete" &&
          data !== null &&
          data !== undefined &&
          isMounted
        ) {
          const flatDetails = flattenFormDetails(data);

          const resetData = {
            ...flatDetails,
            ...Object.keys(flatDetails).reduce((acc, key) => {
              if (
                flatDetails[key] &&
                typeof flatDetails[key] === "object" &&
                "selected" in flatDetails[key]
              ) {
                acc[`${key}_select`] = flatDetails[key].selected;
                acc[`${key}_file`] = flatDetails[key].file;
                setDefaultFile(`${key}_file`, flatDetails[key].file, false);
              }
              return acc;
            }, {}),
          };

          setInitialData(flatDetails);
          reset(resetData);

          updatedConfig.forEach((section) => {
            section.fields.forEach((field) => {
              if (field.type === "enclosure") {
                const fileFieldName = `${field.name}_file`;
                const selectFieldName = `${field.name}_select`;
                const fileUrl = flatDetails[field.name]?.file;
                const selectedValue = flatDetails[field.name]?.selected;
                if (fileUrl && typeof fileUrl === "string") {
                  if (
                    field.isDependentEnclosure &&
                    field.dependentField &&
                    field.dependentValues?.length > 0
                  ) {
                    const parentValue = flatDetails[field.dependentField];
                    if (!field.dependentValues.includes(parentValue)) {
                      return;
                    }
                  }
                  setDefaultFile(fileFieldName, fileUrl);
                }
                if (selectedValue) {
                  setValue(selectFieldName, selectedValue, {
                    shouldValidate: true,
                  });
                }
              }
            });
          });

          await loadAreaOptionsForSavedData(
            updatedConfig,
            flatDetails,
            () => isMounted,
          );
        }
      } catch (error) {
        console.error("Error fetching service content:", error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadForm();

    return () => {
      isMounted = false;
    };
  }, [location.state, mode, reset, data, setValue]);

  const enclosureDependentFields = formSections
    .flatMap((section) => section.fields)
    .filter((field) => field.type === "enclosure" && field.isDependentEnclosure)
    .map((field) => ({
      fieldName: field.name,
      dependentField: field.dependentField,
    }));

  useEffect(() => {
    if (!formSections.length) return;

    formSections.forEach((section) => {
      section.fields.forEach((field) => {
        if (
          field.type === "select" &&
          field.dependentOn &&
          field.dependentOptions &&
          Object.keys(field.dependentOptions).length > 0
        ) {
          if (field.name === "BranchName" && branchManuallyEnteredRef.current) {
            return;
          }

          const parentValue = watch(field.dependentOn);
          const options = field.dependentOptions[parentValue] || [];
          const currentValue = getValues(field.name);

          const hasRealValue =
            currentValue &&
            currentValue !== "Please Select" &&
            currentValue !== "";

          if (!hasRealValue) {
          } else if (options.length === 0) {
            setValue(field.name, "Please Select", { shouldValidate: true });
          } else {
            const isValid = options.some(
              (opt) => String(opt.value) === String(currentValue),
            );
            if (!isValid) {
              setValue(field.name, "Please Select", { shouldValidate: true });
            }
          }
        }

        if (field.additionalFields) {
          const selectedValue = watch(field.name);
          const additionalFields = field.additionalFields[selectedValue] || [];

          additionalFields.forEach((af) => {
            if (
              af.type === "select" &&
              af.dependentOn &&
              af.dependentOptions &&
              Object.keys(af.dependentOptions).length > 0
            ) {
              const parentValue = watch(af.dependentOn);
              const options = af.dependentOptions[parentValue] || [];
              const currentValue = getValues(af.name);

              const hasRealValue =
                currentValue &&
                currentValue !== "Please Select" &&
                currentValue !== "";

              if (!hasRealValue) {
              } else if (options.length === 0) {
                setValue(af.name, "Please Select", { shouldValidate: true });
              } else {
                const isValid = options.some(
                  (opt) => String(opt.value) === String(currentValue),
                );
                if (!isValid) {
                  setValue(af.name, "Please Select", {
                    shouldValidate: true,
                  });
                }
              }
            }
          });
        }

        if (
          field.type === "enclosure" &&
          field.isDependentEnclosure &&
          field.dependentField &&
          field.dependentValues?.length > 0
        ) {
          const watchedValue = getValues(field.dependentField);
          const shouldShow = field.dependentValues.includes(watchedValue);
          const selectFieldName = `${field.name}_select`;
          const fileFieldName = `${field.name}_file`;

          if (!shouldShow) {
            setValue(selectFieldName, "", { shouldValidate: true });
            setValue(fileFieldName, null, { shouldValidate: true });
          }
        }
      });
    });
  }, [
    watch,
    ...enclosureDependentFields.map(({ dependentField }) =>
      watch(dependentField),
    ),
  ]);

  const handleCopyAddress = async (checked) => {
    if (!checked) {
      const permanentSection = formSections.find(
        (sec) => sec.section === "Permanent Address Details",
      );
      if (!permanentSection) {
        console.warn("Permanent Address section not found");
        return;
      }
      permanentSection.fields.forEach((field) => {
        setValue(field.name, field.type === "select" ? "Please Select" : "", {
          shouldValidate: false,
        });
      });
      return;
    }

    const presentSection = formSections.find(
      (sec) => sec.section === "Present Address Details",
    );
    const permanentSection = formSections.find(
      (sec) => sec.section === "Permanent Address Details",
    );

    if (!presentSection || !permanentSection) {
      console.warn("Present or Permanent Address section not found");
      return;
    }

    const permanentSectionIndex = formSections.findIndex(
      (sec) => sec.section === "Permanent Address Details",
    );

    const presentTypeField = presentSection.fields.find((field) =>
      field.name.toLowerCase().includes("addresstype"),
    );
    const permanentTypeField = permanentSection.fields.find((field) =>
      field.name.toLowerCase().includes("addresstype"),
    );

    if (!presentTypeField || !permanentTypeField) {
      console.warn("Address type fields not found in sections");
      return;
    }

    const presentAddressType = getValues(presentTypeField.name);
    let permanentAddressType = getValues(permanentTypeField.name);

    if (
      permanentAddressType === "Please Select" ||
      !presentTypeField.options.some(
        (opt) => opt.value === permanentAddressType,
      )
    ) {
      permanentAddressType = presentAddressType;
      setValue(permanentTypeField.name, presentAddressType, {
        shouldValidate: true,
      });
    }

    const presentAdditionalFields =
      presentTypeField.additionalFields?.[presentAddressType] || [];
    const permanentAdditionalFields =
      permanentTypeField.additionalFields?.[permanentAddressType] || [];

    permanentAdditionalFields.forEach((field) => {
      setValue(field.name, "", { shouldValidate: false });
    });

    for (const presentField of [
      ...presentSection.fields.filter((f) => f.name !== presentTypeField.name),
      ...presentAdditionalFields,
    ]) {
      const fieldValue = getValues(presentField.name);
      const permanentFieldName = presentField.name.replace(
        "Present",
        "Permanent",
      );
      const permanentField = [
        ...permanentSection.fields,
        ...permanentAdditionalFields,
      ].find((f) => f.name.toLowerCase() === permanentFieldName.toLowerCase());

      if (!permanentField) {
        console.warn(
          `Permanent field not found for ${presentField.name}. Expected: ${permanentFieldName}`,
        );
        continue;
      }

      setValue(permanentField.name, fieldValue, { shouldValidate: true });

      if (
        /district|tehsil|muncipality|ward|block|halqapanchayat|village/i.test(
          presentField.name,
        )
      ) {
        await handleAreaChange(
          permanentSectionIndex,
          permanentField,
          fieldValue,
        );
      }
    }

    const validateFields = async () => {
      await trigger(permanentTypeField.name);
      for (const field of [
        ...permanentSection.fields,
        ...permanentAdditionalFields,
      ]) {
        try {
          await trigger(field.name);
        } catch (error) {
          console.warn(`Validation failed for ${field.name}: ${error.message}`);
        }
      }
    };

    await validateFields();
  };

  const handleAaddhaarNumber = async () => {
    const sendOTP = await fetch(
      "/Home/SendAadhaarOTP?aadhaarNumber=" + aadhaarNumber,
    );
    const result = await sendOTP.json();
    if (result.status) {
      setOtpModal(true);
    }
  };

  const handleOtpSubmit = async (otp) => {
    const formdata = new FormData();
    formdata.append("aadhaarNumber", aadhaarNumber);
    formdata.append("otp", otp);
    const response = await fetch("/Home/ValidateAadhaarOTP", {
      method: "POST",
      body: formdata,
    });

    const result = await response.json();

    if (result.status) {
      setOtpModal(false);
      setAadhaarValid(true);

      const maskedAadhaar = aadhaarNumber.replace(/\d/g, (digit, index) => {
        return index < 8 ? "X" : digit;
      });

      setValue("AadharNumber", maskedAadhaar);
      setAadhaarNumber(result.aadhaarToken);
      toast.success("Aadhaar Number Validated.");
    }
  };

  const handleAreaChange = useCallback(
    async (sectionIndex, field, value) => {
      if (!value || value === "Please Select" || value === "placeholder") {
        return;
      }

      const currentFormSections = formSectionsRef.current;
      if (!currentFormSections || !currentFormSections.length) {
        console.warn("formSections not ready for handleAreaChange");
        return;
      }

      try {
        const dependents = [];

        const collectDependents = (fields, currentSectionIdx) => {
          fields.forEach((f) => {
            if (f.enableValueDependency && f.valueDependentOn === field.name) {
              dependents.push({ field: f, sectionIndex: currentSectionIdx });
            }
            if (f.additionalFields) {
              Object.values(f.additionalFields).forEach((arr) => {
                collectDependents(arr, currentSectionIdx);
              });
            }
          });
        };

        currentFormSections.forEach((section, idx) => {
          collectDependents(section.fields, idx);
        });

        console.log(
          `📍 Processing ${field.name} = ${value}, found ${dependents.length} dependents`,
        );

        for (const dep of dependents) {
          const childField = dep.field;
          const childSectionIdx = dep.sectionIndex;

          let tableName = childField.dependentTable;
          if (!tableName) {
            console.warn(`No dependentTable for ${childField.name}`);
            continue;
          }

          let officeTypeIdParam = "";
          if (childField.isOfficeField && childField.officeTypeId) {
            tableName = "OfficeDetails";
            officeTypeIdParam = `&officeTypeId=${childField.officeTypeId}&isOfficeField=true`;
          }

          console.log(
            ` Fetching options for ${childField.name} from ${tableName} with parentId=${value}`,
          );

          const response = await axiosInstance.get(
            `/Base/GetAreaList?table=${tableName}&parentId=${value}${officeTypeIdParam}`,
          );
          const areaList = response.data?.data || [];

          const uniqueOptions = [
            { label: "Please Select", value: "Please Select" },
            ...areaList.map((item) => ({
              value: item.id ?? item.value,
              label: item.name ?? item.label,
            })),
          ];

          console.log(
            `✅ Loaded ${uniqueOptions.length} options for ${childField.name}`,
          );

          setFormSections((prevSections) => {
            const newSections = [...prevSections];
            if (!newSections[childSectionIdx]) return prevSections;

            const section = { ...newSections[childSectionIdx] };

            const updateFieldOptions = (fields) => {
              return fields.map((f) => {
                if (f.name === childField.name) {
                  return { ...f, options: uniqueOptions };
                }
                if (f.additionalFields) {
                  const updatedAdditional = {};
                  Object.keys(f.additionalFields).forEach((key) => {
                    updatedAdditional[key] = updateFieldOptions(
                      f.additionalFields[key],
                    );
                  });
                  return { ...f, additionalFields: updatedAdditional };
                }
                return f;
              });
            };

            section.fields = updateFieldOptions([...section.fields]);
            newSections[childSectionIdx] = section;
            return newSections;
          });

          await new Promise((resolve) => setTimeout(resolve, 50));

          const currentVal = getValues(childField.name);
          if (
            currentVal &&
            currentVal !== "Please Select" &&
            !uniqueOptions.some(
              (opt) => opt.value.toString() === currentVal.toString(),
            )
          ) {
            console.warn(
              `Value ${currentVal} not found in options for ${childField.name}`,
            );
            setValue(childField.name, "Please Select", {
              shouldValidate: true,
            });
          }
        }
      } catch (error) {
        console.error("Dynamic handleAreaChange error:", error);
      }
    },
    [getValues, setValue],
  );

  const fetchBanks = async () => {
    try {
      const response = await axiosInstance.get("/Base/GetBanks");
      if (response.data.status) {
        const banks = response.data.data.map((bank) => ({
          value: bank.id.toString(),
          label: bank.bankname,
        }));
        return [{ label: "Please Select", value: "Please Select" }, ...banks];
      } else {
        throw new Error("Failed to fetch banks");
      }
    } catch (error) {
      console.error("Error fetching banks:", error);
      toast.error("Failed to load bank options. Please try again.");
      return [{ label: "Please Select", value: "Please Select" }];
    }
  };

  const handleBankChange = async (value) => {
    try {
      const response = await axiosInstance.get(
        `/Base/GetBankCode?bankId=${value}`,
      );
      const bankCode = response.data?.bankCode || "";
      setIfscPrefix(bankCode);
      setValue("IfscCode", bankCode, { shouldValidate: true });

      branchManuallyEnteredRef.current = false;
      // ★ Use guardedSetValue so an edit-mode-disabled BranchName is not
      //   wiped when the officer switches banks on the same page.
      guardedSetValue("BranchName", "", { shouldValidate: false });
      setIsBranchNameReadonly(true);
    } catch (error) {}
  };

  const processField = (field, formData, initialData) => {
    if (field.type === "enclosure" && field.isDependentEnclosure) {
      const parentValue =
        formData[field.dependentField] || initialData[field.dependentField];
      if (!parentValue || !field.dependentValues.includes(parentValue)) {
        return null;
      }
    }
    const sectionFormData = { label: field.label, name: field.name };
    if (field.type === "enclosure") {
      const selectFieldName = `${field.name}_select`;
      const fileFieldName = `${field.name}_file`;
      if (field.name === "Other") {
        const documents =
          formData[fileFieldName] || initialData[field.name]?.documents || [];
        sectionFormData["Documents"] = Array.isArray(documents)
          ? documents.map((doc) => ({
              type: doc.type || "",
              file: doc.file || null,
            }))
          : [];
      } else {
        sectionFormData["Enclosure"] =
          formData[selectFieldName] !== undefined
            ? formData[selectFieldName]
            : initialData[field.name]?.selected || "";
        sectionFormData["File"] =
          formData[fileFieldName] !== undefined
            ? formData[fileFieldName]
            : initialData[field.name]?.file || null;
      }
    } else if (field.name === "ApplicantImage") {
      sectionFormData["File"] =
        formData[field.name] !== undefined
          ? formData[field.name]
          : initialData[field.name] || null;
    } else {
      sectionFormData["value"] =
        formData[field.name] !== undefined
          ? formData[field.name]
          : initialData[field.name] || "";
    }
    if (field.additionalFields) {
      const selectedValue =
        sectionFormData["value"] || sectionFormData["Enclosure"] || "";
      const additionalFields = field.additionalFields[selectedValue];
      if (additionalFields) {
        sectionFormData.additionalFields = additionalFields
          .map((additionalField) => {
            const nestedFieldName =
              additionalField.name || `${field.name}_${additionalField.id}`;
            return processField(
              { ...additionalField, name: nestedFieldName },
              formData,
              initialData,
            );
          })
          .filter((nestedField) => nestedField !== null);
      }
    }
    return sectionFormData;
  };

  const handleEmailAlertSubmit = () => {
    setEmailAlertModalOpen(false);
    const data = getValues();
    onSubmit(data, "submit");
  };

  const handleEmailAlertCancel = () => {
    setEmailAlertModalOpen(false);
  };
  const aadhaarExists = watch("AadharNumber") !== undefined;

  const onSubmit = async (data, operationType) => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);

    const scrollX = window.scrollX;
    const scrollY = window.scrollY;

    try {
      data = getValues();

      if (aadhaarExists && !aadhaarValid && operationType !== "save") {
        alert("Aadhaar Number is not validated.");
        return;
      }

      let emailFieldValue = "";
      formSections.forEach((section) => {
        section.fields.forEach((field) => {
          if (field.type === "email") {
            emailFieldValue = getValues(field.name) || "";
          }
        });
      });

      if (
        operationType === "submit" &&
        !emailFieldValue &&
        !emailAlertModalOpen
      ) {
        setEmailAlertModalOpen(true);
        return;
      }

      setLoading(true);
      const groupedFormData = {};
      let returnFieldsArray = [];
      if (additionalDetails != null && additionalDetails !== "") {
        returnFieldsArray = normalizeReturnFields(
          additionalDetails.returnFields,
        );
      }

      formSections.forEach((section) => {
        groupedFormData[section.section] = [];
        section.fields.forEach((field) => {
          const sectionData = processField(field, data, initialData || {});
          if (sectionData !== null) {
            if (field.name === "AadharNumber") {
              sectionData.value =
                operationType === "submit" ? aadhaarNumber : "";
            }
            groupedFormData[section.section].push(sectionData);
          }
        });
      });

      const formdata = new FormData();
      formdata.append("serviceId", selectedServiceId);
      formdata.append("formDetails", JSON.stringify(groupedFormData));

      for (const section in groupedFormData) {
        groupedFormData[section].forEach((field) => {
          if (field.hasOwnProperty("File") && field.File instanceof File) {
            formdata.append(field.name, field.File);
          } else if (
            field.hasOwnProperty("Documents") &&
            Array.isArray(field.Documents)
          ) {
            field.Documents.forEach((doc, index) => {
              if (doc.file instanceof File) {
                formdata.append(`${field.name}_${index}`, doc.file);
              }
            });
          }
          if (field.additionalFields) {
            field.additionalFields.forEach((nestedField) => {
              if (
                nestedField.hasOwnProperty("File") &&
                nestedField.File instanceof File
              ) {
                formdata.append(nestedField.name, nestedField.File);
              }
            });
          }
        });
      }

      formdata.append(
        "status",
        operationType === "submit" ? "Initiated" : "Incomplete",
      );
      formdata.append("referenceNumber", referenceNumber);

      let url = "/User/InsertFormDetails";
      if (additionalDetails != null && additionalDetails !== "") {
        formdata.append("returnFields", JSON.stringify(returnFieldsArray));
        url = "/User/UpdateApplicationDetails";
      }

      const response = await axiosInstance.post(url, formdata);
      const result = response.data;

      if (result.status) {
        if (result.type === "Submit") {
          navigate("/user/acknowledge", {
            state: { applicationId: result.referenceNumber },
          });
          return;
        } else if (result.type === "Edit") {
          setReferenceNumber(result.referenceNumber);
          navigate("/user/initiated");
          return;
        } else {
          setReferenceNumber(result.referenceNumber);
          toast.success(
            `Form details have been saved as a draft. ${
              aadhaarExists &&
              "If you don't submit the form, you will need to re-verify your Aadhaar number when you edit it later"
            }.`,
          );
          if (formRef.current) {
            formRef.current.scrollIntoView({
              behavior: "smooth",
              block: "end",
            });
          }
        }
      } else {
        console.error("Submission failed:", result);
        toast.error("Failed to save form details.");
      }
    } catch (error) {
      console.error("Error submitting form:", error);
      toast.error("An error occurred while saving the form.");
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
      setIsSubmitting(false);
      window.scrollTo(scrollX, scrollY);
    }
  };

  const addDynamicEnclosure = (sectionId) => {
    const newId = `field-${Date.now()}`;
    const newField = {
      id: newId,
      type: "enclosure",
      label: "Other Document",
      name: `CustomDocument_${newId}`,
      minLength: 5,
      maxLength: 50,
      options: [],
      span: 6,
      validationFunctions: ["notEmpty", "validateFile"],
      transformationFunctions: [],
      additionalFields: {},
      accept: ".pdf",
      editable: true,
      dependentOptions: {},
      isDependentEnclosure: false,
      dependentValues: [],
      isConsentCheckbox: false,
      checkboxLayout: "vertical",
      declaration: "",
    };

    setFormSections((prevSections) =>
      prevSections.map((section) =>
        section.id === sectionId
          ? { ...section, fields: [...section.fields, newField] }
          : section,
      ),
    );
  };

  const removeDynamicEnclosure = (sectionId, fieldId) => {
    setFormSections((prevSections) =>
      prevSections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              fields: section.fields.filter((field) => field.id !== fieldId),
            }
          : section,
      ),
    );
  };

  const renderField = (field, sectionIndex) => {
    if (field.enableConditionalVisibility && field.conditionalField) {
      const dependentValue = watch(field.conditionalField);
      const shouldShow =
        !field.conditionalValues ||
        field.conditionalValues.length === 0 ||
        field.conditionalValues.includes(dependentValue);
      if (!shouldShow) {
        return null;
      }
    }
    const commonStyles = {
      "& .MuiOutlinedInput-root": {
        backgroundColor: "#FFFFFF",
        borderRadius: "12px",
        transition: "all 0.3s ease",
        "& fieldset": {
          borderColor: "#D9E2EC",
        },
        "&:hover fieldset": {
          borderColor: "#3D63B0",
        },
        "&.Mui-focused fieldset": {
          borderColor: "#17418F",
          boxShadow: "0 0 0 3px rgba(23, 65, 143, 0.18)",
        },
        "&.Mui-error fieldset": {
          borderColor: "#B3261E",
        },
        "&.Mui-disabled": {
          backgroundColor: "#F0F3F8",
        },
      },
      "& .MuiInputLabel-root": {
        color: "#4A5568",
        fontWeight: "500",
        fontSize: "0.9rem",
        "&.Mui-focused": {
          color: "#17418F",
        },
        "&.Mui-error": {
          color: "#B3261E",
        },
      },
      "& .MuiInputBase-input": {
        fontSize: "1rem",
        color: "#1A202C",
        padding: "14px 16px",
      },
      "& .MuiFormHelperText-root": {
        color: "#B3261E",
        fontSize: "0.85rem",
      },
      marginBottom: "1.5rem",
    };

    const buttonStyles = {
      background: "linear-gradient(135deg, #17418F 0%, #3D63B0 100%)",
      color: "#FFFFFF",
      fontWeight: "600",
      textTransform: "none",
      borderRadius: "10px",
      padding: "10px 20px",
      "&:hover": {
        background: "linear-gradient(135deg, #0E2A5C 0%, #17418F 100%)",
      },
      "&.Mui-disabled": {
        background: "#E2E8F0",
        color: "#94A3B8",
      },
      marginBottom: "0.5rem",
    };

    const formatDisplayDate = (dateValue) => {
      if (!dateValue) return "";
      try {
        const date = new Date(dateValue);
        if (isNaN(date.getTime())) return "";
        return date.toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
      } catch {
        return "";
      }
    };

    const getLabelWithAsteriskJSX = (field) => {
      const isRequired = field.validationFunctions?.includes("notEmpty");
      return (
        <>
          {field.label}
          {isRequired && (
            <span style={{ color: "#B3261E", fontSize: "1rem" }}> *</span>
          )}
        </>
      );
    };

    switch (field.type) {
      case "text":
      case "email":
      case "date":
        return (
          <Controller
            name={field.name}
            control={control}
            defaultValue=""
            rules={{
              validate: async (value) => {
                if (
                  field.name === "AadharNumber" &&
                  (mode === "edit" || mode === "incomplete" || aadhaarValid)
                ) {
                  return true;
                }

                const ifscRegex = /^[A-Za-z]{4}0[A-Za-z0-9]{6}$/;
                if (
                  field.name === "IfscCode" &&
                  value &&
                  !ifscRegex.test(value)
                ) {
                  return "IFSC code must be 11 characters (e.g., ABCD0123456)";
                }

                // ── Capture BranchName state BEFORE runValidations executes.
                const branchBefore =
                  field.name === "IfscCode" ? getValues("BranchName") : null;
                const wasManual =
                  field.name === "IfscCode"
                    ? branchManuallyEnteredRef.current
                    : false;

                const validationResult = await runValidations(
                  field,
                  value,
                  getValues(),
                  referenceNumber,
                  guardedSetValue,
                  selectedServiceId,
                );

                // Debug log — remove once you've verified every field
                // returns the shape you expect.
                console.log(
                  "[runValidations]",
                  field.type,
                  field.name,
                  "→",
                  validationResult,
                );

                if (field.name === "IfscCode") {
                  if (wasManual && branchBefore && !getValues("BranchName")) {
                    setValue("BranchName", branchBefore, {
                      shouldValidate: false,
                    });
                  }

                  // ── CASE A: IFSC not found in the DB. Soft failure:
                  //   unlock BranchName for manual entry and return `true`
                  //   so RHF treats the field as valid and does NOT block
                  //   submit.
                  if (
                    validationResult &&
                    typeof validationResult === "object" &&
                    validationResult.code === "IFSC_NOT_IN_DB"
                  ) {
                    setIsBranchNameReadonly(false);
                    return true;
                  }

                  // ── CASE B: Any other error from runValidations (empty
                  //   when required, bad format, "select a bank first",
                  //   fetch failure, …) is a hard failure and must
                  //   surface to the user.
                  if (typeof validationResult === "string") {
                    setIsBranchNameReadonly(false);
                    return validationResult;
                  }

                  // ── CASE C: IFSC is valid and the backend returned
                  //   branch details.
                  setIsBranchNameReadonly(true);

                  const branchFromDb =
                    validationResult && typeof validationResult === "object"
                      ? validationResult.bankDetails?.branch
                      : null;

                  const hasRealBranch =
                    typeof branchFromDb === "string" &&
                    branchFromDb.trim() !== "" &&
                    branchFromDb !== "Please Select";

                  if (!branchManuallyEnteredRef.current && hasRealBranch) {
                    setValue("BranchName", branchFromDb, {
                      shouldValidate: true,
                    });
                  }

                  return true;
                }

                return normalizeValidationResult(validationResult);
              },
            }}
            render={({ field: { onChange, value, ref } }) => (
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                }}
              >
                {field.type === "date" ? (
                  <LocalizationProvider dateAdapter={AdapterDateFns}>
                    <DatePicker
                      label={getLabelWithAsteriskJSX(field)}
                      value={
                        value ? parse(value, "dd/MM/yyyy", new Date()) : null
                      }
                      onChange={(newValue) => {
                        const formatted =
                          newValue instanceof Date && !isNaN(newValue.getTime())
                            ? format(newValue, "dd/MM/yyyy")
                            : "";
                        onChange(formatted);
                        trigger(field.name);
                      }}
                      format="dd/MM/yyyy"
                      slotProps={{
                        textField: {
                          fullWidth: true,
                          margin: "normal",
                          error: Boolean(errors[field.name]),
                          helperText: errors[field.name]?.message || "",
                          inputRef: ref,
                          disabled: isFieldDisabled(field.name),
                          InputLabelProps: {
                            shrink: true,
                            style: { fontSize: "1rem", color: "#17418F" },
                          },
                          placeholder: "dd MMM yyyy",
                          sx: commonStyles,
                          onBlur: () => trigger(field.name),
                        },
                      }}
                    />
                  </LocalizationProvider>
                ) : (
                  <Box sx={{ width: "100%" }}>
                    <TextField
                      type={field.type}
                      id={`${field.id}`}
                      label={getLabelWithAsteriskJSX(field)}
                      value={value || ""}
                      onKeyDown={(e) => {
                        isBackspacePressed.current = e.key === "Backspace";
                      }}
                      placeholder={
                        field.name === "OtherDocument" ? "File1, File2,..." : ""
                      }
                      onChange={(e) => {
                        let val = e.target.value;
                        const fieldName = field.name;
                        let transformedVal = val;

                        if (fieldName === "BranchName") {
                          branchManuallyEnteredRef.current = true;
                        }

                        if (fieldName === "IfscCode" && ifscPrefix) {
                          if (!val.startsWith(ifscPrefix)) {
                            val = ifscPrefix + val.slice(ifscPrefix.length);
                          }
                          if (val.length > 11) {
                            val = val.slice(0, 11);
                          }
                          transformedVal = val;
                        }

                        if (fieldName === "IfscCode") {
                          branchManuallyEnteredRef.current = false;
                        }

                        if (fieldName === "AadharNumber") {
                          setAadhaarValid(false);
                          const lastChar = val
                            .toString()
                            .charAt(val.length - 1);
                          let updatedAadhaar;
                          if (isBackspacePressed.current) {
                            updatedAadhaar = aadhaarNumber.slice(0, -1);
                          } else {
                            updatedAadhaar = aadhaarNumber + lastChar;
                          }
                          setAadhaarNumber(updatedAadhaar);
                          transformedVal = updatedAadhaar;
                          val = updatedAadhaar;
                        }

                        if (field.transformationFunctions?.length > 0) {
                          field.transformationFunctions.forEach((fnName) => {
                            const transformFn =
                              TransformationFunctionsList[fnName];
                            if (transformFn) {
                              transformedVal = transformFn(
                                transformedVal,
                                val,
                                getValues(),
                                setValue,
                              );
                            }
                          });
                        }

                        onChange(transformedVal);
                      }}
                      onBlur={() => trigger(field.name)}
                      inputRef={ref}
                      disabled={isFieldDisabled(field.name)}
                      error={Boolean(errors[field.name])}
                      helperText={
                        typeof errors[field.name]?.message === "string"
                          ? errors[field.name]?.message
                          : errors[field.name]?.message?.message || ""
                      }
                      fullWidth
                      margin="normal"
                      InputLabelProps={{
                        shrink: true,
                        style: { fontSize: "1rem", color: "#17418F" },
                      }}
                      inputProps={{
                        maxLength: (() => {
                          if (
                            typeof field.maxLength === "object" &&
                            field.maxLength.dependentOn
                          ) {
                            const dependentValue =
                              getValues()[field.maxLength.dependentOn];
                            return field.maxLength[dependentValue] ?? undefined;
                          }
                          return field.maxLength;
                        })(),
                        readOnly:
                          field.name === "BranchName" && isBranchNameReadonly,
                      }}
                      sx={commonStyles}
                    />
                    {field.name == "AadharNumber" && (
                      <Typography
                        variant="subtitle1"
                        sx={{ fontSize: 12, mt: 0.5, display: "block" }}
                      >
                        Dummy Addhaar Number:123456789012 Dummy OTP:
                        1234567{" "}
                      </Typography>
                    )}
                  </Box>
                )}

                {field.name === "AadharNumber" && aadhaarValid ? (
                  <Typography
                    variant="subtitle2"
                    color="success"
                    fontWeight="bold"
                    sx={{ display: "flex" }}
                  >
                    Verified <CheckCircle />
                  </Typography>
                ) : (
                  ""
                )}
                {field.name === "AadharNumber" &&
                  value.length !== 0 &&
                  !aadhaarValid &&
                  !Boolean(errors[field.name]) && (
                    <Button
                      sx={{
                        background:
                          "linear-gradient(135deg, #17418F 0%, #2561E8 100%)",
                        color: "#FFFFFF",
                        fontWeight: "bold",
                        paddingRight: 2,
                        paddingLeft: 2,
                        borderRadius: 5,
                      }}
                      onClick={handleAaddhaarNumber}
                    >
                      Validate
                    </Button>
                  )}
              </Box>
            )}
          />
        );

      case "checkbox":
        return (
          <Controller
            name={field.name}
            control={control}
            defaultValue={
              field.isConsentCheckbox
                ? false
                : field.options?.length > 0
                  ? []
                  : ""
            }
            rules={{
              validate: async (value) => {
                if (field.required) {
                  if (field.isConsentCheckbox) {
                    return true;
                  } else if (Array.isArray(value)) {
                    if (!value || value.length === 0) {
                      return "At least one option must be selected";
                    }
                  } else if (!value) {
                    return "This field is required";
                  }
                }
                const result = await runValidations(
                  field,
                  value,
                  getValues(),
                  referenceNumber,
                  guardedSetValue,
                  selectedServiceId,
                );
                return normalizeValidationResult(result);
              },
            }}
            render={({ field: { onChange, value, ref } }) => (
              <FormControl
                component="fieldset"
                fullWidth
                margin="normal"
                error={Boolean(errors[field.name])}
                disabled={isFieldDisabled(field.name)}
              >
                {field.isConsentCheckbox ? (
                  <Box display="flex" alignItems="flex-start">
                    <Checkbox
                      checked={!!value}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        onChange(checked);
                        if (
                          field.transformationFunctions?.includes(
                            "handleCopyAddress",
                          )
                        ) {
                          handleCopyAddress(checked, sectionIndex);
                        }
                      }}
                      onBlur={() => trigger(field.name)}
                      inputRef={ref}
                      disabled={isFieldDisabled(field.name)}
                      sx={{ paddingTop: 0, paddingBottom: 0 }}
                    />
                    {field.declaration && (
                      <Typography
                        variant="body2"
                        sx={{
                          marginLeft: "0.5rem",
                          color: "#4A5568",
                        }}
                      >
                        {field.declaration}
                        {field.required && (
                          <span style={{ color: "#B3261E" }}> *</span>
                        )}
                      </Typography>
                    )}
                  </Box>
                ) : (
                  <FormGroup
                    row={field.checkboxLayout === "horizontal"}
                    sx={commonStyles}
                  >
                    {field.options?.map((option) => (
                      <FormControlLabel
                        key={option.value}
                        control={
                          <Checkbox
                            checked={
                              Array.isArray(value)
                                ? value.includes(option.value)
                                : value === option.value
                            }
                            onChange={(e) => {
                              const checked = e.target.checked;
                              if (Array.isArray(value)) {
                                const newValue = checked
                                  ? [...value, option.value]
                                  : value.filter((val) => val !== option.value);
                                onChange(newValue);
                              } else {
                                onChange(checked ? option.value : "");
                              }
                              trigger(field.name);
                            }}
                            onBlur={() => trigger(field.name)}
                            inputRef={ref}
                            disabled={isFieldDisabled(field.name)}
                          />
                        }
                        label={
                          <span>
                            {option.label}
                            {field.required && (
                              <span style={{ color: "#B3261E" }}> *</span>
                            )}
                          </span>
                        }
                      />
                    ))}
                  </FormGroup>
                )}
                {errors[field.name] && (
                  <FormHelperText>{errors[field.name]?.message}</FormHelperText>
                )}
              </FormControl>
            )}
          />
        );

      case "file":
        return (
          <Controller
            name={field.name}
            control={control}
            defaultValue={null}
            rules={{
              validate: async (value) => {
                if (field.name === "ApplicantImage") {
                  setImageValidation(true);
                }

                try {
                  const result = await runValidations(
                    field,
                    value,
                    getValues(),
                    referenceNumber,
                    guardedSetValue,
                    selectedServiceId,
                  );
                  return normalizeValidationResult(result);
                } catch (error) {
                  console.error("File validation error:", error);
                  return "File validation failed";
                } finally {
                  if (field.name === "ApplicantImage") {
                    setImageValidation(false);
                  }
                }
              },
            }}
            render={({ field: { onChange, ref } }) => (
              <FormControl
                fullWidth
                margin="normal"
                error={Boolean(errors[field.name])}
                sx={commonStyles}
              >
                <Button
                  variant="contained"
                  component="label"
                  disabled={isFieldDisabled(field.name) || imageValidation}
                  sx={{
                    ...buttonStyles,
                    position: "relative",
                    minWidth: 200,
                  }}
                  onBlur={() => trigger(field.name)}
                >
                  {imageValidation ? (
                    <>
                      <CircularProgress
                        size={22}
                        sx={{
                          color: "white",
                          position: "absolute",
                        }}
                      />
                      <span style={{ opacity: 0 }}>
                        {getLabelWithAsteriskJSX(field)}
                      </span>
                    </>
                  ) : (
                    getLabelWithAsteriskJSX(field)
                  )}

                  <input
                    type="file"
                    hidden
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      onChange(file);
                      trigger(field.name);
                    }}
                    ref={ref}
                    accept={field.accept}
                  />
                </Button>
                <Typography sx={{ fontSize: "0.85rem", color: "#4A5568" }}>
                  Accepted File Types: {field.accept} Size: 20kb-50kb
                </Typography>
                <FormHelperText sx={{ color: "#B3261E" }}>
                  {errors[field.name]?.message || ""}
                </FormHelperText>
              </FormControl>
            )}
          />
        );

      case "select":
        return (
          <Controller
            name={field.name}
            control={control}
            defaultValue="Please Select"
            rules={{
              validate: async (value) => {
                const result = await runValidations(
                  field,
                  value,
                  getValues(),
                  referenceNumber,
                  guardedSetValue,
                  selectedServiceId,
                );
                return normalizeValidationResult(result);
              },
            }}
            render={({ field: { onChange, value, ref } }) => {
              let options = [];
              if (field.dependentOn && field.dependentOn !== "") {
                const parentValue = watch(field.dependentOn);
                options =
                  field.dependentOptions && field.dependentOptions[parentValue]
                    ? field.dependentOptions[parentValue]
                    : field.options || [];
              } else {
                options = field.options || [];
              }

              const pleaseSelect = {
                value: "Please Select",
                label: "Please Select",
              };
              if (!options.some((opt) => opt.value === pleaseSelect.value)) {
                options = [pleaseSelect, ...options];
              }

              if (
                value &&
                !options.some(
                  (opt) => opt.value.toString() === value.toString(),
                )
              ) {
                options = [...options, { value, label: value.toString() }];
              }

              return (
                <>
                  <FormControl fullWidth>
                    <Autocomplete
                      fullWidth
                      options={options}
                      value={
                        options.find(
                          (opt) => String(opt.value) === String(value),
                        ) || null
                      }
                      isOptionEqualToValue={(o, v) =>
                        String(o.value) === String(v.value)
                      }
                      getOptionLabel={(option) => option.label || ""}
                      onChange={(event, newOption) => {
                        const newValue = newOption?.value || "";
                        onChange({ target: { value: newValue } });
                        trigger(field.name);
                        console.log(
                          "Selected value:",
                          newValue,
                          "for field:",
                          field.name,
                        );

                        if (
                          /district|muncipality|block|halqapanchayat/i.test(
                            field.name,
                          )
                        ) {
                          handleAreaChange(sectionIndex, field, newValue);
                        }
                        if (field.name === "BankName") {
                          handleBankChange(newValue);
                        }

                        if (field.additionalFields) {
                          Object.entries(field.additionalFields).forEach(
                            ([key, additionalFields]) => {
                              if (key !== newValue) {
                                additionalFields.forEach((additionalField) => {
                                  const nestedFieldName =
                                    additionalField.name ||
                                    `${field.name}_${additionalField.id}`;
                                  unregister(nestedFieldName, {
                                    keepValue: false,
                                  });
                                });
                              }
                            },
                          );
                        }
                      }}
                      onBlur={() => trigger(field.name)}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          variant="outlined"
                          label={getLabelWithAsteriskJSX(field)}
                          error={Boolean(errors[field.name])}
                          helperText={errors[field.name]?.message || ""}
                          InputLabelProps={{
                            shrink: true,
                            style: { fontSize: "1.2rem", color: "#17418F" },
                          }}
                          inputRef={ref}
                          sx={commonStyles}
                          disabled={isFieldDisabled(field.name)}
                        />
                      )}
                      disableClearable
                    />
                  </FormControl>

                  {field.additionalFields &&
                    field.additionalFields[value] &&
                    field.additionalFields[value].map((additionalField) => {
                      const nestedFieldName =
                        additionalField.name ||
                        `${field.name}_${additionalField.id}`;
                      return (
                        <Col
                          xs={12}
                          lg={additionalField.span}
                          key={additionalField.id}
                        >
                          {renderField(
                            {
                              ...additionalField,
                              name: nestedFieldName,
                            },
                            sectionIndex,
                          )}
                        </Col>
                      );
                    })}
                </>
              );
            }}
          />
        );

      case "enclosure":
        const isDependent = field.isDependentEnclosure;
        const parentValue = isDependent ? watch(field.dependentField) : null;
        if (
          isDependent &&
          (!parentValue || !field.dependentValues.includes(parentValue))
        ) {
          return null;
        }

        const selectFieldName = `${field.name}_select`;
        const fileFieldName = `${field.name}_file`;
        const isDynamic = !field.options || field.options.length === 0;
        const isDisabled = isFieldDisabled(field.name);

        return (
          <Box sx={{ width: "100%", mb: 2, position: "relative" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
              <Typography variant="subtitle1">{field.label}</Typography>
              {isDynamic && field.id.includes("field-") && (
                <IconButton
                  size="small"
                  onClick={() => {
                    removeDynamicEnclosure(`section-${sectionIndex}`, field.id);
                    unregister(selectFieldName);
                    unregister(fileFieldName);
                  }}
                  sx={{
                    color: "#B3261E",
                    "&:hover": { color: "#8C1D18" },
                    p: 0.5,
                  }}
                  disabled={isDisabled}
                  title="Remove Document"
                >
                  <Delete fontSize="small" />
                </IconButton>
              )}
            </Box>

            {isDynamic ? (
              <Controller
                name={selectFieldName}
                control={control}
                defaultValue={initialData?.[field.name]?.selected || ""}
                rules={{ required: "Enclosure name is required" }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Enclosure Name"
                    fullWidth
                    margin="normal"
                    error={Boolean(errors[selectFieldName])}
                    helperText={errors[selectFieldName]?.message}
                    sx={commonStyles}
                    disabled={isDisabled}
                    onBlur={() => trigger(selectFieldName)}
                  />
                )}
              />
            ) : (
              (() => {
                let options = field.options || [];
                const placeholderOption = {
                  value: "placeholder",
                  label: "Please Select",
                };

                const hasPlaceholder = options.some(
                  (opt) =>
                    opt.label === "Please Select" ||
                    opt.value === "placeholder" ||
                    opt.value === "",
                );

                if (!hasPlaceholder) {
                  options = [placeholderOption, ...options];
                }

                return (
                  <Controller
                    name={selectFieldName}
                    control={control}
                    defaultValue={
                      initialData?.[field.name]?.selected || "placeholder"
                    }
                    rules={{
                      validate: async (value) => {
                        if (
                          field.required &&
                          (!value || value === "placeholder")
                        ) {
                          return "Please select an option";
                        }
                        return true;
                      },
                    }}
                    render={({ field: { onChange, value } }) => (
                      <TextField
                        select
                        label={getLabelWithAsteriskJSX(field)}
                        value={value || "placeholder"}
                        onChange={(e) => {
                          const newValue = e.target.value;
                          if (newValue !== "placeholder") {
                            onChange(newValue);
                            setValue(fileFieldName, null, {
                              shouldValidate: true,
                            });
                          } else {
                            onChange("");
                            setValue(fileFieldName, null, {
                              shouldValidate: true,
                            });
                          }
                          trigger(selectFieldName);
                        }}
                        onBlur={() => trigger(selectFieldName)}
                        disabled={isDisabled}
                        error={Boolean(errors[selectFieldName])}
                        helperText={errors[selectFieldName]?.message || ""}
                        fullWidth
                        margin="normal"
                        SelectProps={{ native: true }}
                        sx={{ mb: 2, ...commonStyles }}
                      >
                        {options.map((option) => (
                          <option
                            key={option.id || option.value}
                            value={
                              option.value === "placeholder"
                                ? "placeholder"
                                : option.value
                            }
                          >
                            {option.label}
                          </option>
                        ))}
                      </TextField>
                    )}
                  />
                );
              })()
            )}

            <Controller
              name={fileFieldName}
              control={control}
              defaultValue={initialData?.[field.name]?.file || null}
              rules={{
                validate: async (value) => {
                  const selectValue = getValues(selectFieldName);
                  if (
                    field.required &&
                    !value &&
                    selectValue &&
                    selectValue !== "placeholder"
                  ) {
                    return "Please upload a file";
                  }
                  const result = await runValidations(
                    field,
                    value,
                    getValues(),
                    referenceNumber,
                    guardedSetValue,
                    selectedServiceId,
                  );
                  return normalizeValidationResult(result);
                },
              }}
              render={({ field: { onChange, value } }) => (
                <Box>
                  {value && (
                    <Box
                      display="flex"
                      alignItems="center"
                      gap={1}
                      sx={{ mb: 1 }}
                    >
                      <FormHelperText
                        sx={{
                          cursor: "pointer",
                          color: "#17418F",
                          textDecoration: "underline",
                          fontSize: "0.9rem",
                          "&:hover": { color: "#0E2A5C" },
                        }}
                        onClick={() => {
                          const fileURL =
                            value instanceof File
                              ? URL.createObjectURL(value)
                              : value;
                          window.open(fileURL, "_blank");
                        }}
                      >
                        {value instanceof File ? value.name : "View file"}
                      </FormHelperText>
                      <IconButton
                        size="small"
                        onClick={() => onChange(null)}
                        sx={{
                          color: "#B3261E",
                          "&:hover": { color: "#8C1D18" },
                          p: 0.5,
                        }}
                        disabled={isDisabled}
                      >
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  )}
                  <Button
                    variant="contained"
                    component="label"
                    sx={{
                      width: "100%",
                      borderRadius: "12px",
                      ...buttonStyles,
                    }}
                    disabled={
                      isDisabled ||
                      !getValues(selectFieldName) ||
                      getValues(selectFieldName) === "placeholder"
                    }
                    onBlur={() => trigger(fileFieldName)}
                  >
                    Upload File
                    <input
                      type="file"
                      hidden
                      onChange={(e) => {
                        const file = e.target.files[0];
                        onChange(file);
                        trigger(fileFieldName);
                      }}
                      accept={field.accept || ".pdf"}
                    />
                  </Button>
                  <FormHelperText sx={{ color: "#B3261E" }}>
                    {errors[fileFieldName]?.message || ""}
                  </FormHelperText>
                  <Typography sx={{ fontSize: "0.85rem", color: "#4A5568" }}>
                    Accepted File Types: {field.accept || ".pdf"} Size:
                    100kb-600kb
                  </Typography>
                </Box>
              )}
            />
          </Box>
        );
      default:
        return null;
    }
  };

  if (loading)
    return (
      <Box
        sx={{
          width: "100%",
          height: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          bgcolor: "#F5F7FA",
        }}
      >
        <CircularProgress size={60} color="primary" />
      </Box>
    );

  return (
    <Box
      sx={{
        maxWidth: "90%",
        margin: "2rem auto",
        background: "#F5F7FA",
        borderRadius: "16px",
        padding: { xs: "1.5rem", md: "3rem" },
        minHeight: "100vh",
        overflowY: "auto",
        "&::-webkit-scrollbar": {
          width: "8px",
          backgroundColor: "#D9E2EC",
          borderRadius: "4px",
        },
        "&::-webkit-scrollbar-thumb": {
          backgroundColor: "#17418F",
          borderRadius: "4px",
        },
      }}
    >
      <Backdrop
        sx={{
          color: "#FFFFFF",
          zIndex: (theme) => theme.zIndex.drawer + 999,
          backgroundColor: "rgba(15, 23, 42, 0.75)",
          backdropFilter: "blur(2px)",
        }}
        open={isSubmitting}
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
          }}
        >
          <CircularProgress size={64} sx={{ color: "#FFFFFF" }} />
          <Typography variant="h6" sx={{ fontWeight: 700, color: "#FFFFFF" }}>
            Submitting your application…
          </Typography>
          <Typography
            variant="body2"
            sx={{ color: "#E2E8F0", textAlign: "center", maxWidth: 320 }}
          >
            Please wait — do not close or refresh this page.
          </Typography>
        </Box>
      </Backdrop>

      <Grid container spacing={3} alignItems="stretch">
        <Grid size={{ xs: 12 }}>
          <form
            onSubmit={handleSubmit((data) => onSubmit(data, "submit"))}
            autoComplete="off"
          >
            <Grid container spacing={3} alignItems="stretch">
              {formSections.map((section, index) => {
                const isFullRow = section.fullRow === true;

                return (
                  <Grid
                    size={{ xs: 12, md: isFullRow ? 12 : 6 }}
                    key={section.id}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        flexDirection: "column",
                        height: "100%",
                        padding: "2rem",
                        borderRadius: "12px",
                        background: "#FFFFFF",
                        border: "1px solid #D9E2EC",
                        boxShadow: "0 2px 12px rgba(15, 23, 42, 0.06)",
                        transition: "all 0.3s ease",
                        "&:hover": {
                          boxShadow: "0 6px 22px rgba(23, 65, 143, 0.14)",
                          borderColor: "#3D63B0",
                        },
                      }}
                    >
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 2,
                          mb: "1.5rem",
                        }}
                      >
                        {sectionIconMap[section.section] || (
                          <HelpOutlineIcon
                            sx={{ fontSize: 36, color: "#17418F" }}
                          />
                        )}
                        <Typography
                          variant="h6"
                          sx={{
                            fontWeight: "600",
                            color: "#1A202C",
                            fontSize: "1.5rem",
                          }}
                        >
                          {section.section}
                        </Typography>
                      </Box>

                      <Divider sx={{ mb: "1.5rem", borderColor: "#D9E2EC" }} />

                      {section.section === "Applicant Details" && (
                        <Box
                          sx={{
                            display: "flex",
                            justifyContent: "center",
                            mb: "1.5rem",
                          }}
                        >
                          <Box
                            component="img"
                            src={applicantImagePreview}
                            alt="Applicant Image"
                            sx={{
                              width: 180,
                              height: 180,
                              borderRadius: "50%",
                              objectFit: "cover",
                              boxShadow: "0 4px 12px rgba(15, 23, 42, 0.12)",
                              border: "3px solid #3D63B0",
                            }}
                          />
                        </Box>
                      )}

                      {section.section === "Documents" && (
                        <Typography
                          sx={{
                            fontSize: "0.875rem",
                            textAlign: "center",
                            color: "#4A5568",
                            mb: "1rem",
                          }}
                        >
                          Accepted File Type: .pdf, Size: 100Kb-200Kb
                        </Typography>
                      )}

                      <Grid container spacing={2}>
                        {section.fields.map((field) => {
                          const element = renderField(field, index);
                          if (element != null) {
                            return (
                              <Grid
                                size={{ xs: 12, lg: field.span }}
                                key={field.id}
                              >
                                {element}
                              </Grid>
                            );
                          }
                          return null;
                        })}
                      </Grid>

                      {section.section === "Documents" && (
                        <Box
                          sx={{
                            display: "flex",
                            justifyContent: "flex-start",
                            mt: 2,
                          }}
                        >
                          <Button
                            variant="outlined"
                            onClick={() => addDynamicEnclosure(section.id)}
                            sx={{
                              color: "#17418F",
                              borderColor: "#17418F",
                              fontWeight: 600,
                              borderRadius: "8px",
                              "&:hover": {
                                borderColor: "#0E2A5C",
                                backgroundColor: "rgba(23, 65, 143, 0.06)",
                              },
                            }}
                          >
                            Add Document
                          </Button>
                        </Box>
                      )}
                    </Box>
                  </Grid>
                );
              })}

              <Grid size={{ xs: 12, lg: 12 }}>
                <Box
                  sx={{
                    position: "sticky",
                    bottom: 0,
                    backgroundColor: "#FFFFFF",
                    padding: "1.5rem",
                    borderTop: "1px solid #D9E2EC",
                    boxShadow: "0 -4px 16px rgba(15, 23, 42, 0.08)",
                    display: "flex",
                    justifyContent: "center",
                    gap: 3,
                    zIndex: 1000,
                  }}
                >
                  {mode !== "edit" && (
                    <Button
                      sx={{
                        background:
                          "linear-gradient(135deg, #FF9933 0%, #C75B00 100%)",
                        color: "#FFFFFF",
                        fontSize: { xs: "0.9rem", md: "1rem" },
                        fontWeight: "600",
                        padding: "0.75rem 2.5rem",
                        borderRadius: "10px",
                        textTransform: "none",
                        "&:hover": {
                          background:
                            "linear-gradient(135deg, #C75B00 0%, #8A3E00 100%)",
                        },
                        "&.Mui-disabled": {
                          background: "#E2E8F0",
                          color: "#94A3B8",
                        },
                      }}
                      disabled={buttonLoading || loading || isSubmitting}
                      onClick={() => onSubmit(null, "save")}
                    >
                      Save as Draft{buttonLoading || isSubmitting ? "…" : ""}
                    </Button>
                  )}
                  <Button
                    type="submit"
                    sx={{
                      background:
                        "linear-gradient(135deg, #17418F 0%, #2561E8 100%)",
                      color: "#FFFFFF",
                      fontSize: { xs: "0.9rem", md: "1rem" },
                      fontWeight: "600",
                      padding: "0.75rem 2.5rem",
                      borderRadius: "10px",
                      textTransform: "none",
                      "&:hover": {
                        background:
                          "linear-gradient(135deg, #0E2A5C 0%, #17418F 100%)",
                      },
                      "&.Mui-disabled": {
                        background: "#E2E8F0",
                        color: "#94A3B8",
                      },
                    }}
                    disabled={buttonLoading || loading || isSubmitting}
                    startIcon={
                      isSubmitting ? (
                        <CircularProgress size={18} color="inherit" />
                      ) : null
                    }
                  >
                    {isSubmitting ? "Submitting…" : "Submit"}
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </form>
        </Grid>
      </Grid>

      <MessageModal
        open={messageModalOpen}
        onClose={() => setMessageModalOpen(false)}
        title="Error"
        message="Some fields are not filled or are incorrectly filed. Please correctly fill all fields."
        type="error"
      />

      <MessageModal
        open={emailAlertModalOpen}
        title="Email Required"
        message="Documents like Acknowledgement and Sanction Letters are sent via email. Please provide an email address if you want to receive these letters via mail."
        primaryButton={{
          text: "Submit Without Email",
          action: handleEmailAlertSubmit,
        }}
        secondaryButton={{
          text: "Cancel",
          action: handleEmailAlertCancel,
        }}
        onClose={handleEmailAlertCancel}
      />

      {otpModal && (
        <OtpModal
          open={otpModal}
          onClose={() => {
            setOtpModal(false);
          }}
          onSubmit={handleOtpSubmit}
          registeredAt="Mobile Number."
        />
      )}

      <ToastContainer />
    </Box>
  );
};

export default DynamicScrollableForm;
