using System.Dynamic;
using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Security.Claims;
using System.Text;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http.Extensions;   // <-- NEW (GetDisplayUrl)
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;          // <-- NEW (FromSqlRaw)
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;

using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

using Npgsql;
using UAParser;

using SahayataNidhi.Models.Entities;
using SendEmails;

using JsonSerializer = System.Text.Json.JsonSerializer;

namespace SahayataNidhi.Controllers
{
    public partial class HomeController
    {

        private static bool IsBrowserNavigation(HttpRequest request)
        {
            // 1. Modern browsers (Chrome 76+, Firefox 90+, Safari 16.4+, Edge 79+)
            var secFetchMode = request.Headers["Sec-Fetch-Mode"].ToString();
            if (!string.IsNullOrEmpty(secFetchMode))
                return string.Equals(secFetchMode, "navigate", StringComparison.OrdinalIgnoreCase);

            // 2. Explicit XHR marker (axios sets this by default; fetch does not)
            if (string.Equals(request.Headers["X-Requested-With"].ToString(),
                              "XMLHttpRequest", StringComparison.OrdinalIgnoreCase))
                return false;

            // 3. Fallback: navigation requests ask for HTML
            var accept = request.Headers["Accept"].ToString();
            return accept.Contains("text/html", StringComparison.OrdinalIgnoreCase);
        }

        [HttpGet]
        public async Task<IActionResult> InitiateSSO()
        {
            try
            {
                var clientSessionId = Guid.NewGuid().ToString("N");
                var sid = _configuration["JanParichay:ServiceId"]!;
                var tid = DateTimeOffset.Now.ToUnixTimeMilliseconds();
                var baseUrl = _configuration["JanParichay:JanParichayBaseUrl"]!.TrimEnd('/');

                var encryptedClientSessionId = await _helper.EncryptStringAsync(clientSessionId);
                var loginUrl = $"{baseUrl}/v1/api/login";
                var hmacInput = $"JanParichay{tid}{loginUrl}{sid}";
                var clientSignature = await _helper.GetHmacSignatureAsync(hmacInput);

                var redirectUrl = $"{baseUrl}/v1/api/login?" +
                                  $"sid={sid}" +
                                  $"&tid={tid}" +
                                  $"&cs={clientSignature}" +
                                  $"&string={encryptedClientSessionId}";

                _logger.LogInformation("Redirecting to JanParichay: {Url}", redirectUrl);
                return Json(new { redirectUrl });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "InitiateSSO failed");
                return StatusCode(500, new { error = "SSO initiation failed", details = ex.Message });
            }
        }


