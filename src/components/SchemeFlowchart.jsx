// src/components/SchemeFlowchart.jsx
import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { Box, Typography, Button, Chip } from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import ReplayIcon from "@mui/icons-material/Replay";
import PersonIcon from "@mui/icons-material/Person";
import HubIcon from "@mui/icons-material/Hub";
import TaskAltIcon from "@mui/icons-material/TaskAlt";

export const FLOWS = {
  ladliBeti: {
    steps: [
      {
        id: "citizen",
        label: "Citizen",
        type: "start",
        info: "Applicant submits the application online with supporting documents.",
      },
      {
        id: "cdpo",
        label: "CDPO",
        info: "Child Development Project Officer verifies eligibility at block level.",
      },
      {
        id: "dpo",
        label: "DPO",
        info: "District Programme Officer reviews and recommends the case.",
      },
      {
        id: "fin",
        label: "Director Finance",
        info: "Financial concurrence and fund-availability check.",
      },
      {
        id: "sanction",
        label: "Sanction",
        type: "end",
        info: "Assistance sanctioned and disbursed to the beneficiary's account.",
      },
    ],
  },
  mas: {
    steps: [
      {
        id: "citizen",
        label: "Citizen",
        type: "start",
        info: "Applicant submits the application online with supporting documents.",
      },
      {
        id: "dswo",
        label: "DSWO",
        info: "District Social Welfare Officer verifies the application.",
      },
      {
        id: "ddc",
        label: "DDC",
        info: "District Development Committee recommends approval.",
      },
      {
        id: "fin",
        label: "Director Finance",
        info: "Financial concurrence and fund-availability check.",
      },
      {
        id: "sanction",
        label: "Sanction",
        type: "end",
        info: "Assistance sanctioned and disbursed.",
      },
    ],
  },
  isss: {
    steps: [
      {
        id: "citizen",
        label: "Citizen",
        type: "start",
        info: "Applicant (or guardian) submits the pension application.",
      },
      {
        id: "tswo",
        label: "TSWO",
        info: "Tehsil Social Welfare Officer verifies documents.",
      },
      {
        id: "dswo",
        label: "DSWO",
        info: "District-level verification and recommendation.",
      },
      {
        id: "dirsw",
        label: "Director SW",
        info: "Final approval by the Director of Social Welfare.",
      },
      {
        id: "sanction",
        label: "Sanction",
        type: "end",
        info: "Monthly pension sanctioned and disbursed.",
      },
    ],
    branches: [{ from: "dswo", to: "sanction" }], // the bypass edge from your diagram
  },
};

const NodeIcon = ({ type }) =>
  type === "start" ? (
    <PersonIcon fontSize="small" />
  ) : type === "end" ? (
    <TaskAltIcon fontSize="small" />
  ) : (
    <HubIcon fontSize="small" />
  );

