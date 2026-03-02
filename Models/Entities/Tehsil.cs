using System;
using System.Collections.Generic;

namespace SahayataNidhi.Models.Entities;

public partial class Tehsil
{
    public int Uuid { get; set; }

    public int Districtid { get; set; }

    public int Tehsilid { get; set; }

    public string? Tehsilname { get; set; }

    public bool? Istswo { get; set; }
}
