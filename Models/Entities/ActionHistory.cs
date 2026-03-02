using System;
using System.Collections.Generic;

namespace SahayataNidhi.Models.Entities;

public partial class Actionhistory
{
    public int HistoryId { get; set; }

    public string Referencenumber { get; set; } = null!;

    public string Actiontaker { get; set; } = null!;

    public string Actiontaken { get; set; } = null!;

    public string? Locationlevel { get; set; }

    public int? Locationvalue { get; set; }

    public string? Remarks { get; set; }

    public string Actiontakendate { get; set; } = null!;
}
