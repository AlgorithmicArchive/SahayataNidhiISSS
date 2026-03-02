public class OfficerApplicationDto
{
    public string? ReferenceNumber { get; set; }
    public string? ReferenceNumberAlphaNumeric { get; set; }
    public int? Citizen_id { get; set; }
    public int ServiceId { get; set; }
    public string? DistrictUidForBank { get; set; }
    public string? FormDetails { get; set; }
    public string? WorkFlow { get; set; }
    public string? AdditionalDetails { get; set; }
    public int? CurrentPlayer { get; set; }
    public string? Status { get; set; }
    public string? DataType { get; set; }
    public string? Created_at { get; set; }
    public string? WorkflowStatus { get; set; }  // ← Missing this too!
    public int HasCorrigendum { get; set; }       // ← Missing this!
    public string? DivisionName { get; set; }
    public string? DistrictName { get; set; }
    public string? TehsilName { get; set; }
    public long TotalCount { get; set; }  // ← ADD THIS (bigint maps to long)
}