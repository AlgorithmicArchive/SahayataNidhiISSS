using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json.Linq;
using SahayataNidhi.Models.Entities;

public interface IExpirationSyncService
{
    Task SyncExpirationsAsync(CitizenApplications application, CancellationToken ct = default);
}

public class ExpirationSyncService : IExpirationSyncService
{
    private readonly SwdjkContext _dbcontext;
    private readonly ILogger<ExpirationSyncService> _logger;

    public ExpirationSyncService(SwdjkContext dbcontext, ILogger<ExpirationSyncService> logger)
    {
        _dbcontext = dbcontext;
        _logger = logger;
    }

    private bool TryParseInterval(string intervalStr, out TimeSpan interval)
    {
        interval = TimeSpan.Zero;
        var parts = intervalStr.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length != 2) return false;
        if (!int.TryParse(parts[0], out int value)) return false;

        switch (parts[1].ToLower())
        {
            case "year":
            case "years":
                interval = TimeSpan.FromDays(value * 365);
                return true;
            case "month":
            case "months":
                interval = TimeSpan.FromDays(value * 30);
                return true;
            case "day":
            case "days":
                interval = TimeSpan.FromDays(value);
                return true;
            default:
                return false;
        }
    }

    public async Task SyncExpirationsAsync(CitizenApplications application, CancellationToken ct = default)
    {
        _logger.LogInformation("SyncExpirationsAsync START for AppID: {RefNo}, ServiceId: {ServiceId}",
            application.Referencenumber, application.Serviceid);

        var formJson = JObject.Parse(application.Formdetails ?? "{}");

        _logger.LogInformation("Parsed form JSON for Application: {Application} ", application);

        var expirationTypes = await _dbcontext.ExpirationTypes
            .Where(et => et.IsActive == true && et.ServiceId == application.Serviceid)
            .ToListAsync(ct);

        _logger.LogInformation("Found {Count} active expiration types for ServiceId {ServiceId}",
            expirationTypes.Count, application.Serviceid);

        if (expirationTypes.Count == 0) return;

        string email = GetFormFieldValue(formJson, "Email")!;
        string mobile = GetFormFieldValue(formJson, "MobileNumber")!;
        DateOnly approvalDate = DateOnly.FromDateTime(DateTime.UtcNow.Date);

        foreach (var expType in expirationTypes)
        {
            _logger.LogInformation("Processing ExpirationType ID {Id}, Name {Name}", expType.Id, expType.ExpirationName);

            // Evaluate condition
            if (!string.IsNullOrEmpty(expType.ConditionField))
            {
                bool conditionMet = EvaluateCondition(formJson, expType.ConditionField);
                _logger.LogInformation("Condition for ID {Id} evaluated to {Result}", expType.Id, conditionMet);
                if (!conditionMet) continue;
            }

            DateOnly? expirationDate = null;
            string? sourceValue = null;
            string sourceEvent = "sanctioned";

            if (expType.BasedOnField == true)
            {
                string dateField = expType.ValueField ?? "";
                string dateStr = FindFieldValueRecursively(formJson, dateField)!;
                _logger.LogInformation("BasedOnField=true, ValueField={Field}, extracted date string='{DateStr}'", dateField, dateStr);

                if (!string.IsNullOrEmpty(dateStr) &&
                    DateTime.TryParseExact(dateStr, "dd/MM/yyyy", CultureInfo.InvariantCulture, DateTimeStyles.None, out DateTime exactDate))
                {
                    // Check corrigendum
                    exactDate = await GetCorrigendumOverrideAsync(application.Referencenumber, dateField, exactDate, ct);
                    expirationDate = DateOnly.FromDateTime(exactDate);
                    sourceValue = exactDate.ToString("yyyy-MM-dd");
                    _logger.LogInformation("Parsed expiration date from form: {Date}", expirationDate);
                }
                else
                {
                    _logger.LogWarning("Could not parse date from field '{Field}' with value '{DateStr}'", dateField, dateStr);
                }
            }
            else
            {
                // ValidityPeriod is now a string like "1 year" or "3 years"
                if (!string.IsNullOrEmpty(expType.ValidityPeriod))
                {
                    if (TryParseInterval(expType.ValidityPeriod, out TimeSpan interval))
                    {
                        expirationDate = approvalDate.AddDays((int)interval.TotalDays);
                        sourceEvent = "calculated_from_approval";
                        _logger.LogInformation("Calculated expiration date from ValidityPeriod: {Date} (days added: {Days})",
                            expirationDate, (int)interval.TotalDays);
                    }
                    else
                    {
                        _logger.LogWarning("Failed to parse ValidityPeriod '{Period}' for ExpirationType ID {Id}",
                            expType.ValidityPeriod, expType.Id);
                    }
                }
                else
                {
                    _logger.LogWarning("ValidityPeriod is null or empty for ExpirationType ID {Id}", expType.Id);
                }
            }

            if (expirationDate == null)
            {
                _logger.LogWarning("No expiration date for ExpirationType ID {Id}, skipping", expType.Id);
                continue;
            }

            await UpsertExpirationRecord(
                    application.Referencenumber,
                    application.Serviceid,
                    expType.Id,
                    expirationDate.Value,
                    approvalDate,
                    sourceValue ?? "",
                    sourceEvent,
                    email,
                    mobile,
                    ct);
        }
    }

    // Generic method to get a field value from the form JSON by name (recursive search)
    private static string? GetFormFieldValue(JObject formDetailsObj, string fieldName)
    {
        foreach (var section in formDetailsObj.Properties())
        {
            if (section.Value is JArray fieldsArray)
            {
                foreach (JObject field in fieldsArray)
                {
                    var name = field["name"]?.ToString();
                    if (name == fieldName)
                    {
                        return field["value"]?.ToString()
                            ?? field["File"]?.ToString()
                            ?? field["Enclosure"]?.ToString();
                    }
                }
            }
        }

        return null;
    }

    private string? FindFieldValueRecursively(JToken token, string fieldName)
    {
        if (token is JObject obj)
        {
            if (obj["name"]?.ToString() == fieldName)
            {
                return obj["value"]?.ToString() ?? obj["File"]?.ToString() ?? obj["Enclosure"]?.ToString() ?? "";
            }
            foreach (var prop in obj.Properties())
            {
                var result = FindFieldValueRecursively(prop.Value, fieldName);
                if (result != null) return result;
            }
        }
        else if (token is JArray arr)
        {
            foreach (var item in arr)
            {
                var result = FindFieldValueRecursively(item, fieldName);
                if (result != null) return result;
            }
        }
        return null;
    }

    // Evaluate condition stored as JSON: { "FieldName": "ExpectedValue", ... }
    private bool EvaluateCondition(JObject formJson, string conditionJson)
    {
        if (string.IsNullOrWhiteSpace(conditionJson)) return true;

        _logger.LogInformation($"Form JSON for condition evaluation: {formJson}");
        _logger.LogInformation("Evaluating condition: {ConditionJson}", conditionJson);

        JObject conditions;
        try
        {
            conditions = JObject.Parse(conditionJson);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Invalid condition JSON: {ConditionJson}", conditionJson);
            return false;
        }

        _logger.LogInformation("Parsed conditions: {Conditions}", conditions);
        foreach (var prop in conditions.Properties())
        {
            string fieldName = prop.Name;
            string expectedValue = prop.Value.ToString();
            _logger.LogInformation("Evaluating condition for field '{FieldName}' expecting value '{ExpectedValue}'", fieldName, expectedValue);
            string actualValue = FindFieldValueRecursively(formJson, fieldName)!;
            _logger.LogInformation("Actual value for field '{FieldName}' is '{ActualValue}'", fieldName, actualValue);

            if (!string.Equals(actualValue, expectedValue, StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogDebug("Condition failed: {Field} expected '{Expected}' got '{Actual}'",
                    fieldName, expectedValue, actualValue);
                return false;
            }
        }
        return true;
    }

    // Override date from corrigendum if exists (kept for completeness, but uses simple field name)
    private async Task<DateTime> GetCorrigendumOverrideAsync(string refNumber, string fieldName, DateTime originalDate, CancellationToken ct)
    {
        var corrigendum = await _dbcontext.Corrigendum
            .Where(c => c.Referencenumber == refNumber)
            .Where(c => c.Corrigendumfields != null)
            .OrderByDescending(c => c.Createdat)
            .FirstOrDefaultAsync(ct);

        if (corrigendum != null)
        {
            var corrJson = JObject.Parse(corrigendum.Corrigendumfields);
            // Corrigendum stores changes per field; we look for a change to this field
            var change = corrJson.SelectToken($"$..[?(@.name == '{fieldName}')].new_value");
            if (change != null)
            {
                string newDateStr = change.ToString();
                if (DateTime.TryParseExact(newDateStr, "dd/MM/yyyy", CultureInfo.InvariantCulture, DateTimeStyles.None, out DateTime newDate))
                    return newDate;
            }
        }
        return originalDate;
    }

    private async Task UpsertExpirationRecord(
        string refNumber,
        int serviceId,
        int expTypeId,
        DateOnly expirationDate,
        DateOnly baseDate,
        string sourceValue,
        string sourceEvent,
        string email,
        string mobile,
        CancellationToken ct)
    {
        var existing = await _dbcontext.ApplicationExpirations
            .Where(e => e.Referencenumber == refNumber)
            .Where(e => e.ExpirationTypeId == expTypeId)
            .Where(e => e.IsActive == true)
            .FirstOrDefaultAsync(ct);

        if (existing != null)
        {
            if (existing.ExpirationDate != expirationDate)
            {
                existing.ExpirationDate = expirationDate;
                existing.BaseDate = baseDate;
                existing.SourceValue = sourceValue;
                existing.SourceEvent = sourceEvent;
                existing.Email = email;
                existing.MobileNumber = mobile;
                existing.UpdatedAt = DateTime.UtcNow;
                existing.MailSentCount = 0;
            }
            else
            {
                existing.Email = email;
                existing.MobileNumber = mobile;
                existing.UpdatedAt = DateTime.UtcNow;
            }
        }
        else
        {
            _dbcontext.ApplicationExpirations.Add(new ApplicationExpirations
            {
                Referencenumber = refNumber,
                ServiceId = serviceId,
                ExpirationTypeId = expTypeId,
                ExpirationDate = expirationDate,
                BaseDate = baseDate,
                SourceValue = sourceValue,
                SourceEvent = sourceEvent,
                Email = email,
                MobileNumber = mobile,
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            });
        }

        await _dbcontext.SaveChangesAsync(ct);
    }
}