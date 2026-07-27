using Microsoft.EntityFrameworkCore;
using SahayataNidhi.Models.Entities;

public class SessionRepository
{
    private readonly SwdjkContext _dbContext;
    private readonly ILogger<SessionRepository> _logger = LoggerFactory.Create(builder => builder.AddConsole()).CreateLogger<SessionRepository>();

    public SessionRepository(SwdjkContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<Usersessions?> GetActiveSessionAsync(int userId)
    {
        _logger.LogInformation(
            $"Checking for active session for user ID: {userId}"
        );

        var threshold = DateTime.Now.AddMinutes(-30);

        return await _dbContext.Usersessions
            .Where(s => s.Userid == userId && s.Lastactivitytime > threshold)
            .FirstOrDefaultAsync();
    }

    public async Task<Usersessions?> GetSessionByIdAsync(Guid sessionId)
    {
        return await _dbContext.Usersessions.FirstOrDefaultAsync(s => s.Sessionid == sessionId);
    }
    public async Task AddSessionAsync(Usersessions session)
    {
        _dbContext.Usersessions.Add(session);
        await _dbContext.SaveChangesAsync();
    }

    public async Task RemoveSessionAsync(Usersessions session)
    {
        _dbContext.Usersessions.Remove(session);
        await _dbContext.SaveChangesAsync();
    }

    public async Task UpdateLastActivityAsync(Usersessions session)
    {
        session.Lastactivitytime = DateTime.Now;
        await _dbContext.SaveChangesAsync();
    }

    public async Task DeleteSessionsByUser(int userId)
    {
        var sessions = _dbContext.Usersessions.Where(s => s.Userid == userId);
        _dbContext.Usersessions.RemoveRange(sessions);
        await _dbContext.SaveChangesAsync();
    }

    public async Task<bool> SessionExists(Guid sessionId)
    {
        return await _dbContext.Usersessions.AnyAsync(s => s.Sessionid == sessionId);
    }

    // Optional: if you need to delete a single session by ID (for logout)
    public async Task DeleteSessionById(Guid sessionId)
    {
        var rowsAffected = await _dbContext.Usersessions
            .Where(s => s.Sessionid == sessionId)
            .ExecuteDeleteAsync();

        if (rowsAffected == 0)
        {
            _logger.LogInformation("Session {SessionId} already deleted or not found", sessionId);
        }
    }

    public async Task<bool> HasActiveSession(int userId)
    {
        return await _dbContext.Usersessions.AnyAsync(s => s.Userid == userId);
    }
}
