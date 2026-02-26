import React, { useState } from "react";
import { Modal, Box, Typography, Button } from "@mui/material";
import CustomSelectField from "./form/CustomSelectField";
import CustomInputField from "./form/CustomInputField";
import CustomButton from "./CustomButton";
import CustomCheckbox from "./form/CustomCheckBox";
import CustomDateInput from "./form/CustomDateInput";
import { runValidations } from "../assets/formvalidations";
import CustomFileSelector from "./form/CustomFileSelector";

// Modal style
const style = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  bgcolor: "background.paper",
  boxShadow: 24,
  p: 4,
};

const ActionModal = ({
  open,
  handleClose,
  control,
  handleSubmit,
  onSubmit,
  actionOptions,
  editList,
  editableField,
  currentOfficer,
  errors,
}) => {
  const [selectedAction, setSelectedAction] = useState("");
  const handleActionChange = (value) => {
    console.log(value);
    setSelectedAction(value);
  };
  return (
    <Modal open={open} onClose={handleClose}>
      <Box
        sx={[
          style,
          {
            maxHeight: "600px",
            overflowY: "scroll",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 3,
            width: { xs: "100%", md: "50%" },
          },
        ]}
      >
        <Typography
          variant="h6"
          component="h2"
          sx={{ textAlign: "center", marginTop: 5 }}
        >
          Take Action
        </Typography>
        <Box sx={{ mt: 2 }}>
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              flexDirection: "column",
              backgroundColor: "primary.main",
              borderRadius: 5,
              padding: 3,
              width: "100%",
            }}
          >
            <CustomSelectField
              label={"Choose Action"}
              name={"action"}
              control={control}
              options={actionOptions}
              placeholder={"Choose Action"}
              rules={{ required: "This field is required" }}
              errors={errors}
              onChange={(value) => handleActionChange(value)}
            />
            {selectedAction == "returnToEdit" && (
              <Box sx={{ maxHeight: "200px", overflowY: "scroll" }}>
                {editList.map((item, index) => (
                  <CustomCheckbox
                    label={item.label}
                    name={"editList"}
                    value={item.value}
                    control={control}
                    key={index}
                    rules={{}}
                  />
                ))}
              </Box>
            )}
            {selectedAction == "updateAndForward" && (
              <Box>
                <CustomDateInput
                  key={editableField.name}
                  label={editableField.label}
                  name={"editableField"}
                  control={control}
                  defaultDate={editableField.value}
                  rules={{
                    validate: async (value) => {
                      const error = await runValidations(editableField, value);
                      return error === true || error === "" ? true : error;
                    },
                  }}
                  errors={errors}
                />
              </Box>
            )}
            {selectedAction == "forward" &&
              currentOfficer == "District Social Welfare Officer" && (
                <CustomFileSelector
                  key={"forwardFile"}
                  label={"Certificate By TSWO"}
                  name={"forwardFile"}
                  control={control}
                  accept={".pdf"}
                  rules={{ required: "This field is required" }}
                  errors={errors}
                />
              )}
            <CustomInputField
              name={"remarks"}
              label={"Remarks"}
              control={control}
              placeholder="Remarks"
              rules={{ required: "This field is required" }}
              errors={errors}
            />
            <CustomButton
              text="Take Action"
              onClick={handleSubmit(onSubmit)}
              bgColor="background.default"
              color="primary.main"
            />
          </Box>
        </Box>
        <Button
          variant="outlined"
          onClick={handleClose}
          sx={{ mt: 2, margin: "0 auto" }}
        >
          Close
        </Button>
      </Box>
    </Modal>
  );
};

export default ActionModal;