        public async Task<IActionResult> SSOCallback([FromQuery] string @string)
        {
            var fullUrl = Request.GetDisplayUrl();
            _logger.LogInformation("=== JAN PARICHAY CALLBACK START ===");
            _logger.LogInformation("Full URL: {FullUrl}", fullUrl);
            _logger.LogInformation("Raw @string: '{String}' (Length: {Len})", @string ?? "NULL", @string?.Length ?? 0);
            _logger.LogInformation("All Query Params: {@Query}", Request.Query.ToDictionary(k => k.Key, v => v.Value.ToString()));

            if (string.IsNullOrEmpty(@string))
            {
                _logger.LogError("MISSING HANDSHAKING ID â€” Jan Parichay did NOT send ?string=");
                return BadRequest(new { status = false, response = "Missing handshaking ID" });
            }

            if (@string.Length < 100 || @string.Length > 1000)
            {
                _logger.LogWarning("SUSPICIOUS HANDSHAKING ID LENGTH: {Len} chars", @string.Length);
            }

            _logger.LogInformation("VALID HANDSHAKING ID RECEIVED: {Len} chars", @string.Length);

            try
            {
                var sid = _configuration["JanParichay:ServiceId"]!;
                var clientBaseUrl = _configuration["JanParichay:ClientBaseUrl"]!.TrimEnd('/');
                var frontendUrl = _configuration["AppSettings:FrontendUrl"] ?? "http://localhost:3000";

                var handshakeUrl = $"{clientBaseUrl}/handshake?handshakingId={@string}&sid={sid}";
                _logger.LogInformation("Calling Handshake API: {HandshakeUrl}", handshakeUrl);
                var client = _httpClientFactory.CreateClient();
                var response = await client.GetAsync(handshakeUrl);
                _logger.LogInformation("Handshake Response Status: {StatusCode}", response.StatusCode);

                if (response.StatusCode != HttpStatusCode.OK)
                {
                    var error = await response.Content.ReadAsStringAsync();
                    _logger.LogError("HANDSHAKE FAILED: {Status} | Response: {Error}", response.StatusCode, error);
                    return StatusCode(500, new { status = false, response = "Handshake failed", details = error });
                }

                var encryptedPayload = await response.Content.ReadAsStringAsync();
                _logger.LogInformation("Encrypted Payload: '{Payload}' (Length: {Len})", encryptedPayload, encryptedPayload.Length);

                if (encryptedPayload == "false")
                {
                    _logger.LogError("INVALID HANDSHAKING ID â€” Jan Parichay returned 'false'");
                    return Unauthorized(new { status = false, response = "Invalid handshaking ID" });
                }

                _logger.LogInformation("Decrypting payload...");
                var janUser = await _helper.DecryptStringAsync(encryptedPayload);
                _logger.LogInformation("Decryption SUCCESS. User: {Userid}", janUser.UserId);

                if (janUser?.ClientToken == null)
                {
                    _logger.LogError("DECRYPTED DATA MISSING ClientToken");
                    return BadRequest(new { status = false, response = "Invalid user data" });
                }

                var isValid = await ValidateToken(janUser);
                if (!isValid)
                {
                    _logger.LogWarning("TOKEN VALIDATION FAILED");
                    return Unauthorized(new { status = false, response = "Token validation failed" });
                }

                var janUserJson = JsonSerializer.Serialize(janUser, new System.Text.Json.JsonSerializerOptions
                {
                    WriteIndented = true,
                    PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase
                });

                _logger.LogInformation("COMPLETE JAN USER JSON: {JanUserJson}", janUserJson);

                var localUser = await _helper.FindOrCreateJanParichayUser(janUser);
                if (localUser == null)
                {
                    _logger.LogError("USER CREATION FAILED");
                    return Redirect($"{frontendUrl}");
                    // return StatusCode(500, new { status = false, response = "User creation failed" });
                }

                localUser.Usertype = char.ToUpper(localUser.Usertype![0])
                     + localUser.Usertype[1..];

                // Generate ONE sessionId
                var sessionId = Guid.NewGuid();

                // Pass it to GenerateJwt
                var jwt = _helper.GenerateJwt(localUser, janUser.ClientToken, sessionId);

                // Create session with THE SAME sessionId
                var newSession = new Usersessions
                {
                    Sessionid = sessionId,
                    Userid = localUser.Userid,
                    Jwttoken = jwt,
                    Logintime = DateTime.Now,
                    Lastactivitytime = DateTime.Now
                };

                await _sessionRepo.AddSessionAsync(newSession);

                var cookieOptions = new CookieOptions
                {
                    HttpOnly = true,
                    // SECURITY FIX: was hardcoded `false`, which meant ClientToken and the
                    // session cookies could be sent over plain HTTP even in production.
                    // Ties Secure to the actual request scheme so it's true whenever the
                    // request came in over HTTPS (i.e. always in prod, given
                    // app.UseHttpsRedirection() in Program.cs) while still working for
                    // local HTTP development.
                    Secure = Request.IsHttps,
                    SameSite = SameSiteMode.Lax,
                    Expires = DateTimeOffset.Now.AddHours(12),
                    Path = "/"
                };

                Response.Cookies.Append("ClientToken", janUser.ClientToken, cookieOptions);
                Response.Cookies.Append("SessionId", janUser.SessionId!, cookieOptions);
                Response.Cookies.Append("BrowserId", janUser.BrowserId!, cookieOptions);
                Response.Cookies.Append("PostLoginSessionId", janUser.SessionId!, cookieOptions);

                // Store extra data in cookies instead of session
                Response.Cookies.Append("IdentityProviderIP", janUser?.Ip ?? "", cookieOptions);
                Response.Cookies.Append("ClientIP", HttpContext.Connection.RemoteIpAddress?.ToString() ?? "", cookieOptions);

                var userAgent = HttpContext.Request.Headers.UserAgent.ToString();
                var parser = Parser.GetDefault();
                var clientInfo = parser.Parse(userAgent);

                var browser = clientInfo.Browser.ToString();
                var os = clientInfo.OS.ToString();
                var device = clientInfo.Device.Family;

                Response.Cookies.Append("Browser", browser, cookieOptions);
                Response.Cookies.Append("OS", os, cookieOptions);
                Response.Cookies.Append("Device", string.IsNullOrEmpty(device) ? "Unknown" : device, cookieOptions);


                dynamic ssoResponse = new ExpandoObject();
                ssoResponse.status = true;
                ssoResponse.token = jwt;



                var actualUserType = localUser.Usertype;
                ssoResponse.userType = localUser.Usertype;
                ssoResponse.actualUserType = actualUserType;
                ssoResponse.username = localUser.Username;
                ssoResponse.userId = localUser.Userid;
                ssoResponse.designation = janUser?.Designation ?? "";
                ssoResponse.department = _helper.GetDepartment(localUser);
                ssoResponse.profile = localUser.Profile ?? "/assets/images/profile.jpg";
                ssoResponse.email = janUser?.Email;

                if (localUser.Usertype != "Citizen")
                {
                    // Check if Additionaldetails exists and is not null
                    if (!string.IsNullOrEmpty(localUser.Additionaldetails))
                    {
                        try
                        {
                            var Additionaldetails = JsonConvert.DeserializeObject<dynamic>(localUser.Additionaldetails);

                            // Check if "Validate" property exists and is not null
                            if (Additionaldetails != null && Additionaldetails!.Validate != null)
                            {
                                // Try to parse as bool, default to false if parsing fails
                                bool isValidated = false;
                                bool.TryParse(Additionaldetails!.Validate.ToString(), out isValidated);

                                if (!isValidated)
                                {
                                    ssoResponse.userType = "Citizen";
                                }
                            }
                        }
                        catch (Exception ex)
                        {
                            _logger.LogWarning(ex, "Failed to parse Additionaldetails for user {Userid}", localUser.Userid);
                            // If parsing fails, treat as unvalidated Citizen
                            ssoResponse.userType = "Citizen";
                        }
                    }
                    else
                    {
                        // If Additionaldetails is null/empty, treat as unvalidated Citizen
                        ssoResponse.userType = "Citizen";
                    }
                }

                var encoded = JsonSerializer.Serialize(ssoResponse);
                _logger.LogInformation("REDIRECTING TO FRONTEND: {Url}", $"{frontendUrl}?sso={encoded}");
                return Redirect($"{frontendUrl}/verification?sso={encoded}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "SSOCALLBACK CRASHED â€” Handshaking ID: {Id}", @string);
                return StatusCode(500, new { status = false, response = "SSO processing failed", details = ex.Message });
            }
        }


        [HttpGet]
        [EnableRateLimiting("AuthEndpoints")]
        public async Task<IActionResult> SendLoginOtp(string? username)
        {
            string otpKey = $"otp:{username}";
            string otp = GenerateOTP(7);
            _otpStore.StoreOtp(otpKey, otp);

            string? email = _dbContext.Users.FirstOrDefault(u => u.Username == username)?.Email;

            if (string.IsNullOrEmpty(email))
            {
                return Json(new { status = false, message = "User not found." });
            }

            string htmlMessage = $@"
            <div style='font-family: Arial, sans-serif;'>
                <h2 style='color: #2e6c80;'>Your OTP Code</h2>
                <p>Use the following One-Time Password (OTP) to complete your verification. It is valid for <strong>5 minutes</strong>.</p>
                <div style='font-size: 24px; font-weight: bold; color: #333; margin: 20px 0;'>{otp}</div>
                <p>If you did not request this, please ignore this email.</p>
                <br />
                <p style='font-size: 12px; color: #888;'>Thank you,<br />Your Application Team</p>
            </div>";

            try
            {
                await _emailSender.SendEmail(email, "OTP For Login", htmlMessage);
            }
            catch (Exception? ex)
            {
                _logger.LogInformation($"---{otp}--");
                return Json(new { status = true, message = $"Email and Mobile OTP sending is not working." });
            }
            return Json(new { status = true });
        }

        private string MaskUsername(string username)
        {
            if (string.IsNullOrEmpty(username) || username.Length <= 6)
                return username;
            return $"{username.Substring(0, 3)}***{username.Substring(username.Length - 3)}";
        }

        [HttpPost]
        [EnableRateLimiting("AuthEndpoints")]
        public IActionResult OTPValidation([FromForm] string? email, [FromForm] string? mobile, [FromForm] string otp)
        {
            if (string.IsNullOrEmpty(email) && string.IsNullOrEmpty(mobile))
            {
                return Json(new { status = false, message = "Either email or mobile is required." });
            }

            if (!string.IsNullOrEmpty(email) && !string.IsNullOrEmpty(mobile))
            {
                return Json(new { status = false, message = "Please provide only one: email or mobile, not both." });
            }

            if (string.IsNullOrEmpty(otp))
            {
                return Json(new { status = false, message = "OTP is required." });
            }

            string otpKey = !string.IsNullOrEmpty(email) ? $"otp:email:{email}" : $"otp:mobile:{mobile}";
            string? storedOtp = _otpStore.RetrieveOtp(otpKey);

            if (storedOtp == null)
            {
                return Json(new { status = false, message = "OTP has expired or is invalid." });
            }

            if (storedOtp != otp)
            {
                return Json(new { status = false, message = "Invalid OTP." });
            }

            return Json(new { status = true, message = "OTP validated successfully." });
        }

        [HttpPost]
        [EnableRateLimiting("AuthEndpoints")]
        public async Task<IActionResult> Login([FromForm] IFormCollection form)
        {
            var encryptedUsername = form["username"].ToString();
            var encryptedPassword = form["password"].ToString();


            var username = _rsaService.Decrypt(encryptedUsername);  // Add this
                                                                    // DEBUG: Log what we received

            // Check if it looks like base64
            if (string.IsNullOrEmpty(encryptedPassword) || encryptedPassword.Length < 100)
            {
                return Json(new { status = false, response = "Encryption failed. Password too short or empty." });
            }
            string password;
            try
            {
                password = _rsaService.Decrypt(encryptedPassword);
            }
            catch (FormatException)
            {
                return Json(new { status = false, response = "Invalid encryption format." });
            }
            catch (Exception)
            {
                return Json(new { status = false, response = "Decryption failed." });
            }


            // 1. Check lockout from cache
            string lockoutKey = $"Lockout_{username}";
            if (_memoryCache.TryGetValue(lockoutKey, out DateTime lockoutEnd))
            {
                var remainingMinutes = (lockoutEnd - DateTime.Now).Minutes;
                return Json(new { status = false, response = $"Account locked. Try again after {remainingMinutes} minutes." });
            }

            var usernameParam = new NpgsqlParameter("p_username", username);
            var passwordParam = !string.IsNullOrEmpty(password)
                ? new NpgsqlParameter("p_password", password)
                : new NpgsqlParameter("p_password", DBNull.Value);

            var user = await _dbContext.Users
                .FromSqlRaw("SELECT * FROM userlogin({0}, {1})", usernameParam.Value, passwordParam.Value)
                .AsNoTracking()
                .FirstOrDefaultAsync();

            if (user == null)
            {
                string failKey = $"FailCount_{username}";
                int failCount = _memoryCache.TryGetValue(failKey, out int count) ? count : 0;
                failCount++;

                if (failCount >= 5)
                {
                    _memoryCache.Set(lockoutKey, DateTime.Now.AddMinutes(15), TimeSpan.FromMinutes(15));
                    _memoryCache.Remove(failKey);
                    return Json(new { status = false, response = "Too many failed attempts. Account locked for 15 minutes." });
                }
                else
                {
                    _memoryCache.Set(failKey, failCount, TimeSpan.FromMinutes(15));
                    return Json(new { status = false, response = "Invalid Username or Password." });
                }
            }

            _memoryCache.Remove($"FailCount_{username}");
            _memoryCache.Remove(lockoutKey);

            if (!user.Isemailvalid)
                return Json(new { status = false, response = "Email Not Verified.", isEmailVerified = false, email = user.Email });

            // ðŸ” CONCURRENT LOGIN FIX: Notify existing sessions then delete
            var existingSessions = await _dbContext.Usersessions
                .Where(s => s.Userid == user.Userid)
                .ToListAsync();

            if (existingSessions.Any())
            {
                // Notify all existing sessions to logout immediately via SignalR
                await _hubContext.Clients.Group($"user_{user.Userid}")
                    .SendAsync("ForceLogout", new
                    {
                        reason = "concurrent_login",
                        message = "Your session was terminated because another login was detected.",
                        terminatedAt = DateTime.UtcNow
                    });

                // Allow time for SignalR message delivery before DB deletion
                await Task.Delay(500);

                // Delete all old sessions
                _dbContext.Usersessions.RemoveRange(existingSessions);
                await _dbContext.SaveChangesAsync();
            }

            _logger.LogInformation($"User {user.Username} ({user.Userid}) is attempting to log in.");

            var actualUserType = user.Usertype;
            var displayedUserType = user.Usertype;

            string designation = "";
            string department = "";

            if (user.Usertype == "Officer" || user.Usertype == "Admin")
            {
                if (!string.IsNullOrWhiteSpace(user.Additionaldetails))
                {
                    try
                    {
                        var details = JsonConvert.DeserializeObject<Dictionary<string, JToken>>(user.Additionaldetails);
                        if (details != null)
                        {
                            if (details.TryGetValue("Validate", out var validatedToken) && !validatedToken.Value<bool>())
                            {
                                displayedUserType = "Citizen";
                            }

                            if (details.TryGetValue("Role", out var roleToken))
                            {
                                designation = roleToken.ToString();
                            }

                            if (user.Usertype == "Admin" && details.TryGetValue("Department", out var deptToken))
                            {
                                if (int.TryParse(deptToken.ToString(), out int deptId))
                                {
                                    department = _dbContext.Departments
                                                    .FirstOrDefault(d => d.Departmentid == deptId)?
                                                    .Departmentname ?? "";
                                }
                            }
                        }
                    }
                    catch { /* ignore JSON errors */ }
                }
            }

            // Prepare claims
            var claims = new List<Claim>
            {
                new(ClaimTypes.NameIdentifier, user.Userid.ToString()),
                new(ClaimTypes.Name,           user.Username!),
                new(ClaimTypes.Role,           displayedUserType!),
                new("Profile",                 user.Profile!)
            };

            if (!string.IsNullOrEmpty(designation))
                claims.Add(new Claim("Designation", designation));

            // Generate a new session ID
            var sessionId = Guid.NewGuid();
            claims.Add(new Claim("SessionId", sessionId.ToString()));

            _logger.LogInformation("Added SessionId claim to JWT: {SessionId}", sessionId);

            // Create JWT token
            var key = Encoding.ASCII.GetBytes(_configuration["JWT:Secret"]!);
            var tokenDescriptor = new SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(claims),
                SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature),
                Issuer = _configuration["JWT:Issuer"],
                Audience = _configuration["JWT:Audience"]
            };

