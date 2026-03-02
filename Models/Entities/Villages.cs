using System;
using System.Collections.Generic;

namespace SahayataNidhi.Models.Entities;

public partial class Villages
{
    public int Uuid { get; set; }

    public int? Halqapanchayatid { get; set; }

    public int? Villageid { get; set; }

    public string? Villagename { get; set; }
}
