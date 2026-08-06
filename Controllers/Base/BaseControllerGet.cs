using System.Dynamic;
using System.Globalization;
using System.Security.Claims;
using ClosedXML.Excel;
using CsvHelper;
using iText.Kernel.Pdf;
using iText.Layout;
using iText.Layout.Element;
using iText.Layout.Properties;
using Microsoft.AspNetCore.Mvc;
using Npgsql;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using SahayataNidhi.Models.Entities;
using iText.Kernel.Colors;
using System.Text;
using iText.Kernel.Geom;
using iText.Kernel.Font;
using iText.IO.Font.Constants;

namespace SahayataNidhi.Controllers
{
    public partial class BaseController
    {
        [HttpGet]
        public async Task<IActionResult> DisplayFile(string fileName)
        {
            var fileModel = await dbcontext.Userdocuments
                .FirstOrDefaultAsync(f => f.Filename == fileName);

            if (fileModel == null)
            {
                return NotFound("File not found.");
            }

            if (!fileModel.Filetype.StartsWith("image/") && fileModel.Filetype != "application/pdf")
            {
                return BadRequest("File is not an image or PDF.");
            }

            return File(fileModel.Filedata, fileModel.Filetype);
        }

        [HttpGet]
        public IActionResult GetServiceContent(int serviceId)
        {
            // Retrieve the serviceId from the JWT claims or other mechanisms if necessary.
            var service = dbcontext.Services.FirstOrDefault(ser => ser.Serviceid == serviceId);

            if (service != null)
            {
                return Json(new { status = true, service.Servicename, service.Formelement, service.Serviceid });
            }
            else
            {
                return Json(new { status = false, message = "No Service Found" });
            }
        }

        [HttpGet]
        public IActionResult GetTableSettings(string storageKey)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

            if (!int.TryParse(userIdClaim, out int userId))
            {
                return BadRequest(new { status = false, message = "Invalid user." });
            }

            var userDetails = dbcontext.Users.FirstOrDefault(u => u.Userid == userId);
            if (userDetails == null || string.IsNullOrWhiteSpace(userDetails.Additionaldetails))
            {
                return NotFound(new { status = false, message = "User or settings not found." });
            }

            JObject additionalDetails;

            try
            {
                additionalDetails = JObject.Parse(userDetails.Additionaldetails);
            }
            catch (JsonReaderException)
            {
                return BadRequest(new { status = false, message = "Malformed Additionaldetails JSON." });
            }

            if (additionalDetails.TryGetValue("TableSettings", out JToken? tableSettingsToken) &&
                tableSettingsToken is JObject tableSettings &&
                tableSettings.TryGetValue(storageKey, out JToken? value))
            {
                return Json(new { status = true, TableSettings = value });
            }

            return Json(new { status = false, message = "Table setting not found." });
        }

        public OfficerDetailsModal? GetOfficerDetails()
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

            if (string.IsNullOrEmpty(userId))
            {
                _logger.LogWarning(
                    "GetOfficerDetails: Userid is null. User is not authenticated or NameIdentifier claim is missing."
                );
                return null;
            }

            if (!int.TryParse(userId, out int parsedUserId))
            {
                _logger.LogWarning(
                    "GetOfficerDetails: Failed to parse Userid as integer. Value: {Userid}",
                    userId
                );
                return null;
            }

            // ✅ CORRECT: parameterized SQL call
            var result = dbcontext.Database
                .SqlQueryRaw<OfficerDetailsModal>(
                    "SELECT * FROM get_officer_details(@userId)",
                    new NpgsqlParameter("@userId", parsedUserId)
                )
                .AsEnumerable()
                .FirstOrDefault();

            _logger.LogInformation(
                "------- Officer Details Retrieved: {@OfficerDetails} --------",
                result
            );

