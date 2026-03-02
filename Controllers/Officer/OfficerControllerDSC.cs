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

namespace SahayataNidhi.Controllers.Officer
{
    public partial class OfficerController : Controller
    {
        [HttpPost]
        public IActionResult RegisterDSC([FromForm] IFormCollection form)
        {
            try
            {
                var officer = GetOfficerDetails();
                if (officer == null)
                {
                    return BadRequest(new { success = false, message = "Officer not found." });
                }

                _logger.LogInformation($"------------USER ID: {officer.UserId}-----------------");

                var serialString = form["serial_number"].ToString();
                var ca = form["certifying_authority"].ToString();
                var expirationString = form["expiration_date"].ToString();

                // Validate required fields
                if (string.IsNullOrEmpty(serialString) || string.IsNullOrEmpty(ca))
                {
                    return BadRequest(new { success = false, message = "Serial number and certifying authority are required." });
                }

                // Parse serial number
                byte[] serialBytes;
                try
                {
                    // Try hex string first, then base64
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
                    return BadRequest(new { success = false, message = "Invalid serial number format." });
                }

                // Parse expiration date
                DateTime? expirationDate = null;
                if (!string.IsNullOrEmpty(expirationString) && DateTime.TryParse(expirationString, out var parsedDate))
                {
                    expirationDate = parsedDate;
                }

                var cert = new Models.Entities.Certificates
                {
                    Officerid = officer.UserId,
                    Serialnumber = serialBytes,
                    Certifiyingauthority = ca,
                    Expirationdate = expirationDate,
                    Registereddate = DateTime.Now.ToString("dd MMM yyyy hh:mm:ss tt")
                };

                dbcontext.Certificates.Add(cert);
                dbcontext.SaveChanges();

                return Json(new { success = true, message = "DSC registered successfully." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error registering DSC");
                return StatusCode(500, new { success = false, message = ex.Message });
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

                // Retrieve the certificate for the officer
                var certificate = dbcontext.Certificates
                    .Where(c => c.Officerid == officer.UserId)
                    .FirstOrDefault();

                if (certificate == null)
                {
                    return Json(new
                    {
                        success = true,
                        isAlreadyRegistered = false,
                        message = "No DSC registered for this officer."
                    });
                }

                return Json(new
                {
                    success = true,
                    certificate_id = certificate.Uuid,
                    isAlreadyRegistered = true,
                    message = "DSC is already registered."
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

                // Retrieve the certificate for the officer
                var certificate = dbcontext.Certificates
                    .Where(c => c.Officerid == officer.UserId)
                    .Select(c => new
                    {
                        serial_number = c.Serialnumber != null ? Convert.ToHexString(c.Serialnumber) : null,
                        certifying_authority = c.Certifiyingauthority,
                        expiration_date = c.Expirationdate,
                        registered_date = c.Registereddate
                    })
                    .FirstOrDefault();

                if (certificate == null)
                {
                    return Json(new
                    {
                        success = true,
                        certificate = (object?)null,
                        message = "No registered certificate found for this officer."
                    });
                }

                return Json(new
                {
                    success = true,
                    certificate = new
                    {
                        certificate.serial_number,
                        certificate.certifying_authority,
                        expiration_date = certificate.expiration_date?.ToString("yyyy-MM-dd"),
                        certificate.registered_date
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
                var certificate = dbcontext.Certificates
                    .Where(c => c.Officerid == officer.UserId)
                    .Select(c => new { c.Expirationdate })
                    .FirstOrDefault();

                if (certificate == null)
                {
                    return Json(new
                    {
                        success = true,
                        hasCertificate = false,
                        message = "No DSC registered."
                    });
                }

                bool isExpired = certificate.Expirationdate.HasValue &&
                                certificate.Expirationdate.Value < DateTime.Now;

                return Json(new
                {
                    success = true,
                    hasCertificate = true,
                    isExpired,
                    expirationDate = certificate.Expirationdate?.ToString("dd MMM yyyy"),
                    message = isExpired ? "DSC has expired." : "DSC is valid."
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error checking DSC expiry for User ID: {UserId}", officer.UserId);
                return StatusCode(500, new { success = false, message = ex.Message });
            }
        }
    }
}