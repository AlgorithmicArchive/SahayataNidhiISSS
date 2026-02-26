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
        UserHelperFunctions helper) : Controller
    {
        protected readonly SwdjkContext dbcontext = dbcontext;
        protected readonly ILogger<ViewerController> _logger = logger;
        protected readonly UserHelperFunctions helper = helper;

        public override void OnActionExecuted(ActionExecutedContext context)
        {
            base.OnActionExecuted(context);

            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var officer = dbcontext.Users.FirstOrDefault(u => u.UserId.ToString() == userId);
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
                new("@AccessLevel", NpgsqlDbType.Varchar) { Value = accessLevel },
                new("@AccessCode", NpgsqlDbType.Integer) { Value = accessCode ?? DBNull.Value },
                new("@ServiceId", NpgsqlDbType.Integer) { Value = int.Parse(serviceId) },
                new("@TakenBy", NpgsqlDbType.Varchar) { Value = DBNull.Value },
                new("@DivisionCode", NpgsqlDbType.Integer) { Value = divisionCode ?? DBNull.Value }
            };

            var counts = dbcontext.Database
                .SqlQueryRaw<MainStatusCounts>(
                    "SELECT * FROM get_main_application_status_count(@AccessLevel, @AccessCode, @ServiceId, @TakenBy, @DivisionCode)",
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
                }
            };

            var pensionCategories = new List<dynamic>
            {
                new { Category = "OLD AGE PENSION", Color = "#4f46e5" },
                new { Category = "WOMEN IN DISTRESS", Color = "#059669" },
                new { Category = "PHYSICALLY CHALLENGED PERSON", Color = "#f59e0b" },
                new { Category = "TRANSGENDER", Color = "#0ea5e9" }
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
            var service = dbcontext.Services.FirstOrDefault(s => s.ServiceId == int.Parse(serviceId));

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
                string serviceName = service.ServiceName!;
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

        public string GetOfficerArea(string accessLevel, dynamic formDetails)
        {
            int accessCode;

            switch (accessLevel)
            {
                case "Tehsil":
                    accessCode = Convert.ToInt32(GetFieldValue("Tehsil", formDetails));
                    var tehsil = dbcontext.TswoTehsils.FirstOrDefault(t => t.TehsilId == accessCode);
                    return tehsil?.TehsilName ?? string.Empty;

                case "District":
                    accessCode = Convert.ToInt32(GetFieldValue("District", formDetails));
                    var district = dbcontext.Districts.FirstOrDefault(d => d.DistrictId == accessCode);
                    return district?.DistrictName ?? string.Empty;

                case "Division":
                    accessCode = Convert.ToInt32(GetFieldValue("District", formDetails));
                    var districtForDivision = dbcontext.Districts.FirstOrDefault(d => d.DistrictId == accessCode);
                    if (districtForDivision == null)
                        return string.Empty;
                    return districtForDivision.Division == 1 ? "Jammu" : "Kashmir";
                case "State":
                    return "J&K";
                default:
                    return string.Empty;
            }
        }
        [HttpGet]
        public IActionResult GetMainApplicationStatusData(string serviceId, string type, int pageIndex = 0, int pageSize = 10, string state = "0", string? division = null, string? district = null, string? tehsil = null)
        {
            try
            {
                // Log the incoming parameters
                Console.WriteLine($"=== DEBUG: Received Parameters ===");
                Console.WriteLine($"serviceId: {serviceId}");
                Console.WriteLine($"type: {type}");
                Console.WriteLine($"pageIndex: {pageIndex}");
                Console.WriteLine($"pageSize: {pageSize}");
                Console.WriteLine($"state: {state}");
                Console.WriteLine($"division: {division}");
                Console.WriteLine($"district: {district}");
                Console.WriteLine($"tehsil: {tehsil}");
                Console.WriteLine($"==================================");

                // Determine access level and codes
                string accessLevel;
                object accessCode = DBNull.Value;
                object divisionCode = DBNull.Value;

                if (!string.IsNullOrWhiteSpace(tehsil) && int.TryParse(tehsil, out var tehsilVal))
                {
                    accessLevel = "Tehsil";
                    accessCode = tehsilVal;
                    Console.WriteLine($"DEBUG: Using Tehsil level with code: {accessCode}");
                }
                else if (!string.IsNullOrWhiteSpace(district) && int.TryParse(district, out var districtVal))
                {
                    accessLevel = "District";
                    accessCode = districtVal;
                    Console.WriteLine($"DEBUG: Using District level with code: {accessCode}");
                }
                else if (!string.IsNullOrWhiteSpace(division) && int.TryParse(division, out var divisionVal))
                {
                    accessLevel = "Division";
                    accessCode = divisionVal;
                    divisionCode = divisionVal;
                    Console.WriteLine($"DEBUG: Using Division level with code: {accessCode}");
                }
                else
                {
                    accessLevel = "State";
                    accessCode = state == "0" ? 0 : DBNull.Value;
                    Console.WriteLine($"DEBUG: Using State level with code: {accessCode}");
                }

                Console.WriteLine($"DEBUG: Final values - accessLevel: {accessLevel}, accessCode: {accessCode}, divisionCode: {divisionCode}");

                // METHOD 1: Try with hardcoded values first to test the connection
                Console.WriteLine("DEBUG: Testing with hardcoded values...");
                var testSql = "SELECT * FROM public.get_main_application_status_data('State', 0, 1, NULL, NULL, 0, 10, true)";
                Console.WriteLine($"DEBUG: Test SQL: {testSql}");

                var testResponse = dbcontext.Database
                    .SqlQueryRaw<MainApplicationStatusDto>(testSql)
                    .ToList();

                Console.WriteLine($"DEBUG: Test query returned {testResponse.Count} records");

                if (testResponse.Count > 0)
                {
                    Console.WriteLine($"DEBUG: Test successful! First record ReferenceNumber: {testResponse[0]?.ReferenceNumber}");
                }

                // Get counts from the separate count function using parameterized query
                long totalRecords = 0;
                int pendingCount = 0, returnToEditCount = 0, sanctionedCount = 0, rejectCount = 0, totalApplications = 0;

                try
                {
                    // Use parameterized query like GetApplicationStatus does
                    var countParameters = new List<NpgsqlParameter>
            {
                new NpgsqlParameter("@AccessLevel", NpgsqlDbType.Varchar) { Value = accessLevel },
                new NpgsqlParameter("@AccessCode", NpgsqlDbType.Integer) { Value = accessCode },
                new NpgsqlParameter("@ServiceId", NpgsqlDbType.Integer) { Value = int.Parse(serviceId) },
                new NpgsqlParameter("@TakenBy", NpgsqlDbType.Varchar) { Value = DBNull.Value },
                new NpgsqlParameter("@DivisionCode", NpgsqlDbType.Integer) { Value = divisionCode }
            };

                    var countSql = "SELECT * FROM get_main_application_status_count(@AccessLevel, @AccessCode, @ServiceId, @TakenBy, @DivisionCode)";

                    Console.WriteLine($"DEBUG: Count SQL: {countSql}");
                    Console.WriteLine($"DEBUG: Count Parameters:");
                    foreach (var param in countParameters)
                    {
                        Console.WriteLine($"  {param.ParameterName}: {param.Value} (Type: {param.Value?.GetType()?.Name})");
                    }

                    var countResult = dbcontext.Database
                        .SqlQueryRaw<MainStatusCounts>(countSql, countParameters.ToArray())
                        .AsEnumerable()
                        .FirstOrDefault() ?? new MainStatusCounts();

                    Console.WriteLine($"DEBUG: Count result: Pending={countResult.PendingCount}, Sanctioned={countResult.SanctionedCount}, Total={countResult.TotalApplications}");

                    if (countResult != null)
                    {
                        pendingCount = countResult.PendingCount;
                        returnToEditCount = countResult.ReturnToEditCount;
                        sanctionedCount = countResult.SanctionedCount;
                        rejectCount = countResult.RejectCount;
                        totalApplications = countResult.TotalApplications;

                        // Set totalRecords based on the status type requested
                        if (string.IsNullOrEmpty(type) || type == "total")
                        {
                            totalRecords = totalApplications;
                        }
                        else if (type == "pending")
                        {
                            totalRecords = pendingCount;
                        }
                        else if (type == "returntoedit")
                        {
                            totalRecords = returnToEditCount;
                        }
                        else if (type == "sanctioned")
                        {
                            totalRecords = sanctionedCount;
                        }
                        else if (type == "reject")
                        {
                            totalRecords = rejectCount;
                        }

                        Console.WriteLine($"DEBUG: Counts from separate function:");
                        Console.WriteLine($"  Total: {totalApplications}");
                        Console.WriteLine($"  Pending: {pendingCount}");
                        Console.WriteLine($"  Return to Edit: {returnToEditCount}");
                        Console.WriteLine($"  Sanctioned: {sanctionedCount}");
                        Console.WriteLine($"  Reject: {rejectCount}");
                        Console.WriteLine($"  Using totalRecords for type '{type}': {totalRecords}");
                    }
                }
                catch (Exception countEx)
                {
                    Console.WriteLine($"DEBUG: Error getting counts: {countEx.Message}");
                    Console.WriteLine($"DEBUG: Count error details: {countEx.StackTrace}");
                    // Use data count as fallback
                    totalRecords = testResponse.Count;
                    Console.WriteLine($"DEBUG: Using fallback totalRecords: {totalRecords}");
                }

                // Build parameterized query for data retrieval (always use parameters, no string interpolation)
                var dataParameters = new List<NpgsqlParameter>
        {
            new NpgsqlParameter("@p_access_level", NpgsqlDbType.Varchar)
            {
                Value = accessLevel
            },
            new NpgsqlParameter("@p_access_code", NpgsqlDbType.Integer)
            {
                Value = accessCode
            },
            new NpgsqlParameter("@p_service_id", NpgsqlDbType.Integer)
            {
                Value = int.Parse(serviceId)
            },
            new NpgsqlParameter("@p_division_code", NpgsqlDbType.Integer)
            {
                Value = divisionCode
            },
            new NpgsqlParameter("@p_application_status", NpgsqlDbType.Varchar)
            {
                Value = string.IsNullOrEmpty(type) || type == "total" ? (object)DBNull.Value : type
            },
            new NpgsqlParameter("@p_page_index", NpgsqlDbType.Integer)
            {
                Value = pageIndex
            },
            new NpgsqlParameter("@p_page_size", NpgsqlDbType.Integer)
            {
                Value = pageSize
            },
            new NpgsqlParameter("@p_is_paginated", NpgsqlDbType.Boolean)
            {
                Value = true
            }
        };

                string dataSql = "SELECT * FROM public.get_main_application_status_data(@p_access_level, @p_access_code, @p_service_id, @p_division_code, @p_application_status, @p_page_index, @p_page_size, @p_is_paginated)";

                Console.WriteLine($"DEBUG: Data SQL: {dataSql}");
                Console.WriteLine($"DEBUG: Data Parameters:");
                foreach (var param in dataParameters)
                {
                    Console.WriteLine($"  {param.ParameterName}: {param.Value} (Type: {param.Value?.GetType()?.Name})");
                }

                // Get paginated data
                List<MainApplicationStatusDto> response;

                try
                {
                    response = dbcontext.Database
                        .SqlQueryRaw<MainApplicationStatusDto>(dataSql, dataParameters.ToArray())
                        .ToList();

                    Console.WriteLine($"DEBUG: Data query returned {response.Count} records");
                }
                catch (Exception dataEx)
                {
                    Console.WriteLine($"DEBUG: Data query failed: {dataEx.Message}");
                    Console.WriteLine($"DEBUG: Data error details: {dataEx.StackTrace}");

                    // Return empty response
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

                // Check if we got any data
                if (response.Count == 0)
                {
                    Console.WriteLine($"DEBUG: No data returned. Possible issues:");
                    Console.WriteLine($"  - Service ID {serviceId} may not exist in database");
                    Console.WriteLine($"  - No applications with datatype='new' for this service");
                    Console.WriteLine($"  - Access level filtering may be excluding all records");
                    Console.WriteLine($"  - Application status filter '{type}' may not match any records");

                    // Return empty response with proper structure
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

                Console.WriteLine($"DEBUG: Successfully retrieved {response.Count} records");
                Console.WriteLine($"DEBUG: First record: ReferenceNumber={response[0]?.ReferenceNumber}, WorkflowStatus={response[0]?.WorkflowStatus}");

                // Get service details
                var service = dbcontext.Services
                    .FirstOrDefault(s => s.ServiceId == int.Parse(serviceId));

                if (service == null)
                {
                    Console.WriteLine($"DEBUG: Service with ID {serviceId} not found in Services table");
                    return NotFound("Service not found.");
                }

                string serviceName = service.ServiceName ?? "Unknown Service";
                Console.WriteLine($"DEBUG: Service name: {serviceName}");

                // Determine if sanction date column should be shown
                bool showSanctionDateColumn = type == "sanctioned" ||
                                              (type == "total" && response.Any(x =>
                                                  x.WorkflowStatus != null &&
                                                  x.WorkflowStatus.ToLower() == "sanctioned"));
                Console.WriteLine($"DEBUG: Show sanction date column: {showSanctionDateColumn}");

                // Build columns based on access level
                var columns = new List<object>
        {
            new { accessorKey = "sno", header = "S.No" },
            new { accessorKey = "referenceNumber", header = "Reference Number" }
        };

                if (accessLevel == "State")
                {
                    columns.Insert(1, new { accessorKey = "divisionName", header = "Division Name" });
                    columns.Insert(2, new { accessorKey = "districtName", header = "District Name" });
                }
                else if (accessLevel == "Division")
                {
                    columns.Insert(1, new { accessorKey = "districtName", header = "District Name" });
                    columns.Insert(2, new { accessorKey = "tehsilName", header = "Tehsil Name" });
                }
                else if (accessLevel == "District")
                {
                    columns.Insert(1, new { accessorKey = "tehsilName", header = "Tehsil Name" });
                }

                columns.Add(new { accessorKey = "applicantName", header = "Applicant Name" });
                columns.Add(new { accessorKey = "serviceName", header = "Service Name" });
                columns.Add(new { accessorKey = "currentlyWith", header = "Currently With" });
                columns.Add(new { accessorKey = "status", header = "Application Status" });
                columns.Add(new { accessorKey = "submissionDate", header = "Submission Date" });

                if (showSanctionDateColumn)
                {
                    columns.Add(new { accessorKey = "sanctionDate", header = "Sanction Date" });
                }

                // Build data rows
                var data = new List<Dictionary<string, object>>();
                int sno = pageIndex * pageSize + 1;

                Console.WriteLine($"DEBUG: Processing {response.Count} records into data rows...");

                foreach (var details in response)
                {
                    // Skip rows that have no reference number
                    if (string.IsNullOrEmpty(details.ReferenceNumber))
                    {
                        Console.WriteLine($"DEBUG: Skipping record with empty ReferenceNumber");
                        continue;
                    }

                    Console.WriteLine($"DEBUG: Processing record: {details.ReferenceNumber}");

                    // Parse form details JSON
                    var formDetails = JsonConvert.DeserializeObject<dynamic>(details.FormDetails ?? "{}");

                    // Get applicant name from form details
                    string applicantName = GetFieldValue("ApplicantName", formDetails);
                    Console.WriteLine($"DEBUG: Applicant name for {details.ReferenceNumber}: {applicantName}");

                    // Determine status display - use WorkflowStatus from the function result
                    string status = details.WorkflowStatus == "initiated" ? "Under Process" :
                                  (details.WorkflowStatus ?? "Under Process");

                    // Get submission date
                    string? submissionDate = details.Created_at;

                    // Parse workflow to get current officer details
                    var officers = JsonConvert.DeserializeObject<JArray>(details.WorkFlow ?? "[]");
                    var currentPlayer = details.CurrentPlayer;

                    string officerDesignation = "Unknown";
                    string officerAccessLevel = "Unknown";
                    string officerStatus = "Unknown";
                    string officerArea = "Unknown";

                    if (officers != null && currentPlayer >= 0 && currentPlayer < officers.Count)
                    {
                        officerDesignation = (string)officers[currentPlayer]?["designation"]! ?? "Unknown";
                        officerAccessLevel = (string)officers[currentPlayer]?["accessLevel"]! ?? "Unknown";
                        officerStatus = (string)officers[currentPlayer]?["status"]! ?? "Unknown";
                        officerArea = GetOfficerArea(officerAccessLevel, formDetails);
                    }

                    // Build row data
                    var row = new Dictionary<string, object>
                    {
                        ["sno"] = sno++,
                        ["referenceNumber"] = details.ReferenceNumber ?? ""
                    };

                    // Add location columns based on access level
                    if (accessLevel == "State")
                    {
                        row["divisionName"] = details.DivisionName ?? "N/A";
                        row["districtName"] = details.DistrictName ?? "N/A";
                    }
                    else if (accessLevel == "Division")
                    {
                        row["districtName"] = details.DistrictName ?? "N/A";
                        row["tehsilName"] = details.TehsilName ?? "N/A";
                    }
                    else if (accessLevel == "District")
                    {
                        row["tehsilName"] = details.TehsilName ?? "N/A";
                    }

                    row["applicantName"] = applicantName;
                    row["serviceName"] = serviceName;
                    row["currentlyWith"] = officerStatus == "returntoedit" ? "Citizen" : $"{officerDesignation} ({officerArea})";
                    row["status"] = char.ToUpper(status[0]) + status.Substring(1); // Capitalize first letter
                    row["submissionDate"] = submissionDate ?? "N/A";

                    // Add sanction date if applicable
                    if (showSanctionDateColumn)
                    {
                        string sanctionDate = "-";

                        if (status.ToLower() == "sanctioned" && !string.IsNullOrEmpty(details.WorkFlow))
                        {
                            try
                            {
                                var workflow = JsonConvert.DeserializeObject<JArray>(details.WorkFlow);
                                var sanctionedStep = workflow?
                                    .FirstOrDefault(w => w["status"]?.ToString()?.ToLower() == "sanctioned");

                                if (sanctionedStep?["completedAt"] != null)
                                {
                                    sanctionDate = sanctionedStep["completedAt"]!.ToString();
                                }
                            }
                            catch
                            {
                                sanctionDate = "-";
                            }
                        }

                        row["sanctionDate"] = sanctionDate;
                    }

                    data.Add(row);
                }

                Console.WriteLine($"DEBUG: Final data rows count: {data.Count}");
                Console.WriteLine($"DEBUG: Returning response with {data.Count} rows, {columns.Count} columns, totalRecords: {totalRecords}");

                // Return JSON response
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
                Console.WriteLine($"ERROR: Exception in GetMainApplicationStatusData: {ex.Message}");
                Console.WriteLine($"Stack Trace: {ex.StackTrace}");

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
                .FirstOrDefaultAsync(ca => ca.ReferenceNumber == ApplicationId);

            if (application == null)
            {
                return NotFound("Application not found.");
            }

            var players = JsonConvert.DeserializeObject<JArray>(application.WorkFlow!);
            int currentPlayerIndex = (int)application.CurrentPlayer!;
            var currentPlayer = players!.FirstOrDefault(o => (int)o["playerId"]! == currentPlayerIndex);

            var history = await dbcontext.ActionHistories
                .Where(ah => ah.ReferenceNumber == ApplicationId && !ah.ActionTaken.Contains("Withheld"))
                .OrderBy(ah => ah.ActionTakenDate)
                .ToListAsync();

            var formDetails = JsonConvert.DeserializeObject<dynamic>(application.FormDetails!);

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
                string officerArea = GetOfficerAreaForHistory(item.LocationLevel!, item.LocationValue.ToString()!);
                data.Add(new
                {
                    sno = index++,
                    actionTaker = item.ActionTaker != "Citizen" ? item.ActionTaker + " " + officerArea : item.ActionTaker,
                    actionTaken = item.ActionTaken == "ReturnToCitizen" ? "Returned to citizen for correction" : item.ActionTaken,
                    remarks = item.Remarks ?? "",
                    actionTakenOn = item.ActionTakenDate?.ToString() ?? "",
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
                "Tehsil" => dbcontext.TswoTehsils.FirstOrDefault(t => t.TehsilId == locId)?.TehsilName ?? "",
                "District" => dbcontext.Districts.FirstOrDefault(d => d.DistrictId == locId)?.DistrictName ?? "",
                "Division" => locId == 1 ? "Jammu" : "Kashmir",
                _ => ""
            };
        }
    }
}