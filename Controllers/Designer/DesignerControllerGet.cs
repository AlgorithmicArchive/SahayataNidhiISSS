using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using SahayataNidhi.Models.Entities;
using JsonException = Newtonsoft.Json.JsonException;
using SahayataNidhi.Helpers;

namespace SahayataNidhi.Controllers
{
    public partial class DesignerController
    {
        [HttpGet]
        public IActionResult GetServicesDashboard(int pageIndex = 0, int pageSize = 10)
        {
            // Fetch all services from the database
            var services = dbcontext.Services
                                    .OrderBy(s => s.Serviceid)
                                    .ToList();

            var totalRecords = services.Count;

            // Apply pagination
            var pagedData = services
                .Skip(pageIndex * pageSize)
                .Take(pageSize)
                .ToList();

            // Define columns
            var columns = new List<dynamic>
            {
                new { header = "S.No", accessorKey = "sno" },
                new { header = "Service Name", accessorKey = "servicename" },
                new { header = "Department", accessorKey = "department" },
            };

            // Prepare data
            var data = new List<dynamic>();
            int index = 0;

            foreach (var item in pagedData)
            {
                // Safely handle nullable Departmentid
                var department = "N/A";
                if (item.Departmentid.HasValue)
                {
                    var dept = dbcontext.Departments.FirstOrDefault(d => d.Departmentid == item.Departmentid.Value);
                    department = dept?.Departmentname ?? "N/A";
                }

                var actions = new List<dynamic>
                {
                    new
                    {
                        id = (pageIndex * pageSize) + index + 1,
                        tooltip = (bool)item.Active! ? "Deactivate" : "Activate",
                        color = "#F0C38E",
                        actionFunction = "ToggleServiceActivation"
                    },
                    new
                    {
                        id = (pageIndex * pageSize) + index + 2,
                        tooltip = (bool)item.Activeforofficers! ? "Deactivate for Officers" : "Activate for Officers",
                        color = "#A8E6CF",
                        actionFunction = "ToggleServiceActiveForOfficers"
                    }
                };

                data.Add(new
                {
                    sno = (pageIndex * pageSize) + index + 1,
                    servicename = item.Servicename,
                    department = department,
                    serviceId = item.Serviceid,
                    isActive = item.Active,
                    isActiveForOfficers = item.Activeforofficers,
                    customActions = actions,
                });

                index++;
            }

            return Json(new
            {
                data,
                columns,
                totalRecords
            });
        }

        [HttpGet]
        public IActionResult GetWebServicesDashboard(int pageIndex = 0, int pageSize = 10)
        {
            // Fetch all services from the database
            var webServices = dbcontext.Webservice
                                       .Include(ws => ws.Service) // Assuming navigation property
                                       .ToList();

            var totalRecords = webServices.Count;

            var pagedData = webServices
                .OrderBy(w => w.Id)
                .Skip(pageIndex * pageSize)
                .Take(pageSize)
                .ToList();

            // Define columns (Actions column last)
            var columns = new List<dynamic>
            {
                new { header = "S.No", accessorKey = "sno" },
                new { header = "Service Name", accessorKey = "servicename" },
                new { header = "Web Service Name", accessorKey = "webservicename" },
            };

            // Prepare data
            var data = new List<dynamic>();
            int index = 0;

            foreach (var item in pagedData)
            {
                var serviceName = dbcontext.Services.FirstOrDefault(s => s.Serviceid == item.Serviceid)?.Servicename ?? "N/A";

                var actions = new List<dynamic>
                {
                    new
                    {
                        id = (pageIndex * pageSize) + index + 1,
                        tooltip = item.Isactive ? "Deactivate" : "Activate",
                        color = "#F0C38E",
                        actionFunction = "ToggleWebServiceActivation"
                    }
                };

                data.Add(new
                {
                    sno = (pageIndex * pageSize) + index + 1,
                    servicename = serviceName,
                    webservicename = item.Webservicename,
                    customActions = actions,
                    webserviceId = item.Id,
                    isActive = item.Isactive
                });

                index++;
            }

            return Json(new
            {
                data,
                columns,
                totalRecords
            });
        }

