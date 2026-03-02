using System;
using System.Collections.Generic;

namespace SahayataNidhi.Models.Entities;

public partial class Pool
{
    public int Poolid { get; set; }

    public int Serviceid { get; set; }

    public string Accesslevel { get; set; } = null!;

    public int Accesscode { get; set; }

    public string? Listtype { get; set; }

    public string? List { get; set; }

    public virtual Services Service { get; set; } = null!;
}
