using Microsoft.Extensions.Caching.Memory;

public class OtpStore
{
    private IMemoryCache _cache;

    public OtpStore(IMemoryCache cache)
    {
        _cache = cache;
    }

    public void StoreOtp(string key, string otp)
    {
        // Set cache item options
        MemoryCacheEntryOptions options = new MemoryCacheEntryOptions();
        options.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5); // OTP expires after 5 minutes

        // Add OTP to cache
        _cache.Set(key, otp, options);
    }

    public string? RetrieveOtp(string key)
    {
        // Retrieve OTP from cache
        if (_cache.TryGetValue(key, out string? otp))
        {
            // Remove OTP from cache after it has been retrieved
            _cache.Remove(key);
            return otp;
        }

        return null;
    }
}
