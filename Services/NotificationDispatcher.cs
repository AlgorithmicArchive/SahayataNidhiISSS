using System.Text.RegularExpressions;
using EncryptionHelper;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Npgsql;
using SahayataNidhi.Models.Entities;
using SendEmails;

namespace SahayataNidhi.Services;

/// <summary>Everything the dispatcher needs to notify on a single action.</summary>
public class NotificationRequest
{
    public int ServiceId { get; set; }
    /// <summary>Action key, e.g. "Submission", "Sanction", "Reject", "Forward", "ReturnToCitizen".</summary>
    public string Action { get; set; } = "";
    /// <summary>The application's form details (JSON object) — source of citizen email/mobile and location.</summary>
    public JObject FormDetails { get; set; } = new JObject();
    /// <summary>The application's workflow chain (array of designation steps), if available.</summary>
    public JArray? ApplicationWorkflow { get; set; }
    public string ReferenceNumber { get; set; } = "";
    /// <summary>Human label for the action, e.g. "Sanctioned" (falls back to Action).</summary>
    public string ActionTaken { get; set; } = "";
    /// <summary>Display string of the acting officer's role.</summary>
    public string OfficerRole { get; set; } = "";
    /// <summary>Display string of the acting officer's area / jurisdiction.</summary>
    public string OfficerArea { get; set; } = "";
    /// <summary>User id of the officer performing the action (for ActingOfficer recipient).</summary>
    public int? ActingOfficerUserId { get; set; }
    /// <summary>Optional attachment sent with the email (e.g. acknowledgement / sanction letter).</summary>
    public byte[]? AttachmentData { get; set; }
    public string? AttachmentName { get; set; }
}

/// <summary>A resolved send target holding whatever contact info is available.</summary>
internal class NotificationTarget
{
    public string Name { get; set; } = "";
    public string Email { get; set; } = "";
    public string Mobile { get; set; } = "";
}

