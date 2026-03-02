using System;
using System.Collections.Generic;

namespace SahayataNidhi.Models.Entities;

public partial class StatusCountsSnapshot
{
    public int SnapshotId { get; set; }

    public DateTime? CapturedAt { get; set; }

    public string? PAccessLevel { get; set; }

    public int? PAccessCode { get; set; }

    public int? PServiceId { get; set; }

    public string? PTakenBy { get; set; }

    public int? PDivisionCode { get; set; }

    public int Pendingcount { get; set; }

    public int Forwardedcount { get; set; }

    public int Returnedcount { get; set; }

    public int Returntoeditcount { get; set; }

    public int Sanctionedcount { get; set; }

    public int Rejectcount { get; set; }

    public int Disbursedcount { get; set; }

    public int Totalapplications { get; set; }

    public int Forwardedsanctionedcount { get; set; }

    public int Forwardedsanctionedcorrigendumcount { get; set; }

    public int Forwardedverifiedcorrectioncount { get; set; }

    public int Corrigendumpendingcount { get; set; }

    public int Corrigendumforwardedcount { get; set; }

    public int Corrigendumreturnedcount { get; set; }

    public int Corrigendumsanctionedcount { get; set; }

    public int Corrigendumrejectedcount { get; set; }

    public int Corrigendumcount { get; set; }

    public int Correctionpendingcount { get; set; }

    public int Correctionforwardedcount { get; set; }

    public int Correctionreturnedcount { get; set; }

    public int Correctionsanctionedcount { get; set; }

    public int Correctionrejectedcount { get; set; }

    public int Correctioncount { get; set; }

    public int Amendmentpendingcount { get; set; }

    public int Amendmentforwardedcount { get; set; }

    public int Amendmentreturnedcount { get; set; }

    public int Amendmentsanctionedcount { get; set; }

    public int Amendmentrejectedcount { get; set; }

    public int Amendmentcount { get; set; }

    public int Totalwithheldcount { get; set; }

    public int Temporarywithheldcount { get; set; }

    public int Permanentwithheldcount { get; set; }

    public int Withheldpendingcount { get; set; }

    public int Withheldforwardedcount { get; set; }

    public int Withheldapprovedcount { get; set; }
}
