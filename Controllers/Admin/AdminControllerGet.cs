using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Npgsql;
using System.Data;
using SahayataNidhi.Models.Entities;

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

                var sortedResponse = response.OrderBy(a => a.TehsilName).ToList();
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
                    tehsilName = item.TehsilName,
                    totalApplicationsSubmitted = item.TotalApplicationsSubmitted,
                    totalApplicationsRejected = item.TotalApplicationsRejected,
                    totalApplicationsSanctioned = item.TotalApplicationsSanctioned
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

                // Call PostgreSQL function using SqlQueryRaw
                var result = dbcontext.Database
                    .SqlQueryRaw<DashboardData>(
                        "SELECT * FROM get_count_for_admin({0}, {1}, {2}, {3})",
                        officer.AccessLevel ?? (object)DBNull.Value,
                        officer.AccessCode!,
                        "new",
                        officer.Department == 0 ? (object)DBNull.Value : officer.Department!)
                    .FirstOrDefault();

                if (result == null || result.TotalOfficers == -1)
                {
                    return BadRequest(new { error = "Invalid access level or code" });
                }

                return Json(new
                {
                    totalOfficers = result.TotalOfficers,
                    totalRegisteredUsers = result.TotalCitizens,
                    totalApplicationsSubmitted = result.TotalApplicationsSubmitted,
                    totalServices = result.TotalServices
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching dashboard data");
                return StatusCode(500, new
                {
                    error = "An error occurred while fetching dashboard data",
                    details = ex.Message
                });
            }
        }

        public string GetArea(string AccessLevel, int AccessCode)
        {
            if (AccessLevel == "State") return "Jammu & Kashmir";
            else if (AccessLevel == "Division") return AccessCode == 1 ? "Jammu" : "Kashmir";
            else if (AccessLevel == "District") return dbcontext.Districts.FirstOrDefault(d => d.DistrictId == AccessCode)!.DistrictName!;
            else return dbcontext.TswoTehsils.FirstOrDefault(t => t.TehsilId == AccessCode)!.TehsilName!;
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
                return dbcontext.TswoTehsils.FirstOrDefault(t => t.TehsilId == id)!.TehsilName!;
            }
            else if (fieldName.EndsWith("Tehsil"))
            {
                return dbcontext.Tehsils.FirstOrDefault(t => t.TehsilId == id)!.TehsilName!;
            }
            else if (fieldName.Contains("District"))
            {
                return dbcontext.Districts.FirstOrDefault(d => d.DistrictId == id)!.DistrictName!;
            }
            else if (fieldName.Contains("Muncipality"))
            {
                return dbcontext.Muncipalities.FirstOrDefault(m => m.MuncipalityId == id)!.MuncipalityName!;
            }
            else if (fieldName.Contains("Block"))
            {
                return dbcontext.Blocks.FirstOrDefault(b => b.BlockId == id)!.BlockName!;
            }
            else if (fieldName.Contains("WardNo"))
            {
                return dbcontext.Wards.FirstOrDefault(w => w.WardCode == id)!.WardNo.ToString()!;
            }
            else return dbcontext.Villages.FirstOrDefault(v => v.VillageId == id)!.VillageName!;
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
                .Where(s => s.DepartmentId == officer!.Department || officer.Department == null)
                .OrderBy(s => s.ServiceName)
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
                var department = dbcontext.Departments.FirstOrDefault(d => d.DepartmentId == item.DepartmentId)?.DepartmentName ?? "N/A";

                var row = new
                {
                    sno = serialNo,
                    servicename = item.ServiceName,
                    department,
                    serviceId = item.ServiceId,
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
                districts = dbcontext.Districts
                    .Select(d => new { d.DistrictId, d.DistrictName })
                    .ToList();
            }
            else if (officer.AccessLevel == "State")
            {
                districts = dbcontext.Districts
                    .Select(d => new { d.DistrictId, d.DistrictName })
                    .ToList();
            }
            else if (officer.AccessLevel == "Division")
            {
                districts = dbcontext.Districts
                    .Select(d => new { d.DistrictId, d.DistrictName })
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

                var designations = dbcontext.OfficersDesignations
                    .Where(d => d.DepartmentId == officer.Department)
                    .Select(d => new
                    {
                        DesignationId = d.Uuid,
                        Designation = d.Designation,
                        DesignationShort = d.DesignationShort,
                        AccessLevel = d.AccessLevel
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
                        DepartmentId = d.DepartmentId,
                        DepartmentName = d.DepartmentName,
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
                {
                    return BadRequest(new { error = "Officer details not found" });
                }

                var departmentId = officer.Department;
                if (departmentId <= 0)
                {
                    return BadRequest(new { error = "User department not found." });
                }

                var officesQuery = dbcontext.Offices
                    .Where(o => o.DepartmentId == departmentId)
                    .Select(o => new
                    {
                        OfficeId = o.OfficeId,
                        OfficeType = o.OfficeType,
                        AccessLevel = o.AccessLevel
                    });

                var totalRecords = await officesQuery.CountAsync();
                var pagedData = await officesQuery
                    .Skip(pageIndex * pageSize)
                    .Take(pageSize)
                    .ToListAsync();

                var columns = new List<object>
                {
                    new { accessorKey = "officeId", header = "ID" },
                    new { accessorKey = "officeType", header = "Office Type" },
                    new { accessorKey = "accessLevel", header = "Access Level" }
                };

                var data = pagedData.Select(o => new
                {
                    officeId = o.OfficeId,
                    officeType = o.OfficeType,
                    accessLevel = o.AccessLevel,
                    customActions = new List<object>
                    {
                        new { tooltip = "Update", color = "#F0C38E", actionFunction = "UpdateOffice" },
                        new { tooltip = "Delete", color = "#F0C38E", actionFunction = "DeleteOffice" }
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
                _logger.LogError(ex, "Error fetching offices");
                return StatusCode(500, new
                {
                    error = "An error occurred while fetching offices",
                    details = ex.Message
                });
            }
        }

        [HttpGet]
        public IActionResult GetOfficesType()
        {
            var officesType = dbcontext.Offices.ToList();
            return Json(new { officesType });
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

                var query = from od in dbcontext.OfficesDetails
                            join o in dbcontext.Offices on od.OfficeType equals o.OfficeId
                            where o.DepartmentId == departmentId
                            select new
                            {
                                OfficeDetailId = od.StateCode + od.DivisionCode + od.DistrictCode + od.AreaCode,
                                od.OfficeName,
                                OfficeType = o.OfficeType,
                                od.DivisionCode,
                                od.DistrictCode,
                                od.AreaCode,
                                od.AreaName,
                                AccessLevel = o.AccessLevel
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
                    new { accessorKey = "officeType", header = "Office Type" },
                    new { accessorKey = "divisionCode", header = "Division Code" },
                    new { accessorKey = "districtCode", header = "District Code" },
                    new { accessorKey = "areaCode", header = "Area Code" },
                    new { accessorKey = "areaName", header = "Area Name" }
                };

                var data = pagedData.Select(x => new
                {
                    officeDetailId = x.OfficeDetailId,
                    officeName = x.OfficeName,
                    officeType = x.OfficeType,
                    divisionCode = x.DivisionCode,
                    districtCode = x.DistrictCode,
                    areaCode = x.AreaCode,
                    areaName = x.AreaName,
                    accessLevel = x.AccessLevel,
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

        [HttpGet]
        public async Task<IActionResult> GetDistricts(int? divisionId = null)
        {
            try
            {
                var query = dbcontext.Districts
                    .AsQueryable();

                if (divisionId.HasValue && divisionId.Value > 0)
                    query = query.Where(d => d.Division == divisionId.Value);

                var districts = await query
                    .Select(d => new
                    {
                        districtId = d.DistrictId,
                        districtName = d.DistrictName
                    })
                    .OrderBy(d => d.districtName)
                    .ToListAsync();

                return Json(districts);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching districts");
                return StatusCode(500, new { error = "Error fetching districts", details = ex.Message });
            }
        }

        [HttpGet]
        public async Task<IActionResult> GetTehsils(int? districtId = null)
        {
            try
            {
                var query = dbcontext.Tehsils
                    .AsQueryable();

                if (districtId.HasValue && districtId.Value > 0)
                    query = query.Where(t => t.DistrictId == districtId.Value);

                var tehsils = await query
                    .Select(t => new
                    {
                        tehsilId = t.TehsilId,
                        tehsilName = t.TehsilName
                    })
                    .OrderBy(t => t.tehsilName)
                    .ToListAsync();

                return Json(tehsils);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching tehsils");
                return StatusCode(500, new { error = "Error fetching tehsils", details = ex.Message });
            }
        }

        [HttpGet]
        public async Task<IActionResult> GetBlocks(int? districtId = null)
        {
            try
            {
                var query = dbcontext.Blocks
                    .AsQueryable();

                if (districtId.HasValue && districtId.Value > 0)
                    query = query.Where(b => b.DistrictId == districtId.Value);

                var blocks = await query
                    .Select(b => new
                    {
                        blockId = b.BlockId,
                        blockName = b.BlockName
                    })
                    .OrderBy(b => b.blockName)
                    .ToListAsync();

                return Json(blocks);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching blocks");
                return StatusCode(500, new { error = "Error fetching blocks", details = ex.Message });
            }
        }
    }
}