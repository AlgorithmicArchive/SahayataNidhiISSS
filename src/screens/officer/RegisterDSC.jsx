import React, { useEffect, useState } from "react";
import { Container, Row, Col } from "react-bootstrap";
import {
  TextField,
  Button,
  Box,
  Typography,
  CircularProgress,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from "@mui/material";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import axiosInstance from "../../axiosConfig";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CustomButton from "../../components/CustomButton";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export default function RegisterDSC() {
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [isAlreadyRegistered, SetIsAlreadyRegistered] = useState(false);
  const [certificateId, setCertificateId] = useState(0);
  const [isCheckingRegistration, setIsCheckingRegistration] = useState(true);

  // State for Error Popup
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Helper to show error popup
  const showErrorPopup = (message) => {
    setErrorMessage(message);
    setErrorDialogOpen(true);
  };

  const checkDesktopApp = async () => {
    try {
      // NOTE: Using HTTP, not HTTPS, to avoid self-signed cert blocking
      const response = await fetch("http://localhost:8000/");
      if (!response.ok) {
        showErrorPopup(
          "Please start the USB Token PDF Signer desktop application before continuing.",
        );
        return false;
      }
      return true;
    } catch {
      showErrorPopup(
        "Cannot connect to the USB Token PDF Signer desktop application. Please ensure it is running.",
      );
      return false;
    }
  };

  useEffect(() => {
    const checkIfRegistered = async () => {
      try {
        const response = await axiosInstance.get("/Officer/AlreadyRegistered");
        SetIsAlreadyRegistered(response.data.isAlreadyRegistered);
        setCertificateId(response.data.certificate_id);

        if (!response.data.isAlreadyRegistered) {
          await checkDesktopApp();
        }
      } catch (err) {
        const message = err.message.includes("USB Token PDF Signer")
          ? err.message
          : "Error checking registration status. Please try again later.";
        showErrorPopup(message);
      } finally {
        setIsCheckingRegistration(false);
      }
    };
    checkIfRegistered();
  }, []);

  const fetchCertificates = async (pin) => {
    const formData = new FormData();
    formData.append("pin", pin);

    try {
      // NOTE: Using HTTP, not HTTPS
      const response = await fetch("http://localhost:8000/certificates", {
        method: "POST",
        mode: "cors",
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Desktop App responded with ${response.status}: ${errorText}`,
        );
      }

      return response.json();
    } catch (error) {
      console.error("=== DSC FETCH ERROR DETAILS ===", error);
      throw new Error(
        "Failed to connect to Desktop App. Is it running and is the correct PIN entered?",
      );
    }
  };

  const registerDSC = async (certificate) => {
    const formdata = new FormData();
    formdata.append("serial_number", certificate.serial_number);
    formdata.append("certifying_authority", certificate.certifying_authority);
    formdata.append("expiration_date", certificate.expiration_date);
    formdata.append("cert_subject_name", certificate.common_name);

    const response = await axiosInstance.post("/Officer/RegisterDSC", formdata);
    console.log("=== DSC REGISTER RESPONSE ===", response.data);

    if (!response.data.success) {
      // This catches the detailed "Name mismatch" error from the C# backend
      throw new Error(
        response.data.message || "Failed to register DSC with the server.",
      );
    }

    SetIsAlreadyRegistered(true);
    return response.data;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);

    try {
      const certificates = await fetchCertificates(pin);
      if (!certificates || certificates.length === 0) {
        throw new Error(
          "No certificates found on the USB token. Please check if it is plugged in correctly.",
        );
      }

      const selectedCertificate = certificates[0];
      await registerDSC(selectedCertificate);

      toast.success("DSC registered successfully! Pending Admin Approval.");
    } catch (err) {
      // Show the error in the prominent popup instead of a fleeting toast
      showErrorPopup(
        err.message || "An unexpected error occurred during registration.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleUnregister = async () => {
    setLoading(true);
    try {
      const formdata = new FormData();
      formdata.append("certificateId", certificateId);
      const response = await axiosInstance.post(
        "/Officer/UnRegisteredDSC",
        formdata,
      );

      if (response.data.status) {
        SetIsAlreadyRegistered(false);
        toast.success("DSC unregistered successfully.");
      } else {
        showErrorPopup(response.data.message || "Failed to unregister DSC.");
      }
    } catch (err) {
      showErrorPopup("An error occurred while trying to unregister.");
    } finally {
      setLoading(false);
    }
  };

  if (isCheckingRegistration) {
    return (
      <>
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "100vh",
          }}
        >
          <CircularProgress />
        </Box>
        <ToastContainer />
      </>
    );
  }

  return (
    <Container style={{ height: "100vh" }}>
      <ToastContainer />

      {/* ERROR POPUP DIALOG */}
      <Dialog
        open={errorDialogOpen}
        onClose={() => setErrorDialogOpen(false)}
        aria-labelledby="error-dialog-title"
        aria-describedby="error-dialog-description"
        PaperProps={{
          sx: { borderRadius: 3, border: "2px solid #f44336" },
        }}
      >
        <DialogTitle
          id="error-dialog-title"
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            color: "#d32f2f",
            fontWeight: "bold",
          }}
        >
          <ErrorOutlineIcon fontSize="large" />
          Registration Error
        </DialogTitle>
        <DialogContent>
          <DialogContentText
            id="error-dialog-description"
            sx={{
              fontSize: "1.1rem",
              color: "text.primary",
              whiteSpace: "pre-line",
            }}
          >
            {errorMessage}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={() => setErrorDialogOpen(false)}
            variant="contained"
            color="error"
            fullWidth
            sx={{ borderRadius: 2, py: 1 }}
          >
            Understood
          </Button>
        </DialogActions>
      </Dialog>

      <Row>
        <Col md={{ span: 6, offset: 3 }}>
          {!isAlreadyRegistered ? (
            <Box
              component="form"
              onSubmit={handleSubmit}
              sx={{
                display: "flex",
                flexDirection: "column",
                gap: 3,
                mt: 4,
                p: 3,
                backgroundColor: "#fafafa",
                borderRadius: 3,
                boxShadow: 1,
                pb: 5,
              }}
            >
              <Typography
                variant="h5"
                component="h1"
                gutterBottom
                sx={{ fontWeight: "bold", color: "#1976d2" }}
              >
                Register DSC
              </Typography>

              <Typography variant="body2" color="text.secondary">
                Ensure the USB Token is plugged in and the Desktop Signer App is
                running.
              </Typography>

              <TextField
                label="USB Token PIN"
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                required
                disabled={loading}
                fullWidth
              />

              <Button
                type="submit"
                variant="contained"
                disabled={loading}
                size="large"
                sx={{ py: 1.5, fontWeight: "bold", fontSize: "1rem" }}
              >
                {loading ? (
                  <CircularProgress size={24} color="inherit" />
                ) : (
                  "Register DSC"
                )}
              </Button>
            </Box>
          ) : (
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                minHeight: "90vh",
              }}
            >
              <Card
                elevation={3}
                sx={{
                  padding: 4,
                  maxWidth: 500,
                  width: "90%",
                  textAlign: "center",
                  borderRadius: 3,
                }}
              >
                <CardContent>
                  <CheckCircleIcon
                    sx={{ fontSize: 60, color: "success.main", mb: 2 }}
                  />
                  <Typography variant="h6" sx={{ fontWeight: "bold", mb: 1 }}>
                    Digital Signature Already Registered
                  </Typography>
                  <Typography
                    variant="body1"
                    sx={{ color: "text.secondary", mb: 3 }}
                  >
                    Please unregister your current token before registering a
                    new one.
                  </Typography>
                  <CustomButton
                    text={loading ? "Unregistering..." : "Unregister"}
                    onClick={handleUnregister}
                    disabled={loading}
                  />
                </CardContent>
              </Card>
            </Box>
          )}
        </Col>
      </Row>
    </Container>
  );
}
