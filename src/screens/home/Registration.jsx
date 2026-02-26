import React, { useEffect, useState, useCallback } from "react";
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
import OtpModal from "../../components/OtpModal";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Col, Row } from "react-bootstrap";
import { fetchDistricts } from "../../assets/fetch";
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

export default function RegisterScreen() {
  const API_BASE = window.__CONFIG__?.API_URL || ""; // fallback to empty string

  const [captcha, setCaptcha] = useState(generateCaptcha());
  const {
    handleSubmit,
    control,
    getValues,
    watch,
    formState: { errors },
    trigger,
    setValue,
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
      captcha: "",
      District: "",
      Tehsil: "",
    },
  });

  const [isOtpModalOpen, setIsOtpModalOpen] = useState(false);
  const [otpType, setOtpType] = useState(null); // 'email' or 'mobile'
  const [userId, setUserId] = useState(0);
  const [loading, setLoading] = useState(false);
  const [districtOptions, setDistrictOptions] = useState([]);
  const [tehsilOptions, setTehsilOptions] = useState([]);
  const [isEmailOtpSent, setIsEmailOtpSent] = useState(false);
  const [isEmailOtpVerified, setIsEmailOtpVerified] = useState(false);
  const [isMobileOtpSent, setIsMobileOtpSent] = useState(false);
  const [isMobileOtpVerified, setIsMobileOtpVerified] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isEmailUnique, setIsEmailUnique] = useState(true);
  const [isMobileNumberUnique, setIsMobileNumberUnique] = useState(true);

  const selectedDistrict = watch("District");
  const emailValue = watch("email");
  const mobileValue = watch("mobileNumber");

  const navigate = useNavigate();

  // Reset CAPTCHA on mount/change
  useEffect(() => {
    setValue("captcha", "");
    setCaptcha(generateCaptcha());
  }, [setValue]);

  // Fetch districts
  useEffect(() => {
    fetchDistricts(setDistrictOptions); // assuming this already uses API_BASE
  }, []);

  // Fetch tehsils based on district
  useEffect(() => {
    if (!selectedDistrict) {
      setTehsilOptions([]);
      return;
    }

    const fetchTehsils = async () => {
      try {
        const response = await axios.get(
          `${API_BASE}/Base/GetTeshilForDistrict?districtId=${selectedDistrict}`
        );

        if (response.data.status) {
          const formatted = response.data.tehsils.map((t) => ({
            label: t.tehsilName,
            value: t.tehsilId,
          }));
          setTehsilOptions(formatted);
        }
      } catch (err) {
        console.error("Failed to load tehsils:", err);
        toast.error("Failed to load tehsil options");
      }
    };

    fetchTehsils();
  }, [selectedDistrict]);

  const handleRefreshCaptcha = useCallback(() => {
    setCaptcha(generateCaptcha());
    setValue("captcha", "");
  }, [setValue]);

  // Validate Email + uniqueness check
  const handleEmailValidate = async () => {
    const valid = await trigger("email");
    if (!valid || errors.email || !isEmailUnique) return;

    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/Home/SendOtp`, {
        params: { email: emailValue },
      });

      if (res.data.status) {
        setIsEmailOtpSent(true);
        setIsOtpModalOpen(true);
        setOtpType("email");
        setUserId(res.data.userId);
        setErrorMessage(res.data.message);
        toast.success("OTP sent to email!");
      } else {
        toast.error(res.data.message || "Failed to send OTP");
      }
    } catch (err) {
      console.error("Email OTP error:", err);
      toast.error("Failed to send email OTP");
    } finally {
      setLoading(false);
    }
  };

  // Validate Mobile + uniqueness check
  const handleMobileValidate = async () => {
    const valid = await trigger("mobileNumber");
    if (!valid || errors.mobileNumber || !isMobileNumberUnique) return;

    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/Home/SendOtp`, {
        params: { mobile: mobileValue },
      });

      if (res.data.status) {
        setIsMobileOtpSent(true);
        setIsOtpModalOpen(true);
        setOtpType("mobile");
        setUserId(res.data.userId);
        setErrorMessage(res.data.message);
        toast.success("OTP sent to mobile!");
      } else {
        toast.error(res.data.message || "Failed to send OTP");
      }
    } catch (err) {
      console.error("Mobile OTP error:", err);
      toast.error("Failed to send mobile OTP");
    } finally {
      setLoading(false);
    }
  };

  // Submit Registration
  const onSubmit = async (data) => {
    if (emailValue && !isEmailOtpVerified) {
      return toast.error("Please verify your email first");
    }
    if (!isMobileOtpVerified) {
      return toast.error("Please verify your mobile number first");
    }

    setLoading(true);

    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => formData.append(key, value));

    try {
      const res = await axios.post(`${API_BASE}/Home/Register`, formData, {
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
    if (!otp || otp.length < 4) return toast.error("Please enter a valid OTP");

    setLoading(true);

    const formData = new FormData();
    formData.append("otp", otp);
    if (otpType === "email") formData.append("email", getValues("email"));
    else formData.append("mobile", getValues("mobileNumber"));

    try {
      const res = await axios.post(`${API_BASE}/Home/OTPValidation`, formData);

      if (res.data.status) {
        if (otpType === "email") setIsEmailOtpVerified(true);
        else setIsMobileOtpVerified(true);

        setIsOtpModalOpen(false);
        toast.success(`${otpType === "email" ? "Email" : "Mobile"} verified successfully!`);
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

  return (
    <>
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
          maxWidth="md"
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
            Create Account
          </Typography>

          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 3.5 }}>
              {/* Full Name + Username */}
              <Row>
                <Col xs={12} md={6}>
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
                </Col>

                <Col xs={12} md={6}>
                  <Controller
                    name="username"
                    control={control}
                    rules={{
                      required: "Username is required",
                      minLength: { value: 5, message: "Minimum 5 characters" },
                      validate: async (value) => {
                        try {
                          const res = await axios.get(`${API_BASE}/Home/CheckUsername`, {
                            params: { username: value },
                          });
                          return res.data?.isUnique || "Username is already taken";
                        } catch (err) {
                          console.error("Username check failed:", err);
                          return "Error checking username availability";
                        }
                      },
                    }}
                    render={({ field, fieldState: { error } }) => (
                      <TextField
                        {...field}
                        label={
                          <span style={{ color: "#235BDE", fontWeight: 600 }}>
                            Username <span style={{ color: "red" }}>*</span>
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
                </Col>
              </Row>

              {/* Email + Mobile with Validation */}
              <Row>
                <Col xs={12} md={6}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <Controller
                      name="email"
                      control={control}
                      rules={{
                        pattern: {
                          value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                          message: "Invalid email format",
                        },
                        validate: async (value) => {
                          if (!value) return true;
                          try {
                            const res = await axios.get(`${API_BASE}/Home/CheckEmail`, {
                              params: { email: value, UserType: "Citizen" },
                            });
                            const isUnique = res.data?.isUnique;
                            setIsEmailUnique(isUnique);
                            return isUnique || "Email is already registered";
                          } catch (err) {
                            console.error("Email check failed:", err);
                            return "Error checking email availability";
                          }
                        },
                      }}
                      render={({ field, fieldState: { error } }) => (
                        <TextField
                          {...field}
                          label={
                            <span style={{ color: "#235BDE", fontWeight: 600 }}>
                              Email
                            </span>
                          }
                          type="email"
                          variant="outlined"
                          fullWidth
                          disabled={loading || isEmailOtpVerified}
                          error={!!error}
                          helperText={error?.message}
                          sx={{
                            flex: 1,
                            "& .MuiOutlinedInput-root": { borderRadius: 3 },
                            "& .MuiFormLabel-root": { fontWeight: 600, color: "#235BDE" },
                          }}
                        />
                      )}
                    />

                    {isEmailOtpVerified && emailValue && (
                      <CheckCircleOutline sx={{ color: "#0FB282", fontSize: 32 }} />
                    )}
                  </Box>

                  {!isEmailOtpVerified && emailValue && isEmailUnique && (
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
                </Col>

                <Col xs={12} md={6}>
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
                        validate: async (value) => {
                          if (!value) return true;
                          try {
                            const res = await axios.get(`${API_BASE}/Home/CheckMobileNumber`, {
                              params: { number: value, UserType: "Citizen" },
                            });
                            const isUnique = res.data?.isUnique;
                            setIsMobileNumberUnique(isUnique);
                            return isUnique || "Mobile number is already registered";
                          } catch (err) {
                            console.error("Mobile check failed:", err);
                            return "Error checking mobile availability";
                          }
                        },
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
                          variant="outlined"
                          fullWidth
                          disabled={loading || isMobileOtpVerified}
                          error={!!error}
                          helperText={error?.message}
                          inputProps={{ maxLength: 10 }}
                          sx={{
                            flex: 1,
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

                  {!isMobileOtpVerified && mobileValue && isMobileNumberUnique && (
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
                </Col>
              </Row>

              {/* Password + Confirm Password */}
              <Row>
                <Col xs={12} md={6}>
                  <Controller
                    name="password"
                    control={control}
                    rules={{
                      required: "Password is required",
                      pattern: {
                        value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{6,20}$/,
                        message:
                          "Password must contain uppercase, lowercase, number, and special character",
                      },
                    }}
                    render={({ field, fieldState: { error } }) => (
                      <TextField
                        {...field}
                        label={
                          <span style={{ color: "#235BDE", fontWeight: 600 }}>
                            Password <span style={{ color: "red" }}>*</span>
                          </span>
                        }
                        type="password"
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
                </Col>

                <Col xs={12} md={6}>
                  <Controller
                    name="confirmPassword"
                    control={control}
                    rules={{
                      required: "Confirm password is required",
                      validate: (value) =>
                        value === getValues("password") || "Passwords do not match",
                    }}
                    render={({ field, fieldState: { error } }) => (
                      <TextField
                        {...field}
                        label={
                          <span style={{ color: "#235BDE", fontWeight: 600 }}>
                            Confirm Password <span style={{ color: "red" }}>*</span>
                          </span>
                        }
                        type="password"
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
                </Col>
              </Row>

              {/* District + Tehsil */}
              <Row>
                <Col xs={12} md={6}>
                  <Controller
                    name="District"
                    control={control}
                    rules={{ required: "District is required" }}
                    render={({ field, fieldState: { error } }) => (
                      <FormControl fullWidth error={!!error}>
                        <InputLabel sx={{ color: "#235BDE", fontWeight: 600 }}>
                          District <span style={{ color: "red" }}>*</span>
                        </InputLabel>
                        <Select
                          {...field}
                          disabled={loading}
                          sx={{ borderRadius: 3 }}
                        >
                          {districtOptions.map((opt) => (
                            <MenuItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </MenuItem>
                          ))}
                        </Select>
                        {error && <FormHelperText>{error.message}</FormHelperText>}
                      </FormControl>
                    )}
                  />
                </Col>

                <Col xs={12} md={6}>
                  <Controller
                    name="Tehsil"
                    control={control}
                    rules={{ required: "Tehsil is required" }}
                    render={({ field, fieldState: { error } }) => (
                      <FormControl fullWidth error={!!error}>
                        <InputLabel sx={{ color: "#235BDE", fontWeight: 600 }}>
                          Tehsil <span style={{ color: "red" }}>*</span>
                        </InputLabel>
                        <Select
                          {...field}
                          disabled={loading || !selectedDistrict}
                          sx={{ borderRadius: 3 }}
                        >
                          {tehsilOptions.map((opt) => (
                            <MenuItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </MenuItem>
                          ))}
                        </Select>
                        {error && <FormHelperText>{error.message}</FormHelperText>}
                      </FormControl>
                    )}
                  />
                </Col>
              </Row>

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
                    validate: (value) => value === captcha || "Incorrect CAPTCHA",
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

              {/* Register Button */}
              <Box sx={{ display: "flex", justifyContent: "center", mt: 5 }}>
                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={
                    loading ||
                    !isMobileOtpVerified ||
                    (emailValue && !isEmailOtpVerified)
                  }
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
                    "Create Account"
                  )}
                </Button>
              </Box>
            </Box>
          </form>

          {/* Links */}
          <Box textAlign="center" mt={4}>
            <Typography variant="body1" color="text.secondary">
              Already have an account?{" "}
              <Link
                component="button"
                onClick={() => navigate("/login")}
                sx={{
                  color: "#F67015",
                  fontWeight: 600,
                  textDecoration: "none",
                  "&:hover": { textDecoration: "underline" },
                }}
              >
                Sign In
              </Link>
            </Typography>
          </Box>

          <Box textAlign="center" mt={1}>
            <Typography variant="body1" color="text.secondary">
              Department Officer?{" "}
              <Link
                component="button"
                onClick={() => navigate("/officerRegistration")}
                sx={{
                  color: "#235BDE",
                  fontWeight: 600,
                  textDecoration: "none",
                  "&:hover": { textDecoration: "underline" },
                }}
              >
                Register Here
              </Link>
            </Typography>
          </Box>
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
    </>
  );
}