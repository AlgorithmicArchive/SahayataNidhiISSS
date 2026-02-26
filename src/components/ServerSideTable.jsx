// ServerSideTable.jsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { MaterialReactTable } from "material-react-table";
import {
  Box,
  Button,
  CircularProgress,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Menu,
  IconButton,
  TextField,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import DescriptionIcon from "@mui/icons-material/Description";
import TableChartIcon from "@mui/icons-material/TableChart";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import axiosInstance from "../axiosConfig";
import styled from "@emotion/styled";

// ==================== Styled Components ====================
const TableContainer = styled(Box)`
  background: linear-gradient(to bottom right, #f4f9ff 0%, #f9f3ec 100%);
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 2rem 1rem;
  box-sizing: border-box;
  min-height: 50vh;
  width: 100%;
  @media (max-width: 600px) {
    padding: 1rem 0.5rem;
  }
`;

const TableCard = styled(Box)`
  background: #ffffff;
  border-radius: 16px;
  padding: 2rem;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
  width: 95%;
  max-width: 1200px;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  &:hover {
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.15);
  }
  @media (max-width: 600px) {
    padding: 1rem;
    border-radius: 12px;
  }
`;

const ActionButton = styled(Button)`
  background: linear-gradient(45deg, #1e88e5, #4fc3f7);
  color: #ffffff;
  font-weight: 600;
  text-transform: none;
  border-radius: 8px;
  padding: 0.5rem 1.5rem;
  transition: all 0.3s ease;
  &:hover {
    background: linear-gradient(45deg, #1565c0, #039be5);
    box-shadow: 0 4px 12px rgba(30, 136, 229, 0.3);
  }
  @media (max-width: 600px) {
    padding: 0.4rem 1rem;
    font-size: 0.875rem;
  }
`;

const StyledIconButton = styled(IconButton)`
  color: #1e88e5;
  border: 1px solid #1e88e5;
  border-radius: 8px;
  padding: 0.5rem;
  transition: all 0.3s ease;
  &:hover {
    background: linear-gradient(45deg, #1e88e5, #4fc3f7);
    color: #ffffff;
    transform: scale(1.02);
  }
  @media (max-width: 600px) {
    padding: 0.3rem;
  }
`;

const StyledToggleButtonGroup = styled(ToggleButtonGroup)`
  & .MuiToggleButton-root {
    text-transform: none;
    font-weight: 600;
    padding: 0.5rem 1.5rem;
    border-radius: 8px;
    border: 1px solid #b3cde0;
    color: #1f2937;
    transition: all 0.3s ease;
    &:hover {
      background: #e6f0fa;
      transform: scale(1.02);
    }
    &.Mui-selected {
      background: linear-gradient(45deg, #1e88e5, #4fc3f7);
      color: #ffffff;
      &:hover {
        background: linear-gradient(45deg, #1565c0, #039be5);
      }
    }
  }
  @media (max-width: 600px) {
    & .MuiToggleButton-root {
      padding: 0.4rem 1rem;
      font-size: 0.875rem;
    }
  }
`;

const StyledFormControl = styled(FormControl)`
  & .MuiOutlinedInput-root {
    border-radius: 8px;
    background: #ffffff;
    border: 1px solid #b3cde0;
    &:hover .MuiOutlinedInput-notchedOutline {
      border-color: #1e88e5;
    }
    &.Mui-focused .MuiOutlinedInput-notchedOutline {
      border-color: #1e88e5;
      border-width: 2px;
    }
  }
  & .MuiInputLabel-root {
    color: #1f2937;
    &.Mui-focused {
      color: #1e88e5;
    }
  }
  min-width: 150px;
  margin-right: 1rem;
  @media (max-width: 600px) {
    min-width: 120px;
    margin-right: 0.5rem;
  }
`;

// ==================== Sub‑Components ====================
// InputCell (memoized)
const InputCell = React.memo(({ row, inputValues, setInputValues }) => {
  const [localValue, setLocalValue] = useState(inputValues[row.original.sno] || "");

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
    [row.original.sno, setInputValues]
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
      placeholder="Enter Aadhaar Number"
      inputProps={{ maxLength: 12, pattern: "[0-9]*" }}
      onFocus={(e) => e.target.select()}
      sx={{
        "& .MuiInputBase-input": {
          fontSize: { xs: "0.75rem", sm: "0.875rem" },
        },
      }}
    />
  );
});

