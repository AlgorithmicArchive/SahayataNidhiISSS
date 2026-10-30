using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using SahayataNidhi.Models.Entities;

public class SessionRepository(SwdjkContext dbContext, ILogger<SessionRepository> logger, IMemoryCache cache)
{
    private readonly SwdjkContext _dbContext = dbContext;
    private readonly ILogger<SessionRepository> _logger = logger;
    private readonly IMemoryCache _cache = cache;

    // SessionValidationFilter caches "session exists" lookups under this key
    // format for 2 minutes; whenever a session is removed/revoked we must evict
    // the cached entry so revocation takes effect immediately.
    private void EvictSessionCache(Guid sessionId)
    {
        _cache.Remove($"session_exists_{sessionId}");
    }

    private void EvictAllSessionCaches(int userId)
    {
        if (_cache is MemoryCache mc)
        {
            var keys = new List<object>();
            foreach (var entry in mc.Keys)
                if (entry is string s && s.StartsWith("session_exists_"))
                    keys.Add(entry);
            foreach (var key in keys)
                _cache.Remove(key);
        }
    }

    public async Task<Usersessions?> GetActiveSessionAsync(int userId)
    {
        _logger.LogInformation("Checking for active session for user ID: {UserId}", userId);
        var threshold = DateTime.UtcNow.AddMinutes(-30);

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
        EvictSessionCache(session.Sessionid);
    }

    public async Task UpdateLastActivityAsync(Usersessions session)
    {
        session.Lastactivitytime = DateTime.UtcNow;
        await _dbContext.SaveChangesAsync();
    }

    // OPTIMIZATION: Use ExecuteDeleteAsync to avoid loading entities into memory
    public async Task DeleteSessionsByUser(int userId)
    {
        await _dbContext.Usersessions.Where(s => s.Userid == userId).ExecuteDeleteAsync();
        EvictAllSessionCaches(userId);
    }

    public async Task<bool> SessionExists(Guid sessionId)
    {
        return await _dbContext.Usersessions.AnyAsync(s => s.Sessionid == sessionId);
    }

    public async Task DeleteSessionById(Guid sessionId)
    {
        var rowsAffected = await _dbContext.Usersessions
            .Where(s => s.Sessionid == sessionId)
            .ExecuteDeleteAsync();

        if (rowsAffected == 0)
            _logger.LogInformation("Session {SessionId} already deleted or not found", sessionId);
        else
            EvictSessionCache(sessionId);
    }

    public async Task<bool> HasActiveSession(int userId)
    {
        var threshold = DateTime.UtcNow.AddMinutes(-30);
        return await _dbContext.Usersessions.AnyAsync(s => s.Userid == userId && s.Lastactivitytime > threshold);
    }
}