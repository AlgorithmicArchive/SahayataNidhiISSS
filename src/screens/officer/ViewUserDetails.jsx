import { Box } from "@mui/system";
import React, { useEffect, useState, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { fetchUserDetail } from "../../assets/fetch";
import { Col, Row } from "react-bootstrap";
import {
  Button,
  Checkbox,
  Collapse,
  Divider,
  FormControl,
  FormControlLabel,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import { formatKey, runValidations } from "../../assets/formvalidations";
import { Controller, useForm } from "react-hook-form";
import CustomButton from "../../components/CustomButton";
import axiosInstance from "../../axiosConfig";
import BasicModal from "../../components/BasicModal";
import SectionSelectCheckboxes from "../../components/SectionSelectCheckboxes";

// Updated CollapsibleFormDetails accepts an onViewPdf prop
const CollapsibleFormDetails = ({
  formDetails,
  formatKey,
  detailsOpen,
  setDetailsOpen,
  onViewPdf,
}) => {
  // Transform formDetails (object) to an array of sections if needed.
  const sections = useMemo(() => {
    return Array.isArray(formDetails)
      ? formDetails
      : Object.entries(formDetails).map(([key, value]) => ({ [key]: value }));
  }, [formDetails]);

  return (
    <>
      {/* <Button
        onClick={() => setDetailsOpen((prev) => !prev)}
        sx={{
          backgroundColor: "divider",
          color: "text.primary",
          fontWeight: "bold",
        }}
      >
        {detailsOpen ? "Collapse" : "Expand"} Details
      </Button> */}
      <Collapse in={detailsOpen}>
        <Box
          sx={{
            width: "60%",
            maxHeight: "20%",
            overflowY: "auto",
            border: "2px solid #CCA682",
            borderRadius: 5,
            padding: 5,
            backgroundColor: "background.default",
            margin: { lg: "0 auto" },
          }}
        >
          {sections.map((section, index) => (
            <Box key={index} sx={{ marginBottom: 4 }}>
              {/* SECTION NAME */}
              <Typography
                variant="h6"
                sx={{
                  fontWeight: "bold",
                  marginBottom: 2,
                  borderColor: "divider",
                  borderBottom: "1px solid",
                  paddingBottom: 1,
                }}
              >
                {Object.keys(section)[0]}
              </Typography>

              <Row>
                {Object.entries(section).map(([sectionName, fields]) =>
                  fields.map((field, fieldIndex) => (
                    <Col
                      xs={12}
                      lg={6}
                      key={fieldIndex}
                      style={{ marginBottom: 10 }}
                    >
                      <Box sx={{ display: "flex", flexDirection: "column" }}>
                        <Typography
                          variant="subtitle2"
                          sx={{
                            fontSize: 14,
                            fontWeight: "bold",
                            width: "250px",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {field.label || field.name}
                        </Typography>

                        {/* Render file/image fields differently */}
                        {field.File && field.File !== "" ? (
                          field.File.toLowerCase().match(
                            /\.(jpg|jpeg|png|gif)$/
                          ) ? (
                            // Image Field
                            <Box
                              component="img"
                              src={field.File}
                              alt={field.label}
                              sx={{
                                width: "100%",
                                maxHeight: 200,
                                objectFit: "contain",
                                borderRadius: 2,
                                borderColor: "divider",
                                border: "1px solid",
                                padding: 1,
                                mt: 1,
                              }}
                            />
                          ) : (
                            // Document (PDF) Field
                            <Box sx={{ mt: 1 }}>
                              <Button
                                variant="outlined"
                                onClick={() => onViewPdf(field.File)}
                              >
                                View Document
                              </Button>
                              {field.Enclosure && (
                                <Typography
                                  variant="caption"
                                  display="block"
                                  sx={{ mt: 1 }}
                                >
                                  Enclosure: {field.Enclosure}
                                </Typography>
                              )}
                            </Box>
                          )
                        ) : (
                          // Regular text fields
                          <Typography
                            variant="body1"
                            sx={{
                              border: "1px solid",
                              borderColor: "divider",
                              borderRadius: 3,
                              padding: 2,
                              mt: 1,
                            }}
                          >
                            {field.value !== undefined && field.value !== null
                              ? field.value
                              : "--"}
                          </Typography>
                        )}
                      </Box>
                    </Col>
                  ))
                )}
              </Row>

              <Divider
                orientation="horizontal"
                sx={{ borderColor: "divider", my: 5 }}
              />
            </Box>
          ))}
        </Box>
      </Collapse>
    </>
  );
};

const commonStyles = {
  "& .MuiOutlinedInput-root": {
    "& fieldset": { borderColor: "#312C51" },
    "&:hover fieldset": { borderColor: "#312C51" },
    "&.Mui-focused fieldset": { borderColor: "#312C51" },
  },
  "& .MuiInputLabel-root": { color: "#312C51" },
  "& .MuiInputBase-input::placeholder": { color: "#312C51" },
  color: "#312C51",
};

export default function ViewUserDetails() {
  const location = useLocation();
  const { applicationId } = location.state || {};
  // Initialize formDetails as an object (if that's what fetchUserDetail returns)
  const [formDetails, setFormDetails] = useState({});
  const [actionForm, setActionForm] = useState([]);
  // State for collapsing details
  const [detailsOpen, setDetailsOpen] = useState(true);
  // State for PDF modal
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState("");
  const navigate = useNavigate();
  const {
    control,
    handleSubmit,
    watch,
    getValues,
    formState: { errors },
  } = useForm({ mode: "onChange" });

  useEffect(() => {
    // fetchUserDetail is assumed to set both formDetails and actionForm
    fetchUserDetail(applicationId, setFormDetails, setActionForm);
  }, [applicationId]);

  // Function to handle PDF viewing
  const handleViewPdf = (url) => {
    setPdfUrl(url);
    setPdfModalOpen(true);
  };

  // Render an individual field using Controller
  const renderField = (field, sectionIndex) => {
    switch (field.type) {
      case "text":
      case "email":
      case "date":
        return (
          <Controller
            name={field.name}
            control={control}
            defaultValue={""}
            rules={{
              validate: async (value) =>
                await runValidations(field, value, getValues()),
            }}
            render={({ field: { onChange, value, ref } }) => (
              <TextField
                type={field.type}
                id={field.id}
                label={field.label}
                value={value || ""}
                onChange={onChange}
                inputRef={ref}
                error={Boolean(errors[field.name])}
                helperText={errors[field.name]?.message || ""}
                fullWidth
                margin="normal"
                inputProps={{
                  maxLength: field.validationFunctions?.includes(
                    "specificLength"
                  )
                    ? field.maxLength
                    : undefined,
                }}
                sx={{
                  ...commonStyles,
                  "& .MuiInputBase-input": { color: "#312C51" },
                }}
              />
            )}
          />
        );

      case "file":
        return (
          <Controller
            name={field.name}
            control={control}
            defaultValue={null}
            rules={{
              validate: async (value) => await runValidations(field, value),
            }}
            render={({ field: { onChange, ref } }) => (
              <FormControl
                fullWidth
                margin="normal"
                error={Boolean(errors[field.name])}
                sx={commonStyles}
              >
                <Button
                  variant="contained"
                  component="label"
                  sx={{ backgroundColor: "#312C51", color: "#fff" }}
                >
                  {field.label}
                  <input
                    type="file"
                    hidden
                    onChange={(e) => onChange(e.target.files[0])}
                    ref={ref}
                    accept={field.accept}
                  />
                </Button>
                <FormHelperText>
                  {errors[field.name]?.message || ""}
                </FormHelperText>
              </FormControl>
            )}
          />
        );

      case "select":
        return (
          <Controller
            name={field.name}
            control={control}
            defaultValue={field.options[0]?.value || ""}
            rules={{
              validate: async (value) =>
                await runValidations(field, value, getValues()),
            }}
            render={({ field: { onChange, value, ref } }) => {
              const districtFields = [
                "district",
                "presentdistrict",
                "permanentdistrict",
              ];
              const normalizedFieldName = field.name
                .toLowerCase()
                .replace(/\s/g, "");
              const isDistrict = districtFields.includes(normalizedFieldName);
              let options;
              if (field.optionsType === "dependent" && field.dependentOn) {
                const parentValue = watch(field.dependentOn);
                options =
                  field.dependentOptions && field.dependentOptions[parentValue]
                    ? field.dependentOptions[parentValue]
                    : [];
              } else options = field.options;
              return (
                <FormControl
                  fullWidth
                  margin="normal"
                  error={Boolean(errors[field.name])}
                  sx={commonStyles}
                >
                  <InputLabel id={`${field.id}-label`}>
                    {field.label}
                  </InputLabel>
                  <Select
                    labelId={`${field.id}-label`}
                    id={field.id}
                    value={value || ""}
                    label={field.label}
                    onChange={(e) => {
                      onChange(e);
                    }}
                    inputRef={ref}
                    sx={{
                      "& .MuiOutlinedInput-notchedOutline": {
                        borderColor: "#312C51",
                      },
                      color: "#312C51",
                    }}
                  >
                    {options.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                  <FormHelperText>
                    {errors[field.name]?.message || ""}
                  </FormHelperText>
                  {field.additionalFields &&
                    field.additionalFields[value] &&
                    field.additionalFields[value].map((additionalField) => {
                      const additionalFieldName =
                        additionalField.name ||
                        `${field.name}_${additionalField.id}`;
                      return (
                        <div
                          key={additionalField.id}
                          style={{ marginBottom: 16 }}
                        >
                          <InputLabel
                            htmlFor={additionalField.id}
                            sx={{ color: "#312C51" }}
                          >
                            {additionalField.label}
                          </InputLabel>
                          {renderField(
                            { ...additionalField, name: additionalFieldName },
                            sectionIndex
                          )}
                        </div>
                      );
                    })}
                </FormControl>
              );
            }}
          />
        );

      case "enclosure":
        return (
          <Controller
            name={field.name}
            control={control}
            defaultValue={{
              selected: field.options[0]?.value || "",
              file: null,
            }}
            rules={{}}
            render={({ field: { onChange, value, ref } }) => {
              return (
                <FormControl
                  fullWidth
                  margin="normal"
                  error={Boolean(errors[field.name])}
                  sx={commonStyles}
                >
                  <InputLabel id={`${field.id}_select-label`}>
                    {field.label}
                  </InputLabel>
                  <Select
                    labelId={`${field.id}_select-label`}
                    id={`${field.id}_select`}
                    value={value.selected || ""}
                    label={field.label}
                    onChange={(e) => {
                      const newVal = { ...value, selected: e.target.value };
                      onChange(newVal);
                    }}
                    inputRef={ref}
                    sx={{
                      "& .MuiOutlinedInput-notchedOutline": {
                        borderColor: "#312C51",
                      },
                      color: "#312C51",
                    }}
                  >
                    {field.options.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                  <FormHelperText>
                    {errors[field.name]?.message || ""}
                  </FormHelperText>
                  <Button
                    variant="contained"
                    component="label"
                    sx={{ mt: 2, backgroundColor: "#312C51", color: "#fff" }}
                  >
                    Upload File
                    <input
                      type="file"
                      hidden
                      onChange={(e) => {
                        const file = e.target.files[0];
                        onChange({ ...value, file });
                      }}
                      accept={field.accept}
                    />
                  </Button>
                </FormControl>
              );
            }}
          />
        );

      default:
        return null;
    }
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 3,
      }}
    >
      <Typography variant="h3">USER DETAILS</Typography>
      <CollapsibleFormDetails
        formDetails={formDetails}
        formatKey={formatKey}
        detailsOpen={detailsOpen}
        setDetailsOpen={setDetailsOpen}
        onViewPdf={handleViewPdf}
      />
      {/* PDF Modal - displays pdf inside modal */}
      <BasicModal
        open={pdfModalOpen}
        handleClose={() => setPdfModalOpen(false)}
        Title="Document Viewer"
        pdf={pdfUrl}
      />
    </Box>
  );
}
