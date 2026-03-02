using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;
using Npgsql; // Added for PostgreSQL
using System.Data;
using SahayataNidhi.Models.Entities;

namespace SahayataNidhi.Controllers.Admin
{
    [Authorize(Roles = "Admin")]
    public partial class AdminController(SwdjkContext dbcontext, ILogger<AdminController> logger, UserHelperFunctions helper) : Controller
    {
        protected readonly SwdjkContext dbcontext = dbcontext;
        protected readonly ILogger<AdminController> _logger = logger;
        protected readonly UserHelperFunctions helper = helper;

        public override void OnActionExecuted(ActionExecutedContext context)
        {
            base.OnActionExecuted(context);
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var Admin = dbcontext.Users.FirstOrDefault(u => u.Userid.ToString() == userId);
            var additionalDetails = JsonConvert.DeserializeObject<Dictionary<string, object>>(Admin?.Additionaldetails ?? "{}");
            string AdminDesignation = additionalDetails!.TryGetValue("Role", out var roleObj) ? roleObj?.ToString() ?? "Unknown" : "Unknown";
            int departmentId = Convert.ToInt32(additionalDetails["Department"]);
            var department = dbcontext.Departments.FirstOrDefault(d => d.Departmentid == departmentId);
            string Profile = Admin!.Profile!;
            ViewData["AdminType"] = AdminDesignation;
            ViewData["UserName"] = Admin!.Username;
            ViewData["Profile"] = Profile == "" ? "/assets/dummyDocs/formImage.jpg" : Profile;
            ViewData["Department"] = department?.Departmentname ?? "Unknown";
        }

        public OfficerDetailsModal? GetOfficerDetails()
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
            {
                _logger.LogWarning("GetOfficerDetails: UserId is null. User is not authenticated or NameIdentifier claim is missing.");
                return null;
            }

            // Parse userId to integer for PostgreSQL function
            if (!int.TryParse(userId, out int parsedUserId))
            {
                _logger.LogWarning($"GetOfficerDetails: Invalid UserId format: {userId}");
                return null;
            }

            try
            {
                // Option 1: Using FromSqlRaw with parameter (if you have a DbSet)
                var officer = dbcontext.Set<OfficerDetailsModal>()
                    .FromSqlRaw("SELECT * FROM get_officer_details({0})", parsedUserId)
                    .AsEnumerable()
                    .FirstOrDefault();

                return officer;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error calling get_officer_details function for userId: {parsedUserId}");
                return null;
            }
        }

        // Alternative method using raw SQL query if the above doesn't work
        public OfficerDetailsModal? GetOfficerDetailsAlternative()
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
            {
                return null;
            }

            if (!int.TryParse(userId, out int parsedUserId))
            {
                return null;
            }

            try
            {
                using var command = dbcontext.Database.GetDbConnection().CreateCommand();
                command.CommandText = "SELECT * FROM get_officer_details(@p_user_id)";

                var parameter = command.CreateParameter();
                parameter.ParameterName = "@p_user_id";
                parameter.Value = parsedUserId;
                parameter.DbType = DbType.Int32;
                command.Parameters.Add(parameter);

                dbcontext.Database.OpenConnection();
                using var result = command.ExecuteReader();

                if (result.Read())
                {
                    var officer = new OfficerDetailsModal
                    {
                        UserId = result.GetInt32(result.GetOrdinal("user_id")),
                        Name = result.IsDBNull(result.GetOrdinal("name")) ? null : result.GetString(result.GetOrdinal("name")),
                        Username = result.IsDBNull(result.GetOrdinal("username")) ? null : result.GetString(result.GetOrdinal("username")),
                        Email = result.IsDBNull(result.GetOrdinal("email")) ? null : result.GetString(result.GetOrdinal("email")),
                        MobileNumber = result.IsDBNull(result.GetOrdinal("mobile_number")) ? null : result.GetString(result.GetOrdinal("mobile_number")),
                        Profile = result.IsDBNull(result.GetOrdinal("profile")) ? null : result.GetString(result.GetOrdinal("profile")),
                        UserType = result.IsDBNull(result.GetOrdinal("user_type")) ? null : result.GetString(result.GetOrdinal("user_type")),
                        IsEmailValid = !result.IsDBNull(result.GetOrdinal("is_email_valid")) && result.GetBoolean(result.GetOrdinal("is_email_valid")),
                        RegisteredDate = result.IsDBNull(result.GetOrdinal("registered_date")) ? null : result.GetString(result.GetOrdinal("registered_date")),
                        Role = result.IsDBNull(result.GetOrdinal("role")) ? null : result.GetString(result.GetOrdinal("role")),
                        RoleShort = result.IsDBNull(result.GetOrdinal("role_short")) ? null : result.GetString(result.GetOrdinal("role_short")),
                        AccessLevel = result.IsDBNull(result.GetOrdinal("access_level")) ? null : result.GetString(result.GetOrdinal("access_level")),
                        AccessCode = result.IsDBNull(result.GetOrdinal("access_code")) ? null : result.GetInt32(result.GetOrdinal("access_code")),
                        Department = result.IsDBNull(result.GetOrdinal("department")) ? null : result.GetInt32(result.GetOrdinal("department"))
                    };
                    return officer;
                }
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in GetOfficerDetailsAlternative");
                return null;
            }
            finally
            {
                dbcontext.Database.CloseConnection();
            }
        }

        [HttpGet]
        public IActionResult GetServiceList()
        {
            var officer = GetOfficerDetails();
            if (officer == null || string.IsNullOrEmpty(officer.Role))
            {
                return Json(new { serviceList = new List<OfficerServiceListModal>() });
            }

            try
            {
                // Option 1: Using Set<T> for non-DbSet DTOs
                var serviceList = dbcontext.Set<OfficerServiceListModal>()
                    .FromSqlRaw("SELECT * FROM get_services_by_role({0})", officer.Role)
                    .AsEnumerable()
                    .ToList();

                return Json(new { serviceList });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error calling get_services_by_role function for role: {officer.Role}");
                return Json(new { serviceList = new List<OfficerServiceListModal>() });
            }
        }

        // Alternative method using raw SQL query
        public List<OfficerServiceListModal> GetServiceListAlternative(string role)
        {
            var serviceList = new List<OfficerServiceListModal>();

            try
            {
                using var command = dbcontext.Database.GetDbConnection().CreateCommand();
                command.CommandText = "SELECT * FROM get_services_by_role(@p_role)";

                var parameter = command.CreateParameter();
                parameter.ParameterName = "@p_role";
                parameter.Value = role;
                parameter.DbType = DbType.String;
                command.Parameters.Add(parameter);

                dbcontext.Database.OpenConnection();
                using var result = command.ExecuteReader();

                while (result.Read())
                {
                    var service = new OfficerServiceListModal
                    {
                        ServiceId = result.GetInt32(result.GetOrdinal("service_id")),
                        ServiceName = result.IsDBNull(result.GetOrdinal("service_name")) ? null : result.GetString(result.GetOrdinal("service_name"))
                    };
                    serviceList.Add(service);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error in GetServiceListAlternative for role: {role}");
            }
            finally
            {
                dbcontext.Database.CloseConnection();
            }

            return serviceList;
        }
    }
}