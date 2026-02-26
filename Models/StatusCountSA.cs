public class StatusCountsSA
{
    public int PendingCount { get; set; }
    public int ReturnToEditCount { get; set; }
    public int SanctionCount { get; set; }
    public int RejectCount { get; set; }
    public int DisbursedCount { get; set; } // Added for the DisbursedCount
    public int FailureCount { get; set; } // Added for the FailureCount
    public int TotalApplications { get; set; } // New property for total applications count
}
