using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

public class SessionValidationFilter : IAsyncAuthorizationFilter
{
    private readonly SessionRepository _sessionRepo;
    private readonly ILogger<SessionValidationFilter> _logger;

    public SessionValidationFilter(SessionRepository sessionRepo, ILogger<SessionValidationFilter> logger)
    {
        _sessionRepo = sessionRepo;
        _logger = logger;
    }

    public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
    {
        // Skip if not authenticated
        if (!context.HttpContext.User.Identity?.IsAuthenticated == true)
            return;

        _logger.LogWarning("=== SessionValidationFilter running ===");
        _logger.LogWarning("IsAuthenticated: {IsAuth}", context.HttpContext.User.Identity?.IsAuthenticated);

        var sessionIdClaim = context.HttpContext.User.FindFirst("SessionId")?.Value;
        _logger.LogWarning("SessionId claim: {Claim}", sessionIdClaim);

        if (string.IsNullOrEmpty(sessionIdClaim))
        {
            _logger.LogWarning("SessionId claim missing in JWT");
            context.Result = new UnauthorizedResult();
            return;
        }

        if (!Guid.TryParse(sessionIdClaim, out Guid sessionId))
        {
            _logger.LogWarning("Invalid SessionId format in JWT");
            context.Result = new UnauthorizedResult();
            return;
        }

        var exists = await _sessionRepo.SessionExists(sessionId);
        if (!exists)
        {
            _logger.LogInformation("Session {SessionId} no longer exists (likely replaced by newer login)", sessionId);
            context.Result = new UnauthorizedResult();
            return;
        }
    }
}