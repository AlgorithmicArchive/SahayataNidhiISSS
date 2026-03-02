using System;
using System.Collections.Generic;

namespace SahayataNidhi.Models.Entities;

public partial class Usersessions
{
    public Guid Sessionid { get; set; }

    public int Userid { get; set; }

    public string Jwttoken { get; set; } = null!;

    public DateTime Logintime { get; set; }

    public DateTime Lastactivitytime { get; set; }
}
