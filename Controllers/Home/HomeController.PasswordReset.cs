using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using SahayataNidhi.Models;
using SahayataNidhi.Models.Entities;

namespace SahayataNidhi.Controllers
{
    public partial class HomeController
    {
        [HttpPost]
        public IActionResult GetAccountsForPasswordReset([FromForm] IFormCollection form)
        {
            string email = form["email"].ToString();
            if (string.IsNullOrEmpty(email) || !Regex.IsMatch(email?.Trim()!, @"^[\w\.-]+@([\w-]+\.)+[\w-]{2,}$"))
            {
                return Json(new { status = false, message = "Please provide a valid email address." });
            }

            var users = _dbContext.Users.Where(u => u.Email == email).ToList();
            if (!users.Any())
            {
                return Json(new { status = false, message = "No account found with this email." });
            }

            var accounts = users.Select(u => new
            {
                userId = u.Userid,
                username = u.Username,
                maskedUsername = MaskUsername(u.Username!),
                userType = u.Usertype
            }).ToList();

            string fullName = users.First().Name ?? "User";
            string currentDateTime = DateTime.Now.AddHours(5.5)
                .ToString("dd MMM yyyy, hh:mm tt") + " IST";
            string accountsList = string.Join(", ", users.Select(u => $"{MaskUsername(u.Username!)} (Type: {u.Usertype})"));

            string htmlMessage = $@"
            <div style='font-family: Arial, sans-serif;'>
                <h2 style='color: #2e6c80;'>Your Accounts for Password Reset</h2>
                <p>Dear {fullName},</p>
                <p>The following accounts are associated with your email:</p>
                <ul>
                    {string.Join("", users.Select(u => $"<li><strong>{MaskUsername(u.Username!)}</strong> (Type: {u.Usertype})</li>"))}
                </ul>
                <p>Please select an account in the application to proceed with the password reset.</p>
                <p>This information was requested on {currentDateTime}.</p>
                <p>If you did not request this, please contact support immediately.</p>
                <br />
                <p style='font-size: 12px; color: #888;'>Thank you,<br />Your Application Team</p>
            </div>";

            try
            {
                _emailSender.SendEmail(email!, "Your Accounts for Password Reset", htmlMessage).GetAwaiter().GetResult();
            }
            catch (Exception ex)
            {
                _logger.LogWarning($"Failed to send email: {ex.Message}. Accounts: {accountsList}");
                return Json(new { status = true, message = $"Email sending is not working on demo portal. Your accounts are: {accountsList}", accounts });
            }

            return Json(new { status = true, message = "Accounts found. Please select an account to reset the password.", accounts });
        }

        [HttpPost]
        [EnableRateLimiting("AuthEndpoints")]
        public async Task<IActionResult> SendPasswordResetOtp([FromForm] IFormCollection form)
        {
            string email = form["email"].ToString();
            string userId = form["userId"].ToString();
            if (string.IsNullOrEmpty(email) || !Regex.IsMatch(email?.Trim()!, @"^[\w\.-]+@([\w-]+\.)+[\w-]{2,}$"))
            {
                return Json(new { status = false, message = "Please provide a valid email address." });
            }
            if (string.IsNullOrEmpty(userId))
            {
                return Json(new { status = false, message = "User ID is required." });
            }

            var user = _dbContext.Users.FirstOrDefault(u => u.Email == email && u.Userid == Convert.ToInt32(userId));
            if (user == null)
            {
                return Json(new { status = false, message = "No account found with this email and user ID." });
            }

            string otpKey = $"otp:{user.Userid}";
            string userName = user.Name ?? "User";
            string otp = GenerateOTP(6);
            _otpStore.StoreOtp(otpKey, otp);

            string htmlMessage = $@"
            <div style='font-family: Arial, sans-serif;'>
                <h2 style='color: #2e6c80;'>Your OTP Code for Password Reset</h2>
                <p>Dear {userName},</p>
                <p>Use the following One-Time Password (OTP) to reset your password for account with Username: {MaskUsername(user.Username!)} (Type: {user.Usertype}). It is valid for <strong>5 minutes</strong>.</p>
                <div style='font-size: 24px; font-weight: bold; color: #333; margin: 20px 0;'>{otp}</div>
                <p>If you did not request a password reset, please ignore this email.</p>
                <br />
                <p style='font-size: 12px; color: #888;'>Thank you,<br />Your Application Team</p>
            </div>";

            try
            {
                await _emailSender.SendEmail(email!, "OTP for Password Reset", htmlMessage);
            }
            catch (Exception ex)
            {
                return Json(new { status = true, message = $"Email and Mobile OTP sending is not working" });
            }
            return Json(new { status = true, message = "OTP sent to your email." });
        }

