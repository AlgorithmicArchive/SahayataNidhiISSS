using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore;

namespace SahayataNidhi.Models.Entities;

public partial class SwdjkContext : DbContext
{
    public SwdjkContext(System.Data.Common.DbConnection dbConnection)
    {
    }

    public SwdjkContext(DbContextOptions<SwdjkContext> options)
        : base(options)
    {
    }

    public virtual DbSet<ActionHistory> ActionHistories { get; set; }
    public virtual DbSet<ApplicationPerDistrict> ApplicationPerDistricts { get; set; }
    public virtual DbSet<ApplicationsWithExpiringEligibility> ApplicationsWithExpiringEligibilities { get; set; }
    public virtual DbSet<AuditLogs> AuditLogs { get; set; }
    public virtual DbSet<Bank> Banks { get; set; }
    public virtual DbSet<Bankdetails> BankDetails { get; set; }
    public virtual DbSet<Blocks> Blocks { get; set; }
    public virtual DbSet<Certificates> Certificates { get; set; }
    public virtual DbSet<CitizenApplication> CitizenApplications { get; set; }
    public virtual DbSet<Corrigendum> Corrigendums { get; set; }
    public virtual DbSet<Departments> Departments { get; set; }
    public virtual DbSet<District> Districts { get; set; }
    public virtual DbSet<Emailsettings> EmailSettings { get; set; }
    public virtual DbSet<Feedback> Feedbacks { get; set; }
    public virtual DbSet<Halqapanchayat> HalqaPanchayats { get; set; }
    public virtual DbSet<Muncipalities> Muncipalities { get; set; }
    public virtual DbSet<Muncipalitytypes> MuncipalityTypes { get; set; }
    public virtual DbSet<Officersdesignations> OfficersDesignations { get; set; }
    public virtual DbSet<Offices> Offices { get; set; }
    public virtual DbSet<Officesdetails> OfficesDetails { get; set; }
    public virtual DbSet<PensionPayment> PensionPayments { get; set; }
    public virtual DbSet<Pool> Pools { get; set; }
    public virtual DbSet<ScheduledJobs> ScheduledJobs { get; set; }
    public virtual DbSet<Service> Services { get; set; }
    public virtual DbSet<Tehsil> Tehsils { get; set; }
    public virtual DbSet<Tswotehsil> TswoTehsils { get; set; }
    public virtual DbSet<UserDocument> UserDocuments { get; set; }
    public virtual DbSet<Users> Users { get; set; }
    public virtual DbSet<UserSession> UserSessions { get; set; }
    public virtual DbSet<Villages> Villages { get; set; }
    public virtual DbSet<Wards> Wards { get; set; }
    public virtual DbSet<WebService> WebServices { get; set; }
    public virtual DbSet<WithheldApplications> WithheldApplications { get; set; }

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
        => optionsBuilder.UseNpgsql("Name=DefaultConnection");

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder
            .HasPostgresExtension("pgcrypto")
            .HasPostgresExtension("uuid-ossp");

        modelBuilder.Entity<ActionHistory>(entity =>
        {
            entity.HasKey(e => e.HistoryId).HasName("ActionHistory_PK");
            entity.ToTable("actionhistory");
            entity.Property(e => e.HistoryId).HasColumnName("history_id");
            entity.Property(e => e.ActionTaken)
                .HasMaxLength(100)
                .HasColumnName("actiontaken");
            entity.Property(e => e.ActionTakenDate)
                .HasMaxLength(50)
                .HasColumnName("actiontakendate");
            entity.Property(e => e.ActionTaker)
                .HasMaxLength(255)
                .HasColumnName("actiontaker");
            entity.Property(e => e.LocationLevel)
                .HasMaxLength(100)
                .HasColumnName("locationlevel");
            entity.Property(e => e.LocationValue).HasColumnName("locationvalue");
            entity.Property(e => e.ReferenceNumber)
                .HasMaxLength(30)
                .HasColumnName("referencenumber");
            entity.Property(e => e.Remarks)
                .HasMaxLength(255)
                .HasColumnName("remarks");
        });

