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

        string accessLevel = "State";
        int? accessCode = 0;
        string takenBy = "";
        int? divisionCode = null;
        string resultType = "expiringeligibility";
        int pageIndex = 0, pageSize = 10;

        var applications = await _dbcontext.CitizenApplications
            .FromSqlRaw(
                "SELECT * FROM get_disability_applications(@p_access_level, @p_access_code, @p_service_id, @p_taken_by, @p_division_code, @p_result_type, @p_page_number, @p_page_size)",
                new NpgsqlParameter("@p_access_level", accessLevel),
                new NpgsqlParameter("@p_access_code", accessCode ?? (object)DBNull.Value),
                new NpgsqlParameter("@p_service_id", svcId),
                new NpgsqlParameter("@p_taken_by", takenBy),
                new NpgsqlParameter("@p_division_code", divisionCode ?? (object)DBNull.Value),
                new NpgsqlParameter("@p_result_type", resultType),
                new NpgsqlParameter("@p_page_number", pageIndex + 1),
                new NpgsqlParameter("@p_page_size", pageSize))
            .ToListAsync(ct);

        int mailSentCount = 0;

        foreach (var application in applications)
        {
            if (ct.IsCancellationRequested) break;

            // Try to parse FormDetails as JToken to get ApplicantName and Email
            string applicantName = "";
            string email = "";

            try
            {
                var formDetailsObj = JToken.Parse(application.Formdetails ?? "{}");

                // Check if it's the new JSON structure with sections
                if (formDetailsObj is JObject jObj && jObj.ContainsKey("Applicant Details"))
                {
                    var applicantDetails = jObj["Applicant Details"];
                    if (applicantDetails is JArray applicantArray)
                    {
                        foreach (var field in applicantArray)
                        {
                            if (field["name"]?.ToString() == "ApplicantName")
                                applicantName = field["value"]?.ToString() ?? "";
                            if (field["name"]?.ToString() == "Email")
                                email = field["value"]?.ToString() ?? "";
                        }
                    }
                }
                else
                {
                    // Fallback to direct property access (old structure)
                    applicantName = formDetailsObj["ApplicantName"]?.ToString() ?? "";
                    email = formDetailsObj["Email"]?.ToString() ?? "";
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to parse FormDetails for application {Referencenumber}", application.Referencenumber);
                continue;
            }

            if (string.IsNullOrEmpty(email)) continue;

            var expiringApplication = await _dbcontext.Applicationswithexpiringeligibility
                .FirstOrDefaultAsync(ae => ae.Referencenumber == application.Referencenumber, ct);

            if (expiringApplication == null) continue;

            DateTime expirationDate;
            if (!DateTime.TryParse(expiringApplication.ExpirationDate, out expirationDate))
            {
                _logger.LogWarning("Invalid expiration date format for {Referencenumber}: {Date}",
                    application.Referencenumber, expiringApplication.ExpirationDate);
                continue;
            }

            string htmlMessage = $@"
                <div style='font-family: Arial, sans-serif;'>
                    <h2 style='color: #2e6c80;'>UDID Card Validity Expiring</h2>
                    <p><strong>{applicantName}</strong>,</p>
                    <p>
                        Your UDID Card linked to application <strong>{application.Referencenumber}</strong>
                        is expiring on <strong>{expirationDate:dd MMM yyyy}</strong>.
                    </p>
                    <p>Please renew your UDID card to continue receiving financial assistance.</p>
                </div>";

            expiringApplication.MailSent++;
            await _dbcontext.SaveChangesAsync(ct);
            await _emailSender.SendEmail(email, "UDID Card Expiry Notification", htmlMessage);
            mailSentCount++;
        }

        _logger.LogInformation("Processed {Count} applications, sent {Mails} mails", applications.Count, mailSentCount);
    }

    // === Self-register all public async Task methods (excluding RegisterAllTasksAsync) ===
    public async Task RegisterAllTasksAsync(string cronExpression = "0 9 * * *", CancellationToken ct = default)
    {
        var methods = GetType()
            .GetMethods(BindingFlags.Public | BindingFlags.Instance)
            .Where(m => m.ReturnType == typeof(Task) && m.Name != nameof(RegisterAllTasksAsync))
            .ToList();

        foreach (var method in methods)
        {
            string actionType = method.Name;

            // Build delegate with default args
            var action = async (CancellationToken token) =>
            {
                try
                {
                    var parameters = method.GetParameters();
                    var args = new object?[parameters.Length];

                    for (int i = 0; i < parameters.Length; i++)
                    {
                        var p = parameters[i];
                        if (p.ParameterType == typeof(string) && p.HasDefaultValue)
                            args[i] = p.DefaultValue;
                        else if (p.ParameterType == typeof(string))
                            args[i] = "1"; // default serviceId
                        else if (p.ParameterType == typeof(CancellationToken))
                            args[i] = token;
                        else
                            args[i] = null;
                    }

                    await (Task)method.Invoke(this, args)!;
                    _logger.LogDebug("Successfully executed scheduled task: {MethodName}", actionType);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error executing scheduled task: {MethodName}", actionType);
                    throw;
                }
            };

            await _scheduler.ScheduleTaskAsync(cronExpression, actionType, action);
            _logger.LogInformation("Registered and scheduled {MethodName} with CRON {Cron}", actionType, cronExpression);
        }
    }
}