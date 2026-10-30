using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.AspNetCore.HttpOverrides;
using SahayataNidhi.Models.Entities;
using SendEmails;
using SahayataNidhi.Services;
using Microsoft.AspNetCore.DataProtection;
using System.Security.Claims;
using EncryptionHelper;
using Newtonsoft.Json.Serialization;
using Newtonsoft.Json;

var builder = WebApplication.CreateBuilder(args);

// ============================================================
// 1. Kestrel Configuration (Security)
// ============================================================
builder.WebHost.ConfigureKestrel(serverOptions =>
{
    serverOptions.AddServerHeader = false; // Mitigates server fingerprinting
});

// ============================================================
// 2. Database & Data Protection
// ============================================================
builder.Services.AddDbContext<SwdjkContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddDataProtection()
    .PersistKeysToFileSystem(new DirectoryInfo(Path.Combine(builder.Environment.ContentRootPath, "DataProtection-Keys")))
    .SetApplicationName("ReactMvcApp");

// ============================================================
// 3. MVC, JSON & SignalR Configuration
// ============================================================
// OPTIMIZATION: Combined redundant AddControllersWithViews calls.
// OPTIMIZATION: Razor Runtime Compilation is strictly for Development (Huge performance win in Prod).
var mvcBuilder = builder.Services.AddControllersWithViews(options =>
{
    options.Filters.Add<SessionValidationFilter>();
});

if (builder.Environment.IsDevelopment())
{
    mvcBuilder.AddRazorRuntimeCompilation();
}

// Configure Newtonsoft for MVC
mvcBuilder.AddNewtonsoftJson(options =>
{
    options.SerializerSettings.ReferenceLoopHandling = ReferenceLoopHandling.Ignore;
    options.SerializerSettings.ContractResolver = new CamelCasePropertyNamesContractResolver();
    options.SerializerSettings.PreserveReferencesHandling = PreserveReferencesHandling.None;
    options.SerializerSettings.Formatting = Formatting.None;
});

// Configure System.Text.Json for Minimal APIs / SignalR (if not using Newtonsoft protocol)
builder.Services.Configure<Microsoft.AspNetCore.Http.Json.JsonOptions>(options =>
    options.SerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles);

builder.Services.AddSignalR();

// ============================================================
// 4. CORS Configuration
// ============================================================
var corsOrigins = builder.Configuration.GetSection("CorsAllowedOrigins").Get<string[]>();
if (corsOrigins == null || corsOrigins.Length == 0)
{
    corsOrigins = builder.Environment.IsDevelopment()
        ? new[] { "http://localhost:3000", "https://localhost:3000" }
        : throw new InvalidOperationException("CorsAllowedOrigins is not configured for production.");
}

builder.Services.AddCors(options =>
{
    options.AddPolicy("StrictCors", policy =>
    {
        policy.WithOrigins(corsOrigins)
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials();
    });
});

// ============================================================
// 5. Authentication & Authorization
// ============================================================
var jwtSecretKey = builder.Configuration.GetValue<string>("JWT:Secret")
    ?? throw new InvalidOperationException("JWT:Secret is not configured.");
var key = Encoding.ASCII.GetBytes(jwtSecretKey);

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = builder.Configuration["JWT:Issuer"],
        ValidAudience = builder.Configuration["JWT:Audience"],
        IssuerSigningKey = new SymmetricSecurityKey(key),
        ClockSkew = TimeSpan.Zero
    };
    options.Events = new JwtBearerEvents
    {
        OnTokenValidated = context =>
        {
            var username = context.Principal?.FindFirst(ClaimTypes.Name)?.Value;
            Console.WriteLine($"JWT Token validated for user: {username}");
            return Task.CompletedTask;
        },
        OnAuthenticationFailed = context =>
        {
            Console.WriteLine($"Authentication failed: {context.Exception.Message}");
            return Task.CompletedTask;
        }
    };
});

// BUG FIX: Removed accidental trailing spaces in Policy and Role names!
builder.Services.AddAuthorizationBuilder()
    .AddPolicy("CitizenPolicy", policy => policy.RequireRole("Citizen"))
    .AddPolicy("OfficerPolicy", policy => policy.RequireRole("Officer"))
    .AddPolicy("AdminPolicy", policy => policy.RequireRole("Admin"))
    .AddPolicy("DesignerPolicy", policy => policy.RequireRole("Designer"))
    .AddPolicy("ViewerPolicy", policy => policy.RequireRole("Viewer"));


