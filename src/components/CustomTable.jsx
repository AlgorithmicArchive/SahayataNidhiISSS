import React, { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  Paper,
  Typography,
  CircularProgress,
  Button,
  Checkbox,
  IconButton,
  TextField,
} from "@mui/material";
import { PictureAsPdf, GridOn, TableView } from "@mui/icons-material";
import jsPDF from "jspdf";
import "jspdf-autotable";
import * as XLSX from "xlsx";

const CustomTable = ({
  title = "", // Default title if none provided
  fetchData,
  initialRowsPerPage = 5,
  url,
  buttonActionHandler,
  params,
  formdata,
  showCheckbox = false,
  onSelectionChange,
  fieldToReturn = "",
}) => {
  const [order, setOrder] = useState("asc");
  const [orderBy, setOrderBy] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(initialRowsPerPage);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [columns, setColumns] = useState([]);
  const [selectedRows, setSelectedRows] = useState([]);
  const [searchTerm, setSearchTerm] = useState(""); // State for search input
  const [filteredData, setFilteredData] = useState([]); // State for filtered data

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const result = await fetchData(
          page,
          rowsPerPage,
          url,
          params,
          formdata
        );
        setData(result.data);
        setTotalCount(result.totalCount);
        setColumns(result.columns);
        if (orderBy === "" && result.columns.length > 0) {
          setOrderBy(result.columns[0].value);
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
      }
      setLoading(false);
    };

    loadData();
  }, [page, rowsPerPage, fetchData, url, params, formdata]);

  useEffect(() => {
    // Filter and sort data based on search term and sort order
    let updatedData = [...data];

    // Filtering
    if (searchTerm) {
      const lowercasedSearchTerm = searchTerm.toLowerCase();
      updatedData = updatedData.filter((row) =>
        columns.some((col) =>
          String(row[col.value]).toLowerCase().includes(lowercasedSearchTerm)
        )
      );
    }

    // Sorting
    if (orderBy) {
      updatedData.sort((a, b) => {
        const aValue = a[orderBy];
        const bValue = b[orderBy];

        // Handle different data types
        if (typeof aValue === "number" && typeof bValue === "number") {
          return order === "asc" ? aValue - bValue : bValue - aValue;
        }

        // For strings and other types
        const aString = aValue ? aValue.toString().toLowerCase() : "";
        const bString = bValue ? bValue.toString().toLowerCase() : "";

        if (aString < bString) return order === "asc" ? -1 : 1;
        if (aString > bString) return order === "asc" ? 1 : -1;
        return 0;
      });
    }

    setFilteredData(updatedData);
  }, [data, searchTerm, columns, order, orderBy]);

  const handleRequestSort = (property) => {
    const isAscending = orderBy === property && order === "asc";
    setOrder(isAscending ? "desc" : "asc");
    setOrderBy(property);
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
    setSearchTerm("");
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    const tableTitle = title || "Table";
    doc.text(tableTitle, 10, 10);
    doc.autoTable({
      head: [columns.map((col) => col.label)],
      body: filteredData.map((row) =>
        columns.map((col) => row[col.value] || "")
      ),
    });
    doc.save(`${tableTitle}.pdf`);
  };

  const exportCSV = () => {
    const csvContent = [
      columns.map((col) => col.label).join(","),
      ...filteredData.map((row) =>
        columns.map((col) => `"${row[col.value] || ""}"`).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `${title || "Table"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportExcel = () => {
    const worksheetData = [columns.map((col) => col.label)];
    filteredData.forEach((row) => {
      worksheetData.push(columns.map((col) => row[col.value] || ""));
    });

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, title || "Table");
    XLSX.writeFile(workbook, `${title || "Table"}.xlsx`);
  };

  const isRowSelected = (row) => selectedRows.includes(row);

  const handleSelectAllClick = (event) => {
    if (event.target.checked) {
      const newSelectedRows = filteredData;
      setSelectedRows(newSelectedRows);
      const selectedFieldValues = newSelectedRows.map((row) =>
        fieldToReturn ? row[fieldToReturn] : row
      );
      onSelectionChange(selectedFieldValues);
      return;
    }
    setSelectedRows([]);
    onSelectionChange([]);
  };

  const handleRowClick = (row) => {
    const selectedIndex = selectedRows.indexOf(row);
    let newSelectedRows = [];

    if (selectedIndex === -1) {
      newSelectedRows = newSelectedRows.concat(selectedRows, row);
    } else if (selectedIndex === 0) {
      newSelectedRows = newSelectedRows.concat(selectedRows.slice(1));
    } else if (selectedIndex === selectedRows.length - 1) {
      newSelectedRows = newSelectedRows.concat(selectedRows.slice(0, -1));
    } else if (selectedIndex > 0) {
      newSelectedRows = newSelectedRows.concat(
        selectedRows.slice(0, selectedIndex),
        selectedRows.slice(selectedIndex + 1)
      );
    }

    setSelectedRows(newSelectedRows);
    const selectedFieldValues = newSelectedRows.map((row) =>
      fieldToReturn ? row[fieldToReturn] : row
    );
    onSelectionChange(selectedFieldValues);
  };

  return (
    <Paper
      sx={{
        padding: 5,
        border: "2px solid",
        borderColor: "primary.main",
        width: "100%",
      }}
    >
      <Typography
        variant="h6"
        component="div"
        sx={{ p: 2, color: "primary.main" }}
      >
        {title}
      </Typography>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: "10px",
        }}
      >
        <TextField
          label="Search"
          variant="outlined"
          size="small"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{ width: "200px" }}
        />
        <div>
          <IconButton onClick={exportPDF} color="primary">
            <PictureAsPdf />
          </IconButton>
          <IconButton onClick={exportCSV} color="primary">
            <GridOn />
          </IconButton>
          <IconButton onClick={exportExcel} color="primary">
            <TableView />
          </IconButton>
        </div>
      </div>
      <TableContainer>
        <Table aria-label="dynamic table">
          <TableHead>
            <TableRow
              sx={{
                backgroundColor: "primary.main",
                border: "2px solid #F0C38E",
              }}
            >
              {showCheckbox && (
                <TableCell padding="checkbox">
                  <Checkbox
                    color="default"
                    indeterminate={
                      selectedRows.length > 0 &&
                      selectedRows.length < filteredData.length
                    }
                    checked={
                      filteredData.length > 0 &&
                      selectedRows.length === filteredData.length
                    }
                    onChange={handleSelectAllClick}
                  />
                </TableCell>
              )}
              {columns.map(({ label, value }, index) => (
                <TableCell
                  key={index}
                  sortDirection={orderBy === value ? order : false}
                  sx={{
                    color: "background.paper",
                    borderRight:
                      index === columns.length - 1
                        ? "none"
                        : "2px solid #312C51",
                    fontWeight: "bold",
                  }}
                >
                  <TableSortLabel
                    active={orderBy === value}
                    direction={orderBy === value ? order : "asc"}
                    onClick={() => handleRequestSort(value)}
                    sx={{
                      color:
                        orderBy === value
                          ? "background.default"
                          : "background.paper",
                      "&.Mui-active": { color: "background.paper" },
                    }}
                  >
                    {label}
                  </TableSortLabel>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + (showCheckbox ? 1 : 0)}
                  align="center"
                  sx={{ color: "primary.main" }}
                >
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : filteredData.length > 0 ? (
              filteredData.map((row, rowIndex) => {
                const isSelected = isRowSelected(row);
                return (
                  <TableRow
                    key={rowIndex}
                    sx={{ border: "2px solid #F0C38E" }}
                    hover
                    role="checkbox"
                    aria-checked={isSelected}
                    selected={isSelected}
                    onClick={() => showCheckbox && handleRowClick(row)}
                  >
                    {showCheckbox && (
                      <TableCell padding="checkbox">
                        <Checkbox
                          color="primary"
                          checked={isSelected}
                          onChange={() => handleRowClick(row)}
                        />
                      </TableCell>
                    )}
                    {columns.map(({ value }, columnIndex) => {
                      if (
                        value.includes("button") &&
                        typeof row[value] === "object" &&
                        row[value] !== null
                      ) {
                        return (
                          <TableCell
                            key={columnIndex}
                            sx={{ color: "background.paper" }}
                          >
                            <Button
                              variant="contained"
                              color="primary"
                              sx={{
                                fontWeight: "bold",
                                color: "background.paper",
                              }}
                              onClick={(e) => {
                                e.stopPropagation(); // Prevent row selection
                                buttonActionHandler(
                                  row[value].function,
                                  row[value].parameters
                                );
                              }}
                            >
                              {row[value].buttonText}
                            </Button>
                          </TableCell>
                        );
                      }
                      return (
                        <TableCell
                          key={columnIndex}
                          sx={{
                            color: "primary.main",
                            borderRight: "2px solid #F0C38E",
                          }}
                        >
                          {typeof row[value] === "object" && row[value] !== null
                            ? JSON.stringify(row[value])
                            : row[value]}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length + (showCheckbox ? 1 : 0)}
                  align="center"
                  sx={{ color: "primary.main" }}
                >
                  No records found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        rowsPerPageOptions={[5, 10, 15]}
        component="div"
        count={totalCount}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        sx={{ color: "primary.main" }}
      />
    </Paper>
  );
};

export default CustomTable;
