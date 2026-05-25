public class SecurityMiddleware
{
    private readonly RequestDelegate _next;
    private readonly IConfiguration _config;

    public SecurityMiddleware(RequestDelegate next, IConfiguration config)
    {
        _next = next;
        _config = config;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        // 1. Host Header Injection protection
        var allowedHosts = _config.GetSection("AllowedHosts").Get<string[]>()
            ?? new[] { "10.148.2.25", "localhost" };

        var requestHost = context.Request.Host.Host;
        if (!allowedHosts.Contains(requestHost, StringComparer.OrdinalIgnoreCase))
        {
            context.Response.StatusCode = 400;
            await context.Response.WriteAsync("Invalid Host header");
            return;
        }

        // 2. Security Headers
        context.Response.Headers["X-Frame-Options"] = "DENY";
        context.Response.Headers["X-Content-Type-Options"] = "nosniff";
        // REMOVED: X-XSS-Protection (deprecated, CSP replaces it)
        context.Response.Headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
        context.Response.Headers["Permissions-Policy"] =
            "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()";

        // 3. CSP - Hardened for React/Webpack staging
        var stagingHost = _config["StagingHost"] ?? "10.148.2.25";

        context.Response.Headers.ContentSecurityPolicy =
            "default-src 'self'; " +
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://translate.google.com https://translate.googleapis.com; " +
            "style-src 'self' 'unsafe-inline'; " +
            "img-src 'self' data: blob:; " +
            "font-src 'self'; " +
            $"connect-src 'self' http://{stagingHost}; " +
            "frame-ancestors 'none'; " +
            "base-uri 'self'; " +
            "form-action 'self';";

        // 4. Block standalone OPTIONS (keep your existing logic)
        if (context.Request.Method == "OPTIONS" && !context.Request.Headers.ContainsKey("Origin"))
        {
            context.Response.StatusCode = 405;
            return;
        }

        // 5. Remove server fingerprinting (add if not done elsewhere)
        context.Response.Headers.Remove("Server");
        context.Response.Headers.Remove("X-Powered-By");

        await _next(context);
    }
}