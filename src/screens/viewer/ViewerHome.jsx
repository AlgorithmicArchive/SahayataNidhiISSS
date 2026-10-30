import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  useLayoutEffect,
  useMemo,
} from "react";
import GovPageHeader from "../../components/gov/GovPageHeader";
import {
  Box,
  Typography,
  TextField,
  MenuItem,
  Button,
  CircularProgress,
  Grid,
  Paper,
  Container,
  Divider,
  Stack,
  InputLabel,
  FormControl,
  Select,
  useMediaQuery,
  IconButton, // Added for clear button
} from "@mui/material";
import {
  AssignmentTurnedIn,
  CheckCircle,
  Cancel,
  HourglassEmpty,
  Group,
  ArrowForward,
  FilterList,
  Refresh,
  Assessment,
  ErrorOutline,
  LocationCity,
  Public,
  Map,
  Home,
  Clear, // Added for clear button
} from "@mui/icons-material";
import { useTheme } from "@mui/material/styles";
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import axiosInstance from "../../axiosConfig";
import ServerSideTable from "../../components/ServerSideTable";
import BasicModal from "../../components/BasicModal";

// === STATUS COLORS (Muted, Professional Palette) ===
const STATUS_COLORS = {
  "Applications Received": "#475569", // Slate
  Sanctioned: "#10B981", // Emerald
  "Under Process": "#F59E0B", // Amber
  "Pending with Citizen": "#8B5CF6", // Violet
  Rejected: "#EF4444", // Red
  "Eligible for Pension": "#10B981", // Emerald
  "Not Eligible (Withheld)": "#EF4444", // Red
};
const getColor = (title) => STATUS_COLORS[title] || "#475569";

// === INDIAN GOVERNMENT THEME (GIGW) ===
const GOV_NAVY = "#17418F"; // Deep government navy (Header/Footer)
const GOV_NAVY_DARK = "#0F2640"; // Headings / large numbers
const INDIA_SAFFRON = "#FF9933"; // Tiranga — Kesariya
const INDIA_GREEN = "#138808"; // Tiranga — Hara
// Tiranga bar used as top accent on the main dashboard panel
const TRICOLOR_BAR = `linear-gradient(to right, ${INDIA_SAFFRON} 0%, ${INDIA_SAFFRON} 33.333%, #FFFFFF 33.333%, #FFFFFF 66.666%, ${INDIA_GREEN} 66.666%, ${INDIA_GREEN} 100%)`;

// === ICON MAPS ===
const iconMap = {
  "Applications Received": AssignmentTurnedIn,
  Sanctioned: CheckCircle,
  "Under Process": HourglassEmpty,
  "Pending with Citizen": Group,
  Rejected: Cancel,
  "Eligible for Pension": CheckCircle,
  "Not Eligible (Withheld)": Cancel,
};
const filterIcons = {
  Service: Assessment,
  State: Public,
  Division: LocationCity,
  District: Map,
  Tehsil: Home,
};

// === DEFAULT DATA ===
const defaultCardData = [
  { title: "Applications Received", value: "0", category: "application" },
  { title: "Sanctioned", value: "0", category: "application" },
  { title: "Under Process", value: "0", category: "application" },
  { title: "Pending with Citizen", value: "0", category: "application" },
  { title: "Rejected", value: "0", category: "application" },
  { title: "Eligible for Pension", value: "0", category: "application" },
  { title: "Not Eligible (Withheld)", value: "0", category: "application" },
];

