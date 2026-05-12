using NCrontab;
using System.Collections.Concurrent;
using Microsoft.EntityFrameworkCore;
using SahayataNidhi.Models.Entities;
using System.Reflection;

public interface ICronScheduler
{
    Task ScheduleTaskAsync(string cronExpression, string actionType, Func<CancellationToken, Task> action);
    Task UpdateCronAsync(string actionType, string newCronExpression);
}

public class CronScheduler : BackgroundService, ICronScheduler
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<CronScheduler> _logger;
    private readonly ConcurrentDictionary<string, (CrontabSchedule Schedule, string ActionType, Func<CancellationToken, Task> Action)> _scheduledTasks = new();
    private readonly ConcurrentDictionary<string, Func<CancellationToken, Task>> _actionRegistry = new();

    public CronScheduler(IServiceProvider serviceProvider, ILogger<CronScheduler> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    public async Task ScheduleTaskAsync(string cronExpression, string actionType, Func<CancellationToken, Task> action)
    {
        if (string.IsNullOrWhiteSpace(cronExpression)) throw new ArgumentNullException(nameof(cronExpression));
        if (string.IsNullOrWhiteSpace(actionType)) throw new ArgumentNullException(nameof(actionType));
        if (action == null) throw new ArgumentNullException(nameof(action));

        try
        {
            var schedule = CrontabSchedule.Parse(cronExpression, new CrontabSchedule.ParseOptions { IncludingSeconds = false });
            var taskId = Guid.NewGuid().ToString();

            _scheduledTasks[taskId] = (schedule, actionType, action);
            _actionRegistry[actionType] = action;

            using var scope = _serviceProvider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<SwdjkContext>();
            db.Scheduledjobs.Add(new Scheduledjobs
            {
                Id = Guid.Parse(taskId),
                Cronexpression = cronExpression,
                Actiontype = actionType,
                Lastexecutedat = null
            });
            await db.SaveChangesAsync();

            _logger.LogInformation("Scheduled task {TaskId} ({ActionType}) with CRON: {Cron}", taskId, actionType, cronExpression);
        }
        catch (CrontabException ex)
        {
            _logger.LogError(ex, "Invalid cron expression: {CronExpression}", cronExpression);
            throw;
        }
    }

    public async Task<List<Scheduledjobs>> GetAllJobsAsync()
    {
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SwdjkContext>();
        return await db.Scheduledjobs.ToListAsync();
    }

    public async Task UnscheduleTaskAsync(string taskId)
    {
        if (_scheduledTasks.TryRemove(taskId, out var removed))
        {
            using var scope = _serviceProvider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<SwdjkContext>();
            var job = await db.Scheduledjobs.FindAsync(Guid.Parse(taskId));
            if (job != null)
            {
                db.Scheduledjobs.Remove(job);
                await db.SaveChangesAsync();
            }
            _logger.LogInformation("Unscheduled task {TaskId} ({ActionType})", taskId, removed.ActionType);
        }
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Cron Scheduler starting...");
        await LoadPersistedJobsAsync(stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            var now = DateTime.Now;

            var tasksToRun = new List<KeyValuePair<string, (CrontabSchedule Schedule, string ActionType, Func<CancellationToken, Task> Action)>>();

            // Determine which tasks need to run
            foreach (var task in _scheduledTasks)
            {
                try
                {
                    using var scope = _serviceProvider.CreateScope();
                    var db = scope.ServiceProvider.GetRequiredService<SwdjkContext>();

                    var dbJob = await db.Scheduledjobs.FindAsync(Guid.Parse(task.Key), stoppingToken);
                    if (dbJob == null) continue;

                    // Use LastExecutedAt or CreatedAt as reference
                    var lastRun = dbJob.Lastexecutedat ?? dbJob.Createdat;

                    var nextRun = task.Value.Schedule.GetNextOccurrence(lastRun);

                    _logger.LogDebug(
                        "Evaluating job {ActionType} | LastRun: {LastRun} | NextRun: {NextRun} | Now: {Now}",
                        task.Value.ActionType,
                        lastRun,
                        nextRun,
                        now
                    );

                    if (nextRun <= now)
                    {
                        tasksToRun.Add(task);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error evaluating cron job {TaskId}", task.Key);
                }
            }

            // Execute tasks that are due
            foreach (var task in tasksToRun)
            {
                var (schedule, actionType, action) = task.Value;

                _ = Task.Run(async () =>
                {
                    try
                    {
                        _logger.LogInformation(
                            "Executing task {TaskId} ({ActionType}) at {Time}",
                            task.Key,
                            actionType,
                            DateTime.Now
                        );

                        using var scope = _serviceProvider.CreateScope();
                        var cronServices = scope.ServiceProvider.GetRequiredService<CronServices>();

                        switch (actionType)
                        {
                            case "NotifyExpiringEligibilities":
                                await cronServices.NotifyExpiringEligibilities("1", stoppingToken);
                                break;

                            default:
                                _logger.LogWarning("Unknown cron action {ActionType}", actionType);
                                return;
                        }

                        var db = scope.ServiceProvider.GetRequiredService<SwdjkContext>();
                        var dbJob = await db.Scheduledjobs.FindAsync(Guid.Parse(task.Key), stoppingToken);

                        if (dbJob != null)
                        {
                            dbJob.Lastexecutedat = DateTime.Now;
                            await db.SaveChangesAsync(stoppingToken);
                        }

                        _logger.LogInformation(
                            "Executed task {TaskId} ({ActionType}) successfully",
                            task.Key,
                            actionType
                        );
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(
                            ex,
                            "Failed to execute task {TaskId} ({ActionType})",
                            task.Key,
                            actionType
                        );
                    }
                }, stoppingToken);
            }

            // Compute next sleep time based on LastExecutedAt, not now
            var nextOccurrences = new List<DateTime>();
            foreach (var task in _scheduledTasks)
            {
                try
                {
                    using var scope = _serviceProvider.CreateScope();
                    var db = scope.ServiceProvider.GetRequiredService<SwdjkContext>();

                    var dbJob = await db.Scheduledjobs.FindAsync(Guid.Parse(task.Key), stoppingToken);
                    if (dbJob == null) continue;

                    var lastRun = dbJob.Lastexecutedat ?? dbJob.Createdat;
                    var next = task.Value.Schedule.GetNextOccurrence(lastRun);

                    if (next > now)
                        nextOccurrences.Add(next);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error computing next occurrence for job {TaskId}", task.Key);
                }
            }

            // Sleep until the next task is due
            var delay = nextOccurrences.Any()
                ? nextOccurrences.Min() - now
                : TimeSpan.FromSeconds(10);

            _logger.LogDebug("Scheduler sleeping for {Delay}", delay > TimeSpan.Zero ? delay : TimeSpan.FromMilliseconds(100));

            await Task.Delay(delay > TimeSpan.Zero ? delay : TimeSpan.FromMilliseconds(100), stoppingToken);
        }

        _logger.LogInformation("Cron Scheduler stopped.");
    }
    private async Task LoadPersistedJobsAsync(CancellationToken ct)
    {
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SwdjkContext>();
        var jobs = await db.Scheduledjobs.ToListAsync(ct);

        foreach (var job in jobs)
        {
            try
            {
                var schedule = CrontabSchedule.Parse(job.Cronexpression, new CrontabSchedule.ParseOptions { IncludingSeconds = false });
                var action = _actionRegistry.GetValueOrDefault(job.Actiontype) ?? (ct => Task.CompletedTask);

                _scheduledTasks[job.Id.ToString()] = (schedule, job.Actiontype, action);
                _logger.LogInformation("Loaded job {JobId} ({ActionType})", job.Id, job.Actiontype);
            }
            catch (CrontabException ex)
            {
                _logger.LogError(ex, "Invalid cron in DB for job {JobId}. Skipping.", job.Id);
            }
        }
    }

    public async Task UpdateCronAsync(string actionType, string newCronExpression)
    {
        if (string.IsNullOrWhiteSpace(actionType))
            throw new ArgumentNullException(nameof(actionType));
        if (string.IsNullOrWhiteSpace(newCronExpression))
            throw new ArgumentNullException(nameof(newCronExpression));

        // Validate cron expression
        CrontabSchedule newSchedule;
        try
        {
            newSchedule = CrontabSchedule.Parse(newCronExpression, new CrontabSchedule.ParseOptions { IncludingSeconds = false });
        }
        catch (CrontabException ex)
        {
            _logger.LogError(ex, "Invalid cron expression: {CronExpression}", newCronExpression);
            throw;
        }

        // Find the task entry by actionType
        var entry = _scheduledTasks.FirstOrDefault(kvp => kvp.Value.ActionType == actionType);
        if (entry.Key == null)
        {
            _logger.LogWarning("No scheduled task found with ActionType '{ActionType}' to update.", actionType);
            return;
        }

        // Update in-memory schedule
        var (_, _, action) = entry.Value;
        _scheduledTasks[entry.Key] = (newSchedule, actionType, action);

        // Update database record
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SwdjkContext>();
        var job = await db.Scheduledjobs.FindAsync(Guid.Parse(entry.Key));
        if (job != null)
        {
            job.Cronexpression = newCronExpression;
            await db.SaveChangesAsync();
            _logger.LogInformation("Updated cron for task '{ActionType}' to '{CronExpression}'", actionType, newCronExpression);
        }
        else
        {
            _logger.LogWarning("Database record for task '{ActionType}' not found.", actionType);
        }
    }

    private Task<Func<CancellationToken, Task>?> ResolveActionFromDIAsync(
     string actionType,
     CancellationToken ct)
    {
        using var scope = _serviceProvider.CreateScope();
        var cronServices = scope.ServiceProvider.GetService<CronServices>();
        if (cronServices == null)
            return Task.FromResult<Func<CancellationToken, Task>?>(null);

        var method = cronServices.GetType()
            .GetMethod(actionType, BindingFlags.Public | BindingFlags.Instance);

        if (method?.ReturnType != typeof(Task))
            return Task.FromResult<Func<CancellationToken, Task>?>(null);

        Func<CancellationToken, Task> action = async token =>
        {
            var parameters = method.GetParameters();
            var args = new object?[parameters.Length];

            for (int i = 0; i < parameters.Length; i++)
            {
                var p = parameters[i];
                if (p.ParameterType == typeof(string)) args[i] = "1";
                else if (p.ParameterType == typeof(CancellationToken)) args[i] = token;
                else args[i] = null;
            }

            await (Task)method.Invoke(cronServices, args)!;
        };

        _actionRegistry[actionType] = action;
        return Task.FromResult<Func<CancellationToken, Task>?>(action);
    }

}