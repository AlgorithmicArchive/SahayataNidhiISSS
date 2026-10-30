using System;
using System.Collections.Generic;

namespace SahayataNidhi.Models.Entities;

public partial class WebserviceLogs
{
    public int Id { get; set; }

    public Guid Executionid { get; set; }

    public int Webserviceid { get; set; }

    public int? Serviceid { get; set; }

    public string? Triggername { get; set; }

    public string? Referencenumber { get; set; }

    public int Attemptnumber { get; set; }

    public string? Requesturl { get; set; }

    public string Requestmethod { get; set; } = null!;

    public string? Requestheaders { get; set; }

    public string? Requestbody { get; set; }

    public int? Responsestatuscode { get; set; }

    public string? Responseheaders { get; set; }

    public string? Responsebody { get; set; }

    public bool Issuccess { get; set; }

    public string? Errormessage { get; set; }

    public long? Durationms { get; set; }

    public DateTime Createdat { get; set; }

    public virtual Webservice Webservice { get; set; } = null!;
}
