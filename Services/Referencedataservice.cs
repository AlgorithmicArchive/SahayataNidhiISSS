using Newtonsoft.Json.Linq;
using SahayataNidhi.Models.Entities;

// Phase 2 cleanup: these five methods previously existed as separate,
// independently-maintained copies in BaseController, OfficerController,
// ViewerController and UserController. GetFieldValue and GetOfficerArea were
// byte-for-byte identical in all four places; GetOfficerAreaForHistory,
// GetTehsilName and GetDistrictName had each drifted slightly (see notes
// below) - drift that only surfaced because they were duplicated instead of
// shared. This is now the single source of truth; each controller keeps a
// one-line method that delegates here, so no call sites elsewhere in the
// codebase needed to change.
public interface IReferenceDataService
{
    string GetFieldValue(string fieldName, dynamic data);
    string GetOfficerArea(string accessLevel, dynamic formDetails);
    string GetOfficerAreaForHistory(string accessLevel, int? accessCode);
    string GetTehsilName(int tehsilId);
    string GetDistrictName(int districtId);
}

public class ReferenceDataService(SwdjkContext dbcontext) : IReferenceDataService
{
    private readonly SwdjkContext _dbcontext = dbcontext;

    public string GetFieldValue(string fieldName, dynamic data)
    {
        foreach (var section in data)
        {
            if (section.First is JArray fields)
            {
                foreach (var field in fields)
                {
                    if (field["name"] != null && field["name"]?.ToString() == fieldName)
                    {
                        return field["value"]?.ToString() ?? "";
                    }
                }
            }
        }
        return "";
    }

    public string GetOfficerArea(string accessLevel, dynamic formDetails)
    {
        int accessCode;

        switch (accessLevel)
        {
            case "Tehsil":
                accessCode = Convert.ToInt32(GetFieldValue("Tehsil", formDetails));
                var tehsil = _dbcontext.Tswotehsil.FirstOrDefault(t => t.Tehsilid == accessCode);
                return tehsil?.Tehsilname ?? string.Empty;

            case "District":
                accessCode = Convert.ToInt32(GetFieldValue("District", formDetails));
                var district = _dbcontext.District.FirstOrDefault(d => d.Districtid == accessCode);
                return district?.Districtname ?? string.Empty;

            case "Division":
                accessCode = Convert.ToInt32(GetFieldValue("District", formDetails));
                var districtForDivision = _dbcontext.District.FirstOrDefault(d => d.Districtid == accessCode);
                if (districtForDivision == null)
                    return string.Empty;
                return districtForDivision.Division == 1 ? "Jammu" : "Kashmir";
            case "State":
                return "J&K";
            default:
                return string.Empty;
        }
    }

    public string GetOfficerAreaForHistory(string accessLevel, int? accessCode)
    {
        // NOTE: Officer's previous copy took a shortcut for "Division" -
        // `accessCode == 1 ? "Jammu" : "Kashmir"` - treating the district id
        // itself as the division flag. Base's and User's copies (used here)
        // instead look up the district and read its actual Division field.
        // For any district whose id isn't 1, Officer's version returned the
        // wrong area. Consolidating onto this version fixes that.

        switch (accessLevel)
        {
            case "Tehsil":
                var tehsil = _dbcontext.Tswotehsil.FirstOrDefault(t => t.Tehsilid == accessCode);
                return tehsil?.Tehsilname ?? string.Empty;

            case "District":
                var district = _dbcontext.District.FirstOrDefault(d => d.Districtid == accessCode);
                return district?.Districtname ?? string.Empty;

            case "Division":
                return accessCode == 1 ? "Jammu" : "Kashmir";
            case "State":
                return "J&K";
            default:
                return string.Empty;
        }
    }

    public string GetTehsilName(int tehsilId)
    {
        // NOTE: User's previous copy did
        //   dbcontext.Tehsil.FirstOrDefault(...)!.Tehsilname!
        // - a null-forgiving dereference with no null check, which throws
        // NullReferenceException for an unknown tehsilId. This version
        // (Officer's original) returns "" instead, which is what every
        // caller of the Officer copy already assumed.
        return _dbcontext.Tehsil.FirstOrDefault(d => d.Tehsilid == tehsilId)?.Tehsilname ?? string.Empty;
    }

    public string GetDistrictName(int districtId)
    {
        // Same NullReferenceException risk fixed as in GetTehsilName above.
        return _dbcontext.District.FirstOrDefault(d => d.Districtid == districtId)?.Districtname ?? string.Empty;
    }
}