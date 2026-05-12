using System;
using System.Collections.Generic;

namespace SahayataNidhi.Models.Entities;

public partial class ExpirationTypes
{
    public int Id { get; set; }

    public string TypeCode { get; set; } = null!;

    public int? ServiceId { get; set; }

    public string ExpirationName { get; set; } = null!;

    public string? Description { get; set; }

    public string? MessageTemplate { get; set; }

    public bool? BasedOnField { get; set; }

    public string? ConditionField { get; set; }

    public string? ValueField { get; set; }

    public string? ValidityPeriod { get; set; }

    public string? ReminderBefore { get; set; }

    public bool? StopPaymentOnExpiry { get; set; }

    public string? StopPaymentGracePeriod { get; set; }

    public bool? IsActive { get; set; }

    public DateTime? CreatedAt { get; set; }

    public virtual ICollection<ApplicationExpirations> ApplicationExpirations { get; set; } = new List<ApplicationExpirations>();

    public virtual Services? Service { get; set; }
}