// === FILTERS HOOK ===
const useFilters = (category) => {
  const [state, setState] = useState("0");
  const [division, setDivision] = useState("");
  const [districts, setDistricts] = useState([]);
  const [district, setDistrict] = useState("");
  const [tehsils, setTehsils] = useState([]);
  const [tehsil, setTehsil] = useState("");
  const [wise, setWise] = useState("State");
  const [wiseName, setWiseName] = useState("Jammu & Kashmir");
  const [filterLoading, setFilterLoading] = useState(false);

  const resetFilters = useCallback(() => {
    setState("0");
    setDivision("");
    setDistrict("");
    setTehsil("");
    setDistricts([]);
    setTehsils([]);
    setWise("State");
    setWiseName("Jammu & Kashmir");
  }, []);

  // NEW: Clear individual filter and cascade reset to dependent filters
  const clearFilter = useCallback(
    (type) => {
      if (type === "State") {
        setState("0");
        setDivision("");
        setDistrict("");
        setTehsil("");
        setDistricts([]);
        setTehsils([]);
        setWise("State");
        setWiseName("Jammu & Kashmir");
      } else if (type === "Division") {
        setDivision("");
        setDistrict("");
        setTehsil("");
        setDistricts([]);
        setTehsils([]);
        setWise("State");
        setWiseName("Jammu & Kashmir");
      } else if (type === "District") {
        setDistrict("");
        setTehsil("");
        setTehsils([]);
        if (division) {
          setWise("Division");
          setWiseName(division === "1" ? "Jammu" : "Kashmir");
        } else {
          setWise("State");
          setWiseName("Jammu & Kashmir");
        }
      } else if (type === "Tehsil") {
        setTehsil("");
        if (district) {
          setWise("District");
          setWiseName(
            districts.find((d) => d.value === district)?.label || "District",
          );
        } else if (division) {
          setWise("Division");
          setWiseName(division === "1" ? "Jammu" : "Kashmir");
        } else {
          setWise("State");
          setWiseName("Jammu & Kashmir");
        }
      }
    },
    [division, district, districts],
  );

  const getFilterTitle = (type, value) => {
    if (!value) return type;
    if (type === "State") return value === "0" ? "Jammu & Kashmir" : type;
    if (type === "Division")
      return value === "1" ? "Jammu" : value === "2" ? "Kashmir" : type;
    if (type === "District")
      return districts.find((d) => d.value === value)?.label || type;
    if (type === "Tehsil")
      return tehsils.find((t) => t.value === value)?.label || type;
    return type;
  };

  useEffect(() => {
    const fetchDistricts = async () => {
      if (division) {
        setFilterLoading(true);
        try {
          const res = await axiosInstance.get("/Base/GetDistricts", {
            params: { division },
          });
          setDistricts(
            res.data.districts.map((d) => ({
              label: d.districtname,
              value: d.districtid,
            })),
          );
          setDistrict("");
          setTehsils([]);
          setTehsil("");
        } catch (err) {
          setDistricts([]);
        } finally {
          setFilterLoading(false);
        }
      } else {
        setDistricts([]);
        setDistrict("");
        setTehsils([]);
        setTehsil("");
      }
    };
    fetchDistricts();
  }, [division, category]);

  useEffect(() => {
    const fetchTehsils = async () => {
      if (district) {
        setFilterLoading(true);
        try {
          const res = await axiosInstance.get("/Base/GetTeshilForDistrict", {
            params: { districtId: district },
          });
          setTehsils(
            res.data.tehsils.map((t) => ({
              label: t.tehsilname,
              value: t.tehsilid,
            })),
          );
          setTehsil("");
        } catch (err) {
          setTehsils([]);
        } finally {
          setFilterLoading(false);
        }
      } else {
        setTehsils([]);
        setTehsil("");
      }
    };
    fetchTehsils();
  }, [district, category]);

  useEffect(() => {
    if (tehsil) {
      setWise("Tehsil");
      setWiseName(tehsils.find((t) => t.value === tehsil)?.label || "Tehsil");
    } else if (district) {
      setWise("District");
      setWiseName(
        districts.find((d) => d.value === district)?.label || "District",
      );
    } else if (division) {
      setWise("Division");
      setWiseName(division === "1" ? "Jammu" : "Kashmir");
    } else {
      setWise("State");
      setWiseName("Jammu & Kashmir");
    }
  }, [division, district, tehsil, districts, tehsils]);

  return {
    state,
    setState,
    division,
    setDivision,
    district,
    setDistrict,
    tehsil,
    setTehsil,
    districts,
    tehsils,
    wise,
    wiseName,
    filterLoading,
    resetFilters,
    getFilterTitle,
    clearFilter, // Exported for individual reset
  };
};

