using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using SahayataNidhi.Models.Entities;
using Wangkanai.Detection.Services;
using System.Diagnostics;          // Fixes the 'Stopwatch' error

namespace SahayataNidhi.Controllers
{
    public partial class BaseController(SwdjkContext dbcontext, ILogger<BaseController> logger, IDetectionService detection, IWebHostEnvironment webHostEnvironment, IConfiguration config, UserHelperFunctions helper, SessionRepository sessionRepo, IReferenceDataService referenceData) : Controller
    {
        protected readonly SwdjkContext dbcontext = dbcontext;
        protected readonly ILogger<BaseController> _logger = logger;
        private readonly IDetectionService _detection = detection;
        private readonly IWebHostEnvironment _webHostEnvironment = webHostEnvironment;
        private readonly IConfiguration _config = config;
        protected readonly UserHelperFunctions helper = helper;
        private readonly SessionRepository _sessionRepo = sessionRepo;
        protected readonly IReferenceDataService _referenceData = referenceData;
        private const long MinImageFile = 20 * 1024;  // 20KB
        private const long MaxImageFile = 50 * 1024;  // 50KB
        private const long MinPdfFile = 100 * 1024; // 100KB
        private const long MaxPdfFile = 600 * 1024; // 600KB

        [HttpPost]
        public async Task<IActionResult> SaveTableSettings([FromForm] IFormCollection form)
        {
            string storageKey = form["storageKey"].ToString(); // ✅ fixed typo
            string storageValue = form["storageValue"].ToString();

            var userId = Convert.ToInt32(User.FindFirst(ClaimTypes.NameIdentifier)?.Value);
            // OPTIMIZATION: async + AsNoTracking is not possible here since we update the entity,
            // but tracking is only needed on this single fetched row (was sync before).
            var userDetails = await dbcontext.Users.FirstOrDefaultAsync(u => u.Userid == userId);

            if (userDetails == null || string.IsNullOrWhiteSpace(userDetails.Additionaldetails))
            {
                return BadRequest("User not found or AdditionalDetails is empty.");
            }

            // Parse AdditionalDetails as JSON
            var additionalDetails = JObject.Parse(userDetails.Additionaldetails);

            if (additionalDetails.TryGetValue("TableSettings", out JToken? tableSettingsToken) &&
                tableSettingsToken is JObject tableSettings)
            {
                // Update or add the key
                tableSettings[storageKey] = JsonConvert.DeserializeObject<dynamic>(storageValue);
            }
            else
            {
                // Create new TableSettings section
                additionalDetails["TableSettings"] = new JObject
                {
                    [storageKey] = storageValue
                };
            }

            // ✅ Important: Save updated JSON back to user object
            userDetails.Additionaldetails = additionalDetails.ToString();

            // Persist changes
            await dbcontext.SaveChangesAsync();

            return Json(new { status = true });
        }

        [HttpPost]
        public async Task<IActionResult> ResendWebServiceRequest([FromForm] int logId)
        {
            try
            {
                var log = await dbcontext.WebserviceLogs.FirstOrDefaultAsync(x => x.Id == logId);
                if (log == null) return NotFound(new { status = false, message = "Log not found" });

                var webService = await dbcontext.Webservice.FirstOrDefaultAsync(w => w.Id == log.Webserviceid);
                if (webService == null) return NotFound(new { status = false, message = "Web service configuration not found" });

                // Parse UNMASKED headers from the Web Service configuration
                var headers = new List<KeyValuePair<string, string>>();
                if (!string.IsNullOrWhiteSpace(webService.Headers))
                {
                    try
                    {
                        var headersArray = JArray.Parse(webService.Headers);
                        foreach (var item in headersArray.OfType<JObject>())
                        {
                            var key = item["key"]?.ToString();
                            var value = item["value"]?.ToString();
                            if (!string.IsNullOrWhiteSpace(key))
                                headers.Add(new KeyValuePair<string, string>(key, value ?? ""));
                        }
                    }
                    catch { /* Ignore parse errors */ }
                }

                using var client = new HttpClient();
                using var request = new HttpRequestMessage(HttpMethod.Post, log.Requesturl);

                foreach (var header in headers)
                {
                    if (string.Equals(header.Key, "Content-Type", StringComparison.OrdinalIgnoreCase)) continue;
                    request.Headers.TryAddWithoutValidation(header.Key, header.Value);
                }

                request.Content = new StringContent(log.Requestbody ?? "", Encoding.UTF8, "application/json");

                var stopwatch = Stopwatch.StartNew();

                // Create a brand new log entry for this manual retry
                var newLog = new WebserviceLogs
                {
                    Executionid = Guid.NewGuid(), // New execution ID for manual retry
                    Webserviceid = webService.Id,
                    Serviceid = webService.Serviceid,
                    Triggername = log.Triggername,
                    Referencenumber = log.Referencenumber,
                    Attemptnumber = 1,
                    Requesturl = log.Requesturl,
                    Requestmethod = "POST",
                    Requestheaders = log.Requestheaders, // Reuse masked headers for DB storage
                    Requestbody = log.Requestbody,
                    Issuccess = false,
                    Createdat = DateTime.UtcNow
                };

                try
                {
                    using var response = await client.SendAsync(request);
                    stopwatch.Stop();
                    var responseBody = await response.Content.ReadAsStringAsync();

                    newLog.Responsestatuscode = (int)response.StatusCode;
                    newLog.Responsebody = responseBody.Length > 20000 ? responseBody.Substring(0, 20000) : responseBody;
                    newLog.Issuccess = response.IsSuccessStatusCode;
                    newLog.Durationms = stopwatch.ElapsedMilliseconds;
                }
                catch (Exception ex)
                {
                    stopwatch.Stop();
                    newLog.Errormessage = ex.Message;
                    newLog.Durationms = stopwatch.ElapsedMilliseconds;
                }

                dbcontext.WebserviceLogs.Add(newLog);
                await dbcontext.SaveChangesAsync();

                return Ok(new
                {
                    status = newLog.Issuccess,
                    message = newLog.Issuccess ? "Request resent successfully!" : "Request failed again. Check logs.",
                    data = newLog
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error resending web service request");
                return StatusCode(500, new { status = false, message = ex.Message });
            }
        }

    }
}