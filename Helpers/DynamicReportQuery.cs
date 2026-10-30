using System.Data;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Npgsql;
using NpgsqlTypes;
using SahayataNidhi.Models.Entities;

namespace SahayataNidhi.Helpers;

/// <summary>
/// Builds and executes dynamic report queries from the `reports` table JSON config.
/// Shared by the Designer (preview) and Officer (run report) controllers.
/// No PostgreSQL function binding — SQL is assembled from the template config
/// with identifier whitelisting and parameterized values.
/// </summary>
public static class DynamicReportQuery
{
    public class Result
    {
        public bool Success { get; set; }
        public string Error { get; set; } = "";
        public int Status { get; set; } = 200;
        public List<object> Data { get; set; } = new();
        public List<object> Columns { get; set; } = new();
        public int TotalRecords { get; set; }
    }

    private static readonly Regex SafeIdentifier = new(@"^[A-Za-z_][A-Za-z0-9_]*$", RegexOptions.Compiled);
    private static readonly Regex SafeJsonPath = new(@"^[A-Za-z_][A-Za-z0-9_]*(\s*->>?\s*'[^']*'|\s*#>>\s*'\{[^}]*\}')*$", RegexOptions.Compiled);
    private static readonly Regex NumericValue = new(@"^-?\d+(\.\d+)?$", RegexOptions.Compiled);

