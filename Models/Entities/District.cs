using System;
using System.Collections.Generic;

namespace SahayataNidhi.Models.Entities;

public partial class District
{
    public int Districtid { get; set; }

    public string? Districtname { get; set; }

    public string? Districtshort { get; set; }

    public int Division { get; set; }

    public int? Uuid { get; set; }
}
