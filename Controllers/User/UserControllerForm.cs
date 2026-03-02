using System.Data;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json;
using SahayataNidhi.Models.Entities;
using System.Security.Claims;
using Newtonsoft.Json.Linq;
using System.Globalization;
using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;

namespace SahayataNidhi.Controllers.User
{
    public partial class UserController
    {
        public void ServiceSpecific(int Serviceid, JToken formDetails, string ReferenceNumber)
        {
            _logger.LogInformation($"--------- SERVICE ID: {Serviceid} ------------------------------");
            if (Serviceid == 1)
            {
                var KindOfDisability = FindFieldRecursively(formDetails, "KindOfDisability");
                if (KindOfDisability != null && (string)KindOfDisability!["value"]! == "TEMPORARY")
                {
                    string ExpirationDate = (string)FindFieldRecursively(formDetails, "IfTemporaryDisabilityUdidCardValidUpto")!["value"]!;
                    var expiringEligibility = new Applicationswithexpiringeligibility
                    {
                        Serviceid = Serviceid,
                        ExpirationDate = ExpirationDate,
                        Referencenumber = ReferenceNumber,
                    };
                    dbcontext.Applicationswithexpiringeligibility.Add(expiringEligibility);
                    dbcontext.SaveChanges();
                }
            }
        }