        [HttpGet]
        public IActionResult GetActionFields(string actionTaken)
        {
            try
            {
                var fields = new List<object>();

                switch (actionTaken?.ToLower())
                {
                    case "sanction":
                        // Workflow subfields from the application's workflow column
                        fields = new List<object>
                        {
                            new { name = "completedAt", label = "Completed At (last step)", section = "Workflow" },
                            new { name = "designation", label = "Designation (last step)", section = "Workflow" },
                            new { name = "status", label = "Status (last step)", section = "Workflow" }
                        };
                        break;

                    case "corrigendum":
                    case "correction":
                        fields = new List<object>
                {
                    new { name = "corrigendumid", label = "Corrigendum ID", section = "Corrigendum" },
                    new { name = "referencenumber", label = "Reference Number", section = "Corrigendum" },
                    new { name = "location", label = "Location (JSON)", section = "Corrigendum" },
                    new { name = "corrigendumfields", label = "Corrigendum Fields (JSON)", section = "Corrigendum" },
                    new { name = "workflow", label = "Workflow (JSON)", section = "Corrigendum" },
                    new { name = "currentplayer", label = "Current Player", section = "Corrigendum" },
                    new { name = "type", label = "Corrigendum Type", section = "Corrigendum" },
                    new { name = "history", label = "History (JSON)", section = "Corrigendum" },
                    new { name = "status", label = "Corrigendum Status", section = "Corrigendum" },
                    new { name = "createdat", label = "Created At", section = "Corrigendum" },
                    // Workflow subfields from corrigendum's workflow column
                    new { name = "completedAt", label = "Completed At (last step)", section = "Corrigendum" },
                    new { name = "designation", label = "Designation (last step)", section = "Corrigendum" },
                    new { name = "status", label = "Status (last step)", section = "Corrigendum" }
                };
                        break;

                    case "withheld":
                        fields = new List<object>
                {
                    new { name = "withheld_id", label = "Withheld ID", section = "Withheld" },
                    new { name = "serviceid", label = "Service ID", section = "Withheld" },
                    new { name = "referencenumber", label = "Reference Number", section = "Withheld" },
                    new { name = "location", label = "Location (JSON)", section = "Withheld" },
                    new { name = "workflow", label = "Workflow (JSON)", section = "Withheld" },
                    new { name = "currentplayer", label = "Current Player", section = "Withheld" },
                    new { name = "history", label = "History (JSON)", section = "Withheld" },
                    new { name = "iswithheld", label = "Is Withheld", section = "Withheld" },
                    new { name = "withheldtype", label = "Withheld Type", section = "Withheld" },
                    new { name = "withheldreason", label = "Withheld Reason", section = "Withheld" },
                    new { name = "files", label = "Files (JSON)", section = "Withheld" },
                    new { name = "status", label = "Withheld Status", section = "Withheld" },
                    new { name = "withheldon", label = "Withheld On", section = "Withheld" },
                    // Workflow subfields from withheld's workflow column
                    new { name = "completedAt", label = "Completed At (last step)", section = "Withheld" },
                    new { name = "designation", label = "Designation (last step)", section = "Withheld" },
                    new { name = "status", label = "Status (last step)", section = "Withheld" }
                };
                        break;

                    default:
                        return Json(new { status = false, message = "Unknown action" });
                }

                return Json(new { status = true, fields });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching action fields");
                return Json(new { status = false, message = ex.Message });
            }
        }

