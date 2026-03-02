using System;
using System.Collections.Generic;

namespace SahayataNidhi.Models.Entities;

public partial class WithheldApplications
{
    public int WithheldId { get; set; }

    public int Serviceid { get; set; }

    public string Referencenumber { get; set; } = null!;

    public string? Location { get; set; }

    public string? Workflow { get; set; }

    public int? Currentplayer { get; set; }

    public string? History { get; set; }

    public bool Iswithheld { get; set; }

    public string Withheldtype { get; set; } = null!;

    public string Withheldreason { get; set; } = null!;

    public string? Files { get; set; }

    public string? Status { get; set; }

    public DateOnly? Withheldon { get; set; }
}
