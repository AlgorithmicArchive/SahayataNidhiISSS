using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using System.IO;
using iText.Kernel.Geom;
using iText.Kernel.Pdf;
using iText.Layout;
using iText.Layout.Element;
using iText.Layout.Properties;
using Microsoft.AspNetCore.Mvc;
using Npgsql;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using SahayataNidhi.Models.Entities;
using iText.IO.Image;
using iText.Kernel.Colors;
using iText.Layout.Borders;
using iText.Kernel.Pdf.Canvas;
using System.Data;
using System.Dynamic;
using Microsoft.Extensions.Caching.Memory;
using NpgsqlTypes;
using System.Security.Claims;
using SahayataNidhi.Models;
using System.ComponentModel.DataAnnotations.Schema;
using iText.Kernel.Events;
using iText.Kernel.Font;
using iText.IO.Font.Constants;


namespace SahayataNidhi.Controllers.Officer
{
    public partial class OfficerController : Controller
    {
        public class LegacyStatusCounts
        {
            public int TotalApplications { get; set; }
            public int PendingCount { get; set; }
            public int ForwardedCount { get; set; }
            public int SanctionedCount { get; set; }
            public int RejectCount { get; set; }
        }

        public class TemporaryDisability
        {
            public int TemporaryDisabilityExpiringSoonCount { get; set; }
            public int TotalPhysicallyChallengedApplications { get; set; }
        }

        // Requires: using Newtonsoft.Json.Linq;  (for JObject, used by service_specific_counts parsing below)
        //
        // DTOs matching the FIXED-shape jsonb columns in dashboard_statistics
        // (main_counts, legacy_counts, corrigendum_counts, correction_counts,
        // withheld_counts — same keys for every service/row). service_specific_counts
        // is intentionally NOT modeled as a DTO here since its shape varies by
        // service (see JObject.Parse usage further down).
        // Keys must match exactly what refresh_dashboard_statistics_row() writes.

        public class MainOrLegacyCountsDto
        {
            public int Total { get; set; }
            public int Pending { get; set; }
            public int Rejected { get; set; }
            public int Returned { get; set; }
            public int Forwarded { get; set; }
            public int Sanctioned { get; set; }
            public int Returnedtoedit { get; set; }
            public int Forwardedsanctioned { get; set; }
        }

        public class CorrigendumCountsDto
        {
            public int Total { get; set; }
            public int Pending { get; set; }
            public int Rejected { get; set; }
            public int Returned { get; set; }
            public int Forwarded { get; set; }
            public int Sanctioned { get; set; }
            public int Forwardedsanctioned { get; set; }
        }

        public class CorrectionCountsDto
        {
            public int Total { get; set; }
            public int Pending { get; set; }
            public int Rejected { get; set; }
            public int Returned { get; set; }
            public int Verified { get; set; }
            public int Forwarded { get; set; }
            public int Forwardedverified { get; set; }
        }

        public class WithheldCountsDto
        {
            public int Total { get; set; }
            public int Pending { get; set; }
            public int Approved { get; set; }
            public int Rejected { get; set; }
            public int Returned { get; set; }
            public int Forwarded { get; set; }
            public int Forwardedapproved { get; set; }
        }

        // ═══════════════════════════════════════════════════════════════════════
        // DTO for search_withheld_applications_for_officer result set.
        // Column names must match the RETURNS TABLE signature exactly.
        // ═══════════════════════════════════════════════════════════════════════
        public class WithheldApplicationSearchDto
        {
            [Column("totalrecords")] public long Totalrecords { get; set; }
            [Column("withheldid")] public long WithheldId { get; set; }  // ✅ ADDED
            [Column("sno")] public long Sno { get; set; }
            [Column("referencenumber")] public string? Referencenumber { get; set; }
            [Column("applicantname")] public string? Applicantname { get; set; }
            [Column("withheldtype")] public string? Withheldtype { get; set; }
            [Column("withheldreason")] public string? Withheldreason { get; set; }
            [Column("divisionname")] public string? Divisionname { get; set; }
            [Column("districtname")] public string? Districtname { get; set; }
            [Column("tehsilname")] public string? Tehsilname { get; set; }
            [Column("iswithheld")] public bool? Iswithheld { get; set; }
        }

        // DTO for search_corrigendum_applications_for_officer result set.
        // jsonb columns are mapped to string — Npgsql serialises them as JSON text,
        // which is then deserialised again where needed (workflow, history, fields).
        public class CorrigendumSearchDto
        {
            [Column("corrigendumid")] public string? Corrigendumid { get; set; }
            [Column("referencenumber")] public string? Referencenumber { get; set; }
            [Column("location")] public string? Location { get; set; }
            [Column("corrigendumfields")] public string? Corrigendumfields { get; set; }
            [Column("workflow")] public string? Workflow { get; set; }
            [Column("currentplayer")] public int Currentplayer { get; set; }
            [Column("type")] public string? Type { get; set; }
            [Column("history")] public string? History { get; set; }
            [Column("status")] public string? Status { get; set; }
            [Column("createdat")] public DateTime Createdat { get; set; }
            [Column("latest_wf_status")] public string? Latest_wf_status { get; set; }
            [Column("latest_wf_designation")] public string? Latest_wf_designation { get; set; }
            [Column("latest_wf_completed_at")] public string? Latest_wf_completed_at { get; set; }
            [Column("location_flat")] public string? Location_flat { get; set; }
            [Column("serviceid")] public int? Serviceid { get; set; }
            [Column("datatype")] public string? Datatype { get; set; }
            [Column("applicantname")] public string? Applicantname { get; set; }
            [Column("divisionname")] public string? Divisionname { get; set; }
            [Column("districtname")] public string? Districtname { get; set; }
            [Column("tehsilname")] public string? Tehsilname { get; set; }
            [Column("totalrecords")] public long Totalrecords { get; set; }
        }

        [HttpGet]
        public IActionResult GetIfSameUdidNumber(string referenceNumber, string udidNumber)
        {
            var application = dbcontext.CitizenApplications
                .FirstOrDefault(ca => ca.Referencenumber == referenceNumber);

            var formDetails = JToken.Parse(application!.Formdetails!);

            var udidField = FormJsonHelper.FindFieldRecursively(formDetails, "UdidCardNumber");

            // If the UDID field does not exist or has no value, allow it.
            if (udidField == null || string.IsNullOrWhiteSpace((string?)udidField["value"]))
            {
                return Json(new { status = true });
            }

            var existingUdidNumber = (string?)udidField["value"];

            // Allow if the UDID number matches the existing record.
            if (udidNumber == existingUdidNumber)
            {
                return Json(new { status = true });
            }

            return Json(new
            {
                status = false,
                message = "UDID Number doesn't match the existing one in the record."
            });
        }

        [HttpGet]
        public IActionResult GetLegacyCount(int Serviceid)
        {
            // Validate officer authentication
            var officer = GetOfficerDetails();
            if (officer == null)
                return Unauthorized("Officer authentication failed.");

            // Validate service
            var service = dbcontext.Services.FirstOrDefault(s => s.Serviceid == Serviceid);
            if (service == null)
                return NotFound("Service not found.");

            // Parse workflow
            if (string.IsNullOrEmpty(service.Officereditablefield))
                return Json(new { countList = new List<object>(), canSanction = false });

            // Prepare PostgreSQL parameters (order must match function signature)
            var parameters = new[]
            {
                new NpgsqlParameter("@accesslevel", officer.AccessLevel),
                new NpgsqlParameter("@accesscode", officer.AccessCode ?? (object)DBNull.Value),
                new NpgsqlParameter("@serviceid", Serviceid),
                new NpgsqlParameter("@divisioncode", officer.AccessLevel == "Division" ? officer.AccessCode : (object)DBNull.Value)
            };

            // Execute PostgreSQL function – ensure your LegacyStatusCounts class has the correct properties
            var counts = dbcontext.Database
                .SqlQueryRaw<LegacyStatusCounts>(
                    "SELECT * FROM get_legacy_status_count(@accesslevel, @accesscode, @serviceid, @divisioncode)",
                    parameters
                )
                .AsEnumerable()
                .FirstOrDefault() ?? new LegacyStatusCounts();

            // Build count list for the dashboard
            var countList = new List<object>
            {
                new
                {
                    label = "Total Applications",
                    count = counts.TotalApplications,
                    bgColor = "#6A1B9A",
                    textColor = "#FFFFFF",
                    tableTitle = "Total Legacy Applications",
                },
                new
                {
                    label = "Pending",
                    count = counts.PendingCount,
                    bgColor = "#FF9800",
                    textColor = "#FFFFFF",
                    tableTitle = "Pending Legacy Applications",
                },
                new
                {
                    label = "Forwarded",
                    count = counts.ForwardedCount,
                    bgColor = "#2196F3",
                    textColor = "#FFFFFF",
                    tableTitle = "Forwarded Legacy Applications",
                },
                new
                {
                    label = "Sanctioned",
                    count = counts.SanctionedCount,
                    bgColor = "#4CAF50",
                    textColor = "#FFFFFF",
                    tableTitle = "Sanctioned Legacy Applications",
                },
                new
                {
                    label = "Rejected",
                    count = counts.RejectCount,
                    bgColor = "#F44336",
                    textColor = "#FFFFFF",
                    tableTitle = "Rejected Legacy Applications",
                }
            };

            return Json(new { countList });
        }

