import React, { useState, useContext } from "react";
import {
  Box,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Chip,
  Stack,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import styled from "@emotion/styled";
import ServerSideTable from "../../components/ServerSideTable";
import LoadingSpinner from "../../components/LoadingSpinner";
import axiosInstance from "../../axiosConfig";
import { UserContext } from "../../UserContext";

const MainContainer = styled(Box)`
  min-height: 100vh;
  background: linear-gradient(to bottom right, #f4f9ff 0%, #f9f3ec 100%);
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 2rem 1rem;
  box-sizing: border-box;
  width: 100%;

  @media (max-width: 600px) {
    padding: 1rem 0.5rem;
  }
`;

const TableCard = styled(Box)`
  background: #ffffff;
  border-radius: 16px;
  padding: 2rem;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
  width: 95%;
  max-width: 1200px;
  transition:
    transform 0.3s ease,
    box-shadow 0.3s ease;
  &:hover {
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.15);
  }

  @media (max-width: 600px) {
    padding: 1rem;
    border-radius: 12px;
  }
`;

export default function Services() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const { userId } = useContext(UserContext);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState({
    title: "",
    message: "",
    breachedLimits: [],
    severity: "error", // "error" | "warning" | "info"
  });

  const showModal = (
    title,
    message,
    breachedLimits = [],
    severity = "error",
  ) => {
    setModalData({ title, message, breachedLimits, severity });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
  };

  const checkSubmissionLimit = async (serviceId) => {
    try {
      if (!userId) {
        showModal(
          "Authentication Required",
          "You must be logged in to submit applications.",
          [],
          "warning",
        );
        return false;
      }

      const response = await axiosInstance.get("/User/CheckSubmissionLimit", {
        params: { userId, serviceId },
      });

      if (response.data.status) {
        if (!response.data.canSubmit) {
          const { breachedLimits, message } = response.data;

          if (breachedLimits && breachedLimits.length > 0) {
            // New multi-rule format
            showModal(
              "Submission Limit Exceeded",
              message ||
                "You have reached the maximum number of submissions allowed.",
              breachedLimits,
              "error",
            );
          } else {
            // Fallback for old single-rule format (backward compatibility)
            const { limitType, limitCount } = response.data;
            showModal(
              "Submission Limit Exceeded",
              `You can submit ${limitCount} time${limitCount === 1 ? "" : "s"} ${limitType.toLowerCase()}.`,
              [{ limitType, limitCount }],
              "error",
            );
          }
        }
        return response.data.canSubmit;
      } else {
        showModal(
          "Error",
          response.data.message || "Failed to check submission limit.",
          [],
          "error",
        );
        return false;
      }
    } catch (error) {
      console.error("Error checking submission limit:", error);
      showModal(
        "Error",
        "An error occurred while checking submission limits. Please try again later.",
        [],
        "error",
      );
      return false;
    }
  };

  const actionFunctions = {
    OpenForm: async (row) => {
      const userdata = row.original;
      const canProceed = await checkSubmissionLimit(userdata.serviceId);
      if (canProceed) {
        navigate("/user/form", { state: { ServiceId: userdata.serviceId } });
      }
    },
  };

  if (loading) {
    return (
      <MainContainer>
        <LoadingSpinner />
      </MainContainer>
    );
  }

  const getDialogColor = (severity) => {
    switch (severity) {
      case "error":
        return "#d32f2f";
      case "warning":
        return "#ed6c02";
      case "info":
        return "#0288d1";
      default:
        return "#d32f2f";
    }
  };

  return (
    <MainContainer>
      {/* Modal Popup */}
      <Dialog
        open={modalOpen}
        onClose={closeModal}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            boxShadow: "0 12px 40px rgba(0,0,0,0.2)",
          },
        }}
      >
        <DialogTitle
          sx={{
            color: getDialogColor(modalData.severity),
            fontWeight: "bold",
            pb: 1,
          }}
        >
          {modalData.title}
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: "text.primary", mb: 2 }}>
            {modalData.message}
          </DialogContentText>

          {modalData.breachedLimits.length > 0 && (
            <Stack spacing={1.5} sx={{ mt: 2 }}>
              <Typography
                variant="subtitle2"
                sx={{ fontWeight: "bold", color: "text.secondary" }}
              >
                Limit Details:
              </Typography>
              {modalData.breachedLimits.map((limit, index) => (
                <Box
                  key={index}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1.5,
                    p: 1.5,
                    bgcolor: "grey.50",
                    borderRadius: 2,
                    border: "1px solid",
                    borderColor: "grey.200",
                  }}
                >
                  <Chip
                    label={limit.limitType}
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                  <Typography variant="body2" color="text.secondary">
                    Allowed: <strong>{limit.limitCount}</strong>
                    {limit.currentCount !== undefined && (
                      <>
                        {" "}
                        | Your submissions:{" "}
                        <strong>{limit.currentCount}</strong>
                      </>
                    )}
                  </Typography>
                </Box>
              ))}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={closeModal}
            variant="contained"
            color={
              modalData.severity === "error" ? "error" : modalData.severity
            }
            sx={{ borderRadius: 2, textTransform: "none", px: 3 }}
          >
            Understood
          </Button>
        </DialogActions>
      </Dialog>

      <TableCard>
        <ServerSideTable
          url="User/GetServices"
          extraParams={{}}
          actionFunctions={actionFunctions}
          Title={"Available Services"}
        />
      </TableCard>
    </MainContainer>
  );
}
