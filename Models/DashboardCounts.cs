public class DashboardCounts
{
    // Main application counts
    public int PendingCount { get; set; }
    public int ForwardedCount { get; set; }
    public int ReturnedCount { get; set; }
    public int ReturnToEditCount { get; set; }
    public int SanctionedCount { get; set; }
    public int RejectCount { get; set; }
    public int DisbursedCount { get; set; }
    public int TotalApplications { get; set; }
    public int ForwardedSanctionedCount { get; set; }

    // Corrigendum counts
    public int ForwardedSanctionedCorrigendumCount { get; set; }
    public int ForwardedVerifiedCorrectionCount { get; set; }
    public int CorrigendumPendingCount { get; set; }
    public int CorrigendumForwardedCount { get; set; }
    public int CorrigendumReturnedCount { get; set; }
    public int CorrigendumSanctionedCount { get; set; }
    public int CorrigendumRejectedCount { get; set; }
    public int CorrigendumCount { get; set; }

    // Correction counts
    public int CorrectionPendingCount { get; set; }
    public int CorrectionForwardedCount { get; set; }
    public int CorrectionReturnedCount { get; set; }
    public int CorrectionSanctionedCount { get; set; }
    public int CorrectionRejectedCount { get; set; }
    public int CorrectionCount { get; set; }

    // Amendment counts
    public int AmendmentPendingCount { get; set; }
    public int AmendmentForwardedCount { get; set; }
    public int AmendmentReturnedCount { get; set; }
    public int AmendmentSanctionedCount { get; set; }
    public int AmendmentRejectedCount { get; set; }
    public int AmendmentCount { get; set; }

    // Withheld counts
    public int TotalWithheldCount { get; set; }
    public int TemporaryWithheldCount { get; set; }
    public int PermanentWithheldCount { get; set; }
    public int WithheldPendingCount { get; set; }
    public int WithheldForwardedCount { get; set; }
    public int WithheldApprovedCount { get; set; }

    // Shifted count
    public long ShiftedCount { get; set; }

    // Temporary disability counts
    public long TemporaryDisabilityExpiringSoonCount { get; set; }
    public long TotalPhysicallyChallengedApplications { get; set; }

    // Legacy counts
    public int LegacyTotal { get; set; }
    public int LegacyPending { get; set; }
    public int LegacyForwarded { get; set; }
    public int LegacySanctioned { get; set; }
    public int LegacyRejected { get; set; }
}