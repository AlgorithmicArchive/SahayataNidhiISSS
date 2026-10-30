// ServerSideTable.jsx
import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useImperativeHandle,
} from "react";
import { MaterialReactTable } from "material-react-table";
import {
  Box,
  Button,
  CircularProgress,
  Tooltip,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Menu,
  IconButton,
  TextField,
  Chip,
  Alert,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import DescriptionIcon from "@mui/icons-material/Description";
import TableChartIcon from "@mui/icons-material/TableChart";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import SearchOffIcon from "@mui/icons-material/SearchOff";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import axiosInstance from "../axiosConfig";
import styled from "@emotion/styled";

// ==================== Helpers ====================

const ACTIONS_KEY = "mrt-row-actions";

const getColumnId = (col) => col?.id ?? col?.accessorKey;

const resolveAccessorKey = (row, accessorKey) => {
  if (!row || !accessorKey) return undefined;
  if (Object.prototype.hasOwnProperty.call(row, accessorKey)) {
    return row[accessorKey];
  }
  const lower = String(accessorKey).toLowerCase();
  const actualKey = Object.keys(row).find((k) => k.toLowerCase() === lower);
  return actualKey ? row[actualKey] : undefined;
};

const normalizeColumnsAgainstSample = (columns, sampleRow) => {
  if (!Array.isArray(columns) || columns.length === 0) return columns || [];
  if (!sampleRow || typeof sampleRow !== "object") return columns;

  const sampleKeys = Object.keys(sampleRow);
  const lowerKeyMap = new Map(sampleKeys.map((k) => [k.toLowerCase(), k]));

  return columns.map((col) => {
    const accessorKey = col?.accessorKey;
    if (!accessorKey) return col;
    if (sampleKeys.includes(accessorKey)) return col;

    const actualKey = lowerKeyMap.get(String(accessorKey).toLowerCase());
    if (!actualKey) return col;

    const { accessorKey: _omit, ...rest } = col;
    return {
      ...rest,
      id: accessorKey,
      accessorFn: (row) => resolveAccessorKey(row, accessorKey),
    };
  });
};

const arraysEqual = (a, b) => {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};

// ==================== Styled Components ====================
const TableContainer = styled(Box)`
  background: #f8fafc;
  display: flex;
  justify-content: center;
  padding: 2rem 1rem;
  box-sizing: border-box;
  width: 100%;
  @media (max-width: 600px) {
    padding: 1rem 0.5rem;
  }
`;

const TableCard = styled(Box)`
  background: #ffffff;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow:
    0 1px 3px rgba(0, 0, 0, 0.05),
    0 4px 12px rgba(0, 0, 0, 0.03);
  width: 100%;
  max-width: 1400px;
  border: 1px solid #e2e8f0;
  overflow: hidden;
  @media (max-width: 600px) {
    padding: 1rem;
    border-radius: 8px;
  }
`;

const PoolSection = styled(Box)`
  margin-bottom: 1.5rem;
  border: 1px solid #fcd34d;
  background: #fffbeb;
  border-radius: 10px;
  overflow: hidden;
`;

const PoolHeader = styled(Box)`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #fde68a;
  background: #fef3c7;
`;

const PoolScroll = styled(Box)`
  max-height: 340px;
  overflow: auto;
`;

const ActionButton = styled(Button)`
  background: #2562e9;
  color: #ffffff;
  font-weight: 600;
  text-transform: none;
  border-radius: 6px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  transition: all 0.2s ease;
  &:hover {
    background: #1d4ed8;
    box-shadow: 0 4px 8px rgba(37, 98, 233, 0.2);
    transform: translateY(-1px);
  }
  &.Mui-disabled {
    background: #e2e8f0;
    color: #94a3b8;
    box-shadow: none;
  }
`;

const StyledIconButton = styled(IconButton)`
  color: #475569;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 0.5rem;
  transition: all 0.2s ease;
  background: #ffffff;
  &:hover {
    background: #f1f5f9;
    color: #2562e9;
    border-color: #2562e9;
    transform: translateY(-1px);
  }
  @media (max-width: 600px) {
    padding: 0.35rem;
  }
`;

const StyledFormControl = styled(FormControl)`
  & .MuiOutlinedInput-root {
    border-radius: 6px;
    background: #ffffff;
    &:hover .MuiOutlinedInput-notchedOutline {
      border-color: #2562e9;
    }
    &.Mui-focused .MuiOutlinedInput-notchedOutline {
      border-color: #2562e9;
      border-width: 1px;
    }
  }
  & .MuiInputLabel-root {
    color: #64748b;
    &.Mui-focused {
      color: #2562e9;
    }
  }
  min-width: 160px;
  margin-right: 1rem;
`;

// ==================== Sub-components (Memoized) ====================
const InputCell = React.memo(({ row, inputValues, setInputValues }) => {
  const [localValue, setLocalValue] = useState(
    inputValues[row.original.sno] || "",
  );

  useEffect(() => {
    if (inputValues[row.original.sno] !== localValue) {
      setLocalValue(inputValues[row.original.sno] || "");
    }
  }, [inputValues, row.original.sno, localValue]);

  const handleInputChange = useCallback(
    (e) => {
      const value = e.target.value;
      setLocalValue(value);
      setInputValues((prev) => ({
        ...prev,
        [row.original.sno]: value,
      }));
    },
    [row.original.sno, setInputValues],
  );

  return (
    <TextField
      type="text"
      variant="outlined"
      size="small"
      value={localValue}
      onChange={handleInputChange}
      fullWidth
      autoComplete="off"
      placeholder="Aadhaar No."
      inputProps={{ maxLength: 12, pattern: "[0-9]*" }}
      onFocus={(e) => e.target.select()}
      sx={{
        "& .MuiOutlinedInput-root": {
          borderRadius: "6px",
          fontSize: "0.875rem",
          "& fieldset": { borderColor: "#cbd5e1" },
          "&:hover fieldset": { borderColor: "#2562e9" },
          "&.Mui-focused fieldset": {
            borderColor: "#2562e9",
            borderWidth: "1.5px",
          },
        },
      }}
    />
  );
});

const UserTypeSelect = React.memo(({ row, onChange }) => {
  const [value, setValue] = useState(row.original.userType || "Officer");

  useEffect(() => {
    setValue(row.original.userType || "Officer");
  }, [row.original.userType]);

  const handleChange = useCallback(
    (e) => {
      const newValue = e.target.value;
      setValue(newValue);
      onChange(row.original.username, newValue);
    },
    [row.original.username, onChange],
  );

  return (
    <FormControl size="small" sx={{ minWidth: 100 }}>
      <Select
        value={value}
        onChange={handleChange}
        sx={{
          borderRadius: "6px",
          fontSize: "0.875rem",
          "& .MuiOutlinedInput-notchedOutline": { borderColor: "#cbd5e1" },
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: "#2562e9",
          },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: "#2562e9",
            borderWidth: "1.5px",
          },
        }}
      >
        <MenuItem value="Officer">Officer</MenuItem>
        <MenuItem value="Admin">Admin</MenuItem>
      </Select>
    </FormControl>
  );
});

