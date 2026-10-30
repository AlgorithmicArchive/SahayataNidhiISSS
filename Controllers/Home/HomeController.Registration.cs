using System.Security.Claims;
using System.IdentityModel.Tokens.Jwt;
using Microsoft.AspNetCore.Http.Extensions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Npgsql;
using SahayataNidhi.Models;
using SahayataNidhi.Models.Entities;

namespace SahayataNidhi.Controllers
{
    public partial class HomeController
    {
        [HttpGet]
        [EnableRateLimiting("AuthEndpoints")]
        public async Task<IActionResult> SendOtp(string? email, string? mobile)
        {
            if (string.IsNullOrEmpty(email) && string.IsNullOrEmpty(mobile))
            {
                return Json(new { status = false, message = "Either email or mobile is required." });
            }

            if (!string.IsNullOrEmpty(email) && !string.IsNullOrEmpty(mobile))
            {
                return Json(new { status = false, message = "Please provide only one: email or mobile, not both." });
            }

            string otpKey = !string.IsNullOrEmpty(email) ? $"otp:email:{email}" : $"otp:mobile:{mobile}";
            string otp = GenerateOTP(7);
            _otpStore.StoreOtp(otpKey, otp);

            try
            {
                if (!string.IsNullOrEmpty(email))
                {
                    string htmlMessage = $@"
                    <div style='font-family: Arial, sans-serif;'>
                        <h2 style='color: #2e6c80;'>Your OTP Code</h2>
                        <p>Use the following One-Time Password (OTP) to complete your verification. It is valid for <strong>5 minutes</strong>.</p>
                        <div style='font-size: 24px; font-weight: bold; color: #333; margin: 20px 0;'>{otp}</div>
                        <p>If you did not request this, please ignore this email.</p>
                        <br />
                        <p style='font-size: 12px; color: #888;'>Thank you,<br />Your Application Team</p>
                    </div>";

                    await _emailSender.SendEmail(email, "OTP for Verification", htmlMessage);
                    return Json(new { status = true, message = "OTP sent successfully to your email." });
                }
                else
                {
                    return Json(new { status = true, message = $"Email and Mobile OTP sending is not working" });
                }
            }
            catch (Exception ex)
            {
                return Json(new { status = true, message = $"Email and Mobile OTP sending is not working " });
            }
        }

        [HttpPost]
        [EnableRateLimiting("AuthEndpoints")]
        public async Task<IActionResult> Register(IFormCollection form)
        {
            var Password = form["Password"].ToString();
            var fullName = new NpgsqlParameter("p_name", form["fullName"].ToString());
            var username = new NpgsqlParameter("p_username", form["Username"].ToString());
            var password = new NpgsqlParameter("p_password", Password);
            var email = new NpgsqlParameter("p_email", form["Email"].ToString());
            var mobileNumber = new NpgsqlParameter("p_mobilenumber", form["MobileNumber"].ToString());
            int district = string.IsNullOrEmpty(form["District"].ToString()) ? 0 : Convert.ToInt32(form["District"]);
            int tehsil = string.IsNullOrEmpty(form["Tehsil"].ToString()) ? 0 : Convert.ToInt32(form["Tehsil"]);

            if (!IsStrongPassword(Password, _configuration, out var passwordError))
            {
                return Json(new { status = false, response = passwordError });
            }

            var additionalDetails = new
            {
                District = district,
                Tehsil = tehsil
            };

            var unused = _helper.GenerateUniqueRandomCodes(10, 8);
            var backupCodes = new
            {
                unused,
                used = Array.Empty<string>()
            };

            var Profile = new NpgsqlParameter("p_profile", "");
            var Usertype = new NpgsqlParameter("p_usertype", "Citizen");
            var backupCodesParam = new NpgsqlParameter("p_backupcodes", JsonConvert.SerializeObject(backupCodes));
            var Additionaldetails = new NpgsqlParameter("p_additionaldetails", JsonConvert.SerializeObject(additionalDetails));
            var registeredDate = new NpgsqlParameter("p_registereddate", DateTime.Now.ToString("dd MMM yyyy hh:mm:ss tt"));

            var result = await _dbContext.Users.FromSqlRaw(
                "SELECT * FROM registeruser({0}, {1}, {2}, {3}, {4}, {5}, {6}, {7}, {8}, {9})",
                fullName.Value, username.Value, password.Value, email.Value, mobileNumber.Value,
                Profile.Value, Usertype.Value, backupCodesParam.Value, Additionaldetails.Value, registeredDate.Value
            ).ToListAsync();

            if (result.Count != 0)
            {
                result[0].Isemailvalid = true;
                await _dbContext.SaveChangesAsync();
                return Json(new { status = true, response = "Registration Successful." });
            }
            else
            {
                return Json(new { status = false, response = "Registration failed." });
            }
        }

