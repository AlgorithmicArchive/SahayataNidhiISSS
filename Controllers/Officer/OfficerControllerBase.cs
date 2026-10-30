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
using SahayataNidhi.Services;

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
        IEncryptionService encryptionService,
        IAuditLogService auditService,
        IConfiguration config,
        IMemoryCache memoryCache,
        IExpirationSyncService expirationSyncService, SessionRepository sessionRepo, IReferenceDataService referenceData,
        ApplicationCounterService applicationCounterService,
        INotificationDispatcher notifier, IServiceScopeFactory scopeFactory) : Controller
    {
        protected readonly SwdjkContext dbcontext = dbcontext;
        protected readonly ILogger<OfficerController> _logger = logger;
        protected readonly UserHelperFunctions helper = helper;
        protected readonly ApplicationCounterService _applicationCounter = applicationCounterService;
        protected readonly EmailSender emailSender = emailSender;
        protected readonly PdfService _pdfService = pdfService;
        private readonly IWebHostEnvironment _webHostEnvironment = webHostEnvironment;
        protected readonly INotificationDispatcher _notifier = notifier;
        private readonly IHubContext<ProgressHub> hubContext = hubContext;
        protected readonly IEncryptionService encryptionService = encryptionService;
        private readonly IAuditLogService _auditService = auditService;
        private readonly IConfiguration _config = config;
        private readonly IMemoryCache _memoryCache = memoryCache;
        private readonly IExpirationSyncService _expirationSyncService = expirationSyncService;
        private readonly SessionRepository _sessionRepo = sessionRepo;
        protected readonly IReferenceDataService _referenceData = referenceData;
        private readonly IServiceScopeFactory _scopeFactory = scopeFactory;
        public override void OnActionExecuted(ActionExecutedContext context)
        {
            base.OnActionExecuted(context);

            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

            string? username = null;
            string profile = "/resources/dummyDocs/formImage.jpg";

            // ✅ Use a separate DbContext instance so we don't collide with
            //    any background work still using the request-scoped one.
            using (var scope = _scopeFactory.CreateScope())
            {
                var scopedDb = scope.ServiceProvider.GetRequiredService<SwdjkContext>();

                var officer = scopedDb.Users
                    .AsNoTracking()
                    .FirstOrDefault(u => u.Userid.ToString() == userId);

                username = officer?.Username;
                if (!string.IsNullOrEmpty(officer?.Profile))
                    profile = officer.Profile;
            }

            ViewData["UserType"] = "Officer";
            ViewData["UserName"] = username;
            ViewData["Profile"] = profile;
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

        // =====================================================================
        // Dashboard counts cache (Layer 1)
        //
        // Counts are expensive at State/Division level (get_dashboard_counts
        // expands JSONB workflow/formdetails across all rows). We cache the
        // per-scope result for a short TTL and invalidate only on actions taken
        // by the same officer. Cross-officer staleness is bounded by the TTL.
        // =====================================================================
        protected const string DashboardCountCachePrefix = "officer:dashboard:counts:";

        protected static readonly TimeSpan DashboardCountCacheTtl = TimeSpan.FromSeconds(60);

        protected string BuildDashboardCountKey(string accessLevel, int? accessCode, string role, int serviceId)
            => $"{DashboardCountCachePrefix}{accessLevel}|{accessCode}|{role}|{serviceId}";

        /// <summary>
        /// Removes the cached dashboard counts for the acting officer's scope.
        /// Call after any successful action that changes application statuses.
        /// </summary>
        /// <param name="accessLevel">Officer access level (State/Division/District/Tehsil).</param>
        /// <param name="accessCode">Officer access code.</param>
        /// <param name="role">Officer designation/role.</param>
        /// <param name="serviceId">Service whose counts changed; removes that key.</param>
        protected void InvalidateDashboardCounts(string accessLevel, int? accessCode, string role, int? serviceId = null)
        {
            if (serviceId.HasValue)
            {
                _memoryCache.Remove(BuildDashboardCountKey(accessLevel, accessCode, role, serviceId.Value));
            }
            // If serviceId is unknown we intentionally do nothing — the 60s TTL
            // is the backstop, so a stale value can never live longer than that.
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

                    string currentTrigger = "";
                    if (status == "sanctioned") currentTrigger = "APPLICATION_SANCTIONED";
                    else if (status == "corrigendum") currentTrigger = "CORRIGENDUM_SANCTIONED";
                    else if (status == "withheld") currentTrigger = "WITHHELD_APPROVED";

                    if (!string.IsNullOrEmpty(currentTrigger) && onAction != null && onAction.Contains(currentTrigger))
                    {
                        var fullFieldMapObj = JObject.Parse(getServices.Fieldmappings);
                        var fieldMapObj = fullFieldMapObj[currentTrigger] as JObject ?? fullFieldMapObj;

                        // ✅ FIX: Use unique variable names to avoid scope conflicts
                        object targetEntity = details;

                        JArray parsedWorkflowJson = new JArray();
                        try
                        {
                            var wfProp = details.GetType().GetProperty("Workflow") ?? details.GetType().GetProperty("workflow");
                            if (wfProp != null)
                            {
                                var wfString = wfProp.GetValue(details)?.ToString();
                                if (!string.IsNullOrWhiteSpace(wfString))
                                    parsedWorkflowJson = JArray.Parse(wfString);
                            }
                        }
                        catch { }

                        JObject parsedFormJson = new JObject();
                        try
                        {
                            foreach (var propName in new[] { "Location", "FormDetails", "Data", "Fields", "location" })
                            {
                                var prop = details.GetType().GetProperty(propName);
                                if (prop != null)
                                {
                                    var jsonString = prop.GetValue(details)?.ToString();
                                    if (!string.IsNullOrWhiteSpace(jsonString) && jsonString.Trim().StartsWith("{"))
                                    {
                                        parsedFormJson = JObject.Parse(jsonString);
                                        break;
                                    }
                                }
                            }
                        }
                        catch { }

                        // Pass the uniquely named variables to the mapper
                        var fieldMap = MapServiceFieldsFromForm(parsedFormJson, fieldMapObj, parsedWorkflowJson, targetEntity, dbcontext);

                        await SendApiRequestAsync(getServices.Apiendpoint, fieldMap!, getServices.Headers!);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error executing web service callback for service {ServiceId}", details.Serviceid);
            }

            details.Workflow = JsonConvert.SerializeObject(players);
            details.Currentplayer = (int)currentPlayer!["playerId"]!;
            dbcontext.SaveChanges();

            // Invalidate cached dashboard counts owned by this officer (TTL is the outer backstop).
            InvalidateDashboardCounts(officer.AccessLevel!, officer.AccessCode, officer.Role!, details.Serviceid);

            helper.InsertHistory(applicationId, "Pulled Application", (string)currentPlayer["designation"]!, "Call back Application", officer.AccessLevel!, (int)officer.AccessCode!);


            return Json(new { status = true });
        }

        [HttpGet]
        public async Task<IActionResult> PullCorrigendum(string corrigendumId)
        {
            var officer = GetOfficerDetails();
            if (officer == null)
            {
                return Json(new { status = false, message = "Officer details not found." });
            }

            var corrigendum = dbcontext.Corrigendum.FirstOrDefault(c => c.Corrigendumid == corrigendumId);
            if (corrigendum == null)
            {
                return Json(new { status = false, message = "Corrigendum not found." });
            }

            var players = JArray.Parse(corrigendum.Workflow ?? "[]");
            var currentPlayer = players.FirstOrDefault(p => (string)p["designation"]! == officer.Role);

            if (currentPlayer == null)
            {
                return Json(new { status = false, message = "You are not part of this workflow." });
            }

            string status = (string)currentPlayer["status"]!;

            // ★ Security Check: Verify the officer actually has pull rights
            if (currentPlayer["canPull"]?.ToString().ToLower() != "true")
            {
                return Json(new { status = false, message = "You are not authorized to pull this corrigendum." });
            }

            // ★ State Transitions
            if (status == "forwarded")
            {
                var nextPlayer = players.FirstOrDefault(p => (int)p["playerId"]! == ((int)currentPlayer["playerId"]! + 1));
                if (nextPlayer != null)
                {
                    nextPlayer["status"] = "";
                    nextPlayer["completedAt"] = "";
                    nextPlayer["remarks"] = "";
                }
                currentPlayer["status"] = "pending";
            }
            else if (status == "returned")
            {
                var prevPlayer = players.FirstOrDefault(p => (int)p["playerId"]! == ((int)currentPlayer["playerId"]! - 1));
                if (prevPlayer != null)
                {
                    prevPlayer["status"] = "forwarded";
                }
                currentPlayer["status"] = "pending";
            }
            else if (status == "sanctioned" || status == "verified" || status == "rejected")
            {
                currentPlayer["status"] = "pending";
                // Optional: If pulling a sanctioned/verified corrigendum, you may want to revert the main status
                // corrigendum.Status = "Initiated"; 
            }
            else
            {
                return Json(new { status = false, message = "Application cannot be pulled in its current state." });
            }

            // ★ Save Changes
            corrigendum.Workflow = players.ToString();
            corrigendum.Currentplayer = (int)currentPlayer["playerId"]!;
            dbcontext.SaveChanges();

            // ★ Invalidate Cache & Log History
            InvalidateDashboardCounts(officer.AccessLevel!, officer.AccessCode, officer.Role!, corrigendum.Serviceid);

            helper.InsertHistory(
                corrigendum.Referencenumber,
                "Pulled Corrigendum",
                (string)currentPlayer["designation"]!,
                $"Pulled back to pending from {status}",
                officer.AccessLevel!,
                (int)officer.AccessCode!
            );

            return Json(new { status = true, message = "Corrigendum pulled successfully." });
        }


        [HttpPost]
        public async Task<IActionResult> HandleAction([FromForm] IFormCollection form)
        {
            OfficerDetailsModal officer = GetOfficerDetails();
            if (officer == null)
                return Json(new { status = false, response = "Officer not found" });

            string applicationId = form["applicationId"].ToString();
            string action = form["defaultAction"].ToString();
            string remarks = form["remarks"].ToString() ?? "";
            string additionalDetailsStr = form["additionalDetails"].ToString() ?? "";

            _logger.LogInformation("HandleAction called | AppID: {ApplicationId} | Action: {Action} | Officer: {OfficerRole} ({OfficerId})",
                applicationId, action, officer.Role, officer.UserId);

            // Parse additionalDetails
            JObject additionalDetailsObj = new JObject();
            if (!string.IsNullOrWhiteSpace(additionalDetailsStr))
            {
                try { additionalDetailsObj = JObject.Parse(additionalDetailsStr); }
                catch (Exception ex) { _logger.LogError(ex, "Invalid additionalDetails JSON"); }
            }

            // Extract declaration
            string decleration = additionalDetailsObj["forwardDeclaration"]?.ToString()
                                 ?? additionalDetailsObj["Declearation"]?.ToString()
                                 ?? additionalDetailsObj["declaration"]?.ToString()
                                 ?? "";
            if (string.IsNullOrEmpty(decleration))
            {
                foreach (var prop in additionalDetailsObj.Properties())
                {
                    if (prop.Name.IndexOf("declaration", StringComparison.OrdinalIgnoreCase) >= 0 ||
                        prop.Name.IndexOf("declearation", StringComparison.OrdinalIgnoreCase) >= 0 ||
                        prop.Name.IndexOf("confirmation", StringComparison.OrdinalIgnoreCase) >= 0)
                    {
                        decleration = prop.Value?.ToString() ?? "";
                        break;
                    }
                }
            }

            JToken returnFieldsToken = additionalDetailsObj["returnFields"]!;

            try
            {
                var formdetails = await dbcontext.CitizenApplications
                    .FirstOrDefaultAsync(fd => fd.Referencenumber == applicationId);
                if (formdetails == null)
                    return Json(new { status = false, response = "Application not found" });

                var formDetailsObj = JObject.Parse(formdetails.Formdetails!);
                var workFlow = formdetails.Workflow;
                int currentPlayer = formdetails.Currentplayer ?? 0;

                if (string.IsNullOrEmpty(workFlow))
                {
                    _logger.LogError("WorkFlow is null or empty for application {AppId}", applicationId);
                    return Json(new { status = false, response = "Workflow data missing" });
                }

                var players = JArray.Parse(workFlow);

                // ---------- Bounds checks ----------
                if (currentPlayer < 0 || currentPlayer >= players.Count)
                    return Json(new { status = false, response = "Invalid workflow position" });

                if (action == "Forward" && currentPlayer + 1 >= players.Count)
                    return Json(new { status = false, response = "Cannot forward: No next officer" });
                if (action == "ReturnToPlayer" && currentPlayer <= 0)
                    return Json(new { status = false, response = "Cannot return further" });

                // ---------- Idempotency guard for terminal actions ----------
                string currentStatus = players[currentPlayer]?["status"]?.ToString() ?? "";
                if ((action == "Sanction" || action == "Reject") &&
                    (currentStatus.Equals("sanctioned", StringComparison.OrdinalIgnoreCase) ||
                     currentStatus.Equals("rejected", StringComparison.OrdinalIgnoreCase)))
                {
                    _logger.LogInformation(
                        "HandleAction idempotent skip | AppID: {AppId} | Action: {Action} | CurrentStatus: {Status}",
                        applicationId, action, currentStatus);
                    return Json(new { status = true, response = "Action already applied (idempotent)." });
                }

                // ---------- 1. Apply action to workflow ----------
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

                    await RemoveApplicationFromOfficerPoolAsync(
                        formdetails.Serviceid.ToString()!, officer, applicationId);
                }
                else if (action == "Reject")
                {
                    players[currentPlayer]["status"] = "rejected";

                    await RemoveApplicationFromOfficerPoolAsync(
                        formdetails.Serviceid.ToString()!, officer, applicationId);
                }
                else if (action == "PushToPool")
                {
                    players[currentPlayer]["status"] = "pushedtopool";

                    var pool = await dbcontext.Pool.FirstOrDefaultAsync(p =>
                        p.Serviceid == formdetails.Serviceid &&
                        p.Listtype == "Pool" &&
                        p.Accesslevel == officer.AccessLevel &&
                        p.Accesscode == officer.AccessCode);

                    List<string> poolList;
                    if (string.IsNullOrWhiteSpace(pool?.List))
                        poolList = new List<string>();
                    else
                        poolList = System.Text.Json.JsonSerializer.Deserialize<List<string>>(pool!.List!)
                                   ?? new List<string>();

                    if (!poolList.Contains(applicationId))
                        poolList.Add(applicationId);

                    var serialized = System.Text.Json.JsonSerializer.Serialize(poolList);

                    if (pool == null)
                    {
                        pool = new Pool
                        {
                            Serviceid = formdetails.Serviceid,
                            Listtype = "Pool",
                            Accesslevel = officer.AccessLevel!,
                            Accesscode = (int)officer.AccessCode!,
                            List = serialized
                        };
                        dbcontext.Pool.Add(pool);
                    }
                    else
                    {
                        pool.List = serialized;
                    }
                }

                // =================================================================
                // Legacy officer document upload (multi-document, officer-defined names)
                // - Only on Forward action
                // - Files posted as multipart parts named legacyDocument_0, _1, ...
                // - Matching enclosure names posted as legacyDocumentName_0, _1, ...
                // - Each file gets its own entry in Formdetails.Documents with:
                //     name       = camelCase(enclosureName)
                //     label      = enclosureName
                //     Enclosure  = enclosureName
                //     File       = stored path
                // - Files stored via the same helper used by InsertFormDetails
                //   (hash deduped, root folder = "document")
                // =================================================================
                if (action == "Forward")
                {
                    var legacyDocs = new List<(IFormFile File, string EnclosureName)>();
                    int idx = 0;
                    while (true)
                    {
                        var f = form.Files.FirstOrDefault(x => x.Name == $"legacyDocument_{idx}");
                        if (f == null) break;

                        var enclosureName = form[$"legacyDocumentName_{idx}"].ToString();
                        if (string.IsNullOrWhiteSpace(enclosureName))
                            enclosureName = "Legacy Application Document";

                        legacyDocs.Add((f, enclosureName.Trim()));
                        idx++;
                    }

                    if (legacyDocs.Count > 0)
                    {
                        try
                        {
                            if (formDetailsObj["Documents"] is not JArray docsArray)
                            {
                                docsArray = new JArray();
                                formDetailsObj["Documents"] = docsArray;
                            }

                            foreach (var (legacyFile, enclosureNameRaw) in legacyDocs)
                            {
                                // Store the physical file (hash-deduped)
                                string filePath = await helper.GetFilePath(legacyFile, null, null, "document");

                                // Convert officer's enclosure name into a camelCase key
                                string enclosureKey = ToCamelCase(enclosureNameRaw);
                                if (string.IsNullOrEmpty(enclosureKey))
                                    enclosureKey = "legacyApplicationDocument";

                                docsArray.Add(new JObject
                                {
                                    ["name"] = enclosureKey,
                                    ["label"] = enclosureNameRaw,
                                    ["Enclosure"] = enclosureNameRaw,
                                    ["File"] = filePath
                                });

                                _logger.LogInformation(
                                    "Legacy document attached | AppID: {AppId} | Enclosure: {Enclosure} | Name: {Name} | Path: {Path}",
                                    applicationId, enclosureNameRaw, enclosureKey, filePath);
                            }

                            // Persist the updated JSON back onto the entity
                            formdetails.Formdetails = formDetailsObj.ToString(Formatting.None);
                        }
                        catch (Exception ex)
                        {
                            // Do not abort the Forward action if the attachment failed —
                            // log and continue. The workflow change is the critical part.
                            _logger.LogError(ex,
                                "Legacy document upload FAILED | AppID: {AppId}", applicationId);
                        }
                    }
                }
                // ========== End of legacy document upload ==========

                // Common updates
                players[currentPlayer]["remarks"] = remarks;
                players[currentPlayer]["completedAt"] = DateTime.Now.ToString("dd MMM yyyy hh:mm:ss tt");

                var currentPlayerObj = (JObject)players[currentPlayer];
                if (additionalDetailsObj.Count > 0)
                {
                    if (currentPlayerObj["additionalDetails"] is not JObject playerAdditional)
                    {
                        playerAdditional = new JObject();
                        currentPlayerObj["additionalDetails"] = playerAdditional;
                    }
                    var remarksFieldsToRemove = additionalDetailsObj.Properties()
                        .Where(p => p.Name.Equals("Remarks", StringComparison.OrdinalIgnoreCase) ||
                                    p.Name.Equals("remarks", StringComparison.OrdinalIgnoreCase) ||
                                    p.Name.Equals("Comment", StringComparison.OrdinalIgnoreCase) ||
                                    p.Name.Equals("comment", StringComparison.OrdinalIgnoreCase))
                        .Select(p => p.Name).ToList();
                    foreach (var fieldName in remarksFieldsToRemove)
                        additionalDetailsObj.Remove(fieldName);

                    playerAdditional.Merge(additionalDetailsObj, new JsonMergeSettings
                    {
                        MergeArrayHandling = MergeArrayHandling.Replace
                    });
                }
                else currentPlayerObj.Remove("additionalDetails");

                string newWorkFlow = players.ToString(Formatting.None);
                if (action == "Reject" || action == "Sanction")
                    formdetails.Status = action + "ed";

                formdetails.Workflow = newWorkFlow;

                // =================================================================
                // 2. Update status_counts_snapshot (Entity Framework only)
                // =================================================================
                string dataType = formdetails.Datatype ?? "new";

                var currentOfficerKey = await GetOrCreateSnapshotForOfficer(
                    formdetails.Serviceid,
                    officer.AccessLevel!,
                    (int)officer.AccessCode!,
                    GetDivisionForLevelAndCode(officer.AccessLevel!, (int)officer.AccessCode!),
                    officer.Role!,
                    dataType);

                if (currentOfficerKey.Pendingcount > 0)
                    currentOfficerKey.Pendingcount--;

                switch (action.ToLower())
                {
                    case "forward": currentOfficerKey.Forwardedcount++; break;
                    case "returntoplayer": currentOfficerKey.Returnedcount++; break;
                    case "returntocitizen": currentOfficerKey.Returntoeditcount++; break;
                    case "sanction": currentOfficerKey.Sanctionedcount++; break;
                    case "reject": currentOfficerKey.Rejectcount++; break;
                }
                currentOfficerKey.CapturedAt = DateTime.UtcNow;

                if (action == "Forward" || action == "ReturnToPlayer")
                {
                    int targetIndex = action == "Forward" ? currentPlayer + 1 : currentPlayer - 1;
                    var targetPlayer = (JObject)players[targetIndex];
                    string targetDesignation = targetPlayer["designation"]?.ToString() ?? "";
                    string targetAccessLevel = targetPlayer["accessLevel"]?.ToString() ?? "";

                    int targetAccessCode = GetAccessCodeForLevel(targetAccessLevel, formDetailsObj);
                    int targetDivisionCode = GetDivisionForLevelAndCode(targetAccessLevel, targetAccessCode);

                    if (!string.IsNullOrEmpty(targetDesignation) && targetAccessCode > 0)
                    {
                        var targetOfficerKey = await GetOrCreateSnapshotForOfficer(
                            formdetails.Serviceid,
                            targetAccessLevel,
                            targetAccessCode,
                            targetDivisionCode,
                            targetDesignation,
                            dataType);

                        if (action == "Forward")
                        {
                            targetOfficerKey.Pendingcount++;
                            targetOfficerKey.Totalapplications++;
                        }
                        else
                        {
                            targetOfficerKey.Pendingcount++;
                            if (targetOfficerKey.Forwardedcount > 0)
                                targetOfficerKey.Forwardedcount--;
                        }
                        targetOfficerKey.CapturedAt = DateTime.UtcNow;
                    }
                }

                // =================================================================
                // 3. Save all changes in one transaction
                // =================================================================
                try
                {
                    await dbcontext.SaveChangesAsync();
                    _logger.LogInformation("SaveChanges succeeded | AppID: {AppId} | Action: {Action}", applicationId, action);

                    InvalidateDashboardCounts(officer.AccessLevel!, officer.AccessCode, officer.Role!, formdetails.Serviceid);
                }
                catch (DbUpdateException dbEx)
                {
                    _logger.LogError(dbEx, "DbUpdateException | AppID: {AppId} | Action: {Action} | Inner: {Inner}",
                        applicationId, action, dbEx.InnerException?.Message);
                    return Json(new { status = false, response = "Database save failed: " + dbEx.InnerException?.Message });
                }

                // =================================================================
                // 4. Post-commit side effects
                // =================================================================
                try
                {
                    helper.InsertHistory(applicationId, action, officer.Role!, remarks,
                        officer.AccessLevel!, (int)officer.AccessCode!);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "InsertHistory FAILED | AppID: {AppId} | Action: {Action}", applicationId, action);
                }

                if (action == "Sanction")
                {
                    try
                    {
                        await _expirationSyncService.SyncExpirationsAsync(formdetails, HttpContext.RequestAborted);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Expiration sync FAILED for {AppId}", applicationId);
                    }

                    try
                    {
                        await DispatchWebServicesAsync(
                            "APPLICATION_SANCTIONED",
                            formDetailsObj,
                            JArray.Parse(newWorkFlow),
                            formdetails,
                            formdetails.Serviceid);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "DispatchWebServicesAsync FAILED for {AppId}", applicationId);
                    }
                }

                string officerArea = "Unknown";
                try
                {
                    string appliedDistrictId = GetFieldValue("District", formDetailsObj);
                    string appliedTehsilId = GetFieldValue("Tehsil", formDetailsObj);
                    string districtName = "Unknown District";
                    if (!string.IsNullOrWhiteSpace(appliedDistrictId) && int.TryParse(appliedDistrictId, out int distId))
                        districtName = dbcontext.District.FirstOrDefault(d => d.Districtid == distId)?.Districtname ?? districtName;
                    officerArea = officer.AccessLevel switch
                    {
                        "Tehsil" => !string.IsNullOrWhiteSpace(appliedTehsilId) && int.TryParse(appliedTehsilId, out int tId)
                            ? (dbcontext.Tswotehsil.FirstOrDefault(t => t.Tehsilid == tId)?.Tehsilname ?? "") + ", " + districtName
                            : districtName,
                        "District" => districtName,
                        "Division" => officer.AccessCode == 1 ? "Jammu" : officer.AccessCode == 2 ? "Kashmir" : "Unknown Division",
                        "State" => "Jammu and Kashmir",
                        _ => "Unknown"
                    };
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "officerArea computation FAILED | AppID: {AppId}", applicationId);
                }

                try
                {
                    string Action = action == "ReturnToCitizen" ? "Returned for correction" : action + "ed";

                    byte[]? letterData = null;
                    string? letterName = null;
                    if (action == "Sanction")
                    {
                        string fileName = applicationId.Replace("/", "_") + "_SanctionLetter.pdf";
                        var fileModel = await dbcontext.Userdocuments.FirstOrDefaultAsync(f => f.Filename == fileName);
                        if (fileModel != null)
                        {
                            letterData = fileModel.Filedata;
                            letterName = fileName;
                        }
                    }

                    JArray? wf = null;
                    try { wf = string.IsNullOrEmpty(newWorkFlow) ? null : JArray.Parse(newWorkFlow); } catch { }

                    await _notifier.DispatchAsync(new NotificationRequest
                    {
                        ServiceId = formdetails.Serviceid,
                        Action = action,
                        FormDetails = formDetailsObj,
                        ApplicationWorkflow = wf,
                        ReferenceNumber = applicationId,
                        OfficerRole = officer.Role ?? "",
                        OfficerArea = officerArea,
                        ActionTaken = Action,
                        ActingOfficerUserId = officer.UserId,
                        AttachmentData = letterData,
                        AttachmentName = letterName
                    });
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Notification dispatch FAILED | AppID: {AppId} | Action: {Action}", applicationId, action);
                }

                try
                {
                    _auditService.InsertLog(HttpContext, action,
                        action != "returntoedit"
                            ? $"Application {action} by {officer.RoleShort} {officerArea}"
                            : $"Application Returned to citizen for correction by {officer.RoleShort} {officerArea}",
                        officer.UserId, "Success");
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Audit log FAILED | AppID: {AppId} | Action: {Action}", applicationId, action);
                }

                return Json(new { status = true });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unexpected error in HandleAction | AppID: {AppId} | Action: {Action}", applicationId, action);
                try { _auditService.InsertLog(HttpContext, action, $"Error: {ex.Message}", officer.UserId, "Failure"); } catch { }
                return Json(new { status = false, response = "Server error: " + ex.Message });
            }
        }

        // =================================================================
        // Helper: convert a human-readable enclosure name like "Aadhaar Card"
        // into a camelCase identifier like "aadhaarCard".
        // =================================================================
        private static string ToCamelCase(string label)
        {
            if (string.IsNullOrWhiteSpace(label)) return string.Empty;

            var cleaned = System.Text.RegularExpressions.Regex.Replace(
                label.Trim(), @"[^a-zA-Z0-9 ]+", " ");

            var words = cleaned.Split(new[] { ' ', '\t' }, StringSplitOptions.RemoveEmptyEntries);
            if (words.Length == 0) return string.Empty;

            var sb = new System.Text.StringBuilder();
            for (int i = 0; i < words.Length; i++)
            {
                var w = words[i].ToLowerInvariant();
                if (i == 0) sb.Append(w);
                else sb.Append(char.ToUpperInvariant(w[0])).Append(w.Substring(1));
            }
            return sb.ToString();
        }


        private async Task RemoveApplicationFromOfficerPoolAsync(string serviceId, OfficerDetailsModal officer, string applicationId)
        {
            var pool = await dbcontext.Pool.FirstOrDefaultAsync(p =>
                p.Serviceid == Convert.ToInt32(serviceId) &&
                p.Listtype == "Pool" &&
                p.Accesslevel == officer.AccessLevel &&
                p.Accesscode == officer.AccessCode);

            if (pool == null || string.IsNullOrWhiteSpace(pool.List))
                return;

            List<string> poolList;
            try
            {
                poolList = System.Text.Json.JsonSerializer.Deserialize<List<string>>(pool.List!)
                           ?? new List<string>();
            }
            catch
            {
                poolList = new List<string>();
            }

            int removed = poolList.RemoveAll(x => x == applicationId);
            if (removed == 0)
                return;

            if (poolList.Count == 0)
                dbcontext.Pool.Remove(pool);
            else
                pool.List = System.Text.Json.JsonSerializer.Serialize(poolList);
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
