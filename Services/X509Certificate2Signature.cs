using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using iText.Signatures;

public class X509Certificate2Signature : IExternalSignature
{
    private readonly X509Certificate2 _certificate;
    private readonly string _hashAlgorithm;

    public X509Certificate2Signature(X509Certificate2 certificate, string hashAlgorithm)
    {
        _certificate = certificate;
        _hashAlgorithm = hashAlgorithm;
    }

    public byte[] Sign(byte[] message)
    {
        using (var rsa = _certificate.GetRSAPrivateKey())
        {
            if (rsa == null)
                throw new InvalidOperationException("Certificate does not have a private key.");

            return rsa.SignData(message, GetHashAlgorithmName(_hashAlgorithm), RSASignaturePadding.Pkcs1);
        }
    }

    public string GetHashAlgorithm()
    {
        return _hashAlgorithm;
    }

    public string GetEncryptionAlgorithm()
    {
        return "RSA";
    }

    private static HashAlgorithmName GetHashAlgorithmName(string hashAlgorithm)
    {
        switch (hashAlgorithm.ToUpper())
        {
            case "SHA-1":
                return HashAlgorithmName.SHA1;
            case "SHA-256":
                return HashAlgorithmName.SHA256;
            case "SHA-384":
                return HashAlgorithmName.SHA384;
            case "SHA-512":
                return HashAlgorithmName.SHA512;
            default:
                throw new CryptographicException($"Unsupported hash algorithm: {hashAlgorithm}");
        }
    }

    public string GetDigestAlgorithmName()
    {
        throw new NotImplementedException();
    }

    public string GetSignatureAlgorithmName()
    {
        throw new NotImplementedException();
    }

    public ISignatureMechanismParams GetSignatureMechanismParameters()
    {
        throw new NotImplementedException();
    }
}