const ActionsCell = React.memo(({ row, actionFunctions, inputValues }) => {
  const actions = row.original.customActions;

  if (!Array.isArray(actions)) {
    return (
      <Typography
        variant="body2"
        sx={{ fontWeight: 500, color: "#64748b", fontStyle: "italic" }}
      >
        {actions}
      </Typography>
    );
  }

  return (
    <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
      {actions.map((action, index) => (
        <Tooltip key={index} title={action.tooltipText} arrow placement="top">
          <Button
            size="small"
            variant="contained"
            disableElevation
            sx={{
              minWidth: "auto",
              px: 1.5,
              py: 0.5,
              background: "#10B582",
              color: "#fff",
              fontWeight: 500,
              fontSize: "0.75rem",
              textTransform: "none",
              borderRadius: "4px",
              boxShadow: "0 1px 2px rgba(16, 181, 130, 0.2)",
              "&:hover": { background: "#059669" },
            }}
            onClick={() =>
              actionFunctions[action.actionFunction]?.(row, action, {
                inputValue: inputValues[row.original.sno] || "",
                allInputValues: inputValues,
              })
            }
            aria-label={`${action.name || action.tooltip} for row ${row.original.sno}`}
          >
            {action.name || action.tooltip}
          </Button>
        </Tooltip>
      ))}
    </Box>
  );
});

// ==================== Debounce Hook ====================
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

