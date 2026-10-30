import React, {
  useEffect,
  useState,
  useRef,
  useMemo,
  useCallback,
  useContext,
} from "react";
import { fetchServiceList } from "../../assets/fetch";
import GovPageHeader from "../../components/gov/GovPageHeader";
import ServiceSelectionForm from "../../components/ServiceSelectionForm";
import {
  Box,
  Button,
  Typography,
  CircularProgress,
  Tooltip as MuiTooltip,
  Container as MuiContainer,
  IconButton,
  Grid,
  Collapse,
  Paper,
} from "@mui/material";
import { useForm } from "react-hook-form";
import axiosInstance from "../../axiosConfig";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from "recharts";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import debounce from "lodash/debounce";
import { UserContext } from "../../UserContext";
import {
  AssignmentTurnedIn,
  Cancel,
  CheckCircle,
  EditNote,
  Reply,
  Summarize,
  ForwardToInbox,
  Verified,
  Block,
  Description,
  AccessTime,
  Inventory,
  Person,
  SwapHoriz,
  ExpandMore,
  ExpandLess,
  HourglassEmpty,
  KeyboardArrowRight,
} from "@mui/icons-material";
import CustomLegend from "../../components/CustomLegend";

export default function OfficerHome() {
  const [services, setServices] = useState([]);
  const [serviceId, setServiceId] = useState("");
  const [countList, setCountList] = useState([]);
  const [corrigendumList, setCorrigendumList] = useState([]);
  const [amendmentList, setAmendmentList] = useState([]);
  const [correctionList, setCorrectionList] = useState([]);
  const [legacyCountList, setLegacyCountList] = useState([]);
  const [temporaryCountList, setTemporaryCountList] = useState([]);
  const [withheldCountList, setWithheldCountList] = useState([]);
  const [citizenPendingList, setCitizenPendingList] = useState([]);
  const [counts, setCounts] = useState({
    total: 0,
    pending: 0,
    forwarded: 0,
    citizenPending: 0,
    rejected: 0,
    sanctioned: 0,
    returnedCount: 0,
    shiftedCount: 0,
    corrigendumCount: 0,
    correctionCount: 0,
    legacyTotal: 0,
    legacyRejected: 0,
    legacySanctioned: 0,
  });
  const [canSanction, setCanSanction] = useState(false);
  const [canHavePool, setCanHavePool] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [officerRole, setOfficerRole] = useState("");
  const [officerArea, setOfficerArea] = useState("");
  const [lastServiceId, setLastServiceId] = useState("");

  const navigate = useNavigate();
  const location = useLocation();
  const { setOfficerAuthorities, officerAuthorities } = useContext(UserContext);

  const sectionContainerRef = useRef(null);
  const hasScrolledRef = useRef(false);

  const {
    formState: { errors },
  } = useForm();

  // ── Status colour map (unchanged) ────────────────────────────────────
  const statusColors = useMemo(
    () => ({
      "Total Applications": "#475569",
      "Total Corrigendum": "#7C3AED",
      "Total Correction": "#0D9488",
      "Total Amendment": "#15803D",
      "Total Withheld Applications": "#B45309",
      Pending: "#F59E0B",
      "Pending With Citizen": "#8B5CF6",
      "Withheld Pending": "#F59E0B",
      "Withheld Forwarded": "#0284C7",
      "Withheld Approved": "#10B981",
      Forwarded: "#0284C7",
      "Shifted To Another Location": "#DB2777",
      Returned: "#EA580C",
      Rejected: "#DC2626",
      "Permanent Withheld": "#991B1B",
      "Temporary Withheld": "#D97706",
      Sanctioned: "#10B981",
      Issued: "#059669",
      "PCP-UDID Expires in 3 Months": "#0D9488",
      "PCP Applications": "#2563EB",
      "Pension's Stopped": "#7C3AED",
    }),
    [],
  );

  // ── Icon map (unchanged) ─────────────────────────────────────────────
  const iconMap = useMemo(() => {
    const makeIcon = (Icon) => <Icon sx={{ fontSize: 20 }} />;
    return {
      "Total Applications": makeIcon(Summarize),
      "Total Corrigendum": makeIcon(EditNote),
      "Total Correction": makeIcon(EditNote),
      "Total Amendment": makeIcon(EditNote),
      "Total Withheld Applications": makeIcon(Inventory),
      Pending: makeIcon(HourglassEmpty),
      Forwarded: makeIcon(ForwardToInbox),
      Returned: makeIcon(Reply),
      "Pending With Citizen": makeIcon(Person),
      Rejected: makeIcon(Cancel),
      Sanctioned: makeIcon(Verified),
      "Shifted To Another Location": makeIcon(SwapHoriz),
      Issued: makeIcon(CheckCircle),
      "Pension's Stopped": makeIcon(Block),
      "PCP Applications": makeIcon(Description),
      "PCP-UDID Expires in 3 Months": makeIcon(AccessTime),
    };
  }, []);

  // ── Fetch counts for the selected service ────────────────────────────
  const debouncedHandleRecords = useCallback(
    debounce(async (newServiceId, force = false) => {
      if (!newServiceId) return;
      if (!force && newServiceId === lastServiceId) return;
      setLoading(true);
      setError(null);
      try {
        setServiceId(newServiceId);
        setLastServiceId(newServiceId);
        const response = await axiosInstance.get(
          "/Officer/GetApplicationsCount",
          { params: { ServiceId: newServiceId } },
        );

        setCountList(response.data.countList || []);
        setCorrigendumList(response.data.corrigendumList || []);
        setAmendmentList(response.data.amendmentList || []);
        setCorrectionList(response.data.correctionList || []);
        setTemporaryCountList(response.data.temporaryCountList || []);
        setWithheldCountList(response.data.withheldCountList || []);
        setCitizenPendingList(response.data.citizenPendingList || []);
        setLegacyCountList(response.data.legacyCountList || []);
        setCanSanction(response.data.canSanction || false);
        setCanHavePool(response.data.canHavePool || false);
        setOfficerAuthorities(response.data.officerAuthorities || {});

        const newCounts = {
          total:
            response.data.countList.find(
              (i) => i.label === "Total Applications",
            )?.count || 0,
          pending:
            response.data.countList.find((i) => i.label === "Pending")?.count ||
            0,
          forwarded:
            response.data.countList.find((i) => i.label === "Forwarded")
              ?.count || 0,
          citizenPending:
            response.data.countList.find(
              (i) => i.label === "Pending With Citizen",
            )?.count ||
            response.data.citizenPendingList[0]?.count ||
            0,
          rejected:
            response.data.countList.find((i) => i.label === "Rejected")
              ?.count || 0,
          sanctioned:
            response.data.countList.find((i) => i.label === "Sanctioned")
              ?.count || 0,
          returnedCount:
            response.data.countList.find((i) => i.label === "Returned")
              ?.count || 0,
          shiftedCount:
            response.data.countList.find(
              (i) => i.label === "Shifted To Another Location",
            )?.count || 0,
          corrigendumCount:
            response.data.corrigendumList?.reduce(
              (sum, i) => sum + (i.count || 0),
              0,
            ) || 0,
          correctionCount:
            response.data.correctionList?.reduce(
              (sum, i) => sum + (i.count || 0),
              0,
            ) || 0,
          legacyTotal:
            response.data.legacyCountList?.find(
              (i) => i.label === "Total Applications",
            )?.count || 0,
          legacyRejected:
            response.data.legacyCountList?.find((i) => i.label === "Rejected")
              ?.count || 0,
          legacySanctioned:
            response.data.legacyCountList?.find((i) => i.label === "Sanctioned")
              ?.count || 0,
        };
        setCounts(newCounts);
      } catch (err) {
        setError("Failed to fetch application counts.");
        toast.error("Failed to load application counts.", {
          position: "top-right",
          theme: "colored",
        });
      } finally {
        setLoading(false);
      }
    }, 300),
    [lastServiceId],
  );

  useEffect(
    () => () => debouncedHandleRecords.cancel(),
    [debouncedHandleRecords],
  );

  // ── Card click: navigate to the applications page ────────────────────
  const handleCardClick = useCallback(
    (statusName, cardType, tableTile = null) => {
      const isCorrigendum = cardType.toLowerCase().includes("corrigendum");
      const isCorrection = cardType.toLowerCase().includes("correction");
      const isLegacy = cardType.toLowerCase().includes("legacy");
      const isWithheld = cardType.toLowerCase().includes("withheld");
      const cleanedStatus = statusName
        .replace(/(Corrigendum|Correction|Legacy|Withheld)\s*/gi, "")
        .trim();

      const typeMap = {
        "Total Applications": "total",
        "Total Corrigendum": "total",
        "Total Correction": "total",
        "Total Amendment": "total",
        Pending: "pending",
        Forwarded: "forwarded",
        Returned: "returned",
        Rejected: "rejected",
        Sanctioned: "sanctioned",
        Issued: isCorrigendum ? "sanctioned" : "verified",
        "Pending With Citizen": "returntoedit",
        "Shifted To Another Location": "shifted",
        "Pension's Stopped": "pensionstopped",
        "PCP-UDID Expires in 3 Months": "expiringeligibility",
        "PCP Applications": "totalpcpapplication",
        "Withheld Pending": "pending",
        "Withheld Forwarded": "forwarded",
        "Withheld Approved": "approved",
      };

      let mappedType = typeMap[cleanedStatus] || cleanedStatus.toLowerCase();
      if (isWithheld) mappedType = `withheld_${mappedType}`;

      const url =
        cardType === "Corrigendum" || cardType === "Correction"
          ? "/Officer/GetCorrigendumApplications"
          : statusName === "PCP-UDID Expires in 3 Months" ||
              statusName === "PCP Applications"
            ? "/Officer/GetTemporaryDisability"
            : statusName.includes("Withheld")
              ? "/Officer/GetWithheldApplications"
              : "/Officer/GetApplications";

      const dataTypeValue = isLegacy ? "legacy" : "new";
      const extraParams = {
        ServiceId: serviceId,
        type: mappedType,
        dataType: dataTypeValue,
      };
      if (["Corrigendum", "Correction", "Amendment"].includes(cardType)) {
        extraParams.applicationType = cardType;
      }

      navigate("/officer/applications", {
        state: {
          url,
          extraParams,
          tableTitle: tableTile,
          applicationType: cardType,
          type: mappedType,
          dataType: dataTypeValue,
          serviceId,
          canSanction,
          canHavePool,
          officerRole,
          officerArea,
        },
      });
    },
    [navigate, serviceId, canSanction, canHavePool, officerRole, officerArea],
  );

  // ── Bar chart data ───────────────────────────────────────────────────
  const barData = useMemo(() => {
    const labels = ["Total", "Pending"],
      data = [counts.total, counts.pending],
      bg = ["#475569", "#F59E0B"];
    if (officerAuthorities.canForwardToPlayer) {
      labels.push("Forwarded");
      data.push(counts.forwarded);
      bg.push("#0284C7");
    }
    if (officerAuthorities.canReturnToCitizen) {
      labels.push("Citizen Pending");
      data.push(counts.citizenPending);
      bg.push("#8B5CF6");
    }
    if (officerAuthorities.canReturnToPlayer) {
      labels.push("Returned");
      data.push(counts.returnedCount);
      bg.push("#EA580C");
    }
    labels.push("Rejected");
    data.push(counts.rejected);
    bg.push("#DC2626");
    if (officerAuthorities.canSanction) {
      labels.push("Sanctioned");
      data.push(counts.sanctioned);
      bg.push("#10B981");
    }
    return {
      labels,
      datasets: [{ label: "Applications", data, backgroundColor: bg }],
    };
  }, [counts, officerAuthorities]);

  // ── Pie chart data ───────────────────────────────────────────────────
  const pieData = useMemo(() => {
    const labels = ["Pending"],
      data = [counts.pending],
      bg = ["#F59E0B"];
    if (officerAuthorities.canForwardToPlayer) {
      labels.push("Forwarded");
      data.push(counts.forwarded);
      bg.push("#0284C7");
    }
    if (officerAuthorities.canReturnToPlayer) {
      labels.push("Returned");
      data.push(counts.returnedCount);
      bg.push("#EA580C");
    }
    if (officerAuthorities.canReturnToCitizen) {
      labels.push("Citizen Pending");
      data.push(counts.citizenPending);
      bg.push("#8B5CF6");
    }
    labels.push("Rejected");
    data.push(counts.rejected);
    bg.push("#DC2626");
    if (officerAuthorities.canSanction) {
      labels.push("Sanctioned");
      data.push(counts.sanctioned);
      bg.push("#10B981");
    }
    return { labels, datasets: [{ data, backgroundColor: bg }] };
  }, [counts, officerAuthorities]);

  // ── Fetch services on mount ──────────────────────────────────────────
  useEffect(() => {
    const fetchServices = async () => {
      setLoading(true);
      try {
        await fetchServiceList(setServices, setOfficerRole, setOfficerArea);
      } catch {
        setError("Failed to load services.");
        toast.error("Failed to load services.", { theme: "colored" });
      } finally {
        setLoading(false);
      }
    };
    fetchServices();
  }, []);

  // ── Refresh counts when coming back from the applications page ───────
  useEffect(() => {
    const returnServiceId = location.state?.returnServiceId;
    if (returnServiceId) {
      // Force refresh regardless of lastServiceId.
      debouncedHandleRecords(returnServiceId, true);
      // Clear the flag so a manual refresh doesn't re-trigger it.
      navigate(".", { replace: true, state: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  // ── Auto-scroll into cards after first load ──────────────────────────
  useEffect(() => {
    if (
      !loading &&
      (countList.length > 0 || citizenPendingList.length > 0) &&
      !hasScrolledRef.current &&
      sectionContainerRef.current
    ) {
      setTimeout(() => {
        sectionContainerRef.current.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
        hasScrolledRef.current = true;
      }, 100);
    }
  }, [loading, countList, citizenPendingList]);

  // ── Stat card component ──────────────────────────────────────────────
  const ConsolidatedStatCard = ({
    title,
    items,
    type,
    sectionTooltip = "",
  }) => {
    const [expanded, setExpanded] = useState(false);
    if (!items?.length) return null;

    const sortedItems = [...items].sort((a, b) =>
      a.label.startsWith("Total") ? -1 : b.label.startsWith("Total") ? 1 : 0,
    );
    const itemsToShow = expanded ? sortedItems : [sortedItems[0]];

    return (
      <Paper
        elevation={0}
        sx={{
          p: 3,
          borderRadius: 3,
          border: "1px solid #E2E8F0",
          height: "100%",
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            mb: 2,
          }}
        >
          <MuiTooltip title={sectionTooltip} arrow>
            <Typography variant="h6" sx={{ fontWeight: 700, color: "#0F172A" }}>
              {title}
            </Typography>
          </MuiTooltip>
          <IconButton
            size="small"
            onClick={() => setExpanded(!expanded)}
            sx={{ color: "#64748B" }}
          >
            {expanded ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        </Box>

        <Collapse in={true} timeout="auto">
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            {itemsToShow.map((item, index) => {
              const color = statusColors[item.label] || "#475569";
              return (
                <Box
                  key={index}
                  onClick={() =>
                    handleCardClick(item.label, type, item.tableTitle)
                  }
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    p: 2,
                    borderRadius: 2,
                    borderLeft: `4px solid ${color}`,
                    bgcolor: "#F8FAFC",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    "&:hover": {
                      bgcolor: "#F1F5F9",
                      transform: "translateX(4px)",
                    },
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <Box sx={{ color: color, display: "flex" }}>
                      {iconMap[item.label] || (
                        <AssignmentTurnedIn sx={{ fontSize: 20 }} />
                      )}
                    </Box>
                    <Typography
                      variant="body1"
                      sx={{ fontWeight: 600, color: "#334155" }}
                    >
                      {item.label}
                    </Typography>
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Typography
                      variant="h6"
                      sx={{ fontWeight: 800, color: color }}
                    >
                      {item.count || 0}
                    </Typography>
                    <KeyboardArrowRight
                      sx={{ color: "#CBD5E1", fontSize: 20 }}
                    />
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Collapse>

        {sortedItems.length > 1 && (
          <Button
            fullWidth
            size="small"
            onClick={() => setExpanded(!expanded)}
            sx={{
              mt: 2,
              textTransform: "none",
              color: "#2562E9",
              fontWeight: 600,
            }}
          >
            {expanded ? "Show Less" : `Show ${sortedItems.length - 1} More`}
          </Button>
        )}
      </Paper>
    );
  };

  // ── Early returns ────────────────────────────────────────────────────
  if (loading)
    return (
      <Box
        sx={{
          width: "100%",
          height: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          bgcolor: "#F8FAFC",
        }}
      >
        <CircularProgress sx={{ color: "#2562E9" }} />
      </Box>
    );

  if (error)
    return (
      <Box
        sx={{
          width: "100%",
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          bgcolor: "#F8FAFC",
          gap: 2,
        }}
      >
        <Typography color="error" variant="h6">
          {error}
        </Typography>
        <Button
          variant="contained"
          onClick={() => window.location.reload()}
          sx={{ bgcolor: "#2562E9" }}
        >
          Retry
        </Button>
      </Box>
    );

  // ── Main render ──────────────────────────────────────────────────────
  return (
    <Box sx={{ width: "100%", minHeight: "100vh", bgcolor: "#F8FAFC", pb: 8 }}>
      {/* GIGW Standard Page Header */}
      <Box sx={{ px: { xs: 2, md: 4 }, pt: 3 }}>
        <GovPageHeader
          title={`${officerRole} Dashboard`}
          subtitle={officerArea}
          crumbs={[
            { label: "Officer", path: "/officer/home" },
            { label: "Dashboard", path: "" },
          ]}
        />
      </Box>

      <MuiContainer maxWidth="lg" ref={sectionContainerRef}>
        {/* Service Selection */}
        <Paper
          elevation={0}
          sx={{
            position: "relative",
            overflow: "hidden",
            p: { xs: 2.5, md: 4 },
            mb: 6,
            borderRadius: 3,
            border: "1px solid #E2E8F0",
            boxShadow: "0 4px 20px rgba(15, 23, 42, 0.06)",
            background: "linear-gradient(180deg, #FFFFFF 0%, #FBFDFF 100%)",
            maxWidth: 600,
            mx: "auto",
            "&::before": {
              content: '""',
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 4,
              background:
                "linear-gradient(90deg, #17418F 0%, #2561E8 60%, #FF9933 100%)",
            },
          }}
        >
          <ServiceSelectionForm
            services={services}
            errors={errors}
            value={serviceId}
            onServiceSelect={debouncedHandleRecords}
          />
        </Paper>

        {/* Actionable Cards */}
        <Typography
          variant="h5"
          sx={{ fontWeight: 700, color: "#0F172A", mb: 3 }}
        >
          Actionable Items
        </Typography>
        <Grid container spacing={3} sx={{ mb: 6 }}>
          {countList?.length > 0 && (
            <Grid item xs={12} md={6} lg={4}>
              <ConsolidatedStatCard
                title="Applications"
                items={countList}
                type="application"
                sectionTooltip="Overview of all application statuses"
              />
            </Grid>
          )}
          {withheldCountList.length > 0 && (
            <Grid item xs={12} md={6} lg={4}>
              <ConsolidatedStatCard
                title="Withheld Payments"
                items={withheldCountList}
                type="withheld"
                sectionTooltip="Applications withheld after sanction"
              />
            </Grid>
          )}
          {corrigendumList?.length > 0 && (
            <Grid item xs={12} md={6} lg={4}>
              <ConsolidatedStatCard
                title="Corrigendums"
                items={corrigendumList}
                type="Corrigendum"
                sectionTooltip="Corrigendums issued after cases are sanctioned"
              />
            </Grid>
          )}
          {correctionList?.length > 0 && (
            <Grid item xs={12} md={6} lg={4}>
              <ConsolidatedStatCard
                title="Corrections"
                items={correctionList}
                type="Correction"
                sectionTooltip="Corrections made before cases are sanctioned"
              />
            </Grid>
          )}
        </Grid>

        {/* View Only Cards */}
        <Box sx={{ pt: 4, borderTop: "2px dashed #E2E8F0", mb: 6 }}>
          <Typography
            variant="h5"
            sx={{ fontWeight: 700, color: "#0F172A", mb: 3 }}
          >
            View Only
          </Typography>
          <Grid container spacing={3}>
            {citizenPendingList.length > 0 && (
              <Grid item xs={12} md={6} lg={4}>
                <ConsolidatedStatCard
                  title="Pending With Citizens"
                  items={citizenPendingList}
                  type="application"
                  sectionTooltip="Applications pending with citizens"
                />
              </Grid>
            )}
            {temporaryCountList.length > 0 && (
              <Grid item xs={12} md={6} lg={4}>
                <ConsolidatedStatCard
                  title="Physically Challenged"
                  items={temporaryCountList}
                  type="application"
                  sectionTooltip="Physically challenged applications"
                />
              </Grid>
            )}
            {legacyCountList?.length > 0 && (
              <Grid item xs={12} md={6} lg={4}>
                <ConsolidatedStatCard
                  title="Legacy Applications"
                  items={legacyCountList}
                  type="Legacy"
                  sectionTooltip="Legacy applications overview"
                />
              </Grid>
            )}
          </Grid>
        </Box>

        {/* Charts */}
        {countList?.length > 0 && (
          <Grid container spacing={3} sx={{ mb: 6 }}>
            <Grid item xs={12} lg={6}>
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  borderRadius: 3,
                  border: "1px solid #E2E8F0",
                  height: "100%",
                }}
              >
                <Typography
                  variant="h6"
                  sx={{ fontWeight: 700, color: "#0F172A", mb: 3 }}
                >
                  Status Distribution
                </Typography>
                <Box sx={{ height: 350 }}>
                  {pieData.datasets[0].data.some((v) => v > 0) ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData.labels.map((l, i) => ({
                            name: l,
                            value: pieData.datasets[0].data[i],
                          }))}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius="80%"
                          innerRadius="50%"
                          paddingAngle={2}
                          cornerRadius={5}
                          label
                        >
                          {pieData.labels.map((_, i) => (
                            <Cell
                              key={i}
                              fill={pieData.datasets[0].backgroundColor[i]}
                            />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend content={<CustomLegend />} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <Typography
                      sx={{ textAlign: "center", mt: 10, color: "#94A3B8" }}
                    >
                      No data available
                    </Typography>
                  )}
                </Box>
              </Paper>
            </Grid>
            <Grid item xs={12} lg={6}>
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  borderRadius: 3,
                  border: "1px solid #E2E8F0",
                  height: "100%",
                }}
              >
                <Typography
                  variant="h6"
                  sx={{ fontWeight: 700, color: "#0F172A", mb: 3 }}
                >
                  Count Overview
                </Typography>
                <Box sx={{ height: 350 }}>
                  {barData.datasets[0].data.some((v) => v > 0) ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={barData.labels.map((l, i) => ({
                          name: l,
                          value: barData.datasets[0].data[i],
                        }))}
                        margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                        <XAxis
                          dataKey="name"
                          angle={-45}
                          textAnchor="end"
                          interval={0}
                          height={60}
                          tick={{ fontSize: 12, fill: "#64748B" }}
                        />
                        <YAxis tick={{ fontSize: 12, fill: "#64748B" }} />
                        <Tooltip />
                        <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                          {barData.labels.map((_, i) => (
                            <Cell
                              key={i}
                              fill={barData.datasets[0].backgroundColor[i]}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <Typography
                      sx={{ textAlign: "center", mt: 10, color: "#94A3B8" }}
                    >
                      No data available
                    </Typography>
                  )}
                </Box>
              </Paper>
            </Grid>
          </Grid>
        )}
      </MuiContainer>
    </Box>
  );
}
