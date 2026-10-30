using Microsoft.EntityFrameworkCore;
using SahayataNidhi.Models.Entities;

/// <summary>
/// Single source of truth for per-district/per-service application counters
/// used to generate sequential reference numbers.
/// Replaces three drifting copies of GetCountPerDistrict that previously lived in
/// OfficerControllerHelper.cs (non-atomic, hardcoded to "Corrigendum") and
/// UserControllerHelper.cs / UserControllerForm.cs.
/// </summary>
public class ApplicationCounterService(SwdjkContext dbContext, UserHelperFunctions helper, ILogger<ApplicationCounterService> logger)
    {
        private readonly SwdjkContext _dbContext = dbContext;
        private readonly UserHelperFunctions _helper = helper;
        private readonly ILogger<ApplicationCounterService> _logger = logger;

        /// <summary>
        /// Atomically gets-and-increments the yearly counter for the given
        /// district/service/type via the get_and_increment_count PG function,
        /// with a non-atomic EF fallback if the function call fails.
        /// </summary>
        public int NextCount(int districtId, int serviceId, string type)
        {
            var financialYear = _helper.GetCurrentFinancialYear();

            try
            {
                var parameters = new[]
                {
                    new Npgsql.NpgsqlParameter("p_district_id", districtId),
                    new Npgsql.NpgsqlParameter("p_service_id", serviceId),
                    new Npgsql.NpgsqlParameter("p_financial_year", financialYear),
                    new Npgsql.NpgsqlParameter("p_type", type ?? (object)DBNull.Value)
                };

                var result = _dbContext.Database
                    .SqlQueryRaw<int>("SELECT get_and_increment_count({0}, {1}, {2}, {3})",
                        parameters[0].Value!, parameters[1].Value!, parameters[2].Value!, parameters[3].Value!)
                    .ToList();

                return result.FirstOrDefault();
            }
            catch (Exception ex)
            {
                _logger.LogError("Error getting next application count: {Message}", ex.Message);

                // Fallback: get current count and increment (kept from the user-side copy)
                var existing = _dbContext.Applicationperdistrict
                    .FirstOrDefault(a => a.Districtid == districtId &&
                                        a.Serviceid == serviceId &&
                                        a.Financialyear == financialYear &&
                                        a.Type == type);

                if (existing != null)
                {
                    existing.Countvalue++;
                    _dbContext.SaveChanges();
                    return existing.Countvalue;
                }

                var newEntry = new Applicationperdistrict
                {
                    Districtid = districtId,
                    Serviceid = serviceId,
                    Financialyear = financialYear,
                    Type = type,
                    Countvalue = 1
                };
                _dbContext.Applicationperdistrict.Add(newEntry);
                _dbContext.SaveChanges();
                return newEntry.Countvalue;
            }
        }
}