/// <summary>
/// Reads the per-service notification rules (services.notificationconfig) and, for a given
/// action, resolves the configured recipients and dispatches email and/or SMS through the
/// background queue. Replaces the previously hardcoded email dispatch in the user-submission
/// and officer-action flows so the Designer can drive channel, recipients and templates
/// entirely from configuration.
/// </summary>
public class NotificationDispatcher(
    SwdjkContext dbcontext,
    ILogger<NotificationDispatcher> logger,
    IEmailSender emailSender,
    ISmsSender smsSender,
    IReferenceDataService referenceData,
    IBackgroundTaskQueue taskQueue) : INotificationDispatcher
{
    private static readonly string[] BuiltinTokens =
        { "ApplicantName", "ServiceName", "ReferenceNumber", "OfficerRole", "OfficerArea", "ActionTaken", "Date" };

    public async Task DispatchAsync(NotificationRequest request)
    {
        try
        {
            var service = await dbcontext.Services.AsNoTracking()
                .FirstOrDefaultAsync(s => s.Serviceid == request.ServiceId);
            if (service == null || string.IsNullOrWhiteSpace(service.Notificationconfig))
            {
                Log($"No notification rule for service {request.ServiceId}/{request.Action}; skipping.", request);
                return;
            }

            JObject rules;
            try { rules = JObject.Parse(service.Notificationconfig!); }
            catch (Exception ex) { logger.LogError(ex, "Invalid notificationconfig for service {Svc}", request.ServiceId); return; }

            var rawRule = rules[request.Action] ?? rules["OfficerAction"];
            if (rawRule == null || rawRule.Type == JTokenType.Null)
            {
                Log($"No rule configured for action '{request.Action}'; skipping.", request);
                return;
            }

            var rule = (JObject)rawRule;
            string channel = rule["channel"]?.ToString() ?? "Both";
            if (string.Equals(channel, "None", StringComparison.OrdinalIgnoreCase))
                return;

            string serviceName = service.Servicename ?? "";
            var targets = await ResolveRecipientsAsync(request, rule, serviceName);

            bool sendEmail = channel.Contains("mail", StringComparison.OrdinalIgnoreCase);
            bool sendSms = channel.Contains("sms", StringComparison.OrdinalIgnoreCase);

            string emailSubject = Render(rule["emailSubject"]?.ToString() ?? $"{serviceName} - {request.ReferenceNumber}", request, serviceName, null);
            string emailHtml = Render(rule["emailTemplate"]?.ToString() ?? "", request, serviceName, null);
            string smsText = Render(rule["smsTemplate"]?.ToString() ?? "", request, serviceName, null);

            foreach (var target in targets)
            {
                if (sendEmail && !string.IsNullOrWhiteSpace(target.Email))
                {
                    string to = target.Email, subject = emailSubject, html = emailHtml, name = target.Name;
                    byte[]? attach = request.AttachmentData; string? attachName = request.AttachmentName;
                    taskQueue.QueueBackgroundWorkItem(async _ =>
                    {
                        try
                        {
                            if (attach != null && attach.Length > 0)
                                await emailSender.SendEmailWithAttachments(to, subject, html, attach, attachName!);
                            else
                                await emailSender.SendEmail(to, subject, html);
                        }
                        catch (Exception ex) { logger.LogError(ex, "Email dispatch failed for {Ref} -> {To}", request.ReferenceNumber, to); }
                    });
                    Log($"Queued email for {request.Action} -> {name} <{to}>", request);
                }

                if (sendSms && !string.IsNullOrWhiteSpace(target.Mobile))
                {
                    string to = target.Mobile, text = StripHtml(smsText), name = target.Name;
                    taskQueue.QueueBackgroundWorkItem(async _ =>
                    {
                        try { await smsSender.SendSmsAsync(to, text); }
                        catch (Exception ex) { logger.LogError(ex, "SMS dispatch failed for {Ref} -> {To}", request.ReferenceNumber, to); }
                    });
                    Log($"Queued SMS for {request.Action} -> {name} <{to}>", request);
                }
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Notification dispatch failed for request {Action}/{Ref}", request.Action, request.ReferenceNumber);
        }
    }

    private async Task<List<NotificationTarget>> ResolveRecipientsAsync(NotificationRequest request, JObject rule, string serviceName)
    {
        var targets = new List<NotificationTarget>();
        var recipientFields = (JObject?)rule["recipientFields"];
        string citizenEmailField = recipientFields?["citizenEmail"]?.ToString() ?? "Email";
        string citizenMobileField = recipientFields?["citizenMobile"]?.ToString() ?? "MobileNumber";

        foreach (var recipientToken in rule["recipients"] as JArray ?? new JArray())
        {
            var recipient = (JObject?)recipientToken;
            string type = recipient?["type"]?.ToString() ?? "";

            switch (type)
            {
                case "Citizen":
                    targets.Add(new NotificationTarget
                    {
                        Name = referenceData.GetFieldValue("ApplicantName", request.FormDetails),
                        Email = referenceData.GetFieldValue(citizenEmailField, request.FormDetails),
                        Mobile = referenceData.GetFieldValue(citizenMobileField, request.FormDetails)
                    });
                    break;

                case "ActingOfficer":
                    if (request.ActingOfficerUserId is int actingId)
                    {
                        var acting = await dbcontext.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Userid == actingId);
                        if (acting != null)
                            targets.Add(new NotificationTarget { Name = acting.Name ?? "", Email = acting.Email ?? "", Mobile = acting.Mobilenumber ?? "" });
                    }
                    break;

                case "WorkflowStep":
                    int step = recipient?["step"]?.Value<int?>() ?? -1;
                    if (step >= 0 && request.ApplicationWorkflow != null && step < request.ApplicationWorkflow.Count)
                    {
                        var stepObj = (JObject?)request.ApplicationWorkflow[step];
                        string designation = stepObj?["designation"]?.ToString() ?? "";
                        string accessLevel = stepObj?["accessLevel"]?.ToString() ?? "";
                        if (!string.IsNullOrWhiteSpace(designation))
                        {
                            int? accessCode = ResolveAccessCode(accessLevel, request.FormDetails);
                            var officers = await FindOfficersAsync(designation, accessLevel, accessCode);
                            foreach (var o in officers)
                                targets.Add(new NotificationTarget { Name = o.Name ?? designation, Email = o.Email ?? "", Mobile = o.MobileNumber ?? "" });
                        }
                    }
                    break;
            }
        }

        return targets;
    }

    /// <summary>Derives the required officer access code for a location-bound workflow step.</summary>
    private int? ResolveAccessCode(string accessLevel, JObject formDetails)
    {
        switch (accessLevel)
        {
            case "Tehsil":
                return ParseInt(referenceData.GetFieldValue("Tehsil", formDetails));
            case "District":
                return ParseInt(referenceData.GetFieldValue("District", formDetails));
            case "Division":
            {
                int districtId = ParseInt(referenceData.GetFieldValue("District", formDetails)) ?? -1;
                var district = districtId > 0 ? dbcontext.District.AsNoTracking().FirstOrDefault(d => d.Districtid == districtId) : null;
                return district?.Division;
            }
            case "State":
            default:
                return null; // any officer of that role/access level
        }
    }

    private async Task<List<OfficerDetailsModal>> FindOfficersAsync(string designation, string accessLevel, int? accessCode)
    {
        const string sql = @"
            SELECT u.userid AS ""UserId"", u.name AS ""Name"", u.email AS ""Email"", u.mobilenumber AS ""MobileNumber""
            FROM users u
            WHERE u.usertype = 'Officer'
              AND u.additionaldetails ->> 'Role' = @role
              AND u.additionaldetails ->> 'AccessLevel' = @level
              AND (@code IS NULL OR (u.additionaldetails ->> 'AccessCode')::int = @code)";

        return await dbcontext.Database.SqlQueryRaw<OfficerDetailsModal>(
            sql,
            new NpgsqlParameter("@role", designation),
            new NpgsqlParameter("@level", accessLevel),
            new NpgsqlParameter("@code", (object?)accessCode ?? DBNull.Value) { IsNullable = true })
            .ToListAsync();
    }

    private static int? ParseInt(string value) =>
        int.TryParse(value, out int n) ? n : (int?)null;

    private string Render(string template, NotificationRequest request, string serviceName, Dictionary<string, string>? extra)
    {
        if (string.IsNullOrWhiteSpace(template)) return template;

        var values = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["ApplicantName"] = referenceData.GetFieldValue("ApplicantName", request.FormDetails),
            ["ServiceName"] = serviceName,
            ["ReferenceNumber"] = request.ReferenceNumber,
            ["OfficerRole"] = request.OfficerRole,
            ["OfficerArea"] = request.OfficerArea,
            ["ActionTaken"] = string.IsNullOrEmpty(request.ActionTaken) ? request.Action : request.ActionTaken,
        };

        foreach (var field in EnumerateFormFields(request.FormDetails))
        {
            values.TryAdd(field.Key, field.Value);
        }
        if (extra != null)
            foreach (var kv in extra) values.TryAdd(kv.Key, kv.Value);

        string date = DateTime.Now.ToString("dd MMM yyyy, hh:mm tt");
        string result = template;
        foreach (var kv in values)
            result = result.Replace($"{{{kv.Key}}}", kv.Value, StringComparison.OrdinalIgnoreCase);
        result = result.Replace("{Date}", date);
        return result;
    }

    private static IEnumerable<KeyValuePair<string, string>> EnumerateFormFields(JObject formDetails)
    {
        foreach (var section in formDetails)
        {
            if (section.Value is JArray fields)
            {
                foreach (var field in fields)
                {
                    string? name = field["name"]?.ToString();
                    if (!string.IsNullOrEmpty(name))
                        yield return new KeyValuePair<string, string>(name, field["value"]?.ToString() ?? "");
                }
            }
        }
    }

    private static string StripHtml(string input) =>
        Regex.Replace(input, "<[^>]*>", " ").Replace("&nbsp;", " ");

    private void Log(string message, NotificationRequest request) =>
        logger.LogInformation("NOTIFY: {Message} [svc={Svc}, action={Action}, ref={Ref}]",
            message, request.ServiceId, request.Action, request.ReferenceNumber);
}
