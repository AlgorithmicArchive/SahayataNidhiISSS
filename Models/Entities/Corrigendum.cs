using System;
using System.Collections.Generic;

namespace SahayataNidhi.Models.Entities;

public partial class Corrigendum
{
    public string Corrigendumid { get; set; } = null!;

    public string Referencenumber { get; set; } = null!;

    public string? Location { get; set; }

    public string Corrigendumfields { get; set; } = null!;

    public string Workflow { get; set; } = null!;

    public int Currentplayer { get; set; }

    public string? Type { get; set; }

    public string? History { get; set; }

    public string? Status { get; set; }

    public DateTime Createdat { get; set; }

    public virtual CitizenApplications ReferencenumberNavigation { get; set; } = null!;
}
