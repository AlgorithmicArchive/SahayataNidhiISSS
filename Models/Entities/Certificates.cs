using System;
using System.Collections.Generic;

namespace SahayataNidhi.Models.Entities;

public partial class Certificates
{
    public int Uuid { get; set; }

    public int Officerid { get; set; }

    public byte[]? Serialnumber { get; set; }

    public string? Certifiyingauthority { get; set; }

    public DateTime? Expirationdate { get; set; }

    public string? Registereddate { get; set; }
}
