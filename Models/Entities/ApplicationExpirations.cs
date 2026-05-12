using System;
using System.Collections.Generic;

namespace SahayataNidhi.Models.Entities;

public partial class ApplicationExpirations
{
    public long Id { get; set; }

    public string Referencenumber { get; set; } = null!;

    public int ServiceId { get; set; }

    public int ExpirationTypeId { get; set; }

    public DateOnly ExpirationDate { get; set; }

    public DateOnly? BaseDate { get; set; }

    public string? SourceValue { get; set; }

    public string? SourceEvent { get; set; }

    public string? Email { get; set; }

    public string? MobileNumber { get; set; }

    public int MailSentCount { get; set; }

    public int SmsSentCount { get; set; }

    public DateTime? LastNotifiedAt { get; set; }

    public bool? IsActive { get; set; }

    public DateTime? ResolvedAt { get; set; }

    public DateTime? CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public virtual ExpirationTypes ExpirationType { get; set; } = null!;
}
