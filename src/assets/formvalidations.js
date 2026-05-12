import "@tensorflow/tfjs-backend-webgl"; // Load backend first
import * as tf from "@tensorflow/tfjs"; // Then core TF
import * as cocoSsd from "@tensorflow-models/coco-ssd";

// Make tf globally available (temporarily for debugging)
if (typeof window !== "undefined") {
  window.tf = tf;
}

// Global API base (same pattern used in all your other components)
const API_BASE = window.__CONFIG__?.API_URL || "";

// ────────────────────────────────────────────────
// Validation functions
// ────────────────────────────────────────────────

export function notEmpty(field, value) {
  if (value === "" || value == "Please Select") {
    return "This field is required.";
  }
  return true;
}

export function onlyAlphabets(field, value) {
  if (!/^[A-Za-z .']+$/.test(value)) {
    return "Please use letters (a-z, A-Z) and special characters (. and ') only.";
  }
  return true;
}

export function onlyDigits(field, value) {
  if (!/^\d+$/.test(value)) {
    return "Please enter only digits.";
  }
  return true;
}

function resolveLengthConfig(lengthConfig, formData, fieldLabel = "value") {
  // 1. Plain number
  if (typeof lengthConfig === "number") {
    return { value: lengthConfig };
  }

  // 2. Not an object – shouldn't happen
  if (typeof lengthConfig !== "object" || lengthConfig === null) {
    return { error: `Invalid ${fieldLabel} configuration.` };
  }

  const { dependentOn } = lengthConfig;
  if (!dependentOn) {
    return { error: `Missing dependent field for ${fieldLabel}.` };
  }

  const primaryValue = formData[dependentOn];
  if (
    primaryValue === undefined ||
    primaryValue === null ||
    primaryValue === ""
  ) {
    return { error: `Dependent field (${dependentOn}) value is missing.` };
  }

  // 3. New two‑field style with primaryConfig
  if (lengthConfig.primaryConfig) {
    const primaryConfig = lengthConfig.primaryConfig[primaryValue];
    if (!primaryConfig) {
      return {
        error: `No ${fieldLabel} defined for option "${primaryValue}".`,
      };
    }

    // If secondary is not used, return the single value
    if (!primaryConfig.useSecondary || !lengthConfig.secondaryDependentOn) {
      if (
        primaryConfig.singleValue === undefined ||
        primaryConfig.singleValue === ""
      ) {
        return { error: `No ${fieldLabel} defined for "${primaryValue}".` };
      }
      return { value: primaryConfig.singleValue };
    }

    // Secondary is used – need secondary field value
    const secondaryValue = formData[lengthConfig.secondaryDependentOn];
    if (
      secondaryValue === undefined ||
      secondaryValue === null ||
      secondaryValue === ""
    ) {
      return {
        error: `Secondary dependent field (${lengthConfig.secondaryDependentOn}) value is missing.`,
      };
    }

    const secondaryLength = primaryConfig.secondaryValues?.[secondaryValue];
    if (secondaryLength === undefined || secondaryLength === "") {
      return {
        error: `No ${fieldLabel} defined for combination "${primaryValue} + ${secondaryValue}".`,
      };
    }
    return { value: secondaryLength };
  }

  // 4. Old single‑field style: keys are option values directly on the object
  const resolved = lengthConfig[primaryValue];
  if (resolved === undefined) {
    return { error: `No ${fieldLabel} defined for option "${primaryValue}".` };
  }
  return { value: resolved };
}

export function specificLength(field, value, formData = {}) {
  // Helper to resolve length with error handling
  const getLengthValue = (lengthConfig, type) => {
    if (lengthConfig === undefined || lengthConfig === null) return null;
    const result = resolveLengthConfig(lengthConfig, formData, type);
    if (result.error) {
      throw new Error(result.error);
    }
    return result.value;
  };

  let minLengthValue = null;
  let maxLengthValue = null;

  try {
    if (field.minLength !== undefined) {
      minLengthValue = getLengthValue(field.minLength, "minimum length");
    }
    if (field.maxLength !== undefined) {
      maxLengthValue = getLengthValue(field.maxLength, "maximum length");
    }
  } catch (err) {
    return err.message; // Return the error string from resolveLengthConfig
  }

  // Case 1: Both defined and equal
  if (
    minLengthValue !== null &&
    maxLengthValue !== null &&
    minLengthValue === maxLengthValue
  ) {
    if (value.length !== minLengthValue) {
      return `This must be exactly ${minLengthValue} characters long.`;
    }
    return true;
  }

  // Case 2: Both defined but different
  if (minLengthValue !== null && maxLengthValue !== null) {
    if (value.length !== minLengthValue && value.length !== maxLengthValue) {
      return `This must be exactly ${minLengthValue} or ${maxLengthValue} characters long.`;
    }
    return true;
  }

  // Case 3: Only minLength defined
  if (minLengthValue !== null && maxLengthValue === null) {
    if (value.length !== minLengthValue) {
      return `This must be exactly ${minLengthValue} characters long.`;
    }
    return true;
  }

  // Case 4: Only maxLength defined
  if (maxLengthValue !== null && minLengthValue === null) {
    if (value.length !== maxLengthValue) {
      return `This must be exactly ${maxLengthValue} characters long.`;
    }
    return true;
  }

  return true;
}

export function isEmailValid(field, value) {
  if (
    value.length > 0 &&
    !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value)
  ) {
    return "Invalid Email Address.";
  }
  return true;
}

