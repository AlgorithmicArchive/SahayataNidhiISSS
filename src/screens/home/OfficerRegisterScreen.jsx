import React, { useEffect, useState, useCallback, Suspense } from "react";
import {
  Box,
  Typography,
  Container,
  CircularProgress,
  IconButton,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  FormHelperText,
  Button,
  Paper,
  Alert,
  Stepper,
  Step,
  StepLabel,
  Chip,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import SecurityIcon from "@mui/icons-material/Security";
import { useForm, Controller } from "react-hook-form";
import { fetchDistricts } from "../../assets/fetch";
import OtpModal from "../../components/OtpModal";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import debounce from "lodash/debounce";
import {
  CheckCircle,
  Person,
  Business,
  LocationOn,
  ContactMail,
  Lock,
} from "@mui/icons-material";

// Generate CAPTCHA
const generateCaptcha = () => {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let captcha = "";
  for (let i = 0; i < 6; i++) {
    captcha += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return captcha;
};

export default function OfficerRegisterScreen() {
  const API_BASE = window.__CONFIG__?.API_URL || "";

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

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [deptRes, districtRes] = await Promise.all([
          axios.get(`${API_BASE}/Home/GetDepartments`),
          fetchDistricts(setDistrictOptions),
        ]);

        if (deptRes.data.status) {
          setDepartments(
            deptRes.data.departments.map((d) => ({
              label: d.departmentName,
              value: d.departmentId,
            })),
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

  useEffect(() => {
    if (!selectedDepartment) {
      setDesignations([]);
      setAccessLevelMap({});
      return;
    }

    const fetchDesignations = async () => {
      try {
        const res = await axios.get(
          `${API_BASE}/Home/GetDesignations?deparmentId=${selectedDepartment}`,
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

  useEffect(() => {
    if (!selectedDistrict) {
      setTehsilOptions([]);
      return;
    }

    const fetchTehsils = async () => {
      try {
        const res = await axios.get(
          `${API_BASE}/Base/GetTeshilForDistrict?districtId=${selectedDistrict}`,
        );

        if (res.data.status) {
          setTehsilOptions(
            res.data.tehsils.map((t) => ({
              label: t.tehsilName,
              value: t.tehsilId,
            })),
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

  const debouncedEmailValidation = useCallback(
    debounce(async (value) => {
      if (!value || !selectedDepartment || !selectedDesignation) return true;

      let errorMsg = null;
      if (
        accessLevelMap[selectedDesignation] === "Division" &&
        !selectedDivision
      )
        errorMsg = "Please select Division first";
      else if (
        accessLevelMap[selectedDesignation] === "District" &&
        !selectedDistrict
      )
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
          setError("email", {
            type: "manual",
            message: "Email already exists",
          });
          return false;
        }
        return true;
      } catch (err) {
        console.error("Email check failed:", err);
        return true;
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
    ],
  );

  const debouncedMobileValidation = useCallback(
    debounce(async (value) => {
      if (!value || !selectedDepartment || !selectedDesignation) return true;

      let errorMsg = null;
      if (
        accessLevelMap[selectedDesignation] === "Division" &&
        !selectedDivision
      )
        errorMsg = "Please select Division first";
      else if (
        accessLevelMap[selectedDesignation] === "District" &&
        !selectedDistrict
      )
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
        return true;
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
    ],
  );

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
          ] || 0,
    );

    try {
      const res = await axios.post(
        `${API_BASE}/Home/OfficerRegistration`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        },
      );

      if (res.data.status) {
        toast.success("Registration successful! Redirecting to login...");
        setTimeout(() => navigate("/"), 2200);
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

  const handleOtpSubmit = async (otp) => {
    if (!otp || otp.length < 4) return toast.error("Please enter valid OTP");

    setLoading(true);

    const formData = new FormData();
    formData.append("otp", otp);
    formData.append(
      otpType === "email" ? "email" : "mobile",
      getValues(otpType === "email" ? "email" : "mobileNumber"),
    );

    try {
      const res = await axios.post(`${API_BASE}/Home/OTPValidation`, formData);

      if (res.data.status) {
        if (otpType === "email") setIsEmailOtpVerified(true);
        else setIsMobileOtpVerified(true);

        setIsOtpModalOpen(false);
        toast.success(
          `${otpType === "email" ? "Email" : "Mobile"} verified successfully`,
        );
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
          bgcolor: "#F8FAFC",
        }}
      >
        <CircularProgress size={60} sx={{ color: "#2562E9" }} />
      </Box>
    );
  }

  return (
    <Suspense fallback={<CircularProgress />}>
      <Box
        sx={{
          minHeight: "100vh",
          bgcolor: "#F8FAFC",
          py: { xs: 3, md: 6 },
        }}
      >
        <Container maxWidth="md">
          {/* Header */}
          <Box sx={{ mb: 4, textAlign: "center" }}>
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: 3,
                bgcolor: "#EFF6FF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                mx: "auto",
                mb: 2,
              }}
            >
              <SecurityIcon sx={{ fontSize: 36, color: "#2562E9" }} />
            </Box>
            <Typography
              variant="h3"
              component="h1"
              sx={{
                fontWeight: 800,
                color: "#0F172A",
                letterSpacing: "-0.5px",
                mb: 1,
              }}
            >
              Officer Registration
            </Typography>
            <Typography variant="body1" sx={{ color: "#64748B" }}>
              Create your official account to access the Social Welfare Portal
            </Typography>
          </Box>

          {/* Main Form Card */}
          <Paper
            elevation={0}
            sx={{
              p: { xs: 3, md: 5 },
              borderRadius: 3,
              border: "1px solid #E2E8F0",
              bgcolor: "white",
            }}
          >
            <form onSubmit={handleSubmit(onSubmit)} noValidate>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {/* Personal Information Section */}
                <Box>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      mb: 3,
                    }}
                  >
                    <Person sx={{ color: "#2562E9" }} />
                    <Typography
                      variant="h6"
                      sx={{ fontWeight: 700, color: "#0F172A" }}
                    >
                      Personal Information
                    </Typography>
                  </Box>

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
                        label="Full Name *"
                        variant="outlined"
                        fullWidth
                        disabled={loading}
                        error={!!error}
                        helperText={error?.message}
                        sx={{
                          "& .MuiOutlinedInput-root": {
                            "& fieldset": { borderColor: "#E2E8F0" },
                            "&:hover fieldset": { borderColor: "#2562E9" },
                            "&.Mui-focused fieldset": {
                              borderColor: "#2562E9",
                            },
                          },
                        }}
                      />
                    )}
                  />
                </Box>

                {/* Department & Designation Section */}
                <Box>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      mb: 3,
                    }}
                  >
                    <Business sx={{ color: "#2562E9" }} />
                    <Typography
                      variant="h6"
                      sx={{ fontWeight: 700, color: "#0F172A" }}
                    >
                      Department & Designation
                    </Typography>
                  </Box>

                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: { xs: "column", md: "row" },
                      gap: 3,
                    }}
                  >
                    <Controller
                      name="department"
                      control={control}
                      rules={{ required: "Department is required" }}
                      render={({ field, fieldState: { error } }) => (
                        <FormControl fullWidth error={!!error}>
                          <InputLabel>Department *</InputLabel>
                          <Select
                            {...field}
                            label="Department *"
                            disabled={loading}
                          >
                            {departments.map((d) => (
                              <MenuItem key={d.value} value={d.value}>
                                {d.label}
                              </MenuItem>
                            ))}
                          </Select>
                          {error && (
                            <FormHelperText>{error.message}</FormHelperText>
                          )}
                        </FormControl>
                      )}
                    />

                    <Controller
                      name="designation"
                      control={control}
                      rules={{ required: "Designation is required" }}
                      render={({ field, fieldState: { error } }) => (
                        <FormControl fullWidth error={!!error}>
                          <InputLabel>Designation *</InputLabel>
                          <Select
                            {...field}
                            label="Designation *"
                            disabled={loading || !selectedDepartment}
                          >
                            {designations.map((d) => (
                              <MenuItem key={d.value} value={d.value}>
                                {d.label}
                              </MenuItem>
                            ))}
                          </Select>
                          {error && (
                            <FormHelperText>{error.message}</FormHelperText>
                          )}
                        </FormControl>
                      )}
                    />
                  </Box>
                </Box>

                {/* Access Level Section */}
                {(accessLevelMap[selectedDesignation] === "District" ||
                  accessLevelMap[selectedDesignation] === "Tehsil" ||
                  accessLevelMap[selectedDesignation] === "Division") && (
                  <Box>
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        mb: 3,
                      }}
                    >
                      <LocationOn sx={{ color: "#2562E9" }} />
                      <Typography
                        variant="h6"
                        sx={{ fontWeight: 700, color: "#0F172A" }}
                      >
                        Jurisdiction Area
                      </Typography>
                    </Box>

                    <Box
                      sx={{
                        display: "flex",
                        flexDirection: { xs: "column", md: "row" },
                        gap: 3,
                      }}
                    >
                      <Controller
                        name={
                          accessLevelMap[selectedDesignation] === "Division"
                            ? "Division"
                            : "District"
                        }
                        control={control}
                        rules={{
                          required: `${accessLevelMap[selectedDesignation]} is required`,
                        }}
                        render={({ field, fieldState: { error } }) => (
                          <FormControl fullWidth error={!!error}>
                            <InputLabel>
                              {accessLevelMap[selectedDesignation] ===
                              "Division"
                                ? "Division"
                                : "District"}{" "}
                              *
                            </InputLabel>
                            <Select
                              {...field}
                              label={
                                accessLevelMap[selectedDesignation] ===
                                "Division"
                                  ? "Division *"
                                  : "District *"
                              }
                              disabled={loading}
                            >
                              {accessLevelMap[selectedDesignation] ===
                              "Division" ? (
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
                            {error && (
                              <FormHelperText>{error.message}</FormHelperText>
                            )}
                          </FormControl>
                        )}
                      />

                      {accessLevelMap[selectedDesignation] === "Tehsil" && (
                        <Controller
                          name="Tehsil"
                          control={control}
                          rules={{ required: "TSWO Office is required" }}
                          render={({ field, fieldState: { error } }) => (
                            <FormControl fullWidth error={!!error}>
                              <InputLabel>TSWO Office *</InputLabel>
                              <Select
                                {...field}
                                label="TSWO Office *"
                                disabled={loading || !selectedDistrict}
                              >
                                {tehsilOptions.map((t) => (
                                  <MenuItem key={t.value} value={t.value}>
                                    {t.label}
                                  </MenuItem>
                                ))}
                              </Select>
                              {error && (
                                <FormHelperText>{error.message}</FormHelperText>
                              )}
                            </FormControl>
                          )}
                        />
                      )}
                    </Box>
                  </Box>
                )}

                {/* Contact Information Section */}
                <Box>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      mb: 3,
                    }}
                  >
                    <ContactMail sx={{ color: "#2562E9" }} />
                    <Typography
                      variant="h6"
                      sx={{ fontWeight: 700, color: "#0F172A" }}
                    >
                      Contact Information
                    </Typography>
                  </Box>

                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: { xs: "column", md: "row" },
                      gap: 3,
                    }}
                  >
                    {/* Email */}
                    <Box sx={{ flex: 1 }}>
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1.5,
                          mb: 1,
                        }}
                      >
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
                              label="Email Address *"
                              type="email"
                              fullWidth
                              disabled={loading || isEmailOtpVerified}
                              error={!!error}
                              helperText={error?.message}
                            />
                          )}
                        />
                        {isEmailOtpVerified && (
                          <Chip
                            label="Verified"
                            icon={<CheckCircle sx={{ fontSize: 16 }} />}
                            color="success"
                            size="small"
                            sx={{ fontWeight: 600 }}
                          />
                        )}
                      </Box>

                      {!isEmailOtpVerified && emailValue && !errors.email && (
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={handleEmailValidate}
                          disabled={loading}
                          fullWidth
                          sx={{
                            textTransform: "none",
                            borderColor: "#2562E9",
                            color: "#2562E9",
                            "&:hover": { bgcolor: "#EFF6FF" },
                          }}
                        >
                          Send OTP to Email
                        </Button>
                      )}
                    </Box>

                    {/* Mobile */}
                    <Box sx={{ flex: 1 }}>
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1.5,
                          mb: 1,
                        }}
                      >
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
                              label="Mobile Number *"
                              type="tel"
                              fullWidth
                              inputProps={{ maxLength: 10 }}
                              disabled={loading || isMobileOtpVerified}
                              error={!!error}
                              helperText={error?.message}
                            />
                          )}
                        />
                        {isMobileOtpVerified && (
                          <Chip
                            label="Verified"
                            icon={<CheckCircle sx={{ fontSize: 16 }} />}
                            color="success"
                            size="small"
                            sx={{ fontWeight: 600 }}
                          />
                        )}
                      </Box>

                      {!isMobileOtpVerified &&
                        mobileValue &&
                        !errors.mobileNumber && (
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={handleMobileValidate}
                            disabled={loading}
                            fullWidth
                            sx={{
                              textTransform: "none",
                              borderColor: "#2562E9",
                              color: "#2562E9",
                              "&:hover": { bgcolor: "#EFF6FF" },
                            }}
                          >
                            Send OTP to Mobile
                          </Button>
                        )}
                    </Box>
                  </Box>
                </Box>

                {/* Security Verification Section */}
                <Box>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      mb: 3,
                    }}
                  >
                    <Lock sx={{ color: "#2562E9" }} />
                    <Typography
                      variant="h6"
                      sx={{ fontWeight: 700, color: "#0F172A" }}
                    >
                      Security Verification
                    </Typography>
                  </Box>

                  <Paper
                    variant="outlined"
                    sx={{
                      p: 3,
                      mb: 2,
                      bgcolor: "#F8FAFC",
                      border: "2px dashed #CBD5E1",
                      borderRadius: 2,
                      textAlign: "center",
                    }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 2,
                        mb: 2,
                      }}
                    >
                      <Box
                        sx={{
                          fontFamily: "monospace",
                          fontSize: "2rem",
                          fontWeight: 800,
                          color: "#0F172A",
                          letterSpacing: "8px",
                          userSelect: "none",
                        }}
                      >
                        {captcha}
                      </Box>
                      <IconButton
                        onClick={handleRefreshCaptcha}
                        disabled={loading}
                        sx={{
                          bgcolor: "#EFF6FF",
                          color: "#2562E9",
                          "&:hover": { bgcolor: "#DBEAFE" },
                        }}
                      >
                        <RefreshIcon />
                      </IconButton>
                    </Box>
                    <Typography variant="body2" sx={{ color: "#64748B" }}>
                      Type the characters shown above
                    </Typography>
                  </Paper>

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
                        label="Enter CAPTCHA *"
                        variant="outlined"
                        fullWidth
                        disabled={loading}
                        error={!!error}
                        helperText={error?.message}
                      />
                    )}
                  />
                </Box>

                {/* Submit Button */}
                <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    disabled={
                      loading || !isEmailOtpVerified || !isMobileOtpVerified
                    }
                    sx={{
                      minWidth: 280,
                      py: 1.8,
                      px: 6,
                      fontSize: "1.1rem",
                      fontWeight: 700,
                      bgcolor: "#2562E9",
                      "&:hover": { bgcolor: "#1D4ED8" },
                      textTransform: "none",
                      boxShadow: "0 4px 12px rgba(37, 99, 233, 0.3)",
                      "&:disabled": {
                        bgcolor: "#CBD5E1",
                        color: "#94A3B8",
                      },
                    }}
                  >
                    {loading ? (
                      <>
                        <CircularProgress
                          size={24}
                          color="inherit"
                          sx={{ mr: 2 }}
                        />
                        Registering...
                      </>
                    ) : (
                      "Complete Registration"
                    )}
                  </Button>
                </Box>
              </Box>
            </form>
          </Paper>
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
              backgroundColor: "rgba(15, 23, 42, 0.75)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
            }}
          >
            <CircularProgress size={80} sx={{ color: "#FFFFFF" }} />
          </Box>
        )}
      </Box>
    </Suspense>
  );
}
