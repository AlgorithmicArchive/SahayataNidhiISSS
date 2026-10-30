using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Npgsql;
using System.Data;
using SahayataNidhi.Models;
using SahayataNidhi.Models.Entities;
using System.Text.Json;

namespace SahayataNidhi.Controllers.Admin
{
    public partial class AdminController : Controller
    {
        [HttpGet]
        public IActionResult GetApplicationsForReports(int AccessCode, int ServiceId, string? StatusType = null, int pageIndex = 0, int pageSize = 10)
        {
            try
            {
                if (pageIndex < 0 || pageSize <= 0)
                {
                    _logger.LogWarning($"Invalid pagination parameters: pageIndex={pageIndex}, pageSize={pageSize}");
                    return BadRequest(new { error = "Invalid pageIndex or pageSize" });
                }

                var officerDetails = GetOfficerDetails();
                _logger.LogInformation($"Officer Role: {officerDetails?.Role}, AccessLevel: {officerDetails?.AccessLevel}");

                // Call PostgreSQL function using FromSqlRaw
                var response = dbcontext.Database
                    .SqlQueryRaw<SummaryReports>(
                        "SELECT * FROM get_applications_for_report({0}, {1}, {2}, {3})",
                        AccessCode, ServiceId, "District", "new")
                    .ToList();

                _logger.LogInformation($"Fetched {response.Count} records for AccessCode: {AccessCode}, ServiceId: {ServiceId}");

                if (!response.Any())
                {
                    _logger.LogWarning($"No data returned for AccessCode: {AccessCode}, ServiceId: {ServiceId}");
                }

                var sortedResponse = response.OrderBy(a => a.Tehsilname).ToList();
                var totalRecords = sortedResponse.Count;
                var pagedResponse = sortedResponse
                    .Skip(pageIndex * pageSize)
                    .Take(pageSize)
                    .ToList();

                List<dynamic> columns =
                [
                    new { accessorKey = "tehsilName", header = "Tehsil Name" },
                    new { accessorKey = "totalApplicationsSubmitted", header = "Total Applications Submitted" },
                    new { accessorKey = "totalApplicationsRejected", header = "Total Applications Rejected" },
                    new { accessorKey = "totalApplicationsSanctioned", header = "Total Applications Sanctioned" }
                ];

                List<dynamic> data = pagedResponse.Select(item => new
                {
                    tehsilName = item.Tehsilname,
                    totalApplicationsSubmitted = item.Totalapplicationssubmitted,
                    totalApplicationsRejected = item.Totalapplicationsrejected,
                    totalApplicationsSanctioned = item.Totalapplicationssanctioned
                }).Cast<dynamic>().ToList();

                return Json(new
                {
                    data,
                    columns,
                    totalRecords
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error executing GetApplicationsForReport for AccessCode: {AccessCode}, ServiceId: {ServiceId}");
                return StatusCode(500, new { error = "An error occurred while fetching the report" });
            }
        }

        [HttpGet]
        public IActionResult GetDetailsForDashboard()
        {
            try
            {
                var officer = GetOfficerDetails();
                if (officer == null)
                {
                    return BadRequest(new { error = "Officer details not found" });
                }

                var result = dbcontext.Database
                    .SqlQueryRaw<DashboardData>(
                        @"SELECT 
                    ""TotalOfficers"" AS ""TotalOfficers"",
                    ""TotalCitizens"" AS ""TotalCitizens"",
                    ""TotalApplicationsSubmitted"" AS ""TotalApplicationsSubmitted"",
                    ""TotalServices"" AS ""TotalServices""
                          FROM get_count_for_admin({0}, {1}, {2}, {3})",
                        officer.AccessLevel ?? (object)DBNull.Value,
                        officer.AccessCode!,
                        "new",
                        officer.Department == 0 ? (object)DBNull.Value : officer.Department!)
                    .FirstOrDefault();

                if (result == null || result.TotalOfficers == -1)
                {
                    return BadRequest(new { error = "Invalid access level or code" });
                }

                // NEW: Count pending DSCs for the dashboard card
                var pendingDscCount = dbcontext.Certificates.ToList();

                return Json(new
                {
                    totalOfficers = result.TotalOfficers,
                    totalRegisteredUsers = result.TotalCitizens,
                    totalApplicationsSubmitted = result.TotalApplicationsSubmitted,
                    totalServices = result.TotalServices,
                    pendingDscCount = pendingDscCount.Count // NEW
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching dashboard data");
                return StatusCode(500, new { error = "An error occurred while fetching dashboard data", details = ex.Message });
            }
        }


        [HttpGet]
        public IActionResult GetPendingDSCList(int pageIndex = 0, int pageSize = 10)
        {
            try
            {
                var officer = GetOfficerDetails();
                if (officer == null)
                {
                    return BadRequest(new { error = "Officer details not found" });
                }

                // ── Base query: ALL certificates (pending, approved, rejected) ────
                var query = from c in dbcontext.Certificates
                            join u in dbcontext.Users on c.Officerid equals u.Userid
                            select new
                            {
                                CertificateId = c.Uuid,
                                OfficerId = u.Userid,
                                OfficerName = u.Name,
                                OfficerEmail = u.Email,
                                AdditionalDetails = u.Additionaldetails, // JSON text
                                CertSubjectName = c.CertSubjectName,
                                CertifyingAuthority = c.Certifiyingauthority,
                                ExpirationDate = c.Expirationdate,
                                Status = c.Status
                            };

                // ── Total count BEFORE paging (now includes every row) ────────────
                var totalRecords = query.Count();

                // ── Paged data (still includes raw JSON) ──────────────────────────
                var pagedData = query
                    .OrderByDescending(x => x.CertificateId)
                    .Skip(pageIndex * pageSize)
                    .Take(pageSize)
                    .ToList();

                // ── District lookup once ──────────────────────────────────────────
                var districts = dbcontext.District
                    .ToDictionary(d => d.Districtid, d => d.Districtname);

                // ── Columns shown in the grid ─────────────────────────────────────
                var columns = new List<object>
                    {
                        new { accessorKey = "officerName",        header = "Officer Name (DB)" },
                        new { accessorKey = "officerEmail",       header = "Email" },
                        new { accessorKey = "accessLevel",        header = "Access Level" },
                        new { accessorKey = "areaCode",           header = "Area" },
                        new { accessorKey = "certSubjectName",    header = "Certificate Name (DSC)" },
                        new { accessorKey = "certifyingAuthority",header = "Certifying Authority" },
                        new { accessorKey = "expirationDate",     header = "Expiration Date" },
                        new { accessorKey = "status",             header = "Status" }
                    };

                // ── Shape output + parse JSON for AccessLevel / AreaCode ──────────
                var data = pagedData.Select(item =>
                {
                    string? accessLevel = null;
                    int? accessCode = null;

                    if (!string.IsNullOrWhiteSpace(item.AdditionalDetails))
                    {
                        try
                        {
                            using var doc = JsonDocument.Parse(item.AdditionalDetails);
                            var root = doc.RootElement;

                            if (root.TryGetProperty("AccessLevel", out var al) &&
                                al.ValueKind == JsonValueKind.String)
                            {
                                accessLevel = al.GetString();
                            }

                            if (root.TryGetProperty("AccessCode", out var ac))
                            {
                                if (ac.ValueKind == JsonValueKind.Number)
                                    accessCode = ac.GetInt32();
                                else if (ac.ValueKind == JsonValueKind.String &&
                                         int.TryParse(ac.GetString(), out var parsed))
                                    accessCode = parsed;
                            }

                            // Fallback for DSWO rows that only carry DistrictId
                            if (accessCode == null &&
                                root.TryGetProperty("DistrictId", out var did))
                            {
                                if (did.ValueKind == JsonValueKind.Number)
                                    accessCode = did.GetInt32();
                                else if (did.ValueKind == JsonValueKind.String &&
                                         int.TryParse(did.GetString(), out var didParsed))
                                    accessCode = didParsed;
                            }
                        }
                        catch (System.Text.Json.JsonException ex)
                        {
                            _logger.LogWarning(ex,
                                "Failed to parse AdditionalDetails for officer {OfficerId}",
                                item.OfficerId);
                        }
                    }

                    // ── Human-readable AreaCode ───────────────────────────────────
                    string? areaCode = accessLevel switch
                    {
                        "District" =>
                            accessCode.HasValue &&
                            districts.TryGetValue(accessCode.Value, out var districtName)
                                ? $"District {districtName}"
                                : null,

                        "Division" or "Director" => accessCode switch
                        {
                            1 => "Director Jammu",
                            2 => "Director Kashmir",
                            _ => null
                        },

                        _ => null
                    };

                    // ── Conditional actions based on status ───────────────────────
                    string status = (item.Status ?? "").Trim().ToUpperInvariant();
                    var customActions = new List<dynamic>();

                    if (status == "PENDING")
                    {
                        customActions.Add(new
                        {
                            type = "Approve",
                            tooltip = "Approve DSC",
                            color = "#4CAF50",
                            actionFunction = "ApproveDSC"
                        });
                        customActions.Add(new
                        {
                            type = "Reject",
                            tooltip = "Reject DSC",
                            color = "#F44336",
                            actionFunction = "RejectDSC"
                        });
                    }
                    else if (status == "APPROVED")
                    {
                        customActions.Add(new
                        {
                            type = "View",
                            tooltip = "Already Approved",
                            color = "#94A3B8",
                            actionFunction = "Noop"
                        });
                    }
                    else if (status == "REJECTED")
                    {
                        customActions.Add(new
                        {
                            type = "View",
                            tooltip = "Already Rejected",
                            color = "#94A3B8",
                            actionFunction = "Noop"
                        });
                    }

                    return new
                    {
                        certificateId = item.CertificateId,
                        officerName = item.OfficerName,
                        officerEmail = item.OfficerEmail,
                        accessLevel = accessLevel,
                        areaCode = areaCode,
                        certSubjectName = item.CertSubjectName,
                        certifyingAuthority = item.CertifyingAuthority,
                        expirationDate = item.ExpirationDate?.ToString("dd MMM yyyy"),
                        status = item.Status,
                        customActions = customActions
                    };
                }).ToList();

                return Json(new { data, columns, totalRecords });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching DSC list");
                return StatusCode(500, new
                {
                    error = "An error occurred while fetching DSCs",
                    details = ex.Message
                });
            }
        }
        public string GetArea(string AccessLevel, int AccessCode)
        {
            if (AccessLevel == "State") return "Jammu & Kashmir";
            else if (AccessLevel == "Division") return AccessCode == 1 ? "Jammu" : "Kashmir";
            else if (AccessLevel == "District") return dbcontext.District.FirstOrDefault(d => d.Districtid == AccessCode)!.Districtname!;
            else return dbcontext.Tswotehsil.FirstOrDefault(t => t.Tehsilid == AccessCode)!.Tehsilname!;
        }

        [HttpGet]
        public IActionResult GetOfficersList(int pageIndex = 0, int pageSize = 10)
        {
            try
            {
                var officer = GetOfficerDetails();
                if (officer == null)
                {
                    return BadRequest(new { error = "Officer details not found" });
                }

                if (officer.Department == null)
                {
                    return BadRequest(new { error = "Department ID is required" });
                }

                // Call PostgreSQL function
                var response = dbcontext.Database
                    .SqlQueryRaw<OfficerByAccessLevel>(
                        "SELECT * FROM get_officers_by_access_level({0}, {1}, {2})",
                        officer.AccessLevel ?? (object)DBNull.Value,
                        officer.AccessCode!,
                        officer.Department ?? (object)DBNull.Value)
                    .ToList();

                var totalRecords = response.Count;
                var pagedData = response
                    .Skip(pageIndex * pageSize)
                    .Take(pageSize)
                    .ToList();

                var columns = new List<object>
                {
                    new { accessorKey = "name", header = "Name" },
                    new { accessorKey = "username", header = "Username" },
                    new { accessorKey = "email", header = "Email" },
                    new { accessorKey = "mobileNumber", header = "Mobile Number" },
                    new { accessorKey = "designation", header = "Designation" },
                    new { accessorKey = "accessLevel", header = "Officer Level" },
                    new { accessorKey = "accessArea", header = "Officer Area" }
                };

                var customActions = new List<dynamic>
                {
                    new
                    {
                        type = "Validate",
                        tooltip = "Validate",
                        color = "#F0C38E",
                        actionFunction = "ValidateOfficer"
                    }
                };

                var data = pagedData.Select(item => new
                {
                    name = item.Name,
                    username = item.Username,
                    email = item.Email,
                    mobileNumber = item.MobileNumber,
                    designation = item.Designation,
                    accessLevel = item.AccessLevel,
                    accessArea = GetArea(item.AccessLevel!, Convert.ToInt32(item.AccessCode)),
                    customActions = Convert.ToBoolean(item.IsValidated) ? (object)"Validated" : customActions
                }).ToList();

                return Json(new
                {
                    data,
                    columns,
                    totalRecords
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching officers list");
                return StatusCode(500, new
                {
                    error = "An error occurred while fetching officers list",
                    details = ex.Message
                });
            }
        }

        [HttpGet]
        public IActionResult GetUsersList(int pageIndex = 0, int pageSize = 10)
        {
            var officer = GetOfficerDetails();
            if (officer == null)
            {
                return BadRequest(new { error = "Officer details not found" });
            }

            // Call PostgreSQL function
            var response = dbcontext.Database
                .SqlQueryRaw<CitizenByAccessLevel>(
                    "SELECT * FROM get_citizens_by_access_level({0}, {1})",
                    officer.AccessLevel ?? (object)DBNull.Value,
                    officer.AccessCode!)
                .ToList();

            var totalRecords = response.Count;
            var pagedData = response
                .Skip(pageIndex * pageSize)
                .Take(pageSize)
                .ToList();

            var columns = new List<object>
                {
                    new { accessorKey = "name", header = "Name" },
                    new { accessorKey = "username", header = "Username" },
                    new { accessorKey = "email", header = "Email" },
                    new { accessorKey = "mobileNumber", header = "Mobile Number" },
                };

            var data = pagedData.Select(item => new
            {
                name = item.Name,
                username = item.Username,
                email = item.Email,
                mobileNumber = item.MobileNumber,
            }).ToList();

            return Json(new
            {
                data,
                columns,
                totalRecords
            });
        }

        public string GetAreaName(int id, string fieldName)
        {
            if (fieldName == "Tehsil")
            {
                return dbcontext.Tswotehsil.FirstOrDefault(t => t.Tehsilid == id)!.Tehsilname!;
            }
            else if (fieldName.EndsWith("Tehsil"))
            {
                return dbcontext.Tehsil.FirstOrDefault(t => t.Tehsilid == id)!.Tehsilname!;
            }
            else if (fieldName.Contains("District"))
            {
                return dbcontext.District.FirstOrDefault(d => d.Districtid == id)!.Districtname!;
            }
            else if (fieldName.Contains("Muncipality"))
            {
                return dbcontext.Muncipalities.FirstOrDefault(m => m.Muncipalityid == id)!.Muncipalityname!;
            }
            else if (fieldName.Contains("Block"))
            {
                return dbcontext.Blocks.FirstOrDefault(b => b.Blockid == id)!.Blockname!;
            }
            else if (fieldName.Contains("WardNo"))
            {
                return dbcontext.Wards.FirstOrDefault(w => w.Wardcode == id)!.Wardno.ToString()!;
            }
            else return dbcontext.Villages.FirstOrDefault(v => v.Villageid == id)!.Villagename!;
        }

        [HttpGet]
        public IActionResult GetApplicationsList(int pageIndex = 0, int pageSize = 10)
        {
            try
            {
                var officer = GetOfficerDetails();
                if (officer == null)
                {
                    return BadRequest(new { error = "Officer details not found" });
                }

                // Call PostgreSQL function
                var response = dbcontext.Database
                    .SqlQueryRaw<ApplicationByAccessLevel>(
                        "SELECT * FROM get_applications_by_access_level({0}, {1}, {2}, {3})",
                        officer.AccessLevel ?? (object)DBNull.Value,
                        officer.AccessCode!,
                        "new",
                        officer.Department ?? (object)DBNull.Value)
                    .ToList();

                var totalRecords = response.Count;
                var pagedData = response
                    .Skip(pageIndex * pageSize)
                    .Take(pageSize)
                    .ToList();

                var columnsSet = new HashSet<string>();
                var columns = new List<object>();
                var data = new List<Dictionary<string, object>>();

                foreach (var item in pagedData)
                {
                    var dataDict = new Dictionary<string, object>();

                    dataDict["ReferenceNumber"] = item.ReferenceNumber!;

                    if (columnsSet.Add("ReferenceNumber"))
                        columns.Insert(0, new { accessorKey = "ReferenceNumber", header = "Reference Number" });

                    if (!string.IsNullOrWhiteSpace(item.FormDetails))
                    {
                        var formData = JsonConvert.DeserializeObject<Dictionary<string, List<JObject>>>(item.FormDetails!);

                        foreach (var section in formData!)
                        {
                            foreach (var field in section.Value)
                            {
                                string? accessorKey = field["name"]?.ToString();
                                string? header = field["label"]?.ToString();
                                if (accessorKey!.Contains("Tehsil") || accessorKey.Contains("District") || accessorKey.Contains("Block") ||
                                    accessorKey!.Contains("Muncipality") || accessorKey.Contains("WardNo") || accessorKey.Contains("Village"))
                                {
                                    field["value"] = GetAreaName(Convert.ToInt32(field["value"]), accessorKey);
                                }

                                if (!string.IsNullOrWhiteSpace(accessorKey) && !string.IsNullOrWhiteSpace(header))
                                {
                                    if (field["value"] != null)
                                        dataDict[accessorKey] = field["value"]!;
                                    else if (field["File"] != null)
                                        dataDict[accessorKey] = System.IO.Path.GetFileName(field["File"]!.ToString());

                                    if (columnsSet.Add(accessorKey))
                                        columns.Add(new { accessorKey, header });

                                    if (field["additionalFields"] is JArray additionalFields)
                                    {
                                        foreach (var af in additionalFields)
                                        {
                                            string? afKey = af["name"]?.ToString();
                                            string? afLabel = af["label"]?.ToString();

                                            if (afKey!.Contains("Tehsil") || afKey.Contains("District") || afKey.Contains("Block") ||
                                                afKey!.Contains("Muncipality") || afKey.Contains("WardNo") || afKey.Contains("Village"))
                                            {
                                                af["value"] = GetAreaName(Convert.ToInt32(af["value"]), afKey);
                                            }

                                            var afValue = af["value"] ?? (af["File"] != null ? System.IO.Path.GetFileName(af["File"]!.ToString()) : null);

                                            if (!string.IsNullOrWhiteSpace(afKey) && !string.IsNullOrWhiteSpace(afLabel))
                                            {
                                                dataDict[afKey] = afValue?.ToString() ?? "";

                                                if (columnsSet.Add(afKey))
                                                    columns.Add(new { accessorKey = afKey, header = afLabel });
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    data.Add(dataDict);
                }

                return Json(new
                {
                    data,
                    columns,
                    totalRecords
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching applications list");
                return StatusCode(500, new
                {
                    error = "An error occurred while fetching applications list",
                    details = ex.Message
                });
            }
        }

        [HttpGet]
        public IActionResult GetServices(int pageIndex = 0, int pageSize = 10)
        {
            var officer = GetOfficerDetails();
            var services = dbcontext.Services
                .Where(s => s.Departmentid == officer!.Department || officer.Department == null)
                .OrderBy(s => s.Servicename)
                .ToList();

            var totalCount = services.Count;
            var pagedServices = services
                .Skip(pageIndex * pageSize)
                .Take(pageSize)
                .ToList();

            var columns = new List<dynamic>
            {
                new { header = "S.No", accessorKey = "sno" },
                new { header = "Service Name", accessorKey = "servicename" },
                new { header = "Department", accessorKey = "department" }
            };

            List<dynamic> data = [];
            int index = 0;

            foreach (var item in pagedServices)
            {
                int serialNo = (pageIndex * pageSize) + index + 1;
                var department = dbcontext.Departments.FirstOrDefault(d => d.Departmentid == item.Departmentid)?.Departmentname ?? "N/A";

                var row = new
                {
                    sno = serialNo,
                    servicename = item.Servicename,
                    department,
                    serviceId = item.Serviceid,
                };

                data.Add(row);
                index++;
            }

            return Json(new
            {
                status = true,
                data,
                columns,
                totalCount
            });
        }

        [HttpGet]
        public IActionResult GetOfficerToValidate(int pageIndex = 0, int pageSize = 10)
        {
            try
            {
                if (pageIndex < 0 || pageSize <= 0)
                {
                    return BadRequest(new { error = "Invalid pageIndex or pageSize" });
                }

                var officer = GetOfficerDetails();
                if (officer == null)
                {
                    return Unauthorized(new { error = "Officer not found" });
                }

                string accessLevel = officer.AccessLevel!;
                int accessCode = Convert.ToInt32(officer.AccessCode);

                // Call PostgreSQL function
                var response = dbcontext.Database
                    .SqlQueryRaw<OfficersToValidateModal>(
                        "SELECT * FROM get_officers_to_validate({0}, {1})",
                        accessLevel, accessCode)
                    .ToList();

                var totalRecords = response.Count;
                var pagedData = response
                    .Skip(pageIndex * pageSize)
                    .Take(pageSize)
                    .ToList();

                var columns = new List<object>
                {
                    new { accessorKey = "name", header = "Name" },
                    new { accessorKey = "username", header = "Username" },
                    new { accessorKey = "email", header = "Email" },
                    new { accessorKey = "mobileNumber", header = "Mobile Number" },
                    new { accessorKey = "designation", header = "Designation" },
                    new { accessorKey = "userType", header = "User Type" }
                };

                var customActions = pagedData.Select(item =>
                {
                    var isValidated = item.IsValidated ?? false;
                    return new
                    {
                        type = isValidated ? "Unvalidate" : "Validate",
                        tooltip = isValidated ? "Unvalidate" : "Validate",
                        color = isValidated ? "#FF6B6B" : "#F0C38E",
                        actionFunction = "ValidateOfficer"
                    };
                }).ToList();

                var data = pagedData.Select((item, index) => new
                {
                    name = item.Name,
                    username = item.Username,
                    email = item.Email,
                    mobileNumber = item.MobileNumber,
                    designation = item.Designation,
                    userType = item.UserType,
                    customActions = new List<dynamic> { customActions[index] }
                }).ToList();

                return Json(new
                {
                    data,
                    columns,
                    totalRecords
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching officers to validate");
                return StatusCode(500, new { error = "An error occurred while fetching data." });
            }
        }

        [HttpGet]
        public IActionResult GetCurrentAdminDetails()
        {
            var officer = GetOfficerDetails();
            if (officer == null)
            {
                return BadRequest(new { status = false, message = "Officer details not found" });
            }

            var additionalDetails = new
            {
                officer.Role,
                officer.RoleShort,
                officer.AccessLevel,
                officer.AccessCode,
                officer.Department,
            };

            dynamic? districts = null;

            if (officer.AccessLevel == "System")
            {
                districts = dbcontext.District
                    .Select(d => new { d.Districtid, d.Districtname })
                    .ToList();
            }
            else if (officer.AccessLevel == "State")
            {
                districts = dbcontext.District
                    .Select(d => new { d.Districtid, d.Districtname })
                    .ToList();
            }
            else if (officer.AccessLevel == "Division")
            {
                districts = dbcontext.District
                    .Select(d => new { d.Districtid, d.Districtname })
                    .ToList();
            }

            return Json(new
            {
                status = true,
                officer.UserType,
                AdditionalDetails = JsonConvert.SerializeObject(additionalDetails),
                districts
            });
        }

        [HttpGet]
        public IActionResult GetDesignations(int pageIndex = 0, int pageSize = 10)
        {
            try
            {
                var officer = GetOfficerDetails();
                if (officer == null)
                {
                    return BadRequest(new { error = "Officer details not found" });
                }

                var designations = dbcontext.Officersdesignations
                    .Where(d => d.Departmentid == officer.Department)
                    .Select(d => new
                    {
                        DesignationId = d.Uuid,
                        Designation = d.Designation,
                        DesignationShort = d.Designationshort,
                        AccessLevel = d.Accesslevel
                    })
                    .ToList();

                var totalRecords = designations.Count;
                var pagedData = designations
                    .Skip(pageIndex * pageSize)
                    .Take(pageSize)
                    .ToList();

                var columns = new List<object>
                {
                    new { accessorKey = "designationId", header = "ID" },
                    new { accessorKey = "designation", header = "Designation" },
                    new { accessorKey = "designationShort", header = "Short Name" },
                    new { accessorKey = "accessLevel", header = "Access Level" }
                };

                var data = pagedData.Select(d => new
                {
                    designationId = d.DesignationId,
                    designation = d.Designation,
                    designationShort = d.DesignationShort,
                    accessLevel = d.AccessLevel,
                    customActions = new List<object>
                    {
                        new { tooltip = "Update", color = "#F0C38E", actionFunction = "UpdateDesignation" },
                        new { tooltip = "Delete", color = "#F0C38E", actionFunction = "DeleteDesignation" }
                    }
                }).ToList();

                return Json(new
                {
                    data,
                    columns,
                    totalRecords
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching designations");
                return StatusCode(500, new
                {
                    error = "An error occurred while fetching designations",
                    details = ex.Message
                });
            }
        }

        [HttpGet]
        public IActionResult GetDepartments(int pageIndex = 0, int pageSize = 10)
        {
            try
            {
                var departments = dbcontext.Departments
                    .Select(d => new
                    {
                        DepartmentId = d.Departmentid,
                        DepartmentName = d.Departmentname,
                    })
                    .ToList();

                var totalRecords = departments.Count;
                var pagedData = departments
                    .Skip(pageIndex * pageSize)
                    .Take(pageSize)
                    .ToList();

                var columns = new List<object>
                {
                    new { accessorKey = "departmentId", header = "ID" },
                    new { accessorKey = "departmentName", header = "Department" },
                };

                var data = pagedData.Select(d => new
                {
                    departmentId = d.DepartmentId,
                    departmentName = d.DepartmentName,
                    customActions = new List<object>
                    {
                        new { tooltip = "Update", color = "#F0C38E", actionFunction = "UpdateDepartment" },
                        new { tooltip = "Delete", color = "#F0C38E", actionFunction = "DeleteDepartment" }
                    }
                }).ToList();

                return Json(new
                {
                    data,
                    columns,
                    totalRecords
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching departments");
                return StatusCode(500, new
                {
                    error = "An error occurred while fetching departments",
                    details = ex.Message
                });
            }
        }
        [HttpGet]
        public async Task<IActionResult> GetOffices(int pageIndex = 0, int pageSize = 10)
        {
            try
            {
                var officer = GetOfficerDetails();
                if (officer == null)
                    return BadRequest(new { error = "Officer details not found" });

                var departmentId = officer.Department;
                if (departmentId <= 0)
                    return BadRequest(new { error = "User department not found." });

                var officesQuery = dbcontext.Offices
                    .Where(o => o.Departmentid == departmentId)
                    .Select(o => new
                    {
                        o.Officeid,
                        o.Officename,
                        o.Officenameshort,
                        o.Accesslevel
                    });

                var totalRecords = await officesQuery.CountAsync();
                var pagedData = await officesQuery
                    .Skip(pageIndex * pageSize)
                    .Take(pageSize)
                    .ToListAsync();

                var columns = new List<object>
                {
                    new { accessorKey = "officeId", header = "ID" },
                    new { accessorKey = "officeName", header = "Office Name" },
                    new { accessorKey = "officeNameShort", header = "Short Name" },
                    new { accessorKey = "accessLevel", header = "Access Level" }
                };

                var data = pagedData.Select(o => new
                {
                    officeId = o.Officeid,
                    officeName = o.Officename,
                    officeNameShort = o.Officenameshort,
                    accessLevel = o.Accesslevel,
                    customActions = new List<object>
            {
                new { tooltip = "Update", color = "#F0C38E", actionFunction = "UpdateOffice" },
                new { tooltip = "Delete", color = "#F0C38E", actionFunction = "DeleteOffice" }
            }
                }).ToList();

                return Json(new { data, columns, totalRecords });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching offices");
                return StatusCode(500, new { error = "An error occurred while fetching offices", details = ex.Message });
            }
        }

        [HttpGet]
        public IActionResult GetOfficesType()
        {
            try
            {
                var officer = GetOfficerDetails();
                if (officer == null || officer.Department <= 0)
                    return Json(new { officesType = new List<object>() });

                var offices = dbcontext.Offices
                    .Where(o => o.Departmentid == officer.Department)
                    .Select(o => new
                    {
                        o.Officeid,
                        o.Officename,           // e.g., "DSWO"
                        o.Officenameshort,      // optional
                        o.Accesslevel           // "State", "Division", "District", "Tehsil", "Block"
                    })
                    .ToList();

                return Json(new { officesType = offices });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error loading office types");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        [HttpGet]
        public IActionResult GetDivisions()
        {
            var divisions = new List<dynamic>
            {
                new { label = "Jammu", value = "1" },
                new { label = "Kashmir", value = "2" },
            };

            return Json(new { divisions });
        }

        [HttpGet]
        public async Task<IActionResult> GetOfficeDetails(int pageIndex = 0, int pageSize = 10)
        {
            try
            {
                var officer = GetOfficerDetails();
                if (officer == null)
                    return BadRequest(new { error = "Officer details not found" });

                var departmentId = officer.Department;
                if (departmentId <= 0)
                    return BadRequest(new { error = "User department not found." });

                var query = from od in dbcontext.Officesdetails
                            join o in dbcontext.Offices on od.Officeid equals o.Officeid
                            where o.Departmentid == departmentId
                            select new
                            {
                                od.Officedetailid,
                                od.Officename,
                                OfficeTypeName = o.Officename,
                                od.Divisioncode,
                                od.Districtcode,
                                od.Areacode,
                                od.Areaname
                            };

                var totalRecords = await query.CountAsync();
                var pagedData = await query
                    .Skip(pageIndex * pageSize)
                    .Take(pageSize)
                    .ToListAsync();

                var columns = new List<object>
        {
            new { accessorKey = "officeDetailId", header = "ID" },
            new { accessorKey = "officeName", header = "Office Name" },
            new { accessorKey = "officeTypeName", header = "Office Type" },
            new { accessorKey = "areaName", header = "Area Name" }
        };

                var data = pagedData.Select(x => new
                {
                    officeDetailId = x.Officedetailid,
                    officeName = x.Officename,
                    officeTypeName = x.OfficeTypeName,
                    areaName = x.Areaname,
                    customActions = new List<object>
            {
                new { tooltip = "Update", color = "#F0C38E", actionFunction = "UpdateOfficeDetail" },
                new { tooltip = "Delete", color = "#F0C38E", actionFunction = "DeleteOfficeDetail" }
            }
                }).ToList();

                return Json(new { data, columns, totalRecords });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching office details");
                return StatusCode(500, new { error = "Error fetching office details", details = ex.Message });
            }
        }

        private readonly Dictionary<string, string> ParentAccessLevelMap = new()
        {
            { "Division", "State" },
            { "District", "Division" },
            { "Tehsil",   "District" },
            { "Block",    "District" }
        };

        [HttpGet]
        public async Task<IActionResult> GetParentOfficeDetails(int officeTypeId, int divisionCode, int districtCode)
        {
            var officer = GetOfficerDetails();
            if (officer == null || officer.Department <= 0)
                return BadRequest(new { status = false, message = "Invalid officer." });

            var query = dbcontext.Officesdetails
                .Include(d => d.Office)
                .Where(d => d.Office.Departmentid == officer.Department
                            && d.Officeid == officeTypeId
                            && d.Divisioncode == divisionCode);

            if (districtCode > 0)
                query = query.Where(d => d.Districtcode == districtCode);

            var results = await query
                .Select(d => new
                {
                    d.Officedetailid,
                    OfficeName = d.Officename,
                    d.Areaname
                })
                .ToListAsync();

            return Ok(results);
        }

        [HttpGet]
        public async Task<IActionResult> GetDistricts(int? divisionId = null, int? officeType = null)
        {
            try
            {
                var query = dbcontext.District.AsQueryable();

                if (divisionId.HasValue && divisionId.Value > 0)
                    query = query.Where(d => d.Division == divisionId.Value);

                if (officeType.HasValue && officeType.Value == 1) // DSWO exclusion (if needed)
                {
                    query = query.Where(d => !dbcontext.Officesdetails.Any(o =>
                        o.Districtcode == d.Districtid && o.Officeid == officeType.Value));
                }

                var districts = await query
                    .Select(x => new { districtId = x.Districtid, districtName = x.Districtname })
                    .OrderBy(d => d.districtName)
                    .ToListAsync();

                return Json(districts);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching districts");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        // [HttpGet]
        // public async Task<IActionResult> GetTehsilsAndBlocks(int? districtId = null, int? officeType = null)
        // {
        //     try
        //     {
        //         // Tehsils – exclude only those already assigned to the given officeType
        //         var tehsils = await dbcontext.Tehsil
        //             .Where(t => !districtId.HasValue || t.Districtid == districtId.Value)
        //             .Where(t => !officeType.HasValue ||
        //                         !dbcontext.Officesdetails.Any(o => o.Areacode == t.Tehsilid && o.Officetype == officeType.Value))
        //             .Select(t => new
        //             {
        //                 Id = t.Tehsilid,
        //                 Name = $"{t.Tehsilname ?? ""} (Tehsil)",
        //                 Type = "Tehsil"
        //             })
        //             .ToListAsync();

        //         return Json(blocks);
        //     }
        //     catch (Exception ex)
        //     {
        //         _logger.LogError(ex, "Error fetching blocks");
        //         return StatusCode(500, new { error = "Error fetching blocks", details = ex.Message });
        //     }
        // }


        #region Eligibility Criteria Management

        /// <summary>
        /// Get all expiration type rules (the "eligibility criteria" managed here) optionally filtered by serviceId.
        /// Backed by the existing expiration_types table.
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> GetEligibilityCriteria(int? serviceId = null)
        {
            try
            {
                var officer = GetOfficerDetails();
                if (officer == null)
                    return Unauthorized(new { status = false, message = "Session expired. Please log in again." });

                var criteria = await dbcontext.ExpirationTypes
                    .Where(c => c.IsActive == true)
                    .Where(c => serviceId == null || c.ServiceId == serviceId)
                    .OrderByDescending(c => c.CreatedAt)
                    .Select(c => new
                    {
                        c.Id,
                        c.ServiceId,
                        c.TypeCode,
                        c.ExpirationName,
                        c.Description,
                        c.BasedOnField,
                        c.ConditionField,
                        c.ValueField,
                        c.ValidityPeriod,
                        c.ReminderBefore,
                        c.StopPaymentOnExpiry,
                        c.StopPaymentGracePeriod,
                        c.MessageTemplate,
                        c.IsActive,
                        c.CreatedAt
                    })
                    .ToListAsync();

                // Attach service name for display
                var services = await dbcontext.Services
                    .Select(s => new { s.Serviceid, s.Servicename })
                    .ToListAsync();

                var result = criteria.Select(c => new
                {
                    c.Id,
                    c.ServiceId,
                    serviceName = services.FirstOrDefault(s => s.Serviceid == c.ServiceId)?.Servicename ?? "N/A",
                    criterionName = c.ExpirationName,
                    typeCode = c.TypeCode,
                    c.Description,
                    c.BasedOnField,
                    c.ConditionField,
                    c.ValueField,
                    c.ValidityPeriod,
                    c.ReminderBefore,
                    c.StopPaymentOnExpiry,
                    c.StopPaymentGracePeriod,
                    c.MessageTemplate,
                    c.IsActive,
                    c.CreatedAt
                }).ToList();

                return Ok(new { status = true, data = result });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching eligibility criteria");
                return StatusCode(500, new { status = false, message = "Error fetching eligibility criteria: " + ex.Message });
            }
        }

        /// <summary>
        /// Get a single expiration type rule by ID
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> GetEligibilityCriteriaById(int id)
        {
            try
            {
                var officer = GetOfficerDetails();
                if (officer == null)
                    return Unauthorized(new { status = false, message = "Session expired. Please log in again." });

                var criterion = await dbcontext.ExpirationTypes
                    .Where(c => c.Id == id)
                    .Select(c => new
                    {
                        c.Id,
                        c.ServiceId,
                        c.TypeCode,
                        c.ExpirationName,
                        c.Description,
                        c.BasedOnField,
                        c.ConditionField,
                        c.ValueField,
                        c.ValidityPeriod,
                        c.ReminderBefore,
                        c.StopPaymentOnExpiry,
                        c.StopPaymentGracePeriod,
                        c.MessageTemplate,
                        c.IsActive,
                        c.CreatedAt
                    })
                    .FirstOrDefaultAsync();

                if (criterion == null)
                    return NotFound(new { status = false, message = "Criterion not found" });

                return Ok(new { status = true, data = criterion });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching eligibility criterion {Id}", id);
                return StatusCode(500, new { status = false, message = ex.Message });
            }
        }

        #endregion


        //         // Blocks – same logic
        //         var blocks = await dbcontext.Blocks
        //             .Where(b => !districtId.HasValue || b.Districtid == districtId.Value)
        //             .Where(b => !officeType.HasValue ||
        //                         !dbcontext.Officesdetails.Any(o => o.Areacode == b.Blockid && o.Officetype == officeType.Value))
        //             .Select(b => new
        //             {
        //                 Id = b.Blockid,
        //                 Name = $"{b.Blockname ?? ""} (Block)",
        //                 Type = "Block"
        //             })
        //             .ToListAsync();

        //         var areas = new List<object>();
        //         areas.AddRange(tehsils);
        //         areas.AddRange(blocks);

        //         areas = areas.OrderBy(a => ((dynamic)a).Name ?? "").ToList();

        //         return Json(areas);
        //     }
        //     catch (Exception ex)
        //     {
        //         _logger.LogError(ex, "Error fetching areas");
        //         return StatusCode(500, new { error = "Error fetching areas", details = ex.Message });
        //     }
        // }

        [HttpGet]
        public IActionResult GetDPO(int officeType, int? divisionId = null)
        {
            try
            {
                var officer = GetOfficerDetails();
                if (officer == null || officer.Department <= 0)
                    return Json(new List<object>());   // empty list if no valid officer

                // 1. Find the DPO office type in this department (assume short name "DPO")
                var dpoOffice = dbcontext.Offices
                    .FirstOrDefault(o => o.Departmentid == officer.Department
                                         && o.Officenameshort == "DPO");
                if (dpoOffice == null)
                    return Json(new List<object>());

                // 2. Build query for office details of this type
                var query = dbcontext.Officesdetails
                    .Where(od => od.Officeid == dpoOffice.Officeid
                                 && od.Office.Departmentid == officer.Department);

                // 3. Optional division filter
                if (divisionId.HasValue && divisionId.Value > 0)
                    query = query.Where(od => od.Divisioncode == divisionId.Value);

                // 4. Project as before
                var dpoList = query
                    .Select(od => new
                    {
                        OfficerId = od.Districtcode,      // used to set the CDPO's DistrictCode
                        OfficerName = od.Officename
                    })
                    .OrderBy(d => d.OfficerName)
                    .ToList();

                return Json(dpoList);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching DPO list");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        // [HttpGet]
        // public async Task<IActionResult> GetBlocks(int? districtId = null)
        // {
        //     try
        //     {
        //         var query = dbcontext.Blocks.AsQueryable();

        //         if (districtId.HasValue && districtId.Value > 0)
        //             query = query.Where(b => b.Districtid == districtId.Value);

        //         // Exclude blocks already used in any OfficeDetails record
        //         // query = query.Where(b => !dbcontext.Officesdetails.Any(o => o.Areacode == b.Blockid));

        //         var blocks = await query
        //             .Select(x => new
        //             {
        //                 blockId = x.Blockid,
        //                 blockName = x.Blockname
        //             })
        //             .OrderBy(b => b.blockName)
        //             .ToListAsync();

        //         return Json(blocks);
        //     }
        //     catch (Exception ex)
        //     {
        //         _logger.LogError(ex, "Error fetching blocks");
        //         return StatusCode(500, new { error = "Error fetching blocks", details = ex.Message });
        //     }
        // }

        /// <summary>
        /// Get the available form field paths for a service.
        /// Parses the service's Formelement schema (which describes sections + fields + additionalFields)
        /// and returns one entry per field with { path, name, section, type, isAdditional }.
        /// Falls back to extracting leaf paths from a Sanctioned application if Formelement is missing.
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> GetServiceFormFields(int serviceId)
        {
            try
            {
                var fields = new List<object>();

                // 1. Prefer the service's Formelement schema (authoritative form definition)
                var formElement = await dbcontext.Services
                    .Where(s => s.Serviceid == serviceId)
                    .Select(s => s.Formelement)
                    .FirstOrDefaultAsync();

                if (!string.IsNullOrEmpty(formElement))
                {
                    try
                    {
                        var token = JToken.Parse(formElement);
                        ExtractFieldsFromSchema(token, fields);
                    }
                    catch
                    {
                        // ignore parsing errors and fall through
                    }
                }

                // 2. If the schema produced nothing, fall back to a sample Sanctioned application's
                //    Formdetails to extract leaf field paths heuristically.
                if (fields.Count == 0)
                {
                    var sample = await dbcontext.CitizenApplications
                        .Where(ca => ca.Serviceid == serviceId && ca.Status == "Sanctioned")
                        .OrderByDescending(ca => ca.Referencenumber)
                        .Select(ca => ca.Formdetails)
                        .FirstOrDefaultAsync();

                    if (!string.IsNullOrEmpty(sample))
                    {
                        try
                        {
                            var json = JObject.Parse(sample);
                            ExtractFieldPaths(json, "", fields, maxDepth: 6);
                        }
                        catch
                        {
                            // ignore parsing errors
                        }
                    }
                }

                return Ok(new { status = true, fields });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching form fields for service {ServiceId}", serviceId);
                return StatusCode(500, new { status = false, message = ex.Message });
            }
        }

        /// <summary>
        /// Walk a Formelement schema token (outer array containing a "sections" array)
        /// and produce one entry per field. Recurses into each field's "additionalFields"
        /// (an object of { key: { name, type, ... } } entries) with isAdditional = true.
        /// </summary>
        private void ExtractFieldsFromSchema(JToken token, List<object> fields)
        {
            if (token == null) return;

            // Real Formelement shape: [ { "section": "...", "fields": [ ... ] }, ... ]
            // Tolerate wrapped shape too: [ { "sections": [ ... ] } ]
            JArray? sections = null;

            if (token is JArray outer && outer.Count > 0)
            {
                var first = outer[0];
                if (first is JObject o && o["sections"] is JArray wrapped)
                    sections = wrapped;
                else
                    sections = outer; // each element IS a section object
            }
            else if (token is JObject rootObj && rootObj["sections"] is JArray s)
            {
                sections = s;
            }

            if (sections == null) return;

            foreach (var sectionToken in sections)
            {
                if (sectionToken is not JObject sectionObj) continue;

                var sectionName = sectionObj.Value<string>("section") ?? "Unknown";
                var sectionKey = NormalizeSectionKey(sectionName);

                if (sectionObj["fields"] is not JArray sectionFields) continue;

                foreach (var fieldToken in sectionFields)
                {
                    if (fieldToken is not JObject fieldObj) continue;

                    var fieldName = fieldObj.Value<string>("name");
                    if (string.IsNullOrEmpty(fieldName)) continue;

                    var fieldType = fieldObj.Value<string>("type") ?? "text";

                    fields.Add(new
                    {
                        path = $"{sectionKey}.{fieldName}",
                        name = fieldName,
                        section = sectionName,
                        type = fieldType
                    });

                    // Recurse into additionalFields — an object keyed by option value whose values
                    // are ARRAYS of field objects. May nest further (KindOfDisability -> TEMPORARY -> date).
                    if (fieldObj["additionalFields"] is JObject addlObj && addlObj.Count > 0)
                    {
                        ExtractAdditionalFields(addlObj, sectionKey, sectionName, fieldName + ".", fields);
                    }
                }
            }
        }

        /// <summary>
        /// Walk an "additionalFields" object. In the real Formelement this is keyed by the parent
        /// select's option value (e.g. "PHYSICALLY CHALLENGED PERSON") and each value is an ARRAY
        /// of field objects. The same shape can nest deeper. We flatten every nested field into the
        /// returned list with a dot-notated path under the parent section.
        /// </summary>
        private void ExtractAdditionalFields(JObject addlObj, string sectionKey, string sectionLabel, string pathPrefix, List<object> fields)
        {
            foreach (var prop in addlObj.Properties())
            {
                // Each value may be an array of field objects, or a single field object
                JArray? children = prop.Value switch
                {
                    JArray arr => arr,
                    JObject single => new JArray(single),
                    _ => null
                };
                if (children == null) continue;

                foreach (var child in children)
                {
                    if (child is not JObject fieldObj) continue;

                    var fieldName = fieldObj.Value<string>("name");
                    if (string.IsNullOrEmpty(fieldName)) continue;

                    var fieldType = fieldObj.Value<string>("type") ?? "text";

                    fields.Add(new
                    {
                        path = $"{sectionKey}.{pathPrefix}{fieldName}",
                        name = fieldName,
                        section = sectionLabel,
                        type = fieldType
                    });

                    if (fieldObj["additionalFields"] is JObject nested && nested.Count > 0)
                    {
                        ExtractAdditionalFields(nested, sectionKey, sectionLabel, pathPrefix + fieldName + ".", fields);
                    }
                }
            }
        }

        /// <summary>
        /// Convert a human-readable section label into a camelCase key matching how the
        /// field is nested in FormDetails (e.g. "Applicant Details" -> "applicantDetails").
        /// </summary>
        private static string NormalizeSectionKey(string section)
        {
            if (string.IsNullOrEmpty(section)) return "root";

            var words = section
                .Replace("&", "and")
                .Split(new[] { ' ', '-', '_', '.', '/' }, StringSplitOptions.RemoveEmptyEntries);

            if (words.Length == 0) return section.ToLowerInvariant();

            var sb = new System.Text.StringBuilder();
            sb.Append(words[0].ToLowerInvariant());
            for (int i = 1; i < words.Length; i++)
            {
                var w = words[i];
                if (w.Length == 0) continue;
                sb.Append(char.ToUpperInvariant(w[0]));
                if (w.Length > 1) sb.Append(w.Substring(1).ToLowerInvariant());
            }
            return sb.ToString();
        }

        /// <summary>
        /// Recursively extract field paths from a JObject. Captures leaf scalars and date-like values.
        /// </summary>
        private void ExtractFieldPaths(JToken token, string currentPath, List<object> fields, int maxDepth, int depth = 0)
        {
            if (depth > maxDepth || token == null) return;

            switch (token.Type)
            {
                case JTokenType.Object:
                    foreach (var prop in ((JObject)token).Properties())
                    {
                        var nextPath = string.IsNullOrEmpty(currentPath) ? prop.Name : currentPath + "." + prop.Name;
                        ExtractFieldPaths(prop.Value, nextPath, fields, maxDepth, depth + 1);
                    }
                    break;

                case JTokenType.Array:
                    foreach (var item in (JArray)token)
                    {
                        ExtractFieldPaths(item, currentPath, fields, maxDepth, depth + 1);
                    }
                    break;

                case JTokenType.String:
                case JTokenType.Integer:
                case JTokenType.Float:
                case JTokenType.Boolean:
                case JTokenType.Date:
                    var value = token.ToString();
                    var type = token.Type.ToString();
                    var isDate = type == "Date" || (token.Type == JTokenType.String && DateTime.TryParse(value, out _));
                    fields.Add(new { path = currentPath, value, type = isDate ? "date" : type.ToLower() });
                    break;
            }
        }

        /// <summary>
        /// Preview applications that currently have an active expiration record
        /// computed for the given expiration type rule.
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> PreviewEligibilityCriteria(int serviceId, int criteriaId, int? accessCode = null)
        {
            try
            {
                var officer = GetOfficerDetails();
                if (officer == null)
                    return Unauthorized(new { status = false, message = "Session expired. Please log in again." });

                var expType = await dbcontext.ExpirationTypes
                    .Where(t => t.Id == criteriaId && t.ServiceId == serviceId)
                    .FirstOrDefaultAsync();

                if (expType == null)
                    return NotFound(new { status = false, message = "Criterion not found" });

                var records = await dbcontext.ApplicationExpirations
                    .Where(e => e.ServiceId == serviceId)
                    .Where(e => e.ExpirationTypeId == criteriaId)
                    .Where(e => e.IsActive == true)
                    .OrderBy(e => e.ExpirationDate)
                    .ToListAsync();

                var today = DateOnly.FromDateTime(DateTime.Today);

                var results = records.Select(e => new
                {
                    applicationId = e.Id,
                    referenceNumber = e.Referencenumber,
                    criteriaId = e.ExpirationTypeId,
                    criteriaName = expType.ExpirationName,
                    matchingFieldValue = e.SourceValue,
                    expirationDate = e.ExpirationDate,
                    baseDate = e.BaseDate,
                    daysUntilExpiry = e.ExpirationDate.DayNumber - today.DayNumber
                }).ToList();

                return Ok(new { status = true, data = results, total = results.Count });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error previewing eligibility criteria");
                return StatusCode(500, new { status = false, message = ex.Message });
            }
        }




    }
}