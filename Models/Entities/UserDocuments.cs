using System;
using System.Collections.Generic;

namespace SahayataNidhi.Models.Entities;

public partial class Userdocuments
{
    public int Fileid { get; set; }

    public string Filename { get; set; } = null!;

    public string Filetype { get; set; } = null!;

    public int Filesize { get; set; }

    public byte[] Filedata { get; set; } = null!;

    public string? Documenttype { get; set; }

    public DateTime Updatedat { get; set; }
}
