import React from "react";
import { FormControlLabel, Checkbox, Box, Typography } from "@mui/material";
import { useController } from "react-hook-form";

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

  const allFieldNames = React.useMemo(() => {
    const names = [];
    Object.values(formDetails || {}).forEach((fields) => {
      flattenSection(fields).forEach((f) => names.push(f.name));
    });
    return [...new Set(names)];
  }, [formDetails]);

  const isAllSelected =
    allFieldNames.length > 0 && allFieldNames.every((n) => value.includes(n));

  const isPartiallySelected =
    !isAllSelected && allFieldNames.some((n) => value.includes(n));

  const handleToggleAll = (checked) => {
    if (checked) {
      onChange([...new Set([...value, ...allFieldNames])]);
    } else {
      onChange(value.filter((v) => !allFieldNames.includes(v)));
    }
  };

  return (
    <Box>
      {/* Select All Checkbox */}
      {allFieldNames.length > 0 && (
        <FormControlLabel
          sx={{ mb: 1 }}
          control={
            <Checkbox
              checked={isAllSelected}
              indeterminate={isPartiallySelected}
              onChange={(e) => handleToggleAll(e.target.checked)}
              sx={{
                color: "#312C51",
                "&.Mui-checked": { color: "#312C51" },
                "&.MuiCheckbox-indeterminate": { color: "#312C51" },
              }}
            />
          }
          label={
            <Typography variant="subtitle1" sx={{ fontWeight: "bold" }}>
              Select All
            </Typography>
          }
        />
      )}

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
