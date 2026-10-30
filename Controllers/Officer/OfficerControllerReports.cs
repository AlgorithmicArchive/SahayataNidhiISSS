using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SahayataNidhi.Helpers;
using SahayataNidhi.Models.Entities;

namespace SahayataNidhi.Controllers.Officer
{
    // Inherits [Authorize(Roles = "Officer")] from OfficerControllerBase.
    // Endpoints mirror the Designer ones but run under officer authorization.
    public partial class OfficerController
    {
        [HttpGet]
        public IActionResult GetDynamicReportTemplates([FromQuery] int? serviceId = null)
        {
            try
            {
                var q = dbcontext.Reports.AsQueryable();
                if (serviceId.HasValue)
                    q = q.Where(r => r.ServiceId == serviceId.Value);

                var templates = q
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
                        createdAt = r.Createdat
                    })
                    .ToList();

                return Ok(new { status = true, data = templates });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching dynamic report templates (officer)");
                return StatusCode(500, new { status = false, message = ex.Message });
            }
        }

        [HttpGet]
        public async Task<IActionResult> RunDynamicReport(
            [FromQuery] int templateId,
            [FromQuery] string? filterJson = null)
        {
            try
            {
                var template = await dbcontext.Reports.FindAsync(templateId);
                if (template == null)
                    return NotFound(new { status = false, message = "Report template not found" });

                var result = await DynamicReportQuery.ExecuteAsync(dbcontext, template, filterJson);
                if (!result.Success)
                    return StatusCode(result.Status, new { status = false, message = result.Error });

                return Ok(new
                {
                    status = true,
                    data = result.Data,
                    columns = result.Columns,
                    totalRecords = result.TotalRecords,
                    reportName = template.Name
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error running dynamic report {TemplateId}", templateId);
                return StatusCode(500, new { status = false, message = ex.Message });
            }
        }

        // Distinct values for a filter field/JSON path, scoped to a service — feeds
        // the officer's filter dropdowns so values are real (correct case, no typos).
        [HttpGet]
        public async Task<IActionResult> GetReportFieldValues(
            [FromQuery] int? serviceId = null,
            [FromQuery] string? field = null,
            [FromQuery] string? jsonPath = null)
        {
            try
            {
                var values = await DynamicReportQuery.GetDistinctValuesAsync(dbcontext, serviceId, field, jsonPath);
                return Ok(new { status = true, values });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching report field values (officer)");
                return StatusCode(500, new { status = false, message = ex.Message });
            }
        }
    }
}