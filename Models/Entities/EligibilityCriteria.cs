using System;
using System.Collections.Generic;
using System.Text.Json;

namespace SahayataNidhi.Models.Entities;

public class EligibilityCriteria
{
    public int Id { get; set; }

    public int? ServiceId { get; set; }

    public string CriteriaName { get; set; } = null!;

    public string? Description { get; set; }

    /// <summary>
    /// Field path in FormDetails JSON to evaluate.
    /// Example: "Pension Type.additionalFields.KindOfDisability"
    /// </summary>
    public string FieldPath { get; set; } = null!;

    /// <summary>
    /// Expected value(s) for the field to match.
    /// Can be a single value, comma-separated values, or JSON array.
    /// </summary>
    public string? ExpectedValue { get; set; }

    /// <summary>
    /// Operator for comparison:
    /// equals, not_equals, contains, greater_than, less_than,
    /// expires_within, is_null, is_not_null
    /// </summary>
    public string Operator { get; set; } = "equals";

    /// <summary>
    /// For "expires_within" operator: duration string like '3 months', '30 days', '1 year'
    /// For "between" operator: second value
    /// </summary>
    public string? AdditionalValue { get; set; }

    /// <summary>
    /// Related date field path (for expiry calculations)
    /// Example: "Pension Type.additionalFields.IfTemporaryDisabilityUdidCardValidUpto"
    /// </summary>
    public string? DateFieldPath { get; set; }

    /// <summary>
    /// Reference date for expiry: 'today', 'sanction_date', 'custom'
    /// </summary>
    public string? ReferenceDateType { get; set; } = "today";

    /// <summary>
    /// For reference_date_type = 'custom': number of days from today
    /// </summary>
    public int? ReferenceDaysOffset { get; set; }

    /// <summary>
    /// Actions to take when criteria is matched (JSON).
    /// Format: [{"action": "show_in_dashboard", "label": "PCP-UDID Expires in 3 Months", "type": "expiringeligibility"}]
    /// </summary>
    public string? Actions { get; set; }

    /// <summary>
    /// For grouping related criteria (optional)
    /// </summary>
    public string? CriteriaGroup { get; set; }

    /// <summary>
    /// Priority order (lower = higher priority)
    /// </summary>
    public int Priority { get; set; } = 100;

    public bool? IsActive { get; set; } = true;

    public DateTime? CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public int? CreatedBy { get; set; }

    public virtual Services? Service { get; set; }
}

