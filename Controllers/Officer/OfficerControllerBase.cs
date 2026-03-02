using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;
using SendEmails;
using SahayataNidhi.Models.Entities;
using System.Security.Claims;
using System.Dynamic;
using Newtonsoft.Json.Linq;
using Renci.SshNet;
using EncryptionHelper;
using Microsoft.Extensions.Caching.Memory;
using Npgsql;
using System.Data;

namespace SahayataNidhi.Controllers.Officer
{
    [Authorize(Roles = "Officer")]
    public partial class OfficerController(
        SwdjkContext dbcontext,
        ILogger<OfficerController> logger,
        UserHelperFunctions helper,
        EmailSender emailSender,
        PdfService pdfService,
        IWebHostEnvironment webHostEnvironment,
        IHubContext<ProgressHub> hubContext,
        IEncryptionService encryptionService, IAuditLogService auditService, IConfiguration config, IMemoryCache memoryCache) : Controller
    {
        protected readonly SwdjkContext dbcontext = dbcontext;
        protected readonly ILogger<OfficerController> _logger = logger;
        protected readonly UserHelperFunctions helper = helper;
        protected readonly EmailSender emailSender = emailSender;
        protected readonly PdfService _pdfService = pdfService;
        private readonly IWebHostEnvironment _webHostEnvironment = webHostEnvironment;
        private readonly IHubContext<ProgressHub> hubContext = hubContext;
        protected readonly IEncryptionService encryptionService = encryptionService;
        private readonly IAuditLogService _auditService = auditService;
        private readonly IConfiguration _config = config;
        private readonly IMemoryCache _memoryCache = memoryCache;

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

        public OfficerDetailsModal GetOfficerDetails()
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId) || !int.TryParse(userId, out int parsedUserId))
            {
                _logger.LogWarning($"Invalid or missing UserId: {userId}");
                return null!;
            }

            // Call PostgreSQL function using Database.SqlQueryRaw
            var officer = dbcontext.Database
                .SqlQueryRaw<OfficerDetailsModal>(
                    "SELECT * FROM get_officer_details({0})",
                    parsedUserId)
                .AsEnumerable()
                .FirstOrDefault();

            return officer!;
        }

        public string GetAccessArea(string AccessLevel, int? AccessCode)
        {
            if (AccessLevel == "Tehsil")
            {
                var tehsil = dbcontext.Tswotehsil.Where(t => t.Tehsilid == AccessCode).FirstOrDefault();
                return tehsil?.Tehsilname ?? "Unknown Tehsil";
            }
            else if (AccessLevel == "District")
            {
                var district = dbcontext.District.FirstOrDefault(d => d.Districtid == AccessCode);
                return district?.Districtname ?? "Unknown District";
            }
            else if (AccessLevel == "Division")
            {
                return AccessCode == 1 ? "Jammu" : "Kashmir";
            }
            else return "Jammu and Kashmir";
        }

        [HttpGet]
        public IActionResult GetServiceList()
        {
            var officer = GetOfficerDetails();
            if (officer == null)
            {
                return Json(new { serviceList = new List<OfficerServiceListModal>(), role = "", area = "" });
            }

            // Call PostgreSQL function using Database.SqlQueryRaw
            var serviceList = dbcontext.Database
                .SqlQueryRaw<OfficerServiceListModal>(
                    "SELECT * FROM get_services_by_role({0})",
                    officer.Role ?? "")
                .AsEnumerable()
                .ToList();

            string officerArea = GetAccessArea(officer.AccessLevel!, officer.AccessCode);
            return Json(new { serviceList, role = officer.RoleShort, area = officerArea });
        }

        [HttpGet]
        public async Task<IActionResult> PullApplication(string applicationId)
        {
            var officer = GetOfficerDetails();
            if (officer == null)
            {
                return Json(new { status = false, message = "Officer not found" });
            }

            var details = dbcontext.CitizenApplications.FirstOrDefault(ca => ca.Referencenumber == applicationId);
            if (details == null)
            {
                return Json(new { status = false, message = "Application not found" });
            }

            var players = JsonConvert.DeserializeObject<dynamic>(details.Workflow!) as JArray;
            var currentPlayer = players?.FirstOrDefault(p => (string)p["designation"]! == officer.Role);
            string status = (string)currentPlayer?["status"]!;
            var formDetailsObj = JObject.Parse(details.Formdetails!);
            dynamic otherPlayer = new { };

            if (status == "forwarded")
            {
                otherPlayer = players?.FirstOrDefault(p => (int)p["playerId"]! == ((int)currentPlayer?["playerId"]! + 1))!;
                otherPlayer["status"] = "";
                currentPlayer!["status"] = "pending";
            }
            else if (status == "returned")
            {
                otherPlayer = players?.FirstOrDefault(p => (int)p["playerId"]! == ((int)currentPlayer?["playerId"]! - 1))!;
                otherPlayer["status"] = "forwarded";
                currentPlayer!["status"] = "pending";
            }
            else if (status == "sanctioned" || status == "returntoedit")
            {
                currentPlayer!["status"] = "pending";
            }

            try
            {
                var getServices = dbcontext.Webservice.FirstOrDefault(ws => ws.Serviceid == details.Serviceid && ws.Isactive);
                if (getServices != null)
                {
                    var onAction = JsonConvert.DeserializeObject<List<string>>(getServices.Onaction);
                    if (status == "sanctioned" && onAction != null && onAction.Contains("CallbackOnSanction"))
                    {
                        var fieldMapObj = JObject.Parse(getServices.Fieldmappings);
                        var fieldMap = MapServiceFieldsFromForm(formDetailsObj, fieldMapObj);
                        await SendApiRequestAsync(getServices.Apiendpoint, fieldMap);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in external service call");
            }

            details.Workflow = JsonConvert.SerializeObject(players);
            details.Currentplayer = (int)currentPlayer!["playerId"]!;
            dbcontext.SaveChanges();

            helper.InsertHistory(applicationId, "Pulled Application", (string)currentPlayer["designation"]!, "Call back Application", officer.AccessLevel!, (int)officer.AccessCode!);

            return Json(new { status = true });
        }

        [HttpPost]
        public async Task<IActionResult> HandleAction([FromForm] IFormCollection form)
        {
            OfficerDetailsModal officer = GetOfficerDetails();
            if (officer == null)
            {
                return Json(new { status = false, response = "Officer not found" });
            }

            string applicationId = form["applicationId"].ToString();
            string action = form["defaultAction"].ToString();
            string remarks = form["remarks"].ToString() ?? "";
            string additionalDetailsStr = form["additionalDetails"].ToString() ?? "";

            _logger.LogInformation("HandleAction called | AppID: {ApplicationId} | Action: {Action} | Officer: {OfficerRole} ({OfficerId})",
                applicationId, action, officer.Role, officer.UserId);

            JObject additionalDetailsObj = new JObject();
            if (!string.IsNullOrWhiteSpace(additionalDetailsStr))
            {
                try
                {
                    additionalDetailsObj = JObject.Parse(additionalDetailsStr);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Invalid additionalDetails JSON received from frontend: {Additionaldetails}", additionalDetailsStr);
                    additionalDetailsObj = new JObject();
                }
            }

            // Extract declaration
            string decleration = additionalDetailsObj["forwardDeclaration"]?.ToString() ??
                                 additionalDetailsObj["Declearation"]?.ToString() ??
                                 additionalDetailsObj["declaration"]?.ToString() ?? "";

            if (string.IsNullOrEmpty(decleration))
            {
                foreach (var prop in additionalDetailsObj.Properties())
                {
                    if (prop.Name.ToLower().Contains("declaration") ||
                        prop.Name.ToLower().Contains("declearation") ||
                        prop.Name.ToLower().Contains("confirmation"))
                    {
                        decleration = prop.Value?.ToString() ?? "";
                        break;
                    }
                }
            }

            JToken returnFieldsToken = additionalDetailsObj["returnFields"]!;

            try
            {
                var formdetails = dbcontext.CitizenApplications
                    .FirstOrDefault(fd => fd.Referencenumber == applicationId);

                if (formdetails == null)
                {
                    return Json(new { status = false, response = "Application not found" });
                }

                var formDetailsObj = JObject.Parse(formdetails.Formdetails!);
                var workFlow = formdetails.Workflow;
                int currentPlayer = formdetails.Currentplayer ?? 0;

                _logger.LogInformation("Initial State | CurrentPlayer: {CurrentPlayer} | Workflow Players Count: {Count}",
                    currentPlayer, string.IsNullOrEmpty(workFlow) ? 0 : JArray.Parse(workFlow).Count);
                _logger.LogDebug("Initial WorkFlow JSON: {WorkFlow}", workFlow);

                if (string.IsNullOrEmpty(workFlow))
                {
                    _logger.LogError("WorkFlow is null or empty for application {AppId}", applicationId);
                    return Json(new { status = false, response = "Workflow data missing" });
                }

                var players = JArray.Parse(workFlow);

                // Critical bounds checks
                if (action == "Forward" && currentPlayer + 1 >= players.Count)
                {
                    _logger.LogWarning("Cannot Forward - no next player | Current: {Current} | Total: {Total}", currentPlayer, players.Count);
                    return Json(new { status = false, response = "Cannot forward: No next officer in workflow" });
                }

                if (action == "ReturnToPlayer" && currentPlayer <= 0)
                {
                    _logger.LogWarning("Cannot ReturnToPlayer - already at first player");
                    return Json(new { status = false, response = "Cannot return further: Already at first level" });
                }

                // Perform the action
                if (action == "Forward")
                {
                    players[currentPlayer]["status"] = "forwarded";
                    players[currentPlayer]["canPull"] = true;
                    players[currentPlayer + 1]["status"] = "pending";
                    players[currentPlayer + 1]["detailsConfirmationDeclartion"] = decleration;
                    formdetails.Currentplayer = currentPlayer + 1;
                }
                else if (action == "ReturnToPlayer")
                {
                    players[currentPlayer]["status"] = "returned";
                    players[currentPlayer]["canPull"] = true;
                    players[currentPlayer - 1]["status"] = "pending";
                    formdetails.Currentplayer = currentPlayer - 1;
                }
                else if (action == "ReturnToCitizen")
                {
                    players[currentPlayer]["status"] = "returntoedit";
                    players[currentPlayer]["canPull"] = true;

                    if (returnFieldsToken != null)
                    {
                        JObject appAdditional = string.IsNullOrEmpty(formdetails.Additionaldetails)
                            ? new JObject()
                            : JObject.Parse(formdetails.Additionaldetails);

                        appAdditional["returnFields"] = returnFieldsToken;
                        formdetails.Additionaldetails = appAdditional.ToString();
                    }
                }
                else if (action == "Sanction")
                {
                    players[currentPlayer]["status"] = "sanctioned";
                }
                else if (action == "Reject")
                {
                    players[currentPlayer]["status"] = "rejected";
                }

                // Common updates
                players[currentPlayer]["remarks"] = remarks;
                players[currentPlayer]["completedAt"] = DateTime.Now.ToString("dd MMM yyyy hh:mm:ss tt");

                // Handle additionalDetails in current player
                var currentPlayerObj = (JObject)players[currentPlayer];

                if (additionalDetailsObj.Count > 0)
                {
                    if (currentPlayerObj["additionalDetails"] is not JObject playerAdditional)
                    {
                        playerAdditional = new JObject();
                        currentPlayerObj["additionalDetails"] = playerAdditional;
                    }

                    // Remove duplicate remark fields
                    var remarksFieldsToRemove = additionalDetailsObj.Properties()
                        .Where(p => p.Name.Equals("Remarks", StringComparison.OrdinalIgnoreCase) ||
                                    p.Name.Equals("remarks", StringComparison.OrdinalIgnoreCase) ||
                                    p.Name.Equals("Comment", StringComparison.OrdinalIgnoreCase) ||
                                    p.Name.Equals("comment", StringComparison.OrdinalIgnoreCase))
                        .Select(p => p.Name)
                        .ToList();

                    foreach (var fieldName in remarksFieldsToRemove)
                    {
                        additionalDetailsObj.Remove(fieldName);
                    }

                    playerAdditional.Merge(additionalDetailsObj, new JsonMergeSettings
                    {
                        MergeArrayHandling = MergeArrayHandling.Replace
                    });
                }
                else
                {
                    currentPlayerObj.Remove("additionalDetails");
                }

                // Generate and validate new WorkFlow JSON
                string newWorkFlow;
                try
                {
                    newWorkFlow = players.ToString(Formatting.None);
                    JArray.Parse(newWorkFlow); // Validate
                }
                catch (Exception jsonEx)
                {
                    _logger.LogError(jsonEx, "Generated INVALID WorkFlow JSON after action {Action}. Raw: {RawJson}", action, players.ToString(Formatting.Indented));
                    return Json(new { status = false, response = "Internal error: Invalid workflow generated" });
                }

                _logger.LogDebug("Final WorkFlow JSON to save: {NewWorkFlow}", newWorkFlow);

                if (action == "Reject" || action == "Sanction")
                {
                    formdetails.Status = action + "ed";
                }

                formdetails.Workflow = newWorkFlow;

                // Save with detailed error capture
                try
                {
                    dbcontext.SaveChanges();
                    _logger.LogInformation("SaveChanges succeeded | AppID: {AppId} | Action: {Action}", applicationId, action);
                }
                catch (DbUpdateException dbEx)
                {
                    string innerMessage = dbEx.InnerException?.Message ?? "No inner exception";
                    string fullInner = dbEx.InnerException?.ToString() ?? "None";

                    _logger.LogError(dbEx,
                        "DbUpdateException on SaveChanges | AppID: {AppId} | Action: {Action} | CurrentPlayer: {Player} | " +
                        "Inner Message: {InnerMessage}",
                        applicationId, action, currentPlayer, innerMessage);

                    _logger.LogDebug("Full Inner Exception: {FullInner}", fullInner);

                    return Json(new
                    {
                        status = false,
                        response = "Database save failed: " + innerMessage,
                        details = innerMessage // Remove in production
                    });
                }

                // Insert history
                helper.InsertHistory(applicationId, action, officer.Role!, remarks, officer.AccessLevel!, (int)officer.AccessCode!);

                // External service call
                try
                {
                    var getServices = dbcontext.Webservice
                        .FirstOrDefault(ws => ws.Serviceid == formdetails.Serviceid && ws.Isactive);

                    if (getServices != null)
                    {
                        var onAction = JsonConvert.DeserializeObject<List<string>>(getServices.Onaction);
                        if (onAction != null && onAction.Contains(action))
                        {
                            var fieldMapObj = JObject.Parse(getServices.Fieldmappings);
                            var fieldMap = MapServiceFieldsFromForm(formDetailsObj, fieldMapObj);
                            await SendApiRequestAsync(getServices.Apiendpoint, fieldMap);
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error in external service call for AppID: {AppId}", applicationId);
                }

                // Email preparation
                string fullName = GetFieldValue("ApplicantName", formDetailsObj);
                string ServiceName = dbcontext.Services
                    .FirstOrDefault(s => s.Serviceid == formdetails.Serviceid)?.Servicename ?? "Unknown Service";

                string appliedDistrictId = GetFieldValue("District", formDetailsObj);
                string appliedTehsilId = GetFieldValue("Tehsil", formDetailsObj);

                string districtName = dbcontext.District
                    .FirstOrDefault(d => d.Districtid == Convert.ToInt32(appliedDistrictId))?.Districtname ?? "Unknown District";

                string? tehsilName = null;
                if (!string.IsNullOrWhiteSpace(appliedTehsilId) && int.TryParse(appliedTehsilId, out int tehsilId))
                {
                    tehsilName = dbcontext.Tswotehsil
                        .FirstOrDefault(t => t.Tehsilid == tehsilId)?.Tehsilname;
                }

                string officerArea = officer.AccessLevel switch
                {
                    "Tehsil" => !string.IsNullOrWhiteSpace(tehsilName)
                        ? $"{tehsilName}, {districtName}"
                        : districtName,
                    "District" => districtName,
                    "Division" => officer.AccessCode == 1 ? "Jammu"
                                  : officer.AccessCode == 2 ? "Kashmir"
                                  : "Unknown Division",
                    "State" => "Jammu and Kashmir",
                    _ => "Unknown"
                };

                string userEmail = GetFieldValue("Email", formDetailsObj);
                string Action = action == "ReturnToCitizen" ? "Returned for correction" : action + "ed";

                var emailtemplate = JObject.Parse(dbcontext.Emailsettings.FirstOrDefault()?.Templates ?? "{}");
                string template = emailtemplate["OfficerAction"]?.ToString() ?? "";

                var placeholders = new Dictionary<string, string>
        {
            { "ApplicantName", fullName },
            { "ServiceName", ServiceName },
            { "ReferenceNumber", applicationId },
            { "OfficerRole", officer.Role! },
            { "ActionTaken", Action },
            { "OfficerArea", officerArea }
        };

                foreach (var pair in placeholders)
                {
                    template = template.Replace($"{{{pair.Key}}}", pair.Value);
                }

                string htmlMessage = template;

                // Send email with attachment for Sanction
                if (action == "Sanction")
                {
                    string fileName = applicationId.Replace("/", "_") + "_SanctionLetter.pdf";

                    var fileModel = await dbcontext.Userdocuments
                        .FirstOrDefaultAsync(f => f.Filename == fileName);

                    if (fileModel == null)
                    {
                        _logger.LogWarning($"Sanction letter not found: {fileName}");
                        return Json(new { status = false, message = "Sanction letter file not found" });
                    }

                    try
                    {
                        await emailSender.SendEmailWithAttachments(
                            userEmail!,
                            "Form Submission",
                            htmlMessage,
                            fileModel.Filedata, // byte[] directly from DB
                            fileName
                        );

                        _logger.LogInformation($"Sanction email sent for AppID: {applicationId}");
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, $"Failed to send sanction email for AppID: {applicationId}");
                        return Json(new { status = false, message = "Failed to send email" });
                    }

                }
                else if (action != "Forward" && action != "ReturnToPlayer") // Avoid email on internal forwards/returns
                {
                    try
                    {
                        await emailSender.SendEmail(userEmail, "Application Status Update", htmlMessage);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, $"Failed to send status email for AppID: {applicationId}");
                    }
                }

                // Audit log
                string description = action != "returntoedit"
                    ? $"Application {action} by {officer.RoleShort} {officerArea}"
                    : $"Application Returned to citizen for correction by {officer.RoleShort} {officerArea}";

                _auditService.InsertLog(HttpContext, action, description, officer.UserId, "Success");

                return Json(new { status = true });
            }
            catch (Exception ex)
            {
                string innerMsg = ex.InnerException?.Message ?? "None";
                _logger.LogError(ex, "Unexpected error in HandleAction | AppID: {AppId} | Action: {Action} | Inner: {Inner}",
                    applicationId, action, innerMsg);

                _auditService.InsertLog(HttpContext, action, $"Error: {ex.Message} | Inner: {innerMsg}", officer.UserId, "Failure");

                return Json(new
                {
                    status = false,
                    response = "Server error: " + ex.Message,
                    innerError = innerMsg // Remove in production
                });
            }
        }

        [HttpPost]
        public IActionResult UploadToSftp([FromForm] IFormCollection form)
        {
            try
            {
                if (!form.TryGetValue("AccessCode", out var accessCodeStr) ||
                    !form.TryGetValue("Serviceid", out var serviceIdStr) ||
                    !form.TryGetValue("Type", out var type) ||
                    !form.TryGetValue("Month", out var monthStr) ||
                    !form.TryGetValue("Year", out var yearStr) ||
                    !form.TryGetValue("FtpHost", out var ftpHost) ||
                    !form.TryGetValue("FtpUser", out var ftpUser) ||
                    !form.TryGetValue("FtpPassword", out var ftpPassword))
                {
                    return BadRequest(new { status = false, message = "Missing required form fields" });
                }

                if (!int.TryParse(accessCodeStr, out int accessCode) ||
                    !int.TryParse(serviceIdStr, out int serviceId) ||
                    !int.TryParse(monthStr, out int month) ||
                    !int.TryParse(yearStr, out int year))
                {
                    return BadRequest(new { status = false, message = "Invalid form field values" });
                }

                var districtShortName = dbcontext.District
                    .Where(d => d.Districtid == accessCode)
                    .Select(d => d.Districtshort)
                    .FirstOrDefault();

                if (string.IsNullOrEmpty(districtShortName))
                    return BadRequest(new { status = false, message = "District not found" });

                string monthShort = new DateTime(year, month, 1).ToString("MMM");
                string fileName = $"BankFile_{districtShortName}_{monthShort}_{year}.csv";

                string folderPath = Path.Combine(_webHostEnvironment.WebRootPath, "BankFiles");
                string filePath = Path.Combine(folderPath, fileName);

                if (!System.IO.File.Exists(filePath))
                    return NotFound(new { status = false, message = "CSV file not found on server" });

                byte[] fileBytes = System.IO.File.ReadAllBytes(filePath);

                using (var client = new SftpClient(ftpHost.ToString(), ftpUser.ToString(), ftpPassword.ToString()))
                {
                    client.Connect();
                    if (!client.IsConnected)
                        return StatusCode(500, new { status = false, message = "Failed to connect to SFTP server" });

                    using (var stream = new MemoryStream(fileBytes))
                    {
                        client.UploadFile(stream, fileName, true);
                    }

                    client.Disconnect();
                }

                return Ok(new { status = true, message = "File uploaded successfully to SFTP" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error uploading to SFTP");
                return StatusCode(500, new { status = false, message = $"Error uploading to SFTP: {ex.Message}" });
            }
        }

    }
}