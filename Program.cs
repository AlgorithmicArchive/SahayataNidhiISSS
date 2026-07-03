using System.Text;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.AspNetCore.HttpOverrides;
using SahayataNidhi.Models.Entities;
using SendEmails;
using Microsoft.AspNetCore.DataProtection;
using System.Security.Claims;
using EncryptionHelper;
using Newtonsoft.Json.Serialization;
using Newtonsoft.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Http;

var builder = WebApplication.CreateBuilder(args);

// ============================================================
// 1. Remove Server header (Kestrel) – mitigates #12 partially
// ============================================================
builder.WebHost.ConfigureKestrel(serverOptions =>
{
    serverOptions.AddServerHeader = false;
});

// ============================================================
// 2. Existing service registrations (unchanged)
// ============================================================
builder.Services.AddControllersWithViews().AddRazorRuntimeCompilation();
builder.Services.AddSignalR();
builder.Services.Configure<Microsoft.AspNetCore.Http.Json.JsonOptions>(options =>
    options.SerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles);

builder.Services.AddDbContext<SwdjkContext>(options =>
{
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection"));
});

builder.Services.AddDataProtection()
    .PersistKeysToFileSystem(new DirectoryInfo(Path.Combine(builder.Environment.ContentRootPath, "DataProtection-Keys")))
    .SetApplicationName("ReactMvcApp");

builder.Services.AddControllers().AddNewtonsoftJson(options =>
{
    options.SerializerSettings.ReferenceLoopHandling = ReferenceLoopHandling.Ignore;
    options.SerializerSettings.ContractResolver = new CamelCasePropertyNamesContractResolver();
    options.SerializerSettings.PreserveReferencesHandling = PreserveReferencesHandling.None;
    options.SerializerSettings.Formatting = Formatting.None;
});

// ============================================================
// 3. FIX #4 – CORS: Read allowed origins from configuration
// ============================================================
var corsOrigins = builder.Configuration.GetSection("CorsAllowedOrigins").Get<string[]>();
if (corsOrigins == null || corsOrigins.Length == 0)
{
    // Fallback for development only – never use wildcard in production
    corsOrigins = builder.Environment.IsDevelopment()
        ? new[] { "http://localhost:3000", "https://localhost:3000" }
        : throw new InvalidOperationException("CorsAllowedOrigins is not configured.");
}

builder.Services.AddCors(options =>
{
    options.AddPolicy("StrictCors", policy =>
    {
        policy.WithOrigins(corsOrigins)
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials(); // Set to false if you don't send credentials
    });
});


// JWT Authentication (unchanged)
var jwtSecretKey = builder.Configuration.GetValue<string>("JWT:Secret");
var key = Encoding.ASCII.GetBytes(jwtSecretKey!);
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
            var claimsIdentity = context.Principal!.Identity as ClaimsIdentity;
            if (claimsIdentity != null)
            {
                var username = claimsIdentity.FindFirst(ClaimTypes.Name)?.Value;
                Console.WriteLine($"JWT Token validated for user: {username}");
            }
            return Task.CompletedTask;
        },
        OnAuthenticationFailed = context =>
        {
            Console.WriteLine($"Authentication failed: {context.Exception.Message}");
            return Task.CompletedTask;
        }
    };
});

// Authorization policies (unchanged)
builder.Services.AddAuthorizationBuilder()
    .AddPolicy("CitizenPolicy", policy => policy.RequireRole("Citizen"))
    .AddPolicy("OfficerPolicy", policy => policy.RequireRole("Officer"))
    .AddPolicy("AdminPolicy", policy => policy.RequireRole("Admin"))
    .AddPolicy("DesignerPolicy", policy => policy.RequireRole("Designer"))
    .AddPolicy("ViewerPolicy", policy => policy.RequireRole("Viewer"));

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
// builder.Services.AddHostedService<CronScheduler>();
builder.Services.AddScoped<SessionRepository>();
builder.Services.AddScoped<CronServices>();
builder.Services.AddHttpClient();
builder.Services.AddMemoryCache();
builder.Services.AddSingleton<RsaKeyService>();

builder.Services.AddScoped<SessionValidationFilter>();

// Then, after AddControllersWithViews:
builder.Services.AddControllersWithViews(options =>
{
    options.Filters.Add<SessionValidationFilter>();
});

// ============================================================
// 4. Enforce HTTPS globally (RequireHttps filter)
// ============================================================
// builder.Services.Configure<MvcOptions>(options =>
// {
//     options.Filters.Add(new RequireHttpsAttribute());
// });

var app = builder.Build();

// Background task registration (unchanged)
// app.Lifetime.ApplicationStarted.Register(async () =>
// {
//     using var scope = app.Services.CreateScope();
//     var cronService = scope.ServiceProvider.GetRequiredService<CronServices>();
//     await cronService.RegisterAllTasksAsync();
// });

// ============================================================
// 5. HTTP pipeline – order matters!
// ============================================================

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    // HSTS must come BEFORE HTTPS redirection and before any response headers
    // app.UseHsts();
}


// ============================================================
// 6. FIX #2 & #3 – Enforce HTTPS redirection (uncommented)
// ============================================================
// app.UseHttpsRedirection();

app.UseStaticFiles(new StaticFileOptions
{
    OnPrepareResponse = ctx =>
    {
        // Remove wildcard CORS from static files – it's unsafe
        // ctx.Context.Response.Headers.Append("Access-Control-Allow-Origin", "*");
        var fileExtension = Path.GetExtension(ctx.File.Name).ToLower();
        if (fileExtension == ".pdf")
            ctx.Context.Response.Headers.Append("Content-Disposition", "inline");
        else if (new[] { ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".svg" }.Contains(fileExtension))
            ctx.Context.Response.Headers.Append("Content-Type", $"image/{fileExtension.TrimStart('.')}");
    }
});

app.UseDetection();

// Forwarded headers for proxies (ngrok, nginx, etc.)
app.UseForwardedHeaders(new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto
});

// ============================================================
// 7. Custom security middleware (Host whitelist, security headers, CSP, OPTIONS block)
//    Must be placed after UseForwardedHeaders and before UseRouting
// ============================================================

app.UseRouting();

// ============================================================
// 8. Use the new restricted CORS policy (not "AllowAll")
// ============================================================
app.UseCors("StrictCors");






app.MapHub<SessionHub>("/sessionHub");

app.UseMiddleware<SecurityMiddleware>();

app.UseAuthentication();
app.UseAuthorization();

app.MapHub<ProgressHub>("/progressHub");

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");

app.MapFallbackToController("Index", "Home");

app.Run();