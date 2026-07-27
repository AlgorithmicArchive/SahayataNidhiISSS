using System.Collections.Concurrent;
using System.Security.Claims;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;

public class JanParichayValidationMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<JanParichayValidationMiddleware> _logger;
    private readonly IConfiguration _configuration;
    private static readonly ConcurrentDictionary<Guid, SemaphoreSlim> _sessionLocks = new();

    public JanParichayValidationMiddleware(RequestDelegate next, ILogger<JanParichayValidationMiddleware> logger, IConfiguration configuration)
    {
        _next = next;
        _logger = logger;
        _configuration = configuration;
    }

    public async Task InvokeAsync(HttpContext context, SessionRepository sessionRepo, IHttpClientFactory httpClientFactory)
    {
        var path = context.Request.Path.Value?.ToLower() ?? "";
        if (path.StartsWith("/assets/") ||
            path.StartsWith("/static/") ||
            path.EndsWith(".js") ||
            path.EndsWith(".css") ||
            path.EndsWith(".png") ||
            path.EndsWith(".jpg") ||
            path == "/")
        {
            await _next(context);
            return;
        }

        if (context.User.Identity?.IsAuthenticated == true)
        {
            var sessionIdClaim = context.User.FindFirst("SessionId")?.Value;
            var clientToken = context.User.FindFirst("JanParichayClientToken")?.Value;

            if (!string.IsNullOrEmpty(clientToken) && Guid.TryParse(sessionIdClaim, out var sessionId))
            {
                _logger.LogInformation(">>> MIDDLEWARE CHECK: {Path} - SessionId: {SessionId}", path, sessionId);

                var sessionLock = _sessionLocks.GetOrAdd(sessionId, _ => new SemaphoreSlim(1, 1));

                await sessionLock.WaitAsync();
                try
                {
                    var exists = await sessionRepo.SessionExists(sessionId);
                    if (!exists)
                    {
                        _logger.LogInformation("Session {SessionId} not found - already logged out", sessionId);
                        context.Response.StatusCode = 401;
                        return;
                    }

                    var browserId = context.Request.Cookies["BrowserId"] ?? "unknown";
                    var sid = _configuration["JanParichay:ServiceId"]!;

                    var isValid = await ValidateWithJanParichayAsync(clientToken, sessionIdClaim, browserId, sid, httpClientFactory);

                    if (!isValid)
                    {
                        _logger.LogInformation("JanParichay token invalid for {SessionId} - performing full logout", sessionId);
                        await PerformLogoutAsync(context, sessionRepo, sessionId, clientToken, httpClientFactory);
                        context.Response.StatusCode = 401;
                        return;
                    }
                }
                finally
                {
                    sessionLock.Release();
                    if (sessionLock.CurrentCount == 1)
                        _sessionLocks.TryRemove(sessionId, out _);
                }

                _logger.LogInformation("JanParichay validation passed for {SessionId}", sessionId);
            }
        }

        await _next(context);
    }

    private async Task PerformLogoutAsync(HttpContext context, SessionRepository sessionRepo,
        Guid sessionId, string clientToken, IHttpClientFactory httpClientFactory)
    {
        try
        {
            await sessionRepo.DeleteSessionById(sessionId);
        }
        catch (DbUpdateConcurrencyException)
        {
            _logger.LogWarning("Session {SessionId} was already deleted by another request", sessionId);
        }

        context.Response.Cookies.Delete("ClientToken");
        context.Response.Cookies.Delete("SessionId");
        context.Response.Cookies.Delete("BrowserId");
        context.Response.Cookies.Delete("PostLoginSessionId");

        var cookieSessionId = context.Request.Cookies["SessionId"] ?? context.Request.Cookies["PostLoginSessionId"];
        var browserId = context.Request.Cookies["BrowserId"] ?? "unknown";
        var sid = _configuration["JanParichay:ServiceId"];
        var userAgent = context.Request.Headers["User-Agent"].ToString();

        if (!string.IsNullOrEmpty(clientToken) &&
            !string.IsNullOrEmpty(cookieSessionId) &&
            !string.IsNullOrEmpty(sid))
        {
            try
            {
                var tid = DateTimeOffset.Now.ToUnixTimeMilliseconds().ToString();
                var baseUrl = _configuration["JanParichay:ClientBaseUrl"]?.TrimEnd('/');

                if (!string.IsNullOrEmpty(baseUrl))
                {
                    var logoutUrl = $"{baseUrl}/logout?clientToken={Uri.EscapeDataString(clientToken)}&sid={sid}&sessionId={cookieSessionId}&browserId={browserId}&ua={Uri.EscapeDataString(userAgent)}&tid={tid}";

                    _logger.LogInformation("Calling JanParichay logout: {Url}", logoutUrl);

                    var client = httpClientFactory.CreateClient();
                    client.Timeout = TimeSpan.FromSeconds(5);

                    using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
                    await client.GetAsync(logoutUrl, cts.Token);
                }
            }
            catch (OperationCanceledException)
            {
                _logger.LogWarning("JanParichay logout timed out for session {SessionId}", sessionId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to call JanParichay logout for session {SessionId}", sessionId);
            }
        }
    }

    private async Task<bool> ValidateWithJanParichayAsync(string clientToken, string sessionId, string browserId, string sid, IHttpClientFactory httpClientFactory)
    {
        try
        {
            var baseUrl = _configuration["JanParichay:ClientBaseUrl"]?.TrimEnd('/');
            if (string.IsNullOrEmpty(baseUrl))
            {
                _logger.LogError("JanParichay:ClientBaseUrl not configured");
                return true;
            }

            var url = $"{baseUrl}/isTokenValid?clientToken={clientToken}&sessionId={sessionId}&browserId={browserId}&sid={sid}";
            _logger.LogInformation("Calling JanParichay: {Url}", url);

            var client = httpClientFactory.CreateClient();
            client.Timeout = TimeSpan.FromSeconds(10);

            var response = await client.GetAsync(url);
            _logger.LogInformation("JanParichay response status: {Status}", response.StatusCode);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("JanParichay HTTP {Status} - failing open", response.StatusCode);
                return true;
            }

            var content = await response.Content.ReadAsStringAsync();
            _logger.LogInformation("JanParichay response: {Content}", content);

            var result = JsonSerializer.Deserialize<JsonElement>(content);

            string? status = null;
            string? tokenValid = null;

            if (result.TryGetProperty("status", out var statusElement))
                status = statusElement.GetString()?.ToLower();
            else if (result.TryGetProperty("Status", out statusElement))
                status = statusElement.GetString()?.ToLower();

            if (result.TryGetProperty("tokenValid", out var tokenValidElement))
                tokenValid = tokenValidElement.GetString();
            else if (result.TryGetProperty("TokenValid", out tokenValidElement))
                tokenValid = tokenValidElement.GetString();

            _logger.LogInformation("Parsed: status={Status}, tokenValid={TokenValid}", status, tokenValid);

            if (status == "failure" || tokenValid == "false")
                return false;

            return status == "success" && tokenValid == "true";
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "JanParichay validation exception - failing open");
            return true;
        }
    }
}