        modelBuilder.Entity<ApplicationPerDistrict>(entity =>
        {
            entity.HasKey(e => e.Uuid).HasName("ApplicationPerDistrict_PK");
            entity.ToTable("applicationperdistrict");
            entity.Property(e => e.Uuid).HasColumnName("uuid");
            entity.Property(e => e.CountValue).HasColumnName("countvalue");
            entity.Property(e => e.DistrictId).HasColumnName("districtid");
            entity.Property(e => e.FinancialYear)
                .HasMaxLength(50)
                .HasColumnName("financialyear");
            entity.Property(e => e.ServiceId).HasColumnName("serviceid");
            entity.Property(e => e.Type).HasMaxLength(30).HasColumnName("Type");
        });

        modelBuilder.Entity<ApplicationsWithExpiringEligibility>(entity =>
        {
            entity.HasKey(e => e.ExpiringId).HasName("ApplicationsWithExpiringEligibility_PK");
            entity.ToTable("applicationswithexpiringeligibility");
            entity.Property(e => e.ExpiringId).HasColumnName("expiring_id");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("CURRENT_DATE")
                .HasColumnName("created_at");
            entity.Property(e => e.ExpirationDate)
                .HasMaxLength(100)
                .HasColumnName("expiration_date");
            entity.Property(e => e.MailSent)
                .HasDefaultValue(0)
                .HasColumnName("mail_sent");
            entity.Property(e => e.ReferenceNumber)
                .HasMaxLength(50)
                .HasColumnName("referencenumber");
            entity.Property(e => e.ServiceId).HasColumnName("serviceid");
        });

