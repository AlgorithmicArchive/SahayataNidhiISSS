using System.Data;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using SahayataNidhi.Models.Entities;
using Npgsql;
using NpgsqlTypes;

namespace SahayataNidhi.Controllers.Officer
{
    [Authorize(Roles = "Viewer")]
    public partial class ViewerController(SwdjkContext dbcontext, ILogger<ViewerController> logger,
        UserHelperFunctions helper, IReferenceDataService referenceData) : Controller
    {
        protected readonly SwdjkContext dbcontext = dbcontext;
        protected readonly ILogger<ViewerController> _logger = logger;
        protected readonly UserHelperFunctions helper = helper;
        protected readonly IReferenceDataService _referenceData = referenceData;

        public override void OnActionExecuted(ActionExecutedContext context)
        {
            base.OnActionExecuted(context);

            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var officer = dbcontext.Users.FirstOrDefault(u => u.Userid.ToString() == userId);
            string profile = officer?.Profile ?? "/resources/dummyDocs/formImage.jpg";

            ViewData["UserType"] = "Officer";
            ViewData["UserName"] = officer?.Username;
            ViewData["Profile"] = string.IsNullOrEmpty(profile) ? "/resources/dummyDocs/formImage.jpg" : profile;
        }

        public class PensionTypeCount
        {
            public string? PensionType { get; set; }
            public int Count { get; set; }
        }

        public class LocationCount
        {
            public int LocationId { get; set; }
            public string? LocationName { get; set; }
            public int Count { get; set; }
        }

        public IActionResult GetApplicationStatus(string serviceId, string? division = null, string? district = null, string? tehsil = null)
        {
            string accessLevel;
            object? accessCode = DBNull.Value;
            object? divisionCode = DBNull.Value;

            if (!string.IsNullOrWhiteSpace(tehsil))
            {
                accessLevel = "Tehsil";
                accessCode = int.TryParse(tehsil, out var tehsilVal) ? tehsilVal : DBNull.Value;
                divisionCode = dbcontext.Tswotehsil.Where(t => t.Tehsilid == tehsilVal).Select(t => t.Divisioncode).FirstOrDefault();
            }
            else if (!string.IsNullOrWhiteSpace(district))
            {
                accessLevel = "District";
                accessCode = int.TryParse(district, out var districtVal) ? districtVal : DBNull.Value;
                divisionCode = dbcontext.District.Where(d => d.Districtid == districtVal).Select(d => d.Division).FirstOrDefault();
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
                accessCode = 0;
            }


            var parameters = new List<NpgsqlParameter>
            {
                new("@AccessLevel", NpgsqlDbType.Varchar) { Value = accessLevel },
                new("@AccessCode", NpgsqlDbType.Integer) { Value = accessCode ?? DBNull.Value },
                new("@Serviceid", NpgsqlDbType.Integer) { Value = int.Parse(serviceId) },
                new("@TakenBy", NpgsqlDbType.Varchar) { Value = DBNull.Value },
                new("@DivisionCode", NpgsqlDbType.Integer) { Value = divisionCode ?? DBNull.Value }
            };

            var counts = dbcontext.Database
                .SqlQueryRaw<MainStatusCounts>(
                    "SELECT * FROM get_main_application_status_counts(@AccessLevel, @AccessCode, @Serviceid, @TakenBy, @DivisionCode)",
                    parameters.ToArray()
                )
                .AsEnumerable()
                .FirstOrDefault() ?? new MainStatusCounts();

            var dataList = new List<dynamic>
            {
                new
                {
                    title = "Applications Received",
                    value = counts.TotalApplications.ToString("N0"),
                    category = "application",
                    color = "primary",
                    bgColor = "#1F43B4",
                    gradientStart = "#4f46e5",
                    gradientEnd = "#3b82f6",
                },
                new
                {
                    title = "Sanctioned",
                    value = counts.SanctionedCount.ToString("N0"),
                    category = "application",
                    color = "success",
                    bgColor = "#4CAF50",
                    gradientStart = "#059669",
                    gradientEnd = "#10b981",
                },
                new
                {
                    title = "Under Process",
                    value = counts.PendingCount.ToString("N0"),
                    category = "application",
                    color = "warning",
                    bgColor = "#E4630A",
                    gradientStart = "#f59e0b",
                    gradientEnd = "#fbbf24",
                },
                new
                {
                    title = "Pending with Citizen",
                    value = counts.ReturnToEditCount.ToString("N0"),
                    category = "application",
                    color = "info",
                    bgColor = "#2561E8",
                    gradientStart = "#0ea5e9",
                    gradientEnd = "#38bdf8",
                },
                new
                {
                    title = "Rejected",
                    value = counts.RejectCount.ToString("N0"),
                    category = "application",
                    color = "error",
                    bgColor = "#F44336",
                    gradientStart = "#ef4444",
                    gradientEnd = "#f87171",
                },
                // NEW: Eligible for Pension
                new
                {
                    title = "Eligible for Pension",
                    value = counts.EligibleForPensionCount.ToString("N0"),
                    category = "application",
                    color = "success",
                    bgColor = "#047857", // Darker emerald for distinction
                    gradientStart = "#10b981",
                    gradientEnd = "#34d399",
                },
                // NEW: Not Eligible (Withheld)
                new
                {
                    title = "Not Eligible (Withheld)",
                    value = counts.WithheldCount.ToString("N0"),
                    category = "application",
                    color = "error",
                    bgColor = "#991B1B", // Darker red for distinction
                    gradientStart = "#ef4444",
                    gradientEnd = "#f87171",
                }
            };

            var pensionCategories = new List<dynamic>
            {
                new { Category = "OLD AGE PENSION", Color = "#4f46e5" },
                new { Category = "WOMEN IN DISTRESS", Color = "#059669" },
                new { Category = "PHYSICALLY CHALLENGED PERSON", Color = "#f59e0b" },
                new { Category = "TRANSGENDER PERSON", Color = "#0ea5e9" }
            };

            var categoryArray = pensionCategories.Select(c => c.Category).ToArray();
            var categoryParam = new NpgsqlParameter("@p_categories", NpgsqlDbType.Array | NpgsqlDbType.Varchar)
            {
                Value = categoryArray
            };

            var categoryParams = new[]
            {
                new NpgsqlParameter("@p_json_key", NpgsqlDbType.Text) { Value = "PensionType" },
                new NpgsqlParameter("@p_json_path", NpgsqlDbType.Text) { Value = @"$.""Pension Type""[0].value" }, // Fixed path
                categoryParam,
                new NpgsqlParameter("@p_access_level", NpgsqlDbType.Varchar) { Value = accessLevel },
                new NpgsqlParameter("@p_access_code", NpgsqlDbType.Integer) { Value = accessCode ?? DBNull.Value },
                new NpgsqlParameter("@p_division_code", NpgsqlDbType.Integer) { Value = divisionCode ?? DBNull.Value }
            };

            var pensionTypeCounts = dbcontext.Database
    .SqlQueryRaw<PensionTypeCount>(
        "SELECT category AS \"PensionType\", count AS \"Count\" FROM get_category_counts_from_json(@p_json_key, @p_json_path, @p_categories, @p_access_level, @p_access_code, @p_division_code)",
        categoryParams
    )
    .ToList();

            var categoryData = pensionCategories
                .GroupJoin(pensionTypeCounts,
                    cat => cat.Category,
                    count => count.PensionType,
                    (cat, counts) => new
                    {
                        name = cat.Category,
                        value = counts.FirstOrDefault()?.Count ?? 0,
                        color = cat.Color
                    })
                .ToList();

            var locationParams = new List<NpgsqlParameter>
            {
                new("@p_access_level", NpgsqlDbType.Varchar) { Value = accessLevel },
                new("@p_access_code", NpgsqlDbType.Integer) { Value = accessCode ?? DBNull.Value },
                new("@p_division_code", NpgsqlDbType.Integer) { Value = divisionCode ?? DBNull.Value },
                new("@p_service_id", NpgsqlDbType.Integer) { Value = int.Parse(serviceId) }
            };

            var locationCounts = dbcontext.Database
      .SqlQueryRaw<LocationCount>(
          "SELECT location_id AS \"LocationId\", location_name AS \"LocationName\", count AS \"Count\" FROM get_location_wise_sanctioned_counts(@p_access_level, @p_access_code, @p_division_code, @p_service_id)",
          locationParams.ToArray()
      )
      .ToList();

            var locationColors = new[] { "#4f46e5", "#059669", "#f59e0b", "#0ea5e9", "#ef4444", "#3b82f6", "#10b981", "#fbbf24", "#38bdf8", "#f87171" };

            var locationData = locationCounts
                .Select((loc, index) => new
                {
                    name = loc.LocationName,
                    value = loc.Count,
                    color = locationColors[index % locationColors.Length]
                })
                .ToList();

            return Json(new { dataList, categoryData, locationData });
        }

        public class AadhaarValidationCount
        {
            public int TotalSanctioned { get; set; }
            public int AadhaarValidated { get; set; }
            public int AadhaarNotValidated { get; set; }
        }

        public IActionResult GetAadhaarValidationCount(string serviceId, string? division = null, string? district = null, string? tehsil = null)
        {
            string accessLevel;
            object? accessCode = DBNull.Value;
            object? divisionCode = DBNull.Value;

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
            }

            var parameters = new List<NpgsqlParameter>
            {
                new("@p_access_level", NpgsqlDbType.Varchar) { Value = accessLevel },
                new("@p_access_code", NpgsqlDbType.Integer) { Value = accessCode ?? DBNull.Value },
                new("@p_service_id", NpgsqlDbType.Integer) { Value = int.Parse(serviceId) },
                new("@p_division_code", NpgsqlDbType.Integer) { Value = divisionCode ?? DBNull.Value },
                new("@p_aadhaar_filter", NpgsqlDbType.Varchar) { Value = DBNull.Value }
            };

            var counts = dbcontext.Database
                .SqlQueryRaw<AadhaarValidationCount>(
                    "SELECT * FROM get_aadhaar_validation_count(@p_access_level, @p_access_code, @p_service_id, @p_division_code, @p_aadhaar_filter)",
                    parameters.ToArray()
                )
                .AsEnumerable()
                .FirstOrDefault() ?? new AadhaarValidationCount();

            var dataList = new List<dynamic>
            {
                new
                {
                    title = "Total Sanctioned",
                    value = counts.TotalSanctioned.ToString("N0"),
                    category = "application",
                    color = "primary",
                    bgColor = "#f8faff",
                    gradientStart = "#4f46e5",
                    gradientEnd = "#3b82f6",
                },
                new
                {
                    title = "Aadhaar Validated",
                    value = counts.AadhaarValidated.ToString("N0"),
                    category = "application",
                    color = "success",
                    bgColor = "#f0fdf4",
                    gradientStart = "#059669",
                    gradientEnd = "#10b981",
                },
                new
                {
                    title = "Aadhaar Not Validated",
                    value = counts.AadhaarNotValidated.ToString("N0"),
                    category = "application",
                    color = "warning",
                    bgColor = "#fffbeb",
                    gradientStart = "#f59e0b",
                    gradientEnd = "#fbbf24",
                },
            };

            return Json(new { dataList });
        }
        public IActionResult GetAadhaarValidationData(string serviceId, string type, int pageIndex = 0, int pageSize = 10, string state = "0", string? division = null, string? district = null, string? tehsil = null)
        {
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

            if ((accessLevel == "Tehsil" || accessLevel == "District") && accessCode == DBNull.Value)
            {
                return BadRequest("Invalid AccessCode for the specified AccessLevel.");
            }
            if (accessLevel == "Division" && divisionCode == DBNull.Value)
            {
                return BadRequest("Invalid DivisionCode for Division AccessLevel.");
            }

            var parameters = new List<NpgsqlParameter>
    {
        new("@p_access_level", NpgsqlDbType.Varchar) { Value = accessLevel },
        new("@p_access_code", NpgsqlDbType.Integer) { Value = accessCode },
        new("@p_service_id", NpgsqlDbType.Integer) { Value = int.Parse(serviceId) },
        new("@p_division_code", NpgsqlDbType.Integer) { Value = divisionCode },
        new("@p_aadhaar_filter", NpgsqlDbType.Varchar) { Value = (object)(type == "sanctioned" ? null : type)! ?? DBNull.Value },
        new("@p_page_index", NpgsqlDbType.Integer) { Value = pageIndex },
        new("@p_page_size", NpgsqlDbType.Integer) { Value = pageSize },
        new("@p_is_paginated", NpgsqlDbType.Boolean) { Value = true }
    };

            // Use SqlQueryRaw with the DTO class instead of FromSqlRaw
            var response = dbcontext.Database
                .SqlQueryRaw<AadhaarValidationDataDto>(
                    "SELECT * FROM get_aadhaar_validation_data(@p_access_level, @p_access_code, @p_service_id, @p_division_code, @p_aadhaar_filter, @p_page_index, @p_page_size, @p_is_paginated)",
                    parameters.ToArray()
                )
                .ToList();

            long totalRecords = response.FirstOrDefault()?.TotalRecords ?? 0;
            var service = dbcontext.Services.FirstOrDefault(s => s.Serviceid == int.Parse(serviceId));

            if (service == null)
            {
                return NotFound();
            }

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
            int snoCounter = (pageIndex * pageSize) + 1;

            foreach (var details in response)
            {
                // Skip the total records row if it's the only row and has no other data
                if (response.Count == 1 && string.IsNullOrEmpty(details.ReferenceNumber))
                {
                    continue;
                }

                var formDetails = JsonConvert.DeserializeObject<dynamic>(details.FormDetails ?? "{}");
                string serviceName = service.Servicename!;
                string status = details.Status ?? "Unknown";

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


        public string GetFieldValue(string fieldName, dynamic data) => _referenceData.GetFieldValue(fieldName, data);

        public string GetOfficerArea(string accessLevel, dynamic formDetails) => _referenceData.GetOfficerArea(accessLevel, formDetails);

        [HttpGet]
        public IActionResult GetMainApplicationStatusData(
     string serviceId,
     string type,
     int pageIndex = 0,
     int pageSize = 10,
     string state = "0",
     string? division = null,
     string? district = null,
     string? tehsil = null)
        {
            try
            {
                _logger.LogInformation(
                    "GetMainApplicationStatusData - serviceId={ServiceId}, type={Type}, pageIndex={PageIndex}, pageSize={PageSize}, state={State}, division={Division}, district={District}, tehsil={Tehsil}",
                    serviceId, type, pageIndex, pageSize, state, division, district, tehsil);

                // ─────────────────────────────────────────────────────────
                // Determine scope
                // ─────────────────────────────────────────────────────────
                string accessLevel;
                object accessCode = DBNull.Value;
                object divisionCode = DBNull.Value;

                if (!string.IsNullOrWhiteSpace(tehsil) && int.TryParse(tehsil, out var tehsilVal))
                {
                    accessLevel = "Tehsil";
                    accessCode = tehsilVal;
                    // Tehsil's division (optional; used only by the report queries)
                    divisionCode = dbcontext.Tswotehsil
                        .Where(t => t.Tehsilid == tehsilVal)
                        .Select(t => (int?)t.Divisioncode)
                        .FirstOrDefault() ?? (object)DBNull.Value;
                }
                else if (!string.IsNullOrWhiteSpace(district) && int.TryParse(district, out var districtVal))
                {
                    accessLevel = "District";
                    accessCode = districtVal;
                    divisionCode = dbcontext.District
                        .Where(d => d.Districtid == districtVal)
                        .Select(d => (int?)d.Division)
                        .FirstOrDefault() ?? (object)DBNull.Value;
                }
                else if (!string.IsNullOrWhiteSpace(division) && int.TryParse(division, out var divisionVal))
                {
                    accessLevel = "Division";
                    accessCode = divisionVal;
                    divisionCode = divisionVal;
                }
                else
                {
                    accessLevel = "State";
                    accessCode = int.TryParse(state, out var stateVal) ? stateVal : 0;
                }

                _logger.LogInformation(
                    "Scope resolved - accessLevel={AccessLevel}, accessCode={AccessCode}, divisionCode={DivisionCode}",
                    accessLevel, accessCode, divisionCode);

                int serviceIdInt = int.Parse(serviceId);

                // ─────────────────────────────────────────────────────────
                // 1. Counts  — one call, correct function name
                // ─────────────────────────────────────────────────────────
                int pendingCount = 0, returnToEditCount = 0, sanctionedCount = 0,
                    rejectCount = 0, totalApplications = 0, withheldCount = 0,
                    eligibleCount = 0;

                var countParameters = new[]
                {
            new NpgsqlParameter("@AccessLevel",  NpgsqlDbType.Varchar) { Value = accessLevel },
            new NpgsqlParameter("@AccessCode",   NpgsqlDbType.Integer) { Value = accessCode   ?? DBNull.Value },
            new NpgsqlParameter("@Serviceid",    NpgsqlDbType.Integer) { Value = serviceIdInt },
            new NpgsqlParameter("@TakenBy",      NpgsqlDbType.Varchar) { Value = DBNull.Value },
            new NpgsqlParameter("@DivisionCode", NpgsqlDbType.Integer) { Value = divisionCode ?? DBNull.Value }
        };

                // ✅ FIX: plural "counts", matching the deployed function
                const string countSql =
                    "SELECT * FROM public.get_main_application_status_counts(" +
                    "@AccessLevel, @AccessCode, @Serviceid, @TakenBy, @DivisionCode)";

                var countResult = dbcontext.Database
                    .SqlQueryRaw<MainStatusCounts>(countSql, countParameters)
                    .AsEnumerable()
                    .FirstOrDefault() ?? new MainStatusCounts();

                pendingCount = countResult.PendingCount;
                returnToEditCount = countResult.ReturnToEditCount;
                sanctionedCount = countResult.SanctionedCount;
                rejectCount = countResult.RejectCount;
                totalApplications = countResult.TotalApplications;
                withheldCount = countResult.WithheldCount;
                eligibleCount = countResult.EligibleForPensionCount;

                // Pick the right total for this tab
                long totalRecords = (type ?? "").ToLowerInvariant() switch
                {
                    "" or "total" => totalApplications,
                    "pending" => pendingCount,
                    "returntoedit" => returnToEditCount,
                    "sanctioned" => sanctionedCount,
                    "reject" or "rejected" => rejectCount,
                    "withheld" => withheldCount,
                    "eligible" => eligibleCount,
                    _ => totalApplications
                };

                _logger.LogInformation(
                    "Counts - Total={Total}, Pending={Pending}, ReturnToEdit={ReturnToEdit}, Sanctioned={Sanctioned}, Reject={Reject}, Withheld={Withheld}, Eligible={Eligible}; totalRecords for type '{Type}' = {TotalRecords}",
                    totalApplications, pendingCount, returnToEditCount, sanctionedCount,
                    rejectCount, withheldCount, eligibleCount, type, totalRecords);

                // ─────────────────────────────────────────────────────────
                // 2. Data rows — parameterized, no test query
                // ─────────────────────────────────────────────────────────
                var dataParameters = new[]
                {
            new NpgsqlParameter("@p_access_level",       NpgsqlDbType.Varchar)  { Value = accessLevel },
            new NpgsqlParameter("@p_access_code",        NpgsqlDbType.Integer)  { Value = accessCode   ?? DBNull.Value },
            new NpgsqlParameter("@p_service_id",         NpgsqlDbType.Integer)  { Value = serviceIdInt },
            new NpgsqlParameter("@p_division_code",      NpgsqlDbType.Integer)  { Value = divisionCode ?? DBNull.Value },
            new NpgsqlParameter("@p_application_status", NpgsqlDbType.Varchar)  {
                Value = string.IsNullOrEmpty(type) || type.Equals("total", StringComparison.OrdinalIgnoreCase)
                        ? (object)DBNull.Value
                        : type
            },
            new NpgsqlParameter("@p_page_index",         NpgsqlDbType.Integer)  { Value = pageIndex },
            new NpgsqlParameter("@p_page_size",          NpgsqlDbType.Integer)  { Value = pageSize },
            new NpgsqlParameter("@p_is_paginated",       NpgsqlDbType.Boolean)  { Value = true }
        };

                const string dataSql =
                    "SELECT * FROM public.get_main_application_status_data(" +
                    "@p_access_level, @p_access_code, @p_service_id, @p_division_code, " +
                    "@p_application_status, @p_page_index, @p_page_size, @p_is_paginated)";

                List<MainApplicationStatusDto> response;
                try
                {
                    response = dbcontext.Database
                        .SqlQueryRaw<MainApplicationStatusDto>(dataSql, dataParameters)
                        .ToList();
                }
                catch (Exception dataEx)
                {
                    _logger.LogError(dataEx, "Data query failed for service {ServiceId}, type {Type}", serviceId, type);
                    return Json(new
                    {
                        data = new List<object>(),
                        columns = new List<object>(),
                        totalRecords = totalRecords,
                        counts = new
                        {
                            pending = pendingCount,
                            returntoedit = returnToEditCount,
                            sanctioned = sanctionedCount,
                            reject = rejectCount,
                            total = totalApplications
                        }
                    });
                }

                // Empty result set — still return the correct totalRecords
                if (response.Count == 0)
                {
                    _logger.LogInformation(
                        "No data rows for service {ServiceId}, type {Type}, scope {AccessLevel}/{AccessCode}",
                        serviceId, type, accessLevel, accessCode);

                    return Json(new
                    {
                        data = new List<object>(),
                        columns = new List<object>(),
                        totalRecords = totalRecords,
                        counts = new
                        {
                            pending = pendingCount,
                            returntoedit = returnToEditCount,
                            sanctioned = sanctionedCount,
                            reject = rejectCount,
                            total = totalApplications
                        }
                    });
                }

                // ─────────────────────────────────────────────────────────
                // 3. Service metadata
                // ─────────────────────────────────────────────────────────
                var service = dbcontext.Services.FirstOrDefault(s => s.Serviceid == serviceIdInt);
                if (service == null) return NotFound("Service not found.");
                string serviceName = service.Servicename ?? "Unknown Service";

                bool showSanctionDateColumn =
                    type?.Equals("sanctioned", StringComparison.OrdinalIgnoreCase) == true ||
                    (string.IsNullOrEmpty(type) || type.Equals("total", StringComparison.OrdinalIgnoreCase))
                        && response.Any(x => x.WorkflowStatus?.ToLower() == "sanctioned");

                // ─────────────────────────────────────────────────────────
                // 4. Columns
                // ─────────────────────────────────────────────────────────
                var columns = new List<object>
        {
            new { accessorKey = "sno",            header = "S.No" },
            new { accessorKey = "referenceNumber", header = "Reference Number" }
        };

                switch (accessLevel)
                {
                    case "State":
                        columns.Insert(1, new { accessorKey = "divisionName", header = "Division Name" });
                        columns.Insert(2, new { accessorKey = "districtName", header = "District Name" });
                        break;
                    case "Division":
                        columns.Insert(1, new { accessorKey = "districtName", header = "District Name" });
                        columns.Insert(2, new { accessorKey = "tehsilName", header = "Tehsil Name" });
                        break;
                    case "District":
                        columns.Insert(1, new { accessorKey = "tehsilName", header = "Tehsil Name" });
                        break;
                }

                columns.Add(new { accessorKey = "applicantName", header = "Applicant Name" });
                columns.Add(new { accessorKey = "serviceName", header = "Service Name" });
                columns.Add(new { accessorKey = "currentlyWith", header = "Currently With" });
                columns.Add(new { accessorKey = "status", header = "Application Status" });
                columns.Add(new { accessorKey = "submissionDate", header = "Submission Date" });

                if (showSanctionDateColumn)
                    columns.Add(new { accessorKey = "sanctionDate", header = "Sanction Date" });

                // ─────────────────────────────────────────────────────────
                // 5. Rows
                // ─────────────────────────────────────────────────────────
                var data = new List<Dictionary<string, object>>();
                int sno = pageIndex * pageSize + 1;

                foreach (var details in response)
                {
                    if (string.IsNullOrEmpty(details.ReferenceNumber)) continue;

                    var formDetails = JsonConvert.DeserializeObject<dynamic>(details.FormDetails ?? "{}");
                    string applicantName = GetFieldValue("ApplicantName", formDetails);

                    string status = string.IsNullOrEmpty(details.WorkflowStatus)
                                    || details.WorkflowStatus.Equals("initiated", StringComparison.OrdinalIgnoreCase)
                                        ? "Under Process"
                                        : details.WorkflowStatus;

                    // Workflow context
                    var officers = JsonConvert.DeserializeObject<JArray>(details.WorkFlow ?? "[]");
                    var currentPlayer = details.CurrentPlayer;

                    string officerDesignation = "Unknown";
                    string officerAccessLevel = "Unknown";
                    string officerStatus = "Unknown";
                    string officerArea = "Unknown";

                    if (officers != null && currentPlayer >= 0 && currentPlayer < officers.Count)
                    {
                        officerDesignation = (string?)officers[currentPlayer]?["designation"] ?? "Unknown";
                        officerAccessLevel = (string?)officers[currentPlayer]?["accessLevel"] ?? "Unknown";
                        officerStatus = (string?)officers[currentPlayer]?["status"] ?? "Unknown";
                        officerArea = GetOfficerArea(officerAccessLevel, formDetails);
                    }

                    var row = new Dictionary<string, object>
                    {
                        ["sno"] = sno++,
                        ["referenceNumber"] = details.ReferenceNumber ?? ""
                    };

                    switch (accessLevel)
                    {
                        case "State":
                            row["divisionName"] = details.DivisionName ?? "N/A";
                            row["districtName"] = details.DistrictName ?? "N/A";
                            break;
                        case "Division":
                            row["districtName"] = details.DistrictName ?? "N/A";
                            row["tehsilName"] = details.TehsilName ?? "N/A";
                            break;
                        case "District":
                            row["tehsilName"] = details.TehsilName ?? "N/A";
                            break;
                    }

                    row["applicantName"] = applicantName;
                    row["serviceName"] = serviceName;
                    row["currentlyWith"] = officerStatus.Equals("returntoedit", StringComparison.OrdinalIgnoreCase)
                                            ? "Citizen"
                                            : $"{officerDesignation} ({officerArea})";
                    row["status"] = char.ToUpper(status[0]) + status.Substring(1);
                    row["submissionDate"] = details.Created_at ?? "N/A";

                    if (showSanctionDateColumn)
                    {
                        string sanctionDate = "-";
                        if (status.Equals("sanctioned", StringComparison.OrdinalIgnoreCase)
                            && !string.IsNullOrEmpty(details.WorkFlow))
                        {
                            try
                            {
                                var wf = JsonConvert.DeserializeObject<JArray>(details.WorkFlow);
                                var sanctionedStep = wf?.FirstOrDefault(
                                    w => w["status"]?.ToString()?.ToLower() == "sanctioned");
                                if (sanctionedStep?["completedAt"] != null)
                                    sanctionDate = sanctionedStep["completedAt"]!.ToString();
                            }
                            catch { /* leave as "-" */ }
                        }
                        row["sanctionDate"] = sanctionDate;
                    }

                    data.Add(row);
                }

                _logger.LogInformation(
                    "Returning {RowCount} rows, {ColumnCount} columns, totalRecords={TotalRecords}",
                    data.Count, columns.Count, totalRecords);

                return Json(new
                {
                    data,
                    columns,
                    totalRecords,
                    counts = new
                    {
                        pending = pendingCount,
                        returntoedit = returnToEditCount,
                        sanctioned = sanctionedCount,
                        reject = rejectCount,
                        total = totalApplications
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "GetMainApplicationStatusData failed");
                return StatusCode(500, new
                {
                    error = ex.Message,
                    details = ex.StackTrace,
                    innerException = ex.InnerException?.Message
                });
            }
        }
        [HttpGet]
        public async Task<IActionResult> GetApplicationHistory(string ApplicationId, int page = 0, int size = 10)
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
            int currentPlayerIndex = (int)application.Currentplayer!;
            var currentPlayer = players!.FirstOrDefault(o => (int)o["playerId"]! == currentPlayerIndex);

            var history = await dbcontext.Actionhistory
                .Where(ah => ah.Referencenumber == ApplicationId && !ah.Actiontaken.Contains("Withheld"))
                .OrderBy(ah => ah.Actiontakendate)
                .ToListAsync();

            var formDetails = JsonConvert.DeserializeObject<dynamic>(application.Formdetails!);

            var columns = new List<dynamic>
            {
                new { header = "S.No", accessorKey = "sno" },
                new { header = "Action Taker", accessorKey = "actionTaker" },
                new { header = "Action Taken", accessorKey = "actionTaken" },
                new { header = "Remarks", accessorKey = "remarks" },
                new { header = "Action Taken On", accessorKey = "actionTakenOn" },
            };

            var data = new List<dynamic>();
            int index = 1;

            foreach (var item in history)
            {
                string officerArea = GetOfficerAreaForHistory(item.Locationlevel!, item.Locationvalue.ToString()!);
                data.Add(new
                {
                    sno = index++,
                    actionTaker = item.Actiontaker != "Citizen" ? item.Actiontaker + " " + officerArea : item.Actiontaker,
                    actionTaken = item.Actiontaken == "ReturnToCitizen" ? "Returned to citizen for correction" : item.Actiontaken,
                    remarks = item.Remarks ?? "",
                    actionTakenOn = item.Actiontakendate?.ToString() ?? "",
                });
            }

            if (currentPlayer != null && (string)currentPlayer["status"]! == "pending")
            {
                string designation = (string)currentPlayer["designation"]!;
                string accessLevel = (string)currentPlayer["accessLevel"]!;
                string officerArea = GetOfficerArea(accessLevel, formDetails);

                data.Add(new
                {
                    sno = index++,
                    actionTaker = designation + " " + officerArea,
                    actionTaken = "Pending",
                    remarks = "",
                    actionTakenOn = "",
                });
            }

            int totalRecords = data.Count;

            return Json(new { data, columns, totalRecords });
        }

        private string GetOfficerAreaForHistory(string locationLevel, string locationValue)
        {
            if (string.IsNullOrEmpty(locationValue)) return "";

            int locId = int.Parse(locationValue);

            return locationLevel switch
            {
                "Tehsil" => dbcontext.Tswotehsil.FirstOrDefault(t => t.Tehsilid == locId)?.Tehsilname ?? "",
                "District" => dbcontext.District.FirstOrDefault(d => d.Districtid == locId)?.Districtname ?? "",
                "Division" => locId == 1 ? "Jammu" : "Kashmir",
                _ => ""
            };
        }
    }
}