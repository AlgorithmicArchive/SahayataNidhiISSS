using System;
using System.Collections.Generic;

namespace SahayataNidhi.Models.Entities;

public partial class Emailsettings
{
    public int Id { get; set; }

    public string Sendername { get; set; } = null!;

    public string Senderemail { get; set; } = null!;

    public string Smtpserver { get; set; } = null!;

    public int Smtpport { get; set; }

    public string Password { get; set; } = null!;

    public string? Templates { get; set; }
}
