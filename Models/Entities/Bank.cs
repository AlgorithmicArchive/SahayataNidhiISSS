using System;
using System.Collections.Generic;

namespace SahayataNidhi.Models.Entities;

public partial class Bank
{
    public int Id { get; set; }

    public string Bankname { get; set; } = null!;

    public string Bankcode { get; set; } = null!;
}
