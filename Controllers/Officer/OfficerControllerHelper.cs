using System.Globalization;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Security.Cryptography.Xml;
using System.Text;
using System.Text.RegularExpressions;
using System.Xml;
using iText.Forms.Form.Element;
using iText.Kernel.Geom;
using iText.Kernel.Pdf;
using iText.Kernel.Pdf.Canvas.Parser;
using iText.Kernel.Pdf.Canvas.Parser.Data;
using iText.Kernel.Pdf.Canvas.Parser.Listener;
using iText.Signatures;
using Microsoft.AspNetCore.Mvc;
using Npgsql;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using SahayataNidhi.Models.Entities;
using ServicesEntity = SahayataNidhi.Models.Entities.Services;
using Path = System.IO.Path;
using System.Threading.Tasks.Dataflow;
using System.Reflection;


namespace SahayataNidhi.Controllers.Officer
{
    public partial class OfficerController : Controller
    {
        public static string FormatKey(string input)
        {
            if (string.IsNullOrEmpty(input))
                return input;

            return Regex.Replace(input, "(?<!^)([A-Z])", " $1");
        }

        public string GetDistrictName(int districtId) => _referenceData.GetDistrictName(districtId);

        public string GetTehsilName(int tehsilId) => _referenceData.GetTehsilName(tehsilId);

        private static string? GetFormFieldValue(JObject formDetailsObj, string fieldName)
        {
            foreach (var section in formDetailsObj.Properties())
            {
                if (section.Value is JArray fieldsArray)
                {
                    foreach (JObject field in fieldsArray)
                    {
                        var name = field["name"]?.ToString();
                        if (name == fieldName)
                        {
                            return field["value"]?.ToString()
                                ?? field["File"]?.ToString()
                                ?? field["Enclosure"]?.ToString();
                        }
                    }
                }
            }

            return null;
        }

        public string GetFieldValue(string fieldName, dynamic data) => _referenceData.GetFieldValue(fieldName, data);

        public int GetCountPerDistrict(int districtId, int serviceId)
            => _applicationCounter.NextCount(districtId, serviceId, "Corrigendum");

        private dynamic GetFormattedValue(dynamic item, JObject data)
        {
            if (item == null)
                return new { Label = "[No Label]", Value = "[Item is null]" };

            string label = item.label?.ToString() ?? "[No Label]";
            string fmt = item.transformString?.ToString() ?? "{0}";

            if (!Regex.IsMatch(fmt, @"\{\d+\}"))
                return new { Label = label, Value = fmt };

            var rawValues = (item.selectedFields as IEnumerable<object> ?? Enumerable.Empty<object>())
                .Select(sf =>
                {
                    var name = sf?.ToString() ?? "";
                    if (string.IsNullOrWhiteSpace(name)) return "";

                    var fieldObj = FormJsonHelper.FindFieldRecursively(data, name);
                    string value = "";

                    if (fieldObj != null)
                    {
                        value = ExtractValueWithSpecials(fieldObj, name);

                        if (DateTime.TryParseExact(value,
                            new[] { "yyyy-MM-dd", "dd MMM yyyy hh:mm:ss tt" },
                            CultureInfo.InvariantCulture,
                            DateTimeStyles.None,
                            out DateTime dt))
                        {
                            value = dt.ToString("dd MMM yyyy");
                        }
                    }

                    return string.IsNullOrWhiteSpace(value) ? "" : value;
                })
                .ToList();

            var tokens = Regex.Split(fmt, @"(\{\d+\})").Where(t => !string.IsNullOrEmpty(t)).ToList();
            var outputParts = new List<string>();
            string literalAccumulator = "";

            for (int i = 0; i < tokens.Count; i++)
            {
                var token = tokens[i];

                if (Regex.IsMatch(token, @"^\{\d+\}$"))
                {
                    var indexStr = token.Substring(1, token.Length - 2);
                    if (int.TryParse(indexStr, out int index) && index < rawValues.Count && !string.IsNullOrWhiteSpace(rawValues[index]))
                    {
                        outputParts.Add(literalAccumulator);
                        outputParts.Add(rawValues[index]);
                    }
                    literalAccumulator = "";
                }
                else
                {
                    literalAccumulator += token;
                }
            }

            var result = string.Join("", outputParts);
            result = Regex.Replace(result, @",(\s*,)*\s*$", "");
            result = Regex.Replace(result, @"\s*,\s*,", ",").Trim();

            _logger.LogInformation($"---------- Result: {JsonConvert.SerializeObject(result)} --------------------");

            return new { Label = label, Value = result };
        }

        public static dynamic GetWorkFlowSanctionDetails(JArray workflow)
        {
            if (workflow == null || !workflow.Any())
                return null!;

            foreach (var item in workflow)
            {
                if (item["status"] != null)
                {
                    var statusValue = item["status"]?.ToString();

                    if (string.Equals(statusValue, "sanctioned", StringComparison.OrdinalIgnoreCase) ||
                        string.Equals(statusValue, "approved", StringComparison.OrdinalIgnoreCase))
                    {
                        return new
                        {
                            completedAt = item["completedAt"]?.ToString(),
                            designation = item["designation"]?.ToString(),
                            remarks = item["remarks"]?.ToString()
                        };
                    }
                }
            }

            return null!;
        }

        private bool UpdateFieldValueRecursively(JToken token, string fieldName, string newValue)
        {
            _logger.LogInformation($"------------ TOKEN : {token}  FieldName: {fieldName}  NEW Value: {newValue} ------------------");
            if (token is JObject obj)
            {
                if (obj["name"]?.ToString() == fieldName)
                {
                    if (DateTime.TryParse(newValue?.ToString(), out DateTime parsedDate))
                    {
                        obj["value"] = parsedDate.ToString("dd MMM yyyy", CultureInfo.InvariantCulture);
                    }
                    else
                    {
                        obj["value"] = newValue;
                    }
                    return true;
                }

                foreach (var prop in obj.Properties())
                {
                    if (UpdateFieldValueRecursively(prop.Value, fieldName, newValue))
                        return true;
                }
            }
            else if (token is JArray arr)
            {
                foreach (var el in arr)
                {
                    if (UpdateFieldValueRecursively(el, fieldName, newValue))
                        return true;
                }
            }

            return false;
        }

        private string ExtractValueWithSpecials(JObject fieldObj, string fieldName)
        {
            var tok = fieldObj["value"] ?? fieldObj["File"] ?? fieldObj["Enclosure"];
            if (tok == null) return "";

            var s = tok.ToString();
            if (fieldName.Contains("District", StringComparison.OrdinalIgnoreCase)
                && int.TryParse(s, out int did))
                return GetDistrictName(did);

            if (fieldName.Equals("Tehsil", StringComparison.OrdinalIgnoreCase)
                && int.TryParse(s, out int tid))
                return dbcontext.Tswotehsil.FirstOrDefault(m => m.Tehsilid == tid)?.Tehsilname ?? "";

            if (fieldName.EndsWith("Tehsil", StringComparison.OrdinalIgnoreCase)
               && int.TryParse(s, out int Tid))
                return dbcontext.Tehsil.FirstOrDefault(m => m.Tehsilid == Tid)?.Tehsilname ?? "";

            if (fieldName.Contains("Muncipality", StringComparison.OrdinalIgnoreCase)
                && int.TryParse(s, out int mid))
                return dbcontext.Muncipalities.FirstOrDefault(m => m.Muncipalityid == mid)?.Muncipalityname ?? "";

            if (fieldName.Contains("Block", StringComparison.OrdinalIgnoreCase)
                && int.TryParse(s, out int bid))
                return dbcontext.Blocks.FirstOrDefault(m => m.Blockid == bid)?.Blockname ?? "";

            if (fieldName.Contains("Ward", StringComparison.OrdinalIgnoreCase)
                && int.TryParse(s, out int wid))
                return dbcontext.Wards.FirstOrDefault(m => m.Wardcode == wid)?.Wardno.ToString() ?? "";

            if (fieldName.Contains("Village", StringComparison.OrdinalIgnoreCase)
                && int.TryParse(s, out int vid))
                return dbcontext.Villages.FirstOrDefault(m => m.Villageid == vid)?.Villagename ?? "";

            if (fieldName.Contains("BankName", StringComparison.OrdinalIgnoreCase)
                && int.TryParse(s, out int BankId))
                return dbcontext.Bank.FirstOrDefault(b => b.Id == BankId)?.Bankname ?? "Unknown Bank";

            return s;
        }

