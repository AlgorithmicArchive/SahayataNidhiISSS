public class BankFileRawResult
{
    public string? ReferenceNumber { get; set; }
    public string? Districtbankuid { get; set; }
    public string? Department { get; set; }
    public string? PayingBankAccountNumber { get; set; }
    public string? PayingBankIfscCode { get; set; }
    public string? PayingBankName { get; set; }
    public DateTime FileGenerationDate { get; set; }
    public int Amount { get; set; }
    public string? ApplicantName { get; set; }
    public string? ReceivingIfscCode { get; set; }
    public string? ReceivingAccountNumber { get; set; }
    public string? PensionType { get; set; }
}
