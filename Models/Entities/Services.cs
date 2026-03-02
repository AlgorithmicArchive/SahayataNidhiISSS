using System;
using System.Collections.Generic;

namespace SahayataNidhi.Models.Entities;

public partial class Services
{
    public int Serviceid { get; set; }

    public string? Servicename { get; set; }

    public string? Nameshort { get; set; }

    public int? Departmentid { get; set; }

    public string? Formelement { get; set; }

    public string? Bankdetails { get; set; }

    public string? Officereditablefield { get; set; }

    public string? Documentfields { get; set; }

    public string? Privatefields { get; set; }

    public string? Letters { get; set; }

    public bool? Approvallistenabled { get; set; }

    public string? Submissionlimitconfig { get; set; }

    public string? Createdat { get; set; }

    public bool? Active { get; set; }

    public bool? Activeforofficers { get; set; }

    public virtual ICollection<Pool> Pool { get; set; } = new List<Pool>();

    public virtual ICollection<Webservice> Webservice { get; set; } = new List<Webservice>();
}
