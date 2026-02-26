public class OfficerByAccessLevel
{
    public string? Name { get; set; }
    public string? Username { get; set; }
    public string? Email { get; set; }
    public string? MobileNumber { get; set; }
    public string? Designation { get; set; } // JSON string deserialized to object
    public string? AccessLevel { get; set; }
    public string? AccessCode { get; set; }
    public string? IsValidated { get; set; }
}