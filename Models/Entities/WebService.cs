using System;
using System.Collections.Generic;

namespace SahayataNidhi.Models.Entities;

public partial class Webservice
{
    public int Id { get; set; }

    public string? Webservicename { get; set; }

    public int Serviceid { get; set; }

    public string Apiendpoint { get; set; } = null!;

    public string Onaction { get; set; } = null!;

    public string Fieldmappings { get; set; } = null!;

    public string Createdat { get; set; } = null!;

    public string Updatedat { get; set; } = null!;

    public bool Isactive { get; set; }

    public string? Headers { get; set; }

    public bool Retryenabled { get; set; }

    public int Maxattempts { get; set; }

    public int Retrydelayseconds { get; set; }

    public virtual Services Service { get; set; } = null!;

    public virtual ICollection<WebserviceLogs> WebserviceLogs { get; set; } = new List<WebserviceLogs>();
}