        modelBuilder.Entity<AuditLogs>(entity =>
        {
            entity.HasKey(e => e.LogId).HasName("AuditLogs_PK");
            entity.ToTable("auditlogs");
            entity.Property(e => e.LogId).HasColumnName("logid");
            entity.Property(e => e.Action).HasMaxLength(100).HasColumnName("action");
            entity.Property(e => e.AdditionalData)
                .HasColumnType("jsonb")
                .HasColumnName("additionaldata");
            entity.Property(e => e.Browser)
                .HasMaxLength(100)
                .HasColumnName("browser");
            entity.Property(e => e.Description).HasColumnName("description");
            entity.Property(e => e.Device)
                .HasMaxLength(100)
                .HasColumnName("device");
            entity.Property(e => e.IpAddress)
                .HasMaxLength(45)
                .HasColumnName("ipaddress");
            entity.Property(e => e.OperatingSystem)
                .HasMaxLength(100)
                .HasColumnName("operatingsystem");
            entity.Property(e => e.Status)
                .HasMaxLength(20)
                .HasColumnName("status");
            entity.Property(e => e.Timestamp)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("timestamp without time zone")
                .HasColumnName("timestamp");
            entity.Property(e => e.UserId).HasColumnName("userid");
            entity.HasOne(d => d.User).WithMany(p => p.AuditLogs)
                .HasForeignKey(d => d.UserId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("fk_auditlogs_users");
        });

        modelBuilder.Entity<Bank>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("Bank_PK");
            entity.ToTable("bank");
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.BankCode)
                .HasMaxLength(5)
                .HasColumnName("bankcode");
            entity.Property(e => e.BankName)
                .HasMaxLength(255)
                .HasColumnName("bankname");
        });

        modelBuilder.Entity<Bankdetails>(entity =>
        {
            entity
                .HasNoKey()
                .ToTable("bankdetails");
            entity.Property(e => e.Address)
                .HasMaxLength(255)
                .HasColumnName("address");
            entity.Property(e => e.Bank)
                .HasMaxLength(255)
                .HasColumnName("bank");
            entity.Property(e => e.Branch)
                .HasMaxLength(255)
                .HasColumnName("branch");
            entity.Property(e => e.City1)
                .HasMaxLength(255)
                .HasColumnName("city1");
            entity.Property(e => e.City2)
                .HasMaxLength(255)
                .HasColumnName("city2");
            entity.Property(e => e.Ifsc)
                .HasMaxLength(255)
                .HasColumnName("ifsc");
            entity.Property(e => e.Phone)
                .HasMaxLength(255)
                .HasColumnName("phone");
            entity.Property(e => e.State)
                .HasMaxLength(255)
                .HasColumnName("state");
            entity.Property(e => e.StdCode)
                .HasMaxLength(255)
                .HasColumnName("STD CODE");
        });

        modelBuilder.Entity<Blocks>(entity =>
        {
            entity.HasKey(e => e.Uuid).HasName("Blocks_PK");
            entity.ToTable("blocks");
            entity.Property(e => e.Uuid).HasColumnName("uuid");
            entity.Property(e => e.BlockId).HasColumnName("blockid");
            entity.Property(e => e.BlockName)
                .HasMaxLength(255)
                .HasColumnName("blockname");
            entity.Property(e => e.DistrictId).HasColumnName("districtid");
        });

        modelBuilder.Entity<Certificates>(entity =>
        {
            entity.HasKey(e => e.Uuid).HasName("Certificates_PK");
            entity.ToTable("certificates");
            entity.Property(e => e.Uuid).HasColumnName("uuid");
            entity.Property(e => e.CertifiyingAuthority).HasColumnName("certifiyingauthority");
            entity.Property(e => e.ExpirationDate)
                .HasColumnType("timestamp without time zone")
                .HasColumnName("expirationdate");
            entity.Property(e => e.OfficerId).HasColumnName("officerid");
            entity.Property(e => e.RegisteredDate)
                .HasMaxLength(50)
                .HasColumnName("registereddate");
            entity.Property(e => e.SerialNumber).HasColumnName("serialnumber");
        });

        modelBuilder.Entity<CitizenApplication>(entity =>
        {
            entity.HasKey(e => e.ReferenceNumber).HasName("CitizenApplications_PK");
            entity.ToTable("citizen_applications");
            entity.HasIndex(e => e.ServiceId, "IX_CitizenApplications_ServiceId");
            entity.Property(e => e.ReferenceNumber)
                .HasMaxLength(50)
                .HasColumnName("referencenumber");
            entity.Property(e => e.AdditionalDetails)
                .HasColumnType("jsonb")
                .HasColumnName("additionaldetails");
            entity.Property(e => e.ApplicationId).HasColumnName("appl_id");
            entity.Property(e => e.CitizenId).HasColumnName("citizen_id");
            entity.Property(e => e.CreatedAt)
                .HasMaxLength(50)
                .HasColumnName("created_at");
            entity.Property(e => e.CurrentPlayer).HasColumnName("currentplayer");
            entity.Property(e => e.DataType)
                .HasMaxLength(20)
                .HasColumnName("datatype");
            entity.Property(e => e.DistrictUidForBank)
                .HasMaxLength(6)
                .HasColumnName("districtuidforbank");
            entity.Property(e => e.FormDetails)
                .HasColumnType("jsonb")
                .HasColumnName("formdetails");
            entity.Property(e => e.ReferenceNumberAlphanumeric)
                .HasMaxLength(50)
                .HasColumnName("referencenumberalphanumeric");
            entity.Property(e => e.ServiceId).HasColumnName("serviceid");
            entity.Property(e => e.Status).HasColumnName("status");
            entity.Property(e => e.WorkFlow)
                .HasColumnType("jsonb")
                .HasColumnName("workflow");
        });

        modelBuilder.Entity<Corrigendum>(entity =>
        {
            entity.HasKey(e => e.CorrigendumId).HasName("Corrigendums_PK");
            entity.ToTable("corrigendum");
            entity.HasIndex(e => new { e.ReferenceNumber, e.Type, e.Status }, "IX_Corrigendum_ReferenceNumber_Type_Status");
            entity.Property(e => e.CorrigendumId)
                .HasMaxLength(60)
                .HasColumnName("corrigendumid");
            entity.Property(e => e.CorrigendumFields)
                .HasColumnType("jsonb")
                .HasColumnName("corrigendumfields");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("timestamp without time zone")
                .HasColumnName("createdat");
            entity.Property(e => e.CurrentPlayer).HasColumnName("currentplayer");
            entity.Property(e => e.History)
                .HasColumnType("jsonb")
                .HasColumnName("history");
            entity.Property(e => e.Location)
                .HasColumnType("jsonb")
                .HasColumnName("location");
            entity.Property(e => e.ReferenceNumber)
                .HasMaxLength(50)
                .HasColumnName("referencenumber");
            entity.Property(e => e.Status)
                .HasMaxLength(20)
                .HasColumnName("status");
            entity.Property(e => e.Type)
                .HasMaxLength(50)
                .HasColumnName("type");
            entity.Property(e => e.WorkFlow)
                .HasColumnType("jsonb")
                .HasColumnName("workflow");
            entity.HasOne(d => d.ReferenceNumberNavigation).WithMany(p => p.Corrigendums)
                .HasForeignKey(d => d.ReferenceNumber)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("fk_corrigendum_citizen_applications");
        });

        modelBuilder.Entity<Departments>(entity =>
        {
            entity.HasKey(e => e.DepartmentId).HasName("Departments_PK");
            entity.ToTable("departments");
            entity.Property(e => e.DepartmentId).HasColumnName("departmentid");
            entity.Property(e => e.DepartmentName).HasColumnName("departmentname");
        });

        modelBuilder.Entity<District>(entity =>
        {
            entity.HasKey(e => e.DistrictId).HasName("Districts_PK");
            entity.ToTable("district");
            entity.Property(e => e.DistrictId)
                .ValueGeneratedNever()
                .HasColumnName("districtid");
            entity.Property(e => e.DistrictName)
                .HasMaxLength(255)
                .HasColumnName("districtname");
            entity.Property(e => e.DistrictShort)
                .HasMaxLength(50)
                .HasColumnName("districtshort");
            entity.Property(e => e.Division).HasColumnName("division");
            entity.Property(e => e.Uuid).HasColumnName("uuid");
        });

        modelBuilder.Entity<Emailsettings>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("EmailSettings_PK");
            entity.ToTable("emailsettings");
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.Password).HasColumnName("password");
            entity.Property(e => e.SenderEmail)
                .HasMaxLength(255)
                .HasColumnName("senderemail");
            entity.Property(e => e.SenderName)
                .HasMaxLength(255)
                .HasColumnName("sendername");
            entity.Property(e => e.SmtpPort).HasColumnName("smtpport");
            entity.Property(e => e.SmtpServer)
                .HasMaxLength(255)
                .HasColumnName("smtpserver");
            entity.Property(e => e.Templates)
                .HasColumnType("jsonb")
                .HasColumnName("templates");
        });

        modelBuilder.Entity<Feedback>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("Feedbacks_PK");
            entity.ToTable("feedback");
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.CreatedOn)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("timestamp without time zone")
                .HasColumnName("createdon");
            entity.Property(e => e.Description).HasColumnName("description");
            entity.Property(e => e.Files)
                .HasColumnType("jsonb")
                .HasColumnName("files");
            entity.Property(e => e.Status)
                .HasMaxLength(50)
                .HasDefaultValueSql("'Pending'::character varying")
                .HasColumnName("status");
            entity.Property(e => e.Title)
                .HasMaxLength(255)
                .HasColumnName("title");
            entity.Property(e => e.UserId).HasColumnName("userid");
        });

        modelBuilder.Entity<Halqapanchayat>(entity =>
        {
            entity.HasKey(e => e.Uuid).HasName("HalqaPanchayats_PK");
            entity.ToTable("halqapanchayat");
            entity.Property(e => e.Uuid).HasColumnName("uuid");
            entity.Property(e => e.BlockId).HasColumnName("blockid");
            entity.Property(e => e.HalqaPanchayatId).HasColumnName("halqapanchayatid");
            entity.Property(e => e.HalqaPanchayatName)
                .HasMaxLength(255)
                .HasColumnName("halqapanchayatname");
        });

        modelBuilder.Entity<Muncipalities>(entity =>
        {
            entity.HasKey(e => e.Uuid).HasName("Muncipalities_PK");
            entity.ToTable("muncipalities");
            entity.Property(e => e.Uuid).HasColumnName("uuid");
            entity.Property(e => e.DistrictId).HasColumnName("districtid");
            entity.Property(e => e.MuncipalityId).HasColumnName("muncipalityid");
            entity.Property(e => e.MuncipalityName)
                .HasMaxLength(255)
                .HasColumnName("muncipalityname");
            entity.Property(e => e.MuncipalityType).HasColumnName("muncipalitytype");
        });

        modelBuilder.Entity<Muncipalitytypes>(entity =>
        {
            entity.HasKey(e => e.Uuid).HasName("MuncipalityTypes_PK");
            entity.ToTable("muncipalitytypes");
            entity.Property(e => e.Uuid).HasColumnName("uuid");
            entity.Property(e => e.TypeCode).HasColumnName("typecode");
            entity.Property(e => e.TypeName)
                .HasMaxLength(255)
                .HasColumnName("typename");
        });

        modelBuilder.Entity<Officersdesignations>(entity =>
        {
            entity.HasKey(e => e.Uuid).HasName("OfficersDesignations_PK");
            entity.ToTable("officersdesignations");
            entity.Property(e => e.Uuid).HasColumnName("uuid");
            entity.Property(e => e.AccessLevel)
                .HasMaxLength(100)
                .HasColumnName("accesslevel");
            entity.Property(e => e.DepartmentId).HasColumnName("departmentid");
            entity.Property(e => e.Designation).HasColumnName("designation");
            entity.Property(e => e.DesignationShort)
                .HasMaxLength(100)
                .HasColumnName("designationshort");
        });

        modelBuilder.Entity<Offices>(entity =>
        {
            entity.HasKey(e => e.OfficeId).HasName("Offices_PK");
            entity.ToTable("offices");
            entity.Property(e => e.OfficeId).HasColumnName("officeid");
            entity.Property(e => e.AccessLevel)
                .HasMaxLength(50)
                .HasColumnName("accesslevel");
            entity.Property(e => e.DepartmentId).HasColumnName("departmentid");
            entity.Property(e => e.OfficeType)
                .HasMaxLength(50)
                .HasColumnName("officetype");
        });

        modelBuilder.Entity<Officesdetails>(entity =>
        {
            entity
                .HasNoKey()
                .ToTable("officesdetails");
            entity.Property(e => e.AreaCode).HasColumnName("areacode");
            entity.Property(e => e.AreaName)
                .HasMaxLength(50)
                .HasColumnName("areaname");
            entity.Property(e => e.DistrictCode).HasColumnName("districtcode");
            entity.Property(e => e.DivisionCode).HasColumnName("divisioncode");
            entity.Property(e => e.OfficeName)
                .HasMaxLength(255)
                .HasColumnName("officename");
            entity.Property(e => e.OfficeType).HasColumnName("officetype");
            entity.Property(e => e.StateCode)
                .HasDefaultValue(0)
                .HasColumnName("statecode");
            entity.HasOne(d => d.OfficetypeNavigation).WithMany()
                .HasForeignKey(d => d.OfficeType)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("fk_officesdetails_offices");
        });

        modelBuilder.Entity<PensionPayment>(entity =>
        {
            entity
                .HasNoKey()
                .ToTable("pensionpayments");
            entity.Property(e => e.BankResBankDateExecuted)
                .HasMaxLength(255)
                .HasColumnName("bankres_bankdateexecuted");
            entity.Property(e => e.BankResPensionerCategory)
                .HasMaxLength(255)
                .HasColumnName("bankres_pensionercategory");
            entity.Property(e => e.BankResStatusFromBank)
                .HasMaxLength(255)
                .HasColumnName("bankres_statusfrombank");
            entity.Property(e => e.BankResTransactionId)
                .HasMaxLength(255)
                .HasColumnName("bankres_transactionid");
            entity.Property(e => e.BankResTransactionStatus)
                .HasMaxLength(255)
                .HasColumnName("bankres_transactionstatus");
            entity.Property(e => e.DistrictBankUid)
                .HasMaxLength(255)
                .HasColumnName("districtbankuid");
            entity.Property(e => e.DistrictId)
                .HasMaxLength(255)
                .HasColumnName("districtid");
            entity.Property(e => e.DistrictName)
                .HasMaxLength(255)
                .HasColumnName("districtname");
            entity.Property(e => e.DivisionCode)
                .HasMaxLength(255)
                .HasColumnName("divisioncode");
            entity.Property(e => e.DivisionName)
                .HasMaxLength(255)
                .HasColumnName("divisionname");
            entity.Property(e => e.PayingDepartment)
                .HasMaxLength(255)
                .HasColumnName("payingdepartment");
            entity.Property(e => e.PayingDeptAccountNumber)
                .HasMaxLength(255)
                .HasColumnName("payingdeptaccountnumber");
            entity.Property(e => e.PayingDeptBankName)
                .HasMaxLength(255)
                .HasColumnName("payingdeptbankname");
            entity.Property(e => e.PayingDeptIfscCode)
                .HasMaxLength(255)
                .HasColumnName("payingdeptifsccode");
            entity.Property(e => e.PaymentFileGenerationDate)
                .HasMaxLength(255)
                .HasColumnName("paymentfilegenerationdate");
            entity.Property(e => e.PaymentOfMonth)
                .HasMaxLength(255)
                .HasColumnName("paymentofmonth");
            entity.Property(e => e.PaymentOfYear)
                .HasMaxLength(255)
                .HasColumnName("paymentofyear");
            entity.Property(e => e.PensionAmount)
                .HasMaxLength(255)
                .HasColumnName("pensionamount");
            entity.Property(e => e.PensionerAccountNo)
                .HasMaxLength(255)
                .HasColumnName("pensioneraccountno");
            entity.Property(e => e.PensionerIfscCode)
                .HasMaxLength(255)
                .HasColumnName("pensionerifsccode");
            entity.Property(e => e.PensionerName)
                .HasMaxLength(255)
                .HasColumnName("pensionername");
            entity.Property(e => e.PensionerType)
                .HasMaxLength(255)
                .HasColumnName("pensionertype");
            entity.Property(e => e.ReferenceNumber)
                .HasMaxLength(255)
                .HasColumnName("referencenumber");
            entity.Property(e => e.StateCode)
                .HasMaxLength(255)
                .HasColumnName("statecode");
            entity.Property(e => e.StateName)
                .HasMaxLength(255)
                .HasColumnName("statename");
        });

        modelBuilder.Entity<Pool>(entity =>
        {
            entity.HasKey(e => e.PoolId).HasName("Pools_PK");
            entity.ToTable("pool");
            entity.HasIndex(e => e.ServiceId, "IX_Pool_ServiceId");
            entity.Property(e => e.PoolId).HasColumnName("poolid");
            entity.Property(e => e.AccessCode).HasColumnName("accesscode");
            entity.Property(e => e.AccessLevel)
                .HasMaxLength(255)
                .HasColumnName("accesslevel");
            entity.Property(e => e.List)
                .HasColumnType("jsonb")
                .HasColumnName("list");
            entity.Property(e => e.ListType)
                .HasMaxLength(20)
                .HasColumnName("listtype");
            entity.Property(e => e.ServiceId).HasColumnName("serviceid");
            entity.HasOne(d => d.Service).WithMany(p => p.Pools)
                .HasForeignKey(d => d.ServiceId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("fk_pool_services");
        });

        modelBuilder.Entity<ScheduledJobs>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("ScheduledJobs_PK");
            entity.ToTable("scheduledjobs");
            entity.Property(e => e.Id)
                .HasDefaultValueSql("uuid_generate_v4()")
                .HasColumnName("id");
            entity.Property(e => e.ActionType)
                .HasMaxLength(100)
                .HasColumnName("actiontype");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("timestamp without time zone")
                .HasColumnName("createdat");
            entity.Property(e => e.CronExpression)
                .HasMaxLength(100)
                .HasColumnName("cronexpression");
            entity.Property(e => e.JsonParameters)
                .HasColumnType("jsonb")
                .HasColumnName("jsonparameters");
            entity.Property(e => e.LastExecutedAt)
                .HasColumnType("timestamp without time zone")
                .HasColumnName("lastexecutedat");
        });

        modelBuilder.Entity<Service>(entity =>
        {
            entity.HasKey(e => e.ServiceId).HasName("Services_PK");
            entity.ToTable("services");
            entity.Property(e => e.ServiceId).HasColumnName("serviceid");
            entity.Property(e => e.Active)
                .HasDefaultValue(false)
                .HasColumnName("active");
            entity.Property(e => e.ActiveForOfficers)
                .HasDefaultValue(true)
                .HasColumnName("activeforofficers");
            entity.Property(e => e.ApprovalListEnabled).HasColumnName("approvallistenabled");
            entity.Property(e => e.BankDetails)
                .HasColumnType("jsonb")
                .HasColumnName("bankdetails");
            entity.Property(e => e.CreatedAt)
                .HasMaxLength(50)
                .HasColumnName("createdat");
            entity.Property(e => e.DepartmentId).HasColumnName("departmentid");
            entity.Property(e => e.DocumentFields)
                .HasDefaultValueSql("'\"\"'::jsonb")
                .HasColumnType("jsonb")
                .HasColumnName("documentfields");
            entity.Property(e => e.FormElement)
                .HasColumnType("jsonb")
                .HasColumnName("formelement");
            entity.Property(e => e.Letters)
                .HasColumnType("jsonb")
                .HasColumnName("letters");
            entity.Property(e => e.NameShort)
                .HasMaxLength(50)
                .HasColumnName("nameshort");
            entity.Property(e => e.OfficerEditableField)
                .HasColumnType("jsonb")
                .HasColumnName("officereditablefield");
            entity.Property(e => e.PrivateFields)
                .HasColumnType("jsonb")
                .HasColumnName("privatefields");
            entity.Property(e => e.ServiceName)
                .HasMaxLength(255)
                .HasColumnName("servicename");
            entity.Property(e => e.SubmissionLimitConfig)
                .HasDefaultValueSql("'{\"isLimited\": false, \"limitType\": \"\", \"limitCount\": 0}'::jsonb")
                .HasColumnType("jsonb")
                .HasColumnName("submissionlimitconfig");
        });

        modelBuilder.Entity<Tehsil>(entity =>
        {
            entity.HasKey(e => new { e.TehsilId, e.Uuid }).HasName("Tehsils_PK");
            entity.ToTable("tehsil");
            entity.Property(e => e.TehsilId).HasColumnName("tehsilid");
            entity.Property(e => e.Uuid)
                .ValueGeneratedOnAdd()
                .HasColumnName("uuid");
            entity.Property(e => e.DistrictId).HasColumnName("districtid");
            entity.Property(e => e.IsTswo)
                .HasDefaultValue(false)
                .HasColumnName("istswo");
            entity.Property(e => e.TehsilName)
                .HasMaxLength(255)
                .HasColumnName("tehsilname");
        });

        modelBuilder.Entity<Tswotehsil>(entity =>
        {
            entity
                .HasNoKey()
                .ToTable("tswotehsil");
            entity.Property(e => e.DistrictId).HasColumnName("districtid");
            entity.Property(e => e.DivisionCode).HasColumnName("divisioncode");
            entity.Property(e => e.TehsilId).HasColumnName("tehsilid");
            entity.Property(e => e.TehsilName)
                .HasMaxLength(50)
                .HasColumnName("tehsilname");
            entity.Property(e => e.TswoOfficeName)
                .HasMaxLength(50)
                .HasColumnName("tswoofficename");
        });

        modelBuilder.Entity<UserDocument>(entity =>
        {
            entity.HasKey(e => e.FileId).HasName("UserDocuments_PK");
            entity.ToTable("userdocuments");
            entity.Property(e => e.FileId).HasColumnName("fileid");
            entity.Property(e => e.DocumentType)
                .HasMaxLength(50)
                .HasColumnName("documenttype");
            entity.Property(e => e.FileData).HasColumnName("filedata");
            entity.Property(e => e.FileName)
                .HasMaxLength(255)
                .HasColumnName("filename");
            entity.Property(e => e.FileSize).HasColumnName("filesize");
            entity.Property(e => e.FileType)
                .HasMaxLength(50)
                .HasColumnName("filetype");
            entity.Property(e => e.UpdatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("timestamp without time zone")
                .HasColumnName("updatedat");
        });

        modelBuilder.Entity<Users>(entity =>
        {
            entity.HasKey(e => e.UserId).HasName("Users_PK");
            entity.ToTable("users");
            entity.Property(e => e.UserId).HasColumnName("userid");
            entity.Property(e => e.AdditionalDetails)
                .HasColumnType("jsonb")
                .HasColumnName("additionaldetails");
            entity.Property(e => e.BackupCodes)
                .HasColumnType("jsonb")
                .HasColumnName("backupcodes");
            entity.Property(e => e.Email)
                .HasMaxLength(100)
                .HasColumnName("email");
            entity.Property(e => e.IsEmailValid)
                .HasDefaultValue(false)
                .HasColumnName("isemailvalid");
            entity.Property(e => e.MobileNumber)
                .HasMaxLength(20)
                .HasColumnName("mobilenumber");
            entity.Property(e => e.Name)
                .HasMaxLength(255)
                .HasColumnName("name");
            entity.Property(e => e.Password).HasColumnName("password");
            entity.Property(e => e.Profile)
                .HasMaxLength(100)
                .HasColumnName("profile");
            entity.Property(e => e.RegisteredDate)
                .HasMaxLength(120)
                .HasColumnName("registereddate");
            entity.Property(e => e.Username)
                .HasMaxLength(100)
                .HasColumnName("username");
            entity.Property(e => e.UserType)
                .HasMaxLength(30)
                .HasColumnName("usertype");
        });

        modelBuilder.Entity<UserSession>(entity =>
        {
            entity.HasKey(e => e.SessionId).HasName("UserSessions_PK");
            entity.ToTable("usersessions");
            entity.Property(e => e.SessionId)
                .ValueGeneratedNever()
                .HasColumnName("sessionid");
            entity.Property(e => e.JwtToken).HasColumnName("jwttoken");
            entity.Property(e => e.LastActivityTime)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("timestamp without time zone")
                .HasColumnName("lastactivitytime");
            entity.Property(e => e.LoginTime)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("timestamp without time zone")
                .HasColumnName("logintime");
            entity.Property(e => e.UserId).HasColumnName("userid");
        });

        modelBuilder.Entity<Villages>(entity =>
        {
            entity.HasKey(e => e.Uuid).HasName("Villages_PK");
            entity.ToTable("villages");
            entity.Property(e => e.Uuid).HasColumnName("uuid");
            entity.Property(e => e.HalqapanchayatId).HasColumnName("halqapanchayatid");
            entity.Property(e => e.VillageId).HasColumnName("villageid");
            entity.Property(e => e.VillageName)
                .HasMaxLength(255)
                .HasColumnName("villagename");
        });

        modelBuilder.Entity<Wards>(entity =>
        {
            entity.HasKey(e => e.Uuid).HasName("Wards_PK");
            entity.ToTable("wards");
            entity.Property(e => e.Uuid).HasColumnName("uuid");
            entity.Property(e => e.MuncipalityId).HasColumnName("muncipalityid");
            entity.Property(e => e.WardCode).HasColumnName("wardcode");
            entity.Property(e => e.WardNo).HasColumnName("wardno");
        });

        modelBuilder.Entity<WebService>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("WebServices_PK");
            entity.ToTable("webservice");
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.ApiEndpoint)
                .HasColumnType("jsonb")
                .HasColumnName("apiendpoint");
            entity.Property(e => e.CreatedAt)
                .HasMaxLength(100)
                .HasColumnName("createdat");
            entity.Property(e => e.FieldMappings)
                .HasColumnType("jsonb")
                .HasColumnName("fieldmappings");
            entity.Property(e => e.IsActive)
                .HasDefaultValue(false)
                .HasColumnName("isactive");
            entity.Property(e => e.OnAction)
                .HasColumnType("jsonb")
                .HasColumnName("onaction");
            entity.Property(e => e.ServiceId).HasColumnName("serviceid");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(100)
                .HasColumnName("updatedat");
            entity.Property(e => e.WebServiceName)
                .HasMaxLength(255)
                .HasColumnName("webservicename");
            entity.HasOne(d => d.Service).WithMany(p => p.WebServices)
                .HasForeignKey(d => d.ServiceId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("fk_webservice_services");
        });

        modelBuilder.Entity<WithheldApplications>(entity =>
        {
            entity.HasKey(e => e.WithheldId).HasName("WithheldApplications_PK");
            entity.ToTable("withheld_applications");
            entity.HasIndex(e => new { e.ServiceId, e.IsWithheld }, "IX_WithheldApplications_ServiceId_IsWithheld");
            entity.Property(e => e.WithheldId).HasColumnName("withheld_id");
            entity.Property(e => e.CurrentPlayer).HasColumnName("currentplayer");
            entity.Property(e => e.Files)
                .HasColumnType("jsonb")
                .HasColumnName("files");
            entity.Property(e => e.History)
                .HasColumnType("jsonb")
                .HasColumnName("history");
            entity.Property(e => e.IsWithheld)
                .HasDefaultValue(false)
                .HasColumnName("iswithheld");
            entity.Property(e => e.Location)
                .HasColumnType("jsonb")
                .HasColumnName("location");
            entity.Property(e => e.ReferenceNumber)
                .HasMaxLength(50)
                .HasColumnName("referencenumber");
            entity.Property(e => e.ServiceId).HasColumnName("serviceid");
            entity.Property(e => e.Status)
                .HasMaxLength(50)
                .HasColumnName("status");
            entity.Property(e => e.WithheldOn)
                .HasDefaultValueSql("CURRENT_DATE")
                .HasColumnName("withheldon");
            entity.Property(e => e.WithheldReason).HasColumnName("withheldreason");
            entity.Property(e => e.WithheldType)
                .HasMaxLength(20)
                .HasColumnName("withheldtype");
            entity.Property(e => e.WorkFlow)
                .HasColumnType("jsonb")
                .HasColumnName("workflow");
        });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}