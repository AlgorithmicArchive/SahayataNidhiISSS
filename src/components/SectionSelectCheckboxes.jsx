import React from "react";
import { FormControlLabel, Checkbox, Box, Typography } from "@mui/material";
import { useController } from "react-hook-form";

// additionalFields arrives in TWO shapes:
//   spec   : { "Urban": [ {...}, ... ], "Rural": [ ... ] }
//   fetched: [ { name, label, value }, ... ]
// Flatten both into a plain array of sub-fields.
const getNestedFields = (additionalFields) => {
  if (!additionalFields) return [];
  if (Array.isArray(additionalFields)) return additionalFields;
  if (typeof additionalFields === "object") {
    return Object.values(additionalFields).flatMap((v) =>
      Array.isArray(v) ? v : [],
    );
  }
  return [];
};

// Recursively flatten a section's fields into { name, label, depth }.
// Names are unique within a section, so we can key checkboxes by name.
const flattenSection = (fields, depth = 0) => {
  const out = [];
  (fields || []).forEach((field) => {
    if (!field?.name) return;
    out.push({
      name: field.name,
      label: field.label || field.name,
      depth,
    });
    const nested = getNestedFields(field.additionalFields);
    if (nested.length > 0) {
      out.push(...flattenSection(nested, depth + 1));
    }
  });
  return out;
};

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
      {Object.entries(formDetails || {}).map(([sectionKey, fields]) => {
        const flat = flattenSection(fields);
        const sectionNames = flat.map((f) => f.name);
        const isSectionChecked =
          sectionNames.length > 0 &&
          sectionNames.every((n) => value.includes(n));

        return (
          <Box
            key={sectionKey}
            sx={{ mb: 2, border: "1px solid #ccc", p: 1, borderRadius: 1 }}
          >
            {/* Section-level checkbox — toggles every field, including nested */}
            <FormControlLabel
              control={
                <Checkbox
                  checked={isSectionChecked}
                  onChange={(e) => {
                    if (e.target.checked) {
                      onChange([...new Set([...value, ...sectionNames])]);
                    } else {
                      onChange(value.filter((v) => !sectionNames.includes(v)));
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
              {flat.map(({ name: fieldName, label, depth }) => {
                const isChecked = value.includes(fieldName);

                return (
                  <Box
                    key={fieldName}
                    sx={{
                      ml: depth * 3,
                      pl: depth > 0 ? 1 : 0,
                      borderLeft: depth > 0 ? "2px dashed #d1d5db" : "none",
                    }}
                  >
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={isChecked}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            if (checked) {
                              // Preserve existing Location behaviour
                              if (sectionKey === "Location") {
                                onChange([
                                  ...new Set([...value, ...sectionNames]),
                                ]);
                              } else {
                                onChange([...new Set([...value, fieldName])]);
                              }
                            } else {
                              if (sectionKey === "Location") {
                                onChange(
                                  value.filter(
                                    (v) => !sectionNames.includes(v),
                                  ),
                                );
                              } else {
                                onChange(value.filter((v) => v !== fieldName));
                              }
                            }
                          }}
                          sx={{
                            color: "#312C51",
                            "&.Mui-checked": { color: "#312C51" },
                          }}
                        />
                      }
                      label={
                        <Typography
                          variant="body2"
                          sx={{
                            fontSize: depth > 0 ? "0.85rem" : "0.95rem",
                            color:
                              depth > 0 ? "text.secondary" : "text.primary",
                          }}
                        >
                          {label}
                        </Typography>
                      }
                    />
                  </Box>
                );
              })}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
