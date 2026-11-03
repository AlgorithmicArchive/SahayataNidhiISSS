using System.Data;
using System.Dynamic;
using System.Globalization;
using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Npgsql;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using SahayataNidhi.Models.Entities;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using NpgsqlTypes;

namespace SahayataNidhi.Controllers
{
    public partial class BaseController
    {
        public class Report
        {
            [Key]
            public int Id { get; set; }
            public string? Name { get; set; }
            public string? Description { get; set; }
            public string? TableName { get; set; }

            [Column(TypeName = "jsonb")]
            public string? Columns { get; set; }

            [Column(TypeName = "jsonb")]
            public string? Filters { get; set; }

            public DateTime CreatedAt { get; set; }
            public string? CreatedBy { get; set; }
        }

        public class ReportColumn
        {
            public string? Name { get; set; }
            public string? JsonPath { get; set; }
            public string? Display { get; set; }
            public string? Type { get; set; }
        }

        public class ReportFilter
        {
            public string? Field { get; set; }
            public string? JsonPath { get; set; }
            public string? Operator { get; set; }
            public object? Value { get; set; }
        }

        public string GetOfficerAreaForHistory(string accessLevel, int? accessCode) => _referenceData.GetOfficerAreaForHistory(accessLevel, accessCode);

        public string GetOfficerArea(string accessLevel, dynamic formDetails) => _referenceData.GetOfficerArea(accessLevel, formDetails);

        private static DateTime? SafeParseDate(string? dateString)
        {
            if (string.IsNullOrWhiteSpace(dateString))
                return null;

            dateString = dateString.Trim();

            var formats = new[]
            {
                "dd MMM yyyy hh:mm:ss tt",
                "dd-MM-yyyy HH:mm:ss",
                "dd-MM-yyyy hh:mm:ss tt",
                "dd/MM/yyyy HH:mm:ss",
                "yyyy-MM-dd HH:mm:ss",
                "dd MMM yyyy HH:mm:ss",
            };

            if (DateTime.TryParseExact(
                    dateString,
                    formats,
                    CultureInfo.InvariantCulture,
                    DateTimeStyles.None,
                    out DateTime parsed))
            {
                return parsed;
            }

            if (DateTime.TryParse(dateString, CultureInfo.InvariantCulture, DateTimeStyles.None, out parsed))
            {
                return parsed;
            }

            return null;
        }

        private class ServiceLocationFields
        {
            public bool HasDistrict { get; set; }
            public bool HasChildLocation { get; set; }
            public string ChildLocationHeader { get; set; } = "Tehsil Name";
        }