            var token = new JwtSecurityTokenHandler().CreateToken(tokenDescriptor);
            var tokenString = new JwtSecurityTokenHandler().WriteToken(token);

            // Create new session record in database
            var newSession = new Usersessions
            {
                Sessionid = sessionId,
                Userid = user.Userid,
                Jwttoken = tokenString,
                Logintime = DateTime.Now,
                Lastactivitytime = DateTime.Now
            };

            await _sessionRepo.AddSessionAsync(newSession);
            _auditService.InsertLog(HttpContext, "Login", "User logged in.", user.Userid, "Success");

            return Json(new
            {
                status = true,
                token = tokenString,
                userType = displayedUserType,
                actualUserType = actualUserType,
                profile = user.Profile,
                username = user.Username,
                userId = user.Userid,
                designation,
                department
            });
        }

        [HttpGet]
        [Authorize]
        public IActionResult RefreshToken()
        {
            var username = User.FindFirst(ClaimTypes.Name)?.Value;
            var user = _dbContext.Users.FirstOrDefault(u => u.Username == username);
            if (user == null)
                return Unauthorized(new { status = false, message = "User not found." });

            var claims = User.Claims.Select(c => new Claim(c.Type, c.Value)).ToList();
            var jwtSecretKey = _configuration["JWT:Secret"];
            var key = Encoding.ASCII.GetBytes(jwtSecretKey!);

            var tokenHandler = new JwtSecurityTokenHandler();
            var tokenDescriptor = new SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(claims),
                SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature),
                Issuer = _configuration["JWT:Issuer"],
                Audience = _configuration["JWT:Audience"],
                Expires = DateTime.Now.AddMinutes(30)
            };

            var token = tokenHandler.CreateToken(tokenDescriptor);
            var tokenString = tokenHandler.WriteToken(token);

            return Json(new
            {
                status = true,
                token = tokenString,
                userType = user.Usertype ?? "",
                profile = user.Profile ?? "",
                username = username ?? "",
                designation = User.FindFirst("Designation")?.Value ?? ""
            });
        }

        [HttpGet]
        [Authorize]
        public IActionResult KeepAlive()
        {
            var username = User.FindFirst(ClaimTypes.Name)?.Value;
            var user = _dbContext.Users.FirstOrDefault(u => u.Username == username);
            if (user == null)
                return Unauthorized(new { status = false, message = "User not found." });

            var claims = User.Claims.Select(c => new Claim(c.Type, c.Value)).ToList();
            var jwtSecretKey = _configuration["JWT:Secret"];
            var key = Encoding.ASCII.GetBytes(jwtSecretKey!);

            var tokenHandler = new JwtSecurityTokenHandler();
            var tokenDescriptor = new SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(claims),
                SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature),
                Issuer = _configuration["JWT:Issuer"],
                Audience = _configuration["JWT:Audience"],
                Expires = DateTime.Now.AddHours(24)
            };

            var token = tokenHandler.CreateToken(tokenDescriptor);
            var tokenString = tokenHandler.WriteToken(token);

            return Json(new
            {
                status = true,
                token = tokenString,
                userType = user.Usertype ?? "",
                profile = user.Profile ?? "",
                username = username ?? "",
                designation = User.FindFirst("Designation")?.Value ?? ""
            });
        }

        [HttpGet]
        [Authorize]
        public IActionResult ValidateJWTToken()
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var username = User.FindFirst(ClaimTypes.Name)?.Value;
            var userType = User.FindFirst(ClaimTypes.Role)?.Value;
            var profile = User.FindFirst("Profile")?.Value;
            var designation = User.FindFirst("Designation")?.Value;

            return Json(new
            {
                status = true,
                userId,
                username,
                userType,
                profile,
                designation
            });
        }

        [HttpPost]
        [Authorize]
        public async Task<IActionResult> Logout()
        {
            try
            {
                // Get current user ID from JWT claims
                var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                int? userId = null;
                if (!string.IsNullOrEmpty(userIdClaim))
                    userId = Convert.ToInt32(userIdClaim);

                // Get SessionId from JWT claim and delete that session
                var sessionIdClaim = User.FindFirst("SessionId")?.Value;
                if (!string.IsNullOrEmpty(sessionIdClaim) && Guid.TryParse(sessionIdClaim, out Guid sessionIdFromClaim))
                {
                    await _sessionRepo.DeleteSessionById(sessionIdFromClaim);
                }
                else if (userId.HasValue)
                {
                    // Fallback: if no SessionId claim, delete all sessions for this user
                    await _sessionRepo.DeleteSessionsByUser(userId.Value);
                }

                // Get JanParichay tokens from cookies
                var clientToken = Request.Cookies["ClientToken"];
                var cookieSessionId = Request.Cookies["SessionId"] ?? Request.Cookies["PostLoginSessionId"];
                var browserId = Request.Cookies["BrowserId"];
                var sid = _configuration["JanParichay:ServiceId"]!;
                var userAgent = Request.Headers["User-Agent"].ToString();
                var tid = DateTimeOffset.Now.ToUnixTimeMilliseconds().ToString();

                // Delete cookies
                // Workaround for .NET 10 IResponseCookies.Delete(string) overload resolution issue.
                // Appending with an expired date has the same client-side effect: the browser
                // drops the cookie immediately.
                static void ExpireCookie(HttpResponse response, string name)
                {
                    response.Cookies.Append(name, "", new CookieOptions
                    {
                        Expires = DateTimeOffset.UnixEpoch,
                        Path = "/",
                        HttpOnly = true,
                        Secure = response.HttpContext.Request.IsHttps,
                        SameSite = SameSiteMode.Lax
                    });
                }

                // inside Logout():
                ExpireCookie(Response, "ClientToken");
                ExpireCookie(Response, "SessionId");
                ExpireCookie(Response, "BrowserId");
                ExpireCookie(Response, "PostLoginSessionId");

                // Handle SSO logout if needed
                if (!string.IsNullOrEmpty(clientToken)
                    && !string.IsNullOrEmpty(cookieSessionId)
                    && !string.IsNullOrEmpty(browserId))
                {
                    var logoutUrl = _helper.GetJanParichayLogoutUrl(
                        clientToken,
                        cookieSessionId,
                        browserId,
                        sid,
                        userAgent,
                        tid
                    );

                    _auditService.InsertLog(
                        HttpContext,
                        "Logout",
                        "User logged out via JanParichay.",
                        userId,
                        "Success"
                    );

                    return Json(new { sso = true, logoutUrl });
                }

                _auditService.InsertLog(
                    HttpContext,
                    "Logout",
                    "User logged out (non-SSO).",
                    userId,
                    "Success"
                );

                return Redirect("/");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Logout failed");
                return Redirect("/");
            }
        }

    }
}
