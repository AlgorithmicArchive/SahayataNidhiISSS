using System.Dynamic;
using System.Globalization;
using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Npgsql;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using SahayataNidhi.Models.Entities;
using JsonSerializer = System.Text.Json.JsonSerializer;

public class UserHelperFunctions(IWebHostEnvironment webHostEnvironment, SwdjkContext dbcontext, ILogger<UserHelperFunctions> logger, IHttpClientFactory httpClientFactory, IConfiguration configuration)
{
    private readonly IWebHostEnvironment _webHostEnvironment = webHostEnvironment;
    private readonly SwdjkContext dbcontext = dbcontext;
    private readonly IHttpClientFactory _httpClientFactory = httpClientFactory;
    private readonly IConfiguration _configuration = configuration;
    private readonly ILogger<UserHelperFunctions> _logger = logger;

    private HttpClient Client => _httpClientFactory.CreateClient();

    private string BaseUrl => _configuration["JanParichay:ClientBaseUrl"]!.TrimEnd('/');

    public async Task<string> GetFilePath(IFormFile? docFile = null, byte[]? fileData = null, string? fileName = null, string documentType = "document")
    {
        if ((docFile == null || docFile.Length == 0) && fileData == null)
        {
            return "No file provided.";
        }

        string uniqueName;
        byte[] data;
        string contentType;

        if (docFile != null)
        {
            // Handle IFormFile
            string fileExtension = Path.GetExtension(docFile.FileName);
            string shortGuid = Guid.NewGuid().ToString("N")[..12];
            uniqueName = shortGuid + fileExtension;
            contentType = docFile.ContentType;

            using var memoryStream = new MemoryStream();
            await docFile.CopyToAsync(memoryStream);
            data = memoryStream.ToArray();
        }
        else
        {
            // Handle programmatically generated file
            if (fileData == null)
            {
                throw new ArgumentNullException(nameof(fileData));
            }

            // Determine file type from fileData (check for PDF signature)
            string fileExtension;
            if (fileData.Length > 5 && fileData[0] == 0x25 && fileData[1] == 0x50 && fileData[2] == 0x44 && fileData[3] == 0x46 && fileData[4] == 0x2D)
            {
                // Confirmed PDF (%PDF- signature)
                fileExtension = ".pdf";
                contentType = "application/pdf";
            }
            else
            {
                throw new NotSupportedException("Unsupported file type. Only PDF is supported.");
            }

            string shortGuid = Guid.NewGuid().ToString("N")[..12];
            uniqueName = shortGuid + fileExtension;
            data = fileData;
        }

        if (fileName != null)
        {
            var existingFile = dbcontext.Userdocuments.FirstOrDefault(f => f.Filename == fileName);
            if (existingFile != null)
            {
                dbcontext.Userdocuments.Remove(existingFile);
                await dbcontext.SaveChangesAsync();
            }
        }

        // Save to database to generate FileId
        var fileModel = new Userdocuments
        {
            Filename = fileName ?? uniqueName,
            Filetype = contentType,
            Filesize = data.Length,
            Filedata = data,
            Documenttype = documentType,
            Updatedat = DateTime.Now
        };

        dbcontext.Userdocuments.Add(fileModel);
        await dbcontext.SaveChangesAsync();

        return uniqueName;
    }

    public string GetCurrentFinancialYear()
    {
        var today = DateTime.Today;
        int startYear = today.Month < 4 ? today.Year - 1 : today.Year;
        int endYear = startYear + 1;

        // Format: yyyy-yy (e.g., 2025-26)
        return $"{startYear}-{endYear % 100:00}";
    }

