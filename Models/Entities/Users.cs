using System;
using System.Collections.Generic;

namespace SahayataNidhi.Models.Entities;

public partial class Users
{
    public int Userid { get; set; }

    public string? Name { get; set; }

    public string? Username { get; set; }

    public string? Email { get; set; }

    public byte[]? Password { get; set; }

    public string? Mobilenumber { get; set; }

    public string? Profile { get; set; }

    public string? Usertype { get; set; }

    public string? Backupcodes { get; set; }

    public string? Additionaldetails { get; set; }

    public bool Isemailvalid { get; set; }

    public string? Registereddate { get; set; }

    public virtual ICollection<Auditlogs> Auditlogs { get; set; } = new List<Auditlogs>();
}
