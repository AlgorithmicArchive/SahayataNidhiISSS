using System.Globalization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Primitives;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using SahayataNidhi.Models.Entities;
using System.Data;
using System.Text;
using System.Xml;
using Formatting = Newtonsoft.Json.Formatting;
using System.Security.Cryptography.X509Certificates;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.AspNetCore.Authorization;
using Npgsql;
using System.Net.Http.Headers;

namespace SahayataNidhi.Controllers.Officer
{
    public partial class OfficerController : Controller
    {
        public IActionResult UpdatePool(int Serviceid, string list)
        {
            var officer = GetOfficerDetails();
            var PoolList = dbcontext.Pool.FirstOrDefault(p => p.Serviceid == Convert.ToInt32(Serviceid) && p.Listtype == "Pool" && p.Accesslevel == officer.AccessLevel && p.Accesscode == officer.AccessCode);
            var pool = PoolList != null && !string.IsNullOrWhiteSpace(PoolList!.List) ? JsonConvert.DeserializeObject<List<string>>(PoolList.List) : [];
            var poolList = JsonConvert.DeserializeObject<List<string>>(list);
            foreach (var item in poolList!)
            {
                pool!.Add(item);
            }

            if (PoolList == null)
            {
                var newPool = new Pool
                {
                    Serviceid = Serviceid,
                    Accesslevel = officer.AccessLevel!,
                    Accesscode = (int)officer.AccessCode!,
                    List = JsonConvert.SerializeObject(pool),
                    Listtype = "Pool"
                };
                dbcontext.Pool.Add(newPool);
            }
            else
                PoolList!.List = JsonConvert.SerializeObject(pool);

            dbcontext.SaveChanges();
            return Json(new { status = true, Serviceid, list });
        }