        private ServiceLocationFields ResolveServiceLocationFields(string? formElementJson)
        {
            var result = new ServiceLocationFields();

            if (string.IsNullOrWhiteSpace(formElementJson))
                return result;

            try
            {
                var sections = JArray.Parse(formElementJson);

                // Only examine the Location section — address sections (Present/Permanent
                // Address) also contain Tehsil/Block fields that reflect the *applicant's*
                // address, not the officer's operational area level.
                var locationSection = sections.FirstOrDefault(s =>
                    (s["section"]?.ToString() ?? "").Equals("Location", StringComparison.OrdinalIgnoreCase));

                var fields = locationSection?["fields"] as JArray;
                if (fields == null)
                    return result;

                foreach (var field in fields)
                {
                    var type = field?["type"]?.ToString();
                    if (type != "select")
                        continue;

                    var name = field?["name"]?.ToString() ?? "";
                    var label = field?["label"]?.ToString() ?? "";
                    var valueDependentOn = field?["valueDependentOn"]?.ToString() ?? "";
                    var dependentOn = field?["dependentOn"]?.ToString() ?? "";

                    bool isDistrict = name.Equals("District", StringComparison.OrdinalIgnoreCase)
                                      || name.IndexOf("District", StringComparison.OrdinalIgnoreCase) >= 0;

                    bool dependsOnDistrict = valueDependentOn.Equals("District", StringComparison.OrdinalIgnoreCase)
                                             || dependentOn.Equals("District", StringComparison.OrdinalIgnoreCase);

                    bool isChildLocation = !isDistrict && dependsOnDistrict;

                    if (isDistrict)
                        result.HasDistrict = true;

                    if (isChildLocation)
                    {
                        result.HasChildLocation = true;
                        result.ChildLocationHeader = BuildChildLocationHeader(name, label);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to resolve service location fields from form element.");
            }

            return result;
        }


        private static string BuildChildLocationHeader(string name, string label)
        {
            // Prefer the field's own label (e.g. "Tehsil Social Welfare Office (TSWO)")
            // trimmed of office-like suffixes, otherwise derive from the field name.
            if (!string.IsNullOrWhiteSpace(label))
            {
                // Use the base location word for a clean column header.
                foreach (var token in new[] { "Tehsil", "Block", "Muncipality", "Municipality", "Halqa", "Ward", "Village" })
                {
                    if (label.IndexOf(token, StringComparison.OrdinalIgnoreCase) >= 0)
                        return token + " Name";
                }
            }
            if (!string.IsNullOrWhiteSpace(name))
            {
                foreach (var token in new[] { "Tehsil", "Block", "Muncipality", "Municipality", "Halqa", "Ward", "Village" })
                {
                    if (name.IndexOf(token, StringComparison.OrdinalIgnoreCase) >= 0)
                        return token + " Name";
                }
            }
            return "Tehsil Name";
        }



        public string GetApplications(string? scope, string? columnOrder, string? columnVisibility, int Serviceid, string? type, int pageIndex = 0, int pageSize = 10, string dataType = "new")
        {
            var officerDetails = GetOfficerDetails();

            var roleParam = new NpgsqlParameter("@role", officerDetails!.Role);
            var accessLevelParam = new NpgsqlParameter("@accesslevel", officerDetails.AccessLevel);
            var accessCodeParam = new NpgsqlParameter("@accesscode", officerDetails.AccessCode ?? (object)DBNull.Value);
            var applicationStatusParam = new NpgsqlParameter("@applicationstatus", (object?)type ?? DBNull.Value);
            var serviceIdParam = new NpgsqlParameter("@serviceid", Serviceid);
            var pageIndexParam = new NpgsqlParameter("@pageindex", pageIndex);
            var pageSizeParam = new NpgsqlParameter("@pagesize", pageSize);
            var isPaginatedParam = new NpgsqlParameter("@ispaginated", scope == "InView");
            var dataTypeParam = new NpgsqlParameter("@datatype", dataType != "new" ? dataType : (object)DBNull.Value);
            var divisionCodeParam = new NpgsqlParameter("@division_code",
                officerDetails.AccessLevel == "Division"
                    ? officerDetails.AccessCode ?? (object)DBNull.Value
                    : (object)DBNull.Value);

            List<OfficerApplicationDto> response;

            var service = dbcontext.Services.FirstOrDefault(s => s.Serviceid == Serviceid);
            if (service == null) return JsonConvert.SerializeObject(new { data = new List<dynamic>(), columns = new List<dynamic>(), poolData = new List<dynamic>(), totalRecords = 0 });

            var workflow = JsonConvert.DeserializeObject<List<dynamic>>(service.Officereditablefield!);
            dynamic authorities = workflow!.FirstOrDefault(p => p.designation == officerDetails.Role)!;

            // ================= SERVICE LOCATION / FORM FLAGS =================
            var serviceLocation = ResolveServiceLocationFields(service.Formelement);
            bool serviceHasDistrict = serviceLocation.HasDistrict;
            bool serviceHasChildLocation = serviceLocation.HasChildLocation;
            string childLocationHeader = serviceLocation.ChildLocationHeader;

            bool serviceHasRationCard = !string.IsNullOrWhiteSpace(service.Formelement)
                && service.Formelement.Contains("RationCardNumber", StringComparison.OrdinalIgnoreCase);

            // ================= FETCH =================
            if (type == "shifted")
            {
                var shiftedParameters = new[]
                {
            roleParam,
            accessLevelParam,
            accessCodeParam,
            serviceIdParam
        };

                response = dbcontext.Database
                    .SqlQueryRaw<OfficerApplicationDto>(
                        "SELECT * FROM get_shifted_applications(@role, @accesslevel, @accesscode, @serviceid)",
                        shiftedParameters)
                    .ToList();
            }
            else
            {
                var parameters = new[]
                {
            roleParam,
            accessLevelParam,
            accessCodeParam,
            applicationStatusParam,
            serviceIdParam,
            pageIndexParam,
            pageSizeParam,
            isPaginatedParam,
            dataTypeParam,
            divisionCodeParam
        };

                response = dbcontext.Database
                    .SqlQueryRaw<OfficerApplicationDto>(
                        "SELECT * FROM get_applications_for_officer(@role, @accesslevel, @accesscode, @applicationstatus, @serviceid, @pageindex, @pagesize, @ispaginated, @datatype, @division_code)",
                        parameters)
                    .ToList();
            }

            int totalRecords = type == "shifted" ? response.Count : 0;
            if (type != "shifted" && scope == "InView")
            {
                var countParams = new[]
                {
            roleParam,
            accessLevelParam,
            accessCodeParam,
            applicationStatusParam,
            serviceIdParam,
            new NpgsqlParameter("@pageindex", (object)0),
            new NpgsqlParameter("@pagesize", 1000000),
            new NpgsqlParameter("@ispaginated", false),
            dataTypeParam,
            divisionCodeParam
        };

                totalRecords = dbcontext.Database
                    .SqlQueryRaw<OfficerApplicationDto>(
                        "SELECT * FROM get_applications_for_officer(@role, @accesslevel, @accesscode, @applicationstatus, @serviceid, @pageindex, @pagesize, @ispaginated, @datatype, @division_code)",
                        countParams)
                    .Count();
            }

            var orderedColumns = JsonConvert.DeserializeObject<List<string>>(columnOrder ?? "[]")!;
            var visibility = JsonConvert.DeserializeObject<Dictionary<string, bool>>(columnVisibility ?? "{}")!;

            // ================= BASE COLUMNS (mirrors File 1) =================
            List<dynamic> baseColumns = new List<dynamic>
    {
        new { accessorKey = "sno",             header = "S.No" },
        new { accessorKey = "referenceNumber", header = "Reference Number" },
        new { accessorKey = "applicantName",   header = "Applicant Name" },
        new { accessorKey = "mobileNumber",    header = "Mobile Number" }
    };

            if (serviceHasRationCard)
                baseColumns.Add(new { accessorKey = "rationCardNumber", header = "Ration Card Number" });

            baseColumns.Add(new { accessorKey = "serviceName", header = "Service Name" });
            baseColumns.Add(new { accessorKey = "currentlyWith", header = "Currently With" });
            baseColumns.Add(new { accessorKey = "status", header = "Application Status" });
            baseColumns.Add(new { accessorKey = "officerRemarks", header = "Officer Remarks" });
            baseColumns.Add(new { accessorKey = "submissionDate", header = "Citizen Submission Date" });
            baseColumns.Add(new { accessorKey = "actionTakenOn", header = "Received On" });
            baseColumns.Add(new { accessorKey = "customActions", header = "Actions" });

            if (officerDetails.AccessLevel == "State")
            {
                baseColumns.Insert(1, new { accessorKey = "divisionName", header = "Division Name" });
                if (serviceHasDistrict)
                    baseColumns.Insert(2, new { accessorKey = "districtName", header = "District Name" });
            }
            else if (officerDetails.AccessLevel == "Division")
            {
                if (serviceHasDistrict)
                    baseColumns.Insert(1, new { accessorKey = "districtName", header = "District Name" });
                if (serviceHasChildLocation)
                    baseColumns.Insert(2, new { accessorKey = "tehsilName", header = childLocationHeader });
            }
            else if (officerDetails.AccessLevel == "District")
            {
                if (serviceHasChildLocation)
                    baseColumns.Insert(1, new { accessorKey = "tehsilName", header = childLocationHeader });
            }

            // ================= COLUMN FILTERING =================
            List<dynamic> filteredColumns = new List<dynamic>();
            if (orderedColumns.Count > 0)
            {
                foreach (var key in orderedColumns)
                {
                    if (visibility.TryGetValue(key, out var isVisible) && isVisible)
                    {
                        var col = baseColumns.FirstOrDefault(c => c.accessorKey == key);
                        if (col != null) filteredColumns.Add(col);
                    }
                }
            }
            else
            {
                filteredColumns = baseColumns
                    .Where(c => !visibility.TryGetValue(c.accessorKey, out bool isVisible) || isVisible)
                    .ToList();
            }

            List<dynamic> data = new List<dynamic>();
            List<dynamic> poolData = new List<dynamic>();

            var poolList = dbcontext.Pool.FirstOrDefault(p =>
                p.Serviceid == Serviceid &&
                p.Accesslevel == officerDetails.AccessLevel &&
                p.Accesscode == officerDetails.AccessCode
            );

            var pool = poolList != null && !string.IsNullOrWhiteSpace(poolList.List)
                ? JsonConvert.DeserializeObject<List<string>>(poolList.List)
                : new List<string>();

            int snoCounter = (pageIndex * pageSize) + 1;

            foreach (var details in response)
            {
                var formDetails = JsonConvert.DeserializeObject<dynamic>(details.FormDetails ?? "{}");
                var officers = JsonConvert.DeserializeObject<JArray>(details.WorkFlow ?? "[]");
                var currentPlayer = details.CurrentPlayer ?? 0;

                var latestHistory = dbcontext.Actionhistory
                    .Where(h => h.Referencenumber == details.ReferenceNumber)
                    .AsEnumerable()
                    .OrderByDescending(h => SafeParseDate(h.Actiontakendate) ?? DateTime.MinValue)
                    .FirstOrDefault();

                var parsedDate = latestHistory != null
                    ? SafeParseDate(latestHistory.Actiontakendate) ?? DateTime.MinValue
                    : DateTime.MinValue;

                // ---------- DERIVE CURRENT OFFICER (mirrors File 1) ----------
                string officerDesignation = "Unknown";
                string officerAccessLevel = "Unknown";
                string officerStatus = "Unknown";
                string officerArea = "Unknown";

                if (officers != null && officers.Count > 0)
                {
                    var currentOfficerObj = currentPlayer >= 0 && currentPlayer < officers.Count
                        ? officers[currentPlayer]
                        : officers[0];

                    if (currentOfficerObj != null)
                    {
                        officerDesignation = currentOfficerObj["designation"]?.ToString() ?? "Unknown";
                        officerAccessLevel = currentOfficerObj["accessLevel"]?.ToString() ?? "Unknown";
                        officerStatus = currentOfficerObj["status"]?.ToString() ?? "Unknown";
                    }
                    officerArea = GetOfficerArea(officerAccessLevel, formDetails);
                }

                // ---------- RATION CARD ----------
                string rationCardNumber = string.Empty;
                if (serviceHasRationCard)
                {
                    try
                    {
                        var rcStr = GetFieldValue("RationCardNumber", formDetails)?.ToString();
                        if (!string.IsNullOrWhiteSpace(rcStr)) rationCardNumber = rcStr!;
                    }
                    catch { /* field missing on this row */ }
                }

                // ---------- DERIVED STATUS ----------
                var excludedStatuses = new[] { "Rejected", "Sanctioned", "Initiated" };
                bool IsError = excludedStatuses.Contains(details.Status ?? "");

                string Status = IsError
                    ? (officerStatus == "returntoedit"
                        ? "Pending With Citizen"
                        : (!string.IsNullOrEmpty(officerStatus)
                            ? char.ToUpper(officerStatus[0]) + officerStatus.Substring(1)
                            : "Unknown"))
                    : details.Status ?? "Unknown";

                // ---------- CUSTOM ACTIONS (unchanged from File 2) ----------
                var customActions = new List<dynamic>();
                if (type == "forwarded" || type == "returned" || type == "returntoedit")
                {
                    dynamic currentOfficer = officers!.FirstOrDefault(o => (string)o["designation"]! == officerDetails.Role)!;
                    if (currentOfficer?["canPull"] != null && (bool)currentOfficer!["canPull"]!)
                    {
                        customActions.Add(new { type = "Pull", tooltip = "Pull", color = "#F0C38E", actionFunction = "pullApplication" });
                    }
                }

                var item = new ExpandoObject() as IDictionary<string, object?>;

                foreach (var col in filteredColumns)
                {
                    switch ((string)col.accessorKey)
                    {
                        case "sno": item["sno"] = snoCounter++; break;
                        case "referenceNumber": item["referenceNumber"] = details.ReferenceNumber; break;
                        case "applicantName": item["applicantName"] = GetFieldValue("ApplicantName", formDetails); break;
                        case "mobileNumber": item["mobileNumber"] = GetFieldValue("MobileNumber", formDetails); break;
                        case "rationCardNumber": item["rationCardNumber"] = rationCardNumber; break;
                        case "serviceName": item["serviceName"] = dbcontext.Services.FirstOrDefault(s => s.Serviceid == details.ServiceId)?.Servicename; break;
                        case "currentlyWith":
                            item["currentlyWith"] = officerStatus == "returntoedit"
                                                                            ? "Citizen"
                                                                            : $"{officerDesignation} ({officerArea})"; break;
                        case "status": item["status"] = Status; break;
                        case "officerRemarks": item["officerRemarks"] = latestHistory?.Remarks ?? string.Empty; break;
                        case "submissionDate": item["submissionDate"] = details.Created_at ?? "N/A"; break;
                        case "actionTakenOn": item["actionTakenOn"] = parsedDate == DateTime.MinValue ? null : parsedDate.ToString("dd MMM yyyy hh:mm:ss tt"); break;
                        case "customActions": item["customActions"] = customActions; break;

                        // Access-level location fields — now from DTO
                        case "divisionName": item["divisionName"] = details.DivisionName ?? "N/A"; break;
                        case "districtName": item["districtName"] = details.DistrictName ?? "N/A"; break;
                        case "tehsilName": item["tehsilName"] = details.TehsilName ?? "N/A"; break;
                    }
                }

                if (type == "shifted")
                    data.Add(item);
                else
                    (pool!.Contains(details.ReferenceNumber!) && type == "pending" ? poolData : data).Add(item);
            }

            var result = Json(new
            {
                data,
                columns = filteredColumns,
                poolData,
                totalRecords,
                canSanction = authorities?.canSanction ?? false
            });

            return JsonConvert.SerializeObject(result);
        }
        public async Task<string> GetApplicationHistory(string? scope, string? columnOrder, string? columnVisibility, string ApplicationId, int page, int size)
        {
            var application = await dbcontext.CitizenApplications.FirstOrDefaultAsync(ca => ca.Referencenumber == ApplicationId);

            var players = JsonConvert.DeserializeObject<JArray>(application!.Workflow!);
            var formDetails = JsonConvert.DeserializeObject<dynamic>(application.Formdetails!);
            int currentPlayerIndex = (int)application.Currentplayer!;
            var currentPlayer = players?.FirstOrDefault(o => (int)o["playerId"]! == currentPlayerIndex);

            var fullHistory = await dbcontext.Actionhistory
                .Where(ah => ah.Referencenumber == ApplicationId)
                .ToListAsync();

            var history = (scope == "InView")
                ? fullHistory.Skip(page * size).Take(size).ToList()
                : fullHistory;

            List<dynamic> columns =
            [
                new { accessorKey = "sno", header = "S.No" },
                new { accessorKey = "actionTaker", header = "Action Taker" },
                new { accessorKey = "actionTaken", header = "Action Taken" },
                new { accessorKey = "remarks", header = "Remarks" },
                new { accessorKey = "actionTakenOn", header = "Action Taken On" },
            ];

            List<string> orderedColumns = JsonConvert.DeserializeObject<List<string>>(columnOrder!)!;
            Dictionary<string, bool> visibility = JsonConvert.DeserializeObject<Dictionary<string, bool>>(columnVisibility!)!;

            var filteredColumns = orderedColumns
                .Where(key => visibility.TryGetValue(key, out var isVisible) && isVisible)
                .Select(key =>
                    columns.FirstOrDefault(col =>
                        col.GetType().GetProperty("accessorKey")?.GetValue(col)?.ToString() == key
                    )
                )
                .Where(col => col != null)
                .ToList();

            List<dynamic> data = [];
            int index = 1;

            foreach (var his in history)
            {
                var officerArea = GetOfficerAreaForHistory(his.Locationlevel!, his.Locationvalue);

                dynamic item = new ExpandoObject();
                var itemDict = (IDictionary<string, object?>)item;

                itemDict["sno"] = index;
                itemDict["actionTaker"] = his.Actiontaker != "Citizen"
                    ? $"{his.Actiontaker} {officerArea}"
                    : his.Actiontaker;
                itemDict["actionTaken"] = his.Actiontaken == "ReturnToCitizen"
                    ? "Returned to citizen for correction"
                    : his.Actiontaken;
                itemDict["remarks"] = his.Remarks;
                itemDict["actionTakenOn"] = his.Actiontakendate;

                data.Add(item);
                index++;
            }

            if ((string)currentPlayer!["status"]! == "pending")
            {
                string designation = (string)currentPlayer["designation"]!;
                string accessLevel = (string)currentPlayer["accessLevel"]!;
                string officerArea = GetOfficerArea(accessLevel, formDetails);

                dynamic pendingItem = new ExpandoObject();
                var pendingDict = (IDictionary<string, object?>)pendingItem;

                pendingDict["sno"] = index;
                pendingDict["actionTaker"] = $"{designation} {officerArea}";
                pendingDict["actionTaken"] = "pending";
                pendingDict["remarks"] = "";
                pendingDict["actionTakenOn"] = "";

                data.Add(pendingItem);
            }

            var result = Json(new
            {
                data,
                columns = filteredColumns,
            });

            return JsonConvert.SerializeObject(result);
        }

        public string GetInitiatedApplications(string? scope, string? columnOrder, string? columnVisibility, int pageIndex = 0, int pageSize = 10)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

            if (!int.TryParse(userIdClaim, out int userId))
            {
                return JsonConvert.SerializeObject(new { data = new List<dynamic>(), columns = new List<dynamic>(), totalRecords = 0 });
            }

            var applications = dbcontext.CitizenApplications
                .FromSqlRaw("SELECT * FROM get_initiated_applications({0}, {1}, {2}, {3})",
                    userId, pageIndex, pageSize, scope == "InView")
                .ToList();

            int totalRecords = 0;
            if (scope == "InView")
            {
                totalRecords = dbcontext.CitizenApplications
                    .FromSqlRaw("SELECT * FROM get_initiated_applications({0}, 0, 1000000, false)", userId)
                    .Count();
            }
            else
            {
                totalRecords = applications.Count;
            }

            var sortedApplications = applications.ToList();

            var pagedApplications = (scope == "InView")
                ? [.. sortedApplications.Skip(pageIndex * pageSize).Take(pageSize)]
                : sortedApplications;

            var columns = new List<dynamic>
            {
                new { accessorKey = "sno", header = "S.No" },
                new { accessorKey = "serviceName", header = "Service Name" },
                new { accessorKey = "referenceNumber", header = "Reference Number" },
                new { accessorKey = "applicantName", header = "Applicant Name" },
                new { accessorKey = "currentlyWith", header = "Currently With" },
                new { accessorKey = "submissionDate", header = "Submission Date" },
                new { accessorKey = "status", header = "Status" }
            };

            List<string> orderedColumns = JsonConvert.DeserializeObject<List<string>>(columnOrder!)!;
            Dictionary<string, bool> visibility = JsonConvert.DeserializeObject<Dictionary<string, bool>>(columnVisibility!)!;

            var filteredColumns = orderedColumns
                .Where(key => visibility.TryGetValue(key, out var isVisible) && isVisible)
                .Select(key =>
                    columns.FirstOrDefault(col =>
                        col.GetType().GetProperty("accessorKey")?.GetValue(col)?.ToString() == key
                    )
                )
                .Where(col => col != null)
                .ToList();

            var actionMap = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                { "pending", "Pending" },
                { "forwarded", "Forwarded" },
                { "sanctioned", "Sanctioned" },
                { "returned", "Returned" },
                { "rejected", "Rejected" },
                { "returntoedit", "Returned to citizen for correction" },
                { "Deposited", "Inserted to Bank File" },
                { "Dispatched", "Payment Under Process" },
                { "Disbursed", "Payment Disbursed" },
                { "Failure", "Payment Failed" }
            };

            var data = new List<dynamic>();
            int index = 0;

            foreach (var application in pagedApplications)
            {
                var formDetails = JsonConvert.DeserializeObject<dynamic>(application.Formdetails!);
                var officers = JsonConvert.DeserializeObject<JArray>(application.Workflow!);
                var currentPlayer = application.Currentplayer;
                string officerDesignation = (string)officers![currentPlayer!]!["designation"]!;
                string offierAccessLevel = (string)officers![currentPlayer!]!["accessLevel"]!;
                string officerStatus = (string)officers![currentPlayer!]!["status"]!;
                string officerArea = GetOfficerArea(offierAccessLevel, formDetails);

                string serviceName = dbcontext.Services
                    .FirstOrDefault(s => s.Serviceid == application.Serviceid)?
                    .Servicename ?? "Unknown";

                dynamic row = new ExpandoObject();
                var rowDict = (IDictionary<string, object?>)row;

                var visibleKeys = filteredColumns
                    .Select(col => col!.GetType().GetProperty("accessorKey")?.GetValue(col)?.ToString())
                    .Where(key => !string.IsNullOrEmpty(key))
                    .ToHashSet();

                if (visibleKeys.Contains("sno"))
                    rowDict["sno"] = (pageIndex * pageSize) + index + 1;

                if (visibleKeys.Contains("serviceName"))
                    rowDict["serviceName"] = serviceName;

                if (visibleKeys.Contains("referenceNumber"))
                    rowDict["referenceNumber"] = application.Referencenumber;

                if (visibleKeys.Contains("applicantName"))
                    rowDict["applicantName"] = GetFieldValue("ApplicantName", formDetails);

                if (visibleKeys.Contains("currentlyWith"))
                    rowDict["currentlyWith"] = $"{officerDesignation} {officerArea}";

                if (visibleKeys.Contains("submissionDate"))
                    rowDict["submissionDate"] = application.CreatedAt;

                if (visibleKeys.Contains("status"))
                    rowDict["status"] = actionMap.TryGetValue(officerStatus!, out var label) ? label : officerStatus;

                data.Add(row);
                index++;
            }

            var result = Json(new
            {
                data,
                columns = filteredColumns,
                totalRecords,
            });

            return JsonConvert.SerializeObject(result);
        }

