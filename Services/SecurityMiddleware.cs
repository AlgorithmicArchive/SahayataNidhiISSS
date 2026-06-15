using System.Security.Cryptography;

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
        context.Response.Headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
        context.Response.Headers["Permissions-Policy"] =
            "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()";

        // 3. CSP - Hardened with nonce
        var stagingHost = _config["StagingHost"] ?? "10.148.2.25";
        var nonce = Convert.ToBase64String(RandomNumberGenerator.GetBytes(16));
        context.Items["CspNonce"] = nonce;

        var env = context.RequestServices.GetRequiredService<IHostEnvironment>();
        var isDev = env.IsDevelopment();

        // Build directives based on environment
        var scriptSrc = isDev
            ? $"script-src 'nonce-{nonce}' 'strict-dynamic' 'self' 'unsafe-eval' http://localhost:5004 https://translate.google.com https://translate.googleapis.com; "
            : $"script-src 'nonce-{nonce}' 'strict-dynamic' 'wasm-unsafe-eval' https://translate.google.com https://translate.googleapis.com; ";

        var styleSrc = "style-src 'self' 'unsafe-inline' https://www.gstatic.com; ";

        var imgSrc = "img-src 'self' data: blob: https://fonts.gstatic.com https://www.google.com https://www.gstatic.com https://translate.googleapis.com; ";

        var connectSrc = isDev
            ? $"connect-src 'self' http://localhost:5004 ws://localhost:5004 wss://localhost:5004 https://translate.googleapis.com; "
            : $"connect-src 'self' http://{stagingHost} https://translate.googleapis.com; ";

        context.Response.Headers.ContentSecurityPolicy =
            "default-src 'self'; " +
            scriptSrc +
            styleSrc +
            imgSrc +
            "font-src 'self'; " +
            connectSrc +
            "frame-ancestors 'none'; " +
            "base-uri 'self'; " +
            "form-action 'self';";

        // 4. Block standalone OPTIONS
        if (context.Request.Method == "OPTIONS" && !context.Request.Headers.ContainsKey("Origin"))
        {
            context.Response.StatusCode = 405;
            return;
        }

        // 5. Remove server fingerprinting
        context.Response.Headers.Remove("Server");
        context.Response.Headers.Remove("X-Powered-By");

        await _next(context);
    }
}