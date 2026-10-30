using System;
using System.Collections.Generic;

namespace SahayataNidhi.Models.Entities;

public partial class Smssettings
{
    public int Id { get; set; }

    public string? Providername { get; set; }

    public string? Apiurl { get; set; }

    public string? Httpmethod { get; set; }

    public string? Apikey { get; set; }

    public string? Keylocation { get; set; }

    public string? Keyname { get; set; }

    public string? Senderid { get; set; }

    public string? Bodytemplate { get; set; }

    public string? Successindicator { get; set; }

    public bool? Enabled { get; set; }
}
