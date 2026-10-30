using System.Text;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Npgsql;
using SahayataNidhi.Models.Entities;
using ServicesEntity = SahayataNidhi.Models.Entities.Services;

namespace SahayataNidhi.Controllers
{
    public partial class DesignerController
    {
        [HttpPost]
        public IActionResult ToggleServiceActive([FromForm] IFormCollection form)
        {
            int serviceId = Convert.ToInt32(form["serviceId"].ToString());
            bool active = Convert.ToBoolean(form["active"]);

            var svc = dbcontext.Services.FirstOrDefault(s => s.Serviceid == serviceId);
            if (svc == null)
                return Json(new { status = false, message = "Not found" });

            svc.Active = active;
            dbcontext.SaveChanges();
            return Json(new { status = true, active = svc.Active });
        }

        [HttpPost]
        public IActionResult ToggleServiceActiveForOfficers([FromForm] IFormCollection form)
        {
            int serviceId = Convert.ToInt32(form["serviceId"].ToString());
            bool activeForOfficers = Convert.ToBoolean(form["activeForOfficers"]);

            var svc = dbcontext.Services.FirstOrDefault(s => s.Serviceid == serviceId);
            if (svc == null)
                return Json(new { status = false, message = "Not found" });

            svc.Activeforofficers = activeForOfficers;
            dbcontext.SaveChanges();
            return Json(new { status = true, activeForOfficers = svc.Activeforofficers });
        }