        [HttpGet]
        public async Task<IActionResult> GetApplicationsCount(int Serviceid)
        {
            var officer = GetOfficerDetails();
            if (officer == null) return Unauthorized("Officer authentication failed.");

            var service = dbcontext.Services.FirstOrDefault(s => s.Serviceid == Serviceid);
            if (service == null) return NotFound("Service not found.");

            try
            {
                if (string.IsNullOrEmpty(service.Officereditablefield))
                    return Json(new { countList = new List<object>(), corrigendumList = new List<object>(), correctionList = new List<object>(), amendmentList = new List<object>(), withheldCountList = new List<object>(), citizenPendingList = new List<object>(), legacyCountList = new List<object>(), canSanction = false });

                var workflow = JsonConvert.DeserializeObject<List<dynamic>>(service.Officereditablefield) ?? new List<dynamic>();
                if (workflow.Count == 0) return Json(new { countList = new List<object>(), corrigendumList = new List<object>(), correctionList = new List<object>(), amendmentList = new List<object>(), withheldCountList = new List<object>(), citizenPendingList = new List<object>(), legacyCountList = new List<object>(), canSanction = false });

                dynamic authority = workflow.FirstOrDefault(p => p.designation == officer.Role)!;
                if (authority == null) return Json(new { countList = new List<object>(), corrigendumList = new List<object>(), correctionList = new List<object>(), amendmentList = new List<object>(), withheldCountList = new List<object>(), citizenPendingList = new List<object>(), legacyCountList = new List<object>(), canSanction = false });

                var officerAuthorities = new
                {
                    CanSanction = (bool?)authority.canSanction ?? false,
                    CanHavePool = (bool?)authority.canHavePool ?? false,
                    CanForwardToPlayer = (bool?)authority.canForwardToPlayer ?? false,
                    CanReturnToPlayer = (bool?)authority.canReturnToPlayer ?? false,
                    CanCorrigendum = (bool?)authority.canCorrigendum ?? false,
                    CanReturnToCitizen = (bool?)authority.canReturnToCitizen ?? false,
                    CanManageBankFiles = (bool?)authority.canManageBankFiles ?? false,
                    CanWithhold = (bool?)authority.canWithhold ?? false,
                    CanDirectWithheld = (bool?)authority.canDirectWithheld ?? false,
                    CanValidateAadhaar = (bool?)authority.canValidateAadhaar ?? false
                };

                // --- Layer 1: Server-side cache (IMemoryCache) ---
                var cacheKey = BuildDashboardCountKey(officer.AccessLevel!, officer.AccessCode, officer.Role!, Serviceid);

                // Use Lazy<Task<...>> for single-flight: concurrent requests for same key
                // await the same Task instead of spawning parallel DB calls.
                var sw = System.Diagnostics.Stopwatch.StartNew();
                var result = await _memoryCache.GetOrCreateAsync(cacheKey, async entry =>
                {
                    entry.AbsoluteExpirationRelativeToNow = DashboardCountCacheTtl;
                    entry.SlidingExpiration = null; // no sliding — strict 60s TTL
                    return await ExecuteGetDashboardCounts(officer, Serviceid, officerAuthorities);
                });

                _logger.LogInformation("GetApplicationsCount | Serviceid: {Serviceid} | Access: {Level}/{Code} | Role: {Role} | Elapsed: {ElapsedMs} ms | CacheHit: {Hit}",
                    Serviceid, officer.AccessLevel, officer.AccessCode, officer.Role, sw.ElapsedMilliseconds, sw.ElapsedMilliseconds < 50);

                return Json(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in GetApplicationsCount for Serviceid: {Serviceid}", Serviceid);
                return Json(new
                {
                    countList = new List<object>(),
                    corrigendumList = new List<object>(),
                    correctionList = new List<object>(),
                    amendmentList = new List<object>(),
                    withheldCountList = new List<object>(),
                    citizenPendingList = new List<object>(),
                    legacyCountList = new List<object>(),
                    canSanction = false,
                    error = $"Failed to load dashboard counts: {ex.Message}"
                });
            }
        }

        /// <summary>
        /// Executes the DB function and builds the JSON result payload.
        /// Extracted so it can be used by the cache factory.
        /// </summary>
        private async Task<object> ExecuteGetDashboardCounts(OfficerDetailsModal officer, int Serviceid, dynamic officerAuthorities)
        {
            // ✅ Use NpgsqlCommand directly — bypass EF Core SqlQueryRaw mapping issues
            var connection = dbcontext.Database.GetDbConnection();
            await connection.OpenAsync();

            await using var command = connection.CreateCommand();
            command.CommandText = "SELECT * FROM get_dashboard_counts(@accesslevel, @accesscode, @serviceid, @takenby, @divisioncode, @datatype)";
            command.Parameters.Add(new NpgsqlParameter("@accesslevel", officer.AccessLevel));
            command.Parameters.Add(new NpgsqlParameter("@accesscode", officer.AccessCode ?? (object)DBNull.Value));
            command.Parameters.Add(new NpgsqlParameter("@serviceid", Serviceid));
            command.Parameters.Add(new NpgsqlParameter("@takenby", officer.Role));
            command.Parameters.Add(new NpgsqlParameter("@divisioncode", officer.AccessLevel == "Division" ? officer.AccessCode : DBNull.Value));
            command.Parameters.Add(new NpgsqlParameter("@datatype", DBNull.Value));

            await using var reader = await command.ExecuteReaderAsync();
            var counts = new DashboardCounts();

            if (await reader.ReadAsync())
            {
                counts.PendingCount = reader.GetInt32(0);
                counts.ForwardedCount = reader.GetInt32(1);
                counts.ReturnedCount = reader.GetInt32(2);
                counts.ReturnToEditCount = reader.GetInt32(3);
                counts.SanctionedCount = reader.GetInt32(4);
                counts.RejectCount = reader.GetInt32(5);
                counts.DisbursedCount = reader.GetInt32(6);
                counts.TotalApplications = reader.GetInt32(7);
                counts.ForwardedSanctionedCount = reader.GetInt32(8);
                counts.ForwardedSanctionedCorrigendumCount = reader.GetInt32(9);
                counts.ForwardedVerifiedCorrectionCount = reader.GetInt32(10);
                counts.CorrigendumPendingCount = reader.GetInt32(11);
                counts.CorrigendumForwardedCount = reader.GetInt32(12);
                counts.CorrigendumReturnedCount = reader.GetInt32(13);
                counts.CorrigendumSanctionedCount = reader.GetInt32(14);
                counts.CorrigendumRejectedCount = reader.GetInt32(15);
                counts.CorrigendumCount = reader.GetInt32(16);
                counts.CorrectionPendingCount = reader.GetInt32(17);
                counts.CorrectionForwardedCount = reader.GetInt32(18);
                counts.CorrectionReturnedCount = reader.GetInt32(19);
                counts.CorrectionSanctionedCount = reader.GetInt32(20);
                counts.CorrectionRejectedCount = reader.GetInt32(21);
                counts.CorrectionCount = reader.GetInt32(22);
                counts.AmendmentPendingCount = reader.GetInt32(23);
                counts.AmendmentForwardedCount = reader.GetInt32(24);
                counts.AmendmentReturnedCount = reader.GetInt32(25);
                counts.AmendmentSanctionedCount = reader.GetInt32(26);
                counts.AmendmentRejectedCount = reader.GetInt32(27);
                counts.AmendmentCount = reader.GetInt32(28);
                counts.TotalWithheldCount = reader.GetInt32(29);
                counts.TemporaryWithheldCount = reader.GetInt32(30);
                counts.PermanentWithheldCount = reader.GetInt32(31);
                counts.WithheldPendingCount = reader.GetInt32(32);
                counts.WithheldForwardedCount = reader.GetInt32(33);
                counts.WithheldApprovedCount = reader.GetInt32(34);
                counts.ShiftedCount = reader.GetInt64(35);
                counts.TemporaryDisabilityExpiringSoonCount = reader.GetInt64(36);
                counts.TotalPhysicallyChallengedApplications = reader.GetInt64(37);
                counts.LegacyTotal = reader.GetInt32(38);
                counts.LegacyPending = reader.GetInt32(39);
                counts.LegacyForwarded = reader.GetInt32(40);
                counts.LegacySanctioned = reader.GetInt32(41);
                counts.LegacyRejected = reader.GetInt32(42);
            }

            await reader.CloseAsync();


            var countList = new List<object>
            {
                new { label = "Total Applications", count = counts.TotalApplications, bgColor = "#6A1B9A", textColor = "#FFFFFF", tableTitle = "Total Applications", forwardedSanctionedCount = counts.ForwardedSanctionedCount },
                new { label = "Pending",            count = counts.PendingCount,      bgColor = "#FF9800", textColor = "#FFFFFF", tableTitle = "Pending Applications" }
            };

            if (officerAuthorities.CanForwardToPlayer)
            {
                countList.Add(new { label = "Forwarded", count = counts.ForwardedCount, bgColor = "#2196F3", textColor = "#FFFFFF", tableTitle = "Forwarded Applications" });
            }

            if (officerAuthorities.CanReturnToPlayer)
            {
                countList.Add(new { label = "Returned", count = counts.ReturnedCount, bgColor = "#f97316", textColor = "#FFFFFF", tableTitle = "Returned Applications" });
            }

            if (officerAuthorities.CanReturnToCitizen)
            {
                countList.Add(new
                {
                    label = "Pending With Citizen",
                    count = counts.ReturnToEditCount,
                    bgColor = "#CE93D8",
                    textColor = "#4A148C",
                    tooltipText = "Application is pending at Citizen level for correction.",
                    tableTitle = "Pending With Citizen Applications"
                });
            }

            if (officerAuthorities.CanSanction)
            {
                countList.Add(new { label = "Sanctioned", count = counts.SanctionedCount, bgColor = "#4CAF50", textColor = "#FFFFFF", tableTitle = "Sanctioned Applications" });
            }

            countList.Add(new { label = "Rejected", count = counts.RejectCount, bgColor = "#F44336", textColor = "#FFFFFF", tableTitle = "Rejected Applications" });

            // Citizen pending (unchanged) — for officers who can't return to citizen
            var citizenPendingList = new List<object>();
            if (!officerAuthorities.CanReturnToCitizen)
            {
                citizenPendingList.Add(new
                {
                    label = "Pending With Citizen",
                    count = counts.ReturnToEditCount,
                    bgColor = "#CE93D8",
                    textColor = "#4A148C",
                    tooltipText = "Applications returned to citizens, awaiting resubmission.",
                    tableTitle = "Pending With Citizen Applications"
                });
            }


            // Build corrigendum list
            var corrigendumList = new List<object>();
            if (counts.CorrigendumCount > 0 || officerAuthorities.CanCorrigendum)
            {
                corrigendumList.Add(new { label = "Total Corrigendum", count = counts.CorrigendumCount, bgColor = "#5B21B6", textColor = "#FFFFFF", tableTitle = "Total Corrigendum Applications", forwardedSanctionedCount = counts.ForwardedSanctionedCorrigendumCount });
                if (counts.CorrigendumPendingCount > 0) corrigendumList.Add(new { label = "Pending", count = counts.CorrigendumPendingCount, bgColor = "#F76F15", textColor = "#FFFFFF", tableTitle = "Pending Corrigendum" });
                if (counts.CorrigendumForwardedCount > 0) corrigendumList.Add(new { label = "Forwarded", count = counts.CorrigendumForwardedCount, bgColor = "#0ea5e9", textColor = "#FFFFFF", tableTitle = "Forwarded Corrigendum" });
                if (counts.CorrigendumReturnedCount > 0) corrigendumList.Add(new { label = "Returned", count = counts.CorrigendumReturnedCount, bgColor = "#f97316", textColor = "#FFFFFF", tableTitle = "Returned Corrigendum" });
                if (counts.CorrigendumSanctionedCount > 0) corrigendumList.Add(new { label = "Sanctioned", count = counts.CorrigendumSanctionedCount, bgColor = "#10b981", textColor = "#FFFFFF", tableTitle = "Sanctioned Corrigendum" });
                if (counts.CorrigendumRejectedCount > 0) corrigendumList.Add(new { label = "Rejected", count = counts.CorrigendumRejectedCount, bgColor = "#ef4444", textColor = "#FFFFFF", tableTitle = "Rejected Corrigendum" });
            }

            // Build correction list
            var correctionList = new List<object>();
            if (counts.CorrectionCount > 0)
            {
                correctionList.Add(new { label = "Total Correction", count = counts.CorrectionCount, bgColor = "#0D9488", textColor = "#FFFFFF", tableTitle = "Total Correction Applications", forwardedSanctionedCount = counts.ForwardedVerifiedCorrectionCount });
                if (counts.CorrectionPendingCount > 0) correctionList.Add(new { label = "Pending", count = counts.CorrectionPendingCount, bgColor = "#F76F15", textColor = "#FFFFFF", tableTitle = "Pending Correction" });
                if (counts.CorrectionForwardedCount > 0) correctionList.Add(new { label = "Forwarded", count = counts.CorrectionForwardedCount, bgColor = "#0ea5e9", textColor = "#FFFFFF", tableTitle = "Forwarded Correction" });
                if (counts.CorrectionReturnedCount > 0) correctionList.Add(new { label = "Returned", count = counts.CorrectionReturnedCount, bgColor = "#f97316", textColor = "#FFFFFF", tableTitle = "Returned Correction" });
                if (counts.CorrectionSanctionedCount > 0) correctionList.Add(new { label = "Verified", count = counts.CorrectionSanctionedCount, bgColor = "#10b981", textColor = "#FFFFFF", tableTitle = "Verified Correction" });
                if (counts.CorrectionRejectedCount > 0) correctionList.Add(new { label = "Rejected", count = counts.CorrectionRejectedCount, bgColor = "#ef4444", textColor = "#FFFFFF", tableTitle = "Rejected Correction" });
            }

            // Build amendment list
            var amendmentList = new List<object>();
            if (counts.AmendmentCount > 0)
            {
                amendmentList.Add(new { label = "Total Amendment", count = counts.AmendmentCount, bgColor = "#15803D", textColor = "#FFFFFF", tableTitle = "Total Amendment Applications" });
                if (counts.AmendmentPendingCount > 0) amendmentList.Add(new { label = "Pending", count = counts.AmendmentPendingCount, bgColor = "#F76F15", textColor = "#FFFFFF", tableTitle = "Pending Amendment" });
                if (counts.AmendmentForwardedCount > 0) amendmentList.Add(new { label = "Forwarded", count = counts.AmendmentForwardedCount, bgColor = "#0ea5e9", textColor = "#FFFFFF", tableTitle = "Forwarded Amendment" });
                if (counts.AmendmentReturnedCount > 0) amendmentList.Add(new { label = "Returned", count = counts.AmendmentReturnedCount, bgColor = "#f97316", textColor = "#FFFFFF", tableTitle = "Returned Amendment" });
                if (counts.AmendmentSanctionedCount > 0) amendmentList.Add(new { label = "Sanctioned", count = counts.AmendmentSanctionedCount, bgColor = "#10b981", textColor = "#FFFFFF", tableTitle = "Sanctioned Amendment" });
                if (counts.AmendmentRejectedCount > 0) amendmentList.Add(new { label = "Rejected", count = counts.AmendmentRejectedCount, bgColor = "#ef4444", textColor = "#FFFFFF", tableTitle = "Rejected Amendment" });
            }



            // Shifted
            if (counts.ShiftedCount > 0)
            {
                countList.Add(new { label = "Shifted To Another Location", count = counts.ShiftedCount, tableTitle = "Shifted Applications", bgColor = "#ec4899", textColor = "#FFFFFF" });
            }

            // Withheld
            var withheldCountList = new List<object>
        {
            new { label = "Total Withheld Applications", count = counts.TotalWithheldCount, tooltipText = "Total Withheld Applications", tableTitle = "Total Withheld Applications", bgColor = "#FFCC00", textColor = "#000000" },
            // new { label = "Temporary Withheld", count = counts.TemporaryWithheldCount, tooltipText = "Temporary Withheld Applications", tableTitle = "Temporary Withheld Applications", bgColor = "#F76F15", textColor = "#FFFFFF" },
            // new { label = "Permanent Withheld", count = counts.PermanentWithheldCount, tooltipText = "Permanent Withheld Applications", tableTitle = "Permanent Withheld Applications", bgColor = "#b91c1c", textColor = "#FFFFFF" },
            new { label = "Withheld Pending", count = counts.WithheldPendingCount, tooltipText = "Withheld Applications with Pending Status", tableTitle = "Withheld Pending Applications", bgColor = "#FFCC00", textColor = "#000000" },
            new { label = "Withheld Forwarded", count = counts.WithheldForwardedCount, tooltipText = "Withheld Applications with Forwarded Status", tableTitle = "Withheld Forwarded Applications", bgColor = "#FFCC00", textColor = "#000000" },
            new { label = "Withheld Approved", count = counts.WithheldApprovedCount, tooltipText = "Withheld Applications with Approved Status", tableTitle = "Withheld Approved Applications", bgColor = "#FFCC00", textColor = "#000000" }
        };

            // Temp disability (serviceid == 1 only)
            var temporaryCountList = Serviceid == 1 ? new List<object>
        {
            new { label = "PCP Applications", count = counts.TotalPhysicallyChallengedApplications, tooltipText = "Physically Challenged Applicants", tableTitle = "Total PCP Applications", bgColor = "#3b82f6", textColor = "#FFFFFF" },
            new { label = "PCP-UDID Expires in 3 Months", count = counts.TemporaryDisabilityExpiringSoonCount, tooltipText = "Physically Challenged Applicants with Temporary Disability, UDID Card Expiring Soon", tableTitle = "Expiring Eligibility Applications", bgColor = "#14b8a6", textColor = "#FFFFFF" }
        } : new List<object>();

            // Legacy counts
            var legacyCountList = new List<object>
        {
            new { label = "Total Applications", count = counts.LegacyTotal, bgColor = "#6A1B9A", textColor = "#FFFFFF", tableTitle = "Total Legacy Applications" },
            new { label = "Pending", count = counts.LegacyPending, bgColor = "#FF9800", textColor = "#FFFFFF", tableTitle = "Pending Legacy Applications" },
            new { label = "Forwarded", count = counts.LegacyForwarded, bgColor = "#2196F3", textColor = "#FFFFFF", tableTitle = "Forwarded Legacy Applications" },
            new { label = "Sanctioned", count = counts.LegacySanctioned, bgColor = "#4CAF50", textColor = "#FFFFFF", tableTitle = "Sanctioned Legacy Applications" },
            new { label = "Rejected", count = counts.LegacyRejected, bgColor = "#F44336", textColor = "#FFFFFF", tableTitle = "Rejected Legacy Applications" }
        };

            // Build result
            var result = new ExpandoObject();
            var dict = (IDictionary<string, object>)result!;

            dict["countList"] = countList;
            dict["corrigendumList"] = corrigendumList;
            dict["correctionList"] = correctionList;
            dict["amendmentList"] = amendmentList;
            dict["withheldCountList"] = withheldCountList;
            dict["citizenPendingList"] = citizenPendingList;
            dict["legacyCountList"] = legacyCountList;
            dict["canSanction"] = officerAuthorities.CanSanction;
            dict["canHavePool"] = officerAuthorities.CanHavePool;
            dict["canCorrigendum"] = officerAuthorities.CanCorrigendum;
            dict["officerAuthorities"] = officerAuthorities;

            if (Serviceid == 1)
                dict["temporaryCountList"] = temporaryCountList;

            return result;
        }


        private static DateTime? SafeParseDate(string? dateString)
        {
            if (string.IsNullOrWhiteSpace(dateString))
                return null;

            dateString = dateString.Trim();

            // List of formats to try
            var formats = new[]
            {
                "dd MMM yyyy hh:mm:ss tt",     // 18 Dec 2025 02:13:25 PM
                "dd-MM-yyyy HH:mm:ss",         // 01-01-2025 14:13:25
                "dd-MM-yyyy hh:mm:ss tt",      // 01-01-2025 02:13:25 PM
                "dd/MM/yyyy HH:mm:ss",         // 01/01/2025 14:13:25
                "yyyy-MM-dd HH:mm:ss",         // 2025-01-01 14:13:25
                "dd MMM yyyy HH:mm:ss",        // 18 Dec 2025 14:13:25
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

            // Fallback: let .NET try its best
            if (DateTime.TryParse(dateString, CultureInfo.InvariantCulture, DateTimeStyles.None, out parsed))
            {
                return parsed;
            }

            return null;
        }

        /// <summary>
        /// Result describing which location levels a service's form actually uses.
        /// Services differ in the child level beneath "District" (Tehsil, Block,
        /// Muncipality, ...) and some have no child level at all.
        /// </summary>
        private class ServiceLocationFields
        {
            public bool HasDistrict { get; set; }
            public bool HasChildLocation { get; set; }
            public string ChildLocationHeader { get; set; } = "Tehsil Name";
        }

        /// <summary>
        /// Parses a service's Formelement JSON to determine its location hierarchy.
        /// Looks at the "Location" section (or any section) for select fields named
        /// District and its direct child (a select whose valueDependentOn is "District",
        /// or the location select that is not the District field). The child's label is
        /// used to build the dynamic column header (e.g. "Tehsil Name", "Block Name").
        /// </summary>
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

        [HttpGet]
        public async Task<IActionResult> DownloadSanctionLetter(string fileName)
        {
            var userId = Convert.ToInt32(User.FindFirst(ClaimTypes.NameIdentifier)?.Value);
            try
            {
                var sanctionLetter = await dbcontext.Userdocuments
                    .FirstOrDefaultAsync(sl => sl.Filename == fileName);
                if (sanctionLetter == null)
                    return NotFound($"Sanction letter for Filename {fileName} not found.");

                // Log the download action
                _auditService.InsertLog(HttpContext, "Download File", "Sanction Letter downloaded successfully.", userId, "Success");

                // Return the file
                return File(sanctionLetter.Filedata, "application/pdf", sanctionLetter.Filename);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"An error occurred while downloading the sanction letter. {ex}");
            }
        }

        [HttpGet]
        public IActionResult GetApplications(int Serviceid, string type, int pageIndex = 0, int pageSize = 10, string? dataType = null, string? searchQuery = null)
        {
            var officerDetails = GetOfficerDetails();

            // ========== VALIDATE WORKFLOW ==========
            var service = dbcontext.Services.FirstOrDefault(s => s.Serviceid == Serviceid);
            if (service == null) return NotFound();

            var workflow = JsonConvert.DeserializeObject<List<dynamic>>(service.Officereditablefield!);
            if (workflow == null || workflow.Count == 0)
                return Json(new { countList = new List<dynamic>(), canSanction = false });

            dynamic authorities = workflow.FirstOrDefault(p => p.designation == officerDetails.Role)!;
            if (authorities == null)
                return Json(new { countList = new List<dynamic>(), canSanction = false });

            // =====================================================================
            //                       GET TOTAL RECORDS  (main list only)
            // =====================================================================
            int totalRecords = 0;
            bool poolMode = type == "pending" || type == "pushedtopool" || type == "pool";

            try
            {
                var statusCountParameters = new[]
                {
            new NpgsqlParameter("@p_access_level", officerDetails.AccessLevel),
            new NpgsqlParameter("@p_access_code", officerDetails.AccessCode ?? (object)DBNull.Value),
            new NpgsqlParameter("@p_service_id", Serviceid),
            new NpgsqlParameter("@p_taken_by", officerDetails.Role),
            new NpgsqlParameter("@p_division_code",
                officerDetails.AccessLevel == "Division"
                    ? officerDetails.AccessCode ?? (object)DBNull.Value
                    : (object)DBNull.Value),
            new NpgsqlParameter("@p_data_type",
                string.Equals(dataType, "legacy", StringComparison.OrdinalIgnoreCase)
                    ? (object)dataType! : DBNull.Value)
        };

                var statusCountResult = dbcontext.Database
                    .SqlQueryRaw<DashboardCounts>(
                        "SELECT * FROM get_dashboard_counts(@accesslevel, @accesscode, @serviceid, @takenby, @divisioncode, @datatype)",
                        statusCountParameters)
                    .FirstOrDefault();

                if (statusCountResult != null)
                {
                    switch (type)
                    {
                        case "total": totalRecords = statusCountResult.TotalApplications; break;
                        case "pending": totalRecords = statusCountResult.PendingCount; break;
                        case "forwarded": totalRecords = statusCountResult.ForwardedCount; break;
                        case "returned": totalRecords = statusCountResult.ReturnedCount; break;
                        case "returntoedit": totalRecords = statusCountResult.ReturnToEditCount; break;
                        case "sanctioned": totalRecords = statusCountResult.SanctionedCount; break;
                        case "rejected": totalRecords = statusCountResult.RejectCount; break;
                        case "disbursed": totalRecords = statusCountResult.DisbursedCount; break;
                        case "pushedtopool":
                        case "pool":
                            // Pool total comes from pool fetch below
                            break;
                        default: totalRecords = 0; break;
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error getting status count for type {type}: {ex.Message}");
            }

            // =====================================================================
            //                       FETCH MAIN LIST
            // =====================================================================
            List<OfficerApplicationDto> response;

            if (type == "shifted")
            {
                var shiftedParameters = new[]
                {
            new NpgsqlParameter("@role", officerDetails.Role),
            new NpgsqlParameter("@accesslevel", officerDetails.AccessLevel),
            new NpgsqlParameter("@accesscode", officerDetails.AccessCode ?? (object)DBNull.Value),
            new NpgsqlParameter("@serviceid", Serviceid)
        };
                response = dbcontext.Database
                    .SqlQueryRaw<OfficerApplicationDto>(
                        "SELECT * FROM get_shifted_applications(@role, @accesslevel, @accesscode, @serviceid)",
                        shiftedParameters)
                    .ToList();
                totalRecords = response.Count;
            }
            else if (!string.IsNullOrEmpty(searchQuery))
            {
                var searchParameters = new[]
                {
            new NpgsqlParameter("@role", officerDetails.Role),
            new NpgsqlParameter("@accesslevel", officerDetails.AccessLevel),
            new NpgsqlParameter("@accesscode", officerDetails.AccessCode ?? (object)DBNull.Value),
            new NpgsqlParameter("@applicationstatus", (object?)type ?? DBNull.Value),
            new NpgsqlParameter("@serviceid", Serviceid),
            new NpgsqlParameter("@page_index", pageIndex),
            new NpgsqlParameter("@page_size", pageSize),
            new NpgsqlParameter("@division_code",
                officerDetails.AccessLevel == "Division"
                    ? officerDetails.AccessCode ?? (object)DBNull.Value
                    : (object)DBNull.Value),
            new NpgsqlParameter("@search_query", searchQuery)
        };
                response = dbcontext.Database
                    .SqlQueryRaw<OfficerApplicationDto>(
                        "SELECT * FROM search_applications_for_officer(@role, @accesslevel, @accesscode, @applicationstatus, @serviceid, @page_index, @page_size, @division_code, @search_query)",
                        searchParameters)
                    .ToList();
                totalRecords = response.Count;
            }
            else
            {
                var parameters = new[]
                {
            new NpgsqlParameter("@role", officerDetails.Role),
            new NpgsqlParameter("@accesslevel", officerDetails.AccessLevel),
            new NpgsqlParameter("@accesscode", officerDetails.AccessCode ?? (object)DBNull.Value),
            new NpgsqlParameter("@applicationstatus", (object?)type ?? DBNull.Value),
            new NpgsqlParameter("@serviceid", Serviceid),
            new NpgsqlParameter("@pageindex", pageIndex),
            new NpgsqlParameter("@pagesize", pageSize),
            new NpgsqlParameter("@ispaginated", true),
            new NpgsqlParameter("@datatype", dataType == "legacy" ? dataType : DBNull.Value),
            new NpgsqlParameter("@division_code",
                officerDetails.AccessLevel == "Division"
                    ? officerDetails.AccessCode ?? (object)DBNull.Value
                    : (object)DBNull.Value)
        };
                response = dbcontext.Database
                    .SqlQueryRaw<OfficerApplicationDto>(
                        "SELECT * FROM get_applications_for_officer(@role, @accesslevel, @accesscode, @applicationstatus, @serviceid, @pageindex, @pagesize, @ispaginated, @datatype, @division_code)",
                        parameters)
                    .ToList();

                if (response.Any() && response.First().TotalCount > 0)
                    totalRecords = (int)response.First().TotalCount;
                else
                    totalRecords = response.Count;
            }

            // =====================================================================
            //                       COLUMN SETUP
            // =====================================================================
            var serviceLocation = ResolveServiceLocationFields(service.Formelement);
            bool serviceHasDistrict = serviceLocation.HasDistrict;
            bool serviceHasChildLocation = serviceLocation.HasChildLocation;
            string childLocationHeader = serviceLocation.ChildLocationHeader;

            bool serviceHasRationCard = !string.IsNullOrWhiteSpace(service.Formelement)
                && service.Formelement.Contains("RationCardNumber", StringComparison.OrdinalIgnoreCase);

            // ── Detect which Present Address fields exist in this service's form ──
            // We only add a column when the field name literally appears in the
            // service form element JSON, so services without a Present Address
            // section don't get cluttered with empty columns.
            //
            // NOTE: we search with surrounding quotes ("PresentAddress") so that
            // `PresentAddressType` is not falsely matched by a search for
            // `PresentAddress`.
            var presentAddressColumns = new List<(string AccessorKey, string Header, string FieldName)>();
            bool serviceHasPresentAddress = !string.IsNullOrWhiteSpace(service.Formelement)
                && service.Formelement.Contains("Present Address Details", StringComparison.OrdinalIgnoreCase);

            if (serviceHasPresentAddress)
            {
                var presentCandidates = new (string Field, string Header)[]
                {
            ("PresentAddress",         "Present Address"),
            ("PresentAddressType",     "Present Address Type"),
            ("PresentDistrict",        "Present District"),
            ("PresentTehsil",          "Present Tehsil"),
            ("PresentBlock",           "Present Block"),
            ("PresentHalqaPanchayat",  "Present Halqa Panchayat"),
            ("PresentMuncipality",     "Present Municipality"),
            ("PresentWardNo",          "Present Ward No"),
            ("PresentVillage",         "Present Village"),
            ("PresentPincode",         "Present Pincode"),
                };

                foreach (var (field, header) in presentCandidates)
                {
                    if (service.Formelement!.Contains($"\"{field}\"", StringComparison.OrdinalIgnoreCase))
                    {
                        var accessor = char.ToLowerInvariant(field[0]) + field.Substring(1);
                        presentAddressColumns.Add((accessor, header, field));
                    }
                }
            }

            var columns = new List<dynamic>
    {
        new { accessorKey = "sno",             header = "S.No" },
        new { accessorKey = "referenceNumber", header = "Reference Number" },
        new { accessorKey = "applicantName",   header = "Applicant Name" },
        new { accessorKey = "mobileNumber",    header = "Mobile Number" }
    };

            if (serviceHasRationCard)
                columns.Add(new { accessorKey = "rationCardNumber", header = "Ration Card Number" });

            // Present Address columns — appended right after rationCardNumber so
            // they sit between the identity block and the workflow block. Kept
            // before the workflow columns so they read naturally in the grid.
            foreach (var col in presentAddressColumns)
            {
                columns.Add(new { accessorKey = col.AccessorKey, header = col.Header });
            }

            columns.Add(new { accessorKey = "serviceName", header = "Service Name" });
            columns.Add(new { accessorKey = "currentlyWith", header = "Currently With" });
            columns.Add(new { accessorKey = "status", header = "Application Status" });
            columns.Add(new { accessorKey = "officerRemarks", header = "Officer Remarks" });
            columns.Add(new { accessorKey = "submissionDate", header = "Citizen Submission Date" });
            columns.Add(new { accessorKey = "actionTakenOn", header = "Received On" });

            if (officerDetails.AccessLevel == "State")
            {
                columns.Insert(1, new { accessorKey = "divisionName", header = "Division Name" });
                if (serviceHasDistrict)
                    columns.Insert(2, new { accessorKey = "districtName", header = "District Name" });
            }
            else if (officerDetails.AccessLevel == "Division")
            {
                if (serviceHasDistrict)
                    columns.Insert(1, new { accessorKey = "districtName", header = "District Name" });
                if (serviceHasChildLocation)
                    columns.Insert(2, new { accessorKey = "tehsilName", header = childLocationHeader });
            }
            else if (officerDetails.AccessLevel == "District")
            {
                if (serviceHasChildLocation)
                    columns.Insert(1, new { accessorKey = "tehsilName", header = childLocationHeader });
            }

            // =====================================================================
            //                       POOL — read once, no pagination
            // =====================================================================
            var poolList = dbcontext.Pool.FirstOrDefault(p =>
                p.Serviceid == Serviceid &&
                p.Accesslevel == officerDetails.AccessLevel &&
                p.Accesscode == officerDetails.AccessCode &&
                p.Listtype == "Pool");

            var pool = poolList != null && !string.IsNullOrWhiteSpace(poolList.List)
                ? JsonConvert.DeserializeObject<List<string>>(poolList.List) ?? new List<string>()
                : new List<string>();

            _logger.LogInformation("Pool lookup: found={found}, count={count}",
                poolList != null, pool.Count);

            // ★ Pinned pool fetch — bypass pageIndex/pageSize entirely.
            List<OfficerApplicationDto> poolResponse = new();
            if (poolMode && pool.Count > 0)
            {
                var poolParams = new[]
                {
            new NpgsqlParameter("@role",          officerDetails.Role),
            new NpgsqlParameter("@accesslevel",   officerDetails.AccessLevel),
            new NpgsqlParameter("@accesscode",    officerDetails.AccessCode ?? (object)DBNull.Value),
            new NpgsqlParameter("@serviceid",     Serviceid),
            new NpgsqlParameter("@pageindex",     (object)0),
            new NpgsqlParameter("@pagesize",      (object)Math.Max(pool.Count, 1)),
            new NpgsqlParameter("@datatype",      dataType == "legacy" ? dataType : (object)DBNull.Value),
            new NpgsqlParameter("@division_code",
                officerDetails.AccessLevel == "Division"
                    ? officerDetails.AccessCode ?? (object)DBNull.Value
                    : (object)DBNull.Value),
            new NpgsqlParameter("@refs",          pool.ToArray())
        };

                poolResponse = dbcontext.Database
                    .SqlQueryRaw<OfficerApplicationDto>(
                        "SELECT * FROM get_pool_applications_for_officer(@role, @accesslevel, @accesscode, @serviceid, @pageindex, @pagesize, @datatype, @division_code, @refs)",
                        poolParams)
                    .ToList();

                _logger.LogInformation("Pool fetched (pinned): count={c}", poolResponse.Count);
            }

            // =====================================================================
            //                       BUILD RESULT OBJECTS
            // =====================================================================
            List<dynamic> data = new();
            List<dynamic> poolData = new();

            dynamic BuildRow(OfficerApplicationDto details, int sno, string activeType)
            {
                var formDetails = JsonConvert.DeserializeObject<dynamic>(details.FormDetails ?? "{}");
                var officers = JsonConvert.DeserializeObject<JArray>(details.WorkFlow ?? "[]");
                var currentPlayer = details.CurrentPlayer ?? 0;

                string officerDesignation = "Unknown";
                string officerAccessLevel = "Unknown";
                string officerStatus = "Unknown";
                string officerArea = "Unknown";

                if (officers != null && officers.Count > 0)
                {
                    var currentOfficerObj = currentPlayer >= 0 && currentPlayer < officers.Count
                        ? officers[currentPlayer] : officers[0];

                    if (currentOfficerObj != null)
                    {
                        officerDesignation = currentOfficerObj["designation"]?.ToString() ?? "Unknown";
                        officerAccessLevel = currentOfficerObj["accessLevel"]?.ToString() ?? "Unknown";
                        officerStatus = currentOfficerObj["status"]?.ToString() ?? "Unknown";
                    }
                    officerArea = GetOfficerArea(officerAccessLevel, formDetails);
                }

                var actionHistories = dbcontext.Actionhistory
                    .Where(h => h.Referencenumber == details.ReferenceNumber)
                    .ToList();

                var latestHistory = actionHistories
                    .Select(h => new { History = h, ParsedDate = SafeParseDate(h.Actiontakendate) })
                    .Where(x => x.ParsedDate.HasValue)
                    .OrderByDescending(x => x.ParsedDate!.Value)
                    .Select(x => x.History)
                    .FirstOrDefault();

                DateTime parsedDate = latestHistory != null && SafeParseDate(latestHistory.Actiontakendate).HasValue
                    ? SafeParseDate(latestHistory.Actiontakendate)!.Value
                    : DateTime.MinValue;

                string serviceName = dbcontext.Services
                    .FirstOrDefault(s => s.Serviceid == details.ServiceId)?.Servicename ?? "Unknown";

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

                string officerRemarks = latestHistory?.Remarks ?? string.Empty;

                var customActions = new List<dynamic>();
                JToken? currentOfficer = officers?.FirstOrDefault(o =>
                    o != null && o["designation"]?.ToString() == officerDetails.Role);

                bool canPull = currentOfficer?["canPull"] != null && (bool)currentOfficer["canPull"]!;
                bool hasBeenViewed = currentOfficer?["openedOnce"] != null && (bool)currentOfficer["openedOnce"]!;
                string myWorkflowStatus = currentOfficer?["status"]?.ToString()?.Trim().ToLower() ?? "";

                if ((activeType == "forwarded" || activeType == "returned" || activeType == "returntoedit") && canPull)
                {
                    customActions.Add(new
                    {
                        type = "Pull",
                        tooltip = "Pull Application Back",
                        color = "#F0C38E",
                        actionFunction = "pullApplication"
                    });
                }

                if (activeType == "returntoedit" && !canPull)
                {
                    customActions.Add(new
                    {
                        type = "View",
                        label = "View",
                        tooltip = "View",
                        color = "#F0C38E",
                        actionFunction = "handleViewApplication"
                    });
                }

                if (officerStatus != "returntoedit" && officerStatus != "sanctioned")
                {
                    if (myWorkflowStatus == "pending")
                    {
                        customActions.Add(new
                        {
                            type = "View",
                            label = hasBeenViewed ? "Take Action" : "View",
                            tooltip = hasBeenViewed ? "Take Action on this application" : "View Application",
                            color = hasBeenViewed ? "#10B981" : "#F0C38E",
                            actionFunction = activeType == "pending" ? "handleOpenApplication" : "handleViewApplication"
                        });
                    }
                    else
                    {
                        customActions.Add(new
                        {
                            type = "View",
                            label = "View",
                            tooltip = "View Application Details",
                            color = "#F0C38E",
                            actionFunction = "handleViewApplication"
                        });
                    }
                }
                else if (officerStatus == "sanctioned")
                {
                    customActions.Add(new
                    {
                        type = "View",
                        label = "View",
                        tooltip = "View",
                        color = "#F0C38E",
                        actionFunction = "handleViewApplication"
                    });

                    if (details.DataType != "legacy")
                    {
                        customActions.Add(new
                        {
                            tooltip = "Download SL",
                            color = "#F0C38E",
                            actionFunction = "DownloadSanctionLetter"
                        });

                        var corrigendums = dbcontext.Corrigendum
                            .Where(co => co.Referencenumber == details.ReferenceNumber).ToList();

                        foreach (var item in corrigendums)
                        {
                            string value = GetSanctionedCorrigendum(
                                JsonConvert.DeserializeObject<dynamic>(item.Workflow ?? "{}"),
                                item.Corrigendumid);

                            if (value != null)
                            {
                                customActions.Add(new
                                {
                                    type = "DownloadCorrigendum",
                                    tooltip = "View CRG " + value.TrimEnd('/').Split('/').Last(),
                                    corrigendumId = value,
                                    color = "#F0C38E",
                                    actionFunction = "handleViewPdf"
                                });
                            }
                        }
                    }
                }

                var excludedStatuses = new[] { "Rejected", "Sanctioned", "Initiated" };
                bool IsError = excludedStatuses.Contains(details.Status ?? "");
                if (!IsError) customActions.Clear();

                string Status = IsError
                    ? (officerStatus == "returntoedit"
                        ? "Pending With Citizen"
                        : (!string.IsNullOrEmpty(officerStatus)
                            ? char.ToUpper(officerStatus[0]) + officerStatus.Substring(1)
                            : "Unknown"))
                    : details.Status ?? "Unknown";

                dynamic obj = new ExpandoObject();
                var app = (IDictionary<string, object>)obj;

                if (officerDetails.AccessLevel == "State")
                {
                    app["divisionName"] = details.DivisionName ?? "N/A";
                    app["districtName"] = details.DistrictName ?? "N/A";
                }
                else if (officerDetails.AccessLevel == "Division")
                {
                    app["districtName"] = details.DistrictName ?? "N/A";
                    app["tehsilName"] = details.TehsilName ?? "N/A";
                }
                else if (officerDetails.AccessLevel == "District")
                {
                    app["tehsilName"] = details.TehsilName ?? "N/A";
                }

                app["sno"] = sno;
                app["referenceNumber"] = details.ReferenceNumber!;
                app["applicantName"] = GetFieldValue("ApplicantName", formDetails);
                app["mobileNumber"] = GetFieldValue("MobileNumber", formDetails);
                app["rationCardNumber"] = rationCardNumber;

                // ── Present Address fields ─────────────────────────────────────
                // Read from the nested formDetails via the same recursive
                // GetFieldValue used for everything else. Fields that don't
                // apply to a particular row (e.g. PresentMuncipality on a Rural
                // address) simply yield "" so the column renders blank.
                foreach (var col in presentAddressColumns)
                {
                    object? presentVal = null;
                    try { presentVal = GetFieldValue(col.FieldName, formDetails); }
                    catch { /* field not present on this row */ }
                    app[col.AccessorKey] = presentVal?.ToString() ?? "";
                }
                // ───────────────────────────────────────────────────────────────

                app["officerRemarks"] = officerRemarks;
                app["submissionDate"] = details.Created_at ?? "N/A";
                app["actionTakenOn"] = parsedDate == DateTime.MinValue
                                            ? string.Empty
                                            : parsedDate.ToString("dd MMM yyyy hh:mm:ss tt");
                app["serviceName"] = serviceName;
                app["currentlyWith"] = officerStatus == "returntoedit"
                                            ? "Citizen"
                                            : $"{officerDesignation} ({officerArea})";
                app["status"] = Status!;
                app["serviceId"] = details.ServiceId;
                app["customActions"] = customActions;

                return obj;
            }

            // ── Pool rows first — always S.No 1..N ────────────────────────────────
            int poolSnoCounter = 1;
            foreach (var details in poolResponse)
            {
                try
                {
                    poolData.Add(BuildRow(details, poolSnoCounter++, type!));
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, $"Error processing pool application {details.ReferenceNumber}: {ex.Message}");
                }
            }

            // ── Main list — S.No continues after the pinned pool block ────────────
            int snoCounter = (pageIndex * pageSize) + 1;
            foreach (var details in response)
            {
                try
                {
                    if (pool.Contains(details.ReferenceNumber!)) continue;
                    data.Add(BuildRow(details, snoCounter++, type!));
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, $"Error processing application {details.ReferenceNumber}: {ex.Message}");
                }
            }

            // =====================================================================
            //                       SHAPE / RE-NUMBER
            // =====================================================================
            // Anonymous types have a fixed property set, so we must use
            // ExpandoObject here to carry the dynamic Present Address columns
            // through. We preserve the original field order and splice the
            // Present Address columns in right after "rationCardNumber" (i.e.
            // where Change 2 appended them to the columns list).
            List<dynamic> Shape(List<dynamic> src, int startIndex)
            {
                var result = new List<dynamic>();
                int counter = startIndex;

                foreach (var row in src)
                {
                    var shaped = (IDictionary<string, object>)new ExpandoObject()!;
                    var orig = (IDictionary<string, object>)row;

                    void Copy(string key)
                    {
                        if (orig.TryGetValue(key, out var v) && v != null)
                            shaped[key] = v;
                        else
                            shaped[key] = string.Empty;
                    }

                    shaped["sno"] = counter++;

                    // Access-level–specific fields first, matching column order.
                    if (officerDetails.AccessLevel == "State")
                    {
                        Copy("referenceNumber");
                        Copy("divisionName");
                        Copy("districtName");
                    }
                    else if (officerDetails.AccessLevel == "Division")
                    {
                        Copy("referenceNumber");
                        Copy("districtName");
                        Copy("tehsilName");
                    }
                    else if (officerDetails.AccessLevel == "District")
                    {
                        Copy("referenceNumber");
                        Copy("tehsilName");
                    }
                    else
                    {
                        Copy("referenceNumber");
                    }

                    Copy("applicantName");
                    Copy("mobileNumber");
                    Copy("rationCardNumber");

                    // Present Address columns — same order as in `columns`.
                    foreach (var col in presentAddressColumns)
                        Copy(col.AccessorKey);

                    Copy("submissionDate");
                    Copy("actionTakenOn");
                    Copy("serviceName");
                    Copy("currentlyWith");
                    Copy("status");
                    Copy("officerRemarks");
                    Copy("serviceId");
                    Copy("customActions");

                    result.Add((dynamic)shaped);
                }

                return result;
            }

            // ★ Pool restarts at 1 (pinned). Main continues AFTER the pool block.
            poolData = Shape(poolData, 1);
            data = Shape(data, poolData.Count + (pageIndex * pageSize) + 1);

            _logger.LogInformation(
                "--------- Final Return — Data: {dc}, Pool: {pc}, MainTotal: {tr} ---------",
                data.Count, poolData.Count, totalRecords);

            return Json(new
            {
                data,
                poolData,
                columns,
                totalRecords,                     // main list only → page navigator uses this
                poolTotalRecords = poolData.Count,// pinned pool count
                canSanction = (bool)authorities.canSanction
            });
        }


        [HttpGet]
        public async Task<IActionResult> GenerateUserDetailsPdf(string applicationId)
        {
            var officer = GetOfficerDetails();
            string? username = officer.Username;
            if (string.IsNullOrEmpty(applicationId))
                return BadRequest("Application ID is required.");

            // ── Retrieve application details ──────────────────────────────────
            var application = await dbcontext.CitizenApplications
                .Where(ca => ca.Referencenumber == applicationId)
                .FirstOrDefaultAsync();

            if (application == null)
                return NotFound("Application not found.");

            using (var memoryStream = new MemoryStream())
            {
                var writer = new PdfWriter(memoryStream);
                var pdf = new PdfDocument(writer);
                var document = new Document(pdf, PageSize.A4);
                document.SetMargins(40, 40, 70, 40);   // extra bottom margin for footer

                // ── Palette ───────────────────────────────────────────────────
                var navy = new DeviceRgb(11, 42, 91);      // primary
                var navyLight = new DeviceRgb(30, 71, 143);     // hover/accents
                var gold = new DeviceRgb(201, 151, 0);     // govt gold
                var goldSoft = new DeviceRgb(255, 250, 235);
                var bgSoft = new DeviceRgb(245, 248, 252);
                var bgCard = new DeviceRgb(250, 252, 255);
                var border = new DeviceRgb(209, 217, 230);
                var textDark = new DeviceRgb(26, 32, 44);
                var textMuted = new DeviceRgb(107, 114, 128);

                // ── Page footer on every generated page ───────────────────────
                pdf.AddEventHandler(PdfDocumentEvent.END_PAGE,
                    new PageFooterHandler(navy, gold, textMuted, applicationId));

                string serviceName = dbcontext.Services
                    .FirstOrDefault(s => s.Serviceid == application.Serviceid)!.Servicename!;

                var formDetails = JObject.Parse(application.Formdetails!);

                // ═══════════════════════════════════════════════════════════════
                // 1. OFFICIAL HEADER BANNER
                // ═══════════════════════════════════════════════════════════════
                var titleBanner = new Table(UnitValue.CreatePercentArray(new float[] { 1 }))
                    .SetWidth(UnitValue.CreatePercentValue(100))
                    .SetMarginBottom(0);

                var bannerCell = new Cell()
                    .SetBackgroundColor(navy)
                    .SetBorder(Border.NO_BORDER)
                    .SetPaddingTop(14)
                    .SetPaddingBottom(14)
                    .SetPaddingLeft(20)
                    .SetPaddingRight(20)
                    .Add(new Paragraph("GOVERNMENT OF JAMMU & KASHMIR")
                        .SetFontSize(16)
                        .SetBold()
                        .SetFontColor(ColorConstants.WHITE)
                        .SetTextAlignment(TextAlignment.CENTER)
                        .SetMarginBottom(2))
                    .Add(new Paragraph("DEPARTMENT OF SOCIAL WELFARE")
                        .SetFontSize(11)
                        .SetBold()
                        .SetFontColor(new DeviceRgb(210, 225, 255))
                        .SetTextAlignment(TextAlignment.CENTER));

                titleBanner.AddCell(bannerCell);
                document.Add(titleBanner);

                // Gold accent strip under the banner
                var accentBar = new Table(UnitValue.CreatePercentArray(new float[] { 1 }))
                    .SetWidth(UnitValue.CreatePercentValue(100))
                    .SetMarginBottom(20);
                accentBar.AddCell(new Cell()
                    .SetBackgroundColor(gold)
                    .SetBorder(Border.NO_BORDER)
                    .SetHeight(4)
                    .Add(new Paragraph("")));
                document.Add(accentBar);

                // ═══════════════════════════════════════════════════════════════
                // 2. APPLICATION SUMMARY CARD
                // ═══════════════════════════════════════════════════════════════
                var summaryTable = new Table(UnitValue.CreatePercentArray(new float[] { 65, 35 }))
                    .SetWidth(UnitValue.CreatePercentValue(100))
                    .SetMarginBottom(20);

                // ── Left: title + metadata ────────────────────────────────
                var leftSummary = new Cell()
                    .SetBorder(new SolidBorder(border, 0.8f))
                    .SetBackgroundColor(bgCard)
                    .SetPadding(16)
                    .SetVerticalAlignment(VerticalAlignment.MIDDLE);

                leftSummary.Add(new Paragraph("CITIZEN APPLICATION DETAILS")
                    .SetFontSize(14)
                    .SetBold()
                    .SetFontColor(navy)
                    .SetMarginBottom(10));

                // Service name
                leftSummary.Add(new Paragraph()
                    .Add(new Text("Service: ").SetFontColor(textMuted).SetFontSize(10))
                    .Add(new Text(serviceName).SetFontColor(textDark).SetFontSize(10).SetBold())
                    .SetMarginBottom(4));

                // Reference number
                leftSummary.Add(new Paragraph()
                    .Add(new Text("Reference Number: ").SetFontColor(textMuted).SetFontSize(10))
                    .Add(new Text(applicationId).SetFontColor(gold).SetFontSize(11).SetBold())
                    .SetMarginBottom(4));

                // Generated at
                leftSummary.Add(new Paragraph()
                    .Add(new Text("Generated On: ").SetFontColor(textMuted).SetFontSize(10))
                    .Add(new Text(DateTime.Now.ToString("dd MMM yyyy, HH:mm", CultureInfo.InvariantCulture))
                        .SetFontColor(textDark).SetFontSize(10))
                    .SetMarginBottom(4));

                // Generated by
                leftSummary.Add(new Paragraph()
                    .Add(new Text("Generated By: ").SetFontColor(textMuted).SetFontSize(10))
                    .Add(new Text(username ?? "—").SetFontColor(textDark).SetFontSize(10)));

                // IP address
                leftSummary.Add(new Paragraph()
                    .Add(new Text("IP Address: ").SetFontColor(textMuted).SetFontSize(10))
                    .Add(new Text(HttpContext.Connection.RemoteIpAddress?.ToString() ?? "—")
                        .SetFontColor(textDark).SetFontSize(10)));

                summaryTable.AddCell(leftSummary);

                // ── Right: applicant photograph ───────────────────────────
                var rightSummary = new Cell()
                    .SetBorder(new SolidBorder(border, 0.8f))
                    .SetBackgroundColor(bgCard)
                    .SetPadding(16)
                    .SetVerticalAlignment(VerticalAlignment.MIDDLE)
                    .SetTextAlignment(TextAlignment.CENTER);

                rightSummary.Add(new Paragraph("APPLICANT PHOTOGRAPH")
                    .SetFontSize(9)
                    .SetBold()
                    .SetFontColor(textMuted)
                    .SetTextAlignment(TextAlignment.CENTER)
                    .SetMarginBottom(8));

                var imagePath = GetFormFieldValue(formDetails, "ApplicantImage");
                if (!string.IsNullOrEmpty(imagePath))
                {
                    var imageDetails = dbcontext.Userdocuments.FirstOrDefault(u => u.Filename == imagePath);
                    if (imageDetails != null)
                    {
                        try
                        {
                            var imageData = ImageDataFactory.Create(imageDetails.Filedata);
                            var image = new Image(imageData)
                                .ScaleToFit(110, 110)
                                .SetBorder(new SolidBorder(navy, 1.5f))
                                .SetBorderRadius(new BorderRadius(6))
                                .SetHorizontalAlignment(HorizontalAlignment.CENTER);
                            rightSummary.Add(image);
                        }
                        catch (Exception ex)
                        {
                            rightSummary.Add(new Paragraph($"Image error: {ex.Message}")
                                .SetFontSize(8).SetFontColor(ColorConstants.RED));
                        }
                    }
                    else
                    {
                        rightSummary.Add(new Paragraph("Image not found")
                            .SetFontSize(9).SetFontColor(ColorConstants.RED));
                    }
                }
                else
                {
                    rightSummary.Add(new Paragraph("No photograph on file")
                        .SetFontSize(9).SetFontColor(textMuted).SetItalic());
                }

                summaryTable.AddCell(rightSummary);
                document.Add(summaryTable);

                // ═══════════════════════════════════════════════════════════════
                // 3. APPLICATION DETAILS — SECTION-WISE TABLES
                // ═══════════════════════════════════════════════════════════════
                foreach (var section in formDetails)
                {
                    if (section.Key == "Documents" || section.Key == "ApplicantImage")
                        continue;

                    // Skip empty sections
                    if (section.Value is not JArray sectionArray || sectionArray.Count == 0)
                        continue;

                    // Section header bar
                    var sectionBar = new Table(UnitValue.CreatePercentArray(new float[] { 1 }))
                        .SetWidth(UnitValue.CreatePercentValue(100))
                        .SetMarginTop(14)
                        .SetMarginBottom(0);

                    sectionBar.AddCell(new Cell()
                        .SetBackgroundColor(navy)
                        .SetBorder(Border.NO_BORDER)
                        .SetPaddingTop(8)
                        .SetPaddingBottom(8)
                        .SetPaddingLeft(14)
                        .Add(new Paragraph(FormatSectionKey(section.Key).ToUpperInvariant())
                            .SetFontSize(11)
                            .SetBold()
                            .SetFontColor(ColorConstants.WHITE)));

                    document.Add(sectionBar);

                    // Fields table for this section
                    var fieldsTable = new Table(UnitValue.CreatePercentArray(new float[] { 40, 60 }))
                        .SetWidth(UnitValue.CreatePercentValue(100))
                        .SetMarginBottom(6);

                    bool alternate = false;

                    void AddFieldRow(string label, string value, int depth = 0)
                    {
                        var rowBg = alternate ? bgCard : ColorConstants.WHITE;
                        alternate = !alternate;

                        var labelCell = new Cell()
                            .Add(new Paragraph(FormatFieldLabel(label))
                                .SetFontSize(10)
                                .SetBold()
                                .SetFontColor(navy))
                            .SetBorder(new SolidBorder(border, 0.5f))
                            .SetBackgroundColor(rowBg)
                            .SetPadding(8)
                            .SetPaddingLeft(14 + depth * 12);

                        var valueCell = new Cell()
                            .Add(new Paragraph(value ?? "—")
                                .SetFontSize(10)
                                .SetFontColor(textDark))
                            .SetBorder(new SolidBorder(border, 0.5f))
                            .SetBackgroundColor(rowBg)
                            .SetPadding(8);

                        fieldsTable.AddCell(labelCell);
                        fieldsTable.AddCell(valueCell);
                    }

                    void ProcessFields(JArray arr, int depth = 0)
                    {
                        foreach (var item in arr)
                        {
                            var label = item["label"]?.ToString();
                            var name = item["name"]?.ToString();
                            var value = item["value"]?.ToString();

                            if (!string.IsNullOrEmpty(label) && !string.IsNullOrEmpty(value))
                            {
                                // Special case: Aadhaar
                                if (string.Equals(name, "AadhaarNumber", StringComparison.OrdinalIgnoreCase))
                                {
                                    AddFieldRow(label, string.IsNullOrEmpty(value) ? "Not Verified" : "Verified", depth);
                                }
                                else
                                {
                                    AddFieldRow(label, ConvertValueForDisplay(name!, value), depth);
                                }
                            }

                            if (item["additionalFields"] is JArray additionalFields && additionalFields.Count > 0)
                                ProcessFields(additionalFields, depth + 1);
                        }
                    }

                    ProcessFields(sectionArray);

                    document.Add(fieldsTable);
                }

                // ═══════════════════════════════════════════════════════════════
                // 4. ATTACHED DOCUMENTS
                //    Label overlaid on the first document's own page (not on a
                //    separate page before it).
                // ═══════════════════════════════════════════════════════════════
                var documents = formDetails["Documents"] as JArray;
                bool hasDocuments = documents != null && documents.Any();

                if (hasDocuments)
                {
                    bool isFirstDocument = true;

                    foreach (var doc in documents!)
                    {
                        var filePath = doc["File"]?.ToString();
                        var enclosure = doc["label"]?.ToString() ?? "Document";

                        var fileDetails = dbcontext.Userdocuments
                            .FirstOrDefault(u => u.Filename == filePath);

                        if (fileDetails?.Filedata == null)
                            continue;

                        try
                        {
                            using var inputStream = new MemoryStream(fileDetails.Filedata);
                            using var reader = new PdfReader(inputStream);
                            using var tempMs = new MemoryStream();
                            var srcPdf = new PdfDocument(reader, new PdfWriter(tempMs));
                            var firstPage = srcPdf.GetPage(1);
                            var pageTop = firstPage.GetPageSize().GetTop();

                            // Overlay section header (first doc only) + enclosure label
                            var canvas = new PdfCanvas(firstPage.NewContentStreamBefore(),
                                                       firstPage.GetResources(), srcPdf);
                            var canvasDoc = new Document(srcPdf);

                            float labelY = pageTop - 25;

                            if (isFirstDocument)
                            {
                                canvasDoc.ShowTextAligned(
                                    new Paragraph("ATTACHED DOCUMENTS")
                                        .SetFontSize(13)
                                        .SetBold()
                                        .SetFontColor(navy)
                                        .SetBackgroundColor(new DeviceRgb(240, 247, 255))
                                        .SetPadding(6),
                                    x: 36, y: labelY, TextAlignment.LEFT);

                                labelY -= 28;
                                isFirstDocument = false;
                            }

                            canvasDoc.ShowTextAligned(
                                new Paragraph($"Document: {enclosure}")
                                    .SetFontSize(10)
                                    .SetBold()
                                    .SetFontColor(gold)
                                    .SetBackgroundColor(goldSoft)
                                    .SetPadding(4),
                                x: 36, y: labelY, TextAlignment.LEFT);

                            canvasDoc.Close();

                            // Copy all pages of this document into the main PDF
                            var finalSrc = new PdfDocument(new PdfReader(new MemoryStream(tempMs.ToArray())));
                            finalSrc.CopyPagesTo(1, finalSrc.GetNumberOfPages(), pdf);
                            finalSrc.Close();

                            document.Add(new AreaBreak(AreaBreakType.NEXT_PAGE));
                        }
                        catch (Exception ex)
                        {
                            document.Add(new Paragraph($"Error loading \"{enclosure}\": {ex.Message}")
                                .SetFontSize(11)
                                .SetFontColor(ColorConstants.RED)
                                .SetMarginBottom(6));
                        }
                    }
                }

                // ═══════════════════════════════════════════════════════════════
                // 5. SANCTION LETTER (if sanctioned)
                // ═══════════════════════════════════════════════════════════════
                if (application.Status == "Sanctioned")
                {
                    var sanctionLetterPath = applicationId.Replace("/", "_") + "_SanctionLetter.pdf";
                    var fileDetails = dbcontext.Userdocuments
                        .FirstOrDefault(u => u.Filename == sanctionLetterPath);

                    if (fileDetails != null)
                    {
                        try
                        {
                            using var inputStream = new MemoryStream(fileDetails.Filedata);
                            using var reader = new PdfReader(inputStream);
                            using var tempMs = new MemoryStream();
                            var srcPdf = new PdfDocument(reader, new PdfWriter(tempMs));
                            var firstPage = srcPdf.GetPage(1);
                            var pageTop = firstPage.GetPageSize().GetTop();

                            var canvas = new PdfCanvas(firstPage.NewContentStreamBefore(),
                                                       firstPage.GetResources(), srcPdf);
                            var canvasDoc = new Document(srcPdf);

                            canvasDoc.ShowTextAligned(
                                new Paragraph("SANCTION LETTER")
                                    .SetFontSize(13)
                                    .SetBold()
                                    .SetFontColor(navy)
                                    .SetBackgroundColor(new DeviceRgb(240, 247, 255))
                                    .SetPadding(6),
                                x: 36, y: pageTop - 25, TextAlignment.LEFT);

                            canvasDoc.Close();

                            var finalSrc = new PdfDocument(new PdfReader(new MemoryStream(tempMs.ToArray())));
                            finalSrc.CopyPagesTo(1, finalSrc.GetNumberOfPages(), pdf);
                            finalSrc.Close();

                            document.Add(new AreaBreak(AreaBreakType.NEXT_PAGE));

                            // Corrigendum sanction letters
                            var corrigendum = dbcontext.Corrigendum
                                .Where(c => c.Referencenumber == applicationId).ToList();

                            foreach (var cor in corrigendum)
                            {
                                var corFileDetails = dbcontext.Userdocuments.FirstOrDefault(u =>
                                    u.Filename == cor.Corrigendumid.Replace("/", "_") + "_CorrigendumSanctionLetter.pdf");

                                if (corFileDetails?.Filedata == null) continue;

                                using var corInputStream = new MemoryStream(corFileDetails.Filedata);
                                using var corReader = new PdfReader(corInputStream);
                                using var corTempMs = new MemoryStream();
                                var corSrcPdf = new PdfDocument(corReader, new PdfWriter(corTempMs));
                                var corFirstPage = corSrcPdf.GetPage(1);
                                var corPageTop = corFirstPage.GetPageSize().GetTop();

                                var corCanvas = new PdfCanvas(corFirstPage.NewContentStreamBefore(),
                                                              corFirstPage.GetResources(), corSrcPdf);
                                var corCanvasDoc = new Document(corSrcPdf);

                                corCanvasDoc.ShowTextAligned(
                                    new Paragraph("CORRIGENDUM SANCTION LETTER")
                                        .SetFontSize(13)
                                        .SetBold()
                                        .SetFontColor(navy)
                                        .SetBackgroundColor(new DeviceRgb(240, 247, 255))
                                        .SetPadding(6),
                                    x: 36, y: corPageTop - 25, TextAlignment.LEFT);

                                corCanvasDoc.Close();

                                using var finalCorReader = new PdfReader(new MemoryStream(corTempMs.ToArray()));
                                using var finalCorPdf = new PdfDocument(finalCorReader);
                                finalCorPdf.CopyPagesTo(1, finalCorPdf.GetNumberOfPages(), pdf);
                                finalCorPdf.Close();

                                document.Add(new AreaBreak(AreaBreakType.NEXT_PAGE));
                            }
                        }
                        catch (Exception ex)
                        {
                            document.Add(new Paragraph($"Error loading Sanction Letter: {ex.Message}")
                                .SetFontSize(11).SetFontColor(ColorConstants.RED));
                        }
                    }
                }

                // ═══════════════════════════════════════════════════════════════
                // 6. APPLICATION HISTORY — starts on a fresh page
                // ═══════════════════════════════════════════════════════════════
                document.Add(new AreaBreak(AreaBreakType.NEXT_PAGE));

                // Section header
                var histBar = new Table(UnitValue.CreatePercentArray(new float[] { 1 }))
                    .SetWidth(UnitValue.CreatePercentValue(100))
                    .SetMarginBottom(10);
                histBar.AddCell(new Cell()
                    .SetBackgroundColor(navy)
                    .SetBorder(Border.NO_BORDER)
                    .SetPaddingTop(8).SetPaddingBottom(8).SetPaddingLeft(14)
                    .Add(new Paragraph("APPLICATION HISTORY")
                        .SetFontSize(12).SetBold().SetFontColor(ColorConstants.WHITE)));
                document.Add(histBar);

                var players = JsonConvert.DeserializeObject<dynamic>(application.Workflow!) as JArray;
                int currentPlayerIndex = (int)application.Currentplayer!;
                var currentPlayer = players!.FirstOrDefault(o => (int)o["playerId"]! == currentPlayerIndex);
                var history = await dbcontext.Actionhistory
                    .Where(ah => ah.Referencenumber == applicationId).ToListAsync();

                var historyTable = new Table(UnitValue.CreatePercentArray(new float[] { 8, 22, 25, 30, 15 }))
                    .SetWidth(UnitValue.CreatePercentValue(100))
                    .SetMarginBottom(20);

                var headers = new[] { "S.No", "Action Taker", "Action Taken", "Remarks", "Date" };
                foreach (var header in headers)
                {
                    historyTable.AddHeaderCell(new Cell()
                        .Add(new Paragraph(header)
                            .SetFontSize(10).SetBold()
                            .SetFontColor(ColorConstants.WHITE)
                            .SetTextAlignment(TextAlignment.CENTER))
                        .SetBackgroundColor(navy)
                        .SetPadding(8)
                        .SetBorder(new SolidBorder(border, 0.5f)));
                }

                int index = 1;
                bool altRow = false;

                foreach (var item in history)
                {
                    var rowBg = altRow ? bgCard : ColorConstants.WHITE;
                    altRow = !altRow;

                    string officerArea = GetOfficerAreaForHistory(item.Locationlevel!, item.Locationvalue);

                    historyTable.AddCell(new Cell()
                        .Add(new Paragraph(index.ToString())
                            .SetFontSize(10).SetFontColor(textDark)
                            .SetTextAlignment(TextAlignment.CENTER))
                        .SetPadding(7).SetBackgroundColor(rowBg)
                        .SetBorder(new SolidBorder(border, 0.5f)));

                    historyTable.AddCell(new Cell()
                        .Add(new Paragraph(item.Actiontaker != "Citizen"
                            ? $"{item.Actiontaker} {officerArea}"
                            : item.Actiontaker)
                            .SetFontSize(10).SetFontColor(textDark))
                        .SetPadding(7).SetBackgroundColor(rowBg)
                        .SetBorder(new SolidBorder(border, 0.5f)));

                    historyTable.AddCell(new Cell()
                        .Add(new Paragraph(item.Actiontaken == "ReturnToCitizen"
                            ? "Returned to citizen for correction"
                            : item.Actiontaken)
                            .SetFontSize(10).SetFontColor(textDark))
                        .SetPadding(7).SetBackgroundColor(rowBg)
                        .SetBorder(new SolidBorder(border, 0.5f)));

                    historyTable.AddCell(new Cell()
                        .Add(new Paragraph(item.Remarks ?? "")
                            .SetFontSize(10).SetFontColor(textDark))
                        .SetPadding(7).SetBackgroundColor(rowBg)
                        .SetBorder(new SolidBorder(border, 0.5f)));

                    historyTable.AddCell(new Cell()
                        .Add(new Paragraph(item.Actiontakendate.ToString())
                            .SetFontSize(10).SetFontColor(textDark)
                            .SetTextAlignment(TextAlignment.CENTER))
                        .SetPadding(7).SetBackgroundColor(rowBg)
                        .SetBorder(new SolidBorder(border, 0.5f)));

                    index++;
                }

                // Pending row for the current player
                if ((string)currentPlayer!["status"]! == "pending")
                {
                    string designation = (string)currentPlayer["designation"]!;
                    string accessLevel = (string)currentPlayer["accessLevel"]!;
                    string officerArea = GetOfficerArea(accessLevel, formDetails);

                    var rowBg = altRow ? bgCard : ColorConstants.WHITE;

                    historyTable.AddCell(new Cell()
                        .Add(new Paragraph(index.ToString())
                            .SetFontSize(10).SetFontColor(textDark)
                            .SetTextAlignment(TextAlignment.CENTER))
                        .SetPadding(7).SetBackgroundColor(rowBg)
                        .SetBorder(new SolidBorder(border, 0.5f)));

                    historyTable.AddCell(new Cell()
                        .Add(new Paragraph($"{designation} {officerArea}")
                            .SetFontSize(10).SetFontColor(textDark))
                        .SetPadding(7).SetBackgroundColor(rowBg)
                        .SetBorder(new SolidBorder(border, 0.5f)));

                    historyTable.AddCell(new Cell()
                        .Add(new Paragraph("Pending")
                            .SetFontSize(10).SetFontColor(gold).SetBold())
                        .SetPadding(7).SetBackgroundColor(rowBg)
                        .SetBorder(new SolidBorder(border, 0.5f)));

                    historyTable.AddCell(new Cell()
                        .Add(new Paragraph(""))
                        .SetPadding(7).SetBackgroundColor(rowBg)
                        .SetBorder(new SolidBorder(border, 0.5f)));

                    historyTable.AddCell(new Cell()
                        .Add(new Paragraph(""))
                        .SetPadding(7).SetBackgroundColor(rowBg)
                        .SetBorder(new SolidBorder(border, 0.5f)));
                }

                document.Add(historyTable);

                document.Close();
                writer.Close();

                var pdfBytes = memoryStream.ToArray();
                return File(pdfBytes, "application/pdf", $"{applicationId}_UserDetails.pdf");
            }
        }

        // ═══════════════════════════════════════════════════════════════════════
        // Page footer event handler — adds an official footer to every page
        // generated by the Document. Copied pages from source PDFs are not
        // affected (they retain their own layout).
        // ═══════════════════════════════════════════════════════════════════════
        private class PageFooterHandler : IEventHandler
        {
            private readonly DeviceRgb _navy;
            private readonly DeviceRgb _gold;
            private readonly DeviceRgb _muted;
            private readonly string _refNumber;
            private readonly PdfFont _font;

            public PageFooterHandler(DeviceRgb navy, DeviceRgb gold, DeviceRgb muted, string refNumber)
            {
                _navy = navy;
                _gold = gold;
                _muted = muted;
                _refNumber = refNumber;
                _font = PdfFontFactory.CreateFont(StandardFonts.HELVETICA);
            }

            public void HandleEvent(Event @event)
            {
                var docEvent = (PdfDocumentEvent)@event;
                var pdfDoc = docEvent.GetDocument();
                var page = docEvent.GetPage();
                var pageSize = page.GetPageSize();
                int pageNumber = pdfDoc.GetPageNumber(page);

                var canvas = new PdfCanvas(page.NewContentStreamAfter(),
                                           page.GetResources(), pdfDoc);

                float left = 40;
                float right = pageSize.GetWidth() - 40;
                float lineY = 55;
                float textY = 40;

                // Gold divider above the footer
                canvas.SaveState()
                      .SetStrokeColor(_gold)
                      .SetLineWidth(0.8f)
                      .MoveTo(left, lineY)
                      .LineTo(right, lineY)
                      .Stroke()
                      .RestoreState();

                // Center: department line
                string centerText = "Government of Jammu & Kashmir  •  Department of Social Welfare";
                float centerW = _font.GetWidth(centerText, 8);
                canvas.BeginText()
                      .SetFontAndSize(_font, 8)
                      .SetColor(_muted, true)
                      .SetTextMatrix((pageSize.GetWidth() - centerW) / 2, textY)
                      .ShowText(centerText)
                      .EndText();

                // Left: reference number
                canvas.BeginText()
                      .SetFontAndSize(_font, 8)
                      .SetColor(_muted, true)
                      .SetTextMatrix(left, textY)
                      .ShowText($"Ref: {_refNumber}")
                      .EndText();

                // Right: page number
                string pageText = $"Page {pageNumber}";
                float pageW = _font.GetWidth(pageText, 8);
                canvas.BeginText()
                      .SetFontAndSize(_font, 8)
                      .SetColor(_muted, true)
                      .SetTextMatrix(right - pageW, textY)
                      .ShowText(pageText)
                      .EndText();

                canvas.Release();
            }
        }

        // ═══════════════════════════════════════════════════════════════════════
        // GET: /Officer/GetWithheldApplications
        // ═══════════════════════════════════════════════════════════════════════
        [HttpGet]
        public async Task<IActionResult> GetWithheldApplications(string serviceId, string type, int pageIndex = 0, int pageSize = 10, string? searchQuery = null)
        {
            var officer = GetOfficerDetails();
            if (officer == null)
                return Unauthorized(new { error = "Officer authentication failed." });
            if (string.IsNullOrEmpty(serviceId) || !int.TryParse(serviceId, out int parsedServiceId))
                return BadRequest(new { error = "Invalid Serviceid" });
            if (string.IsNullOrEmpty(type))
                return BadRequest(new { error = "Type parameter is required" });

            string officerRole = officer.Role ?? "";
            string accessLevel = officer.AccessLevel ?? "State";
            int? accessCode = officer.AccessCode;
            int? divisionCode = officer.AccessLevel == "Division" ? officer.AccessCode :
                (officer.AccessLevel == "District" || officer.AccessLevel == "Tehsil") ?
                dbcontext.District
                .Where(d => d.Districtid == officer.AccessCode)
                .Select(d => (int?)d.Division)
                .FirstOrDefault() : null;

            var service = dbcontext.Services.FirstOrDefault(s => s.Serviceid == parsedServiceId);
            var serviceLocation = ResolveServiceLocationFields(service?.Formelement);
            bool serviceHasDistrict = serviceLocation.HasDistrict;
            bool serviceHasChildLocation = serviceLocation.HasChildLocation;
            string childLocationHeader = serviceLocation.ChildLocationHeader;

            var columns = new List<dynamic>
    {
        new { accessorKey = "sno",             header = "S.No" },
        new { accessorKey = "referenceNumber", header = "Reference Number" },
        new { accessorKey = "applicantName",   header = "Applicant Name" },
        new { accessorKey = "withheldType",    header = "Withheld Type" },
        new { accessorKey = "withheldReason",  header = "Withheld Reason" }
    };
            if (officer.AccessLevel == "State")
            {
                columns.Insert(1, new { accessorKey = "divisionName", header = "Division Name" });
                if (serviceHasDistrict)
                    columns.Insert(2, new { accessorKey = "districtName", header = "District Name" });
            }
            else if (officer.AccessLevel == "Division")
            {
                if (serviceHasDistrict)
                    columns.Insert(1, new { accessorKey = "districtName", header = "District Name" });
                if (serviceHasChildLocation)
                    columns.Insert(2, new { accessorKey = "tehsilName", header = childLocationHeader });
            }
            else if (officer.AccessLevel == "District")
            {
                if (serviceHasChildLocation)
                    columns.Insert(1, new { accessorKey = "tehsilName", header = childLocationHeader });
            }
            columns.Add(new { accessorKey = "isWithheld", header = "Is Withheld" });

            List<dynamic> data = new();
            int totalRecords = 0;

            try
            {
                // ═══════════════════════════════════════════════════════════════
                // BRANCH 1: SEARCH
                // ═══════════════════════════════════════════════════════════════
                if (!string.IsNullOrEmpty(searchQuery))
                {
                    var searchParameters = new[]
                    {
                new NpgsqlParameter("@p_service_id",    NpgsqlDbType.Integer) { Value = parsedServiceId },
                new NpgsqlParameter("@p_type",          NpgsqlDbType.Varchar) { Value = type },
                new NpgsqlParameter("@p_officer_role",  NpgsqlDbType.Varchar) { Value = (object?)officerRole ?? DBNull.Value },
                new NpgsqlParameter("@p_access_level",  NpgsqlDbType.Varchar) { Value = (object?)accessLevel ?? DBNull.Value },
                new NpgsqlParameter("@p_access_code",   NpgsqlDbType.Integer) { Value = (object?)accessCode   ?? DBNull.Value },
                new NpgsqlParameter("@p_division_code", NpgsqlDbType.Integer) { Value = (object?)divisionCode ?? DBNull.Value },
                new NpgsqlParameter("@p_page_index",    NpgsqlDbType.Integer) { Value = pageIndex },
                new NpgsqlParameter("@p_page_size",     NpgsqlDbType.Integer) { Value = pageSize },
                new NpgsqlParameter("@p_search_query",  NpgsqlDbType.Varchar) { Value = searchQuery }
            };
                    var result = await dbcontext.Database
                        .SqlQueryRaw<WithheldApplicationSearchDto>(
                            "SELECT * FROM search_withheld_applications_for_officer(@p_service_id, @p_type, @p_officer_role, @p_access_level, @p_access_code, @p_division_code, @p_page_index, @p_page_size, @p_search_query)",
                            searchParameters)
                        .ToListAsync();

                    totalRecords = result.Count > 0 ? (int)result[0].Totalrecords : 0;

                    // ★ Fetch workflows for the current page to evaluate canPull without N+1 queries
                    var pageRefNumbers = result.Select(r => r.Referencenumber).Where(r => !string.IsNullOrEmpty(r)).Distinct().ToList();
                    var withheldWorkflows = dbcontext.WithheldApplications
                        .Where(w => pageRefNumbers.Contains(w.Referencenumber) && w.Serviceid == parsedServiceId)
                        .AsEnumerable()
                        .GroupBy(w => w.Referencenumber)
                        .ToDictionary(g => g.Key, g => (g.FirstOrDefault(wa => IsWithheldRecordActive(wa)) ?? g.LastOrDefault())?.Workflow ?? "[]");

                    data = result.Select(r =>
                    {
                        dynamic obj = new ExpandoObject();
                        var app = (IDictionary<string, object>)obj;
                        app["withheldId"] = r.WithheldId; // ✅ ADDED
                        app["sno"] = r.Sno;
                        app["referenceNumber"] = r.Referencenumber!;
                        if (officer.AccessLevel == "State")
                        {
                            app["divisionName"] = r.Divisionname ?? "N/A";
                            if (serviceHasDistrict) app["districtName"] = r.Districtname ?? "N/A";
                        }
                        else if (officer.AccessLevel == "Division")
                        {
                            if (serviceHasDistrict) app["districtName"] = r.Districtname ?? "N/A";
                            if (serviceHasChildLocation) app["tehsilName"] = r.Tehsilname ?? "N/A";
                        }
                        else if (officer.AccessLevel == "District")
                        {
                            if (serviceHasChildLocation) app["tehsilName"] = r.Tehsilname ?? "N/A";
                        }
                        app["applicantName"] = r.Applicantname ?? "N/A";
                        app["withheldType"] = r.Withheldtype!;
                        app["withheldReason"] = r.Withheldreason!;
                        app["isWithheld"] = r.Iswithheld.HasValue ? (r.Iswithheld.Value ? "YES" : "NO") : "N/A";

                        // ★ Evaluate canPull safely (Handles both boolean and string values)
                        bool canPull = false;
                        if (!string.IsNullOrEmpty(r.Referencenumber) && withheldWorkflows.TryGetValue(r.Referencenumber, out var wfJson))
                        {
                            try
                            {
                                var wfArray = JArray.Parse(wfJson);
                                var currentOfficerNode = wfArray.FirstOrDefault(o => o["designation"]?.ToString() == officerRole);
                                if (currentOfficerNode != null)
                                {
                                    var canPullToken = currentOfficerNode["canPull"];
                                    if (canPullToken != null)
                                    {
                                        if (canPullToken.Type == JTokenType.Boolean)
                                            canPull = (bool)canPullToken;
                                        else if (canPullToken.Type == JTokenType.String)
                                            bool.TryParse(canPullToken.ToString(), out canPull);
                                    }
                                }
                            }
                            catch { /* Ignore JSON parse errors */ }
                        }

                        var actions = new List<dynamic>();
                        // ✅ FIX: Use .Contains() to catch "withheld_forwarded", "forwarded", "withheld_returned", etc.
                        bool isForwardedOrReturned = type.Contains("forwarded", StringComparison.OrdinalIgnoreCase) ||
                                                     type.Contains("returned", StringComparison.OrdinalIgnoreCase);

                        if (isForwardedOrReturned && canPull)
                        {
                            actions.Add(new { type = "Pull", tooltip = "Pull Withheld Application Back", color = "#F0C38E", actionFunction = "pullWithheldApplication" });
                        }
                        else
                        {
                            actions.Add(new { type = "View", tooltip = "View", color = "#F0C38E", actionFunction = "handleViewWithheldApplication" });
                        }
                        app["customActions"] = actions;
                        return obj;
                    }).ToList();
                }
                // ═══════════════════════════════════════════════════════════════
                // BRANCH 2: No search
                // ═══════════════════════════════════════════════════════════════
                else
                {
                    var parameters = new[]
                    {
                new NpgsqlParameter("@p_service_id",    NpgsqlDbType.Integer) { Value = parsedServiceId },
                new NpgsqlParameter("@p_type",          NpgsqlDbType.Varchar) { Value = type },
                new NpgsqlParameter("@p_officer_role",  NpgsqlDbType.Varchar) { Value = (object?)officerRole ?? DBNull.Value },
                new NpgsqlParameter("@p_access_level",  NpgsqlDbType.Varchar) { Value = (object?)accessLevel ?? DBNull.Value },
                new NpgsqlParameter("@p_access_code",   NpgsqlDbType.Integer) { Value = (object?)accessCode   ?? DBNull.Value },
                new NpgsqlParameter("@p_division_code", NpgsqlDbType.Integer) { Value = (object?)divisionCode ?? DBNull.Value },
                new NpgsqlParameter("@p_page_index",    NpgsqlDbType.Integer) { Value = pageIndex },
                new NpgsqlParameter("@p_page_size",     NpgsqlDbType.Integer) { Value = pageSize }
            };
                    var result = await dbcontext.Database
                        .SqlQueryRaw<WithheldApplicationResult>(
                            "SELECT * FROM get_withheld_applications(@p_service_id, @p_type, @p_officer_role, @p_page_index, @p_page_size, @p_access_level, @p_access_code, @p_division_code)",
                            parameters)
                        .ToListAsync();

                    totalRecords = result.Count > 0 ? (int)(result[0].TotalRecords ?? 0) : 0;

                    // ★ Fetch workflows for the current page to evaluate canPull
                    var pageRefNumbers = result.Select(r => r.Referencenumber).Where(r => !string.IsNullOrEmpty(r)).Distinct().ToList();
                    var withheldWorkflows = dbcontext.WithheldApplications
                        .Where(w => pageRefNumbers.Contains(w.Referencenumber) && w.Serviceid == parsedServiceId)
                        .AsEnumerable()
                        .GroupBy(w => w.Referencenumber)
                        .ToDictionary(g => g.Key, g => (g.FirstOrDefault(wa => IsWithheldRecordActive(wa)) ?? g.LastOrDefault())?.Workflow ?? "[]");

                    data = result.Select(r =>
                    {
                        dynamic obj = new ExpandoObject();
                        var app = (IDictionary<string, object>)obj;
                        app["withheldId"] = r.WithheldId; // ✅ ADDED
                        app["sno"] = r.Sno;
                        app["referenceNumber"] = r.Referencenumber!;
                        if (officer.AccessLevel == "State")
                        {
                            app["divisionName"] = r.Divisionname ?? "N/A";
                            if (serviceHasDistrict) app["districtName"] = r.Districtname ?? "N/A";
                        }
                        else if (officer.AccessLevel == "Division")
                        {
                            if (serviceHasDistrict) app["districtName"] = r.Districtname ?? "N/A";
                            if (serviceHasChildLocation) app["tehsilName"] = r.Tehsilname ?? "N/A";
                        }
                        else if (officer.AccessLevel == "District")
                        {
                            if (serviceHasChildLocation) app["tehsilName"] = r.Tehsilname ?? "N/A";
                        }
                        app["applicantName"] = r.ApplicantName ?? "N/A";
                        app["withheldType"] = r.WithheldType!;
                        app["withheldReason"] = r.WithheldReason!;
                        app["isWithheld"] = r.Iswithheld.HasValue ? (r.Iswithheld.Value ? "YES" : "NO") : "N/A";

                        // ★ Evaluate canPull safely (Handles both boolean and string values)
                        bool canPull = false;
                        if (!string.IsNullOrEmpty(r.Referencenumber) && withheldWorkflows.TryGetValue(r.Referencenumber, out var wfJson))
                        {
                            try
                            {
                                var wfArray = JArray.Parse(wfJson);
                                var currentOfficerNode = wfArray.FirstOrDefault(o => o["designation"]?.ToString() == officerRole);
                                if (currentOfficerNode != null)
                                {
                                    var canPullToken = currentOfficerNode["canPull"];
                                    if (canPullToken != null)
                                    {
                                        if (canPullToken.Type == JTokenType.Boolean)
                                            canPull = (bool)canPullToken;
                                        else if (canPullToken.Type == JTokenType.String)
                                            bool.TryParse(canPullToken.ToString(), out canPull);
                                    }
                                }
                            }
                            catch { /* Ignore JSON parse errors */ }
                        }

                        var actions = new List<dynamic>();
                        // ✅ FIX: Use .Contains() to catch "withheld_forwarded", "forwarded", "withheld_returned", etc.
                        bool isForwardedOrReturned = type.Contains("forwarded", StringComparison.OrdinalIgnoreCase) ||
                                                     type.Contains("returned", StringComparison.OrdinalIgnoreCase);

                        if (isForwardedOrReturned && canPull)
                        {
                            actions.Add(new { type = "Pull", tooltip = "Pull Withheld Application Back", color = "#F0C38E", actionFunction = "pullWithheldApplication" });
                        }
                        else
                        {
                            actions.Add(new { type = "View", tooltip = "View", color = "#F0C38E", actionFunction = "handleViewWithheldApplication" });
                        }
                        app["customActions"] = actions;
                        return obj;
                    }).ToList();
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error executing GetWithheldApplications");
                return StatusCode(500, new { error = "An error occurred while fetching withheld applications" });
            }
            return Json(new { columns, data, totalRecords });
        }

        // Define a model for the stored procedure result set
        public class WithheldApplicationResult
        {
            [Column("totalrecords")] public long? TotalRecords { get; set; }
            [Column("withheld_id")] public long WithheldId { get; set; }   // ← the fix
            [Column("sno")] public long Sno { get; set; }
            [Column("referencenumber")] public string? Referencenumber { get; set; }
            [Column("applicantname")] public string? ApplicantName { get; set; }
            [Column("withheldtype")] public string? WithheldType { get; set; }
            [Column("withheldreason")] public string? WithheldReason { get; set; }
            [Column("iswithheld")] public bool? Iswithheld { get; set; }
            [Column("divisionname")] public string? Divisionname { get; set; }
            [Column("districtname")] public string? Districtname { get; set; }
            [Column("tehsilname")] public string? Tehsilname { get; set; }
        }

        [HttpGet]
        public async Task<IActionResult> GetTemporaryDisability(string? Serviceid, string type, int pageIndex = 0, int pageSize = 10)
        {
            try
            {
                var officer = GetOfficerDetails();
                if (officer == null) return Unauthorized("Officer details not found.");

                int serviceId;
                try { serviceId = Convert.ToInt32(Serviceid); }
                catch { return BadRequest("Invalid Serviceid"); }

                string accessLevel = officer.AccessLevel!;
                int? accessCode = officer.AccessCode;
                string takenBy = officer.Role!;

                int? divisionCode = null;
                if (accessLevel == "Division" && accessCode.HasValue)
                {
                    var district = await dbcontext.District.FirstOrDefaultAsync(d => d.Districtid == accessCode.Value);
                    divisionCode = district?.Division ?? accessCode.Value;
                }

                string resultType = type == "totalpcpapplication" ? "totalpcpapplication" : "expiringeligibility";

                if (pageIndex < 0) pageIndex = 0;
                if (pageSize < 1) pageSize = 10;
                int pageNumber = pageIndex + 1;

                var parameters = new[]
                {
            new NpgsqlParameter("@accesslevel", accessLevel),
            new NpgsqlParameter("@accesscode", accessCode ?? (object)DBNull.Value),
            new NpgsqlParameter("@serviceid", serviceId),
            new NpgsqlParameter("@takenby", takenBy),
            new NpgsqlParameter("@divisioncode", divisionCode ?? (object)DBNull.Value),
            new NpgsqlParameter("@resulttype", resultType),
            new NpgsqlParameter("@pagenumber", pageNumber),
            new NpgsqlParameter("@pagesize", pageSize)
        };

                // ★ Execute the function and get results
                var applications = await dbcontext.CitizenApplications
                    .FromSqlRaw("SELECT * FROM get_disability_applications(@accesslevel, @accesscode, @serviceid, @takenby, @divisioncode, @resulttype, @pagenumber, @pagesize)", parameters)
                    .ToListAsync();

                // ★ Get total count
                int totalRecords = 0;
                try
                {
                    var countParameters = new[]
                    {
                new NpgsqlParameter("@accesslevel", accessLevel),
                new NpgsqlParameter("@accesscode", accessCode ?? (object)DBNull.Value),
                new NpgsqlParameter("@serviceid", serviceId),
                new NpgsqlParameter("@takenby", takenBy),
                new NpgsqlParameter("@divisioncode", divisionCode ?? (object)DBNull.Value),
                new NpgsqlParameter("@resulttype", resultType),
                new NpgsqlParameter("@pagenumber", 1),
                new NpgsqlParameter("@pagesize", 1000000)
            };

                    var countQuery = await dbcontext.CitizenApplications
                        .FromSqlRaw("SELECT * FROM get_disability_applications(@accesslevel, @accesscode, @serviceid, @takenby, @divisioncode, @resulttype, @pagenumber, @pagesize)", countParameters)
                        .ToListAsync();

                    totalRecords = countQuery.Count;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error getting total count");
                    totalRecords = applications.Count;
                }

                var serviceName = await dbcontext.Services
                    .Where(s => s.Serviceid == serviceId)
                    .Select(s => s.Servicename)
                    .FirstOrDefaultAsync() ?? "Unknown Service";

                List<dynamic> data = new();
                List<dynamic> columns = new()
        {
            new { accessorKey = "sno", header = "S.No" },
            new { accessorKey = "referenceNumber", header = "Reference Number" },
            new { accessorKey = "applicantName", header = "Applicant Name" },
            new { accessorKey = "serviceName", header = "Service Name" },
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

                        // ★ SIMPLIFIED: Read expiry_date directly from the Postgres result
                        // No parsing needed - Postgres already did it
                        string expiryDisplay = "No Expiry Data";

                        // The expiry_date is now available via FormdetailsFlat or a custom property
                        // Since FromSqlRaw maps to CitizenApplications entity, we need to read it from FormdetailsFlat
                        if (!string.IsNullOrWhiteSpace(application.FormdetailsFlat))
                        {
                            try
                            {
                                var flatObj = JToken.Parse(application.FormdetailsFlat);
                                var rawDate = flatObj["IfTemporaryDisabilityUdidCardValidUpto"]?.ToString();

                                if (!string.IsNullOrWhiteSpace(rawDate) && DateTime.TryParse(rawDate, out DateTime expDate))
                                {
                                    int daysLeft = (expDate.Date - DateTime.Today).Days;
                                    expiryDisplay = expDate.ToString("dd MMM yyyy") + (daysLeft >= 0 ? $" ({daysLeft} days left)" : " (Expired)");
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
                            applicationObject.noOfMailSent = 0; // Default since we removed ApplicationExpirations table
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

                return Json(new
                {
                    data,
                    columns,
                    totalRecords,
                    pageIndex,
                    pageSize,
                    totalPages = pageSize > 0 ? (int)Math.Ceiling((double)totalRecords / pageSize) : 0
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error in GetTemporaryDisability: {ex.Message}");
                return Json(new
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
        // DetailedApplicationsReportDto.cs
        public class DetailedApplicationsReportDto
        {
            // ── existing properties unchanged ───────────────────────────────
            [Column("districtname")] public string? DistrictName { get; set; }
            [Column("tswofficename")] public string? Tswofficename { get; set; }
            [Column("application_status")] public string? ApplicationStatus { get; set; }
            [Column("application_pending_with")] public string? ApplicationPendingWith { get; set; }
            [Column("referencenumber")] public string? ReferenceNumber { get; set; }
            [Column("applicant_name")] public string? ApplicantName { get; set; }
            [Column("parentage")] public string? Parentage { get; set; }
            [Column("date_of_birth")] public string? DateOfBirth { get; set; }   // ← NEW
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

            // ── date columns ────────────────────────────────────────────────
            [Column("submission_date")] public string? SubmissionDate { get; set; }
            [Column("sanctioned_date")] public string? SanctionedDate { get; set; }
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
            public string? ActionTakenOn { get; set; }   // maps to the quoted "ActionTakenOn" column
            public string? Iswithheld { get; set; }
            public string? Withheldtype { get; set; }
            public string? Withheldreason { get; set; }
            public long Totalcount { get; set; }
        }

        [HttpGet]
        public IActionResult GetOfficerAccessDetails()
        {
            var officer = GetOfficerDetails();
            if (officer == null)
                return BadRequest(new { error = "Officer details not found" });

            return Json(new
            {
                officer.AccessLevel,
                officer.AccessCode,
                officer.Role
            });
        }

        [HttpGet]
        public IActionResult GetApplicationsForReport(int AccessCode, int Serviceid, string? StatusType = null, string ReportType = "TehsilWise", string? DataType = null, DateTime? FromDate = null, DateTime? ToDate = null, DateTime? SanctionFromDate = null, DateTime? SanctionToDate = null, int pageIndex = 0, int pageSize = 10, string? accessLevel = null)
        {
            try
            {
                var officer = GetOfficerDetails();
                if (officer == null)
                    return BadRequest(new { error = "Officer details not found" });

                _logger.LogInformation(
                    $"Officer Details - Role: {officer.Role}, AccessLevel: {officer.AccessLevel}, AccessCode: {officer.AccessCode}");
                _logger.LogInformation(
                    $"Report filters - FromDate: {FromDate?.ToString("yyyy-MM-dd") ?? "NULL"}, ToDate: {ToDate?.ToString("yyyy-MM-dd") ?? "NULL"}, " +
                    $"SanctionFrom: {SanctionFromDate?.ToString("yyyy-MM-dd") ?? "NULL"}, SanctionTo: {SanctionToDate?.ToString("yyyy-MM-dd") ?? "NULL"}");

                // Normalize nullable params once so every branch can bind them cleanly.
                object fromDateParam = FromDate.HasValue ? (object)FromDate.Value.Date : DBNull.Value;
                object toDateParam = ToDate.HasValue ? (object)ToDate.Value.Date : DBNull.Value;
                object dataTypeParam = string.IsNullOrEmpty(DataType) ? DBNull.Value : (object)DataType;
                object sanctionFromParam = SanctionFromDate.HasValue ? (object)SanctionFromDate.Value.Date : DBNull.Value;
                object sanctionToParam = SanctionToDate.HasValue ? (object)SanctionToDate.Value.Date : DBNull.Value;

                List<dynamic> data;
                List<dynamic> columns;
                int totalRecords;

                switch (ReportType)
                {
                    case "AgeWise":
                        try
                        {
                            var ageParameters = new[]
                            {
                        new NpgsqlParameter("@serviceid", NpgsqlDbType.Integer) { Value = Serviceid },
                        new NpgsqlParameter("@accesslevel", NpgsqlDbType.Varchar) { Value = officer.AccessLevel == "Tehsil" ? "Tehsil" : officer.AccessLevel == "Division" ? "Division" : "District" },
                        new NpgsqlParameter("@accesscode", NpgsqlDbType.Integer) { Value = officer.AccessCode },
                        new NpgsqlParameter("@applicationstatus", NpgsqlDbType.Varchar) { Value = StatusType ?? "total" },
                        new NpgsqlParameter("@datatype", NpgsqlDbType.Varchar) { Value = dataTypeParam },
                        new NpgsqlParameter("@startdate", NpgsqlDbType.Timestamp) { Value = fromDateParam },
                        new NpgsqlParameter("@enddate", NpgsqlDbType.Timestamp) { Value = toDateParam }
                    };

                            var ageData = dbcontext.Database
                                .SqlQueryRaw<AgeWiseReportDto>(
                                    "SELECT * FROM get_age_counts_filtered(@serviceid, @accesslevel, @accesscode, @applicationstatus, @datatype, @startdate, @enddate)",
                                    ageParameters)
                                .ToList();

                            totalRecords = ageData.Count;
                            data = ageData.Skip(pageIndex * pageSize).Take(pageSize).ToList<dynamic>();
                            columns = new List<dynamic>
                    {
                        new { accessorKey = "age_range", header = "Age Range" },
                        new { accessorKey = "countofapplicants", header = "Beneficiary Count" }
                    };
                        }
                        catch (Exception ex)
                        {
                            _logger.LogError(ex, "AgeWise report failed");
                            return StatusCode(500, new { error = "AgeWise report failed", details = ex.Message });
                        }
                        break;

                    case "PensionTypeWise":
                        try
                        {
                            string statusParam = string.IsNullOrEmpty(StatusType) ? "sanctioned" : StatusType;

                            var pensionParameters = new[]
                            {
                        new NpgsqlParameter("@serviceid", NpgsqlDbType.Integer) { Value = Serviceid },
                        new NpgsqlParameter("@accesslevel", NpgsqlDbType.Varchar) { Value = officer.AccessLevel == "Tehsil" ? "Tehsil" : "District" },
                        new NpgsqlParameter("@accesscode", NpgsqlDbType.Integer) { Value = officer.AccessCode },
                        new NpgsqlParameter("@applicationstatus", NpgsqlDbType.Varchar) { Value = statusParam },
                        new NpgsqlParameter("@datatype", NpgsqlDbType.Varchar) { Value = dataTypeParam },
                        new NpgsqlParameter("@startdate", NpgsqlDbType.Timestamp) { Value = fromDateParam },
                        new NpgsqlParameter("@enddate", NpgsqlDbType.Timestamp) { Value = toDateParam }
                    };

                            var pensionData = dbcontext.Database
                                .SqlQueryRaw<PensionTypeWiseReportDto>(
                                    "SELECT * FROM get_age_and_pension_counts(@serviceid, @accesslevel, @accesscode, @applicationstatus, @datatype, @startdate, @enddate)",
                                    pensionParameters)
                                .ToList();

                            totalRecords = pensionData.Count;
                            data = pensionData.Skip(pageIndex * pageSize).Take(pageSize).ToList<dynamic>();
                            columns = new List<dynamic>
                    {
                        new { accessorKey = "age_range", header = "Age Range" },
                        new { accessorKey = "pensionType", header = "Pension Type" },
                        new { accessorKey = "countOfApplicants", header = "Beneficiary Count" }
                    };
                        }
                        catch (Exception ex)
                        {
                            _logger.LogError(ex, "PensionTypeWise report failed");
                            return StatusCode(500, new { error = "PensionTypeWise report failed", details = ex.Message });
                        }
                        break;

                    case "GenderWise":
                        try
                        {
                            var genderParameters = new[]
                            {
                        new NpgsqlParameter("@serviceid", NpgsqlDbType.Integer) { Value = Serviceid },
                        new NpgsqlParameter("@accesslevel", NpgsqlDbType.Varchar) { Value = officer.AccessLevel == "Tehsil" ? "Tehsil" : "District" },
                        new NpgsqlParameter("@accesscode", NpgsqlDbType.Integer)  { Value = officer.AccessCode },
                        new NpgsqlParameter("@applicationstatus", NpgsqlDbType.Varchar) { Value = StatusType ?? "total" },
                        new NpgsqlParameter("@datatype", NpgsqlDbType.Varchar) { Value = dataTypeParam },
                        new NpgsqlParameter("@startdate", NpgsqlDbType.Timestamp) { Value = fromDateParam },
                        new NpgsqlParameter("@enddate",   NpgsqlDbType.Timestamp) { Value = toDateParam }
                    };

                            var genderData = dbcontext.Database
                                .SqlQueryRaw<GenderWiseReportDto>(
                                    "SELECT * FROM get_gender_counts(@serviceid, @accesslevel, @accesscode, @applicationstatus, @datatype, @startdate, @enddate)",
                                    genderParameters)
                                .ToList();

                            totalRecords = genderData.Count;
                            data = genderData.Skip(pageIndex * pageSize).Take(pageSize).ToList<dynamic>();
                            columns = new List<dynamic>
                    {
                        new { accessorKey = "gender",            header = "Gender" },
                        new { accessorKey = "countofapplicants", header = "Beneficiary Count" }
                    };
                        }
                        catch (Exception ex)
                        {
                            _logger.LogError(ex, "GenderWise report failed");
                            return StatusCode(500, new { error = "GenderWise report failed", details = ex.Message });
                        }
                        break;

                    case "DetailedApplications":
                        try
                        {
                            string? effectiveAccessLevel = string.IsNullOrEmpty(accessLevel)
                                ? officer.AccessLevel
                                : accessLevel;

                            int? effectiveAccessCode =
                                (effectiveAccessLevel == "Tehsil" && officer.AccessLevel == "Tehsil")
                                    ? officer.AccessCode
                                    : AccessCode;

                            var detailedParameters = new[]
                            {
                                new NpgsqlParameter("@p_role", NpgsqlDbType.Varchar) { Value = officer.Role ?? (object)DBNull.Value },
                                new NpgsqlParameter("@p_access_level", NpgsqlDbType.Varchar) { Value = effectiveAccessLevel },
                                new NpgsqlParameter("@p_access_code", NpgsqlDbType.Integer) { Value = effectiveAccessCode },
                                new NpgsqlParameter("@p_application_status", NpgsqlDbType.Varchar) { Value = string.IsNullOrEmpty(StatusType) ? DBNull.Value : StatusType },
                                new NpgsqlParameter("@p_service_id", NpgsqlDbType.Integer) { Value = Serviceid },
                                new NpgsqlParameter("@p_page_index", NpgsqlDbType.Integer) { Value = pageIndex },
                                new NpgsqlParameter("@p_page_size", NpgsqlDbType.Integer) { Value = pageSize },
                                new NpgsqlParameter("@p_is_paginated", NpgsqlDbType.Boolean) { Value = true },
                                new NpgsqlParameter("@p_data_type", NpgsqlDbType.Varchar) { Value = dataTypeParam },
                                new NpgsqlParameter("@p_division_code", NpgsqlDbType.Integer) { Value = DBNull.Value },
                                new NpgsqlParameter("@p_startdate", NpgsqlDbType.Timestamp) { Value = fromDateParam },
                                new NpgsqlParameter("@p_enddate",   NpgsqlDbType.Timestamp) { Value = toDateParam },
                                new NpgsqlParameter("@p_sanction_startdate", NpgsqlDbType.Timestamp) { Value = sanctionFromParam },  // ← new
                                new NpgsqlParameter("@p_sanction_enddate",   NpgsqlDbType.Timestamp) { Value = sanctionToParam }     // ← new
                            };

                            var detailedData = dbcontext.Database
                                .SqlQueryRaw<DetailedApplicationsReportDto>(
                                    "SELECT * FROM get_applications_for_officer_report(" +
                                    "@p_role, @p_access_level, @p_access_code, @p_application_status, " +
                                    "@p_service_id, @p_page_index, @p_page_size, @p_is_paginated, " +
                                    "@p_data_type, @p_division_code, @p_startdate, @p_enddate, " +
                                    "@p_sanction_startdate, @p_sanction_enddate)",
                                    detailedParameters)
                                .ToList();

                            totalRecords = (int)(detailedData.FirstOrDefault()?.Totalcount ?? 0);
                            data = detailedData.Cast<dynamic>().ToList();
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
                                new { accessorKey = "dateOfBirth",                      header = "Date of Birth" },   // ← NEW
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
                        }
                        catch (Exception ex)
                        {
                            _logger.LogError(ex, "Detailed Applications report failed");
                            return StatusCode(500, new { error = "Detailed Applications report failed", details = ex.Message });
                        }
                        break;

                    case "TehsilWise":
                        try
                        {
                            var tehsilParameters = new[]
                            {
                        new NpgsqlParameter("@accesscode", NpgsqlDbType.Integer) { Value = officer.AccessCode },
                        new NpgsqlParameter("@serviceid", NpgsqlDbType.Integer) { Value = Serviceid },
                        new NpgsqlParameter("@accesslevel", NpgsqlDbType.Varchar) { Value = officer.AccessLevel == "Tehsil" ? "Tehsil" : "District" },
                        new NpgsqlParameter("@datatype", NpgsqlDbType.Varchar) { Value = dataTypeParam },
                        new NpgsqlParameter("@fromdate", NpgsqlDbType.Timestamp) { Value = fromDateParam },
                        new NpgsqlParameter("@todate", NpgsqlDbType.Timestamp) { Value = toDateParam }
                    };

                            var tehsilData = dbcontext.Database
                                .SqlQueryRaw<SummaryReports>(
                                    "SELECT * FROM get_applications_for_report(@accesscode, @serviceid, @accesslevel, @datatype, @fromdate, @todate)",
                                    tehsilParameters)
                                .ToList();

                            totalRecords = tehsilData.Count;
                            data = tehsilData.Skip(pageIndex * pageSize).Take(pageSize).ToList<dynamic>();
                            columns = new List<dynamic>
                    {
                        new { accessorKey = "tehsilName", header = "Tehsil Name" },
                        new { accessorKey = "totalApplicationsSubmitted", header = "Total Applications Received" },
                        new { accessorKey = "totalApplicationsPending", header = "Total Applications Pending" },
                        new { accessorKey = "totalApplicationsReturnToEdit", header = "Pending With Citizens" },
                        new { accessorKey = "totalApplicationsSanctioned", header = "Total Sanctioned" },
                        new { accessorKey = "totalApplicationsRejected", header = "Total Rejected" }
                    };
                        }
                        catch (Exception ex)
                        {
                            _logger.LogError(ex, "TehsilWise report failed");
                            return StatusCode(500, new { error = "TehsilWise report failed", details = ex.Message });
                        }
                        break;
                    case "WithheldApplications":
                        try
                        {
                            int? divisionCode = null;
                            if (string.Equals(officer.AccessLevel, "Division", StringComparison.OrdinalIgnoreCase))
                            {
                                divisionCode = officer.AccessCode;
                            }
                            else if (string.Equals(officer.AccessLevel, "District", StringComparison.OrdinalIgnoreCase)
                                     && officer.AccessCode.HasValue)
                            {
                                divisionCode = dbcontext.District
                                    .Where(d => d.Districtid == officer.AccessCode.Value)
                                    .Select(d => (int?)d.Division)
                                    .FirstOrDefault();
                            }
                            else if (string.Equals(officer.AccessLevel, "Tehsil", StringComparison.OrdinalIgnoreCase)
                                     && officer.AccessCode.HasValue)
                            {
                                divisionCode = dbcontext.Tswotehsil
                                    .Where(t => t.Tehsilid == officer.AccessCode.Value)
                                    .Select(t => (int?)t.Divisioncode)
                                    .FirstOrDefault();
                            }

                            var withheldParameters = new[]
                            {
                                new NpgsqlParameter("@p_role",           NpgsqlDbType.Varchar)   { Value = officer.Role ?? (object)DBNull.Value },
                                new NpgsqlParameter("@p_access_level",   NpgsqlDbType.Varchar)   { Value = officer.AccessLevel ?? (object)DBNull.Value },
                                new NpgsqlParameter("@p_access_code",    NpgsqlDbType.Integer)   { Value = officer.AccessCode ?? (object)DBNull.Value },
                                new NpgsqlParameter("@p_service_id",     NpgsqlDbType.Integer)   { Value = Serviceid },
                                new NpgsqlParameter("@p_page_index",     NpgsqlDbType.Integer)   { Value = pageIndex },
                                new NpgsqlParameter("@p_page_size",      NpgsqlDbType.Integer)   { Value = pageSize },
                                new NpgsqlParameter("@p_is_paginated",   NpgsqlDbType.Boolean)   { Value = true },
                                new NpgsqlParameter("@p_data_type",      NpgsqlDbType.Varchar)   { Value = dataTypeParam },
                                new NpgsqlParameter("@p_division_code",  NpgsqlDbType.Integer)   { Value = divisionCode ?? (object)DBNull.Value },
                                new NpgsqlParameter("@p_startdate",      NpgsqlDbType.Timestamp) { Value = fromDateParam },
                                new NpgsqlParameter("@p_enddate",        NpgsqlDbType.Timestamp) { Value = toDateParam }
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
                            data = [.. withheldData.Cast<dynamic>()];

                            columns = new List<dynamic>
                    {
                        new { accessorKey = "districtname",            header = "District" },
                        new { accessorKey = "tswofficename",           header = "TSWO Office" },
                        new { accessorKey = "application_status",      header = "Application Status" },
                        new { accessorKey = "application_pending_with",header = "Application Pending With" },
                        new { accessorKey = "referencenumber",         header = "Reference Number" },
                        new { accessorKey = "applicant_name",          header = "Applicant Name" },
                        new { accessorKey = "parentage",               header = "Parentage" },
                        new { accessorKey = "mobile_number",           header = "Mobile Number" },
                        new { accessorKey = "account_number",          header = "Account Number" },
                        new { accessorKey = "ifsc_code",               header = "IFSC Code" },
                        new { accessorKey = "bank_name",               header = "Bank Name" },
                        new { accessorKey = "branch_name",             header = "Branch Name" },
                        new { accessorKey = "actionTakenOn",           header = "Action Taken On" },
                        new { accessorKey = "iswithheld",              header = "Is Withheld" },
                        new { accessorKey = "withheldtype",            header = "Withheld Type" },
                        new { accessorKey = "withheldreason",          header = "Withheld Reason" }
                    };
                        }
                        catch (Exception ex)
                        {
                            _logger.LogError(ex, "Withheld Applications report failed");
                            return StatusCode(500, new { error = "Withheld Applications report failed", details = ex.Message });
                        }
                        break;

                    default:
                        return BadRequest(new { status = false, message = "Invalid report type" });

                }

                return Json(new
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
                _logger.LogError(ex, $"Error executing report for AccessCode: {AccessCode}, Serviceid: {Serviceid}, ReportType: {ReportType}");
                return StatusCode(500, new
                {
                    status = false,
                    error = "An error occurred while fetching the report",
                    details = ex.Message,
                    reportType = ReportType,
                    serviceId = Serviceid,
                    accessCode = AccessCode
                });
            }
        }

        [HttpGet]
        public IActionResult GetReportTypes()
        {
            try
            {
                var reportTypes = new List<dynamic>
                {
                    new { value = "TehsilWise",           label = "Tehsil Wise Applications Report" },
                    new { value = "AgeWise",              label = "Age Wise Report" },
                    new { value = "PensionTypeWise",      label = "Pension Type Wise Report" },
                    new { value = "GenderWise",           label = "Gender Wise Report" },
                    new { value = "DetailedApplications", label = "Detailed Applications Report" },
                    new { value = "WithheldApplications", label = "Withheld Applications Report" }   // ← comma added above
                };

                return Ok(new { status = true, reportTypes });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching report types");
                return StatusCode(500, new { status = false, message = ex.Message });
            }
        }
        private async Task<string> GetAgeRangesFromBody()
        {
            try
            {
                // Enable rewinding the request body
                Request.EnableBuffering();

                using (var reader = new StreamReader(Request.Body, leaveOpen: true))
                {
                    var body = await reader.ReadToEndAsync();
                    Request.Body.Position = 0; // Reset the stream position

                    if (!string.IsNullOrEmpty(body))
                    {
                        var json = Newtonsoft.Json.Linq.JObject.Parse(body);
                        if (json["ageRanges"] != null)
                        {
                            return json["ageRanges"]!.ToString();
                        }
                    }
                }
                return null!;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error reading age ranges from request body");
                return null!;
            }
        }




        [HttpGet]
        public IActionResult GetUserDetails(string applicationId)
        {
            var officer = GetOfficerDetails();
            var details = dbcontext.CitizenApplications.FirstOrDefault(ca => ca.Referencenumber == applicationId);
            if (details == null)
                return Json(new { error = "Application not found" });

            // PostgreSQL function call for corrigendum
            var parameters = new[]
            {
                new NpgsqlParameter("@officeraccesslevel", officer.AccessLevel),
                new NpgsqlParameter("@officeraccesscode", officer.AccessCode),
                new NpgsqlParameter("@referencenumber", applicationId),
                new NpgsqlParameter("@status", DBNull.Value),
                new NpgsqlParameter("@corrigendumid", DBNull.Value),
                new NpgsqlParameter("@type", DBNull.Value),
                new NpgsqlParameter("@officerrole", officer.Role)
            };

            var IsCorrigendumPending = dbcontext.Corrigendum
               .FromSqlRaw("SELECT * FROM get_corrigendum_by_location_access(@officeraccesslevel, @officeraccesscode, @referencenumber, @status, @corrigendumid, @type, @officerrole)", parameters)
               .ToList();

            var formDetailsToken = JToken.Parse(details.Formdetails!);
            var privatedFields = JsonConvert.DeserializeObject<List<string>>(
                dbcontext.Services.FirstOrDefault(s => s.Serviceid == details.Serviceid)?.Privatefields ?? "[]"
            );

            _logger.LogInformation($"-------------------- Corrigendum Count: {IsCorrigendumPending.Count} -----------------------");

            bool hasPending = false;
            string corrigendumType = "";
            List<dynamic> corrigendumFieldChanges = new List<dynamic>();
            List<string> corrigendumFiles = new List<string>();
            string pendingRemarks = "";
            int currentCorrigendumPlayer = -1;
            JArray? corrigendumWorkflow = null;
            List<dynamic>? corrigendumActions = null;
            bool canTakeCorrigendumAction = false;
            bool canTakeAction = false;

            if (IsCorrigendumPending.Count != 0)
            {
                foreach (var application in IsCorrigendumPending)
                {
                    var workflowArray = JArray.Parse(application.Workflow);
                    hasPending = workflowArray.Any(item => string.Equals((string)item["status"]!, "pending", StringComparison.OrdinalIgnoreCase));
                    corrigendumType = application.Type!;
                    currentCorrigendumPlayer = application.Currentplayer;
                    corrigendumWorkflow = workflowArray;

                    if (application.Corrigendumfields != null)
                    {
                        var corrigendumFields = JObject.Parse(application.Corrigendumfields);
                        pendingRemarks = corrigendumFields["remarks"]?.ToString() ?? "";

                        var corFiles = corrigendumFields["Files"] as JObject;
                        if (corFiles != null)
                        {
                            corrigendumFiles = corFiles
                                .Properties()
                                .SelectMany(p => p.Value is JArray arr
                                    ? arr.Select(f => f?.ToString()).Where(f => !string.IsNullOrWhiteSpace(f))
                                    : Enumerable.Empty<string>())
                                .ToList()!;
                        }

                        var stack = new Stack<(string path, JToken field)>();
                        foreach (var item in corrigendumFields)
                        {
                            if (item.Key != "remarks" && item.Key != "Files" && item.Value is JObject)
                            {
                                stack.Push((item.Key, item.Value));
                            }
                        }

                        int fieldIndex = 1;
                        while (stack.Count > 0)
                        {
                            var (path, field) = stack.Pop();
                            string header = Regex.Replace(path, "(\\B[A-Z])", " $1");
                            string oldValue = field["old_value"]?.ToString() ?? "";
                            string newValue = field["new_value"]?.ToString() ?? "";

                            if (path.IndexOf("Date", StringComparison.OrdinalIgnoreCase) >= 0)
                            {
                                if (DateTime.TryParse(oldValue, out DateTime oldDt))
                                    oldValue = oldDt.ToString("dd MMM yyyy");
                                if (DateTime.TryParse(newValue, out DateTime newDt))
                                    newValue = newDt.ToString("dd MMM yyyy");
                            }

                            corrigendumFieldChanges.Add(new
                            {
                                sno = fieldIndex,
                                formField = header,
                                oldvalue = oldValue,
                                newvalue = newValue
                            });
                            fieldIndex++;

                            var additionalValues = field["additional_values"];
                            if (additionalValues != null && additionalValues is JObject nested)
                            {
                                foreach (var nestedItem in nested)
                                {
                                    string nestedPath = $"{path}.{nestedItem.Key}";
                                    stack.Push((nestedPath, nestedItem.Value)!);
                                }
                            }
                        }

                        if ((application.Type == "Corrigendum" && application.Status == "Sanctioned") ||
                            (application.Type == "Correction" && application.Status == "Verified"))
                        {
                            foreach (var field in corrigendumFields.Properties())
                            {
                                if (field.Name == "Files" || field.Name == "remarks")
                                    continue;
                                var newValue = field.Value["new_value"]?.ToString();
                                if (!string.IsNullOrEmpty(newValue))
                                {
                                    UpdateFieldValueRecursively(formDetailsToken, field.Name, newValue);
                                }
                            }
                        }
                    }

                    if (hasPending && corrigendumWorkflow != null &&
                        currentCorrigendumPlayer >= 0 && currentCorrigendumPlayer < corrigendumWorkflow.Count)
                    {
                        var currentCorrigendumOfficer = corrigendumWorkflow[currentCorrigendumPlayer];
                        if (currentCorrigendumOfficer["designation"]?.ToString() == officer.Role &&
                            currentCorrigendumOfficer["status"]?.ToString() == "pending")
                        {
                            canTakeCorrigendumAction = true;
                            corrigendumActions = BuildCorrigendumActions(corrigendumWorkflow, currentCorrigendumPlayer,
                                corrigendumType, formDetailsToken);
                        }
                    }
                }
            }

            var serviceDetails = dbcontext.Services.FirstOrDefault(s => s.Serviceid == details.Serviceid);
            bool isSanctioned = details.Status == "Sanctioned";

            formDetailsToken = ReorderFormDetails(formDetailsToken, applicationId, isSanctioned);
            var formDetails = JsonConvert.DeserializeObject<dynamic>(details.Formdetails!);
            var officerArray = JsonConvert.DeserializeObject<JArray>(details.Workflow!);
            _logger.LogInformation($"-------------------- Current Player Index: {details.Currentplayer} ----------------------- Officer Array Count: {officerArray!.Count} -----------------------");
            int currentPlayer = details.Currentplayer ?? 0;

            List<dynamic> previousOfficersDetails = new List<dynamic>();
            JObject previousAdditionalDetails = new JObject();

            for (int i = 0; i < currentPlayer; i++)
            {
                var prevOfficer = officerArray![i];
                var designation = prevOfficer["designation"]?.ToString() ?? "";
                var accessLevel = prevOfficer["accessLevel"]?.ToString() ?? "";
                var status = prevOfficer["status"]?.ToString() ?? "";
                var officerArea = GetOfficerArea(accessLevel, formDetails);

                var additionalDetails = prevOfficer["additionalDetails"] as JObject;
                var remarks = additionalDetails?["remarks"]?.ToString() ?? "";
                var recommendation = additionalDetails?["recommendation"]?.ToString() ?? "";
                var recommendationRemarks = additionalDetails?["recommendationRemarks"]?.ToString() ?? "";

                var actionForm = prevOfficer["actionForm"] as JArray;
                List<dynamic> actionFormFields = new List<dynamic>();

                if (actionForm != null)
                {
                    foreach (var field in actionForm)
                    {
                        var fieldObj = field as JObject;
                        if (fieldObj != null)
                        {
                            actionFormFields.Add(new
                            {
                                label = fieldObj["label"]?.ToString() ?? "",
                                value = fieldObj["value"]?.ToString() ?? "",
                                type = fieldObj["type"]?.ToString() ?? ""
                            });
                        }
                    }
                }

                previousOfficersDetails.Add(new
                {
                    officerDesignation = designation,
                    officerArea,
                    fullOfficerInfo = $"{designation} {officerArea}",
                    status,
                    remarks,
                    recommendation,
                    recommendationRemarks,
                    additionalDetails = additionalDetails ?? new JObject(),
                    actionFormFields,
                    playerIndex = i,
                    actionDate = additionalDetails?["actionDate"]?.ToString() ?? ""
                });

                if (i == currentPlayer - 1)
                {
                    previousAdditionalDetails = additionalDetails ?? new JObject();
                }
            }

            // ★ NEW: Mark the application as opened once for the current officer
            if (currentPlayer >= 0 && currentPlayer < officerArray!.Count)
            {
                var currentStep = officerArray[currentPlayer];
                if (currentStep["openedOnce"] == null || currentStep["openedOnce"]!.ToString().ToLower() != "true")
                {
                    currentStep["openedOnce"] = true;
                    _logger.LogInformation($"Marked openedOnce=true for {officer.Role} on application {applicationId}");
                }
            }

            UpdateWorkflowFlags(officerArray!, currentPlayer);

            _logger.LogInformation("Saving workflow for {ApplicationId}: {Workflow}", applicationId, details.Workflow);
            details.Workflow = JsonConvert.SerializeObject(officerArray);


            dbcontext.SaveChanges();

            _logger.LogInformation("Workflow saved successfully for {ApplicationId}", applicationId);

            var mainCurrentOfficer = officerArray!.FirstOrDefault(o => (int)o["playerId"]! == currentPlayer);
            var currentOfficerClone = mainCurrentOfficer != null ? (JObject)mainCurrentOfficer.DeepClone() : new JObject();

            canTakeAction = mainCurrentOfficer != null &&
                            mainCurrentOfficer["designation"]?.ToString() == officer.Role &&
                            mainCurrentOfficer["status"]?.ToString() == "pending";

            InjectEditableActionForm(currentOfficerClone, serviceDetails, currentPlayer);
            UpdateOfficerActionFormLabels(currentOfficerClone, formDetails);
            ReplaceCodeFieldsWithNames(formDetailsToken);
            // FormatDateFields(formDetailsToken);

            var corrigendumData = new
            {
                hasPendingCorrigendum = hasPending,
                corrigendumType,
                fieldChanges = corrigendumFieldChanges,
                files = corrigendumFiles.Any() ? corrigendumFiles : new List<string> { "NO FILES" },
                remarks = pendingRemarks,
                canTakeAction = canTakeCorrigendumAction,
                actions = corrigendumActions ?? new List<dynamic>(),
                currentPlayerIndex = currentCorrigendumPlayer,
                workflow = corrigendumWorkflow
            };

            return Json(new
            {
                list = formDetailsToken,
                currentOfficerDetails = currentOfficerClone,
                hasPending,
                privatedFields,
                previousOfficersDetails,
                isSanctioned,
                corrigendum = corrigendumData,
                canTakeAction,
                previousAdditionalDetails
            });
        }

        private List<dynamic> BuildCorrigendumActions(JArray workflow, int currentPlayerIndex,
     string corrigendumType, JToken formDetails)
        {
            var actions = new List<dynamic> { new { label = "Reject", value = "reject" } };

            if (currentPlayerIndex > 0)
            {
                var prevOfficer = workflow[currentPlayerIndex - 1];
                string prevOfficerDesignation = (string)prevOfficer["designation"]!;
                string prevOfficerAccessLevel = (string)prevOfficer["accessLevel"]!;
                string officerArea = GetOfficerArea(prevOfficerAccessLevel, formDetails);
                actions.Add(new { label = $"Return to {prevOfficerDesignation} {officerArea}", value = "return" });

                // For Correction type, add Verify action
                if (corrigendumType == "Correction")
                {
                    actions.Add(new { label = $"Verify", value = "verified" });
                }
            }

            // Check if current officer is sanction officer
            var sanctionOfficer = workflow.FirstOrDefault(o => o["status"]?.ToString() == "sanctioned");
            var currentCorrigendumOfficer = workflow[currentPlayerIndex]; // Renamed

            if (sanctionOfficer != null && sanctionOfficer["designation"]?.ToString() == currentCorrigendumOfficer["designation"]?.ToString())
            {
                actions.Add(new { label = $"Issue {corrigendumType}", value = "sanction" });
            }
            else if (workflow.Count > currentPlayerIndex + 1)
            {
                var nextOfficer = workflow[currentPlayerIndex + 1];
                string nextOfficerDesignation = (string)nextOfficer["designation"]!;
                string nextOfficerAccessLevel = (string)nextOfficer["accessLevel"]!;
                string officerArea = GetOfficerArea(nextOfficerAccessLevel, formDetails);
                actions.Add(new { label = $"Forward to {nextOfficerDesignation} {officerArea}", value = "forward" });
            }

            return actions;
        }


        [HttpGet]
        public async Task<IActionResult> GetSanctionLetter(string applicationId)
        {
            OfficerDetailsModal officer = GetOfficerDetails();
            var formdetails = dbcontext.CitizenApplications.FirstOrDefault(fd => fd.Referencenumber == applicationId);
            var lettersJson = dbcontext.Services
                       .FirstOrDefault(s => s.Serviceid == Convert.ToInt32(formdetails!.Serviceid))?.Letters;

            var parsed = JsonConvert.DeserializeObject<Dictionary<string, dynamic>>(lettersJson!);
            dynamic? sanctionSection = parsed!.TryGetValue("Sanction", out var sanction) ? sanction : null;
            var tableFields = sanctionSection!.tableFields;
            var sanctionLetterFor = sanctionSection.letterFor;
            var information = sanctionSection.information;

            var details = dbcontext.CitizenApplications
                .FirstOrDefault(ca => ca.Referencenumber == applicationId);



            var formData = JsonConvert.DeserializeObject<JObject>(details!.Formdetails!);

            // Final key-value pair list for the PDF
            var pdfFields = new Dictionary<string, string>();

            foreach (var item in tableFields)
            {
                var formatted = GetFormattedValue(item, formData);
                string label = formatted.Label ?? "[Label Missing]";
                string value = formatted.Value ?? "";

                pdfFields[label] = value;
            }

            // Call your PDF generator
            await _pdfService.CreateSanctionPdf(pdfFields, sanctionLetterFor?.ToString() ?? "", information?.ToString() ?? "", officer, applicationId);
            string fileName = applicationId.Replace("/", "_") + "_SanctionLetter.pdf";

            return Json(new
            {
                status = true,
                path = fileName
            });
        }

        [HttpGet]
        public async Task<IActionResult> GetApplicationHistory(string ApplicationId, int page = 0, int size = 20)
        {
            if (string.IsNullOrEmpty(ApplicationId))
            {
                return BadRequest("ApplicationId is required.");
            }

            var application = await dbcontext.CitizenApplications
                .FirstOrDefaultAsync(ca => ca.Referencenumber == ApplicationId);

            if (application == null)
            {
                return NotFound("Application not found.");
            }

            var players = JsonConvert.DeserializeObject<JArray>(application.Workflow!);
            int? currentPlayerIndex = (int)application.Currentplayer!;
            var currentPlayer = players!.FirstOrDefault(o => (int)o["playerId"]! == currentPlayerIndex);

            var formDetails = JsonConvert.DeserializeObject<dynamic>(application.Formdetails!);

            // Fetch history and parse dates safely
            var history = await dbcontext.Actionhistory
                .Where(ah => ah.Referencenumber == ApplicationId)
                .ToListAsync();

            _logger.LogInformation($"-------------------- Application History Count: {history.Count} -----------------------");

            // Helper to safely parse Actiontakendate in multiple formats
            DateTime? ParseActionDate(string? dateStr)
            {
                if (string.IsNullOrWhiteSpace(dateStr))
                    return null;

                dateStr = dateStr.Trim();

                var formats = new[]
                {
                    "dd MMM yyyy hh:mm:ss tt",   // 17 Dec 2025 09:40:41 PM
                    "dd-MM-yyyy HH:mm:ss",       // 21-01-2025 13:24:13
                    "dd-MM-yyyy hh:mm:ss tt",   // 21-01-2025 09:40:41 PM
                    "dd/MM/yyyy HH:mm:ss",       // 21/01/2025 13:24:13
                    "dd MMM yyyy HH:mm:ss"       // 17 Dec 2025 13:24:13 (if no AM/PM)
                };

                if (DateTime.TryParseExact(dateStr, formats, CultureInfo.InvariantCulture, DateTimeStyles.None, out DateTime parsed))
                    return parsed;

                // Fallback: let .NET guess
                if (DateTime.TryParse(dateStr, CultureInfo.InvariantCulture, DateTimeStyles.None, out parsed))
                    return parsed;

                _logger.LogWarning("Failed to parse Actiontakendate: '{Date}' for ApplicationId: {AppId}", dateStr, ApplicationId);
                return null;
            }

            // Sort history by parsed date (ascending = oldest first)
            var sortedHistory = history
                .Select(h => new
                {
                    Item = h,
                    ParsedDate = ParseActionDate(h.Actiontakendate)
                })
                .Where(x => x.ParsedDate.HasValue)
                .OrderBy(x => x.ParsedDate) // Oldest → Newest
                .Select(x => x.Item)
                .ToList();

            // Add unparseable entries at the end (optional, or skip them)
            var unparseable = history.Except(sortedHistory).ToList();
            sortedHistory.AddRange(unparseable);

            // Build response data
            var columns = new List<dynamic>
            {
                new { header = "S.No", accessorKey = "sno" },
                new { header = "Action Taker", accessorKey = "actionTaker" },
                new { header = "Action Taken", accessorKey = "actionTaken" },
                new { header = "Remarks", accessorKey = "remarks" },
                new { header = "Action Taken On", accessorKey = "actionTakenOn" },
            };

            List<dynamic> data = new();
            int index = 1;

            foreach (var item in sortedHistory)
            {
                _logger.LogInformation($"ACCESS LEVEL: {item.Locationlevel}  ACCESS CODE: {item.Locationvalue}");
                string officerArea = GetOfficerAreaForHistory(item.Locationlevel!, item.Locationvalue);

                string actionTaker = item.Actiontaker != "Citizen"
                    ? $"{item.Actiontaker} {officerArea}".Trim()
                    : "Citizen";

                string actionTaken = item.Actiontaken == "ReturnToCitizen"
                    ? "Returned to citizen for correction"
                    : item.Actiontaken == "ReturnToPlayer"
                        ? "Returned to previous officer for correction"
                    : item.Actiontaken ?? "";

                data.Add(new
                {
                    sno = index++,
                    actionTaker,
                    actionTaken,
                    remarks = item.Remarks ?? "",
                    actionTakenOn = item.Actiontakendate ?? ""
                });
            }

            // Add current pending step if status is "pending"
            if (currentPlayer != null && (string?)currentPlayer["status"] == "pending")
            {
                string designation = (string)currentPlayer["designation"]!;
                string accessLevel = (string)currentPlayer["accessLevel"]!;
                string officerArea = GetOfficerArea(accessLevel, formDetails);

                data.Add(new
                {
                    sno = index++,
                    actionTaker = $"{designation} {officerArea}".Trim(),
                    actionTaken = "Pending",
                    remarks = (string?)null,
                    actionTakenOn = ""
                });
            }

            // Optional: Apply pagination
            var paginatedData = data
                .Skip(page * size)
                .Take(size)
                .ToList();

            int totalRecords = data.Count;

            return Json(new
            {
                data = paginatedData,
                columns,
                totalRecords,
                customActions = new { }
            });
        }

        // A withheld record is "active" (still editable / in-flight) until it reaches
        // a terminal status. Approved/completed records are treated as immutable
        // history, so any further action spins up a new record instead.
        private static bool IsWithheldRecordActive(WithheldApplications wa)
        {
            if (wa == null) return false;
            var s = (wa.LatestWfStatus ?? wa.Status ?? "").Trim().ToLower();
            return s != "approved" && s != "sanctioned" && s != "legacy data";
        }

        public IActionResult GetWithheldApplication(string referenceNumber, string serviceId)
        {
            if (string.IsNullOrEmpty(referenceNumber) || string.IsNullOrEmpty(serviceId))
            {
                return Json(new { status = false, response = "Reference number and service ID are required." });
            }

            if (!int.TryParse(serviceId, out int parsedServiceId))
            {
                return Json(new { status = false, response = "Invalid service ID format." });
            }

            var officer = GetOfficerDetails();
            if (officer == null)
            {
                return Json(new { status = false, response = "Unauthorized: Officer details not found." });
            }

            // 1. Load ALL withheld records for this application (ordered oldest → newest)
            var allWithheldRecords = dbcontext.WithheldApplications
                .Where(wa => wa.Referencenumber == referenceNumber && wa.Serviceid == parsedServiceId)
                .OrderBy(wa => wa.WithheldId)
                .ToList();

            var withheldApplication = allWithheldRecords.FirstOrDefault(IsWithheldRecordActive);
            var lastWithheldRecord = allWithheldRecords.LastOrDefault();
            var displayRecord = withheldApplication ?? lastWithheldRecord;

            // ★ REVOKE PULL PERMISSION: When the current officer opens the withheld application,
            // revoke the previous officer's ability to pull it back.
            if (withheldApplication != null && !string.IsNullOrEmpty(withheldApplication.Workflow))
            {
                try
                {
                    var withheldWfArray = JArray.Parse(withheldApplication.Workflow);
                    UpdateWorkflowFlags(withheldWfArray, withheldApplication.Currentplayer ?? 0);
                    withheldApplication.Workflow = JsonConvert.SerializeObject(withheldWfArray);

                    // EF Core is tracking withheldApplication, so SaveChanges will persist the updated JSON
                    dbcontext.SaveChanges();
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to update withheld workflow flags for {Ref}", referenceNumber);
                }
            }

            bool hasAnyRecord = allWithheldRecords.Count > 0;
            bool hasActiveRecord = withheldApplication != null;
            bool isNewRecordMode = hasAnyRecord && !hasActiveRecord;

            var citizenApplication = dbcontext.CitizenApplications
                .FirstOrDefault(ca => ca.Referencenumber == referenceNumber);

            var service = dbcontext.Services.FirstOrDefault(s => s.Serviceid == parsedServiceId);
            List<dynamic> workflow;

            try
            {
                workflow = JsonConvert.DeserializeObject<List<dynamic>>(service!.Officereditablefield!) ?? new List<dynamic>();
            }
            catch (JsonException ex)
            {
                return StatusCode(500, $"Error parsing workflow: {ex.Message}");
            }

            if (workflow.Count == 0)
                return Json(new { status = false, response = "No workflow defined for this service." });

            dynamic currentOfficer = workflow.FirstOrDefault(p => p.designation == officer.Role)!;
            if (currentOfficer == null)
                return Json(new { status = false, response = "Officer not part of the workflow." });

            int currentPlayerId = (int)currentOfficer.playerId;
            bool isLastPlayer = currentPlayerId == workflow.Count - 1;
            bool canWithhold = (bool?)currentOfficer.canWithhold ?? false;
            bool canDirectWithheld = (bool?)currentOfficer.canDirectWithheld ?? false;

            // Determine if current officer is the one who sanctioned
            bool isSanctioningOfficer = false;
            if (citizenApplication != null && !string.IsNullOrEmpty(citizenApplication.Workflow))
            {
                try
                {
                    var citizenWorkflowHistory = JsonConvert.DeserializeObject<List<dynamic>>(citizenApplication.Workflow);
                    var sanctionEntry = citizenWorkflowHistory?
                        .LastOrDefault(h => h.status?.ToString()?.Equals("sanctioned", StringComparison.OrdinalIgnoreCase) == true);

                    if (sanctionEntry != null)
                    {
                        var sanctionPlayerId = sanctionEntry.playerId != null ? (int)sanctionEntry.playerId : -1;
                        var sanctionDesignation = sanctionEntry.designation?.ToString() ?? "";
                        var sanctionOfficerName = sanctionEntry.officer?.ToString() ?? "";

                        if (sanctionPlayerId == currentPlayerId ||
                            sanctionDesignation.Equals(officer.Role, StringComparison.OrdinalIgnoreCase) ||
                            sanctionOfficerName.Equals(officer.Name, StringComparison.OrdinalIgnoreCase))
                        {
                            isSanctioningOfficer = true;
                        }
                    }
                }
                catch (JsonException ex)
                {
                    _logger.LogError($"Error parsing CitizenApplications.Workflow: {ex.Message}");
                }
            }

            if (withheldApplication == null)
            {
                if (citizenApplication == null)
                    return Json(new { status = false, response = "Application not found." });

                if (citizenApplication.Status != "Sanctioned")
                    return Json(new { status = false, response = "Application is not sanctioned and cannot be withheld." });
            }

            // 2. Permission flags on the ACTIVE record
            bool canRemoveFromWithheld = false;
            bool isWithholdingOfficer = false;
            bool isFirstOfficer = false;

            if (withheldApplication != null)
            {
                var historyList = JsonConvert.DeserializeObject<List<dynamic>>(withheldApplication.History ?? "[]");
                var firstWithheldEntry = historyList?.FirstOrDefault(h => h.status == "withheld");

                isFirstOfficer = firstWithheldEntry != null &&
                    firstWithheldEntry!.ContainsKey("playerId") &&
                    (int)firstWithheldEntry!.playerId == currentPlayerId;

                var withheldEntry = historyList?.LastOrDefault(h => h.status == "withheld" || h.status == "approved");
                if (withheldEntry != null && withheldEntry!.ContainsKey("playerId"))
                {
                    int withheldPlayerId = (int)withheldEntry!.playerId;
                    isWithholdingOfficer = currentPlayerId == withheldPlayerId;
                    canRemoveFromWithheld = currentPlayerId >= withheldPlayerId;
                }
            }

            bool hasPendingReleaseRequest = false;
            string pendingReleaseFromPlayer = "";

            if (withheldApplication != null)
            {
                var historyList = JsonConvert.DeserializeObject<List<dynamic>>(withheldApplication.History ?? "[]");
                var pendingRequest = historyList?.LastOrDefault(h =>
                    h.status == "forwarded" &&
                    (h.remarks?.ToString()?.Contains("release", StringComparison.OrdinalIgnoreCase) == true ||
                     h.remarks?.ToString()?.Contains("remove", StringComparison.OrdinalIgnoreCase) == true));

                if (pendingRequest != null)
                {
                    hasPendingReleaseRequest = true;
                    pendingReleaseFromPlayer = pendingRequest.officer?.ToString() ?? "";
                }
            }

            // 3. Merged Action History
            var history = new List<dynamic>();
            foreach (var rec in allWithheldRecords)
            {
                var h = JsonConvert.DeserializeObject<List<dynamic>>(rec.History ?? "[]");
                if (h != null) history.AddRange(h);
            }

            var columns = new List<dynamic>
            {
                new { header = "S.No", accessorKey = "sno" },
                new { header = "Action Taker", accessorKey = "actionTaker" },
                new { header = "Action Taken", accessorKey = "actionTaken" },
                new { header = "Remarks", accessorKey = "remarks" },
                new { header = "Action Taken On", accessorKey = "actionTakenOn" },
            };

            int index = 1;
            List<dynamic> data = new List<dynamic>();
            foreach (var item in history)
            {
                data.Add(new
                {
                    sno = index,
                    actionTaker = item.officer,
                    actionTaken = item.status,
                    remarks = item.remarks,
                    actionTakenOn = item.actionTakenOn,
                });
                index++;
            }

            // 3b. Aggregate EVERY officer-uploaded file across all cycles
            var allOfficerFiles = new List<dynamic>();
            foreach (var rec in allWithheldRecords)
            {
                List<string> recFiles;
                try
                {
                    recFiles = JsonConvert.DeserializeObject<List<string>>(rec.Files ?? "[]") ?? new List<string>();
                }
                catch (JsonException ex)
                {
                    _logger.LogError($"Error parsing WithheldApplications.Files for WithheldId={rec.WithheldId}: {ex.Message}");
                    recFiles = new List<string>();
                }

                foreach (var f in recFiles)
                {
                    if (string.IsNullOrWhiteSpace(f)) continue;
                    allOfficerFiles.Add(new
                    {
                        fileName = f,
                        withheldId = rec.WithheldId,
                        withheldType = rec.Withheldtype,
                        isWithheld = rec.Iswithheld,
                        status = rec.Status,
                        cycleLabel = $"Cycle #{rec.WithheldId}"
                    });
                }
            }

            var applicationDetails = new ExpandoObject() as IDictionary<string, object>;
            var withheldDetails = new ExpandoObject() as IDictionary<string, dynamic>;

            if (displayRecord != null)
            {
                withheldDetails["withheldType"] = displayRecord.Withheldtype;
                withheldDetails["withheldReason"] = displayRecord.Withheldreason;
                withheldDetails["isWithheld"] = displayRecord.Iswithheld;
                withheldDetails["currentPlayer"] = displayRecord.Currentplayer!;
                withheldDetails["status"] = displayRecord.Status!;
                withheldDetails["files"] = JsonConvert.DeserializeObject<List<string>>(displayRecord.Files ?? "[]")!;
                withheldDetails["isFirstOfficer"] = isFirstOfficer;
            }

            if (citizenApplication?.Formdetails != null)
            {
                try
                {
                    var formDetails = JToken.Parse(citizenApplication.Formdetails);
                    var dswovalue = dbcontext.District
                        .FirstOrDefault(to => to.Districtid == Convert.ToInt32(GetFieldValue("District", formDetails)))?.Districtname ?? "N/A";

                    applicationDetails["applicantName"] = GetFieldValue("ApplicantName", formDetails) ?? "N/A";
                    applicationDetails["parentage"] = GetFieldValue("Parentage", formDetails) ?? "N/A";
                    applicationDetails["r/o"] = $"DISTRICT: {dswovalue}, ADDRESS: {GetFieldValue("PresentAddress", formDetails)}";
                }
                catch (JsonException) { }
            }

            bool recordExists = hasAnyRecord;
            bool canCreate = false;
            bool canChooseWithheldType = false;
            bool canChooseIsWithheld = false;

            if (withheldApplication == null)
            {
                canCreate = canWithhold || canDirectWithheld;
                canChooseWithheldType = true;
                canChooseIsWithheld = true;
                isFirstOfficer = true;
            }
            else
            {
                bool isCurrentPlayer = currentPlayerId == withheldApplication.Currentplayer;
                if (isCurrentPlayer)
                {
                    canCreate = true;
                    canChooseWithheldType = isFirstOfficer;
                    canChooseIsWithheld = isFirstOfficer;
                }
            }

            if (displayRecord != null)
            {
                withheldDetails["isFirstOfficer"] = isFirstOfficer;
            }

            // 4. Build action options
            var options = new List<dynamic>();
            if (withheldApplication != null && hasActiveRecord)
            {
                var workflowList = JsonConvert.DeserializeObject<List<dynamic>>(withheldApplication.Workflow ?? "[]");
                if (workflowList != null && workflowList.Count > 0 && currentPlayerId >= 0 && currentPlayerId < workflowList.Count)
                {
                    if (currentPlayerId > 0)
                    {
                        var prevOfficer = workflowList[currentPlayerId - 1];
                        options.Add(new { label = $"Return to {prevOfficer.designation}", value = "return" });
                    }

                    if (isLastPlayer || isSanctioningOfficer)
                    {
                        options.Add(new { label = "Approve", value = "approve" });
                    }
                    else if (currentPlayerId < workflowList.Count - 1 && (canWithhold || canDirectWithheld))
                    {
                        var nextOfficer = workflowList[currentPlayerId + 1];
                        options.Add(new { label = $"Forward to {nextOfficer.designation}", value = "forward" });
                    }
                }
            }
            else
            {
                if (canDirectWithheld && (isLastPlayer || isSanctioningOfficer))
                {
                    options.Add(new { label = "Approve", value = "approve" });
                }
                else if (canWithhold || canDirectWithheld)
                {
                    options.Add(new { label = "Forward", value = "forward" });
                }
            }

            return Json(new
            {
                status = true,
                application = withheldDetails,
                applicationDetails,
                canCreate,
                canChooseWithheldType,
                canChooseIsWithheld,
                options,
                data,
                columns,
                allOfficerFiles,
                recordExists,
                hasActiveRecord,
                canRemoveFromWithheld,
                isLastPlayer,
                currentPlayerId,
                canWithhold,
                canDirectWithheld,
                isWithholdingOfficer,
                isSanctioningOfficer,
                hasPendingReleaseRequest,
                pendingReleaseFromPlayer,
                isFirstOfficer,
                isNewRecordMode
            });
        }


        [HttpGet]
        public async Task<IActionResult> GetCorrigendumSanctionLetter(string referenceNumber, string corrigendumId, string type)
        {
            try
            {
                var officer = GetOfficerDetails();
                if (officer == null)
                {
                    return Unauthorized("Officer details not found.");
                }

                var corrigendum = dbcontext.Corrigendum
                    .FirstOrDefault(c => c.Referencenumber == referenceNumber && c.Corrigendumid == corrigendumId);
                if (corrigendum == null)
                {
                    return NotFound("Corrigendum not found.");
                }

                var application = dbcontext.CitizenApplications.FirstOrDefault(ca => ca.Referencenumber == referenceNumber);
                if (application == null)
                {
                    return NotFound("Citizen application not found.");
                }

                var workflow = JArray.Parse(application.Workflow!);
                _logger.LogInformation($"Workflow: {workflow}");

                JToken sanctionedOfficer = workflow.FirstOrDefault(p => (string)p["status"]! == "sanctioned")!;
                _logger.LogInformation($"Sanction Officer: {sanctionedOfficer}");

                string? completedAtStr = (string?)sanctionedOfficer["completedAt"];
                string? sanctionDate = null;

                if (!string.IsNullOrEmpty(completedAtStr))
                {
                    // Parse the string to DateTime
                    if (DateTime.TryParse(completedAtStr, out DateTime completedAt))
                    {
                        // Format to "dd MMM yyyy"
                        sanctionDate = completedAt.ToString("dd MMM yyyy", CultureInfo.InvariantCulture);
                    }
                }

                _logger.LogInformation($"Sanction Date: {sanctionDate}");

                var service = dbcontext.Services
                    .FirstOrDefault(s => s.Serviceid == application.Serviceid);
                if (service == null)
                {
                    return NotFound("Service not found.");
                }

                var corrigendumFieldsObj = JObject.Parse(corrigendum.Corrigendumfields ?? "{}");
                corrigendumFieldsObj.Remove("Files");

                // ✅ Normalize any date-shaped values to dd/MM/yyyy before the PDF
                // renderer sees them, so they don't appear as ISO strings, mismatched
                // separators, or with time components on the printed letter.
                NormalizeCorrigendumDateValues(corrigendumFieldsObj);

                await _pdfService.CreateCorrigendumSanctionPdf(
                    corrigendumFieldsObj.ToString(),
                    referenceNumber,
                    officer,
                    service.Servicename!,
                    corrigendumId,
                    sanctionDate!,
                    type
                );

                var filePath = corrigendumId.Replace("/", "_") + $"_{type}_SanctionLetter.pdf";
                return Json(new { status = true, path = filePath });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { status = false, response = ex.Message });
            }
        }

        // ═══════════════════════════════════════════════════════════════════════════
        // Date normalisation helpers for the corrigendum sanction PDF
        // ═══════════════════════════════════════════════════════════════════════════

        // Field names that should be treated as dates even though the name does not
        // contain the substring "date" — e.g. "IfTemporaryDisabilityUdidCardValidUpto".
        private static readonly HashSet<string> AdditionalDateFieldNames =
            new(StringComparer.OrdinalIgnoreCase)
            {
                "IfTemporaryDisabilityUdidCardValidUpto",
                "UdidCardValidUpto",
                "TemporaryDisabilityValidUpto",
                "ValidUpto",
                "ValidFrom",
                "ValidTill",
            };

        // Formats we recognise on the way in. Order matters only for readability;
        // TryParseExact tries each until one matches.
        private static readonly string[] IncomingDateFormats = new[]
        {
            "dd/MM/yyyy",
            "d/M/yyyy",
            "dd-MM-yyyy",
            "d-M-yyyy",
            "yyyy-MM-dd",
            "yyyy/MM/dd",
            "dd MMM yyyy",
            "d MMM yyyy",
            "dd MMMM yyyy",
            "d MMMM yyyy",
            "dd MMM yyyy hh:mm:ss tt",
            "d MMM yyyy hh:mm:ss tt",
            "dd MMMM yyyy hh:mm:ss tt",
            "d MMMM yyyy hh:mm:ss tt",
            "dd-MM-yyyy HH:mm:ss",
            "dd-MM-yyyy hh:mm:ss tt",
            "yyyy-MM-ddTHH:mm:ss",
            "yyyy-MM-dd HH:mm:ss",
        };

        /// <summary>
        /// Walks every field in the corrigendum object and, for any field that is
        /// a date (either by name — contains "date" / "dob" — or by inclusion in
        /// <see cref="AdditionalDateFieldNames"/>), rewrites old_value / new_value
        /// to the dd/MM/yyyy format the sanction letter expects.
        /// Non-date fields (account numbers, names, IDs) are never touched because
        /// they do not match any format in <see cref="IncomingDateFormats"/>.
        /// </summary>
        private static void NormalizeCorrigendumDateValues(JObject corrigendumFields)
        {
            if (corrigendumFields == null) return;

            foreach (var prop in corrigendumFields.Properties().ToList())
            {
                var fieldName = prop.Name;

                // Skip the Files block
                if (string.Equals(fieldName, "Files", StringComparison.OrdinalIgnoreCase))
                    continue;

                // Only transform fields that look like dates
                if (!IsDateFieldName(fieldName))
                    continue;

                // Each field is expected to be an object with old_value / new_value
                if (prop.Value is not JObject fieldObj)
                    continue;

                foreach (var key in new[] { "old_value", "new_value" })
                {
                    var token = fieldObj[key];
                    if (token == null || token.Type != JTokenType.String)
                        continue;

                    var raw = token.ToString();
                    if (string.IsNullOrWhiteSpace(raw))
                        continue;

                    if (TryParseAnyFormat(raw.Trim(), out var parsed))
                    {
                        fieldObj[key] = parsed.ToString(
                            "dd/MM/yyyy", CultureInfo.InvariantCulture);
                    }
                    // else: leave value untouched — best-effort normalisation
                }
            }
        }

        // Returns true when a field name looks like a date. Matches the substring
        // "date" or "dob" (case-insensitive), or an exact match against the
        // AdditionalDateFieldNames set.
        private static bool IsDateFieldName(string name)
        {
            if (string.IsNullOrWhiteSpace(name)) return false;

            if (AdditionalDateFieldNames.Contains(name)) return true;

            var lower = name.ToLowerInvariant();
            return lower.Contains("date") || lower.Contains("dob");
        }

        // Try to parse using the strict format list, then fall back to the general
        // parser as a last resort. The fallback is intentional: some rows may carry
        // a value with an unusual separator that the strict list missed, and
        // dropping the reformat is better than passing an ugly string to the PDF.
        private static bool TryParseAnyFormat(string raw, out DateTime parsed)
        {
            if (DateTime.TryParseExact(
                    raw,
                    IncomingDateFormats,
                    CultureInfo.InvariantCulture,
                    DateTimeStyles.None,
                    out parsed))
            {
                return true;
            }

            return DateTime.TryParse(
                raw,
                CultureInfo.InvariantCulture,
                DateTimeStyles.None,
                out parsed);
        }


        [HttpGet]
        public IActionResult GetApplicationForCorrigendum(string referenceNumber, string serviceId, string type, string? applicationId = null)
        {
            try
            {
                var officer = GetOfficerDetails();
                if (officer == null)
                {
                    return Json(new { status = false, message = "Officer details not found." });
                }

                if (string.IsNullOrWhiteSpace(type) || !new[] { "Corrigendum", "Correction" }.Contains(type))
                {
                    return Json(new { status = false, message = "Invalid or missing type. Must be 'Corrigendum', 'Correction'." });
                }

                if (!int.TryParse(serviceId, out int serviceIdInt))
                {
                    return Json(new { status = false, message = "Invalid serviceId. It must be a numeric value." });
                }

                // Check for any pending corrigendum (for new submissions)
                if (applicationId == null)
                {
                    var pendingCheck = dbcontext.Corrigendum
                        .FromSqlRaw("SELECT * FROM get_corrigendum_by_location_access(@p_officer_access_level, @p_officer_access_code, @p_reference_number, @p_status, @p_corrigendum_id, @p_type, @p_officer_role)",
                            new NpgsqlParameter("@p_officer_access_level", officer.AccessLevel),
                            new NpgsqlParameter("@p_officer_access_code", officer.AccessCode),
                            new NpgsqlParameter("@p_reference_number", referenceNumber),
                            new NpgsqlParameter("@p_status", DBNull.Value),
                            new NpgsqlParameter("@p_corrigendum_id", DBNull.Value),
                            new NpgsqlParameter("@p_type", type),
                            new NpgsqlParameter("@p_officer_role", officer.Role))
                        .ToList();

                    if (pendingCheck.Count != 0)
                    {
                        foreach (var application in pendingCheck)
                        {
                            if (string.IsNullOrEmpty(application.Workflow)) continue;

                            var workflowArray = JArray.Parse(application.Workflow);

                            var isAtCurrentOfficer = workflowArray.Any(item =>
                                string.Equals((string)item["role"]!, officer.Role, StringComparison.OrdinalIgnoreCase) &&
                                string.Equals((string)item["status"]!, "pending", StringComparison.OrdinalIgnoreCase));

                            if (!isAtCurrentOfficer)
                            {
                                if (application.Status?.ToLower() == "initiated")
                                {
                                    return Json(new
                                    {
                                        status = false,
                                        message = $"A {type} is already in progress for this Application Id at another officer level."
                                    });
                                }
                            }

                            if (isAtCurrentOfficer)
                            {
                                applicationId = application.Corrigendumid;
                                break;
                            }
                        }
                    }
                }

                var parameters = new[]
                {
                    new NpgsqlParameter("@referencenumber", referenceNumber),
                    new NpgsqlParameter("@role", officer.Role),
                    new NpgsqlParameter("@officeraccesslevel", officer.AccessLevel),
                    new NpgsqlParameter("@officeraccesscode", officer.AccessCode),
                    new NpgsqlParameter("@serviceid", serviceIdInt),
                    new NpgsqlParameter("@type", type)
                };

                var result = dbcontext.CitizenApplications
                    .FromSqlRaw("SELECT * FROM get_application_for_corrigendum(@referencenumber, @role, @officeraccesslevel, @officeraccesscode, @serviceid, @type)", parameters)
                    .ToList();

                if (!result.Any())
                {
                    return Json(new { status = false, message = "Application not found or you don't have access." });
                }

                var service = dbcontext.Services.FirstOrDefault(s => s.Serviceid == serviceIdInt);
                if (service == null)
                {
                    return Json(new { status = false, message = "Service not found." });
                }

                var formElements = JArray.Parse(service.Formelement ?? "[]");
                List<object> allowedForDetails = new List<object>();
                try
                {
                    JObject documentFields = string.IsNullOrEmpty(service.Documentfields)
                        ? new JObject()
                        : JObject.Parse(service.Documentfields);

                    JArray typeFields = documentFields[type] as JArray ?? new JArray();

                    foreach (var field in typeFields)
                    {
                        if (field.Type == JTokenType.String)
                        {
                            var fieldName = field.ToString();
                            var fieldConfig = formElements
                                .SelectMany(s => s["fields"]?.Values<JObject>() ?? Enumerable.Empty<JObject>())
                                .FirstOrDefault(f => f?["name"]?.ToString() == fieldName);

                            var fieldDetails = new
                            {
                                label = fieldConfig?["label"]?.ToString() ?? fieldName,
                                name = fieldName,
                                type = fieldConfig?["type"]?.ToString() ?? "text",
                                isGroup = false,
                                options = fieldConfig?["options"]?.ToObject<List<object>>() ?? new List<object>(),
                                oldValue = fieldConfig?["value"]?.ToString() ?? ""
                            };
                            allowedForDetails.Add(fieldDetails);
                        }
                        else if (field is JObject group)
                        {
                            var groupLabel = group["label"]?.ToString() ?? "Group";
                            var groupFieldsToken = group["fields"];
                            var groupFields = new List<object>();

                            if (groupFieldsToken is JArray fieldsArray)
                            {
                                foreach (var f in fieldsArray)
                                {
                                    if (f.Type == JTokenType.String)
                                    {
                                        var fieldName = f.ToString();
                                        var fieldConfig = formElements
                                            .SelectMany(s => s["fields"]?.Values<JObject>() ?? Enumerable.Empty<JObject>())
                                            .FirstOrDefault(fc => fc?["name"]?.ToString() == fieldName);

                                        groupFields.Add(new
                                        {
                                            label = fieldConfig?["label"]?.ToString() ?? fieldName,
                                            name = fieldName,
                                            type = fieldConfig?["type"]?.ToString() ?? "text",
                                            oldValue = fieldConfig?["value"]?.ToString() ?? "",
                                            options = fieldConfig?["options"]?.ToObject<List<object>>() ?? new List<object>()
                                        });
                                    }
                                    else if (f is JObject fieldObj)
                                    {
                                        var fieldName = fieldObj?["name"]?.ToString();
                                        var fieldConfig = formElements
                                            .SelectMany(s => s["fields"]?.Values<JObject>() ?? Enumerable.Empty<JObject>())
                                            .FirstOrDefault(fc => fc?["name"]?.ToString() == fieldName);

                                        groupFields.Add(new
                                        {
                                            label = fieldObj?["label"]?.ToString() ?? fieldName,
                                            name = fieldName,
                                            type = fieldConfig?["type"]?.ToString() ?? "text",
                                            oldValue = fieldConfig?["value"]?.ToString() ?? "",
                                            options = fieldConfig?["options"]?.ToObject<List<object>>() ?? new List<object>()
                                        });
                                    }
                                }
                            }

                            allowedForDetails.Add(new
                            {
                                label = groupLabel,
                                fields = groupFields,
                                isGroup = true
                            });
                        }
                    }
                }
                catch (JsonException ex)
                {
                    return Json(new { status = false, message = $"Failed to parse document fields: {ex.Message}" });
                }

                var formDetailsJson = result[0].Formdetails;
                if (string.IsNullOrEmpty(formDetailsJson))
                {
                    return Json(new { status = false, message = "Form details are missing." });
                }

                JToken formDetailsToken;
                try
                {
                    formDetailsToken = JToken.Parse(formDetailsJson);
                }
                catch (JsonException ex)
                {
                    return Json(new { status = false, message = $"Failed to parse form details: {ex.Message}" });
                }

                var legacyBankMappings = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
                {
                    { "STATE BANK OF INDIA", "2" },
                    { "INDIA POST PAYMENTS BANK", "3" },
                    { "INDIA POST PAYMENTS BANK LIMITED", "3" },
                    { "J & K GRAMEEN BANK", "4" },
                    { "THE JAMMU AND KASHMIR BANK LTD./WATERGAM", "1" },
                    { "ELLAQUAI DEHATI BANK", "5" },
                    { "جموں اور کشمیر بینک لمیٹڈ", "1" },
                    { "KASHMIR MERCANTILE CO-OPERATIVE BANK LTD.", "6" },
                    { "KASHMIR MERCANTILE CO OP BANK LTD", "6" },
                    { "THE JAMMU AND KASHMIR BANK LTD.", "1" },
                    { "JAMMU AND KASHMIR BANK LIMITED", "1" }
                };

                if (formDetailsToken is JObject formDetailsObject)
                {
                    foreach (var section in formDetailsObject.Properties())
                    {
                        if (section.Value is not JArray fields) continue;

                        int bankNameIndex = -1;
                        string? resolvedBankIdForSection = null;

                        // ── Pass 1: resolve BankName → id, write the canonical name back ──
                        for (int i = 0; i < fields.Count; i++)
                        {
                            var field = fields[i];
                            if (field["name"]?.ToString() != "BankName") continue;

                            bankNameIndex = i;
                            var val = field["value"]?.ToString();

                            if (string.IsNullOrEmpty(val) || val == "Please Select") continue;

                            string? resolvedBankId = null;

                            // Step 1: normalize input → bank id
                            if (int.TryParse(val, out _))
                            {
                                resolvedBankId = val;
                            }
                            else if (legacyBankMappings.TryGetValue(val, out string? mappedId))
                            {
                                resolvedBankId = mappedId;
                            }
                            else
                            {
                                // Partial-match fallback for legacy names
                                if (val.Contains("JAMMU AND KASHMIR BANK", StringComparison.OrdinalIgnoreCase) ||
                                    val.Contains("جموں اور کشمیر بینک", StringComparison.OrdinalIgnoreCase))
                                {
                                    resolvedBankId = "1";
                                }
                                else if (val.Contains("STATE BANK", StringComparison.OrdinalIgnoreCase))
                                {
                                    resolvedBankId = "2";
                                }
                                else if (val.Contains("INDIA POST", StringComparison.OrdinalIgnoreCase))
                                {
                                    resolvedBankId = "3";
                                }
                                else if (val.Contains("GRAMEEN", StringComparison.OrdinalIgnoreCase))
                                {
                                    resolvedBankId = "4";
                                }
                                else if (val.Contains("ELLAQUAI", StringComparison.OrdinalIgnoreCase))
                                {
                                    resolvedBankId = "5";
                                }
                                else if (val.Contains("KASHMIR MERCANTILE", StringComparison.OrdinalIgnoreCase))
                                {
                                    resolvedBankId = "6";
                                }
                            }

                            // Step 2: bank id → canonical name (BankName keeps the name)
                            // Step 2: bank id → id only. Do NOT rewrite the stored name.
                            if (!string.IsNullOrEmpty(resolvedBankId) &&
                                int.TryParse(resolvedBankId, out int bankId))
                            {
                                // Optional: verify the id exists so we don't inject a bogus BankId
                                var bankExists = dbcontext.Bank.Any(b => b.Id == bankId);
                                if (bankExists)
                                {
                                    resolvedBankIdForSection = resolvedBankId;
                                }
                                else
                                {
                                    // Unknown id — don't inject a BankId, and leave the name alone.
                                    resolvedBankIdForSection = null;
                                }
                            }
                            // else: nothing matched — leave the original value untouched
                            // else: nothing matched — leave the original value untouched
                        }

                        // ── Pass 2: inject (or update) a BankId field right after BankName ──
                        if (resolvedBankIdForSection != null && bankNameIndex >= 0)
                        {
                            int existingBankIdIndex = -1;
                            for (int i = 0; i < fields.Count; i++)
                            {
                                if (fields[i]["name"]?.ToString() == "BankId")
                                {
                                    existingBankIdIndex = i;
                                    break;
                                }
                            }

                            if (existingBankIdIndex >= 0)
                            {
                                // Idempotent: if a BankId already exists (e.g. from a prior
                                // corrigendum), just refresh its value.
                                fields[existingBankIdIndex]["value"] = resolvedBankIdForSection;
                            }
                            else
                            {
                                var bankIdField = new JObject
                                {
                                    ["name"] = "BankId",
                                    ["label"] = "BankId",
                                    ["value"] = resolvedBankIdForSection
                                };
                                fields.Insert(bankNameIndex + 1, bankIdField);
                            }
                        }
                    }
                }
                // ------------------ UPDATE FORMDETAILS USING ALL APPROVED CORRIGENDUM/CORRECTION ------------------
                var approvedCorrigenda = dbcontext.Corrigendum
                    .Where(c => c.Referencenumber == referenceNumber &&
                                ((c.Type == "Corrigendum" && c.Status == "Sanctioned") ||
                                 (c.Type == "Correction" && c.Status == "Verified")))
                    .OrderBy(c => c.Createdat)
                    .ToList();

                foreach (var corr in approvedCorrigenda)
                {
                    if (string.IsNullOrEmpty(corr.Corrigendumfields))
                        continue;

                    JObject corrigendumFields;
                    try
                    {
                        corrigendumFields = JObject.Parse(corr.Corrigendumfields);
                    }
                    catch
                    {
                        continue;
                    }

                    foreach (var field in corrigendumFields.Properties())
                    {
                        if (field.Name == "Files" || field.Name == "remarks")
                            continue;

                        var newValue = field.Value?["new_value"]?.ToString();
                        if (!string.IsNullOrWhiteSpace(newValue))
                        {
                            UpdateFieldValueRecursively(formDetailsToken, field.Name, newValue);
                        }
                    }
                }
                // -------------------------------------------------------------------------------

                bool isSanctioned = result[0].Status == "Sanctioned";
                formDetailsToken = ReorderFormDetails(formDetailsToken, referenceNumber, isSanctioned);
                var formDetailsWithCodes = formDetailsToken.DeepClone();
                ReplaceCodeFieldsWithNames(formDetailsToken, false);
                // FormatDateFields(formDetailsToken);

                var workFlow = JArray.Parse(result[0].Workflow ?? "[]");
                bool isCurrentOfficer = type == "Correction" && workFlow.Count > result[0].Currentplayer &&
                                       workFlow[result[0].Currentplayer!]!["role"]?.ToString() == officer.Role;

                var nextOfficerDetails = workFlow.Count > 1 ? workFlow[1] : new JObject();
                string? nextOfficerDesignation = (string)nextOfficerDetails["designation"]!;
                string? nextOfficerAccessLevel = (string)nextOfficerDetails["accessLevel"]!;
                string officerArea = GetOfficerArea(nextOfficerAccessLevel, formDetailsWithCodes);

                // ------------------ EXISTING CORRIGENDUM CHECK ------------------
                if (!string.IsNullOrEmpty(applicationId))
                {
                    var existingCorrigendum = dbcontext.Corrigendum
                        .FirstOrDefault(c => c.Corrigendumid == applicationId && c.Type == type);

                    if (existingCorrigendum == null)
                    {
                        return Json(new { status = false, message = $"{type} not found." });
                    }

                    var corrigendumWorkflow = JArray.Parse(existingCorrigendum.Workflow ?? "[]");
                    var currentPlayer = existingCorrigendum.Currentplayer;
                    bool canOfficerEdit = false;
                    string officerDesignation = officer.Role!;

                    foreach (var item in corrigendumWorkflow)
                    {
                        var role = (string)item["role"]!;
                        var designation = (string)item["designation"]!;
                        var status = (string)item["status"]!;

                        if ((string.Equals(role, officer.Role, StringComparison.OrdinalIgnoreCase) ||
                             string.Equals(designation, officerDesignation, StringComparison.OrdinalIgnoreCase)) &&
                            string.Equals(status, "pending", StringComparison.OrdinalIgnoreCase))
                        {
                            canOfficerEdit = true;
                            break;
                        }
                    }

                    if (!canOfficerEdit)
                    {
                        return Json(new
                        {
                            status = true,
                            application = result[0],
                            formDetails = formDetailsToken,
                            allowedForDetails,
                            formElements,
                            nextOfficer = nextOfficerDesignation + " " + officerArea,
                            isCurrentOfficer = false,
                            isSanctioned,
                            corrigendumType = type,
                            userRole = officer.Role,
                            existingCorrigendumId = applicationId,
                            canEdit = false,
                            message = $"Found an existing {type} at another officer level. You can view but not edit it."
                        });
                    }

                    var corrigendumFieldsJson = string.IsNullOrEmpty(existingCorrigendum.Corrigendumfields)
                        ? new JObject()
                        : JObject.Parse(existingCorrigendum.Corrigendumfields);

                    var history = JsonConvert.DeserializeObject<List<dynamic>>(existingCorrigendum.History ?? "[]") ?? new List<dynamic>();
                    var columns = new List<dynamic>
                    {
                        new { accessorKey = "sno", header = "S.No." },
                        new { accessorKey = "officer", header = "Officer" },
                        new { accessorKey = "actionTaken", header = "Action Taken" },
                        new { accessorKey = "remarks", header = "Remarks" },
                        new { accessorKey = "actionTakenOn", header = "Action Taken On" },
                    };

                    var data = new List<dynamic>();
                    int index = 1;
                    foreach (var item in history)
                    {
                        string officerName = item["officer"]?.ToString() ?? item["actionTaker"]?.ToString() ?? "Unknown";
                        string statusVal = item["status"]?.ToString() ?? "Unknown";
                        string historyRemarks = item["remarks"]?.ToString() ?? "";
                        string actionTakenOn = item["actionTakenOn"]?.ToString() ?? "";

                        data.Add(new
                        {
                            sno = index,
                            officer = officerName,
                            actionTaken = statusVal,
                            remarks = historyRemarks,
                            actionTakenOn
                        });
                        index++;
                    }

                    nextOfficerDetails = new JObject();
                    for (int i = 0; i < corrigendumWorkflow.Count; i++)
                    {
                        var item = corrigendumWorkflow[i];
                        var statusVal = (string)item["status"]!;
                        if (string.Equals(statusVal, "pending", StringComparison.OrdinalIgnoreCase) && i + 1 < corrigendumWorkflow.Count)
                        {
                            nextOfficerDetails = corrigendumWorkflow[i + 1];
                            break;
                        }
                    }

                    nextOfficerDesignation = (string?)nextOfficerDetails["designation"] ?? "Next Officer";
                    nextOfficerAccessLevel = (string?)nextOfficerDetails["accessLevel"] ?? "";
                    officerArea = GetOfficerArea(nextOfficerAccessLevel, formDetailsWithCodes);

                    JArray officerFiles = new JArray();
                    try
                    {
                        var filesToken = corrigendumFieldsJson["Files"];
                        if (filesToken != null)
                        {
                            if (filesToken is JObject filesObject)
                            {
                                var roleShort = officer.RoleShort ?? "";
                                var roleVal = officer.Role ?? "";
                                if (!string.IsNullOrEmpty(roleShort) && filesObject[roleShort] is JArray roleFiles)
                                {
                                    officerFiles = roleFiles;
                                }
                                else if (!string.IsNullOrEmpty(roleVal) && filesObject[roleVal] is JArray roleNameFiles)
                                {
                                    officerFiles = roleNameFiles;
                                }
                                else if (filesObject["TSWO"] is JArray tswoFiles)
                                {
                                    officerFiles = tswoFiles;
                                }
                            }
                            else if (filesToken is JArray filesArray)
                            {
                                officerFiles = filesArray;
                            }
                            else if (filesToken is JValue jValue && jValue.Type == JTokenType.String)
                            {
                                officerFiles = JArray.Parse(jValue.ToString());
                            }
                        }
                    }
                    catch { }

                    return Json(new
                    {
                        status = true,
                        corrigendumFields = corrigendumFieldsJson.ToString(),
                        application = result[0],
                        formDetails = formDetailsToken,
                        allowedForDetails,
                        formElements,
                        nextOfficer = nextOfficerDesignation + " " + officerArea,
                        columns,
                        data,
                        files = officerFiles,
                        isCurrentOfficer = canOfficerEdit,
                        isSanctioned,
                        corrigendumType = existingCorrigendum.Type,
                        userRole = officer.Role,
                        existingCorrigendumId = existingCorrigendum.Corrigendumid,
                        canEdit = canOfficerEdit,
                        message = canOfficerEdit ?
                            $"Found an existing {type} at your level. You can edit and forward it." :
                            $"Found an existing {type}. You can view but not edit it."
                    });
                }

                // Return for new corrigendum (no existing corrigendum found)
                return Json(new
                {
                    status = true,
                    application = result[0],
                    formDetails = formDetailsToken,
                    allowedForDetails,
                    formElements,
                    nextOfficer = nextOfficerDesignation + " " + officerArea,
                    isCurrentOfficer,
                    isSanctioned,
                    corrigendumType = type,
                    userRole = officer.Role,
                    existingCorrigendumId = (string?)null,
                    canEdit = false,
                    message = "Application found. You can issue a new corrigendum."
                });
            }
            catch (PostgresException ex)
            {
                Console.WriteLine($"Error in GetApplicationForCorrigendum: {ex.Message}, StackTrace: {ex.StackTrace}");
                return StatusCode(500, new
                {
                    status = false,
                    message = $"{ex.MessageText}"
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Unexpected error in GetApplicationForCorrigendum: {ex.Message}, StackTrace: {ex.StackTrace}");
                return StatusCode(500, new
                {
                    status = false,
                    message = "An unexpected error occurred. Please try again."
                });
            }
        }




        [HttpGet]
        public IActionResult GetCorrigendumApplications(string type, string applicationType, string Serviceid, int pageIndex = 0, int pageSize = 10, string? searchQuery = null)
        {
            var officer = GetOfficerDetails();
            if (officer == null) return Unauthorized();
            _logger.LogInformation("Getting corrigendum applications for officer: {Officer}, search='{Search}'", officer.Role, searchQuery);
            int serviceIdInt = Convert.ToInt32(Serviceid);
            var service = dbcontext.Services.FirstOrDefault(s => s.Serviceid == serviceIdInt);
            if (service == null) return NotFound("Service not found.");
            List<dynamic> workflow;
            try
            {
                workflow = JsonConvert.DeserializeObject<List<dynamic>>(service.Officereditablefield!) ?? new List<dynamic>();
            }
            catch (JsonException ex)
            {
                return StatusCode(500, $"Error parsing workflow: {ex.Message}");
            }
            if (workflow.Count == 0)
                return Json(new { countList = new List<object>(), corrigendumList = new List<object>(), correctionList = new List<object>(), canSanction = false });
            dynamic authorities = workflow.FirstOrDefault(p => p.designation == officer.Role)!;
            List<dynamic> data = new();
            int totalRecords = 0;
            try
            {
                // ═══════════════════════════════════════════════════════════════
                // BRANCH 1: Use SEARCH function ONLY if a search query is provided
                // ═══════════════════════════════════════════════════════════════
                if (!string.IsNullOrEmpty(searchQuery))
                {
                    var searchParameters = new[]
                    {
                new NpgsqlParameter("@p_officer_access_level", NpgsqlDbType.Varchar) { Value = officer.AccessLevel ?? (object)DBNull.Value },
                new NpgsqlParameter("@p_officer_access_code",  NpgsqlDbType.Integer) { Value = officer.AccessCode ?? (object)DBNull.Value },
                new NpgsqlParameter("@p_status",                NpgsqlDbType.Varchar) { Value = (object?)type ?? DBNull.Value },
                new NpgsqlParameter("@p_type",                  NpgsqlDbType.Varchar) { Value = (object?)applicationType ?? DBNull.Value },
                new NpgsqlParameter("@p_officer_role",          NpgsqlDbType.Varchar) { Value = officer.Role ?? (object)DBNull.Value },
                new NpgsqlParameter("@p_service_id",            NpgsqlDbType.Integer) { Value = serviceIdInt },
                new NpgsqlParameter("@p_page_index",            NpgsqlDbType.Integer) { Value = pageIndex },
                new NpgsqlParameter("@p_page_size",             NpgsqlDbType.Integer) { Value = pageSize },
                new NpgsqlParameter("@p_search_query",          NpgsqlDbType.Varchar) { Value = searchQuery }
            };
                    var applications = dbcontext.Database
                        .SqlQueryRaw<CorrigendumSearchDto>(
                            "SELECT * FROM search_corrigendum_applications_for_officer(@p_officer_access_level, @p_officer_access_code, @p_status, @p_type, @p_officer_role, @p_service_id, @p_page_index, @p_page_size, @p_search_query)",
                            searchParameters)
                        .ToList();
                    totalRecords = applications.Count > 0 ? (int)applications[0].Totalrecords : 0;
                    var applicationReferenceNumbers = applications
                        .Select(c => c.Referencenumber)
                        .Where(r => !string.IsNullOrEmpty(r))
                        .Distinct()
                        .ToList();
                    var citizenApplications = dbcontext.CitizenApplications
                        .Where(ca => applicationReferenceNumbers.Contains(ca.Referencenumber))
                        .ToDictionary(ca => ca.Referencenumber!, ca => ca);
                    foreach (var application in applications)
                    {
                        if (!citizenApplications.TryGetValue(application.Referencenumber!, out var citizenApp))
                            continue;
                        var formDetails = JsonConvert.DeserializeObject<dynamic>(citizenApp.Formdetails!);
                        var workFlow = string.IsNullOrEmpty(application.Workflow)
                            ? new JArray()
                            : JsonConvert.DeserializeObject<JArray>(application.Workflow) ?? new JArray();
                        var history = string.IsNullOrEmpty(application.History)
                            ? new JArray()
                            : JArray.Parse(application.History);
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
                            .FirstOrDefault(o => o["playerId"]?.Type == JTokenType.Integer && (int)o["playerId"]! == application.Currentplayer);
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
                            .FirstOrDefault(o => o["designation"]?.Type == JTokenType.String && (string)o["designation"]! == officer.Role);

                        // ✅ SAFE PULL PARSING (Handles both boolean and string values)
                        bool canPull = false;
                        var canPullToken = currentOfficer?["canPull"];
                        if (canPullToken != null)
                        {
                            if (canPullToken.Type == JTokenType.Boolean)
                                canPull = (bool)canPullToken;
                            else if (canPullToken.Type == JTokenType.String)
                                bool.TryParse(canPullToken.ToString(), out canPull);
                        }

                        if ((type == "forwarded" || type == "returned") && canPull)
                        {
                            customActions.Add(new { type = "Pull", tooltip = "Pull", color = "#F0C38E", actionFunction = "pullCorrigendum" });
                        }
                        else
                        {
                            var matchedItem = workFlow
                                .OfType<JObject>()
                                .FirstOrDefault(item => item["designation"]?.Type == JTokenType.String && (string)item["designation"]! == officer.Role);
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
                            createdBy = actionTaker == "Citizen" ? "Citizen" : creationOfficerDesignation + " " + officerArea,
                            applicantName = application.Applicantname ?? GetFieldValue("ApplicantName", formDetails),
                            currentlyWith = officerDesignation + " " + currentOfficerArea,
                            currentStatus = CurrentStatus?.ToLower() == "sanctioned" ? "Issued" : CurrentStatus,
                            creationDate = application.Createdat.ToString("dd MMM yyyy hh:mm:ss tt"),
                            applicationType,
                            serviceId = citizenApp.Serviceid,
                            customActions
                        });
                    }
                }
                // ═══════════════════════════════════════════════════════════════
                // BRANCH 2: Use ORIGINAL function when NO search query is provided
                // ═══════════════════════════════════════════════════════════════
                else
                {
                    var parameters = new[]
                    {
                new NpgsqlParameter("@officeraccesslevel", officer.AccessLevel),
                new NpgsqlParameter("@officeraccesscode", officer.AccessCode),
                new NpgsqlParameter("@referencenumber", DBNull.Value),
                new NpgsqlParameter("@status", type),
                new NpgsqlParameter("@corrigendumid", DBNull.Value),
                new NpgsqlParameter("@type", applicationType),
                new NpgsqlParameter("@officerrole", officer.Role)
            };
                    var applications = dbcontext.Corrigendum
                        .FromSqlRaw("SELECT * FROM get_corrigendum_by_location_access(@officeraccesslevel, @officeraccesscode, @referencenumber, @status, @corrigendumid, @type, @officerrole)", parameters)
                        .ToList();
                    var sortedData = applications.OrderBy(a =>
                    {
                        var parts = a.Corrigendumid!.Split('/');
                        var numberPart = parts.Last();
                        return int.TryParse(numberPart, out int num) ? num : 0;
                    }).ToList();
                    totalRecords = sortedData.Count;
                    var pagedData = sortedData.Skip(pageIndex * pageSize).Take(pageSize).ToList();
                    var applicationReferenceNumbers = pagedData.Select(c => c.Referencenumber).ToList();
                    var citizenApplications = dbcontext.CitizenApplications
                        .Where(ca => applicationReferenceNumbers.Contains(ca.Referencenumber))
                        .ToDictionary(ca => ca.Referencenumber!, ca => ca);
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
                            .FirstOrDefault(o => o["playerId"]?.Type == JTokenType.Integer && (int)o["playerId"]! == application.Currentplayer);
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
                            .FirstOrDefault(o => o["designation"]?.Type == JTokenType.String && (string)o["designation"]! == officer.Role);

                        // ✅ SAFE PULL PARSING (Handles both boolean and string values)
                        bool canPull = false;
                        var canPullToken = currentOfficer?["canPull"];
                        if (canPullToken != null)
                        {
                            if (canPullToken.Type == JTokenType.Boolean)
                                canPull = (bool)canPullToken;
                            else if (canPullToken.Type == JTokenType.String)
                                bool.TryParse(canPullToken.ToString(), out canPull);
                        }

                        if ((type == "forwarded" || type == "returned") && canPull)
                        {
                            customActions.Add(new { type = "Pull", tooltip = "Pull", color = "#F0C38E", actionFunction = "pullCorrigendum" });
                        }
                        else
                        {
                            var matchedItem = workFlow
                                .OfType<JObject>()
                                .FirstOrDefault(item => item["designation"]?.Type == JTokenType.String && (string)item["designation"]! == officer.Role);
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
                            createdBy = actionTaker == "Citizen" ? "Citizen" : creationOfficerDesignation + " " + officerArea,
                            applicantName = GetFieldValue("ApplicantName", formDetails),
                            currentlyWith = officerDesignation + " " + currentOfficerArea,
                            currentStatus = CurrentStatus?.ToLower() == "sanctioned" ? "Issued" : CurrentStatus,
                            creationDate = application.Createdat.ToString("dd MMM yyyy hh:mm:ss tt"),
                            applicationType,
                            serviceId = citizenApp.Serviceid,
                            customActions
                        });
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching corrigendum applications");
                return StatusCode(500, new { error = "Failed to fetch applications" });
            }
            var serviceLocation = ResolveServiceLocationFields(service?.Formelement);
            bool serviceHasDistrict = serviceLocation.HasDistrict;
            bool serviceHasChildLocation = serviceLocation.HasChildLocation;
            string childLocationHeader = serviceLocation.ChildLocationHeader;
            List<dynamic> columns = new()
    {
        new { accessorKey = "referenceNumber", header = "Reference Number" },
        new { accessorKey = "applicationId",   header = applicationType + " Id" }
    };
            if (officer.AccessLevel == "State")
            {
                columns.Add(new { accessorKey = "divisionName", header = "Division Name" });
                if (serviceHasDistrict)
                    columns.Add(new { accessorKey = "districtName", header = "District Name" });
            }
            else if (officer.AccessLevel == "Division")
            {
                if (serviceHasDistrict)
                    columns.Add(new { accessorKey = "districtName", header = "District Name" });
                if (serviceHasChildLocation)
                    columns.Add(new { accessorKey = "tehsilName", header = childLocationHeader });
            }
            else if (officer.AccessLevel == "District")
            {
                if (serviceHasChildLocation)
                    columns.Add(new { accessorKey = "tehsilName", header = childLocationHeader });
            }
            columns.Add(new { accessorKey = "createdBy", header = "Creation Officer" });
            columns.Add(new { accessorKey = "applicantName", header = "Applicant Name" });
            columns.Add(new { accessorKey = "currentlyWith", header = "Currently With" });
            columns.Add(new { accessorKey = "currentStatus", header = "Current Status" });
            columns.Add(new { accessorKey = "creationDate", header = applicationType + " Creation Date" });
            columns.Add(new { accessorKey = "applicationType", header = "Application Type" });
            return Json(new
            {
                data,
                columns,
                poolData = new List<dynamic>(),
                totalRecords
            });
        }


        [HttpGet]
        public IActionResult GetCorrigendumApplication(string? referenceNumber = null, string? corrigendumId = null, string? type = null)
        {
            if (string.IsNullOrEmpty(corrigendumId))
            {
                return BadRequest("Corrigendum number is required.");
            }

            var officer = GetOfficerDetails();
            if (officer == null)
            {
                return Unauthorized();
            }

            var parameters = new[]
            {
        new NpgsqlParameter("@officeraccesslevel", officer.AccessLevel),
        new NpgsqlParameter("@officeraccesscode", officer.AccessCode),
        new NpgsqlParameter("@referencenumber", (object?)referenceNumber ?? DBNull.Value),
        new NpgsqlParameter("@status", DBNull.Value),
        new NpgsqlParameter("@corrigendumid", (object?)corrigendumId ?? DBNull.Value),
        new NpgsqlParameter("@type", (object?)type ?? DBNull.Value),
        new NpgsqlParameter("@officerrole", officer.Role)
    };

            bool isParentAppLegacy = !string.IsNullOrEmpty(referenceNumber) && referenceNumber.StartsWith("JK-SW-PNS");
            bool isCorrigendumLegacy = false;

            var corrigendumApplication = dbcontext.Corrigendum
            .FromSqlRaw(
                @"SELECT * 
        FROM get_corrigendum_by_location_access(
            @officeraccesslevel,
            @officeraccesscode,
            @referencenumber,
            @status,
            @corrigendumid,
            @type,
            @officerrole
        )",
                parameters
            )
            .AsNoTracking()
            .FirstOrDefault();

            _logger.LogInformation("Corrigendum Application: {@CorrigendumApplication}", corrigendumApplication);

            if (corrigendumApplication == null)
            {
                return NotFound("Corrigendum application not found.");
            }

            isCorrigendumLegacy = string.Equals(corrigendumApplication.Datatype, "legacy", StringComparison.OrdinalIgnoreCase);
            referenceNumber = corrigendumApplication.Referencenumber;

            List<dynamic>? history = string.IsNullOrEmpty(corrigendumApplication.History)
                ? []
                : JsonConvert.DeserializeObject<List<dynamic>>(corrigendumApplication.History);

            var application = dbcontext.CitizenApplications.FirstOrDefault(ca => ca.Referencenumber == referenceNumber);
            if (application == null)
            {
                return NotFound("Citizen application not found.");
            }

            var formDetails = JObject.Parse(application.Formdetails!);
            bool noaction = true;
            dynamic? sanctionOfficer = null;

            var applicationWorkFlow = string.IsNullOrEmpty(application.Workflow)
                ? null
                : JsonConvert.DeserializeObject<JArray>(application.Workflow);

            if (!isParentAppLegacy)
            {
                UpdateWorkflowFlags(applicationWorkFlow!, application.Currentplayer ?? 0);
            }
            application.Workflow = JsonConvert.SerializeObject(applicationWorkFlow);

            var corrigendumWorkFlow = string.IsNullOrEmpty(corrigendumApplication.Workflow)
                ? null
                : JsonConvert.DeserializeObject<JArray>(corrigendumApplication.Workflow);

            if (!isCorrigendumLegacy && corrigendumWorkFlow != null)
            {
                UpdateWorkflowFlags(corrigendumWorkFlow, corrigendumApplication.Currentplayer);
            }
            corrigendumApplication.Workflow = JsonConvert.SerializeObject(corrigendumWorkFlow);

            // ✅ FIX: Explicitly tell EF Core to track and update this untracked entity
            dbcontext.Corrigendum.Update(corrigendumApplication);
            dbcontext.SaveChanges();

            if (applicationWorkFlow != null)
            {
                foreach (var item in applicationWorkFlow)
                {
                    if (item["status"]?.ToString() == "sanctioned")
                    {
                        sanctionOfficer = item;
                    }
                }
            }

            List<JObject>? Officer = string.IsNullOrEmpty(corrigendumApplication.Workflow)
                ? null
                : JsonConvert.DeserializeObject<List<JObject>>(corrigendumApplication.Workflow);

            if (!isCorrigendumLegacy)
            {
                if (Officer == null || corrigendumApplication.Currentplayer < 0 || corrigendumApplication.Currentplayer >= Officer.Count)
                {
                    return BadRequest("Invalid workflow or current player index.");
                }
            }

            if (!isCorrigendumLegacy)
            {
                var currentOfficer = Officer![corrigendumApplication.Currentplayer];
                if (currentOfficer["designation"]?.ToString() != officer.Role ||
                    (currentOfficer["designation"]?.ToString() == officer.Role && currentOfficer["status"]?.ToString() != "pending"))
                {
                    noaction = false;
                }
            }

            var corrigendumFields = string.IsNullOrEmpty(corrigendumApplication.Corrigendumfields)
                ? null
                : JsonConvert.DeserializeObject<JObject>(corrigendumApplication.Corrigendumfields);

            string remarks = corrigendumFields?["remarks"]?.ToString() ?? "";

            List<dynamic> actions = [new { label = "Reject", value = "reject" }];

            if (!isCorrigendumLegacy)
            {
                var currentOfficer = Officer![corrigendumApplication.Currentplayer];

                if (Convert.ToInt32(currentOfficer["playerId"]) > 0)
                {
                    var prevOfficer = Officer[corrigendumApplication.Currentplayer - 1];
                    string prevOfficerDesignation = (string)prevOfficer["designation"]!;
                    string prevOfficerAccessLevel = (string)prevOfficer["accessLevel"]!;
                    string officerArea = GetOfficerArea(prevOfficerAccessLevel, formDetails);

                    actions.Add(new { label = $"Return to {prevOfficerDesignation} {officerArea}", value = "return" });
                    if (sanctionOfficer == null && type == "Correction")
                    {
                        actions.Add(new { label = $"Verify", value = "verified" });
                    }
                }

                bool suppressForwardForCorrection = sanctionOfficer == null
                    && type == "Correction"
                    && Officer.Count <= corrigendumApplication.Currentplayer + 2;

                if (sanctionOfficer != null &&
                    sanctionOfficer!["designation"]?.ToString() == currentOfficer["designation"]?.ToString())
                {
                    actions.Add(new { label = $"Issue {type}", value = "sanction" });
                }
                else if (Officer.Count > corrigendumApplication.Currentplayer + 1 && !suppressForwardForCorrection)
                {
                    var nextOfficer = Officer[corrigendumApplication.Currentplayer + 1];
                    string nextOfficerDesignation = (string)nextOfficer["designation"]!;
                    string nextOfficerAccessLevel = (string)nextOfficer["accessLevel"]!;
                    string officerArea = GetOfficerArea(nextOfficerAccessLevel, formDetails);

                    actions.Add(new { label = $"Forward to {nextOfficerDesignation} {officerArea}", value = "forward" });
                }
            }

            List<dynamic> columns = [
                new { accessorKey = "sno", header = "S.No." },
        new { accessorKey = "actionTaker", header = "Action Taker" },
        new { accessorKey = "actionTaken", header = "Action Taken" },
        new { accessorKey = "remarks", header = "Remarks" },
        new { accessorKey = "actionTakenOn", header = "Action Taken On" },
        ];

            var data = new List<dynamic>();
            int index = 1;
            string roleShort = "";

            if (history != null)
            {
                foreach (var item in history)
                {
                    string officerName = item["officer"]?.ToString() ?? item["actionTaker"]?.ToString() ?? "Unknown";
                    string status = item["status"]?.ToString() ?? "Unknown";
                    string historyRemarks = item["remarks"]?.ToString() ?? "";
                    string actionTakenOn = item["actionTakenOn"]?.ToString() ?? "";

                    if (!officerName.Contains("Citizen"))
                    {
                        string[] words = officerName.Split(' ', StringSplitOptions.RemoveEmptyEntries);
                        string firstThreeWords = string.Join(" ", words.Take(4));
                        _logger.LogInformation($"Officer Name: {officerName} First Three Words: {firstThreeWords}");

                        var designation = dbcontext.Officersdesignations
                            .FirstOrDefault(od => od.Designation == firstThreeWords);

                        roleShort = designation?.Designationshort ?? "Unknown";
                        _logger.LogInformation($"Role Short: {roleShort}");
                    }

                    data.Add(new
                    {
                        sno = index,
                        actionTaker = officerName,
                        actionTaken = status,
                        remarks = historyRemarks,
                        actionTakenOn,
                    });
                    index++;
                }
            }

            if (!isCorrigendumLegacy)
            {
                var formdetails = JObject.Parse(application.Formdetails!);
                foreach (var item in JsonConvert.DeserializeObject<List<dynamic>>(corrigendumApplication.Workflow)!)
                {
                    if (item["status"] == "pending")
                    {
                        data.Add(new
                        {
                            sno = index,
                            actionTaker = item["designation"] + " " + GetOfficerArea(item["accessLevel"].ToString(), formdetails),
                            actionTaken = item["status"],
                            remarks = item["remarks"],
                            actionTakenOn = item["completedAt"]
                        });
                        break;
                    }
                }
            }

            List<dynamic> fieldColumns = [
                new { accessorKey = "formField", header = "Description" },
        new { accessorKey = "oldvalue", header = "As Existing" },
        new { accessorKey = "newvalue", header = $"{(type == "Amendment" ? "As Updated" : "As Corrected")}" },
    ];

            var fieldsData = new List<dynamic>();
            var stack = new Stack<(string path, JToken field)>();

            if (corrigendumFields != null)
            {
                foreach (var item in corrigendumFields)
                {
                    if (item.Key != "remarks" && item.Key != "Files" && item.Value is JObject)
                    {
                        stack.Push((item.Key, item.Value));
                    }
                }
            }

            while (stack.Count > 0)
            {
                var (path, field) = stack.Pop();
                string header = Regex.Replace(path, "(\\B[A-Z])", " $1");

                string oldValue = field["old_value"]?.ToString() ?? "";
                string newValue = field["new_value"]?.ToString() ?? "";

                if (path.IndexOf("Date", StringComparison.OrdinalIgnoreCase) >= 0)
                {
                    if (DateTime.TryParse(oldValue, out DateTime oldDt))
                        oldValue = oldDt.ToString("dd MMM yyyy");

                    if (DateTime.TryParse(newValue, out DateTime newDt))
                        newValue = newDt.ToString("dd MMM yyyy");
                }

                fieldsData.Add(new
                {
                    formField = header,
                    oldvalue = oldValue,
                    newvalue = newValue
                });

                var additionalValues = field["additional_values"];
                if (additionalValues != null && additionalValues is JObject nested)
                {
                    foreach (var nestedItem in nested)
                    {
                        string nestedPath = $"{path}.{nestedItem.Key}";
                        stack.Push((nestedPath, nestedItem.Value)!);
                    }
                }
            }

            var corFiles = corrigendumFields?["Files"] as JObject;
            _logger.LogInformation($"Cor Files: {corFiles}");

            var allFiles = corFiles?
                .Properties()
                .SelectMany(p => p.Value is JArray arr
                    ? arr.Select(f => f?.ToString()).Where(f => !string.IsNullOrWhiteSpace(f))
                    : Enumerable.Empty<string>())
                .ToList() ?? new List<string>()!;

            if (!allFiles.Any())
            {
                allFiles.Add("NO FILES");
            }

            _logger.LogInformation($"All Files: {string.Join(", ", allFiles)}");

            return Json(new
            {
                data,
                columns,
                fieldColumns,
                fieldsData,
                canTakeAction = !isCorrigendumLegacy && noaction,
                actions,
                remarks,
                corrigendumApplication.Corrigendumid,
                files = allFiles
            });
        }
        public IActionResult GetApplicationsForAadhaarValidation(int pageIndex = 0, int pageSize = 10, int serviceId = 1)
        {
            var officerDetails = GetOfficerDetails();

            var parameters = new[]
            {
                new NpgsqlParameter("@role", officerDetails.Role),
                new NpgsqlParameter("@accesslevel", officerDetails.AccessLevel),
                new NpgsqlParameter("@accesscode", officerDetails.AccessCode),
                new NpgsqlParameter("@applicationstatus", "sanctioned"),
                new NpgsqlParameter("@serviceid", serviceId),
                new NpgsqlParameter("@pageindex", pageIndex),
                new NpgsqlParameter("@pagesize", pageSize),
                new NpgsqlParameter("@ispaginated", 1),
                new NpgsqlParameter("@datatype", "legacy"),
                new NpgsqlParameter("@aadhaarfilter", "empty")
            };

            var response = dbcontext.Database
                .SqlQueryRaw<AadhaarValidationApplicationDto>(
                    "SELECT * FROM get_applications_for_aadhaar_validation(@role, @accesslevel, @accesscode, @applicationstatus, @serviceid, @pageindex, @pagesize, @ispaginated, @datatype, @aadhaarfilter)",
                    parameters
                )
                .ToList();

            int totalRecords = response.Count > 0 ? (int)response[0].TotalRecords : 0;

            // Rest of your code remains the same...
            List<dynamic> columns =
            [
                new { accessorKey = "sno", header = "S.No" },
        new { accessorKey = "referenceNumber", header = "Reference Number" },
        new { accessorKey = "applicantName", header = "Applicant Name" },
        new { accessorKey = "parentage", header = "Parentage" },
        new { accessorKey = "dob", header = "Date Of Birth" },
    ];
            List<dynamic> data = [];

            foreach (var app in response)
            {
                var customActions = new List<dynamic>();
                customActions.Add(new
                {
                    type = "ValidateAadhaar",
                    tooltip = "Validate",
                    color = "#F0C38E",
                    actionFunction = "handleValidateAadhaar"
                });
                var formDetails = JObject.Parse(app.FormDetails!);
                _logger.LogInformation($"---------- Form Details: {formDetails} ---------------");

                var dob = GetFieldValue("DateOfBirth", formDetails);
                if (DateTime.TryParse(dob, out DateTime dobDate))
                {
                    dob = dobDate.ToString("dd MMM yyyy");
                }
                data.Add(new
                {
                    sno = data.Count + 1 + (pageIndex * pageSize),
                    referenceNumber = app.ReferenceNumber,
                    applicantName = GetFieldValue("ApplicantName", formDetails) ?? "N/A",
                    parentage = GetFieldValue("Parentage", formDetails) ?? "N/A",
                    dob = dob ?? "N/A",
                    input = true,
                    customActions,
                });
            }

            return Json(new
            {
                data,
                columns,
                totalRecords
            });
        }

        public class AadhaarValidationCount
        {
            public int TotalSanctioned { get; set; }
            public int AadhaarValidated { get; set; }
            public int AadhaarNotValidated { get; set; }
        }

        [HttpGet]
        public IActionResult GetAadhaarValidationCount(string serviceId, string? division = null, string? district = null, string? tehsil = null)
        {
            var officerDetails = GetOfficerDetails();

            // Compute restricted filters based on officer access
            string officerAccessLevel = officerDetails.AccessLevel!;
            int? officerAccessCode = officerDetails.AccessCode;
            int? restrictedDivision = null;
            int? restrictedDistrict = null;
            int? restrictedTehsil = null;

            if (officerAccessLevel == "Division")
            {
                restrictedDivision = officerAccessCode;
            }
            else if (officerAccessLevel == "District")
            {
                var districtEntity = dbcontext.District.FirstOrDefault(d => d.Districtid == officerAccessCode);
                if (districtEntity != null)
                {
                    restrictedDivision = districtEntity.Division;
                    restrictedDistrict = officerAccessCode;
                }
            }
            else if (officerAccessLevel == "Tehsil")
            {
                var tehsilEntity = dbcontext.Tswotehsil.FirstOrDefault(t => t.Tehsilid == officerAccessCode);
                if (tehsilEntity != null)
                {
                    restrictedDistrict = tehsilEntity.Districtid;
                    var districtEntity = dbcontext.District.FirstOrDefault(d => d.Districtid == tehsilEntity.Districtid);
                    if (districtEntity != null)
                    {
                        restrictedDivision = districtEntity.Division;
                    }
                    restrictedTehsil = officerAccessCode;
                }
            }

            // Enforce restrictions by overriding input parameters if necessary
            if (restrictedTehsil != null)
            {
                tehsil = restrictedTehsil.ToString();
            }
            if (restrictedDistrict != null)
            {
                district = restrictedDistrict.ToString();
            }
            if (restrictedDivision != null)
            {
                division = restrictedDivision.ToString();
            }

            string accessLevel;
            object? accessCode = DBNull.Value;
            object? divisionCode = DBNull.Value;

            // Pick correct access level
            if (!string.IsNullOrWhiteSpace(tehsil))
            {
                accessLevel = "Tehsil";
                accessCode = int.TryParse(tehsil, out var tehsilVal) ? tehsilVal : DBNull.Value;
            }
            else if (!string.IsNullOrWhiteSpace(district))
            {
                accessLevel = "District";
                accessCode = int.TryParse(district, out var districtVal) ? districtVal : DBNull.Value;
            }
            else if (!string.IsNullOrWhiteSpace(division))
            {
                accessLevel = "Division";
                accessCode = int.TryParse(division, out var divisionVal) ? divisionVal : DBNull.Value;
                divisionCode = accessCode; // For compatibility with SQL proc
            }
            else
            {
                accessLevel = "State";
            }

            var parameters = new[]
            {
                new NpgsqlParameter("@serviceid", int.Parse(serviceId)),
                new NpgsqlParameter("@accesslevel", accessLevel),
                new NpgsqlParameter("@accesscode", accessCode ?? DBNull.Value),
                new NpgsqlParameter("@divisioncode", divisionCode ?? DBNull.Value),
                new NpgsqlParameter("@aadhaarfilter", DBNull.Value)
            };

            // Fetch Aadhaar validation counts
            var counts = dbcontext.Database
                .SqlQueryRaw<AadhaarValidationCount>(
                    "SELECT * FROM get_aadhaar_validation_count(@accesslevel, @accesscode, @serviceid, @divisioncode, @aadhaarfilter)",
                    parameters
                )
                .AsEnumerable()
                .FirstOrDefault() ?? new AadhaarValidationCount();

            // Define application status data
            var dataList = new List<dynamic>
            {
                new
                {
                    title = "Total Sanctioned",
                    value = counts.TotalSanctioned.ToString("N0"),
                    category = "application",
                    color = "#fff",
                    bgColor = "#4f46e5",
                    gradientStart = "#4f46e5",
                    gradientEnd = "#3b82f6",
                },
                new
                {
                    title = "Aadhaar Validated",
                    value = counts.AadhaarValidated.ToString("N0"),
                    category = "application",
                    color = "#fff",
                    bgColor = "#059669",
                    gradientStart = "#059669",
                    gradientEnd = "#10b981",
                },
                new
                {
                    title = "Aadhaar Not Validated",
                    value = counts.AadhaarNotValidated.ToString("N0"),
                    category = "application",
                    color = "#fff",
                    bgColor = "#f59e0b",
                    gradientStart = "#f59e0b",
                    gradientEnd = "#fbbf24",
                },
            };

            // Prepare officer access info for frontend
            var officerAccess = new
            {
                accessLevel = officerAccessLevel,
                accessCode = officerAccessCode,
                restrictedDivision,
                restrictedDistrict,
                restrictedTehsil
            };

            return Json(new { dataList, officerAccess });
        }

        [HttpGet]
        public IActionResult GetAadhaarValidationData(string serviceId, string type, int pageIndex = 0, int pageSize = 10, string state = "0", string? division = null, string? district = null, string? tehsil = null)
        {
            // Determine AccessLevel and AccessCode based on filters
            string accessLevel;
            object accessCode = DBNull.Value;
            object divisionCode = DBNull.Value;

            if (!string.IsNullOrWhiteSpace(tehsil))
            {
                accessLevel = "Tehsil";
                accessCode = int.TryParse(tehsil, out var tehsilVal) ? tehsilVal : DBNull.Value;
            }
            else if (!string.IsNullOrWhiteSpace(district))
            {
                accessLevel = "District";
                accessCode = int.TryParse(district, out var districtVal) ? districtVal : DBNull.Value;
            }
            else if (!string.IsNullOrWhiteSpace(division))
            {
                accessLevel = "Division";
                accessCode = int.TryParse(division, out var divisionVal) ? divisionVal : DBNull.Value;
                divisionCode = accessCode;
            }
            else
            {
                accessLevel = "State";
                accessCode = state == "0" ? 0 : DBNull.Value;
            }

            // Validate AccessLevel and AccessCode
            if ((accessLevel == "Tehsil" || accessLevel == "District") && accessCode == DBNull.Value)
            {
                return BadRequest("Invalid AccessCode for the specified AccessLevel.");
            }
            if (accessLevel == "Division" && divisionCode == DBNull.Value)
            {
                return BadRequest("Invalid DivisionCode for Division AccessLevel.");
            }

            // FIXED: Use proper type for @ispaginated parameter
            var parameters = new[]
            {
                new NpgsqlParameter("@accesslevel", NpgsqlDbType.Varchar) { Value = accessLevel },
                new NpgsqlParameter("@accesscode", NpgsqlDbType.Integer) { Value = accessCode },
                new NpgsqlParameter("@serviceid", NpgsqlDbType.Integer) { Value = int.Parse(serviceId) },
                new NpgsqlParameter("@divisioncode", NpgsqlDbType.Integer) { Value = divisionCode },
                new NpgsqlParameter("@aadhaarfilter", NpgsqlDbType.Varchar) {
                    Value = type == "sanctioned" ? (object)DBNull.Value : type
                },
                new NpgsqlParameter("@pageindex", NpgsqlDbType.Integer) { Value = pageIndex },
                new NpgsqlParameter("@pagesize", NpgsqlDbType.Integer) { Value = pageSize },
                // FIX: Use Boolean type instead of Integer
                new NpgsqlParameter("@ispaginated", NpgsqlDbType.Boolean) { Value = true }
            };

            // Fetch application data using DTO
            var response = dbcontext.Database
                .SqlQueryRaw<AadhaarValidationDataDto>(
                    "SELECT * FROM get_aadhaar_validation_data(@accesslevel, @accesscode, @serviceid, @divisioncode, @aadhaarfilter, @pageindex, @pagesize, @ispaginated)",
                    parameters
                )
                .ToList();

            int totalRecords = response.Count > 0 ? (int)response[0].TotalRecords : 0;

            // Fetch service details for serviceName
            var service = dbcontext.Services.FirstOrDefault(s => s.Serviceid == int.Parse(serviceId));
            if (service == null)
            {
                return NotFound();
            }

            // Columns for the table
            List<dynamic> columns =
            [
                new { accessorKey = "sno", header = "S.No" },
        new { accessorKey = "referenceNumber", header = "Reference Number" },
        new { accessorKey = "applicantName", header = "Applicant Name" },
        new { accessorKey = "serviceName", header = "Service Name" },
        new { accessorKey = "status", header = "Application Status" },
        new { accessorKey = "submissionDate", header = "Submission Date" }
            ];

            List<dynamic> data = [];

            // Start numbering based on pagination
            int snoCounter = (pageIndex * pageSize) + 1;

            foreach (var details in response)
            {
                var formDetails = JsonConvert.DeserializeObject<dynamic>(details.FormDetails!);
                string serviceName = service.Servicename!;
                string status = details.Status!;

                var applicationObject = new
                {
                    sno = snoCounter++,
                    referenceNumber = details.ReferenceNumber,
                    applicantName = GetFieldValue("ApplicantName", formDetails),
                    submissionDate = details.Created_at,
                    serviceName,
                    status,
                    serviceId = details.ServiceId
                };

                data.Add(applicationObject);
            }

            return Json(new
            {
                data,
                columns,
                totalRecords
            });
        }

        public class CitizenApplicationSearchResultDto
        {
            public string? ReferenceNumber { get; set; }
            public string? FormDetails { get; set; }
            public string? Status { get; set; }
            public int? DistrictId { get; set; }
            public string? DistrictName { get; set; }
            public int? TehsilId { get; set; }
            public string? TehsilName { get; set; }
            public int? DivisionId { get; set; }
            public string? ApplicantName { get; set; }
            public bool? IsWithheld { get; set; }   // ★ NEW
        }

        // ─────────────────────────────────────────────────────────────────────
        //  1. Search — returns a lightweight list of all matching applications
        // ─────────────────────────────────────────────────────────────────────
        [HttpGet]
        public IActionResult SearchApplication(string Serviceid, string SearchBy, string SearchValue)
        {
            var officer = GetOfficerDetails();

            if (!int.TryParse(Serviceid, out int serviceId))
                return Json(new { status = false, message = "Invalid service id." });

            if (string.IsNullOrWhiteSpace(SearchBy) ||
                (SearchBy != "ReferenceNumber" && SearchBy != "AccountNumber"))
            {
                return Json(new { status = false, message = "Invalid search type." });
            }

            if (string.IsNullOrWhiteSpace(SearchValue))
                return Json(new { status = false, message = "Search value is required." });

            var parameters = new[]
            {
        new NpgsqlParameter("p_service_id",   serviceId),
        new NpgsqlParameter("p_search_by",    SearchBy),
        new NpgsqlParameter("p_search_value", SearchValue.Trim()),
    };

            List<CitizenApplicationSearchResultDto> results;
            try
            {
                results = dbcontext.Database
                    .SqlQueryRaw<CitizenApplicationSearchResultDto>(
                        @"SELECT referencenumber AS ""ReferenceNumber"",
                         formdetails     AS ""FormDetails"",
                         status          AS ""Status"",
                         district_id     AS ""DistrictId"",
                         district_name   AS ""DistrictName"",
                         tehsil_id       AS ""TehsilId"",
                         tehsil_name     AS ""TehsilName"",
                         division_id     AS ""DivisionId"",
                         applicant_name  AS ""ApplicantName"",
                         iswithheld      AS ""IsWithheld""        -- ★ NEW
                  FROM search_citizen_application(
                          @p_service_id,
                          @p_search_by,
                          @p_search_value)",
                        parameters)
                    .ToList();
            }
            catch (PostgresException pgEx) when (pgEx.SqlState == "22023")
            {
                return Json(new { status = false, message = "Invalid search type." });
            }

            if (results.Count == 0)
                return Json(new { status = false, message = "No applications found for the given criteria." });

            var list = results.Select(app =>
            {
                // Prefer the SQL-derived name (handles JSON variants in one place);
                // fall back to the C# extraction that other callers already use.
                var formDetails = JsonConvert.DeserializeObject<dynamic>(app.FormDetails ?? "{}");
                var applicantName = !string.IsNullOrWhiteSpace(app.ApplicantName)
                    ? app.ApplicantName
                    : GetFieldValue("ApplicantName", formDetails);

                return new
                {
                    referenceNumber = app.ReferenceNumber,
                    applicantName,
                    accountNumber = GetFieldValue("AccountNumber", formDetails),
                    ifcCode = GetFieldValue("IfscCode", formDetails),
                    datofBirth = GetFieldValue("DateOfBirth", formDetails),
                    status = app.Status,
                    districtName = app.DistrictName,
                    tehsilName = app.TehsilName,
                    // ★ Boolean → YES/NO/N/A so the UI can render it directly
                    isWithheld = app.IsWithheld.HasValue
                                        ? (app.IsWithheld.Value ? "YES" : "NO")
                                        : "N/A",
                };
            }).ToList();

            return Json(new
            {
                status = true,
                count = list.Count,
                applications = list
            });
        }
        //  2. Get details for a single application (invoked when the officer
        //     clicks a row in the results list).
        // ─────────────────────────────────────────────────────────────────────
        [HttpGet]
        public IActionResult GetApplicationDetails(string ReferenceNumber, string Serviceid)
        {
            if (string.IsNullOrWhiteSpace(ReferenceNumber))
                return Json(new { status = false, message = "Reference number is required." });

            if (!int.TryParse(Serviceid, out int serviceId))
                return Json(new { status = false, message = "Invalid service id." });

            var parameters = new[]
            {
        new NpgsqlParameter("p_service_id",   serviceId),
        new NpgsqlParameter("p_search_by",    "ReferenceNumber"),
        new NpgsqlParameter("p_search_value", ReferenceNumber.Trim()),
    };

            List<CitizenApplicationSearchResultDto> results;
            try
            {
                results = dbcontext.Database
                    .SqlQueryRaw<CitizenApplicationSearchResultDto>(
                        @"SELECT referencenumber AS ""ReferenceNumber"",
                         formdetails     AS ""FormDetails"",
                         status          AS ""Status"",
                         district_id     AS ""DistrictId"",
                         district_name   AS ""DistrictName"",
                         tehsil_id       AS ""TehsilId"",
                         tehsil_name     AS ""TehsilName"",
                         division_id     AS ""DivisionId"",
                         applicant_name  AS ""ApplicantName"",
                         iswithheld      AS ""IsWithheld""        -- ★ NEW
                  FROM search_citizen_application(
                          @p_service_id,
                          @p_search_by,
                          @p_search_value)",
                        parameters)
                    .ToList();
            }
            catch (PostgresException pgEx) when (pgEx.SqlState == "22023")
            {
                return Json(new { status = false, message = "Invalid search type." });
            }

            var application = results.FirstOrDefault();
            if (application == null)
                return Json(new { status = false, message = "Application not found." });

            // ★ access check removed — the SQL already governs what's searchable
            //   and the officer can only reach this endpoint by way of a reference
            //   number that SearchApplication already returned.

            var formDetailsToken = JToken.Parse(application.FormDetails ?? "{}");
            formDetailsToken = ReorderFormDetails(
                formDetailsToken,
                application.ReferenceNumber!,
                application.Status == "Sanctioned");
            ReplaceCodeFieldsWithNames(formDetailsToken);

            // ★ deserialise before calling GetFieldValue — same pattern as SearchApplication
            var formDetailsDynamic = JsonConvert.DeserializeObject<dynamic>(
                application.FormDetails ?? "{}");

            return Json(new
            {
                status = true,
                referenceNumber = application.ReferenceNumber,
                applicantName = GetFieldValue("ApplicantName", formDetailsDynamic),
                statusText = application.Status,
                districtName = application.DistrictName,
                tehsilName = application.TehsilName,
                // ★ Boolean → YES/NO/N/A, same shape the search list uses
                isWithheld = application.IsWithheld.HasValue
                                ? (application.IsWithheld.Value ? "YES" : "NO")
                                : "N/A",
                formDetailsToken
            });
        }
        [HttpGet]
        public IActionResult RedirectToCitizen(string username, bool isCitizen)
        {
            var clientToken = Request.Cookies["ClientToken"];
            var localUser = dbcontext.Users.FirstOrDefault(u => u.Username == username);
            var frontendUrl = _config["AppSettings:FrontendUrl"] ?? "http://localhost:3000";

            localUser!.Usertype = isCitizen ? "Officer" : "Citizen";

            // Generate sessionId and pass to GenerateJwt
            var sessionId = Guid.NewGuid();
            var jwt = helper.GenerateJwt(localUser!, clientToken!, sessionId);

            // Create session in database
            var newSession = new Usersessions
            {
                Sessionid = sessionId,
                Userid = localUser.Userid,
                Jwttoken = jwt,
                Logintime = DateTime.Now,
                Lastactivitytime = DateTime.Now
            };

            _sessionRepo.AddSessionAsync(newSession).Wait(); // or make method async

            dynamic ssoResponse = new ExpandoObject();
            ssoResponse.status = true;
            ssoResponse.token = jwt;
            ssoResponse.userType = localUser?.Usertype;
            ssoResponse.username = localUser?.Username;
            ssoResponse.userId = localUser?.Userid;
            ssoResponse.designation = "";
            ssoResponse.department = helper.GetDepartment(localUser!);
            ssoResponse.profile = localUser?.Profile ?? "/assets/images/profile.jpg";
            ssoResponse.email = localUser?.Email;

            var encoded = JsonConvert.SerializeObject(ssoResponse);

            _logger.LogInformation("REDIRECTING TO FRONTEND: {Url}", $"{frontendUrl}?sso={encoded}");
            return Json(new { url = $"{frontendUrl}/verification?sso={encoded}" });
        }
    }
}