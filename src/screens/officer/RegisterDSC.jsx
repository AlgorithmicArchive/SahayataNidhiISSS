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
} from "@mui/material";
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
  const [desktopAppError, setDesktopAppError] = useState("");

  const checkDesktopApp = async () => {
    try {
      const response = await fetch("http://localhost:8000/");
      if (!response.ok) {
        toast.error(
          "Please start the USB Token PDF Signer desktop application before continuing."
        );
        return false;
      }
      return true;
    } catch {
      toast.error(
        "Please start the USB Token PDF Signer desktop application before continuing."
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
          : "Error checking registration status.";
        setDesktopAppError(message);
        toast.error(message);
      } finally {
        setIsCheckingRegistration(false);
      }
    };
    checkIfRegistered();
  }, []);

  const fetchCertificates = async (pin) => {
    const formData = new FormData();
    formData.append("pin", pin);
    const response = await fetch("http://localhost:8000/certificates", {
      method: "POST",
      body: formData,
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  };

  const registerDSC = async (certificate) => {
    const formdata = new FormData();
    formdata.append("serial_number", certificate.serial_number);
    formdata.append("certifying_authority", certificate.certifying_authority);
    formdata.append("expiration_date", certificate.expiration_date);
    const response = await axiosInstance.post("/Officer/RegisterDSC", formdata);
    if (!response.data.success)
      throw new Error("Failed to register DSC with the server.");
    return response.data;
    SetIsAlreadyRegistered(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);

    try {
      const certificates = await fetchCertificates(pin);
      if (!certificates || certificates.length === 0) {
        throw new Error("No certificates found on the USB token.");
      }

      const selectedCertificate = certificates[0];
      await registerDSC(selectedCertificate);
      toast.success("DSC registered successfully!");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUnregister = async () => {
    const formdata = new FormData();
    formdata.append("certificateId", certificateId);
    const response = await axiosInstance.post(
      "/Officer/UnRegisteredDSC",
      formdata
    );
    if (response.data.status) {
      SetIsAlreadyRegistered(false);
      toast.success("DSC unregistered successfully.");
    } else {
      toast.error("Failed to unregister DSC.");
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
    <Container>
      <ToastContainer />
      <Row>
        <Col md={{ span: 6, offset: 3 }}>
          {!isAlreadyRegistered ? (
            <Box
              component="form"
              onSubmit={handleSubmit}
              sx={{
                display: "flex",
                flexDirection: "column",
                gap: 2,
                mt: 4,
                height: "90vh",
              }}
            >
              <Typography variant="h5" component="h1" gutterBottom>
                Register DSC
              </Typography>
              <TextField
                label="USB Token PIN"
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                required
                disabled={loading || Boolean(desktopAppError)}
              />
              <Button
                type="submit"
                variant="contained"
                disabled={loading || Boolean(desktopAppError)}
              >
                {loading ? <CircularProgress size={24} /> : "Register DSC"}
              </Button>
            </Box>
          ) : (
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                minHeight: "90vh",
                backgroundColor: "#f5f5f5",
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
                    sx={{ fontSize: 50, color: "green", mb: 2 }}
                  />
                  <Typography variant="h6" sx={{ fontWeight: "bold", mb: 1 }}>
                    Digital Signature Already Registered
                  </Typography>
                  <Typography variant="body1" sx={{ color: "text.secondary" }}>
                    Please unregister your current token before registering a
                    new one.
                  </Typography>
                  <CustomButton text="Unregister" onClick={handleUnregister} />
                </CardContent>
              </Card>
            </Box>
          )}
        </Col>
      </Row>
    </Container>
  );
}
