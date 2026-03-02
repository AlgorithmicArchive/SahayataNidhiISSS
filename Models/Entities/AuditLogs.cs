using System;
using System.Collections.Generic;

namespace SahayataNidhi.Models.Entities;

public partial class Auditlogs
{
    public int Logid { get; set; }

    public int Userid { get; set; }

    public string Action { get; set; } = null!;

    public string Description { get; set; } = null!;

    public DateTime Timestamp { get; set; }

    public string Ipaddress { get; set; } = null!;

    public string Browser { get; set; } = null!;

    public string Operatingsystem { get; set; } = null!;

    public string Device { get; set; } = null!;

    public string Status { get; set; } = null!;

    public string? Additionaldata { get; set; }

    public virtual Users User { get; set; } = null!;
}