        [HttpPost]
        public async Task<IActionResult> UpdatePdf([FromForm] IFormCollection form)
        {
            _logger.LogInformation($"Form: {form} ApplicationID: {form["applicationId"]}");

            if (form == null || !form.Files.Any() || string.IsNullOrEmpty(form["applicationId"]))
            {
                return BadRequest(new { status = false, response = "Missing form data." });
            }

            var signedPdf = form.Files["signedPdf"];
            var applicationId = form["applicationId"].ToString();

            if (signedPdf == null || signedPdf.Length == 0)
            {
                return BadRequest(new { status = false, response = "No file uploaded." });
            }

            try
            {
                string fileName = applicationId.Replace("/", "_") + "_SanctionLetter.pdf";

                using var memoryStream = new MemoryStream();
                await signedPdf.CopyToAsync(memoryStream);
                var fileData = memoryStream.ToArray();

                var existingFile = await dbcontext.Userdocuments
                    .FirstOrDefaultAsync(f => f.Filename == fileName);

                if (existingFile != null)
                {
                    existingFile.Filedata = fileData;
                    existingFile.Filetype = "application/pdf";
                    existingFile.Updatedat = DateTime.Now;
                }
                else
                {
                    dbcontext.Userdocuments.Add(new Userdocuments
                    {
                        Filename = fileName,
                        Filedata = fileData,
                        Filetype = "application/pdf",
                        Updatedat = DateTime.Now
                    });
                }

                await dbcontext.SaveChangesAsync();

                return Json(new { status = true, path = fileName });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { status = false, response = $"An error occurred while updating the sanction letter: {ex.Message}" });
            }
        }
        public async Task<IActionResult> SubmitDocumentChange(IFormCollection form)
        {
            try
            {
                var officer = GetOfficerDetails();
                if (officer == null)
                {
                    return Unauthorized("Officer details not found.");
                }

                string type = form["type"].ToString();
                if (string.IsNullOrWhiteSpace(type) || !new[] { "Corrigendum", "Correction", "Amendment" }.Contains(type))
                {
                    return BadRequest("Invalid or missing type. Must be 'Corrigendum', 'Correction', or 'Amendment'.");
                }

                List<string> Files = new List<string>();
                List<string> enclosureFiles = new List<string>();

                if (form.Files != null && form.Files.Count > 0)
                {
                    foreach (var formFile in form.Files)
                    {
                        if (formFile.Length > 0)
                        {
                            string filePath = await helper.GetFilePath(formFile);
                            Files.Add(filePath);
                        }
                    }
                }

                List<string> serverFiles = new List<string>();
                foreach (var key in form.Keys)
                {
                    if (key.StartsWith("serverFiles[") && key.EndsWith("]"))
                    {
                        string fileName = form[key].ToString();
                        if (!string.IsNullOrWhiteSpace(fileName))
                        {
                            serverFiles.Add(fileName);
                        }
                    }
                }

                string referenceNumber = form["referenceNumber"].ToString();
                if (string.IsNullOrWhiteSpace(referenceNumber))
                {
                    return BadRequest("Reference number is required.");
                }

                if (!int.TryParse(form["serviceId"].ToString(), out int serviceId))
                {
                    return BadRequest("Invalid service ID.");
                }

                string remarks = form["remarks"].ToString();
                string corrigendumFieldsJson = form["corrigendumFields"].ToString();
                if (string.IsNullOrWhiteSpace(corrigendumFieldsJson))
                {
                    return BadRequest($"{type} fields are required.");
                }

                string? applicationId = form.ContainsKey("applicationId") && !string.IsNullOrWhiteSpace(form["applicationId"]) ? form["applicationId"].ToString() : null;

                JObject newCorrigendumFields;
                try
                {
                    newCorrigendumFields = JsonConvert.DeserializeObject<JObject>(corrigendumFieldsJson)!;
                }
                catch (JsonException)
                {
                    return BadRequest($"Invalid {type.ToLower()} fields JSON format.");
                }

                var service = dbcontext.Services.FirstOrDefault(s => s.Serviceid == serviceId);
                if (service == null)
                {
                    return BadRequest($"Service with ID {serviceId} not found.");
                }

                var application = dbcontext.CitizenApplications.FirstOrDefault(a => a.Referencenumber == referenceNumber);
                if (application == null)
                {
                    return BadRequest($"Application with reference number '{referenceNumber}' not found.");
                }

                if (type == "Correction")
                {
                    var workFlow = JArray.Parse(application.Workflow ?? "[]");
                    if (workFlow.Count <= application.Currentplayer || workFlow[application.Currentplayer!]!["designation"]?.ToString() != officer.Role)
                    {
                        return Json(new { status = false, message = "You are not the current officer authorized to perform a Correction." });
                    }
                }

                JObject formDetailsJObject;
                try
                {
                    formDetailsJObject = JObject.Parse(application.Formdetails!)!;
                }
                catch (JsonException ex)
                {
                    return BadRequest($"Failed to deserialize form details for application with reference number '{referenceNumber}': {ex.Message}");
                }

                if (!formDetailsJObject.TryGetValue("Location", out JToken? locationToken) || locationToken.Type == JTokenType.Null)
                {
                    return BadRequest($"'Location' property is missing or null in form details for application with reference number '{referenceNumber}'.");
                }

                string location = locationToken.ToString();

                JArray players;
                try
                {
                    players = JArray.Parse(service.Officereditablefield ?? "[]");
                }
                catch (JsonException ex)
                {
                    return BadRequest($"Failed to parse Officereditablefield: {ex.Message}");
                }

                if (players.Count == 0)
                {
                    return Json(new { status = false, message = "No workflow players defined for this service." });
                }

                // --- Handle enclosure files (old logic) ---
                foreach (var prop in newCorrigendumFields.Properties())
                {
                    if (prop.Name != "Files")
                    {
                        var field = prop.Value as JObject;
                        if (field != null && field["type"]?.ToString() == "enclosure")
                        {
                            string fileName = field["new_value"]?.ToString()!;
                            if (!string.IsNullOrWhiteSpace(fileName))
                            {
                                var matchingFile = form.Files!.FirstOrDefault(f => Path.GetFileName(f.FileName) == fileName);
                                if (matchingFile != null && matchingFile.Length > 0)
                                {
                                    string filePath = await helper.GetFilePath(matchingFile);
                                    enclosureFiles.Add(filePath);
                                    field["new_value"] = Path.GetFileName(filePath);
                                }
                                else if (!serverFiles.Contains(fileName))
                                {
                                    return BadRequest($"File '{fileName}' for field '{prop.Name}' not found in uploaded files or server files.");
                                }
                            }
                        }
                    }
                }

                // --- CORRECTED: Handle per‑field supporting documents ---
                // Build a dictionary mapping field name to uploaded file
                var fieldSupportingFileMap = new Dictionary<string, IFormFile>();

                // Iterate through all uploaded files and check their Content-Disposition header
                foreach (var file in form.Files!)
                {
                    // The Content-Disposition header contains the field name
                    var contentDisposition = ContentDispositionHeaderValue.Parse(file.ContentDisposition);
                    string fieldName = contentDisposition.Name?.Trim('"') ?? "";

                    // Check if this is a field supporting document (starts with "fieldSupportingDocuments[")
                    if (fieldName.StartsWith("fieldSupportingDocuments[") && fieldName.EndsWith("]"))
                    {
                        // Extract the actual field name from fieldSupportingDocuments[FieldName]
                        string actualFieldName = fieldName.Substring(
                            "fieldSupportingDocuments[".Length,
                            fieldName.Length - "fieldSupportingDocuments[".Length - 1
                        );
                        fieldSupportingFileMap[actualFieldName] = file;
                    }
                }

                // Now iterate over each property in newCorrigendumFields
                foreach (var prop in newCorrigendumFields.Properties())
                {
                    if (prop.Name == "Files") continue; // skip the global files object

                    var fieldObj = prop.Value as JObject;
                    if (fieldObj == null) continue;

                    // Check if this field has a supporting_document property
                    if (fieldObj.TryGetValue("supporting_document", out JToken? supportingDocToken))
                    {
                        string? existingFilename = supportingDocToken?.ToString();

                        // If a new file was uploaded for this field, process it
                        if (fieldSupportingFileMap.TryGetValue(prop.Name, out IFormFile? newFile))
                        {
                            // Save the file
                            string savedPath = await helper.GetFilePath(newFile);
                            string savedFilename = Path.GetFileName(savedPath);

                            // Update the JSON with the new filename
                            fieldObj["supporting_document"] = savedFilename;
                        }
                        // else: keep existingFilename (which may be null or a string)
                    }
                }
                // --- END CORRECTED ---

                string? CorrigendumNumber = "";

                if (applicationId != null)
                {
                    var corrigendum = dbcontext.Corrigendum.FirstOrDefault(c => c.Corrigendumid == applicationId && c.Type == type);
                    if (corrigendum == null)
                    {
                        return BadRequest($"{type} with ID {applicationId} not found.");
                    }
                    var corrigendumFields = JObject.Parse(corrigendum.Corrigendumfields ?? "{}");

                    foreach (var prop in newCorrigendumFields.Properties())
                    {
                        if (prop.Name != "Files")
                        {
                            corrigendumFields[prop.Name] = prop.Value;
                        }
                    }

                    if (corrigendumFields["Files"] is not JObject corrigendumFiles)
                    {
                        corrigendumFiles = new JObject();
                        corrigendumFields["Files"] = corrigendumFiles;
                    }

                    var combinedFiles = Files.Select(Path.GetFileName).Concat(enclosureFiles.Select(Path.GetFileName)).Concat(serverFiles).Distinct().ToList();
                    corrigendumFiles[officer.RoleShort!] = new JArray(combinedFiles);

                    corrigendum.Corrigendumfields = corrigendumFields.ToString(Formatting.None);

                    JArray workFlow;
                    try
                    {
                        workFlow = JArray.Parse(corrigendum.Workflow ?? "[]");
                    }
                    catch (JsonException ex)
                    {
                        return BadRequest($"Failed to parse existing workflow: {ex.Message}");
                    }

                    if (workFlow.Count == 0)
                    {
                        return BadRequest("Existing workflow is empty.");
                    }

                    int currentPlayerIndex = corrigendum.Currentplayer;
                    if (currentPlayerIndex < 0 || currentPlayerIndex >= workFlow.Count)
                    {
                        return BadRequest("Invalid current player index.");
                    }

                    workFlow[currentPlayerIndex]["status"] = "forwarded";
                    workFlow[currentPlayerIndex]["canPull"] = "true";
                    workFlow[currentPlayerIndex]["remarks"] = remarks;
                    workFlow[currentPlayerIndex]["completedAt"] = DateTime.Now.ToString("dd MMM yyyy hh:mm:ss tt", CultureInfo.InvariantCulture);

                    if (currentPlayerIndex + 1 < workFlow.Count)
                    {
                        workFlow[currentPlayerIndex + 1]["status"] = "pending";
                        workFlow[currentPlayerIndex + 1]["remarks"] = "";
                        workFlow[currentPlayerIndex + 1]["completedAt"] = "";
                        corrigendum.Currentplayer = currentPlayerIndex + 1;
                    }

                    corrigendum.Workflow = JsonConvert.SerializeObject(workFlow);

                    List<dynamic> history;
                    try
                    {
                        history = JsonConvert.DeserializeObject<List<dynamic>>(corrigendum.History ?? "[]") ?? new List<dynamic>();
                    }
                    catch (JsonException ex)
                    {
                        return BadRequest($"Failed to parse existing history: {ex.Message}");
                    }

                    var newHistoryEntry = new
                    {
                        actionTaker = officer.Role + " " + GetOfficerArea(officer.AccessLevel!, formDetailsJObject),
                        status = "forwarded",
                        remarks = remarks,
                        actionTakenOn = DateTime.Now.ToString("dd MMM yyyy hh:mm:ss tt")
                    };

                    history.Add(newHistoryEntry);
                    corrigendum.History = JsonConvert.SerializeObject(history);
                    corrigendum.Type = type;

                    dbcontext.Corrigendum.Update(corrigendum);
                    CorrigendumNumber = corrigendum.Corrigendumid;
                }
                else
                {
                    var Location = formDetailsJObject["Location"];
                    int Districtid = Convert.ToInt32(Location!.FirstOrDefault(l => l["name"]!.ToString() == "District")!["value"]);
                    var finYear = helper.GetCurrentFinancialYear();
                    var districtDetails = dbcontext.District.FirstOrDefault(s => s.Districtid == Districtid);
                    string districtShort = districtDetails!.Districtshort!;
                    int count = GetCountPerDistrict(Districtid, serviceId);

                    var random = new Random();
                    var rnd = random.Next(100, 1000);

                    string typeCode = type switch
                    {
                        "Corrigendum" => "01",
                        "Correction" => "02",
                        "Amendment" => "03",
                        _ => throw new ArgumentException("Invalid type")
                    };

                    string corrigendumNumber = string.Format(
                        "01{0:D2}{1:D2}{2}{3}{4:D3}{5:D2}",
                        service.Serviceid,
                        districtDetails.Districtid,
                        typeCode,
                        finYear.Split('-')[1],
                        rnd,
                        count
                    );
                    CorrigendumNumber = corrigendumNumber;

                    var filteredWorkflow = new JArray();
                    foreach (var player in players)
                    {
                        var filteredPlayer = new JObject
                        {
                            ["designation"] = player["designation"],
                            ["accessLevel"] = player["accessLevel"]?.ToString() ?? string.Empty,
                            ["status"] = player["status"],
                            ["completedAt"] = player["completedAt"]?.ToString() ?? string.Empty,
                            ["remarks"] = player["remarks"],
                            ["playerId"] = player["playerId"],
                            ["prevPlayerId"] = player["prevPlayerId"],
                            ["nextPlayerId"] = player["nextPlayerId"],
                            ["canPull"] = player["canPull"]
                        };

                        filteredWorkflow.Add(filteredPlayer);
                    }

                    if (filteredWorkflow.Count > 0)
                    {
                        filteredWorkflow[0]["status"] = "forwarded";
                        filteredWorkflow[0]["remarks"] = remarks;
                        filteredWorkflow[0]["completedAt"] = DateTime.Now.ToString("dd MMM yyyy hh:mm:ss tt");
                        if (filteredWorkflow.Count > 1)
                        {
                            filteredWorkflow[1]["status"] = "pending";
                        }
                    }

                    var workFlow = JsonConvert.SerializeObject(filteredWorkflow);
                    var history = new
                    {
                        officer = officer.Role + " " + GetOfficerArea(officer.AccessLevel!, formDetailsJObject),
                        status = "Forwarded",
                        remarks = remarks,
                        actionTakenOn = DateTime.Now.ToString("dd MMM yyyy hh:mm:ss tt")
                    };

                    List<dynamic> History = new List<dynamic> { history };
                    var corrigendumFields = JObject.Parse(corrigendumFieldsJson);
                    corrigendumFields["Files"] = new JObject
                    {
                        [officer.RoleShort!] = new JArray(Files.Select(Path.GetFileName).Concat(enclosureFiles.Select(Path.GetFileName)).Concat(serverFiles).Distinct())
                    };

                    var corrigendum = new Corrigendum
                    {
                        Corrigendumid = CorrigendumNumber,
                        Referencenumber = referenceNumber,
                        Location = location,
                        Corrigendumfields = JsonConvert.SerializeObject(corrigendumFields),
                        Workflow = workFlow,
                        Currentplayer = filteredWorkflow.Count > 1 ? 1 : 0,
                        History = JsonConvert.SerializeObject(History),
                        Status = "Initiated",
                        Type = type
                    };

                    dbcontext.Corrigendum.Add(corrigendum);
                }

                dbcontext.SaveChanges();

                return Json(new
                {
                    status = true,
                    message = applicationId != null ? $"{type} updated with No. {CorrigendumNumber} successfully." : $"{type} with No. {CorrigendumNumber} forwarded successfully."
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    status = false,
                    message = $"An error occurred: {ex.Message}"
                });
            }
        }
        [HttpPost]
        public async Task<IActionResult> HandleCorrigendumAction([FromForm] IFormCollection form)
        {
            try
            {
                var officer = GetOfficerDetails();
                if (officer == null)
                {
                    return Unauthorized("Officer details not found.");
                }

                string type = form["type"].ToString();
                if (string.IsNullOrWhiteSpace(type) || !new[] { "Corrigendum", "Correction", "Amendment" }.Contains(type))
                {
                    return BadRequest("Invalid or missing type. Must be 'Corrigendum', 'Correction', or 'Amendment'.");
                }

                var referenceNumber = form["referenceNumber"].ToString();
                var action = form["action"].ToString();
                var remarks = form["remarks"].ToString();
                var corrigendumId = form["corrigendumId"].ToString();

                List<string> Files = new List<string>();
                if (form.Files != null && form.Files.Count > 0)
                {
                    foreach (var formFile in form.Files)
                    {
                        if (formFile.Length > 0)
                        {
                            string filePath = await helper.GetFilePath(formFile);
                            Files.Add(filePath);
                        }
                    }
                }

                var corrigendum = dbcontext.Corrigendum
                    .FirstOrDefault(c => c.Referencenumber == referenceNumber && c.Corrigendumid == corrigendumId && c.Type == type);
                if (corrigendum == null)
                {
                    return NotFound($"{type} not found.");
                }

                var CitizenApplications = dbcontext.CitizenApplications
                    .FirstOrDefault(c => c.Referencenumber == referenceNumber);
                if (CitizenApplications == null)
                {
                    return NotFound("Citizen application not found.");
                }

                if (type == "Correction")
                {
                    var workFlow = JArray.Parse(corrigendum.Workflow ?? "[]");
                    if (workFlow.Count <= corrigendum.Currentplayer || workFlow[corrigendum.Currentplayer]["designation"]?.ToString() != officer.Role)
                    {
                        return Json(new { status = false, message = "You are not the current officer authorized to handle this Correction." });
                    }
                }

                var formDetails = JObject.Parse(CitizenApplications.Formdetails!);

                int currentPlayer = corrigendum.Currentplayer;
                var workFlowCorrigendum = JArray.Parse(corrigendum.Workflow ?? "[]");
                if (workFlowCorrigendum.Count > 0)
                {
                    if (action == "forward")
                    {
                        workFlowCorrigendum[currentPlayer]["status"] = "forwarded";
                        workFlowCorrigendum[currentPlayer]["canPull"] = true;
                        if (currentPlayer + 1 < workFlowCorrigendum.Count)
                        {
                            workFlowCorrigendum[currentPlayer + 1]["status"] = "pending";
                            corrigendum.Currentplayer = currentPlayer + 1;
                        }
                    }
                    else if (action == "sanction")
                    {
                        workFlowCorrigendum[currentPlayer]["status"] = "sanctioned";
                        corrigendum.Status = "Sanctioned";
                    }
                    else if (action == "return")
                    {
                        workFlowCorrigendum[currentPlayer]["status"] = "returned";
                        workFlowCorrigendum[currentPlayer]["canPull"] = true;
                        if (currentPlayer > 0)
                        {
                            workFlowCorrigendum[currentPlayer - 1]["status"] = "pending";
                            workFlowCorrigendum[currentPlayer - 1]["remarks"] = "";
                            workFlowCorrigendum[currentPlayer - 1]["completedAt"] = "";
                            corrigendum.Currentplayer = currentPlayer - 1;
                        }
                    }
                    else if (action == "verified")
                    {
                        workFlowCorrigendum[currentPlayer]["status"] = "verified";
                        corrigendum.Status = "Verified";
                    }
                    else if (action == "reject")
                    {
                        workFlowCorrigendum[currentPlayer]["status"] = "rejected";
                        corrigendum.Status = "Rejected";
                    }
                    workFlowCorrigendum[currentPlayer]["remarks"] = remarks;
                    workFlowCorrigendum[currentPlayer]["completedAt"] = DateTime.Now.ToString("dd MMMM yyyy hh:mm:ss tt");
                    corrigendum.Workflow = workFlowCorrigendum.ToString(Formatting.None);
                }

                var corrigendumHistory = JsonConvert.DeserializeObject<List<dynamic>>(corrigendum.History ?? "[]");
                var newCorrigendumHistory = new
                {
                    actionTaker = officer.Role + " " + GetOfficerArea(officer.AccessLevel!, formDetails),
                    status = action,
                    remarks = remarks,
                    actionTakenOn = DateTime.Now.ToString("dd MMMM yyyy hh:mm:ss tt"),
                };
                corrigendumHistory!.Add(newCorrigendumHistory);
                corrigendum.History = JsonConvert.SerializeObject(corrigendumHistory);

                var corrigendumFields = JObject.Parse(corrigendum.Corrigendumfields);
                if (corrigendumFields["Files"] is not JObject filesObj)
                {
                    filesObj = new JObject();
                    corrigendumFields["Files"] = filesObj;
                }

                if (corrigendumFields["IfTemporaryDisabilityUdidCardValidUpto"] is JObject fieldObj)
                {
                    var newValue = fieldObj["new_value"]?.ToString();

                    if (!string.IsNullOrWhiteSpace(newValue))
                    {
                        var expiring = dbcontext.Applicationswithexpiringeligibility
                            .FirstOrDefault(ae => ae.Referencenumber == referenceNumber);

                        if (expiring != null)
                        {
                            expiring.ExpirationDate = newValue;
                            dbcontext.SaveChanges();
                        }
                        else
                        {
                            _logger.LogWarning($"No expiring eligibility found for reference {referenceNumber}.");
                        }
                    }
                    else
                    {
                        _logger.LogWarning($"Field 'new_value' is null or empty for 'IfTemporaryDisabilityUdidCardValidUpto'.");
                    }
                }

                var roleKey = officer.RoleShort!;
                var newFiles = new JArray(Files.Select(Path.GetFileName));
                if (filesObj[roleKey] is JArray existingFiles)
                {
                    foreach (var file in Files)
                    {
                        existingFiles.Add(file);
                    }
                }
                else
                {
                    filesObj[roleKey] = newFiles;
                }
                try
                {
                    var getServices = dbcontext.Webservice.FirstOrDefault(ws => ws.Serviceid == CitizenApplications.Serviceid && ws.Isactive);
                    if (getServices != null)
                    {
                        var onAction = JsonConvert.DeserializeObject<List<string>>(getServices.Onaction);
                        if (onAction != null && onAction.Contains(action))
                        {
                            var corrigendumPayload = new Dictionary<string, string>();
                            var corrigendumFieldsObj = JObject.Parse(corrigendum.Corrigendumfields);
                            foreach (var field in corrigendumFieldsObj.Properties())
                            {
                                var FieldObj = field.Value as JObject;
                                if (FieldObj != null)
                                {
                                    var name = FieldObj["name"]?.ToString();
                                    var newValue = FieldObj["new_value"]?.ToString();
                                    if (!string.IsNullOrEmpty(name) && !string.IsNullOrEmpty(newValue))
                                    {
                                        corrigendumPayload[name] = newValue;
                                    }
                                }
                            }

                            await SendApiRequestAsync(getServices.Apiendpoint, corrigendumPayload);
                        }
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine("Error in external service call: " + ex.Message);
                }
                corrigendum.Corrigendumfields = corrigendumFields.ToString(Formatting.None);
                corrigendum.Type = type;

                dbcontext.Corrigendum.Update(corrigendum);
                dbcontext.SaveChanges();

                return Json(new { status = true });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { status = false, response = ex.Message });
            }
        }

