using System.Net.Http;
using System.Text;
using EncryptionHelper;
using Microsoft.EntityFrameworkCore;
using SahayataNidhi.Models.Entities;

public class SmsSender(
    ILogger<SmsSender> logger,
    SwdjkContext dbcontext,
    IHttpClientFactory httpClientFactory,
    IEncryptionService encryptionService,
    IConfiguration configuration) : ISmsSender
{
    private readonly ILogger<SmsSender> _logger = logger;
    private readonly IHttpClientFactory _httpClientFactory = httpClientFactory;
    private readonly IEncryptionService _encryptionService = encryptionService;
    private readonly IConfiguration _configuration = configuration;

    public Task<bool> SendSmsAsync(string to, string message)
        => SendCoreAsync(to, message, templateId: null, variables: Array.Empty<string>());

    public Task<bool> SendTemplateSmsAsync(string to, string templateId, params string[] variables)
        => SendCoreAsync(to, message: null, templateId, variables ?? Array.Empty<string>());

    private async Task<bool> SendCoreAsync(string to, string? message, string? templateId, string[] variables)
    {
        var sms = await dbcontext.Smssettings.AsNoTracking().FirstOrDefaultAsync();
        if (sms == null)
        {
            _logger.LogInformation("SMS: no provider configured; skipping send to {To}", to);
            return true;
        }
        if (sms.Enabled != true)
        {
            _logger.LogInformation(
                "SMS: provider '{Provider}' disabled; simulated send to {To} [template={TemplateId}, vars={Vars}]",
                sms.Providername, to, templateId ?? "-", string.Join(" | ", variables));
            return true;
        }
        if (string.IsNullOrWhiteSpace(sms.Apiurl))
        {
            _logger.LogWarning("SMS: provider '{Provider}' enabled but ApiUrl is empty.", sms.Providername);
            return false;
        }

        try
        {
            string apikey = string.IsNullOrEmpty(sms.Apikey)
                ? ""
                : _encryptionService.Decrypt(sms.Apikey, _configuration["Encryption:Key"]!);

            string senderId = sms.Senderid ?? "";
            string method = string.IsNullOrWhiteSpace(sms.Httpmethod) ? "POST" : sms.Httpmethod.ToUpperInvariant();

            string url = Replace(sms.Apiurl, to, message, senderId, apikey, templateId, variables);

            var request = new HttpRequestMessage(new HttpMethod(method), url);

            if (string.Equals(sms.Keylocation, "header", StringComparison.OrdinalIgnoreCase))
                request.Headers.TryAddWithoutValidation(sms.Keyname ?? "authkey", apikey);

            string? contentType = null;
            string? body = null;

            if (!string.IsNullOrWhiteSpace(sms.Bodytemplate))
            {
                body = Replace(sms.Bodytemplate, to, message, senderId, apikey, templateId, variables);
                contentType = InferContentType(sms.Bodytemplate);
            }
            else if (method != "GET")
            {
                body = templateId != null
                    ? BuildDefaultTemplateBody(to, senderId, apikey, templateId, variables)
                    : $"mobile={Uri.EscapeDataString(to)}&message={Uri.EscapeDataString(message ?? "")}&sender={Uri.EscapeDataString(senderId)}&key={Uri.EscapeDataString(apikey)}";
                contentType = "application/x-www-form-urlencoded";
            }

            if (body != null)
            {
                if (contentType == "application/x-www-form-urlencoded")
                {
                    // Avoid double-encoding: send the raw bytes with the form header.
                    request.Content = new ByteArrayContent(Encoding.UTF8.GetBytes(body));
                    request.Content.Headers.TryAddWithoutValidation("Content-Type", "application/x-www-form-urlencoded");
                }
                else
                {
                    request.Content = new StringContent(body, Encoding.UTF8, contentType ?? "text/plain");
                }
            }

            _logger.LogInformation(
                "SMS: sending to {To} via {Provider} -> {Method} {Url} [template={TemplateId}]",
                to, sms.Providername, method, SanitizeUrl(url), templateId ?? "-");

            var client = _httpClientFactory.CreateClient("SmsSender");
            client.Timeout = TimeSpan.FromSeconds(30);
            using var response = await client.SendAsync(request);
            string responseBody = await response.Content.ReadAsStringAsync();

            bool ok = response.IsSuccessStatusCode;
            if (!string.IsNullOrWhiteSpace(sms.Successindicator))
            {
                var indicator = sms.Successindicator.Trim();
                bool contains = responseBody.Contains(indicator, StringComparison.OrdinalIgnoreCase);
                ok = ok && contains;
                _logger.LogInformation("SMS: provider response matched success indicator '{Indicator}': {Matched}", indicator, contains);
            }

            if (!ok)
                _logger.LogWarning("SMS: provider returned {(int)response.StatusCode}: {Body}", (int)response.StatusCode, Truncate(responseBody, 500));

            return ok;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "SMS: send failed to {To}", to);
            return false;
        }
    }

    /// <summary>Fallback DLT-style form body when the provider has no Bodytemplate configured.</summary>
    private static string BuildDefaultTemplateBody(string to, string senderId, string apikey, string templateId, string[] variables)
    {
        var sb = new StringBuilder();
        sb.Append("templateid=").Append(Uri.EscapeDataString(templateId));
        sb.Append("&mobiles=").Append(Uri.EscapeDataString(to));
        sb.Append("&sender=").Append(Uri.EscapeDataString(senderId));
        sb.Append("&authkey=").Append(Uri.EscapeDataString(apikey));
        for (int i = 0; i < variables.Length; i++)
            sb.Append("&var").Append(i + 1).Append('=').Append(Uri.EscapeDataString(variables[i] ?? ""));
        return sb.ToString();
    }

    private static string Replace(
        string template, string to, string? message, string senderId, string apikey,
        string? templateId, string[] variables)
    {
        string result = template
            .Replace("{to}", Uri.EscapeDataString(to))
            .Replace("{message}", Uri.EscapeDataString(message ?? ""))
            .Replace("{senderid}", Uri.EscapeDataString(senderId))
            .Replace("{apikey}", Uri.EscapeDataString(apikey))
            .Replace("{templateid}", Uri.EscapeDataString(templateId ?? ""));

        for (int i = 0; i < variables.Length; i++)
            result = result.Replace($"{{var{i + 1}}}", Uri.EscapeDataString(variables[i] ?? ""));

        return result;
    }

    private static string InferContentType(string bodyTemplate)
    {
        var trimmed = bodyTemplate.TrimStart();
        if (trimmed.StartsWith('{') || trimmed.StartsWith('['))
            return "application/json";
        return "application/x-www-form-urlencoded";
    }

    private static string SanitizeUrl(string url)
    {
        try
        {
            var uri = new Uri(url);
            if (string.IsNullOrEmpty(uri.Query)) return url;
            var q = string.Join("&", uri.Query.TrimStart('?').Split('&')
                .Select(p => p.Split('=', 2) is var kv && kv.Length == 2 && IsSensitive(kv[0]) ? kv[0] + "=***" : p));
            return uri.GetLeftPart(UriPartial.Path) + "?" + q;
        }
        catch { return url; }
    }

    private static bool IsSensitive(string key) =>
        key.Contains("key", StringComparison.OrdinalIgnoreCase) ||
        key.Contains("auth", StringComparison.OrdinalIgnoreCase) ||
        key.Contains("token", StringComparison.OrdinalIgnoreCase) ||
        key.Contains("pass", StringComparison.OrdinalIgnoreCase);

    private static string Truncate(string value, int max) => value.Length <= max ? value : value[..max] + "…";
}