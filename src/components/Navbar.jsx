import React, { useContext, useState, useEffect, useRef, useMemo } from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  IconButton,
  Box,
  Paper,
  MenuList,
  MenuItem,
  Popper,
  Menu,
  CircularProgress,
  Collapse,
  ClickAwayListener,
  useMediaQuery,
} from "@mui/material";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { UserContext } from "../UserContext";
import TokenTimer from "./TokenTimer";
import axiosInstance from "../axiosConfig";
import MenuIcon from "@mui/icons-material/Menu";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import { toast } from "react-toastify";

const MyNavbar = () => {
  // Aligns exactly with MUI's `md` breakpoint, which is what the sx props use
  const isDesktop = useMediaQuery("(min-width: 900px)");

  const [mobileMenuAnchor, setMobileMenuAnchor] = useState(null);
  const [openSubmenu, setOpenSubmenu] = useState(null);
  const [openMenu, setOpenMenu] = useState(null);
  const [popperAnchor, setPopperAnchor] = useState(null);
  const [loginLoading, setLoginLoading] = useState(false);

  const timeoutRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  const {
    userType,
    setUserType,
    setToken,
    setUsername,
    setProfile,
    username,
    profile,
    designation,
    verified,
    setVerified,
    officerAuthorities,
    actualUserType,
  } = useContext(UserContext);

  const API_BASE = window.__CONFIG__?.API_URL || "";

  useEffect(() => {
    return () => timeoutRef.current && clearTimeout(timeoutRef.current);
  }, []);

  /* -------------------------------------------------
     Logout & navigation
  ------------------------------------------------- */
  const handleLogout = async () => {
    try {
      const r = await axiosInstance.post(`${API_BASE}/Home/LogOut`);
      if (r.data.sso && r.data.logoutUrl) {
        window.location.href = r.data.logoutUrl;
        return;
      }
    } catch {
      /* fall through to local logout */
    }

    setToken(null);
    setUserType(null);
    setUsername(null);
    setProfile(null);
    setVerified(false);
    sessionStorage.clear();
    closeAllMenus();
    navigate("/");
  };

  const closeAllMenus = () => {
    setMobileMenuAnchor(null);
    setPopperAnchor(null);
    setOpenMenu(null);
    setOpenSubmenu(null);
  };

  const handleNavigate = async (path) => {
    if (path === "/login") {
      try {
        setLoginLoading(true);
        toast.info("Attempting SSO login...", { autoClose: 2000 });

        const SSO_TIMEOUT = 5000;
        const ssoPromise = fetch(`${API_BASE}/Home/InitiateSSO`, {
          method: "GET",
        });
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("SSO timeout")), SSO_TIMEOUT),
        );

        const response = await Promise.race([ssoPromise, timeoutPromise]);
        const d = await response.json();

        if (d.redirectUrl) {
          toast.success("Redirecting to SSO provider...");
          setTimeout(() => (window.location.href = d.redirectUrl), 300);
        } else {
          toast.warning(d.message || "SSO failed, using manual login");
          setLoginLoading(false);
          navigate("/");
        }
      } catch (error) {
        let errorMessage = "Login error";
        if (error.message === "SSO timeout") {
          errorMessage = "SSO service timeout - using manual login";
        } else if (error.name === "TypeError") {
          errorMessage = "Network error - using manual login";
        }
        toast.warning(errorMessage);
        setLoginLoading(false);
        navigate("/");
      }
    } else {
      navigate(path);
      closeAllMenus();
    }
  };

  const handleMobileMenuOpen = (e) => setMobileMenuAnchor(e.currentTarget);
  const handleMobileMenuClose = () => setMobileMenuAnchor(null);

  /* -------------------------------------------------
     Hover (desktop) & click (all devices)
  ------------------------------------------------- */
  const handleMouseEnter = (key, el) => {
    if (isDesktop) {
      clearTimeout(timeoutRef.current);
      setOpenMenu(key);
      setPopperAnchor(el);
    }
  };

  const handleClick = (key, el) => {
    clearTimeout(timeoutRef.current);
    setOpenMenu((prev) => (prev === key ? null : key));
    setPopperAnchor(el);
  };

  const handleMouseLeave = () => {
    if (isDesktop) {
      timeoutRef.current = setTimeout(() => setOpenMenu(null), 200);
    }
  };

  const handleMenuMouseEnter = () => clearTimeout(timeoutRef.current);
  const handleMenuMouseLeave = () => handleMouseLeave();

  /* -------------------------------------------------
     Styles
  ------------------------------------------------- */
  const getActivePaths = (item) => {
    if (item.path) return [item.path];
    if (item.subItems) return item.subItems.map((s) => s.path).filter(Boolean);
    return [];
  };

  const getNavItemStyle = (item) => {
    const active = getActivePaths(item).includes(location.pathname);
    return {
      color: active ? "#FFF" : "#374151",
      fontWeight: active ? 600 : 500,
      padding: "8px 16px",
      transition: "all .3s ease",
      background: active
        ? "linear-gradient(to right, #10B582, #0D9588)"
        : "transparent",
      borderRadius: 2,
      boxShadow: active ? "0 4px 10px rgba(16, 181, 130, 0.25)" : "none",
      textTransform: "none",
      "&:hover": {
        transform: active ? "none" : "translateY(-1px)",
        color: !active ? "#0FB282" : undefined,
        backgroundColor: !active ? "rgba(16, 181, 130, 0.08)" : undefined,
      },
      ...(item.isSpecial && {
        background: "linear-gradient(to right, #E5620A, #D97706)",
        color: "#fff",
        boxShadow: "0 4px 10px rgba(229, 98, 10, 0.3)",
        "&:hover": {
          background: "linear-gradient(to right, #D97706, #B45309)",
          transform: "translateY(-2px)",
        },
        marginLeft: 2,
      }),
      display: "flex",
      alignItems: "center",
      gap: 0.5,
    };
  };

  const getMenuItemStyle = (path) => {
    const active = location.pathname === path;
    return {
      backgroundColor: active ? "rgba(16, 181, 130, 0.12)" : "transparent",
      color: active ? "#0D9588" : "#374151",
      fontWeight: active ? 600 : "normal",
      borderRadius: 1,
      mb: 0.5,
      "&:hover": {
        backgroundColor: active ? "rgba(16, 181, 130, 0.18)" : "#f3f4f6",
        color: "#0FB282",
      },
    };
  };

  /* -------------------------------------------------
     Dynamic menu config
  ------------------------------------------------- */
  const getMenuConfig = () => {
    const m = [];
    if (!userType && !verified) {
      m.push(
        { name: "Home", path: "/", key: "home" },
        { name: "Login", path: "/login", key: "login", isSpecial: true },
        {
          name: "Department Officer Register",
          path: "/officerRegistration",
          key: "officerRegistration",
          isSpecial: true,
        },
      );
    }
    if (userType === "Citizen" && verified) {
      m.push(
        { name: "Home", path: "/user/home", key: "citizen-home" },
        {
          name: "Apply for Service",
          path: "/user/services",
          key: "apply-service",
        },
        {
          name: "Application Status",
          key: "app-status",
          subItems: [
            { name: "Initiated Applications", path: "/user/initiated" },
            { name: "Incomplete Applications", path: "/user/incomplete" },
          ],
        },
      );
    }
    if (userType === "Officer" && verified) {
      m.push(
        { name: "Dashboard", path: "/officer/home", key: "officer-home" },
        { name: "Reports", path: "/officer/reports", key: "officer-reports" },
      );
      if (officerAuthorities?.canSanction) {
        m.push({
          name: "DSC Management",
          key: "dsc-mgmt",
          subItems: [{ name: "Register DSC", path: "/officer/registerdsc" }],
        });
      }
      if (officerAuthorities?.canManageBankFiles) {
        m.push({
          name: "Bank Files",
          key: "bank-files",
          subItems: [
            { name: "Create Bank File", path: "/officer/bankFile" },
            {
              name: "Update Bank Response File",
              path: "/officer/responseFile",
            },
          ],
        });
      }
      const upd = [];
      if (officerAuthorities?.canCorrigendum)
        upd.push({ name: "Data Updation", path: "/officer/issuecorrigendum" });
      if (
        officerAuthorities?.canWithhold ||
        officerAuthorities?.canDirectWithheld
      )
        upd.push({ name: "Withheld Application", path: "/officer/withheld" });
      if (upd.length)
        m.push({
          name: "Applications Updations",
          key: "updations",
          subItems: upd,
        });
      m.push({
        name: "View Applications",
        key: "view-apps",
        subItems: [
          { name: "Search Application", path: "/officer/searchapplication" },
        ],
      });
    }
    if (userType === "Viewer" && verified) {
      m.push({ name: "Dashboard", path: "/viewer/home", key: "viewer-home" });
    }
    if (userType === "Admin" && verified) {
      m.push(
        { name: "Dashboard", path: "/admin/home", key: "admin-home" },
        { name: "Reports", path: "/admin/reports", key: "admin-reports" },
        {
          name: "Add",
          key: "admin-add",
          subItems: [
            { name: "Admin", path: "/admin/addadmin" },
            { name: "Designation", path: "/admin/addDesignations" },
            { name: "Offices Type", path: "/admin/addOffices" },
            { name: "Offices Details", path: "/admin/addOfficeDetails" },
            ...(designation === "System Admin"
              ? [{ name: "Department", path: "/admin/addDepartment" }]
              : []),
          ],
        },
        {
          name: "Validate Officers",
          path: "/admin/validateofficer",
          key: "admin-validate",
        },
        {
          name: "Webservice Logs",
          path: "/admin/webservicelogs",
          key: "admin-webservicelogs",
        },
        {
          name: "Eligibility Criteria",
          path: "/admin/manageEligibilityCriteria",
          key: "admin-eligibility-criteria",
        },
      );
    }
    if (userType === "Designer" && verified) {
      m.push(
        {
          name: "Dashboard",
          path: "/designer/dashboard",
          key: "designer-dashboard",
        },
        {
          name: "Dynamic Form",
          path: "/designer/dynamicform",
          key: "dynamic-form",
        },
        {
          name: "Create/Update",
          key: "designer-create",
          subItems: [
            { name: "Service", path: "/designer/createservice" },
            { name: "WorkFlow", path: "/designer/createworkflow" },
            { name: "Corrections/Corrigendum", path: "/designer/corrections" },
            { name: "Letter Pdf", path: "/designer/createletterpdf" },
            { name: "Web Service", path: "/designer/createwebservice" },
            { name: "Create Reports", path: "/designer/createreports" },
            { name: "Notifications", path: "/designer/emailsettings" },
            { name: "Expiration Types", path: "/designer/expirations" },
            {
              name: "Submission Limitations",
              path: "/designer/submissionlimitations",
            },
          ],
        },
      );
    }
    return m;
  };

  const menuConfig = getMenuConfig();

  const mobileMenuItems = useMemo(() => {
    if (!userType || !verified) return menuConfig;
    const profileSub = [{ name: "Logout", action: handleLogout }];
    return [
      ...menuConfig,
      { name: "Profile", key: "profile", subItems: profileSub },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuConfig, userType, verified, actualUserType]);

  /* -------------------------------------------------
     Render helpers
  ------------------------------------------------- */
  const renderDesktopItem = (item, idx) => {
    const isDrop = !!item.subItems;
    if (!isDrop) {
      const isLogin = item.path === "/login";
      return (
        <Button
          key={idx}
          component={isLogin ? "button" : Link}
          to={!isLogin ? item.path : undefined}
          sx={getNavItemStyle(item)}
          onClick={() => handleNavigate(item.path)}
          disabled={isLogin && loginLoading}
        >
          {isLogin && loginLoading ? (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <CircularProgress size={18} sx={{ color: "#fff" }} />
              <span>Redirecting...</span>
            </Box>
          ) : (
            item.name
          )}
        </Button>
      );
    }
    return (
      <Box
        key={idx}
        sx={{ position: "relative" }}
        onMouseEnter={(e) => handleMouseEnter(item.key, e.currentTarget)}
        onMouseLeave={handleMouseLeave}
      >
        <Button
          sx={getNavItemStyle(item)}
          onClick={(e) => handleClick(item.key, e.currentTarget)}
        >
          {item.name}
          <ArrowDropDownIcon
            sx={{
              fontSize: 20,
              transition: "transform 0.2s",
              transform: openMenu === item.key ? "rotate(180deg)" : "none",
            }}
          />
        </Button>
        <Popper
          open={openMenu === item.key}
          anchorEl={popperAnchor}
          placement="bottom-start"
          disablePortal={false}
          modifiers={[{ name: "offset", options: { offset: [0, -6] } }]}
          sx={{ zIndex: 1300 }}
        >
          <Box
            onMouseEnter={handleMenuMouseEnter}
            onMouseLeave={handleMenuMouseLeave}
            sx={{ pt: "6px" }}
          >
            <Paper
              sx={{
                boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
                borderRadius: 2,
                minWidth: 200,
              }}
            >
              <MenuList sx={{ py: 1 }}>
                {item.subItems.map((sub, i) => (
                  <MenuItem
                    key={i}
                    sx={{ mx: 1, px: 2, ...getMenuItemStyle(sub.path) }}
                    onClick={() => handleNavigate(sub.path)}
                  >
                    {sub.name}
                  </MenuItem>
                ))}
              </MenuList>
            </Paper>
          </Box>
        </Popper>
      </Box>
    );
  };

  const renderMobileItem = (item, idx) => {
    const isDrop = !!item.subItems;
    const open = openSubmenu === item.key;

    if (!isDrop) {
      return (
        <MenuItem
          key={idx}
          onClick={() => {
            handleMobileMenuClose();
            handleNavigate(item.path);
          }}
          sx={{ py: 1.5, ...getMenuItemStyle(item.path) }}
        >
          {item.path === "/login" && loginLoading ? (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <CircularProgress size={16} />
              <span>Redirecting...</span>
            </Box>
          ) : (
            item.name
          )}
        </MenuItem>
      );
    }

    return (
      <React.Fragment key={idx}>
        <MenuItem
          onClick={() => setOpenSubmenu(open ? null : item.key)}
          sx={{
            fontWeight: 600,
            justifyContent: "space-between",
            py: 1.5,
            color: open ? "#0FB282" : "text.primary",
            "&:hover": { backgroundColor: "#f0f0f0", color: "#10B582" },
          }}
        >
          {item.name}
          <ArrowDropDownIcon
            sx={{
              transition: "transform 0.3s",
              transform: open ? "rotate(180deg)" : "none",
            }}
          />
        </MenuItem>
        <Collapse in={open} timeout="auto" unmountOnExit>
          <Box sx={{ pl: 3, borderLeft: "2px solid #E5E7EB", ml: 3, mb: 1 }}>
            {item.subItems.map((sub, i) => (
              <MenuItem
                key={i}
                sx={{ py: 1, ...getMenuItemStyle(sub.path) }}
                onClick={() => {
                  if (sub.action) {
                    sub.action();
                  } else {
                    handleMobileMenuClose();
                    handleNavigate(sub.path);
                  }
                }}
              >
                {sub.name}
              </MenuItem>
            ))}
          </Box>
        </Collapse>
      </React.Fragment>
    );
  };

  /* -------------------------------------------------
     JSX
  ------------------------------------------------- */
  return (
    <AppBar
      position="sticky"
      sx={{
        top: 0,
        backgroundColor: "#fff",
        boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
        zIndex: 1100,
      }}
    >
      <Toolbar sx={{ justifyContent: "space-between" }}>
        {/* Logo */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            flexGrow: { xs: 1, md: 0 },
          }}
        >
          <img
            src={`/assets/images/logo.png`}
            alt="Logo"
            style={{
              height: 45,
              width: 45,
              borderRadius: "50%",
              objectFit: "cover",
            }}
            onError={(e) => {
              e.currentTarget.src = `/assets/images/fallback-logo.png`;
            }}
          />
          <Box sx={{ ml: 1.5, display: { xs: "none", sm: "block" } }}>
            <Typography
              variant="h6"
              sx={{
                color: "#111827",
                fontWeight: 800,
                lineHeight: 1.2,
                fontSize: "1.1rem",
              }}
            >
              ISSS Pension
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: "#6B7280", fontWeight: 500 }}
            >
              Social Welfare Department
            </Typography>
          </Box>
        </Box>

        {/* ─────────── MOBILE: hamburger + Menu (no ClickAwayListener) ─────────── */}
        {!isDesktop && (
          <>
            <IconButton
              edge="end"
              color="inherit"
              onClick={handleMobileMenuOpen}
              sx={{ color: "#374151" }}
            >
              <MenuIcon />
            </IconButton>

            <Menu
              anchorEl={mobileMenuAnchor}
              open={Boolean(mobileMenuAnchor)}
              onClose={handleMobileMenuClose}
              sx={{
                "& .MuiPaper-root": {
                  width: "85vw",
                  maxWidth: 340,
                  mt: 1,
                  borderRadius: 2,
                  boxShadow: "0 10px 40px rgba(0,0,0,0.1)",
                },
              }}
            >
              <Box sx={{ py: 1 }}>{mobileMenuItems.map(renderMobileItem)}</Box>
            </Menu>
          </>
        )}

        {/* ─────────── DESKTOP: ClickAwayListener wraps the whole menu ─────────── */}
        {isDesktop && (
          <ClickAwayListener onClickAway={closeAllMenus}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.5,
                backgroundColor: "#F9FAFB",
                borderRadius: 5,
                p: 0.5,
                border: "1px solid #E5E7EB",
              }}
            >
              {menuConfig.map(renderDesktopItem)}

              {userType && verified && (
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1.5,
                    ml: 1,
                    pl: 1.5,
                    borderLeft: "1px solid #E5E7EB",
                  }}
                >
                  <TokenTimer />
                  <Typography
                    sx={{
                      color: "#374151",
                      fontWeight: 600,
                      fontSize: "0.9rem",
                      display: { xs: "none", lg: "block" },
                    }}
                  >
                    {username}
                  </Typography>
                  <Box
                    onMouseEnter={(e) =>
                      handleMouseEnter("profile", e.currentTarget)
                    }
                    onMouseLeave={handleMouseLeave}
                    sx={{ position: "relative" }}
                  >
                    <IconButton
                      sx={{ p: 0 }}
                      onClick={(e) => handleClick("profile", e.currentTarget)}
                    >
                      <img
                        src={`/Base/DisplayFile?fileName=${profile}`}
                        alt="Profile"
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: "50%",
                          objectFit: "cover",
                          border: "2px solid #10B582",
                        }}
                        onError={(e) =>
                          (e.currentTarget.src = `/assets/images/profile.jpg`)
                        }
                      />
                    </IconButton>
                    <Popper
                      open={openMenu === "profile"}
                      anchorEl={popperAnchor}
                      placement="bottom-end"
                      disablePortal={false}
                      modifiers={[
                        { name: "offset", options: { offset: [0, -6] } },
                      ]}
                      sx={{ zIndex: 1300 }}
                    >
                      <Box
                        onMouseEnter={handleMenuMouseEnter}
                        onMouseLeave={handleMenuMouseLeave}
                        sx={{ pt: "6px" }}
                      >
                        <Paper
                          sx={{
                            boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
                            borderRadius: 2,
                            minWidth: 160,
                          }}
                        >
                          <MenuList sx={{ py: 1 }}>
                            <MenuItem
                              sx={{ mx: 1, px: 2, color: "#DC2626" }}
                              onClick={handleLogout}
                            >
                              Logout
                            </MenuItem>
                          </MenuList>
                        </Paper>
                      </Box>
                    </Popper>
                  </Box>
                </Box>
              )}
            </Box>
          </ClickAwayListener>
        )}
      </Toolbar>
    </AppBar>
  );
};

export default MyNavbar;
