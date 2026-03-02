using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Npgsql;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Primitives;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using SahayataNidhi.Models.Entities;

namespace SahayataNidhi.Controllers.Profile
{
    [Authorize(Roles = "Citizen,Officer,Admin,Viewer,Designer")]
    public class ProfileController(SwdjkContext dbcontext, ILogger<ProfileController> logger, UserHelperFunctions helper, IWebHostEnvironment webHostEnvironment, IAuditLogService auditService) : Controller
    {
        private readonly SwdjkContext _dbcontext = dbcontext;
        private readonly ILogger<ProfileController> _logger = logger;
        private readonly UserHelperFunctions _helper = helper;
        private readonly IWebHostEnvironment _webHostEnvironment = webHostEnvironment;
        private readonly IAuditLogService _auditService = auditService;

        public override void OnActionExecuted(ActionExecutedContext context)
        {
            base.OnActionExecuted(context);
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            string? userType = User.FindFirst(ClaimTypes.Role)?.Value;
            var user = _dbcontext.Users.FirstOrDefault(u => u.Userid.ToString() == userId);
            string Profile = user?.Profile ?? "/assets/images/profile.jpg";
            ViewData["UserType"] = userType;
            ViewData["UserName"] = user?.Username;
            ViewData["Profile"] = Profile;
        }

        [HttpGet]
        public IActionResult Index()
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            string? userType = User.FindFirst(ClaimTypes.Role)?.Value;

            if (userId != null && !string.IsNullOrEmpty(userType))
            {
                var userDetails = _dbcontext.Users.FirstOrDefault(u => u.Userid.ToString() == userId);
                return View(userDetails);
            }
            return RedirectToAction("Error", "Home");
        }

        [HttpGet]
        public IActionResult GetUserDetails()
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (userId == null)
            {
                _logger.LogWarning("User ID not found in claims.");
                return Json(new { isValid = false, errorMessage = "User ID not found." });
            }

            var userDetails = _dbcontext.Users.FirstOrDefault(u => u.Userid.ToString() == userId);
            if (userDetails == null)
            {
                _logger.LogWarning($"User not found for ID: {userId}");
                return Json(new { isValid = false, errorMessage = "User not found." });
            }