        [HttpPost]
        public async Task<IActionResult> UpdateCorrigendumPdf([FromForm] IFormCollection form)
        {
            try
            {
                _logger.LogInformation($"----------------- IS Form NULL : {form == null} IS File Available :{form!.Files.Any()} IS Refernce Number Empty: {string.IsNullOrEmpty(form["referenceNumber"])} IS Corrigendum : {string.IsNullOrEmpty(form["corrigendumId"])} IS Type : {string.IsNullOrEmpty(form["type"])} ---------------------------");
                if (form == null || !form.Files.Any() || string.IsNullOrEmpty(form["referenceNumber"]) || string.IsNullOrEmpty(form["corrigendumId"]) || string.IsNullOrEmpty(form["type"]))
                {
                    _logger.LogInformation("---------------- Missing form data for UpdateCorrigendumPdf. Form: {Form} -----------------------", form);
                    return BadRequest(new { status = false, response = "Missing form data, file, or type." });
                }

                string type = form["type"].ToString();
                if (type != "Corrigendum" && type != "Correction" && type != "Amendment")
                {
                    return BadRequest("Invalid type. Must be 'Corrigendum' or 'Correction' or 'Amendment'.");
                }

                var officer = GetOfficerDetails();
                if (officer == null)
                {
                    _logger.LogWarning("Officer details not found for applicationId: {ApplicationId}, corrigendumId: {Corrigendumid}", form["applicationId"], form["corrigendumId"]);
                    return Unauthorized(new { status = false, response = "Officer details not found." });
                }


                var signedPdf = form.Files["signedPdf"];
                var applicationId = form["referenceNumber"].ToString();
                var corrigendumId = form["corrigendumId"].ToString();

                if (signedPdf == null || signedPdf.Length == 0)
                {
                    _logger.LogWarning("No signed PDF uploaded for applicationId: {ApplicationId}, corrigendumId: {Corrigendumid}", applicationId, corrigendumId);
                    return BadRequest(new { status = false, response = "Signed PDF is required." });
                }

                if (signedPdf.ContentType != "application/pdf")
                {
                    _logger.LogWarning("Invalid file type uploaded for applicationId: {ApplicationId}, corrigendumId: {Corrigendumid}. Expected application/pdf, got {ContentType}", applicationId, corrigendumId, signedPdf.ContentType);
                    return BadRequest(new { status = false, response = "Invalid file type. Only PDF files are allowed." });
                }

                var corrigendum = await dbcontext.Corrigendum
                    .FirstOrDefaultAsync(c => c.Referencenumber == applicationId && c.Corrigendumid == corrigendumId && c.Type == type);
                if (corrigendum == null)
                {
                    _logger.LogWarning("{Type} not found for applicationId: {ApplicationId}, corrigendumId: {Corrigendumid}", type, applicationId, corrigendumId);
                    return NotFound(new { status = false, response = $"{type} not found." });
                }

                if (type == "Correction")
                {
                    var workFlow = JArray.Parse(corrigendum.Workflow ?? "[]");
                    if (workFlow.Count <= corrigendum.Currentplayer || workFlow[corrigendum.Currentplayer]["role"]?.ToString() != officer.Role)
                    {
                        return Json(new { status = false, message = "You are not the current officer authorized to update this Correction PDF." });
                    }
                }

                var fileName = corrigendumId.Replace("/", "_") + $"_{type}SanctionLetter.pdf";
                using var memoryStream = new MemoryStream();
                await signedPdf.CopyToAsync(memoryStream);
                var fileData = memoryStream.ToArray();

                var existingFile = await dbcontext.Userdocuments
                    .FirstOrDefaultAsync(f => f.Filename == fileName);
                if (existingFile != null)
                {
                    existingFile.Filedata = fileData;
                    existingFile.Filetype = "application/pdf";
                    existingFile.Updatedat = DateTime.Now;
                }
                else
                {
                    dbcontext.Userdocuments.Add(new Userdocuments
                    {
                        Filename = fileName,
                        Filedata = fileData,
                        Filetype = "application/pdf",
                        Updatedat = DateTime.Now
                    });
                }

                var workFlowCorrigendum = JArray.Parse(corrigendum.Workflow ?? "[]");
                if (workFlowCorrigendum.Count > 0)
                {
                    workFlowCorrigendum[corrigendum.Currentplayer]["status"] = "sanctioned";
                    workFlowCorrigendum[corrigendum.Currentplayer]["completedAt"] = DateTime.Now.ToString("dd MMMM yyyy hh:mm:ss tt");
                    corrigendum.Workflow = workFlowCorrigendum.ToString(Formatting.None);
                    corrigendum.Status = "Sanctioned";
                }

                dbcontext.Corrigendum.Update(corrigendum);
                await dbcontext.SaveChangesAsync();

                _logger.LogInformation("{Type} PDF updated and status set to sanctioned for applicationId: {ApplicationId}, corrigendumId: {Corrigendumid}", type, applicationId, corrigendumId);

                return Json(new { status = true, path = fileName });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating {Type} PDF for applicationId: {ApplicationId}, corrigendumId: {Corrigendumid}", form["type"], form["applicationId"], form["corrigendumId"]);
                return StatusCode(500, new { status = false, response = $"An error occurred while updating the {form["type"]} PDF: {ex.Message}" });
            }
        }

