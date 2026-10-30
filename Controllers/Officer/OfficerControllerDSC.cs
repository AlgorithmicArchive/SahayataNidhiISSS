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
                    return BadRequest(new
                    {
                        success = false,
                        message = "User session expired or invalid. Please log in again."
                    });
                }

                _logger.LogInformation($"------------USER ID: {officer.UserId}-----------------");

                // ==========================================================
                // READ ALL SERIAL REPRESENTATIONS SENT BY THE CLIENT
                // ==========================================================
                // The desktop token exposes the same certificate serial in several
                // shapes: a raw hex string, a decimal/ASCII form, and an integer.
                // The frontend (RegisterDSC.jsx) forwards all of them so the
                // backend can persist the canonical byte[] from the most reliable
                // representation. On later signing calls, UserDetails re-reads the
                // token and tries every shape — so the value we store here must
                // round-trip cleanly against at least one of them.
                var serialString = form["serial_number"].ToString();
                var serialHexString = form["serial_number_hex"].ToString();
                var serialIntString = form["serial_number_int"].ToString();

                var ca = form["certifying_authority"].ToString();
                var expirationString = form["expiration_date"].ToString();
                var certSubjectName = form["cert_subject_name"].ToString()?.Trim();

                _logger.LogInformation(
                    "DSC Register payload — serial_number='{Serial}', serial_number_hex='{SerialHex}', serial_number_int='{SerialInt}', CA='{CA}'",
                    serialString, serialHexString, serialIntString, ca);

                if (string.IsNullOrEmpty(serialString) && string.IsNullOrEmpty(serialHexString))
                {
                    return BadRequest(new
                    {
                        success = false,
                        message = "Certificate details are incomplete. Please ensure your USB token is properly connected and the correct PIN was entered."
                    });
                }

                if (string.IsNullOrEmpty(ca))
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

                if (!string.Equals(officerName, certSubjectName, StringComparison.OrdinalIgnoreCase))
                {
                    _logger.LogWarning(
                        $"DSC Registration Blocked: Name mismatch. Officer: '{officerName}', Cert: '{certSubjectName}'");
                    return Json(new
                    {
                        success = false,
                        message = $"Name mismatch detected. The digital certificate belongs to '{certSubjectName}', which does not match your logged-in profile ('{officerName}'). Please insert the correct USB token assigned to you."
                    });
                }

                // ==========================================================
                // FIX 2: ROBUST SERIAL NUMBER PARSING
                // ==========================================================
                // Priority:
                //   1. serial_number_hex  — explicit, unambiguous (preferred)
                //   2. serial_number      — fall back to the legacy auto-detect
                //                           (hex vs base64), for older clients
                //
                // Note on the legacy path: `Uri.IsHexDigit` returns TRUE for pure
                // digits ("12345"), so a decimal-looking string would have been
                // silently misread as hex. We now detect that case and, if the
                // string is all digits AND longer than 2 chars AND not flagged as
                // hex, we treat it as a decimal integer and convert properly.
                byte[] serialBytes;
                try
                {
                    string serialToParse = !string.IsNullOrWhiteSpace(serialHexString)
                        ? serialHexString
                        : serialString;

                    // Strip common separators used in serial display strings.
                    string cleanSerial = (serialToParse ?? "")
                        .Replace(" ", "")
                        .Replace("-", "")
                        .Replace(":", "")
                        .Trim();

                    if (string.IsNullOrEmpty(cleanSerial))
                    {
                        throw new ArgumentException("Serial number is empty after cleaning.");
                    }

                    bool isExplicitHex = !string.IsNullOrWhiteSpace(serialHexString);
                    bool looksLikeHex = cleanSerial.All(c => Uri.IsHexDigit(c));
                    bool looksLikeDecimal = cleanSerial.All(char.IsDigit);

                    if (isExplicitHex)
                    {
                        // Caller told us it's hex — trust it, just pad to even length.
                        if (cleanSerial.Length % 2 != 0)
                            cleanSerial = "0" + cleanSerial;

                        serialBytes = Convert.FromHexString(cleanSerial);
                    }
                    else if (looksLikeHex && !looksLikeDecimal)
                    {
                        // Contains A-F → definitely hex.
                        if (cleanSerial.Length % 2 != 0)
                            cleanSerial = "0" + cleanSerial;

                        serialBytes = Convert.FromHexString(cleanSerial);
                    }
                    else if (looksLikeDecimal && long.TryParse(cleanSerial, out var decimalSerial))
                    {
                        // All digits — treat as decimal integer and convert to the
                        // minimal big-endian byte array. Matches what the token
                        // exposes as `serial_number_int` on later reads.
                        serialBytes = DecimalSerialToBytes(decimalSerial);
                    }
                    else
                    {
                        // Fall back to base64 (legacy clients).
                        serialBytes = Convert.FromBase64String(cleanSerial);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex,
                        "Failed to parse serial number. serial_number='{Serial}', serial_number_hex='{SerialHex}', serial_number_int='{SerialInt}'",
                        serialString, serialHexString, serialIntString);

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
                    string cleanDateStr = expirationString.Replace(" UTC", "").Trim();

                    if (DateTime.TryParse(cleanDateStr, CultureInfo.InvariantCulture,
                                          DateTimeStyles.AssumeUniversal, out var parsedDate))
                    {
                        // Npgsql: convert to UTC then drop the Kind so it saves into
                        // a `timestamp without time zone` column without complaining.
                        expirationDate = DateTime.SpecifyKind(
                            parsedDate.ToUniversalTime(),
                            DateTimeKind.Unspecified);
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
                    Serialnumber = serialBytes,               // canonical byte[]
                    Certifiyingauthority = ca,
                    Expirationdate = expirationDate,
                    Registereddate = DateTime.UtcNow.ToString("dd MMM yyyy hh:mm:ss tt"),
                    Status = "PENDING",
                    CertSubjectName = certSubjectName
                };

                dbcontext.Certificates.Add(cert);
                dbcontext.SaveChanges();

                // Log the canonical hex so we can cross-reference it against what
                // UserDetails will later read back from the token.
                _logger.LogInformation(
                    "DSC registered for UserId {UserId}. Stored serial (hex) = {Hex}",
                    officer.UserId, Convert.ToHexString(serialBytes));

                return Json(new
                {
                    success = true,
                    message = "Digital Signature Certificate registered successfully and is pending Admin approval.",
                    // Echo back the canonical hex so the client can sanity-check
                    // round-trip against the token.
                    serial_number_hex = Convert.ToHexString(serialBytes)
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

        // ==========================================================
        // HELPERS
        // ==========================================================

        /// <summary>
        /// Converts a decimal serial-number string (as exposed by some USB tokens
        /// through `serial_number_int`) to its minimal big-endian byte array.
        /// Mirrors the conversion already used implicitly by the token's own
        /// `serial_number_hex` output.
        /// </summary>
        private static byte[] DecimalSerialToBytes(long value)
        {
            if (value == 0) return new byte[] { 0 };

            // Handle negative values defensively (shouldn't happen for a cert
            // serial, but a corrupted token could report one).
            ulong unsigned = value < 0 ? unchecked((ulong)value) : (ulong)value;

            var bytes = new List<byte>();
            while (unsigned > 0)
            {
                bytes.Add((byte)(unsigned & 0xFF));
                unsigned >>= 8;
            }
            bytes.Reverse(); // big-endian
            return bytes.ToArray();
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
                // Log every form field received so you can see the real name in the console
                foreach (var key in form.Keys)
                {
                    _logger.LogInformation($"Form field received -> Key: '{key}', Value: '{form[key]}'");
                }

                // Try all common field names the frontend might use
                string certificateIdStr = null;
                foreach (var candidate in new[] { "certificateId", "uuid", "id", "certId", "certificate_id" })
                {
                    if (form.TryGetValue(candidate, out var val) && !string.IsNullOrWhiteSpace(val))
                    {
                        certificateIdStr = val.ToString().Trim();
                        _logger.LogInformation($"Matched certificate ID field name: '{candidate}' with value: '{certificateIdStr}'");
                        break;
                    }
                }

                if (string.IsNullOrEmpty(certificateIdStr))
                {
                    _logger.LogWarning("No certificate ID field found in the form. Available keys: " + string.Join(", ", form.Keys));
                    return BadRequest(new { status = false, message = "Invalid certificate ID. No matching field was found in the request." });
                }

                if (!int.TryParse(certificateIdStr, out int certificateId))
                {
                    _logger.LogWarning($"Could not parse certificate ID as integer: '{certificateIdStr}'");
                    return BadRequest(new { status = false, message = $"Invalid certificate ID. Received value was not a number: '{certificateIdStr}'" });
                }

                var officer = GetOfficerDetails();
                if (officer == null)
                {
                    return BadRequest(new { status = false, message = "Officer not found." });
                }

                // uuid is a PostgreSQL "serial" = integer, so compare directly
                var certificate = dbcontext.Certificates
                    .FirstOrDefault(c => c.Uuid == certificateId && c.Officerid == officer.UserId);

                if (certificate == null)
                {
                    _logger.LogWarning($"Certificate with Uuid={certificateId} not found for OfficerId={officer.UserId}");
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