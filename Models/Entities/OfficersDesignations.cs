using System;
using System.Collections.Generic;

namespace SahayataNidhi.Models.Entities;

public partial class Officersdesignations
{
    public int Uuid { get; set; }

    public int? Departmentid { get; set; }

    public string? Designation { get; set; }

    public string? Designationshort { get; set; }

    public string? Accesslevel { get; set; }
}
