using System;
using System.Collections.Generic;

namespace SahayataNidhi.Models.Entities;

public partial class Applicationswithexpiringeligibility
{
    public int ExpiringId { get; set; }

    public int Serviceid { get; set; }

    public string Referencenumber { get; set; } = null!;

    public string ExpirationDate { get; set; } = null!;

    public int MailSent { get; set; }

    public DateOnly? CreatedAt { get; set; }
}
