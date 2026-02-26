import React, { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { runValidations } from "../../assets/formvalidations";
import { Box, Checkbox, FormControlLabel } from "@mui/material";
import CustomButton from "../../components/CustomButton";
import {
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Button,
} from "@mui/material";
import { Col, Row } from "react-bootstrap";
import axiosInstance from "../../axiosConfig";

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

const DynamicScrollableForm = () => {
  const {
    control,
    handleSubmit,
    trigger,
    watch,
    getValues,
    setValue,
    formState: { errors },
  } = useForm({ mode: "onChange" });

  const [formSections, setFormSections] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState([]); // State for services list
  const [selectedServiceId, setSelectedServiceId] = useState(""); // State for selected service

  // State for checkbox
  const [isCopyAddressChecked, setIsCopyAddressChecked] = useState(false);

  // Fetch services on mount
  useEffect(() => {
    async function fetchServices() {
      const response = await axiosInstance.get("/Base/GetServices");
      console.log(response.data);
      setServices(response.data.services);
      setLoading(false);
    }
    fetchServices();
  }, []);

  // When a service is selected, parse its formElements config
  const handleServiceChange = (e) => {
    const serviceId = e.target.value;
    setSelectedServiceId(serviceId);
    const service = services.find((s) => s.serviceId === serviceId);
    if (service && service.formElement) {
      try {
        const config = JSON.parse(service.formElement);
        setFormSections(config);
      } catch (err) {
        console.error("Error parsing formElements:", err);
        setFormSections([]);
      }
    } else {
      setFormSections([]);
    }
  };

  // Copy address handler
  const handleCopyAddress = (checked, sectionIndex) => {
    if (checked) {
      // Find present address fields
      const presentSection = formSections.find(
        (sec) => sec.section === "Present Address Details"
      );

      const permanentSection = formSections.find(
        (sec) => sec.section === "Permanent Address Details"
      );

      const permanentDistrictField = permanentSection.fields.find((field) =>
        field.name.includes("District")
      );

      if (presentSection) {
        presentSection.fields.forEach((field) => {
          const presentFieldName = field.name;
          const permanentFieldName = presentFieldName.replace(
            "Present",
            "Permanent"
          );

          // Get present address value and set to permanent address
          const presentValue = getValues(presentFieldName);
          setValue(permanentFieldName, presentValue);
          if (permanentFieldName.includes("District")) {
            console.log(sectionIndex, permanentDistrictField, presentValue);
            handleDistrictChange(
              sectionIndex,
              permanentDistrictField,
              presentValue
            );
          }
        });
      }
    }
  };

  // When Next is pressed, trigger validation for all fields in the current step
  const handleNext = async () => {
    const currentFieldNames = formSections[currentStep].fields.map(
      (field) => field.name
    );
    const valid = await trigger(currentFieldNames);
    if (valid) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    setCurrentStep((prev) => prev - 1);
  };

  const onSubmit = (data) => {
    const sectionWiseData = {};

    // Recursive function to handle nested additional fields
    const processField = (field, data, sectionData) => {
      // Add current field
      sectionData.push({
        label: field.label,
        value: data[field.name] || "",
      });

      // Check for additional fields
      if (field.additionalFields) {
        const selectedValue = data[field.name];
        const additionalFields = field.additionalFields[selectedValue];

        if (additionalFields) {
          additionalFields.forEach((additionalField) => {
            // Generate the nested field name
            const nestedFieldName =
              additionalField.name || `${field.name}_${additionalField.id}`;

            // Recursively process nested additional fields
            processField(
              {
                ...additionalField,
                name: nestedFieldName,
              },
              data,
              sectionData
            );
          });
        }
      }
    };

    formSections.forEach((section) => {
      const sectionData = [];
      section.fields.forEach((field) => {
        // Process main field and any nested additional fields
        processField(field, data, sectionData);
      });

      sectionWiseData[section.section] = sectionData;
    });

    console.log("Final structured data:", sectionWiseData);
    // Submit sectionWiseData to your API here
  };

  // When a district field changes, fetch tehsils and update the corresponding tehsil field's options
  const handleDistrictChange = async (sectionIndex, districtField, value) => {
    try {
      const response = await fetch(
        `/Base/GetTeshilForDistrict?districtId=${value}`
      );
      const data = await response.json();
      if (data.status && data.tehsils) {
        const newOptions = data.tehsils.map((tehsil) => ({
          value: tehsil.tehsilId,
          label: tehsil.tehsilName,
        }));

        setFormSections((prevSections) => {
          const newSections = [...prevSections];
          const section = newSections[sectionIndex];
          // Assume the tehsil field's name is derived by replacing "District" with "Tehsil"
          const tehsilFieldName = districtField.name.replace(
            "District",
            "Tehsil"
          );
          section.fields = section.fields.map((field) => {
            if (field.name === tehsilFieldName) {
              return { ...field, options: newOptions };
            }
            return field;
          });
          return newSections;
        });
      }
    } catch (error) {
      console.error("Error fetching tehsils:", error);
    }
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
                    ? field.maxLength // Replace with your actual max length value
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
              validate: async (value) => await runValidations(field, value),
            }}
            render={({ field: { onChange, value, ref } }) => {
              const isDistrict =
                field.name.toLowerCase().includes("district") || false;
              let options;
              if (field.optionsType == "dependent" && field.dependentOn) {
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
                      if (isDistrict) {
                        handleDistrictChange(
                          sectionIndex,
                          field,
                          e.target.value
                        );
                      }
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
                  {
                    // Render additional fields if this select option has extra fields.
                    field.additionalFields &&
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
                      })
                  }
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
            // Adjust composite validation as needed.
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
                      const isDistrict =
                        field.name.toLowerCase().includes("district") || false;
                      if (isDistrict) {
                        handleDistrictChange(
                          sectionIndex,
                          field,
                          e.target.value
                        );
                      }
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
  if (loading) return <div>Loading form...</div>;

  return (
    <Box
      sx={{
        width: "50vw",
        height: "auto",
        display: "flex",
        margin: "0 auto",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#F0C38E",
        borderRadius: 5,
        color: "#312C51",
        padding: 10,
      }}
    >
      <form onSubmit={handleSubmit(onSubmit)} style={{ width: "100%" }}>
        {/* Service selection dropdown - Always show this */}
        <FormControl fullWidth sx={{ mb: 3 }}>
          <InputLabel id="service-select-label">Select Service</InputLabel>
          <Select
            labelId="service-select-label"
            value={selectedServiceId}
            label="Select Service"
            onChange={handleServiceChange}
            sx={{ border: "2px solid #312C51", color: "#312C51" }}
          >
            {services.map((service) => (
              <MenuItem key={service.serviceId} value={service.serviceId}>
                {service.serviceName}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Show form sections only if they exist */}
        {formSections.length > 0 ? (
          <>
            {/* Current step content */}
            {formSections.map((section, index) => {
              if (index !== currentStep) return null;
              return (
                <div key={section.id}>
                  <h2>{section.section}</h2>
                  {section.section === "Permanent Address Details" && (
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={isCopyAddressChecked}
                          onChange={(e) => {
                            setIsCopyAddressChecked(e.target.checked);
                            handleCopyAddress(e.target.checked, index);
                          }}
                        />
                      }
                      label="Same As Present Address"
                    />
                  )}
                  <Row>
                    {section.fields.map((field) => (
                      <Col xs={12} lg={field.span} key={field.id}>
                        <Box sx={{ display: "flex", flexDirection: "column" }}>
                          {renderField(field, index)}
                        </Box>
                      </Col>
                    ))}
                  </Row>
                </div>
              );
            })}

            {/* Navigation buttons */}
            <Box
              sx={{ display: "flex", justifyContent: "center", marginTop: 5 }}
            >
              {currentStep > 0 && (
                <CustomButton
                  text="Previous"
                  bgColor="#312C51"
                  color="#F0C38E"
                  width={"40%"}
                  onClick={handlePrev}
                />
              )}
              {currentStep < formSections.length - 1 && (
                <CustomButton
                  text="Next"
                  bgColor="#312C51"
                  color="#F0C38E"
                  width={"40%"}
                  onClick={handleNext}
                />
              )}
              {currentStep === formSections.length - 1 && (
                <CustomButton
                  text="Submit"
                  bgColor="#312C51"
                  color="#F0C38E"
                  width={"40%"}
                  type="submit"
                />
              )}
            </Box>
          </>
        ) : (
          /* Show message only after services are loaded and no form config */
          !loading && <div>No form configuration available.</div>
        )}
      </form>
    </Box>
  );
};

export default DynamicScrollableForm;
