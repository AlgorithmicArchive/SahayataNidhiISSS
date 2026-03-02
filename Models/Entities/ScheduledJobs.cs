using System;
using System.Collections.Generic;

namespace SahayataNidhi.Models.Entities;

public partial class Scheduledjobs
{
    public Guid Id { get; set; }

    public string Cronexpression { get; set; } = null!;

    public string Actiontype { get; set; } = null!;

    public DateTime? Lastexecutedat { get; set; }

    public DateTime Createdat { get; set; }

    public string? Jsonparameters { get; set; }
}