// ==================== Main Component ====================
const ServerSideTable = React.forwardRef(
  (
    {
      url,
      actionFunctions,
      extraParams = {},
      canSanction = false,
      canHavePool = false,
      pendingApplications = false,
      serviceId,
      refreshTrigger,
      onPushToPool,
      onExecuteAction,
      actionOptions = [],
      selectedAction,
      setSelectedAction,
      Title,
      searchableFields = ["referenceNumber", "applicantName"],
      showDownloadButtons = false,
      poolSanctionBatchLimit = 5,
    },
    ref,
  ) => {
    // ===== PAGINATION PERSISTENCE =====
    const storageKey = Title.toLowerCase()
      .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
        index === 0 ? word.toLowerCase() : word.toUpperCase(),
      )
      .replace(/\s+/g, "");

    const paginationStorageKey = `${storageKey}__pagination`;

    // ---------- State ----------
    const [columns, setColumns] = useState([]);
    const [inboxData, setInboxData] = useState([]);
    const [poolData, setPoolData] = useState([]);
    const [poolTotalRecords, setPoolTotalRecords] = useState(0);
    const [pageCount, setPageCount] = useState(0);
    const [totalRecords, setTotalRecords] = useState(0);
    const [isLoading, setIsLoading] = useState(false);

    // ===== PAGINATION PERSISTENCE =====
    // The main MRT is not mounted until the first fetch resolves (see the
    // render gate at the bottom). That prevents MRT from ever seeing the
    // "empty data → populated data" transition with a non-zero restored
    // pageIndex, which is what triggered its internal reset to page 0.
    const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

    const [mainRowSelection, setMainRowSelection] = useState({});
    const [poolRowSelection, setPoolRowSelection] = useState({});

    // ===== PAGINATION PERSISTENCE =====
    const [pagination, setPagination] = useState(() => {
      console.log(
        "[PAGINATION] init — reading sessionStorage key:",
        paginationStorageKey,
      );
      try {
        const raw = sessionStorage.getItem(paginationStorageKey);
        console.log("[PAGINATION] init — raw stored value:", raw);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (
            Number.isInteger(parsed?.pageIndex) &&
            parsed.pageIndex >= 0 &&
            Number.isInteger(parsed?.pageSize) &&
            parsed.pageSize > 0
          ) {
            console.log("[PAGINATION] RESTORED →", parsed);
            return {
              pageIndex: parsed.pageIndex,
              pageSize: parsed.pageSize,
            };
          }
          console.warn(
            "[PAGINATION] stored value failed validation, using default:",
            parsed,
          );
        } else {
          console.log("[PAGINATION] nothing stored, using default");
        }
      } catch (err) {
        console.warn("[PAGINATION] restore failed:", err);
      }
      return { pageIndex: 0, pageSize: 10 };
    });

    // ===== PAGINATION TRACE =====
    useEffect(() => {
      console.log("[PAGINATION] state →", {
        pageIndex: pagination.pageIndex,
        pageSize: pagination.pageSize,
      });
    }, [pagination]);

    const [hasActions, setHasActions] = useState(false);
    const [columnOrder, setColumnOrder] = useState([]);
    const [columnVisibility, setColumnVisibility] = useState({});
    const [anchorEl, setAnchorEl] = useState(null);
    const [downloadType, setDownloadType] = useState(null);
    const [inputValues, setInputValues] = useState({});

    const [globalFilter, setGlobalFilter] = useState("");
    const debouncedGlobalFilter = useDebounce(globalFilter, 500);

    const [settingsLoaded, setSettingsLoaded] = useState(false);
    const [settingsLoadSuccess, setSettingsLoadSuccess] = useState(false);

    // ---------- Refs ----------
    const paginationRef = useRef(pagination);
    const globalFilterRef = useRef(debouncedGlobalFilter);
    const extraParamsRef = useRef(extraParams);
    const urlRef = useRef(url);
    const searchableFieldsRef = useRef(searchableFields);

    const actionFunctionsRef = useRef(actionFunctions);
    const columnOrderRef = useRef(columnOrder);
    const settingsLoadedRef = useRef(settingsLoaded);
    const hasActionsRef = useRef(hasActions);
    const handleUserTypeChangeRef = useRef(null);

    const inputValuesRef = useRef(inputValues);
    inputValuesRef.current = inputValues;

    const saveDebounceRef = useRef(null);

    useEffect(() => {
      paginationRef.current = pagination;
      // ===== PAGINATION TRACE =====
      console.log("[PAGINATION] ref.current synced →", {
        pageIndex: paginationRef.current.pageIndex,
        pageSize: paginationRef.current.pageSize,
      });
    }, [pagination]);

    // ===== PAGINATION PERSISTENCE =====
    // Persist only AFTER the first fetch completes. This ensures the
    // restored value can never be clobbered by a transient state during
    // the initial load window.
    useEffect(() => {
      if (!hasLoadedOnce) {
        console.log(
          "[PAGINATION] persist SKIPPED (initial load not complete yet)",
        );
        return;
      }
      try {
        const nextSerialized = JSON.stringify(pagination);
        const prevSerialized = sessionStorage.getItem(paginationStorageKey);
        if (prevSerialized !== nextSerialized) {
          console.log("[PAGINATION] persist CHANGING storage:", {
            prev: prevSerialized ? JSON.parse(prevSerialized) : null,
            next: pagination,
          });
        }
        sessionStorage.setItem(paginationStorageKey, nextSerialized);
      } catch (err) {
        console.warn("[PAGINATION] persist failed:", err);
      }
    }, [pagination, paginationStorageKey, hasLoadedOnce]);

    useEffect(() => {
      globalFilterRef.current = debouncedGlobalFilter;
    }, [debouncedGlobalFilter]);
    useEffect(() => {
      extraParamsRef.current = extraParams;
    }, [extraParams]);
    useEffect(() => {
      urlRef.current = url;
    }, [url]);
    useEffect(() => {
      searchableFieldsRef.current = searchableFields;
    }, [searchableFields]);
    useEffect(() => {
      actionFunctionsRef.current = actionFunctions;
    }, [actionFunctions]);
    useEffect(() => {
      columnOrderRef.current = columnOrder;
    }, [columnOrder]);
    useEffect(() => {
      settingsLoadedRef.current = settingsLoaded;
    }, [settingsLoaded]);
    useEffect(() => {
      hasActionsRef.current = hasActions;
    }, [hasActions]);

    // ---------- Load saved column settings ----------
    useEffect(() => {
      const fetchTableSettings = async () => {
        try {
          const response = await axiosInstance.get("/Base/GetTableSettings", {
            params: { storageKey },
          });
          if (response.data?.status && response.data?.tableSettings) {
            const raw = response.data.tableSettings;
            if (typeof raw === "object" && raw !== null) {
              if (raw.savedColumnOrder) setColumnOrder(raw.savedColumnOrder);
              if (raw.savedColumnVisibility)
                setColumnVisibility(raw.savedColumnVisibility);
              setSettingsLoadSuccess(true);
            } else if (typeof raw === "string" && raw.trim() !== "") {
              try {
                const savedSettings = JSON.parse(raw);
                if (savedSettings.savedColumnOrder)
                  setColumnOrder(savedSettings.savedColumnOrder);
                if (savedSettings.savedColumnVisibility)
                  setColumnVisibility(savedSettings.savedColumnVisibility);
                setSettingsLoadSuccess(true);
              } catch {
                setSettingsLoadSuccess(false);
              }
            } else {
              setSettingsLoadSuccess(false);
            }
          } else {
            setSettingsLoadSuccess(false);
          }
        } catch {
          setSettingsLoadSuccess(false);
        } finally {
          setSettingsLoaded(true);
        }
      };
      fetchTableSettings();
    }, [storageKey]);

    // ---------- Reconcile columnOrder / columnVisibility ----------
    useEffect(() => {
      if (!settingsLoaded || columns.length === 0) return;

      const columnIds = columns.map(getColumnId);
      const columnIdSet = new Set(columnIds);
      const hasActionsKey = columnIdSet.has(ACTIONS_KEY);

      setColumnOrder((prevOrder) => {
        let next;

        if (prevOrder.length === 0) {
          next = columnIds.slice();
        } else {
          const adjustedPrev = prevOrder.map((k) =>
            k === "actions" ? ACTIONS_KEY : k,
          );
          const alreadyHasActions = adjustedPrev.includes(ACTIONS_KEY);

          const seen = new Set(adjustedPrev);
          const merged = adjustedPrev.slice();
          for (let i = 0; i < columnIds.length; i++) {
            const key = columnIds[i];
            if (key && !seen.has(key)) {
              merged.push(key);
              seen.add(key);
            }
          }
          next = merged.filter((k) => columnIdSet.has(k));

          if (hasActionsKey && !alreadyHasActions) {
            const withoutActions = next.filter((k) => k !== ACTIONS_KEY);
            next = [ACTIONS_KEY, ...withoutActions];
          }
        }

        return arraysEqual(next, prevOrder) ? prevOrder : next;
      });

      setColumnVisibility((prev) => {
        let changed = false;
        const next = { ...prev };

        for (let i = 0; i < columnIds.length; i++) {
          const id = columnIds[i];
          if (id && !(id in next)) {
            next[id] = true;
            changed = true;
          }
        }
        for (const key of Object.keys(next)) {
          if (!columnIdSet.has(key)) {
            delete next[key];
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, [settingsLoaded, columns]);

    // ---------- Persist settings (debounced) ----------
    const persistColumnSettings = useCallback(
      async (orderToSave, visibilityToSave) => {
        if (!settingsLoadSuccess) return;
        const formData = new FormData();
        formData.append("storageKey", storageKey);
        formData.append(
          "storageValue",
          JSON.stringify({
            savedColumnOrder: orderToSave,
            savedColumnVisibility: visibilityToSave,
          }),
        );
        try {
          await axiosInstance.post("/Base/SaveTableSettings", formData);
        } catch {
          /* silent */
        }
      },
      [storageKey, settingsLoadSuccess],
    );

    useEffect(() => {
      if (!settingsLoadSuccess) return;
      if (
        columnOrder.length === 0 &&
        Object.keys(columnVisibility).length === 0
      )
        return;

      if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
      saveDebounceRef.current = setTimeout(() => {
        persistColumnSettings(columnOrder, columnVisibility);
      }, 600);

      return () => {
        if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
      };
    }, [
      columnOrder,
      columnVisibility,
      persistColumnSettings,
      settingsLoadSuccess,
    ]);

    // ---------- Data fetching ----------
    const fetchData = useCallback(async () => {
      const currentUrl = urlRef.current;
      if (!currentUrl) {
        toast.error("URL is missing.", { position: "top-center" });
        return;
      }

      setIsLoading(true);
      try {
        const params = {
          pageIndex: paginationRef.current.pageIndex,
          pageSize: paginationRef.current.pageSize,
          ...extraParamsRef.current,
        };

        if (globalFilterRef.current) {
          params.searchQuery = globalFilterRef.current;
          params.searchFields = JSON.stringify(searchableFieldsRef.current);
        }

        // ===== PAGINATION TRACE =====
        console.log("[PAGINATION] fetchData → GET", currentUrl, params);

        const response = await axiosInstance.get(currentUrl, { params });
        const json = response.data;

        const hasAnyActions =
          json.data?.some((row) => row.customActions?.length > 0) ||
          json.poolData?.some((row) => row.customActions?.length > 0) ||
          false;

        const rawColumns = Array.isArray(json.columns)
          ? json.columns
          : Object.values(json.columns || {});

        const sampleRow =
          (Array.isArray(json.poolData) && json.poolData[0]) ||
          (Array.isArray(json.data) && json.data[0]) ||
          null;

        const normalizedColumns = normalizeColumnsAgainstSample(
          rawColumns,
          sampleRow,
        );

        let updatedColumns = normalizedColumns.map((col) =>
          getColumnId(col) === "sno" ? { ...col, size: 20 } : col,
        );

        updatedColumns = updatedColumns.map((col) => {
          if (col.accessorKey === "userType" || col.id === "userType") {
            return {
              ...col,
              size: 120,
              enableSorting: false,
              Cell: ({ row }) => (
                <UserTypeSelect
                  row={row}
                  onChange={(username, newType) =>
                    handleUserTypeChangeRef.current?.(username, newType)
                  }
                />
              ),
            };
          }
          return col;
        });

        const hasInputColumn = json.data?.some((row) => row.input === true);
        if (hasInputColumn) {
          updatedColumns.push({
            accessorKey: "customInput",
            header: "Aadhaar Number",
            size: 150,
            enableSorting: false,
            enableColumnFilter: false,
            Cell: ({ row }) => (
              <InputCell
                row={row}
                inputValues={inputValuesRef.current}
                setInputValues={setInputValues}
              />
            ),
          });
        }

        if (hasAnyActions) {
          updatedColumns.unshift({
            accessorKey: ACTIONS_KEY,
            header: "Actions",
            size: 200,
            enableSorting: false,
            enableColumnFilter: false,
            Cell: ({ row }) => (
              <ActionsCell
                row={row}
                actionFunctions={actionFunctionsRef.current}
                inputValues={inputValuesRef.current}
              />
            ),
          });
        }

        const total = json.totalRecords ?? json.totalCount ?? 0;
        const poolTotal = json.poolTotalRecords ?? json.poolData?.length ?? 0;

        // ===== PAGINATION TRACE =====
        console.log("[PAGINATION] fetchData ← response:", {
          requestedPageIndex: params.pageIndex,
          requestedPageSize: params.pageSize,
          totalRecords: total,
          computedPageCount: Math.ceil(total / paginationRef.current.pageSize),
          returnedRows: json.data?.length ?? 0,
          poolRows: json.poolData?.length ?? 0,
        });

        // ===== PAGINATION PERSISTENCE =====
        const serverPageCount = Math.ceil(
          total / paginationRef.current.pageSize,
        );
        const maxPageIndex = Math.max(0, serverPageCount - 1);
        if (paginationRef.current.pageIndex > maxPageIndex) {
          console.warn(
            "[PAGINATION] pageIndex out of range, clamping:",
            paginationRef.current.pageIndex,
            "→",
            maxPageIndex,
          );
          setPagination((prev) => ({ ...prev, pageIndex: maxPageIndex }));
          return;
        }

        setHasActions(hasAnyActions);
        setColumns(updatedColumns);
        setInboxData(json.data || []);
        setPoolData(json.poolData || []);
        setTotalRecords(total);
        setPoolTotalRecords(poolTotal);
        setPageCount(Math.ceil(total / paginationRef.current.pageSize));

        if (globalFilterRef.current && total > 0) {
          toast.info(`Found ${total} matching records`, {
            position: "top-center",
            autoClose: 2000,
          });
        } else if (globalFilterRef.current && total === 0) {
          toast.info("No matching records found", {
            position: "top-center",
            autoClose: 2000,
          });
        }
      } catch {
        toast.error("Failed to load table data. Please try again.", {
          position: "top-center",
        });
      } finally {
        setIsLoading(false);
        // ===== PAGINATION PERSISTENCE =====
        // First successful (or attempted) load completed → the main MRT can
        // safely mount now with the restored pagination.
        setHasLoadedOnce((prev) => {
          if (!prev) {
            console.log("[PAGINATION] first load complete — MRT may now mount");
          }
          return true;
        });
      }
    }, []);

    const handleUserTypeChange = useCallback(
      async (username, newType) => {
        const formdata = new FormData();
        formdata.append("username", username);
        formdata.append("userType", newType);
        try {
          const response = await axiosInstance.post(
            "/Admin/UpdateUserType",
            formdata,
          );
          if (response.data.status) {
            toast.success(response.data.message, { position: "top-center" });
            fetchData();
          } else {
            toast.error(response.data.message || "Update failed.", {
              position: "top-center",
            });
          }
        } catch {
          toast.error("An error occurred while updating user type.", {
            position: "top-center",
          });
        }
      },
      [fetchData],
    );

    useEffect(() => {
      handleUserTypeChangeRef.current = handleUserTypeChange;
    }, [handleUserTypeChange]);

    useEffect(() => {
      // ===== PAGINATION TRACE =====
      console.log("[PAGINATION] effect → fetchData()", {
        pageIndex: pagination.pageIndex,
        pageSize: pagination.pageSize,
        globalFilter: debouncedGlobalFilter,
      });
      fetchData();
    }, [
      fetchData,
      pagination.pageIndex,
      pagination.pageSize,
      debouncedGlobalFilter,
      extraParams,
      url,
      refreshTrigger,
    ]);

    // ===== PAGINATION TRACE =====
    useEffect(() => {
      console.log("[PAGINATION] render snapshot:", {
        pagination,
        pageCount,
        totalRecords,
        poolTotalRecords,
        hasLoadedOnce,
      });
    }, [pagination, pageCount, totalRecords, poolTotalRecords, hasLoadedOnce]);

    useImperativeHandle(ref, () => ({ refetch: fetchData }), [fetchData]);

    // ---------- Pool sanction limit enforcement ----------
    const isSanctionAction =
      String(selectedAction).toLowerCase() === "sanction";

    const poolSelectedCount = useMemo(
      () => Object.values(poolRowSelection).filter(Boolean).length,
      [poolRowSelection],
    );

    const exceedsLimit =
      isSanctionAction &&
      poolData.length > 0 &&
      poolSelectedCount > poolSanctionBatchLimit;

    const handlePoolRowSelectionChange = useCallback(
      (updater) => {
        const next =
          typeof updater === "function" ? updater(poolRowSelection) : updater;
        const nextCount = Object.values(next).filter(Boolean).length;

        if (isSanctionAction && nextCount > poolSanctionBatchLimit) {
          toast.warn(
            `Maximum Sanction Limit allowed ${poolSanctionBatchLimit} application${
              poolSanctionBatchLimit === 1 ? "" : "s"
            } at a time.`,
            {
              position: "top-center",
              autoClose: 3000,
              theme: "colored",
            },
          );
          return;
        }

        setPoolRowSelection(next);
      },
      [poolRowSelection, isSanctionAction, poolSanctionBatchLimit],
    );

    const handleMainRowSelectionChange = useCallback(
      (updater) => {
        const next =
          typeof updater === "function" ? updater(mainRowSelection) : updater;
        setMainRowSelection(next);
      },
      [mainRowSelection],
    );

    // ---------- Download ----------
    const handleDownload = async (format, scope) => {
      if (!url) {
        toast.error("URL is missing.");
        return;
      }
      setIsLoading(true);
      setAnchorEl(null);
      setDownloadType(null);

      try {
        const formData = new FormData();
        formData.append("columnOrder", JSON.stringify(columnOrder));
        formData.append("columnVisibility", JSON.stringify(columnVisibility));
        formData.append("scope", scope);
        formData.append("format", format);
        formData.append("function", url.split("/").filter(Boolean).pop());

        if (scope === "InView") {
          formData.append("pageIndex", pagination.pageIndex.toString());
          formData.append("pageSize", pagination.pageSize.toString());
        }

        Object.entries(extraParams).forEach(([key, value]) => {
          formData.append(key, value?.toString() ?? "");
        });

        if (globalFilter) {
          formData.append("searchQuery", globalFilter);
          formData.append("searchFields", JSON.stringify(searchableFields));
        }

        if (Object.keys(inputValues).length > 0) {
          formData.append("inputValues", JSON.stringify(inputValues));
        }

        const response = await axiosInstance.post(
          "/Base/ExportData",
          formData,
          { responseType: "blob" },
        );

        const extension = { Excel: "xlsx", Csv: "csv", Pdf: "pdf" }[format];
        const fileName = `${Title.replace(/\s+/g, "_")}_${scope}_${
          new Date().toISOString().split("T")[0]
        }${globalFilter ? "_search_results" : ""}.${extension}`;

        const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement("a");
        link.href = blobUrl;
        link.setAttribute("download", fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);

        toast.success(`${format} file downloaded successfully!`, {
          position: "top-center",
        });
      } catch {
        toast.error(`Failed to download ${format} file.`, {
          position: "top-center",
        });
      } finally {
        setIsLoading(false);
      }
    };

    const handleMenuOpen = (event, format) => {
      setAnchorEl(event.currentTarget);
      setDownloadType(format);
    };

    const handleMenuClose = () => {
      setAnchorEl(null);
      setDownloadType(null);
    };

    // ---------- Memoized data / columns ----------
    const memoizedPoolData = useMemo(() => poolData, [poolData]);
    const memoizedInboxData = useMemo(() => inboxData, [inboxData]);
    const memoizedColumns = useMemo(() => columns, [columns]);

    const getRowId = useCallback((row) => row.referenceNumber ?? row.sno, []);

    const showPool = poolData.length > 0;
    const showPushToPoolToolbar =
      canSanction && pendingApplications && inboxData.length > 0;
    const showExecuteToolbar = canHavePool && actionOptions?.length > 0;

    return (
      <TableContainer>
        <TableCard>
          {/* Header */}
          <Box sx={{ mb: 3, borderBottom: "1px solid #f1f5f9", pb: 2 }}>
            <Typography
              variant="h5"
              component="h1"
              sx={{
                fontWeight: 700,
                color: "primary.dark",
                mb: 0.5,
                fontSize: { xs: "1.25rem", sm: "1.5rem" },
              }}
            >
              {Title}
            </Typography>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                flexWrap: "wrap",
              }}
            >
              <Chip
                label={`${totalRecords} Records`}
                size="small"
                sx={{
                  bgcolor: "#f1f5f9",
                  color: "#475569",
                  fontWeight: 600,
                  fontSize: "0.75rem",
                }}
              />
              {poolTotalRecords > 0 && (
                <Chip
                  label={`Pool: ${poolTotalRecords}`}
                  size="small"
                  sx={{
                    bgcolor: "#fef3c7",
                    color: "#92400e",
                    fontWeight: 600,
                    fontSize: "0.75rem",
                  }}
                />
              )}
              {globalFilter && (
                <Chip
                  label={`Search: "${globalFilter}"`}
                  size="small"
                  color="primary"
                  onDelete={() => setGlobalFilter("")}
                  sx={{ fontSize: "0.75rem" }}
                />
              )}
            </Box>
          </Box>

          {/* Global toolbar: search + download + refresh */}
          <Box
            sx={{
              display: "flex",
              flexDirection: { xs: "column", sm: "row" },
              justifyContent: "space-between",
              alignItems: { xs: "flex-start", sm: "center" },
              mb: 2,
              gap: { xs: 2, sm: 1 },
            }}
          >
            <TextField
              size="small"
              placeholder="Search reference / applicant…"
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              sx={{ minWidth: 280, flex: "1 1 320px", maxWidth: 480 }}
            />

            <Box
              sx={{
                display: "flex",
                gap: 1,
                flexWrap: "wrap",
                ml: { sm: "auto" },
              }}
            >
              {showDownloadButtons && (
                <>
                  <Tooltip title="Download Excel" arrow>
                    <StyledIconButton
                      onClick={(e) => handleMenuOpen(e, "Excel")}
                      size="small"
                    >
                      <TableChartIcon fontSize="small" />
                    </StyledIconButton>
                  </Tooltip>
                  <Tooltip title="Download CSV" arrow>
                    <StyledIconButton
                      onClick={(e) => handleMenuOpen(e, "Csv")}
                      size="small"
                    >
                      <DescriptionIcon fontSize="small" />
                    </StyledIconButton>
                  </Tooltip>
                  <Tooltip title="Download PDF" arrow>
                    <StyledIconButton
                      onClick={(e) => handleMenuOpen(e, "Pdf")}
                      size="small"
                    >
                      <PictureAsPdfIcon fontSize="small" />
                    </StyledIconButton>
                  </Tooltip>
                </>
              )}
              <Tooltip title="Refresh Data" arrow>
                <StyledIconButton onClick={fetchData} size="small">
                  <RefreshIcon fontSize="small" />
                </StyledIconButton>
              </Tooltip>
              <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                transformOrigin={{ vertical: "top", horizontal: "right" }}
                PaperProps={{
                  sx: {
                    borderRadius: "8px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                    mt: 1,
                  },
                }}
              >
                <MenuItem onClick={() => handleDownload(downloadType, "All")}>
                  All Data
                </MenuItem>
                <MenuItem
                  onClick={() => handleDownload(downloadType, "InView")}
                >
                  Visible Screen Data
                </MenuItem>
              </Menu>
            </Box>
          </Box>

          {/* Over-limit warning */}
          {exceedsLimit && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              You have selected {poolSelectedCount} applications but the
              sanction batch limit for this service is {poolSanctionBatchLimit}.
              Please reduce your selection to continue.
            </Alert>
          )}

          {/* ── Pinned pool section ─────────────────────────────────────── */}
          {showPool && (
            <PoolSection>
              <PoolHeader>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Typography
                    sx={{
                      fontWeight: 700,
                      color: "#92400e",
                      fontSize: "0.95rem",
                    }}
                  >
                    Your Pool
                  </Typography>
                  <Chip
                    size="small"
                    label={poolData.length}
                    sx={{
                      bgcolor: "#fde68a",
                      color: "#78350f",
                      fontWeight: 700,
                      height: 20,
                    }}
                  />
                </Box>
                <Typography variant="caption" sx={{ color: "#92400e" }}>
                  Pinned — stays visible across all pages.
                </Typography>
              </PoolHeader>

              <PoolScroll>
                <MaterialReactTable
                  key={`pool-${Title}`}
                  columns={memoizedColumns}
                  data={memoizedPoolData}
                  enableStickyHeader
                  enablePagination={false}
                  enableBottomToolbar={false}
                  enableTopToolbar
                  enableColumnOrdering
                  enableColumnHiding
                  enableRowSelection={canHavePool}
                  enableSelectAll={canHavePool}
                  getRowId={getRowId}
                  state={{
                    isLoading,
                    columnOrder,
                    columnVisibility,
                    ...(canHavePool && { rowSelection: poolRowSelection }),
                  }}
                  onRowSelectionChange={
                    canHavePool ? handlePoolRowSelectionChange : undefined
                  }
                  onColumnOrderChange={setColumnOrder}
                  onColumnVisibilityChange={setColumnVisibility}
                  muiTablePaperProps={{
                    sx: {
                      borderRadius: 0,
                      background: "transparent",
                      border: 0,
                      boxShadow: "none",
                    },
                  }}
                  muiTableContainerProps={{
                    sx: { background: "transparent" },
                  }}
                  muiTableHeadCellProps={{
                    sx: {
                      background: "#fef3c7",
                      color: "#78350f",
                      fontWeight: 600,
                      fontSize: "0.72rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      borderBottom: "1px solid #fde68a",
                      borderRight: "1px solid #fde68a",
                      "&:last-child": { borderRight: "none" },
                      py: 1.1,
                      position: "sticky",
                      top: 0,
                      zIndex: 2,
                    },
                  }}
                  muiTableBodyRowProps={{
                    sx: {
                      "&:hover": { background: "#fefce8" },
                      "&.Mui-selected": { background: "#fde68a !important" },
                      "&:last-child td": { borderBottom: "none" },
                    },
                  }}
                  muiTableBodyCellProps={{
                    sx: {
                      color: "#1e293b",
                      background: "#fffdf5",
                      fontSize: "0.85rem",
                      borderRight: "1px solid #fef3c7",
                      borderBottom: "1px solid #fef3c7",
                      py: 1,
                      "&:last-child": { borderRight: "none" },
                    },
                  }}
                  renderTopToolbarCustomActions={({ table }) => {
                    if (!showExecuteToolbar) return null;
                    const selectedRows = table.getSelectedRowModel().rows;
                    const overCap =
                      isSanctionAction &&
                      selectedRows.length > poolSanctionBatchLimit;

                    return (
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1,
                          px: 1,
                          flexWrap: "wrap",
                        }}
                      >
                        <StyledFormControl size="small">
                          <InputLabel
                            id="bulk-action-label"
                            sx={{ fontSize: "0.875rem" }}
                          >
                            Bulk Action
                          </InputLabel>
                          <Select
                            labelId="bulk-action-label"
                            value={selectedAction}
                            label="Bulk Action"
                            onChange={(e) => setSelectedAction(e.target.value)}
                            size="small"
                            sx={{ fontSize: "0.875rem" }}
                          >
                            {actionOptions.map((option) => (
                              <MenuItem
                                key={option.value}
                                value={option.value}
                                sx={{ fontSize: "0.875rem" }}
                              >
                                {option.label}
                              </MenuItem>
                            ))}
                          </Select>
                        </StyledFormControl>
                        <Tooltip
                          arrow
                          title={
                            overCap
                              ? `You can sanction at most ${poolSanctionBatchLimit} application${
                                  poolSanctionBatchLimit === 1 ? "" : "s"
                                } at a time.`
                              : ""
                          }
                        >
                          <span>
                            <ActionButton
                              size="small"
                              disabled={selectedRows.length === 0 || overCap}
                              onClick={() => {
                                if (overCap) {
                                  toast.error(
                                    `Sanction batch limit exceeded. Maximum ${poolSanctionBatchLimit} application${
                                      poolSanctionBatchLimit === 1 ? "" : "s"
                                    } per batch.`,
                                    {
                                      position: "top-center",
                                      autoClose: 4000,
                                      theme: "colored",
                                    },
                                  );
                                  return;
                                }
                                onExecuteAction(selectedRows, inputValues);
                              }}
                            >
                              Execute ({selectedRows.length})
                              {isSanctionAction
                                ? ` / ${poolSanctionBatchLimit}`
                                : ""}
                            </ActionButton>
                          </span>
                        </Tooltip>
                      </Box>
                    );
                  }}
                />
              </PoolScroll>
            </PoolSection>
          )}

          {/* ── Main table — server-side paginated ─────────────────────── */}
          {/* ===== PAGINATION PERSISTENCE =====
              Do NOT mount MRT until the first fetch has resolved. Mounting it
              with `data=[]`, `pageCount=0` while `state.pagination.pageIndex>0`
              causes MRT to emit an onPaginationChange reset-to-0 the moment
              data arrives, overwriting the restored sessionStorage value. */}
          {hasLoadedOnce ? (
            <MaterialReactTable
              key={`main-${Title}`}
              columns={memoizedColumns}
              data={memoizedInboxData}
              enableStickyHeader
              autoResetPageIndex={false}
              state={{
                pagination,
                isLoading,
                columnOrder,
                columnVisibility,
                ...(canSanction &&
                  pendingApplications && {
                    rowSelection: mainRowSelection,
                  }),
              }}
              onPaginationChange={(updater) => {
                // ===== PAGINATION TRACE =====
                const next =
                  typeof updater === "function" ? updater(pagination) : updater;
                console.log("[PAGINATION] MRT onPaginationChange:", {
                  prev: pagination,
                  next,
                  reason:
                    next.pageIndex !== pagination.pageIndex
                      ? "page change"
                      : next.pageSize !== pagination.pageSize
                        ? "pageSize change"
                        : "unknown",
                });
                setPagination(next);
              }}
              onRowSelectionChange={
                canSanction && pendingApplications
                  ? handleMainRowSelectionChange
                  : undefined
              }
              onColumnOrderChange={setColumnOrder}
              onColumnVisibilityChange={setColumnVisibility}
              enableRowSelection={canSanction && pendingApplications}
              enableColumnOrdering
              enableColumnHiding
              manualPagination
              enablePagination
              getRowId={getRowId}
              pageCount={pageCount}
              rowCount={totalRecords}
              muiTablePaperProps={{
                sx: {
                  borderRadius: "8px",
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  boxShadow: "none",
                },
              }}
              muiTableContainerProps={{
                sx: {
                  maxHeight: "65vh",
                  background: "#ffffff",
                  "&::-webkit-scrollbar": { width: "8px", height: "8px" },
                  "&::-webkit-scrollbar-thumb": {
                    background: "#cbd5e1",
                    borderRadius: "4px",
                  },
                  "&::-webkit-scrollbar-track": { background: "#f1f5f9" },
                },
              }}
              muiTableHeadCellProps={{
                sx: {
                  background: "#f8fafc",
                  color: "#475569",
                  fontWeight: 600,
                  fontSize: "0.75rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  borderBottom: "2px solid #e2e8f0",
                  borderRight: "1px solid #e2e8f0",
                  "&:last-child": { borderRight: "none" },
                  py: 1.5,
                  position: "sticky",
                  top: 0,
                  zIndex: 2,
                },
              }}
              muiTableBodyRowProps={{
                sx: {
                  "&:hover": {
                    background: "#f8fafc",
                    transition: "background-color 0.2s ease",
                  },
                  "&.Mui-selected": { background: "#eff6ff !important" },
                  "&:last-child td": { borderBottom: "none" },
                },
              }}
              muiTableBodyCellProps={{
                sx: {
                  color: "#1e293b",
                  background: "transparent",
                  fontSize: "0.875rem",
                  borderRight: "1px solid #e2e8f0",
                  borderBottom: "1px solid #e2e8f0",
                  py: 1.5,
                  "&:last-child": { borderRight: "none" },
                },
              }}
              muiTableFooterRowProps={{
                sx: {
                  borderTop: "2px solid #e2e8f0",
                  background: "#f8fafc",
                },
              }}
              muiTablePaginationProps={{
                rowsPerPageOptions: [10, 25, 50, 100],
                showFirstButton: true,
                showLastButton: true,
                sx: {
                  color: "#475569",
                  background: "#ffffff",
                  borderTop: "1px solid #e2e8f0",
                  fontSize: "0.875rem",
                  "& .MuiTablePagination-select": { borderRadius: "4px" },
                },
              }}
              renderEmptyRowsFallback={() => (
                <Box sx={{ textAlign: "center", py: 8, color: "#94a3b8" }}>
                  <SearchOffIcon
                    sx={{ fontSize: 48, mb: 2, color: "#cbd5e1" }}
                  />
                  <Typography
                    variant="h6"
                    sx={{ fontWeight: 500, color: "#64748b", mb: 1 }}
                  >
                    {globalFilter
                      ? `No results found for "${globalFilter}"`
                      : "No records available"}
                  </Typography>
                  <Typography variant="body2">
                    {globalFilter
                      ? "Try adjusting your search terms."
                      : "No applications found."}
                  </Typography>
                </Box>
              )}
              renderBottomToolbarCustomActions={() =>
                isLoading && (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <CircularProgress size={16} sx={{ color: "#2562e9" }} />
                    <Typography variant="body2" sx={{ color: "#64748b" }}>
                      Loading data...
                    </Typography>
                  </Box>
                )
              }
              renderTopToolbarCustomActions={({ table }) => {
                const selectedRows = table.getSelectedRowModel().rows;
                if (!showPushToPoolToolbar) return null;
                return (
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      px: 1,
                    }}
                  >
                    <ActionButton
                      size="small"
                      disabled={selectedRows.length === 0}
                      onClick={() => onPushToPool(selectedRows, inputValues)}
                    >
                      Push to Pool ({selectedRows.length})
                    </ActionButton>
                  </Box>
                );
              }}
            />
          ) : (
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                py: 10,
                gap: 2,
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                background: "#ffffff",
              }}
            >
              <CircularProgress size={32} sx={{ color: "#2562e9" }} />
              <Typography variant="body2" sx={{ color: "#64748b" }}>
                Loading data…
              </Typography>
            </Box>
          )}
        </TableCard>
      </TableContainer>
    );
  },
);

export default ServerSideTable;
