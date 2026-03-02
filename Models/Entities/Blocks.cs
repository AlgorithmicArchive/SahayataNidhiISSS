using System;
using System.Collections.Generic;

namespace SahayataNidhi.Models.Entities;

public partial class Blocks
{
    public int Uuid { get; set; }

    public int? Districtid { get; set; }

    public int? Blockid { get; set; }

    public string? Blockname { get; set; }
}
