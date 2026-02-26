using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Npgsql;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;
using SendEmails;
using SahayataNidhi.Models.Entities;
using System.Security.Claims;
using Newtonsoft.Json.Linq;

namespace SahayataNidhi.Controllers.User
{
    [Authorize(Roles = "Citizen")]
    public partial class UserController(
    SwdjkContext dbcontext,
    IAuditLogService auditService,
    ILogger<UserController> logger,
    UserHelperFunctions helper,
    EmailSender emailSender,
    PdfService pdfService,
    IWebHostEnvironment webHostEnvironment,
    IBackgroundTaskQueue taskQueue,
    IHttpClientFactory httpClientFactory,
    IServiceScopeFactory serviceScopeFactory
) : Controller
    {
        protected readonly SwdjkContext dbcontext = dbcontext;
        private readonly IAuditLogService _auditService = auditService;
        protected readonly ILogger<UserController> _logger = logger;
        protected readonly UserHelperFunctions helper = helper;
        protected readonly EmailSender emailSender = emailSender;
        protected readonly PdfService _pdfService = pdfService;
        private readonly IWebHostEnvironment _webHostEnvironment = webHostEnvironment;

        private readonly IBackgroundTaskQueue _taskQueue = taskQueue;
        private readonly IHttpClientFactory _httpClientFactory = httpClientFactory;
        private readonly IServiceScopeFactory _serviceScopeFactory = serviceScopeFactory;

        public override void OnActionExecuted(ActionExecutedContext context)
        {
            base.OnActionExecuted(context);
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var citizen = dbcontext.Users.FirstOrDefault(u => u.UserId.ToString() == userIdClaim);

            ViewData["UserType"] = "Citizen";
            ViewData["UserName"] = citizen?.Username;
            ViewData["Profile"] = citizen?.Profile;
        }

        public IActionResult Index()
        {
            var details = GetUserDetails();
            return View(details);
        }

        public IActionResult GetServiceNames()
        {
            var services = dbcontext.Services.ToList();

            var ServiceList = services.Select(service => new
            {
                service.ServiceId,
                service.ServiceName
            }).ToList();

            return Json(new { status = true, ServiceList });
        }

        [HttpPost]
        public IActionResult Feedback([FromForm] IFormCollection form)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            string? message = form["message"].ToString();
            string serviceValue = form["service"].ToString();

            if (string.IsNullOrEmpty(userIdClaim))
            {
                return RedirectToAction("Index");
            }

            if (!int.TryParse(userIdClaim, out int userId))
            {
                return RedirectToAction("Index");
            }

            try
            {
                string serviceRelatedJson;
                if (!string.IsNullOrEmpty(serviceValue))
                {
                    var obj = new
                    {
                        ServiceId = Convert.ToInt32(serviceValue),
                        ApplicationId = form["ApplicationId"].ToString()
                    };
                    serviceRelatedJson = JsonConvert.SerializeObject(obj);
                }
                else
                {
                    serviceRelatedJson = "{}";
                }

                // Direct database insertion into Feedback table
                var feedback = new Models.Entities.Feedback
                {
                    UserId = userId,
                    Description = message, // Assuming Description field is for the message
                    Files = serviceRelatedJson, // Using Files field to store service-related JSON
                    Status = "Pending",
                    CreatedOn = DateTime.Now
                };

                dbcontext.Feedbacks.Add(feedback);
                dbcontext.SaveChanges();

                return RedirectToAction("Index");
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error submitting feedback: {ex.Message}");
                return RedirectToAction("Index");
            }
        }

        [HttpGet]
        public IActionResult GetFile(string? filePath)
        {
            if (string.IsNullOrEmpty(filePath))
            {
                return NotFound();
            }

            var fullPath = _webHostEnvironment.WebRootPath + filePath;
            _logger.LogInformation($"-----------WEB HOST Path : {_webHostEnvironment.WebRootPath}----------------");
            _logger.LogInformation($"-----------Full Path : {fullPath}----------------");

            if (!System.IO.File.Exists(fullPath))
            {
                return NotFound();
            }

            var fileBytes = System.IO.File.ReadAllBytes(fullPath);
            var contentType = GetContentType(fullPath);

            return File(fileBytes, contentType, Path.GetFileName(fullPath));
        }

        private static string GetContentType(string path)
        {
            var types = new Dictionary<string, string>
            {
                { ".txt", "text/plain" },
                { ".pdf", "application/pdf" },
                { ".jpg", "image/jpeg" },
                { ".jpeg", "image/jpeg" },
                { ".png", "image/png" },
                { ".gif", "image/gif" },
                { ".bmp", "image/bmp" }
            };

            var ext = Path.GetExtension(path).ToLowerInvariant();
            return types.TryGetValue(ext, out string? value) ? value : "application/octet-stream";
        }


    }
}