import React, {
  useState,
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
} from "react";
import { Box, Typography } from "@mui/material";
import { Controller } from "react-hook-form";
import CustomButton from "../CustomButton";

const CustomFileSelector = forwardRef(
  ({ label, name, control, accept = "", value = "", rules = {} }, ref) => {
    const [preview, setPreview] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);
    const fileInputRef = useRef(null);

    if (!control) {
      console.error(
        "CustomFileSelector requires a valid control prop from react-hook-form."
      );
      return null;
    }

    // useEffect to set the preview when the value prop changes
    useEffect(() => {
      if (value !== "" && name === "ApplicantImage") {
        setPreview(value); // Set the preview to the value passed via props
      }
    }, [value, name]); // Run only when `value` or `name` changes

    const handleFileChange = (event, onChange) => {
      const file = event.target.files[0];
      setSelectedFile(file);
      onChange(file);

      if (file && file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onloadend = () => setPreview(reader.result);
        reader.readAsDataURL(file);
      } else {
        setPreview(null);
      }
    };

    // Expose functions to parent via ref
    useImperativeHandle(ref, () => ({
      triggerFileInput: () => {
        fileInputRef.current?.click();
      },
      setSelectedFile: (newFile) => {
        setSelectedFile(newFile);
      },
      setPreview: (newPreview) => {
        setPreview(newPreview);
      },
    }));

    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          mb: 2,
          border: "2px solid",
          borderColor: "background.default",
          borderRadius: 3,
          padding: 3,
        }}
      >
        {label && (
          <Typography
            sx={{ fontWeight: "bold", mb: 1, color: "background.default" }}
          >
            {label}
          </Typography>
        )}

        {/* File Input Field with Controller */}
        <Controller
          name={name}
          control={control}
          rules={rules}
          defaultValue={value}
          render={({ field, fieldState: { error } }) => (
            <Box>
              {/* Hidden file input */}
              <input
                type="file"
                accept={accept}
                onChange={(e) => handleFileChange(e, field.onChange)}
                style={{ display: "none" }}
                ref={fileInputRef}
                aria-labelledby={`${name}-label`}
              />
              <Box
                sx={{
                  display: "flex",
                  width: "max-content",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <CustomButton
                  component="span"
                  text="Choose File"
                  bgColor="background.paper"
                  color="primary.main"
                  onClick={() => fileInputRef.current?.click()}
                  aria-label={`Choose file for ${label}`}
                />

                {/* Show image preview if the file is an image, else show file name */}
                {preview ? (
                  <Box>
                    <img
                      src={preview}
                      alt="Preview"
                      style={{
                        width: "100px",
                        height: "100px",
                        objectFit: "cover",
                        borderRadius: "5px",
                      }}
                    />
                  </Box>
                ) : selectedFile ? (
                  <Typography
                    variant="body2"
                    sx={{
                      color: "background.default",
                      border: "2px solid #48426D",
                      padding: 2,
                      borderRadius: 5,
                    }}
                  >
                    {selectedFile.name}
                  </Typography>
                ) : null}
              </Box>

              {error && (
                <Typography variant="body2" sx={{ color: "red", mt: 1 }}>
                  {error.message}
                </Typography>
              )}
            </Box>
          )}
        />
      </Box>
    );
  }
);

export default CustomFileSelector;
