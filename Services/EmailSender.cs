using System.Net;
using System.Net.Mail;
using EncryptionHelper;
using Microsoft.Extensions.Options;
using SahayataNidhi.Models.Entities;

namespace SendEmails
{
    public class EmailSender(ILogger<EmailSender> logger, SwdjkContext dbcontext, IEncryptionService encryptionService, IConfiguration configuration) : IEmailSender
    {
        protected readonly SwdjkContext dbcontext = dbcontext;
        private readonly ILogger<EmailSender> _logger = logger;

        private readonly IEncryptionService _encryptionService = encryptionService;
        private readonly IConfiguration _configuration = configuration;

        public async Task SendEmail(string email, string subject, string message)
        {
            throw new SmtpException("Simulated failure for testing purposes");
            // await SendEmailWithAttachments(email, subject, message, [], string.Empty); // Don't Delete this line
        }



        public async Task SendEmailWithAttachments(
            string email,
            string subject,
            string message,
            byte[] attachmentData,
            string attachmentFileName
        )
        {
            try
            {
                var emailSettings = dbcontext.EmailSettings.FirstOrDefault();
                if (emailSettings == null)
                    throw new InvalidOperationException("Email settings not found.");

                string senderEmail = emailSettings.SenderEmail!;
                string? key = _configuration["Encryption:Key"];
                string password = _encryptionService.Decrypt(emailSettings.Password!, key!);

                using var client = new SmtpClient(emailSettings.SmtpServer, emailSettings.SmtpPort)
                {
                    EnableSsl = true,
                    Credentials = new NetworkCredential(senderEmail, password),
                    Timeout = 30000
                };

                using var mailMessage = new MailMessage
                {
                    From = new MailAddress(senderEmail),
                    Subject = subject,
                    Body = message,
                    IsBodyHtml = true
                };

                mailMessage.To.Add(email);

                // ✅ ATTACHMENT FROM MEMORY (NO FILE SYSTEM)
                if (attachmentData != null && attachmentData.Length > 0)
                {
                    var attachmentStream = new MemoryStream(attachmentData);

                    var attachment = new Attachment(
                        attachmentStream,
                        attachmentFileName,
                        "application/pdf"
                    );

                    mailMessage.Attachments.Add(attachment);
                }

                await client.SendMailAsync(mailMessage);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error sending email with attachment");
                throw;
            }
        }


    }
}
