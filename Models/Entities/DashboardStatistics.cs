using System;
using System.Collections.Generic;

namespace SahayataNidhi.Models.Entities;

public partial class DashboardStatistics
{
    public long Id { get; set; }

    public int Serviceid { get; set; }

    public string Location { get; set; } = null!;

    public string MainCounts { get; set; } = null!;

    public string LegacyCounts { get; set; } = null!;

    public long ShiftedCounts { get; set; }

    public string CorrigendumCounts { get; set; } = null!;

    public string CorrectionCounts { get; set; } = null!;

    public string WithheldCounts { get; set; } = null!;

    public string ServiceSpecificCounts { get; set; } = null!;

    public virtual Services Service { get; set; } = null!;
}
