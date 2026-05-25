using System.Security.Cryptography;
using System.Text;

public class RsaKeyService
{
    private readonly RSA _rsa;

    public RsaKeyService(IConfiguration config)
    {
        _rsa = RSA.Create(2048);

        var privateKeyPem = config["RSA_PRIVATE_KEY"];
        if (!string.IsNullOrEmpty(privateKeyPem))
        {
            var bytes = Convert.FromBase64String(privateKeyPem);
            _rsa.ImportPkcs8PrivateKey(bytes, out _);
        }
    }

    public string GetPublicKeyPem()
    {
        // SPKI format - standard and works with node-forge
        var pubKey = _rsa.ExportSubjectPublicKeyInfo();
        return Convert.ToBase64String(pubKey);
    }

    public string Decrypt(string base64Cipher)
    {
        var cipher = Convert.FromBase64String(base64Cipher);
        var plain = _rsa.Decrypt(cipher, RSAEncryptionPadding.Pkcs1);
        return Encoding.UTF8.GetString(plain);
    }
}