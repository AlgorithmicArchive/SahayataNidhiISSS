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
        [HttpPost]
        public IActionResult ValidateOfficer(string email)
        {
            try
            {
                if (string.IsNullOrEmpty(email))
                {
                    return BadRequest(new { status = false, message = "email is required." });
                }

                var officer = dbcontext.Users.FirstOrDefault(u => u.Email == email);
                if (officer == null)
                {
                    return NotFound(new { status = false, message = "Officer not found." });
                }

                var additionalDetails = JsonConvert.DeserializeObject<Dictionary<string, dynamic>>(officer.Additionaldetails ?? "{}");
                if (additionalDetails == null)
                {
                    return BadRequest(new { status = false, message = "Invalid officer details." });
                }

                bool currentValidate = additionalDetails.ContainsKey("Validate") ? additionalDetails["Validate"] : false;
                additionalDetails["Validate"] = !currentValidate;

                officer.Additionaldetails = JsonConvert.SerializeObject(additionalDetails);
                dbcontext.SaveChanges();

                string currentDateTime = DateTime.Now.AddHours(5.5).ToString("dd MMM yyyy, hh:mm tt") + " IST";

                return Json(new
                {
                    status = true,
                    message = additionalDetails["Validate"] ? "Officer validated" : "Officer unvalidated",
                    isValidated = additionalDetails["Validate"],
                    updatedAt = currentDateTime
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error validating officer: {Username}", email);
                return StatusCode(500, new { status = false, message = "An error occurred while validating the officer." });
            }
        }

        [HttpPost]
        public IActionResult UpdateUserType(string username, string userType)
        {
            try
            {
                if (string.IsNullOrEmpty(username) || string.IsNullOrEmpty(userType))
                {
                    return BadRequest(new { status = false, message = "Username and userType are required." });
                }

                if (userType != "Admin" && userType != "Officer")
                {
                    return BadRequest(new { status = false, message = "Invalid userType. Must be 'Admin' or 'Officer'." });
                }

                var user = dbcontext.Users.FirstOrDefault(u => u.Username == username);
                if (user == null)
                {
                    return NotFound(new { status = false, message = "User not found." });
                }

                user.Usertype = userType;
                dbcontext.SaveChanges();

                string currentDateTime = DateTime.Now.AddHours(5.5)
                    .ToString("dd MMM yyyy, hh:mm tt") + " IST";

                return Json(new
                {
                    status = true,
                    message = $"User type changed to {userType}",
                    userType,
                    updatedAt = currentDateTime
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating user type for {Username}", username);
                return StatusCode(500, new { status = false, message = "An error occurred while updating user type." });
            }
        }

        [HttpPost]
        public IActionResult AddAdmin([FromForm] IFormCollection form)
        {
            try
            {
                if (string.IsNullOrEmpty(form["name"]) || string.IsNullOrEmpty(form["username"]) ||
                    string.IsNullOrEmpty(form["password"]) || string.IsNullOrEmpty(form["email"]) ||
                    string.IsNullOrEmpty(form["mobileNumber"]) || string.IsNullOrEmpty(form["role"]))
                {
                    return Json(new { status = false, response = "Missing required fields" });
                }

                // Prepare parameters for PostgreSQL function
                var fullName = form["name"].ToString();
                var username = form["username"].ToString();
                var password = form["password"].ToString();
                var email = form["email"].ToString();
                var mobileNumber = form["mobileNumber"].ToString();
                var profile = "/assets/images/profile.jpg";
                var userType = form["role"].ToString().Contains("Admin") ? "Admin" : "Officer";

                var backupCodes = new
                {
                    unused = helper.GenerateUniqueRandomCodes(10, 8),
                    used = Array.Empty<string>()
                };
                var backupCodesJson = JsonConvert.SerializeObject(backupCodes);

                var additionalDetailsJson = form["Additionaldetails"].ToString();
                if (string.IsNullOrEmpty(additionalDetailsJson))
                {
                    return Json(new { status = false, response = "Additionaldetails is required" });
                }

                dynamic additionalDetails = JsonConvert.DeserializeObject(additionalDetailsJson)!;
                if (!string.IsNullOrEmpty(form["department"]))
                {
                    additionalDetails.Department = int.Parse(form["department"]!);
                }
                var additionalDetailsJsonFinal = JsonConvert.SerializeObject(additionalDetails);

                var registeredDate = DateTime.Now.ToString("dd MMM yyyy hh:mm:ss tt");

                // Call PostgreSQL function using FromSqlRaw
                var result = dbcontext.Users.FromSqlRaw(
                        "SELECT * FROM registeruser({0}, {1}, {2}, {3}, {4}, {5}, {6}, {7}, {8}, {9})",
                        fullName, username, password, email, mobileNumber, profile, userType,
                        backupCodesJson, (string)additionalDetailsJsonFinal, registeredDate)
                    .ToList();

                if (result.Count > 0)
                {
                    return Json(new { status = true, userId = result[0].Userid });
                }
                else
                {
                    return Json(new { status = false, response = "Registration failed." });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating admin");
                return Json(new { status = false, response = $"Error creating admin: {ex.Message}" });
            }
        }

        [HttpPost]
        public IActionResult AddDesignation()
        {
            try
            {
                var designation = Request.Form["Designation"].ToString();
                var designationShort = Request.Form["DesignationShort"].ToString();
                var accessLevel = Request.Form["Accesslevel"].ToString();
                var departmentId = int.Parse(Request.Form["Departmentid"]!);

                if (string.IsNullOrWhiteSpace(designation) || string.IsNullOrWhiteSpace(designationShort) || string.IsNullOrWhiteSpace(accessLevel))
                {
                    return BadRequest(new { error = "All fields are required" });
                }

                var newDesignation = new Officersdesignations
                {
                    Designation = designation,
                    Designationshort = designationShort,
                    Accesslevel = accessLevel,
                    Departmentid = departmentId
                };

                dbcontext.Officersdesignations.Add(newDesignation);
                dbcontext.SaveChanges();

                return Json(new { status = true });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error adding designation");
                return StatusCode(500, new
                {
                    error = "An error occurred while adding designation",
                    details = ex.Message
                });
            }
        }

        [HttpPost]
        public IActionResult UpdateDesignation([FromForm] IFormCollection form)
        {
            try
            {
                var officer = GetOfficerDetails();
                if (officer == null)
                {
                    return BadRequest(new { error = "Officer details not found" });
                }

                var designationIdString = form["DesignationId"].ToString();
                var designation = form["Designation"].ToString();
                var designationShort = form["DesignationShort"].ToString();
                var accessLevel = form["Accesslevel"].ToString();
                var departmentIdString = form["Departmentid"].ToString();

                if (string.IsNullOrWhiteSpace(designationIdString) || string.IsNullOrWhiteSpace(designation) ||
                    string.IsNullOrWhiteSpace(designationShort) || string.IsNullOrWhiteSpace(accessLevel) ||
                    string.IsNullOrWhiteSpace(departmentIdString))
                {
                    return BadRequest(new { error = "All fields are required" });
                }

                if (!int.TryParse(designationIdString, out var designationId))
                {
                    return BadRequest(new { error = "Invalid DesignationId format; must be an integer" });
                }
                if (!int.TryParse(departmentIdString, out var departmentId))
                {
                    return BadRequest(new { error = "Invalid Departmentid format; must be an integer" });
                }

                var existingDesignation = dbcontext.Officersdesignations
                    .FirstOrDefault(d => d.Uuid == designationId && d.Departmentid == officer.Department);
                if (existingDesignation == null)
                {
                    return NotFound(new { error = "Designation not found or you do not have permission to update it" });
                }

                existingDesignation.Designation = designation;
                existingDesignation.Designationshort = designationShort;
                existingDesignation.Accesslevel = accessLevel;
                existingDesignation.Departmentid = departmentId;

                dbcontext.SaveChanges();

                return Json(new { status = true });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating designation");
                return StatusCode(500, new
                {
                    error = "An error occurred while updating designation",
                    details = ex.Message
                });
            }
        }

        [HttpPost]
        public IActionResult DeleteDesignation([FromForm] IFormCollection form)
        {
            try
            {
                var officer = GetOfficerDetails();
                if (officer == null)
                {
                    return BadRequest(new { error = "Officer details not found" });
                }

                var designationIdString = form["DesignationId"].ToString();

                if (string.IsNullOrWhiteSpace(designationIdString))
                {
                    return BadRequest(new { error = "DesignationId is required" });
                }

                if (!int.TryParse(designationIdString, out var designationId))
                {
                    return BadRequest(new { error = "Invalid DesignationId format; must be an integer" });
                }

                var designation = dbcontext.Officersdesignations
                    .FirstOrDefault(d => d.Uuid == designationId && d.Departmentid == officer.Department);
                if (designation == null)
                {
                    return NotFound(new { error = "Designation not found or you do not have permission to delete it" });
                }

                dbcontext.Officersdesignations.Remove(designation);
                dbcontext.SaveChanges();

                return Json(new { status = true });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting designation");
                return StatusCode(500, new
                {
                    error = "An error occurred while deleting designation",
                    details = ex.Message
                });
            }
        }

        [HttpPost]
        public IActionResult AddDepartment([FromForm] string Departmentname)
        {
            try
            {
                var department = new Departments { Departmentname = Departmentname };
                dbcontext.Departments.Add(department);
                dbcontext.SaveChanges();
                return Json(new { status = true });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error adding department");
                return Json(new { status = false, message = ex.Message });
            }
        }

        [HttpPost]
        public IActionResult UpdateDepartment([FromForm] int Departmentid, [FromForm] string Departmentname)
        {
            try
            {
                var department = dbcontext.Departments.Find(Departmentid);
                if (department == null)
                    return Json(new { status = false, message = "Department not found" });

                department.Departmentname = Departmentname;
                dbcontext.SaveChanges();
                return Json(new { status = true });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating department");
                return Json(new { status = false, message = ex.Message });
            }
        }

        [HttpPost]
        public IActionResult DeleteDepartment([FromForm] int Departmentid)
        {
            try
            {
                var department = dbcontext.Departments.Find(Departmentid);
                if (department == null)
                    return Json(new { status = false, message = "Department not found" });

                dbcontext.Departments.Remove(department);
                dbcontext.SaveChanges();
                return Json(new { status = true });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting department");
                return Json(new { status = false, message = ex.Message });
            }
        }

        [HttpPost]
        public async Task<IActionResult> AddOffice([FromForm] IFormCollection form)
        {
            try
            {
                if (!form.TryGetValue("Officetype", out var officeTypeValues) || string.IsNullOrWhiteSpace(officeTypeValues[0]))
                    return Json(new { status = false, message = "Office Type is required." });

                if (!form.TryGetValue("Accesslevel", out var accessLevelValues) || string.IsNullOrWhiteSpace(accessLevelValues[0]))
                    return Json(new { status = false, message = "Access Level is required." });

                if (!form.TryGetValue("Departmentid", out var deptIdValues) || !int.TryParse(deptIdValues[0], out int departmentId))
                    return Json(new { status = false, message = "Invalid Department ID." });

                var office = new Offices
                {
                    Departmentid = departmentId,
                    Officetype = officeTypeValues[0]!.Trim(),
                    Accesslevel = accessLevelValues[0]!.Trim()
                };

                dbcontext.Offices.Add(office);
                await dbcontext.SaveChangesAsync();

                return Json(new { status = true, message = "Office added successfully." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error adding office");
                return Json(new { status = false, message = ex.Message });
            }
        }

        [HttpPost]
        public async Task<IActionResult> UpdateOffice([FromForm] IFormCollection form)
        {
            try
            {
                if (!form.TryGetValue("Officeid", out var idValues) || !int.TryParse(idValues[0], out int officeId))
                    return Json(new { status = false, message = "Invalid Office ID." });

                if (!form.TryGetValue("Officetype", out var officeTypeValues) || string.IsNullOrWhiteSpace(officeTypeValues[0]))
                    return Json(new { status = false, message = "Office Type is required." });

                if (!form.TryGetValue("Accesslevel", out var accessLevelValues) || string.IsNullOrWhiteSpace(accessLevelValues[0]))
                    return Json(new { status = false, message = "Access Level is required." });

                if (!form.TryGetValue("Departmentid", out var deptIdValues) || !int.TryParse(deptIdValues[0], out int departmentId))
                    return Json(new { status = false, message = "Invalid Department ID." });

                var office = await dbcontext.Offices.FindAsync(officeId);
                if (office == null)
                    return Json(new { status = false, message = "Office not found." });

                if (office.Departmentid != departmentId)
                    return Json(new { status = false, message = "You cannot modify offices from another department." });

                office.Officetype = officeTypeValues[0]!.Trim();
                office.Accesslevel = accessLevelValues[0]!.Trim();

                await dbcontext.SaveChangesAsync();

                return Json(new { status = true, message = "Office updated successfully." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating office");
                return Json(new { status = false, message = ex.Message });
            }
        }

        [HttpPost]
        public async Task<IActionResult> DeleteOffice([FromForm] IFormCollection form)
        {
            try
            {
                if (!form.TryGetValue("Officeid", out var idValues) || !int.TryParse(idValues[0], out int officeId))
                    return Json(new { status = false, message = "Invalid Office ID." });

                var office = await dbcontext.Offices.FindAsync(officeId);
                if (office == null)
                    return Json(new { status = false, message = "Office not found." });

                dbcontext.Offices.Remove(office);
                await dbcontext.SaveChangesAsync();

                return Json(new { status = true, message = "Office deleted successfully." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting office");
                return Json(new { status = false, message = ex.Message });
            }
        }

        [HttpPost]
        public async Task<IActionResult> AddOfficeDetail([FromForm] string OfficeName, [FromForm] int Officetype, [FromForm] int Divisioncode, [FromForm] int DistrictCode, [FromForm] int AreaCode, [FromForm] string AreaName)
        {
            try
            {
                var officer = GetOfficerDetails();
                if (officer == null || officer.Department <= 0)
                    return BadRequest(new { status = false, message = "Invalid officer or department." });

                var office = await dbcontext.Offices
                    .FirstOrDefaultAsync(o => o.Officeid == Officetype && o.Departmentid == officer.Department);

                if (office == null)
                    return BadRequest(new { status = false, message = "Invalid office type or access denied." });

                var newDetail = new Officesdetails
                {
                    Statecode = 0,
                    Divisioncode = Divisioncode,
                    Districtcode = DistrictCode,
                    Areacode = AreaCode,
                    Areaname = AreaName ?? "",
                    Officename = OfficeName,
                    Officetype = Officetype
                };

                dbcontext.Officesdetails.Add(newDetail);
                await dbcontext.SaveChangesAsync();

                return Json(new { status = true, message = "Office detail added successfully." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error adding office detail");
                return StatusCode(500, new { status = false, message = "Error adding office detail: " + ex.Message });
            }
        }

        [HttpPost]
        public async Task<IActionResult> UpdateOfficeDetail([FromForm] int OfficeDetailId, [FromForm] string OfficeName, [FromForm] int Officetype, [FromForm] int Divisioncode, [FromForm] int DistrictCode, [FromForm] int AreaCode, [FromForm] string AreaName)
        {
            try
            {
                var officer = GetOfficerDetails();
                if (officer == null || officer.Department <= 0)
                    return BadRequest(new { status = false, message = "Invalid officer." });

                var detail = await dbcontext.Officesdetails
                    .FirstOrDefaultAsync(od =>
                        od.Divisioncode == Divisioncode &&
                        od.Districtcode == DistrictCode &&
                        od.Areacode == AreaCode &&
                        od.Officetype == Officetype);

                if (detail == null)
                    return NotFound(new { status = false, message = "Office detail not found." });

                var office = await dbcontext.Offices
                    .FirstOrDefaultAsync(o => o.Officeid == Officetype && o.Departmentid == officer.Department);

                if (office == null)
                    return BadRequest(new { status = false, message = "Access denied." });

                detail.Officename = OfficeName;
                detail.Areaname = AreaName ?? "";

                await dbcontext.SaveChangesAsync();

                return Json(new { status = true, message = "Office detail updated successfully." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating office detail");
                return StatusCode(500, new { status = false, message = "Error updating: " + ex.Message });
            }
        }

        [HttpPost]
        public async Task<IActionResult> DeleteOfficeDetail([FromForm] int OfficeDetailId)
        {
            try
            {
                var officer = GetOfficerDetails();
                if (officer == null || officer.Department <= 0)
                    return BadRequest(new { status = false, message = "Invalid officer." });

                // For now, use OfficeDetailId as primary key (adjust based on your model)
                var detail = await dbcontext.Officesdetails
                    .Include(od => od.OfficetypeNavigation)
                    .FirstOrDefaultAsync(od => od.Statecode + od.Divisioncode + od.Districtcode + od.Areacode == OfficeDetailId); // Adjust based on actual PK

                if (detail == null)
                    return NotFound(new { status = false, message = "Office detail not found." });

                // Verify department access
                if (detail.OfficetypeNavigation?.Departmentid != officer.Department)
                    return BadRequest(new { status = false, message = "Access denied." });

                dbcontext.Officesdetails.Remove(detail);
                await dbcontext.SaveChangesAsync();

                return Json(new { status = true, message = "Office detail deleted successfully." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting office detail");
                return StatusCode(500, new { status = false, message = "Error deleting: " + ex.Message });
            }
        }
    }
}