import React from "react";
import { FormControlLabel, Checkbox, Box, Typography } from "@mui/material";
import { useController } from "react-hook-form";

export default function SectionSelectCheckboxes({
  formDetails,
  control,
  name,
  formatKey,
}) {
  const {
    field: { value = [], onChange },
  } = useController({ control, name });

  return (
    <Box>
      {Object.entries(formDetails).map(([sectionKey, fields]) => {
        const sectionFieldNames = fields.map((f) => f.name);
        const isSectionChecked = sectionFieldNames.every((fieldName) =>
          value.includes(fieldName)
        );

        return (
          <Box
            key={sectionKey}
            sx={{ mb: 2, border: "1px solid #ccc", p: 1, borderRadius: 1 }}
          >
            <FormControlLabel
              control={
                <Checkbox
                  checked={isSectionChecked}
                  onChange={(e) => {
                    if (e.target.checked) {
                      const newVal = [
                        ...new Set([...value, ...sectionFieldNames]),
                      ];
                      onChange(newVal);
                    } else {
                      const newVal = value.filter(
                        (v) => !sectionFieldNames.includes(v)
                      );
                      onChange(newVal);
                    }
                  }}
                  sx={{
                    color: "#312C51",
                    "&.Mui-checked": { color: "#312C51" },
                  }}
                />
              }
              label={
                <Typography variant="subtitle1" sx={{ fontWeight: "bold" }}>
                  {formatKey(sectionKey)}
                </Typography>
              }
            />
            <Box sx={{ ml: 4 }}>
              {fields.map((field) => {
                const isChecked = value.includes(field.name);
                return (
                  <FormControlLabel
                    key={field.name}
                    control={
                      <Checkbox
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            // If section is Location, select all fields in Location
                            if (sectionKey === "Location") {
                              const newVal = [
                                ...new Set([...value, ...sectionFieldNames]),
                              ];
                              onChange(newVal);
                            } else {
                              onChange([...value, field.name]);
                            }
                          } else {
                            // If section is Location, deselect all fields in Location
                            if (sectionKey === "Location") {
                              const newVal = value.filter(
                                (v) => !sectionFieldNames.includes(v)
                              );
                              onChange(newVal);
                            } else {
                              onChange(value.filter((v) => v !== field.name));
                            }
                          }
                        }}
                        sx={{
                          color: "#312C51",
                          "&.Mui-checked": { color: "#312C51" },
                        }}
                      />
                    }
                    label={field.label || field.name}
                  />
                );
              })}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
