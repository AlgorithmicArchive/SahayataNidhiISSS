import React, { useContext, useState, useEffect, useCallback } from "react";
import {
  Typography,
  Button,
  Box,
  CircularProgress,
  Alert,
} from "@mui/material";
import CustomInputField from "../../components/form/CustomInputField";
import { useForm } from "react-hook-form";
import CustomButton from "../../components/CustomButton";
import { useNavigate, useLocation } from "react-router-dom";
import { Validate } from "../../assets/fetch"; // ← Consider updating this helper to use API_BASE too
import { UserContext } from "../../UserContext";
import { jwtDecode } from "jwt-decode";

export default function Verification() {
  const API_BASE = window.__CONFIG__?.API_URL || ""; // fallback to empty string

  const [selectedOption, setSelectedOption] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [otpMessage, setOtpMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [processingSSO, setProcessingSSO] = useState(true);
  const [ssoError, setSsoError] = useState(null);
  const [hasAttemptedSSO, setHasAttemptedSSO] = useState(false);
  const [usernameFromURL, setUsernameFromURL] = useState(null);
  const [redirecting, setRedirecting] = useState(false);
  const [isCitizenFlow, setIsCitizenFlow] = useState(false);

  const {
    handleSubmit,
    control,
    formState: { errors },
    reset,
  } = useForm();

  const {
    setVerified,
    userType,
    setUserType,
    username,
    setUsername,
    setToken,
    setProfile,
    setDesignation,
    setDepartment,
    setUserId,
    setActualUserType,
    token,
    verified,
  } = useContext(UserContext);

  const navigate = useNavigate();
  const location = useLocation();

  // Parse URL parameters for username
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const usernameParam = params.get("username");
    if (usernameParam) {
      setUsernameFromURL(usernameParam);
      if (!username) {
        setUsername(usernameParam);
        sessionStorage.setItem("username", usernameParam);
      }
    }
  }, [location.search, username, setUsername]);

  // Get current username from available sources
  const getCurrentUsername = useCallback(() => {
    return username || usernameFromURL || sessionStorage.getItem("username");
  }, [username, usernameFromURL]);

  // Redirect function
  const redirectBasedOnUserType = useCallback(
    (userType) => {
      const normalizedType = userType?.toLowerCase();
      let redirectPath = "/";
      switch (normalizedType) {
        case "admin":
          redirectPath = "/admin/home";
          break;
        case "officer":
          redirectPath = "/officer/home";
          break;
        case "designer":
          redirectPath = "/designer/dashboard";
          break;
        case "viewer":
          redirectPath = "/viewer/home";
          break;
        case "citizen":
          redirectPath = "/user/home";
          break;
        default:
          redirectPath = "/";
      }
      setRedirecting(true);
      navigate(redirectPath, { replace: true });
    },
    [navigate]
  );

  // Process SSO data from URL
  const processSSO = useCallback(async () => {
    try {
      const params = new URLSearchParams(location.search);
      const ssoParam = params.get("sso");
      if (!ssoParam) {
        setProcessingSSO(false);
        setHasAttemptedSSO(true);
        return;
      }

      setIsLoading(true);
      setHasAttemptedSSO(true);

      const decodedParam = decodeURIComponent(ssoParam);
      const ssoData = JSON.parse(decodedParam);

      if (!ssoData.status || !ssoData.token) {
        throw new Error("Invalid SSO data format");
      }

      const decodedToken = jwtDecode(ssoData.token);
      const currentTime = Date.now() / 1000;
      if (decodedToken.exp && decodedToken.exp < currentTime) {
        throw new Error("Token has expired");
      }

      // Store in sessionStorage
      sessionStorage.setItem("token", ssoData.token);
      sessionStorage.setItem("userType", ssoData.userType);
      sessionStorage.setItem("username", ssoData.username);
      sessionStorage.setItem("userId", ssoData.userId?.toString() || "");
      sessionStorage.setItem("profile", ssoData.profile || "");
      sessionStorage.setItem("designation", ssoData.designation || "");
      sessionStorage.setItem("department", ssoData.department || "");
      sessionStorage.setItem(
        "actualUserType",
        ssoData.actualUserType || ssoData.userType
      );
      sessionStorage.setItem("verified", "true");

      // Update context
      setToken(ssoData.token);
      setUserType(ssoData.userType);
      setUsername(ssoData.username);
      setUserId(ssoData.userId);
      setProfile(ssoData.profile || "");
      setDesignation(ssoData.designation || "");
      setDepartment(ssoData.department || "");
      setActualUserType(ssoData.actualUserType || ssoData.userType);
      setVerified(true);

      // Clear URL parameters
      window.history.replaceState({}, document.title, "/verification");

      // Redirect
      redirectBasedOnUserType(ssoData.userType);
    } catch (error) {
      console.error("SSO processing error:", error);
      setSsoError("Failed to process login. Please try again.");
      setProcessingSSO(false);
    } finally {
      setIsLoading(false);
    }
  }, [
    location.search,
    setToken,
    setUserType,
    setUsername,
    setUserId,
    setProfile,
    setDesignation,
    setDepartment,
    setActualUserType,
    setVerified,
    redirectBasedOnUserType,
  ]);

  // Process SSO on mount
  useEffect(() => {
    if (!hasAttemptedSSO) {
      processSSO();
    }
  }, [hasAttemptedSSO, processSSO]);

  // Check for existing session
  useEffect(() => {
    const checkExistingSession = () => {
      const storedToken = sessionStorage.getItem("token");
      const storedVerified = sessionStorage.getItem("verified") === "true";
      const storedUserType = sessionStorage.getItem("userType");

      if (storedToken && storedVerified && storedUserType && !token) {
        setToken(storedToken);
        setUserType(storedUserType);
        setUsername(sessionStorage.getItem("username") || "");
        setVerified(true);
        redirectBasedOnUserType(storedUserType);
        return true;
      }
      return false;
    };

    if (!hasAttemptedSSO) {
      checkExistingSession();
    }
  }, [
    hasAttemptedSSO,
    setToken,
    setUserType,
    setUsername,
    setVerified,
    token,
    redirectBasedOnUserType,
  ]);

  // Determine user type and setup Citizen flow if needed
  useEffect(() => {
    if (!processingSSO && !ssoError && !selectedOption) {
      const currentUsername = getCurrentUsername();
      const currentUserType = userType || sessionStorage.getItem("userType");
      const normalizedUserType = currentUserType?.toLowerCase();

      if (normalizedUserType === "citizen" && currentUsername && !token) {
        setIsCitizenFlow(true);
        handleOptionSelect("otp");
      }
    }
  }, [
    processingSSO,
    ssoError,
    selectedOption,
    userType,
    token,
    getCurrentUsername,
  ]);

  const handleOptionSelect = async (option) => {
    const currentUsername = getCurrentUsername();
    if (!currentUsername) {
      setErrorMessage("Username not found. Please login again.");
      return;
    }

    setErrorMessage("");
    setOtpMessage("");
    setSelectedOption(option);

    if (option === "otp") {
      setIsSendingOtp(true);
      try {
        const response = await fetch(
          `${API_BASE}/Home/SendLoginOtp?username=${encodeURIComponent(
            currentUsername
          )}`
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.status) {
          setOtpMessage(
            data.message ||
            "OTP sent to your registered email and mobile."
          );
        } else {
          const errorMsg = data.message || "Failed to send OTP.";
          setErrorMessage(errorMsg);
          if (
            errorMsg.toLowerCase().includes("not found") ||
            errorMsg.toLowerCase().includes("not available") ||
            errorMsg.toLowerCase().includes("failed")
          ) {
            setOtpMessage(errorMsg);
          }
        }
      } catch (error) {
        console.error("Error sending OTP:", error);
        setErrorMessage(
          "Network error. Please check your connection and try again."
        );
      } finally {
        setIsSendingOtp(false);
      }
    }
  };

  const handleBack = () => {
    setSelectedOption(null);
    setErrorMessage("");
    setOtpMessage("");
    reset({
      otp: "",
      backupCode: "",
    });
    setIsCitizenFlow(false);
  };

  const onSubmit = async (data) => {
    const currentUsername = getCurrentUsername();
    if (!currentUsername) {
      setErrorMessage("Session expired. Please login again.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const formData = new FormData();
      formData.append("username", currentUsername);

      if (selectedOption === "otp") {
        formData.append("otp", data.otp);
      } else {
        formData.append("backupCode", data.backupCode);
      }

      // If Validate is using relative path → update it in ../../assets/fetch too
      const response = await Validate(formData);

      if (response.status) {
        if (response.token) {
          sessionStorage.setItem("token", response.token);
          setToken(response.token);
        }
        if (response.userType) {
          sessionStorage.setItem("userType", response.userType);
          setUserType(response.userType);
        }
        if (response.username) {
          sessionStorage.setItem("username", response.username);
          setUsername(response.username);
        }
        if (response.userId) {
          sessionStorage.setItem("userId", response.userId.toString());
          setUserId(response.userId);
        }
        if (response.actualUserType) {
          sessionStorage.setItem("actualUserType", response.actualUserType);
          setActualUserType(response.actualUserType);
        }

        sessionStorage.setItem("verified", "true");
        setVerified(true);

        redirectBasedOnUserType(response.userType);
      } else {
        setErrorMessage(response.message || "Verification failed. Please try again.");
      }
    } catch (error) {
      console.error("Verification error:", error);
      setErrorMessage("An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resendOtp = async () => {
    const currentUsername = getCurrentUsername();
    if (!currentUsername) {
      setErrorMessage("Username not found. Please login again.");
      return;
    }

    setIsSendingOtp(true);
    setErrorMessage("");
    setOtpMessage("");

    try {
      const response = await fetch(
        `${API_BASE}/Home/SendLoginOtp?username=${encodeURIComponent(
          currentUsername
        )}`
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.status) {
        setOtpMessage(
          data.message ||
          "OTP sent to your registered email and mobile."
        );
      } else {
        const errorMsg = data.message || "Failed to send OTP.";
        setErrorMessage(errorMsg);
        if (
          errorMsg.toLowerCase().includes("not found") ||
          errorMsg.toLowerCase().includes("not available") ||
          errorMsg.toLowerCase().includes("failed")
        ) {
          setOtpMessage(errorMsg);
        }
      }
    } catch (error) {
      console.error("Error resending OTP:", error);
      setErrorMessage("Network error. Please try again.");
    } finally {
      setIsSendingOtp(false);
    }
  };

  // Show loading while processing
  if (isLoading || redirecting) {
    return (
      <Box
        sx={{
          width: "100vw",
          height: "80vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          flexDirection: "column",
          gap: 3,
          bgcolor: "background.default",
        }}
      >
        <CircularProgress size={60} thickness={4} sx={{ color: "primary.main" }} />
        <Typography variant="h6" color="text.primary" fontWeight="medium">
          {redirecting ? "Redirecting..." : "Completing your login..."}
        </Typography>
      </Box>
    );
  }

  // Show SSO error if any
  if (ssoError) {
    return (
      <Box
        sx={{
          width: "100vw",
          height: "80vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          flexDirection: "column",
          gap: 3,
          p: 3,
          bgcolor: "background.default",
        }}
      >
        <Alert severity="error" sx={{ width: "100%", maxWidth: 500 }}>
          {ssoError}
        </Alert>
        <Button
          variant="contained"
          onClick={() => navigate("/login")}
          sx={{
            bgcolor: "primary.main",
            "&:hover": { bgcolor: "primary.dark" },
            px: 4,
            py: 1.5,
            borderRadius: 2,
            textTransform: "none",
            fontWeight: "bold",
          }}
        >
          Go to Login
        </Button>
      </Box>
    );
  }

  // If already verified and has token, show redirecting
  if (token && verified) {
    useEffect(() => {
      if (userType && !redirecting) {
        redirectBasedOnUserType(userType);
      }
    }, [userType, redirecting, redirectBasedOnUserType]);

    return (
      <Box
        sx={{
          width: "100vw",
          height: "80vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          flexDirection: "column",
          gap: 3,
          bgcolor: "background.default",
        }}
      >
        <CircularProgress size={60} thickness={4} sx={{ color: "primary.main" }} />
        <Typography variant="h6" color="text.primary" fontWeight="medium">
          Redirecting...
        </Typography>
      </Box>
    );
  }

  // Get current username for display
  const displayUsername = getCurrentUsername();

  // If no username found and SSO processing is done
  if (!displayUsername && !processingSSO && hasAttemptedSSO) {
    return (
      <Box
        sx={{
          width: "100vw",
          height: "80vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          flexDirection: "column",
          gap: 3,
          bgcolor: "background.default",
        }}
      >
        <Alert severity="info" sx={{ width: "100%", maxWidth: 500 }}>
          No login session found. Please login first.
        </Alert>
        <Button
          variant="contained"
          onClick={() => navigate("/login")}
          sx={{
            bgcolor: "primary.main",
            "&:hover": { bgcolor: "primary.dark" },
            px: 4,
            py: 1.5,
            borderRadius: 2,
            textTransform: "none",
            fontWeight: "bold",
          }}
        >
          Go to Login
        </Button>
      </Box>
    );
  }

  const renderVerificationUI = () => {
    // Citizen flow – OTP only
    if (userType?.toLowerCase() === "citizen" || isCitizenFlow) {
      useEffect(() => {
        if (!otpMessage && !isSendingOtp && !selectedOption) {
          handleOptionSelect("otp");
        }
      }, [otpMessage, isSendingOtp, selectedOption]);

      return (
        <Box
          sx={{
            width: "100%",
            maxWidth: 450,
            bgcolor: "background.paper",
            p: { xs: 3, sm: 4 },
            borderRadius: 3,
            boxShadow: 3,
            display: "flex",
            flexDirection: "column",
            gap: 3,
          }}
        >
          {isSendingOtp && (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 2,
                py: 1,
              }}
            >
              <CircularProgress size={24} sx={{ color: "primary.main" }} />
              <Typography variant="body2" color="text.secondary">
                Sending OTP...
              </Typography>
            </Box>
          )}

          {otpMessage && (
            <Alert
              severity={
                otpMessage.includes("not") || otpMessage.includes("failed")
                  ? "warning"
                  : "info"
              }
              sx={{ width: "100%" }}
            >
              {otpMessage}
            </Alert>
          )}

          <CustomInputField
            label="Enter 7-digit OTP"
            name="otp"
            placeholder="Enter OTP"
            type="text"
            control={control}
            rules={{
              required: "OTP is required",
              pattern: {
                value: /^[0-9]{7}$/,
                message: "OTP must be exactly 7 digits",
              },
            }}
            errors={errors}
            disabled={isSubmitting || isSendingOtp}
            fullWidth
          />

          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <CustomButton
              text={isSubmitting ? "Verifying..." : "Verify OTP"}
              onClick={handleSubmit(onSubmit)}
              bgColor="primary.main"
              color="white"
              width="100%"
              disabled={isSubmitting || isSendingOtp}
              startIcon={
                isSubmitting && <CircularProgress size={20} color="inherit" />
              }
              sx={{
                py: 1.5,
                borderRadius: 2,
                fontWeight: "bold",
              }}
            />

            <Box
              sx={{
                display: "flex",
                gap: 2,
                justifyContent: "space-between",
                flexDirection: { xs: "column", sm: "row" },
              }}
            >
              <Button
                variant="outlined"
                onClick={resendOtp}
                disabled={isSendingOtp}
                sx={{
                  color: "primary.main",
                  borderColor: "primary.main",
                  borderRadius: 2,
                  textTransform: "none",
                  flex: 1,
                  py: 1,
                }}
                startIcon={isSendingOtp && <CircularProgress size={16} />}
              >
                {isSendingOtp ? "Sending..." : "Resend OTP"}
              </Button>

              <Button
                variant="text"
                onClick={() => navigate("/login")}
                sx={{
                  color: "text.secondary",
                  borderRadius: 2,
                  textTransform: "none",
                  flex: 1,
                  py: 1,
                }}
              >
                Back to Login
              </Button>
            </Box>
          </Box>
        </Box>
      );
    }

    // Non-Citizen flows
    if (selectedOption === "otp") {
      return (
        <Box
          sx={{
            width: "100%",
            maxWidth: 450,
            bgcolor: "background.paper",
            p: { xs: 3, sm: 4 },
            borderRadius: 3,
            boxShadow: 3,
            display: "flex",
            flexDirection: "column",
            gap: 3,
          }}
        >
          <Typography variant="h6" color="text.primary" fontWeight="medium">
            OTP Verification
          </Typography>

          {isSendingOtp && (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 2,
                py: 1,
              }}
            >
              <CircularProgress size={20} sx={{ color: "primary.main" }} />
              <Typography variant="body2">Sending OTP...</Typography>
            </Box>
          )}

          {otpMessage && (
            <Alert
              severity={
                otpMessage.includes("not") || otpMessage.includes("failed")
                  ? "warning"
                  : "info"
              }
              sx={{ width: "100%" }}
            >
              {otpMessage}
            </Alert>
          )}

          <CustomInputField
            label="Enter 7-digit OTP sent to your email/mobile"
            name="otp"
            placeholder="Enter OTP"
            type="text"
            control={control}
            rules={{
              required: "OTP is required",
              pattern: {
                value: /^[0-9]{7}$/,
                message: "OTP must be exactly 7 digits",
              },
            }}
            errors={errors}
            disabled={isSubmitting || isSendingOtp}
            fullWidth
          />

          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <CustomButton
              text={isSubmitting ? "Verifying..." : "Verify"}
              onClick={handleSubmit(onSubmit)}
              bgColor="primary.main"
              color="white"
              width="100%"
              disabled={isSubmitting || isSendingOtp}
              startIcon={
                isSubmitting && <CircularProgress size={20} color="inherit" />
              }
              sx={{
                py: 1.5,
                borderRadius: 2,
                fontWeight: "bold",
              }}
            />

            <Box
              sx={{
                display: "flex",
                gap: 2,
                justifyContent: "space-between",
                flexDirection: { xs: "column", sm: "row" },
              }}
            >
              <Button
                variant="outlined"
                onClick={resendOtp}
                disabled={isSendingOtp}
                sx={{
                  color: "primary.main",
                  borderColor: "primary.main",
                  borderRadius: 2,
                  textTransform: "none",
                  flex: 1,
                  py: 1,
                }}
                startIcon={isSendingOtp && <CircularProgress size={16} />}
              >
                {isSendingOtp ? "Sending..." : "Resend OTP"}
              </Button>

              <Button
                variant="text"
                onClick={handleBack}
                sx={{
                  color: "text.secondary",
                  borderRadius: 2,
                  textTransform: "none",
                  flex: 1,
                  py: 1,
                }}
              >
                Back
              </Button>
            </Box>
          </Box>
        </Box>
      );
    }

    if (selectedOption === "backup") {
      return (
        <Box
          sx={{
            width: "100%",
            maxWidth: 450,
            bgcolor: "background.paper",
            p: { xs: 3, sm: 4 },
            borderRadius: 3,
            boxShadow: 3,
            display: "flex",
            flexDirection: "column",
            gap: 3,
          }}
        >
          <Typography variant="h6" color="text.primary" fontWeight="medium">
            Backup Code
          </Typography>

          <CustomInputField
            label="Enter your backup code"
            name="backupCode"
            placeholder="Enter backup code"
            type="text"
            control={control}
            rules={{
              required: "Backup code is required",
            }}
            errors={errors}
            disabled={isSubmitting}
            fullWidth
          />

          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <CustomButton
              text={isSubmitting ? "Verifying..." : "Verify"}
              onClick={handleSubmit(onSubmit)}
              bgColor="primary.main"
              color="white"
              width="100%"
              disabled={isSubmitting}
              startIcon={
                isSubmitting && <CircularProgress size={20} color="inherit" />
              }
              sx={{
                py: 1.5,
                borderRadius: 2,
                fontWeight: "bold",
              }}
            />

            <Box sx={{ display: "flex", gap: 2, justifyContent: "center" }}>
              <Button
                variant="text"
                onClick={handleBack}
                sx={{
                  color: "text.secondary",
                  borderRadius: 2,
                  textTransform: "none",
                  flex: 1,
                  py: 1,
                }}
              >
                Back
              </Button>
            </Box>
          </Box>
        </Box>
      );
    }

    // Option selection screen (non-citizen)
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: 2,
          width: "100%",
          maxWidth: 400,
        }}
      >
        <Button
          variant="contained"
          onClick={() => handleOptionSelect("otp")}
          sx={{
            bgcolor: "primary.main",
            color: "white",
            borderRadius: 2,
            fontWeight: "bold",
            textTransform: "none",
            py: 2,
            fontSize: "1rem",
            "&:hover": { bgcolor: "primary.dark" },
          }}
        >
          Verify with OTP
        </Button>

        <Button
          variant="outlined"
          onClick={() => handleOptionSelect("backup")}
          sx={{
            bgcolor: "background.paper",
            color: "primary.main",
            borderColor: "primary.main",
            borderRadius: 2,
            fontWeight: "bold",
            textTransform: "none",
            py: 2,
            fontSize: "1rem",
            "&:hover": {
              bgcolor: "primary.light",
              borderColor: "primary.dark",
              color: "primary.dark",
            },
          }}
        >
          Use Backup Code
        </Button>
      </Box>
    );
  };

  // Main render
  return (
    <Box
      sx={{
        width: "100vw",
        minHeight: "80vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
        gap: 3,
        p: 3,
        bgcolor: "background.default",
      }}
    >
      <Typography
        variant="h4"
        component="h1"
        sx={{
          fontWeight: "bold",
          color: "text.primary",
          textAlign: "center",
          mb: 2,
        }}
      >
        {isCitizenFlow ? "OTP Verification" : "Verification Required"}
      </Typography>

      {displayUsername && (
        <Typography
          variant="body1"
          color="text.secondary"
          sx={{ textAlign: "center", mb: 4, maxWidth: 500 }}
        >
          Hello <strong>{displayUsername}</strong>,{" "}
          {isCitizenFlow
            ? "please enter the OTP sent to your registered email and mobile number."
            : "please choose a verification method to continue."}
        </Typography>
      )}

      {renderVerificationUI()}

      {errorMessage && !selectedOption && (
        <Alert severity="error" sx={{ mt: 2, width: "100%", maxWidth: 450 }}>
          {errorMessage}
        </Alert>
      )}
    </Box>
  );
}