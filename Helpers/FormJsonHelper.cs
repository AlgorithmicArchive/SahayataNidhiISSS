using Newtonsoft.Json.Linq;

/// <summary>
/// Shared JSON traversal utilities for SurveyJS-style form payloads.
/// Consolidates the previously duplicated private copies found in
/// OfficerControllerHelper.cs and UserControllerHelper.cs.
/// </summary>
public static class FormJsonHelper
{
    /// <summary>
    /// Recursively searches a form JSON tree for a JObject whose "name"
    /// property equals <paramref name="fieldName"/>. Returns null if not found.
    /// </summary>
    public static JObject? FindFieldRecursively(JToken token, string fieldName)
    {
        if (token is JObject obj)
        {
            if (obj["name"]?.ToString() == fieldName) return obj;
            foreach (var prop in obj.Properties())
                if (FindFieldRecursively(prop.Value, fieldName) is JObject found)
                    return found;
        }
        else if (token is JArray arr)
        {
            foreach (var el in arr)
                if (FindFieldRecursively(el, fieldName) is JObject found)
                    return found;
        }
        return null;
    }
}