        [HttpPost]
        public async Task<IActionResult> OfficerRegistration([FromForm] IFormCollection form)
        {
            var Password = form["Password"].ToString();

            var email = form["email"].ToString().Trim();
            var mobileNumber = form["mobileNumber"].ToString().Trim();
            var fullName = form["fullName"].ToString().Trim();
            var designation = form["designation"].ToString();
            var departmentId = form["department"].ToString();
            var accessLevel = form["accessLevel"].ToString();
            var accessCodeStr = form["accessCode"].ToString();
            if (!IsStrongPassword(Password, _configuration, out var passwordError))
            {
                return Json(new { status = false, response = passwordError });
            }

            var username = email;

            if (!int.TryParse(accessCodeStr, out int accessCode))
                return Json(new { status = false, message = "Invalid access code." });

            try
            {
                var existingUser = await _dbContext.Users
                    .FirstOrDefaultAsync(u => u.Email == email);

                var profile = "/assets/images/profile.jpg";
                var registeredDate = DateTime.Now.ToString("dd MMM yyyy hh:mm:ss tt");

                var officerDetails = new
                {
                    Role = designation,
                    RoleShort = GetShortTitleFromRole(designation),
                    AccessLevel = accessLevel,
                    AccessCode = accessCode,
                    Department = int.Parse(departmentId),
                    District = form.ContainsKey("District") && !string.IsNullOrEmpty(form["District"]) ? form["District"].ToString() : null,
                    Division = form.ContainsKey("Division") && !string.IsNullOrEmpty(form["Division"]) ? form["Division"].ToString() : null,
                    Tehsil = form.ContainsKey("Tehsil") && !string.IsNullOrEmpty(form["Tehsil"]) ? form["Tehsil"].ToString() : null,
                    Validate = true
                };

                if (existingUser != null)
                {
                    if (existingUser.Usertype != "Citizen")
                        return Json(new { status = false, message = "Email already registered as non-Citizen." });

                    var currentDetails = string.IsNullOrEmpty(existingUser.Additionaldetails)
                        ? new { }
                        : JsonConvert.DeserializeObject(existingUser.Additionaldetails) ?? new { };

                    var mergedDetails = new
                    {
                        Citizen = currentDetails,
                        Officer = officerDetails
                    };

                    existingUser.Username = username;
                    existingUser.Mobilenumber = mobileNumber;
                    existingUser.Usertype = "Officer";
                    existingUser.Additionaldetails = JsonConvert.SerializeObject(mergedDetails);
                    existingUser.Registereddate = registeredDate;

                    await _dbContext.SaveChangesAsync();

                    return Json(new
                    {
                        status = true,
                        userId = existingUser.Userid,
                        message = "Upgraded from Citizen to Officer successfully."
                    });
                }
                else
                {
                    var backupCodesObj = new
                    {
                        unused = _helper.GenerateUniqueRandomCodes(10, 8),
                        used = Array.Empty<string>()
                    };

                    var backupCodesJson = JsonConvert.SerializeObject(backupCodesObj);
                    var additionalDetailsJson = JsonConvert.SerializeObject(officerDetails);

                    var fullNameParam = new NpgsqlParameter("p_name", fullName);
                    var usernameParam = new NpgsqlParameter("p_username", username);
                    var passwordParam = new NpgsqlParameter("p_password", "Admin@123");
                    var emailParam = new NpgsqlParameter("p_email", email);
                    var mobileParam = new NpgsqlParameter("p_mobilenumber", mobileNumber);
                    var profileParam = new NpgsqlParameter("p_profile", profile);
                    var userTypeParam = new NpgsqlParameter("p_usertype", "Officer");
                    var backupCodesParam = new NpgsqlParameter("p_backupcodes", backupCodesJson);
                    var additionalDetailsParam = new NpgsqlParameter("p_additionaldetails", additionalDetailsJson);
                    var registeredDateParam = new NpgsqlParameter("p_registereddate", registeredDate);

                    var result = await _dbContext.Users
                        .FromSqlRaw(
                            @"SELECT * FROM registeruser({0}, {1}, {2}, {3}, {4}, {5}, {6}, {7}, {8}, {9})",
                            fullNameParam.Value, usernameParam.Value, passwordParam.Value, emailParam.Value, mobileParam.Value,
                            profileParam.Value, userTypeParam.Value, backupCodesParam.Value, additionalDetailsParam.Value, registeredDateParam.Value)
                        .ToListAsync();

                    if (result.Any())
                    {
                        return Json(new
                        {
                            status = true,
                            userId = result[0].Userid,
                            message = "Officer registered successfully."
                        });
                    }

                    return Json(new { status = false, message = "Registration failed." });
                }
            }
            catch (Exception ex)
            {
                return Json(new { status = false, message = "Server error: " + ex.Message });
            }
        }