        // ═══════════════════════════════════════════════════════════════════════
        //  Grid backing "Corrigendum" and "Correction" cards.
        //  Ported from OfficerController.GetCorrigendumApplications so ExportData
        //  can invoke it via the same URL-last-segment dispatch used by
        //  GetApplications / GetInitiatedApplications.
        //
        //  Returns PLAIN JSON (no JsonResult wrapper) — ExportData reads
        //  result.data / result.columns directly.
        //
        //  NOTE 1: when scope == "All" the JSX does not send pageIndex/pageSize,
        //  so they arrive as 0 here. Take(0) would silently return an empty
        //  list → "No data to export." All-scope skips pagination entirely.
        //
        //  NOTE 2: pagedData MUST stay List<Corrigendum> (typed). Casting it
        //  to dynamic breaks the `out var` / `is JObject` patterns and the
        //  LINQ lambdas downstream (CS8197, CS0165, CS1977).
        // ═══════════════════════════════════════════════════════════════════════
        public string GetCorrigendumApplications(string? scope, string? columnOrder, string? columnVisibility, string type, string applicationType, string Serviceid, int pageIndex = 0, int pageSize = 10)
        {
            var officer = GetOfficerDetails();
            if (officer == null)
                return JsonConvert.SerializeObject(new
                {
                    data = new List<dynamic>(),
                    columns = new List<dynamic>(),
                    poolData = new List<dynamic>(),
                    totalRecords = 0
                });

            _logger.LogInformation(
                "----- GetCorrigendumApplications | Officer: {Officer} | Type: {Type} | Scope: {Scope} -----",
                officer.Role, applicationType, scope);

            var parameters = new[]
            {
                new NpgsqlParameter("@officeraccesslevel", officer.AccessLevel),
                new NpgsqlParameter("@officeraccesscode",  officer.AccessCode),
                new NpgsqlParameter("@referencenumber",    DBNull.Value),
                new NpgsqlParameter("@status",             type),
                new NpgsqlParameter("@corrigendumid",      DBNull.Value),
                new NpgsqlParameter("@type",               applicationType),
                new NpgsqlParameter("@officerrole",        officer.Role)
            };

            var service = dbcontext.Services.FirstOrDefault(s => s.Serviceid == Convert.ToInt32(Serviceid));
            if (service == null)
                return JsonConvert.SerializeObject(new
                {
                    data = new List<dynamic>(),
                    columns = new List<dynamic>(),
                    poolData = new List<dynamic>(),
                    totalRecords = 0
                });

            List<dynamic> workflow;
            try
            {
                workflow = JsonConvert.DeserializeObject<List<dynamic>>(service.Officereditablefield!) ?? new();
            }
            catch (JsonException ex)
            {
                return JsonConvert.SerializeObject(new { error = $"Error parsing workflow: {ex.Message}" });
            }

            if (workflow.Count == 0)
                return JsonConvert.SerializeObject(new
                {
                    data = new List<dynamic>(),
                    columns = new List<dynamic>(),
                    poolData = new List<dynamic>(),
                    totalRecords = 0
                });

            dynamic authorities = workflow.FirstOrDefault(p => p.designation == officer.Role)!;

            var applications = dbcontext.Corrigendum
                .FromSqlRaw("SELECT * FROM get_corrigendum_by_location_access(@officeraccesslevel, @officeraccesscode, @referencenumber, @status, @corrigendumid, @type, @officerrole)", parameters)
                .ToList();

            var applicationReferenceNumbers = applications.Select(c => c.Referencenumber).ToList();
            var citizenApplications = dbcontext.CitizenApplications
                .Where(ca => applicationReferenceNumbers.Contains(ca.Referencenumber))
                .ToDictionary(ca => ca.Referencenumber!, ca => ca);

            var sortedData = applications.OrderBy(a =>
            {
                var parts = a.Corrigendumid!.Split('/');
                var numberPart = parts.Last();
                return int.TryParse(numberPart, out int num) ? num : 0;
            }).ToList();

            var totalRecords = sortedData.Count;

            // ── Pagination: "All" scope skips it entirely. ─────────────────────
            // pagedData is List<Corrigendum> — NOT List<dynamic>. The foreach
            // body depends on typed member access and lambdas.
            List<Corrigendum> pagedData;
            if (string.Equals(scope, "All", StringComparison.OrdinalIgnoreCase))
            {
                pagedData = sortedData;
            }
            else
            {
                pagedData = sortedData
                    .Skip(pageIndex * pageSize)
                    .Take(pageSize)
                    .ToList();
            }

            List<dynamic> data = new();

            foreach (var application in pagedData)
            {
                if (!citizenApplications.TryGetValue(application.Referencenumber!, out var citizenApp))
                    continue;

                var formDetails = JsonConvert.DeserializeObject<dynamic>(citizenApp.Formdetails!);
                var workFlow = JsonConvert.DeserializeObject<JArray>(application.Workflow!) ?? new JArray();
                var history = JArray.Parse(application.History!) ?? new JArray();

                string creationOfficerDesignation = "Legacy Data";
                string creationOfficerAccessLevel = "State";
                if (workFlow.Count > 0 && workFlow[0] is JObject firstEntry)
                {
                    creationOfficerDesignation = (string?)firstEntry["designation"] ?? "Legacy Data";
                    creationOfficerAccessLevel = (string?)firstEntry["accessLevel"] ?? "State";
                }

                int currentPlayer = application.Currentplayer;
                string officerDesignation = "N/A";
                string offierAccessLevel = "N/A";

                if (currentPlayer >= 0 && currentPlayer < workFlow.Count && workFlow[currentPlayer] is JObject currentEntry)
                {
                    officerDesignation = (string?)currentEntry["designation"] ?? "N/A";
                    offierAccessLevel = (string?)currentEntry["accessLevel"] ?? "N/A";
                }
                else if (workFlow.Count > 0)
                {
                    var lastEntry = workFlow[workFlow.Count - 1] as JObject;
                    officerDesignation = (string?)lastEntry?["designation"] ?? "N/A";
                    offierAccessLevel = (string?)lastEntry?["accessLevel"] ?? "N/A";
                }

                var officerWithApplication = workFlow
                    .OfType<JObject>()
                    .FirstOrDefault(o => o["playerId"]?.Type == JTokenType.Integer
                                         && (int)o["playerId"]! == application.Currentplayer);

                string? CurrentStatus = officerWithApplication != null
                    ? (string?)officerWithApplication["status"]
                    : (workFlow.Count > 0 ? (string?)workFlow[workFlow.Count - 1]?["status"] : "Legacy Data");

                var firstAction = history.Count > 0 ? history[0] : null;
                string actionTaker = firstAction != null ? (string?)firstAction["actionTaker"] ?? "System" : "System";

                string currentOfficerArea = GetOfficerArea(offierAccessLevel, formDetails);
                string officerArea = GetOfficerArea(creationOfficerAccessLevel, JObject.Parse(citizenApp.Formdetails!));

                var customActions = new List<dynamic>();

                var currentOfficer = workFlow
                    .OfType<JObject>()
                    .FirstOrDefault(o => o["designation"]?.Type == JTokenType.String
                                         && (string)o["designation"]! == officer.Role);

                bool canPull = currentOfficer?["canPull"]?.Type == JTokenType.Boolean
                            && (bool)currentOfficer["canPull"]!;

                if ((type == "forwarded" || type == "returned") && canPull)
                {
                    customActions.Add(new
                    {
                        type = "Pull",
                        tooltip = "Pull",
                        color = "#F0C38E",
                        actionFunction = "pullCorrigendum"
                    });
                }
                else
                {
                    var matchedItem = workFlow
                        .OfType<JObject>()
                        .FirstOrDefault(item => item["designation"]?.Type == JTokenType.String
                                                && (string)item["designation"]! == officer.Role);

                    bool isToEdit = matchedItem != null
                        && (string?)matchedItem["status"] == "pending"
                        && matchedItem["playerId"]?.Type == JTokenType.Integer
                        && (int?)matchedItem["playerId"] == application.Currentplayer
                        && authorities != null
                        && (bool?)authorities!.canCorrigendum == true
                        && actionTaker != "Citizen";

                    string actionFunction = isToEdit
                        ? "handleEditCorrigendumApplication"
                        : application.Status == "Sanctioned"
                            ? "handleViewPdf"
                            : "handleViewCorrigendumApplication";

                    customActions.Add(new
                    {
                        type = application.Status?.ToLower() == "sanctioned" ? "View" : "handleViewCorrigendumApplication",
                        tooltip = "View",
                        corrigendumId = application.Corrigendumid,
                        color = "#F0C38E",
                        actionFunction,
                    });
                }

                data.Add(new
                {
                    referenceNumber = application.Referencenumber,
                    applicationId = application.Corrigendumid,
                    createdBy = actionTaker == "Citizen"
                                        ? "Citizen"
                                        : creationOfficerDesignation + " " + officerArea,
                    applicantName = GetFieldValue("ApplicantName", formDetails),
                    currentlyWith = officerDesignation + " " + currentOfficerArea,
                    currentStatus = CurrentStatus?.ToLower() == "sanctioned" ? "Issued" : CurrentStatus,
                    creationDate = application.Createdat.ToString("dd MMM yyyy hh:mm:ss tt"),
                    applicationType,
                    serviceId = citizenApp.Serviceid,
                    customActions
                });
            }

            List<dynamic> columns = new()
            {
                new { accessorKey = "referenceNumber", header = "Reference Number" },
                new { accessorKey = "applicationId",   header = applicationType + " Id" },
                new { accessorKey = "createdBy",       header = "Creation Officer" },
                new { accessorKey = "applicantName",   header = "Applicant Name" },
                new { accessorKey = "currentlyWith",   header = "Currently With" },
                new { accessorKey = "currentStatus",   header = "Current Status" },
                new { accessorKey = "creationDate",    header = applicationType + " Creation Date" },
                new { accessorKey = "applicationType", header = "Application Type" }
            };

            return JsonConvert.SerializeObject(new
            {
                data,
                columns,
                poolData = new List<dynamic>(),
                totalRecords
            });
        }

