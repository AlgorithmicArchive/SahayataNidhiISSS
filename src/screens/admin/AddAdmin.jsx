import React, { useEffect, useState } from "react";
import {
  Box,
  Container,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Paper,
  Divider,
  Chip,
} from "@mui/material";
import { useForm, Controller } from "react-hook-form";
import axiosInstance from "../../axiosConfig";
import MessageModal from "../../components/MessageModal";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import OtpModal from "../../components/OtpModal";
import {
  AdminPanelSettings,
  Person,
  ContactMail,
  Lock,
  LocationOn,
  CheckCircle,
} from "@mui/icons-material";

// Admin hierarchy configuration
const adminHierarchy = {
  System: {
    allowedToCreate: ["State", "Division", "District"],
    roles: [
      {
        Role: "State Admin",
        RoleShort: "SA",
        AccessLevel: "State",
        AccessCode: 0,
      },
      {
        Role: "Division Admin",
        RoleShort: "DA",
        AccessLevel: "Division",
        AccessCode: 1,
      },
      {
        Role: "District Admin",
        RoleShort: "DIA",
        AccessLevel: "District",
        AccessCode: 2,
      },
    ],
  },
  State: {
    allowedToCreate: ["Division", "District"],
    roles: [
      {
        Role: "Division Admin",
        RoleShort: "DA",
        AccessLevel: "Division",
        AccessCode: 1,
      },
      {
        Role: "District Admin",
        RoleShort: "DIA",
        AccessLevel: "District",
        AccessCode: 2,
      },
    ],
  },
  Division: {
    allowedToCreate: ["District"],
    roles: [
      {
        Role: "District Admin",
        RoleShort: "DIA",
        AccessLevel: "District",
        AccessCode: 2,
      },
    ],
  },
  District: {
    allowedToCreate: [],
    roles: [],
  },
};

// Mock divisions (replace with API data if available)
const divisions = [
  { id: 1, name: "Jammu" },
  { id: 2, name: "Kashmir" },
];

// Mock districts as fallback
const mockDistricts = [
  { id: 1, name: "District 1", divisionId: 1 },
  { id: 2, name: "District 2", divisionId: 1 },
  { id: 3, name: "District 3", divisionId: 2 },
];

