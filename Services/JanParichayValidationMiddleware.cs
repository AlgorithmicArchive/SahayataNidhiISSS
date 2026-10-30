using System.Collections.Concurrent;
using System.Security.Claims;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;

public class JanParichayValidationMiddleware(RequestDelegate next, ILogger<JanParichayValidationMiddleware> logger, IConfiguration configuration)
{
    private readonly RequestDelegate _next = next;
    private readonly ILogger<JanParichayValidationMiddleware> _logger = logger;
    private readonly IConfiguration _configuration = configuration;
    private static readonly ConcurrentDictionary<Guid, SemaphoreSlim> _sessionLocks = new();

    public async Task InvokeAsync(HttpContext context, SessionRepository sessionRepo, IHttpClientFactory httpClientFactory)
    {
        var path = context.Request.Path.Value?.ToLower() ?? "";
        if (path.StartsWith("/assets/") || path.StartsWith("/static/") ||
            path.EndsWith(".js") || path.EndsWith(".css") || path.EndsWith(".png") ||
            path.EndsWith(".jpg") || path == "/")
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
                        _logger.LogWarning("JanParichay token invalid for {SessionId} - performing full logout", sessionId);
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
            }
        }
        await _next(context);
    }

    private async Task PerformLogoutAsync(HttpContext context, SessionRepository sessionRepo, Guid sessionId, string clientToken, IHttpClientFactory httpClientFactory)
    {
        try { await sessionRepo.DeleteSessionById(sessionId); }
        catch (DbUpdateConcurrencyException) { _logger.LogWarning("Session {SessionId} was already deleted", sessionId); }

        context.Response.Cookies.Delete("ClientToken");
        context.Response.Cookies.Delete("SessionId");
        context.Response.Cookies.Delete("BrowserId");
        context.Response.Cookies.Delete("PostLoginSessionId");

        var cookieSessionId = context.Request.Cookies["SessionId"] ?? context.Request.Cookies["PostLoginSessionId"];
        var browserId = context.Request.Cookies["BrowserId"] ?? "unknown";
        var sid = _configuration["JanParichay:ServiceId"];
        var userAgent = context.Request.Headers["User-Agent"].ToString();

        if (!string.IsNullOrEmpty(clientToken) && !string.IsNullOrEmpty(cookieSessionId) && !string.IsNullOrEmpty(sid))
        {
            try
            {
                var tid = DateTimeOffset.Now.ToUnixTimeMilliseconds().ToString();
                var baseUrl = _configuration["JanParichay:ClientBaseUrl"]?.TrimEnd('/');
                if (!string.IsNullOrEmpty(baseUrl))
                {
                    var logoutUrl = $"{baseUrl}/logout?clientToken={Uri.EscapeDataString(clientToken)}&sid={sid}&sessionId={cookieSessionId}&browserId={browserId}&ua={Uri.EscapeDataString(userAgent)}&tid={tid}";

                    var client = httpClientFactory.CreateClient();
                    // FIX: Use CancellationToken instead of client.Timeout to avoid pooling bugs
                    using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
                    await client.GetAsync(logoutUrl, cts.Token);
                }
            }
            catch (OperationCanceledException) { _logger.LogWarning("JanParichay logout timed out for session {SessionId}", sessionId); }
            catch (Exception ex) { _logger.LogError(ex, "Failed to call JanParichay logout for session {SessionId}", sessionId); }
        }
    }

    // OPTIMIZATION: Strongly typed record for JSON deserialization
    private record JanParichayResponse(string? Status, string? TokenValid);

    private async Task<bool> ValidateWithJanParichayAsync(string clientToken, string sessionId, string browserId, string sid, IHttpClientFactory httpClientFactory)
    {
        try
        {
            var baseUrl = _configuration["JanParichay:ClientBaseUrl"]?.TrimEnd('/');
            if (string.IsNullOrEmpty(baseUrl)) return false; // Fail closed if not configured

            var url = $"{baseUrl}/isTokenValid?clientToken={Uri.EscapeDataString(clientToken)}&sessionId={Uri.EscapeDataString(sessionId)}&browserId={Uri.EscapeDataString(browserId)}&sid={Uri.EscapeDataString(sid)}";

            var client = httpClientFactory.CreateClient();
            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(10));

            var response = await client.GetAsync(url, cts.Token);
            if (!response.IsSuccessStatusCode) return false; // Fail closed on HTTP errors

            var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
            var result = await response.Content.ReadFromJsonAsync<JanParichayResponse>(options, cts.Token);

            if (result == null) return false;

            return result.Status?.Equals("success", StringComparison.OrdinalIgnoreCase) == true &&
                   result.TokenValid?.Equals("true", StringComparison.OrdinalIgnoreCase) == true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "JanParichay validation exception");
            return false; // SECURITY FIX: Fail closed on exceptions
        }
    }
}