        [HttpPost]
        public async Task<IActionResult> InsertFormDetails([FromForm] IFormCollection form)
        {
            // Retrieve userId from JWT token
            int userId = Convert.ToInt32(User.FindFirst(ClaimTypes.NameIdentifier)?.Value);
            int serviceId = Convert.ToInt32(form["serviceId"].ToString());
            string formDetailsJson = form["formDetails"].ToString();
            string status = form["status"].ToString();
            string ReferenceNumber = form["referenceNumber"].ToString();
            string OfficerRole = "";
            string OfficerArea = "";

            var formDetailsObj = JObject.Parse(formDetailsJson);
            var formdetailsToken = JToken.Parse(formDetailsJson);

            // Flatten all sections into a single collection of fields.
            var allFields = formDetailsObj.Properties()
                .Where(prop => prop.Value is JArray)
                .SelectMany(prop => (JArray)prop.Value)
                .OfType<JObject>();

            // Dictionary to store file hashes and their corresponding file paths
            var fileHashMap = new Dictionary<string, string>();

            // Process each file.
            foreach (var file in form.Files)
            {
                // Calculate SHA256 hash of the file content
                string fileHash;
                using (var stream = file.OpenReadStream())
                using (var sha256 = SHA256.Create())
                {
                    byte[] hashBytes = await sha256.ComputeHashAsync(stream);
                    fileHash = Convert.ToBase64String(hashBytes);
                }

                // Check if the file hash already exists in the map
                if (!fileHashMap.TryGetValue(fileHash, out string? filePath))
                {
                    // File is new, generate and store the file path
                    filePath = await helper.GetFilePath(file, null, null, "document");
                    fileHashMap[fileHash] = filePath;
                }
                else
                {
                    _logger.LogInformation($"Reusing existing file path for hash: {fileHash}");
                }

                // Assign the file path to all matching fields
                foreach (var field in allFields.Where(f => f["name"]?.ToString() == file.Name))
                {
                    field["File"] = filePath;
                }
            }

            // Here we look for any key that contains "District" (case-insensitive) and try to parse its value as an integer.
            int districtId = Convert.ToInt32(FindFieldRecursively(formdetailsToken, "District")!["value"]);

            if (string.IsNullOrEmpty(ReferenceNumber))
            {
                int count = GetCountPerDistrict(districtId, serviceId);
                var service = dbcontext.Services.FirstOrDefault(s => s.Serviceid == serviceId);
                var districtDetails = dbcontext.District.FirstOrDefault(s => s.Districtid == districtId);
                string districtShort = districtDetails!.Districtshort!;
                OfficerArea = districtDetails.Districtname!;
                var officerEditableField = service!.Officereditablefield;

                if (string.IsNullOrEmpty(officerEditableField))
                {
                    return Json(new { status = false });
                }

                // Parse the Officereditablefield JSON
                var players = JArray.Parse(officerEditableField);
                if (players.Count == 0)
                {
                    return Json(new { status = false });
                }

                // Create a new JArray to store filtered workflow
                var filteredWorkflow = new JArray();

                foreach (var player in players)
                {
                    _logger.LogInformation($"Original Player: {player}  string : {player.ToString()}");
                    // Create a new JObject with only the required fields
                    var filteredPlayer = new JObject
                    {
                        ["designation"] = player["designation"],
                        ["accessLevel"] = player["accessLevel"]?.ToString() ?? string.Empty,
                        ["status"] = player["status"],
                        ["completedAt"] = player["completedAt"]?.ToString() ?? string.Empty,
                        ["remarks"] = player["remarks"],
                        ["additionalFields"] = "",
                        ["playerId"] = player["playerId"],
                        ["prevPlayerId"] = player["prevPlayerId"],
                        ["nextPlayerId"] = player["nextPlayerId"],
                        ["canPull"] = player["canPull"]
                    };

                    filteredWorkflow.Add(filteredPlayer);
                }

                // Set the status of the first player to "pending"
                if (filteredWorkflow.Count > 0)
                {
                    filteredWorkflow[0]["status"] = "pending";
                    OfficerRole = filteredWorkflow[0]["designation"]?.ToString() ?? string.Empty;
                }

                var workFlow = filteredWorkflow.ToString(Formatting.None);
                var finYear = helper.GetCurrentFinancialYear();
                var ReferenceNumberAlphaNumber = "JK-" + service.Nameshort + "-" + districtShort + "/" + finYear + "/" + count;
                var random = new Random();
                ReferenceNumber = "01" + service.Serviceid.ToString("D2") + districtDetails.Districtid.ToString("D2") + finYear.Split("-")[1] + random.Next(100, 1000) + count;

                var createdAt = DateTime.Now.ToString("dd MMM yyyy hh:mm:ss tt", CultureInfo.InvariantCulture);

                _logger.LogInformation("$ ------ Form Details with File Paths: ------" + formDetailsObj.ToString());

                // Store the updated JSON (with file paths) in the database.
                var newFormDetails = new CitizenApplications
                {
                    Referencenumber = ReferenceNumber,
                    Referencenumberalphanumeric = ReferenceNumberAlphaNumber,
                    CitizenId = userId,
                    Serviceid = serviceId,
                    Districtuidforbank = null,
                    Formdetails = formDetailsObj.ToString(),
                    Currentplayer = 0,
                    Workflow = workFlow!,
                    Status = status,
                    Datatype = "new",
                    CreatedAt = createdAt
                };

                dbcontext.CitizenApplications.Add(newFormDetails);
            }
            else
            {
                var application = dbcontext.CitizenApplications.FirstOrDefault(a => a.Referencenumber == ReferenceNumber);
                application!.Formdetails = formDetailsObj.ToString();

                if (application.Status != status)
                {
                    application.Status = status;
                }
                application.CreatedAt = DateTime.Now.ToString("dd MMM yyyy hh:mm:ss tt", CultureInfo.InvariantCulture);
            }

            dbcontext.SaveChanges();

            if (status == "Initiated")
            {
                try
                {
                    var getServices = dbcontext.Webservice.FirstOrDefault(ws => ws.Serviceid == serviceId && ws.Isactive);
                    if (getServices != null)
                    {
                        var onAction = JsonConvert.DeserializeObject<List<string>>(getServices.Onaction);
                        if (onAction != null && onAction.Contains("Submission"))
                        {
                            // Instead of calling SendApiRequestAsync directly, push to background
                            _taskQueue.QueueBackgroundWorkItem(async token =>
                            {
                                using var scope = _serviceScopeFactory.CreateScope();
                                var dbcontext = scope.ServiceProvider.GetRequiredService<SwdjkContext>();

                                try
                                {
                                    var fieldMapObj = JObject.Parse(getServices.Fieldmappings);
                                    var fieldMap = MapServiceFieldsFromForm(formDetailsObj, fieldMapObj);

                                    await SendApiRequestAsync(getServices.Apiendpoint, fieldMap);
                                    _logger.LogInformation($"API request sent in background for Reference: {ReferenceNumber}");
                                }
                                catch (Exception ex)
                                {
                                    _logger.LogError(ex, $"Background API request failed for Reference: {ReferenceNumber}");
                                }
                            });
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, $"Failed while scheduling API request for Reference: {ReferenceNumber}");
                }

                string fullPath = await FetchAcknowledgementDetails(ReferenceNumber);
                string? fullName = GetFormFieldValue(formDetailsObj, "ApplicantName");
                string? ServiceName = dbcontext.Services.FirstOrDefault(s => s.Serviceid == serviceId)!.Servicename;

                // Get email from form - check multiple possible field names
                string? email = GetFormFieldValue(formDetailsObj, "Email")
                              ?? GetFormFieldValue(formDetailsObj, "email")
                              ?? GetFormFieldValue(formDetailsObj, "EmailAddress")
                              ?? GetFormFieldValue(formDetailsObj, "emailaddress");

                // Check if email is valid before attempting to send
                if (!string.IsNullOrWhiteSpace(email) && IsValidEmail(email))
                {
                    var emailtemplate = JObject.Parse(dbcontext.Emailsettings.FirstOrDefault()!.Templates!);
                    string template = emailtemplate["Submission"]!.ToString();

                    var placeholders = new Dictionary<string, string>
                    {
                        { "ApplicantName", GetFormFieldValue(formDetailsObj, "ApplicantName") ?? "" },
                        { "ServiceName", ServiceName!},
                        { "ReferenceNumber", ReferenceNumber },
                        { "OfficerRole", OfficerRole },
                        { "OfficerArea", OfficerArea }
                    };

                    foreach (var pair in placeholders)
                    {
                        template = template.Replace($"{{{pair.Key}}}", pair.Value);
                    }

                    string htmlMessage = template;

                    // Retrieve the file from the database
                    var fileResult = await DisplayFile(fullPath.Split('=')[1]);

                    // Check if the file exists and is valid
                    if (fileResult is FileContentResult fileContentResult)
                    {
                        // Get the file data from FileContentResult
                        byte[] fileData = fileContentResult.FileContents;
                        string fileName = ReferenceNumber.Replace("/", "_") + "Acknowledgement.pdf";
                        // Write temp file
                        string tempDir = Path.Combine(_webHostEnvironment.WebRootPath, "Temp");
                        Directory.CreateDirectory(tempDir);
                        string tempFilePath = Path.Combine(tempDir, fileName);

                        _taskQueue.QueueBackgroundWorkItem(async token =>
                        {
                            try
                            {
                                await emailSender.SendEmailWithAttachments(
                                    email!,
                                    "Form Submission",
                                    htmlMessage,
                                    fileData, // byte[] directly
                                    ReferenceNumber.Replace("/", "_") + "_Acknowledgement.pdf"
                                );

                                _logger.LogInformation(
                                    $"Email sent in background to {email} for Reference: {ReferenceNumber}"
                                );
                            }
                            catch (Exception ex)
                            {
                                _logger.LogError(
                                    ex,
                                    $"Background email sending failed for Reference: {ReferenceNumber}, Email: {email}"
                                );
                            }
                        });

                    }
                    else
                    {
                        _logger.LogWarning($"File not found or invalid for Reference: {ReferenceNumber}, Email: {email}");
                    }
                }
                else
                {
                    _logger.LogInformation($"No valid email address found for Reference: {ReferenceNumber}. Email not sent.");
                }

                string field = GetFormFieldValue(formDetailsObj, "Tehsil") != null ? "Tehsil" : "District";
                string? value = GetFormFieldValue(formDetailsObj, field);

                string? locationLevel = field;
                int locationValue = Convert.ToInt32(value);

                ServiceSpecific(serviceId, formdetailsToken, ReferenceNumber);

                helper.InsertHistory(ReferenceNumber, "Application Submission", "Citizen", "Submitted", locationLevel, locationValue);

                return Json(new { status = true, ReferenceNumber, type = "Submit" });
            }
            else
            {
                return Json(new { status = true, ReferenceNumber, type = "Save" });
            }
        }


        // Helper method to validate email format
        private static bool IsValidEmail(string email)
        {
            if (string.IsNullOrWhiteSpace(email))
                return false;

            try
            {
                var addr = new System.Net.Mail.MailAddress(email);
                return addr.Address == email;
            }
            catch
            {
                return false;
            }
        }


        public int GetShiftedFromTo(string location)
        {
            try
            {
                var locationList = JsonConvert.DeserializeObject<List<JObject>>(location);

                int? districtValue = null;

                foreach (var item in locationList!)
                {
                    var name = item["name"]?.ToString();
                    var valueStr = item["value"]?.ToString();

                    if (string.IsNullOrEmpty(name) || string.IsNullOrEmpty(valueStr))
                        continue;

                    if (name == "Tehsil" && int.TryParse(valueStr, out int tehsil))
                    {
                        return tehsil; // Return immediately if Tehsil found
                    }

                    if (name == "District" && int.TryParse(valueStr, out int district))
                    {
                        districtValue = district; // Store District in case Tehsil not found
                    }
                }

                return districtValue ?? 0; // Return District if Tehsil wasn't found
            }
            catch (JsonException ex)
            {
                _logger.LogError(ex, "Failed to deserialize location JSON.");
                return -1;
            }
        }

        [HttpPost]
        public async Task<IActionResult> UpdateApplicationDetails([FromForm] IFormCollection form)
        {
            string referenceNumber = form["referenceNumber"].ToString();
            string returnFieldsJson = form["returnFields"].ToString();
            string formDetailsJson = form["formDetails"].ToString();

            var updatedFieldNames = JsonConvert.DeserializeObject<List<string>>(returnFieldsJson) ?? new List<string>();
            var submittedFormDetails = JObject.Parse(formDetailsJson);

            var application = dbcontext.CitizenApplications
                .FirstOrDefault(a => a.Referencenumber == referenceNumber);

            if (application == null)
                return Json(new { status = false, message = "Application not found" });

            var existingFormDetails = JObject.Parse(application.Formdetails ?? "{}");

            // === 1. Location Change Detection ===
            int shiftedFrom = GetShiftedFromTo(JsonConvert.SerializeObject(existingFormDetails["Location"] ?? new JObject()));
            int shiftedTo = shiftedFrom;
            var submittedLocation = submittedFormDetails["Location"];
            if (submittedLocation != null && submittedLocation.HasValues)
                shiftedTo = GetShiftedFromTo(submittedLocation.ToString());

            // === Helper: Find field by name (supports nested additionalFields) ===
            JObject FindFieldByName(JObject root, string name)
            {
                if (string.IsNullOrEmpty(name)) return null!;

                foreach (var prop in root.Properties())
                {
                    if (prop.Value is JArray section)
                    {
                        foreach (var item in section.OfType<JObject>())
                        {
                            if (string.Equals(item["name"]?.ToString(), name, StringComparison.OrdinalIgnoreCase))
                                return item;

                            var addFields = item["additionalFields"] as JArray;
                            if (addFields != null)
                            {
                                var nested = addFields.OfType<JObject>()
                                    .FirstOrDefault(n => string.Equals(n["name"]?.ToString(), name, StringComparison.OrdinalIgnoreCase));
                                if (nested != null) return nested;
                            }
                        }
                    }
                }
                return null!;
            }

            // === 2. Process ONLY the fields in updatedFieldNames ===
            foreach (string fieldName in updatedFieldNames)
            {
                var uploadedFile = form.Files.FirstOrDefault(f => f.Name == fieldName);
                var submittedField = FindFieldByName(submittedFormDetails, fieldName);
                var existingField = FindFieldByName(existingFormDetails, fieldName);

                if (submittedField == null || existingField == null) continue;

                bool hasNewFileUpload = uploadedFile != null && uploadedFile.Length > 0;
                string? oldFilePath = existingField["File"]?.ToString();
                bool hadFileBefore = !string.IsNullOrEmpty(oldFilePath);

                // === Handle file upload/replacement/removal ===
                if (hasNewFileUpload)
                {
                    // New file uploaded → delete old + save new
                    if (hadFileBefore)
                    {
                        helper.DeleteFile(oldFilePath!);
                        _logger.LogInformation($"Replaced old file for {fieldName}");
                    }

                    string newPath = await helper.GetFilePath(uploadedFile, null, null, "document");
                    submittedField["File"] = newPath;
                    _logger.LogInformation($"Uploaded new file for {fieldName}: {newPath}");
                }
                else
                {
                    // No new file uploaded
                    if (submittedField["File"] == null ||
                        submittedField["File"]!.Type == JTokenType.Null ||
                        (submittedField["File"]!.Type == JTokenType.Object && submittedField["File"]!.HasValues == false))
                    {
                        // User explicitly removed the file
                        if (hadFileBefore)
                        {
                            helper.DeleteFile(oldFilePath!);
                            _logger.LogInformation($"User removed file for {fieldName}");
                        }
                        submittedField.Remove("File");
                    }
                    else
                    {
                        // Frontend sent empty object/string → means "keep existing file"
                        // Restore the original file path
                        if (hadFileBefore)
                        {
                            submittedField["File"] = oldFilePath;
                            _logger.LogInformation($"Preserved existing file for {fieldName}");
                        }
                    }
                }

                // === Copy all other properties from submittedField to existingField ===
                // This updates text values, labels, etc.
                foreach (var prop in submittedField.Properties())
                {
                    if (prop.Name != "File") // We already handled File above
                    {
                        existingField[prop.Name] = prop.Value;
                    }
                }

                // Special: Ensure File is correctly set in existingField
                if (submittedField["File"] != null)
                {
                    existingField["File"] = submittedField["File"];
                }
                else
                {
                    existingField.Remove("File");
                }
            }

            // === 3. Save ONLY the updated existingFormDetails (preserves untouched fields) ===
            application.Formdetails = existingFormDetails.ToString();
            application.Additionaldetails = null;

            // === 4. Workflow & History ===
            var workFlow = JsonConvert.DeserializeObject<JArray>(application.Workflow ?? "[]");
            var currentOfficer = workFlow?.FirstOrDefault(o => (int?)o["playerId"] == application.Currentplayer);
            if (currentOfficer != null)
            {
                currentOfficer["status"] = "pending";
                if (shiftedFrom != shiftedTo)
                {
                    currentOfficer["shifted"] = true;
                    currentOfficer["shiftedFrom"] = shiftedFrom;
                    currentOfficer["shiftedTo"] = shiftedTo;
                }
            }

            application.Workflow = workFlow?.ToString();
            application.CreatedAt = DateTime.Now.ToString("dd MMM yyyy hh:mm:ss tt");

            string locationLevel = GetFormFieldValue(existingFormDetails, "Tehsil") != null ? "Tehsil" : "District";
            int locationValue = Convert.ToInt32(GetFormFieldValue(existingFormDetails, locationLevel ?? "District"));

            dbcontext.SaveChanges();

            helper.InsertHistory(referenceNumber, "Re submission of Application", "Citizen", "Re submitted", locationLevel!, locationValue);

            return Json(new
            {
                status = true,
                message = "Application updated successfully",
                type = "Edit",
                referenceNumber
            });
        }

        [HttpPost]
        public async Task<IActionResult> UpdateExpiringDocumentDetails([FromForm] IFormCollection form)
        {
            try
            {
                // Validate required fields
                string referenceNumber = form["referenceNumber"].ToString();
                if (string.IsNullOrWhiteSpace(referenceNumber))
                    return BadRequest(new { status = false, message = "Reference number is required." });

                if (!int.TryParse(form["Serviceid"].ToString(), out int serviceId))
                    return BadRequest(new { status = false, message = "Invalid service ID." });

                string remarks = form["remarks"].ToString() ?? string.Empty;
                string? applicationId = form.ContainsKey("applicationId") && !string.IsNullOrWhiteSpace(form["applicationId"])
                    ? form["applicationId"].ToString()
                    : null;

                // Retrieve service and application
                var service = dbcontext.Services.FirstOrDefault(s => s.Serviceid == serviceId);
                if (service == null)
                    return BadRequest(new { status = false, message = $"Service with ID {serviceId} not found." });

                var application = dbcontext.CitizenApplications.FirstOrDefault(a => a.Referencenumber == referenceNumber);
                if (application == null)
                    return BadRequest(new { status = false, message = $"Application with reference number '{referenceNumber}' not found." });

                // Parse formFields from Formdetails
                JToken formFields;
                try
                {
                    formFields = JToken.Parse(application.Formdetails ?? "{}");
                }
                catch (JsonException ex)
                {
                    return BadRequest(new { status = false, message = $"Failed to parse FormFields: {ex.Message}" });
                }

                // Define fields to correct, excluding IfTemporaryDisabilityUdidCardValidUpto initially
                var fieldsToCorrect = new[] { "UdidCardIssueDate", "PercentageOfDisability", "KindOfDisability", "UdidCard" };
                var conditionalFields = new[] { "IfTemporaryDisabilityUdidCardValidUpto" };

                // Check KindOfDisability to determine if IfTemporaryDisabilityUdidCardValidUpto should be included
                string kindOfDisability = form["KindOfDisability"].ToString();
                var finalFieldsToCorrect = kindOfDisability == "TEMPORARY"
                    ? fieldsToCorrect.Concat(conditionalFields).ToArray()
                    : fieldsToCorrect;

                // Get old values
                var oldValues = new JObject();
                foreach (var fieldName in finalFieldsToCorrect)
                {
                    var field = FindFieldRecursively(formFields, fieldName);

                    oldValues[fieldName] =
                        field != null
                        ? (field.TryGetValue("File", out var fileVal) ? fileVal?.ToString()
                          : field.TryGetValue("value", out var val) ? val?.ToString()
                          : null)
                        : null;
                }

                // Get new values, excluding UdidCard (handled separately)
                var newValues = new JObject();
                foreach (var fieldName in finalFieldsToCorrect.Except(new[] { "UdidCard" }))
                {
                    if (form.ContainsKey(fieldName) && !string.IsNullOrWhiteSpace(form[fieldName]))
                    {
                        newValues[fieldName] = form[fieldName].ToString();
                    }
                    else
                    {
                        newValues[fieldName] = null;
                    }
                }

                // Handle UdidCard file
                string? udidCardFileName = null;
                var udidCardFile = form.Files?.FirstOrDefault(f => f.Name == "UdidCard" && f.Length > 0);
                if (udidCardFile != null)
                {
                    // Validate file size (100kb–200kb) and type (.pdf)
                    if (udidCardFile.Length < 100 * 1024 || udidCardFile.Length > 200 * 1024)
                        return BadRequest(new { status = false, message = "UdidCard file size must be between 100kb and 200kb." });

                    if (!udidCardFile.FileName.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase))
                        return BadRequest(new { status = false, message = "UdidCard file must be a PDF." });

                    string filePath = await helper.GetFilePath(udidCardFile, null, null, "document");
                    udidCardFileName = Path.GetFileName(filePath);
                }
                else if (form.Keys.Any(k => k == "serverFiles[UdidCard]"))
                {
                    string serverFile = form["serverFiles[UdidCard]"].ToString();
                    if (!string.IsNullOrWhiteSpace(serverFile))
                        udidCardFileName = serverFile;
                }

                // Set new value for UdidCard
                newValues["UdidCard"] = udidCardFileName;

                // Build corrigendumFields
                var corrigendumFields = new JObject();
                foreach (var fieldName in finalFieldsToCorrect)
                {
                    corrigendumFields[fieldName] = new JObject
                    {
                        ["old_value"] = oldValues[fieldName],
                        ["new_value"] = newValues[fieldName],
                        ["additional_values"] = new JObject()
                    };
                }

                corrigendumFields["Files"] = new JObject
                {
                    ["TSWO"] = new JArray(udidCardFileName ?? string.Empty),
                    ["DSWO"] = new JArray()
                };

                // Parse location from Formdetails
                JObject formDetails;
                try
                {
                    formDetails = JObject.Parse(application.Formdetails ?? "{}");
                }
                catch (JsonException ex)
                {
                    return BadRequest(new { status = false, message = $"Failed to parse Formdetails: {ex.Message}" });
                }

                if (!formDetails.TryGetValue("Location", out JToken? locationToken) || locationToken.Type == JTokenType.Null)
                    return BadRequest(new { status = false, message = "'Location' property is missing or null in Formdetails." });

                string location = locationToken.ToString();

                // Parse Officereditablefield for workflow
                JArray players;
                try
                {
                    players = JArray.Parse(service.Officereditablefield ?? "[]");
                }
                catch (JsonException ex)
                {
                    return BadRequest(new { status = false, message = $"Failed to parse Officereditablefield: {ex.Message}" });
                }

                if (players.Count == 0)
                    return Json(new { status = false, message = "No workflow players defined for this service." });

                // Generate CorrigendumId (improved to avoid collisions)
                var locationObj = JArray.Parse(location);
                int districtId = Convert.ToInt32(locationObj.First(l => l["name"]!.ToString() == "District")!["value"]);
                var finYear = helper.GetCurrentFinancialYear();
                var districtDetails = dbcontext.District.FirstOrDefault(s => s.Districtid == districtId);
                if (districtDetails == null)
                    return BadRequest(new { status = false, message = $"District with ID {districtId} not found." });

                string districtShort = districtDetails.Districtshort!;

                // Get count for corrigendum - we need to implement this method for PostgreSQL
                int count = GetCountPerDistrict(districtId, serviceId, "Amendment");

                string corrigendumNumber = string.Format(
                    "01{0:D2}{1:D2}{2}{3}{4:D4}",
                    service.Serviceid,
                    districtDetails.Districtid,
                    "03",
                    finYear.Split('-')[1],
                    count + 1
                );

                // Build workflow
                var filteredWorkflow = new JArray();
                foreach (var player in players)
                {
                    var filteredPlayer = new JObject
                    {
                        ["designation"] = player["designation"],
                        ["accessLevel"] = player["accessLevel"],
                        ["status"] = player["status"],
                        ["completedAt"] = player["completedAt"],
                        ["remarks"] = player["remarks"],
                        ["playerId"] = player["playerId"],
                        ["prevPlayerId"] = player["prevPlayerId"],
                        ["nextPlayerId"] = player["nextPlayerId"],
                        ["canPull"] = true
                    };
                    filteredWorkflow.Add(filteredPlayer);
                }

                if (filteredWorkflow.Count > 0)
                {
                    filteredWorkflow[0]["status"] = "pending";
                    filteredWorkflow[0]["remarks"] = "";
                    filteredWorkflow[0]["completedAt"] = "";
                }

                var workFlowJson = JsonConvert.SerializeObject(filteredWorkflow);

                var historyEntry = new
                {
                    actionTaker = "Citizen",
                    status = "Correction Submitted",
                    remarks = remarks,
                    actionTakenOn = DateTime.Now.ToString("dd MMM yyyy hh:mm:ss tt")
                };

                // Create new corrigendum
                var corrigendum = new Corrigendum
                {
                    Corrigendumid = corrigendumNumber,
                    Referencenumber = referenceNumber,
                    Location = location,
                    Corrigendumfields = JsonConvert.SerializeObject(corrigendumFields),
                    Workflow = workFlowJson,
                    Currentplayer = 0,
                    History = JsonConvert.SerializeObject(new List<dynamic> { historyEntry }),
                    Status = "Initiated",
                    Type = "Amendment",
                };

                dbcontext.Corrigendum.Add(corrigendum);
                await dbcontext.SaveChangesAsync();

                return Json(new
                {
                    status = true,
                    message = applicationId != null
                        ? $"Amendment updated with No. {corrigendumNumber} successfully."
                        : $"Amendment with No. {corrigendumNumber} forwarded successfully."
                });
            }
            catch (DbUpdateException ex)
            {
                return StatusCode(500, new { status = false, message = $"Database error occurred: {ex.InnerException?.Message ?? ex.Message}" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { status = false, message = $"An error occurred: {ex.Message}" });
            }
        }

        // Helper method to get count for corrigendum (PostgreSQL version)
        // private int GetCountPerDistrictForCorrigendum(int districtId, int serviceId, string type)
        // {
        //     try
        //     {
        //         // For PostgreSQL, we can use a direct query
        //         var count = dbcontext.Corrigendums
        //             .Where(c => c.Location!.Contains($"\"District\":\"{districtId}\"") ||
        //                        c.Location.Contains($"\"District\":{districtId}"))
        //             .Where(c => c.Type == type)
        //             .Count();

        //         return count;
        //     }
        //     catch (Exception ex)
        //     {
        //         _logger.LogError($"Error getting corrigendum count: {ex.Message}");
        //         return 0;
        //     }
        // }

        // You'll also need to update the GetCountPerDistrict method for PostgreSQL
        // private int GetCountPerDistrict(int districtId, int serviceId)
        // {
        //     try
        //     {
        //         var finYear = helper.GetCurrentFinancialYear();

        //         // For PostgreSQL, use direct Entity Framework query
        //         var count = dbcontext.CitizenApplications
        //             .Where(a => a.Serviceid == serviceId)
        //             .Where(a => a.Formdetails != null &&
        //                        (a.Formdetails.Contains($"\"District\":\"{districtId}\"") ||
        //                         a.Formdetails.Contains($"\"District\":{districtId}")))
        //             .Where(a => a.CreatedAt != null && a.CreatedAt.Contains(finYear))
        //             .Count();

        //         return count + 1; // +1 for the new application
        //     }
        //     catch (Exception ex)
        //     {
        //         _logger.LogError($"Error getting application count: {ex.Message}");
        //         return 1;
        //     }
        // }


    }
}