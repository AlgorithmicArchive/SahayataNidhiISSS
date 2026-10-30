import React, { useEffect, useState, useRef } from "react";
import {
  Box,
  CircularProgress,
  Select,
  MenuItem,
  FormControl,
} from "@mui/material";
import TranslateIcon from "@mui/icons-material/Translate";

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी" },
  { code: "ur", label: "اردو" },
];

const COOKIE_NAME = "googtrans";

// Helper: read cookie
const getCookie = (name) => {
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
};

// Helper: write cookie for both current domain AND parent domain
// (Google requires the cookie on the parent domain too to persist)
const setLanguageCookie = (langCode) => {
  const value = `/en/${langCode}`;
  const hostParts = window.location.hostname.split(".");
  const parentDomain =
    hostParts.length > 2
      ? hostParts.slice(-2).join(".")
      : window.location.hostname;

  // Set for current host
  document.cookie = `${COOKIE_NAME}=${value};path=/`;
  // Set for parent domain (needed for Google's iframe to read it)
  document.cookie = `${COOKIE_NAME}=${value};path=/;domain=.${parentDomain}`;
};

const GoogleTranslateWidget = () => {
  const [currentLang, setCurrentLang] = useState("en");
  const [isTranslating, setIsTranslating] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const initRef = useRef(false);

  // Read saved language from cookie on mount
  useEffect(() => {
    const saved = getCookie(COOKIE_NAME);
    if (saved) {
      const code = saved.split("/").pop();
      if (LANGUAGES.some((l) => l.code === code)) {
        setCurrentLang(code);
      }
    }
  }, []);

  // Load Google Translate script once
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const scriptUrl =
      "//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";

    window.googleTranslateElementInit = () => {
      new window.google.translate.TranslateElement(
        {
          pageLanguage: "en",
          includedLanguages: LANGUAGES.map((l) => l.code).join(","),
          autoDisplay: false,
        },
        "google_translate_element_hidden", // Hidden container — we use our own UI
      );
      setScriptLoaded(true);

      // Apply saved language immediately after init
      const saved = getCookie(COOKIE_NAME);
      if (saved) {
        const code = saved.split("/").pop();
        if (code !== "en") {
          setTimeout(() => triggerTranslate(code), 300);
        }
      }
    };

    if (!document.querySelector(`script[src="${scriptUrl}"]`)) {
      const script = document.createElement("script");
      script.src = scriptUrl;
      script.async = true;
      document.body.appendChild(script);
    } else if (window.google?.translate) {
      window.googleTranslateElementInit();
    }
  }, []);

  // Programmatically trigger Google Translate via its hidden dropdown
  const triggerTranslate = (langCode) => {
    setIsTranslating(true);

    // Find the hidden <select> Google creates
    const frame = document.querySelector(".goog-te-combo");
    if (frame) {
      frame.value = langCode;
      frame.dispatchEvent(new Event("change"));
    }

    // Hide Google's top banner (ugly blue bar)
    const hideBanner = () => {
      const bannerFrame = document.querySelector(".goog-te-banner-frame");
      if (bannerFrame) {
        try {
          const body = bannerFrame.contentDocument?.body;
          if (body) {
            const closeBtn = body.querySelector(".goog-close-link");
            if (closeBtn) closeBtn.click();
          }
        } catch (e) {
          /* cross-origin */
        }
      }
    };
    setTimeout(hideBanner, 500);
    setTimeout(hideBanner, 1500);

    // Turn off loader once DOM is translated (usually 400–900ms)
    setTimeout(() => setIsTranslating(false), 1200);
  };

  // Language change handler
  const handleLangChange = (e) => {
    const code = e.target.value;
    setCurrentLang(code);
    setLanguageCookie(code);

    if (code === "en") {
      // Reset to English by clearing cookie and reloading
      document.cookie = `${COOKIE_NAME}=;path=/;expires=Thu, 01 Jan 1970 00:00:00 GMT`;
      const hostParts = window.location.hostname.split(".");
      const parentDomain =
        hostParts.length > 2
          ? hostParts.slice(-2).join(".")
          : window.location.hostname;
      document.cookie = `${COOKIE_NAME}=;path=/;domain=.${parentDomain};expires=Thu, 01 Jan 1970 00:00:00 GMT`;
      window.location.reload();
    } else {
      triggerTranslate(code);
    }
  };

  return (
    <>
      {/* Hidden container Google needs (don't remove) */}
      <div id="google_translate_element_hidden" style={{ display: "none" }} />

      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        {isTranslating && (
          <CircularProgress
            size={14}
            sx={{ color: "#1D4ED8", animation: "spin 1s linear infinite" }}
          />
        )}
        <FormControl size="small">
          <Select
            value={currentLang}
            onChange={handleLangChange}
            disabled={!scriptLoaded || isTranslating}
            displayEmpty
            renderValue={(v) => (
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <TranslateIcon sx={{ fontSize: 14 }} />
                <span>
                  {LANGUAGES.find((l) => l.code === v)?.label || "Language"}
                </span>
              </Box>
            )}
            sx={{
              minWidth: 110,
              fontSize: "0.75rem",
              border: "1px solid #1D4ED8",
              borderRadius: "8px",
              "& .MuiSelect-select": {
                pl: 1,
                pr: "8px !important",
                py: 0.25,
                display: "flex",
                alignItems: "center",
              },
              "& .MuiOutlinedInput-notchedOutline": { border: "none" },
              "& .MuiSvgIcon-root": { display: "none" },
            }}
            MenuProps={{ PaperProps: { sx: { borderRadius: "8px" } } }}
          >
            {LANGUAGES.map((lang) => (
              <MenuItem
                key={lang.code}
                value={lang.code}
                sx={{ fontSize: "0.8rem" }}
              >
                {lang.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      <style>{`
        /* Hide all of Google's default UI artifacts */
        .goog-te-banner-frame, .goog-logo-link, .goog-te-gadget span { display: none !important; }
        body { top: 0 !important; }
        .goog-text-highlight { background: none !important; box-shadow: none !important; }
        /* Spinner animation */
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
};

export default GoogleTranslateWidget;