// === DASHBOARD DATA HOOK ===
const useDashboardData = (category, filters, serviceId) => {
  const [data, setData] = useState(
    defaultCardData.filter((c) => c.category === category),
  );
  const [categoryData, setCategoryData] = useState([]);
  const [locationData, setLocationData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = {
        serviceId: serviceId || "1", // Dynamic serviceId
        division: filters.division || null,
        district: filters.district || null,
        tehsil: filters.tehsil || null,
      };
      const res = await axiosInstance.get("/Viewer/GetApplicationStatus", {
        params,
      });
      const filtered = res.data.dataList.filter((c) => c.category === category);
      setData(
        filtered.map((card) => ({ ...card, color: getColor(card.title) })),
      );
      setCategoryData(res.data.categoryData || []);
      setLocationData(res.data.locationData || []);
    } catch (err) {
      setError(`Failed to load data`);
      setData(
        defaultCardData
          .filter((c) => c.category === category)
          .map((c) => ({ ...c, color: getColor(c.title) })),
      );
    } finally {
      setIsLoading(false);
    }
  }, [filters.division, filters.district, filters.tehsil, category, serviceId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);
  return { data, categoryData, locationData, isLoading, error };
};

// === ACCESSIBILITY HELPERS ===
const useFitCountFont = (value, maxPx) => {
  const ref = useRef(null);
  const [fittedPx, setFittedPx] = useState(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const text = String(value || "0");

    const fit = () => {
      if (!el) return;
      const avail = el.parentElement
        ? el.parentElement.clientWidth
        : el.clientWidth;
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const widthAt = (px) => {
        ctx.font = `800 ${px}px 'Inter', 'Roboto', 'Helvetica', 'Arial', sans-serif`;
        return ctx.measureText(text).width;
      };
      const big = widthAt(maxPx);
      const next = big > avail ? Math.floor((avail * maxPx) / big) : maxPx;
      setFittedPx(Math.max(12, Math.min(maxPx, next)));
    };

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el.parentElement || el);
    document.fonts?.ready?.then(fit).catch(() => {});
    return () => ro.disconnect();
  }, [value, maxPx]);

  return { ref, fittedPx };
};

const getTextColorOn = (hex) => {
  const h = (hex || "#475569").replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? GOV_NAVY_DARK : "#FFFFFF";
};

// === SOLID COLOUR GOVERNMENT STAT CARD ===
const ModernStatCard = ({ card, onCardClick }) => {
  const Icon = iconMap[card.title] || AssignmentTurnedIn;
  const color = card.color || "#475569";
  const textColor = getTextColorOn(color);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { ref: countRef, fittedPx } = useFitCountFont(
    card.value,
    isMobile ? 34 : 44,
  );

  return (
    <Paper
      elevation={0}
      onClick={() => onCardClick(card.title, card.category)}
      sx={{
        position: "relative",
        overflow: "hidden",
        p: { xs: 3, sm: 3.5 },
        borderRadius: 2,
        border: "2px solid rgba(255,255,255,0.45)",
        cursor: "pointer",
        transition: "all 0.2s ease",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        bgcolor: color,
        boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
        "&:hover": {
          filter: "brightness(1.08)",
          boxShadow: `0 8px 28px ${color}66, 0 12px 40px rgba(0,0,0,0.25)`,
          transform: "translateY(-2px)",
        },
      }}
    >
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          mb: 2,
        }}
      >
        <Typography
          variant="body2"
          sx={{
            color: textColor,
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: 0.6,
            fontSize: { xs: "0.75rem", sm: "0.85rem" },
            lineHeight: 1.4,
            maxWidth: "72%",
          }}
        >
          {card.title}
        </Typography>
        <Box
          sx={{
            width: { xs: 42, sm: 50 },
            height: { xs: 42, sm: 50 },
            borderRadius: 2,
            bgcolor: "rgba(255,255,255,0.20)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon sx={{ fontSize: { xs: 22, sm: 28 }, color: textColor }} />
        </Box>
      </Box>

      <Box>
        <Typography
          variant={isMobile ? "h5" : "h4"}
          ref={countRef}
          sx={{
            fontWeight: 800,
            color: textColor,
            lineHeight: 1.1,
            mb: 1.5,
            fontFamily: "'Inter', 'Roboto', 'Helvetica', 'Arial', sans-serif",
            whiteSpace: "nowrap",
          }}
          style={fittedPx ? { fontSize: `${fittedPx}px` } : undefined}
        >
          {card.value || "0"}
        </Typography>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            color: textColor,
            fontWeight: 700,
            fontSize: { xs: "0.85rem", sm: "0.95rem" },
          }}
        >
          View Details <ArrowForward sx={{ fontSize: { xs: 17, sm: 19 } }} />
        </Box>
      </Box>
    </Paper>
  );
};

