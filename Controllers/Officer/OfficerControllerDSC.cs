using Microsoft.AspNetCore.Mvc;
using iText.Kernel.Pdf;
using iText.Signatures;
using Org.BouncyCastle.Pkcs;
using Org.BouncyCastle.Crypto;
using iText.Bouncycastle.Crypto;
using iText.Commons.Bouncycastle.Cert;
using iText.Bouncycastle.X509;
using System.Security.Cryptography.X509Certificates;
using System.Security.Cryptography;
using iText.Forms.Form.Element;
using iText.Forms.Fields.Properties;
using iText.Kernel.Font;
using iText.IO.Font.Constants;
using iText.Kernel.Colors;
using System.Text;
using System.Linq;
using Microsoft.Extensions.Logging;
using System.Globalization;

namespace SahayataNidhi.Controllers.Officer
{
    public partial class OfficerController : Controller
    {
        [HttpPost]

        public IActionResult RegisterDSC([FromForm] IFormCollection form)
        {
            var officer = GetOfficerDetails();

            try
            {
                if (officer == null)
                {
                    return BadRequest(new { success = false, message = "User session expired or invalid. Please log in again." });
                }

                _logger.LogInformation($"------------USER ID: {officer.UserId}-----------------");

                var serialString = form["serial_number"].ToString();
                var ca = form["certifying_authority"].ToString();
                var expirationString = form["expiration_date"].ToString();
                var certSubjectName = form["cert_subject_name"].ToString()?.Trim();

                if (string.IsNullOrEmpty(serialString) || string.IsNullOrEmpty(ca))
                {
                    return BadRequest(new
                    {
                        success = false,
                        message = "Certificate details are incomplete. Please ensure your USB token is properly connected and the correct PIN was entered."
                    });
                }

                // ==========================================================
                // FIX 1: VALIDATE CERTIFICATE NAME MATCHES OFFICER NAME
                // ==========================================================
                // Note: Ensure 'officer.Name' matches the actual property in your Officer model
                string officerName = officer.Name?.Trim() ?? "";

                if (string.IsNullOrWhiteSpace(officerName))
                {
                    _logger.LogWarning("Officer name is missing in the database for UserId: {UserId}", officer.UserId);
                    return Json(new
                    {
                        success = false,
                        message = "Your user profile is missing a registered name. Please contact the system administrator to update your profile."
                    });
                }

                // Case-insensitive comparison to handle minor casing differences (e.g., "John Doe" vs "JOHN DOE")
                if (!string.Equals(officerName, certSubjectName, StringComparison.OrdinalIgnoreCase))
                {
                    _logger.LogWarning($"DSC Registration Blocked: Name mismatch. Officer: '{officerName}', Cert: '{certSubjectName}'");
                    return Json(new
                    {
                        success = false,
                        message = $"Name mismatch detected. The digital certificate belongs to '{certSubjectName}', which does not match your logged-in profile ('{officerName}'). Please insert the correct USB token assigned to you."
                    });
                }

                // ==========================================================
                // FIX 2: ROBUST SERIAL NUMBER PARSING
                // ==========================================================
                byte[] serialBytes;
                try
                {
                    if (serialString.All(c => Uri.IsHexDigit(c)))
                    {
                        serialBytes = Convert.FromHexString(serialString);
                    }
                    else
                    {
                        serialBytes = Convert.FromBase64String(serialString);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to parse serial number: {SerialString}", serialString);
                    return Json(new
                    {
                        success = false,
                        message = "Failed to read the certificate serial number. The USB token may be damaged, locked, or incompatible."
                    });
                }

                // ==========================================================
                // FIX 3: ROBUST EXPIRATION DATE PARSING
                // ==========================================================
                DateTime? expirationDate = null;
                if (!string.IsNullOrWhiteSpace(expirationString))
                {
                    // Remove " UTC" suffix to ensure clean parsing across all server cultures
                    string cleanDateStr = expirationString.Replace(" UTC", "").Trim();

                    if (DateTime.TryParse(cleanDateStr, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var parsedDate))
                    {
                        // CRITICAL POSTGRESQL FIX: 
                        // 1. Convert to UTC so the time is accurate.
                        // 2. Use SpecifyKind to change it to 'Unspecified' so Npgsql allows saving 
                        //    to a 'timestamp without time zone' column without throwing an exception.
                        expirationDate = DateTime.SpecifyKind(parsedDate.ToUniversalTime(), DateTimeKind.Unspecified);
                    }
                    else
                    {
                        _logger.LogWarning("Failed to parse expiration date: {ExpirationString}", expirationString);
                    }
                }

                // ==========================================================
                // SAVE TO DATABASE
                // ==========================================================
                var cert = new Models.Entities.Certificates
                {
                    Officerid = officer.UserId,
                    Serialnumber = serialBytes,
                    Certifiyingauthority = ca,
                    Expirationdate = expirationDate,

                    // NOTE: If 'Registereddate' is a DateTime column in your DB model, 
                    // change this line to: Registereddate = DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Unspecified)
                    Registereddate = DateTime.UtcNow.ToString("dd MMM yyyy hh:mm:ss tt"),

                    Status = "PENDING",
                    CertSubjectName = certSubjectName
                };

                dbcontext.Certificates.Add(cert);
                dbcontext.SaveChanges();

                return Json(new
                {
                    success = true,
                    message = "Digital Signature Certificate registered successfully and is pending Admin approval."
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error registering DSC for UserId: {UserId}", officer?.UserId);
                return StatusCode(500, new
                {
                    success = false,
                    message = "An unexpected error occurred while registering your Digital Signature Certificate. Please try again or contact system support."
                });
            }
        }

        [HttpGet]
        public IActionResult AlreadyRegistered()
        {
            var officer = GetOfficerDetails();
            if (officer == null)
            {
                return BadRequest(new { success = false, message = "Officer not found." });
            }

            try
            {
                _logger.LogInformation($"Checking DSC registration for User ID: {officer.UserId}");

                // Get the LATEST certificate for this officer
                var certificate = dbcontext.Certificates
                    .Where(c => c.Officerid == officer.UserId)
                    .OrderByDescending(c => c.Uuid)
                    .FirstOrDefault();

                if (certificate == null)
                {
                    return Json(new { success = true, isAlreadyRegistered = false, message = "No DSC registered." });
                }

                // Return status so UI knows if it's approved or pending
                string uiMessage = certificate.Status == "APPROVED"
                    ? "DSC is already registered and approved."
                    : "DSC is registered but pending admin approval.";

                return Json(new
                {
                    success = true,
                    certificate_id = certificate.Uuid,
                    isAlreadyRegistered = true,
                    status = certificate.Status,
                    message = uiMessage
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching registered DSC for User ID: {UserId}", officer.UserId);
                return StatusCode(500, new { success = false, message = ex.Message });
            }
        }

        [HttpPost]
        public IActionResult UnRegisteredDSC([FromForm] IFormCollection form)
        {
            try
            {
                if (!form.TryGetValue("certificateId", out var certificateIdStr) ||
                    !int.TryParse(certificateIdStr, out int certificateId))
                {
                    return BadRequest(new { status = false, message = "Invalid certificate ID." });
                }

                var officer = GetOfficerDetails();
                if (officer == null)
                {
                    return BadRequest(new { status = false, message = "Officer not found." });
                }

                // Verify the certificate belongs to the officer
                var certificate = dbcontext.Certificates
                    .FirstOrDefault(c => c.Uuid == certificateId && c.Officerid == officer.UserId);

                if (certificate == null)
                {
                    return NotFound(new { status = false, message = "Certificate not found or does not belong to this officer." });
                }

                dbcontext.Certificates.Remove(certificate);
                dbcontext.SaveChanges();

                return Json(new { status = true, message = "DSC unregistered successfully." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error unregistering DSC");
                return StatusCode(500, new { status = false, message = ex.Message });
            }
        }

        [HttpGet]
        public IActionResult GetRegisteredDSC()
        {
            var officer = GetOfficerDetails();
            if (officer == null)
            {
                return BadRequest(new { success = false, message = "Officer not found." });
            }

            try
            {
                _logger.LogInformation($"Fetching registered DSC for User ID: {officer.UserId}");

                var certificate = dbcontext.Certificates
                    .Where(c => c.Officerid == officer.UserId)
                    .OrderByDescending(c => c.Uuid)
                    .Select(c => new
                    {
                        serial_number = c.Serialnumber != null ? Convert.ToHexString(c.Serialnumber) : null,
                        certifying_authority = c.Certifiyingauthority,
                        expiration_date = c.Expirationdate,
                        registered_date = c.Registereddate,
                        status = c.Status,               // NEW
                        cert_subject_name = c.CertSubjectName // NEW
                    })
                    .FirstOrDefault();

                if (certificate == null)
                {
                    return Json(new { success = true, certificate = (object?)null, message = "No registered certificate found." });
                }

                return Json(new
                {
                    success = true,
                    certificate = new
                    {
                        certificate.serial_number,
                        certificate.certifying_authority,
                        expiration_date = certificate.expiration_date?.ToString("yyyy-MM-dd"),
                        certificate.registered_date,
                        certificate.status,
                        certificate.cert_subject_name
                    },
                    message = "DSC retrieved successfully."
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching registered DSC for User ID: {UserId}", officer.UserId);
                return StatusCode(500, new { success = false, message = ex.Message });
            }
        }

        // Optional: Method to check if DSC is expired
        [HttpGet]
        public IActionResult CheckDSCExpiry()
        {
            var officer = GetOfficerDetails();
            if (officer == null)
            {
                return BadRequest(new { success = false, message = "Officer not found." });
            }

            try
            {
                // CRITICAL: Only check certificates that are explicitly APPROVED
                var certificate = dbcontext.Certificates
                    .Where(c => c.Officerid == officer.UserId && c.Status == "APPROVED")
                    .OrderByDescending(c => c.Uuid)
                    .Select(c => new { c.Expirationdate })
                    .FirstOrDefault();

                if (certificate == null)
                {
                    return Json(new
                    {
                        success = true,
                        hasCertificate = false,
                        message = "No APPROVED DSC registered. Please register and wait for admin approval."
                    });
                }

                bool isExpired = certificate.Expirationdate.HasValue && certificate.Expirationdate.Value < DateTime.Now;

                return Json(new
                {
                    success = true,
                    hasCertificate = true,
                    isExpired,
                    expirationDate = certificate.Expirationdate?.ToString("dd MMM yyyy"),
                    message = isExpired ? "DSC has expired." : "DSC is valid and approved for signing."
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error checking DSC expiry for User ID: {UserId}", officer.UserId);
                return StatusCode(500, new { success = false, message = ex.Message });
            }
        }

        [HttpGet]
        public IActionResult GetDSCStatus()
        {
            var officer = GetOfficerDetails();
            if (officer == null)
            {
                return BadRequest(new { status = false, reason = "Officer details not found." });
            }

            try
            {
                var certificate = dbcontext.Certificates
                    .Where(c => c.Officerid == officer.UserId)
                    .OrderByDescending(c => c.Uuid)
                    .Select(c => new { c.Status })
                    .FirstOrDefault();

                if (certificate == null)
                {
                    // ✅ Return specific reason
                    return Json(new { status = false, reason = "No Digital Signature Certificate (DSC) is registered for your account." });
                }
                else if (certificate.Status == "PENDING")
                {
                    // ✅ Return specific reason
                    return Json(new { status = false, reason = "Your DSC registration is currently pending approval by the administrator." });
                }

                return Json(new { status = true });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching DSC status for User ID: {UserId}", officer.UserId);
                return StatusCode(500, new { status = false, reason = "Failed to verify DSC status. Please try again later." });
            }
        }
    }
}