    public string GenerateApplicationId(int districtId, SwdjkContext dbcontext)
    {
        string? districtShort = dbcontext.District.FirstOrDefault(u => u.Districtid == districtId)?.Districtshort;

        string financialYear = GetCurrentFinancialYear();

        var result = dbcontext.Applicationperdistrict.FirstOrDefault(a => a.Districtid == districtId && a.Financialyear == financialYear);

        int countPerDistrict = result?.Countvalue ?? 0;

        string sql = "";

        if (countPerDistrict != 0)
            sql = "UPDATE ApplicationPerDistrict SET CountValue = @CountValue WHERE DistrictId = @districtId AND FinancialYear = @financialyear";
        else
            sql = "INSERT INTO ApplicationPerDistrict (DistrictId, FinancialYear, CountValue) VALUES (@districtId, @financialyear, @CountValue)";

        countPerDistrict++; // Increment before using in parameter

        // PostgreSQL update/insert
        dbcontext.Database.ExecuteSqlRaw(sql,
            new NpgsqlParameter("@districtId", districtId),
            new NpgsqlParameter("@financialyear", financialYear),
            new NpgsqlParameter("@CountValue", countPerDistrict));

        return $"{districtShort}/{financialYear}/{countPerDistrict}";
    }

    public NpgsqlParameter[]? GetAddressParameters(IFormCollection form, string prefix)
    {
        try
        {
            return
            [
                new NpgsqlParameter("@AddressDetails", form[$"{prefix}Address"].ToString()),
                new NpgsqlParameter("@DistrictId", Convert.ToInt32(form[$"{prefix}District"])),
                new NpgsqlParameter("@TehsilId", Convert.ToInt32(form[$"{prefix}Tehsil"])),
                new NpgsqlParameter("@BlockId", Convert.ToInt32(form[$"{prefix}Block"])),
                new NpgsqlParameter("@HalqaPanchayatName", form[$"{prefix}PanchayatMuncipality"].ToString()),
                new NpgsqlParameter("@VillageName", form[$"{prefix}Village"].ToString()),
                new NpgsqlParameter("@WardName", form[$"{prefix}Ward"].ToString()),
                new NpgsqlParameter("@Pincode", form[$"{prefix}Pincode"].ToString())
            ];
        }
        catch (FormatException)
        {
            return null;
        }
    }

    // Removed UpdateApplication function as requested

    public string[] GenerateUniqueRandomCodes(int numberOfCodes, int codeLength)
    {
        HashSet<string> codesSet = new HashSet<string>();
        Random random = new();

        while (codesSet.Count < numberOfCodes)
        {
            const string chars = "0123456789";
            char[] codeChars = new char[codeLength];

            for (int i = 0; i < codeLength; i++)
            {
                codeChars[i] = chars[random.Next(chars.Length)];
            }

            string newCode = new(codeChars);
            codesSet.Add(newCode.ToString());
        }

        string[] codesArray = new string[numberOfCodes];
        codesSet.CopyTo(codesArray);
        return codesArray;
    }

    public void InsertHistory(string referenceNumber, string ActionTaken, string ActionTaker, string Remarks, string LocationLevel, int LocationValue)
    {
        var history = new Actionhistory
        {
            Referencenumber = referenceNumber,
            Actiontaken = ActionTaken,
            Actiontaker = ActionTaker,
            Remarks = Remarks,
            Locationlevel = LocationLevel,
            Locationvalue = LocationValue,
            Actiontakendate = DateTime.Now.ToString("dd MMM yyyy hh:mm:ss tt", CultureInfo.InvariantCulture)
        };
        dbcontext.Actionhistory.Add(history);
        dbcontext.SaveChanges();
    }

    public bool DeleteFile(string filePath)
    {
        try
        {
            if (string.IsNullOrEmpty(filePath))
            {
                return false;
            }

            var fullPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", filePath.TrimStart('/'));

            if (System.IO.File.Exists(fullPath))
            {
                System.IO.File.Delete(fullPath);
                return true;
            }

            return false;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error deleting file: {ex.Message}");
            return false;
        }
    }

    // Janparichay Helper functions
    public async Task<string> PerformHandshakeAsync(string handshakingId, string sid)
    {
        var url = $"{BaseUrl}/handshake?handshakingId={handshakingId}&sid={sid}";
        var response = await Client.GetAsync(url);
        var content = await response.Content.ReadAsStringAsync();

        _logger.LogInformation("Handshake Response: {Content}", content);

        response.EnsureSuccessStatusCode();
        var result = JsonSerializer.Deserialize<HandshakeResponse>(content, new JsonSerializerOptions { PropertyNameCaseInsensitive = true })
                     ?? throw new Exception("Handshake failed: null response");

        if (result.Status?.ToLower() != "success")
            throw new Exception($"Handshake failed: {result.Status}");

        return result.ServerHandshakingId!;
    }