export default function AddAdmin() {
  const {
    control,
    handleSubmit,
    watch,
    setValue,
    getValues,
    trigger,
    formState: { errors },
  } = useForm({
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      name: "",
      username: "",
      email: "",
      password: "",
      mobileNumber: "",
      userType: "Admin",
      role: "",
      division: "",
      district: "",
      department: "",
    },
  });

  const [currentAdminLevel, setCurrentAdminLevel] = useState("");
  const [currentAdminRole, setCurrentAdminRole] = useState("");
  const [currentAdminDivision, setCurrentAdminDivision] = useState(null);
  const [availableRoles, setAvailableRoles] = useState([]);
  const [allDistricts, setAllDistricts] = useState([]);
  const [filteredDistricts, setFilteredDistricts] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [isOtpModalOpen, setIsOtpModalOpen] = useState(false);
  const [otpType, setOtpType] = useState(null);
  const [userId, setUserId] = useState(0);
  const [isEmailOtpSent, setIsEmailOtpSent] = useState(false);
  const [isEmailOtpVerified, setIsEmailOtpVerified] = useState(false);
  const [isMobileOtpSent, setIsMobileOtpSent] = useState(false);
  const [isMobileOtpVerified, setIsMobileOtpVerified] = useState(false);

  const selectedRole = watch("role");
  const selectedDivision = watch("division");
  const emailValue = watch("email");
  const mobileValue = watch("mobileNumber");

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const adminResponse = await axiosInstance.get(
          "/Admin/GetCurrentAdminDetails",
        );
        if (!adminResponse.data || !adminResponse.data.additionalDetails) {
          throw new Error("Admin data is missing");
        }

        const details = JSON.parse(adminResponse.data.additionalDetails);
        if (!details || !details.AccessLevel) {
          throw new Error("Invalid admin details");
        }

        setCurrentAdminLevel(details.AccessLevel);
        setCurrentAdminRole(details.Role || "");
        if (details.DivisionId) {
          setCurrentAdminDivision(details.DivisionId);
        }

        const roleLevel =
          details.Role === "System Admin" ? "System" : details.AccessLevel;
        if (adminHierarchy[roleLevel]) {
          setAvailableRoles(adminHierarchy[roleLevel].roles);
        } else {
          throw new Error(`No roles defined for AccessLevel: ${roleLevel}`);
        }

        const fetchedDistricts = adminResponse.data.districts || mockDistricts;
        setAllDistricts(fetchedDistricts);
        setFilteredDistricts(fetchedDistricts);

        if (details.Role === "System Admin") {
          const deptResponse = await axiosInstance.get("/Base/GetDepartments");
          if (
            deptResponse.data.status &&
            deptResponse.data.departments?.length > 0
          ) {
            setDepartments(deptResponse.data.departments);
          } else {
            throw new Error(
              "Failed to load departments or no departments available",
            );
          }
        }
      } catch (error) {
        setErrorMessage(`Error loading data: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (
      (selectedRole === "District Admin" ||
        selectedRole === "Division Admin") &&
      selectedDivision
    ) {
      setFilteredDistricts(
        allDistricts.filter((d) => d.divisionId === parseInt(selectedDivision)),
      );
      setValue("district", "");
    }
  }, [selectedDivision, selectedRole, setValue, allDistricts]);

  const handleEmailValidate = async () => {
    const isValid = await trigger("email");
    if (isValid && !errors.email) {
      setIsLoading(true);
      try {
        const email = getValues("email");
        const response = await axiosInstance.get("/Home/SendOtp", {
          params: { email },
        });
        if (response.data.status) {
          setIsEmailOtpSent(true);
          setIsOtpModalOpen(true);
          setOtpType("email");
          setUserId(response.data.userId);
          toast.success("OTP sent to your email!", { position: "top-center" });
        } else {
          toast.error("Failed to send OTP. Please try again.", {
            position: "top-center",
          });
        }
      } catch (error) {
        toast.error("Error sending OTP to email.", { position: "top-center" });
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleMobileValidate = async () => {
    const isValid = await trigger("mobileNumber");
    if (isValid && !errors.mobileNumber) {
      setIsLoading(true);
      try {
        const mobile = getValues("mobileNumber");
        // Fixed bug: was sending mobile to 'email' param in original code
        const response = await axiosInstance.get("/Home/SendOtp", {
          params: { mobile },
        });
        if (response.data.status) {
          setIsMobileOtpSent(true);
          setIsOtpModalOpen(true);
          setOtpType("mobile");
          setUserId(response.data.userId);
          toast.success("OTP sent to your mobile number!", {
            position: "top-center",
          });
        } else {
          toast.error("Failed to send OTP. Please try again.", {
            position: "top-center",
          });
        }
      } catch (error) {
        toast.error("Error sending OTP to mobile.", { position: "top-center" });
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleOtpSubmit = async (otp) => {
    if (!otp) {
      toast.error("Please enter an OTP.", { position: "top-center" });
      return;
    }

    setIsLoading(true);
    const formData = new FormData();
    formData.append("otp", otp);
    if (otpType === "email") {
      formData.append("email", getValues("email"));
    } else if (otpType === "mobile") {
      formData.append("email", getValues("mobileNumber"));
    }

    try {
      const response = await axiosInstance.post(
        "/Home/OTPValidation",
        formData,
      );
      if (response.data.status) {
        if (otpType === "email") setIsEmailOtpVerified(true);
        else if (otpType === "mobile") setIsMobileOtpVerified(true);

        setIsOtpModalOpen(false);
        setOtpType(null);
        toast.success(
          `${otpType === "email" ? "Email" : "Mobile"} OTP verified successfully!`,
          { position: "top-center" },
        );
      } else {
        toast.error("Invalid OTP. Please try again.", {
          position: "top-center",
        });
      }
    } catch (error) {
      toast.error(
        `Error validating ${otpType === "email" ? "email" : "mobile"} OTP.`,
        { position: "top-center" },
      );
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async (data) => {
    if (!isEmailOtpVerified) {
      toast.error("Please verify email OTP before creating admin.", {
        position: "top-center",
      });
      return;
    }
    if (!isMobileOtpVerified) {
      toast.error("Please verify mobile OTP before creating admin.", {
        position: "top-center",
      });
      return;
    }

    const selectedRoleObj = availableRoles.find((r) => r.Role === data.role);
    if (!selectedRoleObj) {
      setErrorMessage("Invalid role selected");
      return;
    }

    if (currentAdminRole === "System Admin" && !data.department) {
      setErrorMessage("Department is required for System Admin");
      return;
    }

    const additionalDetails = {
      Role: selectedRoleObj.Role,
      RoleShort: selectedRoleObj.RoleShort,
      AccessLevel: selectedRoleObj.AccessLevel,
      AccessCode: data.district || data.division || selectedRoleObj.AccessCode,
      Department: parseInt(data.department) || 0,
      Validate: true,
    };

    try {
      const formData = new FormData();
      formData.append("name", data.name);
      formData.append("username", data.username);
      formData.append("email", data.email);
      formData.append("password", data.password);
      formData.append("mobileNumber", data.mobileNumber);
      formData.append("role", data.role);
      formData.append("division", data.division);
      formData.append("district", data.district);
      formData.append("department", data.department);
      formData.append("AdditionalDetails", JSON.stringify(additionalDetails));

      const response = await axiosInstance.post("/Admin/AddAdmin", formData);

      if (response.data.status) {
        setShowMessageModal(true);
        setValue("name", "");
        setValue("username", "");
        setValue("email", "");
        setValue("password", "");
        setValue("mobileNumber", "");
        setValue("role", "");
        setValue("division", "");
        setValue("district", "");
        setValue("department", "");
        setErrorMessage("");
        setIsEmailOtpSent(false);
        setIsEmailOtpVerified(false);
        setIsMobileOtpSent(false);
        setIsMobileOtpVerified(false);
      }
    } catch (error) {
      setErrorMessage(`Error creating admin: ${error.message}`);
    }
  };

  if (isLoading) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
          bgcolor: "#F8FAFC",
        }}
      >
        <CircularProgress size={60} sx={{ color: "#2562E9" }} />
      </Box>
    );
  }

  if (currentAdminLevel === "District") {
    return (
      <Box sx={{ bgcolor: "#F8FAFC", minHeight: "100vh", py: 8 }}>
        <Container maxWidth="md">
          <Alert
            severity="warning"
            sx={{ borderRadius: 2, border: "1px solid #FDE68A" }}
          >
            <Typography fontWeight={600}>
              District Admins are not authorized to create new admins.
            </Typography>
          </Alert>
        </Container>
      </Box>
    );
  }

  return (
    <Box sx={{ bgcolor: "#F8FAFC", minHeight: "100vh", py: 4 }}>
      <Container maxWidth="md">
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1 }}>
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: 2,
                bgcolor: "#EFF6FF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <AdminPanelSettings sx={{ fontSize: 32, color: "#2562E9" }} />
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
                Add New Administrator
              </Typography>
              <Typography variant="body1" sx={{ color: "#64748B" }}>
                Create a new admin account with specific jurisdiction and role
                permissions
              </Typography>
            </Box>
          </Box>
        </Box>

        {errorMessage && (
          <Alert
            severity="error"
            sx={{ mb: 3, borderRadius: 2, border: "1px solid #FECACA" }}
          >
            <Typography fontWeight={600}>{errorMessage}</Typography>
          </Alert>
        )}

        {currentAdminRole === "System Admin" && departments.length === 0 && (
          <Alert
            severity="warning"
            sx={{ mb: 3, borderRadius: 2, border: "1px solid #FDE68A" }}
          >
            No departments available. Please contact support to configure
            departments.
          </Alert>
        )}

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
          <form onSubmit={handleSubmit(onSubmit)}>
            {/* Section 1: Personal Information */}
            <Box sx={{ mb: 4 }}>
              <Box
                sx={{ display: "flex", alignItems: "center", gap: 1, mb: 3 }}
              >
                <Person sx={{ color: "#2562E9" }} />
                <Typography
                  variant="h6"
                  sx={{ fontWeight: 700, color: "#0F172A" }}
                >
                  Personal Information
                </Typography>
              </Box>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <Controller
                    name="name"
                    control={control}
                    rules={{
                      required: "Name is required",
                      minLength: { value: 5, message: "Minimum 5 characters" },
                    }}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label="Full Name"
                        required
                        error={!!errors.name}
                        helperText={errors.name?.message}
                        disabled={isLoading}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Controller
                    name="username"
                    control={control}
                    rules={{
                      required: "Username is required",
                      minLength: { value: 5, message: "Minimum 5 characters" },
                      validate: async (value) => {
                        if (!value) return "Username is required";
                        try {
                          const res = await axiosInstance.get(
                            "/Home/CheckUsername",
                            { params: { username: value } },
                          );
                          return (
                            res.data?.isUnique || "Username already exists"
                          );
                        } catch {
                          return "Error checking username";
                        }
                      },
                    }}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label="Username"
                        required
                        error={!!errors.username}
                        helperText={errors.username?.message}
                        disabled={isLoading}
                      />
                    )}
                  />
                </Grid>
              </Grid>
            </Box>

            <Divider sx={{ my: 4 }} />

            {/* Section 2: Contact & Verification */}
            <Box sx={{ mb: 4 }}>
              <Box
                sx={{ display: "flex", alignItems: "center", gap: 1, mb: 3 }}
              >
                <ContactMail sx={{ color: "#2562E9" }} />
                <Typography
                  variant="h6"
                  sx={{ fontWeight: 700, color: "#0F172A" }}
                >
                  Contact & Verification
                </Typography>
              </Box>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <Controller
                    name="email"
                    control={control}
                    rules={{
                      required: "Email is required",
                      pattern: {
                        value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                        message: "Invalid email format",
                      },
                      validate: async (value) => {
                        if (!value) return "Email is required";
                        try {
                          const res = await axiosInstance.get(
                            "/Home/CheckEmail",
                            { params: { email: value, UserType: "Admin" } },
                          );
                          return res.data?.isUnique || "Email already exists";
                        } catch {
                          return "Error checking email";
                        }
                      },
                    }}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label="Email Address"
                        required
                        type="email"
                        error={!!errors.email}
                        helperText={errors.email?.message}
                        disabled={isLoading || isEmailOtpVerified}
                        InputProps={{
                          endAdornment: isEmailOtpVerified ? (
                            <Chip
                              label="Verified"
                              icon={<CheckCircle sx={{ fontSize: 16 }} />}
                              color="success"
                              size="small"
                              sx={{ fontWeight: 600, mr: -1 }}
                            />
                          ) : null,
                        }}
                      />
                    )}
                  />
                  {!isEmailOtpVerified && emailValue && !errors.email && (
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={handleEmailValidate}
                      disabled={isLoading}
                      fullWidth
                      sx={{
                        mt: 1.5,
                        textTransform: "none",
                        borderColor: "#2562E9",
                        color: "#2562E9",
                        "&:hover": { bgcolor: "#EFF6FF" },
                      }}
                    >
                      Send OTP to Email
                    </Button>
                  )}
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Controller
                    name="mobileNumber"
                    control={control}
                    rules={{
                      required: "Mobile Number is required",
                      pattern: {
                        value: /^[0-9]{10}$/,
                        message: "Enter 10 digit number",
                      },
                      validate: async (value) => {
                        if (!value) return "Mobile Number is required";
                        try {
                          const res = await axiosInstance.get(
                            "/Home/CheckMobileNumber",
                            { params: { number: value, UserType: "Admin" } },
                          );
                          return (
                            res.data?.isUnique || "Mobile Number already exists"
                          );
                        } catch {
                          return "Error checking mobile number";
                        }
                      },
                    }}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label="Mobile Number"
                        required
                        type="tel"
                        error={!!errors.mobileNumber}
                        helperText={errors.mobileNumber?.message}
                        disabled={isLoading || isMobileOtpVerified}
                        inputProps={{ maxLength: 10 }}
                        InputProps={{
                          endAdornment: isMobileOtpVerified ? (
                            <Chip
                              label="Verified"
                              icon={<CheckCircle sx={{ fontSize: 16 }} />}
                              color="success"
                              size="small"
                              sx={{ fontWeight: 600, mr: -1 }}
                            />
                          ) : null,
                        }}
                      />
                    )}
                  />
                  {!isMobileOtpVerified &&
                    mobileValue &&
                    !errors.mobileNumber && (
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={handleMobileValidate}
                        disabled={isLoading}
                        fullWidth
                        sx={{
                          mt: 1.5,
                          textTransform: "none",
                          borderColor: "#2562E9",
                          color: "#2562E9",
                          "&:hover": { bgcolor: "#EFF6FF" },
                        }}
                      >
                        Send OTP to Mobile
                      </Button>
                    )}
                </Grid>
              </Grid>
            </Box>

            <Divider sx={{ my: 4 }} />

            {/* Section 3: Security */}
            <Box sx={{ mb: 4 }}>
              <Box
                sx={{ display: "flex", alignItems: "center", gap: 1, mb: 3 }}
              >
                <Lock sx={{ color: "#2562E9" }} />
                <Typography
                  variant="h6"
                  sx={{ fontWeight: 700, color: "#0F172A" }}
                >
                  Security
                </Typography>
              </Box>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <Controller
                    name="password"
                    control={control}
                    rules={{
                      required: "Password is required",
                      minLength: { value: 6, message: "Minimum 6 characters" },
                      maxLength: {
                        value: 12,
                        message: "Maximum 12 characters",
                      },
                      pattern: {
                        value:
                          /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{6,12}$/,
                        message:
                          "Must include upper, lower, number, special char",
                      },
                    }}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label="Password"
                        required
                        type="password"
                        error={!!errors.password}
                        helperText={errors.password?.message}
                        disabled={isLoading}
                      />
                    )}
                  />
                </Grid>
              </Grid>
            </Box>

            <Divider sx={{ my: 4 }} />

            {/* Section 4: Role & Jurisdiction */}
            <Box sx={{ mb: 4 }}>
              <Box
                sx={{ display: "flex", alignItems: "center", gap: 1, mb: 3 }}
              >
                <LocationOn sx={{ color: "#2562E9" }} />
                <Typography
                  variant="h6"
                  sx={{ fontWeight: 700, color: "#0F172A" }}
                >
                  Role & Jurisdiction
                </Typography>
              </Box>
              <Grid container spacing={3}>
                {currentAdminRole === "System Admin" && (
                  <Grid item xs={12} sm={6}>
                    <Controller
                      name="department"
                      control={control}
                      rules={{
                        required: "Department is required for System Admin",
                      }}
                      render={({ field }) => (
                        <FormControl fullWidth error={!!errors.department}>
                          <InputLabel>Department</InputLabel>
                          <Select
                            {...field}
                            label="Department"
                            disabled={isLoading}
                          >
                            <MenuItem value="">
                              Please Select Department
                            </MenuItem>
                            {departments.map((dept) => (
                              <MenuItem
                                key={dept.departmentId}
                                value={dept.departmentId}
                              >
                                {dept.departmentName}
                              </MenuItem>
                            ))}
                          </Select>
                          {errors.department && (
                            <Typography
                              color="error"
                              variant="caption"
                              sx={{ mt: 0.5, ml: 1.5 }}
                            >
                              {errors.department.message}
                            </Typography>
                          )}
                        </FormControl>
                      )}
                    />
                  </Grid>
                )}

                <Grid item xs={12} sm={6}>
                  <Controller
                    name="role"
                    control={control}
                    rules={{ required: "Role is required" }}
                    render={({ field }) => (
                      <FormControl fullWidth error={!!errors.role}>
                        <InputLabel>Role</InputLabel>
                        <Select {...field} label="Role" disabled={isLoading}>
                          <MenuItem value="">Please Select Role</MenuItem>
                          {availableRoles.map((role) => (
                            <MenuItem key={role.RoleShort} value={role.Role}>
                              {role.Role}
                            </MenuItem>
                          ))}
                        </Select>
                        {errors.role && (
                          <Typography
                            color="error"
                            variant="caption"
                            sx={{ mt: 0.5, ml: 1.5 }}
                          >
                            {errors.role.message}
                          </Typography>
                        )}
                      </FormControl>
                    )}
                  />
                </Grid>

                {(selectedRole === "Division Admin" ||
                  selectedRole === "District Admin") &&
                  (currentAdminLevel === "System" ||
                    currentAdminLevel === "State") && (
                    <Grid item xs={12} sm={6}>
                      <Controller
                        name="division"
                        control={control}
                        rules={{ required: "Division is required" }}
                        render={({ field }) => (
                          <FormControl fullWidth error={!!errors.division}>
                            <InputLabel>Division</InputLabel>
                            <Select
                              {...field}
                              label="Division"
                              disabled={isLoading}
                            >
                              <MenuItem value="">
                                Please Select Division
                              </MenuItem>
                              {divisions.map((division) => (
                                <MenuItem key={division.id} value={division.id}>
                                  {division.name}
                                </MenuItem>
                              ))}
                            </Select>
                            {errors.division && (
                              <Typography
                                color="error"
                                variant="caption"
                                sx={{ mt: 0.5, ml: 1.5 }}
                              >
                                {errors.division.message}
                              </Typography>
                            )}
                          </FormControl>
                        )}
                      />
                    </Grid>
                  )}

                {selectedRole === "District Admin" && (
                  <Grid item xs={12} sm={6}>
                    <Controller
                      name="district"
                      control={control}
                      rules={{ required: "District is required" }}
                      render={({ field }) => (
                        <FormControl fullWidth error={!!errors.district}>
                          <InputLabel>District</InputLabel>
                          <Select
                            {...field}
                            label="District"
                            disabled={isLoading}
                          >
                            <MenuItem value="">Please Select District</MenuItem>
                            {filteredDistricts.map((district) => (
                              <MenuItem key={district.id} value={district.id}>
                                {district.name}
                              </MenuItem>
                            ))}
                          </Select>
                          {errors.district && (
                            <Typography
                              color="error"
                              variant="caption"
                              sx={{ mt: 0.5, ml: 1.5 }}
                            >
                              {errors.district.message}
                            </Typography>
                          )}
                        </FormControl>
                      )}
                    />
                  </Grid>
                )}
              </Grid>
            </Box>

            {/* Submit Button */}
            <Button
              type="submit"
              variant="contained"
              size="large"
              fullWidth
              disabled={
                isLoading || !isEmailOtpVerified || !isMobileOtpVerified
              }
              sx={{
                mt: 2,
                py: 1.5,
                fontSize: "1rem",
                fontWeight: 700,
                textTransform: "none",
                bgcolor: "#2562E9",
                "&:hover": { bgcolor: "#1D4ED8" },
                boxShadow: "0 4px 12px rgba(37, 99, 233, 0.2)",
              }}
            >
              {isLoading ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                "Create Administrator"
              )}
            </Button>
          </form>
        </Paper>

        <MessageModal
          title="Add Admin"
          message="Admin Added Successfully."
          type="success"
          key="addadmin"
          open={showMessageModal}
          onClose={() => setShowMessageModal(false)}
        />

        {OtpModal && (
          <OtpModal
            open={isOtpModalOpen}
            onClose={() => {
              setIsOtpModalOpen(false);
              setOtpType(null);
            }}
            onSubmit={handleOtpSubmit}
            registeredAt={otpType}
            title={`Enter ${otpType === "email" ? "Email" : "Mobile"} OTP`}
          />
        )}

        <ToastContainer position="top-right" autoClose={3000} theme="colored" />
      </Container>
    </Box>
  );
}