        [HttpPost]
        public IActionResult ToggleWebServiceActive([FromForm] IFormCollection form)
        {
            try
            {
                int webserviceId = Convert.ToInt32(form["webserviceId"].ToString());
                bool active = Convert.ToBoolean(form["active"]);

                var svc = dbcontext.Webservice.FirstOrDefault(s => s.Id == webserviceId);
                if (svc == null)
                {
                    return Json(new { status = false, message = "Web service not found" });
                }

                if (active)
                {
                    // Check for other active web services for the same Serviceid
                    var otherActiveWebService = dbcontext.Webservice
                        .FirstOrDefault(ws => ws.Serviceid == svc.Serviceid && ws.Id != webserviceId && ws.Isactive);

                    if (otherActiveWebService != null)
                    {
                        var serviceName = dbcontext.Services
                            .FirstOrDefault(s => s.Serviceid == svc.Serviceid)?.Servicename ?? "Unknown";
                        return Json(new
                        {
                            status = false,
                            message = $"Another web service (ID: {otherActiveWebService.Id}) is already active for service '{serviceName}'. Please deactivate it first."
                        });
                    }
                }

                // Update the requested web service
                svc.Isactive = active;
                svc.Updatedat = DateTime.Now.ToString("o");
                dbcontext.SaveChanges();

                return Json(new
                {
                    status = true,
                    active = svc.Isactive,
                    message = $"Web service {(active ? "activated" : "deactivated")} successfully"
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error toggling web service active state");
                return Json(new { status = false, message = $"Error toggling web service: {ex.Message}" });
            }
        }

        private static string UnwrapJsonString(string value)
        {
            if (string.IsNullOrWhiteSpace(value))
                return value;

            try
            {
                if (value.StartsWith("\"") && value.EndsWith("\""))
                {
                    return JsonConvert.DeserializeObject<string>(value)!;
                }
            }
            catch
            {
                // ignore and return original
            }

            return value;
        }

        [HttpPost]
        public IActionResult SaveWebService([FromForm] string id, [FromForm] int serviceId, [FromForm] string webServiceName, [FromForm] string apiEndPoint, [FromForm] string onAction, [FromForm] string fieldMappings, [FromForm] string headers, [FromForm] bool retryEnabled = true, [FromForm] int maxAttempts = 3, [FromForm] int retryDelaySeconds = 5)
        {
            try
            {
                Webservice entity;
                int parsedId = 0;
                bool isUpdate = !string.IsNullOrEmpty(id) && int.TryParse(id, out parsedId) && parsedId > 0;

                if (isUpdate)
                {
                    entity = dbcontext.Webservice.FirstOrDefault(w => w.Id == parsedId);
                    if (entity == null)
                        return Json(new { status = false, message = "Web service not found" });
                }
                else
                {
                    entity = new Webservice
                    {
                        Serviceid = serviceId,
                        Createdat = DateTime.Now.ToString("o")
                    };
                    dbcontext.Webservice.Add(entity);
                }

                entity.Webservicename = webServiceName;

                // Save plain URL string (Ensure your DB column is 'text' or 'varchar', not 'json')
                entity.Apiendpoint = apiEndPoint?.Trim();

                entity.Onaction = onAction;

                // fieldMappings is now saved flat (no trigger wrapper) as sent by the updated frontend
                entity.Fieldmappings = fieldMappings;

                entity.Headers = headers;
                entity.Updatedat = DateTime.Now.ToString("o");

                // Retry settings (Ensure casing matches your Webservice.cs entity model exactly)
                entity.Retryenabled = retryEnabled;
                entity.Maxattempts = retryEnabled ? Math.Clamp(maxAttempts, 1, 20) : 1;
                entity.Retrydelayseconds = retryEnabled ? Math.Clamp(retryDelaySeconds, 0, 3600) : 0;

                dbcontext.SaveChanges();

                return Json(new { status = true, message = "Saved successfully", id = entity.Id });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving web service");
                return Json(new { status = false, message = ex.InnerException?.Message ?? ex.Message });
            }
        }

        [HttpPost] // or [HttpDelete]
        public IActionResult DeleteWebService([FromForm] int id)
        {
            try
            {
                var entity = dbcontext.Webservice.FirstOrDefault(w => w.Id == id);
                if (entity == null) return Json(new { status = false, message = "Not found" });

                dbcontext.Webservice.Remove(entity);
                dbcontext.SaveChanges();
                return Json(new { status = true, message = "Deleted" });
            }
            catch (Exception ex)
            {
                return Json(new { status = false, message = ex.Message });
            }
        }

        [HttpPost]
        public async Task<IActionResult> SaveLetterDetails(int serviceId, string objField, string letterData)
        {
            var service = dbcontext.Services.FirstOrDefault(s => s.Serviceid == serviceId);
            if (service == null)
            {
                return NotFound(new { status = false, message = "Service not found." });
            }

            try
            {
                if (string.IsNullOrWhiteSpace(objField))
                {
                    return BadRequest(new { status = false, message = "Object field (objField) cannot be empty." });
                }
                if (string.IsNullOrWhiteSpace(letterData))
                {
                    return BadRequest(new { status = false, message = "Letter data cannot be empty." });
                }

                var newJson = JObject.Parse(letterData);
                if (newJson[objField] == null)
                {
                    return BadRequest(new { status = false, message = $"Invalid letter data: '{objField}' object required." });
                }

                JObject existingJson = string.IsNullOrWhiteSpace(service.Letters)
                    ? []
                    : JObject.Parse(service.Letters);

                existingJson[objField] = newJson[objField];

                service.Letters = existingJson.ToString();
                dbcontext.Services.Update(service);
                await dbcontext.SaveChangesAsync();

                return Json(new { status = true, message = $"{objField} letter updated successfully." });
            }
            catch (JsonException ex)
            {
                _logger.LogError(ex, "Invalid JSON format in SaveLetterDetails");
                return BadRequest(new { status = false, message = $"Invalid JSON format: {ex.Message}" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving letter details");
                return StatusCode(500, new { status = false, message = $"Error updating {objField} letter: {ex.Message}" });
            }
        }

        [HttpPost]
        public IActionResult Formelement([FromForm] IFormCollection form)
        {
            string serviceIdString = form["serviceId"].ToString();
            string serviceName = form["serviceName"].ToString();
            string serviceNameShort = form["serviceNameShort"].ToString();
            string departmentIdString = form["departmentId"].ToString();

            if (string.IsNullOrEmpty(departmentIdString) || !int.TryParse(departmentIdString, out int departmentId))
            {
                return Json(new { status = false, response = "Invalid or missing Department ID." });
            }

            var formElement = form["formElement"].ToString();

            if (!string.IsNullOrEmpty(serviceIdString))
            {
                if (!int.TryParse(serviceIdString, out int serviceId))
                {
                    return Json(new { status = false, response = "Invalid Service ID." });
                }

                var service = dbcontext.Services.FirstOrDefault(s => s.Serviceid == serviceId);

                if (service != null)
                {
                    if (service.Formelement != formElement)
                        service.Formelement = formElement;

                    if (service.Servicename != serviceName)
                        service.Servicename = serviceName;

                    if (service.Nameshort != serviceNameShort)
                        service.Nameshort = serviceNameShort;

                    if (service.Departmentid != departmentId)
                        service.Departmentid = departmentId;
                }
            }
            else
            {
                var newService = new ServicesEntity
                {
                    Formelement = formElement,
                    Servicename = serviceName,
                    Nameshort = serviceNameShort,
                    Departmentid = departmentId
                };

                dbcontext.Services.Add(newService);
            }

            dbcontext.SaveChanges();

            return Json(new { status = true });
        }

        [HttpPost]
        public async Task<IActionResult> WorkFlowPlayers([FromForm] IFormCollection form)
        {
            try
            {
                string serviceIdString = form["serviceId"].ToString();
                var workFlowPlayers = form["workflowplayers"].ToString();

                if (!string.IsNullOrEmpty(serviceIdString))
                {
                    int serviceId = Convert.ToInt32(serviceIdString);
                    var service = dbcontext.Services.FirstOrDefault(s => s.Serviceid == serviceId);
                    if (service != null)
                    {
                        // Use JSON settings that handle nested objects properly
                        var settings = new JsonSerializerSettings
                        {
                            TypeNameHandling = TypeNameHandling.None,
                            ReferenceLoopHandling = ReferenceLoopHandling.Ignore,
                            Formatting = Formatting.None,
                            NullValueHandling = NullValueHandling.Ignore
                        };

                        // Parse and re-serialize to ensure proper JSON formatting
                        try
                        {
                            var parsedObject = JsonConvert.DeserializeObject(workFlowPlayers, settings);
                            service.Officereditablefield = JsonConvert.SerializeObject(parsedObject, settings);
                        }
                        catch (JsonException)
                        {
                            // If parsing fails, store as-is
                            service.Officereditablefield = workFlowPlayers;
                        }

                        dbcontext.Services.Update(service);
                    }
                }
                else
                {
                    var newService = new ServicesEntity
                    {
                        Officereditablefield = workFlowPlayers
                    };
                    dbcontext.Services.Add(newService);
                }

                dbcontext.SaveChanges();

                return Json(new { status = true });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating workflow players");
                return Json(new { status = false, message = $"Error: {ex.Message}" });
            }
        }

        [HttpPost]
        public IActionResult SetEmailSettings([FromForm] IFormCollection form)
        {
            try
            {
                string senderName = form["SenderName"].ToString();
                string senderEmail = form["SenderEmail"].ToString();
                string smtpServer = form["SmtpServer"].ToString();
                int smtpPort = Convert.ToInt32(form["SmtpPort"].ToString());
                string password = form["Password"].ToString();

                string? key = _configuration["Encryption:Key"];
                if (string.IsNullOrEmpty(key))
                {
                    return Json(new { success = false, message = "Encryption key not found in configuration." });
                }

                string encryptedPassword = _encryptionService.Encrypt(password, key);

                var emailSetting = new Models.Entities.Emailsettings
                {
                    Sendername = senderName,
                    Senderemail = senderEmail,
                    Smtpserver = smtpServer,
                    Smtpport = smtpPort,
                    Password = encryptedPassword,
                };

                dbcontext.Emailsettings.Add(emailSetting);
                dbcontext.SaveChanges();

                return Json(new { success = true, message = "Email settings saved successfully." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error setting email settings");
                return Json(new { success = false, message = "An error occurred.", error = ex.Message });
            }
        }

        [HttpPost]
        public IActionResult SaveEmailTemplate([FromForm] IFormCollection form)
        {
            try
            {
                var emailSettings = dbcontext.Emailsettings.FirstOrDefault();
                if (emailSettings == null)
                    return BadRequest("Email settings not found.");

                JObject templates = JObject.Parse(emailSettings.Templates ?? "{}");

                string key = form["type"].ToString();
                string newValue = form["template"].ToString();

                templates[key] = newValue;

                emailSettings.Templates = JsonConvert.SerializeObject(templates);
                dbcontext.SaveChanges();

                return Json(new { success = true, updated = true, key, value = newValue });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving email template");
                return Json(new { success = false, message = $"Error: {ex.Message}" });
            }
        }

        [HttpPost]
        public async Task<IActionResult> SaveSmsSettings([FromForm] IFormCollection form)
        {
            try
            {
                var sms = await dbcontext.Smssettings.FirstOrDefaultAsync();
                if (sms == null)
                {
                    sms = new Smssettings { Enabled = false };
                    dbcontext.Smssettings.Add(sms);
                }

                sms.Providername = form["providername"].ToString();
                sms.Apiurl = form["apiurl"].ToString();
                sms.Httpmethod = string.IsNullOrWhiteSpace(form["httpmethod"].ToString())
                    ? "POST" : form["httpmethod"].ToString();
                sms.Keylocation = string.IsNullOrWhiteSpace(form["keylocation"].ToString())
                    ? "header" : form["keylocation"].ToString();
                sms.Keyname = form["keyname"].ToString();
                sms.Senderid = form["senderid"].ToString();
                sms.Bodytemplate = form["bodytemplate"].ToString();
                sms.Successindicator = form["successindicator"].ToString();

                if (bool.TryParse(form["enabled"].ToString(), out bool enabled))
                    sms.Enabled = enabled;

                string apikey = form["apikey"].ToString();
                if (!string.IsNullOrWhiteSpace(apikey))
                    sms.Apikey = _encryptionService.Encrypt(apikey, _configuration["Encryption:Key"]!);

                await dbcontext.SaveChangesAsync();
                return Json(new { status = true, message = "SMS settings saved." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving SMS settings");
                return Json(new { status = false, message = $"Error saving SMS settings: {ex.Message}" });
            }
        }

        [HttpPost]
        public async Task<IActionResult> SaveNotificationConfig([FromForm] IFormCollection form)
        {
            try
            {
                if (!int.TryParse(form["serviceId"].ToString(), out int serviceId) || serviceId <= 0)
                    return BadRequest(new { status = false, message = "Invalid service ID." });

                string action = form["action"].ToString();
                if (string.IsNullOrWhiteSpace(action))
                    return BadRequest(new { status = false, message = "Action is required." });

                var service = await dbcontext.Services.FirstOrDefaultAsync(s => s.Serviceid == serviceId);
                if (service == null)
                    return NotFound(new { status = false, message = "Service not found." });

                JObject config;
                try
                {
                    config = string.IsNullOrWhiteSpace(service.Notificationconfig)
                        ? new JObject()
                        : JObject.Parse(service.Notificationconfig!);
                }
                catch
                {
                    config = new JObject();
                }

                string ruleJson = form["rule"].ToString();
                if (string.IsNullOrWhiteSpace(ruleJson))
                    config.Remove(action);
                else
                    config[action] = JObject.Parse(ruleJson);

                service.Notificationconfig = JsonConvert.SerializeObject(config);
                await dbcontext.SaveChangesAsync();

                return Json(new { status = true, message = "Notification rule saved.", config });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving notification config");
                return Json(new { status = false, message = $"Error saving notification config: {ex.Message}" });
            }
        }

        [HttpPost]
        public IActionResult SaveDocumentFields([FromForm] IFormCollection form)
        {
            int serviceId = Convert.ToInt32(form["serviceId"].ToString());
            string documentType = form["documentType"].ToString();
            string fields = form["fields"].ToString();

            var service = dbcontext.Services.FirstOrDefault(s => s.Serviceid == serviceId);
            if (service == null)
            {
                return Json(new { status = false, message = "Service not found." });
            }

            List<object> fieldsList;
            try
            {
                fieldsList = JsonConvert.DeserializeObject<List<object>>(fields)!;
                if (fieldsList == null)
                {
                    return Json(new { status = false, message = "Invalid fields data." });
                }

                foreach (var field in fieldsList)
                {
                    if (field is string)
                    {
                        // Single field, no additional validation needed
                    }
                    else if (field is Newtonsoft.Json.Linq.JObject jObject)
                    {
                        if (!jObject.ContainsKey("label") || !jObject.ContainsKey("fields"))
                        {
                            return Json(new { status = false, message = "Invalid group format: missing label or fields." });
                        }
                        if (string.IsNullOrEmpty(jObject["label"]?.ToString()))
                        {
                            return Json(new { status = false, message = "Group label cannot be empty." });
                        }
                        var groupFields = jObject["fields"]?.ToObject<List<string>>();
                        if (groupFields == null || groupFields.Count == 0)
                        {
                            return Json(new { status = false, message = "Group fields cannot be empty." });
                        }
                    }
                    else
                    {
                        return Json(new { status = false, message = "Invalid field format." });
                    }
                }
            }
            catch (JsonException ex)
            {
                _logger.LogError(ex, "Failed to parse fields data");
                return Json(new { status = false, message = "Failed to parse fields data." });
            }

            Dictionary<string, List<object>> documentFields;
            if (string.IsNullOrEmpty(service.Documentfields))
            {
                documentFields = new Dictionary<string, List<object>>();
            }
            else
            {
                try
                {
                    documentFields = JsonConvert.DeserializeObject<Dictionary<string, List<object>>>(service.Documentfields)!;
                    if (documentFields == null)
                    {
                        documentFields = new Dictionary<string, List<object>>();
                    }
                }
                catch (JsonException ex)
                {
                    _logger.LogError(ex, "Failed to parse existing document fields");
                    return Json(new { status = false, message = "Failed to parse existing document fields." });
                }
            }

            documentFields[documentType] = fieldsList;

            try
            {
                service.Documentfields = JsonConvert.SerializeObject(documentFields);
                dbcontext.SaveChanges();
                return Json(new { status = true, message = "Document fields saved successfully." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving document fields");
                return Json(new { status = false, message = $"Error saving document fields: {ex.Message}" });
            }
        }

        [HttpPost]
        public async Task<IActionResult> SaveServiceConfig([FromForm] int serviceId, [FromForm] string submissionLimitConfig)
        {
            try
            {
                if (serviceId <= 0)
                    return BadRequest(new { status = false, message = "Invalid service ID." });

                if (string.IsNullOrWhiteSpace(submissionLimitConfig))
                    return BadRequest(new { status = false, message = "Config is required." });

                JObject config;
                try
                {
                    config = JObject.Parse(submissionLimitConfig);
                }
                catch (JsonException ex)
                {
                    _logger.LogError(ex, "Invalid JSON");
                    return BadRequest(new { status = false, message = "Invalid JSON format." });
                }

                // ── Submission limits ─────────────────────────────────────────
                bool isLimited = config["isLimited"]?.Value<bool>() ?? false;
                var limits = config["limits"] as JArray ?? new JArray();

                if (isLimited && !limits.Any())
                    return BadRequest(new { status = false, message = "At least one limit rule required." });

                var usedTypes = new HashSet<string>();
                foreach (var rule in limits)
                {
                    var limitType = rule["limitType"]?.ToString();
                    var limitCount = rule["limitCount"]?.Value<int>() ?? 0;

                    if (string.IsNullOrWhiteSpace(limitType) || !ValidLimitTypes.Contains(limitType))
                        return BadRequest(new { status = false, message = $"Invalid limit type: {limitType}" });

                    if (limitCount <= 0)
                        return BadRequest(new { status = false, message = $"Limit count must be > 0 for {limitType}." });

                    if (!usedTypes.Add(limitType))
                        return BadRequest(new { status = false, message = $"Duplicate limit type: {limitType}." });
                }

                // ── Pool sanction batch limit ─────────────────────────────────
                const int DefaultPoolLimit = 5;
                const int MinPoolLimit = 1;
                const int MaxPoolLimit = 100;

                int poolSanctionBatchLimit = DefaultPoolLimit;
                var poolToken = config["poolSanctionBatchLimit"];
                if (poolToken != null && poolToken.Type != JTokenType.Null)
                {
                    if (!int.TryParse(poolToken.ToString(), out var parsed) ||
                        parsed < MinPoolLimit ||
                        parsed > MaxPoolLimit)
                    {
                        return BadRequest(new
                        {
                            status = false,
                            message = $"Pool sanction batch limit must be a whole number between {MinPoolLimit} and {MaxPoolLimit}."
                        });
                    }
                    poolSanctionBatchLimit = parsed;
                }

                var service = await dbcontext.Services
                    .Where(s => s.Serviceid == serviceId)
                    .FirstOrDefaultAsync();

                if (service == null)
                    return NotFound(new { status = false, message = "Service not found." });

                service.Submissionlimitconfig = JsonConvert.SerializeObject(new
                {
                    isLimited,
                    limits = limits.ToObject<List<dynamic>>(),
                    poolSanctionBatchLimit
                });

                await dbcontext.SaveChangesAsync();

                return Ok(new { status = true, message = "Configuration saved successfully." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving config for service {ServiceId}", serviceId);
                return StatusCode(500, new { status = false, message = ex.Message });
            }
        }       // ─────────────────────────────────────────────────────────────────────────
       
       
        // DYNAMIC REPORT TEMPLATE — Save / Update / Delete
        // ─────────────────────────────────────────────────────────────────────────

        [HttpPost]
        public async Task<IActionResult> SaveReportTemplate([FromBody] dynamic dto)
        {
            try
            {
                var name = dto.name?.ToString().Trim();
                var description = dto.description?.ToString().Trim() ?? "";
                var tableName = dto.tableName?.ToString().Trim();
                var columnsJson = dto.columns?.ToString();
                var filtersJson = dto.filters?.ToString();
                var createdBy = dto.createdBy?.ToString() ?? "";
                int? serviceId = null;
                if (dto.serviceId != null)
                {
                    string svText = dto.serviceId?.ToString() ?? "";
                    if (int.TryParse(svText, out int svParsed)) serviceId = svParsed;
                }

                if (string.IsNullOrEmpty(name))
                    return BadRequest(new { status = false, message = "Report name is required" });
                if (string.IsNullOrEmpty(tableName))
                    return BadRequest(new { status = false, message = "Base table name is required" });
                if (string.IsNullOrEmpty(columnsJson))
                    return BadRequest(new { status = false, message = "At least one column must be selected" });

                // Validate JSON
                try { JArray.Parse(columnsJson); } catch { return BadRequest(new { status = false, message = "Invalid columns JSON" }); }
                if (!string.IsNullOrEmpty(filtersJson))
                    try { JArray.Parse(filtersJson); } catch { return BadRequest(new { status = false, message = "Invalid filters JSON" }); }

                int id = dto.id ?? 0;

                if (id > 0)
                {
                    // Update existing
                    var existing = await dbcontext.Reports.FindAsync(id);
                    if (existing == null)
                        return NotFound(new { status = false, message = "Report template not found" });

                    existing.Name = name;
                    existing.Description = description;
                    existing.Tablename = tableName;
                    existing.ServiceId = serviceId;
                    existing.Columns = columnsJson;
                    existing.Filters = filtersJson;
                    await dbcontext.SaveChangesAsync();

                    return Ok(new { status = true, message = "Report template updated successfully", data = existing });
                }
                else
                {
                    // Create new
                    var entity = new Reports
                    {
                        Name = name,
                        Description = description,
                        Tablename = tableName,
                        ServiceId = serviceId,
                        Columns = columnsJson,
                        Filters = filtersJson,
                        Createdat = DateTime.Now,
                        Createdby = createdBy
                    };

                    dbcontext.Reports.Add(entity);
                    await dbcontext.SaveChangesAsync();

                    return Ok(new { status = true, message = "Report template created successfully", data = entity });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving report template");
                return StatusCode(500, new { status = false, message = ex.Message });
            }
        }

        [HttpDelete]
        public async Task<IActionResult> DeleteReportTemplate([FromQuery] int id)
        {
            try
            {
                var entity = await dbcontext.Reports.FindAsync(id);
                if (entity == null)
                    return NotFound(new { status = false, message = "Report template not found" });

                dbcontext.Reports.Remove(entity);
                await dbcontext.SaveChangesAsync();

                return Ok(new { status = true, message = "Report template deleted successfully" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting report template {Id}", id);
                return StatusCode(500, new { status = false, message = ex.Message });
            }
        }
    }

}