        // ═══════════════════════════════════════════════════════════════════════
        //  Grid backing "PCP Applications" and "PCP-UDID Expires in 3 Months".
        //  Ported from OfficerController.GetTemporaryDisability.
        //
        //  Returns PLAIN JSON (no JsonResult wrapper) — ExportData reads
        //  result.data / result.columns directly.
        //
        //  NOTE: for scope="All" the JSX omits pageIndex/pageSize, so they
        //  arrive as 0. We force a wide fetch so the SQL function returns
        //  everything in one call.
        // ═══════════════════════════════════════════════════════════════════════
        public async Task<string> GetTemporaryDisability(string? scope, string? columnOrder, string? columnVisibility, string? Serviceid, string type, int pageIndex = 0, int pageSize = 10)
        {
            try
            {
                var officer = GetOfficerDetails();
                if (officer == null)
                    return JsonConvert.SerializeObject(new
                    {
                        data = new List<dynamic>(),
                        columns = new List<dynamic>(),
                        totalRecords = 0
                    });

                int serviceId;
                try { serviceId = Convert.ToInt32(Serviceid); }
                catch { return JsonConvert.SerializeObject(new { error = "Invalid Serviceid" }); }

                string accessLevel = officer.AccessLevel!;
                int? accessCode = officer.AccessCode;
                string takenBy = officer.Role!;

                int? divisionCode = null;
                if (accessLevel == "Division" && accessCode.HasValue)
                {
                    var district = await dbcontext.District
                        .FirstOrDefaultAsync(d => d.Districtid == accessCode.Value);
                    divisionCode = district?.Division ?? accessCode.Value;
                }

                string resultType = type == "totalpcpapplication"
                    ? "totalpcpapplication"
                    : "expiringeligibility";

                // ── Pagination: "All" scope skips it entirely. ─────────────────
                if (string.Equals(scope, "All", StringComparison.OrdinalIgnoreCase))
                {
                    pageIndex = 0;
                    pageSize = 1_000_000;   // effectively "no pagination"
                }
                else
                {
                    if (pageIndex < 0) pageIndex = 0;
                    if (pageSize < 1) pageSize = 10;
                }
                int pageNumber = pageIndex + 1;

                var parameters = new[]
                {
                    new NpgsqlParameter("@accesslevel",  accessLevel),
                    new NpgsqlParameter("@accesscode",   accessCode ?? (object)DBNull.Value),
                    new NpgsqlParameter("@serviceid",    serviceId),
                    new NpgsqlParameter("@takenby",      takenBy),
                    new NpgsqlParameter("@divisioncode", divisionCode ?? (object)DBNull.Value),
                    new NpgsqlParameter("@resulttype",   resultType),
                    new NpgsqlParameter("@pagenumber",   pageNumber),
                    new NpgsqlParameter("@pagesize",     pageSize)
                };

                var applications = await dbcontext.CitizenApplications
                    .FromSqlRaw("SELECT * FROM get_disability_applications(@accesslevel, @accesscode, @serviceid, @takenby, @divisioncode, @resulttype, @pagenumber, @pagesize)", parameters)
                    .ToListAsync();

                int totalRecords = 0;
                try
                {
                    var countParameters = new[]
                    {
                        new NpgsqlParameter("@accesslevel",  accessLevel),
                        new NpgsqlParameter("@accesscode",   accessCode ?? (object)DBNull.Value),
                        new NpgsqlParameter("@serviceid",    serviceId),
                        new NpgsqlParameter("@takenby",      takenBy),
                        new NpgsqlParameter("@divisioncode", divisionCode ?? (object)DBNull.Value),
                        new NpgsqlParameter("@resulttype",   resultType),
                        new NpgsqlParameter("@pagenumber",   1),
                        new NpgsqlParameter("@pagesize",     1000000)
                    };

                    var countQuery = await dbcontext.CitizenApplications
                        .FromSqlRaw("SELECT * FROM get_disability_applications(@accesslevel, @accesscode, @serviceid, @takenby, @divisioncode, @resulttype, @pagenumber, @pagesize)", countParameters)
                        .ToListAsync();

                    totalRecords = countQuery.Count;
                }
                catch
                {
                    totalRecords = applications.Count;
                }

                var serviceName = await dbcontext.Services
                    .Where(s => s.Serviceid == serviceId)
                    .Select(s => s.Servicename)
                    .FirstOrDefaultAsync() ?? "Unknown Service";

                List<dynamic> data = new();
                List<dynamic> columns = new()
                {
                    new { accessorKey = "sno",             header = "S.No" },
                    new { accessorKey = "referenceNumber", header = "Reference Number" },
                    new { accessorKey = "applicantName",   header = "Applicant Name" },
                    new { accessorKey = "serviceName",     header = "Service Name" },
                };

                if (type == "totalpcpapplication")
                {
                    columns.Add(new { accessorKey = "applicationType", header = "UDID Card Type" });
                    columns.Add(new { accessorKey = "expiryDate", header = "UDID Card Expiry Date" });
                }
                else
                {
                    columns.Add(new { accessorKey = "expiryDate", header = "UDID Card Expiry Date" });
                    columns.Add(new { accessorKey = "noOfMailSent", header = "No. Of Reminder Mails Sent to Citizen" });
                }

                int snoCounter = (pageIndex * pageSize) + 1;

                foreach (var application in applications)
                {
                    try
                    {
                        var formDetailsObj = JToken.Parse(application.Formdetails ?? "{}");
                        string applicantName = GetFieldValue("ApplicantName", formDetailsObj) ?? "Unknown Applicant";

                        dynamic applicationObject = new ExpandoObject();
                        applicationObject.sno = snoCounter++;
                        applicationObject.referenceNumber = application.Referencenumber;
                        applicationObject.applicantName = applicantName;
                        applicationObject.serviceName = serviceName;

                        string expiryDisplay = "No Expiry Data";
                        if (!string.IsNullOrWhiteSpace(application.FormdetailsFlat))
                        {
                            try
                            {
                                var flatObj = JToken.Parse(application.FormdetailsFlat);
                                var rawDate = flatObj["IfTemporaryDisabilityUdidCardValidUpto"]?.ToString();

                                if (!string.IsNullOrWhiteSpace(rawDate) && DateTime.TryParse(rawDate, out DateTime expDate))
                                {
                                    int daysLeft = (expDate.Date - DateTime.Today).Days;
                                    expiryDisplay = expDate.ToString("dd MMM yyyy")
                                        + (daysLeft >= 0 ? $" ({daysLeft} days left)" : " (Expired)");
                                }
                            }
                            catch { /* ignore */ }
                        }

                        applicationObject.expiryDate = expiryDisplay;

                        if (type == "totalpcpapplication")
                        {
                            var disabilityTypeField = FormJsonHelper.FindFieldRecursively(formDetailsObj, "KindOfDisability");
                            applicationObject.applicationType = disabilityTypeField?["value"]?.ToString() ?? "N/A";
                        }
                        else
                        {
                            applicationObject.noOfMailSent = 0;
                            applicationObject.customActions = new List<dynamic>
                            {
                                new
                                {
                                    type = "SendEmail",
                                    tooltip = "Send Reminder Email",
                                    tooltipText = "Send Reminder Mail to Citizen",
                                    color = "#F0C38E",
                                    actionFunction = "sendExpirationEmail"
                                }
                            };
                        }

                        data.Add(applicationObject);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, $"Error processing {application.Referencenumber}: {ex.Message}");
                        continue;
                    }
                }

                return JsonConvert.SerializeObject(new
                {
                    data,
                    columns,
                    totalRecords,
                    pageIndex,
                    pageSize,
                    totalPages = pageSize > 0
                        ? (int)Math.Ceiling((double)totalRecords / pageSize)
                        : 0
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error in GetTemporaryDisability: {ex.Message}");
                return JsonConvert.SerializeObject(new
                {
                    data = new List<dynamic>(),
                    columns = new List<dynamic>(),
                    totalRecords = 0,
                    pageIndex = 0,
                    pageSize = 10,
                    totalPages = 0,
                    error = ex.Message
                });
            }
        }

        public class AgeWiseReportDto
        {
            public string? Age_range { get; set; }
            public long Countofapplicants { get; set; }
        }

        public class AgeRangeDto
        {
            public int Min { get; set; }
            public int Max { get; set; }
            public string? Label { get; set; }
        }

        public class PensionTypeWiseReportDto
        {
            public string? Age_range { get; set; }
            public string? Pensiontype { get; set; }
            public long Countofapplicants { get; set; }
        }

        public class GenderWiseReportDto
        {
            public string? Gender { get; set; }
            public long Countofapplicants { get; set; }
        }

        public class DetailedApplicationsReportDto
        {
            [Column("districtname")] public string? DistrictName { get; set; }
            [Column("tswofficename")] public string? Tswofficename { get; set; }
            [Column("application_status")] public string? ApplicationStatus { get; set; }
            [Column("application_pending_with")] public string? ApplicationPendingWith { get; set; }
            [Column("referencenumber")] public string? ReferenceNumber { get; set; }
            [Column("applicant_name")] public string? ApplicantName { get; set; }
            [Column("parentage")] public string? Parentage { get; set; }
            [Column("date_of_birth")] public string? DateOfBirth { get; set; }
            [Column("mobile_number")] public string? MobileNumber { get; set; }
            [Column("account_number")] public string? AccountNumber { get; set; }
            [Column("ifsc_code")] public string? IfscCode { get; set; }
            [Column("bank_name")] public string? BankName { get; set; }
            [Column("branch_name")] public string? BranchName { get; set; }
            [Column("present_address")] public string? PresentAddress { get; set; }
            [Column("present_district")] public string? PresentDistrict { get; set; }
            [Column("present_tehsil")] public string? PresentTehsil { get; set; }
            [Column("permanent_address")] public string? PermanentAddress { get; set; }
            [Column("permanent_district")] public string? PermanentDistrict { get; set; }
            [Column("permanent_tehsil")] public string? PermanentTehsil { get; set; }
            [Column("pension_type")] public string? PensionType { get; set; }
            [Column("gender")] public string? Gender { get; set; }        // NEW
            [Column("category")] public string? Category { get; set; }      // NEW
            [Column("udid_card_number")] public string? UdidCardNumber { get; set; }
            [Column("type_of_disability")] public string? TypeOfDisability { get; set; }
            [Column("kind_of_disability")] public string? KindOfDisability { get; set; }
            [Column("percentage_of_disability")] public string? PercentageOfDisability { get; set; }
            [Column("disability_others")] public string? DisabilityOthers { get; set; }
            [Column("temporary_disability_valid_upto")] public string? TemporaryDisabilityValidUpto { get; set; }
            [Column("civil_condition")] public string? CivilCondition { get; set; }
            [Column("last_action_taken")] public string? LastActionTaken { get; set; }
            [Column("remarks")] public string? Remarks { get; set; }
            [Column("ActionTakenOn")] public string? ActionTakenOn { get; set; }
            [Column("totalcount")] public long Totalcount { get; set; }
            [Column("submission_date")] public string? SubmissionDate { get; set; }
            [Column("sanctioned_date")] public string? SanctionedDate { get; set; }
        }

        public class WithheldApplicationResult
        {
            public long Sno { get; set; }
            public string? Referencenumber { get; set; }
            public string? ApplicantName { get; set; }
            public string? WithheldType { get; set; }
            public string? WithheldReason { get; set; }
            public int? TotalRecords { get; set; }
        }

        public class WithheldDetailedReportDto
        {
            public string? Districtname { get; set; }
            public string? Tswofficename { get; set; }
            public string? Application_status { get; set; }
            public string? Application_pending_with { get; set; }
            public string? Referencenumber { get; set; }
            public string? Applicant_name { get; set; }
            public string? Parentage { get; set; }
            public string? Mobile_number { get; set; }
            public string? Account_number { get; set; }
            public string? Ifsc_code { get; set; }
            public string? Bank_name { get; set; }
            public string? Branch_name { get; set; }
            public string? ActionTakenOn { get; set; }
            public string? Iswithheld { get; set; }
            public string? Withheldtype { get; set; }
            public string? Withheldreason { get; set; }
            public long Totalcount { get; set; }
        }

        [HttpGet]
        public async Task<IActionResult> GetApplicationsForReport(
      int accessCode,
      int serviceId,
      string accessLevel,
      string? dataType = null,
      string reportType = "TehsilWise",
      string? statusType = null,
      string? ageRanges = null,
      int pageIndex = 0,
      int pageSize = 10,
      bool isPaginated = true,
      DateTime? fromDate = null,
      DateTime? toDate = null,
      DateTime? sanctionFromDate = null,
      DateTime? sanctionToDate = null,
      string? gender = null,          // NEW
      string? pensionType = null,     // NEW
      string? category = null)        // NEW
        {
            try
            {
                var officer = GetOfficerDetails();
                _logger.LogInformation(
                    $"GetApplicationsForReport - AccessCode: {accessCode}, ServiceId: {serviceId}, " +
                    $"AccessLevel: {accessLevel}, DataType: {dataType}, ReportType: {reportType}, " +
                    $"StatusType: {statusType}, PageIndex: {pageIndex}, PageSize: {pageSize}, " +
                    $"IsPaginated: {isPaginated}, " +
                    $"FromDate: {fromDate?.ToString("yyyy-MM-dd") ?? "NULL"}, " +
                    $"ToDate: {toDate?.ToString("yyyy-MM-dd") ?? "NULL"}, " +
                    $"SanctionFrom: {sanctionFromDate?.ToString("yyyy-MM-dd") ?? "NULL"}, " +
                    $"SanctionTo: {sanctionToDate?.ToString("yyyy-MM-dd") ?? "NULL"}, " +
                    $"Gender: {gender ?? "NULL"}, PensionType: {pensionType ?? "NULL"}, Category: {category ?? "NULL"}");

                List<dynamic> data;
                List<dynamic> columns;
                int totalRecords = 0;

                switch (reportType)
                {
                    case "TehsilWise":
                        var tehsilParameters = new[]
                        {
                    new NpgsqlParameter("@p_access_code", NpgsqlDbType.Integer) { Value = accessCode },
                    new NpgsqlParameter("@p_service_id", NpgsqlDbType.Integer) { Value = serviceId },
                    new NpgsqlParameter("@p_access_level", NpgsqlDbType.Varchar) { Value = accessLevel },
                    new NpgsqlParameter("@p_data_type", NpgsqlDbType.Varchar) { Value = string.IsNullOrEmpty(dataType) ? DBNull.Value : dataType }
                };

                        var tehsilResults = dbcontext.Database
                            .SqlQueryRaw<SummaryReports>(
                                "SELECT * FROM get_applications_for_report(@p_access_code, @p_service_id, @p_access_level, @p_data_type)",
                                tehsilParameters)
                            .ToList();

                        data = tehsilResults.Cast<dynamic>().ToList();
                        totalRecords = data.Count;
                        columns = new List<dynamic>
                {
                    new { accessorKey = "tehsilname", header = "Tehsil Name" },
                    new { accessorKey = "totalapplicationssubmitted", header = "Total Applications Submitted" },
                    new { accessorKey = "totalapplicationspending", header = "Total Applications Pending" },
                    new { accessorKey = "totalapplicationsreturntoedit", header = "Total Applications Return to Edit" },
                    new { accessorKey = "totalapplicationsrejected", header = "Total Applications Rejected" },
                    new { accessorKey = "totalapplicationssanctioned", header = "Total Applications Sanctioned" }
                };
                        break;

                    case "AgeWise":
                        string ageRangesJson = ageRanges!;

                        if (string.IsNullOrEmpty(ageRangesJson))
                        {
                            ageRangesJson = @"[
                        {""min"": 0, ""max"": 59, ""label"": ""Below 60""},
                        {""min"": 60, ""max"": 79, ""label"": ""60 to 79""},
                        {""min"": 80, ""max"": 999, ""label"": ""80 and Above""}
                    ]";
                        }

                        var ageParameters = new[]
                        {
                    new NpgsqlParameter("@p_service_id", NpgsqlDbType.Integer) { Value = serviceId },
                    new NpgsqlParameter("@p_access_level", NpgsqlDbType.Varchar) { Value = accessLevel },
                    new NpgsqlParameter("@p_access_code", NpgsqlDbType.Integer) { Value = accessCode },
                    new NpgsqlParameter("@p_application_status", NpgsqlDbType.Varchar) { Value = string.IsNullOrEmpty(statusType) ? "total" : statusType },
                    new NpgsqlParameter("@p_data_type", NpgsqlDbType.Varchar) { Value = string.IsNullOrEmpty(dataType) ? DBNull.Value : dataType },
                    new NpgsqlParameter("@p_age_ranges", NpgsqlDbType.Jsonb) { Value = ageRangesJson }
                };

                        var ageResults = dbcontext.Database
                            .SqlQueryRaw<AgeWiseReportDto>(
                                "SELECT * FROM get_age_counts_with_dynamic_ranges(@p_service_id, @p_access_level, @p_access_code, @p_application_status, @p_data_type, @p_age_ranges)",
                                ageParameters)
                            .ToList();

                        data = ageResults.Cast<dynamic>().ToList();
                        totalRecords = data.Count;
                        columns = new List<dynamic>
                {
                    new { accessorKey = "age_range", header = "Age Range" },
                    new { accessorKey = "countofapplicants", header = "Beneficiary Count" }
                };
                        break;

                    case "PensionTypeWise":
                        ageRangesJson = ageRanges!;

                        if (string.IsNullOrEmpty(ageRangesJson))
                        {
                            ageRangesJson = @"[
                        {""min"": 0, ""max"": 59, ""label"": ""Below 60""},
                        {""min"": 60, ""max"": 79, ""label"": ""60 to 79""},
                        {""min"": 80, ""max"": 999, ""label"": ""80 and Above""}
                    ]";
                        }

                        var pensionParameters = new[]
                        {
                    new NpgsqlParameter("@p_service_id", NpgsqlDbType.Integer) { Value = serviceId },
                    new NpgsqlParameter("@p_access_level", NpgsqlDbType.Varchar) { Value = accessLevel },
                    new NpgsqlParameter("@p_access_code", NpgsqlDbType.Integer) { Value = accessCode },
                    new NpgsqlParameter("@p_application_status", NpgsqlDbType.Varchar) { Value = string.IsNullOrEmpty(statusType) ? "total" : statusType },
                    new NpgsqlParameter("@p_data_type", NpgsqlDbType.Varchar) { Value = string.IsNullOrEmpty(dataType) ? DBNull.Value : dataType },
                    new NpgsqlParameter("@p_age_ranges", NpgsqlDbType.Jsonb) { Value = ageRangesJson }
                };

                        var pensionResults = dbcontext.Database
                            .SqlQueryRaw<PensionTypeWiseReportDto>(
                                "SELECT * FROM get_age_and_pension_counts(@p_service_id, @p_access_level, @p_access_code, @p_application_status, @p_data_type, @p_age_ranges)",
                                pensionParameters)
                            .ToList();

                        data = pensionResults.Cast<dynamic>().ToList();
                        totalRecords = data.Count;
                        columns = new List<dynamic>
                {
                    new { accessorKey = "age_range", header = "Age Range" },
                    new { accessorKey = "pensiontype", header = "Pension Type" },
                    new { accessorKey = "countofapplicants", header = "Beneficiary Count" }
                };
                        break;

                    case "GenderWise":
                        var genderParameters = new[]
                        {
                    new NpgsqlParameter("@p_service_id", NpgsqlDbType.Integer) { Value = serviceId },
                    new NpgsqlParameter("@p_access_level", NpgsqlDbType.Varchar) { Value = accessLevel },
                    new NpgsqlParameter("@p_access_code", NpgsqlDbType.Integer) { Value = accessCode },
                    new NpgsqlParameter("@p_application_status", NpgsqlDbType.Varchar) { Value = string.IsNullOrEmpty(statusType) ? "total" : statusType },
                    new NpgsqlParameter("@p_data_type", NpgsqlDbType.Varchar) { Value = string.IsNullOrEmpty(dataType) ? DBNull.Value : dataType }
                };

                        var genderResults = dbcontext.Database
                            .SqlQueryRaw<GenderWiseReportDto>(
                                "SELECT * FROM get_gender_counts(@p_service_id, @p_access_level, @p_access_code, @p_application_status, @p_data_type)",
                                genderParameters)
                            .ToList();

                        data = genderResults.Cast<dynamic>().ToList();
                        totalRecords = data.Count;
                        columns = new List<dynamic>
                {
                    new { accessorKey = "gender", header = "Gender" },
                    new { accessorKey = "countofapplicants", header = "Beneficiary Count" }
                };
                        break;

                    case "DetailedApplications":
                        var detailedParameters = new[]
                        {
                    new NpgsqlParameter("@p_role", NpgsqlDbType.Varchar) { Value = officer?.Role ?? (object)DBNull.Value },
                    new NpgsqlParameter("@p_access_level", NpgsqlDbType.Varchar) { Value = accessLevel },
                    new NpgsqlParameter("@p_access_code", NpgsqlDbType.Integer) { Value = accessCode },
                    new NpgsqlParameter("@p_application_status", NpgsqlDbType.Varchar) { Value = string.IsNullOrEmpty(statusType) ? DBNull.Value : statusType },
                    new NpgsqlParameter("@p_service_id", NpgsqlDbType.Integer) { Value = serviceId },
                    new NpgsqlParameter("@p_page_index", NpgsqlDbType.Integer) { Value = pageIndex },
                    new NpgsqlParameter("@p_page_size", NpgsqlDbType.Integer) { Value = pageSize },
                    new NpgsqlParameter("@p_is_paginated", NpgsqlDbType.Boolean) { Value = isPaginated },
                    new NpgsqlParameter("@p_data_type", NpgsqlDbType.Varchar) { Value = string.IsNullOrEmpty(dataType) ? DBNull.Value : dataType },
                    new NpgsqlParameter("@p_division_code", NpgsqlDbType.Integer) { Value = accessLevel == "Division" ? accessCode : (object)DBNull.Value },
                    new NpgsqlParameter("@p_startdate",          NpgsqlDbType.Timestamp) { Value = fromDate.HasValue         ? (object)fromDate.Value.Date         : DBNull.Value },
                    new NpgsqlParameter("@p_enddate",            NpgsqlDbType.Timestamp) { Value = toDate.HasValue           ? (object)toDate.Value.Date           : DBNull.Value },
                    new NpgsqlParameter("@p_sanction_startdate", NpgsqlDbType.Timestamp) { Value = sanctionFromDate.HasValue ? (object)sanctionFromDate.Value.Date : DBNull.Value },
                    new NpgsqlParameter("@p_sanction_enddate",   NpgsqlDbType.Timestamp) { Value = sanctionToDate.HasValue   ? (object)sanctionToDate.Value.Date   : DBNull.Value },
                    // ── NEW filters ─────────────────────────────────────
                    new NpgsqlParameter("@p_gender",       NpgsqlDbType.Varchar) { Value = string.IsNullOrEmpty(gender)      ? DBNull.Value : (object)gender },
                    new NpgsqlParameter("@p_pension_type", NpgsqlDbType.Varchar) { Value = string.IsNullOrEmpty(pensionType) ? DBNull.Value : (object)pensionType },
                    new NpgsqlParameter("@p_category",     NpgsqlDbType.Varchar) { Value = string.IsNullOrEmpty(category)    ? DBNull.Value : (object)category }
                };

                        var detailedResults = dbcontext.Database
                            .SqlQueryRaw<DetailedApplicationsReportDto>(
                                "SELECT * FROM get_applications_for_officer_report(" +
                                "@p_role, @p_access_level, @p_access_code, @p_application_status, " +
                                "@p_service_id, @p_page_index, @p_page_size, @p_is_paginated, " +
                                "@p_data_type, @p_division_code, @p_startdate, @p_enddate, " +
                                "@p_sanction_startdate, @p_sanction_enddate, " +
                                "@p_gender, @p_pension_type, @p_category)",
                                detailedParameters)
                            .ToList();

                        totalRecords = (int)(detailedResults.FirstOrDefault()?.Totalcount ?? 0);
                        data = detailedResults.Cast<dynamic>().ToList();

                        columns = new List<dynamic>
                        {
                            new { accessorKey = "districtName",                     header = "District" },
                            new { accessorKey = "tswofficename",                    header = "TSWO Office" },
                            new { accessorKey = "applicationStatus",                header = "Application Status" },
                            new { accessorKey = "applicationPendingWith",           header = "Application Pending With" },
                            new { accessorKey = "referenceNumber",                  header = "Reference Number" },
                            new { accessorKey = "applicantName",                    header = "Applicant Name" },
                            new { accessorKey = "submissionDate",                   header = "Submission Date" },
                            new { accessorKey = "parentage",                        header = "Parentage" },
                            new { accessorKey = "dateOfBirth",                      header = "Date of Birth" },
                            new { accessorKey = "mobileNumber",                     header = "Mobile Number" },
                            new { accessorKey = "accountNumber",                    header = "Account Number" },
                            new { accessorKey = "ifscCode",                         header = "IFSC Code" },
                            new { accessorKey = "bankName",                         header = "Bank Name" },
                            new { accessorKey = "branchName",                       header = "Branch Name" },
                            new { accessorKey = "presentAddress",                   header = "Present Address" },
                            new { accessorKey = "presentDistrict",                  header = "Present District" },
                            new { accessorKey = "presentTehsil",                    header = "Present Tehsil" },
                            new { accessorKey = "permanentAddress",                 header = "Permanent Address" },
                            new { accessorKey = "permanentDistrict",                header = "Permanent District" },
                            new { accessorKey = "permanentTehsil",                  header = "Permanent Tehsil" },
                            new { accessorKey = "pensionType",                      header = "Pension Type" },
                            new { accessorKey = "gender",                           header = "Gender" },        // NEW
                            new { accessorKey = "category",                         header = "Category" },      // NEW
                            new { accessorKey = "udidCardNumber",                   header = "UDID Card Number" },
                            new { accessorKey = "typeOfDisability",                 header = "Type of Disability" },
                            new { accessorKey = "kindOfDisability",                 header = "Kind of Disability" },
                            new { accessorKey = "percentageOfDisability",           header = "Percentage of Disability" },
                            new { accessorKey = "disabilityOthers",                 header = "Disability (If Others)" },
                            new { accessorKey = "temporaryDisabilityValidUpto",     header = "Temporary Disability Valid Upto" },
                            new { accessorKey = "civilCondition",                   header = "Civil Condition" },
                            new { accessorKey = "lastActionTaken",                  header = "Last Action Taken" },
                            new { accessorKey = "remarks",                          header = "Remarks" },
                            new { accessorKey = "actionTakenOn",                    header = "Action Taken On" },
                            new { accessorKey = "sanctionedDate",                   header = "Sanctioned Date" }
                        };
                        break;

                    case "WithheldApplications":
                        {
                            int? divisionCode = null;
                            if (string.Equals(accessLevel, "Division", StringComparison.OrdinalIgnoreCase))
                            {
                                divisionCode = accessCode;
                            }
                            else if (string.Equals(accessLevel, "District", StringComparison.OrdinalIgnoreCase))
                            {
                                divisionCode = dbcontext.District
                                    .Where(d => d.Districtid == accessCode)
                                    .Select(d => (int?)d.Division)
                                    .FirstOrDefault();
                            }
                            else if (string.Equals(accessLevel, "Tehsil", StringComparison.OrdinalIgnoreCase))
                            {
                                divisionCode = dbcontext.Tswotehsil
                                    .Where(t => t.Tehsilid == accessCode)
                                    .Select(t => (int?)t.Divisioncode)
                                    .FirstOrDefault();
                            }

                            var withheldParameters = new[]
                            {
                        new NpgsqlParameter("@p_role",           NpgsqlDbType.Varchar)   { Value = officer?.Role        ?? (object)DBNull.Value },
                        new NpgsqlParameter("@p_access_level",   NpgsqlDbType.Varchar)   { Value = accessLevel          ?? (object)DBNull.Value },
                        new NpgsqlParameter("@p_access_code",    NpgsqlDbType.Integer)   { Value = accessCode },
                        new NpgsqlParameter("@p_service_id",     NpgsqlDbType.Integer)   { Value = serviceId },
                        new NpgsqlParameter("@p_page_index",     NpgsqlDbType.Integer)   { Value = pageIndex },
                        new NpgsqlParameter("@p_page_size",      NpgsqlDbType.Integer)   { Value = pageSize },
                        new NpgsqlParameter("@p_is_paginated",   NpgsqlDbType.Boolean)   { Value = isPaginated },
                        new NpgsqlParameter("@p_data_type",      NpgsqlDbType.Varchar)   { Value = string.IsNullOrEmpty(dataType) ? DBNull.Value : dataType },
                        new NpgsqlParameter("@p_division_code",  NpgsqlDbType.Integer)   { Value = divisionCode ?? (object)DBNull.Value },
                        new NpgsqlParameter("@p_startdate",      NpgsqlDbType.Timestamp) { Value = fromDate.HasValue ? (object)fromDate.Value.Date : DBNull.Value },
                        new NpgsqlParameter("@p_enddate",        NpgsqlDbType.Timestamp) { Value = toDate.HasValue   ? (object)toDate.Value.Date   : DBNull.Value }
                    };

                            var withheldData = dbcontext.Database
                                .SqlQueryRaw<WithheldDetailedReportDto>(
                                    "SELECT * FROM get_withheld_applications_report(" +
                                    "@p_role, @p_access_level, @p_access_code, @p_service_id, " +
                                    "@p_page_index, @p_page_size, @p_is_paginated, " +
                                    "@p_data_type, @p_division_code, @p_startdate, @p_enddate)",
                                    withheldParameters)
                                .ToList();

                            totalRecords = (int)(withheldData.FirstOrDefault()?.Totalcount ?? 0);
                            data = withheldData.Cast<dynamic>().ToList();

                            columns = new List<dynamic>
                    {
                        new { accessorKey = "districtname",             header = "District" },
                        new { accessorKey = "tswofficename",            header = "TSWO Office" },
                        new { accessorKey = "application_status",       header = "Application Status" },
                        new { accessorKey = "application_pending_with", header = "Application Pending With" },
                        new { accessorKey = "referencenumber",          header = "Reference Number" },
                        new { accessorKey = "applicant_name",           header = "Applicant Name" },
                        new { accessorKey = "parentage",                header = "Parentage" },
                        new { accessorKey = "mobile_number",            header = "Mobile Number" },
                        new { accessorKey = "account_number",           header = "Account Number" },
                        new { accessorKey = "ifsc_code",                header = "IFSC Code" },
                        new { accessorKey = "bank_name",                header = "Bank Name" },
                        new { accessorKey = "branch_name",              header = "Branch Name" },
                        new { accessorKey = "actionTakenOn",            header = "Action Taken On" },
                        new { accessorKey = "iswithheld",               header = "Is Withheld" },
                        new { accessorKey = "withheldtype",             header = "Withheld Type" },
                        new { accessorKey = "withheldreason",           header = "Withheld Reason" }
                    };
                        }
                        break;

                    default:
                        return BadRequest(new { status = false, message = "Invalid report type" });
                }

                return Ok(new
                {
                    status = true,
                    data,
                    columns,
                    totalRecords,
                    pageIndex,
                    pageSize,
                    totalPages = (int)Math.Ceiling(totalRecords / (double)pageSize)
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error executing report - AccessCode: {accessCode}, ServiceId: {serviceId}, ReportType: {reportType}");
                return StatusCode(500, new { status = false, message = ex.Message });
            }
        }
        private static string NormalizeColumnKey(string key)
        {
            if (string.IsNullOrEmpty(key)) return string.Empty;
            return key.Replace("_", string.Empty)
                      .Replace("-", string.Empty)
                      .Replace(" ", string.Empty)
                      .ToLowerInvariant();
        }

        private static List<Dictionary<string, object>> AlignDataKeysToColumns(
            List<Dictionary<string, object>> rows,
            List<Dictionary<string, string>> columns)
        {
            if (rows == null || rows.Count == 0) return rows ?? new List<Dictionary<string, object>>();
            if (columns == null || columns.Count == 0) return rows;

            var accessorByNormalized = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            foreach (var col in columns)
            {
                if (col.TryGetValue("accessorKey", out var ak) && !string.IsNullOrWhiteSpace(ak))
                    accessorByNormalized[NormalizeColumnKey(ak)] = ak;
            }
            if (accessorByNormalized.Count == 0) return rows;

            var alignedRows = new List<Dictionary<string, object>>(rows.Count);
            foreach (var row in rows)
            {
                var newRow = new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase);

                foreach (var kvp in row)
                {
                    var norm = NormalizeColumnKey(kvp.Key);
                    if (accessorByNormalized.TryGetValue(norm, out var targetKey))
                        newRow[targetKey] = kvp.Value;
                    else
                        newRow[kvp.Key] = kvp.Value;
                }

                foreach (var col in columns)
                {
                    if (col.TryGetValue("accessorKey", out var ak) &&
                        !string.IsNullOrWhiteSpace(ak) &&
                        !newRow.ContainsKey(ak))
                    {
                        newRow[ak] = null!;
                    }
                }

                alignedRows.Add(newRow);
            }

            return alignedRows;
        }

