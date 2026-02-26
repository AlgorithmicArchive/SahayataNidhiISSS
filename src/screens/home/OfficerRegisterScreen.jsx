import React, { useEffect, useState, useCallback, Suspense } from "react";
import {
  Box,
  Typography,
  Container,
  Link,
  CircularProgress,
  IconButton,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  FormHelperText,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import { useForm, Controller } from "react-hook-form";
import { fetchDistricts } from "../../assets/fetch";
import OtpModal from "../../components/OtpModal";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Col, Row } from "react-bootstrap";
import debounce from "lodash/debounce";
import { CheckCircleOutline } from "@mui/icons-material";

// Generate CAPTCHA
const generateCaptcha = () => {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let captcha = "";
  for (let i = 0; i < 6; i++) {
    captcha += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return captcha;
};

export default function OfficerRegisterScreen() {
  const API_BASE = window.__CONFIG__?.API_URL || ""; // fallback to empty string

  const {
    handleSubmit,
    control,
    getValues,
    watch,
    trigger,
    setError,
    formState: { errors },
  } = useForm({
    mode: "onBlur",
    reValidateMode: "onBlur",
    defaultValues: {
      fullName: "",
      username: "",
      email: "",
      mobileNumber: "",
      password: "",
      confirmPassword: "",
      department: "",
      designation: "",
      District: "",
      Division: "",
      Tehsil: "",
      captcha: "",
    },
  });

  const [captcha, setCaptcha] = useState(generateCaptcha());
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [districtOptions, setDistrictOptions] = useState([]);
  const [tehsilOptions, setTehsilOptions] = useState([]);
  const [accessLevelMap, setAccessLevelMap] = useState({});
  const [isOtpModalOpen, setIsOtpModalOpen] = useState(false);
  const [otpType, setOtpType] = useState(null);
  const [userId, setUserId] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isEmailOtpVerified, setIsEmailOtpVerified] = useState(false);
  const [isMobileOtpVerified, setIsMobileOtpVerified] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isReady, setIsReady] = useState(false);

  const selectedDepartment = watch("department");
  const selectedDesignation = watch("designation");
  const selectedDistrict = watch("District");
  const selectedDivision = watch("Division");
  const selectedTehsil = watch("Tehsil");
  const emailValue = watch("email");
  const mobileValue = watch("mobileNumber");

  const navigate = useNavigate();

  // Fetch initial data (departments + districts)
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [deptRes, districtRes] = await Promise.all([
          axios.get(`${API_BASE}/Home/GetDepartments`),
          fetchDistricts(setDistrictOptions), // assuming fetchDistricts already uses API_BASE
        ]);

        if (deptRes.data.status) {
          setDepartments(
            deptRes.data.departments.map((d) => ({
              label: d.departmentName,
              value: d.departmentId,
            }))
          );
        }

        setCaptcha(generateCaptcha());
        setIsReady(true);
      } catch (err) {
        console.error("Failed to load initial data:", err);
        toast.error("Failed to load departments or districts");
      }
    };

    fetchData();
  }, []);

  // Fetch designations based on department
  useEffect(() => {
    if (!selectedDepartment) {
      setDesignations([]);
      setAccessLevelMap({});
      return;
    }

    const fetchDesignations = async () => {
      try {
        const res = await axios.get(
          `${API_BASE}/Home/GetDesignations?deparmentId=${selectedDepartment}`
        );

        if (res.data.status) {
          const opts = res.data.designations.map((d) => ({
            label: `${d.designation} (${d.accessLevel})`,
            value: d.designation,
            accessLevel: d.accessLevel,
          }));
          setDesignations(opts);

          const map = {};
          opts.forEach((o) => (map[o.value] = o.accessLevel));
          setAccessLevelMap(map);
        }
      } catch (err) {
        console.error("Failed to load designations:", err);
        toast.error("Failed to load designations");
      }
    };

    fetchDesignations();
  }, [selectedDepartment]);

  // Fetch tehsils based on district
  useEffect(() => {
    if (!selectedDistrict) {
      setTehsilOptions([]);
      return;
    }

    const fetchTehsils = async () => {
      try {
        const res = await axios.get(
          `${API_BASE}/Base/GetTeshilForDistrict?districtId=${selectedDistrict}`
        );

        if (res.data.status) {
          setTehsilOptions(
            res.data.tehsils.map((t) => ({
              label: t.tehsilName,
              value: t.tehsilId,
            }))
          );
        }
      } catch (err) {
        console.error("Failed to load tehsils:", err);
        toast.error("Failed to load tehsil options");
      }
    };

    fetchTehsils();
  }, [selectedDistrict]);

  const handleRefreshCaptcha = () => setCaptcha(generateCaptcha());

  // Debounced email uniqueness check
  const debouncedEmailValidation = useCallback(
    debounce(async (value) => {
      if (!value || !selectedDepartment || !selectedDesignation) return true;

      let errorMsg = null;
      if (accessLevelMap[selectedDesignation] === "Division" && !selectedDivision)
        errorMsg = "Please select Division first";
      else if (accessLevelMap[selectedDesignation] === "District" && !selectedDistrict)
        errorMsg = "Please select District first";
      else if (
        accessLevelMap[selectedDesignation] === "Tehsil" &&
        (!selectedDistrict || !selectedTehsil)
      )
        errorMsg = "Please select District & Tehsil first";

      if (errorMsg) {
        setError("email", { type: "manual", message: errorMsg });
        return false;
      }

      try {
        const res = await axios.get(`${API_BASE}/Home/CheckEmail`, {
          params: {
            email: value,
            UserType: "Officer",
            departmentId: selectedDepartment,
            designation: selectedDesignation,
          },
        });

        if (!res.data.isUnique) {
          setError("email", { type: "manual", message: "Email already exists" });
          return false;
        }
        return true;
      } catch (err) {
        console.error("Email check failed:", err);
        return true; // don't block form if check fails
      }
    }, 500),
    [
      selectedDepartment,
      selectedDesignation,
      selectedDivision,
      selectedDistrict,
      selectedTehsil,
      accessLevelMap,
      setError,
    ]
  );

  // Debounced mobile uniqueness check
  const debouncedMobileValidation = useCallback(
    debounce(async (value) => {
      if (!value || !selectedDepartment || !selectedDesignation) return true;

      let errorMsg = null;
      if (accessLevelMap[selectedDesignation] === "Division" && !selectedDivision)
        errorMsg = "Please select Division first";
      else if (accessLevelMap[selectedDesignation] === "District" && !selectedDistrict)
        errorMsg = "Please select District first";
      else if (
        accessLevelMap[selectedDesignation] === "Tehsil" &&
        (!selectedDistrict || !selectedTehsil)
      )
        errorMsg = "Please select District & Tehsil first";

      if (errorMsg) {
        setError("mobileNumber", { type: "manual", message: errorMsg });
        return false;
      }

      try {
        const res = await axios.get(`${API_BASE}/Home/CheckMobileNumber`, {
          params: {
            number: value,
            UserType: "Officer",
            departmentId: selectedDepartment,
            designation: selectedDesignation,
          },
        });

        if (!res.data.isUnique) {
          setError("mobileNumber", {
            type: "manual",
            message: "Mobile already exists",
          });
          return false;
        }
        return true;
      } catch (err) {
        console.error("Mobile check failed:", err);
        return true; // don't block form if check fails
      }
    }, 500),
    [
      selectedDepartment,
      selectedDesignation,
      selectedDivision,
      selectedDistrict,
      selectedTehsil,
      accessLevelMap,
      setError,
    ]
  );

  // Send OTP for Email
  const handleEmailValidate = async () => {
    const valid = await trigger("email");
    if (!valid || errors.email) return;

    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/Home/SendOtp`, {
        params: { email: getValues("email") },
      });

      if (res.data.status) {
        setIsOtpModalOpen(true);
        setOtpType("email");
        setUserId(res.data.userId);
        setErrorMessage(res.data.message);
        toast.success("OTP sent to email");
      } else {
        toast.error(res.data.message || "Failed to send OTP");
      }
    } catch (err) {
      console.error("Email OTP error:", err);
      toast.error("Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  // Send OTP for Mobile
  const handleMobileValidate = async () => {
    const valid = await trigger("mobileNumber");
    if (!valid || errors.mobileNumber) return;

    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/Home/SendOtp`, {
        params: { mobile: getValues("mobileNumber") },
      });

      if (res.data.status) {
        setIsOtpModalOpen(true);
        setOtpType("mobile");
        setUserId(res.data.userId);
        setErrorMessage(res.data.message);
        toast.success("OTP sent to mobile");
      } else {
        toast.error(res.data.message || "Failed to send OTP");
      }
    } catch (err) {
      console.error("Mobile OTP error:", err);
      toast.error("Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  // Final form submission
  const onSubmit = async (data) => {
    if (!isEmailOtpVerified || !isMobileOtpVerified) {
      toast.error("Please verify both email and mobile first");
      return;
    }

    setLoading(true);

    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => formData.append(key, value));

    formData.append("accessLevel", accessLevelMap[selectedDesignation] || "");
    formData.append(
      "accessCode",
      accessLevelMap[selectedDesignation] === "State"
        ? 0
        : data[
        accessLevelMap[selectedDesignation] === "Tehsil"
          ? "Tehsil"
          : accessLevelMap[selectedDesignation] === "District"
            ? "District"
            : "Division"
        ] || 0
    );

    try {
      const res = await axios.post(`${API_BASE}/Home/OfficerRegistration`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (res.data.status) {
        toast.success("Registration successful! Redirecting to login...");
        setTimeout(() => navigate("/login"), 2200);
      } else {
        toast.error(res.data.message || "Registration failed");
      }
    } catch (err) {
      console.error("Registration error:", err);
      toast.error("An error occurred during registration");
    } finally {
      setLoading(false);
      handleRefreshCaptcha();
    }
  };

  // OTP verification submit
  const handleOtpSubmit = async (otp) => {
    if (!otp || otp.length < 4) return toast.error("Please enter valid OTP");

    setLoading(true);

    const formData = new FormData();
    formData.append("otp", otp);
    formData.append(
      otpType === "email" ? "email" : "mobile",
      getValues(otpType === "email" ? "email" : "mobileNumber")
    );

    try {
      const res = await axios.post(`${API_BASE}/Home/OTPValidation`, formData);

      if (res.data.status) {
        if (otpType === "email") setIsEmailOtpVerified(true);
        else setIsMobileOtpVerified(true);

        setIsOtpModalOpen(false);
        toast.success(`${otpType === "email" ? "Email" : "Mobile"} verified successfully`);
      } else {
        toast.error(res.data.message || "Invalid OTP");
      }
    } catch (err) {
      console.error("OTP validation error:", err);
      toast.error("OTP verification failed");
    } finally {
      setLoading(false);
    }
  };

  if (!isReady) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "80vh",
        }}
      >
        <CircularProgress size={80} sx={{ color: "#2562E9" }} />
      </Box>
    );
  }

  return (
    <Suspense fallback={<CircularProgress />}>
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          background: "linear-gradient(to bottom right, #F4F9FF 0%, #F9F3EC 100%)",
          p: { xs: 2, md: 4 },
        }}
      >
        <Container
          maxWidth="lg"
          sx={{
            backgroundColor: "#FFFFFF",
            p: { xs: 4, md: 6 },
            borderRadius: 4,
            boxShadow: "0 12px 40px rgba(0, 0, 0, 0.12)",
            transition: "all 0.3s ease",
            "&:hover": {
              transform: "translateY(-8px)",
              boxShadow: "0 16px 48px rgba(0, 0, 0, 0.15)",
            },
          }}
        >
          {/* Title */}
          <Typography
            variant="h3"
            component="h1"
            sx={{
              fontWeight: 700,
              fontSize: { xs: "2.8rem", sm: "3.2rem", md: "3.5rem" },
              textAlign: "center",
              background: "linear-gradient(to bottom right, #2561E8, #1F43B4)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              mb: 5,
              letterSpacing: "-0.5px",
            }}
          >
            Officer Registration
          </Typography>

          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 3.5 }}>
              {/* Full Name */}
              <Controller
                name="fullName"
                control={control}
                rules={{
                  required: "Full name is required",
                  minLength: { value: 5, message: "Minimum 5 characters" },
                }}
                render={({ field, fieldState: { error } }) => (
                  <TextField
                    {...field}
                    label={
                      <span style={{ color: "#235BDE", fontWeight: 600 }}>
                        Full Name <span style={{ color: "red" }}>*</span>
                      </span>
                    }
                    variant="outlined"
                    fullWidth
                    disabled={loading}
                    error={!!error}
                    helperText={error?.message}
                    sx={{
                      "& .MuiOutlinedInput-root": { borderRadius: 3 },
                      "& .MuiFormLabel-root": { fontWeight: 600, color: "#235BDE" },
                    }}
                  />
                )}
              />

              {/* Department & Designation */}
              <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, gap: 3 }}>
                <Controller
                  name="department"
                  control={control}
                  rules={{ required: "Department is required" }}
                  render={({ field, fieldState: { error } }) => (
                    <FormControl fullWidth error={!!error}>
                      <InputLabel sx={{ color: "#235BDE", fontWeight: 600 }}>
                        Department <span style={{ color: "red" }}>*</span>
                      </InputLabel>
                      <Select
                        {...field}
                        disabled={loading}
                        sx={{ borderRadius: 3 }}
                      >
                        {departments.map((d) => (
                          <MenuItem key={d.value} value={d.value}>
                            {d.label}
                          </MenuItem>
                        ))}
                      </Select>
                      {error && <FormHelperText>{error.message}</FormHelperText>}
                    </FormControl>
                  )}
                />

                <Controller
                  name="designation"
                  control={control}
                  rules={{ required: "Designation is required" }}
                  render={({ field, fieldState: { error } }) => (
                    <FormControl fullWidth error={!!error}>
                      <InputLabel sx={{ color: "#235BDE", fontWeight: 600 }}>
                        Designation <span style={{ color: "red" }}>*</span>
                      </InputLabel>
                      <Select
                        {...field}
                        disabled={loading || !selectedDepartment}
                        sx={{ borderRadius: 3 }}
                      >
                        {designations.map((d) => (
                          <MenuItem key={d.value} value={d.value}>
                            {d.label}
                          </MenuItem>
                        ))}
                      </Select>
                      {error && <FormHelperText>{error.message}</FormHelperText>}
                    </FormControl>
                  )}
                />
              </Box>

              {/* Conditional Access Level Fields */}
              {(accessLevelMap[selectedDesignation] === "District" ||
                accessLevelMap[selectedDesignation] === "Tehsil" ||
                accessLevelMap[selectedDesignation] === "Division") && (
                  <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, gap: 3 }}>
                    {/* District / Division */}
                    <Controller
                      name={accessLevelMap[selectedDesignation] === "Division" ? "Division" : "District"}
                      control={control}
                      rules={{ required: `${accessLevelMap[selectedDesignation]} is required` }}
                      render={({ field, fieldState: { error } }) => (
                        <FormControl fullWidth error={!!error}>
                          <InputLabel sx={{ color: "#235BDE", fontWeight: 600 }}>
                            {accessLevelMap[selectedDesignation] === "Division" ? "Division" : "District"}{" "}
                            <span style={{ color: "red" }}>*</span>
                          </InputLabel>
                          <Select
                            {...field}
                            disabled={loading}
                            sx={{ borderRadius: 3 }}
                          >
                            {accessLevelMap[selectedDesignation] === "Division" ? (
                              <>
                                <MenuItem value={1}>Jammu</MenuItem>
                                <MenuItem value={2}>Kashmir</MenuItem>
                              </>
                            ) : (
                              districtOptions.map((d) => (
                                <MenuItem key={d.value} value={d.value}>
                                  {d.label}
                                </MenuItem>
                              ))
                            )}
                          </Select>
                          {error && <FormHelperText>{error.message}</FormHelperText>}
                        </FormControl>
                      )}
                    />

                    {/* Tehsil (only if Tehsil level) */}
                    {accessLevelMap[selectedDesignation] === "Tehsil" && (
                      <Controller
                        name="Tehsil"
                        control={control}
                        rules={{ required: "TSWO Office is required" }}
                        render={({ field, fieldState: { error } }) => (
                          <FormControl fullWidth error={!!error}>
                            <InputLabel sx={{ color: "#235BDE", fontWeight: 600 }}>
                              TSWO Office <span style={{ color: "red" }}>*</span>
                            </InputLabel>
                            <Select
                              {...field}
                              disabled={loading || !selectedDistrict}
                              sx={{ borderRadius: 3 }}
                            >
                              {tehsilOptions.map((t) => (
                                <MenuItem key={t.value} value={t.value}>
                                  {t.label}
                                </MenuItem>
                              ))}
                            </Select>
                            {error && <FormHelperText>{error.message}</FormHelperText>}
                          </FormControl>
                        )}
                      />
                    )}
                  </Box>
                )}

              {/* Email + Mobile with Validation Buttons */}
              <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, gap: 3 }}>
                {/* Email */}
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <Controller
                      name="email"
                      control={control}
                      rules={{
                        required: "Email is required",
                        pattern: {
                          value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                          message: "Invalid email format",
                        },
                        validate: debouncedEmailValidation,
                      }}
                      render={({ field, fieldState: { error } }) => (
                        <TextField
                          {...field}
                          label={
                            <span style={{ color: "#235BDE", fontWeight: 600 }}>
                              Email <span style={{ color: "red" }}>*</span>
                            </span>
                          }
                          type="email"
                          fullWidth
                          disabled={loading || isEmailOtpVerified}
                          error={!!error}
                          helperText={error?.message}
                          sx={{
                            "& .MuiOutlinedInput-root": { borderRadius: 3 },
                            "& .MuiFormLabel-root": { fontWeight: 600, color: "#235BDE" },
                          }}
                        />
                      )}
                    />

                    {isEmailOtpVerified && (
                      <CheckCircleOutline sx={{ color: "#0FB282", fontSize: 32 }} />
                    )}
                  </Box>

                  {!isEmailOtpVerified && emailValue && !errors.email && (
                    <Button
                      variant="contained"
                      size="small"
                      onClick={handleEmailValidate}
                      disabled={loading}
                      fullWidth
                      sx={{
                        mt: 1.5,
                        background: "linear-gradient(45deg, #F67015, #E4630A)",
                        "&:hover": { background: "linear-gradient(45deg, #E4630A, #F67015)" },
                      }}
                    >
                      Validate Email
                    </Button>
                  )}
                </Box>

                {/* Mobile */}
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <Controller
                      name="mobileNumber"
                      control={control}
                      rules={{
                        required: "Mobile number is required",
                        pattern: {
                          value: /^[0-9]{10}$/,
                          message: "Enter valid 10-digit mobile number",
                        },
                        validate: debouncedMobileValidation,
                      }}
                      render={({ field, fieldState: { error } }) => (
                        <TextField
                          {...field}
                          label={
                            <span style={{ color: "#235BDE", fontWeight: 600 }}>
                              Mobile Number <span style={{ color: "red" }}>*</span>
                            </span>
                          }
                          type="tel"
                          fullWidth
                          inputProps={{ maxLength: 10 }}
                          disabled={loading || isMobileOtpVerified}
                          error={!!error}
                          helperText={error?.message}
                          sx={{
                            "& .MuiOutlinedInput-root": { borderRadius: 3 },
                            "& .MuiFormLabel-root": { fontWeight: 600, color: "#235BDE" },
                          }}
                        />
                      )}
                    />

                    {isMobileOtpVerified && (
                      <CheckCircleOutline sx={{ color: "#0FB282", fontSize: 32 }} />
                    )}
                  </Box>

                  {!isMobileOtpVerified && mobileValue && !errors.mobileNumber && (
                    <Button
                      variant="contained"
                      size="small"
                      onClick={handleMobileValidate}
                      disabled={loading}
                      fullWidth
                      sx={{
                        mt: 1.5,
                        background: "linear-gradient(45deg, #0FB282, #4CAF50)",
                        "&:hover": { background: "linear-gradient(45deg, #4CAF50, #0FB282)" },
                      }}
                    >
                      Validate Mobile
                    </Button>
                  )}
                </Box>
              </Box>

              {/* CAPTCHA */}
              <Box sx={{ mt: 3 }}>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 2,
                    flexDirection: { xs: "column", sm: "row" },
                    justifyContent: "center",
                  }}
                >
                  <Box
                    sx={{
                      background: "linear-gradient(to bottom right, #F0F7FE 0%, #FDF7F0 100%)",
                      border: "3px solid #2562E9",
                      borderRadius: 4,
                      padding: { xs: "16px 24px", sm: "18px 28px" },
                      boxShadow: "0 6px 16px rgba(0, 0, 0, 0.12)",
                      fontFamily: "monospace",
                      fontSize: { xs: "2rem", sm: "2.3rem", md: "2.5rem" },
                      fontWeight: 800,
                      color: "#2562E9",
                      letterSpacing: "5px",
                      minWidth: { xs: "220px", sm: "680px" },
                      textAlign: "center",
                      userSelect: "none",
                      textShadow: "1px 1px 2px rgba(0,0,0,0.1)",
                    }}
                  >
                    {captcha}
                  </Box>

                  <IconButton
                    onClick={handleRefreshCaptcha}
                    disabled={loading}
                    sx={{
                      background: "linear-gradient(to bottom, #2562E9 0%, #1F43B5 100%)",
                      color: "#FDF6F0",
                      width: 64,
                      height: 64,
                      borderRadius: 3,
                      boxShadow: "0 4px 12px rgba(37, 98, 233, 0.3)",
                      "&:hover": {
                        background: "linear-gradient(to bottom, #1F43B5 0%, #2562E9 100%)",
                        transform: "scale(1.1)",
                      },
                    }}
                  >
                    <RefreshIcon sx={{ fontSize: "2rem" }} />
                  </IconButton>
                </Box>

                <Controller
                  name="captcha"
                  control={control}
                  rules={{
                    required: "CAPTCHA is required",
                    validate: (v) => v === captcha || "Incorrect CAPTCHA",
                  }}
                  render={({ field, fieldState: { error } }) => (
                    <TextField
                      {...field}
                      label={
                        <span style={{ color: "#235BDE", fontWeight: 600 }}>
                          Enter CAPTCHA <span style={{ color: "red" }}>*</span>
                        </span>
                      }
                      variant="outlined"
                      fullWidth
                      disabled={loading}
                      error={!!error}
                      helperText={error?.message}
                      sx={{
                        mt: 2.5,
                        "& .MuiOutlinedInput-root": { borderRadius: 3 },
                        "& .MuiFormLabel-root": { fontWeight: 600, color: "#235BDE" },
                      }}
                    />
                  )}
                />
              </Box>

              {/* Submit Button */}
              <Box sx={{ display: "flex", justifyContent: "center", mt: 5 }}>
                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={loading || !isEmailOtpVerified || !isMobileOtpVerified}
                  sx={{
                    minWidth: 240,
                    py: 1.8,
                    px: 6,
                    fontSize: "1.2rem",
                    fontWeight: 700,
                    background: "linear-gradient(45deg, #2562E9, #1F43B5)",
                    borderRadius: 3,
                    boxShadow: "0 6px 20px rgba(37,98,233,0.3)",
                    "&:hover": {
                      background: "linear-gradient(45deg, #1F43B5, #2562E9)",
                      transform: "translateY(-3px)",
                      boxShadow: "0 12px 30px rgba(37,98,233,0.4)",
                    },
                    "&:disabled": {
                      background: "grey",
                      opacity: 0.7,
                    },
                  }}
                >
                  {loading ? (
                    <>
                      <CircularProgress size={24} color="inherit" sx={{ mr: 2 }} />
                      Registering...
                    </>
                  ) : (
                    "Complete Registration"
                  )}
                </Button>
              </Box>
            </Box>
          </form>
        </Container>

        {/* OTP Modal */}
        {OtpModal && (
          <OtpModal
            open={isOtpModalOpen}
            onClose={() => {
              setIsOtpModalOpen(false);
              setOtpType(null);
            }}
            errorMessage={errorMessage}
            onSubmit={handleOtpSubmit}
            registeredAt={otpType}
            title={`Enter ${otpType === "email" ? "Email" : "Mobile"} OTP`}
          />
        )}

        <ToastContainer position="top-right" autoClose={4000} />

        {/* Full-screen loader overlay */}
        {loading && (
          <Box
            sx={{
              position: "fixed",
              inset: 0,
              backgroundColor: "rgba(0,0,0,0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
            }}
          >
            <CircularProgress size={80} sx={{ color: "#2562E9" }} />
          </Box>
        )}
      </Box>
    </Suspense>
  );
}