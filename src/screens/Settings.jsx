import React, { useContext, useEffect, useRef, useState } from "react";
import {
  Box,
  Divider,
  Typography,
  Avatar,
  CircularProgress,
  Tooltip,
  TextField,
  Button,
  InputAdornment,
  IconButton,
  Paper,
  Container,
} from "@mui/material";
import {
  CheckCircle,
  Cancel,
  Visibility,
  VisibilityOff,
  PhotoCamera,
  Save,
  Refresh,
  Shield,
  Person,
  Lock,
} from "@mui/icons-material";
import axiosInstance from "../axiosConfig";
import { UserContext } from "../UserContext";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export default function Settings() {
  const { setProfile, userType } = useContext(UserContext);
  const [userDetails, setUserDetails] = useState({
    name: "",
    username: "",
    email: "",
    mobileNumber: "",
    profile: "",
    ageProof: "",
  });
  const [used, setUsed] = useState([]);
  const [unused, setUnused] = useState([]);
  const [save, setSave] = useState(false);
  const [profile, setLocalProfile] = useState({ file: null, url: "" });
  const [ageProof, setAgeProof] = useState({ file: null });
  const [loading, setLoading] = useState(true);
  const [buttonLoading, setButtonLoading] = useState(false);
  const [passwordSave, setPasswordSave] = useState(false);
  const [passwordFields, setPasswordFields] = useState({
    CurrentPassword: "",
    NewPassword: "",
    ConfirmNewPassword: "",
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const profileRef = useRef(null);
  const ageProofRef = useRef(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setUserDetails((prev) => ({ ...prev, [name]: value }));
    setSave(true);
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordFields((prev) => ({ ...prev, [name]: value }));
    setPasswordSave(true);
  };

  const togglePasswordVisibility = (field) => {
    switch (field) {
      case "current":
        setShowCurrentPassword(!showCurrentPassword);
        break;
      case "new":
        setShowNewPassword(!showNewPassword);
        break;
      case "confirm":
        setShowConfirmPassword(!showConfirmPassword);
        break;
      default:
        break;
    }
  };

  const validatePasswords = () => {
    if (!passwordFields.CurrentPassword) {
      toast.error("Current password is required.", {
        position: "top-center",
        autoClose: 3000,
        theme: "colored",
      });
      return false;
    }
    if (passwordFields.NewPassword !== passwordFields.ConfirmNewPassword) {
      toast.error("New password and confirm password do not match.", {
        position: "top-center",
        autoClose: 3000,
        theme: "colored",
      });
      return false;
    }
    if (passwordFields.NewPassword.length < 8) {
      toast.error("New password must be at least 8 characters long.", {
        position: "top-center",
        autoClose: 3000,
        theme: "colored",
      });
      return false;
    }
    return true;
  };

  const handleProfileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        toast.error("Please select an image file.", {
          position: "top-center",
          autoClose: 3000,
          theme: "colored",
        });
        return;
      }
      const imageUrl = URL.createObjectURL(file);
      setLocalProfile({ file, url: imageUrl });
      setSave(true);
      toast.info("Profile image selected. Click Save to update.", {
        position: "top-center",
        autoClose: 2000,
        theme: "colored",
      });
    }
  };

  const handleAgeProofChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.type !== "application/pdf") {
        toast.error("Please select a PDF file for Proof of Age.", {
          position: "top-center",
          autoClose: 3000,
          theme: "colored",
        });
        return;
      }
      if (file.size < 100 * 1024 || file.size > 200 * 1024) {
        toast.error("File size must be between 100KB and 200KB.", {
          position: "top-center",
          autoClose: 3000,
          theme: "colored",
        });
        return;
      }
      setAgeProof({ file });
      setSave(true);
      toast.info("Proof of Age selected. Click Save to update.", {
        position: "top-center",
        autoClose: 2000,
        theme: "colored",
      });
    }
  };

  const handleSaveProfile = async () => {
    setButtonLoading(true);
    try {
      const formData = new FormData();
      formData.append("name", userDetails.name);
      formData.append("username", userDetails.username);
      formData.append("email", userDetails.email);
      formData.append("mobileNumber", userDetails.mobileNumber);
      if (profile.file) formData.append("profile", profile.file);
      if (ageProof.file) formData.append("ageProof", ageProof.file);

      const response = await axiosInstance.post(
        "/Profile/UpdateUserDetails",
        formData,
      );
      if (response.data.isValid) {
        setProfile(response.data.profile);
        setLocalProfile({ file: null, url: response.data.profile || "" });
        setAgeProof({ file: null });
        setUserDetails({
          name: response.data.name || "",
          username: response.data.username || "",
          email: response.data.email || "",
          mobileNumber: response.data.mobileNumber || "",
          profile: response.data.profile || "",
          ageProof: response.data.ageProof || "",
        });
        setSave(false);
        if (profileRef.current) profileRef.current.value = "";
        if (ageProofRef.current) ageProofRef.current.value = "";
        toast.success("User details updated successfully!", {
          position: "top-center",
          autoClose: 2000,
          theme: "colored",
        });
      } else {
        throw new Error(
          response.data.errorMessage || "Failed to update user details.",
        );
      }
    } catch (error) {
      toast.error("Failed to update user details. Please try again.", {
        position: "top-center",
        autoClose: 3000,
        theme: "colored",
      });
    } finally {
      setButtonLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!validatePasswords()) return;
    setButtonLoading(true);
    try {
      const formData = new FormData();
      formData.append("CurrentPassword", passwordFields.CurrentPassword);
      formData.append("NewPassword", passwordFields.NewPassword);
      formData.append("ConfirmNewPassword", passwordFields.ConfirmNewPassword);

      const response = await axiosInstance.post(
        "/Profile/ChangePassword",
        formData,
      );
      if (response.data.status) {
        setPasswordFields({
          CurrentPassword: "",
          NewPassword: "",
          ConfirmNewPassword: "",
        });
        setPasswordSave(false);
        setShowCurrentPassword(false);
        setShowNewPassword(false);
        setShowConfirmPassword(false);
        toast.success("Password changed successfully!", {
          position: "top-center",
          autoClose: 2000,
          theme: "colored",
        });
      } else {
        throw new Error(response.data.response || "Failed to change password.");
      }
    } catch (error) {
      toast.error(
        error.response?.data?.response ||
          "Failed to change password. Please try again.",
        { position: "top-center", autoClose: 3000, theme: "colored" },
      );
    } finally {
      setButtonLoading(false);
    }
  };

  const handleNewCodes = async () => {
    setButtonLoading(true);
    try {
      const response = await axiosInstance.get("/Profile/GenerateBackupCodes");
      if (response.data.status) {
        toast.success("New backup codes generated successfully!", {
          position: "top-center",
          autoClose: 2000,
          theme: "colored",
        });
        await GetUserDetails();
      } else {
        throw new Error(
          response.data.errorMessage || "Failed to generate codes",
        );
      }
    } catch (error) {
      toast.error("Failed to generate backup codes. Please try again.", {
        position: "top-center",
        autoClose: 3000,
        theme: "colored",
      });
    } finally {
      setButtonLoading(false);
    }
  };

  async function GetUserDetails() {
    setLoading(true);
    try {
      const response = await axiosInstance.get("/Profile/GetUserDetails");
      if (response.data) {
        setUserDetails({
          name: response.data.name || "",
          username: response.data.username || "",
          email: response.data.email || "",
          mobileNumber: response.data.mobileNumber || "",
          profile: response.data.profile || "",
          ageProof: response.data.ageProof || "",
        });
        setLocalProfile({ file: null, url: response.data.profile || "" });
        setAgeProof({ file: null });
        const backupCodes = JSON.parse(
          response.data.backupCodes || '{"used":[],"unused":[]}',
        );
        setUsed(backupCodes.used || []);
        setUnused(backupCodes.unused || []);
      }
    } catch (error) {
      toast.error("Failed to load settings. Please try again.", {
        position: "top-center",
        autoClose: 3000,
        theme: "colored",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    GetUserDetails();
  }, []);

  // Shared styling for read-only fields
  const readOnlySx = {
    "& .MuiOutlinedInput-root": {
      bgcolor: "#F8FAFC",
      "& fieldset": { borderColor: "#E2E8F0" },
      "&:hover fieldset": { borderColor: "#CBD5E1" },
    },
    "& .MuiInputBase-input.Mui-readOnly": {
      color: "#334155",
      fontWeight: 500,
    },
  };

  if (loading) {
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
        <CircularProgress sx={{ color: "#2562E9" }} />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "#F8FAFC",
        py: { xs: 4, md: 8 },
        px: 2,
      }}
    >
      <Container maxWidth="md" sx={{ px: { xs: 0, sm: 2 } }}>
        <Paper
          elevation={0}
          sx={{
            width: "100%",
            bgcolor: "#FFFFFF",
            border: "1px solid #E2E8F0",
            borderRadius: 3,
            overflow: "hidden",
          }}
          role="main"
          aria-labelledby="settings-title"
        >
          {/* Header Section */}
          <Box
            sx={{
              p: { xs: 3, md: 4 },
              borderBottom: "1px solid #E2E8F0",
              bgcolor: "#F8FAFC",
            }}
          >
            <Typography
              variant="h5"
              component="h1"
              id="settings-title"
              sx={{
                fontWeight: 700,
                color: "primary.dark",
                display: "flex",
                alignItems: "center",
                gap: 1,
              }}
            >
              <Person sx={{ color: "#2562E9" }} />
              Account Settings
            </Typography>
            <Typography variant="body2" sx={{ color: "#64748B", mt: 0.5 }}>
              Manage your profile information and security preferences.
            </Typography>
          </Box>

          <Box sx={{ p: { xs: 3, md: 4 } }}>
            {/* Profile Image Section */}
            <Box sx={{ mb: 4 }}>
              <Typography
                variant="h6"
                sx={{ fontWeight: 600, color: "#0F172A", mb: 2 }}
              >
                Profile Picture
              </Typography>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                  flexWrap: "wrap",
                }}
              >
                <Tooltip title="Profile Picture" arrow>
                  <Avatar
                    src={
                      profile.file
                        ? profile.url
                        : profile.url
                          ? `/Base/DisplayFile?fileName=${profile.url}`
                          : ""
                    }
                    alt={`${userDetails?.name || "User"}'s profile picture`}
                    sx={{
                      width: 100,
                      height: 100,
                      bgcolor: "#E2E8F0",
                      border: "3px solid #FFFFFF",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                    }}
                  />
                </Tooltip>
                <Box sx={{ flex: 1, minWidth: 200 }}>
                  <Typography variant="body2" sx={{ color: "#64748B", mb: 2 }}>
                    Upload a new photo to update your profile. Accepted formats:
                    JPG, PNG.
                  </Typography>
                  <input
                    type="file"
                    ref={profileRef}
                    hidden
                    onChange={handleProfileChange}
                    accept="image/*"
                    aria-label="Upload profile image"
                  />
                  {!save ? (
                    <Button
                      variant="outlined"
                      startIcon={<PhotoCamera />}
                      onClick={() => profileRef.current?.click()}
                      sx={{
                        textTransform: "none",
                        borderColor: "#CBD5E1",
                        color: "#334155",
                        "&:hover": {
                          borderColor: "#2562E9",
                          color: "#2562E9",
                          bgcolor: "#F8FAFC",
                        },
                      }}
                    >
                      Change Image
                    </Button>
                  ) : (
                    <Button
                      variant="contained"
                      startIcon={
                        buttonLoading ? (
                          <CircularProgress size={18} color="inherit" />
                        ) : (
                          <Save />
                        )
                      }
                      onClick={handleSaveProfile}
                      disabled={buttonLoading}
                      sx={{
                        bgcolor: "#2562E9",
                        color: "#FFF",
                        textTransform: "none",
                        "&:hover": { bgcolor: "#1D4ED8" },
                      }}
                    >
                      Save Changes
                    </Button>
                  )}
                </Box>
              </Box>
            </Box>

            <Divider sx={{ my: 4, borderColor: "#E2E8F0" }} />

            {/* User Details Section */}
            <Box sx={{ mb: 4 }}>
              <Typography
                variant="h6"
                sx={{ fontWeight: 600, color: "#0F172A", mb: 1 }}
              >
                Personal Information
              </Typography>
              <Typography variant="body2" sx={{ color: "#94A3B8", mb: 3 }}>
                These details are linked to your official account and cannot be
                edited here.
              </Typography>

              <Box
                sx={{
                  display: "grid",
                  gap: 2.5,
                  gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                }}
              >
                <TextField
                  label="Name"
                  name="name"
                  value={userDetails.name}
                  onChange={handleInputChange}
                  InputProps={{ readOnly: true }}
                  fullWidth
                  variant="outlined"
                  sx={readOnlySx}
                />
                <TextField
                  label="Username"
                  name="username"
                  value={userDetails.username}
                  onChange={handleInputChange}
                  InputProps={{ readOnly: true }}
                  fullWidth
                  variant="outlined"
                  sx={readOnlySx}
                />
                <TextField
                  label="Email"
                  name="email"
                  value={userDetails.email}
                  onChange={handleInputChange}
                  InputProps={{ readOnly: true }}
                  fullWidth
                  variant="outlined"
                  sx={readOnlySx}
                />
                <TextField
                  label="Mobile Number"
                  name="mobileNumber"
                  value={userDetails.mobileNumber}
                  onChange={handleInputChange}
                  InputProps={{ readOnly: true }}
                  fullWidth
                  variant="outlined"
                  sx={readOnlySx}
                />
              </Box>
            </Box>

            {/* Backup Codes Section (Non-Citizens Only) */}
            {userType !== "Citizen" && (
              <>
                <Divider sx={{ my: 4, borderColor: "#E2E8F0" }} />
                <Box>
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
                    <Box>
                      <Typography
                        variant="h6"
                        sx={{
                          fontWeight: 600,
                          color: "#0F172A",
                          display: "flex",
                          alignItems: "center",
                          gap: 1,
                        }}
                      >
                        <Shield sx={{ color: "#F59E0B" }} />
                        Backup Codes
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{ color: "#64748B", mt: 0.5 }}
                      >
                        Use these codes to log in if you lose access to your
                        primary device.
                      </Typography>
                    </Box>
                    <Button
                      variant="outlined"
                      startIcon={
                        buttonLoading ? (
                          <CircularProgress size={18} />
                        ) : (
                          <Refresh />
                        )
                      }
                      onClick={handleNewCodes}
                      disabled={buttonLoading}
                      sx={{
                        textTransform: "none",
                        borderColor: "#CBD5E1",
                        color: "#334155",
                        "&:hover": {
                          borderColor: "#F59E0B",
                          color: "#F59E0B",
                          bgcolor: "#FFFBEB",
                        },
                      }}
                    >
                      Generate New Codes
                    </Button>
                  </Box>

                  {unused.length === 0 && used.length === 0 ? (
                    <Box
                      sx={{
                        p: 3,
                        bgcolor: "#F8FAFC",
                        borderRadius: 2,
                        textAlign: "center",
                        border: "1px dashed #CBD5E1",
                      }}
                    >
                      <Typography sx={{ color: "#64748B" }}>
                        No backup codes available. Generate new codes to secure
                        your account.
                      </Typography>
                    </Box>
                  ) : (
                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: {
                          xs: "repeat(2, 1fr)",
                          sm: "repeat(3, 1fr)",
                          md: "repeat(4, 1fr)",
                        },
                        gap: 1.5,
                      }}
                    >
                      {unused.map((code, index) => (
                        <Tooltip
                          key={`unused-${index}`}
                          title="Unused backup code"
                          arrow
                        >
                          <Box
                            sx={{
                              p: 1.5,
                              bgcolor: "#F0FDF4",
                              border: "1px solid #BBF7D0",
                              borderRadius: 2,
                              display: "flex",
                              alignItems: "center",
                              gap: 1,
                              fontFamily: "monospace",
                              fontWeight: 600,
                              fontSize: "0.95rem",
                              color: "#166534",
                              transition: "all 0.2s",
                              "&:hover": {
                                transform: "translateY(-2px)",
                                boxShadow: "0 4px 8px rgba(0,0,0,0.05)",
                              },
                            }}
                          >
                            <CheckCircle
                              sx={{ fontSize: 18, color: "#22C55E" }}
                            />
                            {code}
                          </Box>
                        </Tooltip>
                      ))}
                      {used.map((code, index) => (
                        <Tooltip
                          key={`used-${index}`}
                          title="Used backup code"
                          arrow
                        >
                          <Box
                            sx={{
                              p: 1.5,
                              bgcolor: "#F8FAFC",
                              border: "1px solid #E2E8F0",
                              borderRadius: 2,
                              display: "flex",
                              alignItems: "center",
                              gap: 1,
                              fontFamily: "monospace",
                              fontWeight: 500,
                              fontSize: "0.95rem",
                              color: "#94A3B8",
                              textDecoration: "line-through",
                            }}
                          >
                            <Cancel sx={{ fontSize: 18, color: "#CBD5E1" }} />
                            {code}
                          </Box>
                        </Tooltip>
                      ))}
                    </Box>
                  )}
                </Box>
              </>
            )}

            {/* Change Password Section */}
            <Box
              sx={{
                mb: 4,
              }}
            >
              <Typography
                variant="h5"
                sx={{
                  fontFamily: "'Playfair Display', serif",
                  color: "#0D47A1",
                  fontWeight: 700,
                  mb: 2,
                }}
              >
                Change Password
              </Typography>
              <Box
                sx={{
                  display: "grid",
                  gap: 2,
                  gridTemplateColumns: { xs: "1fr", md: "1fr" },
                }}
              >
                <TextField
                  label="Current Password"
                  name="CurrentPassword"
                  type={showCurrentPassword ? "text" : "password"}
                  value={passwordFields.CurrentPassword}
                  onChange={handlePasswordChange}
                  fullWidth
                  variant="outlined"
                  aria-label="Current password"
                  autoComplete="new-password"
                  inputProps={{
                    autoComplete: "off",
                  }}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          aria-label="toggle current password visibility"
                          onClick={() => togglePasswordVisibility("current")}
                          edge="end"
                        >
                          {showCurrentPassword ? (
                            <VisibilityOff />
                          ) : (
                            <Visibility />
                          )}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      "& fieldset": { borderColor: "#90CAF9" },
                      "&:hover fieldset": { borderColor: "#42A5F5" },
                      "&.Mui-focused fieldset": { borderColor: "#1E88E5" },
                    },
                  }}
                />
                <TextField
                  label="New Password"
                  name="NewPassword"
                  type={showNewPassword ? "text" : "password"}
                  value={passwordFields.NewPassword}
                  onChange={handlePasswordChange}
                  fullWidth
                  variant="outlined"
                  aria-label="New password"
                  helperText="Password must be at least 8 characters long"
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          aria-label="toggle new password visibility"
                          onClick={() => togglePasswordVisibility("new")}
                          edge="end"
                        >
                          {showNewPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      "& fieldset": { borderColor: "#90CAF9" },
                      "&:hover fieldset": { borderColor: "#42A5F5" },
                      "&.Mui-focused fieldset": { borderColor: "#1E88E5" },
                    },
                  }}
                />
                <TextField
                  label="Confirm New Password"
                  name="ConfirmNewPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={passwordFields.ConfirmNewPassword}
                  onChange={handlePasswordChange}
                  fullWidth
                  variant="outlined"
                  aria-label="Confirm new password"
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          aria-label="toggle confirm password visibility"
                          onClick={() => togglePasswordVisibility("confirm")}
                          edge="end"
                        >
                          {showConfirmPassword ? (
                            <VisibilityOff />
                          ) : (
                            <Visibility />
                          )}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      "& fieldset": { borderColor: "#90CAF9" },
                      "&:hover fieldset": { borderColor: "#42A5F5" },
                      "&.Mui-focused fieldset": { borderColor: "#1E88E5" },
                    },
                  }}
                />
                {passwordSave && (
                  <CustomButton
                    text="Change Password"
                    onClick={handleChangePassword}
                    sx={buttonStyles}
                    disabled={buttonLoading}
                    startIcon={
                      buttonLoading && (
                        <CircularProgress size={20} color="inherit" />
                      )
                    }
                    aria-label="Change password"
                  />
                )}
              </Box>
            </Box>
          </Box>
        </Paper>
      </Container>

      <ToastContainer
        position="top-center"
        toastStyle={{
          background: "#FFFFFF",
          color: "#0F172A",
          borderRadius: "8px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          border: "1px solid #E2E8F0",
          fontSize: "0.9rem",
        }}
      />
    </Box>
  );
}