builder.Services.AddHttpClient("WebService", client =>
{
    client.Timeout = TimeSpan.FromSeconds(60);
});

builder.Services.AddScoped<IWebServiceExecutionService, WebServiceExecutionService>();

// ============================================================
// 5b. Rate Limiting (brute-force & abuse protection)
// ============================================================
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    // Strict per-IP fixed window for unauthenticated auth/OTP endpoints.
    options.AddPolicy("AuthEndpoints", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            }));

    // General per-user (falls back to IP) sliding window for authenticated traffic.
    options.AddPolicy("ApiGeneral", context =>
        RateLimitPartition.GetSlidingWindowLimiter(
            context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                ?? context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new SlidingWindowRateLimiterOptions
            {
                PermitLimit = 300,
                Window = TimeSpan.FromMinutes(1),
                SegmentsPerWindow = 4,
                QueueLimit = 0
            }));
});

// ============================================================
// 6. Dependency Injection Registrations
// ============================================================
builder.Services.AddTransient<IEmailSender, EmailSender>();
builder.Services.Configure<EmailSettings>(builder.Configuration.GetSection("EmailSettings"));
builder.Services.AddScoped<OtpStore>();
builder.Services.AddScoped<EmailSender>();
builder.Services.AddScoped<UserHelperFunctions>();
builder.Services.AddTransient<PdfService>();
builder.Services.AddSingleton<IEncryptionService, EncryptionService>();
builder.Services.AddScoped<IAuditLogService, AuditLogService>();
builder.Services.AddDetection();
builder.Services.AddSingleton<IBackgroundTaskQueue, BackgroundTaskQueue>();
builder.Services.AddScoped<IExpirationSyncService, ExpirationSyncService>();
builder.Services.AddHostedService<QueuedHostedService>();
builder.Services.AddSingleton<ICronScheduler, CronScheduler>();
builder.Services.AddScoped<SessionRepository>();
builder.Services.AddScoped<IReferenceDataService, ReferenceDataService>();
builder.Services.AddScoped<ApplicationCounterService>();
builder.Services.AddScoped<CronServices>();
builder.Services.AddTransient<ISmsSender, SmsSender>();
builder.Services.AddScoped<INotificationDispatcher, NotificationDispatcher>();
builder.Services.AddHttpClient();
builder.Services.AddMemoryCache();
builder.Services.AddSingleton<RsaKeyService>();

var app = builder.Build();

// ============================================================
// 7. HTTP Middleware Pipeline (Order is critical!)
// ============================================================

// 1. Forwarded Headers (Must be first to correctly identify scheme/host behind proxies like Nginx/ngrok)
app.UseForwardedHeaders(new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto
});

// 2. Exception Handling & HSTS (Production only)
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts(); // Enforce HTTP Strict Transport Security
}

// 3. HTTPS Redirection
// app.UseHttpsRedirection();

// 4. Static Files
// OPTIMIZATION: Use HashSet for O(1) lookups instead of Array.Contains()
var imageExtensions = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
{
    ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".svg"
};

app.UseStaticFiles(new StaticFileOptions
{
    OnPrepareResponse = ctx =>
    {
        var fileExtension = Path.GetExtension(ctx.File.Name);
        if (fileExtension.Equals(".pdf", StringComparison.OrdinalIgnoreCase))
        {
            ctx.Context.Response.Headers.Append("Content-Disposition", "inline");
        }
        else if (imageExtensions.Contains(fileExtension))
        {
            ctx.Context.Response.Headers.Append("Content-Type", $"image/{fileExtension.TrimStart('.')}");
        }
    }
});

app.UseDetection();
app.UseRouting();

// 5. CORS (Must be after UseRouting and before UseAuthorization)
app.UseCors("StrictCors");

// 5b. Rate Limiting (after CORS, before auth endpoints execute)
app.UseRateLimiter();

// 6. Authentication & Custom Middleware
app.UseAuthentication();
app.UseMiddleware<JanParichayValidationMiddleware>();
app.UseMiddleware<SecurityMiddleware>();

// 7. Authorization
app.UseAuthorization();

// ============================================================
// 8. Endpoint Routing
// ============================================================
app.MapHub<SessionHub>("/sessionHub");
app.MapHub<ProgressHub>("/progressHub");

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");

app.MapFallbackToController("Index", "Home");

app.Run();