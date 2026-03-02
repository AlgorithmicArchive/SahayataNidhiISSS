using System;
using System.Collections.Generic;

namespace SahayataNidhi.Models.Entities;

public partial class Wards
{
    public int Uuid { get; set; }

    public int? Muncipalityid { get; set; }

    public int? Wardcode { get; set; }

    public int? Wardno { get; set; }
}