            return result;
        }


        public string GetFieldValue(string fieldName, dynamic data)
        {
            foreach (var section in data)
            {
                if (section.First is JArray fields)
                {
                    foreach (var field in fields)
                    {
                        if (field["name"] != null && field["name"]?.ToString() == fieldName)
                        {
                            return field["value"]?.ToString() ?? "";
                        }
                    }
                }
            }
            return "";
        }

        [HttpGet]
        public IActionResult GetDepartments()
        {
            var departments = dbcontext.Departments.ToList();
            return Json(new { status = true, departments });
        }

        [HttpGet]
        public IActionResult GetDesignations(string departmentId)
        {
            _logger.LogInformation($"------- Department ID: {departmentId} --------");
            var designations = dbcontext.Officersdesignations.Where(des => des.Departmentid == Convert.ToInt32(departmentId)).ToList();
            return Json(new { status = true, designations });
        }

        [HttpGet]
        public IActionResult GetServices()
        {
            var officer = GetOfficerDetails();

            if (officer == null)
            {
                _logger.LogWarning("GetServices: Officer details not found.");
                return Json(new { status = false, message = "Officer details not found." });
            }

            _logger.LogInformation(
                "------- Officer Details: {@Officer} --------",
                officer
            );

            // ✅ Admin-like users → all services
            if (officer.Role == "Designer"
                || officer.UserType == "Admin"
                || officer.UserType == "Viewer")
            {
                var services = dbcontext.Services.ToList();
                var service = services.Select(s => new
                {
                    serviceId = s.Serviceid,
                    serviceName = s.Servicename,
                    nameShort = s.Nameshort,
                    departmentId = s.Departmentid,
                    formElement = s.Formelement
                }).ToArray();
                return Json(new { status = true, services = service });
            }

            // ✅ CORRECT: parameterized PostgreSQL function call
            var result = dbcontext.Database
                .SqlQueryRaw<OfficerServiceListModal>(
                    "SELECT * FROM get_services_by_role(@role)",
                    new Npgsql.NpgsqlParameter("@role", officer.Role!)
                )
                .AsEnumerable()
                .ToList();

            var Services = result.Select(s => new
            {
                s.ServiceId,
                s.ServiceName,
            }).ToArray();


            return Json(new { status = true, Services });
        }


        [HttpGet]
        public IActionResult GetAccessAreas()
        {
            var officer = GetOfficerDetails();
            if (officer == null)
            {
                var District = dbcontext.District.ToList();
                return Json(new { status = true, districts = District });
            }

            if (officer!.AccessLevel == "Tehsil")
            {
                var tehsils = dbcontext.Tswotehsil.Where(t => t.Tehsilid == officer.AccessCode).ToList();
                return Json(new { status = true, tehsils });
            }

            var districts = dbcontext.District.Where(d =>
                (officer.AccessLevel == "State") ||
                (officer!.AccessLevel == "Division" && d.Division == officer.AccessCode) ||
                (officer.AccessLevel == "District" && d.Districtid == officer.AccessCode))
                .ToList();

            return Json(new { status = true, districts });
        }

        [HttpGet]
        public IActionResult GetDistricts(string? division = null)
        {
            List<District> districts;
            if (division != null)
            {
                districts = dbcontext.District.Where(d => d.Division == Convert.ToInt32(division)).ToList();
                return Json(new { status = true, districts });
            }
            districts = dbcontext.District.ToList();
            return Json(new { status = true, districts });
        }

        [HttpGet]
        public IActionResult GetTeshilForDistrict(string districtId)
        {
            int Districtid = Convert.ToInt32(districtId);
            var tehsils = dbcontext.Tswotehsil.Where(u => u.Districtid == Districtid).ToList();
            return Json(new { status = true, tehsils });
        }

        [HttpGet]
        public IActionResult GetIFSCCode(string bankName, string branchName)
        {
            // Validate input parameters
            if (string.IsNullOrWhiteSpace(bankName) || string.IsNullOrWhiteSpace(branchName))
            {
                return BadRequest(new { status = false, message = "BankName and BranchName are required." });
            }

            try
            {
                if (bankName == "JK GRAMEEN BANK")
                {
                    return Ok(new { status = true, ifscCode = "JAKA0GRAMEN" });
                }

                string cleanedBankName = bankName;
                if (cleanedBankName.StartsWith("THE ", StringComparison.OrdinalIgnoreCase))
                {
                    cleanedBankName = cleanedBankName.Substring(4).TrimStart();
                }

                // Call PostgreSQL function
                var result = dbcontext.Database
                    .SqlQueryRaw<string>($"SELECT * FROM get_ifsc_code({0}, {1})", cleanedBankName, branchName)
                    .AsNoTracking()
                    .AsEnumerable()
                    .FirstOrDefault();

                if (!string.IsNullOrEmpty(result))
                {
                    return Ok(new { status = true, ifscCode = result });
                }
                else
                {
                    return NotFound(new { status = false, message = "No IFSC code found for the provided bank and branch." });
                }
            }
            catch (Exception ex)
            {
                // Log the exception (use a logging framework like Serilog in production)
                return StatusCode(500, new { status = false, message = "An error occurred while fetching the IFSC code.", error = ex.Message });
            }
        }

        [HttpGet]
        public IActionResult GetOfficesType()
        {
            var officesType = dbcontext.Offices.ToList();
            return Json(new { officesType });
        }

        [HttpGet]
        public IActionResult GetAreaList(
     string table,
     int parentId,
     int? officeTypeId = null,
     bool isOfficeField = false)
        {
            table = table?.ToLowerInvariant() ?? "";

            object? data = null;

            switch (table)
            {
                // --------------------------------------------------------------------------------
                case "officedetails":
                    var odQuery = dbcontext.Officesdetails.AsQueryable();
                    if (officeTypeId.HasValue)
                        odQuery = odQuery.Where(od => od.Officeid == officeTypeId.Value);
                    if (parentId > 0)
                        odQuery = odQuery.Where(od => od.Parentofficedetailid == parentId);

                    data = odQuery
                        .OrderBy(od => od.Officename)
                        .Select(od => new { value = od.Areacode, label = od.Officename })
                        .ToList();
                    break;

                // --------------------------------------------------------------------------------
                case "district":
                    if (isOfficeField && officeTypeId.HasValue)
                    {
                        data = dbcontext.Officesdetails
                            .Where(od => od.Officeid == officeTypeId.Value)
                            .Select(od => new { value = od.Districtcode, label = od.Officename })
                            .Distinct()
                            .OrderBy(x => x.label)
                            .ToList();
                    }
                    else
                    {
                        var distQuery = dbcontext.District.AsQueryable();
                        if (parentId > 0)
                            distQuery = distQuery.Where(d => d.Division == parentId);
                        data = distQuery
                            .OrderBy(d => d.Districtname)
                            .Select(d => new { value = d.Districtid, label = d.Districtname })
                            .ToList();
                    }
                    break;

                // --------------------------------------------------------------------------------
                // Tehsil – now perfectly mirrors the old "TehsilAll" logic
                // --------------------------------------------------------------------------------
                case "tehsil":   // (formerly "TehsilAll")
                    if (isOfficeField && officeTypeId.HasValue)
                    {
                        data = dbcontext.Officesdetails
                            .Where(od => od.Officeid == officeTypeId.Value)
                            .Select(od => new { value = od.Officedetailid, label = od.Areaname })
                            .Distinct()
                            .OrderBy(x => x.label)
                            .ToList();
                    }
                    else
                    {
                        data = dbcontext.Tehsil
                            .Where(t => t.Districtid == parentId)
                            .OrderBy(t => t.Tehsilname)
                            .Select(t => new { value = t.Tehsilid, label = t.Tehsilname })
                            .ToList();
                    }
                    break;

                // If you still need "TehsilAll" for backward compatibility, keep it as an alias:
                case "tehsilall":
                    goto case "tehsil";   // reuse exactly the same logic

                // --------------------------------------------------------------------------------
                case "blocks":
                    if (isOfficeField && officeTypeId.HasValue)
                    {
                        data = dbcontext.Officesdetails
                            .Where(od => od.Officeid == officeTypeId.Value)
                            .Select(od => new { value = od.Officedetailid, label = od.Areaname })
                            .Distinct()
                            .OrderBy(x => x.label)
                            .ToList();
                    }
                    else
                    {
                        data = dbcontext.Blocks
                            .Where(b => b.Districtid == parentId)
                            .OrderBy(b => b.Blockname)
                            .Select(b => new { value = b.Blockid, label = b.Blockname })
                            .ToList();
                    }
                    break;

                // --------------------------------------------------------------------------------
                case "muncipalities":
                    data = dbcontext.Muncipalities
                        .Where(m => m.Districtid == parentId)
                        .OrderBy(m => m.Muncipalityname)
                        .Select(m => new { value = m.Muncipalityid, label = m.Muncipalityname })
                        .ToList();
                    break;

                case "wards":
                    data = dbcontext.Wards
                        .Where(w => w.Muncipalityid == parentId)
                        .OrderBy(w => w.Wardcode)
                        .Select(w => new { value = w.Wardcode, label = "Ward No " + w.Wardno })
                        .ToList();
                    break;

                case "halqapanchayat":
                    data = dbcontext.Halqapanchayat
                        .Where(h => h.Blockid == parentId)
                        .OrderBy(h => h.Halqapanchayatname)
                        .Select(h => new { value = h.Halqapanchayatid, label = h.Halqapanchayatname })
                        .ToList();
                    break;

                case "villages":
                    data = dbcontext.Villages
                        .Where(v => v.Halqapanchayatid == parentId)
                        .OrderBy(v => v.Villagename)
                        .Select(v => new { value = v.Villageid, label = v.Villagename })
                        .ToList();
                    break;

                default:
                    return BadRequest(new { error = "Invalid table name." });
            }

            return Json(new { data });
        }
        private static byte[] GenerateExcel(List<Dictionary<string, object>> data, List<Dictionary<string, string>> columns)
        {
            using (var workbook = new XLWorkbook())
            {
                var worksheet = workbook.Worksheets.Add("Report");

                // Add headers
                for (int i = 0; i < columns.Count; i++)
                {
                    string headerValue = "";
                    if (columns[i].ContainsKey("header") && !string.IsNullOrEmpty(columns[i]["header"]))
                        headerValue = columns[i]["header"];
                    else if (columns[i].ContainsKey("accessorKey"))
                        headerValue = columns[i]["accessorKey"];

                    worksheet.Cell(1, i + 1).Value = headerValue;
                    worksheet.Cell(1, i + 1).Style.Font.Bold = true;
                }

                // Add data
                for (int rowIndex = 0; rowIndex < data.Count; rowIndex++)
                {
                    var rowData = data[rowIndex];
                    for (int colIndex = 0; colIndex < columns.Count; colIndex++)
                    {
                        var key = columns[colIndex]["accessorKey"];
                        var value = rowData.GetValueOrDefault(key);

                        // Handle different data types
                        if (value != null)
                        {
                            if (value is DateTime dateTime)
                                worksheet.Cell(rowIndex + 2, colIndex + 1).Value = dateTime;
                            else if (value is int intValue)
                                worksheet.Cell(rowIndex + 2, colIndex + 1).Value = intValue;
                            else if (value is decimal decimalValue)
                                worksheet.Cell(rowIndex + 2, colIndex + 1).Value = decimalValue;
                            else if (value is double doubleValue)
                                worksheet.Cell(rowIndex + 2, colIndex + 1).Value = doubleValue;
                            else
                                worksheet.Cell(rowIndex + 2, colIndex + 1).Value = value.ToString();
                        }
                        else
                        {
                            worksheet.Cell(rowIndex + 2, colIndex + 1).Value = "";
                        }
                    }
                }

                // Add footer
                int footerRow = data.Count + 3;
                worksheet.Cell(footerRow, 1).Value = $"Report generated on: {DateTime.Now:dd MMMM yyyy, HH:mm:ss}";
                worksheet.Cell(footerRow, 1).Style.Font.Italic = true;
                worksheet.Range(footerRow, 1, footerRow, columns.Count).Merge();

                // Auto-adjust column widths
                worksheet.Columns().AdjustToContents();

                using var stream = new MemoryStream();
                workbook.SaveAs(stream);
                return stream.ToArray();
            }
        }

        private static byte[] GenerateCsv(List<Dictionary<string, object>> data, List<Dictionary<string, string>> columns)
        {
            using (var stream = new MemoryStream())
            using (var writer = new StreamWriter(stream, Encoding.UTF8))
            using (var csv = new CsvWriter(writer, CultureInfo.InvariantCulture))
            {
                // Write headers
                foreach (var column in columns)
                {
                    string headerValue = "";
                    if (column.ContainsKey("header") && !string.IsNullOrEmpty(column["header"]))
                        headerValue = column["header"];
                    else if (column.ContainsKey("accessorKey"))
                        headerValue = column["accessorKey"];

                    csv.WriteField(headerValue);
                }
                csv.NextRecord();

                // Write data
                foreach (var row in data)
                {
                    foreach (var column in columns)
                    {
                        var key = column["accessorKey"];
                        var value = row.GetValueOrDefault(key);

                        if (value != null)
                        {
                            if (value is DateTime dateTime)
                                csv.WriteField(dateTime.ToString("dd MMM yyyy HH:mm:ss"));
                            else
                                csv.WriteField(value.ToString());
                        }
                        else
                        {
                            csv.WriteField("");
                        }
                    }
                    csv.NextRecord();
                }

                // Write footer
                csv.WriteField($"Report generated on: {DateTime.Now:dd MMMM yyyy, HH:mm:ss}");
                csv.NextRecord();

                writer.Flush();
                return stream.ToArray();
            }
        }




        private static PageSize GetOptimalPageSize(int columnCount, out float fontSize, out float margin)
        {
            // Define thresholds for different paper sizes with appropriate font sizes
            if (columnCount <= 10)
            {
                fontSize = 9;
                margin = 10;
                return PageSize.A4.Rotate();
            }
            else if (columnCount <= 15)
            {
                fontSize = 8;
                margin = 8;
                return PageSize.A4.Rotate();
            }
            else if (columnCount <= 20)
            {
                fontSize = 7;
                margin = 6;
                return PageSize.A3.Rotate(); // A3 is 2x A4 width (11.7 x 16.5 inches)
            }
            else if (columnCount <= 25)
            {
                fontSize = 6;
                margin = 5;
                return PageSize.A2.Rotate(); // A2 is even larger (16.5 x 23.4 inches)
            }
            else if (columnCount <= 35)
            {
                fontSize = 5;
                margin = 4;
                return PageSize.A1.Rotate(); // A1 is very large (23.4 x 33.1 inches)
            }
            else
            {
                fontSize = 4;
                margin = 3;
                return PageSize.A0.Rotate(); // A0 is massive (33.1 x 46.8 inches) - use with caution
            }
        }

        private static List<string> SplitTextIntoLines(string text, int maxCharsPerLine)
        {
            var lines = new List<string>();

            if (text.Length <= maxCharsPerLine)
            {
                lines.Add(text);
                return lines;
            }

            // Try to split by spaces first
            var words = text.Split(' ');
            var currentLine = new StringBuilder();

            foreach (var word in words)
            {
                if (currentLine.Length + word.Length + 1 <= maxCharsPerLine)
                {
                    if (currentLine.Length > 0)
                        currentLine.Append(" ");
                    currentLine.Append(word);
                }
                else
                {
                    if (currentLine.Length > 0)
                    {
                        lines.Add(currentLine.ToString());
                        currentLine.Clear();
                    }

                    // If a single word is longer than maxCharsPerLine, force split it
                    if (word.Length > maxCharsPerLine)
                    {
                        for (int i = 0; i < word.Length; i += maxCharsPerLine)
                        {
                            int length = Math.Min(maxCharsPerLine, word.Length - i);
                            lines.Add(word.Substring(i, length));
                        }
                    }
                    else
                    {
                        currentLine.Append(word);
                    }
                }
            }

            if (currentLine.Length > 0)
                lines.Add(currentLine.ToString());

            return lines;
        }

        private static byte[] GeneratePdf(List<Dictionary<string, object>> data, List<Dictionary<string, string>> columns)
        {
            using (var stream = new MemoryStream())
            {
                var writer = new PdfWriter(stream);
                var pdf = new PdfDocument(writer);

                // Get optimal page size based on column count
                float fontSize;
                float margin;
                var pageSize = GetOptimalPageSize(columns.Count, out fontSize, out margin);

                pdf.SetDefaultPageSize(pageSize);
                var document = new Document(pdf);
                document.SetMargins(margin, margin, margin, margin);

                // Create table with flexible column widths
                var table = new Table(columns.Count);
                table.SetWidth(UnitValue.CreatePercentValue(100));

                // Calculate available width per column for text wrapping decisions
                float pageWidth = pageSize.GetWidth();
                float marginWidth = margin * 2;
                float availableWidth = pageWidth - marginWidth;
                float baseColumnWidth = availableWidth / columns.Count;

                // Get fonts - using standard fonts without FontConstants
                PdfFont normalFont = PdfFontFactory.CreateFont(StandardFonts.HELVETICA);
                PdfFont boldFont = PdfFontFactory.CreateFont(StandardFonts.HELVETICA_BOLD);

                // Add headers with optimized text handling
                foreach (var column in columns)
                {
                    string headerValue = column.ContainsKey("header") && !string.IsNullOrEmpty(column["header"])
                        ? column["header"]
                        : column["accessorKey"];

                    // Calculate if header needs to be truncated or wrapped
                    float maxCharsPerLine = (float)(baseColumnWidth / (fontSize * 0.5));
                    var headerCell = new Cell();

                    if (headerValue.Length > maxCharsPerLine && maxCharsPerLine > 10)
                    {
                        // Truncate very long headers
                        string truncatedHeader = headerValue.Substring(0, (int)maxCharsPerLine - 3) + "...";
                        headerCell.Add(new Paragraph(truncatedHeader)
                            .SetFont(boldFont)
                            .SetFontSize(fontSize));
                    }
                    else
                    {
                        headerCell.Add(new Paragraph(headerValue)
                            .SetFont(boldFont)
                            .SetFontSize(fontSize));
                    }

                    headerCell.SetBackgroundColor(ColorConstants.LIGHT_GRAY)
                        .SetBold()
                        .SetTextAlignment(TextAlignment.CENTER)
                        .SetPadding(3);

                    table.AddHeaderCell(headerCell);
                }

                // Add data rows with optimized text handling
                int rowCount = 0;
                int totalRows = data.Count;

                foreach (var row in data)
                {
                    foreach (var column in columns)
                    {
                        var key = column["accessorKey"];
                        var value = row.ContainsKey(key) ? row[key] : null;
                        string cellValue = value?.ToString() ?? "";

                        if (value is DateTime dt)
                            cellValue = dt.ToString("dd MMM yyyy");
                        else if (value is decimal dec)
                            cellValue = dec.ToString("N2");
                        else if (value is double dbl)
                            cellValue = dbl.ToString("N2");
                        else if (value is int intVal)
                            cellValue = intVal.ToString("N0");

                        // Calculate if value needs to be truncated
                        float maxCharsPerLine = (float)(baseColumnWidth / (fontSize * 0.6));
                        var cell = new Cell();

                        if (cellValue.Length > maxCharsPerLine && maxCharsPerLine > 15)
                        {
                            // Truncate very long values
                            string truncatedValue = cellValue.Substring(0, (int)maxCharsPerLine - 3) + "...";
                            cell.Add(new Paragraph(truncatedValue)
                                .SetFont(normalFont)
                                .SetFontSize(fontSize));
                        }
                        else
                        {
                            cell.Add(new Paragraph(cellValue)
                                .SetFont(normalFont)
                                .SetFontSize(fontSize));
                        }

                        cell.SetPadding(2);
                        table.AddCell(cell);
                    }

                    rowCount++;

                    // Calculate rows per page based on font size and paper size
                    float pageHeight = pageSize.GetHeight();
                    float usableHeight = pageHeight - (margin * 2);
                    float rowHeightEstimate = (float)(fontSize * 1.5); // Approximate row height in points
                    int rowsPerPage = Math.Max(15, (int)(usableHeight / rowHeightEstimate) - 5); // Subtract 5 for header and footer

                    // Add new page when reaching row limit
                    if (rowCount % rowsPerPage == 0 && rowCount < totalRows)
                    {
                        document.Add(table);
                        table = new Table(columns.Count);
                        table.SetWidth(UnitValue.CreatePercentValue(100));

                        // Re-add headers on new page with same styling
                        foreach (var column in columns)
                        {
                            string headerValue = column.ContainsKey("header") && !string.IsNullOrEmpty(column["header"])
                                ? column["header"]
                                : column["accessorKey"];

                            float maxCharsPerLine = (float)(baseColumnWidth / (fontSize * 0.5));
                            var headerCell = new Cell();

                            if (headerValue.Length > maxCharsPerLine && maxCharsPerLine > 10)
                            {
                                string truncatedHeader = headerValue.Substring(0, (int)maxCharsPerLine - 3) + "...";
                                headerCell.Add(new Paragraph(truncatedHeader)
                                    .SetFont(boldFont)
                                    .SetFontSize(fontSize));
                            }
                            else
                            {
                                headerCell.Add(new Paragraph(headerValue)
                                    .SetFont(boldFont)
                                    .SetFontSize(fontSize));
                            }

                            headerCell.SetBackgroundColor(ColorConstants.LIGHT_GRAY)
                                .SetBold()
                                .SetTextAlignment(TextAlignment.CENTER)
                                .SetPadding(3);

                            table.AddHeaderCell(headerCell);
                        }
                    }
                }

                // Add footer with page numbers
                int totalPages = pdf.GetNumberOfPages();
                var footerCell = new Cell(1, columns.Count)
                    .Add(new Paragraph($"Report generated on: {DateTime.Now:dd MMMM yyyy, HH:mm:ss} | Page {totalPages} of {totalPages}")
                        .SetFont(normalFont)
                        .SetFontColor(ColorConstants.GRAY)
                        .SetItalic()
                        .SetFontSize(7))
                    .SetTextAlignment(TextAlignment.CENTER)
                    .SetPadding(2);
                table.AddFooterCell(footerCell);

                document.Add(table);
                document.Close();

                return stream.ToArray();
            }
        }
        [HttpGet]
        public async Task<IActionResult> GetBanks()
        {
            try
            {
                var banks = await dbcontext.Bank
                    .ToListAsync();
                return Ok(new { status = true, data = banks });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { status = false, message = ex.Message });
            }
        }

        [HttpGet]
        public IActionResult GetBankCode(string bankId)
        {
            try
            {
                int BankId = Convert.ToInt32(bankId);
                var bank = dbcontext.Bank
                    .FirstOrDefault(b => b.Id == BankId);

                if (bank != null)
                {
                    return Ok(new { status = true, bankCode = bank.Bankcode });
                }
                else
                {
                    return NotFound(new { status = false, message = "Bank not found." });
                }
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { status = false, message = ex.Message });
            }
        }

        [HttpGet]
        public IActionResult GetBankDetails(string IfscCode, int BankId)
        {
            try
            {
                string bankName = dbcontext.Bank
                 .FirstOrDefault(b => b.Id == BankId)?.Bankname ?? string.Empty;

                var pattern = $"%{bankName}%";

                // PostgreSQL query using LIKE for pattern matching
                var bankDetails = dbcontext.Bankdetails
                    .FromSqlRaw(@"
                    SELECT *
                    FROM bankdetails
                    WHERE ifsc = {0}
                    AND bank ILIKE {1}
                    LIMIT 1", IfscCode, pattern)
                    .FirstOrDefault();

                if (bankDetails != null)
                {
                    return Ok(new { status = true, bankDetails });
                }
                else
                {
                    return NotFound(new { status = false, message = "Bank details not found." });
                }
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { status = false, message = ex.Message });
            }
        }

        [HttpGet]
        [HttpGet]
        public IActionResult RedirectToCitizen(string username, bool isCitizen)
        {
            var clientToken = Request.Cookies["ClientToken"];
            var localUser = dbcontext.Users.FirstOrDefault(u => u.Username == username);
            var frontendUrl = _config["AppSettings:FrontendUrl"] ?? "http://localhost:3000";

            localUser!.Usertype = isCitizen ? "Officer" : "Citizen";

            // Generate sessionId and pass to GenerateJwt
            var sessionId = Guid.NewGuid();
            var jwt = helper.GenerateJwt(localUser!, clientToken!, sessionId);

            // Create session in database
            var newSession = new Usersessions
            {
                Sessionid = sessionId,
                Userid = localUser.Userid,
                Jwttoken = jwt,
                Logintime = DateTime.Now,
                Lastactivitytime = DateTime.Now
            };

            _sessionRepo.AddSessionAsync(newSession).Wait(); // or make method async

            dynamic ssoResponse = new ExpandoObject();
            ssoResponse.status = true;
            ssoResponse.token = jwt;
            ssoResponse.userType = localUser?.Usertype;
            ssoResponse.username = localUser?.Username;
            ssoResponse.userId = localUser?.Userid;
            ssoResponse.designation = "";
            ssoResponse.department = helper.GetDepartment(localUser!);
            ssoResponse.profile = localUser?.Profile ?? "/assets/images/profile.jpg";
            ssoResponse.email = localUser?.Email;

            var encoded = JsonConvert.SerializeObject(ssoResponse);

            _logger.LogInformation("REDIRECTING TO FRONTEND: {Url}", $"{frontendUrl}?sso={encoded}");
            return Json(new { url = $"{frontendUrl}/verification?sso={encoded}" });
        }
    }
}