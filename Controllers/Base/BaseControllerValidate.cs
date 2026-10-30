using Emgu.CV;
using Emgu.CV.CvEnum;
using Emgu.CV.Dnn;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql; // Added for PostgreSQL support

namespace SahayataNidhi.Controllers
{
    public partial class BaseController
    {
        [HttpPost]
        public IActionResult UsernameAlreadyExist([FromForm] IFormCollection form)
        {
            string Username = form["Username"].ToString();
            var isUsernameInUsers = dbcontext.Users.FirstOrDefault(u => u.Username == Username);
            if (isUsernameInUsers == null)
                return Json(new { status = false });
            else
                return Json(new { status = true });
        }

        [HttpPost]
        public IActionResult EmailAlreadyExist([FromForm] IFormCollection form)
        {
            string email = form["email"].ToString();
            var isEmailInUsers = dbcontext.Users.FirstOrDefault(u => u.Email == email);
            if (isEmailInUsers == null)
                return Json(new { status = false });
            else
                return Json(new { status = true });
        }

        [HttpPost]
        public IActionResult MobileNumberAlreadyExist([FromForm] IFormCollection form)
        {
            string MobileNumber = form["MobileNumber"].ToString();
            var isMobileNumberInUsers = dbcontext.Users.FirstOrDefault(u => u.Mobilenumber == MobileNumber);
            if (isMobileNumberInUsers == null)
                return Json(new { status = false });
            else
                return Json(new { status = true });
        }

