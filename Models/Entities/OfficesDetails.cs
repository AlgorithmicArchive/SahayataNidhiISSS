using System;
using System.Collections.Generic;

namespace SahayataNidhi.Models.Entities;

public partial class Officesdetails
{
    public string Areaname { get; set; } = null!;

    public string Officename { get; set; } = null!;

    public int Officeid { get; set; }

    public int Officedetailid { get; set; }

    public int? Parentofficedetailid { get; set; }

    public int Statecode { get; set; }

    public int Divisioncode { get; set; }

    public int Districtcode { get; set; }

    public int Areacode { get; set; }

    public virtual Offices Office { get; set; } = null!;
}
