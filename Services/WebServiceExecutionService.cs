using System.Diagnostics;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using SahayataNidhi.Models.Entities;

public interface IWebServiceExecutionService
{
    Task ExecuteForTriggerAsync(int serviceId, string trigger, JObject sourceData);
}

public class WebServiceExecutionService : IWebServiceExecutionService
{
    private readonly SwdjkContext _db; // change to your DbContext name
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<WebServiceExecutionService> _logger;

    public WebServiceExecutionService(
        SwdjkContext db,
        IHttpClientFactory httpClientFactory,
        ILogger<WebServiceExecutionService> logger)
    {
        _db = db;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    private static readonly Dictionary<string, string> TriggerAliases =
        new(StringComparer.OrdinalIgnoreCase)
        {
            ["Sanction"] = "APPLICATION_SANCTIONED",
            ["Submission"] = "APPLICATION_SANCTIONED",
            ["Rejection"] = "APPLICATION_SANCTIONED",

            ["Corrigendum"] = "CORRIGENDUM_SANCTIONED",
            ["Amendment"] = "CORRIGENDUM_SANCTIONED",

            ["Withheld"] = "WITHHELD_APPROVED"
        };

    public async Task ExecuteForTriggerAsync(int serviceId, string trigger, JObject sourceData)
    {
        if (string.IsNullOrWhiteSpace(trigger))
            return;

        trigger = NormalizeTrigger(trigger);

        var activeWebServices = await _db.Webservice
            .Where(w => w.Serviceid == serviceId && w.Isactive)
            .ToListAsync();

        var matchedWebServices = activeWebServices
            .Where(w => TriggerMatches(w.Onaction, trigger))
            .ToList();

        foreach (var webService in matchedWebServices)
        {
            await ExecuteWithRetryAsync(webService, trigger, sourceData);
        }
    }

    private async Task ExecuteWithRetryAsync(Webservice webService, string trigger, JObject sourceData)
    {
        int totalAttempts = webService.Retryenabled
            ? Math.Max(1, webService.Maxattempts)
            : 1;

        int delaySeconds = webService.Retryenabled
            ? Math.Max(0, webService.Retrydelayseconds)
            : 0;

        string endpoint = CleanValue(webService.Apiendpoint);

        JObject payload = BuildPayload(webService.Fieldmappings, trigger, sourceData);

        string requestBody = payload.ToString(Formatting.None);

        var headers = ParseHeaders(webService.Headers!);

        string? referenceNumber = sourceData?["referencenumber"]?.ToString();

        Guid executionId = Guid.NewGuid();

        var client = _httpClientFactory.CreateClient("WebService");

        for (int attempt = 1; attempt <= totalAttempts; attempt++)
        {
            var log = new WebserviceLogs
            {
                Executionid = executionId,
                Webserviceid = webService.Id,
                Serviceid = webService.Serviceid,
                Triggername = trigger,
                Referencenumber = referenceNumber,
                Attemptnumber = attempt,
                Requesturl = endpoint,
                Requestmethod = "POST",
                Requestheaders = MaskHeaders(headers),
                Requestbody = Truncate(requestBody),
                Issuccess = false,
                Createdat = DateTime.UtcNow
            };

            var stopwatch = Stopwatch.StartNew();

            try
            {
                using var request = new HttpRequestMessage(HttpMethod.Post, endpoint);

                foreach (var header in headers)
                {
                    if (string.Equals(header.Key, "Content-Type", StringComparison.OrdinalIgnoreCase))
                        continue;

                    request.Headers.TryAddWithoutValidation(header.Key, header.Value);
                }

                request.Content = new StringContent(
                    requestBody,
                    Encoding.UTF8,
                    "application/json");

                using var response = await client.SendAsync(request);

                string responseBody = await response.Content.ReadAsStringAsync();

                stopwatch.Stop();

                var responseHeaders = response.Headers
                    .Select(h => new KeyValuePair<string, string>(
                        h.Key,
                        string.Join(",", h.Value)))
                    .ToList();

                if (response.Content != null)
                {
                    responseHeaders.AddRange(
                        response.Content.Headers.Select(h =>
                            new KeyValuePair<string, string>(
                                h.Key,
                                string.Join(",", h.Value))));
                }

                log.Responsestatuscode = (int)response.StatusCode;
                log.Responseheaders = MaskHeaders(responseHeaders);
                log.Responsebody = Truncate(responseBody);
                log.Issuccess = response.IsSuccessStatusCode;
                log.Durationms = stopwatch.ElapsedMilliseconds;

                _db.WebserviceLogs.Add(log);
                await _db.SaveChangesAsync();

                if (response.IsSuccessStatusCode)
                {
                    _logger.LogInformation(
                        "Web service {WebServiceId} succeeded on attempt {Attempt}",
                        webService.Id,
                        attempt);

                    return;
                }

                _logger.LogWarning(
                    "Web service {WebServiceId} failed on attempt {Attempt} with status {StatusCode}",
                    webService.Id,
                    attempt,
                    (int)response.StatusCode);
            }
            catch (Exception ex)
            {
                stopwatch.Stop();

                log.Issuccess = false;
                log.Errormessage = Truncate(ex.Message);
                log.Durationms = stopwatch.ElapsedMilliseconds;

                _db.WebserviceLogs.Add(log);
                await _db.SaveChangesAsync();

                _logger.LogError(
                    ex,
                    "Web service {WebServiceId} exception on attempt {Attempt}",
                    webService.Id,
                    attempt);
            }

            if (attempt < totalAttempts && delaySeconds > 0)
            {
                await Task.Delay(TimeSpan.FromSeconds(delaySeconds));
            }
        }

        _logger.LogError(
            "Web service {WebServiceId} stopped after {Attempts} attempts",
            webService.Id,
            totalAttempts);
    }

    private bool TriggerMatches(string onActionJson, string trigger)
    {
        if (string.IsNullOrWhiteSpace(onActionJson))
            return false;

        trigger = NormalizeTrigger(trigger);

        try
        {
            var actions = JArray.Parse(onActionJson);

            return actions.Any(x =>
                NormalizeTrigger(x?.ToString()) == trigger);
        }
        catch
        {
            return NormalizeTrigger(onActionJson) == trigger;
        }
    }

    private static string NormalizeTrigger(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return string.Empty;

        value = value.Trim();

        return TriggerAliases.TryGetValue(value, out var normalized)
            ? normalized
            : value;
    }

    private JObject BuildPayload(string fieldMappingsJson, string trigger, JObject sourceData)
    {
        if (string.IsNullOrWhiteSpace(fieldMappingsJson))
            return new JObject();

        try
        {
            var root = JObject.Parse(fieldMappingsJson);

            var actionMappings = root[trigger] as JObject ?? root;

            return BuildObject(actionMappings, sourceData);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to build web service payload");
            return new JObject();
        }
    }

    private JObject BuildObject(JObject mapping, JObject source)
    {
        var result = new JObject();

        if (mapping == null)
            return result;

        foreach (var property in mapping.Properties())
        {
            if (property.Value is JObject child)
            {
                // Leaf mapping format:
                // { "field": "...", "type": "...", "respectiveColumn": "..." }
                if (child["field"] != null && child["type"] != null)
                {
                    var fieldName = child["field"]?.ToString();

                    result[property.Name] = GetSourceValue(source, fieldName);
                }
                else
                {
                    result[property.Name] = BuildObject(child, source);
                }
            }
        }

        return result;
    }

    private JToken GetSourceValue(JObject source, string fieldName)
    {
        if (source == null || string.IsNullOrWhiteSpace(fieldName))
            return null;

        // Supports simple property or JSON path like "location.district"
        var token = source.SelectToken(fieldName);

        if (token != null)
            return token;

        return source.GetValue(fieldName, StringComparison.OrdinalIgnoreCase);
    }

    private List<KeyValuePair<string, string>> ParseHeaders(string headersJson)
    {
        var list = new List<KeyValuePair<string, string>>();

        if (string.IsNullOrWhiteSpace(headersJson))
            return list;

        try
        {
            var array = JArray.Parse(headersJson);

            foreach (var item in array.OfType<JObject>())
            {
                var key = item["key"]?.ToString();
                var value = item["value"]?.ToString();

                if (!string.IsNullOrWhiteSpace(key))
                {
                    list.Add(new KeyValuePair<string, string>(key, value ?? string.Empty));
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to parse web service headers");
        }

        return list;
    }

    private string MaskHeaders(IEnumerable<KeyValuePair<string, string>> headers)
    {
        if (headers == null)
            return null;

        var masked = headers.Select(h => new
        {
            key = h.Key,
            value = IsSecretHeader(h.Key) ? "***" : h.Value
        });

        return JsonConvert.SerializeObject(masked);
    }

    private bool IsSecretHeader(string headerName)
    {
        if (string.IsNullOrWhiteSpace(headerName))
            return false;

        var lower = headerName.ToLower();

        return lower.Contains("authorization")
               || lower.Contains("token")
               || lower.Contains("key")
               || lower.Contains("secret")
               || lower.Contains("password")
               || lower.Contains("api");
    }

    private string CleanValue(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return value;

        try
        {
            if (value.StartsWith("\"") && value.EndsWith("\""))
            {
                return JsonConvert.DeserializeObject<string>(value);
            }
        }
        catch
        {
            // ignore
        }

        return value;
    }

    private string Truncate(string value, int maxLength = 20000)
    {
        if (string.IsNullOrEmpty(value))
            return value;

        return value.Length <= maxLength
            ? value
            : value.Substring(0, maxLength);
    }
}