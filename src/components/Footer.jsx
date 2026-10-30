import {
  Box,
  Grid,
  Typography,
  Link,
  Divider,
  Container,
  IconButton,
  Tooltip,
  Chip,
} from "@mui/material";
import React from "react";
import { useNavigate } from "react-router-dom";

// Icons
import EmailIcon from "@mui/icons-material/Email";
import PhoneIcon from "@mui/icons-material/Phone";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import TwitterIcon from "@mui/icons-material/Twitter";
import FacebookIcon from "@mui/icons-material/Facebook";
import YouTubeIcon from "@mui/icons-material/YouTube";
import InstagramIcon from "@mui/icons-material/Instagram";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import VisibilityIcon from "@mui/icons-material/Visibility";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";

export default function Footer() {
  const navigate = useNavigate();

  const handleNav = (path) => (e) => {
    e.preventDefault();
    navigate(path);
  };

  const linkStyle = {
    color: "rgba(255, 255, 255, 0.7)",
    textDecoration: "none",
    fontSize: "0.9rem",
    fontWeight: 400,
    display: "block",
    mb: 1.5,
    transition: "all 0.2s ease",
    "&:hover": {
      color: "#F9A825", // Brand orange/gold on hover
      transform: "translateX(4px)",
    },
  };

  const sectionTitleStyle = {
    color: "#F9A825",
    fontWeight: 700,
    fontSize: "1.1rem",
    mb: 2.5,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    position: "relative",
    pb: 1,
    "&::after": {
      content: '""',
      position: "absolute",
      bottom: 0,
      left: 0,
      width: "40px",
      height: "3px",
      bgcolor: "#2563EB",
      borderRadius: "2px",
    },
  };

  return (
    <Box
      component="footer"
      sx={{
        background: "linear-gradient(180deg, #0F172A 0%, #1E293B 100%)",
        color: "white",
        position: "relative",
        pt: 8,
        pb: 0,
        mt: 8,
        borderTop: "4px solid",
        borderImage: "linear-gradient(to right, #2563EB, #F9A825) 1",
      }}
    >
      <Container maxWidth="lg">
        <Grid container spacing={4}>
          {/* Column 1: Branding & About */}
          <Grid item xs={12} md={4}>
            <Box sx={{ display: "flex", alignItems: "center", mb: 3 }}>
              <Box
                sx={{
                  width: 56,
                  height: 56,
                  bgcolor: "linear-gradient(135deg, #2563EB 0%, #1E40AF 100%)",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "2px solid rgba(255,255,255,0.2)",
                  boxShadow: "0 4px 12px rgba(37, 99, 235, 0.4)",
                  mr: 2,
                }}
              >
                <Typography
                  variant="h6"
                  sx={{ fontWeight: "bold", color: "white" }}
                >
                  ISSS
                </Typography>
              </Box>
              <Box>
                <Typography
                  variant="h5"
                  sx={{ fontWeight: 800, color: "white", lineHeight: 1.2 }}
                >
                  ISSS Pension
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: "rgba(255,255,255,0.6)" }}
                >
                  Social Welfare Portal
                </Typography>
              </Box>
            </Box>

            <Typography
              variant="body2"
              sx={{ color: "rgba(255,255,255,0.7)", mb: 2, lineHeight: 1.7 }}
            >
              Facilitating transparent and structured financial assistance for
              every citizen of Jammu & Kashmir through a digital-first approach.
            </Typography>

            <Box sx={{ display: "flex", gap: 1.5, mt: 3 }}>
              {[
                { icon: <TwitterIcon />, label: "Twitter" },
                { icon: <FacebookIcon />, label: "Facebook" },
                { icon: <YouTubeIcon />, label: "YouTube" },
                { icon: <InstagramIcon />, label: "Instagram" },
              ].map((social) => (
                <Tooltip title={social.label} key={social.label}>
                  <IconButton
                    sx={{
                      bgcolor: "rgba(255,255,255,0.05)",
                      color: "rgba(255,255,255,0.8)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      "&:hover": {
                        bgcolor: "#2563EB",
                        color: "white",
                        transform: "translateY(-2px)",
                      },
                      transition: "all 0.3s ease",
                    }}
                  >
                    {social.icon}
                  </IconButton>
                </Tooltip>
              ))}
            </Box>
          </Grid>

          {/* Column 2: Portal Links */}
          <Grid item xs={6} sm={4} md={2}>
            <Typography sx={sectionTitleStyle}>Portal</Typography>
            <Box sx={{ display: "flex", flexDirection: "column" }}>
              <Link
                href="/user/home"
                onClick={handleNav("/user/home")}
                sx={linkStyle}
              >
                Home
              </Link>
              <Link
                href="/user/services"
                onClick={handleNav("/user/services")}
                sx={linkStyle}
              >
                Apply for Service
              </Link>
              <Link
                href="/user/initiated"
                onClick={handleNav("/user/initiated")}
                sx={linkStyle}
              >
                Track Status
              </Link>
              <Link
                href="/feedback"
                onClick={handleNav("/feedback")}
                sx={linkStyle}
              >
                Feedback
              </Link>
              <Link
                href="/register"
                onClick={handleNav("/register")}
                sx={linkStyle}
              >
                Register / Login
              </Link>
            </Box>
          </Grid>

          {/* Column 3: Government Info */}
          <Grid item xs={6} sm={4} md={2}>
            <Typography sx={sectionTitleStyle}>Information</Typography>
            <Box sx={{ display: "flex", flexDirection: "column" }}>
              <Link href="#rti" sx={linkStyle}>
                RTI
              </Link>
              <Link href="#grievance" sx={linkStyle}>
                Grievance
              </Link>
              <Link href="#faq" sx={linkStyle}>
                Help / FAQ
              </Link>
              <Link href="#sitemap" sx={linkStyle}>
                Sitemap
              </Link>
              <Link href="#accessibility" sx={linkStyle}>
                Accessibility
              </Link>
            </Box>
          </Grid>

          {/* Column 4: Contact Info */}
          <Grid item xs={12} sm={4} md={4}>
            <Typography sx={sectionTitleStyle}>Reach Us</Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
                <LocationOnIcon sx={{ color: "#F9A825", mt: 0.3 }} />
                <Typography
                  variant="body2"
                  sx={{ color: "rgba(255,255,255,0.8)", lineHeight: 1.6 }}
                >
                  Directorate of Social Welfare,
                  <br />
                  Jammu & Kashmir, India
                </Typography>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <PhoneIcon sx={{ color: "#F9A825" }} />
                <Typography
                  variant="body2"
                  sx={{ color: "rgba(255,255,255,0.8)" }}
                >
                  Helpline: 1800-XXX-XXXX (Toll Free)
                </Typography>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <EmailIcon sx={{ color: "#F9A825" }} />
                <Typography
                  variant="body2"
                  sx={{ color: "rgba(255,255,255,0.8)" }}
                >
                  support@jkswd.gov.in
                </Typography>
              </Box>
            </Box>
          </Grid>
        </Grid>

        {/* Government Initiatives Strip */}
        <Box
          sx={{
            mt: 6,
            py: 3,
            borderTop: "1px solid rgba(255,255,255,0.1)",
            borderBottom: "1px solid rgba(255,255,255,0.1)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            flexWrap: "wrap",
            gap: { xs: 3, md: 6 },
            opacity: 0.6,
            "&:hover": { opacity: 0.9 },
            transition: "opacity 0.3s ease",
          }}
        >
          {["Digital India", "NIC", "MeitY", "MyGov", "J&K Govt"].map(
            (initiative) => (
              <Typography
                key={initiative}
                variant="caption"
                sx={{
                  fontWeight: 700,
                  letterSpacing: "1px",
                  color: "rgba(255,255,255,0.8)",
                  textTransform: "uppercase",
                }}
              >
                {initiative}
              </Typography>
            ),
          )}
        </Box>

        {/* Bottom Bar */}
        <Box
          sx={{
            mt: 4,
            py: 3,
            bgcolor: "#0B1120", // Solid dark background, NO opacity
            mx: { xs: -2, sm: -3, md: -4 },
            px: { xs: 2, sm: 3, md: 4 },
          }}
        >
          <Box
            sx={{
              display: "flex",
              flexDirection: { xs: "column", md: "row" },
              justifyContent: "space-between",
              alignItems: "center",
              gap: 2,
            }}
          >
            {/* Left: Copyright & Stats */}
            <Box
              sx={{
                display: "flex",
                flexDirection: { xs: "column", sm: "row" },
                alignItems: { xs: "flex-start", sm: "center" },
                gap: { xs: 1, sm: 3 },
              }}
            >
              <Typography
                variant="body2"
                sx={{ color: "rgba(255,255,255,0.6)", fontSize: "0.85rem" }}
              >
                © {new Date().getFullYear()} Department of Social Welfare, J&K.
                All rights reserved.
              </Typography>
              <Box sx={{ display: "flex", gap: 2 }}>
                <Chip
                  icon={
                    <CalendarMonthIcon sx={{ fontSize: "14px !important" }} />
                  }
                  label="Last Updated: Aug 2026"
                  size="small"
                  sx={{
                    bgcolor: "rgba(255,255,255,0.05)",
                    color: "rgba(255,255,255,0.7)",
                    fontSize: "0.75rem",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                />
                <Chip
                  icon={<VisibilityIcon sx={{ fontSize: "14px !important" }} />}
                  label="Visitors: 1,24,500"
                  size="small"
                  sx={{
                    bgcolor: "rgba(255,255,255,0.05)",
                    color: "rgba(255,255,255,0.7)",
                    fontSize: "0.75rem",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                />
              </Box>
            </Box>

            {/* Right: Legal Links & Back to Top */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 3 }}>
              {["Privacy Policy", "Terms of Service", "Disclaimer"].map(
                (link) => (
                  <Link
                    key={link}
                    href={`#${link.toLowerCase().replace(/ /g, "-")}`}
                    sx={{
                      color: "rgba(255,255,255,0.6)",
                      textDecoration: "none",
                      fontSize: "0.85rem",
                      "&:hover": {
                        color: "#F9A825",
                        textDecoration: "underline",
                      },
                    }}
                  >
                    {link}
                  </Link>
                ),
              )}
              <Tooltip title="Back to Top">
                <IconButton
                  onClick={() =>
                    window.scrollTo({ top: 0, behavior: "smooth" })
                  }
                  sx={{
                    bgcolor: "#2563EB",
                    color: "white",
                    "&:hover": { bgcolor: "#1D4ED8" },
                    boxShadow: "0 4px 12px rgba(37, 99, 235, 0.4)",
                  }}
                >
                  <ArrowUpwardIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
