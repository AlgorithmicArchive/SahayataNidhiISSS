using System;
using System.Collections.Generic;

namespace SahayataNidhi.Models.Entities;

public partial class Muncipalities
{
    public int Uuid { get; set; }

    public int? Districtid { get; set; }

    public int? Muncipalityid { get; set; }

    public string? Muncipalityname { get; set; }

    public int? Muncipalitytype { get; set; }
}
