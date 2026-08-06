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
  FormLabel,
  FormGroup,
  CircularProgress,
  Grid2 as Grid,
  Autocomplete,
} from "@mui/material";
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
import MessageModal from "../../components/MessageModal";
import { toast, ToastContainer } from "react-toastify";
import OtpModal from "../../components/OtpModal";
import { CheckCircle, Delete } from "@mui/icons-material";
import { LocalizationProvider, DatePicker } from "@mui/x-date-pickers";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { format, parse } from "date-fns";

const sectionIconMap = {
  Location: <LocationOnIcon sx={{ fontSize: 36, color: "#14B8A6" }} />,
  "Applicant Details": <PersonIcon sx={{ fontSize: 36, color: "#EC4899" }} />,
  "Present Address Details": (
    <HomeIcon sx={{ fontSize: 36, color: "#8B5CF6" }} />
  ),
  "Permanent Address Details": (
    <HomeIcon sx={{ fontSize: 36, color: "#8B5CF6" }} />
  ),
  "Bank Details": (
    <AccountBalanceIcon sx={{ fontSize: 36, color: "#F59E0B" }} />
  ),
  Documents: <InsertDriveFileIcon sx={{ fontSize: 36, color: "#10B981" }} />,
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

// Helper function to sanitize form sections (remove duplicate options)
const sanitizeFormSections = (sections) => {
  return sections.map((section) => ({
    ...section,
    fields: section.fields.map((field) => {
      if (field.options) {
        const seenValues = new Set();
        const uniqueOptions = field.options.filter((option) => {
          if (seenValues.has(option.value)) return false;
          seenValues.add(option.value);
          return true;
        });
        return { ...field, options: uniqueOptions };
      }
      return field;
    }),
  }));
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
    formState: { errors },
  } = useForm({
    mode: "onBlur",
    reValidateMode: "onBlur",
    shouldUnregister: false,
    defaultValues: {},
  });

  const [formSections, setFormSections] = useState([]);
  const [services, setServices] = useState([]); // <-- NEW: State for services list
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
  const isBackspacePressed = useRef(false);
  const formRef = useRef(null);
  const applicantImageFile = watch("ApplicantImage");

  // ========== FETCH SERVICES LIST ON MOUNT ==========
  useEffect(() => {
    async function fetchServices() {
      try {
        const response = await axiosInstance.get("/Base/GetServices");
        if (response.data && response.data.services) {
          setServices(response.data.services);
        }
      } catch (error) {
        console.error("Error fetching services:", error);
      }
    }
    fetchServices();
  }, []);

  // ========== HANDLE SERVICE SECHANGE ==========
  const handleServiceChange = async (e) => {
    const serviceId = e.target.value;
    setSelectedServiceId(serviceId);
    setLoading(true);
    setFormSections([]); // Clear previous form

    try {
      const result = await GetServiceContent(serviceId);
      if (result && result.status) {
        let config = JSON.parse(result.formelement);
        let updatedConfig = sanitizeFormSections(config);

        const bankOptions = await fetchBanks();
        updatedConfig = updatedConfig.map((section) => {
          if (section.section === "Bank Details") {
            return {
              ...section,
              fields: section.fields.map((field) => {
                if (field.name === "BankName")
                  return { ...field, options: bankOptions };
                if (field.name === "BranchName" || field.name === "IfscCode") {
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
      }
    } catch (error) {
      console.error("Error fetching service content:", error);
      toast.error("Failed to load service form.");
    } finally {
      setLoading(false);
    }
  };

  // ========== SAME AS PRESENT SYNC LOGIC ==========
  const sameAsPresentChecked = useWatch({ control, name: "SameAsPresent" });
  const [presentFieldNames, setPresentFieldNames] = useState([]);
  const [permanentFieldMap, setPermanentFieldMap] = useState({});
  const isSyncingRef = useRef(false);

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
          Object.values(field.additionalFields).forEach((arr) => {
            if (Array.isArray(arr))
              names = names.concat(collectFieldNames(arr, prefix));
          });
        }
      });
      return names;
      a;
    };

    const presentNames = collectFieldNames(presentSection.fields);
    const permanentNames = collectFieldNames(permanentSection.fields);
    const mapping = {};
    presentNames.forEach((pName) => {
      const permName = pName.replace(/^Present/, "Permanent");
      if (permanentNames.includes(permName)) mapping[pName] = permName;
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

  const isFieldDisabled = (fieldName) => {
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
      if (!path || typeof path !== "string") return;
      const response = await fetch(`/Base/DisplayFile?fileName=${path}`);
      if (!response.ok)
        throw new Error(`Failed to fetch file for ${fieldName}`);
      const blob = await response.blob();
      const fileName = path.split("/").pop() || `${fieldName}_file`;
      const file = new File([blob], fileName, { type: blob.type });
      setValue(fieldName, file, { shouldValidate: true });
      if (setPreview)
        setApplicantImagePreview(`/Base/DisplayFile?fileName=${path}`);
    } catch (error) {
      console.error(`Error setting default file for ${fieldName}:`, error);
    }
  };

  const handleAreaChange = useCallback(
    async (sectionIndex, field, value) => {
      try {
        const dependents = [];
        const collectDependents = (fields, currentSectionIdx) => {
          fields.forEach((f) => {
            if (f.enableValueDependency && f.valueDependentOn === field.name) {
              dependents.push({ field: f, sectionIndex: currentSectionIdx });
            }
            if (f.additionalFields) {
              Object.values(f.additionalFields).forEach((arr) =>
                collectDependents(arr, currentSectionIdx),
              );
            }
          });
        };
        formSections.forEach((section, idx) =>
          collectDependents(section.fields, idx),
        );

        for (const dep of dependents) {
          const childField = dep.field;
          let tableName = childField.dependentTable;
          if (!tableName) continue;

          let officeTypeIdParam = "";
          if (childField.isOfficeField && childField.officeTypeId) {
            tableName = "OfficeDetails";
            officeTypeIdParam = `&officeTypeId=${childField.officeTypeId}&isOfficeField=true`;
          }

          const response = await axiosInstance.get(
            `/Base/GetAreaList?table=${tableName}&parentId=${value}${officeTypeIdParam}`,
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
          setFormSections((prevSections) => {
            const newSections = [...prevSections];
            const section = newSections[dep.sectionIndex];
            const updateFieldOptions = (fields) =>
              fields.map((f) => {
                if (f.name === childField.name)
                  return { ...f, options: newOptions };
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
            section.fields = updateFieldOptions(section.fields);
            return newSections;
          });

          const currentVal = getValues(childField.name);
          if (
            currentVal &&
            !newOptions.some(
              (opt) => opt.value.toString() === currentVal.toString(),
            )
          ) {
            setValue(childField.name, "Please Select", {
              shouldValidate: true,
            });
          }
        }
      } catch (error) {
        console.error("Dynamic handleAreaChange error:", error);
      }
    },
    [formSections, getValues, setValue, setFormSections],
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
      }
    } catch (error) {
      console.error("Error fetching banks:", error);
    }
    return [{ label: "Please Select", value: "Please Select" }];
  };

  const handleBankChange = async (value) => {
    try {
      const response = await axiosInstance.get(
        `/Base/GetBankCode?bankId=${value}`,
      );
      const bankCode = response.data?.bankCode || "";
      setIfscPrefix(bankCode);
      setValue("IfscCode", bankCode, { shouldValidate: true });
    } catch (error) {}
  };

  // ========== INITIAL FORM LOAD (From location.state OR Dropdown) ==========
  useEffect(() => {
    async function loadInitialForm() {
      const { ServiceId: stateServiceId, referenceNumber: refNum } =
        location.state || {};

      // If ServiceId is passed via navigation state, load it automatically
      if (stateServiceId) {
        setSelectedServiceId(stateServiceId);
        if (refNum) setReferenceNumber(refNum);
        setLoading(true);

        try {
          const result = await GetServiceContent(stateServiceId);
          if (result && result.status) {
            let config = JSON.parse(result.formelement);
            let updatedConfig = sanitizeFormSections(config);

            const bankOptions = await fetchBanks();
            updatedConfig = updatedConfig.map((section) => {
              if (section.section === "Bank Details") {
                return {
                  ...section,
                  fields: section.fields.map((field) => {
                    if (field.name === "BankName")
                      return { ...field, options: bankOptions };
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

            if ((mode === "incomplete" || mode === "edit") && refNum) {
              const { formDetails, additionalDetails: addDetails } =
                await fetchFormDetails(refNum);
              setAdditionalDetails(addDetails);
              const flatDetails = flattenFormDetails(formDetails);
              setInitialData(flatDetails);

              const resetData = { ...flatDetails };
              Object.keys(flatDetails).forEach((key) => {
                if (
                  flatDetails[key] &&
                  typeof flatDetails[key] === "object" &&
                  "selected" in flatDetails[key]
                ) {
                  resetData[`${key}_select`] = flatDetails[key].selected || "";
                  resetData[`${key}_file`] = flatDetails[key].file || null;
                  setDefaultFile(`${key}_file`, flatDetails[key].file, false);
                }
              });

              const returnFields = JSON.parse(addDetails?.returnFields || "[]");
              setDependableFields(returnFields);
              reset(resetData);

              if (mode === "edit" || mode === "incomplete") {
                const value = getValues("AadharNumber");
                if (value && value.length > 0) setAadhaarValid(true);
              }
            }
          }
        } catch (error) {
          console.error("Error fetching service content:", error);
        } finally {
          setLoading(false);
        }
      } else {
        // No ServiceId in state, allow user to select from dropdown
        setLoading(false);
      }
    }
    loadInitialForm();
  }, [location.state, mode, reset, data, setValue]);

  const handleAaddhaarNumber = async () => {
    const sendOTP = await fetch(
      "/Home/SendAadhaarOTP?aadhaarNumber=" + aadhaarNumber,
    );
    const result = await sendOTP.json();
    if (result.status) setOtpModal(true);
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
      const maskedAadhaar = aadhaarNumber.replace(/\d/g, (digit, index) =>
        index < 8 ? "X" : digit,
      );
      setValue("AadharNumber", maskedAadhaar);
      setAadhaarNumber(result.aadhaarToken);
      toast.success("Aadhaar Number Validated.");
    }
    if (result.status) {
      setOtpModal(false);
      setAadhaarValid(true);
      const maskedAadhaar = aadhaarNumber.replace(/\d/g, (digit, index) =>
        index < 8 ? "X" : digit,
      );
      setValue("AadharNumber", maskedAadhaar);
      setAadhaarNumber(result.aadhaarToken);
      toast.success("Aadhaar Number Validated.");
    }
  };

  const handleCopyAddress = async (checked) => {
    if (!checked) {
      const permanentSection = formSections.find(
        (sec) => sec.section === "Permanent Address Details",
      );
      if (permanentSection) {
        permanentSection.fields.forEach((field) => {
          setValue(field.name, field.type === "select" ? "Please Select" : "", {
            shouldValidate: false,
          });
        });
      }
    }
  };

  const processField = (field, formData, initialData) => {
    if (field.type === "enclosure" && field.isDependentEnclosure) {
      const parentValue =
        formData[field.dependentField] || initialData[field.dependentField];
      if (!parentValue || !field.dependentValues.includes(parentValue))
        return null;
    }
    const sectionFormData = { label: field.label, name: field.name };
    if (field.type === "enclosure") {
      const selectFieldName = `${field.name}_select`;
      const fileFieldName = `${field.name}_file`;
      sectionFormData["Enclosure"] =
        formData[selectFieldName] !== undefined
          ? formData[selectFieldName]
          : initialData[field.name]?.selected || "";
      sectionFormData["File"] =
        formData[fileFieldName] !== undefined
          ? formData[fileFieldName]
          : initialData[field.name]?.file || null;
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
    return sectionFormData;
  };

  const handleEmailAlertSubmit = () => {
    setEmailAlertModalOpen(false);
    onSubmit(getValues(), "submit");
  };

  const onSubmit = async (data, operationType) => {
    data = getValues();
    if (watch("AadharNumber") && !aadhaarValid && operationType !== "save") {
      alert("Aadhaar Number is not validated.");
      return;
    }

    let emailFieldValue = "";
    formSections.forEach((section) => {
      section.fields.forEach((field) => {
        if (field.type === "email")
          emailFieldValue = getValues(field.name) || "";
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
    formSections.forEach((section) => {
      groupedFormData[section.section] = [];
      section.fields.forEach((field) => {
        const sectionData = processField(field, data, initialData || {});
        if (sectionData !== null) {
          if (field.name === "AadharNumber")
            sectionData.value = operationType === "submit" ? aadhaarNumber : "";
          groupedFormData[section.section].push(sectionData);
        }
      });
    });

    const formdata = new FormData();
    formdata.append("serviceId", selectedServiceId);
    formdata.append("formDetails", JSON.stringify(groupedFormData));
    formdata.append(
      "status",
      operationType === "submit" ? "Initiated" : "Incomplete",
    );
    formdata.append("referenceNumber", referenceNumber);

    let url = "/User/InsertFormDetails";
    if (additionalDetails != null && additionalDetails !== "") {
      formdata.append("returnFields", additionalDetails.returnFields);
      url = "/User/UpdateApplicationDetails";
    }

    try {
      const response = await axiosInstance.post(url, formdata);
      const result = response.data;
      setLoading(false);
      if (result.status) {
        if (result.type === "Submit") {
          navigate("/user/acknowledge", {
            state: { applicationId: result.referenceNumber },
          });
        } else {
          setReferenceNumber(result.referenceNumber);
          toast.success("Form details have been saved successfully.");
        }
      } else {
        toast.error("Failed to save form details.");
      }
    } catch (error) {
      console.error("Error submitting form:", error);
      setLoading(false);
      toast.error("An error occurred while saving the form.");
    }
  };

  const addDynamicEnclosure = (sectionId) => {
    const newId = `field-${Date.now()}`;
    const newField = {
      id: newId,
      type: "enclosure",
      label: "Other Document",
      name: `CustomDocument_${newId}`,
      span: 6,
      accept: ".pdf",
      editable: true,
      isDependentEnclosure: false,
    };
    setFormSections((prev) =>
      prev.map((sec) =>
        sec.id === sectionId
          ? { ...sec, fields: [...sec.fields, newField] }
          : sec,
      ),
    );
  };

  const removeDynamicEnclosure = (sectionId, fieldId) => {
    setFormSections((prev) =>
      prev.map((sec) =>
        sec.id === sectionId
          ? { ...sec, fields: sec.fields.filter((f) => f.id !== fieldId) }
          : sec,
      ),
    );
  };

  const commonStyles = {
    "& .MuiOutlinedInput-root": {
      backgroundColor: "#FFFFFF",
      borderRadius: "12px",
      "& fieldset": { borderColor: "#A5B4FC" },
      "&:hover fieldset": { borderColor: "#6366F1" },
      "&.Mui-focused fieldset": {
        borderColor: "#6366F1",
        boxShadow: "0 0 0 3px rgba(99, 102, 241, 0.2)",
      },
    },
    "& .MuiInputLabel-root": {
      color: "#6B7280",
      fontWeight: "500",
      "&.Mui-focused": { color: "#6366F1" },
    },
    marginBottom: "1.5rem",
  };

  const buttonStyles = {
    background: "linear-gradient(to right, #10B981, #059669)",
    color: "#FFFFFF",
    fontWeight: "600",
    textTransform: "none",
    borderRadius: "10px",
    padding: "10px 20px",
  };

  const getLabelWithAsteriskJSX = (field) => {
    const isRequired = field.validationFunctions?.includes("notEmpty");
    return (
      <>
        {field.label}
        {isRequired && (
          <span style={{ color: "#F43F5E", fontSize: "1rem" }}> *</span>
        )}
      </>
    );
  };

  const renderField = (field, sectionIndex) => {
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
              validate: async (value) =>
                await runValidations(
                  field,
                  value,
                  getValues(),
                  referenceNumber,
                  setValue,
                ),
            }}
            render={({ field: { onChange, value, ref } }) => (
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
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
                      }}
                      format="dd/MM/yyyy"
                      slotProps={{
                        textField: {
                          fullWidth: true,
                          margin: "normal",
                          sx: commonStyles,
                          inputRef: ref,
                          disabled: isFieldDisabled(field.name),
                        },
                      }}
                    />
                  </LocalizationProvider>
                ) : (
                  <TextField
                    type={field.type}
                    label={getLabelWithAsteriskJSX(field)}
                    value={value || ""}
                    onChange={(e) => {
                      let val = e.target.value;
                      if (field.name === "IfscCode" && ifscPrefix) {
                        if (!val.startsWith(ifscPrefix))
                          val = ifscPrefix + val.slice(ifscPrefix.length);
                        if (val.length > 11) val = val.slice(0, 11);
                      }
                      if (field.name === "AadharNumber") {
                        setAadhaarValid(false);
                        const lastChar = val.toString().charAt(val.length - 1);
                        let updatedAadhaar = isBackspacePressed.current
                          ? aadhaarNumber.slice(0, -1)
                          : aadhaarNumber + lastChar;
                        setAadhaarNumber(updatedAadhaar);
                        val = updatedAadhaar;
                      }
                      onChange(val);
                    }}
                    onKeyDown={(e) => {
                      isBackspacePressed.current = e.key === "Backspace";
                    }}
                    inputRef={ref}
                    disabled={isFieldDisabled(field.name)}
                    error={Boolean(errors[field.name])}
                    helperText={errors[field.name]?.message || ""}
                    fullWidth
                    margin="normal"
                    sx={commonStyles}
                  />
                )}
                {field.name === "AadharNumber" && aadhaarValid && (
                  <Typography
                    variant="subtitle2"
                    color="success"
                    fontWeight="bold"
                    sx={{ display: "flex" }}
                  >
                    Verified <CheckCircle />
                  </Typography>
                )}
                {field.name === "AadharNumber" &&
                  value?.length !== 0 &&
                  !aadhaarValid &&
                  !errors[field.name] && (
                    <Button
                      sx={{
                        ...buttonStyles,
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
      case "select":
        return (
          <Controller
            name={field.name}
            control={control}
            defaultValue="Please Select"
            rules={{
              validate: async (value) =>
                await runValidations(field, value, getValues()),
            }}
            render={({ field: { onChange, value, ref } }) => {
              let options = field.options || [];
              if (!options.some((opt) => opt.value === "Please Select")) {
                options = [
                  { value: "Please Select", label: "Please Select" },
                  ...options,
                ];
              }
              return (
                <Autocomplete
                  fullWidth
                  options={options}
                  value={options.find((opt) => opt.value === value) || null}
                  getOptionLabel={(option) => option.label || ""}
                  onChange={(event, newOption) => {
                    const newValue = newOption?.value || "Please Select";
                    onChange({ target: { value: newValue } });
                    if (
                      /district|muncipality|block|halqapanchayat/i.test(
                        field.name,
                      )
                    )
                      handleAreaChange(sectionIndex, field, newValue);
                    if (field.name === "BankName") handleBankChange(newValue);
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      variant="outlined"
                      label={getLabelWithAsteriskJSX(field)}
                      inputRef={ref}
                      sx={commonStyles}
                      disabled={isFieldDisabled(field.name)}
                    />
                  )}
                  disableClearable
                />
              );
            }}
          />
        );
      case "enclosure":
        const selectFieldName = `${field.name}_select`;
        const fileFieldName = `${field.name}_file`;
        const isDynamic = field.id?.includes("field-");
        return (
          <Box sx={{ width: "100%", mb: 2, position: "relative" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
              <Typography variant="subtitle1">{field.label}</Typography>
              {isDynamic && (
                <IconButton
                  size="small"
                  onClick={() => {
                    removeDynamicEnclosure(
                      formSections[sectionIndex].id,
                      field.id,
                    );
                    unregister(selectFieldName);
                    unregister(fileFieldName);
                  }}
                  sx={{ color: "#F43F5E" }}
                  title="Remove Document"
                >
                  <Delete fontSize="small" />
                </IconButton>
              )}
            </Box>
            <Controller
              name={selectFieldName}
              control={control}
              defaultValue={initialData?.[field.name]?.selected || ""}
              rules={{ required: "Enclosure name is required" }}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Document Type"
                  fullWidth
                  margin="normal"
                  sx={commonStyles}
                  disabled={isFieldDisabled(field.name)}
                />
              )}
            />
            <Controller
              name={fileFieldName}
              control={control}
              defaultValue={initialData?.[field.name]?.file || null}
              rules={{
                validate: async (value) => {
                  if (value instanceof File && value.size > 200000)
                    return "File must be under 200KB";
                  return true;
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
                          color: "#6366F1",
                          textDecoration: "underline",
                        }}
                        onClick={() =>
                          window.open(
                            value instanceof File
                              ? URL.createObjectURL(value)
                              : value,
                            "_blank",
                          )
                        }
                      >
                        {value instanceof File ? value.name : "View file"}
                      </FormHelperText>
                      <IconButton
                        size="small"
                        onClick={() => onChange(null)}
                        sx={{ color: "#F43F5E" }}
                      >
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  )}
                  <Button
                    variant="contained"
                    component="label"
                    sx={{ width: "100%", ...buttonStyles }}
                    disabled={isFieldDisabled(field.name)}
                  >
                    Upload File
                    <input
                      type="file"
                      hidden
                      onChange={(e) => {
                        onChange(e.target.files[0]);
                        trigger(fileFieldName);
                      }}
                      accept={field.accept || ".pdf"}
                    />
                  </Button>
                  <FormHelperText sx={{ color: "#F43F5E" }}>
                    {errors[fileFieldName]?.message || ""}
                  </FormHelperText>
                </Box>
              )}
            />
          </Box>
        );
      case "file":
        return (
          <Controller
            name={field.name}
            control={control}
            defaultValue={null}
            rules={{
              validate: async (value) => await runValidations(field, value),
            }}
            render={({ field: { onChange, ref } }) => (
              <FormControl fullWidth margin="normal" sx={commonStyles}>
                <Button
                  variant="contained"
                  component="label"
                  sx={buttonStyles}
                  disabled={isFieldDisabled(field.name)}
                >
                  {getLabelWithAsteriskJSX(field)}
                  <input
                    type="file"
                    hidden
                    onChange={(e) => {
                      onChange(e.target.files[0]);
                      if (field.name === "ApplicantImage")
                        setApplicantImagePreview(
                          URL.createObjectURL(e.target.files[0]),
                        );
                    }}
                    ref={ref}
                    accept={field.accept}
                  />
                </Button>
                <FormHelperText sx={{ color: "#F43F5E" }}>
                  {errors[field.name]?.message || ""}
                </FormHelperText>
              </FormControl>
            )}
          />
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
        }}
      >
        <CircularProgress size={60} />
      </Box>
    );

  return (
    <Box
      sx={{
        maxWidth: "90%",
        margin: "2rem auto",
        background:
          "linear-gradient(to bottom right, #f4f9ff 0%, #f9f3ec 100%)",
        borderRadius: "16px",
        padding: { xs: "1.5rem", md: "3rem" },
        minHeight: "100vh",
      }}
    >
      <Grid container spacing={3}>
        <Grid size={{ xs: 12 }}>
          <form
            onSubmit={handleSubmit((data) => onSubmit(data, "submit"))}
            autoComplete="off"
          >
            <Grid container spacing={3}>
              {/* ========== SERVICE SELECTION DROPDOWN ========== */}
              {!location.state?.ServiceId && services.length > 0 && (
                <Grid size={{ xs: 12 }}>
                  <Box
                    sx={{
                      padding: "2rem",
                      borderRadius: "12px",
                      background:
                        "linear-gradient(to bottom, #FFFFFF, #F0FDFA)",
                      boxShadow: "0 2px 10px rgba(0, 0, 0, 0.1)",
                      mb: 3,
                    }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 2,
                        mb: 2,
                      }}
                    >
                      <HelpOutlineIcon
                        sx={{ fontSize: 36, color: "#14B8A6" }}
                      />
                      <Typography
                        variant="h6"
                        sx={{
                          fontWeight: "600",
                          color: "#1F2937",
                          fontSize: "1.5rem",
                        }}
                      >
                        Select Service
                      </Typography>
                    </Box>
                    <Divider sx={{ mb: "1.5rem", borderColor: "#A5B4FC" }} />
                    <FormControl fullWidth>
                      <InputLabel id="service-select-label">Service</InputLabel>
                      <Select
                        labelId="service-select-label"
                        value={selectedServiceId}
                        label="Service"
                        onChange={handleServiceChange}
                        sx={commonStyles}
                        disabled={mode === "edit" || mode === "incomplete"}
                      >
                        <MenuItem value="" disabled>
                          Please Select a Service
                        </MenuItem>
                        {services.map((service) => (
                          <MenuItem
                            key={service.serviceId}
                            value={service.serviceId}
                          >
                            {service.serviceName}{" "}
                            {service.serviceCode && `(${service.serviceCode})`}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Box>
                </Grid>
              )}
              {/* ========== END SERVICE SELECTION ========== */}

              {formSections.map((section, index) => {
                return (
                  <Grid size={{ xs: 12, md: 6 }} key={section.id}>
                    <Box
                      sx={{
                        display: "flex",
                        flexDirection: "column",
                        height: "100%",
                        padding: "2rem",
                        borderRadius: "12px",
                        background:
                          "linear-gradient(to bottom, #FFFFFF, #F0FDFA)",
                        boxShadow: "0 2px 10px rgba(0, 0, 0, 0.1)",
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
                            sx={{ fontSize: 36, color: "#14B8A6" }}
                          />
                        )}
                        <Typography
                          variant="h6"
                          sx={{
                            fontWeight: "600",
                            color: "#1F2937",
                            fontSize: "1.5rem",
                          }}
                        >
                          {section.section}
                        </Typography>
                      </Box>
                      <Divider sx={{ mb: "1.5rem", borderColor: "#A5B4FC" }} />

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
                              border: "3px solid #A5B4FC",
                            }}
                          />
                        </Box>
                      )}

                      <Grid container spacing={2}>
                        {section.fields.map((field) => {
                          const element = renderField(field, index);
                          if (element != null)
                            return (
                              <Grid
                                size={{ xs: 12, lg: field.span }}
                                key={field.id}
                              >
                                {element}
                              </Grid>
                            );
                          return null;
                        })}
                      </Grid>

                      {section.section === "Documents" && mode !== "edit" && (
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
                          >
                            Add Document
                          </Button>
                        </Box>
                      )}
                    </Box>
                  </Grid>
                );
              })}

              <Grid size={{ xs: 12 }}>
                <Box
                  sx={{
                    position: "sticky",
                    bottom: 0,
                    backgroundColor: "#FFF",
                    padding: "1.5rem",
                    borderTop: "1px solid #A5B4FC",
                    boxShadow: "0 -4px 12px rgba(0, 0, 0, 0.1)",
                    display: "flex",
                    justifyContent: "center",
                    gap: 3,
                    zIndex: 1000,
                    borderRadius: "0 0 16px 16px",
                  }}
                >
                  {mode !== "edit" && (
                    <Button
                      sx={{
                        background:
                          "linear-gradient(to bottom right, #E4630A, #F9A825)",
                        color: "#FFFFFF",
                        fontWeight: "600",
                        padding: "0.75rem 2.5rem",
                        borderRadius: "10px",
                        textTransform: "none",
                      }}
                      disabled={buttonLoading || loading}
                      onClick={() => onSubmit(getValues(), "save")}
                    >
                      Save as Draft
                    </Button>
                  )}
                  <Button
                    type="submit"
                    sx={{
                      background:
                        "linear-gradient(to bottom right, #4CAF50, #81C784)",
                      color: "#FFFFFF",
                      fontWeight: "600",
                      padding: "0.75rem 2.5rem",
                      borderRadius: "10px",
                      textTransform: "none",
                    }}
                    disabled={buttonLoading || loading}
                  >
                    Submit
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
        message="Some fields are not filled or are incorrectly filed."
        type="error"
      />
      <MessageModal
        open={emailAlertModalOpen}
        title="Email Required"
        message="Please provide an email address to receive acknowledgement letters."
        primaryButton={{
          text: "Submit Without Email",
          action: handleEmailAlertSubmit,
        }}
        secondaryButton={{
          text: "Cancel",
          action: () => setEmailAlertModalOpen(false),
        }}
        onClose={() => setEmailAlertModalOpen(false)}
      />
      {otpModal && (
        <OtpModal
          open={otpModal}
          onClose={() => setOtpModal(false)}
          onSubmit={handleOtpSubmit}
          registeredAt="Mobile Number. Dummy OTP is 1234567"
        />
      )}
      <ToastContainer />
    </Box>
  );
};

export default DynamicScrollableForm;
