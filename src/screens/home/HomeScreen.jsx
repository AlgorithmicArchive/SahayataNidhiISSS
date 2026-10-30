import { Box, Typography, Container, Grid, Button, Chip } from "@mui/material";
import React, { useEffect, useRef } from "react";
import CustomCard from "../../components/CustomCard";
import SchemeFlowchart, { FLOWS } from "../../components/SchemeFlowchart";
import { useNavigate } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  GirlSharp,
  FavoriteBorderOutlined,
  AccountBalanceSharp,
  ArrowForward,
  CheckCircleOutline,
} from "@mui/icons-material";

gsap.registerPlugin(ScrollTrigger);

export default function HomeScreen() {
  const navigate = useNavigate();
  const section1Ref = useRef(null);
  const heroImageRef = useRef(null);
  const card1Ref = useRef(null);
  const card2Ref = useRef(null);
  const card3Ref = useRef(null);

  const API_BASE = window.__CONFIG__?.API_URL || "";

  useEffect(() => {
    const cards = [card1Ref.current, card2Ref.current, card3Ref.current].filter(
      Boolean,
    );

    // 1. Subtle floating animation for the hero image
    if (heroImageRef.current) {
      gsap.to(heroImageRef.current, {
        y: -15,
        duration: 3,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
      });
    }

    // 2. Card reveal animation (Fixed: 'once: true' prevents them from vanishing when scrolling back up)
    if (cards.length > 0) {
      gsap.fromTo(
        cards,
        { y: 60, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          stagger: 0.15,
          ease: "power3.out",
          scrollTrigger: {
            trigger: cards[0],
            start: "top 85%",
            once: true, // 🔥 Crucial UX fix
          },
        },
      );
    }

    return () => {
      ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
    };
  }, []);

  return (
    <Box sx={{ width: "100%", overflowX: "hidden", bgcolor: "#FAFAFA" }}>
      {/* ================= SECTION 1: HERO ================= */}
      <Box
        ref={section1Ref}
        sx={{
          position: "relative",
          minHeight: { xs: "auto", md: "85vh" },
          width: "100%",
          display: "flex",
          alignItems: "center",
          py: { xs: 8, md: 12 },
          background: "linear-gradient(135deg, #F4F9FF 0%, #F9F3EC 100%)",
          overflow: "hidden",
        }}
      >
        {/* Subtle Dot Pattern Background */}
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            opacity: 0.4,
            backgroundImage: `radial-gradient(circle at 1px 1px, #2562E9 1px, transparent 0)`,
            backgroundSize: "32px 32px",
            pointerEvents: "none",
          }}
        />

        <Container maxWidth="xl" sx={{ position: "relative", zIndex: 2 }}>
          <Grid container spacing={{ xs: 4, md: 8 }} alignItems="center">
            {/* Left Content */}
            <Grid item xs={12} md={6}>
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 3,
                  maxWidth: 600,
                }}
              >
                {/* Eyebrow Badge */}
                <Chip
                  icon={<CheckCircleOutline sx={{ fontSize: 18 }} />}
                  label="Government of Jammu & Kashmir Initiative"
                  color="primary"
                  variant="outlined"
                  sx={{
                    alignSelf: "flex-start",
                    fontWeight: 600,
                    bgcolor: "rgba(37, 98, 233, 0.08)",
                    borderColor: "rgba(37, 98, 233, 0.3)",
                    color: "#1F43B5",
                  }}
                />

                {/* Main Headings */}
                <Box>
                  <Typography
                    sx={{
                      fontWeight: 800,
                      fontSize: { xs: "2.5rem", sm: "3.5rem", md: "4.5rem" },
                      lineHeight: 1.1,
                      letterSpacing: "-1px",
                    }}
                  >
                    <Box component="span" sx={{ color: "#F67015" }}>
                      Facilitating
                    </Box>{" "}
                    <Box component="span" sx={{ color: "#235BDE" }}>
                      Financial
                    </Box>{" "}
                    <Box component="span" sx={{ color: "#0FB282" }}>
                      Assistance
                    </Box>
                  </Typography>
                  <Typography
                    sx={{
                      fontWeight: 600,
                      fontSize: { xs: "1.5rem", md: "2rem" },
                      color: "text.secondary",
                      mt: 1,
                    }}
                  >
                    for Every Citizen
                  </Typography>
                </Box>

                {/* Description Box */}
                <Typography
                  variant="body1"
                  sx={{
                    bgcolor: "rgba(255,255,255,0.7)",
                    backdropFilter: "blur(8px)",
                    borderRadius: 3,
                    p: 3,
                    color: "text.primary",
                    fontSize: "1.1rem",
                    lineHeight: 1.7,
                    border: "1px solid rgba(0,0,0,0.05)",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.03)",
                  }}
                >
                  Submit your application for welfare schemes through a
                  transparent and structured process. Each form is carefully
                  evaluated and processed across designated phases before
                  approval and sanction.
                </Typography>

                {/* CTA Button */}
                <Box>
                  <Button
                    variant="contained"
                    size="large"
                    endIcon={<ArrowForward />}
                    onClick={() => navigate("/login")}
                    sx={{
                      background: "linear-gradient(to right, #2562E9, #1F43B5)",
                      color: "#fff",
                      fontWeight: "bold",
                      fontSize: "1.1rem",
                      py: 2,
                      px: 5,
                      borderRadius: 2,
                      boxShadow: "0 8px 24px rgba(37, 98, 233, 0.25)",
                      textTransform: "none",
                      "&:hover": {
                        background:
                          "linear-gradient(to right, #1F43B5, #183590)",
                        transform: "translateY(-3px)",
                        boxShadow: "0 12px 28px rgba(37, 98, 233, 0.4)",
                      },
                      transition: "all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)",
                    }}
                  >
                    Get Started
                  </Button>
                </Box>
              </Box>
            </Grid>

            {/* Right Image */}
            <Grid item xs={12} md={6}>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Box
                  ref={heroImageRef}
                  component="img"
                  src={`/assets/images/socialwelfare.png`}
                  alt="Social Welfare"
                  sx={{
                    width: "100%",
                    maxWidth: 550,
                    borderRadius: 5,
                    objectFit: "contain",
                    filter: "drop-shadow(0 20px 40px rgba(37, 99, 235, 0.15))",
                  }}
                />
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* ================= SECTION 2: SERVICES ================= */}
      <Box
        sx={{
          width: "100%",
          background: "linear-gradient(180deg, #FAFAFA 0%, #F0F7FE 100%)",
          py: { xs: 8, md: 12 },
        }}
      >
        <Container maxWidth="xl">
          <Box sx={{ textAlign: "center", mb: 8, maxWidth: 800, mx: "auto" }}>
            {/* Section Badge */}
            <Typography
              sx={{
                color: "#E4630A",
                fontWeight: 700,
                fontSize: "0.9rem",
                textTransform: "uppercase",
                letterSpacing: "2px",
                mb: 2,
              }}
            >
              What We Offer
            </Typography>

            {/* Main Title */}
            <Typography
              variant="h3"
              sx={{
                fontWeight: 800,
                fontSize: { xs: "2rem", md: "3rem" },
                lineHeight: 1.2,
                mb: 2,
              }}
            >
              <Box
                component="span"
                sx={{
                  background: "linear-gradient(to right, #2561E8, #1F43B4)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                Services Provided
              </Box>
            </Typography>

            <Typography
              variant="body1"
              sx={{
                color: "text.secondary",
                fontSize: "1.1rem",
                lineHeight: 1.6,
              }}
            >
              Government-backed financial assistance services designed
              specifically for economically and socially vulnerable citizens of
              Jammu & Kashmir.
            </Typography>
          </Box>

          {/* Cards & Flowcharts Grid */}
          <Grid container spacing={4}>
            {/* Card 1 */}
            {/* <Grid item xs={12} md={4}>
              <Box
                ref={card1Ref}
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  height: "100%",
                }}
              >
                <CustomCard
                  heading="Ladli Beti"
                  description="Aimed at promoting the education and well-being of the girl child, this scheme provides financial support to families for the upbringing and education of daughters."
                  gradient="linear-gradient(135deg, #F44336 0%, #E91E63 100%)"
                  icon={<GirlSharp sx={{ fontSize: 40 }} />}
                />
                <Box sx={{ mt: "auto", pt: 2 }}>
                  <SchemeFlowchart flow={FLOWS.ladliBeti} accent="#E91E63" />
                </Box>
              </Box>
            </Grid> */}

            {/* Card 2 */}
            <Grid item xs={12} md={6}>
              <Box
                ref={card2Ref}
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  height: "100%",
                }}
              >
                <CustomCard
                  heading="Marriage Assistance"
                  description="This scheme extends financial assistance to economically disadvantaged women at the time of their marriage, ensuring dignity and reducing economic burden."
                  gradient="linear-gradient(135deg, #4CAF50 0%, #81C784 100%)"
                  icon={<FavoriteBorderOutlined sx={{ fontSize: 40 }} />}
                />
                <Box sx={{ mt: "auto", pt: 2 }}>
                  <SchemeFlowchart flow={FLOWS.mas} accent="#4CAF50" />
                </Box>
              </Box>
            </Grid>

            {/* Card 3 */}
            <Grid item xs={12} md={6}>
              <Box
                ref={card3Ref}
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  height: "100%",
                }}
              >
                <CustomCard
                  heading="JK-ISSS Pension"
                  description="Comprehensive pension program offering financial security to senior citizens, persons with disabilities, women in distress, and transgender individuals."
                  gradient="linear-gradient(135deg, #2561E8 0%, #1F43B4 100%)"
                  icon={<AccountBalanceSharp sx={{ fontSize: 40 }} />}
                />
                <Box sx={{ mt: "auto", pt: 2 }}>
                  <SchemeFlowchart flow={FLOWS.isss} accent="#1F43B4" />
                </Box>
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>
    </Box>
  );
}
