using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using System.IO;
using iText.Kernel.Geom;
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
using iText.IO.Image;
using iText.Kernel.Colors;
using iText.Layout.Borders;
using iText.Kernel.Pdf.Canvas;
using System.Data;
using System.Dynamic;
using Microsoft.Extensions.Caching.Memory;
using NpgsqlTypes;
using System.Security.Claims;

namespace SahayataNidhi.Controllers.Officer
{
    public partial class OfficerController : Controller
    {
        public class LegacyStatusCounts
        {
            public int TotalApplications { get; set; }
            public int PendingCount { get; set; }
            public int ForwardedCount { get; set; }
            public int SanctionedCount { get; set; }
            public int RejectCount { get; set; }
        }

        public class TemporaryDisability
        {
            public int TemporaryDisabilityExpiringSoonCount { get; set; }
            public int TotalPhysicallyChallengedApplications { get; set; }
        }

        [HttpGet]
        public IActionResult GetLegacyCount(int Serviceid)
        {
            // Validate officer authentication
            var officer = GetOfficerDetails();
            if (officer == null)
                return Unauthorized("Officer authentication failed.");

            // Validate service
            var service = dbcontext.Services.FirstOrDefault(s => s.Serviceid == Serviceid);
            if (service == null)
                return NotFound("Service not found.");

            // Parse workflow
            if (string.IsNullOrEmpty(service.Officereditablefield))
                return Json(new { countList = new List<object>(), canSanction = false });

            // Prepare PostgreSQL parameters (order must match function signature)
            var parameters = new[]
            {
                new NpgsqlParameter("@accesslevel", officer.AccessLevel),
                new NpgsqlParameter("@accesscode", officer.AccessCode ?? (object)DBNull.Value),
                new NpgsqlParameter("@serviceid", Serviceid),
                new NpgsqlParameter("@divisioncode", officer.AccessLevel == "Division" ? officer.AccessCode : (object)DBNull.Value)
            };

            // Execute PostgreSQL function – ensure your LegacyStatusCounts class has the correct properties
            var counts = dbcontext.Database
                .SqlQueryRaw<LegacyStatusCounts>(
                    "SELECT * FROM get_legacy_status_count(@accesslevel, @accesscode, @serviceid, @divisioncode)",
                    parameters
                )
                .AsEnumerable()
                .FirstOrDefault() ?? new LegacyStatusCounts();

            // Build count list for the dashboard
            var countList = new List<object>
            {
                new
                {
                    label = "Total Applications",
                    count = counts.TotalApplications,
                    bgColor = "#6A1B9A",
                    textColor = "#FFFFFF",
                    tableTitle = "Total Legacy Applications",
                },
                new
                {
                    label = "Pending",
                    count = counts.PendingCount,
                    bgColor = "#FF9800",
                    textColor = "#FFFFFF",
                    tableTitle = "Pending Legacy Applications",
                },
                new
                {
                    label = "Forwarded",
                    count = counts.ForwardedCount,
                    bgColor = "#2196F3",
                    textColor = "#FFFFFF",
                    tableTitle = "Forwarded Legacy Applications",
                },
                new
                {
                    label = "Sanctioned",
                    count = counts.SanctionedCount,
                    bgColor = "#4CAF50",
                    textColor = "#FFFFFF",
                    tableTitle = "Sanctioned Legacy Applications",
                },
                new
                {
                    label = "Rejected",
                    count = counts.RejectCount,
                    bgColor = "#F44336",
                    textColor = "#FFFFFF",
                    tableTitle = "Rejected Legacy Applications",
                }
            };

            return Json(new { countList });
        }

        [HttpGet]
        public IActionResult GetApplicationsCount(int Serviceid)
        {
            // Validate officer authentication
            var officer = GetOfficerDetails();
            if (officer == null)
                return Unauthorized("Officer authentication failed.");

            // Validate service
            var service = dbcontext.Services.FirstOrDefault(s => s.Serviceid == Serviceid);
            if (service == null)
                return NotFound("Service not found.");

            // NO CACHING AT ALL — fresh data every request
            try
            {
                if (string.IsNullOrEmpty(service.Officereditablefield))
                    return Json(new
                    {
                        countList = new List<object>(),
                        corrigendumList = new List<object>(),
                        correctionList = new List<object>(),
                        withheldCountList = new List<object>(),
                        citizenPendingList = new List<object>(),
                        canSanction = false
                    });

                var workflow = JsonConvert.DeserializeObject<List<dynamic>>(service.Officereditablefield) ?? new List<dynamic>();
                if (workflow.Count == 0)
                    return Json(new
                    {
                        countList = new List<object>(),
                        corrigendumList = new List<object>(),
                        correctionList = new List<object>(),
                        withheldCountList = new List<object>(),
                        citizenPendingList = new List<object>(),
                        canSanction = false
                    });

                dynamic authority = workflow.FirstOrDefault(p => p.designation == officer.Role)!;
                if (authority == null)
                    return Json(new
                    {
                        countList = new List<object>(),
                        corrigendumList = new List<object>(),
                        correctionList = new List<object>(),
                        withheldCountList = new List<object>(),
                        citizenPendingList = new List<object>(),
                        canSanction = false
                    });

                var officerAuthorities = new
                {
                    CanSanction = (bool?)authority.canSanction ?? false,
                    CanHavePool = (bool?)authority.canHavePool ?? false,
                    CanForwardToPlayer = (bool?)authority.canForwardToPlayer ?? false,
                    CanReturnToPlayer = (bool?)authority.canReturnToPlayer ?? false,
                    CanCorrigendum = (bool?)authority.canCorrigendum ?? false,
                    CanReturnToCitizen = (bool?)authority.canReturnToCitizen ?? false,
                    CanManageBankFiles = (bool?)authority.canManageBankFiles ?? false,
                    CanWithhold = (bool?)authority.canWithhold ?? false,
                    CanDirectWithheld = (bool?)authority.canDirectWithheld ?? false,
                    CanValidateAadhaar = (bool?)authority.canValidateAadhaar ?? false
                };

                // Prepare PostgreSQL parameters – now including the sixth parameter @datatype
                var parameters = new[]
                {
            new NpgsqlParameter("@accesslevel", officer.AccessLevel),
            new NpgsqlParameter("@accesscode", officer.AccessCode ?? (object)DBNull.Value),
            new NpgsqlParameter("@serviceid", Serviceid),
            new NpgsqlParameter("@takenby", officer.Role),
            new NpgsqlParameter("@divisioncode", officer.AccessLevel == "Division" ? officer.AccessCode : DBNull.Value),
            // ✅ NEW: Sixth parameter – always DBNull.Value for dashboard counts (no datatype filter)
            new NpgsqlParameter("@datatype", DBNull.Value)
        };

                // Fresh data every time — .AsEnumerable() is REQUIRED
                var counts = dbcontext.Database
                    .SqlQueryRaw<StatusCounts>("SELECT * FROM get_status_count(@accesslevel, @accesscode, @serviceid, @takenby, @divisioncode, @datatype)", parameters)
                    .AsEnumerable()
                    .FirstOrDefault() ?? new StatusCounts();

                var shiftedCount = dbcontext.Database
                    .SqlQueryRaw<ShiftedCountModal>("SELECT * FROM get_shifted_count(@accesslevel, @accesscode, @serviceid, @takenby, @divisioncode)", parameters.Take(5).ToArray()) // only first 5
                    .AsEnumerable()
                    .FirstOrDefault() ?? new ShiftedCountModal();

                var temporaryCount = dbcontext.Database
                    .SqlQueryRaw<TemporaryDisability>("SELECT * FROM get_temporary_disability_count(@accesslevel, @accesscode, @serviceid, @takenby, @divisioncode)", parameters.Take(5).ToArray())
                    .AsEnumerable()
                    .FirstOrDefault() ?? new TemporaryDisability();

                // Build your lists
                var countList = BuildMainApplicationCounts(counts, officerAuthorities);
                var corrigendumList = BuildCorrigendumCounts(counts, officerAuthorities);
                var correctionList = BuildCorrectionCounts(counts, officerAuthorities);

                var citizenPendingList = new List<object>();
                if (!officerAuthorities.CanReturnToCitizen)
                {
                    citizenPendingList.Add(new
                    {
                        label = "Pending With Citizen",
                        count = counts.ReturnToEditCount,
                        bgColor = "#CE93D8",
                        textColor = "#4A148C",
                        tooltipText = "Application is pending at Citizen level for correction.",
                        tableTitle = "Pending With Citizen Applications"
                    });
                }

                if (shiftedCount.ShiftedCount > 0)
                {
                    countList.Add(new
                    {
                        label = "Shifted To Another Location",
                        count = shiftedCount.ShiftedCount,
                        tableTitle = "Shifted Applications",
                        bgColor = "#ABCDEF",
                        textColor = "#123456"
                    });
                }

                var withheldCountList = new List<object>
        {
            new {
                label = "Total Withheld Applications",
                count = counts.TotalWithheldCount,
                tooltipText = "Total Withheld Applications",
                tableTitle = "Total Withheld Applications",
                bgColor = "#FFCC00",
                textColor = "#000000"
            },
            new {
                label = "Withheld Pending",
                count = counts.WithheldPendingCount,
                tooltipText = "Withheld Applications with Pending Status",
                tableTitle = "Withheld Pending Applications",
                bgColor = "#FFCC00",
                textColor = "#000000"
            },
            new {
                label = "Withheld Forwarded",
                count = counts.WithheldForwardedCount,
                tooltipText = "Withheld Applications with Forwarded Status",
                tableTitle = "Withheld Forwarded Applications",
                bgColor = "#FFCC00",
                textColor = "#000000"
            },
            new {
                label = "Withheld Approved",
                count = counts.WithheldApprovedCount,
                tooltipText = "Withheld Applications with Approved Status",
                tableTitle = "Withheld Approved Applications",
                bgColor = "#FFCC00",
                textColor = "#000000"
            }
        };

                var temporaryCountList = Serviceid == 1 ? new List<object>
        {
            new {
                label = "PCP Applications",
                count = temporaryCount.TotalPhysicallyChallengedApplications,
                tooltipText = "Physically Challenged Applicants",
                tableTitle = "Total PCP Applications",
                bgColor = "#ABCDEF",
                textColor = "#123456"
            },
            new {
                label = "PCP-UDID Expires in 3 Months",
                count = temporaryCount.TemporaryDisabilityExpiringSoonCount,
                tooltipText = "Physically Challenged Applicants with Temporary Disability, UDID Card Expiring Soon",
                tableTitle = "Expiring Eligibility Applications",
                bgColor = "#ABCDEF",
                textColor = "#123456"
            }
        } : new List<object>();

                // Build result object
                var result = new ExpandoObject();
                var dict = (IDictionary<string, object>)result!;

                dict["countList"] = countList;
                dict["corrigendumList"] = corrigendumList;
                dict["correctionList"] = correctionList;
                dict["withheldCountList"] = withheldCountList;
                dict["citizenPendingList"] = citizenPendingList;
                dict["canSanction"] = officerAuthorities.CanSanction;
                dict["canHavePool"] = officerAuthorities.CanHavePool;
                dict["canCorrigendum"] = officerAuthorities.CanCorrigendum;
                dict["officerAuthorities"] = officerAuthorities;

                if (Serviceid == 1)
                    dict["temporaryCountList"] = temporaryCountList;

                return Json(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in GetApplicationsCount for Serviceid: {Serviceid}", Serviceid);

                return Json(new
                {
                    countList = new List<object>(),
                    corrigendumList = new List<object>(),
                    correctionList = new List<object>(),
                    withheldCountList = new List<object>(),
                    citizenPendingList = new List<object>(),
                    canSanction = false,
                    error = $"Failed to load dashboard counts: {ex.Message}"
                });
            }
        }
        private DateTime? SafeParseDate(string? dateString)
        {
            if (string.IsNullOrWhiteSpace(dateString))
                return null;

            dateString = dateString.Trim();

            // List of formats to try
            var formats = new[]
            {
                "dd MMM yyyy hh:mm:ss tt",     // 18 Dec 2025 02:13:25 PM
                "dd-MM-yyyy HH:mm:ss",         // 01-01-2025 14:13:25
                "dd-MM-yyyy hh:mm:ss tt",      // 01-01-2025 02:13:25 PM
                "dd/MM/yyyy HH:mm:ss",         // 01/01/2025 14:13:25
                "yyyy-MM-dd HH:mm:ss",         // 2025-01-01 14:13:25
                "dd MMM yyyy HH:mm:ss",        // 18 Dec 2025 14:13:25
            };

            if (DateTime.TryParseExact(
                    dateString,
                    formats,
                    CultureInfo.InvariantCulture,
                    DateTimeStyles.None,
                    out DateTime parsed))
            {
                return parsed;
            }

            // Fallback: let .NET try its best
            if (DateTime.TryParse(dateString, CultureInfo.InvariantCulture, DateTimeStyles.None, out parsed))
            {
                return parsed;
            }

            return null;
        }

        [HttpGet]
        public async Task<IActionResult> DownloadSanctionLetter(string fileName)
        {
            var userId = Convert.ToInt32(User.FindFirst(ClaimTypes.NameIdentifier)?.Value);
            try
            {
                var sanctionLetter = await dbcontext.Userdocuments
                    .FirstOrDefaultAsync(sl => sl.Filename == fileName);
                if (sanctionLetter == null)
                    return NotFound($"Sanction letter for Filename {fileName} not found.");

                // Log the download action
                _auditService.InsertLog(HttpContext, "Download File", "Sanction Letter downloaded successfully.", userId, "Success");

                // Return the file
                return File(sanctionLetter.Filedata, "application/pdf", sanctionLetter.Filename);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"An error occurred while downloading the sanction letter. {ex}");
            }
        }

