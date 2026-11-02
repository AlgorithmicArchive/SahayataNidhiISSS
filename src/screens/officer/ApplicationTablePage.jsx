import React, { useState, useRef, useCallback, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
  CircularProgress,
  Backdrop,
  Container as MuiContainer,
  Paper,
} from "@mui/material";
import { ArrowBack } from "@mui/icons-material";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import axiosInstance from "../../axiosConfig";
import ServerSideTable from "../../components/ServerSideTable";
import BasicModal from "../../components/BasicModal";
import GovPageHeader from "../../components/gov/GovPageHeader";
import { fetchCertificateDetails } from "../../assets/fetch";

export default function ApplicationTablePage() {
  const navigate = useNavigate();
  const location = useLocation();

  // ── Params pushed in from the dashboard ─────────────────────────────
  const {
    url = "/Officer/GetApplications",
    extraParams = {},
    tableTitle = null,
    applicationType = "application",
    dataType = "new",
    type = "",
    serviceId = "",
    canSanction = false,
    canHavePool = false,
    officerRole = "",
    officerArea = "",
  } = location.state || {};

  // ── Table state ─────────────────────────────────────────────────────
  const tableRef = useRef(null);
  const tableInstanceRef = useRef(null);
  const [tableKey, setTableKey] = useState(0);

  // ── FIX: default the action to a value that actually exists in the
  // dropdown. When sanction is unavailable the previous "Sanction" default
  // left the <Select> bound to a non-existent option and caused the child's
  // isSanctionAction check to evaluate true in contexts where sanctioning
  // was never offered.
  const [selectedAction, setSelectedAction] = useState(
    canSanction && dataType === "new" ? "Sanction" : "Reject",
  );

  // ── NEW: per-service sanction batch limit (fetched from the backend) ─
  const [poolSanctionBatchLimit, setPoolSanctionBatchLimit] = useState(null);

  // ── Action state ────────────────────────────────────────────────────
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [rejectConfirmOpen, setRejectConfirmOpen] = useState(false);
  const [pullConfirmOpen, setPullConfirmOpen] = useState(false);
  const [pendingRejectRows, setPendingRejectRows] = useState([]);
  const [pin, setPin] = useState("");
  const [storedPin, setStoredPin] = useState(null);

  // ── PDF state ───────────────────────────────────────────────────────
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState("");
  const [pdfBlob, setPdfBlob] = useState(null);
  const [isSignedPdf, setIsSignedPdf] = useState(false);

  // ── Batch/sanction state ────────────────────────────────────────────
  const [currentApplicationId, setCurrentApplicationId] = useState("");
  const [pendingIds, setPendingIds] = useState([]);
  const [currentIdIndex, setCurrentIdIndex] = useState(0);
  const [pendingFormData, setPendingFormData] = useState(null);
  const [pullRow, setPullRow] = useState({});

  // ── Loader overlay ──────────────────────────────────────────────────
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState("");

  // ── Refs (avoid stale closures during the multi-app batch) ──────────
  const pdfBlobRef = useRef(null);
  const pdfUrlRef = useRef("");
  const pendingFormDataRef = useRef(null);
  const currentApplicationIdRef = useRef("");
  const currentIdIndexRef = useRef(0);
  const pendingIdsRef = useRef([]);
  const loaderDepthRef = useRef(0);

  useEffect(() => {
    pdfBlobRef.current = pdfBlob;
  }, [pdfBlob]);
  useEffect(() => {
    pdfUrlRef.current = pdfUrl;
  }, [pdfUrl]);
  useEffect(() => {
    pendingFormDataRef.current = pendingFormData;
  }, [pendingFormData]);
  useEffect(() => {
    currentApplicationIdRef.current = currentApplicationId;
  }, [currentApplicationId]);
  useEffect(() => {
    currentIdIndexRef.current = currentIdIndex;
  }, [currentIdIndex]);
  useEffect(() => {
    pendingIdsRef.current = pendingIds;
  }, [pendingIds]);

  // ── NEW: fetch the pool sanction batch limit for this service ──────
  // Only fetched when the pool + sanction flow is actually available for
  // this page. On failure the state stays null and the child's built-in
  // default of 5 applies — same behaviour as before this change.
  useEffect(() => {
    if (!serviceId || !canHavePool || !canSanction || dataType !== "new") {
      setPoolSanctionBatchLimit(null);
      return;
    }

    let alive = true;
    axiosInstance
      .get("/Officer/GetPoolSanctionBatchLimit", { params: { serviceId } })
      .then((r) => {
        const v = r.data?.poolSanctionBatchLimit;
        if (alive && Number.isInteger(v) && v > 0) {
          setPoolSanctionBatchLimit(v);
        }
      })
      .catch(() => {
        /* keep null → ServerSideTable falls back to its default */
      });

    return () => {
      alive = false;
    };
  }, [serviceId, canHavePool, canSanction, dataType]);

  // ── Scoped loader ───────────────────────────────────────────────────
  const beginLoader = useCallback((msg = "Processing…") => {
    loaderDepthRef.current += 1;
    setActionMessage(msg);
    setActionLoading(true);
  }, []);

  const endLoader = useCallback(() => {
    loaderDepthRef.current = Math.max(0, loaderDepthRef.current - 1);
    if (loaderDepthRef.current === 0) {
      setActionLoading(false);
      setActionMessage("");
    }
  }, []);

  const withLoader = useCallback(
    async (fn, message = "Processing…") => {
      beginLoader(message);
      try {
        return await fn();
      } finally {
        endLoader();
      }
    },
    [beginLoader, endLoader],
  );

  // ── Helpers ─────────────────────────────────────────────────────────
  const refreshTable = useCallback(() => {
    if (tableInstanceRef.current?.refetch) tableInstanceRef.current.refetch();
    setTableKey((prev) => prev + 1);
  }, []);

  const checkDSCStatus = async () => {
    try {
      const response = await axiosInstance.get("/Officer/GetDSCStatus");
      return response.data;
    } catch {
      return {
        status: false,
        reason: "Failed to connect to the server to verify DSC status.",
      };
    }
  };

  const fetchCertificates = async (pin) => {
    const formData = new FormData();
    formData.append("pin", pin);
    const response = await fetch("http://localhost:8000/certificates", {
      method: "POST",
      body: formData,
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  };

  const isValidPdf = async (blob) => {
    try {
      if (blob.type !== "application/pdf") return false;
      const ab = await blob.slice(0, 4).arrayBuffer();
      const header = new Uint8Array(ab);
      return [37, 80, 68, 70].every((b, i) => b === header[i]);
    } catch {
      return false;
    }
  };

  const actionFunctions = React.useMemo(
    () => ({
      handleOpenApplication: (row) =>
        navigate("/officer/userDetails", {
          state: {
            applicationId: row.original.referenceNumber,
            notaction: false,
          },
        }),
      handleViewApplication: (row) =>
        navigate("/officer/userDetails", {
          state: {
            applicationId: row.original.referenceNumber,
            notaction: false,
          },
        }),
      handleViewWithheldApplication: (row) =>
        navigate("/officer/withheld", {
          state: { applicationId: row.original.referenceNumber },
        }),
      DownloadSanctionLetter: async (row) => {
        const applicationId = row.original.referenceNumber;
        const fileName =
          applicationId.replace(/\//g, "_") + "_SanctionLetter.pdf";
        try {
          const response = await axiosInstance.get(
            "/Officer/DownloadSanctionLetter",
            { params: { fileName }, responseType: "blob" },
          );
          const blob = new Blob([response.data], { type: "application/pdf" });
          const link = document.createElement("a");
          link.href = window.URL.createObjectURL(blob);
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(link.href);
        } catch {
          toast.error("Failed to download sanction letter.", {
            position: "top-center",
            theme: "colored",
          });
        }
      },
      pullApplication: async (row) => {
        setPullRow(row.original);
        setPullConfirmOpen(true);
      },
      pullCorrigendum: async (row) => {
        setPullRow(row.original);
        setPullConfirmOpen(true);
      },
      pullWithheldApplication: async (row) => {
        setPullRow(row.original);
        setPullConfirmOpen(true);
      },
      handleViewCorrigendumApplication: (row) =>
        navigate("/officer/viewcorrigendumdetails", {
          state: {
            referenceNumber: row.original.referenceNumber,
            applicationId: row.original.applicationId,
            type: row.original.applicationType,
          },
        }),

      handleViewPdf: async (row, action) => {
        const { referenceNumber, applicationType: appType } = row.original;
        const { type: actType, corrigendumId } = action;

        if (actType === "handleViewCorrigendumApplication") {
          navigate("/officer/viewcorrigendumdetails", {
            state: {
              referenceNumber,
              applicationId: row.original.applicationId,
              type: appType,
            },
          });
          return;
        }

        let filename;
        if (actType === "DownloadSL") {
          filename = `${referenceNumber.replace(/\//g, "_")}_SanctionLetter.pdf`;
        } else if (actType === "DownloadCorrigendum") {
          filename = `${corrigendumId.replace(/\//g, "_")}_${appType}_SanctionLetter.pdf`;
        } else if (actType === "DownloadCorrection") {
          filename = `${corrigendumId.replace(/\//g, "_")}_CorrectionSanctionLetter.pdf`;
        } else if (actType === "View" && corrigendumId) {
          filename = `${corrigendumId.replace(/\//g, "_")}_${appType}_SanctionLetter.pdf`;
        }

        if (!filename) {
          toast.error("Unknown document type.", {
            position: "top-right",
            theme: "colored",
          });
          return;
        }

        try {
          const fetchedBlob = await withLoader(async () => {
            const pdfR = await axiosInstance.get("/Base/DisplayFile", {
              params: { filename },
              responseType: "blob",
            });
            const blob = new Blob([pdfR.data], { type: "application/pdf" });
            if (!(await isValidPdf(blob))) {
              throw new Error(
                `Could not load "${filename}" (server returned non-PDF).`,
              );
            }
            return blob;
          }, `Loading document…`);

          setPdfBlob(fetchedBlob);
          setPdfUrl(filename);
          setIsSignedPdf(true);
          setCurrentApplicationId(referenceNumber);
          setPdfModalOpen(true);
        } catch (error) {
          toast.error(`Error preparing PDF: ${error.message}`, {
            position: "top-right",
            theme: "colored",
            autoClose: 6000,
          });
        }
      },
      handleEditCorrigendumApplication: (row) =>
        navigate("/officer/issuecorrigendum", {
          state: {
            ReferenceNumber: row.original.referenceNumber,
            ServiceId: row.original.serviceId,
            applicationId: row.original.applicationId,
            applicationType: row.original.applicationType,
          },
        }),
      handleEditCorrectionApplication: (row) =>
        navigate("/officer/issuecorrection", {
          state: {
            ReferenceNumber: row.original.referenceNumber,
            ServiceId: row.original.serviceId,
            applicationId: row.original.applicationId,
          },
        }),
      sendExpirationEmail: async (row) => {
        beginLoader("Sending email…");
        const { referenceNumber, expiryDate } = row.original;
        const expirationDate = expiryDate?.split("(")[0].trim() || "";
        const formdata = new FormData();
        formdata.append("referenceNumber", referenceNumber);
        formdata.append("expirationDate", expirationDate);
        try {
          const response = await axiosInstance.post(
            "/Officer/SendExpirationEmail",
            formdata,
          );
          if (response.data.status) {
            toast.success("Expiration email sent!", {
              position: "top-right",
              theme: "colored",
            });
            refreshTable();
          }
        } catch {
          toast.error("Failed to send expiration email.", {
            position: "top-right",
            theme: "colored",
          });
        } finally {
          endLoader();
        }
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [navigate, refreshTable, beginLoader, endLoader],
  );

  // ── Push to pool ────────────────────────────────────────────────────
  const handlePushToPool = useCallback(
    async (selectedRows) => {
      if (!selectedRows?.length)
        return toast.error("No applications selected.", {
          position: "top-right",
          theme: "colored",
        });
      const list = JSON.stringify(
        selectedRows.map((r) => r.original.referenceNumber),
      );
      try {
        await withLoader(
          () =>
            axiosInstance.post("/Officer/UpdatePool", null, {
              params: { Serviceid: serviceId, list },
            }),
          "Pushing to pool…",
        );
        toast.success("Pushed to pool!", {
          position: "top-right",
          theme: "colored",
        });
        refreshTable();
      } catch {
        toast.error("Failed to push to pool.", {
          position: "top-right",
          theme: "colored",
        });
      }
    },
    [serviceId, refreshTable, withLoader],
  );

  // ── Sign PDF (local signing microservice) ───────────────────────────
  const signPdf = async (blob, pin) => {
    const formData = new FormData();
    formData.append("pdf", blob, "document.pdf");
    formData.append("pin", pin);
    formData.append(
      "original_path",
      currentApplicationIdRef.current.replace(/\//g, "_") +
        "_SanctionLetter.pdf",
    );
    const response = await fetch("http://localhost:8000/sign", {
      method: "POST",
      body: formData,
    });
    if (!response.ok)
      throw new Error(`Signing failed: ${await response.text()}`);
    return await response.blob();
  };

  // ── Single application processor ────────────────────────────────────
  const processSingleId = useCallback(
    async (id) => {
      setCurrentApplicationId(id);
      const formData = new FormData();
      formData.append("applicationId", id);
      formData.append("defaultAction", selectedAction);
      formData.append(
        "Remarks",
        selectedAction === "Sanction"
          ? "Sanctioned"
          : selectedAction === "Reject"
            ? "Rejected"
            : "Returned to Inbox",
      );

      let hasError = false;
      try {
        if (selectedAction === "toInbox") {
          const fd = new FormData();
          fd.append("Serviceid", serviceId);
          fd.append("list", JSON.stringify(Array.isArray(id) ? id : [id]));
          const r = await withLoader(
            () => axiosInstance.post("/Officer/RemoveFromPool", fd),
            `Returning ${id} to inbox…`,
          );
          if (!r.data.status)
            throw new Error(r.data.message || "Failed to remove from pool.");
        } else if (selectedAction === "Sanction") {
          const r = await withLoader(
            () =>
              axiosInstance.get("/Officer/GetSanctionLetter", {
                params: { applicationId: id },
              }),
            `Preparing sanction letter for ${id}…`,
          );
          if (!r.data.status)
            throw new Error(r.data.response || "Something went wrong");

          const pdfR = await withLoader(
            () =>
              axiosInstance.get(`/Base/DisplayFile`, {
                params: { filename: r.data.path },
                responseType: "blob",
              }),
            `Loading sanction letter for ${id}…`,
          );
          const fetchedBlob = new Blob([pdfR.data], {
            type: "application/pdf",
          });
          if (!(await isValidPdf(fetchedBlob))) {
            throw new Error(
              `Sanction letter for ${id} could not be loaded (server returned non-PDF).`,
            );
          }
          setPdfBlob(fetchedBlob);
          setPdfUrl(r.data.path);
          setIsSignedPdf(false);
          setPdfModalOpen(true);
          setPendingFormData(formData);
          return false;
        } else {
          const { data: r } = await withLoader(
            () => axiosInstance.post("/Officer/HandleAction", formData),
            `Processing ${id}…`,
          );
          if (!r.status) throw new Error(r.response || "Something went wrong");
        }
      } catch (error) {
        toast.error(`Error processing ${id}: ${error.message}`, {
          position: "top-right",
          theme: "colored",
        });
        hasError = true;
      }
      return !hasError;
    },
    [selectedAction, serviceId, withLoader],
  );

  // ── Batch processor ─────────────────────────────────────────────────
  const processAllIds = useCallback(
    async (ids) => {
      setPendingIds(ids);
      setCurrentIdIndex(0);
      let successCount = 0;
      for (let i = 0; i < ids.length; i++) {
        setCurrentIdIndex(i);
        const success = await processSingleId(ids[i]);
        if (selectedAction === "Sanction" && !success) return;
        if (success) successCount++;
      }
      setPendingIds([]);
      setCurrentIdIndex(0);
      setCurrentApplicationId("");
      toast.success(
        `${selectedAction === "toInbox" ? "Returned" : selectedAction} ${successCount} of ${ids.length}!`,
        { position: "top-right", theme: "colored" },
      );
      refreshTable();
    },
    [selectedAction, processSingleId, refreshTable],
  );

  // ── Sign + update flow ──────────────────────────────────────────────
  const signAndUpdatePdf = useCallback(
    async (pinToUse) => {
      try {
        const blob = pdfBlobRef.current;
        const appId = currentApplicationIdRef.current;
        const formData = pendingFormDataRef.current;

        if (!blob) throw new Error("No PDF blob");
        if (!(await isValidPdf(blob))) throw new Error("Invalid PDF");

        const certDetails = await fetchCertificateDetails();
        if (!certDetails) throw new Error("No registered DSC");

        const certificates = await withLoader(
          () => fetchCertificates(pinToUse),
          "Reading USB token…",
        );
        if (!certificates?.length) throw new Error("No certificates on token");

        const selected = certificates[0];

        if (new Date(certDetails.expirationDate) < new Date()) {
          throw new Error("Certificate expired");
        }

        const norm = (v) =>
          String(v ?? "")
            .replace(/\s+/g, "")
            .replace(/-/g, "")
            .toUpperCase();

        const dbSerial = norm(certDetails.serial_number);
        const tokenSerial = norm(selected.serial_number);
        const tokenHex = norm(selected.serial_number_hex);
        const tokenInt = String(selected.serial_number_int ?? "");

        let isMatch = false;

        if (dbSerial === tokenSerial) {
          isMatch = true;
          console.log("✅ Matched via direct decimal string comparison");
        }

        if (!isMatch && dbSerial === tokenHex) {
          isMatch = true;
          console.log("✅ Matched via direct hex comparison");
        }

        if (!isMatch) {
          try {
            const dbAsInt = parseInt(dbSerial, 16);
            if (!isNaN(dbAsInt) && dbAsInt.toString() === tokenInt) {
              isMatch = true;
              console.log("✅ Matched via hex-to-int conversion");
            }
          } catch (e) {}
        }

        if (!isMatch) {
          try {
            const dbAsDecimal = parseInt(dbSerial, 10);
            if (!isNaN(dbAsDecimal) && dbAsDecimal.toString() === tokenInt) {
              isMatch = true;
              console.log("✅ Matched via decimal-to-int comparison");
            }
          } catch (e) {}
        }

        if (!isMatch && dbSerial.length % 2 === 0 && dbSerial.length > 0) {
          try {
            let decoded = "";
            for (let i = 0; i < dbSerial.length; i += 2) {
              decoded += String.fromCharCode(
                parseInt(dbSerial.substr(i, 2), 16),
              );
            }
            if (/^\d+$/.test(decoded) && decoded === tokenInt) {
              isMatch = true;
              console.log("✅ Matched via ASCII decode fallback");
            }
          } catch (e) {}
        }

        if (!isMatch) {
          console.log(
            "❌ Mismatch! DB Serial:",
            certDetails.serial_number,
            "| Token Decimal:",
            selected.serial_number,
            "| Token Hex:",
            selected.serial_number_hex,
            "| Token Int:",
            selected.serial_number_int,
          );
          throw new Error("Not the registered certificate");
        }

        const signedBlob = await withLoader(
          () => signPdf(blob, pinToUse, selected.serial_number_hex),
          "Signing PDF…",
        );
        const updForm = new FormData();
        updForm.append("signedPdf", signedBlob, "signed.pdf");
        updForm.append("applicationId", appId);
        const updR = await withLoader(
          () => axiosInstance.post("/Officer/UpdatePdf", updForm),
          `Uploading signed PDF for ${appId}…`,
        );
        if (!updR.data.status) throw new Error("Failed to update PDF");

        if (formData) {
          const { data: r } = await withLoader(
            () => axiosInstance.post("/Officer/HandleAction", formData),
            `Sanctioning ${appId}…`,
          );
          if (!r.status) throw new Error(r.response || "Failed to sanction");
        }

        if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
        setPdfUrl(updR.data.path);
        setPdfBlob(null);
        setIsSignedPdf(true);
        setPendingFormData(null);
        toast.success("PDF signed!", {
          position: "top-right",
          theme: "colored",
        });

        const ids = pendingIdsRef.current;
        const idx = currentIdIndexRef.current;
        const next = idx + 1;

        if (next < ids.length) {
          setCurrentIdIndex(next);
          setCurrentApplicationId(ids[next]);
          await new Promise((r) => setTimeout(r, 500));
          await processSingleId(ids[next]);
        } else {
          setPendingIds([]);
          setCurrentIdIndex(0);
          setCurrentApplicationId("");
          setConfirmOpen(false);
          toast.success(`Sanctioned ${ids.length}!`, {
            position: "top-right",
            theme: "colored",
          });
          refreshTable();
        }
      } catch (error) {
        toast.error(error.message, {
          position: "top-right",
          theme: "colored",
        });
        setPendingFormData(null);
        throw error;
      }
    },
    [processSingleId, refreshTable, withLoader],
  );

  const handlePinSubmit = useCallback(async () => {
    if (!pin) {
      return toast.error("Please enter the PIN.", {
        position: "top-right",
        theme: "colored",
      });
    }
    try {
      await signAndUpdatePdf(pin);
      setStoredPin(pin);
      setConfirmOpen(false);
      setPin("");
    } catch {
      setConfirmOpen(false);
      setPin("");
    }
  }, [pin, signAndUpdatePdf]);

  const handleSignPdf = useCallback(async () => {
    if (!storedPin) {
      setConfirmOpen(true);
      return;
    }
    try {
      await signAndUpdatePdf(storedPin);
    } catch (error) {
      const isCertError =
        error.message.includes("No certificates") ||
        error.message.includes("Not the registered") ||
        error.message.includes("expired");
      if (isCertError) {
        setStoredPin(null);
        setConfirmOpen(true);
        return;
      }
      toast.error(`Sanctioning stopped: ${error.message}`, {
        position: "top-right",
        theme: "colored",
        autoClose: 6000,
      });
    }
  }, [storedPin, signAndUpdatePdf]);

  // ── Reject flow ─────────────────────────────────────────────────────
  const handleRejectConfirm = useCallback(async () => {
    setRejectConfirmOpen(false);
    await processAllIds(
      pendingRejectRows.map((r) => r.original.referenceNumber),
    );
  }, [pendingRejectRows, processAllIds]);

  // ── Pull flow ───────────────────────────────────────────────────────
  const handlePullApplication = async () => {
    try {
      let response;

      if (
        applicationType === "Corrigendum" ||
        applicationType === "Correction" ||
        applicationType === "Amendment"
      ) {
        response = await withLoader(
          () =>
            axiosInstance.get("/Officer/PullCorrigendum", {
              params: { corrigendumId: pullRow.applicationId },
            }),
          "Pulling corrigendum…",
        );
      } else if (
        url.includes("WithheldApplications") ||
        tableTitle?.toLowerCase().includes("withheld")
      ) {
        response = await withLoader(
          () =>
            axiosInstance.get("/Officer/PullWithheldApplication", {
              params: { withheldId: pullRow.withheldId },
            }),
          "Pulling withheld application…",
        );
      } else {
        response = await withLoader(
          () =>
            axiosInstance.get("/Officer/PullApplication", {
              params: { applicationId: pullRow.referenceNumber },
            }),
          "Pulling application…",
        );
      }

      if (response.data.status) {
        toast.success("Pulled successfully!", {
          position: "top-right",
          theme: "colored",
        });
        setPullConfirmOpen(false);
        refreshTable();
      } else {
        toast.error(response.data.message || "Failed to pull.", {
          position: "top-right",
          theme: "colored",
        });
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to pull.", {
        position: "top-right",
        theme: "colored",
      });
    }
  };

  // ── Execute action (from table toolbar) ─────────────────────────────
  const handleExecuteAction = useCallback(
    async (selectedRows) => {
      if (!selectedRows?.length)
        return toast.error("No applications selected.", {
          position: "top-right",
          theme: "colored",
        });

      // ── NEW: enforce the same cap the child UI is showing, so a
      // programmatic call or a stale child instance can't sneak past it.
      if (
        selectedAction === "Sanction" &&
        Number.isInteger(poolSanctionBatchLimit) &&
        selectedRows.length > poolSanctionBatchLimit
      ) {
        return toast.error(
          `Sanction batch limit is ${poolSanctionBatchLimit} application${
            poolSanctionBatchLimit === 1 ? "" : "s"
          } per batch.`,
          { position: "top-center", autoClose: 4000, theme: "colored" },
        );
      }

      if (selectedAction === "Sanction") {
        const dscCheck = await withLoader(checkDSCStatus, "Verifying DSC…");
        if (!dscCheck.status)
          return toast.error(
            `Cannot Sanction: ${dscCheck.reason || "DSC invalid."}`,
            { position: "top-right", autoClose: 6000, theme: "colored" },
          );
      }
      const ids = selectedRows.map((i) => i.original.referenceNumber);
      if (selectedAction === "Reject") {
        setPendingRejectRows(selectedRows);
        setRejectConfirmOpen(true);
      } else {
        await processAllIds(ids);
      }
    },
    [selectedAction, processAllIds, withLoader, poolSanctionBatchLimit],
  );

  const getActionOptions = React.useMemo(() => {
    const o = [
      { value: "Reject", label: "Reject" },
      { value: "toInbox", label: "Return to Inbox" },
    ];
    if (canSanction && dataType === "new")
      o.push({ value: "Sanction", label: "Sanction" });
    return o;
  }, [canSanction, dataType]);

  const handleModalClose = useCallback(() => {
    setPdfModalOpen(false);
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setPdfUrl("");
    setPdfBlob(null);
    setIsSignedPdf(false);
  }, [pdfUrl]);

  // ── Back to dashboard ───────────────────────────────────────────────
  const handleBack = () => {
    navigate("/officer/home", {
      state: { returnServiceId: serviceId },
    });
  };

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <Box sx={{ width: "100%", minHeight: "100vh", bgcolor: "#F8FAFC", pb: 8 }}>
      <Box sx={{ px: { xs: 2, md: 4 }, pt: 3 }}>
        <GovPageHeader
          title={tableTitle || "Applications"}
          subtitle={officerArea}
          crumbs={[
            { label: "Officer", path: "/officer/home" },
            { label: "Dashboard", path: "/officer/home" },
            { label: tableTitle || "Applications", path: "" },
          ]}
        />
      </Box>

      <MuiContainer maxWidth="lg" sx={{ mt: 3 }}>
        <Paper
          elevation={0}
          sx={{
            p: 2,
            mb: 3,
            borderRadius: 3,
            border: "1px solid #E2E8F0",
            display: "flex",
            alignItems: "center",
          }}
        >
          <Button
            startIcon={<ArrowBack />}
            onClick={handleBack}
            sx={{ textTransform: "none", color: "#2562E9", fontWeight: 600 }}
          >
            Back to Dashboard
          </Button>
        </Paper>

        <Box ref={tableRef}>
          <ServerSideTable
            ref={tableInstanceRef}
            key={`table-${tableKey}-${serviceId}-${type}`}
            url={url}
            extraParams={extraParams}
            actionFunctions={actionFunctions}
            canSanction={canSanction}
            canHavePool={canHavePool}
            pendingApplications={
              type === "pending" &&
              !tableTitle?.includes("Corrigendum") &&
              !tableTitle?.includes("Correction")
            }
            serviceId={serviceId}
            onPushToPool={handlePushToPool}
            onExecuteAction={handleExecuteAction}
            actionOptions={getActionOptions}
            selectedAction={selectedAction}
            setSelectedAction={setSelectedAction}
            Title={tableTitle}
            showDownloadButtons={true}
            // ── NEW: pass the per-service limit through. `?? undefined`
            //    (not `null`) so the child's `= 5` default still fires
            //    while the fetch is in flight or if it failed.
            poolSanctionBatchLimit={poolSanctionBatchLimit ?? 5}
          />
        </Box>
      </MuiContainer>

      {/* ── Dialogs ────────────────────────────────────────────────── */}
      <Dialog
        open={rejectConfirmOpen}
        onClose={() => {
          setRejectConfirmOpen(false);
          setPendingRejectRows([]);
        }}
        PaperProps={{ sx: { borderRadius: 3, p: 2 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, color: "#0F172A" }}>
          Confirm Reject Action
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: "#475569" }}>
            Are you sure you want to reject {pendingRejectRows.length} selected
            application{pendingRejectRows.length > 1 ? "s" : ""}? This cannot be
            undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button
            onClick={() => {
              setRejectConfirmOpen(false);
              setPendingRejectRows([]);
            }}
            sx={{ textTransform: "none", color: "#64748B" }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleRejectConfirm}
            sx={{
              textTransform: "none",
              bgcolor: "#DC2626",
              "&:hover": { bgcolor: "#B91C1C" },
            }}
          >
            Confirm Reject
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={pullConfirmOpen}
        onClose={() => setPullConfirmOpen(false)}
        PaperProps={{ sx: { borderRadius: 3, p: 2 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, color: "#0F172A" }}>
          Confirm Pull Action
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: "#475569" }}>
            Are you sure you want to pull {pullRow.referenceNumber}? This cannot
            be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button
            onClick={() => setPullConfirmOpen(false)}
            sx={{ textTransform: "none", color: "#64748B" }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handlePullApplication}
            sx={{
              textTransform: "none",
              bgcolor: "#2562E9",
              "&:hover": { bgcolor: "#1D4ED8" },
            }}
          >
            Confirm Pull
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        PaperProps={{ sx: { borderRadius: 3, p: 2 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, color: "#0F172A" }}>
          Enter USB Token PIN
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2, color: "#475569" }}>
            Please enter the PIN for your USB token to sign the document.
          </Typography>
          <TextField
            type="password"
            label="USB Token PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            fullWidth
            margin="normal"
            autoFocus
          />
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button
            onClick={() => setConfirmOpen(false)}
            sx={{ textTransform: "none", color: "#64748B" }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handlePinSubmit}
            disabled={!pin}
            sx={{
              textTransform: "none",
              bgcolor: "#2562E9",
              "&:hover": { bgcolor: "#1D4ED8" },
            }}
          >
            Submit
          </Button>
        </DialogActions>
      </Dialog>

      <BasicModal
        open={pdfModalOpen}
        handleClose={handleModalClose}
        handleActionButton={isSignedPdf ? null : handleSignPdf}
        buttonText={isSignedPdf ? null : "Sign PDF"}
        Title={isSignedPdf ? "Signed Document" : "Document Preview"}
        pdf={pdfUrl}
      />

      {/* ── Blocking action loader ─────────────────────────────────── */}
      <Backdrop
        open={actionLoading}
        sx={{
          color: "#fff",
          zIndex: (theme) => theme.zIndex.modal + 100,
          backgroundColor: "rgba(15, 23, 42, 0.55)",
          backdropFilter: "blur(3px)",
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <CircularProgress sx={{ color: "#2562E9" }} size={52} thickness={4} />
        <Typography
          variant="body1"
          sx={{ color: "#fff", fontWeight: 600, textAlign: "center", px: 3 }}
        >
          {actionMessage || "Processing…"}
        </Typography>
      </Backdrop>

      <ToastContainer />
    </Box>
  );
}
