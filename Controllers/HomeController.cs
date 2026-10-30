using System.Diagnostics;
using System.Text.RegularExpressions;

using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

using Newtonsoft.Json;

using SahayataNidhi.Models;             // ErrorViewModel
using SahayataNidhi.Models.Entities;   // SwdjkContext
using SendEmails;                       // EmailSender

namespace SahayataNidhi.Controllers
{

    public partial class HomeController(ILogger<HomeController> logger, SwdjkContext dbContext, OtpStore otpStore, EmailSender emailSender, UserHelperFunctions helper, PdfService pdfService, IConfiguration configuration, IAuditLogService auditService, SessionRepository sessionRepo, IHttpClientFactory httpClientFactory, IMemoryCache memoryCache, IHubContext<SessionHub> hubContext, RsaKeyService rsaService) : Controller
    {
        private readonly ILogger<HomeController> _logger = logger;
        private readonly SwdjkContext _dbContext = dbContext;
        private readonly OtpStore _otpStore = otpStore;
        private readonly EmailSender _emailSender = emailSender;
        private readonly UserHelperFunctions _helper = helper;
        private readonly PdfService _pdfService = pdfService;
        private readonly IConfiguration _configuration = configuration;
        private readonly IAuditLogService _auditService = auditService;
        private readonly SessionRepository _sessionRepo = sessionRepo;
        private readonly IHttpClientFactory _httpClientFactory = httpClientFactory;
        private readonly IMemoryCache _memoryCache = memoryCache;
        private readonly IHubContext<SessionHub> _hubContext = hubContext;
        private readonly RsaKeyService _rsaService = rsaService;
        public override void OnActionExecuted(ActionExecutedContext context)
        {
            base.OnActionExecuted(context);
            ViewData["Usertype"] = "";
        }

        // JAN PARICHAY SETUP
        public async Task<bool> ValidateToken(UserSignature userSignature)
        {
            var client = _httpClientFactory.CreateClient();
            var clientToken = userSignature.ClientToken; // From payload
            var sessionId = userSignature.SessionId; // From payload (Post Login Session Id)
            var browserId = userSignature.BrowserId; // From payload

            // PDF Page 10: Include sessionId & browserId from cookies if set, fallback to payload
            var cookieSessionId = HttpContext.Request.Cookies["SessionId"];
            var cookieBrowserId = HttpContext.Request.Cookies["BrowserId"];
            if (!string.IsNullOrEmpty(cookieSessionId)) sessionId = cookieSessionId;
            if (!string.IsNullOrEmpty(cookieBrowserId)) browserId = cookieBrowserId;

            var url = $"{_configuration["JanParichay:ClientBaseUrl"]}/isTokenValid?" +
                      $"clientToken={clientToken!}" +
                      $"&sid={_configuration["JanParichay:ServiceId"]}" +
                      $"&sessionId={sessionId!}" +
                      $"&browserId={browserId!}";

            var response = await client.GetAsync(url);
            if (!response.IsSuccessStatusCode) return false;

            var json = await response.Content.ReadAsStringAsync();
            var result = JsonConvert.DeserializeObject<Dictionary<string, string>>(json);
            return result?["tokenValid"] == "true";
        }

        [HttpGet]
        public IActionResult GetPublicKey()
        {
            return Ok(new
            {
                publicKey = _rsaService.GetPublicKeyPem(),
                keyId = Guid.NewGuid().ToString("N")[..8]
            });
        }


        private static string GenerateOTP(int length)
        {
            var random = new Random();
            string otp = string.Empty;

            for (int i = 0; i < length; i++)
            {
                otp += random.Next(0, 10).ToString();
            }

            return otp;
        }
        private static bool IsStrongPassword(string password, IConfiguration config, out string? errorMessage)
        {
            errorMessage = null;

            if (string.IsNullOrEmpty(password))
            {
                errorMessage = "Password is required.";
                return false;
            }

            var policy = config.GetSection("PasswordPolicy");
            int minLen = policy.GetValue<int>("MinLength", 8);
            bool requireUpper = policy.GetValue<bool>("RequireUppercase", true);
            bool requireLower = policy.GetValue<bool>("RequireLowercase", true);
            bool requireDigit = policy.GetValue<bool>("RequireDigit", true);
            bool requireSpecial = policy.GetValue<bool>("RequireSpecialChar", true);

            // 1. Minimum length
            if (password.Length < minLen)
            {
                errorMessage = $"Password must be at least {minLen} characters.";
                return false;
            }

            // 2. Maximum length (prevent DoS)
            if (password.Length > 128)
            {
                errorMessage = "Password must not exceed 128 characters.";
                return false;
            }

            // 3. Uppercase
            if (requireUpper && !password.Any(char.IsUpper))
            {
                errorMessage = "Password must contain at least one uppercase letter.";
                return false;
            }

            // 4. Lowercase
            if (requireLower && !password.Any(char.IsLower))
            {
                errorMessage = "Password must contain at least one lowercase letter.";
                return false;
            }

            // 5. Digit
            if (requireDigit && !password.Any(char.IsDigit))
            {
                errorMessage = "Password must contain at least one digit.";
                return false;
            }

            // 6. Special character
            if (requireSpecial && !password.Any(ch => !char.IsLetterOrDigit(ch)))
            {
                errorMessage = "Password must contain at least one special character.";
                return false;
            }

            // 7. No whitespace
            if (password.Any(char.IsWhiteSpace))
            {
                errorMessage = "Password must not contain spaces.";
                return false;
            }

            // 8. Common/generic passwords
            var lower = password.ToLowerInvariant();
            var commonPasswords = new[] {
        "password", "123456", "admin", "user", "login", "welcome",
        "password123", "admin123", "user123", "login123", "welcome123",
        "admin@123", "qwerty", "abc123", "letmein", "monkey", "dragon"
    };
            if (commonPasswords.Any(common => lower.Contains(common)))
            {
                errorMessage = "This password is too common. Please choose a stronger password.";
                return false;
            }

            // 9. Repeated characters
            if (Regex.IsMatch(password, @"(\d)\1{2,}"))
            {
                errorMessage = "Password must not contain 3 or more repeated digits.";
                return false;
            }
            if (Regex.IsMatch(password, @"(.)\1{3,}"))
            {
                errorMessage = "Password must not contain 4 or more repeated characters.";
                return false;
            }

            // 10. Sequential characters
            const string sequences = "abcdefghijklmnopqrstuvwxyz0123456789qwertyuiopasdfghjklzxcvbnm";
            for (int i = 0; i <= lower.Length - 4; i++)
            {
                var substring = lower.Substring(i, 4);
                if (sequences.Contains(substring) || sequences.Contains(new string(substring.Reverse().ToArray())))
                {
                    errorMessage = "Password must not contain sequential characters (e.g., 'abcd', '1234', 'qwerty').";
                    return false;
                }
            }

            return true;
        }

        public IActionResult Index()
        {
            return View();
        }

        static string GetShortTitleFromRole(string role)
        {
            if (string.IsNullOrWhiteSpace(role))
                return "Unknown";

            var words = role.Split(' ', StringSplitOptions.RemoveEmptyEntries);
            return string.Concat(words.Select(w => char.ToUpper(w[0])));
        }

        [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
        public IActionResult Error()
        {
            return View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
        }
    }
}