export async function duplicateAccountNumber(
  field,
  value,
  formData,
  referenceNumber,
) {
  try {
    const bankName =
      formData["BankDetail"] != null
        ? formData["Bank Details"][0].value
        : formData.BankName;
    const ifscCode =
      formData["BankDetail"] != null
        ? formData["Bank Details"][2].value
        : formData.IfscCode;

    const fd = new FormData();
    fd.append("bankName", bankName);
    fd.append("ifscCode", ifscCode);
    fd.append("accNo", value);
    fd.append("applicationId", referenceNumber);

    const res = await fetch(`${API_BASE}/Base/IsDuplicateAccNo`, {
      method: "POST",
      body: fd,
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`Server error: ${res.status} - Response: ${errorText}`);
      return "Validation failed due to a server error.";
    }

    const data = await res.json();
    if (data.status) {
      return "Account Number already exists.";
    }
    return true;
  } catch (error) {
    console.error("Error in duplicateAccountNumber:", error);
    return "Validation failed due to a server error.";
  }
}

export async function validateIfscCode(
  field,
  value,
  formData,
  referenceNumber,
  setValue, // Keep parameter but handle it safely
) {
  const ifscCode = formData.IfscCode || value;
  const bankName = formData.BankName;

  // Ensure IFSC code exists
  if (!ifscCode || !ifscCode.trim()) {
    return true; // Allow empty IFSC
  }

  if (!bankName || bankName === "Please Select") {
    return "Please select a bank name first";
  }

  try {
    const fd = new FormData();
    fd.append("bankName", bankName);
    fd.append("ifscCode", ifscCode.trim().toUpperCase());

    const res = await fetch(`${API_BASE}/Base/ValidateIfscCode`, {
      method: "POST",
      body: fd,
    });

    if (!res.ok) {
      if (typeof setValue === "function") {
        setValue("BranchName", "", { shouldValidate: true });
      }
      return "Failed to validate IFSC code. Please try again.";
    }

    const data = await res.json();

    if (!data || !data.status || !data.bankDetails) {
      if (typeof setValue === "function") {
        setValue("BranchName", "", { shouldValidate: true });
      }
      return "IFSC Code is incorrect or branch details not available.";
    }

    // Update BranchName if setValue exists
    if (typeof setValue === "function") {
      setValue("BranchName", data.bankDetails.branch, { shouldValidate: true });
    }

    return true; // Validation passed
  } catch (error) {
    console.error("Error validating IFSC:", error);
    if (typeof setValue === "function") {
      setValue("BranchName", "", { shouldValidate: true });
    }
    return "Error validating IFSC code. Please try again.";
  }
}

export async function validateFile(field, value) {
  try {
    const formData = new FormData();

    if (field.accept.includes(".jpg")) formData.append("fileType", "image");
    else if (field.accept.includes(".pdf")) formData.append("fileType", "pdf");
    else return;

    const notRequired = !field.validationFunctions.includes("notEmpty");

    formData.append("file", value);

    const res = await fetch(`${API_BASE}/Base/Validate`, {
      method: "POST",
      body: formData,
    });

    const data = await res.json();

    if (!data.isValid) {
      if (data.errorMessage == "No file uploaded." && notRequired) {
        return true;
      }
      return data.errorMessage;
    }

    return true;
  } catch (error) {
    console.error("Error in validateFile:", error);
    return "File validation failed due to a server error.";
  }
}

export function range(field, value) {
  if (value < field.minLength || value > field.maxLength) {
    return `The value must be between ${field.minLength} and ${field.maxLength}.`;
  }
}

