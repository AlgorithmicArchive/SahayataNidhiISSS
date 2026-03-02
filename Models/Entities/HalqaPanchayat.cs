using System;
using System.Collections.Generic;

namespace SahayataNidhi.Models.Entities;

public partial class Halqapanchayat
{
    public int Uuid { get; set; }

    public int? Blockid { get; set; }

    public int? Halqapanchayatid { get; set; }

    public string? Halqapanchayatname { get; set; }
}
