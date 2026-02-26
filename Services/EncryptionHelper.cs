using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Configuration;

namespace EncryptionHelper
{
    public interface IEncryptionService
    {
        string Encrypt(string plainText, string key);
        string Decrypt(string cipherText, string key);
    }

    public class EncryptionService : IEncryptionService
    {
        private readonly byte[] _salt;

        public EncryptionService(IConfiguration configuration)
        {
            _salt = Encoding.UTF8.GetBytes(configuration["Encryption:Salt"] ?? throw new InvalidOperationException("Salt is not configured."));
        }

        public string Encrypt(string plainText, string key)
        {
            if (string.IsNullOrEmpty(plainText))
                throw new ArgumentNullException(nameof(plainText));
            if (string.IsNullOrEmpty(key))
                throw new ArgumentNullException(nameof(key));

            byte[] encrypted;
            using (var aes = Aes.Create())
            {
                aes.Key = DeriveKey(key);
                aes.IV = GenerateIV();

                using (var encryptor = aes.CreateEncryptor(aes.Key, aes.IV))
                using (var ms = new MemoryStream())
                {
                    ms.Write(aes.IV, 0, aes.IV.Length); // Prepend IV to the encrypted data
                    using (var cs = new CryptoStream(ms, encryptor, CryptoStreamMode.Write))
                    using (var sw = new StreamWriter(cs))
                    {
                        sw.Write(plainText);
                    }
                    encrypted = ms.ToArray();
                }
            }

            return Convert.ToBase64String(encrypted);
        }

        public string Decrypt(string cipherText, string key)
        {
            if (string.IsNullOrEmpty(cipherText))
                throw new ArgumentNullException(nameof(cipherText));
            if (string.IsNullOrEmpty(key))
                throw new ArgumentNullException(nameof(key));

            byte[] cipherBytes = Convert.FromBase64String(cipherText);
            string decrypted;

            using (var aes = Aes.Create())
            {
                aes.Key = DeriveKey(key);

                // Extract IV from the beginning of the cipher text
                byte[] iv = new byte[16];
                Array.Copy(cipherBytes, 0, iv, 0, iv.Length);
                aes.IV = iv;

                using (var decryptor = aes.CreateDecryptor(aes.Key, aes.IV))
                using (var ms = new MemoryStream(cipherBytes, iv.Length, cipherBytes.Length - iv.Length))
                using (var cs = new CryptoStream(ms, decryptor, CryptoStreamMode.Read))
                using (var sr = new StreamReader(cs))
                {
                    decrypted = sr.ReadToEnd();
                }
            }

            return decrypted;
        }

        private byte[] DeriveKey(string key)
        {
            using (var deriveBytes = new Rfc2898DeriveBytes(key, _salt, 10000, HashAlgorithmName.SHA256))
            {
                return deriveBytes.GetBytes(32); // 256-bit key
            }
        }

        private byte[] GenerateIV()
        {
            using (var aes = Aes.Create())
            {
                aes.GenerateIV();
                return aes.IV;
            }
        }
    }
}