public interface ISmsSender
{
    /// <summary>Sends a free-text SMS. Only works with non-DLT gateways or in simulated mode.</summary>
    Task<bool> SendSmsAsync(string to, string message);

    /// <summary>
    /// Sends a DLT-registered template SMS. <paramref name="variables"/> are the ordered
    /// values that fill the template's {#alphanumeric#} placeholders (var1, var2, ...).
    /// </summary>
    Task<bool> SendTemplateSmsAsync(string to, string templateId, params string[] variables);
}