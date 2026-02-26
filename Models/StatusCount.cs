using System.ComponentModel.DataAnnotations.Schema;

public class StatusCounts
{
    [Column("totalapplications")]
    public int TotalApplications { get; set; }

    [Column("pendingcount")]
    public int PendingCount { get; set; }

    [Column("forwardedcount")]
    public int ForwardedCount { get; set; }

    [Column("returnedcount")]
    public int ReturnedCount { get; set; }

    [Column("returntoeditcount")]
    public int ReturnToEditCount { get; set; }

    [Column("sanctionedcount")]
    public int SanctionedCount { get; set; }

    [Column("rejectcount")]
    public int RejectCount { get; set; }

    [Column("disbursedcount")]
    public int DisbursedCount { get; set; }

    [Column("forwardedsanctionedcount")]
    public int ForwardedSanctionedCount { get; set; }

    [Column("forwardedsanctionedcorrigendumcount")]
    public int ForwardedSanctionedCorrigendumCount { get; set; }

    [Column("forwardedverifiedcorrectioncount")]
    public int ForwardedVerifiedCorrectionCount { get; set; }

    [Column("corrigendumpendingcount")]
    public int CorrigendumPendingCount { get; set; }

    [Column("corrigendumforwardedcount")]
    public int CorrigendumForwardedCount { get; set; }

    [Column("corrigendumreturnedcount")]
    public int CorrigendumReturnedCount { get; set; }

    [Column("corrigendumsanctionedcount")]
    public int CorrigendumSanctionedCount { get; set; }

    [Column("corrigendumrejectedcount")]
    public int CorrigendumRejectedCount { get; set; }

    [Column("corrigendumcount")]
    public int CorrigendumCount { get; set; }

    [Column("correctionpendingcount")]
    public int CorrectionPendingCount { get; set; }

    [Column("correctionforwardedcount")]
    public int CorrectionForwardedCount { get; set; }

    [Column("correctionreturnedcount")]
    public int CorrectionReturnedCount { get; set; }

    [Column("correctionsanctionedcount")]
    public int CorrectionSanctionedCount { get; set; }

    [Column("correctionrejectedcount")]
    public int CorrectionRejectedCount { get; set; }

    [Column("correctioncount")]
    public int CorrectionCount { get; set; }

    [Column("amendmentpendingcount")]
    public int AmendmentPendingCount { get; set; }

    [Column("amendmentforwardedcount")]
    public int AmendmentForwardedCount { get; set; }

    [Column("amendmentreturnedcount")]
    public int AmendmentReturnedCount { get; set; }

    [Column("amendmentsanctionedcount")]
    public int AmendmentSanctionedCount { get; set; }

    [Column("amendmentrejectedcount")]
    public int AmendmentRejectedCount { get; set; }

    [Column("amendmentcount")]
    public int AmendmentCount { get; set; }

    [Column("totalwithheldcount")]
    public int TotalWithheldCount { get; set; }

    [Column("temporarywithheldcount")]
    public int TemporaryWithheldCount { get; set; }

    [Column("permanentwithheldcount")]
    public int PermanentWithheldCount { get; set; }

    [Column("withheldpendingcount")]
    public int WithheldPendingCount { get; set; }

    [Column("withheldforwardedcount")]
    public int WithheldForwardedCount { get; set; }

    [Column("withheldapprovedcount")]
    public int WithheldApprovedCount { get; set; }
}