export default function SchemeFlowchart({ flow, accent = "#1F43B5" }) {
  const { steps, branches = [] } = flow;
  const uid = useId();
  const rootRef = useRef(null);
  const nodeRefs = useRef({});
  const timer = useRef(null);
  const [inView, setInView] = useState(false);
  const [active, setActive] = useState(-1); // -1 idle · steps.length = done
  const [rails, setRails] = useState([]);

  /* reveal on scroll */
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => e.isIntersecting && setInView(true),
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  /* measure branch rails (responsive-safe) */
  useEffect(() => {
    if (!inView || !branches.length) return;
    const measure = () => {
      const c = rootRef.current?.getBoundingClientRect();
      if (!c) return;
      setRails(
        branches
          .map((b) => {
            const s = nodeRefs.current[b.from]?.getBoundingClientRect();
            const t = nodeRefs.current[b.to]?.getBoundingClientRect();
            if (!s || !t) return null;
            const railX = c.width - 10;
            const sy = s.top - c.top + s.height / 2;
            const ty = t.top - c.top + t.height / 2;
            return {
              key: b.from + b.to,
              d: `M ${s.right - c.left} ${sy} H ${railX} V ${ty} H ${t.right - c.left + 4}`,
            };
          })
          .filter(Boolean),
      );
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(rootRef.current);
    return () => ro.disconnect();
  }, [inView, branches]);

  /* play / trace */
  const play = useCallback(() => {
    clearInterval(timer.current);
    setActive(0);
    timer.current = setInterval(() => {
      setActive((a) => {
        if (a >= steps.length - 1) {
          clearInterval(timer.current);
          return steps.length;
        }
        return a + 1;
      });
    }, 1000);
  }, [steps.length]);
  useEffect(() => () => clearInterval(timer.current), []);

  /* auto-run once, respect reduced motion */
  useEffect(() => {
    if (
      !inView ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const t = setTimeout(play, 700);
    return () => clearTimeout(t);
  }, [inView, play]);

  const done = active === steps.length;

  return (
    <Box
      ref={rootRef}
      sx={{ position: "relative", width: "100%", maxWidth: 280, mx: "auto" }}
    >
      <Typography
        sx={{
          textAlign: "center",
          fontWeight: 700,
          color: accent,
          mb: 2,
          fontSize: "0.95rem",
        }}
      >
        Application Flow
      </Typography>

      <Box
        sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}
      >
        {steps.map((s, i) => (
          <React.Fragment key={s.id}>
            {i > 0 && (
              <Box
                sx={{
                  width: 2,
                  height: 26,
                  bgcolor: "rgba(0,0,0,.12)",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <Box
                  sx={{
                    position: "absolute",
                    inset: 0,
                    bgcolor: accent,
                    transformOrigin: "top",
                    transform: active >= i ? "scaleY(1)" : "scaleY(0)",
                    transition: "transform .5s",
                  }}
                />
              </Box>
            )}
            <Box
              component="button"
              ref={(el) => {
                nodeRefs.current[s.id] = el;
              }}
              aria-label={`${s.label}: ${s.info}`}
              onClick={() => {
                clearInterval(timer.current);
                setActive(i);
              }}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                width: 180,
                px: 2,
                py: 1,
                border: "1px solid",
                borderColor: active === i ? accent : "rgba(0,0,0,.12)",
                borderRadius: 2,
                cursor: "pointer",
                bgcolor:
                  s.type === "end"
                    ? "#E8F5E9"
                    : s.type === "start"
                      ? "#E3F2FD"
                      : "#fff",
                color: "text.primary",
                boxShadow:
                  active === i
                    ? `0 0 0 3px ${accent}33, 0 6px 16px rgba(0,0,0,.12)`
                    : "0 1px 2px rgba(0,0,0,.08)",
                opacity: inView ? 1 : 0,
                transform: !inView
                  ? "translateY(14px)"
                  : active === i
                    ? "scale(1.06)"
                    : "none",
                transition: `all .45s cubic-bezier(.2,.7,.3,1) ${inView ? i * 0.1 : 0}s`,
                "&:hover": { borderColor: accent },
              }}
            >
              <NodeIcon type={s.type} />
              <Typography sx={{ fontWeight: 600, fontSize: "0.85rem" }}>
                {s.label}
              </Typography>
            </Box>
          </React.Fragment>
        ))}
      </Box>

      {/* branch edges as SVG rails */}
      <Box
        component="svg"
        sx={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          overflow: "visible",
        }}
      >
        <defs>
          <marker
            id={`${uid}-a`}
            markerWidth="7"
            markerHeight="7"
            refX="6"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 7 3.5, 0 7" fill={accent} />
          </marker>
        </defs>
        {rails.map((r) => (
          <path
            key={r.key}
            d={r.d}
            fill="none"
            stroke={accent}
            strokeWidth={1.5}
            strokeDasharray="4 4"
            opacity={0.75}
            markerEnd={`url(#${uid}-a)`}
          />
        ))}
      </Box>

      {/* live description panel */}
      <Box sx={{ minHeight: 72, mt: 2, textAlign: "center" }}>
        {active >= 0 && active < steps.length && (
          <Typography
            key={active}
            variant="body2"
            sx={{ color: "text.secondary", animation: "fadeIn .4s" }}
          >
            <Box component="strong" sx={{ color: "text.primary" }}>
              {steps[active].label}:{" "}
            </Box>
            {steps[active].info}
          </Typography>
        )}
        {done && (
          <Chip
            size="small"
            color="success"
            icon={<TaskAltIcon />}
            label="Application sanctioned"
          />
        )}
        <Button
          size="small"
          sx={{ mt: 1 }}
          startIcon={done ? <ReplayIcon /> : <PlayArrowIcon />}
          onClick={play}
        >
          {done ? "Replay" : "Trace application"}
        </Button>
      </Box>

      <Box component="style">{`@keyframes fadeIn { from { opacity: 0; transform: translateY(4px);} to { opacity: 1; } }`}</Box>
    </Box>
  );
}
