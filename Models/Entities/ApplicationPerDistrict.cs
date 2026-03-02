using System;
using System.Collections.Generic;

namespace SahayataNidhi.Models.Entities;

public partial class Applicationperdistrict
{
    public int Uuid { get; set; }

    public string? Type { get; set; }

    public int Districtid { get; set; }

    public int? Serviceid { get; set; }

    public string? Financialyear { get; set; }

    public int Countvalue { get; set; }
}
