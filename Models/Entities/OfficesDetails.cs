using System;
using System.Collections.Generic;

namespace SahayataNidhi.Models.Entities;

public partial class Officesdetails
{
    public int Statecode { get; set; }

    public int Divisioncode { get; set; }

    public int Districtcode { get; set; }

    public int Areacode { get; set; }

    public string Areaname { get; set; } = null!;

    public string Officename { get; set; } = null!;

    public int Officetype { get; set; }

    public virtual Offices OfficetypeNavigation { get; set; } = null!;
}
