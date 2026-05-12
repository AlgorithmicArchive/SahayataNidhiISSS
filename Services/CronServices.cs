using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json.Linq;
using SahayataNidhi.Models.Entities;
using System.Reflection;
using Npgsql;

public class CronServices
{
    private readonly SwdjkContext _dbcontext;
    private readonly IEmailSender _emailSender;
    private readonly ILogger<CronServices> _logger;
    private readonly ICronScheduler _scheduler;

    public CronServices(
        SwdjkContext dbcontext,
        IEmailSender emailSender,
        ILogger<CronServices> logger,
        ICronScheduler scheduler)
    {
        _dbcontext = dbcontext;
        _emailSender = emailSender;
        _logger = logger;
        _scheduler = scheduler;
    }

    // === Task: Notify Expiring Eligibilities ===    

    public async Task NotifyExpiringEligibilities(string? serviceId = "1", CancellationToken ct = default)
    {
        if (!int.TryParse(serviceId, out int svcId))
        {
            _logger.LogWarning("Invalid ServiceId: {ServiceId}", serviceId);
            return;
        }

        var today = DateOnly.FromDateTime(DateTime.Today);

        // Fetch all active expirations with their associated expiration type
        var expiringRecords = await _dbcontext.ApplicationExpirations
            .Include(e => e.ExpirationType)
            .Where(e => e.ServiceId == svcId)
            .Where(e => e.IsActive == true)
            .Where(e => e.Email != null)
            .Where(e => e.MailSentCount == 0)   // only those not yet notified
            .Where(e => e.ExpirationDate >= today) // not already expired (optional, maybe include grace period)
            .ToListAsync(ct);

        int mailSentCount = 0;

        foreach (var exp in expiringRecords)
        {
            if (ct.IsCancellationRequested) break;

            var expType = exp.ExpirationType;
            if (expType == null) continue;

            // Determine the notification start date based on reminder_before
            DateOnly reminderStartDate = exp.ExpirationDate;
            if (!string.IsNullOrEmpty(expType.ReminderBefore))
            {
                if (TryParseInterval(expType.ReminderBefore, out TimeSpan reminderBefore))
                {
                    reminderStartDate = exp.ExpirationDate.AddDays((int)-reminderBefore.TotalDays);
                }
            }

            // Skip if today is before the reminder window
            if (today < reminderStartDate)
                continue;

            // Fetch applicant name from citizen_applications
            string applicantName = "";
            var application = await _dbcontext.CitizenApplications
                .FirstOrDefaultAsync(a => a.Referencenumber == exp.Referencenumber, ct);
            if (application != null)
            {
                applicantName = ExtractFieldFromJson(application.Formdetails, "ApplicantName");
            }

            // Prepare email content
            string subject = $"{expType.ExpirationName} Expiry Notification";
            var placeholders = new Dictionary<string, string>
            {
                { "ApplicantName", applicantName },
                { "ReferenceNumber", exp.Referencenumber },
                { "CertificateName", expType.ExpirationName },
                { "ExpiryDate", exp.ExpirationDate.ToString("dd MMM yyyy") }
            };

            string messageBody = BuildEmailMessage(expType.MessageTemplate, placeholders);

            try
            {
                await _emailSender.SendEmail(exp.Email!, subject, messageBody);

                exp.MailSentCount++;
                exp.LastNotifiedAt = DateTime.UtcNow;
                await _dbcontext.SaveChangesAsync(ct);

                mailSentCount++;
                _logger.LogInformation("Sent {Type} expiry email to {Email} for RefNo {RefNo}",
                    expType.ExpirationName, exp.Email, exp.Referencenumber);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send expiry email for RefNo {RefNo}", exp.Referencenumber);
            }
        }

        _logger.LogInformation("Processed {Total} expiring records, sent {Sent} emails", expiringRecords.Count, mailSentCount);
    }

    // Helper: Parse interval string like "3 months" or "1 year" to TimeSpan (approx)
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

