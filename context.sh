# SQL Server
dotnet ef dbcontext scaffold "Name=DefaultConnection" Microsoft.EntityFrameworkCore.SqlServer -o Models/Entities --force --no-pluralize

# Postgres
dotnet ef dbcontext scaffold "Name=DefaultConnection" Npgsql.EntityFrameworkCore.PostgreSQL -o Models/Entities --force --no-pluralize