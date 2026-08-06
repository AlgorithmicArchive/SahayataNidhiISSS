using System;
using System.Collections.Generic;

namespace SahayataNidhi.Models.Entities;

public partial class MvDivisionLocations
{
    public int? Division { get; set; }

    public List<int>? TehsilIds { get; set; }

    public List<int>? DistrictIds { get; set; }
}