        [HttpPost]
        public async Task<IActionResult> SendExpirationEmail([FromForm] IFormCollection form)
        {
            try
            {
                string referenceNumber = form["referenceNumber"].ToString();
                string expirationDateString = form["expirationDate"].ToString();

                // If the string is empty, return an error
                if (string.IsNullOrWhiteSpace(expirationDateString))
                {
                    return Json(new { status = false, message = "Expiration date is required." });
                }

                // Parse the date - try multiple common formats
                DateTime parsedExpirationDate;
                string[] expectedFormats = {
                    "dd MMM yyyy",      // 27 Feb 2026
                    "dd/MM/yyyy",        // 27/02/2026
                    "yyyy-MM-dd",         // 2026-02-27
                    "dd-MM-yyyy"          // 27-02-2026
                };

                bool parseSuccess = DateTime.TryParseExact(
                    expirationDateString,
                    expectedFormats,
                    CultureInfo.InvariantCulture,
                    DateTimeStyles.None,
                    out parsedExpirationDate
                );

                // If exact parsing fails, try a more flexible approach
                if (!parseSuccess)
                {
                    parseSuccess = DateTime.TryParse(
                        expirationDateString,
                        CultureInfo.InvariantCulture,
                        DateTimeStyles.None,
                        out parsedExpirationDate
                    );
                }

                if (!parseSuccess)
                {
                    _logger.LogError($"Failed to parse expiration date: {expirationDateString}");
                    return Json(new { status = false, message = "Invalid date format. Please provide a valid date." });
                }

                var application = dbcontext.CitizenApplications.FirstOrDefault(ca => ca.Referencenumber == referenceNumber);
                if (application == null)
                    return Json(new { status = false, message = "Application not found." });

                var formDetailsJson = JObject.Parse(application.Formdetails!);
                string email = GetFieldValue("Email", formDetailsJson);
                string applicantName = GetFieldValue("ApplicantName", formDetailsJson);

                string htmlMessage = $@"
                <div style='font-family: Arial, sans-serif;'>
                    <h2 style='color: #2e6c80;'>UDID Card Validity Expiring</h2>
                    <p><strong>{applicantName}</strong>,</p>
                    <p>
                        This is a reminder that your UDID Card linked to application reference number 
                        <strong>{referenceNumber}</strong> is expiring on <strong>{parsedExpirationDate:dd MMM yyyy}</strong>.
                    </p>
                    <p>
                        Please renew your UDID card and update your application if a new one has been issued.
                        This is necessary to continue receiving financial assistance under ISSS without interruption.
                    </p>
                    <p>
                        You can log into the portal and update your UDID card details at your earliest convenience.
                    </p>
                    <p>
                        If you've already renewed your UDID card, kindly ignore this message.
                    </p>
                    <br />
                    <p style='font-size: 12px; color: #888;'><br />Your Application Team</p>
                </div>";

                var expiringApplications = dbcontext.Applicationswithexpiringeligibility
                    .FirstOrDefault(a => a.Referencenumber == referenceNumber);
                if (expiringApplications != null)
                {
                    expiringApplications.MailSent = expiringApplications.MailSent + 1;
                    await dbcontext.SaveChangesAsync();
                }

                await emailSender.SendEmail(email, "Important: UDID Card Validity Expiring", htmlMessage);

                return Json(new { status = true, message = "Email Sent Successfully" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in SendExpirationEmail");
                return Json(new { status = false, message = "An error occurred while sending the email." });
            }
        }

        [HttpPost]
        public async Task<IActionResult> CreateWithheldApplication([FromForm] IFormCollection form)
        {
            try
            {
                var officer = GetOfficerDetails();

                string referenceNumber = form["Referencenumber"].ToString();
                if (string.IsNullOrEmpty(referenceNumber))
                    return BadRequest(new { status = false, message = "Referencenumber is required." });

                if (!int.TryParse(form["Serviceid"], out int serviceId) || serviceId <= 0)
                    return BadRequest(new { status = false, message = "Valid Serviceid is required." });

                string withheldType = form["WithheldType"].ToString();
                string withheldReason = form["WithheldReason"].ToString();
                string action = form["Action"].ToString();
                bool isWithheld = true;

                if (string.IsNullOrEmpty(withheldType) || string.IsNullOrEmpty(withheldReason) || string.IsNullOrEmpty(action))
                    return BadRequest(new { status = false, message = "All required fields must be filled." });

                var existingApplication = dbcontext.WithheldApplications
                    .FirstOrDefault(wa => wa.Referencenumber == referenceNumber && wa.Serviceid == serviceId);

                if (existingApplication != null)
                    return BadRequest(new { status = false, message = "Application already exists." });

                var service = dbcontext.Services.FirstOrDefault(s => s.Serviceid == serviceId);
                if (service == null)
                    return BadRequest(new { status = false, message = "Service not found." });

                var citizenApp = dbcontext.CitizenApplications
                    .FirstOrDefault(ca => ca.Referencenumber == referenceNumber);
                if (citizenApp == null)
                    return BadRequest(new { status = false, message = "Citizen application not found." });

                List<dynamic> workflow;
                try
                {
                    workflow = JsonConvert.DeserializeObject<List<dynamic>>(service.Officereditablefield ?? "[]")!;
                }
                catch
                {
                    return BadRequest(new { status = false, message = "Invalid workflow configuration." });
                }

                dynamic currentOfficer = workflow.FirstOrDefault(p => p.designation == officer.Role)!;
                if (currentOfficer == null)
                    return BadRequest(new { status = false, message = "Officer not in workflow." });

                int currentPlayerId = (int)currentOfficer.playerId;
                bool isLastPlayer = currentPlayerId == workflow.Count - 1;

                bool canWithhold = (bool?)currentOfficer.canWithhold ?? false;
                bool canDirectWithheld = (bool?)currentOfficer.canDirectWithheld ?? false;

                if (!canWithhold && !canDirectWithheld)
                    return BadRequest(new { status = false, message = "You don't have authority to withhold." });

                if (action == "forward")
                {
                    if (isLastPlayer)
                        return BadRequest(new { status = false, message = "Last player cannot forward, must approve." });

                    if (!canWithhold)
                        return BadRequest(new { status = false, message = "You don't have 'canWithhold' authority to forward." });
                }
                else if (action == "approve")
                {
                    if (!canDirectWithheld && !isLastPlayer)
                        return BadRequest(new { status = false, message = "You don't have authority to directly approve." });
                }
                else
                {
                    return BadRequest(new { status = false, message = "Invalid action." });
                }

                var fileNames = new List<string>();
                var files = form.Files.GetFiles("Files");
                foreach (var file in files)
                {
                    if (file.Length > 0)
                    {
                        var fileName = await helper.GetFilePath(file);
                        if (!string.IsNullOrEmpty(fileName) && fileName != "No file provided.")
                        {
                            fileNames.Add(fileName);
                        }
                    }
                }

                JObject formDetailsJObject;
                try
                {
                    formDetailsJObject = JObject.Parse(citizenApp.Formdetails!);
                }
                catch
                {
                    return BadRequest(new { status = false, message = "Invalid form details." });
                }

                string location = formDetailsJObject["Location"]?.ToString() ?? "";

                var workflowStatus = new List<dynamic>();
                for (int i = 0; i < workflow.Count; i++)
                {
                    var status = "pending";
                    var completedAt = (string)null!;
                    var remarks = (string)null!;

                    if (i == currentPlayerId)
                    {
                        if (action == "approve")
                        {
                            status = "approved";
                            completedAt = DateTime.Now.ToString("dd MMM yyyy hh:mm:ss tt");
                            remarks = withheldReason;
                        }
                        else if (action == "forward")
                        {
                            status = "forwarded";
                            completedAt = DateTime.Now.ToString("dd MMM yyyy hh:mm:ss tt");
                            remarks = withheldReason;
                        }
                    }

                    workflowStatus.Add(new
                    {
                        designation = workflow[i].designation,
                        playerId = workflow[i].playerId,
                        status = status,
                        completedAt = completedAt,
                        remarks = remarks
                    });
                }

                var history = new List<dynamic>
                {
                    new
                    {
                        officer = officer.Role + " " + GetOfficerArea(officer.AccessLevel!, formDetailsJObject),
                        status = action == "approve" ? "withheld" : "forwarded",
                        remarks = withheldReason,
                        actionTakenOn = DateTime.Now.ToString("dd MMM yyyy hh:mm:ss tt"),
                        playerId = currentPlayerId
                    }
                };

                int nextPlayerId = currentPlayerId;
                if (action == "forward")
                {
                    nextPlayerId = currentPlayerId + 1;
                }

                var newApplication = new WithheldApplications
                {
                    Serviceid = serviceId,
                    Referencenumber = referenceNumber,
                    Location = location,
                    Workflow = JsonConvert.SerializeObject(workflowStatus),
                    Currentplayer = nextPlayerId,
                    History = JsonConvert.SerializeObject(history),
                    Iswithheld = isWithheld,
                    Withheldtype = withheldType,
                    Withheldreason = withheldReason,
                    Status = action == "approve" ? "Approved" : "Initiated",
                    Files = fileNames.Count > 0 ? JsonConvert.SerializeObject(fileNames) : null,
                };

                dbcontext.WithheldApplications.Add(newApplication);
                await dbcontext.SaveChangesAsync();

                return Ok(new
                {
                    status = true,
                    message = "Withheld application created successfully.",
                    files = fileNames
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { status = false, message = "Failed to create application: " + ex.Message });
            }
        }

        [HttpPost]
        public async Task<IActionResult> UpdateWithheldApplication([FromForm] IFormCollection form)
        {
            try
            {
                var officer = GetOfficerDetails();

                string referenceNumber = form["Referencenumber"].ToString();
                if (string.IsNullOrEmpty(referenceNumber))
                    return BadRequest(new { status = false, message = "Referencenumber is required." });

                if (!int.TryParse(form["Serviceid"], out int serviceId) || serviceId <= 0)
                    return BadRequest(new { status = false, message = "Valid Serviceid is required." });

                if (!bool.TryParse(form["Iswithheld"], out bool isWithheld))
                    return BadRequest(new { status = false, message = "Invalid Iswithheld value." });

                string withheldType = form["WithheldType"].ToString();
                string withheldReason = form["WithheldReason"].ToString();
                string action = form["Action"].ToString();

                var application = dbcontext.WithheldApplications
                    .FirstOrDefault(wa => wa.Referencenumber == referenceNumber && wa.Serviceid == serviceId);

                if (application == null)
                    return NotFound(new { status = false, message = "Application not found." });

                var service = dbcontext.Services.FirstOrDefault(s => s.Serviceid == serviceId);
                if (service == null)
                    return BadRequest(new { status = false, message = "Service not found." });

                var citizenApp = dbcontext.CitizenApplications
                    .FirstOrDefault(ca => ca.Referencenumber == referenceNumber);
                if (citizenApp == null)
                    return BadRequest(new { status = false, message = "Citizen application not found." });

                List<dynamic> workflow;
                try
                {
                    workflow = JsonConvert.DeserializeObject<List<dynamic>>(service.Officereditablefield ?? "[]")!;
                }
                catch
                {
                    return BadRequest(new { status = false, message = "Invalid workflow configuration." });
                }

                dynamic currentOfficer = workflow.FirstOrDefault(p => p.designation == officer.Role)!;
                if (currentOfficer == null)
                    return BadRequest(new { status = false, message = "Officer not in workflow." });

                int currentPlayerId = (int)currentOfficer.playerId;
                bool isLastPlayer = currentPlayerId == workflow.Count - 1;

                bool canWithhold = (bool?)currentOfficer.canWithhold ?? false;
                bool canDirectWithheld = (bool?)currentOfficer.canDirectWithheld ?? false;

                bool isWithholdingOfficer = false;
                var historyList = JsonConvert.DeserializeObject<List<dynamic>>(application.History ?? "[]");
                var withheldEntry = historyList?.LastOrDefault(h => h.status == "withheld" || h.status == "approved");
                if (withheldEntry != null && withheldEntry!.ContainsKey("playerId"))
                {
                    int withheldPlayerId = (int)withheldEntry!.playerId;
                    isWithholdingOfficer = currentPlayerId == withheldPlayerId;
                }

                if (application.Currentplayer != currentPlayerId)
                    return BadRequest(new { status = false, message = "You are not the current player for this application." });

                if (action == "approve")
                {
                    if (!isWithheld)
                    {
                        if (!isWithholdingOfficer && !isLastPlayer && !canDirectWithheld)
                            return BadRequest(new { status = false, message = "Only the officer who withheld, last player, or direct authority can approve release." });
                    }
                    else
                    {
                        if (!canDirectWithheld && !isLastPlayer)
                            return BadRequest(new { status = false, message = "You don't have authority to approve withheld." });
                    }
                }

                var existingFiles = new List<string>();
                if (!string.IsNullOrEmpty(application.Files))
                {
                    existingFiles = JsonConvert.DeserializeObject<List<string>>(application.Files) ?? new List<string>();
                }

                var newFiles = form.Files.GetFiles("Files");
                foreach (var file in newFiles)
                {
                    if (file.Length > 0)
                    {
                        var fileName = await helper.GetFilePath(file);
                        if (!string.IsNullOrEmpty(fileName) && fileName != "No file provided.")
                        {
                            existingFiles.Add(fileName);
                        }
                    }
                }

                var existingFilesFromForm = form["ExistingFiles"];
                if (!StringValues.IsNullOrEmpty(existingFilesFromForm))
                {
                    var filesToKeep = existingFilesFromForm.ToString().Split(',', StringSplitOptions.RemoveEmptyEntries);
                    existingFiles = existingFiles.Where(f => filesToKeep.Contains(f)).ToList();
                }

                JObject formDetailsJObject;
                try
                {
                    formDetailsJObject = JObject.Parse(citizenApp.Formdetails!);
                }
                catch
                {
                    return BadRequest(new { status = false, message = "Invalid form details." });
                }

                List<dynamic> workflowStatus;
                try
                {
                    workflowStatus = JsonConvert.DeserializeObject<List<dynamic>>(application.Workflow ?? "[]")!;
                }
                catch
                {
                    workflowStatus = new List<dynamic>();

                    for (int i = 0; i < workflow.Count; i++)
                    {
                        workflowStatus.Add(new
                        {
                            designation = workflow[i].designation,
                            playerId = workflow[i].playerId,
                            status = "pending",
                            completedAt = (string)null!,
                            remarks = (string)null!
                        });
                    }
                }

                if (workflowStatus.Count > currentPlayerId)
                {
                    workflowStatus[currentPlayerId].status = action == "approve" ? "approved" : "forwarded";
                    workflowStatus[currentPlayerId].completedAt = DateTime.Now.ToString("dd MMM yyyy hh:mm:ss tt");
                    workflowStatus[currentPlayerId].remarks = withheldReason;
                }

                List<dynamic> history;
                try
                {
                    history = JsonConvert.DeserializeObject<List<dynamic>>(application.History ?? "[]")!;
                }
                catch
                {
                    history = new List<dynamic>();
                }

                string historyStatus;
                if (action == "forward")
                {
                    historyStatus = "forwarded";
                    if (!isWithheld && application.Iswithheld)
                    {
                        withheldReason = $"Request to release: {withheldReason}";
                    }
                }
                else if (action == "approve")
                {
                    if (isWithheld)
                    {
                        historyStatus = "withheld";
                    }
                    else
                    {
                        historyStatus = "released";
                    }
                }
                else
                {
                    historyStatus = action;
                }

                history.Add(new
                {
                    officer = officer.Role + " " + GetOfficerArea(officer.AccessLevel!, formDetailsJObject),
                    status = historyStatus,
                    remarks = withheldReason,
                    actionTakenOn = DateTime.Now.ToString("dd MMM yyyy hh:mm:ss tt"),
                    playerId = currentPlayerId
                });

                int nextPlayerId = currentPlayerId;
                if (action == "forward")
                {
                    nextPlayerId = currentPlayerId + 1;
                }

                application.Withheldtype = withheldType;
                application.Withheldreason = withheldReason;
                application.Iswithheld = isWithheld;
                application.Currentplayer = nextPlayerId;
                application.History = JsonConvert.SerializeObject(history);
                application.Workflow = JsonConvert.SerializeObject(workflowStatus);
                application.Status = action == "approve" ? "Approved" : "Initiated";
                application.Files = existingFiles.Count > 0 ? JsonConvert.SerializeObject(existingFiles) : null;

                if (isWithheld && action == "approve")
                {
                    application.Withheldon = DateOnly.FromDateTime(DateTime.Now);
                }
                else if (!isWithheld && action == "approve")
                {
                    application.Withheldon = DateOnly.MinValue;
                }

                await dbcontext.SaveChangesAsync();

                return Ok(new
                {
                    status = true,
                    message = "Withheld application updated successfully.",
                    files = existingFiles
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { status = false, message = "Failed to update application: " + ex.Message });
            }
        }


        [HttpPost]
        public async Task<IActionResult> UpdateAadhaarToken([FromForm] IFormCollection form)
        {
            if (form == null)
                return BadRequest(new { success = false, message = "Form data is required." });

            var referenceNumber = form["referenceNumber"].ToString().Trim();
            var aadhaarToken = form["aadhaarToken"].ToString().Trim();

            if (string.IsNullOrWhiteSpace(referenceNumber))
                return BadRequest(new { success = false, message = "Referencenumber is required." });

            if (string.IsNullOrWhiteSpace(aadhaarToken))
                return BadRequest(new { success = false, message = "AadhaarToken is required." });

            try
            {
                // Call PostgreSQL function using FromSqlRaw
                await dbcontext.Database.ExecuteSqlRawAsync(
                    "SELECT update_aadhaar_token_by_reference({0}, {1})",
                    referenceNumber, aadhaarToken);

                return Ok(new { success = true, message = "Aadhaar token updated successfully." });
            }
            catch (PostgresException pgEx)
            {
                _logger.LogError(pgEx, "PostgreSQL error updating Aadhaar token for {Ref}", referenceNumber);
                return StatusCode(500, new { success = false, message = "Database error." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating Aadhaar token for {Ref}", referenceNumber);
                return StatusCode(500, new { success = false, message = "Server error." });
            }
        }

        [HttpPost]
        public async Task<IActionResult> PrepareEsign([FromForm] IFormFile pdfBlob, [FromForm] string userName, [FromForm] string signPosition, [FromForm] int pageNo, [FromForm] string applicationId)
        {
            var tempDir = Path.Combine(_webHostEnvironment.WebRootPath, "Temp");
            Directory.CreateDirectory(tempDir);

            var preparedPdfPath = Path.Combine(tempDir, $"prepared_pdf_{applicationId}_{Guid.NewGuid():N}.pdf");
            try
            {
                _logger.LogInformation("Starting eSign for applicationId: {ApplicationId}, user: {UserName}", applicationId, userName);

                if (pdfBlob == null || pdfBlob.Length == 0)
                    return BadRequest(new { status = false, message = "No PDF uploaded." });
                if (pageNo < 1)
                    return BadRequest(new { status = false, message = "Invalid page number." });
                if (string.IsNullOrEmpty(userName))
                    return BadRequest(new { status = false, message = "Username is required." });
                if (!new[] { "1", "2" }.Contains(signPosition))
                    return BadRequest(new { status = false, message = "Invalid sign position." });

                await using var inputStream = pdfBlob.OpenReadStream();
                var memoryStream = new MemoryStream();
                await inputStream.CopyToAsync(memoryStream);
                memoryStream.Position = 0;

                var clientCertPath = Path.Combine(_webHostEnvironment.WebRootPath, _config["Certificate:CertPath"] ?? throw new InvalidOperationException("Certificate:CertPath not configured"));
                var clientCertPassword = _config["Certificate:CertPassword"] ?? throw new InvalidOperationException("Certificate:CertPassword not configured");

                var callbackUrl = $"{Request.Scheme}://{Request.Host}/Officer/EsignResponse";
                var gatewayResponseUrl = $"https://esigngw.jk.gov.in/eSign21/response?rs={Uri.EscapeDataString(callbackUrl)}";

                var txnId = $"999-EDJK-{DateTime.Now:yyyyMMddHHmmss}-{Guid.NewGuid():N}".Substring(0, 30);
                _logger.LogInformation("Generated txnId: {TxnId}", txnId);

                var sb = new StringBuilder();
                byte[] preparedPdf = null!;
                var xmlSettings = new XmlWriterSettings
                {
                    Indent = false,
                    NewLineHandling = NewLineHandling.None,
                    OmitXmlDeclaration = false
                };

                using (var writer = XmlWriter.Create(sb, xmlSettings))
                {
                    writer.WriteProcessingInstruction("xml", @"version=""1.0"" encoding=""UTF-8""");
                    writer.WriteStartElement("Esign");
                    writer.WriteAttributeString("AuthMode", "1");
                    writer.WriteAttributeString("ver", "2.1");
                    writer.WriteAttributeString("sc", "Y");
                    writer.WriteAttributeString("ts", DateTime.Now.ToString("yyyy-MM-ddTHH:mm:ss", CultureInfo.InvariantCulture));
                    writer.WriteAttributeString("txn", txnId);
                    writer.WriteAttributeString("ekycId", "");
                    writer.WriteAttributeString("aspId", "JKIT-900");
                    writer.WriteAttributeString("ekycIdType", "A");
                    writer.WriteAttributeString("responseSigType", "pkcs7");
                    writer.WriteAttributeString("responseUrl", gatewayResponseUrl);

                    writer.WriteStartElement("Docs");
                    writer.WriteStartElement("InputHash");
                    writer.WriteAttributeString("id", "1");
                    writer.WriteAttributeString("hashAlgorithm", "SHA256");
                    writer.WriteAttributeString("docInfo", "Sanction Letter");

                    var (documentHash, pdfBytes) = await GetDocumentHashAsync(memoryStream, userName, signPosition, pageNo);
                    preparedPdf = pdfBytes;
                    writer.WriteString(documentHash);

                    writer.WriteEndElement();
                    writer.WriteEndElement();
                    writer.WriteEndElement();
                    writer.Flush();
                }

                var strxml = sb.ToString().Trim();
                if (string.IsNullOrEmpty(strxml))
                    throw new InvalidOperationException("Generated XML is empty");

                _logger.LogDebug("Generated XML preview: {Xml}", strxml.Substring(0, Math.Min(strxml.Length, 500)));

                if (!System.IO.File.Exists(clientCertPath))
                    throw new FileNotFoundException("Client certificate not found", clientCertPath);

                var clientCert = X509CertificateLoader.LoadPkcs12FromFile(clientCertPath, clientCertPassword, X509KeyStorageFlags.EphemeralKeySet);
                if (clientCert.NotAfter < DateTime.Now)
                    throw new InvalidOperationException("Client certificate has expired");

                _logger.LogInformation("Certificate loaded: Subject={Subject}, Thumbprint={Thumbprint}, ValidFrom={ValidFrom}, ValidTo={ValidTo}",
                    clientCert.Subject, clientCert.Thumbprint, clientCert.NotBefore, clientCert.NotAfter);

                var signedXml = SignXml(strxml);
                _logger.LogDebug("Signed XML preview: {SignedXml}", signedXml.Substring(0, Math.Min(signedXml.Length, 500)));

                var xmlFilePath = Path.Combine(_webHostEnvironment.WebRootPath, "Uploads", $"xml_{applicationId}_{txnId}.xml");
                _logger.LogInformation("Saving XML to path: {Path}", xmlFilePath);
                await System.IO.File.WriteAllTextAsync(xmlFilePath, signedXml);

                await System.IO.File.WriteAllBytesAsync(preparedPdfPath, preparedPdf);
                if (!System.IO.File.Exists(preparedPdfPath))
                    throw new IOException($"Failed to save temporary PDF at {preparedPdfPath}");

                _logger.LogInformation("Saved temporary PDF at {Path}", preparedPdfPath);

                var cacheEntry = new
                {
                    PreparedPdfPath = preparedPdfPath,
                    ApplicationId = applicationId,
                    TxnId = txnId
                };
                var cacheKey = $"esign_{txnId}";
                _memoryCache.Set(cacheKey, cacheEntry, TimeSpan.FromHours(1));
                _logger.LogInformation("Cached eSign data with key: {CacheKey}", cacheKey);

                return Ok(new
                {
                    status = true,
                    signedXml = System.IO.File.ReadAllText(xmlFilePath),
                    clientrequestURL = callbackUrl,
                    username = userName,
                    userId = "2",
                    txnId = txnId
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in PrepareEsign: {Message}", ex.Message);
                if (System.IO.File.Exists(preparedPdfPath))
                {
                    try { System.IO.File.Delete(preparedPdfPath); } catch { }
                }
                return StatusCode(500, new { status = false, message = ex.Message });
            }
        }

        [HttpGet]
        public IActionResult CheckESignStatus([FromQuery] string applicationId)
        {
            try
            {
                var signedPdfPath = Path.Combine(_webHostEnvironment.WebRootPath, "Temp", $"signed_pdf_{applicationId}.pdf");
                var isSigned = System.IO.File.Exists(signedPdfPath);
                _logger.LogInformation("Checking eSign status for applicationId: {ApplicationId}, Signed PDF exists: {IsSigned}", applicationId, isSigned);
                var fileName = applicationId.Replace("/", "_") + "_SanctionLetter.pdf";
                return Ok(new { success = isSigned, path = isSigned ? fileName : null });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in CheckESignStatus: {Message}", ex.Message);
                return StatusCode(500, new { success = false, message = ex.Message });
            }
        }

        [HttpPost]
        [AllowAnonymous]
        [IgnoreAntiforgeryToken]
        public async Task<IActionResult> EsignResponse(IFormCollection form)
        {
            string? preparedPath = null;
            try
            {
                _logger.LogInformation("Processing EsignResponse action");
                _logger.LogInformation("Response headers: {Headers}", string.Join(", ", Request.Headers.Select(h => $"{h.Key}: {h.Value}")));
                _logger.LogInformation("Response form data: {FormData}", string.Join(", ", form.Select(f => $"{f.Key}: {f.Value.ToString().Substring(0, Math.Min(f.Value.ToString().Length, 100))}")));

                var resp = form["respon"];
                if (string.IsNullOrEmpty(resp))
                {
                    _logger.LogWarning("No response XML received");
                    return Json(new { success = false, message = "No response received from eSign service." });
                }

                var xmlDoc = new XmlDocument();
                xmlDoc.LoadXml(resp!);
                var txnId = xmlDoc.SelectSingleNode("/EsignResp/@txn")?.Value;
                if (string.IsNullOrEmpty(txnId))
                {
                    _logger.LogWarning("No transaction ID in response XML");
                    return Json(new { success = false, message = "Invalid response: No transaction ID." });
                }
                _logger.LogInformation("Received txnId: {TxnId}", txnId);

                var cacheKey = $"esign_{txnId}";
                if (!_memoryCache.TryGetValue(cacheKey, out dynamic? cacheEntry))
                {
                    _logger.LogWarning("No cache entry found for key: {CacheKey}", cacheKey);
                    return Json(new { success = false, message = "Invalid session data or temporary PDF not found. Cache key missing." });
                }

                preparedPath = cacheEntry!.PreparedPdfPath as string;
                var applicationId = cacheEntry.ApplicationId as string;
                var cachedTxnId = cacheEntry.TxnId as string;

                if (string.IsNullOrEmpty(applicationId) || string.IsNullOrEmpty(preparedPath))
                {
                    _logger.LogWarning("Invalid cache data: ApplicationId={ApplicationId}, PreparedPdfPath={PreparedPdfPath}", applicationId, preparedPath);
                    return Json(new { success = false, message = "Invalid cache data." });
                }

                if (cachedTxnId != txnId)
                {
                    _logger.LogWarning("Transaction ID mismatch: Cached={CachedTxnId}, Received={ReceivedTxnId}", cachedTxnId, txnId);
                    return Json(new { success = false, message = "Transaction ID mismatch." });
                }

                if (!System.IO.File.Exists(preparedPath))
                {
                    _logger.LogWarning("Temporary PDF not found at {PreparedPath}", preparedPath);
                    return Json(new { success = false, message = "Temporary PDF not found." });
                }

                if (!CheckESignUserName(resp!))
                {
                    _logger.LogWarning("Invalid user certificate");
                    return Json(new { success = false, message = "Invalid user certificate." });
                }

                var signedPdfPath = Path.Combine(_webHostEnvironment.WebRootPath, "Temp", $"signed_pdf_{applicationId}.pdf");

                byte[] pdfBytes;
                await using (var fileStream = new FileStream(preparedPath, FileMode.Open, FileAccess.Read))
                using (var ms = new MemoryStream())
                {
                    await fileStream.CopyToAsync(ms);
                    pdfBytes = ms.ToArray();
                }


                using (var memoryStream = new MemoryStream())
                {
                    await memoryStream.WriteAsync(pdfBytes, 0, pdfBytes.Length);
                    memoryStream.Position = 0;

                    _logger.LogDebug("Embedding signature into PDF for applicationId: {ApplicationId}", applicationId);
                    EmbedSignature(resp!, memoryStream);
                    await memoryStream.FlushAsync();

                    await System.IO.File.WriteAllBytesAsync(signedPdfPath, memoryStream.ToArray());
                }

                try
                {
                    System.IO.File.Delete(preparedPath);
                    _logger.LogInformation("Deleted temporary PDF at {PreparedPath}", preparedPath);
                }
                catch (IOException ex)
                {
                    _logger.LogWarning("Failed to delete temporary PDF at {PreparedPath}: {Message}", preparedPath, ex.Message);
                }

                var node = xmlDoc.SelectSingleNode("/EsignResp");
                var esign_status = node?.Attributes?["status"]?.Value ?? "";
                var interrorCode = node?.Attributes?["errCode"]?.Value ?? "";
                var strmsg = node?.Attributes?["errMsg"]?.Value ?? "";
                if (esign_status != "1")
                {
                    _logger.LogWarning("eSign failed: {ErrorMsg} ({ErrorCode})", strmsg, interrorCode);
                    return Json(new { success = false, message = $"eSign failed: {strmsg} ({interrorCode})" });
                }

                var xmlFilePathPattern = Path.Combine(_webHostEnvironment.WebRootPath, "Uploads", $"xml_{applicationId}_*.xml");
                foreach (var file in System.IO.Directory.GetFiles(Path.GetDirectoryName(xmlFilePathPattern) ?? "", Path.GetFileName(xmlFilePathPattern)))
                {
                    _logger.LogInformation("Cleaning up XML file at {Path}", file);
                    try
                    {
                        System.IO.File.Delete(file);
                    }
                    catch (IOException ex)
                    {
                        _logger.LogWarning("Failed to delete XML file at {Path}: {Message}", file, ex.Message);
                    }
                }

                byte[] signedBytes;
                await using (var fs = new FileStream(signedPdfPath, FileMode.Open, FileAccess.Read))
                using (var ms = new MemoryStream())
                {
                    await fs.CopyToAsync(ms);
                    signedBytes = ms.ToArray();
                }


                var fileName = applicationId.Replace("/", "_") + "_SanctionLetter.pdf";
                var existingFile = await dbcontext.Userdocuments.FirstOrDefaultAsync(f => f.Filename == fileName);
                if (existingFile != null)
                {
                    existingFile.Filedata = signedBytes;
                    existingFile.Updatedat = DateTime.Now;
                }
                else
                {
                    dbcontext.Userdocuments.Add(new Userdocuments
                    {
                        Filename = fileName,
                        Filedata = signedBytes,
                        Filetype = "application/pdf",
                        Updatedat = DateTime.Now
                    });
                }
                await dbcontext.SaveChangesAsync();

                _memoryCache.Remove(cacheKey);
                _logger.LogInformation("Removed cache entry for key: {CacheKey}", cacheKey);

                _logger.LogInformation("eSign completed successfully for applicationId: {ApplicationId}", applicationId);
                return Json(new { success = true, message = "PDF signed successfully.", path = fileName });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in EsignResponse: {Message}", ex.Message);
                if (!string.IsNullOrEmpty(preparedPath) && System.IO.File.Exists(preparedPath))
                {
                    try { System.IO.File.Delete(preparedPath); } catch { }
                }
                return Json(new { success = false, message = $"Error processing response: {ex.Message}" });
            }
        }
    }
}