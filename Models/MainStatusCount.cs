public class MainStatusCounts
{
    public int TotalApplications { get; set; }
    public int PendingCount { get; set; }
    public int ReturnToEditCount { get; set; }
    public int RejectCount { get; set; }
    public int SanctionedCount { get; set; }

    // NEW: Counts for pension eligibility
    public int WithheldCount { get; set; }
    public int EligibleForPensionCount { get; set; }
}