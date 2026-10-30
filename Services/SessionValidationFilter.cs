using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;

public class SessionValidationFilter : IAsyncAuthorizationFilter
{
    private readonly SessionRepository _sessionRepo;
    private readonly ILogger<SessionValidationFilter> _logger;
    private readonly IMemoryCache _cache;

    public SessionValidationFilter(SessionRepository sessionRepo, ILogger<SessionValidationFilter> logger, IMemoryCache cache)
    {
        _sessionRepo = sessionRepo;
        _logger = logger;
        _cache = cache;
    }

    public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
    {
        // NOTE: previously written as `!context.HttpContext.User.Identity?.IsAuthenticated == true`,
        // which only worked because `!` binds tighter than `==` - correct by accident, and one
        // edit away from silently skipping the session check. Made explicit below.
        if (context.HttpContext.User.Identity?.IsAuthenticated != true)
            return;

        var sessionIdClaim = context.HttpContext.User.FindFirst("SessionId")?.Value;
        if (string.IsNullOrEmpty(sessionIdClaim) || !Guid.TryParse(sessionIdClaim, out Guid sessionId))
        {
            context.Result = new UnauthorizedResult();
            return;
        }

        var cacheKey = $"session_exists_{sessionId}";

        // OPTIMIZATION: Cache DB lookup for 2 minutes to prevent DB spamming
        if (!_cache.TryGetValue(cacheKey, out bool exists))
        {
            exists = await _sessionRepo.SessionExists(sessionId);
            _cache.Set(cacheKey, exists, TimeSpan.FromMinutes(2));
        }

        if (!(bool)exists!)
        {
            _logger.LogInformation("Session {SessionId} no longer exists", sessionId);
            context.Result = new UnauthorizedResult();
        }
    }
}