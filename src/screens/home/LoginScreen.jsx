import React, { useContext, useState, useEffect } from "react";
import {
  Box,
  Typography,
  Link,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  IconButton,
  InputAdornment,
  Alert,
  Paper,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import LockIcon from "@mui/icons-material/Lock";
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { useNavigate } from "react-router-dom";
import { UserContext } from "../../UserContext";
import { ToastContainer, toast } from "react-toastify";
import CircularProgress from "@mui/material/CircularProgress";
import "react-toastify/dist/ReactToastify.css";
import { rsaService } from "../../services/rsaService";

// CAPTCHA generator
const generateCaptcha = () => {
  const characters = "ABCDEFGHIJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let captcha = "";
  for (let i = 0; i < 6; i++) {
    captcha += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return captcha;
};

// Validation schema
const schema = yup.object().shape({
  username: yup.string().required("Username is required"),
  password: yup
    .string()
    .min(6, "Password must be at least 6 characters")
    .required("Password is required"),
  captcha: yup
    .string()
    .required("CAPTCHA is required")
    .test("captcha-match", "CAPTCHA is incorrect", function (value) {
      return value === this.options.context.captcha;
    }),
});

export default function LoginScreen() {
  const API_BASE = window.__CONFIG__?.API_URL || "";

  const [captcha, setCaptcha] = useState(generateCaptcha());
  const [showPassword, setShowPassword] = useState(false);
  const [buttonLoading, setButtonLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [otp, setOtp] = useState("");
  const [email, setEmail] = useState("");
  const [loginError, setLoginError] = useState("");

  const {
    handleSubmit,
    control,
    formState: { errors },
    watch,
    setValue,
  } = useForm({
    resolver: yupResolver(schema),
    context: { captcha },
  });

  const {
    setUserType,
    setToken,
    setProfile,
    setUsername,
    setDesignation,
    setDepartment,
    setUserId,
    setActualUserType,
  } = useContext(UserContext);

  const navigate = useNavigate();

  useEffect(() => {
    setCaptcha(generateCaptcha());
  }, []);

  // Clear login error when user types or refreshes CAPTCHA
  useEffect(() => {
    const subscription = watch(() => setLoginError(""));
    return () => subscription.unsubscribe();
  }, [watch]);

  const handleRefreshCaptcha = () => {
    setCaptcha(generateCaptcha());
    setLoginError("");
    setValue("captcha", "");
  };

  const handleClickShowPassword = () => {
    setShowPassword(!showPassword);
  };

  const handleMouseDownPassword = (event) => {
    event.preventDefault();
  };

  // Encrypt password with RSA before submission
  const onSubmit = async (data) => {
    setButtonLoading(true);
    setLoading(true);
    setLoginError("");

    try {
      const encryptedUsername = await rsaService.encrypt(data.username);
      const encryptedPassword = await rsaService.encrypt(data.password);

      const formData = new FormData();
      formData.append("username", encryptedUsername);
      formData.append("password", encryptedPassword);

      const response = await fetch(`${API_BASE}/Home/Login`, {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (result.status) {
        setToken(result.token);
        setUserType(result.userType);
        setActualUserType(result.actualUserType);
        setProfile(result.profile);
        setUsername(result.username);
        setDesignation(result.designation);
        setUserId(result.userId);
        if (result.department && result.department !== "")
          setDepartment(result.department);

        navigate("/verification");
      } else if (result.isEmailVerified === false) {
        const formDataEmail = new FormData();
        formDataEmail.append("email", result.email);

        const res = await fetch(`${API_BASE}/Home/SendEmailVerificationOtp`, {
          method: "POST",
          body: formDataEmail,
        });

        const resJson = await res.json();

        if (resJson.status) {
          setEmail(result.email);
          setUsername(result.username);
          setOtpModalOpen(true);
          toast.success("OTP sent to your email.");
        } else {
          toast.error(resJson.message || "Failed to send OTP.");
          setLoginError(resJson.message || "Failed to send OTP.");
        }
      } else {
        const errorMsg = result.response || "Invalid credentials.";
        toast.error(errorMsg);
        setLoginError(errorMsg);
      }
    } catch (err) {
      console.error("Login Error:", err);
      const errorMsg = "An error occurred. Please try again.";
      toast.error(errorMsg);
      setLoginError(errorMsg);
    } finally {
      setLoading(false);
      setButtonLoading(false);
      setCaptcha(generateCaptcha());
    }
  };

  const handleOtpVerify = async () => {
    if (!otp || otp.length !== 6) {
      toast.error("OTP must be 6 digits.");
      return;
    }

    setButtonLoading(true);

    try {
      const formData = new FormData();
      formData.append("email", email);
      formData.append("otp", otp);

      const res = await fetch(`${API_BASE}/Home/VerifyEmailOtp`, {
        method: "POST",
        body: formData,
      });

      const result = await res.json();

      if (result.status) {
        setOtpModalOpen(false);
        toast.success("Email verified. Please login again.");
      } else {
        toast.error(result.message || "OTP verification failed.");
        setLoginError(result.message || "OTP verification failed.");
      }
    } catch (err) {
      toast.error("Error verifying OTP.");
      setLoginError("Error verifying OTP.");
    } finally {
      setButtonLoading(false);
    }
  };

  const handleResendOtp = async () => {
    const formData = new FormData();
    formData.append("email", email);

    try {
      const res = await fetch(`${API_BASE}/Home/SendEmailVerificationOtp`, {
        method: "POST",
        body: formData,
      });

      const result = await res.json();

      if (result.status) {
        toast.success("OTP resent to your email.");
      } else {
        toast.error(result.message || "Failed to resend OTP.");
        setLoginError(result.message || "Failed to resend OTP.");
      }
    } catch (err) {
      toast.error("Error resending OTP.");
      setLoginError("Error resending OTP.");
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
          bgcolor: "#F8FAFC",
        }}
      >
        <CircularProgress size={60} sx={{ color: "#2562E9" }} />
      </Box>
    );

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "#F8FAFC",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        py: 4,
        px: 2,
      }}
    >
      <Paper
        elevation={0}
        sx={{
          width: "100%",
          maxWidth: 480,
          p: { xs: 3, sm: 5 },
          borderRadius: 3,
          border: "1px solid #E2E8F0",
          bgcolor: "white",
        }}
      >
        {/* Header */}
        <Box sx={{ textAlign: "center", mb: 4 }}>
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
            <LockIcon sx={{ fontSize: 32, color: "#2562E9" }} />
          </Box>
          <Typography
            variant="h4"
            sx={{
              fontWeight: 800,
              color: "#0F172A",
              letterSpacing: "-0.5px",
              mb: 0.5,
            }}
          >
            Welcome Back
          </Typography>
          <Typography variant="body1" sx={{ color: "#64748B" }}>
            Sign in to access your dashboard
          </Typography>
        </Box>

        {/* Form */}
        <Box
          component="form"
          noValidate
          autoComplete="off"
          onSubmit={handleSubmit(onSubmit)}
          sx={{ display: "flex", flexDirection: "column", gap: 3 }}
        >
          {/* Username Field */}
          <Controller
            name="username"
            control={control}
            defaultValue=""
            render={({ field }) => (
              <TextField
                {...field}
                label="Username"
                placeholder="Enter your username"
                disabled={buttonLoading}
                error={!!errors.username}
                helperText={errors.username?.message}
                fullWidth
                required
              />
            )}
          />

          {/* Password Field */}
          <Controller
            name="password"
            control={control}
            defaultValue=""
            render={({ field }) => (
              <TextField
                {...field}
                label="Password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                disabled={buttonLoading}
                error={!!errors.password}
                helperText={errors.password?.message}
                fullWidth
                required
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="toggle password visibility"
                        onClick={handleClickShowPassword}
                        onMouseDown={handleMouseDownPassword}
                        edge="end"
                        disabled={buttonLoading}
                        size="small"
                      >
                        {showPassword ? (
                          <VisibilityOff fontSize="small" />
                        ) : (
                          <Visibility fontSize="small" />
                        )}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            )}
          />

          {/* CAPTCHA Section */}
          <Box>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                mb: 2,
              }}
            >
              <Paper
                variant="outlined"
                sx={{
                  flex: 1,
                  py: 2,
                  px: 2,
                  bgcolor: "#E8E4D8", // aged-paper beige
                  border: "2px solid #A8A29E",
                  borderRadius: 2,
                  textAlign: "center",
                  userSelect: "none",
                  position: "relative",
                  overflow: "hidden",
                  minHeight: 64,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  // Multiple overlapping noise layers using gradients:
                  // 1. Diagonal hash lines
                  // 2. Counter-diagonal hash lines
                  // 3. Thick strike-through line
                  // 4. Second strike-through line at different angle
                  backgroundImage: `
      repeating-linear-gradient(
        45deg,
        transparent,
        transparent 9px,
        rgba(120, 80, 60, 0.18) 9px,
        rgba(120, 80, 60, 0.18) 10px
      ),
      repeating-linear-gradient(
        -30deg,
        transparent,
        transparent 14px,
        rgba(60, 80, 120, 0.14) 14px,
        rgba(60, 80, 120, 0.14) 15px
      ),
      linear-gradient(
        12deg,
        transparent 46%,
        rgba(80, 40, 20, 0.45) 46%,
        rgba(80, 40, 20, 0.45) 54%,
        transparent 54%
      ),
      linear-gradient(
        -8deg,
        transparent 52%,
        rgba(40, 60, 100, 0.35) 52%,
        rgba(40, 60, 100, 0.35) 58%,
        transparent 58%
      )
    `,
                  boxShadow: "inset 0 0 12px rgba(0,0,0,0.08)",
                }}
              >
                {captcha.split("").map((char, i) => {
                  // Deterministic "randomness" per character (so same captcha = same look)
                  const seed = (char.charCodeAt(0) + i * 13) % 100;
                  const rotation = (seed % 40) - 20; // -20° to +20°
                  const translateY = (seed % 11) - 5; // -5px to +5px
                  const fontSize = 1.4 + (seed % 10) / 25; // 1.4rem to 1.8rem
                  const colors = [
                    "#6B3410", // dark brown
                    "#2F4F4F", // dark slate
                    "#556B2F", // dark olive
                    "#8B0000", // dark red
                    "#4B0082", // indigo
                    "#1C3A5E", // navy
                  ];
                  const color = colors[(seed + i) % colors.length];
                  const fonts = [
                    "Georgia",
                    "'Courier New'",
                    "'Times New Roman'",
                    "Verdana",
                  ];
                  const fontFamily = fonts[(seed + i) % fonts.length];
                  const fontStyle = seed % 3 === 0 ? "italic" : "normal";
                  const fontWeight = seed % 2 === 0 ? 900 : 700;
                  const opacity = 0.78 + (seed % 22) / 100;
                  const letterSpacing = (seed % 6) + 2;

                  return (
                    <span
                      key={i}
                      style={{
                        display: "inline-block",
                        transform: `rotate(${rotation}deg) translateY(${translateY}px)`,
                        fontSize: `${fontSize}rem`,
                        color,
                        fontFamily,
                        fontStyle,
                        fontWeight,
                        opacity,
                        letterSpacing: `${letterSpacing}px`,
                        textShadow:
                          "1px 1px 0 rgba(255,255,255,0.7), -1px -1px 0 rgba(0,0,0,0.15)",
                        marginRight: `${seed % 4}px`,
                      }}
                    >
                      {char}
                    </span>
                  );
                })}
              </Paper>
              <IconButton
                onClick={handleRefreshCaptcha}
                disabled={buttonLoading}
                sx={{
                  bgcolor: "#EFF6FF",
                  color: "#2562E9",
                  width: 48,
                  height: 48,
                  "&:hover": { bgcolor: "#DBEAFE" },
                }}
              >
                <RefreshIcon />
              </IconButton>
            </Box>

            <Controller
              name="captcha"
              control={control}
              defaultValue=""
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Enter CAPTCHA"
                  placeholder="Type the code above"
                  disabled={buttonLoading}
                  error={!!errors.captcha}
                  helperText={errors.captcha?.message}
                  fullWidth
                  required
                />
              )}
            />
          </Box>

          {/* Forgot Password */}
          <Box sx={{ textAlign: "right", mt: -1 }}>
            <Link
              href="/forgot-password"
              sx={{
                fontSize: "0.875rem",
                color: "#2562E9",
                fontWeight: 600,
                textDecoration: "none",
                "&:hover": { textDecoration: "underline" },
              }}
            >
              Forgot Password/Username?
            </Link>
          </Box>

          {/* Error Message */}
          {loginError && (
            <Alert severity="error" sx={{ borderRadius: 2 }}>
              {loginError}
            </Alert>
          )}

          {/* LOGIN BUTTON */}
          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={buttonLoading}
            fullWidth
            sx={{
              py: 1.5,
              fontSize: "1rem",
              fontWeight: 700,
              textTransform: "none",
              bgcolor: "#2562E9",
              "&:hover": { bgcolor: "#1D4ED8" },
              boxShadow: "0 4px 12px rgba(37, 99, 233, 0.2)",
            }}
          >
            {buttonLoading ? (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <CircularProgress size={20} color="inherit" />
                Logging In...
              </Box>
            ) : (
              "Log In"
            )}
          </Button>

          {/* Sign Up Link */}
          <Box sx={{ textAlign: "center", mt: 1 }}>
            <Typography variant="body2" sx={{ color: "#64748B" }}>
              Don't have an account?{" "}
              <Link
                href="/register"
                sx={{
                  color: "#2562E9",
                  fontWeight: 600,
                  textDecoration: "none",
                  "&:hover": { textDecoration: "underline" },
                }}
                onClick={(e) => {
                  e.preventDefault();
                  navigate("/register");
                }}
              >
                Register here
              </Link>
            </Typography>
          </Box>
        </Box>
      </Paper>

      {/* OTP Modal */}
      <Dialog
        open={otpModalOpen}
        onClose={() => setOtpModalOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, color: "#0F172A", pb: 1 }}>
          Verify Your Email
        </DialogTitle>
        <DialogContent sx={{ px: 3, pb: 2 }}>
          <Typography variant="body2" sx={{ color: "#475569", mb: 3 }}>
            Enter the 6-digit OTP sent to{" "}
            <strong style={{ color: "#0F172A" }}>{email}</strong>
          </Typography>
          <TextField
            fullWidth
            label="OTP"
            variant="outlined"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            inputProps={{ maxLength: 6 }}
            disabled={buttonLoading}
            autoFocus
          />
          <Box mt={2}>
            <Link
              component="button"
              variant="body2"
              onClick={handleResendOtp}
              disabled={buttonLoading}
              sx={{
                color: "#2562E9",
                fontWeight: 600,
                textDecoration: "none",
                "&:hover": { textDecoration: "underline" },
              }}
            >
              Resend OTP
            </Link>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, pt: 0 }}>
          <Button
            onClick={() => setOtpModalOpen(false)}
            disabled={buttonLoading}
            sx={{ textTransform: "none", color: "#64748B" }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleOtpVerify}
            disabled={buttonLoading || otp.length !== 6}
            sx={{
              textTransform: "none",
              fontWeight: 600,
              bgcolor: "#2562E9",
              "&:hover": { bgcolor: "#1D4ED8" },
            }}
          >
            Verify
          </Button>
        </DialogActions>
      </Dialog>

      <ToastContainer position="top-right" autoClose={3000} theme="colored" />
    </Box>
  );
}