        [HttpGet]
        public IActionResult GetApplications(int Serviceid, string type, int pageIndex = 0, int pageSize = 10,
       string? dataType = null, string? searchQuery = null)
        {
            var officerDetails = GetOfficerDetails();

            // ========== VALIDATE WORKFLOW ==========
            var service = dbcontext.Services.FirstOrDefault(s => s.Serviceid == Serviceid);
            if (service == null)
                return NotFound();

            var workflow = JsonConvert.DeserializeObject<List<dynamic>>(service.Officereditablefield!);
            if (workflow == null || workflow.Count == 0)
                return Json(new { countList = new List<dynamic>(), canSanction = false });

            dynamic authorities = workflow.FirstOrDefault(p => p.designation == officerDetails.Role)!;
            if (authorities == null)
                return Json(new { countList = new List<dynamic>(), canSanction = false });

            // =====================================================================
            //                       GET TOTAL RECORDS (with optional datatype filter)
            // =====================================================================
            int totalRecords = 0;

            try
            {
                // Parameters for get_status_count – note the added @p_data_type
                var statusCountParameters = new[]
                {
            new NpgsqlParameter("@p_access_level", officerDetails.AccessLevel),
            new NpgsqlParameter("@p_access_code", officerDetails.AccessCode ?? (object)DBNull.Value),
            new NpgsqlParameter("@p_service_id", Serviceid),
            new NpgsqlParameter("@p_taken_by", officerDetails.Role),
            new NpgsqlParameter("@p_division_code",
                officerDetails.AccessLevel == "Division" ? officerDetails.AccessCode ?? (object)DBNull.Value : (object)DBNull.Value),
            new NpgsqlParameter("@p_data_type", !string.IsNullOrEmpty(dataType) ? (object)dataType : DBNull.Value)
        };

                var statusCountResult = dbcontext.Database
                    .SqlQueryRaw<StatusCounts>(
                        "SELECT * FROM get_status_count(@p_access_level, @p_access_code, @p_service_id, @p_taken_by, @p_division_code, @p_data_type)",
                        statusCountParameters
                    )
                    .FirstOrDefault();

                _logger.LogInformation($"-------- Status Count Result: {JsonConvert.SerializeObject(statusCountResult)} -------");

                if (statusCountResult != null)
                {
                    // Map the status type to the corresponding count field
                    switch (type)
                    {
                        case "total":
                            totalRecords = statusCountResult.TotalApplications;
                            break;
                        case "pending":
                            totalRecords = statusCountResult.PendingCount;
                            break;
                        case "forwarded":
                            totalRecords = statusCountResult.ForwardedCount;
                            break;
                        case "returned":
                            totalRecords = statusCountResult.ReturnedCount;
                            break;
                        case "returntoedit":
                            totalRecords = statusCountResult.ReturnToEditCount;
                            break;
                        case "sanctioned":
                            totalRecords = statusCountResult.SanctionedCount;
                            break;
                        case "rejected":
                            totalRecords = statusCountResult.RejectCount;
                            break;
                        case "disbursed":
                            totalRecords = statusCountResult.DisbursedCount;
                            break;
                        default:
                            totalRecords = 0;
                            break;
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error getting status count for type {type}: {ex.Message}");
                // Continue without total records count
            }

            _logger.LogInformation($"--------- Initial Status Count for type '{type}': {totalRecords} ---------");

            // =====================================================================
            //                       FETCH LIST USING DTO
            // =====================================================================
            List<OfficerApplicationDto> response;

            if (type == "shifted")
            {
                // SHIFTED APPLICATIONS (no search for shifted)
                var shiftedParameters = new[]
                {
            new NpgsqlParameter("@role", officerDetails.Role),
            new NpgsqlParameter("@accesslevel", officerDetails.AccessLevel),
            new NpgsqlParameter("@accesscode", officerDetails.AccessCode ?? (object)DBNull.Value),
            new NpgsqlParameter("@serviceid", Serviceid)
        };

                response = dbcontext.Database
                    .SqlQueryRaw<OfficerApplicationDto>(
                        "SELECT * FROM get_shifted_applications(@role, @accesslevel, @accesscode, @serviceid)",
                        shiftedParameters
                    )
                    .ToList();

                // For shifted applications, use the actual count
                totalRecords = response.Count;
            }
            else if (!string.IsNullOrEmpty(searchQuery))
            {
                var searchParameters = new[]
                {
            new NpgsqlParameter("@role", officerDetails.Role),
            new NpgsqlParameter("@accesslevel", officerDetails.AccessLevel),
            new NpgsqlParameter("@accesscode", officerDetails.AccessCode ?? (object)DBNull.Value),
            new NpgsqlParameter("@applicationstatus", (object?)type ?? DBNull.Value),
            new NpgsqlParameter("@serviceid", Serviceid),
            new NpgsqlParameter("@page_index", pageIndex),
            new NpgsqlParameter("@page_size", pageSize),
            new NpgsqlParameter("@division_code",
                officerDetails.AccessLevel == "Division" ? officerDetails.AccessCode ?? (object)DBNull.Value : (object)DBNull.Value),
            new NpgsqlParameter("@search_query", searchQuery)
        };

                response = dbcontext.Database
                    .SqlQueryRaw<OfficerApplicationDto>(
                        "SELECT * FROM search_applications_for_officer(@role, @accesslevel, @accesscode, @applicationstatus, @serviceid, @page_index, @page_size, @division_code, @search_query)",
                        searchParameters
                    )
                    .ToList();

                // For search results, use the actual count
                totalRecords = response.Count;
            }
            else
            {
                // NORMAL APPLICATIONS - Use existing function
                var parameters = new[]
                {
            new NpgsqlParameter("@role", officerDetails.Role),
            new NpgsqlParameter("@accesslevel", officerDetails.AccessLevel),
            new NpgsqlParameter("@accesscode", officerDetails.AccessCode ?? (object)DBNull.Value),
            new NpgsqlParameter("@applicationstatus", (object?)type ?? DBNull.Value),
            new NpgsqlParameter("@serviceid", Serviceid),
            new NpgsqlParameter("@pageindex", pageIndex),
            new NpgsqlParameter("@pagesize", pageSize),
            new NpgsqlParameter("@ispaginated", true),
            new NpgsqlParameter("@datatype", dataType == "legacy" ? (object)dataType : DBNull.Value),
            new NpgsqlParameter("@division_code",
                officerDetails.AccessLevel == "Division" ? officerDetails.AccessCode ?? (object)DBNull.Value : (object)DBNull.Value)
        };

                response = dbcontext.Database
                    .SqlQueryRaw<OfficerApplicationDto>(
                        "SELECT * FROM get_applications_for_officer(@role, @accesslevel, @accesscode, @applicationstatus, @serviceid, @pageindex, @pagesize, @ispaginated, @datatype, @division_code)",
                        parameters
                    )
                    .ToList();

                // ✅ CRITICAL FIX: Get total count from the first record (if any)
                // The function returns totalcount in every row, so we can get it from the first record
                if (response.Any() && response.First().TotalCount > 0)
                {
                    // Override the status count with the actual total from the function
                    // This is more accurate as it accounts for all filters
                    totalRecords = (int)response.First().TotalCount;
                    _logger.LogInformation($"--------- Total Records from function: {totalRecords} ---------");
                }
                else
                {
                    // Fallback to count from response if TotalCount is not available
                    totalRecords = response.Count;
                    _logger.LogWarning($"--------- TotalCount not available, using response count: {totalRecords} ---------");
                }
            }

            // =====================================================================
            //                       COLUMN SETUP
            // =====================================================================
            var columns = new List<dynamic>
    {
        new { accessorKey = "sno", header = "S.No" },
        new { accessorKey = "referenceNumber", header = "Reference Number" },
        new { accessorKey = "applicantName", header = "Applicant Name" },
        new { accessorKey = "serviceName", header = "Service Name" },
        new { accessorKey = "currentlyWith", header = "Currently With" },
        new { accessorKey = "status", header = "Application Status" },
        new { accessorKey = "submissionDate", header = "Citizen Submission Date" },
        new { accessorKey = "actionTakenOn", header = "Received On" }
    };

            // Add location columns based on access level
            if (officerDetails.AccessLevel == "State")
            {
                columns.Insert(1, new { accessorKey = "divisionName", header = "Division Name" });
                columns.Insert(2, new { accessorKey = "districtName", header = "District Name" });
            }
            else if (officerDetails.AccessLevel == "Division")
            {
                columns.Insert(1, new { accessorKey = "districtName", header = "District Name" });
                columns.Insert(2, new { accessorKey = "tehsilName", header = "Tehsil Name" });
            }
            else if (officerDetails.AccessLevel == "District")
            {
                columns.Insert(1, new { accessorKey = "tehsilName", header = "Tehsil Name" });
            }

            // =====================================================================
            //                       POOL LOGIC
            // =====================================================================
            var poolList = dbcontext.Pool.FirstOrDefault(p =>
                p.Serviceid == Serviceid &&
                p.Accesslevel == officerDetails.AccessLevel &&
                p.Accesscode == officerDetails.AccessCode
            );

            var pool = poolList != null && !string.IsNullOrWhiteSpace(poolList.List)
                ? JsonConvert.DeserializeObject<List<string>>(poolList.List)
                : new List<string>();

            List<dynamic> data = [];
            List<dynamic> poolData = [];

            // =====================================================================
            //                       BUILD RESULT OBJECTS
            // =====================================================================
            int snoCounter = (pageIndex * pageSize) + 1;

            foreach (var details in response)
            {
                try
                {
                    var formDetails = JsonConvert.DeserializeObject<dynamic>(details.FormDetails ?? "{}");
                    var officers = JsonConvert.DeserializeObject<JArray>(details.WorkFlow ?? "[]");
                    var currentPlayer = details.CurrentPlayer ?? 0;

                    string officerDesignation = "Unknown";
                    string offierAccessLevel = "Unknown";
                    string officerStatus = "Unknown";
                    string officerArea = "Unknown";

                    if (officers != null && officers.Count > 0)
                    {
                        var currentOfficerObj = currentPlayer >= 0 && currentPlayer < officers.Count
                            ? officers[currentPlayer]
                            : officers[0];

                        if (currentOfficerObj != null)
                        {
                            officerDesignation = currentOfficerObj["designation"]?.ToString() ?? "Unknown";
                            offierAccessLevel = currentOfficerObj["accessLevel"]?.ToString() ?? "Unknown";
                            officerStatus = currentOfficerObj["status"]?.ToString() ?? "Unknown";
                        }

                        officerArea = GetOfficerArea(offierAccessLevel, formDetails);
                    }

                    _logger.LogInformation($"------------ Officer Designation: {officerDesignation}  Officer Area: {officerArea} ------------------");

                    var actionHistories = dbcontext.Actionhistory
                        .Where(h => h.Referencenumber == details.ReferenceNumber)
                        .ToList();

                    var latestHistory = actionHistories
                        .Select(h => new { History = h, ParsedDate = SafeParseDate(h.Actiontakendate) })
                        .Where(x => x.ParsedDate.HasValue)
                        .OrderByDescending(x => x.ParsedDate!.Value)
                        .Select(x => x.History)
                        .FirstOrDefault();

                    DateTime parsedDate = latestHistory != null && SafeParseDate(latestHistory.Actiontakendate).HasValue
                        ? SafeParseDate(latestHistory.Actiontakendate)!.Value
                        : DateTime.MinValue;

                    string serviceName = dbcontext.Services.FirstOrDefault(s => s.Serviceid == details.ServiceId)?.Servicename ?? "Unknown";

                    // =====================================================================
                    //                       CUSTOM ACTIONS LOGIC
                    // =====================================================================
                    var customActions = new List<dynamic>();

                    JToken? currentOfficer = null;
                    if (officers != null)
                    {
                        currentOfficer = officers.FirstOrDefault(o =>
                            o != null &&
                            o["designation"]?.ToString() == officerDetails.Role);
                    }

                    bool canPull = currentOfficer?["canPull"] != null && (bool)currentOfficer["canPull"]!;

                    if ((type == "forwarded" || type == "returned" || type == "returntoedit") && canPull)
                    {
                        customActions.Add(new
                        {
                            type = "Pull",
                            tooltip = "Pull",
                            color = "#F0C38E",
                            actionFunction = "pullApplication"
                        });
                    }

                    if (type == "returntoedit" && !canPull)
                    {
                        customActions.Add(new
                        {
                            type = "View",
                            tooltip = "View",
                            color = "#F0C38E",
                            actionFunction = "handleViewApplication"
                        });
                    }

                    if (officerStatus != "returntoedit" && officerStatus != "sanctioned")
                    {
                        customActions.Add(new
                        {
                            type = "View",
                            tooltip = "View",
                            color = "#F0C38E",
                            actionFunction = type == "pending" ? "handleOpenApplication" : "handleViewApplication"
                        });
                    }
                    else if (officerStatus == "sanctioned")
                    {
                        customActions.Add(new
                        {
                            type = "View",
                            tooltip = "View",
                            color = "#F0C38E",
                            actionFunction = "handleViewApplication"
                        });

                        customActions.Add(new { tooltip = "Download SL", color = "#F0C38E", actionFunction = "DownloadSanctionLetter" });

                        var corrigendums = dbcontext.Corrigendum.Where(co => co.Referencenumber == details.ReferenceNumber).ToList();
                        foreach (var item in corrigendums)
                        {
                            string value = GetSanctionedCorrigendum(JsonConvert.DeserializeObject<dynamic>(item.Workflow ?? "{}"), item.Corrigendumid);
                            if (value != null)
                            {
                                customActions.Add(new
                                {
                                    type = "DownloadCorrigendum",
                                    tooltip = "View CRG " + value.TrimEnd('/').Split('/').Last(),
                                    corrigendumId = value,
                                    color = "#F0C38E",
                                    actionFunction = "handleViewPdf"
                                });
                            }
                        }
                    }

                    var excludedStatuses = new[] { "Rejected", "Sanctioned", "Initiated" };
                    bool IsError = excludedStatuses.Contains(details.Status ?? "");
                    if (!IsError)
                    {
                        customActions.Clear();
                    }

                    string Status = IsError
                        ? officerStatus == "returntoedit"
                            ? "Pending With Citizen"
                            : (!string.IsNullOrEmpty(officerStatus)
                                ? char.ToUpper(officerStatus[0]) + officerStatus.Substring(1)
                                : "Unknown")
                        : details.Status ?? "Unknown";

                    dynamic obj = new ExpandoObject();
                    var app = (IDictionary<string, object>)obj;

                    // -------------------------
                    // LOCATION FIELD FIX APPLY
                    // -------------------------
                    if (officerDetails.AccessLevel == "State")
                    {
                        app["divisionName"] = details.DivisionName ?? "N/A";
                        app["districtName"] = details.DistrictName ?? "N/A";
                    }
                    else if (officerDetails.AccessLevel == "Division")
                    {
                        app["districtName"] = details.DistrictName ?? "N/A";
                        app["tehsilName"] = details.TehsilName ?? "N/A";
                    }
                    else if (officerDetails.AccessLevel == "District")
                    {
                        app["tehsilName"] = details.TehsilName ?? "N/A";
                    }

                    app["sno"] = snoCounter++;
                    app["referenceNumber"] = details.ReferenceNumber!;
                    app["applicantName"] = GetFieldValue("ApplicantName", formDetails);
                    app["submissionDate"] = details.Created_at ?? "N/A";
                    app["actionTakenOn"] = parsedDate == DateTime.MinValue ? string.Empty : parsedDate.ToString("dd MMM yyyy hh:mm:ss tt");
                    app["serviceName"] = serviceName;
                    app["currentlyWith"] = officerStatus == "returntoedit" ? "Citizen" : $"{officerDesignation} ({officerArea})";
                    app["status"] = Status!;
                    app["serviceId"] = details.ServiceId;
                    app["customActions"] = customActions;

                    if (type == "pending" && pool!.Contains(details.ReferenceNumber!))
                        poolData.Add(obj);
                    else
                        data.Add(obj);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, $"Error processing application {details.ReferenceNumber}: {ex.Message}");
                    continue;
                }
            }

            // =====================================================================
            //                       RESET SERIAL NUMBERS
            // =====================================================================
            // Reset serial numbers based on access level
            if (officerDetails.AccessLevel == "State")
            {
                data = data.Select((d, i) => new
                {
                    sno = (pageIndex * pageSize) + i + 1,
                    d.referenceNumber,
                    d.divisionName,
                    d.districtName,
                    d.applicantName,
                    d.submissionDate,
                    d.actionTakenOn,
                    d.serviceName,
                    d.currentlyWith,
                    d.status,
                    d.serviceId,
                    d.customActions
                }).ToList<dynamic>();

                poolData = poolData.Select((d, i) => new
                {
                    sno = (pageIndex * pageSize) + i + 1,
                    d.referenceNumber,
                    d.divisionName,
                    d.districtName,
                    d.applicantName,
                    d.submissionDate,
                    d.actionTakenOn,
                    d.serviceName,
                    d.currentlyWith,
                    d.status,
                    d.serviceId,
                    d.customActions
                }).ToList<dynamic>();
            }
            else if (officerDetails.AccessLevel == "Division")
            {
                data = data.Select((d, i) => new
                {
                    sno = (pageIndex * pageSize) + i + 1,
                    d.referenceNumber,
                    d.districtName,
                    d.tehsilName,
                    d.applicantName,
                    d.submissionDate,
                    d.actionTakenOn,
                    d.serviceName,
                    d.currentlyWith,
                    d.status,
                    d.serviceId,
                    d.customActions
                }).ToList<dynamic>();

                poolData = poolData.Select((d, i) => new
                {
                    sno = (pageIndex * pageSize) + i + 1,
                    d.referenceNumber,
                    d.districtName,
                    d.tehsilName,
                    d.applicantName,
                    d.submissionDate,
                    d.actionTakenOn,
                    d.serviceName,
                    d.currentlyWith,
                    d.status,
                    d.serviceId,
                    d.customActions
                }).ToList<dynamic>();
            }
            else if (officerDetails.AccessLevel == "District")
            {
                data = data.Select((d, i) => new
                {
                    sno = (pageIndex * pageSize) + i + 1,
                    d.referenceNumber,
                    d.tehsilName,
                    d.applicantName,
                    d.submissionDate,
                    d.actionTakenOn,
                    d.serviceName,
                    d.currentlyWith,
                    d.status,
                    d.serviceId,
                    d.customActions
                }).ToList<dynamic>();

                poolData = poolData.Select((d, i) => new
                {
                    sno = (pageIndex * pageSize) + i + 1,
                    d.referenceNumber,
                    d.tehsilName,
                    d.applicantName,
                    d.submissionDate,
                    d.actionTakenOn,
                    d.serviceName,
                    d.currentlyWith,
                    d.status,
                    d.serviceId,
                    d.customActions
                }).ToList<dynamic>();
            }
            else
            {
                data = data.Select((d, i) => new
                {
                    sno = (pageIndex * pageSize) + i + 1,
                    d.referenceNumber,
                    d.applicantName,
                    d.submissionDate,
                    d.actionTakenOn,
                    d.serviceName,
                    d.currentlyWith,
                    d.status,
                    d.serviceId,
                    d.customActions
                }).ToList<dynamic>();

                poolData = poolData.Select((d, i) => new
                {
                    sno = (pageIndex * pageSize) + i + 1,
                    d.referenceNumber,
                    d.applicantName,
                    d.submissionDate,
                    d.actionTakenOn,
                    d.serviceName,
                    d.currentlyWith,
                    d.status,
                    d.serviceId,
                    d.customActions
                }).ToList<dynamic>();
            }

            _logger.LogInformation($"--------- Final Return - Data Count: {data.Count}, Pool Count: {poolData.Count}, Total Records: {totalRecords} ---------");

            return Json(new
            {
                data,
                poolData,
                columns,
                totalRecords,
                canSanction = (bool)authorities.canSanction
            });
        }

        [HttpGet]
        public async Task<IActionResult> GenerateUserDetailsPdf(string applicationId)
        {
            var officer = GetOfficerDetails();
            string? username = officer.Username;
            if (string.IsNullOrEmpty(applicationId))
            {
                return BadRequest("Application ID is required.");
            }

            // Retrieve application details
            var application = await dbcontext.CitizenApplications
                .Where(ca => ca.Referencenumber == applicationId)
                .FirstOrDefaultAsync();

            if (application == null)
            {
                return NotFound("Application not found.");
            }

            using (var memoryStream = new MemoryStream())
            {
                // Initialize PDF writer and document
                var writer = new PdfWriter(memoryStream);
                var pdf = new PdfDocument(writer);
                var document = new Document(pdf, PageSize.A4);
                document.SetMargins(30, 30, 30, 30);

                string serviceName = dbcontext.Services.FirstOrDefault(s => s.Serviceid == application.Serviceid)!.Servicename!;

                // Parse Formdetails JSON
                var formDetails = JObject.Parse(application.Formdetails!);

                // Create a header table for title, metadata, and applicant image
                var headerTable = new Table(UnitValue.CreatePercentArray(new float[] { 60, 40 }));
                headerTable.SetWidth(UnitValue.CreatePercentValue(100));
                headerTable.SetMarginBottom(20);

                // Title cell
                var titleCell = new Cell(1, 1)
                    .Add(new Paragraph("Citizen Application Details")
                        .SetFontSize(18)
                        .SetBold()
                        .SetTextAlignment(TextAlignment.LEFT)
                        .SetFontColor(new DeviceRgb(25, 118, 210))
                        .SetMarginBottom(5))
                    .Add(new Paragraph(serviceName)
                        .SetFontSize(14)
                        .SetTextAlignment(TextAlignment.LEFT)
                        .SetFontColor(new DeviceRgb(51, 51, 51))
                        .SetMarginBottom(10))
                    .SetBorder(Border.NO_BORDER)
                    .SetVerticalAlignment(VerticalAlignment.TOP)
                    .SetPadding(10)
                    .SetBackgroundColor(new DeviceRgb(240, 248, 255)); // Light blue background
                headerTable.AddCell(titleCell);

                // Metadata and image cell
                var metadataCell = new Cell(1, 1)
                    .SetBorder(Border.NO_BORDER)
                    .SetVerticalAlignment(VerticalAlignment.TOP)
                    .SetTextAlignment(TextAlignment.RIGHT)
                    .SetPadding(10)
                    .SetBackgroundColor(new DeviceRgb(240, 248, 255));

                // Add metadata (Login ID, IP Address, Generated At)
                metadataCell.Add(new Paragraph($"Login ID: {username}")
                    .SetFontSize(10)
                    .SetFontColor(new DeviceRgb(51, 51, 51))
                    .SetTextAlignment(TextAlignment.RIGHT));
                metadataCell.Add(new Paragraph($"IP Address: {HttpContext.Connection.RemoteIpAddress}")
                    .SetFontSize(10)
                    .SetFontColor(new DeviceRgb(51, 51, 51))
                    .SetTextAlignment(TextAlignment.RIGHT));
                metadataCell.Add(new Paragraph($"Generated At: {DateTime.Now.ToString("dd MMM yyyy hh:mm:ss", CultureInfo.InvariantCulture)}")
                    .SetFontSize(10)
                    .SetFontColor(new DeviceRgb(51, 51, 51))
                    .SetTextAlignment(TextAlignment.RIGHT)
                    .SetMarginBottom(10));

                // Applicant image
                var imagePath = GetFormFieldValue(formDetails, "ApplicantImage");
                if (!string.IsNullOrEmpty(imagePath))
                {
                    var ImageDetails = dbcontext.Userdocuments.FirstOrDefault(u => u.Filename == imagePath);
                    if (ImageDetails != null)
                    {
                        try
                        {
                            var imageData = ImageDataFactory.Create(ImageDetails.Filedata);
                            var image = new Image(imageData)
                                .ScaleToFit(60, 60)
                                .SetBorder(new SolidBorder(new DeviceRgb(25, 118, 210), 2))
                                .SetBorderRadius(new BorderRadius(8))
                                .SetMargins(5, 0, 5, 0)
                                .SetHorizontalAlignment(HorizontalAlignment.RIGHT);
                            metadataCell.Add(image);
                        }
                        catch (Exception ex)
                        {
                            metadataCell.Add(new Paragraph($"Image error: {ex.Message}")
                                .SetFontSize(8)
                                .SetFontColor(ColorConstants.RED)
                                .SetTextAlignment(TextAlignment.RIGHT));
                        }
                    }
                    else
                    {
                        metadataCell.Add(new Paragraph("Image not found")
                            .SetFontSize(8)
                            .SetFontColor(ColorConstants.RED)
                            .SetTextAlignment(TextAlignment.RIGHT));
                    }
                }
                else
                {
                    metadataCell.Add(new Paragraph("No image")
                        .SetFontSize(8)
                        .SetFontColor(ColorConstants.GRAY)
                        .SetTextAlignment(TextAlignment.RIGHT));
                }
                headerTable.AddCell(metadataCell);

                document.Add(headerTable);

                // Add a decorative divider
                document.Add(new Paragraph("")
                    .SetBorderBottom(new SolidBorder(new DeviceRgb(25, 118, 210), 2))
                    .SetMarginBottom(20));

                // Create a table for application details
                var detailsTable = new Table(UnitValue.CreatePercentArray(new float[] { 40, 60 }));
                detailsTable.SetWidth(UnitValue.CreatePercentValue(100));
                detailsTable.SetMarginBottom(20);

                // Add section headers and details
                foreach (var section in formDetails)
                {
                    if (section.Key == "Documents" || section.Key == "ApplicantImage") continue;

                    // Add section header spanning both columns
                    var sectionHeader = new Cell(1, 2)
                        .Add(new Paragraph(FormatSectionKey(section.Key))
                            .SetFontSize(14)
                            .SetBold()
                            .SetFontColor(new DeviceRgb(242, 140, 56))
                            .SetMarginTop(15)
                            .SetMarginBottom(10)
                            .SetPadding(8))
                        .SetBorder(new SolidBorder(new DeviceRgb(200, 200, 200), 1))
                        .SetBackgroundColor(new DeviceRgb(245, 245, 245))
                        .SetBorderRadius(new BorderRadius(6));
                    detailsTable.AddCell(sectionHeader);

                    if (section.Value is JArray sectionArray)
                    {
                        foreach (var item in sectionArray)
                        {
                            var label = item["label"]?.ToString();
                            var name = item["name"]?.ToString();
                            var value = item["value"]?.ToString();

                            if (!string.IsNullOrEmpty(label) && !string.IsNullOrEmpty(value))
                            {
                                string displayValue = ConvertValueForDisplay(name!, value);

                                var labelCell = new Cell()
                                    .Add(new Paragraph(FormatFieldLabel(label))
                                        .SetFontSize(11)
                                        .SetBold()
                                        .SetFontColor(new DeviceRgb(51, 51, 51)))
                                    .SetBorder(new SolidBorder(new DeviceRgb(200, 200, 200), (float)0.5))
                                    .SetPadding(10)
                                    .SetBackgroundColor(new DeviceRgb(250, 250, 250))
                                    .SetBorderRadius(new BorderRadius(4));
                                detailsTable.AddCell(labelCell);

                                var valueCell = new Cell()
                                    .Add(new Paragraph(displayValue)
                                        .SetFontSize(11)
                                        .SetFontColor(new DeviceRgb(0, 0, 0)))
                                    .SetBorder(new SolidBorder(new DeviceRgb(200, 200, 200), (float)0.5))
                                    .SetPadding(10)
                                    .SetBackgroundColor(new DeviceRgb(250, 250, 250))
                                    .SetBorderRadius(new BorderRadius(4));
                                detailsTable.AddCell(valueCell);

                                if (item["additionalFields"] is JArray additionalFields)
                                {
                                    foreach (var additionalField in additionalFields)
                                    {
                                        var addLabel = additionalField["label"]?.ToString();
                                        var addValue = additionalField["value"]?.ToString();
                                        if (!string.IsNullOrEmpty(addLabel) && !string.IsNullOrEmpty(addValue))
                                        {
                                            string addDisplayValue = ConvertValueForDisplay(addLabel, addValue);

                                            var addLabelCell = new Cell()
                                                .Add(new Paragraph(FormatFieldLabel(addLabel))
                                                    .SetFontSize(10)
                                                    .SetBold()
                                                    .SetFontColor(new DeviceRgb(51, 51, 51)))
                                                .SetBorder(new SolidBorder(new DeviceRgb(200, 200, 200), (float)0.5))
                                                .SetPadding(8)
                                                .SetBackgroundColor(new DeviceRgb(250, 250, 250))
                                                .SetBorderRadius(new BorderRadius(4))
                                                .SetPaddingLeft(20);
                                            detailsTable.AddCell(addLabelCell);

                                            var addValueCell = new Cell()
                                                .Add(new Paragraph(addDisplayValue)
                                                    .SetFontSize(10)
                                                    .SetFontColor(new DeviceRgb(0, 0, 0)))
                                                .SetBorder(new SolidBorder(new DeviceRgb(200, 200, 200), (float)0.5))
                                                .SetPadding(8)
                                                .SetBackgroundColor(new DeviceRgb(250, 250, 250))
                                                .SetBorderRadius(new BorderRadius(4));
                                            detailsTable.AddCell(addValueCell);

                                            if (additionalField["additionalFields"] is JArray nestedFields)
                                            {
                                                foreach (var nestedField in nestedFields)
                                                {
                                                    var nestedLabel = nestedField["label"]?.ToString();
                                                    var nestedValue = nestedField["value"]?.ToString();
                                                    if (!string.IsNullOrEmpty(nestedLabel) && !string.IsNullOrEmpty(nestedValue))
                                                    {
                                                        string nestedDisplayValue = ConvertValueForDisplay(nestedLabel, nestedValue);

                                                        var nestedLabelCell = new Cell()
                                                            .Add(new Paragraph(FormatFieldLabel(nestedLabel))
                                                                .SetFontSize(10)
                                                                .SetBold()
                                                                .SetFontColor(new DeviceRgb(51, 51, 51)))
                                                            .SetBorder(new SolidBorder(new DeviceRgb(200, 200, 200), (float)0.5))
                                                            .SetPadding(8)
                                                            .SetBackgroundColor(new DeviceRgb(250, 250, 250))
                                                            .SetBorderRadius(new BorderRadius(4))
                                                            .SetPaddingLeft(30);
                                                        detailsTable.AddCell(nestedLabelCell);

                                                        var nestedValueCell = new Cell()
                                                            .Add(new Paragraph(nestedDisplayValue)
                                                                .SetFontSize(10)
                                                                .SetFontColor(new DeviceRgb(0, 0, 0)))
                                                            .SetBorder(new SolidBorder(new DeviceRgb(200, 200, 200), (float)0.5))
                                                            .SetPadding(8)
                                                            .SetBackgroundColor(new DeviceRgb(250, 250, 250))
                                                            .SetBorderRadius(new BorderRadius(4));
                                                        detailsTable.AddCell(nestedValueCell);
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                document.Add(detailsTable);

                // Add Attached Documents section
                var documents = formDetails["Documents"] as JArray;
                bool hasDocuments = documents != null && documents.Any();
                if (hasDocuments)
                {
                    document.Add(new Paragraph("Attached Documents")
                        .SetFontSize(14)
                        .SetBold()
                        .SetFontColor(new DeviceRgb(242, 140, 56))
                        .SetBackgroundColor(new DeviceRgb(245, 245, 245))
                        .SetPadding(8)
                        .SetMarginTop(20)
                        .SetMarginBottom(10)
                        .SetBorderRadius(new BorderRadius(6)));

                    foreach (var doc in documents!)
                    {
                        var filePath = doc["File"]?.ToString();
                        var enclosure = doc["label"]?.ToString();
                        var FileDetails = dbcontext.Userdocuments.FirstOrDefault(u => u.Filename == filePath);
                        if (FileDetails != null)
                        {
                            if (FileDetails.Filedata != null)
                            {
                                try
                                {
                                    // Start a new page for each document
                                    using var inputStream = new MemoryStream(FileDetails.Filedata);
                                    using var reader = new PdfReader(inputStream);
                                    using var tempMs = new MemoryStream();
                                    var srcPdf = new PdfDocument(reader, new PdfWriter(tempMs));
                                    var firstPage = srcPdf.GetPage(1);

                                    var canvas = new PdfCanvas(firstPage.NewContentStreamBefore(), firstPage.GetResources(), srcPdf);
                                    var canvasDoc = new Document(srcPdf);
                                    canvasDoc.ShowTextAligned(
                                        new Paragraph($"Document: {enclosure}")
                                            .SetFontSize(14)
                                            .SetBold()
                                            .SetFontColor(new DeviceRgb(242, 140, 56))
                                            .SetBackgroundColor(new DeviceRgb(245, 245, 245))
                                            .SetPadding(5),
                                        x: 36, y: firstPage.GetPageSize().GetTop() - 50,
                                        TextAlignment.LEFT
                                    );
                                    canvasDoc.Close();

                                    srcPdf = new PdfDocument(new PdfReader(new MemoryStream(tempMs.ToArray())));
                                    int documentPageCount = srcPdf.GetNumberOfPages();
                                    srcPdf.CopyPagesTo(1, documentPageCount, pdf);
                                    srcPdf.Close();
                                    document.Add(new AreaBreak(AreaBreakType.NEXT_PAGE));
                                }
                                catch (Exception ex)
                                {
                                    document.Add(new Paragraph($"Error loading {enclosure}: {ex.Message}")
                                        .SetFontSize(12)
                                        .SetFontColor(ColorConstants.RED)
                                        .SetMarginBottom(5));
                                }
                            }
                            else
                            {
                                document.Add(new Paragraph($"Document {enclosure}: File not found")
                                    .SetFontSize(12)
                                    .SetFontColor(ColorConstants.RED)
                                    .SetMarginBottom(5));
                            }
                        }
                    }
                }

                // Add Sanction Letter if application status is Sanctioned
                if (application.Status == "Sanctioned")
                {
                    var sanctionLetterPath = applicationId.Replace("/", "_") + "_SanctionLetter.pdf";
                    var FileDetails = dbcontext.Userdocuments.FirstOrDefault(u => u.Filename == sanctionLetterPath);
                    if (FileDetails != null)
                    {
                        try
                        {
                            using var inputStream = new MemoryStream(FileDetails.Filedata);
                            using var reader = new PdfReader(inputStream);
                            using var tempMs = new MemoryStream();
                            var srcPdf = new PdfDocument(reader, new PdfWriter(tempMs));
                            var firstPage = srcPdf.GetPage(1);

                            var canvas = new PdfCanvas(firstPage.NewContentStreamBefore(), firstPage.GetResources(), srcPdf);
                            var canvasDoc = new Document(srcPdf);
                            canvasDoc.ShowTextAligned(
                                new Paragraph("Sanction Letter")
                                    .SetFontSize(14)
                                    .SetBold()
                                    .SetFontColor(new DeviceRgb(242, 140, 56))
                                    .SetBackgroundColor(new DeviceRgb(245, 245, 245))
                                    .SetPadding(5),
                                x: 36, y: firstPage.GetPageSize().GetTop() - 50,
                                TextAlignment.LEFT
                            );
                            canvasDoc.Close();

                            srcPdf = new PdfDocument(new PdfReader(new MemoryStream(tempMs.ToArray())));
                            int documentPageCount = srcPdf.GetNumberOfPages();
                            srcPdf.CopyPagesTo(1, documentPageCount, pdf);
                            srcPdf.Close();
                            document.Add(new AreaBreak(AreaBreakType.NEXT_PAGE));

                            var corrigendum = dbcontext.Corrigendum.Where(c => c.Referencenumber == applicationId).ToList();
                            if (corrigendum.Count > 0)
                            {
                                foreach (var cor in corrigendum)
                                {
                                    var corFileDetails = dbcontext.Userdocuments.FirstOrDefault(u =>
                                        u.Filename == cor.Corrigendumid.Replace("/", "_") + "_CorrigendumSanctionLetter.pdf");

                                    if (corFileDetails != null)
                                    {
                                        using var corInputStream = new MemoryStream(corFileDetails.Filedata);
                                        using var corReader = new PdfReader(corInputStream);
                                        using var corTempMs = new MemoryStream();
                                        var corSrcPdf = new PdfDocument(corReader, new PdfWriter(corTempMs));
                                        var corFirstPage = corSrcPdf.GetPage(1);

                                        var corCanvas = new PdfCanvas(corFirstPage.NewContentStreamBefore(), corFirstPage.GetResources(), corSrcPdf);
                                        var corCanvasDoc = new Document(corSrcPdf);
                                        corCanvasDoc.ShowTextAligned(
                                            new Paragraph("Sanction Letter")
                                                .SetFontSize(14)
                                                .SetBold()
                                                .SetFontColor(new DeviceRgb(242, 140, 56))
                                                .SetBackgroundColor(new DeviceRgb(245, 245, 245))
                                                .SetPadding(5),
                                            x: 36, y: corFirstPage.GetPageSize().GetTop() - 50,
                                            TextAlignment.LEFT
                                        );
                                        corCanvasDoc.Close();

                                        using var finalCorReader = new PdfReader(new MemoryStream(corTempMs.ToArray()));
                                        using var finalCorPdf = new PdfDocument(finalCorReader);
                                        int corDocumentPageCount = finalCorPdf.GetNumberOfPages();
                                        finalCorPdf.CopyPagesTo(1, corDocumentPageCount, pdf);
                                        finalCorPdf.Close();

                                        document.Add(new AreaBreak(AreaBreakType.NEXT_PAGE));
                                    }
                                    else
                                    {
                                        document.Add(new Paragraph($"Corrigendum Letter for ID {cor.Corrigendumid}: File not found")
                                            .SetFontSize(12)
                                            .SetFontColor(ColorConstants.RED)
                                            .SetMarginBottom(5));
                                    }
                                }
                            }
                        }
                        catch (Exception ex)
                        {
                            document.Add(new Paragraph($"Error loading Sanction Letter: {ex.Message}")
                                .SetFontSize(12)
                                .SetFontColor(ColorConstants.RED)
                                .SetMarginBottom(5));
                        }
                    }
                    else
                    {
                        document.Add(new Paragraph("Sanction Letter: File not found")
                            .SetFontSize(12)
                            .SetFontColor(ColorConstants.RED)
                            .SetMarginBottom(5));
                    }
                }

                // Add Application History on a new page only if there is content before it
                if (pdf.GetNumberOfPages() > 1 || hasDocuments || detailsTable.GetNumberOfRows() > 0 || application.Status == "Sanctioned")
                {
                    document.Add(new AreaBreak(AreaBreakType.NEXT_PAGE));
                }

                // Add Application History
                var players = JsonConvert.DeserializeObject<dynamic>(application.Workflow!) as JArray;
                int currentPlayerIndex = (int)application.Currentplayer!;
                var currentPlayer = players!.FirstOrDefault(o => (int)o["playerId"]! == currentPlayerIndex);
                var history = await dbcontext.Actionhistory.Where(ah => ah.Referencenumber == applicationId).ToListAsync();

                var historyTable = new Table(UnitValue.CreatePercentArray(new float[] { 10, 25, 25, 25, 15 }));
                historyTable.SetWidth(UnitValue.CreatePercentValue(100));
                historyTable.SetMarginTop(20);
                historyTable.SetMarginBottom(20);

                document.Add(new Paragraph("Application History")
                    .SetFontSize(14)
                    .SetBold()
                    .SetFontColor(new DeviceRgb(242, 140, 56))
                    .SetBackgroundColor(new DeviceRgb(245, 245, 245))
                    .SetPadding(8)
                    .SetMarginTop(20)
                    .SetMarginBottom(10)
                    .SetTextAlignment(TextAlignment.LEFT)
                    .SetBorderRadius(new BorderRadius(6)));

                var headers = new[] { "S.No", "Action Taker", "Action Taken", "Remarks", "Action Taken On" };
                foreach (var header in headers)
                {
                    historyTable.AddHeaderCell(new Cell()
                        .Add(new Paragraph(header)
                            .SetFontSize(11)
                            .SetBold()
                            .SetFontColor(new DeviceRgb(255, 255, 255))
                            .SetTextAlignment(TextAlignment.CENTER))
                        .SetBackgroundColor(new DeviceRgb(25, 118, 210))
                        .SetPadding(10)
                        .SetBorderRadius(new BorderRadius(4)));
                }

                int index = 1;
                foreach (var item in history)
                {
                    string officerArea = GetOfficerAreaForHistory(item.Locationlevel!, item.Locationvalue);
                    historyTable.AddCell(new Cell()
                        .Add(new Paragraph(index.ToString())
                            .SetFontSize(10)
                            .SetFontColor(new DeviceRgb(0, 0, 0))
                            .SetTextAlignment(TextAlignment.CENTER))
                        .SetPadding(8)
                        .SetBackgroundColor(new DeviceRgb(250, 250, 250))
                        .SetBorder(new SolidBorder(new DeviceRgb(200, 200, 200), (float)0.5))
                        .SetBorderRadius(new BorderRadius(4)));
                    historyTable.AddCell(new Cell()
                        .Add(new Paragraph(item.Actiontaker != "Citizen" ? $"{item.Actiontaker} {officerArea}" : item.Actiontaker)
                            .SetFontSize(10)
                            .SetFontColor(new DeviceRgb(0, 0, 0)))
                        .SetPadding(8)
                        .SetBackgroundColor(new DeviceRgb(250, 250, 250))
                        .SetBorder(new SolidBorder(new DeviceRgb(200, 200, 200), (float)0.5))
                        .SetBorderRadius(new BorderRadius(4)));
                    historyTable.AddCell(new Cell()
                        .Add(new Paragraph(item.Actiontaken == "ReturnToCitizen" ? "Returned to citizen for correction" : item.Actiontaken)
                            .SetFontSize(10)
                            .SetFontColor(new DeviceRgb(0, 0, 0)))
                        .SetPadding(8)
                        .SetBackgroundColor(new DeviceRgb(250, 250, 250))
                        .SetBorder(new SolidBorder(new DeviceRgb(200, 200, 200), (float)0.5))
                        .SetBorderRadius(new BorderRadius(4)));
                    historyTable.AddCell(new Cell()
                        .Add(new Paragraph(item.Remarks ?? "")
                            .SetFontSize(10)
                            .SetFontColor(new DeviceRgb(0, 0, 0)))
                        .SetPadding(8)
                        .SetBackgroundColor(new DeviceRgb(250, 250, 250))
                        .SetBorder(new SolidBorder(new DeviceRgb(200, 200, 200), (float)0.5))
                        .SetBorderRadius(new BorderRadius(4)));
                    historyTable.AddCell(new Cell()
                        .Add(new Paragraph(item.Actiontakendate.ToString())
                            .SetFontSize(10)
                            .SetFontColor(new DeviceRgb(0, 0, 0))
                            .SetTextAlignment(TextAlignment.CENTER))
                        .SetPadding(8)
                        .SetBackgroundColor(new DeviceRgb(250, 250, 250))
                        .SetBorder(new SolidBorder(new DeviceRgb(200, 200, 200), (float)0.5))
                        .SetBorderRadius(new BorderRadius(4)));
                    index++;
                }

                if ((string)currentPlayer!["status"]! == "pending")
                {
                    string designation = (string)currentPlayer["designation"]!;
                    string accessLevel = (string)currentPlayer["accessLevel"]!;
                    string officerArea = GetOfficerArea(accessLevel, formDetails);
                    historyTable.AddCell(new Cell()
                        .Add(new Paragraph(index.ToString())
                            .SetFontSize(10)
                            .SetFontColor(new DeviceRgb(0, 0, 0))
                            .SetTextAlignment(TextAlignment.CENTER))
                        .SetPadding(8)
                        .SetBackgroundColor(new DeviceRgb(250, 250, 250))
                        .SetBorder(new SolidBorder(new DeviceRgb(200, 200, 200), (float)0.5))
                        .SetBorderRadius(new BorderRadius(4)));
                    historyTable.AddCell(new Cell()
                        .Add(new Paragraph($"{currentPlayer["designation"]} {officerArea}")
                            .SetFontSize(10)
                            .SetFontColor(new DeviceRgb(0, 0, 0)))
                        .SetPadding(8)
                        .SetBackgroundColor(new DeviceRgb(250, 250, 250))
                        .SetBorder(new SolidBorder(new DeviceRgb(200, 200, 200), (float)0.5))
                        .SetBorderRadius(new BorderRadius(4)));
                    historyTable.AddCell(new Cell()
                        .Add(new Paragraph(currentPlayer["status"]!.ToString())
                            .SetFontSize(10)
                            .SetFontColor(new DeviceRgb(0, 0, 0)))
                        .SetPadding(8)
                        .SetBackgroundColor(new DeviceRgb(250, 250, 250))
                        .SetBorder(new SolidBorder(new DeviceRgb(200, 200, 200), (float)0.5))
                        .SetBorderRadius(new BorderRadius(4)));
                    historyTable.AddCell(new Cell()
                        .Add(new Paragraph("")
                            .SetFontSize(10)
                            .SetFontColor(new DeviceRgb(0, 0, 0)))
                        .SetPadding(8)
                        .SetBackgroundColor(new DeviceRgb(250, 250, 250))
                        .SetBorder(new SolidBorder(new DeviceRgb(200, 200, 200), (float)0.5))
                        .SetBorderRadius(new BorderRadius(4)));
                    historyTable.AddCell(new Cell()
                        .Add(new Paragraph("")
                            .SetFontSize(10)
                            .SetFontColor(new DeviceRgb(0, 0, 0))
                            .SetTextAlignment(TextAlignment.CENTER))
                        .SetPadding(8)
                        .SetBackgroundColor(new DeviceRgb(250, 250, 250))
                        .SetBorder(new SolidBorder(new DeviceRgb(200, 200, 200), (float)0.5))
                        .SetBorderRadius(new BorderRadius(4)));
                }

                document.Add(historyTable);

                document.Close();
                writer.Close();

                var pdfBytes = memoryStream.ToArray();
                return File(pdfBytes, "application/pdf", $"{applicationId}_UserDetails.pdf");
            }
        }

        [HttpGet]
        public async Task<IActionResult> GetWithheldApplications(string serviceId, string type, int pageIndex = 0, int pageSize = 10)
        {
            var officer = GetOfficerDetails();
            string officerRole = officer.Role!.ToString();

            // Validate inputs
            if (string.IsNullOrEmpty(serviceId) || !int.TryParse(serviceId, out int parsedServiceId))
            {
                _logger.LogWarning("Invalid Serviceid provided: {Serviceid}", serviceId);
                return BadRequest(new { error = "Invalid Serviceid" });
            }

            if (string.IsNullOrEmpty(type))
            {
                _logger.LogWarning("Type parameter is missing or empty");
                return BadRequest(new { error = "Type parameter is required" });
            }

            var withheldType = type.StartsWith("withheld_")
                ? type.Split('_')[1]
                : type;

            bool isStatusNotType = withheldType != "temporary" && withheldType != "permanent" && withheldType != "total";

            // Validate officerRole when type implies status filtering
            if (isStatusNotType && string.IsNullOrEmpty(officerRole))
            {
                _logger.LogWarning("OfficerRole is required for type: {Type}", type);
                return BadRequest(new { error = "OfficerRole is required for status-based filtering" });
            }

            _logger.LogInformation($"Executing GetWithheldApplications: Serviceid={serviceId}, Type={type}, OfficerRole={officerRole}, PageIndex={pageIndex}, PageSize={pageSize}");

            // Prepare columns for frontend
            var columns = new List<dynamic>
            {
                new { accessorKey = "sno", header = "S.No" },
                new { accessorKey = "referenceNumber", header = "Reference Number" },
                new { accessorKey = "applicantName", header = "Applicant Name" },
                new { accessorKey = "withheldType", header = "Withheld Type" },
                new { accessorKey = "withheldReason", header = "Withheld Reason" }
            };

            List<dynamic> data = [];
            int totalRecords = 0;

            try
            {
                var parameters = new[]
                {
                    new NpgsqlParameter("@serviceid", parsedServiceId),
                    new NpgsqlParameter("@type", type),
                    new NpgsqlParameter("@officerrole", (object)officerRole! ?? DBNull.Value),
                    new NpgsqlParameter("@pageindex", pageIndex),
                    new NpgsqlParameter("@pagesize", pageSize)
                };

                var result = await dbcontext.Database
                    .SqlQueryRaw<WithheldApplicationResult>(
                        "SELECT * FROM get_withheld_applications(@serviceid, @type, @officerrole, @pageindex, @pagesize)",
                        parameters
                    )
                    .ToListAsync();

                totalRecords = result.Count > 0 ? result[0].TotalRecords ?? 0 : 0;

                // Prepare data for frontend
                data = result.Select(r => new
                {
                    sno = r.Sno,
                    referenceNumber = r.Referencenumber,
                    applicantName = r.ApplicantName ?? "N/A",
                    withheldType = r.WithheldType,
                    withheldReason = r.WithheldReason,
                    customActions = new List<dynamic>
                    {
                        new
                        {
                            type = "View",
                            tooltip = "View",
                            color = "#F0C38E",
                            actionFunction = "handleViewWithheldApplication"
                        }
                    }
                }).ToList<dynamic>();

                _logger.LogInformation("Retrieved {Count} records with TotalRecords={TotalRecords}", result.Count, totalRecords);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error executing GetWithheldApplications: Serviceid={Serviceid}, Type={Type}, OfficerRole={OfficerRole}", serviceId, type, officerRole);
                return StatusCode(500, new { error = "An error occurred while fetching withheld applications" });
            }

            return Json(new { columns, data, totalRecords });
        }

        // Define a model for the stored procedure result set
        public class WithheldApplicationResult
        {
            public long Sno { get; set; }
            public string? Referencenumber { get; set; }
            public string? ApplicantName { get; set; }
            public string? WithheldType { get; set; }
            public string? WithheldReason { get; set; }
            public int? TotalRecords { get; set; }
        }

        [HttpGet]
        public async Task<IActionResult> GetTemporaryDisability(string? Serviceid, string type, int pageIndex = 0, int pageSize = 10)
        {
            try
            {
                var officer = GetOfficerDetails();
                int serviceId;
                try
                {
                    serviceId = Convert.ToInt32(Serviceid);
                }
                catch
                {
                    return BadRequest("Invalid Serviceid");
                }

                string accessLevel = officer.AccessLevel!;
                int? accessCode = officer.AccessCode;
                string takenBy = officer.Role!;
                int? divisionCode = null;

                string resultType = type == "totalpcpapplication" ? "totalpcpapplication" : "expiringeligibility";

                // Validate pagination
                if (pageIndex < 0) pageIndex = 0;
                if (pageSize < 1) pageSize = 10;

                int pageNumber = pageIndex + 1; // Convert 0-based to 1-based for PostgreSQL

                // =====================================================================
                // 1. Get Paginated Data
                // =====================================================================
                var parameters = new[]
                {
            new NpgsqlParameter("@accesslevel", accessLevel),
            new NpgsqlParameter("@accesscode", accessCode ?? (object)DBNull.Value),
            new NpgsqlParameter("@serviceid", serviceId),
            new NpgsqlParameter("@takenby", takenBy),
            new NpgsqlParameter("@divisioncode", divisionCode ?? (object)DBNull.Value),
            new NpgsqlParameter("@resulttype", resultType),
            new NpgsqlParameter("@pagenumber", pageNumber),
            new NpgsqlParameter("@pagesize", pageSize)
        };

                var applications = await dbcontext.CitizenApplications
                    .FromSqlRaw("SELECT * FROM get_disability_applications(@accesslevel, @accesscode, @serviceid, @takenby, @divisioncode, @resulttype, @pagenumber, @pagesize)", parameters)
                    .ToListAsync();

                // =====================================================================
                // 2. Get Total Count (without pagination)
                // =====================================================================
                int totalRecords = 0;
                try
                {
                    var countParameters = new[]
                    {
                new NpgsqlParameter("@accesslevel", accessLevel),
                new NpgsqlParameter("@accesscode", accessCode ?? (object)DBNull.Value),
                new NpgsqlParameter("@serviceid", serviceId),
                new NpgsqlParameter("@takenby", takenBy),
                new NpgsqlParameter("@divisioncode", divisionCode ?? (object)DBNull.Value),
                new NpgsqlParameter("@resulttype", resultType),
                new NpgsqlParameter("@pagenumber", 1),
                new NpgsqlParameter("@pagesize", 1000000) // Large number to get all records
            };

                    var countQuery = await dbcontext.CitizenApplications
                        .FromSqlRaw("SELECT * FROM get_disability_applications(@accesslevel, @accesscode, @serviceid, @takenby, @divisioncode, @resulttype, @pagenumber, @pagesize)", countParameters)
                        .ToListAsync();

                    totalRecords = countQuery.Count;
                    _logger.LogInformation($"Total records for {resultType}: {totalRecords}");
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error getting total count for disability applications");
                    totalRecords = applications.Count; // Fallback to current page count
                }

                // =====================================================================
                // 3. Process Results
                // =====================================================================
                var serviceName = await dbcontext.Services
                    .Where(s => s.Serviceid == serviceId)
                    .Select(s => s.Servicename)
                    .FirstOrDefaultAsync() ?? "Unknown Service";

                List<dynamic> data = new();
                List<dynamic> columns = new()
        {
            new { accessorKey = "sno", header = "S.No" },
            new { accessorKey = "referenceNumber", header = "Reference Number" },
            new { accessorKey = "applicantName", header = "Applicant Name" },
            new { accessorKey = "serviceName", header = "Service Name" },
        };

                if (type == "totalpcpapplication")
                {
                    columns.Add(new { accessorKey = "applicationType", header = "UDID Card Type" });
                    columns.Add(new { accessorKey = "expiryDate", header = "UDID Card Expiry Date" });
                }
                else // expiringeligibility
                {
                    columns.Add(new { accessorKey = "expiryDate", header = "UDID Card Expiry Date" });
                    columns.Add(new { accessorKey = "noOfMailSent", header = "No. Of Reminder Mails Sent to Citizen" });
                }

                int snoCounter = (pageIndex * pageSize) + 1;

                foreach (var application in applications)
                {
                    try
                    {
                        var formDetailsObj = JToken.Parse(application.Formdetails ?? "{}");
                        string applicantName = GetFieldValue("ApplicantName", formDetailsObj) ?? "Unknown Applicant";

                        // Fetch expiring eligibility record
                        var expiringApplication = dbcontext.Applicationswithexpiringeligibility
                            .FirstOrDefault(ae => ae.Referencenumber == application.Referencenumber);

                        dynamic applicationObject = new ExpandoObject();
                        applicationObject.sno = snoCounter++;
                        applicationObject.referenceNumber = application.Referencenumber;
                        applicationObject.applicantName = applicantName;
                        applicationObject.serviceName = serviceName;

                        string expiryDisplay = "No Expiry Data";
                        int mailSentCount = 0;
                        bool hasValidExpiry = false;

                        if (expiringApplication != null &&
                            !string.IsNullOrWhiteSpace(expiringApplication.ExpirationDate) &&
                            DateTime.TryParse(expiringApplication.ExpirationDate, out DateTime expirationDate))
                        {
                            int daysLeft = (expirationDate.Date - DateTime.Today).Days;
                            expiryDisplay = expirationDate.ToString("dd MMM yyyy") + (daysLeft >= 0 ? $" ({daysLeft} days left)" : " (Expired)");
                            mailSentCount = expiringApplication.MailSent;
                            hasValidExpiry = true;
                        }
                        else
                        {
                            // Log for debugging
                            _logger.LogWarning($"No valid expiry date for Referencenumber: {application.Referencenumber}. " +
                                               $"ExpirationDate: '{expiringApplication?.ExpirationDate}'");

                            // For expiringeligibility mode, only include applications with valid expiry
                            if (type != "totalpcpapplication")
                            {
                                continue; // Skip applications without valid expiry data
                            }
                            expiryDisplay = "No Expiry Data";
                        }

                        // Set expiry date
                        applicationObject.expiryDate = expiryDisplay;

                        if (type == "totalpcpapplication")
                        {
                            var disabilityTypeField = FindFieldRecursively(formDetailsObj, "KindOfDisability");
                            string disabilityType = disabilityTypeField?["value"]?.ToString() ?? "N/A";

                            _logger.LogInformation($"Disability Type: {disabilityType} for {application.Referencenumber}");

                            applicationObject.applicationType = disabilityType;
                        }
                        else // expiringeligibility
                        {
                            if (!hasValidExpiry)
                                continue; // Already skipped above, but double safety

                            applicationObject.noOfMailSent = mailSentCount;

                            var customActions = new List<dynamic>
                    {
                        new
                        {
                            type = "SendEmail",
                            tooltip = "Send Reminder Email",
                            tooltipText = "Send Reminder Mail to Citizen",
                            color = "#F0C38E",
                            actionFunction = "sendExpirationEmail"
                        }
                    };
                            applicationObject.customActions = customActions;
                        }

                        data.Add(applicationObject);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, $"Error processing application {application.Referencenumber}: {ex.Message}");
                        // Skip this record but continue with others
                        continue;
                    }
                }

                // =====================================================================
                // 4. Return Response with Proper Pagination Info
                // =====================================================================
                return Json(new
                {
                    data,
                    columns,
                    totalRecords,
                    pageIndex,
                    pageSize,
                    totalPages = pageSize > 0 ? (int)Math.Ceiling((double)totalRecords / pageSize) : 0
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error in GetTemporaryDisability for type {type}: {ex.Message}");

                return Json(new
                {
                    data = new List<dynamic>(),
                    columns = new List<dynamic>(),
                    totalRecords = 0,
                    pageIndex = 0,
                    pageSize = 10,
                    totalPages = 0,
                    error = $"Failed to load data: {ex.Message}"
                });
            }
        }



        public class AgeWiseReportDto
        {
            public string? age_range { get; set; }  // Changed from 'age'
            public long countofapplicants { get; set; }
        }

        public class PensionTypeWiseReportDto
        {
            public string? Age { get; set; }          // was int Age
            public string? PensionType { get; set; }
            public int CountOfApplicants { get; set; }
        }

        public class GenderWiseReportDto
        {
            public string? Gender { get; set; }
            public int CountOfApplicants { get; set; }
        }

        // DetailedApplicationsReportDto.cs
        public class DetailedApplicationsReportDto
        {
            public string? districtname { get; set; }
            public string? tswofficename { get; set; }
            public string? application_status { get; set; }
            public string? application_pending_with { get; set; }
            public string? referencenumber { get; set; }
            public string? applicant_name { get; set; }
            public string? parentage { get; set; }
            public string? account_number { get; set; }
            public string? ifsc_code { get; set; }
            public string? bank_name { get; set; }
            public string? branch_name { get; set; }
            public int totalcount { get; set; }
        }

        [HttpGet]
        public IActionResult GetApplicationsForReports(int AccessCode, int Serviceid, string? StatusType = null, string ReportType = "TehsilWise", string? DataType = null, DateTime? StartDate = null, DateTime? EndDate = null, int pageIndex = 0, int pageSize = 10)
        {
            try
            {
                var officer = GetOfficerDetails();
                if (officer == null)
                    return BadRequest(new { error = "Officer details not found" });

                // Log officer details for debugging (remove in production)
                _logger.LogInformation($"Officer Details - Role: {officer.Role}, AccessLevel: {officer.AccessLevel}, AccessCode: {officer.AccessCode}");

                List<dynamic> data;
                List<dynamic> columns;
                int totalRecords;

                switch (ReportType)
                {
                    case "AgeWise":
                        try
                        {
                            object startDateParam = StartDate.HasValue ? (object)StartDate.Value : DBNull.Value;
                            object endDateParam = EndDate.HasValue ? (object)EndDate.Value : DBNull.Value;

                            var ageParameters = new[]
                            {
                                new NpgsqlParameter("@serviceid", NpgsqlDbType.Integer) { Value = Serviceid },
                                new NpgsqlParameter("@accesslevel", NpgsqlDbType.Varchar) { Value = officer.AccessLevel == "Tehsil" ? "Tehsil" : officer.AccessLevel == "Division" ? "Division" : "District" },
                                new NpgsqlParameter("@accesscode", NpgsqlDbType.Integer) { Value = officer.AccessCode }, // Use officer's access code
                                new NpgsqlParameter("@applicationstatus", NpgsqlDbType.Varchar) { Value = StatusType ?? "total" },
                                new NpgsqlParameter("@datatype", NpgsqlDbType.Varchar) { Value = DataType ?? (object)DBNull.Value },
                                new NpgsqlParameter("@startdate", NpgsqlDbType.Timestamp) { Value = startDateParam },
                                new NpgsqlParameter("@enddate", NpgsqlDbType.Timestamp) { Value = endDateParam }
                            };

                            _logger.LogInformation($"AgeWise report - Serviceid: {Serviceid}, AccessLevel: {officer.AccessLevel}, AccessCode: {officer.AccessCode}, Status: {StatusType ?? "NULL"}, DataType: {DataType ?? "NULL"}, StartDate: {StartDate?.ToString("yyyy-MM-dd") ?? "NULL"}, EndDate: {EndDate?.ToString("yyyy-MM-dd") ?? "NULL"}");

                            var ageData = dbcontext.Database
                                .SqlQueryRaw<AgeWiseReportDto>(
                                    "SELECT * FROM get_age_counts_filtered(@serviceid, @accesslevel, @accesscode, @applicationstatus, @datatype, @startdate, @enddate)",
                                    ageParameters)
                                .ToList();

                            _logger.LogInformation($"AgeWise report returned {JsonConvert.SerializeObject(ageData)} records");

                            totalRecords = ageData.Count;
                            data = ageData.Skip(pageIndex * pageSize).Take(pageSize).ToList<dynamic>();
                            columns = new List<dynamic>
                            {
                                new { accessorKey = "age_range", header = "Age Range" },  // Changed header
                                new { accessorKey = "countofapplicants", header = "Beneficiary Count" }
                            };
                        }
                        catch (Exception ex)
                        {
                            _logger.LogError(ex, "AgeWise report failed");
                            return StatusCode(500, new { error = "AgeWise report failed", details = ex.Message });
                        }
                        break;

                    // Inside the switch case for "PensionTypeWise"
                    case "PensionTypeWise":
                        try
                        {
                            object startDateParam = StartDate.HasValue ? (object)StartDate.Value : DBNull.Value;
                            object endDateParam = EndDate.HasValue ? (object)EndDate.Value : DBNull.Value;

                            // Default to "sanctioned" if StatusType is not provided
                            string statusParam = string.IsNullOrEmpty(StatusType) ? "sanctioned" : StatusType;

                            var pensionParameters = new[]
                            {
                                new NpgsqlParameter("@serviceid", NpgsqlDbType.Integer) { Value = Serviceid },
                                new NpgsqlParameter("@accesslevel", NpgsqlDbType.Varchar) { Value = officer.AccessLevel == "Tehsil" ? "Tehsil" : "District" },
                                new NpgsqlParameter("@accesscode", NpgsqlDbType.Integer) { Value = officer.AccessCode },
                                new NpgsqlParameter("@applicationstatus", NpgsqlDbType.Varchar) { Value = statusParam },
                                new NpgsqlParameter("@datatype", NpgsqlDbType.Varchar) { Value = DataType ?? (object)DBNull.Value },
                                new NpgsqlParameter("@startdate", NpgsqlDbType.Timestamp) { Value = startDateParam },
                                new NpgsqlParameter("@enddate", NpgsqlDbType.Timestamp) { Value = endDateParam }
                            };

                            _logger.LogInformation($"PensionTypeWise report - Serviceid: {Serviceid}, AccessLevel: {officer.AccessLevel}, AccessCode: {officer.AccessCode}, Status: {statusParam}");

                            // ✅ Aliased columns to match DTO property names
                            var pensionData = dbcontext.Database
                                .SqlQueryRaw<PensionTypeWiseReportDto>(
                                    "SELECT age_range AS \"Age\", pensiontype AS \"PensionType\", countofapplicants AS \"CountOfApplicants\" " +
                                    "FROM get_age_and_pension_counts(@serviceid, @accesslevel, @accesscode, @applicationstatus, @datatype, @startdate, @enddate)",
                                    pensionParameters)
                                .ToList();

                            totalRecords = pensionData.Count;
                            data = pensionData.Skip(pageIndex * pageSize).Take(pageSize).ToList<dynamic>();

                            columns = new List<dynamic>
                            {
                                new { accessorKey = "age", header = "Age Range" },      // header updated for clarity
                                new { accessorKey = "pensionType", header = "Pension Type" },
                                new { accessorKey = "countOfApplicants", header = "Beneficiary Count" }
                            };
                        }
                        catch (Exception ex)
                        {
                            _logger.LogError(ex, "PensionTypeWise report failed");
                            return StatusCode(500, new { error = "PensionTypeWise report failed", details = ex.Message });
                        }
                        break;

                    case "GenderWise":
                        try
                        {
                            var genderParameters = new[]
                            {
                        new NpgsqlParameter("@serviceid", NpgsqlDbType.Integer) { Value = Serviceid },
                        new NpgsqlParameter("@accesslevel", NpgsqlDbType.Varchar) { Value = officer.AccessLevel == "Tehsil" ? "Tehsil" : "District" },
                        new NpgsqlParameter("@accesscode", NpgsqlDbType.Integer) { Value = officer.AccessCode }, // Use officer's access code
                        new NpgsqlParameter("@applicationstatus", NpgsqlDbType.Varchar) { Value = StatusType ?? "total" },
                        new NpgsqlParameter("@datatype", NpgsqlDbType.Varchar) { Value = DataType ?? (object)DBNull.Value }
                    };

                            _logger.LogInformation($"GenderWise report - Serviceid: {Serviceid}, AccessLevel: {officer.AccessLevel}, AccessCode: {officer.AccessCode}");

                            var genderData = dbcontext.Database
                                .SqlQueryRaw<GenderWiseReportDto>(
                                    "SELECT * FROM get_gender_counts(@serviceid, @accesslevel, @accesscode, @applicationstatus, @datatype)",
                                    genderParameters)
                                .ToList();

                            totalRecords = genderData.Count;
                            data = genderData.Skip(pageIndex * pageSize).Take(pageSize).ToList<dynamic>();
                            columns = new List<dynamic>
                    {
                        new { accessorKey = "gender", header = "Gender" },
                        new { accessorKey = "countOfApplicants", header = "Beneficiary Count" }
                    };
                        }
                        catch (Exception ex)
                        {
                            _logger.LogError(ex, "GenderWise report failed");
                            return StatusCode(500, new { error = "GenderWise report failed", details = ex.Message });
                        }
                        break;

                    case "DetailedApplications":
                        try
                        {
                            // For DetailedApplications, we IGNORE the incoming AccessCode and use officer's own
                            // This is the key fix - we don't use the AccessCode parameter from the URL

                            var detailedParameters = new[]
                            {
                        new NpgsqlParameter("@p_role", NpgsqlDbType.Varchar) { Value = officer.Role ?? (object)DBNull.Value },
                        new NpgsqlParameter("@p_access_level", NpgsqlDbType.Varchar) { Value = officer.AccessLevel ?? (object)DBNull.Value },
                        new NpgsqlParameter("@p_access_code", NpgsqlDbType.Integer) { Value = officer.AccessCode }, // Use officer's access code, NOT the passed AccessCode
                        new NpgsqlParameter("@p_application_status", NpgsqlDbType.Varchar) { Value = string.IsNullOrEmpty(StatusType) ? DBNull.Value : StatusType },
                        new NpgsqlParameter("@p_service_id", NpgsqlDbType.Integer) { Value = Serviceid },
                        new NpgsqlParameter("@p_page_index", NpgsqlDbType.Integer) { Value = pageIndex },
                        new NpgsqlParameter("@p_page_size", NpgsqlDbType.Integer) { Value = pageSize },
                        new NpgsqlParameter("@p_is_paginated", NpgsqlDbType.Boolean) { Value = true },
                        new NpgsqlParameter("@p_data_type", NpgsqlDbType.Varchar) { Value = string.IsNullOrEmpty(DataType) ? DBNull.Value : DataType },
                        new NpgsqlParameter("@p_division_code", NpgsqlDbType.Integer) { Value = DBNull.Value }
                    };

                            // Log the actual values being passed to the function
                            _logger.LogInformation($"DetailedApplications report - " +
                                $"Role: {officer.Role}, " +
                                $"AccessLevel: {officer.AccessLevel}, " +
                                $"AccessCode: {officer.AccessCode} (using officer's own, ignoring URL AccessCode: {AccessCode}), " +
                                $"Serviceid: {Serviceid}, " +
                                $"Status: {StatusType ?? "NULL"}, " +
                                $"PageIndex: {pageIndex}, " +
                                $"PageSize: {pageSize}");

                            var detailedData = dbcontext.Database
                                .SqlQueryRaw<DetailedApplicationsReportDto>(
                                    "SELECT * FROM get_applications_for_officer_report(@p_role, @p_access_level, @p_access_code, @p_application_status, @p_service_id, @p_page_index, @p_page_size, @p_is_paginated, @p_data_type, @p_division_code)",
                                    detailedParameters)
                                .ToList();

                            totalRecords = detailedData.FirstOrDefault()?.totalcount ?? 0;
                            data = detailedData.Cast<dynamic>().ToList();

                            _logger.LogInformation($"DetailedApplications report returned {detailedData.Count} records, totalcount: {totalRecords}");

                            columns = new List<dynamic>
                    {
                        new { accessorKey = "districtname", header = "District" },
                        new { accessorKey = "tswofficename", header = "TSWO Office" },
                        new { accessorKey = "application_status", header = "Application Status" },
                        new { accessorKey = "application_pending_with", header = "Application Pending With" },
                        new { accessorKey = "referencenumber", header = "Reference Number" },
                        new { accessorKey = "applicant_name", header = "Applicant Name" },
                        new { accessorKey = "parentage", header = "Parentage" },
                        new { accessorKey = "account_number", header = "Account Number" },
                        new { accessorKey = "ifsc_code", header = "IFSC Code" },
                        new { accessorKey = "bank_name", header = "Bank Name" },
                        new { accessorKey = "branch_name", header = "Branch Name" }
                    };
                        }
                        catch (Exception ex)
                        {
                            _logger.LogError(ex, "Detailed Applications report failed");
                            return StatusCode(500, new { error = "Detailed Applications report failed", details = ex.Message });
                        }
                        break;

                    case "TehsilWise":
                    default:
                        try
                        {
                            var tehsilParameters = new[]
                            {
                        new NpgsqlParameter("@accesscode", NpgsqlDbType.Integer) { Value = officer.AccessCode }, // Use officer's access code
                        new NpgsqlParameter("@serviceid", NpgsqlDbType.Integer) { Value = Serviceid },
                        new NpgsqlParameter("@accesslevel", NpgsqlDbType.Varchar) { Value = officer.AccessLevel == "Tehsil" ? "Tehsil" : "District" }
                    };

                            _logger.LogInformation($"TehsilWise report - Serviceid: {Serviceid}, AccessLevel: {officer.AccessLevel}, AccessCode: {officer.AccessCode}");

                            var tehsilData = dbcontext.Database
                                .SqlQueryRaw<SummaryReports>(
                                    "SELECT * FROM get_applications_for_report(@accesscode, @serviceid, @accesslevel)",
                                    tehsilParameters)
                                .ToList();

                            totalRecords = tehsilData.Count;
                            data = tehsilData.Skip(pageIndex * pageSize).Take(pageSize).ToList<dynamic>();
                            columns = new List<dynamic>
                    {
                        new { accessorKey = "tehsilName", header = "Tehsil Name" },
                        new { accessorKey = "totalApplicationsSubmitted", header = "Total Applications Received" },
                        new { accessorKey = "totalApplicationsPending", header = "Total Applications Pending" },
                        new { accessorKey = "totalApplicationsReturnToEdit", header = "Pending With Citizens" },
                        new { accessorKey = "totalApplicationsSanctioned", header = "Total Sanctioned" },
                        new { accessorKey = "totalApplicationsRejected", header = "Total Rejected" }
                    };
                        }
                        catch (Exception ex)
                        {
                            _logger.LogError(ex, "TehsilWise report failed");
                            return StatusCode(500, new { error = "TehsilWise report failed", details = ex.Message });
                        }
                        break;
                }

                return Json(new
                {
                    data,
                    columns,
                    totalRecords,
                    pageIndex,
                    pageSize,
                    totalPages = (int)Math.Ceiling(totalRecords / (double)pageSize)
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error executing report for AccessCode: {AccessCode}, Serviceid: {Serviceid}, ReportType: {ReportType}");
                return StatusCode(500, new
                {
                    error = "An error occurred while fetching the report",
                    details = ex.Message,
                    reportType = ReportType,
                    serviceId = Serviceid,
                    accessCode = AccessCode
                });
            }
        }



        [HttpGet]
        public IActionResult GetUserDetails(string applicationId)
        {
            var officer = GetOfficerDetails();
            var details = dbcontext.CitizenApplications.FirstOrDefault(ca => ca.Referencenumber == applicationId);
            if (details == null)
                return Json(new { error = "Application not found" });

            // PostgreSQL function call for corrigendum
            var parameters = new[]
            {
                new NpgsqlParameter("@officeraccesslevel", officer.AccessLevel),
                new NpgsqlParameter("@officeraccesscode", officer.AccessCode),
                new NpgsqlParameter("@referencenumber", applicationId),
                new NpgsqlParameter("@status", DBNull.Value),
                new NpgsqlParameter("@corrigendumid", DBNull.Value),
                new NpgsqlParameter("@type", DBNull.Value),
                new NpgsqlParameter("@officerrole", officer.Role)
            };

            var IsCorrigendumPending = dbcontext.Corrigendum
               .FromSqlRaw("SELECT * FROM get_corrigendum_by_location_access(@officeraccesslevel, @officeraccesscode, @referencenumber, @status, @corrigendumid, @type, @officerrole)", parameters)
               .ToList();

            var formDetailsToken = JToken.Parse(details.Formdetails!);
            var privatedFields = JsonConvert.DeserializeObject<List<string>>(
                dbcontext.Services.FirstOrDefault(s => s.Serviceid == details.Serviceid)?.Privatefields ?? "[]"
            );

            _logger.LogInformation($"-------------------- Corrigendum Count: {IsCorrigendumPending.Count} -----------------------");

            bool hasPending = false;
            string corrigendumType = "";
            List<dynamic> corrigendumFieldChanges = new List<dynamic>();
            List<string> corrigendumFiles = new List<string>();
            string pendingRemarks = "";
            int currentCorrigendumPlayer = -1;
            JArray? corrigendumWorkflow = null;
            List<dynamic>? corrigendumActions = null;
            bool canTakeCorrigendumAction = false;
            bool canTakeAction = false;

            if (IsCorrigendumPending.Count != 0)
            {
                foreach (var application in IsCorrigendumPending)
                {
                    var workflowArray = JArray.Parse(application.Workflow);
                    hasPending = workflowArray.Any(item => string.Equals((string)item["status"]!, "pending", StringComparison.OrdinalIgnoreCase));
                    corrigendumType = application.Type!;
                    currentCorrigendumPlayer = application.Currentplayer;
                    corrigendumWorkflow = workflowArray;

                    if (application.Corrigendumfields != null)
                    {
                        var corrigendumFields = JObject.Parse(application.Corrigendumfields);
                        pendingRemarks = corrigendumFields["remarks"]?.ToString() ?? "";

                        var corFiles = corrigendumFields["Files"] as JObject;
                        if (corFiles != null)
                        {
                            corrigendumFiles = corFiles
                                .Properties()
                                .SelectMany(p => p.Value is JArray arr
                                    ? arr.Select(f => f?.ToString()).Where(f => !string.IsNullOrWhiteSpace(f))
                                    : Enumerable.Empty<string>())
                                .ToList()!;
                        }

                        var stack = new Stack<(string path, JToken field)>();
                        foreach (var item in corrigendumFields)
                        {
                            if (item.Key != "remarks" && item.Key != "Files" && item.Value is JObject)
                            {
                                stack.Push((item.Key, item.Value));
                            }
                        }

                        int fieldIndex = 1;
                        while (stack.Count > 0)
                        {
                            var (path, field) = stack.Pop();
                            string header = Regex.Replace(path, "(\\B[A-Z])", " $1");
                            string oldValue = field["old_value"]?.ToString() ?? "";
                            string newValue = field["new_value"]?.ToString() ?? "";

                            if (path.IndexOf("Date", StringComparison.OrdinalIgnoreCase) >= 0)
                            {
                                if (DateTime.TryParse(oldValue, out DateTime oldDt))
                                    oldValue = oldDt.ToString("dd MMM yyyy");
                                if (DateTime.TryParse(newValue, out DateTime newDt))
                                    newValue = newDt.ToString("dd MMM yyyy");
                            }

                            corrigendumFieldChanges.Add(new
                            {
                                sno = fieldIndex,
                                formField = header,
                                oldvalue = oldValue,
                                newvalue = newValue
                            });
                            fieldIndex++;

                            var additionalValues = field["additional_values"];
                            if (additionalValues != null && additionalValues is JObject nested)
                            {
                                foreach (var nestedItem in nested)
                                {
                                    string nestedPath = $"{path}.{nestedItem.Key}";
                                    stack.Push((nestedPath, nestedItem.Value)!);
                                }
                            }
                        }

                        if ((application.Type == "Corrigendum" && application.Status == "Sanctioned") ||
                            (application.Type == "Correction" && application.Status == "Verified"))
                        {
                            foreach (var field in corrigendumFields.Properties())
                            {
                                if (field.Name == "Files" || field.Name == "remarks")
                                    continue;
                                var newValue = field.Value["new_value"]?.ToString();
                                if (!string.IsNullOrEmpty(newValue))
                                {
                                    UpdateFieldValueRecursively(formDetailsToken, field.Name, newValue);
                                }
                            }
                        }
                    }

                    if (hasPending && corrigendumWorkflow != null &&
                        currentCorrigendumPlayer >= 0 && currentCorrigendumPlayer < corrigendumWorkflow.Count)
                    {
                        var currentCorrigendumOfficer = corrigendumWorkflow[currentCorrigendumPlayer];
                        if (currentCorrigendumOfficer["designation"]?.ToString() == officer.Role &&
                            currentCorrigendumOfficer["status"]?.ToString() == "pending")
                        {
                            canTakeCorrigendumAction = true;
                            corrigendumActions = BuildCorrigendumActions(corrigendumWorkflow, currentCorrigendumPlayer,
                                corrigendumType, formDetailsToken);
                        }
                    }
                }
            }

            var serviceDetails = dbcontext.Services.FirstOrDefault(s => s.Serviceid == details.Serviceid);
            bool isSanctioned = details.Status == "Sanctioned";

            formDetailsToken = ReorderFormDetails(formDetailsToken, applicationId, isSanctioned);
            var formDetails = JsonConvert.DeserializeObject<dynamic>(details.Formdetails!);
            var officerArray = JsonConvert.DeserializeObject<JArray>(details.Workflow!);
            _logger.LogInformation($"-------------------- Current Player Index: {details.Currentplayer} ----------------------- Officer Array Count: {officerArray} -----------------------");
            int currentPlayer = details.Currentplayer ?? 0;

            // NEW: Collect all previous officers' declarations and recommendations
            List<dynamic> previousOfficersDetails = new List<dynamic>();
            JObject previousAdditionalDetails = new JObject(); // Kept for backward compatibility

            // Collect all previous officers' details (excluding current officer)
            for (int i = 0; i < currentPlayer; i++)
            {
                var prevOfficer = officerArray![i];
                var designation = prevOfficer["designation"]?.ToString() ?? "";
                var accessLevel = prevOfficer["accessLevel"]?.ToString() ?? "";
                var status = prevOfficer["status"]?.ToString() ?? "";
                var officerArea = GetOfficerArea(accessLevel, formDetails);

                // Get additional details (declarations, recommendations, etc.)
                var additionalDetails = prevOfficer["additionalDetails"] as JObject;
                var remarks = additionalDetails?["remarks"]?.ToString() ?? "";
                var recommendation = additionalDetails?["recommendation"]?.ToString() ?? "";
                var recommendationRemarks = additionalDetails?["recommendationRemarks"]?.ToString() ?? "";

                // Get all action form fields if they exist
                var actionForm = prevOfficer["actionForm"] as JArray;
                List<dynamic> actionFormFields = new List<dynamic>();

                if (actionForm != null)
                {
                    foreach (var field in actionForm)
                    {
                        var fieldObj = field as JObject;
                        if (fieldObj != null)
                        {
                            actionFormFields.Add(new
                            {
                                label = fieldObj["label"]?.ToString() ?? "",
                                value = fieldObj["value"]?.ToString() ?? "",
                                type = fieldObj["type"]?.ToString() ?? ""
                            });
                        }
                    }
                }

                // Add officer details to the list
                previousOfficersDetails.Add(new
                {
                    officerDesignation = designation,
                    officerArea,
                    fullOfficerInfo = $"{designation} {officerArea}",
                    status,
                    remarks,
                    recommendation,
                    recommendationRemarks,
                    additionalDetails = additionalDetails ?? new JObject(),
                    actionFormFields,
                    playerIndex = i,
                    actionDate = additionalDetails?["actionDate"]?.ToString() ?? ""
                });

                // For backward compatibility, keep the immediate previous officer's details
                if (i == currentPlayer - 1)
                {
                    previousAdditionalDetails = additionalDetails ?? new JObject();
                }
            }

            UpdateWorkflowFlags(officerArray!, currentPlayer);
            details.Workflow = JsonConvert.SerializeObject(officerArray);
            dbcontext.SaveChanges();

            var mainCurrentOfficer = officerArray!.FirstOrDefault(o => (int)o["playerId"]! == currentPlayer);
            var currentOfficerClone = mainCurrentOfficer != null ? (JObject)mainCurrentOfficer.DeepClone() : new JObject();

            canTakeAction = mainCurrentOfficer
                != null && mainCurrentOfficer["designation"]?.ToString() == officer.Role
                && mainCurrentOfficer["status"]?.ToString() == "pending";

            InjectEditableActionForm(currentOfficerClone, serviceDetails, currentPlayer);
            UpdateOfficerActionFormLabels(currentOfficerClone, formDetails);
            ReplaceCodeFieldsWithNames(formDetailsToken);
            FormatDateFields(formDetailsToken);

            var corrigendumData = new
            {
                hasPendingCorrigendum = hasPending,
                corrigendumType,
                fieldChanges = corrigendumFieldChanges,
                files = corrigendumFiles.Any() ? corrigendumFiles : new List<string> { "NO FILES" },
                remarks = pendingRemarks,
                canTakeAction = canTakeCorrigendumAction,
                actions = corrigendumActions ?? new List<dynamic>(),
                currentPlayerIndex = currentCorrigendumPlayer,
                workflow = corrigendumWorkflow
            };

            return Json(new
            {
                list = formDetailsToken,
                currentOfficerDetails = currentOfficerClone,
                hasPending,
                privatedFields,
                previousOfficersDetails, // NEW: Array of all previous officers
                isSanctioned,
                corrigendum = corrigendumData,
                canTakeAction,
                previousAdditionalDetails // Kept for backward compatibility
            });
        }

        private List<dynamic> BuildCorrigendumActions(JArray workflow, int currentPlayerIndex,
            string corrigendumType, JToken formDetails)
        {
            var actions = new List<dynamic> { new { label = "Reject", value = "reject" } };

            if (currentPlayerIndex > 0)
            {
                var prevOfficer = workflow[currentPlayerIndex - 1];
                string prevOfficerDesignation = (string)prevOfficer["designation"]!;
                string prevOfficerAccessLevel = (string)prevOfficer["accessLevel"]!;
                string officerArea = GetOfficerArea(prevOfficerAccessLevel, formDetails);
                actions.Add(new { label = $"Return to {prevOfficerDesignation} {officerArea}", value = "return" });

                // For Correction type, add Verify action
                if (corrigendumType == "Correction")
                {
                    actions.Add(new { label = $"Verify", value = "verified" });
                }
            }

            // Check if current officer is sanction officer
            var sanctionOfficer = workflow.FirstOrDefault(o => o["status"]?.ToString() == "sanctioned");
            var currentCorrigendumOfficer = workflow[currentPlayerIndex]; // Renamed

            if (sanctionOfficer != null && sanctionOfficer["designation"]?.ToString() == currentCorrigendumOfficer["designation"]?.ToString())
            {
                actions.Add(new { label = $"Issue {corrigendumType}", value = "sanction" });
            }
            else if (workflow.Count > currentPlayerIndex + 1)
            {
                var nextOfficer = workflow[currentPlayerIndex + 1];
                string nextOfficerDesignation = (string)nextOfficer["designation"]!;
                string nextOfficerAccessLevel = (string)nextOfficer["accessLevel"]!;
                string officerArea = GetOfficerArea(nextOfficerAccessLevel, formDetails);
                actions.Add(new { label = $"Forward to {nextOfficerDesignation} {officerArea}", value = "forward" });
            }

            return actions;
        }


        [HttpGet]
        public async Task<IActionResult> GetSanctionLetter(string applicationId)
        {
            OfficerDetailsModal officer = GetOfficerDetails();
            var formdetails = dbcontext.CitizenApplications.FirstOrDefault(fd => fd.Referencenumber == applicationId);
            var lettersJson = dbcontext.Services
                       .FirstOrDefault(s => s.Serviceid == Convert.ToInt32(formdetails!.Serviceid))?.Letters;

            var parsed = JsonConvert.DeserializeObject<Dictionary<string, dynamic>>(lettersJson!);
            dynamic? sanctionSection = parsed!.TryGetValue("Sanction", out var sanction) ? sanction : null;
            var tableFields = sanctionSection!.tableFields;
            var sanctionLetterFor = sanctionSection.letterFor;
            var information = sanctionSection.information;

            var details = dbcontext.CitizenApplications
                .FirstOrDefault(ca => ca.Referencenumber == applicationId);



            var formData = JsonConvert.DeserializeObject<JObject>(details!.Formdetails!);

            // Final key-value pair list for the PDF
            var pdfFields = new Dictionary<string, string>();

            foreach (var item in tableFields)
            {
                var formatted = GetFormattedValue(item, formData);
                string label = formatted.Label ?? "[Label Missing]";
                string value = formatted.Value ?? "";

                pdfFields[label] = value;
            }

            // Call your PDF generator
            await _pdfService.CreateSanctionPdf(pdfFields, sanctionLetterFor?.ToString() ?? "", information?.ToString() ?? "", officer, applicationId);
            string fileName = applicationId.Replace("/", "_") + "_SanctionLetter.pdf";

            return Json(new
            {
                status = true,
                path = fileName
            });
        }

        [HttpGet]
        public async Task<IActionResult> GetApplicationHistory(string ApplicationId, int page = 0, int size = 20)
        {
            if (string.IsNullOrEmpty(ApplicationId))
            {
                return BadRequest("ApplicationId is required.");
            }

            var application = await dbcontext.CitizenApplications
                .FirstOrDefaultAsync(ca => ca.Referencenumber == ApplicationId);

            if (application == null)
            {
                return NotFound("Application not found.");
            }

            var players = JsonConvert.DeserializeObject<JArray>(application.Workflow!);
            int? currentPlayerIndex = (int)application.Currentplayer!;
            var currentPlayer = players!.FirstOrDefault(o => (int)o["playerId"]! == currentPlayerIndex);

            var formDetails = JsonConvert.DeserializeObject<dynamic>(application.Formdetails!);

            // Fetch history and parse dates safely
            var history = await dbcontext.Actionhistory
                .Where(ah => ah.Referencenumber == ApplicationId)
                .ToListAsync();

            _logger.LogInformation($"-------------------- Application History Count: {history.Count} -----------------------");

            // Helper to safely parse Actiontakendate in multiple formats
            DateTime? ParseActionDate(string? dateStr)
            {
                if (string.IsNullOrWhiteSpace(dateStr))
                    return null;

                dateStr = dateStr.Trim();

                var formats = new[]
                {
                    "dd MMM yyyy hh:mm:ss tt",   // 17 Dec 2025 09:40:41 PM
                    "dd-MM-yyyy HH:mm:ss",       // 21-01-2025 13:24:13
                    "dd-MM-yyyy hh:mm:ss tt",   // 21-01-2025 09:40:41 PM
                    "dd/MM/yyyy HH:mm:ss",       // 21/01/2025 13:24:13
                    "dd MMM yyyy HH:mm:ss"       // 17 Dec 2025 13:24:13 (if no AM/PM)
                };

                if (DateTime.TryParseExact(dateStr, formats, CultureInfo.InvariantCulture, DateTimeStyles.None, out DateTime parsed))
                    return parsed;

                // Fallback: let .NET guess
                if (DateTime.TryParse(dateStr, CultureInfo.InvariantCulture, DateTimeStyles.None, out parsed))
                    return parsed;

                _logger.LogWarning("Failed to parse Actiontakendate: '{Date}' for ApplicationId: {AppId}", dateStr, ApplicationId);
                return null;
            }

            // Sort history by parsed date (ascending = oldest first)
            var sortedHistory = history
                .Select(h => new
                {
                    Item = h,
                    ParsedDate = ParseActionDate(h.Actiontakendate)
                })
                .Where(x => x.ParsedDate.HasValue)
                .OrderBy(x => x.ParsedDate) // Oldest → Newest
                .Select(x => x.Item)
                .ToList();

            // Add unparseable entries at the end (optional, or skip them)
            var unparseable = history.Except(sortedHistory).ToList();
            sortedHistory.AddRange(unparseable);

            // Build response data
            var columns = new List<dynamic>
            {
                new { header = "S.No", accessorKey = "sno" },
                new { header = "Action Taker", accessorKey = "actionTaker" },
                new { header = "Action Taken", accessorKey = "actionTaken" },
                new { header = "Remarks", accessorKey = "remarks" },
                new { header = "Action Taken On", accessorKey = "actionTakenOn" },
            };

            List<dynamic> data = new();
            int index = 1;

            foreach (var item in sortedHistory)
            {
                string officerArea = GetOfficerAreaForHistory(item.Locationlevel!, item.Locationvalue);

                string actionTaker = item.Actiontaker != "Citizen"
                    ? $"{item.Actiontaker} {officerArea}".Trim()
                    : "Citizen";

                string actionTaken = item.Actiontaken == "ReturnToCitizen"
                    ? "Returned to citizen for correction"
                    : item.Actiontaken == "ReturnToPlayer"
                        ? "Returned to previous officer for correction"
                    : item.Actiontaken ?? "";

                data.Add(new
                {
                    sno = index++,
                    actionTaker,
                    actionTaken,
                    remarks = item.Remarks ?? "",
                    actionTakenOn = item.Actiontakendate ?? ""
                });
            }

            // Add current pending step if status is "pending"
            if (currentPlayer != null && (string?)currentPlayer["status"] == "pending")
            {
                string designation = (string)currentPlayer["designation"]!;
                string accessLevel = (string)currentPlayer["accessLevel"]!;
                string officerArea = GetOfficerArea(accessLevel, formDetails);

                data.Add(new
                {
                    sno = index++,
                    actionTaker = $"{designation} {officerArea}".Trim(),
                    actionTaken = "Pending",
                    remarks = (string?)null,
                    actionTakenOn = ""
                });
            }

            // Optional: Apply pagination
            var paginatedData = data
                .Skip(page * size)
                .Take(size)
                .ToList();

            int totalRecords = data.Count;

            return Json(new
            {
                data = paginatedData,
                columns,
                totalRecords,
                customActions = new { }
            });
        }

        public IActionResult GetWithheldApplication(string referenceNumber, string serviceId)
        {
            if (string.IsNullOrEmpty(referenceNumber) || string.IsNullOrEmpty(serviceId))
            {
                return Json(new { status = false, response = "Reference number and service ID are required." });
            }

            if (!int.TryParse(serviceId, out int parsedServiceId))
            {
                return Json(new { status = false, response = "Invalid service ID format." });
            }

            var officer = GetOfficerDetails();
            if (officer == null)
            {
                return Json(new { status = false, response = "Unauthorized: Officer details not found." });
            }

            var withheldApplication = dbcontext.WithheldApplications
                .FirstOrDefault(wa => wa.Referencenumber == referenceNumber && wa.Serviceid == parsedServiceId);

            var CitizenApplications = dbcontext.CitizenApplications
                .FirstOrDefault(ca => ca.Referencenumber == referenceNumber);

            var service = dbcontext.Services.FirstOrDefault(s => s.Serviceid == parsedServiceId);

            List<dynamic> workflow;
            try
            {
                workflow = JsonConvert.DeserializeObject<List<dynamic>>(service!.Officereditablefield!) ?? new List<dynamic>();
            }
            catch (JsonException ex)
            {
                return StatusCode(500, $"Error parsing workflow: {ex.Message}");
            }

            if (workflow.Count == 0)
                return Json(new { status = false, response = "No workflow defined for this service." });

            // Find current officer in workflow
            dynamic currentOfficer = workflow.FirstOrDefault(p => p.designation == officer.Role)!;
            if (currentOfficer == null)
                return Json(new { status = false, response = "Officer not part of the workflow." });

            int currentPlayerId = (int)currentOfficer.playerId;
            bool isLastPlayer = currentPlayerId == workflow.Count - 1;

            // Get authorities
            bool canWithhold = (bool?)currentOfficer.canWithhold ?? false;
            bool canDirectWithheld = (bool?)currentOfficer.canDirectWithheld ?? false;

            // Determine if current officer is the one who sanctioned
            bool isSanctioningOfficer = false;
            if (CitizenApplications != null && !string.IsNullOrEmpty(CitizenApplications.Workflow))
            {
                try
                {
                    var citizenWorkflowHistory = JsonConvert.DeserializeObject<List<dynamic>>(CitizenApplications.Workflow);
                    var sanctionEntry = citizenWorkflowHistory?
                        .LastOrDefault(h => h.status?.ToString()?.Equals("sanctioned", StringComparison.OrdinalIgnoreCase) == true);

                    if (sanctionEntry != null)
                    {
                        var sanctionPlayerId = sanctionEntry.playerId != null ? (int)sanctionEntry.playerId : -1;
                        var sanctionDesignation = sanctionEntry.designation?.ToString() ?? "";
                        var sanctionOfficerName = sanctionEntry.officer?.ToString() ?? "";

                        if (sanctionPlayerId == currentPlayerId ||
                            sanctionDesignation.Equals(officer.Role, StringComparison.OrdinalIgnoreCase) ||
                            sanctionOfficerName.Equals(officer.Name, StringComparison.OrdinalIgnoreCase))
                        {
                            isSanctioningOfficer = true;
                        }
                    }
                }
                catch (JsonException ex)
                {
                    _logger.LogError($"Error parsing CitizenApplications.Workflow: {ex.Message}");
                }
            }

            if (withheldApplication == null)
            {
                if (CitizenApplications == null)
                {
                    return Json(new { status = false, response = "Application not found." });
                }
                if (CitizenApplications.Status != "Sanctioned")
                {
                    return Json(new { status = false, response = "Application is not sanctioned and cannot be withheld." });
                }
            }

            // Determine if current officer can remove from withheld
            bool canRemoveFromWithheld = false;
            bool isWithholdingOfficer = false;
            bool isFirstOfficer = false; // Flag to check if this is the first officer in the withheld workflow

            if (withheldApplication != null)
            {
                // Parse workflow history to find who withheld
                var historyList = JsonConvert.DeserializeObject<List<dynamic>>(withheldApplication.History ?? "[]");

                // Check if this is the first officer in the withheld history
                var firstWithheldEntry = historyList?.FirstOrDefault(h => h.status == "withheld");
                isFirstOfficer = firstWithheldEntry != null &&
                                firstWithheldEntry!.ContainsKey("playerId") &&
                                (int)firstWithheldEntry!.playerId == currentPlayerId;

                var withheldEntry = historyList?.LastOrDefault(h => h.status == "withheld" || h.status == "approved");
                if (withheldEntry != null)
                {
                    var withheldPlayer = historyList?.Where(h => h.status == "withheld" || h.status == "approved")
                                                   .OrderByDescending(h => h.actionTakenOn)
                                                   .FirstOrDefault();
                    if (withheldPlayer != null && withheldPlayer!.ContainsKey("playerId"))
                    {
                        int withheldPlayerId = (int)withheldPlayer!.playerId;
                        isWithholdingOfficer = currentPlayerId == withheldPlayerId;
                        canRemoveFromWithheld = currentPlayerId >= withheldPlayerId;
                    }
                }
            }

            // Check if there's a pending release request
            bool hasPendingReleaseRequest = false;
            string pendingReleaseFromPlayer = "";
            if (withheldApplication != null)
            {
                var historyList = JsonConvert.DeserializeObject<List<dynamic>>(withheldApplication.History ?? "[]");
                var pendingRequest = historyList?.LastOrDefault(h => h.status == "forwarded" &&
                                                                   (h.remarks?.ToString()?.Contains("release", StringComparison.OrdinalIgnoreCase) == true ||
                                                                    h.remarks?.ToString()?.Contains("remove", StringComparison.OrdinalIgnoreCase) == true));
                if (pendingRequest != null)
                {
                    hasPendingReleaseRequest = true;
                    pendingReleaseFromPlayer = pendingRequest.officer?.ToString() ?? "";
                }
            }

            // Build options based on scenario
            var options = new List<dynamic>();

            // Determine if officer can choose WithheldType and IsWithheld
            bool canChooseWithheldType = false;
            bool canChooseIsWithheld = false;

            if (withheldApplication == null)
            {
                // First time creation - can choose both
                canChooseWithheldType = true;
                canChooseIsWithheld = true;

                if (canWithhold && !canDirectWithheld)
                {
                    options.Add(new { label = "Forward", value = "forward" });
                }
                if (canDirectWithheld)
                {
                    options.Add(new { label = "Approve", value = "approve" });
                }
            }
            else
            {
                // Existing application - check if current officer is the first officer
                canChooseWithheldType = isFirstOfficer;
                canChooseIsWithheld = isFirstOfficer;

                if (canDirectWithheld)
                {
                    if (isSanctioningOfficer)
                    {
                        options.Add(new { label = "Approve", value = "approve" });
                    }
                    else
                    {
                        options.Add(new { label = "Forward", value = "forward" });
                    }
                }
            }

            // Build response data
            var history = withheldApplication != null ?
                JsonConvert.DeserializeObject<List<dynamic>>(withheldApplication.History ?? "[]") :
                new List<dynamic>();

            var columns = new List<dynamic>
            {
                new { header = "S.No", accessorKey="sno" },
                new { header = "Action Taker", accessorKey="actionTaker" },
                new { header = "Action Taken", accessorKey="actionTaken" },
                new { header = "Remarks", accessorKey="remarks" },
                new { header = "Action Taken On", accessorKey="actionTakenOn" },
            };

            int index = 1;
            List<dynamic> data = [];
            foreach (var item in history!)
            {
                data.Add(new
                {
                    sno = index,
                    actionTaker = item.officer,
                    actionTaken = item.status,
                    remarks = item.remarks,
                    actionTakenOn = item.actionTakenOn,
                });
                index++;
            }

            // Build application details
            var applicationDetails = new ExpandoObject() as IDictionary<string, object>;
            var withheldDetails = new ExpandoObject() as IDictionary<string, dynamic>;

            if (withheldApplication != null)
            {
                withheldDetails["withheldType"] = withheldApplication.Withheldtype;
                withheldDetails["withheldReason"] = withheldApplication.Withheldreason;
                withheldDetails["isWithheld"] = withheldApplication.Iswithheld;
                withheldDetails["currentPlayer"] = withheldApplication.Currentplayer!;
                withheldDetails["status"] = withheldApplication.Status!;
                withheldDetails["files"] = JsonConvert.DeserializeObject<List<string>>(withheldApplication.Files ?? "[]")!;
                withheldDetails["isFirstOfficer"] = isFirstOfficer;
            }

            if (CitizenApplications?.Formdetails != null)
            {
                try
                {
                    var formDetails = JToken.Parse(CitizenApplications.Formdetails);
                    var dswovalue = dbcontext.District
                        .FirstOrDefault(to => to.Districtid == Convert.ToInt32(GetFieldValue("District", formDetails)))?.Districtname ?? "N/A";

                    applicationDetails["applicantName"] = GetFieldValue("ApplicantName", formDetails) ?? "N/A";
                    applicationDetails["parentage"] = GetFieldValue("Parentage", formDetails) ?? "N/A";
                    applicationDetails["r/o"] = $"DISTRICT: {dswovalue}, ADDRESS: {GetFieldValue("PresentAddress", formDetails)}";
                }
                catch (JsonException)
                {
                    // Handle error
                }
            }

            bool recordExists = withheldApplication != null;
            bool canCreate = false;

            // Determine if officer can create/update
            if (withheldApplication == null)
            {
                canCreate = canWithhold || canDirectWithheld;
            }
            else
            {
                var currentPlayerInWithheld = withheldApplication.Currentplayer;
                canCreate = currentPlayerId == currentPlayerInWithheld;

                if (!canCreate && hasPendingReleaseRequest)
                {
                    canCreate = currentPlayerId == currentPlayerInWithheld;
                }
            }

            return Json(new
            {
                status = true,
                application = withheldDetails,
                applicationDetails = applicationDetails,
                canCreate,
                canChooseWithheldType,
                canChooseIsWithheld,
                options,
                data,
                columns,
                recordExists,
                canRemoveFromWithheld,
                isLastPlayer,
                currentPlayerId,
                canWithhold,
                canDirectWithheld,
                isWithholdingOfficer,
                isSanctioningOfficer,
                hasPendingReleaseRequest,
                pendingReleaseFromPlayer,
                isFirstOfficer
            });
        }

        [HttpGet]
        public async Task<IActionResult> GetCorrigendumSanctionLetter(string referenceNumber, string corrigendumId, string type)
        {
            try
            {
                var officer = GetOfficerDetails();
                if (officer == null)
                {
                    return Unauthorized("Officer details not found.");
                }

                var corrigendum = dbcontext.Corrigendum
                    .FirstOrDefault(c => c.Referencenumber == referenceNumber && c.Corrigendumid == corrigendumId);
                if (corrigendum == null)
                {
                    return NotFound("Corrigendum not found.");
                }

                var application = dbcontext.CitizenApplications.FirstOrDefault(ca => ca.Referencenumber == referenceNumber);
                if (application == null)
                {
                    return NotFound("Citizen application not found.");
                }

                var workflow = JArray.Parse(application.Workflow!);
                _logger.LogInformation($"Workflow: {workflow}");

                JToken sanctionedOfficer = workflow.FirstOrDefault(p => (string)p["status"]! == "sanctioned")!;
                _logger.LogInformation($"Sanction Officer: {sanctionedOfficer}");

                string? completedAtStr = (string?)sanctionedOfficer["completedAt"];
                string? sanctionDate = null;

                if (!string.IsNullOrEmpty(completedAtStr))
                {
                    // Parse the string to DateTime
                    if (DateTime.TryParse(completedAtStr, out DateTime completedAt))
                    {
                        // Format to "dd MMM yyyy"
                        sanctionDate = completedAt.ToString("dd MMM yyyy", CultureInfo.InvariantCulture);
                    }
                }

                _logger.LogInformation($"Sanction Date: {sanctionDate}");

                var service = dbcontext.Services
                    .FirstOrDefault(s => s.Serviceid == application.Serviceid);
                if (service == null)
                {
                    return NotFound("Service not found.");
                }

                var corrigendumFieldsObj = JObject.Parse(corrigendum.Corrigendumfields ?? "{}");
                corrigendumFieldsObj.Remove("Files");

                await _pdfService.CreateCorrigendumSanctionPdf(
                    corrigendumFieldsObj.ToString(),
                    referenceNumber,
                    officer,
                    service.Servicename!,
                    corrigendumId,
                    sanctionDate!,
                    type
                );

                var filePath = corrigendumId.Replace("/", "_") + $"_{type}_SanctionLetter.pdf";
                return Json(new { status = true, path = filePath });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { status = false, response = ex.Message });
            }
        }


        [HttpGet]
        public IActionResult GetApplicationForCorrigendum(string referenceNumber, string serviceId, string type, string? applicationId = null)
        {
            try
            {
                var officer = GetOfficerDetails();
                if (officer == null)
                {
                    return Json(new { status = false, message = "Officer details not found." });
                }

                if (string.IsNullOrWhiteSpace(type) || !new[] { "Corrigendum", "Correction" }.Contains(type))
                {
                    return Json(new { status = false, message = "Invalid or missing type. Must be 'Corrigendum', 'Correction'." });
                }

                if (!int.TryParse(serviceId, out int serviceIdInt))
                {
                    return Json(new { status = false, message = "Invalid serviceId. It must be a numeric value." });
                }

                // Check for any pending corrigendum (for new submissions)
                if (applicationId == null)
                {
                    var pendingCheck = dbcontext.Corrigendum
                        .FromSqlRaw("SELECT * FROM get_corrigendum_by_location_access(@p_officer_access_level, @p_officer_access_code, @p_reference_number, @p_status, @p_corrigendum_id, @p_type, @p_officer_role)",
                            new NpgsqlParameter("@p_officer_access_level", officer.AccessLevel),
                            new NpgsqlParameter("@p_officer_access_code", officer.AccessCode),
                            new NpgsqlParameter("@p_reference_number", referenceNumber),
                            new NpgsqlParameter("@p_status", DBNull.Value),
                            new NpgsqlParameter("@p_corrigendum_id", DBNull.Value),
                            new NpgsqlParameter("@p_type", type),
                            new NpgsqlParameter("@p_officer_role", officer.Role))
                        .ToList();

                    if (pendingCheck.Count != 0)
                    {
                        foreach (var application in pendingCheck)
                        {
                            if (string.IsNullOrEmpty(application.Workflow)) continue;

                            var workflowArray = JArray.Parse(application.Workflow);

                            var isAtCurrentOfficer = workflowArray.Any(item =>
                                string.Equals((string)item["role"]!, officer.Role, StringComparison.OrdinalIgnoreCase) &&
                                string.Equals((string)item["status"]!, "pending", StringComparison.OrdinalIgnoreCase));

                            if (!isAtCurrentOfficer)
                            {
                                if (application.Status?.ToLower() == "initiated")
                                {
                                    return Json(new
                                    {
                                        status = false,
                                        message = $"A {type} is already in progress for this Application Id at another officer level."
                                    });
                                }
                            }

                            if (isAtCurrentOfficer)
                            {
                                applicationId = application.Corrigendumid;
                                break;
                            }
                        }
                    }
                }

                var parameters = new[]
                {
                    new NpgsqlParameter("@referencenumber", referenceNumber),
                    new NpgsqlParameter("@role", officer.Role),
                    new NpgsqlParameter("@officeraccesslevel", officer.AccessLevel),
                    new NpgsqlParameter("@officeraccesscode", officer.AccessCode),
                    new NpgsqlParameter("@serviceid", serviceIdInt),
                    new NpgsqlParameter("@type", type)
                };

                var result = dbcontext.CitizenApplications
                    .FromSqlRaw("SELECT * FROM get_application_for_corrigendum(@referencenumber, @role, @officeraccesslevel, @officeraccesscode, @serviceid, @type)", parameters)
                    .ToList();

                if (!result.Any())
                {
                    return Json(new { status = false, message = "Application not found or you don't have access." });
                }

                var service = dbcontext.Services.FirstOrDefault(s => s.Serviceid == serviceIdInt);
                if (service == null)
                {
                    return Json(new { status = false, message = "Service not found." });
                }

                var formElements = JArray.Parse(service.Formelement ?? "[]");
                List<object> allowedForDetails = new List<object>();
                try
                {
                    JObject documentFields = string.IsNullOrEmpty(service.Documentfields)
                        ? new JObject()
                        : JObject.Parse(service.Documentfields);

                    JArray typeFields = documentFields[type] as JArray ?? new JArray();

                    foreach (var field in typeFields)
                    {
                        if (field.Type == JTokenType.String)
                        {
                            var fieldName = field.ToString();
                            var fieldConfig = formElements
                                .SelectMany(s => s["fields"]?.Values<JObject>() ?? Enumerable.Empty<JObject>())
                                .FirstOrDefault(f => f?["name"]?.ToString() == fieldName);

                            var fieldDetails = new
                            {
                                label = fieldConfig?["label"]?.ToString() ?? fieldName,
                                name = fieldName,
                                type = fieldConfig?["type"]?.ToString() ?? "text",
                                isGroup = false,
                                options = fieldConfig?["options"]?.ToObject<List<object>>() ?? new List<object>(),
                                oldValue = fieldConfig?["value"]?.ToString() ?? ""
                            };
                            allowedForDetails.Add(fieldDetails);
                        }
                        else if (field is JObject group)
                        {
                            var groupLabel = group["label"]?.ToString() ?? "Group";
                            var groupFieldsToken = group["fields"];
                            var groupFields = new List<object>();

                            if (groupFieldsToken is JArray fieldsArray)
                            {
                                foreach (var f in fieldsArray)
                                {
                                    if (f.Type == JTokenType.String)
                                    {
                                        var fieldName = f.ToString();
                                        var fieldConfig = formElements
                                            .SelectMany(s => s["fields"]?.Values<JObject>() ?? Enumerable.Empty<JObject>())
                                            .FirstOrDefault(fc => fc?["name"]?.ToString() == fieldName);

                                        groupFields.Add(new
                                        {
                                            label = fieldConfig?["label"]?.ToString() ?? fieldName,
                                            name = fieldName,
                                            type = fieldConfig?["type"]?.ToString() ?? "text",
                                            oldValue = fieldConfig?["value"]?.ToString() ?? "",
                                            options = fieldConfig?["options"]?.ToObject<List<object>>() ?? new List<object>()
                                        });
                                    }
                                    else if (f is JObject fieldObj)
                                    {
                                        var fieldName = fieldObj?["name"]?.ToString();
                                        var fieldConfig = formElements
                                            .SelectMany(s => s["fields"]?.Values<JObject>() ?? Enumerable.Empty<JObject>())
                                            .FirstOrDefault(fc => fc?["name"]?.ToString() == fieldName);

                                        groupFields.Add(new
                                        {
                                            label = fieldObj?["label"]?.ToString() ?? fieldName,
                                            name = fieldName,
                                            type = fieldConfig?["type"]?.ToString() ?? "text",
                                            oldValue = fieldConfig?["value"]?.ToString() ?? "",
                                            options = fieldConfig?["options"]?.ToObject<List<object>>() ?? new List<object>()
                                        });
                                    }
                                }
                            }

                            allowedForDetails.Add(new
                            {
                                label = groupLabel,
                                fields = groupFields,
                                isGroup = true
                            });
                        }
                    }
                }
                catch (JsonException ex)
                {
                    return Json(new { status = false, message = $"Failed to parse document fields: {ex.Message}" });
                }

                var formDetailsJson = result[0].Formdetails;
                if (string.IsNullOrEmpty(formDetailsJson))
                {
                    return Json(new { status = false, message = "Form details are missing." });
                }

                JToken formDetailsToken;
                try
                {
                    formDetailsToken = JToken.Parse(formDetailsJson);
                }
                catch (JsonException ex)
                {
                    return Json(new { status = false, message = $"Failed to parse form details: {ex.Message}" });
                }

                // ------------------ UPDATE FORMDETAILS USING ALL APPROVED CORRIGENDUM/CORRECTION ------------------
                var approvedCorrigenda = dbcontext.Corrigendum
                    .Where(c => c.Referencenumber == referenceNumber &&
                                ((c.Type == "Corrigendum" && c.Status == "Sanctioned") ||
                                 (c.Type == "Correction" && c.Status == "Verified")))
                    .OrderBy(c => c.Createdat)
                    .ToList();

                foreach (var corr in approvedCorrigenda)
                {
                    if (string.IsNullOrEmpty(corr.Corrigendumfields))
                        continue;

                    JObject corrigendumFields;
                    try
                    {
                        corrigendumFields = JObject.Parse(corr.Corrigendumfields);
                    }
                    catch
                    {
                        continue;
                    }

                    foreach (var field in corrigendumFields.Properties())
                    {
                        if (field.Name == "Files" || field.Name == "remarks")
                            continue;

                        var newValue = field.Value?["new_value"]?.ToString();
                        if (!string.IsNullOrWhiteSpace(newValue))
                        {
                            UpdateFieldValueRecursively(formDetailsToken, field.Name, newValue);
                        }
                    }
                }
                // -------------------------------------------------------------------------------

                bool isSanctioned = result[0].Status == "Sanctioned";
                formDetailsToken = ReorderFormDetails(formDetailsToken, referenceNumber, isSanctioned);
                var formDetailsWithCodes = formDetailsToken.DeepClone();
                ReplaceCodeFieldsWithNames(formDetailsToken, false);
                FormatDateFields(formDetailsToken);

                var workFlow = JArray.Parse(result[0].Workflow ?? "[]");
                bool isCurrentOfficer = type == "Correction" && workFlow.Count > result[0].Currentplayer &&
                                       workFlow[result[0].Currentplayer!]!["role"]?.ToString() == officer.Role;

                var nextOfficerDetails = workFlow.Count > 1 ? workFlow[1] : new JObject();
                string? nextOfficerDesignation = (string)nextOfficerDetails["designation"]!;
                string? nextOfficerAccessLevel = (string)nextOfficerDetails["accessLevel"]!;
                string officerArea = GetOfficerArea(nextOfficerAccessLevel, formDetailsWithCodes);

                // ------------------ EXISTING CORRIGENDUM CHECK ------------------
                if (!string.IsNullOrEmpty(applicationId))
                {
                    var existingCorrigendum = dbcontext.Corrigendum
                        .FirstOrDefault(c => c.Corrigendumid == applicationId && c.Type == type);

                    if (existingCorrigendum == null)
                    {
                        return Json(new { status = false, message = $"{type} not found." });
                    }

                    var corrigendumWorkflow = JArray.Parse(existingCorrigendum.Workflow ?? "[]");
                    var currentPlayer = existingCorrigendum.Currentplayer;
                    bool canOfficerEdit = false;
                    string officerDesignation = officer.Role!;

                    foreach (var item in corrigendumWorkflow)
                    {
                        var role = (string)item["role"]!;
                        var designation = (string)item["designation"]!;
                        var status = (string)item["status"]!;

                        if ((string.Equals(role, officer.Role, StringComparison.OrdinalIgnoreCase) ||
                             string.Equals(designation, officerDesignation, StringComparison.OrdinalIgnoreCase)) &&
                            string.Equals(status, "pending", StringComparison.OrdinalIgnoreCase))
                        {
                            canOfficerEdit = true;
                            break;
                        }
                    }

                    if (!canOfficerEdit)
                    {
                        return Json(new
                        {
                            status = true,
                            application = result[0],
                            formDetails = formDetailsToken,
                            allowedForDetails,
                            formElements,
                            nextOfficer = nextOfficerDesignation + " " + officerArea,
                            isCurrentOfficer = false,
                            isSanctioned,
                            corrigendumType = type,
                            userRole = officer.Role,
                            existingCorrigendumId = applicationId,
                            canEdit = false,
                            message = $"Found an existing {type} at another officer level. You can view but not edit it."
                        });
                    }

                    var corrigendumFieldsJson = string.IsNullOrEmpty(existingCorrigendum.Corrigendumfields)
                        ? new JObject()
                        : JObject.Parse(existingCorrigendum.Corrigendumfields);

                    var history = JsonConvert.DeserializeObject<List<dynamic>>(existingCorrigendum.History ?? "[]") ?? new List<dynamic>();
                    var columns = new List<dynamic>
            {
                new { accessorKey = "sno", header = "S.No." },
                new { accessorKey = "officer", header = "Officer" },
                new { accessorKey = "actionTaken", header = "Action Taken" },
                new { accessorKey = "remarks", header = "Remarks" },
                new { accessorKey = "actionTakenOn", header = "Action Taken On" },
            };

                    var data = new List<dynamic>();
                    int index = 1;
                    foreach (var item in history)
                    {
                        string officerName = item["officer"]?.ToString() ?? item["actionTaker"]?.ToString() ?? "Unknown";
                        string statusVal = item["status"]?.ToString() ?? "Unknown";
                        string historyRemarks = item["remarks"]?.ToString() ?? "";
                        string actionTakenOn = item["actionTakenOn"]?.ToString() ?? "";

                        data.Add(new
                        {
                            sno = index,
                            officer = officerName,
                            actionTaken = statusVal,
                            remarks = historyRemarks,
                            actionTakenOn
                        });
                        index++;
                    }

                    nextOfficerDetails = new JObject();
                    for (int i = 0; i < corrigendumWorkflow.Count; i++)
                    {
                        var item = corrigendumWorkflow[i];
                        var statusVal = (string)item["status"]!;
                        if (string.Equals(statusVal, "pending", StringComparison.OrdinalIgnoreCase) && i + 1 < corrigendumWorkflow.Count)
                        {
                            nextOfficerDetails = corrigendumWorkflow[i + 1];
                            break;
                        }
                    }

                    nextOfficerDesignation = (string?)nextOfficerDetails["designation"] ?? "Next Officer";
                    nextOfficerAccessLevel = (string?)nextOfficerDetails["accessLevel"] ?? "";
                    officerArea = GetOfficerArea(nextOfficerAccessLevel, formDetailsWithCodes);

                    JArray officerFiles = new JArray();
                    try
                    {
                        var filesToken = corrigendumFieldsJson["Files"];
                        if (filesToken != null)
                        {
                            if (filesToken is JObject filesObject)
                            {
                                var roleShort = officer.RoleShort ?? "";
                                var roleVal = officer.Role ?? "";
                                if (!string.IsNullOrEmpty(roleShort) && filesObject[roleShort] is JArray roleFiles)
                                {
                                    officerFiles = roleFiles;
                                }
                                else if (!string.IsNullOrEmpty(roleVal) && filesObject[roleVal] is JArray roleNameFiles)
                                {
                                    officerFiles = roleNameFiles;
                                }
                                else if (filesObject["TSWO"] is JArray tswoFiles)
                                {
                                    officerFiles = tswoFiles;
                                }
                            }
                            else if (filesToken is JArray filesArray)
                            {
                                officerFiles = filesArray;
                            }
                            else if (filesToken is JValue jValue && jValue.Type == JTokenType.String)
                            {
                                officerFiles = JArray.Parse(jValue.ToString());
                            }
                        }
                    }
                    catch { }

                    return Json(new
                    {
                        status = true,
                        corrigendumFields = corrigendumFieldsJson.ToString(),
                        application = result[0],
                        formDetails = formDetailsToken,
                        allowedForDetails,
                        formElements,
                        nextOfficer = nextOfficerDesignation + " " + officerArea,
                        columns,
                        data,
                        files = officerFiles,
                        isCurrentOfficer = canOfficerEdit,
                        isSanctioned,
                        corrigendumType = existingCorrigendum.Type,
                        userRole = officer.Role,
                        existingCorrigendumId = existingCorrigendum.Corrigendumid,
                        canEdit = canOfficerEdit,
                        message = canOfficerEdit ?
                            $"Found an existing {type} at your level. You can edit and forward it." :
                            $"Found an existing {type}. You can view but not edit it."
                    });
                }

                // Return for new corrigendum (no existing corrigendum found)
                return Json(new
                {
                    status = true,
                    application = result[0],
                    formDetails = formDetailsToken,
                    allowedForDetails,
                    formElements,
                    nextOfficer = nextOfficerDesignation + " " + officerArea,
                    isCurrentOfficer,
                    isSanctioned,
                    corrigendumType = type,
                    userRole = officer.Role,
                    existingCorrigendumId = (string?)null,
                    canEdit = false,
                    message = "Application found. You can issue a new corrigendum."
                });
            }
            catch (PostgresException ex)
            {
                Console.WriteLine($"Error in GetApplicationForCorrigendum: {ex.Message}, StackTrace: {ex.StackTrace}");
                return StatusCode(500, new
                {
                    status = false,
                    message = $"{ex.MessageText}"
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Unexpected error in GetApplicationForCorrigendum: {ex.Message}, StackTrace: {ex.StackTrace}");
                return StatusCode(500, new
                {
                    status = false,
                    message = "An unexpected error occurred. Please try again."
                });
            }
        }

        [HttpGet]
        public IActionResult GetCorrigendumApplications(string type, string applicationType, string Serviceid, int pageIndex = 0, int pageSize = 10)
        {
            var officer = GetOfficerDetails();
            if (officer == null)
            {
                return Unauthorized();
            }

            _logger.LogInformation("------------------ Getting applications for officer: {Officer} -----------------------", officer.Role);

            var parameters = new[]
            {
                new NpgsqlParameter("@officeraccesslevel", officer.AccessLevel),
                new NpgsqlParameter("@officeraccesscode", officer.AccessCode),
                new NpgsqlParameter("@referencenumber", DBNull.Value),
                new NpgsqlParameter("@status", type),
                new NpgsqlParameter("@corrigendumid", DBNull.Value),
                new NpgsqlParameter("@type", applicationType),
                new NpgsqlParameter("@officerrole", officer.Role)
            };

            var service = dbcontext.Services.FirstOrDefault(s => s.Serviceid == Convert.ToInt32(Serviceid));

            List<dynamic> workflow;
            try
            {
                workflow = JsonConvert.DeserializeObject<List<dynamic>>(service!.Officereditablefield!) ?? new List<dynamic>();
            }
            catch (JsonException ex)
            {
                return StatusCode(500, $"Error parsing workflow: {ex.Message}");
            }

            if (workflow.Count == 0)
                return Json(new { countList = new List<object>(), corrigendumList = new List<object>(), correctionList = new List<object>(), canSanction = false });

            // Find officer authorities
            dynamic authorities = workflow.FirstOrDefault(p => p.designation == officer.Role)!;

            var applications = dbcontext.Corrigendum
                .FromSqlRaw("SELECT * FROM get_corrigendum_by_location_access(@officeraccesslevel, @officeraccesscode, @referencenumber, @status, @corrigendumid, @type, @officerrole)", parameters)
                .ToList();

            var applicationReferenceNumbers = applications.Select(c => c.Referencenumber).ToList();
            var CitizenApplications = dbcontext.CitizenApplications
                .Where(ca => applicationReferenceNumbers.Contains(ca.Referencenumber))
                .ToDictionary(ca => ca.Referencenumber!, ca => ca);

            var sortedData = applications.OrderBy(a =>
            {
                var parts = a.Corrigendumid!.Split('/');
                var numberPart = parts.Last();
                return int.TryParse(numberPart, out int num) ? num : 0;
            }).ToList();

            var totalRecords = sortedData.Count;

            var pagedData = sortedData
                .Skip(pageIndex * pageSize)
                .Take(pageSize)
                .ToList();

            List<dynamic> data = new();

            foreach (var application in pagedData)
            {
                if (CitizenApplications.TryGetValue(application.Referencenumber!, out var citizenApp))
                {
                    var formDetails = JsonConvert.DeserializeObject<dynamic>(citizenApp.Formdetails!);
                    var workFlow = JsonConvert.DeserializeObject<JArray>(application.Workflow!);
                    var creationOfficer = workFlow![0];
                    string creationOfficerDesignation = (string)creationOfficer["designation"]!;
                    string creationOfficerAccessLevel = (string)creationOfficer["accessLevel"]!;
                    var officers = JsonConvert.DeserializeObject<JArray>(application.Workflow!);
                    var currentPlayer = application.Currentplayer;
                    string officerDesignation = (string)officers![currentPlayer!]!["designation"]!;
                    string offierAccessLevel = (string)officers![currentPlayer!]!["accessLevel"]!;
                    string officerStatus = (string)officers![currentPlayer!]!["status"]!;
                    string currentOfficerArea = GetOfficerArea(offierAccessLevel, formDetails);
                    string officerArea = GetOfficerArea(creationOfficerAccessLevel, JObject.Parse(citizenApp.Formdetails!));
                    var customActions = new List<dynamic>();

                    var history = JArray.Parse(application.History!);
                    var firstAction = history[0];


                    var currentOfficer = workFlow!.FirstOrDefault(o => (string)o["designation"]! == officer.Role);
                    var officerWithApplication = workFlow.FirstOrDefault(o => (int)o["playerId"]! == application.Currentplayer!);
                    string? CurrentStatus = (string)officerWithApplication!["status"]!;
                    // Add Pull if applicable
                    bool canPull = currentOfficer?["canPull"] != null && (bool)currentOfficer["canPull"]!;

                    if ((type == "forwarded" || type == "returned") && canPull)
                    {
                        customActions.Add(new
                        {
                            type = "Pull",
                            tooltip = "Pull",
                            color = "#F0C38E",
                            actionFunction = "pullApplication"
                        });
                    }
                    else
                    {
                        var matchedItem = workFlow
                       .FirstOrDefault(item => (string)item["designation"]! == officer.Role);


                        bool isToEdit = matchedItem != null && (string?)matchedItem["status"] == "pending" && (int?)matchedItem["playerId"] == application.Currentplayer && authorities != null && (bool)authorities!.canCorrigendum && (string)firstAction["actionTaker"]! != "Citizen";
                        string actionFunction = isToEdit ? "handleEditCorrigendumApplication" : application.Status == "Sanctioned" ? "handleViewPdf" : "handleViewCorrigendumApplication";
                        customActions.Add
                        (
                            new
                            {
                                type = application.Status == "sanctioned" ? "View" : "DownloadCorrigendum",
                                tooltip = $"View",
                                corrigendumId = application.Corrigendumid,
                                color = "#F0C38E",
                                actionFunction,
                            }
                        );
                    }


                    string applicationId = application.Corrigendumid.ToString();

                    data.Add(new
                    {
                        referenceNumber = application.Referencenumber,
                        applicationId = application.Corrigendumid,
                        createdBy = (string)firstAction["actionTaken"]! == "Citizen" ? "Citizent" : creationOfficerDesignation + " " + officerArea,
                        applicantName = GetFieldValue("ApplicantName", formDetails),
                        currentlyWith = officerDesignation + " " + currentOfficerArea,
                        currentStatus = CurrentStatus == "sanctioned" ? "Issued" : CurrentStatus,
                        creationDate = application.Createdat.ToString("dd MMM yyyy hh:mm:ss tt"),
                        applicationType,
                        serviceId = citizenApp.Serviceid,
                        customActions
                    });
                }
            }

            List<dynamic> columns = new()
            {
                new { accessorKey = "referenceNumber", header =  "Reference Number" },
                new { accessorKey = "applicationId", header = applicationType + " Id" },
                new { accessorKey = "createdBy", header = "Creation Officer" },
                new { accessorKey = "applicantName", header = "Applicant Name" },
                new { accessorKey = "currentlyWith", header = "Currently With" },
                new { accessorKey = "currentStatus", header = "Current Status" },
                new { accessorKey = "creationDate", header = applicationType + " Creation Date" },
                new { accessorKey = "applicationType", header = "Application Type" }
            };

            return Json(new
            {
                data,
                columns,
                poolData = new List<dynamic>(),
                totalRecords
            });
        }

        [HttpGet]
        public IActionResult GetCorrigendumApplication(string? referenceNumber = null, string? corrigendumId = null, string? type = null)
        {
            if (string.IsNullOrEmpty(corrigendumId))
            {
                return BadRequest("Corrigendum number is required.");
            }

            var officer = GetOfficerDetails();
            if (officer == null)
            {
                return Unauthorized();
            }

            var parameters = new[]
            {
                new NpgsqlParameter("@officeraccesslevel", officer.AccessLevel),
                new NpgsqlParameter("@officeraccesscode", officer.AccessCode),
                new NpgsqlParameter("@referencenumber", (object?)referenceNumber ?? DBNull.Value),
                new NpgsqlParameter("@status", DBNull.Value),
                new NpgsqlParameter("@corrigendumid", (object?)corrigendumId ?? DBNull.Value),
                new NpgsqlParameter("@type", (object?)type ?? DBNull.Value),
                new NpgsqlParameter("@officerrole", officer.Role) // 🔥 REQUIRED
            };


            var corrigendumApplication = dbcontext.Corrigendum
            .FromSqlRaw(
                @"SELECT * 
                FROM get_corrigendum_by_location_access(
                    @officeraccesslevel,
                    @officeraccesscode,
                    @referencenumber,
                    @status,
                    @corrigendumid,
                    @type,
                    @officerrole
                )",
                parameters
            )
            .AsNoTracking()
            .FirstOrDefault();


            _logger.LogInformation("Corrigendum Application: {@CorrigendumApplication}", corrigendumApplication);

            if (corrigendumApplication == null)
            {
                return NotFound("Corrigendum application not found.");
            }

            referenceNumber = corrigendumApplication.Referencenumber;

            List<dynamic>? history = string.IsNullOrEmpty(corrigendumApplication.History)
                ? []
                : JsonConvert.DeserializeObject<List<dynamic>>(corrigendumApplication.History);

            var application = dbcontext.CitizenApplications.FirstOrDefault(ca => ca.Referencenumber == referenceNumber);
            if (application == null)
            {
                return NotFound("Citizen application not found.");
            }

            var formDetails = JObject.Parse(application.Formdetails!);
            bool noaction = true;
            dynamic? sanctionOfficer = null;

            var applicationWorkFlow = string.IsNullOrEmpty(application.Workflow)
                ? null
                : JsonConvert.DeserializeObject<JArray>(application.Workflow);

            UpdateWorkflowFlags(applicationWorkFlow!, application.Currentplayer ?? 0);
            application.Workflow = JsonConvert.SerializeObject(applicationWorkFlow);

            if (!string.IsNullOrEmpty(corrigendumApplication.Workflow))
            {
                var corrigendumWorkFlow = JsonConvert.DeserializeObject<JArray>(corrigendumApplication.Workflow);

                // Use the Currentplayer (or similar property) from corrigendumApplication
                UpdateWorkflowFlags(corrigendumWorkFlow!, corrigendumApplication.Currentplayer);

                corrigendumApplication.Workflow = JsonConvert.SerializeObject(corrigendumWorkFlow);
            }

            dbcontext.SaveChanges();

            if (applicationWorkFlow != null)
            {
                foreach (var item in applicationWorkFlow)
                {
                    if (item["status"]?.ToString() == "sanctioned")
                    {
                        sanctionOfficer = item;
                    }
                }
            }

            List<JObject>? Officer = string.IsNullOrEmpty(corrigendumApplication.Workflow)
                ? null
                : JsonConvert.DeserializeObject<List<JObject>>(corrigendumApplication.Workflow);

            if (Officer == null || corrigendumApplication.Currentplayer < 0 || corrigendumApplication.Currentplayer >= Officer.Count)
            {
                return BadRequest("Invalid workflow or current player index.");
            }

            var currentOfficer = Officer[corrigendumApplication.Currentplayer];
            if (currentOfficer["designation"]?.ToString() != officer.Role ||
                (currentOfficer["designation"]?.ToString() == officer.Role && currentOfficer["status"]?.ToString() != "pending"))
            {
                noaction = false;
            }

            var corrigendumFields = string.IsNullOrEmpty(corrigendumApplication.Corrigendumfields)
                ? null
                : JsonConvert.DeserializeObject<JObject>(corrigendumApplication.Corrigendumfields);

            string remarks = corrigendumFields?["remarks"]?.ToString() ?? "";

            List<dynamic> actions = [new { label = "Reject", value = "reject" }];

            if (Convert.ToInt32(currentOfficer["playerId"]) > 0)
            {
                var prevOfficer = Officer[corrigendumApplication.Currentplayer - 1];
                string prevOfficerDesignation = (string)prevOfficer["designation"]!;
                string prevOfficerAccessLevel = (string)prevOfficer["accessLevel"]!;
                string officerArea = GetOfficerArea(prevOfficerAccessLevel, formDetails);



                actions.Add(new { label = $"Return to {prevOfficerDesignation} {officerArea}", value = "return" });
                if (sanctionOfficer == null && type == "Correction")
                {
                    actions.Add(new { label = $"Verify", value = "verified" });
                }
            }

            if (sanctionOfficer != null && sanctionOfficer!["designation"]?.ToString() == currentOfficer["designation"]?.ToString())
            {
                actions.Add(new { label = $"Issue {type}", value = "sanction" });
            }
            else if (Officer.Count > corrigendumApplication.Currentplayer + 1)
            {
                var nextOfficer = Officer[corrigendumApplication.Currentplayer + 1];
                string nextOfficerDesignation = (string)nextOfficer["designation"]!;
                string nextOfficerAccessLevel = (string)nextOfficer["accessLevel"]!;
                string officerArea = GetOfficerArea(nextOfficerAccessLevel, formDetails);

                actions.Add(new { label = $"Forward to {nextOfficerDesignation} {officerArea}", value = "forward" });
            }

            List<dynamic> columns = [
            new { accessorKey = "sno", header = "S.No." },
            new { accessorKey = "actionTaker", header = "Action Taker" },
            new { accessorKey = "actionTaken", header = "Action Taken" },
            new { accessorKey = "remarks", header = "Remarks" },
            new { accessorKey = "actionTakenOn", header = "Action Taken On" },
            ];

            var data = new List<dynamic>();
            int index = 1;
            string roleShort = "";
            if (history != null)
            {
                foreach (var item in history)
                {
                    string officerName = item["officer"]?.ToString() ?? item["actionTaker"].ToString() ?? "Unknown";
                    string status = item["status"]?.ToString() ?? "Unknown";
                    string historyRemarks = item["remarks"]?.ToString() ?? "";
                    string actionTakenOn = item["actionTakenOn"]?.ToString() ?? "";
                    if (!officerName.Contains("Citizen"))
                    {

                        string[] words = officerName.Split(' ', StringSplitOptions.RemoveEmptyEntries);
                        string firstThreeWords = string.Join(" ", words.Take(4));
                        _logger.LogInformation($"Officer Name: {officerName} First Three Words: {firstThreeWords}");

                        var designation = dbcontext.Officersdesignations
                            .FirstOrDefault(od => od.Designation == firstThreeWords);

                        roleShort = designation?.Designationshort ?? "Unknown";
                        _logger.LogInformation($"Role Short: {roleShort}");
                    }
                    data.Add(new
                    {
                        sno = index,
                        actionTaker = officerName,
                        actionTaken = status,
                        remarks = historyRemarks,
                        actionTakenOn,
                    });
                    index++;
                }
            }

            var formdetails = JObject.Parse(application.Formdetails!);
            foreach (var item in JsonConvert.DeserializeObject<List<dynamic>>(corrigendumApplication.Workflow)!)
            {
                if (item["status"] == "pending")
                {
                    data.Add(new
                    {
                        sno = index,
                        actionTaker = item["designation"] + " " + GetOfficerArea(item["accessLevel"].ToString(), formdetails),
                        actionTaken = item["status"],
                        remarks = item["remarks"],
                        actionTakenOn = item["completedAt"]
                    });
                    break;
                }
            }

            List<dynamic> fieldColumns = [
                    new { accessorKey = "formField", header = "Description" },
                    new { accessorKey = "oldvalue", header = "As Existing" },
                    new { accessorKey = "newvalue",header = $"{(type == "Amendment" ? "As Updated" : "As Corrected")}"},
                ];

            var fieldsData = new List<dynamic>();
            var stack = new Stack<(string path, JToken field)>();

            if (corrigendumFields != null)
            {
                foreach (var item in corrigendumFields)
                {
                    if (item.Key != "remarks" && item.Key != "Files" && item.Value is JObject)
                    {
                        stack.Push((item.Key, item.Value));
                    }
                }
            }

            while (stack.Count > 0)
            {
                var (path, field) = stack.Pop();
                string header = Regex.Replace(path, "(\\B[A-Z])", " $1");

                string oldValue = field["old_value"]?.ToString() ?? "";
                string newValue = field["new_value"]?.ToString() ?? "";

                // 🔁 Check for "Date" in the path and format oldValue/newValue
                if (path.IndexOf("Date", StringComparison.OrdinalIgnoreCase) >= 0)
                {
                    if (DateTime.TryParse(oldValue, out DateTime oldDt))
                        oldValue = oldDt.ToString("dd MMM yyyy");

                    if (DateTime.TryParse(newValue, out DateTime newDt))
                        newValue = newDt.ToString("dd MMM yyyy");
                }

                fieldsData.Add(new
                {
                    formField = header,
                    oldvalue = oldValue,
                    newvalue = newValue
                });

                var additionalValues = field["additional_values"];
                if (additionalValues != null && additionalValues is JObject nested)
                {
                    foreach (var nestedItem in nested)
                    {
                        string nestedPath = $"{path}.{nestedItem.Key}";
                        stack.Push((nestedPath, nestedItem.Value)!);
                    }
                }
            }


            var corFiles = corrigendumFields?["Files"] as JObject;
            _logger.LogInformation($"Cor Files: {corFiles}");

            var allFiles = corFiles?
                .Properties()
                .SelectMany(p => p.Value is JArray arr
                    ? arr.Select(f => f?.ToString()).Where(f => !string.IsNullOrWhiteSpace(f))
                    : Enumerable.Empty<string>())
                .ToList() ?? new List<string>()!;

            if (!allFiles.Any())
            {
                allFiles.Add("NO FILES");
            }

            _logger.LogInformation($"All Files: {string.Join(", ", allFiles)}");



            return Json(new
            {
                data,
                columns,
                fieldColumns,
                fieldsData,
                canTakeAction = noaction,
                actions,
                remarks,
                corrigendumApplication.Corrigendumid,
                files = allFiles
            });
        }

        public IActionResult GetApplicationsForAadhaarValidation(int pageIndex = 0, int pageSize = 10, int serviceId = 1)
        {
            var officerDetails = GetOfficerDetails();

            var parameters = new[]
            {
                new NpgsqlParameter("@role", officerDetails.Role),
                new NpgsqlParameter("@accesslevel", officerDetails.AccessLevel),
                new NpgsqlParameter("@accesscode", officerDetails.AccessCode),
                new NpgsqlParameter("@applicationstatus", "sanctioned"),
                new NpgsqlParameter("@serviceid", serviceId),
                new NpgsqlParameter("@pageindex", pageIndex),
                new NpgsqlParameter("@pagesize", pageSize),
                new NpgsqlParameter("@ispaginated", 1),
                new NpgsqlParameter("@datatype", "legacy"),
                new NpgsqlParameter("@aadhaarfilter", "empty")
            };

            var response = dbcontext.Database
                .SqlQueryRaw<AadhaarValidationApplicationDto>(
                    "SELECT * FROM get_applications_for_aadhaar_validation(@role, @accesslevel, @accesscode, @applicationstatus, @serviceid, @pageindex, @pagesize, @ispaginated, @datatype, @aadhaarfilter)",
                    parameters
                )
                .ToList();

            int totalRecords = response.Count > 0 ? (int)response[0].TotalRecords : 0;

            // Rest of your code remains the same...
            List<dynamic> columns =
            [
                new { accessorKey = "sno", header = "S.No" },
        new { accessorKey = "referenceNumber", header = "Reference Number" },
        new { accessorKey = "applicantName", header = "Applicant Name" },
        new { accessorKey = "parentage", header = "Parentage" },
        new { accessorKey = "dob", header = "Date Of Birth" },
    ];
            List<dynamic> data = [];

            foreach (var app in response)
            {
                var customActions = new List<dynamic>();
                customActions.Add(new
                {
                    type = "ValidateAadhaar",
                    tooltip = "Validate",
                    color = "#F0C38E",
                    actionFunction = "handleValidateAadhaar"
                });
                var formDetails = JObject.Parse(app.FormDetails!);
                _logger.LogInformation($"---------- Form Details: {formDetails} ---------------");

                var dob = GetFieldValue("DateOfBirth", formDetails);
                if (DateTime.TryParse(dob, out DateTime dobDate))
                {
                    dob = dobDate.ToString("dd MMM yyyy");
                }
                data.Add(new
                {
                    sno = data.Count + 1 + (pageIndex * pageSize),
                    referenceNumber = app.ReferenceNumber,
                    applicantName = GetFieldValue("ApplicantName", formDetails) ?? "N/A",
                    parentage = GetFieldValue("Parentage", formDetails) ?? "N/A",
                    dob = dob ?? "N/A",
                    input = true,
                    customActions,
                });
            }

            return Json(new
            {
                data,
                columns,
                totalRecords
            });
        }

        public class AadhaarValidationCount
        {
            public int TotalSanctioned { get; set; }
            public int AadhaarValidated { get; set; }
            public int AadhaarNotValidated { get; set; }
        }

        [HttpGet]
        public IActionResult GetAadhaarValidationCount(string serviceId, string? division = null, string? district = null, string? tehsil = null)
        {
            var officerDetails = GetOfficerDetails();

            // Compute restricted filters based on officer access
            string officerAccessLevel = officerDetails.AccessLevel!;
            int? officerAccessCode = officerDetails.AccessCode;
            int? restrictedDivision = null;
            int? restrictedDistrict = null;
            int? restrictedTehsil = null;

            if (officerAccessLevel == "Division")
            {
                restrictedDivision = officerAccessCode;
            }
            else if (officerAccessLevel == "District")
            {
                var districtEntity = dbcontext.District.FirstOrDefault(d => d.Districtid == officerAccessCode);
                if (districtEntity != null)
                {
                    restrictedDivision = districtEntity.Division;
                    restrictedDistrict = officerAccessCode;
                }
            }
            else if (officerAccessLevel == "Tehsil")
            {
                var tehsilEntity = dbcontext.Tswotehsil.FirstOrDefault(t => t.Tehsilid == officerAccessCode);
                if (tehsilEntity != null)
                {
                    restrictedDistrict = tehsilEntity.Districtid;
                    var districtEntity = dbcontext.District.FirstOrDefault(d => d.Districtid == tehsilEntity.Districtid);
                    if (districtEntity != null)
                    {
                        restrictedDivision = districtEntity.Division;
                    }
                    restrictedTehsil = officerAccessCode;
                }
            }

            // Enforce restrictions by overriding input parameters if necessary
            if (restrictedTehsil != null)
            {
                tehsil = restrictedTehsil.ToString();
            }
            if (restrictedDistrict != null)
            {
                district = restrictedDistrict.ToString();
            }
            if (restrictedDivision != null)
            {
                division = restrictedDivision.ToString();
            }

            string accessLevel;
            object? accessCode = DBNull.Value;
            object? divisionCode = DBNull.Value;

            // Pick correct access level
            if (!string.IsNullOrWhiteSpace(tehsil))
            {
                accessLevel = "Tehsil";
                accessCode = int.TryParse(tehsil, out var tehsilVal) ? tehsilVal : DBNull.Value;
            }
            else if (!string.IsNullOrWhiteSpace(district))
            {
                accessLevel = "District";
                accessCode = int.TryParse(district, out var districtVal) ? districtVal : DBNull.Value;
            }
            else if (!string.IsNullOrWhiteSpace(division))
            {
                accessLevel = "Division";
                accessCode = int.TryParse(division, out var divisionVal) ? divisionVal : DBNull.Value;
                divisionCode = accessCode; // For compatibility with SQL proc
            }
            else
            {
                accessLevel = "State";
            }

            var parameters = new[]
            {
                new NpgsqlParameter("@serviceid", int.Parse(serviceId)),
                new NpgsqlParameter("@accesslevel", accessLevel),
                new NpgsqlParameter("@accesscode", accessCode ?? DBNull.Value),
                new NpgsqlParameter("@divisioncode", divisionCode ?? DBNull.Value),
                new NpgsqlParameter("@aadhaarfilter", DBNull.Value)
            };

            // Fetch Aadhaar validation counts
            var counts = dbcontext.Database
                .SqlQueryRaw<AadhaarValidationCount>(
                    "SELECT * FROM get_aadhaar_validation_count(@accesslevel, @accesscode, @serviceid, @divisioncode, @aadhaarfilter)",
                    parameters
                )
                .AsEnumerable()
                .FirstOrDefault() ?? new AadhaarValidationCount();

            // Define application status data
            var dataList = new List<dynamic>
            {
                new
                {
                    title = "Total Sanctioned",
                    value = counts.TotalSanctioned.ToString("N0"),
                    category = "application",
                    color = "#fff",
                    bgColor = "#4f46e5",
                    gradientStart = "#4f46e5",
                    gradientEnd = "#3b82f6",
                },
                new
                {
                    title = "Aadhaar Validated",
                    value = counts.AadhaarValidated.ToString("N0"),
                    category = "application",
                    color = "#fff",
                    bgColor = "#059669",
                    gradientStart = "#059669",
                    gradientEnd = "#10b981",
                },
                new
                {
                    title = "Aadhaar Not Validated",
                    value = counts.AadhaarNotValidated.ToString("N0"),
                    category = "application",
                    color = "#fff",
                    bgColor = "#f59e0b",
                    gradientStart = "#f59e0b",
                    gradientEnd = "#fbbf24",
                },
            };

            // Prepare officer access info for frontend
            var officerAccess = new
            {
                accessLevel = officerAccessLevel,
                accessCode = officerAccessCode,
                restrictedDivision,
                restrictedDistrict,
                restrictedTehsil
            };

            return Json(new { dataList, officerAccess });
        }

        [HttpGet]
        public IActionResult GetAadhaarValidationData(string serviceId, string type, int pageIndex = 0, int pageSize = 10, string state = "0", string? division = null, string? district = null, string? tehsil = null)
        {
            // Determine AccessLevel and AccessCode based on filters
            string accessLevel;
            object accessCode = DBNull.Value;
            object divisionCode = DBNull.Value;

            if (!string.IsNullOrWhiteSpace(tehsil))
            {
                accessLevel = "Tehsil";
                accessCode = int.TryParse(tehsil, out var tehsilVal) ? tehsilVal : DBNull.Value;
            }
            else if (!string.IsNullOrWhiteSpace(district))
            {
                accessLevel = "District";
                accessCode = int.TryParse(district, out var districtVal) ? districtVal : DBNull.Value;
            }
            else if (!string.IsNullOrWhiteSpace(division))
            {
                accessLevel = "Division";
                accessCode = int.TryParse(division, out var divisionVal) ? divisionVal : DBNull.Value;
                divisionCode = accessCode;
            }
            else
            {
                accessLevel = "State";
                accessCode = state == "0" ? 0 : DBNull.Value;
            }

            // Validate AccessLevel and AccessCode
            if ((accessLevel == "Tehsil" || accessLevel == "District") && accessCode == DBNull.Value)
            {
                return BadRequest("Invalid AccessCode for the specified AccessLevel.");
            }
            if (accessLevel == "Division" && divisionCode == DBNull.Value)
            {
                return BadRequest("Invalid DivisionCode for Division AccessLevel.");
            }

            // FIXED: Use proper type for @ispaginated parameter
            var parameters = new[]
            {
                new NpgsqlParameter("@accesslevel", NpgsqlDbType.Varchar) { Value = accessLevel },
                new NpgsqlParameter("@accesscode", NpgsqlDbType.Integer) { Value = accessCode },
                new NpgsqlParameter("@serviceid", NpgsqlDbType.Integer) { Value = int.Parse(serviceId) },
                new NpgsqlParameter("@divisioncode", NpgsqlDbType.Integer) { Value = divisionCode },
                new NpgsqlParameter("@aadhaarfilter", NpgsqlDbType.Varchar) {
                    Value = type == "sanctioned" ? (object)DBNull.Value : type
                },
                new NpgsqlParameter("@pageindex", NpgsqlDbType.Integer) { Value = pageIndex },
                new NpgsqlParameter("@pagesize", NpgsqlDbType.Integer) { Value = pageSize },
                // FIX: Use Boolean type instead of Integer
                new NpgsqlParameter("@ispaginated", NpgsqlDbType.Boolean) { Value = true }
            };

            // Fetch application data using DTO
            var response = dbcontext.Database
                .SqlQueryRaw<AadhaarValidationDataDto>(
                    "SELECT * FROM get_aadhaar_validation_data(@accesslevel, @accesscode, @serviceid, @divisioncode, @aadhaarfilter, @pageindex, @pagesize, @ispaginated)",
                    parameters
                )
                .ToList();

            int totalRecords = response.Count > 0 ? (int)response[0].TotalRecords : 0;

            // Fetch service details for serviceName
            var service = dbcontext.Services.FirstOrDefault(s => s.Serviceid == int.Parse(serviceId));
            if (service == null)
            {
                return NotFound();
            }

            // Columns for the table
            List<dynamic> columns =
            [
                new { accessorKey = "sno", header = "S.No" },
        new { accessorKey = "referenceNumber", header = "Reference Number" },
        new { accessorKey = "applicantName", header = "Applicant Name" },
        new { accessorKey = "serviceName", header = "Service Name" },
        new { accessorKey = "status", header = "Application Status" },
        new { accessorKey = "submissionDate", header = "Submission Date" }
            ];

            List<dynamic> data = [];

            // Start numbering based on pagination
            int snoCounter = (pageIndex * pageSize) + 1;

            foreach (var details in response)
            {
                var formDetails = JsonConvert.DeserializeObject<dynamic>(details.FormDetails!);
                string serviceName = service.Servicename!;
                string status = details.Status!;

                var applicationObject = new
                {
                    sno = snoCounter++,
                    referenceNumber = details.ReferenceNumber,
                    applicantName = GetFieldValue("ApplicantName", formDetails),
                    submissionDate = details.Created_at,
                    serviceName,
                    status,
                    serviceId = details.ServiceId
                };

                data.Add(applicationObject);
            }

            return Json(new
            {
                data,
                columns,
                totalRecords
            });
        }


        [HttpGet]
        public IActionResult SearchApplication(string Serviceid, string Referencenumber)
        {
            var officer = GetOfficerDetails();
            int serviceId = Convert.ToInt32(Serviceid);

            var application = dbcontext.CitizenApplications
                .FirstOrDefault(ca => ca.Serviceid == serviceId && ca.Referencenumber == Referencenumber);

            if (application == null)
            {
                return Json(new { status = false, message = "Application not found" });
            }

            var formDetails = JObject.Parse(application.Formdetails ?? "{}");
            var formDetailsToken = JToken.Parse(application.Formdetails!);
            formDetailsToken = ReorderFormDetails(formDetailsToken, Referencenumber, application.Status == "Sanctioned");
            ReplaceCodeFieldsWithNames(formDetailsToken);

            // Extract Tehsil & District only once
            int? tehsilId = Convert.ToInt32(GetFieldValue("Tehsil", formDetails));
            int? districtId = Convert.ToInt32(GetFieldValue("District", formDetails));

            // Preload district & tehsil objects only if needed
            var district = districtId.HasValue
                ? dbcontext.District.FirstOrDefault(d => d.Districtid == districtId.Value)
                : null;

            var tehsil = tehsilId.HasValue
                ? dbcontext.Tswotehsil.FirstOrDefault(t => t.Tehsilid == tehsilId.Value)
                : null;

            // Compute accessCode in one place
            int accessCode = officer.AccessLevel switch
            {
                "Tehsil" => tehsilId ?? 0,
                "District" => districtId ?? 0,
                "Division" => district?.Division ?? 0,
                _ => 0
            };

            // Officer has access
            if (officer.AccessCode == accessCode)
            {
                return Json(new { status = true, isAccessible = true, formDetailsToken });
            }

            // Officer does not have access
            return Json(new
            {
                status = true,
                isAccessible = false,
                message = $"You don't have access of this application. This application belongs to District: {district!.Districtname}, Tehsil: {tehsil!.Tehsilname}",
            });
        }

        [HttpGet]
        public IActionResult RedirectToCitizen(string username, bool isCitizen)
        {
            var clientToken = Request.Cookies["ClientToken"];
            var localUser = dbcontext.Users.FirstOrDefault(u => u.Username == username);
            var frontendUrl = _config["AppSettings:FrontendUrl"] ?? "http://localhost:3000";
            localUser!.Usertype = isCitizen ? "Officer" : "Citizen";
            var jwt = helper.GenerateJwt(localUser!, clientToken!);
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