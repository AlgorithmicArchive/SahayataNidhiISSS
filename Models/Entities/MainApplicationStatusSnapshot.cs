using System;
using System.Collections.Generic;

namespace SahayataNidhi.Models.Entities;

public partial class MainApplicationStatusSnapshot
{
    public int SnapshotId { get; set; }

    public DateTime? CapturedAt { get; set; }

    public string? PAccessLevel { get; set; }

    public int? PAccessCode { get; set; }

    public int? PServiceId { get; set; }

    public string? PTakenBy { get; set; }

    public int? PDivisionCode { get; set; }

    public int Pendingcount { get; set; }

    public int Returntoeditcount { get; set; }

    public int Sanctionedcount { get; set; }

    public int Rejectcount { get; set; }

    public int Totalapplications { get; set; }
}
