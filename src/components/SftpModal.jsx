import React, { useState } from "react";
import {
  Modal,
  Box,
  Typography,
  Button,
  Divider,
  useTheme,
} from "@mui/material";
import CustomInputField from "./form/CustomInputField";
import CustomButton from "./CustomButton";
import { useForm } from "react-hook-form";
import axiosInstance from "../axiosConfig";

const modalStyle = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: "90%",
  maxWidth: 600,
  maxHeight: "90vh",
  overflowY: "auto",
  bgcolor: "background.paper",
  p: 4,
  borderRadius: 4,
  boxShadow: "0 4px 20px rgba(0, 0, 0, 0.1)",
};

const SftpModal = ({
  open,
  handleClose,
  serviceId,
  districtId,
  type,
  month,
  year,
}) => {
  const theme = useTheme();
  const {
    control,
    formState: { errors },
    handleSubmit,
  } = useForm();
  const [responseMessage, setResponseMessage] = useState("");
  const [responseColor, setResponseColor] = useState(
    theme.palette.text.primary
  );

  const onSubmit = async (data) => {
    const formData = new FormData();
    formData.append("AccessCode", districtId);
    formData.append("ServiceId", serviceId);
    formData.append("Type", type);
    formData.append("Month", month);
    formData.append("Year", year);
    formData.append("FtpHost", data.ftpHost);
    formData.append("FtpUser", data.ftpUser);
    formData.append("FtpPassword", data.ftpPassword);

    try {
      const response = await axiosInstance.post(
        "/Officer/UploadToSftp",
        formData
      );
      const result = response.data;
      setResponseMessage(result.message);
      setResponseColor(
        result.status ? theme.palette.success.main : theme.palette.error.main
      );
    } catch (error) {
      setResponseMessage("An error occurred while uploading to SFTP.");
      setResponseColor(theme.palette.error.main);
    }
  };

  return (
    <Modal open={open} onClose={handleClose}>
      <Box sx={modalStyle}>
        <Typography variant="h5" sx={{ textAlign: "center", mb: 2 }}>
          Send Bank File to SFTP
        </Typography>

        <Divider sx={{ mb: 3 }} />

        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            backgroundColor: theme.palette.background.default,
            borderRadius: 3,
            p: 3,
            border: `1px solid ${theme.palette.divider}`,
          }}
        >
          <CustomInputField
            name="ftpHost"
            label="FTP Host"
            placeholder="Enter FTP Host"
            control={control}
            rules={{ required: "This field is required" }}
            errors={errors}
          />
          <CustomInputField
            name="ftpUser"
            label="FTP User"
            placeholder="Enter FTP Username"
            control={control}
            rules={{ required: "This field is required" }}
            errors={errors}
          />
          <CustomInputField
            name="ftpPassword"
            label="FTP Password"
            type="password"
            placeholder="Enter FTP Password"
            control={control}
            rules={{ required: "This field is required" }}
            errors={errors}
          />
          <CustomButton
            text="Send File to SFTP"
            onClick={handleSubmit(onSubmit)}
            bgColor={theme.palette.primary.main}
            color="#fff"
          />
          {responseMessage && (
            <Typography
              variant="body1"
              sx={{
                textAlign: "center",
                color: responseColor,
                fontWeight: 500,
                mt: 2,
              }}
            >
              {responseMessage}
            </Typography>
          )}
        </Box>

        <Button
          variant="outlined"
          onClick={handleClose}
          fullWidth
          sx={{
            mt: 3,
            borderColor: theme.palette.primary.main,
            color: theme.palette.primary.main,
          }}
        >
          Close
        </Button>
      </Box>
    </Modal>
  );
};

export default SftpModal;