// Helper function to parse DD/MM/YYYY and return a Date object
function parseDDMMYYYY(value) {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();

  // 1. Try DD/MM/YYYY first
  const ddmmyyyyPattern = /^(\d{2})\/(\d{2})\/(\d{4})$/;
  const ddMatch = trimmed.match(ddmmyyyyPattern);
  if (ddMatch) {
    const [, day, month, year] = ddMatch.map(Number);
    const date = new Date(year, month - 1, day);
    if (isNaN(date.getTime()) || date.getDate() !== day) return null;
    date.setHours(0, 0, 0, 0);
    return date;
  }

  // 2. Try YYYY-MM-DD (ISO format)
  const isoPattern = /^(\d{4})-(\d{2})-(\d{2})$/;
  const isoMatch = trimmed.match(isoPattern);
  if (isoMatch) {
    const [, year, month, day] = isoMatch.map(Number);
    const date = new Date(year, month - 1, day);
    if (isNaN(date.getTime()) || date.getDate() !== day) return null;
    date.setHours(0, 0, 0, 0);
    return date;
  }

  // Not a recognised format
  return null;
}

export function isAgeGreaterThan(field, value, formData) {
  let maxLengthValue;
  try {
    const result = resolveLengthConfig(
      field.maxLength,
      formData,
      "maximum age",
    );
    if (result.error) return result.error;
    maxLengthValue = result.value;
  } catch (err) {
    return err.message;
  }

  const inputDate = parseDDMMYYYY(value);
  if (!inputDate) {
    return `${field.label || "Date"} must be in DD/MM/YYYY format and valid.`;
  }

  const currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);

  const compareDate = new Date(
    currentDate.getFullYear() - maxLengthValue,
    currentDate.getMonth(),
    currentDate.getDate(),
  );
  compareDate.setHours(0, 0, 0, 0);

  if (inputDate >= compareDate) {
    return `Age should be greater than or equal to ${maxLengthValue}.`;
  }
  return true;
}

export function isDateWithinRange(field, value, formData) {
  const dateOfMarriage = parseDDMMYYYY(value);
  if (!dateOfMarriage) {
    return `${field.label || "Date"} must be in DD/MM/YYYY format and valid.`;
  }

  // Resolve minLength and maxLength (they may be dependency objects)
  let minMonths, maxMonths;
  try {
    minMonths = resolveLengthConfig(
      field.minLength,
      formData,
      "min months",
    )?.value;
    maxMonths = resolveLengthConfig(
      field.maxLength,
      formData,
      "max months",
    )?.value;
  } catch (err) {
    return err.message;
  }

  // Ensure they are numbers
  minMonths = parseInt(minMonths, 10);
  maxMonths = parseInt(maxMonths, 10);

  const currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);

  const minDate = new Date(currentDate);
  minDate.setMonth(currentDate.getMonth() + minMonths);

  const maxDate = new Date(currentDate);
  maxDate.setMonth(currentDate.getMonth() + maxMonths);

  if (dateOfMarriage < minDate || dateOfMarriage > maxDate) {
    return `The date should be between ${minMonths} to ${maxMonths} months from current date.`;
  }
  return true;
}

// export function range(field, value, formData) {
//   let min, max;
//   try {
//     min = resolveLengthConfig(field.minLength, formData, "min value")?.value;
//     max = resolveLengthConfig(field.maxLength, formData, "max value")?.value;
//   } catch (err) {
//     return err.message;
//   }

//   min = parseFloat(min);
//   max = parseFloat(max);

//   if (value < min || value > max) {
//     return `The value must be between ${min} and ${max}.`;
//   }
//   return true;
// }

export function isDateAfterCurrentDate(field, value, formData) {
  const inputDate = parseDDMMYYYY(value);
  if (!inputDate) {
    return `${field.label || "Date"} must be in DD/MM/YYYY format and valid.`;
  }

  const currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);

  if (inputDate <= currentDate) {
    return `${field.label || "Date"} must be after the current date.`;
  }

  if (field.name === "IfTemporaryDisabilityUdidCardValidUpto") {
    const issueDate = parseDDMMYYYY(formData["UdidCardIssueDate"]);
    if (!issueDate) {
      return `UDID Card Issue Date must be in DD/MM/YYYY format and valid.`;
    }
    if (inputDate <= issueDate) {
      return `${field.label || "Date"} must be after the UDID Card Issue date.`;
    }
  }
  return true;
}

export function isDateBeforeCurrentDate(field, value) {
  const inputDate = parseDDMMYYYY(value);
  if (!inputDate) {
    return `${field.label || "Date"} must be in DD/MM/YYYY format and valid.`;
  }

  const currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);

  if (inputDate >= currentDate) {
    return `${field.label || "Date"} must be before the current date.`;
  }
  return true;
}

export async function tehsilForDistrict(field, districtValue) {
  if (!districtValue) return [];

  try {
    const fd = new FormData();
    fd.append("districtId", districtValue);

    const response = await fetch(`${API_BASE}/Base/GetTeshilForDistrict`, {
      method: "POST",
      body: fd,
    });

    const data = await response.json();

    if (data.status && Array.isArray(data.tehsils)) {
      return data.tehsils.map((tehsil) => ({
        value: tehsil.tehsilId,
        label: tehsil.tehsilName,
      }));
    }
    return [];
  } catch (error) {
    console.error("Error in tehsilForDistrict:", error);
    return [];
  }
}