        [HttpPost]
        public async Task<IActionResult> SendUsernameToEmail([FromForm] IFormCollection form)
        {
            string email = form["email"].ToString();
            if (string.IsNullOrEmpty(email) || !Regex.IsMatch(email.Trim(), @"^[\w\.-]+@([\w-]+\.)+[\w-]{2,}$"))
            {
                return Json(new { status = false, message = "Please provide a valid email address." });
            }

            var users = _dbContext.Users.Where(u => u.Email == email).ToList();
            if (!users.Any())
            {
                return Json(new { status = false, message = "No account found with this email." });
            }

            string fullName = users.First().Name ?? "User";
            string currentDateTime = DateTime.Now.AddHours(5.5)
                .ToString("dd MMM yyyy, hh:mm tt") + " IST";
            string usernamesList = string.Join(", ", users.Select(u => $"{u.Username} (Type: {u.Usertype})"));

            string htmlMessage = $@"
            <div style='font-family: Arial, sans-serif;'>
                <h2 style='color: #2e6c80;'>Your Username Retrieval</h2>
                <p>{fullName},</p>
                <p>Your usernames are:</p>
                <ul>
                    {string.Join("", users.Select(u => $"<li><strong>{u.Username}</strong> (Type: {u.Usertype})</li>"))}
                </ul>
                <p>This information was requested on {currentDateTime}.</p>
                <p>If you did not request this, please contact support immediately.</p>
                <br />
                <p style='font-size: 12px; color: #888;'>Thank you,<br />Your Application Team</p>
            </div>";

            try
            {
                await _emailSender.SendEmail(email, "Your Username", htmlMessage);
            }
            catch (Exception ex)
            {
                return Json(new { status = true, message = $"Email and Mobile OTP sending is not working" });
            }
            return Json(new { status = true, message = "Usernames have been sent to your email.", usernames = usernamesList });
        }

        public class ResetPasswordResult
        {
            public int Result { get; set; }
            public string? Message { get; set; }
            public int Userid { get; set; }
        }

        [HttpPost]
        [EnableRateLimiting("AuthEndpoints")]
        public async Task<IActionResult> ValidateOtpAndResetPassword([FromForm] IFormCollection form)
        {
            string email = form["email"].ToString();
            string userId = form["userId"].ToString();
            string otp = form["otp"].ToString();
            string newPassword = form["newPassword"].ToString();

            if (!IsStrongPassword(newPassword, _configuration, out var passwordError))
            {
                return Json(new { status = false, response = passwordError });
            }

            if (string.IsNullOrEmpty(email) || !Regex.IsMatch(email, @"^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$"))
            {
                return Json(new { status = false, message = "Please provide a valid email address." });
            }

            if (string.IsNullOrEmpty(userId))
            {
                return Json(new { status = false, message = "User ID is required." });
            }

            if (string.IsNullOrEmpty(otp) || !Regex.IsMatch(otp, @"^\d{6}$"))
            {
                return Json(new { status = false, message = "Please provide a valid 6-digit OTP." });
            }

            if (string.IsNullOrEmpty(newPassword) || newPassword.Length < 8)
            {
                return Json(new { status = false, message = "Password must be at least 8 characters long." });
            }

            var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.Email == email && u.Userid == Convert.ToInt32(userId));
            if (user == null)
            {
                return Json(new { status = false, message = "No account found with this email and user ID." });
            }

            string otpKey = $"otp:{user.Userid}";
            var storedOtp = _otpStore.RetrieveOtp(otpKey);

            if (storedOtp == null || storedOtp != otp)
            {
                return Json(new { status = false, message = "Invalid or expired OTP." });
            }

            try
            {
                // PostgreSQL function call with Npgsql parameters
                var parameters = new[]
                {
                    new NpgsqlParameter("p_email", email),
                    new NpgsqlParameter("p_userid", Convert.ToInt32(userId)),
                    new NpgsqlParameter("p_newpassword", newPassword)
                };

                var result = await _dbContext.Database
                    .SqlQueryRaw<ResetPasswordResult>("SELECT * FROM resetuserpassword({0}, {1}, {2})",
                        parameters[0].Value!, parameters[1].Value!, parameters[2].Value!)
                    .ToListAsync();

                var resetResult = result.FirstOrDefault();
                if (resetResult != null && resetResult.Result == 1)
                {
                    _otpStore.RetrieveOtp(otpKey); // Clear OTP after successful reset
                    _auditService.InsertLog(HttpContext, "Reset Password", "Password reset successfully.", user.Userid, "Success");
                    return Json(new { status = true, message = resetResult.Message });
                }
                else
                {
                    _auditService.InsertLog(HttpContext, "Reset Password", "Failed to reset password.", user.Userid, "Failure");
                    return Json(new { status = false, message = resetResult?.Message ?? "Failed to reset password." });
                }
            }
            catch (Exception ex)
            {
                _auditService.InsertLog(HttpContext, "Reset Password", $"An error occurred: {ex.Message}", user.Userid, "Failure");
                return Json(new { status = false, message = $"An error occurred: {ex.Message}" });
            }
        }

    }
}
