using System;
using System.Collections.Generic;

namespace SahayataNidhi.Models.Entities;

public partial class Officesdetails
{
    public int StateCode { get; set; }

    public int DivisionCode { get; set; }

    public int DistrictCode { get; set; }

    public int AreaCode { get; set; }

    public string AreaName { get; set; } = null!;

    public string OfficeName { get; set; } = null!;

    public int OfficeType { get; set; }

    public virtual Offices OfficetypeNavigation { get; set; } = null!;
}