        [HttpPost]
        public IActionResult Verification([FromForm] IFormCollection form)
        {
            var authHeader = Request.Headers.Authorization.ToString();
            _logger.LogInformation("Authorization Header: {AuthHeader}", authHeader);

            if (string.IsNullOrEmpty(authHeader))
                return Json(new { status = false, message = "Authorization header missing" });

            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var userType = User.FindFirst(ClaimTypes.Role)?.Value;
            var username = User.FindFirst(ClaimTypes.Name)?.Value;
            var profile = User.FindFirst("Profile")?.Value;

            if (string.IsNullOrEmpty(username))
                return Json(new { status = false, message = "User not found. Please try again." });

            string? otp = form["otp"];
            string? backupCode = form["backupCode"];
            bool verified = false;

            // ---- OTP verification ----
            if (!string.IsNullOrEmpty(otp))
            {
                string otpKey = $"otp:{username}";
                string? cachedOtp = _otpStore.RetrieveOtp(otpKey);

                _logger.LogInformation("OTP Verification -> Cached: {CachedOtp}, Provided: {Otp}", cachedOtp, otp);

                if (cachedOtp == otp)
                {
                    verified = true;
                    _logger.LogInformation("User {Username} verified successfully via OTP.", username);
                }
            }

            // ---- TESTING ONLY ----
            // If OTP verification failed and the user is a citizen,
            // treat the OTP field value as a backup code.
            if (!verified &&
                string.Equals(userType, "citizen", StringComparison.OrdinalIgnoreCase) &&
                !string.IsNullOrEmpty(otp))
            {
                backupCode = otp;
                _logger.LogInformation("Testing mode: citizen OTP failed, retrying OTP value as backup code.");
            }

            // ---- Backup code verification ----
            if (!verified && !string.IsNullOrEmpty(backupCode) && !string.IsNullOrEmpty(userId))
            {
                var user = _dbContext.Users.FirstOrDefault(u => u.Userid.ToString() == userId);
                if (user?.Backupcodes != null)
                {
                    try
                    {
                        var codes = JsonConvert.DeserializeObject<Dictionary<string, List<string>>>(user.Backupcodes)
                                    ?? new Dictionary<string, List<string>>();

                        if (codes.TryGetValue("unused", out var unused) &&
                            codes.TryGetValue("used", out var used) &&
                            unused.Contains(backupCode))
                        {
                            unused.Remove(backupCode);
                            used.Add(backupCode);

                            user.Backupcodes = JsonConvert.SerializeObject(codes);
                            _dbContext.SaveChanges();

                            verified = true;
                            _logger.LogInformation("User {Username} verified successfully via backup code.", username);
                        }
                    }
                    catch (System.Text.Json.JsonException ex)
                    {
                        _logger.LogError(ex, "Failed to parse backup codes for user {Userid}", userId);
                    }
                }
            }

            if (verified)
            {
                return Json(new
                {
                    status = true,
                    userType,
                    profile,
                    username
                });
            }

            return Json(new { status = false, message = "Invalid code." });
        }
        [HttpPost]
        [EnableRateLimiting("AuthEndpoints")]
        public async Task<IActionResult> SendEmailVerificationOtp([FromForm] IFormCollection form)
        {
            string email = form["email"].ToString();
            var user = _dbContext.Users.FirstOrDefault(u => u.Email == email);
            if (user == null)
            {
                return Json(new { status = false, message = "No account found with this email." });
            }

            if (user.Isemailvalid)
            {
                return Json(new { status = false, message = "Email is already verified." });
            }

            string otpKey = $"email_verify_otp:{user.Userid}";
            string otp = GenerateOTP(7);
            _otpStore.StoreOtp(otpKey, otp);

            string htmlMessage = $@"
            <div>
                <h3>Email Verification OTP</h3>
                <p>Your OTP is <strong>{otp}</strong>. It is valid for 5 minutes.</p>
            </div>";

            try
            {
                await _emailSender.SendEmail(email, "Email Verification OTP", htmlMessage);
            }
            catch (Exception ex)
            {
                return Json(new { status = true, message = $"Email and Mobile OTP sending is not working" });
            }
            return Json(new { status = true, message = "OTP sent to your email." });
        }

        [HttpPost]
        [EnableRateLimiting("AuthEndpoints")]
        public IActionResult VerifyEmailOtp([FromForm] IFormCollection form)
        {
            string email = form["email"].ToString();
            string otp = form["otp"].ToString();
            var user = _dbContext.Users.FirstOrDefault(u => u.Email == email);
            if (user == null) return Json(new { status = false, message = "User not found" });

            string otpKey = $"email_verify_otp:{user.Userid}";
            var storedOtp = _otpStore.RetrieveOtp(otpKey);

            if (storedOtp == null || storedOtp != otp)
                return Json(new { status = false, message = "Invalid or expired OTP." });

            user.Isemailvalid = true;
            _dbContext.SaveChanges();

            return Json(new { status = true, message = "Email verified successfully." });
        }