// === COMBINED PENSION ELIGIBILITY CARD ===
const PensionEligibilityCard = ({
  eligible,
  withheld,
  onEligibleClick,
  onWithheldClick,
}) => {
  const bgColor = GOV_NAVY;
  const textColor = "#FFFFFF";

  return (
    <Paper
      elevation={0}
      sx={{
        position: "relative",
        overflow: "hidden",
        p: { xs: 2, sm: 3 },
        borderRadius: 2,
        border: "2px solid rgba(255,255,255,0.45)",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        bgcolor: bgColor,
        boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
        transition: "all 0.2s ease",
        "&:hover": {
          filter: "brightness(1.08)",
          boxShadow: `0 8px 28px ${bgColor}66, 0 12px 40px rgba(0,0,0,0.25)`,
          transform: "translateY(-2px)",
        },
      }}
    >
      <Typography
        variant="subtitle1"
        sx={{
          fontWeight: 800,
          color: textColor,
          mb: 2,
          textAlign: "center",
          textTransform: "uppercase",
          letterSpacing: 0.6,
          fontSize: { xs: "0.75rem", sm: "0.85rem" },
        }}
      >
        Pension Eligibility
      </Typography>

      <Box sx={{ display: "flex", width: "100%", height: "100%" }}>
        <Box
          sx={{
            flex: 1,
            textAlign: "center",
            cursor: "pointer",
            borderRight: "1px solid rgba(255,255,255,0.2)",
            pr: 1,
            "&:hover": { bgcolor: "rgba(255,255,255,0.1)" },
            borderRadius: 1,
            transition: "background-color 0.2s",
            minWidth: 0,
          }}
          onClick={onEligibleClick}
        >
          <CheckCircle
            sx={{ fontSize: { xs: 28, sm: 36 }, color: "#34D399", mb: 0.5 }}
          />
          <Typography
            variant="h5"
            sx={{
              fontWeight: 800,
              color: textColor,
              lineHeight: 1.1,
              fontFamily: "'Inter', sans-serif",
              fontSize: { xs: "1.5rem", sm: "2rem" },
              wordBreak: "break-word",
            }}
          >
            {eligible?.value || "0"}
          </Typography>
          <Typography
            variant="body2"
            sx={{
              color: "rgba(255,255,255,0.9)",
              fontWeight: 700,
              mt: 0.5,
              fontSize: { xs: "0.7rem", sm: "0.8rem" },
              lineHeight: 1.2,
            }}
          >
            Eligible
          </Typography>
        </Box>

        <Box
          sx={{
            flex: 1,
            textAlign: "center",
            cursor: "pointer",
            pl: 1,
            "&:hover": { bgcolor: "rgba(255,255,255,0.1)" },
            borderRadius: 1,
            transition: "background-color 0.2s",
            minWidth: 0,
          }}
          onClick={onWithheldClick}
        >
          <Cancel
            sx={{ fontSize: { xs: 28, sm: 36 }, color: "#F87171", mb: 0.5 }}
          />
          <Typography
            variant="h5"
            sx={{
              fontWeight: 800,
              color: textColor,
              lineHeight: 1.1,
              fontFamily: "'Inter', sans-serif",
              fontSize: { xs: "1.5rem", sm: "2rem" },
              wordBreak: "break-word",
            }}
          >
            {withheld?.value || "0"}
          </Typography>
          <Typography
            variant="body2"
            sx={{
              color: "rgba(255,255,255,0.9)",
              fontWeight: 700,
              mt: 0.5,
              fontSize: { xs: "0.7rem", sm: "0.8rem" },
              lineHeight: 1.2,
            }}
          >
            Withheld
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
};

// === DONUT CHART ===
const DonutChart = ({ pieData, chartTitle }) => {
  const hasData =
    pieData?.datasets?.[0]?.data?.some((v) => Number(v) > 0) ?? false;

  if (!hasData) {
    return (
      <Paper
        elevation={0}
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: 320,
          bgcolor: "#F8FAFC",
          borderRadius: 2,
          border: "1px dashed #CBD5E1",
        }}
      >
        <Assessment sx={{ fontSize: 48, color: "#CBD5E1", mb: 1 }} />
        <Typography variant="body2" color="#94A3B8">
          No data available for {chartTitle}
        </Typography>
      </Paper>
    );
  }

  const filtered = pieData.labels
    .map((label, i) => ({
      name: label,
      value: Number(pieData.datasets[0].data[i]) || 0,
      color: pieData.datasets[0].backgroundColor[i],
    }))
    .filter((d) => d.value > 0);

  if (filtered.length === 0) {
    return (
      <Paper
        elevation={0}
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: 320,
          bgcolor: "#F8FAFC",
          borderRadius: 2,
          border: "1px dashed #CBD5E1",
        }}
      >
        <Assessment sx={{ fontSize: 48, color: "#CBD5E1", mb: 1 }} />
        <Typography variant="body2" color="#94A3B8">
          No data available for {chartTitle}
        </Typography>
      </Paper>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <RechartsPieChart>
        <Pie
          data={filtered}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius="75%"
          innerRadius="55%"
          paddingAngle={3}
          cornerRadius={6}
        >
          {filtered.map((e, i) => (
            <Cell key={`cell-${i}`} fill={e.color} />
          ))}
        </Pie>
        <Tooltip
          formatter={(v) => Number(v).toLocaleString("en-IN")}
          contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0" }}
        />
        <Legend />
      </RechartsPieChart>
    </ResponsiveContainer>
  );
};