    public static async Task<Result> ExecuteAsync(SwdjkContext dbcontext, Reports template, string? filterJson)
    {
        var result = new Result();
        try
        {
            var tableName = template.Tablename;
            if (string.IsNullOrWhiteSpace(tableName))
            {
                result.Error = "Template has no base table";
                return result;
            }

            // Whitelist: table must exist in the EF model
            var knownTables = dbcontext.Model.GetEntityTypes()
                .Select(t => t.GetTableName())
                .ToList();
            if (!knownTables.Contains(tableName, StringComparer.OrdinalIgnoreCase))
            {
                result.Error = $"Table '{tableName}' is not accessible for reports";
                result.Status = 400;
                return result;
            }

            var columnConfigs = string.IsNullOrEmpty(template.Columns)
                ? new List<JObject>()
                : JsonConvert.DeserializeObject<List<JObject>>(template.Columns)!;
            if (columnConfigs.Count == 0)
            {
                result.Error = "Template has no columns defined";
                result.Status = 400;
                return result;
            }

            var filterConfigs = string.IsNullOrEmpty(template.Filters)
                ? new List<JObject>()
                : JsonConvert.DeserializeObject<List<JObject>>(template.Filters)!;

            var runtimeFilters = new Dictionary<string, string>();
            if (!string.IsNullOrEmpty(filterJson))
            {
                var parsed = JObject.Parse(filterJson);
                foreach (var p in parsed.Properties())
                    runtimeFilters[p.Name] = p.Value?.ToString() ?? "";
            }

            // Column whitelist from the EF model — used to validate both the
            // SELECT list and the WHERE filters so a stale/unknown plain column
            // returns a friendly 400 instead of a raw Postgres "column does not exist".
            var entityType = dbcontext.Model.GetEntityTypes()
                .FirstOrDefault(t => string.Equals(t.GetTableName(), tableName, StringComparison.OrdinalIgnoreCase));
            var tableColumns = entityType?.GetProperties()
                .Select(p => p.GetColumnName())
                .ToHashSet(StringComparer.OrdinalIgnoreCase) ?? new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            // ── SELECT ──
            var selectParts = new List<string>();
            for (int i = 0; i < columnConfigs.Count; i++)
            {
                var col = columnConfigs[i];
                var colName = col.Value<string>("name") ?? col.Value<string>("field");
                var label = col.Value<string>("label") ?? colName;
                var jsonPath = col.Value<string>("jsonPath");
                var format = col.Value<string>("format");

                if (!string.IsNullOrEmpty(jsonPath))
                {
                    var root = Regex.Match(jsonPath, @"^([A-Za-z_][A-Za-z0-9_]*)");
                    if (root.Success == false || !SafeIdentifier.IsMatch(root.Groups[1].Value) || !SafeJsonPath.IsMatch(jsonPath))
                    {
                        result.Error = $"Invalid JSON path for column '{colName}'";
                        result.Status = 400;
                        return result;
                    }
                    selectParts.Add($"{jsonPath} AS \"col_{i}\"");
                }
                else
                {
                    if (colName == null || !SafeIdentifier.IsMatch(colName))
                    {
                        result.Error = $"Invalid column name '{colName}'";
                        result.Status = 400;
                        return result;
                    }
                    if (!tableColumns.Contains(colName))
                    {
                        result.Error = $"Column '{colName}' not found on table '{tableName}'";
                        result.Status = 400;
                        return result;
                    }
                    selectParts.Add($"t.{colName} AS \"col_{i}\"");
                }

                result.Columns.Add(new { accessorKey = $"col_{i}", header = label, format });
            }

            // ── WHERE clause from filter config + runtime values ──
            var whereParts = new List<string>();
            var sqlParams = new List<NpgsqlParameter>();

            int paramIndex = 0;
            foreach (var flt in filterConfigs)
            {
                var field = flt.Value<string>("field");
                var jsonPath = flt.Value<string>("jsonPath");
                var op = (flt.Value<string>("operator") ?? "eq").ToLowerInvariant();
                var defValue = flt.Value<string>("defaultValue");
                var dataType = (flt.Value<string>("dataType") ?? "").ToLowerInvariant();
                bool isDate = dataType == "date";
                // Optional runtime-key override. Needed when two filters share the
                // same column (e.g. a date range: created_at >= from / created_at <= to)
                // so the officer's inputs don't collide. Keyed by the UI as well.
                var paramKey = flt.Value<string>("paramKey");

                // Runtime value (from UI) wins over the template default
                string? rawValue = null;
                if (paramKey != null && runtimeFilters.TryGetValue(paramKey, out var rk)) rawValue = rk;
                else if (field != null && runtimeFilters.TryGetValue(field, out var rv)) rawValue = rv;
                else if (jsonPath != null && runtimeFilters.TryGetValue(jsonPath, out var rv2)) rawValue = rv2;
                else if (!string.IsNullOrEmpty(defValue)) rawValue = defValue;

                if (string.IsNullOrEmpty(rawValue)) continue;

                string expr;
                if (!string.IsNullOrEmpty(jsonPath))
                {
                    var root = Regex.Match(jsonPath, @"^([A-Za-z_][A-Za-z0-9_]*)");
                    if (!root.Success || !SafeIdentifier.IsMatch(root.Groups[1].Value) || !SafeJsonPath.IsMatch(jsonPath))
                    {
                        result.Error = $"Invalid JSON path in filter '{field}'";
                        result.Status = 400;
                        return result;
                    }
                    expr = $"({jsonPath})";
                }
                else
                {
                    if (field == null || !SafeIdentifier.IsMatch(field) || !tableColumns.Contains(field))
                    {
                        result.Error = $"Filter column '{field}' not found on table '{tableName}'";
                        result.Status = 400;
                        return result;
                    }
                    expr = $"t.{field}";
                }

                // For date filters, compare on the date component (works for ISO-8601
                // strings and date columns) so range operators (>= / <=) are date-aware.
                // Empty/blank values are turned into NULL (excluded by the comparison)
                // rather than erroring on an empty-string cast.
                if (isDate) expr = $"(NULLIF(btrim({expr}::text), '')::date)";

                var pName = $"@p{paramIndex++}";
                string opSql;
                switch (op)
                {
                    case "neq": opSql = "<>"; break;
                    case "gt": opSql = ">"; break;
                    case "gte": opSql = ">="; break;
                    case "lt": opSql = "<"; break;
                    case "lte": opSql = "<="; break;
                    case "contains": opSql = "ILIKE"; rawValue = "%" + rawValue + "%"; break;
                    case "starts": opSql = "ILIKE"; rawValue = rawValue + "%"; break;
                    case "ends": opSql = "ILIKE"; rawValue = "%" + rawValue; break;
                    default: opSql = "="; break;
                }
                var pType = isDate ? NpgsqlDbType.Date : NpgsqlDbType.Varchar;
                whereParts.Add($"{expr} {opSql} {pName}");
                sqlParams.Add(new NpgsqlParameter(pName, pType) { Value = rawValue });
            }

            // Fixed service binding: a template bound to a service only ever shows
            // that service's records (applies to Simple-mode reports).
            if (template.ServiceId.HasValue &&
                tableColumns.Contains("serviceid", StringComparer.OrdinalIgnoreCase))
            {
                whereParts.Add("t.serviceid = @svc");
                sqlParams.Add(new NpgsqlParameter("@svc", NpgsqlDbType.Integer) { Value = template.ServiceId.Value });
            }

            // ── Assemble + execute (row cap keeps responses bounded) ──
            var sql = $"SELECT {string.Join(", ", selectParts)} FROM \"{tableName}\" t";
            if (whereParts.Count > 0) sql += " WHERE " + string.Join(" AND ", whereParts);
            sql += " LIMIT 1000";

            var conn = (NpgsqlConnection)dbcontext.Database.GetDbConnection();
            var openedHere = false;
            if (conn.State != ConnectionState.Open) { await conn.OpenAsync(); openedHere = true; }
            try
            {
                using var cmd = conn.CreateCommand();
                cmd.CommandText = sql;
                cmd.CommandTimeout = 120;
                foreach (var p in sqlParams) cmd.Parameters.Add(p);

                using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    var dict = new Dictionary<string, object>();
                    for (int i = 0; i < columnConfigs.Count; i++)
                    {
                        var val = reader.IsDBNull(i) ? null : reader.GetValue(i);
                        dict[$"col_{i}"] = JsonSafe(val);
                    }
                    result.Data.Add(dict);
                }
            }
            finally
            {
                if (openedHere) await conn.CloseAsync();
            }

            result.TotalRecords = result.Data.Count;
            result.Success = true;
            return result;
        }
        catch (Exception ex)
        {
            result.Success = false;
            result.Error = ex.Message;
            result.Status = 500;
            return result;
        }
    }

    /// <summary>Converts a DB value to something System.Text.Json can always serialize.</summary>
    private static object JsonSafe(object? val)
    {
        if (val == null || val is DBNull) return "";
        if (val is string || val is bool || val is int || val is long || val is short
            || val is decimal || val is double || val is float || val is DateTime) return val;
        return val.ToString() ?? "";
    }

    /// <summary>
    /// Returns the distinct values of a single column or JSON path within a table,
    /// optionally scoped to one service. Used to populate filter dropdowns so officers
    /// pick real values (correct case, no typos) instead of typing them.
    /// Field/JSON-path are validated the same way as the report query builder.
    /// </summary>
    public static async Task<List<string>> GetDistinctValuesAsync(
        SwdjkContext dbcontext, int? serviceId, string? field, string? jsonPath,
        string tableName = "citizen_applications")
    {
        var values = new List<string>();

        var knownTables = dbcontext.Model.GetEntityTypes().Select(t => t.GetTableName()).ToList();
        if (!knownTables.Contains(tableName, StringComparer.OrdinalIgnoreCase))
            return values;

        var entityType = dbcontext.Model.GetEntityTypes()
            .FirstOrDefault(t => string.Equals(t.GetTableName(), tableName, StringComparison.OrdinalIgnoreCase));
        var tableColumns = entityType?.GetProperties()
            .Select(p => p.GetColumnName())
            .ToHashSet(StringComparer.OrdinalIgnoreCase) ?? new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        string expr;
        if (!string.IsNullOrEmpty(jsonPath))
        {
            var root = Regex.Match(jsonPath, @"^([A-Za-z_][A-Za-z0-9_]*)");
            if (!root.Success || !SafeIdentifier.IsMatch(root.Groups[1].Value) || !SafeJsonPath.IsMatch(jsonPath))
                return values;
            expr = jsonPath;
        }
        else if (!string.IsNullOrEmpty(field) && SafeIdentifier.IsMatch(field) && tableColumns.Contains(field))
        {
            expr = $"t.{field}";
        }
        else
        {
            return values;
        }

        var sql = $"SELECT DISTINCT {expr} AS v FROM \"{tableName}\" t WHERE {expr} IS NOT NULL AND btrim({expr}::text) <> ''";
        var sqlParams = new List<NpgsqlParameter>();
        if (serviceId.HasValue && tableColumns.Contains("serviceid"))
        {
            sql += " AND t.serviceid = @svc";
            sqlParams.Add(new NpgsqlParameter("@svc", NpgsqlDbType.Integer) { Value = serviceId.Value });
        }
        sql += " ORDER BY v LIMIT 500";

        var conn = (NpgsqlConnection)dbcontext.Database.GetDbConnection();
        var openedHere = false;
        if (conn.State != ConnectionState.Open) { await conn.OpenAsync(); openedHere = true; }
        try
        {
            using var cmd = conn.CreateCommand();
            cmd.CommandText = sql;
            cmd.CommandTimeout = 60;
            foreach (var p in sqlParams) cmd.Parameters.Add(p);
            using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                var v = reader.IsDBNull(0) ? null : reader.GetValue(0)?.ToString();
                if (!string.IsNullOrWhiteSpace(v)) values.Add(v);
            }
        }
        finally
        {
            if (openedHere) await conn.CloseAsync();
        }

        return values;
    }
}