        [HttpPost]
        public async Task<IActionResult> ExportData([FromForm] IFormCollection form)
        {
            try
            {
                string? columnOrder = form["columnOrder"];
                string? columnVisibility = form["columnVisibility"];
                string? scope = form["scope"];
                string? format = form["format"];
                int pageIndex = Convert.ToInt32(form["pageIndex"]);
                int pageSize = Convert.ToInt32(form["pageSize"]);
                string? function = form["function"];

                List<Dictionary<string, object>> dataList = new List<Dictionary<string, object>>();
                List<Dictionary<string, string>> columnList = new List<Dictionary<string, string>>();

                // ----------------------------------------------------------------
                // Handle different function types
                // ----------------------------------------------------------------
                if (function == "GetApplications")
                {
                    int Serviceid = Convert.ToInt32(form["Serviceid"]);
                    string? type = form["type"];
                    string? dataType = form["dataType"];

                    var result = JsonConvert.DeserializeObject<dynamic>(
                        GetApplications(
                            scope, columnOrder, columnVisibility,
                            Serviceid, type, pageIndex, pageSize,
                            string.IsNullOrWhiteSpace(dataType) ? "new" : dataType)
                    );

                    if (result != null)
                    {
                        var data = result.Value.data;
                        var columns = result.Value.columns;
                        dataList = JsonConvert.DeserializeObject<List<Dictionary<string, object>>>(data.ToString());
                        columnList = JsonConvert.DeserializeObject<List<Dictionary<string, string>>>(columns.ToString());
                    }
                }
                else if (function == "GetInitiatedApplications")
                {
                    var result = JsonConvert.DeserializeObject<dynamic>(
                        GetInitiatedApplications(scope, columnOrder, columnVisibility, pageIndex, pageSize)
                    );

                    if (result != null)
                    {
                        var data = result.Value.data;
                        var columns = result.Value.columns;
                        dataList = JsonConvert.DeserializeObject<List<Dictionary<string, object>>>(data.ToString());
                        columnList = JsonConvert.DeserializeObject<List<Dictionary<string, string>>>(columns.ToString());
                    }
                }
                // ── Corrigendum / Correction grid ──
                // Returns PLAIN JSON (no JsonResult wrapper), so read result.data
                // / result.columns directly.
                else if (function == "GetCorrigendumApplications")
                {
                    string type = form["type"].ToString();
                    string applicationType = form["applicationType"].ToString();
                    string serviceIdStr = form["ServiceId"].ToString();

                    var json = GetCorrigendumApplications(
                        scope, columnOrder, columnVisibility,
                        type, applicationType, serviceIdStr,
                        pageIndex, pageSize);

                    var result = JsonConvert.DeserializeObject<dynamic>(json);
                    if (result != null)
                    {
                        var data = result.data;
                        var columns = result.columns;

                        dataList = JsonConvert.DeserializeObject<List<Dictionary<string, object>>>(data.ToString());
                        columnList = JsonConvert.DeserializeObject<List<Dictionary<string, string>>>(columns.ToString());
                    }
                }
                // ── PCP / Temporary Disability grid ──
                else if (function == "GetTemporaryDisability")
                {
                    string type = form["type"].ToString();
                    string serviceIdStr = form["ServiceId"].ToString();

                    var json = await GetTemporaryDisability(
                        scope, columnOrder, columnVisibility,
                        serviceIdStr, type,
                        pageIndex, pageSize);

                    var result = JsonConvert.DeserializeObject<dynamic>(json);
                    if (result != null)
                    {
                        var data = result.data;
                        var columns = result.columns;

                        dataList = JsonConvert.DeserializeObject<List<Dictionary<string, object>>>(data.ToString());
                        columnList = JsonConvert.DeserializeObject<List<Dictionary<string, string>>>(columns.ToString());
                    }
                }
                else if (function == "GetApplicationsForReport")
                {
                    int accessCode = Convert.ToInt32(form["accessCode"]);
                    int serviceId = Convert.ToInt32(form["serviceId"]);
                    string accessLevel = form["accessLevel"].ToString();
                    string? dataType = form["dataType"].ToString();
                    string reportType = form["reportType"].ToString();
                    string? statusType = form["statusType"].ToString();
                    string? ageRanges = form["ageRanges"].ToString();
                    bool isPaginated = scope == "InView";

                    // ── NEW filters ────────────────────────────────────────
                    string? gender = form["gender"];
                    string? pensionType = form["pensionType"];
                    string? category = form["category"];

                    string? fromDateRaw = form["fromDate"];
                    string? toDateRaw = form["toDate"];
                    string? sanctionFromRaw = form["sanctionFromDate"];
                    string? sanctionToRaw = form["sanctionToDate"];

                    DateTime? fromDate = null;
                    DateTime? toDate = null;
                    DateTime? sanctionFromDate = null;
                    DateTime? sanctionToDate = null;

                    if (!string.IsNullOrWhiteSpace(fromDateRaw) && DateTime.TryParse(fromDateRaw, out var fd))
                        fromDate = fd.Date;
                    if (!string.IsNullOrWhiteSpace(toDateRaw) && DateTime.TryParse(toDateRaw, out var td))
                        toDate = td.Date;
                    if (!string.IsNullOrWhiteSpace(sanctionFromRaw) && DateTime.TryParse(sanctionFromRaw, out var sf))
                        sanctionFromDate = sf.Date;
                    if (!string.IsNullOrWhiteSpace(sanctionToRaw) && DateTime.TryParse(sanctionToRaw, out var st))
                        sanctionToDate = st.Date;

                    int fetchPageIndex = pageIndex;
                    int fetchPageSize = pageSize;

                    if (scope == "All")
                    {
                        fetchPageIndex = 0;
                        fetchPageSize = int.MaxValue;
                        isPaginated = false;
                    }

                    var reportResult = await GetApplicationsForReport(
                        accessCode,
                        serviceId,
                        accessLevel,
                        dataType,
                        reportType,
                        statusType,
                        ageRanges,
                        fetchPageIndex,
                        fetchPageSize,
                        isPaginated,
                        fromDate,
                        toDate,
                        sanctionFromDate,
                        sanctionToDate,
                        gender,        // NEW
                        pensionType,   // NEW
                        category);     // NEW

                    var okResult = reportResult as OkObjectResult;
                    if (okResult?.Value != null)
                    {
                        dynamic result = okResult.Value;

                        if (result.status == true)
                        {
                            var data = result.data;
                            var columns = result.columns;

                            string dataJson = JsonConvert.SerializeObject(data);
                            string columnsJson = JsonConvert.SerializeObject(columns);

                            dataList = JsonConvert.DeserializeObject<List<Dictionary<string, object>>>(dataJson)!
                                .Select(dict => new Dictionary<string, object>(dict, StringComparer.OrdinalIgnoreCase))
                                .ToList();
                            columnList = JsonConvert.DeserializeObject<List<Dictionary<string, string>>>(columnsJson)!;
                        }
                        else
                        {
                            return Json(new { status = false, error = "Failed to generate report data." });
                        }
                    }
                    else
                    {
                        _logger.LogError("No data returned from GetApplicationsForReport");
                        return Json(new { status = false, error = "No data available." });
                    }
                }
                else if (function == "GetWithheldApplications")
                {
                    int withheldServiceId = int.TryParse(form["ServiceId"], out var wsid) ? wsid : 0;
                    string withheldType = form["type"].FirstOrDefault() ?? "withheld_total";

                    if (withheldServiceId == 0)
                        return Json(new { status = false, error = "ServiceId is required." });

                    var officer = GetOfficerDetails();
                    if (officer == null)
                        return Json(new { status = false, error = "Officer authentication failed." });

                    string accessLevel = officer.AccessLevel ?? "State";
                    int? accessCode = officer.AccessCode;
                    int? divisionCode = null;
                    string officerRole = officer.Role ?? "";

                    if (string.Equals(accessLevel, "Division", StringComparison.OrdinalIgnoreCase))
                    {
                        divisionCode = officer.AccessCode;
                    }
                    else if (string.Equals(accessLevel, "District", StringComparison.OrdinalIgnoreCase)
                             && officer.AccessCode.HasValue)
                    {
                        divisionCode = dbcontext.District
                            .Where(d => d.Districtid == officer.AccessCode.Value)
                            .Select(d => (int?)d.Division)
                            .FirstOrDefault();
                    }
                    else if (string.Equals(accessLevel, "Tehsil", StringComparison.OrdinalIgnoreCase)
                             && officer.AccessCode.HasValue)
                    {
                        divisionCode = dbcontext.Tswotehsil
                            .Where(t => t.Tehsilid == officer.AccessCode.Value)
                            .Select(t => (int?)t.Divisioncode)
                            .FirstOrDefault();
                    }

                    int fetchPageIndex = 0;
                    int fetchPageSize = (scope == "All") ? int.MaxValue : Math.Max(pageSize, 1);
                    if (scope != "All")
                        fetchPageIndex = pageIndex;

                    var withheldParams = new[]
                    {
                        new NpgsqlParameter("@p_service_id",    NpgsqlDbType.Integer) { Value = withheldServiceId },
                        new NpgsqlParameter("@p_type",          NpgsqlDbType.Varchar) { Value = withheldType },
                        new NpgsqlParameter("@p_officer_role",  NpgsqlDbType.Varchar) { Value = (object?)officerRole ?? DBNull.Value },
                        new NpgsqlParameter("@p_page_index",    NpgsqlDbType.Integer) { Value = fetchPageIndex },
                        new NpgsqlParameter("@p_page_size",     NpgsqlDbType.Integer) { Value = fetchPageSize },
                        new NpgsqlParameter("@p_access_level",  NpgsqlDbType.Varchar) { Value = (object?)accessLevel ?? DBNull.Value },
                        new NpgsqlParameter("@p_access_code",   NpgsqlDbType.Integer) { Value = (object?)accessCode ?? DBNull.Value },
                        new NpgsqlParameter("@p_division_code", NpgsqlDbType.Integer) { Value = (object?)divisionCode ?? DBNull.Value }
                    };

                    var withheldResults = await dbcontext.Database
                        .SqlQueryRaw<WithheldApplicationResult>(
                            "SELECT * FROM get_withheld_applications(" +
                            "@p_service_id, @p_type, @p_officer_role, " +
                            "@p_page_index, @p_page_size, " +
                            "@p_access_level, @p_access_code, @p_division_code)",
                            withheldParams)
                        .ToListAsync();

                    var allWithheldColumns = new List<Dictionary<string, string>>
                    {
                        new() { ["accessorKey"] = "sno",             ["header"] = "S.No" },
                        new() { ["accessorKey"] = "referenceNumber", ["header"] = "Reference Number" },
                        new() { ["accessorKey"] = "applicantName",   ["header"] = "Applicant Name" },
                        new() { ["accessorKey"] = "withheldType",    ["header"] = "Withheld Type" },
                        new() { ["accessorKey"] = "withheldReason",  ["header"] = "Withheld Reason" }
                    };

                    var orderedKeys = JsonConvert.DeserializeObject<List<string>>(columnOrder ?? "[]") ?? new List<string>();
                    var visibility = JsonConvert.DeserializeObject<Dictionary<string, bool>>(columnVisibility ?? "{}")
                                      ?? new Dictionary<string, bool>();

                    var keySet = allWithheldColumns.Select(c => c["accessorKey"]).ToHashSet(StringComparer.OrdinalIgnoreCase);

                    if (orderedKeys.Count > 0)
                    {
                        columnList = orderedKeys
                            .Where(k => keySet.Contains(k))
                            .Where(k => !visibility.TryGetValue(k, out var v) || v)
                            .Select(k => allWithheldColumns.First(c => string.Equals(c["accessorKey"], k, StringComparison.OrdinalIgnoreCase)))
                            .ToList();
                    }
                    else
                    {
                        columnList = allWithheldColumns
                            .Where(c => !visibility.TryGetValue(c["accessorKey"], out var v) || v)
                            .ToList();
                    }

                    dataList = withheldResults.Select(r =>
                    {
                        var dict = new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase)
                        {
                            ["sno"] = r.Sno,
                            ["referenceNumber"] = r.Referencenumber ?? "",
                            ["applicantName"] = r.ApplicantName ?? "N/A",
                            ["withheldType"] = r.WithheldType ?? "",
                            ["withheldReason"] = r.WithheldReason ?? ""
                        };
                        return dict;
                    }).ToList();
                }

                if (dataList == null || !dataList.Any())
                {
                    return Json(new { status = false, error = "No data to export." });
                }

                dataList = AlignDataKeysToColumns(dataList, columnList);

                // ----------------------------------------------------------------
                // Generate file based on format
                // ----------------------------------------------------------------
                string fileName = $"{function}_{scope}_{DateTime.Now:yyyyMMdd_HHmmss}";
                byte[] fileBytes;
                string contentType;

                switch (format?.ToLower())
                {
                    case "excel":
                        fileBytes = GenerateExcel(dataList, columnList);
                        contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
                        fileName += ".xlsx";
                        break;
                    case "csv":
                        fileBytes = GenerateCsv(dataList, columnList);
                        contentType = "text/csv";
                        fileName += ".csv";
                        break;
                    case "pdf":
                        fileBytes = GeneratePdf(dataList, columnList);
                        contentType = "application/pdf";
                        fileName += ".pdf";
                        break;
                    default:
                        _logger.LogError($"Invalid format: {format}");
                        return Json(new { status = false, error = "Invalid format specified." });
                }

                return File(fileBytes, contentType, fileName);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error generating export file.");
                return Json(new { status = false, error = $"Error generating file: {ex.Message}" });
            }
        }
    }
}