// === CLEAN FILTER SECTION ===
const CleanFilterSection = ({
  category,
  filters,
  filterLoading,
  serviceId,
  setServiceId,
  services,
}) => {
  const {
    state,
    setState,
    division,
    setDivision,
    district,
    setDistrict,
    tehsil,
    setTehsil,
    districts,
    tehsils,
    resetFilters,
    getFilterTitle,
    clearFilter,
  } = filters;

  const filterFields = [
    {
      label: "Service",
      value: serviceId,
      onChange: setServiceId,
      options: services,
      icon: filterIcons.Service,
    },
    {
      label: "State",
      value: state,
      onChange: setState,
      options: [{ value: "0", label: "Jammu & Kashmir" }],
      icon: filterIcons.State,
    },
    {
      label: "Division",
      value: division,
      onChange: setDivision,
      options: [
        { value: "1", label: "Jammu" },
        { value: "2", label: "Kashmir" },
      ],
      icon: filterIcons.Division,
    },
    {
      label: "District",
      value: district,
      onChange: setDistrict,
      options: districts,
      icon: filterIcons.District,
    },
    {
      label: "Tehsil",
      value: tehsil,
      onChange: setTehsil,
      options: tehsils,
      icon: filterIcons.Tehsil,
    },
  ];

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2.5, sm: 3 },
        mb: 4,
        borderRadius: 3,
        border: "1px solid #E2E8F0",
        bgcolor: "white",
        boxShadow:
          "0 1px 3px rgba(23, 65, 143, 0.06), 0 4px 12px rgba(23, 65, 143, 0.04)",
      }}
    >
      <Stack direction="row" alignItems="center" spacing={2} mb={3}>
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: 2,
            bgcolor: "rgba(23, 65, 143, 0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <FilterList sx={{ color: GOV_NAVY }} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography
            variant="h6"
            sx={{ fontWeight: 700, color: GOV_NAVY_DARK }}
          >
            Filters
          </Typography>
          <Typography variant="body2" sx={{ color: "#64748B" }}>
            Refine your dashboard view by region and service
          </Typography>
        </Box>
        {filterLoading && (
          <CircularProgress size={24} sx={{ color: GOV_NAVY }} />
        )}
      </Stack>

      <Grid container spacing={3}>
        {filterFields.map(
          ({ label, value, onChange, options, icon: Icon }, i) => {
            // Show clear button if it has a value AND it's not the default State ("0") or default Service ("1")
            const shouldShowClear =
              label === "Service" ? value !== "1" : value && value !== "0";

            return (
              <Grid item xs={12} sm={6} md={2.4} key={i}>
                <TextField
                  select
                  fullWidth
                  label={getFilterTitle(label, value)}
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <Icon sx={{ color: "#94A3B8", mr: 1, fontSize: 20 }} />
                    ),
                    endAdornment: shouldShowClear ? (
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (label === "Service") {
                            onChange("1");
                          } else {
                            clearFilter(label);
                          }
                        }}
                        sx={{ mr: 1 }}
                      >
                        <Clear sx={{ fontSize: 18, color: "#94A3B8" }} />
                      </IconButton>
                    ) : null,
                  }}
                  sx={{
                    bgcolor: "white",
                    "& .MuiOutlinedInput-notchedOutline": {
                      borderColor: "#E2E8F0",
                    },
                    "&:hover .MuiOutlinedInput-notchedOutline": {
                      borderColor: GOV_NAVY,
                    },
                    "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                      borderColor: GOV_NAVY,
                    },
                  }}
                >
                  <MenuItem value="" disabled>
                    Select {label}
                  </MenuItem>
                  {options.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
            );
          },
        )}
      </Grid>

      <Box mt={3} display="flex" justifyContent="flex-end">
        <Button
          variant="outlined"
          onClick={resetFilters}
          startIcon={<Refresh />}
          sx={{
            textTransform: "none",
            fontWeight: 600,
            borderColor: "#CBD5E1",
            color: "#475569",
            "&:hover": {
              borderColor: GOV_NAVY,
              color: GOV_NAVY,
              bgcolor: "rgba(23, 65, 143, 0.06)",
            },
          }}
        >
          Reset All Filters
        </Button>
      </Box>
    </Paper>
  );
};

