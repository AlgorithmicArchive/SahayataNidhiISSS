using System;
using System.Collections.Generic;

namespace SahayataNidhi.Models.Entities;

public partial class Reports
{
    public int Id { get; set; }

    public string Name { get; set; } = null!;

    public string? Description { get; set; }

    public string Tablename { get; set; } = null!;

    public string Columns { get; set; } = null!;

    public string? Filters { get; set; }

    public DateTime? Createdat { get; set; }

    public string? Createdby { get; set; }
}
