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
        // 1. Host Header Injection protection (Issue #1)
        var allowedHosts = _config.GetSection("AllowedHosts").Get<string[]>()
            ?? new[] { "10.148.2.25", "localhost", "yourdomain.com" };
        var requestHost = context.Request.Host.Host;
        if (!allowedHosts.Contains(requestHost, StringComparer.OrdinalIgnoreCase))
        {
            context.Response.StatusCode = 400;
            await context.Response.WriteAsync("Invalid Host header");
            return;
        }

        // 2. Security Headers (Issues #7, #8, #11)
        context.Response.Headers.Append("X-Frame-Options", "DENY");
        context.Response.Headers.Append("X-Content-Type-Options", "nosniff");
        context.Response.Headers.Append("X-XSS-Protection", "1; mode=block");
        context.Response.Headers.Append("Referrer-Policy", "strict-origin-when-cross-origin");
        context.Response.Headers.Append("Permissions-Policy", "geolocation=(), microphone=(), camera=()");

        // 3. Content-Security-Policy (Issue #8) – adjust for React
        context.Response.Headers.Append("Content-Security-Policy",
            "default-src 'self'; " +
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://trusted.cdn.com; " +
            "style-src 'self' 'unsafe-inline'; " +
            "img-src 'self' data:; " +
            "frame-ancestors 'none';");

        // 4. Block OPTIONS method unless it's a CORS preflight (Issue #9)
        if (context.Request.Method == "OPTIONS" && !context.Request.Headers.ContainsKey("Origin"))
        {
            context.Response.StatusCode = 405;
            return;
        }

        await _next(context);
    }
}