    // ENCRYPT
    public async Task<string> EncryptStringAsync(string plainText)
    {
        var url = $"{BaseUrl}/encryption";

        var requestBody = new
        {
            AESString = plainText
        };

        var content = new StringContent(
            JsonSerializer.Serialize(requestBody),
            Encoding.UTF8,
            "application/json"
        );

        _logger.LogInformation("Encrypt Request: {Body}", JsonSerializer.Serialize(requestBody));

        var response = await Client.PostAsync(url, content);
        var responseContent = await response.Content.ReadAsStringAsync();

        _logger.LogInformation("Encrypt Response: {Content}", responseContent);

        response.EnsureSuccessStatusCode();

        var result = JsonSerializer.Deserialize<EncryptResponse>(responseContent,
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true })
            ?? throw new Exception("Encrypt failed: null response");

        if (!string.Equals(result.Status, "success", StringComparison.OrdinalIgnoreCase) ||
            string.IsNullOrEmpty(result.Data?.Signature))
        {
            throw new Exception($"Encrypt failed: {responseContent}");
        }

        return result.Data.Signature;
    }

    public async Task<UserSignature> DecryptStringAsync(string encryptedText)
    {
        var url = $"{BaseUrl}/decryption";

        var jsonBody = JsonSerializer.Serialize(new
        {
            EncryptedString = encryptedText
        });

        var content = new StringContent(jsonBody, Encoding.UTF8, "application/json");

        var response = await Client.PostAsync(url, content);
        var responseString = await response.Content.ReadAsStringAsync();

        _logger.LogInformation("Decrypt Response: {Content}", responseString);

        response.EnsureSuccessStatusCode();

        var result = JsonSerializer.Deserialize<DecryptResponse>(responseString,
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true })
            ?? throw new Exception("Decrypt failed: null response");

        if (result.Status?.ToLower() != "success" || result.Data?.Signature == null)
            throw new Exception($"Decrypt failed: {responseString}");

        return result.Data.Signature;
    }

    // HMAC
    public async Task<string> GetHmacSignatureAsync(string input)
    {
        var url = $"{BaseUrl}/hmac";

        var requestBody = new
        {
            HmacString = input
        };

        var content = new StringContent(
            JsonSerializer.Serialize(requestBody),
            Encoding.UTF8,
            "application/json"
        );

        _logger.LogInformation("HMAC Request: {Body}", JsonSerializer.Serialize(requestBody));

        var response = await Client.PostAsync(url, content);
        var responseContent = await response.Content.ReadAsStringAsync();

        _logger.LogInformation("HMAC Response: {Content}", responseContent);

        response.EnsureSuccessStatusCode();

        var result = JsonSerializer.Deserialize<HmacResponse>(
            responseContent,
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true })
            ?? throw new Exception("HMAC failed: null response");

        if (!string.Equals(result.Status, "success", StringComparison.OrdinalIgnoreCase) ||
            string.IsNullOrEmpty(result.Data?.Signature))
        {
            throw new Exception($"HMAC failed: {responseContent}");
        }

        return result.Data.Signature;
    }

    // TOKEN VALIDATION
    public async Task<bool> ValidateTokenAsync(string clientToken, string sessionId, string browserId, string sid)
    {
        var url = $"{BaseUrl}/isTokenValid?clientToken={clientToken}&sessionId={sessionId}&browserId={browserId}&sid={sid}";
        var response = await Client.GetAsync(url);
        var content = await response.Content.ReadAsStringAsync();

        _logger.LogInformation("TokenValid Response: {Content}", content);

        response.EnsureSuccessStatusCode();
        var result = JsonSerializer.Deserialize<TokenValidResponse>(content, new JsonSerializerOptions { PropertyNameCaseInsensitive = true })
                     ?? throw new Exception("TokenValid failed");

        return result.Status?.ToLower() == "success" && result.TokenValid == "true";
    }

    public async Task<Users> FindOrCreateJanParichayUser(UserSignature userSignature)
    {
        if (userSignature == null)
            throw new ArgumentException("Invalid JanParichay user data");

        var effectiveEmail = string.IsNullOrEmpty(userSignature.Email) ? userSignature.UserId : userSignature.Email;
        if (string.IsNullOrEmpty(effectiveEmail))
            throw new ArgumentException("Invalid JanParichay user data: Missing both Email and UserId");

        var existingUser = await dbcontext.Users
            .FirstOrDefaultAsync(u => u.Email == effectiveEmail);

        if (existingUser != null)
        {
            if (string.IsNullOrWhiteSpace(existingUser.Username))
            {
                existingUser.Username = userSignature.UserName;
                await dbcontext.SaveChangesAsync();
            }

            return existingUser;
        }

        var additionalDetails = new
        {
            DateOfBirth = userSignature.Dob
        };
        var additionalJson = JsonSerializer.Serialize(additionalDetails);

        var newUser = new Users
        {
            Name = $"{userSignature.FirstName?.ToUpper()} {userSignature.LastName?.ToUpper()}".Trim(),
            Username = effectiveEmail,
            Email = effectiveEmail,
            Mobilenumber = userSignature.MobileNo,
            Usertype = userSignature.UserType ?? "Citizen",
            Profile = userSignature.ProfilePic ?? "/assets/images/profile.jpg",
            Backupcodes = null,
            Additionaldetails = additionalJson,
            Isemailvalid = true,
            Registereddate = DateTime.Now.ToString("dd MMM yyyy hh:mm:ss tt")
        };

        _logger.LogInformation($"Creating new user with UserData: {newUser}");

        dbcontext.Users.Add(newUser);
        await dbcontext.SaveChangesAsync();
        return newUser;
    }

    // LOGOUT
    public string GetJanParichayLogoutUrl(
        string clientToken,
        string sessionId,
        string browserId,
        string sid,
        string userAgent,
        string tid)
    {
        var baseUrl = _configuration["JanParichay:JanParichayBaseUrl"]!.TrimEnd('/');

        var signatureBase = $"JanParichay{tid}{baseUrl}/v1/salt/api/client/logout{clientToken}{sid}{sessionId}";

        var clientSignature = GetHmacSignatureAsync(signatureBase).GetAwaiter().GetResult();

        var url = $"{baseUrl}/v1/salt/api/client/logout?" +
                  $"clientToken={clientToken}" +
                  $"&sid={sid}" +
                  $"&sessionId={sessionId}" +
                  $"&browserId={browserId}" +
                  $"&ua={userAgent}" +
                  $"&tid={tid}" +
                  $"&cs={clientSignature}";

        _logger.LogInformation("JanParichay Logout Redirect URL: {Url}", url);
        return url;
    }

    public string GetDepartment(Users user)
    {
        if (user.Usertype != "Admin") return "";
        try
        {
            var details = JsonConvert.DeserializeObject<Dictionary<string, object>>(user.Additionaldetails!);
            if (details?.TryGetValue("Department", out var deptId) == true)
            {
                int id = Convert.ToInt32(deptId);
                return dbcontext.Departments.FirstOrDefault(d => d.Departmentid == id)?.Departmentname ?? "";
            }
        }
        catch { }
        return "";
    }

    public string GenerateJwt(Users user, string clientToken)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Userid.ToString()),
            new(ClaimTypes.Name, user.Username!),
            new(ClaimTypes.Role, user.Usertype!),
            new("Profile", user.Profile!),
            new("JanParichayClientToken", clientToken)
        };

        var key = Encoding.ASCII.GetBytes(_configuration["JWT:Secret"]!);
        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Expires = DateTime.Now.AddHours(12),
            SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature),
            Issuer = _configuration["JWT:Issuer"],
            Audience = _configuration["JWT:Audience"]
        };

        var tokenHandler = new JwtSecurityTokenHandler();
        var token = tokenHandler.CreateToken(tokenDescriptor);
        return tokenHandler.WriteToken(token);
    }
}
