using System;
using System.Collections.Generic;

namespace SahayataNidhi.Models.Entities;

public partial class Offices
{
    public int Officeid { get; set; }

    public int Departmentid { get; set; }

    public string Officetype { get; set; } = null!;

    public string Accesslevel { get; set; } = null!;
}
