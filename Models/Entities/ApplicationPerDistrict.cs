using System;
using System.ComponentModel.DataAnnotations.Schema;

namespace SahayataNidhi.Models.Entities;

public partial class ApplicationPerDistrict
{
    public int Uuid { get; set; }

    [Column("Type")]
    public string? Type { get; set; }

    public int DistrictId { get; set; }

    public int? ServiceId { get; set; }

    public string? FinancialYear { get; set; }

    public int CountValue { get; set; }
}
