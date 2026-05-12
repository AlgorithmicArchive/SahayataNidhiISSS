using System;
using System.Collections.Generic;

namespace SahayataNidhi.Models.Entities;

public partial class CitizenApplicationsLegacy
{
    public string Referencenumber { get; set; } = null!;

    public string? Referencenumberalphanumeric { get; set; }

    public int CitizenId { get; set; }

    public int Serviceid { get; set; }

    public string? Districtuidforbank { get; set; }

    public string? Formdetails { get; set; }

    public string? Workflow { get; set; }

    public string? Additionaldetails { get; set; }

    public int? Currentplayer { get; set; }

    public string? Status { get; set; }

    public string? Datatype { get; set; }

    public string? CreatedAt { get; set; }

    public long? ApplId { get; set; }
}
