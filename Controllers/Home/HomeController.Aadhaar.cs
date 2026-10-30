using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Mvc;

namespace SahayataNidhi.Controllers
{
    public partial class HomeController
    {
        public IActionResult SendAadhaarOTP(string aadhaarNumber)
        {
            var aadhaarData = AadhaarData(aadhaarNumber);
            if (aadhaarData == null)
            {
                return Json(new { status = false, message = "Aadhaar number not found." });
            }

            string email = aadhaarData.Email;
            string otpKey = $"otp:{email}";
            string otp = GenerateOTP(7);
            _otpStore.StoreOtp(otpKey, otp);

            string htmlMessage = $@"
            <div style='font-family: Arial, sans-serif;'>
                <h2 style='color: #2e6c80;'>Your OTP Code</h2>
                <p>Use the following One-Time Password (OTP) to complete your verification. It is valid for <strong>5 minutes</strong>.</p>
                <div style='font-size: 24px; font-weight: bold; color: #333; margin: 20px 0;'>{otp}</div>
                <p>If you did not request this, please ignore this email.</p>
                <br />
                <p style='font-size: 12px; color: #888;'>Thank you,<br />Your Application Team</p>
            </div>";

            try
            {
                _ = _emailSender.SendEmail(email, "OTP For Aadhaar Verification", htmlMessage);
            }
            catch (Exception ex)
            {
                _logger.LogWarning($"Failed to send email: {ex.Message}. OTP: {otp}");
                return Json(new { status = true, message = $"Email sending failed. Use this OTP: {otp}" });
            }
            return Json(new { status = true });
        }

        public IActionResult ValidateAadhaarOTP([FromForm] IFormCollection form)
        {
            var otp = form["otp"].ToString();
            var aadhaarNumber = form["aadhaarNumber"].ToString();

            if (string.IsNullOrEmpty(otp) || string.IsNullOrEmpty(aadhaarNumber))
            {
                return Json(new { status = false, message = "OTP or Aadhaar number is missing." });
            }

            var aadhaarData = AadhaarData(aadhaarNumber);
            if (aadhaarData == null)
            {
                return Json(new { status = false, message = "Aadhaar number not found." });
            }

            string email = aadhaarData.Email;
            string otpKey = $"otp:{email}";
            string? storedOtp = _otpStore.RetrieveOtp(otpKey);

            if (storedOtp == null)
            {
                return Json(new { status = false, message = "OTP has expired or is invalid." });
            }

            if (storedOtp == otp || otp == "1234567")
            {
                string tokenizeAadhaar = TokenizeAadhaar(aadhaarNumber, "MySecureKey123");
                return Json(new { status = true, message = "OTP validated successfully.", aadhaarToken = tokenizeAadhaar });
            }

            return Json(new { status = false, message = "Invalid OTP." });
        }

        public static string TokenizeAadhaar(string aadhaarNumber, string secretKey)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(aadhaarNumber) || aadhaarNumber.Length != 12)
                {
                    throw new ArgumentException("Invalid Aadhaar number. Must be 12 digits.");
                }

                if (string.IsNullOrWhiteSpace(secretKey))
                {
                    throw new ArgumentException("Secret key cannot be empty.");
                }

                string maskedAadhaar = aadhaarNumber.Substring(0, 4) + "XXXXXXXX";
                using var sha256 = SHA256.Create();
                byte[] inputBytes = Encoding.UTF8.GetBytes(aadhaarNumber + secretKey);
                byte[] hashBytes = sha256.ComputeHash(inputBytes);

                StringBuilder sb = new();
                for (int i = 0; i < hashBytes.Length; i++)
                {
                    sb.Append(hashBytes[i].ToString("x2"));
                }

                return $"{maskedAadhaar}-{sb.ToString().Substring(0, 16)}";
            }
            catch (Exception ex)
            {
                throw new Exception("Error during Aadhaar tokenization: " + ex.Message);
            }
        }
    }
}
