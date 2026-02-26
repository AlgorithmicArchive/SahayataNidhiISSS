// Ensure your interface reflects the new method
public interface IEmailSender
{
    Task SendEmail(string email, string subject, string message);
    Task SendEmailWithAttachments(
     string email,
     string subject,
     string message,
     byte[] attachmentData,
     string attachmentFileName
 );
}