// UserTypeSelect (memoized)
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
    [row.original.username, onChange]
  );

  return (
    <FormControl size="small" sx={{ minWidth: 100 }}>
      <Select value={value} onChange={handleChange}>
        <MenuItem value="Officer">Officer</MenuItem>
        <MenuItem value="Admin">Admin</MenuItem>
      </Select>
    </FormControl>
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
      actionOptions,
      selectedAction,
      setSelectedAction,
      Title,
      searchableFields = ["referenceNumber", "applicantName"], // fields to search on server
    },
    ref
  ) => {
    // ---------- State ----------
    const [columns, setColumns] = useState([]);
    const [inboxData, setInboxData] = useState([]);
    const [poolData, setPoolData] = useState([]);
    const [pageCount, setPageCount] = useState(0);
    const [totalRecords, setTotalRecords] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [rowSelection, setRowSelection] = useState({});
    const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
    const [viewType, setViewType] = useState("Inbox");
    const [hasActions, setHasActions] = useState(false);
    const [columnOrder, setColumnOrder] = useState([]);
    const [columnVisibility, setColumnVisibility] = useState({});
    const [anchorEl, setAnchorEl] = useState(null);
    const [downloadType, setDownloadType] = useState(null);
    const [inputValues, setInputValues] = useState({});

    // Global filter (built‑in MRT search)
    const [globalFilter, setGlobalFilter] = useState("");
    const debouncedGlobalFilter = useDebounce(globalFilter, 500);

    // Storage key for column settings
    const storageKey = Title.toLowerCase()
      .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
        index === 0 ? word.toLowerCase() : word.toUpperCase()
      )
      .replace(/\s+/g, "");

    // ---------- Refs to avoid dependency loops ----------
    const paginationRef = useRef(pagination);
    const globalFilterRef = useRef(debouncedGlobalFilter);
    const extraParamsRef = useRef(extraParams);
    const urlRef = useRef(url);
    const searchableFieldsRef = useRef(searchableFields);

    useEffect(() => {
      paginationRef.current = pagination;
    }, [pagination]);
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

    // ---------- Data fetching (stable) ----------
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

        // Add search if active
        if (globalFilterRef.current) {
          params.searchQuery = globalFilterRef.current;
          params.searchFields = JSON.stringify(searchableFieldsRef.current);
        }

        const response = await axiosInstance.get(currentUrl, { params });
        const json = response.data;

        const hasAnyActions =
          json.data?.some((row) => row.customActions?.length > 0) ||
          json.poolData?.some((row) => row.customActions?.length > 0) ||
          false;

        // Build columns
        let updatedColumns = Object.values(json.columns || {}).map((col) =>
          col.accessorKey === "sno" ? { ...col, size: 20 } : col
        );

        // Custom cell for userType
        updatedColumns = updatedColumns.map((col) => {
          if (col.accessorKey === "userType") {
            return {
              ...col,
              size: 120,
              enableSorting: false,
              Cell: ({ row }) => (
                <UserTypeSelect row={row} onChange={handleUserTypeChange} />
              ),
            };
          }
          return col;
        });

        // Input column if needed
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
                inputValues={inputValues}
                setInputValues={setInputValues}
              />
            ),
          });
        }

        setHasActions(hasAnyActions);
        setColumns(updatedColumns);
        setInboxData(json.data || []);
        setPoolData(json.poolData || []);
        setTotalRecords(json.totalRecords || 0);
        setPageCount(Math.ceil((json.totalRecords || 0) / paginationRef.current.pageSize));

        // Column order
        setColumnOrder((prevOrder) => {
          if (prevOrder.length === 0) return updatedColumns.map((col) => col.accessorKey);
          const newOrder = [...prevOrder];
          updatedColumns.forEach((col) => {
            if (!newOrder.includes(col.accessorKey)) newOrder.push(col.accessorKey);
          });
          return newOrder.filter((key) => updatedColumns.some((col) => col.accessorKey === key));
        });

        // Column visibility
        setColumnVisibility((prevVisibility) => {
          if (Object.keys(prevVisibility).length === 0) {
            const initial = {};
            updatedColumns.forEach((col) => (initial[col.accessorKey] = true));
            return initial;
          }
          const newVis = { ...prevVisibility };
          updatedColumns.forEach((col) => {
            if (!(col.accessorKey in newVis)) newVis[col.accessorKey] = true;
          });
          Object.keys(newVis).forEach((key) => {
            if (!updatedColumns.some((col) => col.accessorKey === key)) delete newVis[key];
          });
          return newVis;
        });

        // Optional toast for search results
        if (globalFilterRef.current && json.totalRecords > 0) {
          toast.info(`Found ${json.totalRecords} matching records`, {
            position: "top-center",
            autoClose: 2000,
          });
        } else if (globalFilterRef.current && json.totalRecords === 0) {
          toast.info("No matching records found", {
            position: "top-center",
            autoClose: 2000,
          });
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        toast.error("Failed to load table data. Please try again.", {
          position: "top-center",
        });
      } finally {
        setIsLoading(false);
      }
    }, []); // No dependencies – uses refs

    // Trigger fetch when relevant state changes
    useEffect(() => {
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

    // ---------- UserType change handler ----------
    const handleUserTypeChange = useCallback(
      async (username, newType) => {
        const formdata = new FormData();
        formdata.append("username", username);
        formdata.append("userType", newType);
        try {
          const response = await axiosInstance.post("/Admin/UpdateUserType", formdata);
          if (response.data.status) {
            toast.success(response.data.message, { position: "top-center" });
            fetchData(); // refresh after change
          } else {
            toast.error(response.data.message || "Update failed.", { position: "top-center" });
          }
        } catch (error) {
          console.error("Error updating user type:", error);
          toast.error("An error occurred while updating user type.", { position: "top-center" });
        }
      },
      [fetchData]
    );

    // ---------- Column settings persistence ----------
    useEffect(() => {
      const fetchTableSettings = async () => {
        try {
          const response = await axiosInstance.get("/Base/GetTableSettings", {
            params: { storageKey },
          });
          if (response.data?.status && response.data?.tableSettings) {
            const savedSettings = JSON.parse(response.data.tableSettings);
            if (savedSettings) {
              if (savedSettings.savedColumnOrder) setColumnOrder(savedSettings.savedColumnOrder);
              if (savedSettings.savedColumnVisibility)
                setColumnVisibility(savedSettings.savedColumnVisibility);
            }
          }
        } catch (error) {
          console.error("Error fetching table settings:", error);
        }
      };
      fetchTableSettings();
    }, [storageKey]);

    const saveColumnSettings = useCallback(async () => {
      const formData = new FormData();
      formData.append("storageKey", storageKey);
      formData.append(
        "storageValue",
        JSON.stringify({
          savedColumnOrder: columnOrder,
          savedColumnVisibility: columnVisibility,
        })
      );
      await axiosInstance.post("/Base/SaveTableSettings", formData);
    }, [columnOrder, columnVisibility, storageKey]);

    useEffect(() => {
      if (columnOrder.length > 0 || Object.keys(columnVisibility).length > 0) {
        saveColumnSettings();
      }
    }, [columnOrder, columnVisibility, saveColumnSettings]);

    // ---------- Download handlers ----------
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
          formData.append(key, value.toString());
        });

        if (globalFilter) {
          formData.append("searchQuery", globalFilter);
          formData.append("searchFields", JSON.stringify(searchableFields));
        }

        if (Object.keys(inputValues).length > 0) {
          formData.append("inputValues", JSON.stringify(inputValues));
        }

        const response = await axiosInstance.post("/Base/ExportData", formData, {
          responseType: "blob",
        });

        const extension = { Excel: "xlsx", Csv: "csv", Pdf: "pdf" }[format];
        const fileName = `${Title.replace(/\s+/g, "_")}_${scope}_${new Date().toISOString().split("T")[0]
          }${globalFilter ? "_search_results" : ""}.${extension}`;

        const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement("a");
        link.href = blobUrl;
        link.setAttribute("download", fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);

        toast.success(`${format} file downloaded successfully!`, { position: "top-center" });
      } catch (error) {
        console.error(`Download error:`, error);
        toast.error(`Failed to download ${format} file.`, { position: "top-center" });
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

    // ---------- View type toggle ----------
    const isPoolView = viewType === "Pool";
    const tableData = isPoolView ? poolData : inboxData;
    const showToggleButtons = poolData && pendingApplications && canSanction && canHavePool;

    const handleViewTypeChange = (event, newViewType) => {
      if (newViewType !== null) {
        setViewType(newViewType);
        setRowSelection({});
      }
    };

    // Memoized data/columns (optional, but good practice)
    const memoizedTableData = useMemo(() => tableData, [tableData]);
    const memoizedColumns = useMemo(() => columns, [columns]);

    return (
      <TableContainer ref={ref}>
        <TableCard>
          <Typography
            variant="h4"
            sx={{
              fontWeight: 700,
              color: "#1f2937",
              fontFamily: "'Inter', sans-serif",
              mb: 2,
              textAlign: "center",
              fontSize: { xs: "1.5rem", sm: "2rem" },
            }}
          >
            {Title}
            {globalFilter && (
              <Typography
                component="span"
                sx={{
                  ml: 2,
                  fontSize: "1rem",
                  color: "#1e88e5",
                  fontWeight: 400,
                }}
              >
                (Search Results)
              </Typography>
            )}
          </Typography>

          <Box
            sx={{
              display: "flex",
              flexDirection: { xs: "column", sm: "row" },
              justifyContent: "space-between",
              alignItems: { xs: "flex-start", sm: "center" },
              mb: 3,
              gap: { xs: 2, sm: 0 },
            }}
          >
            <Typography variant="body2" color="#6b7280">
              Total Records: {totalRecords}
            </Typography>

            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
              <Tooltip title="Download as Excel" arrow>
                <StyledIconButton onClick={(e) => handleMenuOpen(e, "Excel")}>
                  <TableChartIcon />
                </StyledIconButton>
              </Tooltip>
              <Tooltip title="Download as CSV" arrow>
                <StyledIconButton onClick={(e) => handleMenuOpen(e, "Csv")}>
                  <DescriptionIcon />
                </StyledIconButton>
              </Tooltip>
              <Tooltip title="Download as PDF" arrow>
                <StyledIconButton onClick={(e) => handleMenuOpen(e, "Pdf")}>
                  <PictureAsPdfIcon />
                </StyledIconButton>
              </Tooltip>
              <Tooltip title="Refresh Data" arrow>
                <StyledIconButton onClick={fetchData}>
                  <RefreshIcon />
                </StyledIconButton>
              </Tooltip>
              <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
                anchorOrigin={{ vertical: "top", horizontal: "right" }}
                transformOrigin={{ vertical: "bottom", horizontal: "right" }}
              >
                <MenuItem onClick={() => handleDownload(downloadType, "All")}>
                  All Data
                </MenuItem>
                <MenuItem onClick={() => handleDownload(downloadType, "InView")}>
                  Visible Screen Data
                </MenuItem>
              </Menu>
            </Box>
          </Box>

          {showToggleButtons && (
            <Box sx={{ display: "flex", justifyContent: "center", mb: 3 }}>
              <StyledToggleButtonGroup
                value={viewType}
                exclusive
                onChange={handleViewTypeChange}
                aria-label="View type"
              >
                <ToggleButton value="Inbox">Inbox ({inboxData.length})</ToggleButton>
                <ToggleButton value="Pool">Pool ({poolData.length})</ToggleButton>
              </StyledToggleButtonGroup>
            </Box>
          )}

          <MaterialReactTable
            key={`table-${Title}`}
            columns={memoizedColumns}
            data={memoizedTableData}
            state={{
              pagination,
              isLoading,
              columnOrder,
              columnVisibility,
              globalFilter, // built‑in search state
              ...(canSanction && pendingApplications && { rowSelection }),
            }}
            onPaginationChange={setPagination}
            onGlobalFilterChange={setGlobalFilter} // triggers server search
            onRowSelectionChange={
              canSanction && pendingApplications ? setRowSelection : undefined
            }
            onColumnOrderChange={setColumnOrder}
            onColumnVisibilityChange={setColumnVisibility}
            enableRowSelection={canSanction && pendingApplications}
            enableColumnOrdering
            enableColumnHiding
            manualPagination
            enablePagination
            pageCount={pageCount}
            rowCount={totalRecords}
            muiTablePaperProps={{
              sx: {
                borderRadius: "12px",
                background: "#ffffff",
                border: "1px solid #b3cde0",
                boxShadow: "0 4px 16px rgba(0, 0, 0, 0.05)",
              },
            }}
            muiTableContainerProps={{ sx: { maxHeight: "600px", background: "#ffffff" } }}
            muiTableHeadCellProps={{
              sx: {
                background: "#e6f0fa",
                color: "#1f2937",
                fontWeight: 600,
                fontSize: { xs: "0.75rem", sm: "0.875rem" },
                borderBottom: "2px solid #b3cde0",
                borderRight: "1px solid #b3cde0",
                "&:last-child": { borderRight: "none" },
                whiteSpace: "normal",
                wordBreak: "break-word",
              },
            }}
            muiTableBodyRowProps={{
              sx: {
                "&:hover": { background: "#f8fafc", transition: "background-color 0.2s ease" },
              },
            }}
            muiTableBodyCellProps={{
              sx: {
                color: "#1f2937",
                background: "#ffffff",
                fontSize: { xs: "0.75rem", sm: "0.875rem" },
                borderRight: "1px solid #b3cde0",
                borderBottom: "1px solid #b3cde0",
                "&:last-child": { borderRight: "none" },
                whiteSpace: "normal",
                wordBreak: "break-word",
              },
            }}
            muiTableFooterRowProps={{ sx: { borderTop: "2px solid #b3cde0" } }}
            muiTablePaginationProps={{
              rowsPerPageOptions: [10, 25, 50],
              showFirstButton: true,
              showLastButton: true,
              sx: {
                color: "#1f2937",
                background: "#ffffff",
                borderTop: "1px solid #b3cde0",
                fontSize: { xs: "0.75rem", sm: "0.875rem" },
              },
            }}
            renderEmptyRowsFallback={() => (
              <Box sx={{ textAlign: "center", py: 4, color: "#6b7280" }}>
                {globalFilter
                  ? `No results found for "${globalFilter}"`
                  : `No ${viewType.toLowerCase()} applications available.`}
              </Box>
            )}
            renderBottomToolbarCustomActions={() =>
              isLoading && (
                <CircularProgress size={24} sx={{ color: "#1e88e5" }} aria-label="Loading" />
              )
            }
            {...(hasActions && {
              enableRowActions: true,
              positionActionsColumn: "last",
              renderRowActions: ({ row }) => (
                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                  {Array.isArray(row.original.customActions) ? (
                    row.original.customActions.map((action, index) => (
                      <Tooltip key={index} title={action.tooltipText} arrow>
                        <Button
                          sx={{
                            width: "max-content",
                            background: "linear-gradient(to right, #10B582, #0D9588)",
                            color: "#fff",
                            fontWeight: 600,
                          }}
                          onClick={() =>
                            actionFunctions[action.actionFunction]?.(
                              row,
                              action,
                              {
                                inputValue: inputValues[row.original.sno] || "",
                                allInputValues: inputValues,
                              }
                            )
                          }
                          aria-label={`${action.name || action.tooltip} for row ${row.original.sno}`}
                        >
                          {action.name || action.tooltip}
                        </Button>
                      </Tooltip>
                    ))
                  ) : (
                    <Typography variant="body2" sx={{ fontWeight: 600, color: "#1f2937" }}>
                      {row.original.customActions}
                    </Typography>
                  )}
                </Box>
              ),
            })}
            renderTopToolbarCustomActions={({ table }) => {
              const selectedRows = table.getSelectedRowModel().rows;
              if (canSanction && pendingApplications && viewType === "Inbox") {
                return (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <ActionButton
                      disabled={selectedRows.length === 0}
                      onClick={() => onPushToPool(selectedRows, inputValues)}
                    >
                      Push to Pool
                    </ActionButton>
                  </Box>
                );
              } else if (canHavePool && viewType === "Pool") {
                return (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <StyledFormControl size="small">
                      <InputLabel id="bulk-action-label">Bulk Action</InputLabel>
                      <Select
                        labelId="bulk-action-label"
                        value={selectedAction}
                        label="Bulk Action"
                        onChange={(e) => setSelectedAction(e.target.value)}
                        size="small"
                      >
                        {actionOptions.map((option) => (
                          <MenuItem key={option.value} value={option.value}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </StyledFormControl>
                    <ActionButton
                      disabled={selectedRows.length === 0}
                      onClick={() => onExecuteAction(selectedRows, inputValues)}
                    >
                      Execute
                    </ActionButton>
                  </Box>
                );
              }
              return null;
            }}
          />
        </TableCard>
      </TableContainer>
    );
  }
);

export default ServerSideTable;