// === MAIN DASHBOARD ===
export default function ModernMUIDashboard() {
  const appFilters = useFilters("application");

  // NEW: Service state and fetching
  const [serviceId, setServiceId] = useState("1");
  const [services, setServices] = useState([
    { value: "1", label: "Social Welfare Pension" },
  ]);

  useEffect(() => {
    const fetchServices = async () => {
      try {
        // Replace "/Base/GetServices" with your actual backend endpoint for fetching services
        const res = await axiosInstance.get("/Base/GetServices");
        if (res.data && Array.isArray(res.data.services)) {
          setServices(
            res.data.services.map((s) => ({
              value: String(s.serviceId || s.id),
              label: s.serviceName || s.name,
            })),
          );
        }
      } catch (err) {
        console.warn("Could not fetch services, using default", err);
      }
    };
    fetchServices();
  }, []);

  const {
    data: appData,
    categoryData,
    locationData,
    isLoading: appLoading,
    error: appError,
  } = useDashboardData("application", appFilters, serviceId);

  const [selectedTable, setSelectedTable] = useState(null);
  const tableRef = useRef(null);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [timelineApplicationId, setTimelineApplicationId] = useState(null);
  const [timelineTable, setTimelineTable] = useState(null);
  const contentRef = useRef(null);
  const hasScrolledRef = useRef(false);

  const handleOpenTimelineModal = (applicationId) => {
    setTimelineApplicationId(applicationId);
    setTimelineTable({
      url: "/Viewer/GetApplicationHistory",
      params: { ApplicationId: applicationId },
    });
    setTimelineOpen(true);
  };

  const handleCloseTimelineModal = () => {
    setTimelineOpen(false);
    setTimelineApplicationId(null);
    setTimelineTable(null);
  };

  const actionFunctions = {
    ViewTimeline: (row) =>
      handleOpenTimelineModal(row.original.referenceNumber),
  };

  const handleCardClick = useCallback((title) => {
    const map = {
      "Applications Received": "total",
      Sanctioned: "sanctioned",
      "Under Process": "pending",
      "Pending with Citizen": "returntoedit",
      Rejected: "rejected",
      "Eligible for Pension": "eligible",
      "Not Eligible (Withheld)": "withheld",
    };
    setSelectedTable({ title, type: map[title] || "total" });
    setTimeout(
      () => tableRef.current?.scrollIntoView({ behavior: "smooth" }),
      100,
    );
  }, []);

  const statusPieData = useMemo(() => {
    const targetTitles = [
      "Sanctioned",
      "Under Process",
      "Pending with Citizen",
      "Rejected",
    ];
    const labels = [];
    const data = [];
    const backgroundColor = [];

    const colorMap = {
      Sanctioned: "#10B981",
      "Under Process": "#F59E0B",
      "Pending with Citizen": "#8B5CF6",
      Rejected: "#EF4444",
    };

    targetTitles.forEach((title) => {
      const item = appData.find((d) => d.title === title);
      if (item) {
        labels.push(item.title);
        const rawValue = item.value || "0";
        const numValue = parseInt(rawValue.replace(/[^0-9]/g, ""), 10) || 0;
        data.push(numValue);
        backgroundColor.push(colorMap[title]);
      }
    });

    return { labels, datasets: [{ data, backgroundColor }] };
  }, [appData]);

  const dynamicTitle = `${appFilters.wise === "State" ? "Division" : appFilters.wise === "Division" ? "District" : "Tehsil"}-wise Sanctioned`;

  useEffect(() => {
    if (
      !appLoading &&
      appData.length > 0 &&
      !hasScrolledRef.current &&
      contentRef.current
    ) {
      setTimeout(() => {
        contentRef.current.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
        hasScrolledRef.current = true;
      }, 100);
    }
  }, [appLoading, appData]);

  const getCard = (title) => appData.find((c) => c.title === title);

  const cardOrder = [
    "Applications Received",
    "Sanctioned",
    "PENSION_BREAKDOWN",
    "Under Process",
    "Pending with Citizen",
    "Rejected",
  ];

  return (
    <Box sx={{ bgcolor: "#F8FAFC", minHeight: "100vh", py: { xs: 3, sm: 4 } }}>
      <Container maxWidth="xl">
        <Box sx={{ mb: { xs: 3, sm: 4 } }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1 }}>
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: 2,
                bgcolor: "rgba(23, 65, 143, 0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Assessment sx={{ fontSize: 32, color: GOV_NAVY }} />
            </Box>
            <Box>
              <GovPageHeader
                title="Analytics Dashboard"
                hindiTitle="विश्लेषण डैशबोर्ड"
                crumbs={[
                  { label: "Viewer", path: "/viewer/home" },
                  { label: "Analytics", path: "" },
                ]}
              />
              <Typography variant="body1" sx={{ color: "#64748B" }}>
                Real-time application status and regional analytics
              </Typography>
            </Box>
          </Box>
        </Box>

        <div ref={contentRef}>
          <CleanFilterSection
            category="application"
            filters={appFilters}
            filterLoading={appFilters.filterLoading}
            serviceId={serviceId}
            setServiceId={setServiceId}
            services={services}
          />
        </div>

        {appLoading ? (
          <Box textAlign="center" py={12}>
            <CircularProgress size={60} sx={{ color: GOV_NAVY }} />
            <Typography variant="h6" mt={3} color="#64748B">
              Loading dashboard data...
            </Typography>
          </Box>
        ) : appError ? (
          <Paper
            sx={{
              p: 6,
              textAlign: "center",
              bgcolor: "#FEF2F2",
              borderRadius: 3,
              border: "1px solid #FECACA",
            }}
          >
            <ErrorOutline sx={{ fontSize: 64, color: "#EF4444", mb: 2 }} />
            <Typography variant="h6" color="#EF4444" fontWeight={600}>
              {appError}
            </Typography>
          </Paper>
        ) : (
          <>
            <Paper
              elevation={0}
              sx={{
                position: "relative",
                overflow: "hidden",
                mb: 4,
                borderRadius: 3,
                p: { xs: 2, sm: 3 },
                pt: { xs: 3, sm: 4.5 },
                border: "1px solid #E2E8F0",
                bgcolor: "white",
                boxShadow:
                  "0 1px 3px rgba(23, 65, 143, 0.06), 0 4px 12px rgba(23, 65, 143, 0.04)",
              }}
            >
              <Box
                sx={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 6,
                  background: TRICOLOR_BAR,
                }}
              />
              <Typography
                variant="h5"
                sx={{ fontWeight: 700, color: GOV_NAVY_DARK, mb: 0.5 }}
              >
                Application Status Overview
              </Typography>
              <Typography
                variant="body1"
                sx={{ color: "#64748B", fontWeight: 600, mb: 3 }}
              >
                Showing data for:{" "}
                <b style={{ color: GOV_NAVY_DARK }}>
                  {appFilters.wise} - {appFilters.wiseName}
                </b>
              </Typography>

              <Grid container spacing={3} mb={5}>
                {cardOrder.map((key, i) => {
                  if (key === "PENSION_BREAKDOWN") {
                    return (
                      <Grid item xs={12} sm={6} md={4} key={i}>
                        <PensionEligibilityCard
                          eligible={getCard("Eligible for Pension")}
                          withheld={getCard("Not Eligible (Withheld)")}
                          onEligibleClick={() =>
                            handleCardClick("Eligible for Pension")
                          }
                          onWithheldClick={() =>
                            handleCardClick("Not Eligible (Withheld)")
                          }
                        />
                      </Grid>
                    );
                  }

                  const card = getCard(key);
                  if (!card) return null;

                  return (
                    <Grid item xs={12} sm={6} md={4} key={i}>
                      <ModernStatCard
                        card={card}
                        onCardClick={handleCardClick}
                      />
                    </Grid>
                  );
                })}
              </Grid>

              <Divider sx={{ my: 4, borderColor: "#E2E8F0" }} />

              <Grid container spacing={4}>
                <Grid item xs={12} md={appFilters.tehsil ? 6 : 4}>
                  <Typography
                    variant="h6"
                    sx={{
                      fontWeight: 700,
                      color: GOV_NAVY_DARK,
                      fontSize: { xs: "1rem", sm: "1.15rem" },
                      mb: 2,
                    }}
                  >
                    Status Distribution
                  </Typography>
                  <DonutChart pieData={statusPieData} chartTitle="Status" />
                </Grid>
                <Grid item xs={12} md={appFilters.tehsil ? 6 : 4}>
                  <Typography
                    variant="h6"
                    sx={{
                      fontWeight: 700,
                      color: GOV_NAVY_DARK,
                      fontSize: { xs: "1rem", sm: "1.15rem" },
                      mb: 2,
                    }}
                  >
                    Category-wise Sanctioned
                  </Typography>
                  <DonutChart
                    pieData={{
                      labels: categoryData.map((c) => c.name),
                      datasets: [
                        {
                          data: categoryData.map((c) => c.value),
                          backgroundColor: categoryData.map((c) => c.color),
                        },
                      ],
                    }}
                    chartTitle="Category"
                  />
                </Grid>
                {!appFilters.tehsil && (
                  <Grid item xs={12} md={4}>
                    <Typography
                      variant="h6"
                      sx={{
                        fontWeight: 700,
                        color: GOV_NAVY_DARK,
                        fontSize: { xs: "1rem", sm: "1.15rem" },
                        mb: 2,
                      }}
                    >
                      {dynamicTitle}
                    </Typography>
                    <DonutChart
                      pieData={{
                        labels: locationData.map((l) => l.name),
                        datasets: [
                          {
                            data: locationData.map((l) => l.value),
                            backgroundColor: locationData.map((l) => l.color),
                          },
                        ],
                      }}
                      chartTitle="Location"
                    />
                  </Grid>
                )}
              </Grid>
            </Paper>

            {selectedTable && (
              <Box ref={tableRef}>
                <ServerSideTable
                  // UPDATED: Dynamic serviceId in URL
                  url={`/Viewer/GetMainApplicationStatusData?serviceId=${encodeURIComponent(serviceId)}&type=${encodeURIComponent(selectedTable.type)}`}
                  extraParams={{
                    state: appFilters.state,
                    division: appFilters.division,
                    district: appFilters.district,
                    tehsil: appFilters.tehsil,
                  }}
                  Title={selectedTable.title}
                  actionFunctions={actionFunctions}
                  canSanction={false}
                  canHavePool={false}
                  pendingApplications={false}
                  serviceId={serviceId} // UPDATED: Dynamic serviceId prop
                  onPushToPool={() => {}}
                  onExecuteAction={() => {}}
                  actionOptions={[]}
                  selectedAction=""
                  setSelectedAction={() => {}}
                  showDownloadButtons={true}
                />
              </Box>
            )}
          </>
        )}
      </Container>

      <BasicModal
        open={timelineOpen}
        handleClose={handleCloseTimelineModal}
        Title={`Application History: ${timelineApplicationId || ""}`}
        pdf={null}
        table={timelineTable}
      />
    </Box>
  );
}
