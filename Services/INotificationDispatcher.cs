namespace SahayataNidhi.Services;

public interface INotificationDispatcher
{
    /// <summary>
    /// Looks up the configured notification rule for (service, action) and dispatches
    /// email and/or SMS to the configured recipients on the background queue.
    /// Never throws to the caller — failures are logged per send.
    /// </summary>
    Task DispatchAsync(NotificationRequest request);
}