        [HttpGet]
        public async Task<IActionResult> GetWebServiceLogs([FromQuery] int? webserviceId = null, [FromQuery] int pageIndex = 0, [FromQuery] int pageSize = 20)
        {
            try
            {
                var query = dbcontext.WebserviceLogs.AsQueryable();

                if (webserviceId.HasValue && webserviceId.Value > 0)
                {
                    query = query.Where(x => x.Webserviceid == webserviceId.Value);
                }

                var totalRecords = await query.CountAsync();

                var data = await query
                    .OrderByDescending(x => x.Createdat)
                    .Skip(pageIndex * pageSize)
                    .Take(pageSize)
                    .Select(x => new
                    {
                        id = x.Id,
                        executionId = x.Executionid,
                        webserviceId = x.Webserviceid,
                        serviceId = x.Serviceid,
                        triggerName = x.Triggername,
                        referenceNumber = x.Referencenumber,
                        attemptNumber = x.Attemptnumber,
                        requestUrl = x.Requesturl,
                        requestMethod = x.Requestmethod,
                        responseStatusCode = x.Responsestatuscode,
                        isSuccess = x.Issuccess,
                        errorMessage = x.Errormessage,
                        durationMs = x.Durationms,
                        createdAt = x.Createdat
                    })
                    .ToListAsync();

                return Ok(new
                {
                    status = true,
                    data,
                    totalRecords
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching web service logs");
                return StatusCode(500, new
                {
                    status = false,
                    message = ex.Message
                });
            }
        }

        [HttpGet]
        public async Task<IActionResult> GetWebServiceLogById([FromQuery] int id)
        {
            var log = await dbcontext.WebserviceLogs
                .FirstOrDefaultAsync(x => x.Id == id);

            if (log == null)
                return NotFound(new { status = false, message = "Log not found" });

            return Ok(new
            {
                status = true,
                data = log
            });
        }

        [HttpGet]
        public IActionResult GetWebServices(int serviceId)
        {
            try
            {
                var webServices = dbcontext.Webservice
                    .Where(ws => ws.Serviceid == serviceId)
                    .Select(ws => new
                    {
                        id = ws.Id,
                        serviceId = ws.Serviceid,
                        webServiceName = ws.Webservicename,
                        apiEndpoint = ws.Apiendpoint,
                        onAction = ws.Onaction,
                        fieldMappings = ws.Fieldmappings,
                        headers = ws.Headers,
                        createdAt = ws.Createdat,
                        updatedAt = ws.Updatedat,

                        // ✅ Include retry configuration fields for the UI
                        retryEnabled = ws.Retryenabled,
                        maxAttempts = ws.Maxattempts,
                        retryDelaySeconds = ws.Retrydelayseconds
                    })
                    .ToList();

                return Json(new
                {
                    status = true,
                    configs = webServices
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching web services");
                return Json(new { status = false, message = $"Error: {ex.Message}" });
            }
        }
        [HttpGet]
        public IActionResult GetLetterDetails(int serviceId, string objField)
        {
            var service = dbcontext.Services.FirstOrDefault(s => s.Serviceid == serviceId);
            if (service == null || string.IsNullOrWhiteSpace(service.Letters))
            {
                return NotFound("Service or Letters data not found.");
            }

            try
            {
                var json = JObject.Parse(service.Letters);

                if (!json.TryGetValue(objField, out var requiredObj))
                {
                    return NotFound($"Field '{objField}' not found in Letters.");
                }

                return Json(new { requiredObj });
            }
            catch (Newtonsoft.Json.JsonException ex)
            {
                _logger.LogError(ex, "Error parsing JSON in GetLetterDetails");
                return BadRequest($"Invalid JSON format: {ex.Message}");
            }
        }

        [HttpGet]
        public IActionResult GetFormElements([FromQuery] string serviceId)
        {
            // Validate serviceId
            if (string.IsNullOrWhiteSpace(serviceId) || !int.TryParse(serviceId, out int parsedServiceId))
            {
                return BadRequest(new { status = false, message = "Invalid service ID." });
            }

            // Fetch the service
            var service = dbcontext.Services.FirstOrDefault(s => s.Serviceid == parsedServiceId);
            if (service == null || string.IsNullOrWhiteSpace(service.Formelement))
            {
                return BadRequest(new { status = false, message = "Service not found or no form elements found." });
            }

            // Parse the JSON into a JToken
            JToken root = JToken.Parse(service.Formelement);

            // Extract sections and fields
            var sections = new List<object>();
            foreach (var sectionToken in root)
            {
                var sectionName = (string)sectionToken["section"]!;
                var sectionFields = new List<object>();

                // Add top-level fields
                var fields = sectionToken["fields"];
                if (fields != null)
                {
                    foreach (var field in fields)
                    {
                        var fieldName = (string)field["name"]!;
                        var fieldLabel = (string)field["label"]!;
                        if (!string.IsNullOrWhiteSpace(fieldName) && !string.IsNullOrWhiteSpace(fieldLabel))
                        {
                            sectionFields.Add(new { name = fieldName, label = fieldLabel });
                        }

                        // Handle nested additionalFields recursively
                        var additionalFields = field["additionalFields"];
                        if (additionalFields != null && additionalFields.HasValues)
                        {
                            foreach (var additionalFieldGroup in additionalFields)
                            {
                                foreach (var additionalFieldArray in additionalFieldGroup)
                                {
                                    foreach (var additionalField in additionalFieldArray)
                                    {
                                        var nestedName = (string)additionalField["name"]!;
                                        var nestedLabel = (string)additionalField["label"]!;
                                        if (!string.IsNullOrWhiteSpace(nestedName) && !string.IsNullOrWhiteSpace(nestedLabel))
                                        {
                                            sectionFields.Add(new { name = nestedName, label = nestedLabel });
                                        }

                                        // Handle further nested additionalFields
                                        var nestedAdditionalFields = additionalField["additionalFields"];
                                        if (nestedAdditionalFields != null && nestedAdditionalFields.HasValues)
                                        {
                                            foreach (var nestedGroup in nestedAdditionalFields)
                                            {
                                                foreach (var nestedArray in nestedGroup)
                                                {
                                                    foreach (var nestedField in nestedArray)
                                                    {
                                                        var deepNestedName = (string)nestedField["name"]!;
                                                        var deepNestedLabel = (string)nestedField["label"]!;
                                                        if (!string.IsNullOrWhiteSpace(deepNestedName) && !string.IsNullOrWhiteSpace(deepNestedLabel))
                                                        {
                                                            sectionFields.Add(new { name = deepNestedName, label = deepNestedLabel });
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                sections.Add(new
                {
                    sectionName,
                    fields = sectionFields
                });
            }

            // Get column names from DbContext
            var entityType = dbcontext.Model.FindEntityType(typeof(CitizenApplications));
            if (entityType == null)
            {
                return BadRequest(new { status = false, message = "Entity not found in DbContext." });
            }

            var columnNames = entityType.GetProperties()
                .Select(p => p.GetColumnName())
                .ToList();

            return Json(new
            {
                status = true,
                sections,
                columnNames
            });
        }

        [HttpGet]
        public IActionResult GetFormElementsForEmail(string serviceId)
        {
            if (!int.TryParse(serviceId, out int serviceIdInt))
            {
                return BadRequest(new { error = "Invalid serviceId." });
            }

            var service = dbcontext.Services
                .FirstOrDefault(s => s.Serviceid == serviceIdInt);

            if (service == null || string.IsNullOrWhiteSpace(service.Formelement))
            {
                return BadRequest(new { error = "No form elements found for the given serviceId." });
            }

            try
            {
                var allNames = new List<string>
                {
                    "ApplicantName",
                    "ActionTaken",
                    "OfficerRole",
                    "OfficerArea",
                    "ReferenceNumber",
                    "ServiceName",
                    "CreatedAt"
                };

                // For PostgreSQL, we can also use direct SQL if needed for complex parsing
                // But for simple operations, the existing logic works fine
                // Parse the JSON string
                JToken root = JToken.Parse(service.Formelement);

                // Extract form names from JSON with validation
                var formNames = root
                    .SelectTokens("$..name")
                    .Where(t => t != null && t.Type == JTokenType.String)
                    .Select(t => t.ToString().Trim())
                    .Where(name => !string.IsNullOrWhiteSpace(name))
                    .Distinct()
                    .ToList();

                // Add standard fields
                formNames.Add("ReferenceNumber");
                formNames.Add("ServiceName");
                formNames.Add("CreatedAt");

                // Combine with hardcoded names and deduplicate
                allNames = allNames
                    .Concat(formNames)
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .OrderBy(name => name, StringComparer.OrdinalIgnoreCase)
                    .ToList();

                // Debug log to verify data
                if (!allNames.Any())
                {
                    return BadRequest(new { error = "No valid form elements or service properties found." });
                }

                return Ok(new { names = allNames });
            }
            catch (Newtonsoft.Json.JsonException ex)
            {
                _logger.LogError(ex, "Failed to parse JSON in GetFormElementsForEmail");
                return BadRequest(new { error = "Failed to parse JSON.", details = ex.Message });
            }
        }

        [HttpGet]
        public IActionResult GetDocumentFields([FromQuery] int serviceId)
        {
            // Validate serviceId
            if (serviceId <= 0)
            {
                return Json(new { status = false, message = "Invalid service ID." });
            }

            // Fetch the service from the database
            var service = dbcontext.Services.FirstOrDefault(s => s.Serviceid == serviceId);
            if (service == null)
            {
                return Json(new { status = false, message = "Service not found." });
            }

            // Check if Documentfields exist
            if (string.IsNullOrEmpty(service.Documentfields))
            {
                return Json(new
                {
                    status = true,
                    documentFields = new
                    {
                        Correction = new List<object>(),
                        Corrigendum = new List<object>(),
                        Amendment = new List<object>()
                    }
                });
            }

            // Deserialize Documentfields
            try
            {
                var documentFields = JsonConvert.DeserializeObject<Dictionary<string, List<object>>>(service.Documentfields);
                if (documentFields == null)
                {
                    return Json(new
                    {
                        status = true,
                        documentFields = new
                        {
                            Correction = new List<object>(),
                            Corrigendum = new List<object>(),
                            Amendment = new List<object>()
                        }
                    });
                }

                // Ensure Correction, Corrigendum, and Amendment keys exist
                var responseFields = new
                {
                    Correction = documentFields.ContainsKey("Correction") ? documentFields["Correction"] : new List<object>(),
                    Corrigendum = documentFields.ContainsKey("Corrigendum") ? documentFields["Corrigendum"] : new List<object>(),
                    Amendment = documentFields.ContainsKey("Amendment") ? documentFields["Amendment"] : new List<object>()
                };

                return Json(new { status = true, documentFields = responseFields });
            }
            catch (Newtonsoft.Json.JsonException ex)
            {
                _logger.LogError(ex, "Failed to parse document fields");
                return Json(new { status = false, message = "Failed to parse document fields." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving document fields");
                return Json(new { status = false, message = $"Error retrieving document fields: {ex.Message}" });
            }
        }

        [HttpGet]
        public IActionResult GetEmailTemplate([FromQuery] int serviceId, [FromQuery] string type)
        {
            if (serviceId <= 0 || string.IsNullOrEmpty(type))
            {
                return Json(new { status = false, message = "Invalid service ID or email type." });
            }

            var service = dbcontext.Emailsettings.FirstOrDefault(s => s.Id == serviceId);
            if (service == null)
            {
                return Json(new { status = false, message = "Service not found." });
            }

            // Assuming email templates are stored in a column named EmailTemplates as JSON
            if (string.IsNullOrEmpty(service.Templates))
            {
                return Json(new { status = true, template = "" });
            }

            try
            {
                var emailTemplates = JsonConvert.DeserializeObject<Dictionary<string, string>>(service.Templates);
                var template = emailTemplates?.ContainsKey(type) == true ? emailTemplates[type] : "";
                return Json(new { status = true, template });
            }
            catch (Newtonsoft.Json.JsonException ex)
            {
                _logger.LogError(ex, "Failed to parse email templates");
                return Json(new { status = false, message = "Failed to parse email templates." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving email template");
                return Json(new { status = false, message = $"Error retrieving email template: {ex.Message}" });
            }
        }

        // =====================================================================
        // Dynamic notifications: SMS provider settings, per-service notification
        // rules, and the workflow steps used to build recipient options.
        // =====================================================================
        [HttpGet]
        public async Task<IActionResult> GetSmsSettings()
        {
            var sms = await dbcontext.Smssettings.AsNoTracking().FirstOrDefaultAsync();
            if (sms == null)
                return Json(new { status = true, settings = (object?)null });

            return Json(new
            {
                status = true,
                settings = new
                {
                    sms.Id,
                    sms.Providername,
                    sms.Apiurl,
                    sms.Httpmethod,
                    sms.Keylocation,
                    sms.Keyname,
                    sms.Senderid,
                    sms.Bodytemplate,
                    sms.Successindicator,
                    sms.Enabled,
                    HasApiKey = !string.IsNullOrEmpty(sms.Apikey)
                }
            });
        }

        [HttpGet]
        public async Task<IActionResult> GetNotificationConfig([FromQuery] int serviceId)
        {
            if (serviceId <= 0)
                return BadRequest(new { status = false, message = "Invalid service ID." });

            var service = await dbcontext.Services.AsNoTracking().FirstOrDefaultAsync(s => s.Serviceid == serviceId);
            if (service == null)
                return NotFound(new { status = false, message = "Service not found." });

            try
            {
                var config = string.IsNullOrWhiteSpace(service.Notificationconfig)
                    ? new JObject()
                    : JObject.Parse(service.Notificationconfig!);
                return Json(new { status = true, config });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to parse notification config for service {Svc}", serviceId);
                return Json(new { status = false, message = "Failed to parse notification config." });
            }
        }

        [HttpGet]
        public async Task<IActionResult> GetServiceWorkflowSteps([FromQuery] int serviceId)
        {
            if (serviceId <= 0)
                return BadRequest(new { status = false, message = "Invalid service ID." });

            try
            {
                var sample = await dbcontext.CitizenApplications
                    .AsNoTracking()
                    .Where(a => a.Serviceid == serviceId && a.Workflow != null)
                    .OrderByDescending(a => a.ApplId)
                    .Select(a => a.Workflow)
                    .FirstOrDefaultAsync();

                var steps = new List<object>();
                if (!string.IsNullOrEmpty(sample))
                {
                    var arr = JArray.Parse(sample);
                    for (int i = 0; i < arr.Count; i++)
                    {
                        var step = arr[i];
                        steps.Add(new
                        {
                            step = i,
                            designation = step["designation"]?.ToString() ?? "",
                            accessLevel = step["accessLevel"]?.ToString() ?? ""
                        });
                    }
                }

                return Json(new { status = true, steps });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to load workflow steps for service {Svc}", serviceId);
                return Json(new { status = false, message = "Failed to load workflow steps." });
            }
        }


        [HttpGet]
        public async Task<IActionResult> GetServiceConfig([FromQuery] int serviceId)
        {
            try
            {
                if (serviceId <= 0)
                    return BadRequest(new { status = false, message = "Invalid service ID." });

                var service = await dbcontext.Services
                    .AsNoTracking()
                    .Where(s => s.Serviceid == serviceId)
                    .Select(s => new { s.Submissionlimitconfig })
                    .FirstOrDefaultAsync();

                if (service == null)
                    return NotFound(new { status = false, message = "Service not found." });

                const int DefaultPoolLimit = 5;
                const int MinPoolLimit = 1;
                const int MaxPoolLimit = 100;

                object config;

                try
                {
                    var parsed = JObject.Parse(service.Submissionlimitconfig!);

                    // Read poolSanctionBatchLimit with validation, fall back to default
                    int poolSanctionBatchLimit = DefaultPoolLimit;
                    var poolToken = parsed.GetValue("poolSanctionBatchLimit", StringComparison.OrdinalIgnoreCase);
                    if (poolToken != null && poolToken.Type != JTokenType.Null
                        && int.TryParse(poolToken.ToString(), out var parsedPool)
                        && parsedPool >= MinPoolLimit && parsedPool <= MaxPoolLimit)
                    {
                        poolSanctionBatchLimit = parsedPool;
                    }

                    // New format: has "limits" array
                    if (parsed["limits"] != null)
                    {
                        config = new
                        {
                            isLimited = parsed["isLimited"]?.Value<bool>() ?? false,
                            limits = parsed["limits"]?.ToObject<List<dynamic>>() ?? new List<dynamic>(),
                            poolSanctionBatchLimit
                        };
                    }
                    // Old format: migrate on-the-fly
                    else
                    {
                        var isLimited = parsed["isLimited"]?.Value<bool>() ?? false;
                        var limits = new List<object>();

                        if (isLimited && !string.IsNullOrEmpty(parsed["limitType"]?.ToString()))
                        {
                            limits.Add(new
                            {
                                limitType = parsed["limitType"]!.ToString(),
                                limitCount = parsed["limitCount"]?.Value<int>() ?? 0
                            });
                        }

                        config = new { isLimited, limits, poolSanctionBatchLimit };
                    }
                }
                catch
                {
                    config = new
                    {
                        isLimited = false,
                        limits = new List<object>(),
                        poolSanctionBatchLimit = DefaultPoolLimit
                    };
                }

                return Ok(new { status = true, config });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching config for service {ServiceId}", serviceId);
                return StatusCode(500, new { status = false, message = ex.Message });
            }
        }

        [HttpGet]
        public IActionResult GetTables()
        {
            // Using Entity Framework Core with Npgsql
            var tables = dbcontext.Model.GetEntityTypes()
                .Select(t => t.GetTableName())
                .Distinct()
                .ToList();
            return Ok(tables);
        }

        [HttpGet]
        public IActionResult GetTableColumns(string tableName, bool includeJsonStructure = false)
        {
            try
            {
                if (string.IsNullOrEmpty(tableName))
                {
                    return BadRequest(new { status = false, message = "Table name is required" });
                }

                // Get the entity type for the specified table
                var entityType = dbcontext.Model.GetEntityTypes()
                    .FirstOrDefault(t => t.GetTableName() == tableName);

                if (entityType == null)
                {
                    return NotFound(new { status = false, message = $"Table '{tableName}' not found" });
                }

                // Get column information
                var columns = entityType.GetProperties()
                    .Select(p =>
                    {
                        var columnType = p.GetColumnType();
                        var isJson = columnType.Contains("json", StringComparison.OrdinalIgnoreCase);

                        var columnInfo = new
                        {
                            name = p.Name,
                            type = columnType,
                            nullable = p.IsNullable,
                            isPrimaryKey = p.IsPrimaryKey(),
                            maxLength = p.GetMaxLength(),
                            isJson = isJson
                        };

                        return columnInfo;
                    })
                    .OrderBy(c => c.name)
                    .ToList();

                var result = new { status = true, columns };

                return Ok(result);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { status = false, message = ex.Message });
            }
        }

        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            try
            {
                var types = await dbcontext.ExpirationTypes
                    .OrderByDescending(x => x.CreatedAt)
                    .ToListAsync();
                return Ok(new { status = true, data = types });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { status = false, message = ex.Message });
            }
        }

        [HttpGet]
        public async Task<IActionResult> GetById(int id)
        {
            var type = await dbcontext.ExpirationTypes.FindAsync(id);
            if (type == null)
                return NotFound(new { status = false, message = "Record not found" });
            return Ok(new { status = true, data = type });
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] ExpirationTypes dto)
        {
            if (!ModelState.IsValid)
                return BadRequest(new { status = false, message = "Invalid data", errors = ModelState });

            // Check uniqueness of TypeCode
            var exists = await dbcontext.ExpirationTypes.AnyAsync(x => x.TypeCode == dto.TypeCode);
            if (exists)
                return Conflict(new { status = false, message = $"TypeCode '{dto.TypeCode}' already exists." });

            var entity = new ExpirationTypes
            {
                TypeCode = dto.TypeCode,
                ServiceId = dto.ServiceId,
                ExpirationName = dto.ExpirationName,
                Description = dto.Description,
                MessageTemplate = dto.MessageTemplate,
                BasedOnField = dto.BasedOnField,
                ConditionField = dto.ConditionField,
                ValueField = dto.ValueField,
                ValidityPeriod = dto.ValidityPeriod,
                ReminderBefore = dto.ReminderBefore,
                StopPaymentOnExpiry = dto.StopPaymentOnExpiry,
                StopPaymentGracePeriod = dto.StopPaymentGracePeriod,
                IsActive = dto.IsActive,
                CreatedAt = DateTime.UtcNow
            };

            dbcontext.ExpirationTypes.Add(entity);
            await dbcontext.SaveChangesAsync();

            return Ok(new { status = true, message = "Created successfully", data = entity });
        }

        [HttpPut]
        public async Task<IActionResult> Update(int id, [FromBody] ExpirationTypes dto)
        {
            _logger.LogInformation("Updating ExpirationType with ID {Id}", id);
            var entity = await dbcontext.ExpirationTypes.FindAsync(id);
            if (entity == null)
                return NotFound(new { status = false, message = "Record not found" });

            // Check uniqueness of TypeCode excluding current record
            var duplicate = await dbcontext.ExpirationTypes
                .AnyAsync(x => x.TypeCode == dto.TypeCode && x.Id != id);
            if (duplicate)
                return Conflict(new { status = false, message = $"TypeCode '{dto.TypeCode}' already exists." });

            entity.TypeCode = dto.TypeCode;
            entity.ServiceId = dto.ServiceId;
            entity.ExpirationName = dto.ExpirationName;
            entity.Description = dto.Description;
            entity.MessageTemplate = dto.MessageTemplate;
            entity.BasedOnField = dto.BasedOnField;
            entity.ConditionField = dto.ConditionField;
            entity.ValueField = dto.ValueField;
            entity.ValidityPeriod = dto.ValidityPeriod;
            entity.ReminderBefore = dto.ReminderBefore;
            entity.StopPaymentOnExpiry = dto.StopPaymentOnExpiry;
            entity.StopPaymentGracePeriod = dto.StopPaymentGracePeriod;
            entity.IsActive = dto.IsActive;

            await dbcontext.SaveChangesAsync();

            return Ok(new { status = true, message = "Updated successfully", data = entity });
        }

        [HttpDelete]
        public async Task<IActionResult> Delete(int id)
        {
            var entity = await dbcontext.ExpirationTypes.FindAsync(id);
            if (entity == null)
                return NotFound(new { status = false, message = "Record not found" });

            dbcontext.ExpirationTypes.Remove(entity);
            await dbcontext.SaveChangesAsync();

            return Ok(new { status = true, message = "Deleted successfully" });
        }

        // ─────────────────────────────────────────────────────────────────────────
        // DYNAMIC REPORT TEMPLATE ENDPOINTS
        // Queries are built dynamically from JSON config stored in the `reports` table.
        // No PostgreSQL function binding required.
        // ─────────────────────────────────────────────────────────────────────────

        [HttpGet]
        public IActionResult GetReportTemplates([FromQuery] int? serviceId = null)
        {
            try
            {
                var templates = dbcontext.Reports
                    .OrderByDescending(r => r.Createdat)
                    .Select(r => new
                    {
                        id = r.Id,
                        name = r.Name,
                        description = r.Description,
                        tableName = r.Tablename,
                        serviceId = r.ServiceId,
                        columns = r.Columns,
                        filters = r.Filters,
                        createdAt = r.Createdat,
                        createdBy = r.Createdby
                    })
                    .ToList();

                return Ok(new { status = true, data = templates });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching report templates");
                return StatusCode(500, new { status = false, message = ex.Message });
            }
        }

        [HttpGet]
        public async Task<IActionResult> GetReportTemplateById([FromQuery] int id)
        {
            try
            {
                var report = await dbcontext.Reports.FindAsync(id);
                if (report == null)
                    return NotFound(new { status = false, message = "Report template not found" });

                var columns = string.IsNullOrEmpty(report.Columns)
                    ? new List<object>()
                    : JsonConvert.DeserializeObject<List<object>>(report.Columns);

                var filters = string.IsNullOrEmpty(report.Filters)
                    ? new List<object>()
                    : JsonConvert.DeserializeObject<List<object>>(report.Filters);

                return Ok(new
                {
                    status = true,
                    data = new
                    {
                        id = report.Id,
                        name = report.Name,
                        description = report.Description,
                        tableName = report.Tablename,
                        serviceId = report.ServiceId,
                        columns,
                        filters,
                        createdAt = report.Createdat,
                        createdBy = report.Createdby
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching report template {Id}", id);
                return StatusCode(500, new { status = false, message = ex.Message });
            }
        }

        /// <summary>
        /// Executes a saved report template dynamically.
        /// Reads the template's columns/filters JSON config, builds a parameterized SQL query,
        /// and returns the data + column metadata. No PostgreSQL function binding required.
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> ExecuteReportTemplate([FromQuery] int templateId, [FromQuery] string? filterJson = null)
        {
            try
            {
                var template = await dbcontext.Reports.FindAsync(templateId);
                if (template == null)
                    return NotFound(new { status = false, message = "Report template not found" });

                // ── Run the report template using the proven ADO.NET path ──

                var result = await DynamicReportQuery.ExecuteAsync(dbcontext, template, filterJson);
                if (!result.Success)
                    return StatusCode(result.Status, new { status = false, message = result.Error });

                return Ok(new
                {
                    status = true,
                    data = result.Data,
                    columns = result.Columns,
                    totalRecords = result.TotalRecords
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error executing report template {TemplateId}", templateId);
                return StatusCode(500, new { status = false, message = ex.Message });
            }
        }

        // Distinct values for a filter field/JSON path, scoped to a service — feeds
        // the report builder's filter-value dropdowns so the designer picks real values.
        [HttpGet]
        public async Task<IActionResult> GetReportFieldValues([FromQuery] int? serviceId = null, [FromQuery] string? field = null, [FromQuery] string? jsonPath = null)
        {
            try
            {
                var values = await DynamicReportQuery.GetDistinctValuesAsync(dbcontext, serviceId, field, jsonPath);
                return Ok(new { status = true, values });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching report field values");
                return StatusCode(500, new { status = false, message = ex.Message });
            }
        }
    }
}