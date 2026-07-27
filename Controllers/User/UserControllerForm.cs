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
        // public void ServiceSpecific(int Serviceid, JToken formDetails, string ReferenceNumber)
        // {
        //     _logger.LogInformation($"--------- SERVICE ID: {Serviceid} ------------------------------");
        //     if (Serviceid == 1)
        //     {
        //         var KindOfDisability = FindFieldRecursively(formDetails, "KindOfDisability");
        //         if (KindOfDisability != null && (string)KindOfDisability!["value"]! == "TEMPORARY")
        //         {
        //             string ExpirationDate = (string)FindFieldRecursively(formDetails, "IfTemporaryDisabilityUdidCardValidUpto")!["value"]!;
        //             var expiringEligibility = new Applicationswithexpiringeligibility
        //             {
        //                 Serviceid = Serviceid,
        //                 ExpirationDate = ExpirationDate,
        //                 Referencenumber = ReferenceNumber,
        //             };
        //             dbcontext.Applicationswithexpiringeligibility.Add(expiringEligibility);
        //             dbcontext.SaveChanges();
        //         }
        //     }
        // }

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
        public async Task<IActionResult> InsertFormDetails([FromForm] IFormCollection form)
        {
            int userId = Convert.ToInt32(User.FindFirst(ClaimTypes.NameIdentifier)?.Value);
            int serviceId = Convert.ToInt32(form["serviceId"].ToString());
            string formDetailsJson = form["formDetails"].ToString();
            string status = form["status"].ToString();
            string ReferenceNumber = form["referenceNumber"].ToString();

            var formDetailsObj = JObject.Parse(formDetailsJson);
            var formdetailsToken = JToken.Parse(formDetailsJson);

            var allFields = formDetailsObj.Properties()
                .Where(prop => prop.Value is JArray)
                .SelectMany(prop => (JArray)prop.Value)
                .OfType<JObject>();

            var fileHashMap = new Dictionary<string, string>();
            foreach (var file in form.Files)
            {
                string fileHash;
                using (var stream = file.OpenReadStream())
                using (var sha256 = SHA256.Create())
                {
                    byte[] hashBytes = await sha256.ComputeHashAsync(stream);
                    fileHash = Convert.ToBase64String(hashBytes);
                }
                if (!fileHashMap.TryGetValue(fileHash, out string? filePath))
                {
                    filePath = await helper.GetFilePath(file, null, null, "document");
                    fileHashMap[fileHash] = filePath;
                }
                foreach (var field in allFields.Where(f => f["name"]?.ToString() == file.Name))
                    field["File"] = filePath;
            }

            int districtId = Convert.ToInt32(FindFieldRecursively(formdetailsToken, "District")!["value"]);

            var districtDetails = await dbcontext.District.FirstOrDefaultAsync(s => s.Districtid == districtId);
            var service = await dbcontext.Services.FirstOrDefaultAsync(s => s.Serviceid == serviceId);

            if (districtDetails == null || service == null)
                return Json(new { status = false, message = "District or service not found." });

            int divisionCode = 0;
            int locationValue;
            string locationLevel;

            string? tehsilValue = FindFieldRecursively(formdetailsToken, "Tehsil")?["value"]?.ToString();
            if (!string.IsNullOrWhiteSpace(tehsilValue))
            {
                locationLevel = "Tehsil";
                locationValue = Convert.ToInt32(tehsilValue);
            }
            else
            {
                locationLevel = "District";
                locationValue = districtId;
            }

            if (locationLevel == "Tehsil")
            {
                var tehsil = await dbcontext.Tehsil.FirstOrDefaultAsync(t => t.Tehsilid == locationValue);
                if (tehsil != null)
                {
                    var district = await dbcontext.District.FirstOrDefaultAsync(d => d.Districtid == tehsil.Districtid);
                    divisionCode = district?.Division ?? 0;
                }
            }
            else
            {
                divisionCode = districtDetails.Division;
            }

            string workFlow = string.Empty;
            string officerRole = string.Empty;
            string officerArea = districtDetails.Districtname!;

            if (string.IsNullOrEmpty(ReferenceNumber))
            {
                int count = GetCountPerDistrict(districtId, serviceId);
                string districtShort = districtDetails.Districtshort!;
                if (string.IsNullOrEmpty(service.Officereditablefield))
                    return Json(new { status = false });

                var players = JArray.Parse(service.Officereditablefield);
                if (players.Count == 0)
                    return Json(new { status = false });

                var filteredWorkflow = new JArray(
                    players.Select(p => new JObject
                    {
                        ["designation"] = p["designation"],
                        ["accessLevel"] = p["accessLevel"]?.ToString() ?? string.Empty,
                        ["status"] = p["status"],
                        ["completedAt"] = p["completedAt"]?.ToString() ?? string.Empty,
                        ["remarks"] = p["remarks"],
                        ["additionalFields"] = "",
                        ["playerId"] = p["playerId"],
                        ["prevPlayerId"] = p["prevPlayerId"],
                        ["nextPlayerId"] = p["nextPlayerId"],
                        ["canPull"] = p["canPull"]
                    })
                );

                filteredWorkflow[0]["status"] = "pending";
                officerRole = filteredWorkflow[0]["designation"]?.ToString() ?? string.Empty;
                workFlow = filteredWorkflow.ToString(Formatting.None);

                var finYear = helper.GetCurrentFinancialYear();
                var ReferenceNumberAlphaNumber = "JK-" + service.Nameshort + "-" + districtShort + "/" + finYear + "/" + count;
                var random = new Random();
                ReferenceNumber = "01" + service.Serviceid.ToString("D2") + districtDetails.Districtid.ToString("D2") + finYear.Split("-")[1] + random.Next(100, 1000) + count;

                var createdAt = DateTime.Now.ToString("dd MMM yyyy hh:mm:ss tt", CultureInfo.InvariantCulture);
                var newFormDetails = new CitizenApplications
                {
                    Referencenumber = ReferenceNumber,
                    Referencenumberalphanumeric = ReferenceNumberAlphaNumber,
                    CitizenId = userId,
                    Serviceid = serviceId,
                    Districtuidforbank = null,
                    Formdetails = formDetailsObj.ToString(),
                    Currentplayer = 0,
                    Workflow = workFlow,
                    Status = status,
                    Datatype = "new",
                    CreatedAt = createdAt
                };
                dbcontext.CitizenApplications.Add(newFormDetails);
            }
            else
            {
                var application = await dbcontext.CitizenApplications
                    .FirstOrDefaultAsync(a => a.Referencenumber == ReferenceNumber);
                if (application == null)
                    return Json(new { status = false, message = "Application not found." });
                application.Formdetails = formDetailsObj.ToString();
                if (application.Status != status)
                    application.Status = status;
                application.CreatedAt = DateTime.Now.ToString("dd MMM yyyy hh:mm:ss tt", CultureInfo.InvariantCulture);
            }

            await dbcontext.SaveChangesAsync();

            // ========== Entity Framework Upsert for status_counts_snapshot ==========
            if (!string.IsNullOrEmpty(workFlow))
            {
                string takenBy = "";
                try
                {
                    var workflowArray = JArray.Parse(workFlow);
                    if (workflowArray.Count > 0)
                        takenBy = workflowArray[0]["designation"]?.ToString() ?? "";
                }
                catch { }

                using var transaction = await dbcontext.Database
                    .BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
                try
                {
                    var snapshotKey = new
                    {
                        p_service_id = serviceId,
                        p_access_level = locationLevel,
                        p_access_code = locationValue,
                        p_division_code = divisionCode,
                        p_taken_by = takenBy,
                        p_data_type = "new"
                    };

                    var existing = await dbcontext.StatusCountsSnapshot
                        .FirstOrDefaultAsync(s =>
                            s.PServiceId == snapshotKey.p_service_id &&
                            s.PAccessLevel == snapshotKey.p_access_level &&
                            s.PAccessCode == snapshotKey.p_access_code &&
                            s.PDivisionCode == snapshotKey.p_division_code &&
                            s.PTakenBy == snapshotKey.p_taken_by &&
                            s.PDataType == snapshotKey.p_data_type);

                    if (existing != null)
                    {
                        existing.Pendingcount++;
                        existing.Totalapplications++;
                        existing.CapturedAt = DateTime.UtcNow;
                    }
                    else
                    {
                        var snapshot = new StatusCountsSnapshot
                        {
                            CapturedAt = DateTime.UtcNow,
                            PAccessLevel = snapshotKey.p_access_level,
                            PAccessCode = snapshotKey.p_access_code,
                            PServiceId = snapshotKey.p_service_id,
                            PTakenBy = snapshotKey.p_taken_by,
                            PDivisionCode = snapshotKey.p_division_code,
                            PDataType = snapshotKey.p_data_type,
                            Pendingcount = 1,
                            Totalapplications = 1
                        };
                        dbcontext.StatusCountsSnapshot.Add(snapshot);
                    }

                    await dbcontext.SaveChangesAsync();
                    await transaction.CommitAsync();
                }
                catch
                {
                    await transaction.RollbackAsync();
                    throw;
                }
            }

            // ========== End of snapshot upsert ==========

            if (status == "Initiated")
            {
                // Background API call (same as before)
                try
                {
                    var webService = await dbcontext.Webservice
                        .FirstOrDefaultAsync(ws => ws.Serviceid == serviceId && ws.Isactive);
                    if (webService != null)
                    {
                        var onAction = JsonConvert.DeserializeObject<List<string>>(webService.Onaction);
                        if (onAction != null && onAction.Contains("Submission"))
                        {
                            _taskQueue.QueueBackgroundWorkItem(async token =>
                            {
                                using var scope = _serviceScopeFactory.CreateScope();
                                var db = scope.ServiceProvider.GetRequiredService<SwdjkContext>();
                                try
                                {
                                    var fieldMapObj = JObject.Parse(webService.Fieldmappings);
                                    var fieldMap = MapServiceFieldsFromForm(formDetailsObj, fieldMapObj);
                                    await SendApiRequestAsync(webService.Apiendpoint, fieldMap);
                                }
                                catch (Exception ex)
                                {
                                    _logger.LogError(ex, $"Background API failed for {ReferenceNumber}");
                                }
                            });
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, $"Failed scheduling API for {ReferenceNumber}");
                }

                string fullPath = await FetchAcknowledgementDetails(ReferenceNumber);
                string? fullName = GetFormFieldValue(formDetailsObj, "ApplicantName");
                string? serviceName = service.Servicename;
                string? email = GetFormFieldValue(formDetailsObj, "Email")
                              ?? GetFormFieldValue(formDetailsObj, "email")
                              ?? GetFormFieldValue(formDetailsObj, "EmailAddress");
                if (!string.IsNullOrWhiteSpace(email) && IsValidEmail(email))
                {
                    var emailTemplateObj = await dbcontext.Emailsettings.FirstOrDefaultAsync();
                    if (emailTemplateObj != null)
                    {
                        var templateJson = JObject.Parse(emailTemplateObj.Templates!);
                        string template = templateJson["Submission"]!.ToString();
                        var placeholders = new Dictionary<string, string>
                {
                    { "ApplicantName", fullName ?? "" },
                    { "ServiceName", serviceName! },
                    { "ReferenceNumber", ReferenceNumber },
                    { "OfficerRole", officerRole },
                    { "OfficerArea", officerArea }
                };
                        foreach (var pair in placeholders)
                            template = template.Replace($"{{{pair.Key}}}", pair.Value);
                        string htmlMessage = template;

                        var fileResult = await DisplayFile(fullPath.Split('=')[1]);
                        if (fileResult is FileContentResult fileContent)
                        {
                            _taskQueue.QueueBackgroundWorkItem(async token =>
                            {
                                try
                                {
                                    await emailSender.SendEmailWithAttachments(
                                        email!,
                                        "Form Submission",
                                        htmlMessage,
                                        fileContent.FileContents,
                                        ReferenceNumber.Replace("/", "_") + "_Acknowledgement.pdf"
                                    );
                                }
                                catch (Exception ex)
                                {
                                    _logger.LogError(ex, $"Email failed for {ReferenceNumber}");
                                }
                            });
                        }
                    }
                }

                helper.InsertHistory(ReferenceNumber, "Application Submission", "Citizen", "Submitted",
                                     locationLevel, locationValue);
                return Json(new { status = true, ReferenceNumber, type = "Submit" });
            }
            else
            {
                return Json(new { status = true, ReferenceNumber, type = "Save" });
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