            try
            {
                // Get ProofOfAge from Additionaldetails
                var ageProof = string.IsNullOrEmpty(userDetails.Additionaldetails)
                    ? ""
                    : JObject.Parse(userDetails.Additionaldetails)["ProofOfAge"]?.ToString() ?? "";

                var details = new
                {
                    isValid = true,
                    userDetails.Name,
                    userDetails.Username,
                    userDetails.Email,
                    userDetails.Mobilenumber,
                    userDetails.Profile,
                    userDetails.Backupcodes,
                    ageProof
                };

                return Json(details);
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error fetching user details: {ex.Message}");
                return Json(new { isValid = false, errorMessage = "Failed to fetch user details: " + ex.Message });
            }
        }

        [HttpGet]
        public IActionResult GenerateBackupCodes()
        {
            var userId = Convert.ToInt32(User.FindFirst(ClaimTypes.NameIdentifier)?.Value);

            try
            {
                var user = _dbcontext.Users.FirstOrDefault(u => u.Userid == userId);
                if (user == null)
                {
                    return Json(new { status = false, errorMessage = "User not found." });
                }

                var unused = _helper.GenerateUniqueRandomCodes(10, 8);
                var backupCodes = new
                {
                    unused,
                    used = Array.Empty<string>(),
                };

                // Direct update without stored procedure
                user.Backupcodes = JsonConvert.SerializeObject(backupCodes);
                _dbcontext.SaveChanges();

                return Json(new { status = true, url = "/settings" });
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error generating backup codes: {ex.Message}");
                return Json(new { status = false, errorMessage = "Failed to generate backup codes." });
            }
        }

        [HttpGet]
        public IActionResult Settings()
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            string? userType = HttpContext.Session.GetString("UserType");

            if (userId != null && !string.IsNullOrEmpty(userType))
            {
                var userDetails = _dbcontext.Users.FirstOrDefault(u => u.Userid.ToString() == userId);
                if (userType == "Admin") ViewData["Layout"] = "_AdminLayout";

                if (userDetails != null) return View(userDetails);
            }
            return RedirectToAction("Error", "Home");
        }

        [HttpPost]
        public async Task<IActionResult> UpdateUserDetails([FromForm] IFormCollection form)
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var user = await _dbcontext.Users.FirstOrDefaultAsync(u => u.Userid.ToString() == userId);

            if (user == null)
            {
                _logger.LogInformation("User not found.");
                return Json(new { isValid = false, errorMessage = "User not found." });
            }

            try
            {
                // Validate input
                if (!form.TryGetValue("name", out StringValues name) || string.IsNullOrEmpty(name.ToString()))
                {
                    return Json(new { isValid = false, errorMessage = "Name is required." });
                }
                if (!form.TryGetValue("username", out StringValues username) || string.IsNullOrEmpty(username.ToString()))
                {
                    return Json(new { isValid = false, errorMessage = "Username is required." });
                }
                if (!form.TryGetValue("email", out StringValues email) || string.IsNullOrEmpty(email.ToString()))
                {
                    return Json(new { isValid = false, errorMessage = "Email is required." });
                }
                if (!form.TryGetValue("mobileNumber", out StringValues mobileNumber) || string.IsNullOrEmpty(mobileNumber.ToString()))
                {
                    return Json(new { isValid = false, errorMessage = "Mobile number is required." });
                }

                // Update allowed fields
                user.Name = name.ToString();
                user.Username = username.ToString();
                user.Email = email.ToString();
                user.Mobilenumber = mobileNumber.ToString();

                // Handle profile image if uploaded
                if (form.Files.GetFile("profile") is IFormFile profileFile && profileFile.Length > 0)
                {
                    var profile = user.Profile;
                    if (!string.IsNullOrEmpty(profile) && profile != "/assets/images/profile.jpg")
                    {
                        string existingFilePath = Path.Combine(_webHostEnvironment.WebRootPath, profile.TrimStart('/'));
                        if (System.IO.File.Exists(existingFilePath))
                        {
                            try
                            {
                                System.IO.File.Delete(existingFilePath);
                                _logger.LogInformation($"Existing file {existingFilePath} deleted.");
                            }
                            catch (Exception ex)
                            {
                                _logger.LogError($"Error deleting file {existingFilePath}: {ex.Message}");
                            }
                        }
                    }
                    var profileFileName = await _helper.GetFilePath(profileFile, null, null, "profile");
                    _logger.LogInformation($"Profile file path: {profileFileName}");
                    user.Profile = profileFileName;
                }

                // Handle proof of age if uploaded
                string? ageProofFileName = null;
                if (form.Files.GetFile("ageProof") is IFormFile ageProofFile && ageProofFile.Length > 0)
                {
                    // Validate file size (100KB–200KB) and type (PDF)
                    if (ageProofFile.Length < 100 * 1024 || ageProofFile.Length > 200 * 1024)
                    {
                        return Json(new { isValid = false, errorMessage = "Proof of Age file size must be between 100KB and 200KB." });
                    }
                    if (ageProofFile.ContentType != "application/pdf")
                    {
                        return Json(new { isValid = false, errorMessage = "Proof of Age must be a PDF file." });
                    }

                    // Get existing Additionaldetails or initialize
                    JObject additionalDetails = string.IsNullOrEmpty(user.Additionaldetails)
                        ? new JObject()
                        : JObject.Parse(user.Additionaldetails);

                    // Get existing ProofOfAge filename to pass to GetFilePath
                    var existingProofOfAge = additionalDetails["ProofOfAge"]?.ToString();

                    ageProofFileName = await _helper.GetFilePath(ageProofFile, null, existingProofOfAge, "document");
                    _logger.LogInformation($"Proof of Age file path: {ageProofFileName}");

                    // Update Additionaldetails JSON
                    additionalDetails["ProofOfAge"] = ageProofFileName;
                    user.Additionaldetails = JsonConvert.SerializeObject(additionalDetails);
                }

                await _dbcontext.SaveChangesAsync();

                _auditService.InsertLog(HttpContext, "Update Profile",
                    ageProofFileName != null ? "Profile and Proof of Age updated successfully." : "Profile updated successfully.",
                    user.Userid, "Success");

                // Get ProofOfAge for response
                var responseAgeProof = string.IsNullOrEmpty(user.Additionaldetails)
                    ? ""
                    : JObject.Parse(user.Additionaldetails)["ProofOfAge"]?.ToString() ?? "";

                return Json(new
                {
                    isValid = true,
                    name = user.Name,
                    username = user.Username,
                    email = user.Email,
                    mobileNumber = user.Mobilenumber,
                    profile = user.Profile,
                    ageProof = responseAgeProof
                });
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error updating user details: {ex.Message}");
                return Json(new { isValid = false, errorMessage = "Failed to update user details: " + ex.Message });
            }
        }

        [HttpPost]
        public async Task<IActionResult> CreateFeedback([FromForm] IFormCollection form)
        {
            try
            {
                var fileNames = new List<string>();

                // Handle file uploads
                if (form.Files != null && form.Files.Count > 0)
                {
                    foreach (var file in form.Files)
                    {
                        // Use FileService to store file and get unique filename
                        var fileName = await _helper.GetFilePath(file, null, null, "feedback");
                        if (fileName != "No file provided.")
                        {
                            fileNames.Add(fileName);
                        }
                    }
                }

                // Extract other form fields
                var userId = Convert.ToInt32(User.FindFirst(ClaimTypes.NameIdentifier)?.Value);

                var title = form["Title"].ToString();
                var description = form["Description"].ToString();

                var feedback = new Feedback
                {
                    Userid = userId,
                    Title = title,
                    Description = description,
                    Files = JsonConvert.SerializeObject(fileNames),
                    Createdon = DateTime.Now
                };

                _dbcontext.Feedback.Add(feedback);
                await _dbcontext.SaveChangesAsync();

                return Ok(new { message = "Feedback submitted successfully" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error submitting feedback", error = ex.Message });
            }
        }

        [HttpGet]
        public async Task<IActionResult> GetFeedbacks(int pageIndex = 0, int pageSize = 10)
        {
            try
            {
                // Fetch all feedbacks
                var feedbacks = await _dbcontext.Feedback
                .Select(f => new
                {
                    f.Id,
                    f.Userid,
                    f.Title,
                    f.Description,
                    Files = JsonConvert.DeserializeObject<List<string>>(f.Files ?? "[]"),
                    f.Status,
                    f.Createdon
                })
                .OrderBy(f => f.Status != "Pending") // "Pending" first, others after
                .ThenByDescending(f => f.Createdon)   // optional: newest first
                .ToListAsync();

                // Pagination
                var totalRecords = feedbacks.Count;
                var pagedData = feedbacks
                    .Skip(pageIndex * pageSize)
                    .Take(pageSize)
                    .ToList();

                // Define columns for the frontend
                var columns = new List<object>
                {
                    new { accessorKey = "id", header = "ID" },
                    new { accessorKey = "title", header = "Title" },
                    new { accessorKey = "description", header = "Description" },
                    new { accessorKey = "createdOn", header = "Created On" },
                    new { accessorKey = "status", header = "Status" },
                };

                var data = new List<object>();

                // Define the reusable custom actions once
                var customActions = new List<object>
                {
                    new { tooltip = "View Files", color = "#1976D2", actionFunction = "ViewFiles" },
                };

                foreach (var f in pagedData)
                {
                    if (f.Status == "Pending")
                    {
                        customActions.Add(new { tooltip = "Resolved", color = "#4CAF50", actionFunction = "ResolveFeedback" });
                    }
                    data.Add(new
                    {
                        f.Id,
                        f.Title,
                        f.Description,
                        Createdon = f.Createdon.ToString("yyyy-MM-dd"),
                        f.Status,
                        f.Files,
                        CustomActions = customActions
                    });
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
                return StatusCode(500, new
                {
                    error = "Error retrieving feedbacks",
                    details = ex.Message
                });
            }
        }

        [HttpPost]
        public IActionResult UpdateFeedbackStatus([FromForm] IFormCollection form)
        {
            try
            {
                var feedbackId = Convert.ToInt32(form["feedbackId"]);
                _logger.LogInformation($"---------- Updating status for feedback ID: {feedbackId} ---------");

                var feedback = _dbcontext.Feedback.FirstOrDefault(f => f.Id == feedbackId);
                if (feedback == null)
                {
                    return Json(new { isValid = false, errorMessage = "Feedback not found." });
                }

                feedback.Status = "Resolved";
                _dbcontext.SaveChanges();

                return Json(new { isValid = true, message = "Feedback status updated to Resolved." });
            }
            catch (Exception ex)
            {
                return Json(new { isValid = false, errorMessage = "Error updating feedback status: " + ex.Message });
            }
        }

        private int GetCurrentUserId()
        {
            // Example: Extract from HttpContext.User (e.g., JWT claims)
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (int.TryParse(userIdClaim, out int userId))
            {
                return userId;
            }
            throw new UnauthorizedAccessException("User ID not found.");
        }

        public class PasswordChangeResult
        {
            public bool IsValid { get; set; }
            public string ErrorMessage { get; set; } = string.Empty;
        }

        public async Task<IActionResult> ChangePassword([FromForm] IFormCollection form)
        {
            var currentPassword = form["CurrentPassword"].ToString();
            var newPassword = form["NewPassword"].ToString();
            var confirmNewPassword = form["ConfirmNewPassword"].ToString();
            var userId = GetCurrentUserId();

            // Server-side validation
            if (string.IsNullOrEmpty(currentPassword) || string.IsNullOrEmpty(newPassword) || string.IsNullOrEmpty(confirmNewPassword))
            {
                return BadRequest(new { status = false, response = "All password fields are required." });
            }

            if (newPassword != confirmNewPassword)
            {
                return BadRequest(new { status = false, response = "New password and confirmation do not match." });
            }

            if (newPassword.Length < 8)
            {
                return BadRequest(new { status = false, response = "New password must be at least 8 characters long." });
            }

            try
            {
                // Call PostgreSQL function using FromSqlRaw
                var parameters = new[]
                {
                    new NpgsqlParameter("p_user_id", userId),
                    new NpgsqlParameter("p_current_password", currentPassword),
                    new NpgsqlParameter("p_new_password", newPassword)
                };

                var result = await _dbcontext.Database
                    .SqlQueryRaw<PasswordChangeResult>("SELECT * FROM change_password({0}, {1}, {2})",
                        parameters[0].Value!, parameters[1].Value!, parameters[2].Value!)
                    .ToListAsync();

                var changeResult = result.FirstOrDefault();

                if (changeResult != null && changeResult.IsValid)
                {
                    return Json(new { status = true, response = "Password changed successfully." });
                }
                else
                {
                    return Json(new { status = false, response = changeResult?.ErrorMessage ?? "Failed to change password." });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error changing password: {ex.Message}");
                return Json(new { status = false, response = $"Error: {ex.Message}" });
            }
        }
    }
}