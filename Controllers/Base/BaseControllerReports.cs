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
            public string? TableName { get; set; }  // The main table to query

            [Column(TypeName = "jsonb")]
            public string? Columns { get; set; }     // JSON array of ReportColumn

            [Column(TypeName = "jsonb")]
            public string? Filters { get; set; }     // JSON array of ReportFilter (nullable)

            public DateTime CreatedAt { get; set; }
            public string? CreatedBy { get; set; }
        }

        public class ReportColumn
        {
            public string? Name { get; set; }          // Database column name
            public string? JsonPath { get; set; }      // Optional JSON path (e.g., "address.city")
            public string? Display { get; set; }        // Column header
            public string? Type { get; set; }           // e.g., "string", "int", "date"
        }

        public class ReportFilter
        {
            public string? Field { get; set; }          // Database column name
            public string? JsonPath { get; set; }       // Optional JSON path
            public string? Operator { get; set; }       // "eq", "neq", "gt", "lt", "contains"
            public object? Value { get; set; }          // Filter value
        }
        public string GetOfficerAreaForHistory(string accessLevel, int? accessCode)
        {
            switch (accessLevel)
            {
                case "Tehsil":
                    var tehsil = dbcontext.Tswotehsil.FirstOrDefault(t => t.Tehsilid == accessCode);
                    return tehsil?.Tehsilname ?? string.Empty;

                case "District":
                    var district = dbcontext.District.FirstOrDefault(d => d.Districtid == accessCode);
                    return district?.Districtname ?? string.Empty;

                case "Division":
                    var districtForDivision = dbcontext.District.FirstOrDefault(d => d.Districtid == accessCode);
                    if (districtForDivision == null)
                        return string.Empty;
                    return districtForDivision.Division == 1 ? "Jammu" : "Kashmir";
                case "State":
                    return "J&K";
                default:
                    return string.Empty;
            }
        }

        public string GetOfficerArea(string accessLevel, dynamic formDetails)
        {
            int accessCode;

            switch (accessLevel)
            {
                case "Tehsil":
                    accessCode = Convert.ToInt32(GetFieldValue("Tehsil", formDetails));
                    var tehsil = dbcontext.Tswotehsil.FirstOrDefault(t => t.Tehsilid == accessCode);
                    return tehsil?.Tehsilname ?? string.Empty;

                case "District":
                    accessCode = Convert.ToInt32(GetFieldValue("District", formDetails));
                    var district = dbcontext.District.FirstOrDefault(d => d.Districtid == accessCode);
                    return district?.Districtname ?? string.Empty;

                case "Division":
                    accessCode = Convert.ToInt32(GetFieldValue("District", formDetails));
                    var districtForDivision = dbcontext.District.FirstOrDefault(d => d.Districtid == accessCode);
                    if (districtForDivision == null)
                        return string.Empty;
                    return districtForDivision.Division == 1 ? "Jammu" : "Kashmir";
                case "State":
                    return "J&K";
                default:
                    return string.Empty;
            }
        }

        public string GetApplications(string? scope, string? columnOrder, string? columnVisibility, int Serviceid, string? type, int pageIndex = 0, int pageSize = 10, string dataType = "new")
        {
            var officerDetails = GetOfficerDetails();

            // Prepare parameters for PostgreSQL function
            var roleParam = new NpgsqlParameter("p_role", officerDetails!.Role);
            var accessLevelParam = new NpgsqlParameter("p_access_level", officerDetails.AccessLevel);
            var accessCodeParam = new NpgsqlParameter("p_access_code", officerDetails.AccessCode);
            var applicationStatusParam = type != null ? new NpgsqlParameter("p_application_status", type) : new NpgsqlParameter("p_application_status", DBNull.Value);
            var serviceIdParam = new NpgsqlParameter("p_service_id", Serviceid);
            var pageIndexParam = new NpgsqlParameter("p_page_index", pageIndex);
            var pageSizeParam = new NpgsqlParameter("p_page_size", pageSize);
            var isPaginatedParam = new NpgsqlParameter("p_is_paginated", scope == "InView");
            var dataTypeParam = dataType != "new" ? new NpgsqlParameter("p_data_type", dataType) : new NpgsqlParameter("p_data_type", DBNull.Value);

            List<CitizenApplications> response;

            var service = dbcontext.Services.FirstOrDefault(s => s.Serviceid == Serviceid);
            if (service == null) return JsonConvert.SerializeObject(new { data = new List<dynamic>(), columns = new List<dynamic>(), poolData = new List<dynamic>(), totalRecords = 0 });

            var workflow = JsonConvert.DeserializeObject<List<dynamic>>(service.Officereditablefield!);
            dynamic authorities = workflow!.FirstOrDefault(p => p.designation == officerDetails.Role)!;

            if (type == "shifted")
            {
                // For shifted applications - we'll need a separate PostgreSQL function or handle differently
                // For now, we'll use direct query as fallback
                response = dbcontext.CitizenApplications
                    .Where(ca => ca.Serviceid == Serviceid)
                    .ToList()
                    .Where(ca =>
                    {
                        var wf = JsonConvert.DeserializeObject<JArray>(ca.Workflow!);
                        var currentPlayer = wf?.FirstOrDefault(o => (int)o["playerId"]! == ca.Currentplayer!);
                        return currentPlayer != null && (string)currentPlayer["status"]! == "shifted";
                    })
                    .ToList();
            }
            else
            {
                // Call PostgreSQL function
                response = dbcontext.CitizenApplications
                    .FromSqlRaw(
                        "SELECT * FROM get_applications_for_officer({0}, {1}, {2}, {3}, {4}, {5}, {6}, {7}, {8})",
                        roleParam.Value, accessLevelParam.Value, accessCodeParam.Value,
                        applicationStatusParam.Value, serviceIdParam.Value, pageIndexParam.Value,
                        pageSizeParam.Value, isPaginatedParam.Value, dataTypeParam.Value)
                    .ToList();
            }

            // Calculate total records for pagination
            int totalRecords = type == "shifted" ? response.Count : 0;
            if (type != "shifted" && scope == "InView")
            {
                // For paginated results, we need to get total count separately
                totalRecords = dbcontext.CitizenApplications
                    .FromSqlRaw(
                        "SELECT * FROM get_applications_for_officer({0}, {1}, {2}, {3}, {4}, 0, 1000000, false, {5})",
                        roleParam.Value, accessLevelParam.Value, accessCodeParam.Value,
                        applicationStatusParam.Value, serviceIdParam.Value, dataTypeParam.Value)
                    .Count();
            }

            // Deserialize column order and visibility
            var orderedColumns = JsonConvert.DeserializeObject<List<string>>(columnOrder ?? "[]")!;
            var visibility = JsonConvert.DeserializeObject<Dictionary<string, bool>>(columnVisibility ?? "{}")!;

            // Base columns
            List<dynamic> baseColumns = new List<dynamic>
            {
                new { accessorKey = "sno", header = "S.No" },
                new { accessorKey = "referenceNumber", header = "Reference Number" },
                new { accessorKey = "applicantName", header = "Applicant Name" },
                new { accessorKey = "serviceName", header = "Service Name" },
                new { accessorKey = "status", header = "Application Status" },
                new { accessorKey = "submissionDate", header = "Citizen Submission Date" },
                new { accessorKey = "actionTakenOn", header = "Action Taken On" },
                new { accessorKey = "customActions", header = "Actions" }
            };

            // Apply ordering and visibility
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
                // Filter columns based on visibility
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
                var formDetails = JsonConvert.DeserializeObject<dynamic>(details.Formdetails!);
                var officers = JsonConvert.DeserializeObject<JArray>(details.Workflow!);
                var currentPlayer = details.Currentplayer;

                var latestHistory = dbcontext.Actionhistory
                    .Where(h => h.Referencenumber == details.Referencenumber)
                    .AsEnumerable()
                    .OrderByDescending(h => DateTime.ParseExact(h.Actiontakendate, "dd MMM yyyy hh:mm:ss tt", CultureInfo.InvariantCulture))
                    .FirstOrDefault();

                var parsedDate = latestHistory != null
                    ? DateTime.ParseExact(latestHistory.Actiontakendate, "dd MMM yyyy hh:mm:ss tt", CultureInfo.InvariantCulture)
                    : DateTime.MinValue;

                // Custom Actions logic (simplified)
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
                        case "referenceNumber": item["referenceNumber"] = details.Referencenumber; break;
                        case "applicantName": item["applicantName"] = GetFieldValue("ApplicantName", formDetails); break;
                        case "serviceName": item["serviceName"] = dbcontext.Services.FirstOrDefault(s => s.Serviceid == details.Serviceid)?.Servicename; break;
                        case "status": item["status"] = details.Status; break;
                        case "submissionDate": item["submissionDate"] = details.CreatedAt; break;
                        case "actionTakenOn": item["actionTakenOn"] = parsedDate == DateTime.MinValue ? null : parsedDate.ToString("dd MMM yyyy hh:mm:ss tt"); break;
                        case "customActions": item["customActions"] = customActions; break;
                    }
                }

                if (type == "shifted")
                    data.Add(item);
                else
                    (pool!.Contains(details.Referencenumber) && type == "pending" ? poolData : data).Add(item);
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

            // Apply scope-based filtering
            var history = (scope == "InView")
                ? fullHistory.Skip(page * size).Take(size).ToList()
                : fullHistory;

            // Define full columns
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

            // Call PostgreSQL function
            var applications = dbcontext.CitizenApplications
                .FromSqlRaw("SELECT * FROM get_initiated_applications({0}, {1}, {2}, {3})",
                    userId, pageIndex, pageSize, scope == "InView")
                .ToList();

            // Get total count for pagination
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

            var sortedApplications = applications
                .ToList();

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
        // DetailedApplicationsReportDto.cs
        public class DetailedApplicationsReportDto
        {
            // Existing fields
            public string? Districtname { get; set; }
            public string? Tswofficename { get; set; }
            public string? Application_status { get; set; }
            public string? Application_pending_with { get; set; }
            public string? Referencenumber { get; set; }
            public string? Applicant_name { get; set; }
            public string? Parentage { get; set; }
            public string? Account_number { get; set; }
            public string? Ifsc_code { get; set; }
            public string? Bank_name { get; set; }
            public string? Branch_name { get; set; }

            // === NEW FIELDS ADDED ===

            // Present Address Fields
            public string? Present_address { get; set; }
            public string? Present_district { get; set; }
            public string? Present_tehsil { get; set; }

            // Permanent Address Fields
            public string? Permanent_address { get; set; }
            public string? Permanent_district { get; set; }
            public string? Permanent_tehsil { get; set; }

            // Pension & Disability Fields
            public string? Pension_type { get; set; }
            public string? Type_of_disability { get; set; }
            public string? Kind_of_disability { get; set; }
            public string? Percentage_of_disability { get; set; }
            public string? Disability_others { get; set; }
            public string? Temporary_disability_valid_upto { get; set; }
            public string? Civil_condition { get; set; }
            public string? Udid_card_number { get; set; }

            // Total count (kept at the end)
            public long Totalcount { get; set; }
        }

        [HttpGet]
        public async Task<IActionResult> GetApplicationsForReport(int accessCode, int serviceId, string accessLevel, string? dataType = null, string reportType = "TehsilWise", string? statusType = null, string? ageRanges = null, int pageIndex = 0, int pageSize = 10, bool isPaginated = true)  // Add this parameter
        {
            try
            {
                var officer = GetOfficerDetails();
                _logger.LogInformation($"GetApplicationsForReport - AccessCode: {accessCode}, ServiceId: {serviceId}, AccessLevel: {accessLevel}, DataType: {dataType}, ReportType: {reportType}, StatusType: {statusType}, PageIndex: {pageIndex}, PageSize: {pageSize}, IsPaginated: {isPaginated}");

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
                            .SqlQueryRaw<TehsilWiseReportDto>(
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
                            new NpgsqlParameter("@p_division_code", NpgsqlDbType.Integer) { Value = accessLevel == "Division" ? accessCode : (object)DBNull.Value }
                        };

                        var detailedResults = dbcontext.Database
                            .SqlQueryRaw<DetailedApplicationsReportDto>(
                                "SELECT * FROM get_applications_for_officer_report(@p_role, @p_access_level, @p_access_code, @p_application_status, @p_service_id, @p_page_index, @p_page_size, @p_is_paginated, @p_data_type, @p_division_code)",
                                detailedParameters)
                            .ToList();

                        // Get the total count from the first record
                        totalRecords = (int)(detailedResults.FirstOrDefault()?.Totalcount ?? 0);
                        data = detailedResults.Cast<dynamic>().ToList();

                        columns = new List<dynamic>
                        {
                            new { accessorKey = "districtname", header = "District" },
                            new { accessorKey = "tswofficename", header = "TSWO Office" },
                            new { accessorKey = "application_status", header = "Application Status" },
                            new { accessorKey = "application_pending_with", header = "Application Pending With" },
                            new { accessorKey = "referencenumber", header = "Reference Number" },
                            new { accessorKey = "applicant_name", header = "Applicant Name" },
                            new { accessorKey = "parentage", header = "Parentage" },
                            new { accessorKey = "account_number", header = "Account Number" },
                            new { accessorKey = "ifsc_code", header = "IFSC Code" },
                            new { accessorKey = "bank_name", header = "Bank Name" },
                            new { accessorKey = "branch_name", header = "Branch Name" },
                            new { accessorKey = "present_address", header = "Present Address" },
                            new { accessorKey = "present_district", header = "Present District" },
                            new { accessorKey = "present_tehsil", header = "Present Tehsil" },
                            new { accessorKey = "permanent_address", header = "Permanent Address" },
                            new { accessorKey = "permanent_district", header = "Permanent District" },
                            new { accessorKey = "permanent_tehsil", header = "Permanent Tehsil" },
                            new { accessorKey = "pension_type", header = "Pension Type" },
                            new { accessorKey = "udid_card_number", header = "UDID Card Number" },
                            new { accessorKey = "type_of_disability", header = "Type of Disability" },
                            new { accessorKey = "kind_of_disability", header = "Kind of Disability" },
                            new { accessorKey = "percentage_of_disability", header = "Percentage of Disability" },
                            new { accessorKey = "disability_others", header = "Disability (If Others)" },
                            new { accessorKey = "temporary_disability_valid_upto", header = "Temporary Disability Valid Upto" },
                            new { accessorKey = "civil_condition", header = "Civil Condition" }
                        };
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

                // Handle different function types
                if (function == "GetApplications")
                {
                    int Serviceid = Convert.ToInt32(form["Serviceid"]);
                    string? type = form["type"];
                    var result = JsonConvert.DeserializeObject<dynamic>(
                        GetApplications(scope, columnOrder, columnVisibility, Serviceid, type, pageIndex, pageSize)
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
                else if (function == "GetApplicationsForReport")
                {
                    // Extract report parameters
                    int accessCode = Convert.ToInt32(form["accessCode"]);
                    int serviceId = Convert.ToInt32(form["serviceId"]);
                    string accessLevel = form["accessLevel"].ToString();
                    string? dataType = form["dataType"].ToString();
                    string reportType = form["reportType"].ToString();
                    string? statusType = form["statusType"].ToString();
                    string? ageRanges = form["ageRanges"].ToString();
                    bool isPaginated = scope == "InView";

                    // For "All" scope, fetch all records
                    int fetchPageIndex = pageIndex;
                    int fetchPageSize = pageSize;

                    if (scope == "All")
                    {
                        fetchPageIndex = 0;
                        fetchPageSize = int.MaxValue;
                        isPaginated = false;
                    }

                    // Call the GetApplicationsForReport endpoint directly
                    var reportResult = await GetApplicationsForReport(
                        accessCode, serviceId, accessLevel, dataType, reportType,
                        statusType, ageRanges, fetchPageIndex, fetchPageSize, isPaginated);

                    // Extract the data from the response
                    var okResult = reportResult as OkObjectResult;
                    if (okResult?.Value != null)
                    {
                        // The value should be an anonymous object with status, data, columns, etc.
                        dynamic result = okResult.Value;

                        if (result.status == true)
                        {
                            var data = result.data;
                            var columns = result.columns;

                            // Serialize the objects to JSON, then deserialize to the expected format
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

                if (dataList == null || !dataList.Any())
                {
                    return Json(new { status = false, error = "No data to export." });
                }

                // Generate file based on format
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