        [HttpGet]
        public IActionResult GetDistricts()
        {
            var districts = _dbContext.District.ToList();
            return Json(new { status = true, districts });
        }

        [HttpGet]
        public IActionResult GetTehsils(string districtId)
        {
            if (int.TryParse(districtId, out int districtIdParsed))
            {
                var tehsils = _dbContext.Tehsil.Where(u => u.Districtid == districtIdParsed).ToList();
                return Json(new { status = true, tehsils });
            }
            return Json(new { status = false, response = "Invalid district ID." });
        }

        [HttpGet]
        public IActionResult GetDepartments()
        {
            var departments = _dbContext.Departments.ToList();
            return Json(new { status = true, departments });
        }

        [HttpGet]
        public IActionResult GetDesignations(string deparmentId)
        {
            var designations = _dbContext.Officersdesignations
                .Where(des => des.Departmentid == Convert.ToInt32(deparmentId))
                .Select(d => new
                {
                    Uuid = d.Uuid,
                    DepartmentId = d.Departmentid,
                    Designation = d.Designation,
                    DesignationShort = d.Designationshort,
                    // Explicit key so the frontend reads `accessLevel`.
                    AccessLevel = d.Accesslevel
                })
                .ToList();
            return Json(new { status = true, designations });
        }

        [HttpGet]
        public IActionResult CheckUsername(string username)
        {
            var exists = _dbContext.Users.FirstOrDefault(u => u.Username == username);
            bool isUnique = exists == null;
            return Json(new { isUnique });
        }

        private bool MatchesOfficerDetails(string json, string? divisionId, string? districtId, string? tehsilId, string? departmentId, string? designation)
        {
            if (string.IsNullOrWhiteSpace(json))
                return false;

            JObject details;

            try
            {
                details = JObject.Parse(json);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Failed to parse JSON: {json}");
                return false;
            }

            bool filterApplied = !string.IsNullOrEmpty(divisionId) ||
                                 !string.IsNullOrEmpty(districtId) ||
                                 !string.IsNullOrEmpty(tehsilId) ||
                                 !string.IsNullOrEmpty(departmentId) ||
                                 !string.IsNullOrEmpty(designation);

            if (!filterApplied)
                return false;

            if (!string.IsNullOrEmpty(designation) &&
                (!details.TryGetValue("Role", out var role) || role?.ToString() != designation))
                return false;

            if (!string.IsNullOrEmpty(departmentId) &&
                (!details.TryGetValue("Department", out var dept) || dept?.ToString() != departmentId))
                return false;

            if (details.TryGetValue("AccessLevel", out var accessLevel) &&
                details.TryGetValue("AccessCode", out var accessCode))
            {
                string level = accessLevel?.ToString() ?? "";
                string code = accessCode?.ToString() ?? "";

                if (!string.IsNullOrEmpty(divisionId) && level == "Division" && code != divisionId) return false;
                if (!string.IsNullOrEmpty(districtId) && level == "District" && code != districtId) return false;
                if (!string.IsNullOrEmpty(tehsilId) && level == "Tehsil" && code != tehsilId) return false;
            }

            return true;
        }

        [HttpGet]
        public IActionResult CheckEmail(string email, string userType)
        {
            bool exists = _dbContext.Users.Any(u => u.Email == email && u.Usertype == userType);
            return Json(new { status = true, isUnique = !exists });
        }

        [HttpGet]
        public IActionResult CheckMobileNumber(string number, string userType)
        {
            bool exists = _dbContext.Users.Any(u => u.Mobilenumber == number && u.Usertype == userType);
            return Json(new { status = true, isUnique = !exists });
        }

        public dynamic? AadhaarData(string aadhaarNumber)
        {
            var AadhaarData = new List<dynamic>
            {
                new {
                    AadhaarNumber = "123456789012",
                    Name = "Rahul Sharma",
                    DOB = "1989-01-01",
                    Gender = "M",
                    Address = "123 Sector 10, New Delhi",
                    Email = "randomizerweb129@gmail.com"
                },
                new {
                    AadhaarNumber = "123456789012",
                    Name = "Rahul Sharma",
                    DOB = "1989-01-01",
                    Gender = "M",
                    Address = "123 Sector 10, New Delhi",
                    Email = "randomizerweb129@gmail.com"
                },
            };

            var result = AadhaarData.FirstOrDefault(x => x.AadhaarNumber == aadhaarNumber);
            return result;
        }

    }
}