// ────────────────────────────────────────────────
// TensorFlow.js / COCO-SSD Human Detection
// ────────────────────────────────────────────────

let modelLoaded = false;
let cocoSsdModel = null;

export async function loadCocoSsdModel() {
  if (modelLoaded) return cocoSsdModel;

  const backendNames = tf.engine().backendNames();

  const backendToUse = backendNames.includes("webgl") ? "webgl" : "cpu";
  await tf.setBackend(backendToUse);
  await tf.ready();

  const MODEL_URL = `${API_BASE}/models/coco-ssd/model/model.json`;

  cocoSsdModel = await cocoSsd.load({
    modelUrl: MODEL_URL,
  });

  modelLoaded = true;
  return cocoSsdModel;
}

export async function detectHuman(field, value) {
  if (!value || !(value instanceof File)) {
    return "No valid image file provided.";
  }

  try {
    await loadCocoSsdModel();

    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Failed to load image"));
      image.src = URL.createObjectURL(value);
    });

    const predictions = await cocoSsdModel.detect(img);

    URL.revokeObjectURL(img.src);

    const personPrediction = predictions.find(
      (pred) => pred.class === "person" && pred.score > 0.5,
    );

    if (personPrediction) {
      return true;
    } else {
      return "No human detected in the image. Please upload a photo containing a human.";
    }
  } catch (error) {
    console.error("Error in detectHuman with COCO-SSD:", error);

    if (
      error.message.includes("backend") ||
      error.message.includes("Backend")
    ) {
      return "Human detection failed: Graphics/GPU issue. Please try again or use a different browser.";
    }

    return "Human detection failed due to an error. Please try again.";
  }
}

// ────────────────────────────────────────────────
// Main validation runner
// ────────────────────────────────────────────────

export const runValidations = async (
  field,
  value,
  formData,
  referenceNumber,
  setValue,
) => {
  if (!Array.isArray(field.validationFunctions)) return true;

  for (const validationFn of field.validationFunctions) {
    const fun = ValidationFunctionsList[validationFn];
    if (typeof fun !== "function") continue;

    try {
      let error = await fun(
        field,
        value || "",
        formData,
        referenceNumber,
        setValue,
      );
      if (error !== true) return error;
    } catch (err) {
      return "Validation failed due to an unexpected error.";
    }
  }

  return true;
};

// ────────────────────────────────────────────────
// Other helpers (unchanged)
// ────────────────────────────────────────────────

export function formatKey(input) {
  if (!input) return input;
  const result = input.replace(/(?<!^)([A-Z])/g, " $1");
  return result;
}

export const ValidationFunctionsList = {
  notEmpty,
  onlyAlphabets,
  onlyDigits,
  specificLength,
  isAgeGreaterThan,
  isEmailValid,
  isDateWithinRange,
  duplicateAccountNumber,
  validateFile,
  validateIfscCode,
  range,
  isDateAfterCurrentDate,
  isDateBeforeCurrentDate,
  detectHuman,
};

export const TransformationFunctionsList = {
  CaptilizeAlphabet: (value) => value.toUpperCase(),
  MaskAadhaar: (value, aadhaarNumber) => {
    const input =
      typeof aadhaarNumber === "string" && aadhaarNumber.length > 0
        ? aadhaarNumber
        : value;
    let digitCount = 0;
    return input.replace(/\d/g, (digit) => {
      return digitCount++ < 8 ? "X" : digit;
    });
  },
};

export const validationFunctionsList = [
  { id: "notEmpty", label: "Required" },
  { id: "onlyAlphabets", label: "Only Alphabets" },
  { id: "onlyDigits", label: "Only Digits" },
  { id: "specificLength", label: "Specific Length" },
  { id: "isAgeGreaterThan", label: "Age Limit" },
  { id: "isEmailValid", label: "Email Format" },
  { id: "isDateWithinRange", label: "Date Range" },
  { id: "duplicateAccountNumber", label: "Duplicate Account Number" },
  { id: "validateFile", label: "Validate File" },
  { id: "validateIfscCode", label: "Validate IFSC" },
  { id: "range", label: "Range Value" },
  { id: "isDateAfterCurrentDate", label: "After Current Date" },
  { id: "isDateBeforeCurrentDate", label: "Before Current Date" },
  { id: "detectHuman", label: "Detect Human" },
];

export const transformationFunctionsList = [
  { id: "CaptilizeAlphabet", label: "Capital Alphabets" },
  { id: "handleCopyAddress", label: "Copy Address" },
  { id: "MaskAadhaar", label: "Mask Aadhaar" },
];