        [HttpGet]
        public IActionResult GetCertificateDetails()
        {
            var officer = GetOfficerDetails();
            try
            {
                var certificateDetails = dbcontext.Certificates
                    .Where(ce => ce.Officerid == officer.UserId)
                    .Select(c => new
                    {
                        serial_number = BitConverter.ToString(c.Serialnumber!).Replace("-", ""),
                        certifying_authority = c.Certifiyingauthority,
                        expiration_date = c.Expirationdate
                    })
                    .FirstOrDefault();

                _logger.LogInformation($"-------Certificate Details: {JsonConvert.SerializeObject(certificateDetails)}-------------------------------");

                if (certificateDetails == null)
                {
                    return NotFound(new { success = false, message = "No certificate found for this officer." });
                }

                return Json(new
                {
                    success = true,
                    certificateDetails
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching certificate details for User ID: {UserId}", officer?.UserId);
                return StatusCode(500, new { success = false, message = ex.Message });
            }
        }

        private static string CleanCorrectionFields(string correctionFieldsJson)
        {
            if (string.IsNullOrWhiteSpace(correctionFieldsJson))
                return "";

            try
            {
                var obj = JObject.Parse(correctionFieldsJson);

                // 🔹 Remove DSW, DSWO, TSWO inside Files
                if (obj["Files"] is JObject filesObj)
                {
                    filesObj.Remove("DSW");
                    filesObj.Remove("DSWO");
                    filesObj.Remove("TSWO");

                    // If Files becomes empty, remove it completely
                    if (!filesObj.Properties().Any())
                        obj.Remove("Files");
                }

                // 🔹 Remove additional_values from all fields
                foreach (var property in obj.Properties().ToList())
                {
                    if (property.Value is JObject fieldObj)
                    {
                        fieldObj.Remove("additional_values");
                    }
                }

                return obj.ToString(Newtonsoft.Json.Formatting.None);
            }
            catch
            {
                return correctionFieldsJson; // fallback
            }
        }

        /// <summary>
        /// True when a token is null, JSON null, or an empty / whitespace string.
        /// Numbers, booleans, and non-empty strings are considered "present".
        /// </summary>
        private static bool IsEmptyOrMissing(JToken? token)
        {
            if (token == null) return true;
            if (token.Type == JTokenType.Null) return true;
            if (token.Type == JTokenType.String && string.IsNullOrWhiteSpace(token.ToString())) return true;
            return false;
        }

        /// <summary>
        /// Translates a numeric code stored in formdetails into its human-readable name.
        /// Returns null when the field is not a known code field, the value isn't numeric,
        /// or the lookup fails — in which case the caller keeps the raw value.
        /// </summary>
        private static string? TryResolveCodeFieldName(string fieldName, string rawValue, SwdjkContext dbContext)
        {
            if (!int.TryParse(rawValue, out int code)) return null;

            // Top-level TSWO (Location → Tehsil) — uses the TSWO table
            if (string.Equals(fieldName, "Tehsil", StringComparison.OrdinalIgnoreCase))
                return dbContext.Tswotehsil.FirstOrDefault(t => t.Tehsilid == code)?.Tehsilname;

            // Division / Region — 1 = Jammu, 2 = Kashmir
            if (string.Equals(fieldName, "Region", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(fieldName, "Division", StringComparison.OrdinalIgnoreCase))
                return code == 1 ? "JAMMU" : code == 2 ? "KASHMIR" : null;

            // District (top-level and Present/Permanent districts)
            if (string.Equals(fieldName, "District", StringComparison.OrdinalIgnoreCase) ||
                fieldName.EndsWith("District", StringComparison.OrdinalIgnoreCase))
                return dbContext.District.FirstOrDefault(d => d.Districtid == code)?.Districtname;

            // Regular tehsil (PresentTehsil, PermanentTehsil)
            if (fieldName.EndsWith("Tehsil", StringComparison.OrdinalIgnoreCase))
                return dbContext.Tehsil.FirstOrDefault(t => t.Tehsilid == code)?.Tehsilname;

            if (fieldName.Contains("Muncipality", StringComparison.OrdinalIgnoreCase))
                return dbContext.Muncipalities.FirstOrDefault(m => m.Muncipalityid == code)?.Muncipalityname;

            if (fieldName.Contains("HalqaPanchayat", StringComparison.OrdinalIgnoreCase))
                return dbContext.Halqapanchayat.FirstOrDefault(h => h.Halqapanchayatid == code)?.Halqapanchayatname;

            if (fieldName.Contains("Block", StringComparison.OrdinalIgnoreCase))
                return dbContext.Blocks.FirstOrDefault(b => b.Blockid == code)?.Blockname;

            if (fieldName.Contains("Ward", StringComparison.OrdinalIgnoreCase))
                return dbContext.Wards.FirstOrDefault(w => w.Wardcode == code)?.Wardno.ToString();

            if (fieldName.Contains("Village", StringComparison.OrdinalIgnoreCase))
                return dbContext.Villages.FirstOrDefault(v => v.Villageid == code)?.Villagename;

            if (string.Equals(fieldName, "BankName", StringComparison.OrdinalIgnoreCase))
                return dbContext.Bank.FirstOrDefault(b => b.Id == code)?.Bankname;

            return null;
        }

        // Replaces every '(' and ')' in string values with '-'.
        // Walks objects and arrays so nested payloads get the same treatment.
        // Numbers, booleans, nulls and dates are returned unchanged.
        private static readonly Regex BracketRegex =
            new Regex(@"[()]", RegexOptions.Compiled);

        private static JToken? NormalizeBrackets(JToken? token)
        {
            if (token == null) return null;

            switch (token.Type)
            {
                case JTokenType.String:
                    var s = token.ToString();
                    if (s.IndexOf('(') < 0 && s.IndexOf(')') < 0) return token;
                    return new JValue(BracketRegex.Replace(s, "-"));

                case JTokenType.Object:
                    var srcObj = (JObject)token;
                    var outObj = new JObject();
                    foreach (var p in srcObj.Properties())
                    {
                        outObj[p.Name] = NormalizeBrackets(p.Value) ?? JValue.CreateNull();
                    }
                    return outObj;

                case JTokenType.Array:
                    var srcArr = (JArray)token;
                    var outArr = new JArray();
                    foreach (var item in srcArr)
                    {
                        outArr.Add(NormalizeBrackets(item) ?? JValue.CreateNull());
                    }
                    return outArr;

                default:
                    return token;   // Integer, Float, Boolean, Date, Null, …
            }
        }

        private static JToken? MapServiceFieldsFromForm(JObject? formDetailsObj, JToken fieldMapping, JArray workflowJson, object entityObject, SwdjkContext dbContext)
        {
            // ── CASE 0: Static value — always include (intentional config)
            if (fieldMapping is JObject staticConfig &&
                staticConfig.ContainsKey("type") &&
                string.Equals(staticConfig["type"]?.ToString(), "static", StringComparison.OrdinalIgnoreCase))
            {
                var staticValue = staticConfig["value"] ?? JToken.FromObject("");
                return NormalizeBrackets(staticValue);
            }

            // ── CASE 1: Leaf node { type, field }
            if (fieldMapping is JObject config && config.ContainsKey("type") && config.ContainsKey("field"))
            {
                string type = config["type"]?.ToString() ?? "";
                string field = config["field"]?.ToString() ?? "";
                string respectiveColumn = config["respectiveColumn"]?.ToString() ?? "";

                JToken? valueToken = null;

                if (type.Equals("column", StringComparison.OrdinalIgnoreCase))
                {
                    var property = entityObject.GetType()
                        .GetProperty(field, BindingFlags.IgnoreCase | BindingFlags.Public | BindingFlags.Instance);

                    if (property != null)
                    {
                        var value = property.GetValue(entityObject);
                        if (value != null)
                        {
                            // Auto-resolve Division / Region codes to names (1 = JAMMU, 2 = KASHMIR)
                            if ((field.Equals("Division", StringComparison.OrdinalIgnoreCase) ||
                                 field.Equals("Region", StringComparison.OrdinalIgnoreCase))
                                && int.TryParse(value.ToString(), out int divCode))
                            {
                                valueToken = divCode == 1 ? "JAMMU"
                                           : divCode == 2 ? "KASHMIR"
                                           : JToken.FromObject(value);
                            }
                            else
                            {
                                valueToken = JToken.FromObject(value);
                            }
                        }
                    }
                }
                else if (type.Equals("json", StringComparison.OrdinalIgnoreCase))
                {
                    if (respectiveColumn.Equals("Workflow", StringComparison.OrdinalIgnoreCase) ||
                        respectiveColumn.Equals("WorkFlow", StringComparison.OrdinalIgnoreCase))
                    {
                        var wf = GetWorkFlowSanctionDetails(workflowJson);
                        if (wf != null)
                        {
                            var prop = wf.GetType().GetProperty(field);
                            if (prop != null)
                            {
                                var val = prop.GetValue(wf);
                                valueToken = val != null ? JToken.FromObject(val) : null;
                            }
                        }
                    }
                    else if (formDetailsObj != null)
                    {
                        var foundField = FormJsonHelper.FindFieldRecursively(formDetailsObj, field);
                        var rawValue = foundField?["value"];

                        if (!IsEmptyOrMissing(rawValue))
                        {
                            // Try to translate known code fields (District, Tehsil, Block, Village, …) into names
                            var resolved = TryResolveCodeFieldName(field, rawValue!.ToString(), dbContext);
                            valueToken = resolved != null ? JToken.FromObject(resolved) : rawValue;
                        }
                    }
                }
                else if (type.Equals("lookup", StringComparison.OrdinalIgnoreCase))
                {
                    string lookupTable = config["lookupTable"]?.ToString()?.ToLower() ?? "";
                    int? idValue = null;

                    // 1. Prefer the id found in formdetails JSON
                    if (formDetailsObj != null)
                    {
                        var foundField = FormJsonHelper.FindFieldRecursively(formDetailsObj, field);
                        if (foundField?["value"] != null
                            && int.TryParse(foundField["value"]!.ToString(), out int formId))
                        {
                            idValue = formId;
                        }
                    }

                    // 2. Fall back to the entity property (with "Id" suffix fallback)
                    if (idValue == null)
                    {
                        var property = entityObject.GetType()
                            .GetProperty(field, BindingFlags.IgnoreCase | BindingFlags.Public | BindingFlags.Instance)
                            ?? entityObject.GetType()
                                .GetProperty(field + "Id", BindingFlags.IgnoreCase | BindingFlags.Public | BindingFlags.Instance);

                        if (property != null)
                        {
                            var val = property.GetValue(entityObject);
                            if (val != null && int.TryParse(val.ToString(), out int entityId))
                                idValue = entityId;
                        }
                    }

                    if (idValue.HasValue)
                    {
                        int id = idValue.Value;
                        valueToken = lookupTable switch
                        {
                            "district" =>
                                dbContext.District.FirstOrDefault(d => d.Districtid == id)?.Districtname is string dn
                                    ? JToken.FromObject(dn) : null,

                            "districtdivision" =>
                                dbContext.District.FirstOrDefault(d => d.Districtid == id)?.Division is int dv
                                    ? JToken.FromObject(dv) : null,

                            "tehsil" =>
                                dbContext.Tehsil.FirstOrDefault(t => t.Tehsilid == id)?.Tehsilname is string tn
                                    ? JToken.FromObject(tn) : null,

                            "tswotehsil" =>
                                dbContext.Tswotehsil.FirstOrDefault(t => t.Tehsilid == id)?.Tehsilname is string tsn
                                    ? JToken.FromObject(tsn) : null,

                            "block" =>
                                dbContext.Blocks.FirstOrDefault(b => b.Blockid == id)?.Blockname is string bn
                                    ? JToken.FromObject(bn) : null,

                            "village" =>
                                dbContext.Villages.FirstOrDefault(v => v.Villageid == id)?.Villagename is string vn
                                    ? JToken.FromObject(vn) : null,

                            "halqapanchayat" =>
                                dbContext.Halqapanchayat.FirstOrDefault(h => h.Halqapanchayatid == id)?.Halqapanchayatname is string hn
                                    ? JToken.FromObject(hn) : null,

                            "muncipality" =>
                                dbContext.Muncipalities.FirstOrDefault(m => m.Muncipalityid == id)?.Muncipalityname is string mn
                                    ? JToken.FromObject(mn) : null,

                            "ward" =>
                                dbContext.Wards.FirstOrDefault(w => w.Wardcode == id)?.Wardno is int wn
                                    ? JToken.FromObject(wn) : null,

                            "division" =>
                                id == 1 ? (JToken)"JAMMU"
                              : id == 2 ? (JToken)"KASHMIR"
                              : JToken.FromObject(id),

                            _ => null,
                        };
                    }
                }

                return IsEmptyOrMissing(valueToken) ? null : NormalizeBrackets(valueToken);
            }

            // ── CASE 2: Nested object — recurse, skipping any null children
            if (fieldMapping is JObject nestedObject)
            {
                JObject result = new JObject();
                foreach (var prop in nestedObject.Properties())
                {
                    var child = MapServiceFieldsFromForm(formDetailsObj, prop.Value, workflowJson, entityObject, dbContext);
                    if (child == null) continue;   // field missing/empty → don't include
                    result[prop.Name] = child;
                }

                // ✅ FIXED: Return the JObject directly. Do not wrap it in a JArray.
                return result;
            }

            return null;
        }

        private async Task SendApiRequestAsync(string url, object payload, string headersJson)
        {
            if (string.IsNullOrWhiteSpace(url))
            {
                _logger.LogError("API call failed: URL is null or whitespace");
                return;
            }

            url = url.Trim();

            if (!Uri.IsWellFormedUriString(url, UriKind.Absolute))
            {
                _logger.LogError("Malformed URL: '{Url}' – not a valid absolute URI", url);
                return;
            }

            // Note: It is highly recommended to inject IHttpClientFactory instead of using 'new HttpClient()' 
            // to prevent socket exhaustion in high-traffic environments.
            using var client = new HttpClient();

            // Add headers from stored JSON array
            if (!string.IsNullOrWhiteSpace(headersJson))
            {
                var headersArray = JArray.Parse(headersJson);
                foreach (var item in headersArray)
                {
                    string key = item["key"]?.ToString()!;
                    string value = item["value"]?.ToString()!;
                    if (!string.IsNullOrWhiteSpace(key) && !string.IsNullOrWhiteSpace(value))
                    {
                        client.DefaultRequestHeaders.TryAddWithoutValidation(key, value);
                    }
                }
            }

            var json = JsonConvert.SerializeObject(payload);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            try
            {
                var response = await client.PostAsync(url, content);
                var responseBody = await response.Content.ReadAsStringAsync();

                _logger.LogInformation("API call to {Url} returned {StatusCode}: {Body}",
                    url, response.StatusCode, responseBody);

                response.EnsureSuccessStatusCode();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "API call to {Url} failed", url);
                throw;
            }
        }

        /// <summary>
        /// Generic, configuration-driven web-service dispatcher.
        /// Fires every ACTIVE Webservice row for the given service whose Onaction
        /// array contains <paramref name="eventName"/> (case-insensitive).
        /// The payload shape is built entirely from Fieldmappings[eventName] via
        /// MapServiceFieldsFromForm - changing what data is sent NEVER requires code changes.
        /// Failures are logged and swallowed so external APIs never break officer workflow.
        /// </summary>
        /// <param name="eventName">Lifecycle event: "AddBeneficiaries" | "Corrigendum" | "Withheld" | any custom configured event</param>


        private record ApiCallResult(int? StatusCode, string? ResponseBody, string? ResponseHeaders, bool Success, string? Error, long DurationMs);

        /// <summary>
        /// Sends the payload with retries (respecting webservice.Retryenabled, Maxattempts, Retrydelayseconds),
        /// writing one webservice_logs row per attempt. Logging failures are swallowed so they never
        /// affect the caller.
        /// </summary>
        private async Task SendApiRequestWithLoggingAsync(
      int webserviceId,
      int serviceId,
      string triggerName,
      string? referenceNumber,
      string url,
      string method,
      string headersJson,
      object payload,
      bool retryEnabled,
      int maxAttempts,
      int retryDelaySeconds)
        {
            Guid executionId = Guid.NewGuid();
            string requestBody = JsonConvert.SerializeObject(payload);
            int totalAttempts = retryEnabled ? Math.Max(1, maxAttempts) : 1;
            int delaySeconds = retryEnabled ? Math.Max(1, retryDelaySeconds) : 0;

            ApiCallResult? lastResult = null;
            bool lastEffectiveSuccess = false;
            string? lastEffectiveError = null;

            for (int attempt = 1; attempt <= totalAttempts; attempt++)
            {
                ApiCallResult result;

                if (string.IsNullOrWhiteSpace(url) ||
                    !Uri.IsWellFormedUriString(url, UriKind.Absolute))
                {
                    result = new ApiCallResult(null, null, null, false,
                        $"Malformed URL: '{url}'", 0);
                }
                else
                {
                    result = await ExecuteHttpAsync(url, method, headersJson, requestBody);
                }

                lastResult = result;

                // ── Evaluate real success: transport status AND response body ────────
                var (effectiveSuccess, effectiveError) = EvaluateApiResult(result);
                lastEffectiveSuccess = effectiveSuccess;
                lastEffectiveError = effectiveError;

                // ── Persist one row per attempt ─────────────────────────────────────
                try
                {
                    dbcontext.WebserviceLogs.Add(new WebserviceLogs
                    {
                        Executionid = executionId,
                        Webserviceid = webserviceId,
                        Serviceid = serviceId,
                        Triggername = triggerName,
                        Referencenumber = referenceNumber,
                        Attemptnumber = attempt,
                        Requesturl = url,
                        Requestmethod = method,
                        Requestheaders = headersJson,
                        Requestbody = requestBody,
                        Responsestatuscode = result.StatusCode,
                        Responseheaders = result.ResponseHeaders,
                        Responsebody = result.ResponseBody,
                        Issuccess = effectiveSuccess,         // ← real success, not just HTTP
                        Errormessage = effectiveError,        // ← real error from body if any
                        Durationms = result.DurationMs,
                        Createdat = DateTime.UtcNow
                    });
                    await dbcontext.SaveChangesAsync();
                }
                catch (Exception logEx)
                {
                    _logger.LogError(logEx,
                        "Failed to persist webservice_logs row | webservice={WsId} execution={ExecutionId} attempt={Attempt}",
                        webserviceId, executionId, attempt);
                }

                _logger.LogInformation(
                    "WS call ws={WsId} trigger={Trigger} attempt={Attempt}/{Total} → http={HttpStatus} success={Success} duration={Duration}ms execution={ExecutionId}",
                    webserviceId, triggerName, attempt, totalAttempts,
                    result.StatusCode?.ToString() ?? "N/A",
                    effectiveSuccess, result.DurationMs, executionId);

                if (effectiveSuccess)
                    return;

                if (attempt < totalAttempts)
                    await Task.Delay(TimeSpan.FromSeconds(delaySeconds));
            }

            if (!lastEffectiveSuccess)
            {
                _logger.LogWarning(
                    "All {Total} attempts failed | webservice={WsId} trigger={Trigger} execution={ExecutionId} lastHttp={HttpStatus} lastError={Error}",
                    totalAttempts, webserviceId, triggerName, executionId,
                    lastResult?.StatusCode?.ToString() ?? "N/A",
                    lastEffectiveError);
            }
        }

        // ─────────────────────────────────────────────────────────────────────────────
        // Inspects both the HTTP transport result AND the response body to decide
        // whether the remote operation actually succeeded.
        //
        // Handles these API shapes:
        //   { "success": false, "Message": "...", "StatusCode": 500 }
        //   { "success": true }
        //   { "StatusCode": 500, "Message": "..." }   (no "success" flag)
        //   non-JSON bodies (plain text / HTML)       → falls back to HTTP status
        // ─────────────────────────────────────────────────────────────────────────────
        private static (bool Success, string? Error) EvaluateApiResult(ApiCallResult result)
        {
            // 1. Transport-level failure → already failed
            if (!result.Success)
            {
                return (false, result.Error
                    ?? (result.StatusCode.HasValue
                            ? $"HTTP {result.StatusCode}"
                            : "HTTP request failed"));
            }

            // 2. No body → nothing to inspect, trust the HTTP result
            if (string.IsNullOrWhiteSpace(result.ResponseBody))
                return (true, null);

            // 3. Try to detect an application-level error envelope
            try
            {
                var token = JToken.Parse(result.ResponseBody);

                // Shape A: explicit "success" flag (bool or string) set to false
                var successProp = token["success"] ?? token["Success"];
                if (successProp != null)
                {
                    bool isSuccess;
                    if (successProp.Type == JTokenType.Boolean)
                    {
                        isSuccess = successProp.Value<bool>();
                    }
                    else
                    {
                        // handle "false" / "true" as strings
                        isSuccess = !string.Equals(successProp.ToString(), "false",
                                                   StringComparison.OrdinalIgnoreCase);
                    }

                    if (!isSuccess)
                    {
                        var msg = token["Message"]?.ToString()
                               ?? token["message"]?.ToString()
                               ?? token["error"]?.ToString()
                               ?? "Remote API reported success=false";

                        var inner = token["StatusCode"]?.ToString()
                                 ?? token["statusCode"]?.ToString();

                        return (false, string.IsNullOrEmpty(inner) ? msg : $"[{inner}] {msg}");
                    }
                }

                // Shape B: explicit application StatusCode >= 400
                var statusProp = token["StatusCode"] ?? token["statusCode"];
                if (statusProp != null
                    && int.TryParse(statusProp.ToString(), out var appStatus)
                    && appStatus >= 400)
                {
                    var msg = token["Message"]?.ToString()
                           ?? token["message"]?.ToString()
                           ?? "Remote API error";

                    return (false, $"[{appStatus}] {msg}");
                }
            }
            catch (JsonException)
            {
                // Body isn't JSON — fall back to the HTTP result
            }

            return (true, null);
        }

        /// <summary>
        /// Pure HTTP call. No DB writes, no logging beyond ILogger. Returns a result
        /// object; never throws (exceptions are turned into a failure result).
        /// </summary>
        private async Task<ApiCallResult> ExecuteHttpAsync(
            string url, string method, string headersJson, string requestBody)
        {
            var sw = System.Diagnostics.Stopwatch.StartNew();
            try
            {
                // Prefer IHttpClientFactory in production; shown here to match existing style.
                using var client = new HttpClient();

                // Headers
                if (!string.IsNullOrWhiteSpace(headersJson))
                {
                    try
                    {
                        var headersArray = JArray.Parse(headersJson);
                        foreach (var item in headersArray)
                        {
                            string key = item["key"]?.ToString()!;
                            string value = item["value"]?.ToString()!;
                            if (!string.IsNullOrWhiteSpace(key) && !string.IsNullOrWhiteSpace(value))
                                client.DefaultRequestHeaders.TryAddWithoutValidation(key, value);
                        }
                    }
                    catch (Exception hdrEx)
                    {
                        _logger.LogWarning(hdrEx, "Failed to parse headers JSON for {Url}", url);
                    }
                }

                using var content = new StringContent(requestBody, Encoding.UTF8, "application/json");
                using var request = new HttpRequestMessage(new HttpMethod(method), url) { Content = content };
                using var response = await client.SendAsync(request);

                string responseBody = await response.Content.ReadAsStringAsync();
                string responseHeaders = string.Join("\n",
                    response.Headers
                            .Concat(response.Content.Headers)
                            .Select(h => $"{h.Key}: {string.Join(", ", h.Value)}"));

                sw.Stop();

                return new ApiCallResult(
                    (int)response.StatusCode,
                    responseBody,
                    responseHeaders,
                    response.IsSuccessStatusCode,
                    response.IsSuccessStatusCode ? null : $"HTTP {(int)response.StatusCode} {response.ReasonPhrase}",
                    sw.ElapsedMilliseconds);
            }
            catch (Exception ex)
            {
                sw.Stop();
                return new ApiCallResult(null, null, null, false, ex.Message, sw.ElapsedMilliseconds);
            }
        }

        public async Task DispatchWebServicesAsync(string eventName, JObject? formDetailsObj, JArray workflowJson, object entityObject, int serviceId, Func<JObject, JObject>? payloadTransform = null, bool wrapPayloadInArray = false)
        {
            try
            {
                var webServices = await dbcontext.Webservice
                    .Where(ws => ws.Serviceid == serviceId && ws.Isactive)
                    .ToListAsync();

                if (webServices.Count == 0)
                {
                    _logger.LogInformation(
                        "No active web services for service {ServiceId} (event {Event})",
                        serviceId, eventName);
                    return;
                }

                string? referenceNumber = ExtractReferenceNumber(entityObject);

                foreach (var ws in webServices)
                {
                    try
                    {
                        var onActions = JsonConvert.DeserializeObject<List<string>>(ws.Onaction ?? "[]")
                                        ?? new List<string>();

                        bool matches = onActions.Any(a =>
                            string.Equals(a, eventName, StringComparison.OrdinalIgnoreCase));

                        if (!matches)
                        {
                            _logger.LogDebug(
                                "Web service '{Name}' skipped for event '{Event}' (onactions: {Actions})",
                                ws.Webservicename, eventName, string.Join(",", onActions));
                            continue;
                        }

                        var mappings = JObject.Parse(ws.Fieldmappings ?? "{}");

                        // 1. Preferred: event-keyed wrapper { "EVENT_NAME": { ...fields... } }
                        JToken? mapping = mappings.Properties()
                            .FirstOrDefault(p => string.Equals(p.Name, eventName, StringComparison.OrdinalIgnoreCase))
                            ?.Value;

                        // 2. Fallback: flat mapping { "Field1": {...}, "Field2": {...} } with no event wrapper
                        bool usedFlatFallback = false;
                        if (mapping == null && LooksLikeFlatFieldMapping(mappings))
                        {
                            mapping = mappings;
                            usedFlatFallback = true;
                        }

                        if (mapping == null)
                        {
                            _logger.LogWarning(
                                "Web service '{Name}' listens on '{Event}' but Fieldmappings has no '{Event}' node and is not a flat field mapping. Skipping.",
                                ws.Webservicename, eventName, eventName);
                            continue;
                        }

                        // Apiendpoint is sometimes stored as a quoted JSON string
                        string endpoint = ws.Apiendpoint?.Trim() ?? "";
                        if (endpoint.StartsWith("\""))
                            endpoint = JsonConvert.DeserializeObject<string>(endpoint) ?? "";

                        if (string.IsNullOrWhiteSpace(endpoint))
                        {
                            _logger.LogWarning("Web service '{Name}' has empty endpoint. Skipping.", ws.Webservicename);
                            continue;
                        }

                        // Build payload from config
                        JToken? payload = MapServiceFieldsFromForm(formDetailsObj, mapping, workflowJson, entityObject, dbcontext);

                        if (payload == null)
                        {
                            _logger.LogWarning(
                                "Web service '{Name}' event '{Event}' produced an empty payload — skipping dispatch.",
                                ws.Webservicename, eventName);
                            continue;
                        }

                        // Apply payload transform regardless of whether the mapper returned
                        // an object or an array-of-one (nested configs are wrapped in an array).
                        if (payloadTransform != null)
                        {
                            if (payload is JObject payloadObj)
                            {
                                payload = payloadTransform(payloadObj);
                            }
                            else if (payload is JArray payloadArr)
                            {
                                // Apply in-place to every JObject inside the array
                                foreach (var item in payloadArr.OfType<JObject>())
                                {
                                    payloadTransform(item);   // mutates in place; return value ignored
                                }
                            }
                        }

                        object outgoing = wrapPayloadInArray ? new JArray(payload) : payload;

                        _logger.LogInformation(
                            "Dispatching web service '{Name}' | event={Event} | mappingShape={Shape} | endpoint={Endpoint}",
                            ws.Webservicename, eventName,
                            usedFlatFallback ? "flat" : "event-keyed",
                            endpoint);

                        await SendApiRequestWithLoggingAsync(
                            webserviceId: ws.Id,
                            serviceId: serviceId,
                            triggerName: eventName,
                            referenceNumber: referenceNumber,
                            url: endpoint,
                            method: "POST",
                            headersJson: ws.Headers ?? "[]",
                            payload: outgoing,
                            retryEnabled: ws.Retryenabled,
                            maxAttempts: ws.Maxattempts,
                            retryDelaySeconds: ws.Retrydelayseconds);
                    }
                    catch (Exception exPerService)
                    {
                        _logger.LogError(exPerService,
                            "Web service '{Name}' failed for event '{Event}' (service {ServiceId})",
                            ws.Webservicename, eventName, serviceId);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "Web-service dispatch failed for event '{Event}' (service {ServiceId})",
                    eventName, serviceId);
            }
        }

        private static string? ExtractReferenceNumber(object entityObject) => entityObject switch
        {
            CitizenApplications ca => ca.Referencenumber,
            Corrigendum c => c.Referencenumber,
            WithheldApplications w => w.Referencenumber,
            _ => null
        };

        /// <summary>
        /// True when every top-level value looks like a field descriptor
        /// (has both "type" and "field"). Distinguishes a flat Fieldmappings
        /// payload (like webservice id=4) from an event-keyed wrapper.
        /// </summary>
        private static bool LooksLikeFlatFieldMapping(JObject mappings)
        {
            if (mappings == null || mappings.Count == 0) return false;
            foreach (var prop in mappings.Properties())
            {
                if (prop.Value is not JObject obj) return false;
                if (obj["type"] == null || obj["field"] == null) return false;
            }
            return true;
        }

        /// <summary>
        /// Turns the raw Corrigendumfields JSON stored on the corrigendum row into the shape
        /// the external API expects:
        ///   { "FieldName": { "old_value": ..., "new_value": ... }, ... }
        /// Strips "Files", "additional_values", and "supporting_document".
        /// Returns a JObject (nested object), not a string.
        /// </summary>
        /// 
        // Strict date formats recognised in corrigendum values. The output is
        // always normalised to yyyy-MM-dd, regardless of which format matched.
        private static readonly string[] DateValueFormats = new[]
        {
            "yyyy-MM-dd",
            "yyyy/MM/dd",
            "dd/MM/yyyy",
            "d/M/yyyy",
            "dd-MM-yyyy",
            "d-M-yyyy",
            "dd MMM yyyy",
            "d MMM yyyy",
            "dd MMMM yyyy",
            "d MMMM yyyy",
        };

        // If the token is a string that matches one of the strict date formats,
        // rewrite it as yyyy-MM-dd. Non-string tokens, empty strings, and strings
        // that do not match any known date format are returned unchanged, so
        // ordinary text fields, numbers, and IDs are never touched.
        private static JToken? NormalizeDateValue(JToken? token)
        {
            if (token == null || token.Type != JTokenType.String)
                return token;

            var raw = token.ToString();
            if (string.IsNullOrWhiteSpace(raw))
                return token;

            var trimmed = raw.Trim();

            if (DateTime.TryParseExact(
                    trimmed,
                    DateValueFormats,
                    CultureInfo.InvariantCulture,
                    DateTimeStyles.None,
                    out var parsed))
            {
                return new JValue(
                    parsed.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
            }

            return token;
        }
        private static JObject? CleanCorrectionFieldsObject(string? corrigendumFieldsJson)
        {
            if (string.IsNullOrWhiteSpace(corrigendumFieldsJson))
                return null;

            try
            {
                var source = JObject.Parse(corrigendumFieldsJson);
                var output = new JObject();

                foreach (var prop in source.Properties())
                {
                    // Drop the global Files block entirely
                    if (string.Equals(prop.Name, "Files", StringComparison.OrdinalIgnoreCase))
                        continue;

                    if (prop.Value is not JObject fieldObj)
                        continue;

                    var oldVal = fieldObj["old_value"];
                    var newVal = fieldObj["new_value"];

                    // Nothing to send if neither old nor new value is present
                    if (IsEmptyOrMissing(oldVal) && IsEmptyOrMissing(newVal))
                        continue;

                    var clean = new JObject();

                    if (!IsEmptyOrMissing(oldVal))
                        clean["old_value"] = NormalizeDateValue(oldVal);

                    if (!IsEmptyOrMissing(newVal))
                        clean["new_value"] = NormalizeDateValue(newVal);

                    output[prop.Name] = clean;
                }

                return output;
            }
            catch
            {
                return null;
            }
        }




        /// <summary>
        /// True when every top-level value of the object looks like a field descriptor
        /// (i.e., has both "type" and "field" keys). This distinguishes a flat
        /// Fieldmappings payload from an event-keyed wrapper.
        /// </summary>

        public JToken ReorderFormDetails(JToken formDetailsToken, string applicationId, bool isSanctioned)
        {
            if (formDetailsToken is not JObject formDetailsObject)
                return formDetailsToken;

            // Fetch sanctioned corrigendums
            var corrigendums = dbcontext.Corrigendum
                .Where(co => co.Referencenumber == applicationId && co.Status == "Sanctioned")
                .ToList();

            // Ensure Documents section exists
            if (!formDetailsObject.ContainsKey("Documents") || formDetailsObject["Documents"] is not JArray)
            {
                formDetailsObject["Documents"] = new JArray();
            }

            var documentsArray = (JArray)formDetailsObject["Documents"]!;

            // Filter out invalid "Other" documents
            var filteredDocs = new JArray(
                documentsArray.Children<JObject>().Where(doc =>
                {
                    var name = doc["name"]?.ToString();
                    var enclosure = doc["Enclosure"]?.ToString();
                    return !(name == "Other" && (string.IsNullOrEmpty(enclosure) || enclosure == "Please Select"));
                })
            );

            // Add Sanction Letter if sanctioned
            if (isSanctioned)
            {
                filteredDocs.Add(new JObject
        {
            { "label", "Sanction Letter" },
            { "name", "Sanction Letter" },
            { "Enclosure", "Sanction Letter" },
            { "File", applicationId.Replace("/", "_") + "_SanctionLetter.pdf" }
        });
            }

            // Add Corrigendum Sanction Letters
            foreach (var corrigendum in corrigendums)
            {
                filteredDocs.Add(new JObject
        {
            { "label", "Corrigendum Sanction Letter" },
            { "name", "Corrigendum Sanction Letter" },
            { "Enclosure", "Corrigendum Sanction Letter" },
            { "File", corrigendum.Corrigendumid.Replace("/", "_") + "_CorrigendumSanctionLetter.pdf" }
        });
            }

            // Store final Documents array (will be added last)
            var finalDocuments = filteredDocs;

            // Start building the reordered object
            var reordered = new JObject();

            // 1. Location - First
            if (formDetailsObject["Location"] != null)
            {
                reordered["Location"] = formDetailsObject["Location"];
            }

            // 2. Applicant Details - Second
            if (formDetailsObject["Applicant Details"] != null)
            {
                reordered["Applicant Details"] = formDetailsObject["Applicant Details"];
            }

            // 3. All other sections EXCEPT Location, Applicant Details, Bank Details, Documents, Declearation
            foreach (var prop in formDetailsObject.Properties())
            {
                string name = prop.Name;
                if (name != "Location" &&
                    name != "Applicant Details" &&
                    name != "Bank Details" &&
                    name != "Documents" &&
                    name != "Declearation")
                {
                    reordered[name] = prop.Value;
                }
            }

            // 4. Bank Details - Second Last (if exists)
            if (formDetailsObject["Bank Details"] != null)
            {
                reordered["Bank Details"] = formDetailsObject["Bank Details"];
            }

            // 5. Documents - Always Last
            reordered["Documents"] = finalDocuments;

            // "Declearation" remains excluded as per original logic

            return reordered;
        }

        public string? GetSanctionedCorrigendum(dynamic WorkFlow, string id)
        {
            foreach (var item in WorkFlow)
            {
                if ((string)item.status == "sanctioned")
                {
                    return id;
                }
            }

            return null;
        }

        private static string FormatSectionKey(string key)
        {
            if (string.IsNullOrEmpty(key)) return key;

            var result = Regex.Replace(key, "([a-z])([A-Z])", "$1 $2");
            return CultureInfo.CurrentCulture.TextInfo.ToTitleCase(result);
        }

        private static string FormatFieldLabel(string label)
        {
            if (string.IsNullOrEmpty(label)) return label;

            return label.EndsWith(":") ? label : $"{label}:";
        }

        private string ConvertValueForDisplay(string name, string value)
        {
            if (string.IsNullOrEmpty(value)) return value;

            if (name.Contains("District", StringComparison.OrdinalIgnoreCase) && int.TryParse(value, out int districtId))
            {
                return GetDistrictName(districtId);
            }
            else if (name.Equals("Tehsil", StringComparison.OrdinalIgnoreCase) && int.TryParse(value, out int tehsilId))
            {
                return dbcontext.Tswotehsil.FirstOrDefault(m => m.Tehsilid == tehsilId)?.Tehsilname ?? "";
            }
            else if (name.EndsWith("Tehsil", StringComparison.OrdinalIgnoreCase) && int.TryParse(value, out int Tehsilid))
            {
                return GetTehsilName(Tehsilid);
            }
            else if (name.Contains("Muncipality", StringComparison.OrdinalIgnoreCase) && int.TryParse(value, out int muncipalityId))
            {
                return dbcontext.Muncipalities.FirstOrDefault(m => m.Muncipalityid == muncipalityId)?.Muncipalityname ?? "";
            }
            else if (name.Contains("Block", StringComparison.OrdinalIgnoreCase) && int.TryParse(value, out int BlockId))
            {
                return dbcontext.Blocks.FirstOrDefault(m => m.Blockid == BlockId)?.Blockname ?? "";
            }
            else if (name.Contains("Ward", StringComparison.OrdinalIgnoreCase) && int.TryParse(value, out int WardId))
            {
                return dbcontext.Wards.FirstOrDefault(m => m.Wardcode == WardId)?.Wardno.ToString() ?? "";
            }
            else if (name.Contains("Village", StringComparison.OrdinalIgnoreCase) && int.TryParse(value, out int Villageid))
            {
                return dbcontext.Villages.FirstOrDefault(m => m.Villageid == Villageid)?.Villagename ?? "";
            }

            return value;
        }

        public string GetOfficerArea(string accessLevel, dynamic formDetails) => _referenceData.GetOfficerArea(accessLevel, formDetails);

        private void UpdateOfficerActionFormLabels(JObject officerClone, dynamic formDetails)
        {
            var officerRoles = dbcontext.Users
                .Where(u => u.Usertype == "Officer" && u.Additionaldetails != null)
                .AsEnumerable()
                .Select(u => JsonConvert.DeserializeObject<Dictionary<string, dynamic>>(u.Additionaldetails!))
                .Where(details => details != null && details.ContainsKey("AccessLevel"))
                .Select(details => details!["AccessLevel"])
                .Distinct()
                .ToList();

            if (officerClone.TryGetValue("actionForm", out var actionFormToken) && actionFormToken is JArray actionFormArray)
            {
                foreach (var field in actionFormArray.Children<JObject>())
                {
                    if (field.TryGetValue("options", out var optionsToken) && optionsToken is JArray optionsArray)
                    {
                        foreach (var option in optionsArray.Children<JObject>())
                        {
                            string? label = option["label"]?.ToString();
                            if (string.IsNullOrWhiteSpace(label)) continue;

                            foreach (var role in officerRoles)
                            {
                                if (label.Contains(role!, StringComparison.OrdinalIgnoreCase))
                                {
                                    string area = GetOfficerArea(role, formDetails);
                                    option["label"] = $"{label} {area}";
                                    break;
                                }
                            }
                        }
                    }
                }
            }
        }

        private void ReplaceCodeFieldsWithNames(JToken formDetails, bool doBankName = true)
        {
            var lookupMap = new Dictionary<string, Func<int, string>>
            {
                { "District", GetDistrictName },
                { "Tehsil", id=>dbcontext.Tswotehsil.FirstOrDefault(t => t.Tehsilid == id)?.Tehsilname ?? "" },
                { "PresentTehsil", id => dbcontext.Tehsil.FirstOrDefault(t => t.Tehsilid == id)?.Tehsilname ?? "" },
                { "PermanentTehsil", id => dbcontext.Tehsil.FirstOrDefault(t => t.Tehsilid == id)?.Tehsilname ?? "" },
                { "Muncipality", id => dbcontext.Muncipalities.FirstOrDefault(m => m.Muncipalityid == id)?.Muncipalityname ?? "" },
                { "Block", id => dbcontext.Blocks.FirstOrDefault(m => m.Blockid == id)?.Blockname ?? "" },
                { "HalqaPanchayat", id => dbcontext.Halqapanchayat.FirstOrDefault(m => m.Halqapanchayatid == id)?.Halqapanchayatname ?? "" },
                { "Village", id => dbcontext.Villages.FirstOrDefault(m => m.Villageid == id)?.Villagename ?? "" },
                { "WardNo", id => dbcontext.Wards.FirstOrDefault(w => w.Wardcode == id)?.Wardno.ToString() ?? "" },
            };

            if (doBankName)
            {
                lookupMap["BankName"] =
                    id => dbcontext.Bank.FirstOrDefault(b => b.Id == id)?.Bankname ?? "";
            }

            foreach (var section in formDetails.Children<JProperty>())
            {
                foreach (var fieldToken in section.Value.Children<JObject>())
                {
                    ProcessField(fieldToken, lookupMap);

                    if (fieldToken["additionalFields"] is JArray additionalFields)
                    {
                        foreach (var additional in additionalFields.OfType<JObject>())
                            ProcessField(additional, lookupMap);
                    }
                }
            }
        }

        private static void ProcessField(JObject field, Dictionary<string, Func<int, string>> lookupMap)
        {
            var name = field["name"]?.ToString() ?? "";
            var valueStr = field["value"]?.ToString();

            if (!int.TryParse(valueStr, out int code)) return;

            foreach (var key in lookupMap.Keys)
            {
                if (name.Equals(key, StringComparison.OrdinalIgnoreCase))
                {
                    field["value"] = lookupMap[key](code);
                    return;
                }
            }

            foreach (var key in lookupMap.Keys)
            {
                if (name.EndsWith(key, StringComparison.OrdinalIgnoreCase))
                {
                    field["value"] = lookupMap[key](code);
                    return;
                }
            }
        }

        // BUG FIX: this used to short-circuit the "Division" case as
        // `accessCode == 1 ? "Jammu" : "Kashmir"`, treating the district id
        // itself as the division flag - wrong for any district id other than 1.
        // Delegating to the shared implementation, which looks up the district
        // and reads its actual Division field (see ReferenceDataService).
        public string GetOfficerAreaForHistory(string accessLevel, int? accessCode) => _referenceData.GetOfficerAreaForHistory(accessLevel, accessCode);

        private static void FormatDateFields(JToken formDetails)
        {
            foreach (var section in formDetails.Children<JProperty>())
            {
                foreach (var field in section.Value.Children<JObject>())
                {
                    TryFormatDate(field);

                    if (field["additionalFields"] is JArray additionalFields)
                    {
                        foreach (var additional in additionalFields.OfType<JObject>())
                            TryFormatDate(additional);
                    }
                }
            }
        }

        private static void TryFormatDate(JObject field)
        {
            if (DateTime.TryParse(field["value"]?.ToString(), out DateTime dt))
            {
                field["value"] = dt.ToString("dd MMM yyyy");
            }
        }

        private static void UpdateWorkflowFlags(JArray officerArray, int currentPlayerId)
        {
            var previousOfficer = officerArray.FirstOrDefault(o => (int)o["playerId"]! == (currentPlayerId - 1));
            var nextOfficer = officerArray.FirstOrDefault(o => (int)o["playerId"]! == (currentPlayerId + 1));

            if (previousOfficer != null)
                previousOfficer["canPull"] = false;

            if (nextOfficer != null)
                nextOfficer["canPull"] = false;
        }


        private void InjectEditableActionForm(JObject currentOfficerClone, ServicesEntity? serviceDetails, int currentPlayer)
        {
            if (string.IsNullOrWhiteSpace(serviceDetails?.Officereditablefield))
                return;

            var editableFields = JsonConvert.DeserializeObject<List<JObject>>(serviceDetails.Officereditablefield);
            int playerId = (int)currentOfficerClone["playerId"]!;

            var match = editableFields?.FirstOrDefault(f => (int)f["playerId"]! == playerId);
            if (match != null && match["actionForm"] != null)
            {
                currentOfficerClone["actionForm"] = match["actionForm"];
            }
        }

        private List<object> BuildMainApplicationCounts(StatusCounts counts, dynamic authorities)
        {
            var countList = new List<object>
            {
                new { label = "Total Applications", count = counts.TotalApplications, bgColor = "#000000", textColor = "#FFFFFF",tableTitle = "Total Applications" },
                new { label = "Pending", count = counts.PendingCount, bgColor = "#FFC107", textColor = "#212121" ,tableTitle="Pending Applications"}
            };

            _logger.LogInformation($"---- Officer Authorities: {authorities} ------");

            if ((bool)authorities.CanForwardToPlayer)
            {
                countList.Add(new
                {
                    label = "Forwarded",
                    count = counts.ForwardedCount,
                    bgColor = "#64B5F6",
                    textColor = "#0D47A1",
                    tableTitle = "Forwarded Applications",
                    forwardedSanctionedCount = counts.ForwardedCount > 0 ? counts.ForwardedSanctionedCount : (int?)null
                });
            }

            if ((bool)authorities.CanReturnToPlayer)
            {
                countList.Add(new
                {
                    label = "Returned",
                    count = counts.ReturnedCount,
                    bgColor = "#E0E0E0",
                    textColor = "#212121",
                    tableTitle = "Returned Applications",
                });
            }

            if ((bool)authorities.CanReturnToCitizen)
            {
                countList.Add(new
                {
                    label = "Pending With Citizen",
                    count = counts.ReturnToEditCount,
                    bgColor = "#CE93D8",
                    textColor = "#4A148C",
                    tooltipText = "Application is pending at Citizen level for correction.",
                    tableTitle = "Pending With Citizen Applications",
                });
            }

            countList.Add(new
            {
                label = "Rejected",
                count = counts.RejectCount,
                bgColor = "#FF7043",
                textColor = "#B71C1C",
                tableTitle = "Rejected Applications",
            });

            if ((bool)authorities.CanSanction)
            {
                countList.Add(new
                {
                    label = "Sanctioned",
                    count = counts.SanctionedCount,
                    bgColor = "#81C784",
                    textColor = "#1B5E20",
                    tableTitle = "Sanctioned Applications",
                });
            }

            return countList;
        }

        private static List<object> BuildCorrigendumCounts(StatusCounts counts, dynamic authorities)
        {
            var corrigendumList = new List<object>
            {
                new
                {
                    label = "Total Corrigendum",
                    name = "corrigendum",
                    count = counts.CorrigendumCount,
                    bgColor = "#6A1B9A",
                    textColor = "#FFFFFF",
                    tableTitle = "Total Corrigendum Applications",
                },
                new
                {
                    label = "Pending",
                    name = "corrigendum",
                    count = counts.CorrigendumPendingCount,
                    bgColor = "#FFC107",
                    textColor = "#212121",
                    tableTitle = "Pending Corrigendum Applications",
                }
            };

            if ((bool)authorities.CanForwardToPlayer)
            {
                corrigendumList.Add(new
                {
                    label = "Forwarded",
                    name = "corrigendum",
                    count = counts.CorrigendumForwardedCount,
                    bgColor = "#64B5F6",
                    textColor = "#0D47A1",
                    tableTitle = "Forwarded Corrigendum Applications",
                    forwardedSanctionedCount = counts.CorrigendumForwardedCount > 0 ? counts.ForwardedSanctionedCorrigendumCount : (int?)null
                });
            }

            if ((bool)authorities.CanReturnToPlayer)
            {
                corrigendumList.Add(new
                {
                    label = "Returned",
                    name = "corrigendum",
                    count = counts.CorrigendumReturnedCount,
                    bgColor = "#E0E0E0",
                    textColor = "#212121",
                    tableTitle = "Returned Corrigendum Applications",
                });
            }

            corrigendumList.Add(new
            {
                label = "Rejected",
                name = "corrigendum",
                count = counts.CorrigendumRejectedCount,
                bgColor = "#FF7043",
                textColor = "#B71C1C",
                tableTitle = "Rejected Corrigendum Applications",
            });

            if ((bool)authorities.CanSanction)
            {
                corrigendumList.Add(new
                {
                    label = "Issued",
                    name = "corrigendum",
                    count = counts.CorrigendumSanctionedCount,
                    bgColor = "#81C784",
                    textColor = "#1B5E20",
                    tableTitle = "Issued Corrigendum Applications",
                });
            }

            return corrigendumList;
        }

        private static List<object> BuildAmendmentCounts(StatusCounts counts, dynamic authorities)
        {
            var amendmentList = new List<object>
            {
                new
                {
                    label = "Total Amendment",
                    name = "corrigendum",
                    count = counts.AmendmentCount,
                    bgColor = "#6A1B9A",
                    textColor = "#FFFFFF",
                    tableTitle = "Total Amendment Applications",
                },
                new
                {
                    label = "Pending",
                    name = "corrigendum",
                    count = counts.AmendmentPendingCount,
                    bgColor = "#FFC107",
                    textColor = "#212121",
                    tableTitle = "Pending Amendment Applications",
                }
            };

            if ((bool)authorities.CanForwardToPlayer)
            {
                amendmentList.Add(new
                {
                    label = "Forwarded",
                    name = "corrigendum",
                    count = counts.AmendmentForwardedCount,
                    bgColor = "#64B5F6",
                    textColor = "#0D47A1",
                    tableTitle = "Forwarded Amendment Applications",
                    forwardedSanctionedCount = counts.CorrigendumForwardedCount > 0 ? counts.ForwardedSanctionedCorrigendumCount : (int?)null
                });
            }

            if ((bool)authorities.CanReturnToPlayer)
            {
                amendmentList.Add(new
                {
                    label = "Returned",
                    name = "corrigendum",
                    count = counts.AmendmentReturnedCount,
                    bgColor = "#E0E0E0",
                    textColor = "#212121",
                    tableTitle = "Returned Amendment Applications",
                });
            }

            amendmentList.Add(new
            {
                label = "Rejected",
                name = "corrigendum",
                count = counts.AmendmentRejectedCount,
                bgColor = "#FF7043",
                textColor = "#B71C1C",
                tableTitle = "Rejected Amendment Applications",
            });

            if ((bool)authorities.CanSanction)
            {
                amendmentList.Add(new
                {
                    label = "Issued",
                    name = "corrigendum",
                    count = counts.AmendmentSanctionedCount,
                    bgColor = "#81C784",
                    textColor = "#1B5E20",
                    tableTitle = "Issued Amendment Applications",
                });
            }

            return amendmentList;
        }

        private static List<object> BuildCorrectionCounts(StatusCounts counts, dynamic authorities)
        {
            var correctionList = new List<object>
            {
                new
                {
                    label = "Total Correction",
                    name = "correction",
                    count = counts.CorrectionCount,
                    bgColor = "#6A1B9A",
                    textColor = "#FFFFFF",
                    tableTitle = "Total Correction Applications",
                },
                new
                {
                    label = "Pending",
                    name = "correction",
                    count = counts.CorrectionPendingCount,
                    bgColor = "#FFC107",
                    textColor = "#212121",
                    tableTitle = "Pending Correction Applications",
                }
            };

            if ((bool)authorities.CanForwardToPlayer)
            {
                correctionList.Add(new
                {
                    label = "Forwarded",
                    name = "correction",
                    count = counts.CorrectionForwardedCount,
                    bgColor = "#64B5F6",
                    textColor = "#0D47A1",
                    tableTitle = "Forwarded Correction Applications",
                    forwardedSanctionedCount = counts.CorrectionForwardedCount > 0 ? counts.ForwardedVerifiedCorrectionCount : (int?)null
                });
            }

            if ((bool)authorities.CanReturnToPlayer)
            {
                correctionList.Add(new
                {
                    label = "Returned",
                    name = "correction",
                    count = counts.CorrectionReturnedCount,
                    bgColor = "#E0E0E0",
                    textColor = "#212121",
                    tableTitle = "Returned Correction Applications",
                });
            }

            correctionList.Add(new
            {
                label = "Rejected",
                name = "correction",
                count = counts.CorrectionRejectedCount,
                bgColor = "#FF7043",
                textColor = "#B71C1C",
                tableTitle = "Rejected Correction Applications",
            });

            if ((bool)authorities.CanSanction)
            {
                correctionList.Add(new
                {
                    label = "Issued",
                    name = "correction",
                    count = counts.CorrectionSanctionedCount,
                    bgColor = "#81C784",
                    textColor = "#1B5E20",
                    tableTitle = "Issued Correction Applications",
                });
            }

            return correctionList;
        }

        public async Task NotifyExpiringEligibilities(string? Serviceid, int pageIndex = 0, int pageSize = 10)
        {
            if (!int.TryParse(Serviceid, out int serviceId))
            {
                _logger.LogWarning("Invalid Serviceid provided");
                return;
            }

            string accessLevel = "State";
            int? accessCode = 0;
            string takenBy = "";
            int? divisionCode = null;
            string resultType = "expiringeligibility";

            if (pageIndex < 0) pageIndex = 0;
            if (pageSize < 1) pageSize = 10;

            var applications = await dbcontext.CitizenApplications
                .FromSqlRaw("SELECT * FROM get_disability_applications(@p_access_level, @p_access_code, @p_service_id, @p_taken_by, @p_division_code, @p_result_type, @p_page_number, @p_page_size)",
                    new NpgsqlParameter("@p_access_level", accessLevel),
                    new NpgsqlParameter("@p_access_code", accessCode ?? (object)DBNull.Value),
                    new NpgsqlParameter("@p_service_id", serviceId),
                    new NpgsqlParameter("@p_taken_by", takenBy),
                    new NpgsqlParameter("@p_division_code", divisionCode ?? (object)DBNull.Value),
                    new NpgsqlParameter("@p_result_type", resultType),
                    new NpgsqlParameter("@p_page_number", pageIndex + 1),
                    new NpgsqlParameter("@p_page_size", pageSize))
                .ToListAsync();

            int mailSentCount = 0;

            foreach (var application in applications)
            {
                var formDetailsObj = JToken.Parse(application.Formdetails ?? "{}");
                string applicantName = GetFieldValue("ApplicantName", formDetailsObj);
                string email = GetFieldValue("Email", formDetailsObj);

                var expiringApplication = dbcontext.ApplicationExpirations
                    .FirstOrDefault(ae => ae.Referencenumber == application.Referencenumber);

                if (expiringApplication != null && !string.IsNullOrEmpty(email))
                {
                    DateTime expirationDate = DateTime.Parse(expiringApplication.ExpirationDate.ToString());

                    string htmlMessage = $@"
                    <div style='font-family: Arial, sans-serif;'>
                        <h2 style='color: #2e6c80;'>UDID Card Validity Expiring</h2>
                        <p><strong>{applicantName}</strong>,</p>
                        <p>
                            This is a reminder that your UDID Card linked to application reference number 
                            <strong>{application.Referencenumber}</strong> is expiring on <strong>{expirationDate:dd MMM yyyy}</strong>.
                        </p>
                        <p>
                            Please renew your UDID card and update your application if a new one has been issued.
                            This is necessary to continue receiving financial assistance without interruption.
                        </p>
                        <p>
                            You can log into the citizen portal and update your UDID card details at your earliest convenience.
                        </p>
                        <p>
                            If you've already renewed your UDID card, kindly ignore this message.
                        </p>
                        <br />
                        <p style='font-size: 12px; color: #888;'>Thank you,<br />Your Application Team</p>
                    </div>";

                    expiringApplication.MailSentCount++;
                    await dbcontext.SaveChangesAsync();

                    await emailSender.SendEmail(email, "Important: UDID Card Validity Expiring", htmlMessage);
                    mailSentCount++;
                }
            }

            _logger.LogInformation("Processed {Count} applications, sent {Mails} mails", applications.Count, mailSentCount);
        }

        private string SignXml(string strxml)
        {
            try
            {
                var xmlDoc = new XmlDocument { PreserveWhitespace = true };
                xmlDoc.LoadXml(strxml);

                var certPath = Path.Combine(_webHostEnvironment.WebRootPath, _config["Certificate:CertPath"] ?? throw new InvalidOperationException("Certificate:CertPath not configured"));
                var certPassword = _config["Certificate:CertPassword"] ?? throw new InvalidOperationException("Certificate:CertPassword not configured");
                _logger.LogDebug("Loading certificate from {CertPath}", certPath);
                if (!System.IO.File.Exists(certPath))
                {
                    _logger.LogError("Certificate file not found at {CertPath}", certPath);
                    throw new FileNotFoundException("Certificate file not found", certPath);
                }
                using var cert = X509CertificateLoader.LoadPkcs12FromFile(certPath, certPassword, X509KeyStorageFlags.EphemeralKeySet);

                _logger.LogDebug("Certificate loaded: Subject={Subject}, HasPrivateKey={HasPrivateKey}", cert.Subject, cert.HasPrivateKey);

                var signedXml = new SignedXml(xmlDoc) { SigningKey = cert.GetRSAPrivateKey() ?? throw new InvalidOperationException("No private key") };
                var reference = new Reference { Uri = "" };
                reference.AddTransform(new XmlDsigEnvelopedSignatureTransform());
                signedXml.AddReference(reference);

                var keyInfo = new KeyInfo();
                keyInfo.AddClause(new KeyInfoX509Data(cert));
                signedXml.KeyInfo = keyInfo;
                signedXml.ComputeSignature();

                var xmlDigitalSignature = signedXml.GetXml();
                xmlDoc.DocumentElement?.AppendChild(xmlDoc.ImportNode(xmlDigitalSignature, true));

                return xmlDoc.InnerXml;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in SignXml: {Message}", ex.Message);
                throw;
            }
        }

        private async Task<(string DocumentHash, byte[] PreparedPdf)> GetDocumentHashAsync(Stream inputStream, string userName, string signPos, int pageNo)
        {
            try
            {
                _logger.LogDebug("Processing PDF for hash, page: {PageNo}, position: {SignPos}", pageNo, signPos);
                if (signPos != "1" && signPos != "2")
                {
                    _logger.LogWarning("Invalid sign position: {SignPos}", signPos);
                    throw new ArgumentException("Sign position must be '1' (Left) or '2' (Right)");
                }

                inputStream.Position = 0;
                _logger.LogDebug("Creating PdfReader with input stream of length: {Length}, CanRead: {CanRead}", inputStream.Length, inputStream.CanRead);
                if (!inputStream.CanRead)
                {
                    _logger.LogError("Input PDF stream is not readable");
                    throw new InvalidOperationException("Input PDF stream is not readable");
                }

                using var pdfReader = new PdfReader(inputStream);
                using var tempOutputStream = new MemoryStream();
                var stampingProps = new StampingProperties().UseAppendMode();
                _logger.LogDebug("Creating PdfSigner");

                var signer = new PdfSigner(pdfReader, tempOutputStream, stampingProps);
                var pdfDoc = signer.GetDocument();
                _logger.LogDebug("PDF has {TotalPages} pages", pdfDoc.GetNumberOfPages());
                if (pageNo < 1 || pageNo > pdfDoc.GetNumberOfPages())
                {
                    _logger.LogWarning("Invalid page number: {PageNo}, total pages: {TotalPages}", pageNo, pdfDoc.GetNumberOfPages());
                    pdfReader.Close();
                    throw new ArgumentException($"Invalid page number: {pageNo}. PDF has {pdfDoc.GetNumberOfPages()} pages.");
                }

                float[] coordinates = FindTextCoordinates(pdfDoc, "ISSUING AUTHORITY", pageNo);
                float xPos, yPos, signatureWidth = 200f, signatureHeight = 50f;
                if (coordinates != null)
                {
                    _logger.LogDebug("Found 'ISSUING AUTHORITY' at coordinates: X={X}, Y={Y}", coordinates[0], coordinates[1]);
                    xPos = coordinates[0];
                    yPos = coordinates[1] + 10;
                }
                else
                {
                    _logger.LogWarning("Text 'ISSUING AUTHORITY' not found, using default position");
                    var page = pdfDoc.GetPage(pageNo);
                    var pageSize = page.GetPageSize();
                    float margin = 20f;
                    xPos = signPos == "2" ? pageSize.GetWidth() - signatureWidth - margin : margin;
                    yPos = margin;
                }

                var rect = new Rectangle(xPos, yPos, signatureWidth, signatureHeight);
                _logger.LogDebug("Signature rectangle: {Rect}", rect);

                var appearance = new SignatureFieldAppearance("Signature1")
                    .SetContent($"Signed By: {userName}\nDate: {DateTime.Now:yyyy-MM-dd}")
                    .SetFontSize(10f)
                    .SetInteractive(false);
                signer.SetFieldName("Signature1");
                signer.SetPageNumber(pageNo);
                signer.SetPageRect(rect);
                signer.SetReason("Document Approval");
                signer.SetLocation("India");
                signer.SetSignatureCreator(userName);
                signer.SetSignatureAppearance((SignatureFieldAppearance)appearance);

                var signatureField = signer.GetSignatureField();
                if (signatureField != null)
                {
                    signatureField.SetReuseAppearance(false);
                    _logger.LogDebug("Signature field configured: {FieldName}", signatureField.GetFieldName());
                }

                var external = new BlankSignatureContainer(PdfName.Adobe_PPKLite, PdfName.Adbe_pkcs7_detached);
                _logger.LogDebug("Preparing PDF with external container, estimated size: 16384");

                await Task.Run(() => signer.SignExternalContainer(external, 16384));

                var preparedPdf = tempOutputStream.ToArray();
                _logger.LogDebug("Prepared PDF bytes length: {Length}", preparedPdf.Length);

                var data = await external.GetDataAsync() ?? throw new InvalidOperationException("No hash data");
                _logger.LogDebug("Extracted data for hashing, length: {Length}", data.Length);
                using var sha256 = SHA256.Create();
                var hashBytes = sha256.ComputeHash(data);
                var hash = BitConverter.ToString(hashBytes).Replace("-", "").ToLower();
                _logger.LogInformation("Generated document hash: {Hash}", hash);

                return (hash, preparedPdf);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in GetDocumentHashAsync: {Message}", ex.Message);
                throw;
            }
        }

        private void EmbedSignature(string xmlResponse, Stream pdfStream)
        {
            try
            {
                if (!pdfStream.CanRead || !pdfStream.CanWrite)
                {
                    _logger.LogError("PDF stream is not readable or writable.");
                    throw new InvalidOperationException("PDF stream is not readable or writable.");
                }

                var xmlDoc = new XmlDocument();
                xmlDoc.LoadXml(xmlResponse);
                var signatureNode = xmlDoc.SelectSingleNode("//DocSignature");
                if (signatureNode == null)
                    throw new InvalidOperationException("No DocSignature found in response XML.");

                var sigBytes = Convert.FromBase64String(signatureNode.InnerText);
                _logger.LogDebug("Signature bytes length: {Length}", sigBytes.Length);

                pdfStream.Position = 0;
                using (MemoryStream inputStream = new MemoryStream())
                {
                    pdfStream.CopyTo(inputStream);
                    inputStream.Position = 0;

                    using (var outputStream = new MemoryStream())
                    using (var reader = new PdfReader(inputStream))
                    using (var writer = new PdfWriter(outputStream))
                    {
                        reader.SetCloseStream(false);
                        writer.SetCloseStream(false);

                        using (var pdfDoc = new PdfDocument(reader, writer))
                        {
                            var external = new ExternalSignatureContainer(sigBytes);
                            PdfSigner.SignDeferred(pdfDoc, "Signature1", outputStream, external);
                        }

                        outputStream.Position = 0;
                        pdfStream.SetLength(0);
                        outputStream.CopyTo(pdfStream);
                        pdfStream.Position = 0;
                    }
                }

                _logger.LogInformation("Successfully embedded signature into PDF stream.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to embed signature: {Message}", ex.Message);
                throw new InvalidOperationException($"Failed to embed signature: {ex.Message}", ex);
            }
        }

        private float[] FindTextCoordinates(PdfDocument pdfDoc, string targetText, int pageNumber)
        {
            var page = pdfDoc.GetPage(pageNumber);
            if (page == null)
            {
                _logger.LogWarning("Page {PageNumber} not found in PDF.", pageNumber);
                return null!;
            }

            var rect = PdfTextLocator.GetTextCoordinates(page, targetText);
            if (rect != null)
            {
                _logger.LogDebug("Found '{TargetText}' at X={X}, Y={Y}", targetText, rect.GetX(), rect.GetY());
                return new float[] { rect.GetX(), rect.GetY() };
            }

            _logger.LogWarning("Text '{TargetText}' not found on page {PageNumber}", targetText, pageNumber);
            return null!;
        }

        private async Task<StatusCountsSnapshot> GetOrCreateSnapshotForOfficer(
    int serviceId, string accessLevel, int accessCode, int divisionCode,
    string takenBy, string dataType)
        {
            var existing = await dbcontext.StatusCountsSnapshot
                .FirstOrDefaultAsync(s =>
                    s.PServiceId == serviceId &&
                    s.PAccessLevel == accessLevel &&
                    s.PAccessCode == accessCode &&
                    s.PDivisionCode == divisionCode &&
                    s.PTakenBy == takenBy &&
                    s.PDataType == dataType);

            if (existing != null) return existing;

            var snap = new StatusCountsSnapshot
            {
                CapturedAt = DateTime.UtcNow,
                PAccessLevel = accessLevel,
                PAccessCode = accessCode,
                PServiceId = serviceId,
                PTakenBy = takenBy,
                PDivisionCode = divisionCode,
                PDataType = dataType,
                // all counts default to 0
            };
            dbcontext.StatusCountsSnapshot.Add(snap);
            return snap;
        }

        private int GetAccessCodeForLevel(string accessLevel, JObject formDetailsObj)
        {
            if (accessLevel == "Tehsil")
            {
                string? val = GetFormFieldValue(formDetailsObj, "Tehsil");
                if (!string.IsNullOrEmpty(val) && int.TryParse(val, out int id)) return id;
            }
            else if (accessLevel == "District")
            {
                string? val = GetFormFieldValue(formDetailsObj, "District");
                if (!string.IsNullOrEmpty(val) && int.TryParse(val, out int id)) return id;
            }
            return 0;
        }

        private int GetDivisionForLevelAndCode(string accessLevel, int accessCode)
        {
            if (accessLevel == "Tehsil")
            {
                var tehsil = dbcontext.Tehsil.FirstOrDefault(t => t.Tehsilid == accessCode);
                if (tehsil != null)
                {
                    var district = dbcontext.District.FirstOrDefault(d => d.Districtid == tehsil.Districtid);
                    return district?.Division ?? 0;
                }
            }
            else if (accessLevel == "District")
            {
                var district = dbcontext.District.FirstOrDefault(d => d.Districtid == accessCode);
                return district?.Division ?? 0;
            }
            else if (accessLevel == "Division")
            {
                return accessCode;
            }
            return 0;
        }

        private class PdfTextLocator : LocationTextExtractionStrategy
        {
            public string TextToSearchFor { get; set; }
            public List<TextChunk> ResultCoordinates { get; set; }

            public static Rectangle GetTextCoordinates(PdfPage page, string s)
            {
                PdfTextLocator strat = new PdfTextLocator(s);
                PdfTextExtractor.GetTextFromPage(page, strat);
                foreach (TextChunk c in strat.ResultCoordinates)
                {
                    if (c.Text == s)
                        return c.ResultCoordinates;
                }
                return null!;
            }

            public PdfTextLocator(string textToSearchFor)
            {
                this.TextToSearchFor = textToSearchFor;
                ResultCoordinates = new List<TextChunk>();
            }

            public override void EventOccurred(IEventData data, EventType type)
            {
                if (!type.Equals(EventType.RENDER_TEXT))
                    return;

                TextRenderInfo renderInfo = (TextRenderInfo)data;
                IList<TextRenderInfo> text = renderInfo.GetCharacterRenderInfos();
                for (int i = 0; i < text.Count; i++)
                {
                    if (text[i].GetText() == TextToSearchFor[0].ToString())
                    {
                        string word = "";
                        for (int j = i; j < i + TextToSearchFor.Length && j < text.Count; j++)
                        {
                            word = word + text[j].GetText();
                        }

                        if (word == TextToSearchFor)
                        {
                            float startX = text[i].GetBaseline().GetStartPoint().Get(0);
                            float startY = text[i].GetBaseline().GetStartPoint().Get(1);
                            float endX = text[i + TextToSearchFor.Length - 1].GetAscentLine().GetEndPoint().Get(0);
                            float endY = text[i + TextToSearchFor.Length - 1].GetAscentLine().GetEndPoint().Get(1);
                            Rectangle rect = new Rectangle(startX, startY, endX - startX, endY - startY);
                            ResultCoordinates.Add(new TextChunk(word, rect));
                        }
                    }
                }
            }
        }

        private class TextChunk
        {
            public string Text { get; set; }
            public Rectangle ResultCoordinates { get; set; }

            public TextChunk(string s, Rectangle r)
            {
                Text = s;
                ResultCoordinates = r;
            }
        }

        private bool CheckESignUserName(string xml)
        {
            try
            {
                var xmlDoc = new XmlDocument();
                xmlDoc.LoadXml(xml);
                var userCertNode = xmlDoc.SelectSingleNode("//UserX509Certificate");
                if (userCertNode == null || string.IsNullOrEmpty(userCertNode.InnerText))
                {
                    _logger.LogWarning("No UserX509Certificate found in XML response");
                    throw new InvalidOperationException("No certificate found in XML response");
                }

                var txnNode = xmlDoc.SelectSingleNode("/EsignResp/@txn");
                var txnId = txnNode?.Value ?? "";
                if (string.IsNullOrEmpty(txnId))
                {
                    _logger.LogWarning("No transaction ID found in XML response");
                    throw new InvalidOperationException("No transaction ID found in XML response");
                }
                _logger.LogDebug("Extracted transaction ID: {TxnId}", txnId);

                string expectedUserName = "Person One Name";
                _logger.LogDebug("Retrieved username for txn {TxnId}: {ExpectedUserName}", txnId, expectedUserName);

                var userCertBytes = Convert.FromBase64String(userCertNode.InnerText);
                using var cert = X509CertificateLoader.LoadPkcs12(userCertBytes, null, X509KeyStorageFlags.EphemeralKeySet);

                _logger.LogInformation("Certificate details: Subject={Subject}, FriendlyName={FriendlyName}, Thumbprint={Thumbprint}, Issuer={Issuer}",
                    cert.Subject, cert.FriendlyName, cert.Thumbprint, cert.Issuer);

                string certCN = cert.Subject.Split(new[] { ", " }, StringSplitOptions.None)
                    .FirstOrDefault(part => part.StartsWith("CN="))?.Substring(3) ?? "";
                _logger.LogDebug("Extracted CN from certificate: {CertCN}", certCN);

                var nameParts = expectedUserName.ToLower().Split(' ', StringSplitOptions.RemoveEmptyEntries);
                bool isValidCN = !string.IsNullOrEmpty(certCN) && nameParts.Any(part => certCN.ToLower().Contains(part));
                _logger.LogDebug("CN validation result: isValidCN={IsValidCN}, CN={CertCN}, Expected={ExpectedUserName}", isValidCN, certCN, expectedUserName);
                if (!isValidCN)
                {
                    _logger.LogWarning("Certificate CN '{CertCN}' does not match expected username '{ExpectedUserName}'", certCN, expectedUserName);
                }

                string expectedIssuer = "Test C-DAC Sub CA for eKYC 2022";
                bool isValidIssuer = !string.IsNullOrEmpty(cert.Issuer) && cert.Issuer.Contains(expectedIssuer, StringComparison.OrdinalIgnoreCase);
                _logger.LogDebug("Issuer validation result: isValidIssuer={IsValidIssuer}, Issuer={Issuer}, Expected={ExpectedIssuer}", isValidIssuer, cert.Issuer, expectedIssuer);
                if (!isValidIssuer)
                {
                    _logger.LogWarning("Certificate issuer '{Issuer}' does not contain expected '{ExpectedIssuer}'", cert.Issuer, expectedIssuer);
                }

                bool isValid = isValidCN && isValidIssuer;
                if (isValid)
                {
                    _logger.LogInformation("Certificate validation successful for user: {ExpectedUserName}", expectedUserName);
                }
                else
                {
                    _logger.LogWarning("Certificate validation failed: CNMatch={IsValidCN}, IssuerValid={IsValidIssuer}", isValidCN, isValidIssuer);
                    throw new InvalidOperationException($"Certificate validation failed: CN='{certCN}', Expected='{expectedUserName}', Issuer='{cert.Issuer}'");
                }

                return isValid;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to verify user certificate: {Message}", ex.Message);
                throw new InvalidOperationException($"Failed to verify user certificate: {ex.Message}", ex);
            }
        }

        private class BlankSignatureContainer : IExternalSignatureContainer
        {
            private readonly PdfName _filter;
            private readonly PdfName _subFilter;
            private byte[]? _data;

            public BlankSignatureContainer(PdfName filter, PdfName subFilter)
            {
                _filter = filter;
                _subFilter = subFilter;
            }

            public async Task<byte[]?> GetDataAsync()
            {
                return await Task.FromResult(_data);
            }

            public byte[] Sign(Stream data)
            {
                using var memoryStream = new MemoryStream();
                data.CopyTo(memoryStream);
                _data = memoryStream.ToArray();
                return [];
            }

            public void ModifySigningDictionary(PdfDictionary signDic)
            {
                signDic.Put(PdfName.Filter, _filter);
                signDic.Put(PdfName.SubFilter, _subFilter);
            }
        }

        private class ExternalSignatureContainer : IExternalSignatureContainer
        {
            private readonly byte[] _signature;

            public ExternalSignatureContainer(byte[] signature)
            {
                _signature = signature;
            }

            public async Task<byte[]?> GetDataAsync()
            {
                return await Task.FromResult<byte[]?>(null);
            }

            public byte[] Sign(Stream data)
            {
                return _signature;
            }

            public void ModifySigningDictionary(PdfDictionary signDic)
            {
                signDic.Put(PdfName.Filter, PdfName.Adobe_PPKLite);
                signDic.Put(PdfName.SubFilter, PdfName.Adbe_pkcs7_detached);
            }
        }
    }
}