        [HttpPost]
        public IActionResult IsDuplicateAccNo([FromForm] IFormCollection form)
        {
            try
            {
                string bankName = form["bankName"].ToString();
                string ifscCode = form["ifscCode"].ToString();
                string accNo = form["accNo"].ToString();
                string applicationId = form["applicationId"].ToString() ?? "";

                // Input validation
                if (string.IsNullOrEmpty(bankName)
                    || string.IsNullOrEmpty(ifscCode)
                    || string.IsNullOrEmpty(accNo))
                {
                    return Json(new { status = false });
                }

                // serviceId must be an integer
                if (!int.TryParse(form["serviceId"].ToString(), out int serviceId) || serviceId <= 0)
                {
                    return Json(new { status = false, error = "serviceId is required." });
                }

                // PostgreSQL function call — positional arguments
                // Signature: get_duplicate_acc_no(p_serviceid, p_account_number, p_ifsc_code, p_bank_name)
                var applications = dbcontext.CitizenApplications
                    .FromSqlInterpolated($@"
                SELECT * FROM get_duplicate_acc_no(
                    {serviceId},
                    {accNo},
                    {ifscCode},
                    {bankName}
                )")
                    .ToList();

                if (applications.Count == 0)
                {
                    return Json(new { status = false });
                }

                // Exclude current application from the duplicates
                var otherApplications = applications
                    .Where(app => string.IsNullOrWhiteSpace(applicationId)
                               || app.Referencenumber != applicationId)
                    .ToList();

                _logger.LogInformation(
                    $"----------- Found {otherApplications.Count} other applications for account {accNo}. -----------------");

                // If no other applications, then not a duplicate
                if (otherApplications.Count == 0)
                {
                    return Json(new { status = false });
                }

                // If any of the other applications are NOT rejected, it's a duplicate
                bool hasNonRejected = false;

                foreach (var app in otherApplications)
                {
                    _logger.LogInformation(
                        $"App Status [{app.Status}] for Ref {app.Referencenumber}");

                    if (!string.Equals(app.Status?.Trim(), "Rejected",
                                       StringComparison.OrdinalIgnoreCase))
                    {
                        hasNonRejected = true;
                        break;
                    }
                }

                if (hasNonRejected)
                {
                    return Json(new { status = true });
                }

                // All are rejected → not considered duplicate
                return Json(new { status = false });

            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in IsDuplicateAccNo");
                return Json(new { status = false, error = "Internal server error" });
            }
        }

        private static string FormatBytes(long bytes)
        {
            string[] units = { "B", "KB", "MB", "GB", "TB" };
            double size = bytes;
            int unit = 0;

            while (size >= 1024 && unit < units.Length - 1)
            {
                size /= 1024;
                unit++;
            }

            // Show one decimal only when it adds information (e.g. 1.5 MB),
            // otherwise show an integer (e.g. 100 KB, 600 KB).
            return size == Math.Floor(size)
                ? $"{size:0} {units[unit]}"
                : $"{size:0.##} {units[unit]}";
        }
        [HttpPost]
        public IActionResult Validate([FromForm] IFormCollection file)
        {
            if (file == null)
            {
                return Json(new { isValid = false, errorMessage = "Invalid request: No form data received. Check Content-Type and request body." });
            }

            if (file.Files.Count == 0)
            {
                return Json(new { isValid = false, errorMessage = "No file uploaded." });
            }

            var uploadedFile = file.Files[0];
            string fileType = file["fileType"].ToString();

            // ✅ Optional flag — when true, PDFs are allowed up to 1 MB
            //    instead of the default MaxPdfFile limit. Sent by the officer
            //    upload UI when a "Legacy Application Document" is being attached.
            bool isLegacyDocument = false;
            var legacyFlagRaw = file["legacyDocument"].ToString();
            if (!string.IsNullOrWhiteSpace(legacyFlagRaw) &&
                bool.TryParse(legacyFlagRaw, out bool parsedLegacy))
            {
                isLegacyDocument = parsedLegacy;
            }

            // 1 MB ceiling for legacy documents
            const long LegacyPdfMaxBytes = 1 * 1024 * 1024;

            using (var fileStream = uploadedFile.OpenReadStream())
            {
                byte[] fileHeader = new byte[4];
                fileStream.ReadExactly(fileHeader, 0, 4);
                string fileExtension = Path.GetExtension(uploadedFile.FileName)?.ToLower()!;

                // Check if the file type is an image
                if (fileType == "image")
                {
                    if (!IsValidImage(fileHeader, fileExtension))
                    {
                        return Json(new { isValid = false, errorMessage = "The uploaded file is not a valid image." });
                    }

                    // If it's a valid image, check the file size
                    if (uploadedFile.Length < MinImageFile || uploadedFile.Length > MaxImageFile)
                    {
                        return Json(new { isValid = false, errorMessage = "Image file size must be between 20KB and 50KB." });
                    }
                }
                // Check if the file type is a PDF
                else if (fileType == "pdf")
                {
                    if (!IsValidPdf(fileHeader, fileExtension))
                    {
                        return Json(new { isValid = false, errorMessage = "The uploaded file is not a valid PDF." });
                    }

                    // ✅ Legacy document: allow up to 1 MB. Otherwise use the default limit.
                    long effectiveMax = isLegacyDocument ? LegacyPdfMaxBytes : MaxPdfFile;

                    if (uploadedFile.Length < MinPdfFile || uploadedFile.Length > effectiveMax)
                    {
                        return Json(new
                        {
                            isValid = false,
                            errorMessage = isLegacyDocument
                                ? $"Legacy document PDF size must be between {FormatBytes(MinPdfFile)} and {FormatBytes(effectiveMax)}."
                                : $"PDF file size must be between {FormatBytes(MinPdfFile)} and {FormatBytes(effectiveMax)}."
                        });
                    }
                }
                else
                {
                    return Json(new { isValid = false, errorMessage = "Unsupported file type." });
                }
            }

            // If all checks pass, return success
            return Json(new { isValid = true, message = "" });
        }
        private static bool IsValidImage(byte[] header, string fileExtension)
        {
            // PNG: 89 50 4E 47 (hex) / JPG: FF D8 FF E0 or FF D8 FF E1
            if (fileExtension == ".png" && header[0] == 0x89 && header[1] == 0x50 &&
                header[2] == 0x4E && header[3] == 0x47)
            {
                return true;
            }

            if (fileExtension == ".jpg" || fileExtension == ".jpeg")
            {
                return header[0] == 0xFF && header[1] == 0xD8 && (header[2] == 0xFF);
            }

            return false;
        }

        private static bool IsValidPdf(byte[] header, string fileExtension)
        {
            // PDF files start with: 25 50 44 46 (hex)
            return fileExtension == ".pdf" && header[0] == 0x25 && header[1] == 0x50 &&
                header[2] == 0x44 && header[3] == 0x46;
        }

        [HttpPost]
        public IActionResult ValidateIfscCode([FromForm] IFormCollection form)
        {
            try
            {
                string bankNameOrId = form["bankName"].ToString();
                string ifscCode = form["ifscCode"].ToString();

                // Check if bankNameOrId is empty
                if (string.IsNullOrWhiteSpace(bankNameOrId))
                {
                    return Json(new
                    {
                        status = false,
                        message = "Bank name/ID is required."
                    });
                }

                // Check if IFSC code is empty
                if (string.IsNullOrWhiteSpace(ifscCode))
                {
                    return Json(new
                    {
                        status = false,
                        message = "IFSC code is required."
                    });
                }

                string actualBankName = "";

                // Try to parse as integer (ID)
                if (int.TryParse(bankNameOrId, out int bankId))
                {
                    // It's an ID, get bank name from database
                    var bank = dbcontext.Bank.FirstOrDefault(b => b.Id == bankId);
                    if (bank == null)
                    {
                        return Json(new
                        {
                            status = false,
                            message = "Bank not found with the provided ID."
                        });
                    }
                    actualBankName = bank.Bankname;
                }
                else
                {
                    // It's a bank name, use it directly
                    actualBankName = bankNameOrId;

                    // Optional: Verify the bank exists in database
                    var bankExists = dbcontext.Bank.Any(b => b.Bankname == actualBankName);
                    if (!bankExists)
                    {
                        return Json(new
                        {
                            status = false,
                            message = "Bank not found with the provided name."
                        });
                    }
                }

                // Execute PostgreSQL function using FromSqlInterpolated
                var result = dbcontext.Bankdetails
                    .FromSqlInterpolated($@"
                        SELECT * FROM validate_ifsc(
                            {actualBankName}, 
                            {ifscCode}
                        )")
                    .AsEnumerable()
                    .FirstOrDefault();

                if (result == null)
                {
                    return Json(new
                    {
                        status = false,
                        message = "Invalid IFSC code for the specified bank."
                    });
                }

                return Json(new
                {
                    status = true,
                    bankDetails = new
                    {
                        branch = result.Branch,
                        bankName = actualBankName,
                        ifsc = ifscCode
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in ValidateIfscCode");
                return Json(new
                {
                    status = false,
                    message = $"An error occurred while validating IFSC code., {ex.Message}"
                });
            }
        }


    }
}