    // Helper: Build email message from template or fallback
    private string BuildEmailMessage(string? template, Dictionary<string, string> placeholders)
    {
        if (string.IsNullOrEmpty(template))
        {
            // Default fallback template
            template = @"
            <div style='font-family: Arial, sans-serif;'>
                <h2 style='color: #2e6c80;'>{CertificateName} Expiring Soon</h2>
                <p><strong>{ApplicantName}</strong>,</p>
                <p>
                    Your {CertificateName} linked to application <strong>{ReferenceNumber}</strong>
                    is expiring on <strong>{ExpiryDate}</strong>.
                </p>
                <p>Please renew it to continue receiving benefits.</p>
            </div>";
        }

        foreach (var kvp in placeholders)
        {
            template = template.Replace($"{{{kvp.Key}}}", kvp.Value);
        }

        return template;
    }
    // Helper: Extract a field value from the JSON formdetails (same as before)
    private string ExtractFieldFromJson(string? formDetailsJson, string fieldName)
    {
        if (string.IsNullOrEmpty(formDetailsJson)) return "";
        try
        {
            var json = JObject.Parse(formDetailsJson);
            if (json.TryGetValue("Applicant Details", out var applicantToken) && applicantToken is JArray applicantArray)
            {
                foreach (var field in applicantArray)
                {
                    if (field["name"]?.ToString() == fieldName)
                        return field["value"]?.ToString() ?? "";
                }
            }
        }
        catch { /* ignore */ }
        return "";
    }

    // === Self-register all public async Task methods (excluding RegisterAllTasksAsync) ===
    public async Task RegisterAllTasksAsync(CancellationToken ct = default)
    {
        var methods = GetType()
            .GetMethods(BindingFlags.Public | BindingFlags.Instance)
            .Where(m => m.ReturnType == typeof(Task) && m.Name != nameof(RegisterAllTasksAsync))
            .ToList();

        foreach (var method in methods)
        {
            string actionType = method.Name;

            // Fetch the job configuration from DB
            var jobConfig = await _dbcontext.Scheduledjobs
                .FirstOrDefaultAsync(j => j.Actiontype == actionType, ct);

            string cronExpression = jobConfig?.Cronexpression ?? GetDefaultCronForTask(actionType);

            var action = CreateActionDelegate(method);

            if (jobConfig == null)
            {
                // New task: insert into DB and schedule
                _dbcontext.Scheduledjobs.Add(new Scheduledjobs
                {
                    Id = Guid.NewGuid(),
                    Actiontype = actionType,
                    Cronexpression = cronExpression,
                    Createdat = DateTime.UtcNow
                });
                await _dbcontext.SaveChangesAsync(ct);
                await _scheduler.ScheduleTaskAsync(cronExpression, actionType, action);
                _logger.LogInformation("Registered new task {MethodName} with CRON {Cron}", actionType, cronExpression);
            }
            else
            {
                // Existing task: schedule with DB cron (and update if needed)
                await _scheduler.ScheduleTaskAsync(cronExpression, actionType, action);
                _logger.LogInformation("Scheduled existing task {MethodName} with CRON {Cron}", actionType, cronExpression);
            }
        }
    }

    private string GetDefaultCronForTask(string actionType)
    {
        // Define fallback crons per task (optional)
        return actionType switch
        {
            nameof(NotifyExpiringEligibilities) => "0 9 * * *",  // 9 AM daily
            _ => "0 0 * * *"  // midnight default
        };
    }

    private Func<CancellationToken, Task> CreateActionDelegate(MethodInfo method)
    {
        return async (CancellationToken token) =>
        {
            try
            {
                var parameters = method.GetParameters();
                var args = new object?[parameters.Length];

                for (int i = 0; i < parameters.Length; i++)
                {
                    var p = parameters[i];
                    if (p.ParameterType == typeof(string))
                        args[i] = "1";  // default serviceId, could be improved
                    else if (p.ParameterType == typeof(CancellationToken))
                        args[i] = token;
                    else
                        args[i] = null;
                }

                await (Task)method.Invoke(this, args)!;
                _logger.LogDebug("Executed scheduled task: {MethodName}", method.Name);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error executing scheduled task: {MethodName}", method.Name);
                throw;
            }
        };
    }
}