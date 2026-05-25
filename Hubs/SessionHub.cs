// Hubs/SessionHub.cs
using Microsoft.AspNetCore.SignalR;

public class SessionHub : Hub
{
    public async Task RegisterSession(string userId, string sessionId)
    {
        // Add connection to a group keyed by user ID
        await Groups.AddToGroupAsync(Context.ConnectionId, $"user_{userId}");

        // Store mapping: sessionId -> connectionId for targeted logout
        await Clients.Caller.SendAsync("SessionRegistered", sessionId);
    }

    public async Task UnregisterSession(string userId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"user_{userId}");
    }
}