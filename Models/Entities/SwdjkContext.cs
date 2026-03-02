using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore;

namespace SahayataNidhi.Models.Entities;

public partial class SwdjkContext : DbContext
{
    public SwdjkContext()
    {
    }

    public SwdjkContext(DbContextOptions<SwdjkContext> options)
        : base(options)
    {
    }

    public virtual DbSet<Actionhistory> Actionhistory { get; set; }

    public virtual DbSet<Applicationperdistrict> Applicationperdistrict { get; set; }

    public virtual DbSet<Applicationswithexpiringeligibility> Applicationswithexpiringeligibility { get; set; }

    public virtual DbSet<Auditlogs> Auditlogs { get; set; }

    public virtual DbSet<Bank> Bank { get; set; }

    public virtual DbSet<Bankdetails> Bankdetails { get; set; }

    public virtual DbSet<Blocks> Blocks { get; set; }

    public virtual DbSet<Certificates> Certificates { get; set; }

    public virtual DbSet<CitizenApplications> CitizenApplications { get; set; }

    public virtual DbSet<Corrigendum> Corrigendum { get; set; }

    public virtual DbSet<Departments> Departments { get; set; }

    public virtual DbSet<District> District { get; set; }

    public virtual DbSet<Emailsettings> Emailsettings { get; set; }

    public virtual DbSet<Feedback> Feedback { get; set; }

    public virtual DbSet<Halqapanchayat> Halqapanchayat { get; set; }

    public virtual DbSet<MainApplicationStatusSnapshot> MainApplicationStatusSnapshot { get; set; }

    public virtual DbSet<Muncipalities> Muncipalities { get; set; }

    public virtual DbSet<Muncipalitytypes> Muncipalitytypes { get; set; }

    public virtual DbSet<Officersdesignations> Officersdesignations { get; set; }

    public virtual DbSet<Offices> Offices { get; set; }

    public virtual DbSet<Officesdetails> Officesdetails { get; set; }

    public virtual DbSet<Pensionpayments> Pensionpayments { get; set; }

    public virtual DbSet<Pool> Pool { get; set; }

    public virtual DbSet<Scheduledjobs> Scheduledjobs { get; set; }

    public virtual DbSet<Services> Services { get; set; }

    public virtual DbSet<StatusCountsSnapshot> StatusCountsSnapshot { get; set; }

    public virtual DbSet<Tehsil> Tehsil { get; set; }

    public virtual DbSet<Tswotehsil> Tswotehsil { get; set; }

    public virtual DbSet<Userdocuments> Userdocuments { get; set; }

    public virtual DbSet<Users> Users { get; set; }

    public virtual DbSet<Usersessions> Usersessions { get; set; }

    public virtual DbSet<Villages> Villages { get; set; }

    public virtual DbSet<Wards> Wards { get; set; }

    public virtual DbSet<Webservice> Webservice { get; set; }

    public virtual DbSet<WithheldApplications> WithheldApplications { get; set; }

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
        => optionsBuilder.UseNpgsql("Name=DefaultConnection");

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder
            .HasPostgresExtension("pgcrypto")
            .HasPostgresExtension("uuid-ossp");

        modelBuilder.Entity<Actionhistory>(entity =>
        {
            entity.HasKey(e => e.HistoryId).HasName("actionhistory_pkey");

            entity.ToTable("actionhistory");

            entity.HasIndex(e => e.Actiontaken, "idx_actionhistory_actiontaken");

            entity.HasIndex(e => new { e.Actiontaker, e.Actiontakendate }, "idx_actionhistory_actiontaker").IsDescending(false, true);

            entity.HasIndex(e => new { e.Referencenumber, e.Actiontaker, e.Actiontaken, e.Actiontakendate, e.Remarks }, "idx_actionhistory_covering");

            entity.HasIndex(e => new { e.Referencenumber, e.Actiontaker, e.Actiontaken, e.Actiontakendate }, "idx_actionhistory_dedup");

            entity.HasIndex(e => new { e.Locationlevel, e.Locationvalue }, "idx_actionhistory_location");

            entity.HasIndex(e => new { e.Referencenumber, e.Actiontakendate }, "idx_actionhistory_referencenumber_date").IsDescending(false, true);

            entity.Property(e => e.HistoryId).HasColumnName("history_id");
            entity.Property(e => e.Actiontaken)
                .HasMaxLength(100)
                .HasColumnName("actiontaken");
            entity.Property(e => e.Actiontakendate)
                .HasMaxLength(50)
                .HasColumnName("actiontakendate");
            entity.Property(e => e.Actiontaker)
                .HasMaxLength(255)
                .HasColumnName("actiontaker");
            entity.Property(e => e.Locationlevel)
                .HasMaxLength(100)
                .HasColumnName("locationlevel");
            entity.Property(e => e.Locationvalue).HasColumnName("locationvalue");
            entity.Property(e => e.Referencenumber)
                .HasMaxLength(30)
                .HasColumnName("referencenumber");
            entity.Property(e => e.Remarks)
                .HasMaxLength(255)
                .HasColumnName("remarks");
        });

        modelBuilder.Entity<Applicationperdistrict>(entity =>
        {
            entity.HasKey(e => e.Uuid).HasName("applicationperdistrict_pkey");

            entity.ToTable("applicationperdistrict");

            entity.HasIndex(e => new { e.Districtid, e.Serviceid, e.Type, e.Financialyear }, "uq_applicationperdistrict_unique").IsUnique();

            entity.Property(e => e.Uuid).HasColumnName("uuid");
            entity.Property(e => e.Countvalue).HasColumnName("countvalue");
            entity.Property(e => e.Districtid).HasColumnName("districtid");
            entity.Property(e => e.Financialyear)
                .HasMaxLength(50)
                .HasColumnName("financialyear");
            entity.Property(e => e.Serviceid).HasColumnName("serviceid");
            entity.Property(e => e.Type).HasMaxLength(30);
        });

        modelBuilder.Entity<Applicationswithexpiringeligibility>(entity =>
        {
            entity.HasKey(e => e.ExpiringId).HasName("applicationswithexpiringeligibility_pkey");

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
            entity.Property(e => e.Referencenumber)
                .HasMaxLength(50)
                .HasColumnName("referencenumber");
            entity.Property(e => e.Serviceid).HasColumnName("serviceid");
        });

        modelBuilder.Entity<Auditlogs>(entity =>
        {
            entity.HasKey(e => e.Logid).HasName("auditlogs_pkey");

            entity.ToTable("auditlogs");

            entity.Property(e => e.Logid).HasColumnName("logid");
            entity.Property(e => e.Action)
                .HasMaxLength(100)
                .HasColumnName("action");
            entity.Property(e => e.Additionaldata)
                .HasColumnType("jsonb")
                .HasColumnName("additionaldata");
            entity.Property(e => e.Browser)
                .HasMaxLength(100)
                .HasColumnName("browser");
            entity.Property(e => e.Description).HasColumnName("description");
            entity.Property(e => e.Device)
                .HasMaxLength(100)
                .HasColumnName("device");
            entity.Property(e => e.Ipaddress)
                .HasMaxLength(45)
                .HasColumnName("ipaddress");
            entity.Property(e => e.Operatingsystem)
                .HasMaxLength(100)
                .HasColumnName("operatingsystem");
            entity.Property(e => e.Status)
                .HasMaxLength(20)
                .HasColumnName("status");
            entity.Property(e => e.Timestamp)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("timestamp without time zone")
                .HasColumnName("timestamp");
            entity.Property(e => e.Userid).HasColumnName("userid");

            entity.HasOne(d => d.User).WithMany(p => p.Auditlogs)
                .HasForeignKey(d => d.Userid)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("fk_auditlogs_users");
        });

        modelBuilder.Entity<Bank>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("bank_pkey");

            entity.ToTable("bank");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.Bankcode)
                .HasMaxLength(5)
                .HasColumnName("bankcode");
            entity.Property(e => e.Bankname)
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
            entity.HasKey(e => e.Uuid).HasName("blocks_pkey");

            entity.ToTable("blocks");

            entity.Property(e => e.Uuid).HasColumnName("uuid");
            entity.Property(e => e.Blockid).HasColumnName("blockid");
            entity.Property(e => e.Blockname)
                .HasMaxLength(255)
                .HasColumnName("blockname");
            entity.Property(e => e.Districtid).HasColumnName("districtid");
        });

        modelBuilder.Entity<Certificates>(entity =>
        {
            entity.HasKey(e => e.Uuid).HasName("certificates_pkey");

            entity.ToTable("certificates");

            entity.Property(e => e.Uuid).HasColumnName("uuid");
            entity.Property(e => e.Certifiyingauthority).HasColumnName("certifiyingauthority");
            entity.Property(e => e.Expirationdate)
                .HasColumnType("timestamp without time zone")
                .HasColumnName("expirationdate");
            entity.Property(e => e.Officerid).HasColumnName("officerid");
            entity.Property(e => e.Registereddate)
                .HasMaxLength(50)
                .HasColumnName("registereddate");
            entity.Property(e => e.Serialnumber).HasColumnName("serialnumber");
        });

        modelBuilder.Entity<CitizenApplications>(entity =>
        {
            entity.HasKey(e => e.Referencenumber).HasName("citizen_applications_pkey");

            entity.ToTable("citizen_applications");

            entity.HasIndex(e => new { e.Serviceid, e.Datatype }, "idx_citizen_applications_active").HasFilter("(status <> 'Incomplete'::text)");

            entity.HasIndex(e => e.ApplId, "idx_citizen_applications_appl_id");

            entity.HasIndex(e => e.CreatedAt, "idx_citizen_applications_created_at").IsDescending();

            entity.HasIndex(e => new { e.Serviceid, e.Datatype, e.Status }, "idx_citizen_applications_service_datatype");

            entity.HasIndex(e => new { e.Serviceid, e.Status }, "idx_citizen_applications_service_status");

            entity.HasIndex(e => e.Status, "idx_citizen_applications_status");

            entity.HasIndex(e => e.Workflow, "idx_citizen_applications_workflow_gin").HasMethod("gin");

            entity.HasIndex(e => e.Serviceid, "ix_citizen_applications_serviceid");

            entity.Property(e => e.Referencenumber)
                .HasMaxLength(50)
                .HasColumnName("referencenumber");
            entity.Property(e => e.Additionaldetails)
                .HasColumnType("jsonb")
                .HasColumnName("additionaldetails");
            entity.Property(e => e.ApplId).HasColumnName("appl_id");
            entity.Property(e => e.CitizenId).HasColumnName("citizen_id");
            entity.Property(e => e.CreatedAt)
                .HasMaxLength(50)
                .HasColumnName("created_at");
            entity.Property(e => e.Currentplayer).HasColumnName("currentplayer");
            entity.Property(e => e.Datatype)
                .HasMaxLength(20)
                .HasColumnName("datatype");
            entity.Property(e => e.Districtuidforbank)
                .HasMaxLength(6)
                .HasColumnName("districtuidforbank");
            entity.Property(e => e.Formdetails)
                .HasColumnType("jsonb")
                .HasColumnName("formdetails");
            entity.Property(e => e.Referencenumberalphanumeric)
                .HasMaxLength(50)
                .HasColumnName("referencenumberalphanumeric");
            entity.Property(e => e.Serviceid).HasColumnName("serviceid");
            entity.Property(e => e.Status).HasColumnName("status");
            entity.Property(e => e.Workflow)
                .HasColumnType("jsonb")
                .HasColumnName("workflow");
        });

        modelBuilder.Entity<Corrigendum>(entity =>
        {
            entity.HasKey(e => e.Corrigendumid).HasName("corrigendum_pkey");

            entity.ToTable("corrigendum");

            entity.HasIndex(e => e.Workflow, "idx_corrigendum_workflow_gin").HasMethod("gin");

            entity.HasIndex(e => new { e.Referencenumber, e.Type, e.Status }, "ix_corrigendum_referencenumber_type_status");

            entity.Property(e => e.Corrigendumid)
                .HasMaxLength(60)
                .HasColumnName("corrigendumid");
            entity.Property(e => e.Corrigendumfields)
                .HasColumnType("jsonb")
                .HasColumnName("corrigendumfields");
            entity.Property(e => e.Createdat)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("timestamp without time zone")
                .HasColumnName("createdat");
            entity.Property(e => e.Currentplayer).HasColumnName("currentplayer");
            entity.Property(e => e.History)
                .HasColumnType("jsonb")
                .HasColumnName("history");
            entity.Property(e => e.Location)
                .HasColumnType("jsonb")
                .HasColumnName("location");
            entity.Property(e => e.Referencenumber)
                .HasMaxLength(50)
                .HasColumnName("referencenumber");
            entity.Property(e => e.Status)
                .HasMaxLength(20)
                .HasColumnName("status");
            entity.Property(e => e.Type)
                .HasMaxLength(50)
                .HasColumnName("type");
            entity.Property(e => e.Workflow)
                .HasColumnType("jsonb")
                .HasColumnName("workflow");

            entity.HasOne(d => d.ReferencenumberNavigation).WithMany(p => p.Corrigendum)
                .HasForeignKey(d => d.Referencenumber)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("fk_corrigendum_citizen_applications");
        });

        modelBuilder.Entity<Departments>(entity =>
        {
            entity.HasKey(e => e.Departmentid).HasName("departments_pkey");

            entity.ToTable("departments");

            entity.Property(e => e.Departmentid).HasColumnName("departmentid");
            entity.Property(e => e.Departmentname).HasColumnName("departmentname");
        });

        modelBuilder.Entity<District>(entity =>
        {
            entity.HasKey(e => e.Districtid).HasName("district_pkey");

            entity.ToTable("district");

            entity.Property(e => e.Districtid)
                .ValueGeneratedNever()
                .HasColumnName("districtid");
            entity.Property(e => e.Districtname)
                .HasMaxLength(255)
                .HasColumnName("districtname");
            entity.Property(e => e.Districtshort)
                .HasMaxLength(50)
                .HasColumnName("districtshort");
            entity.Property(e => e.Division).HasColumnName("division");
            entity.Property(e => e.Uuid).HasColumnName("uuid");
        });

        modelBuilder.Entity<Emailsettings>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("emailsettings_pkey");

            entity.ToTable("emailsettings");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.Password).HasColumnName("password");
            entity.Property(e => e.Senderemail)
                .HasMaxLength(255)
                .HasColumnName("senderemail");
            entity.Property(e => e.Sendername)
                .HasMaxLength(255)
                .HasColumnName("sendername");
            entity.Property(e => e.Smtpport).HasColumnName("smtpport");
            entity.Property(e => e.Smtpserver)
                .HasMaxLength(255)
                .HasColumnName("smtpserver");
            entity.Property(e => e.Templates)
                .HasColumnType("jsonb")
                .HasColumnName("templates");
        });

        modelBuilder.Entity<Feedback>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("feedback_pkey");

            entity.ToTable("feedback");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.Createdon)
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
            entity.Property(e => e.Userid).HasColumnName("userid");
        });

        modelBuilder.Entity<Halqapanchayat>(entity =>
        {
            entity.HasKey(e => e.Uuid).HasName("halqapanchayat_pkey");

            entity.ToTable("halqapanchayat");

            entity.Property(e => e.Uuid).HasColumnName("uuid");
            entity.Property(e => e.Blockid).HasColumnName("blockid");
            entity.Property(e => e.Halqapanchayatid).HasColumnName("halqapanchayatid");
            entity.Property(e => e.Halqapanchayatname)
                .HasMaxLength(255)
                .HasColumnName("halqapanchayatname");
        });

        modelBuilder.Entity<MainApplicationStatusSnapshot>(entity =>
        {
            entity.HasKey(e => e.SnapshotId).HasName("main_application_status_snapshot_pkey");

            entity.ToTable("main_application_status_snapshot");

            entity.HasIndex(e => new { e.PServiceId, e.PAccessLevel, e.PTakenBy, e.CapturedAt }, "idx_main_app_status_params");

            entity.Property(e => e.SnapshotId).HasColumnName("snapshot_id");
            entity.Property(e => e.CapturedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("captured_at");
            entity.Property(e => e.PAccessCode).HasColumnName("p_access_code");
            entity.Property(e => e.PAccessLevel)
                .HasMaxLength(50)
                .HasColumnName("p_access_level");
            entity.Property(e => e.PDivisionCode).HasColumnName("p_division_code");
            entity.Property(e => e.PServiceId).HasColumnName("p_service_id");
            entity.Property(e => e.PTakenBy)
                .HasMaxLength(255)
                .HasColumnName("p_taken_by");
            entity.Property(e => e.Pendingcount)
                .HasDefaultValue(0)
                .HasColumnName("pendingcount");
            entity.Property(e => e.Rejectcount)
                .HasDefaultValue(0)
                .HasColumnName("rejectcount");
            entity.Property(e => e.Returntoeditcount)
                .HasDefaultValue(0)
                .HasColumnName("returntoeditcount");
            entity.Property(e => e.Sanctionedcount)
                .HasDefaultValue(0)
                .HasColumnName("sanctionedcount");
            entity.Property(e => e.Totalapplications)
                .HasDefaultValue(0)
                .HasColumnName("totalapplications");
        });

        modelBuilder.Entity<Muncipalities>(entity =>
        {
            entity.HasKey(e => e.Uuid).HasName("muncipalities_pkey");

            entity.ToTable("muncipalities");

            entity.Property(e => e.Uuid).HasColumnName("uuid");
            entity.Property(e => e.Districtid).HasColumnName("districtid");
            entity.Property(e => e.Muncipalityid).HasColumnName("muncipalityid");
            entity.Property(e => e.Muncipalityname)
                .HasMaxLength(255)
                .HasColumnName("muncipalityname");
            entity.Property(e => e.Muncipalitytype).HasColumnName("muncipalitytype");
        });

        modelBuilder.Entity<Muncipalitytypes>(entity =>
        {
            entity.HasKey(e => e.Uuid).HasName("muncipalitytypes_pkey");

            entity.ToTable("muncipalitytypes");

            entity.Property(e => e.Uuid).HasColumnName("uuid");
            entity.Property(e => e.Typecode).HasColumnName("typecode");
            entity.Property(e => e.Typename)
                .HasMaxLength(255)
                .HasColumnName("typename");
        });

        modelBuilder.Entity<Officersdesignations>(entity =>
        {
            entity.HasKey(e => e.Uuid).HasName("officersdesignations_pkey");

            entity.ToTable("officersdesignations");

            entity.Property(e => e.Uuid).HasColumnName("uuid");
            entity.Property(e => e.Accesslevel)
                .HasMaxLength(100)
                .HasColumnName("accesslevel");
            entity.Property(e => e.Departmentid).HasColumnName("departmentid");
            entity.Property(e => e.Designation).HasColumnName("designation");
            entity.Property(e => e.Designationshort)
                .HasMaxLength(100)
                .HasColumnName("designationshort");
        });

        modelBuilder.Entity<Offices>(entity =>
        {
            entity.HasKey(e => e.Officeid).HasName("offices_pkey");

            entity.ToTable("offices");

            entity.Property(e => e.Officeid).HasColumnName("officeid");
            entity.Property(e => e.Accesslevel)
                .HasMaxLength(50)
                .HasColumnName("accesslevel");
            entity.Property(e => e.Departmentid).HasColumnName("departmentid");
            entity.Property(e => e.Officetype)
                .HasMaxLength(50)
                .HasColumnName("officetype");
        });

        modelBuilder.Entity<Officesdetails>(entity =>
        {
            entity
                .HasNoKey()
                .ToTable("officesdetails");

            entity.Property(e => e.Areacode).HasColumnName("areacode");
            entity.Property(e => e.Areaname)
                .HasMaxLength(50)
                .HasColumnName("areaname");
            entity.Property(e => e.Districtcode).HasColumnName("districtcode");
            entity.Property(e => e.Divisioncode).HasColumnName("divisioncode");
            entity.Property(e => e.Officename)
                .HasMaxLength(255)
                .HasColumnName("officename");
            entity.Property(e => e.Officetype).HasColumnName("officetype");
            entity.Property(e => e.Statecode)
                .HasDefaultValue(0)
                .HasColumnName("statecode");

            entity.HasOne(d => d.OfficetypeNavigation).WithMany()
                .HasForeignKey(d => d.Officetype)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("fk_officesdetails_offices");
        });

        modelBuilder.Entity<Pensionpayments>(entity =>
        {
            entity
                .HasNoKey()
                .ToTable("pensionpayments");

            entity.Property(e => e.BankresBankdateexecuted)
                .HasMaxLength(255)
                .HasColumnName("bankres_bankdateexecuted");
            entity.Property(e => e.BankresPensionercategory)
                .HasMaxLength(255)
                .HasColumnName("bankres_pensionercategory");
            entity.Property(e => e.BankresStatusfrombank)
                .HasMaxLength(255)
                .HasColumnName("bankres_statusfrombank");
            entity.Property(e => e.BankresTransactionid)
                .HasMaxLength(255)
                .HasColumnName("bankres_transactionid");
            entity.Property(e => e.BankresTransactionstatus)
                .HasMaxLength(255)
                .HasColumnName("bankres_transactionstatus");
            entity.Property(e => e.Districtbankuid)
                .HasMaxLength(255)
                .HasColumnName("districtbankuid");
            entity.Property(e => e.Districtid)
                .HasMaxLength(255)
                .HasColumnName("districtid");
            entity.Property(e => e.Districtname)
                .HasMaxLength(255)
                .HasColumnName("districtname");
            entity.Property(e => e.Divisioncode)
                .HasMaxLength(255)
                .HasColumnName("divisioncode");
            entity.Property(e => e.Divisionname)
                .HasMaxLength(255)
                .HasColumnName("divisionname");
            entity.Property(e => e.Payingdepartment)
                .HasMaxLength(255)
                .HasColumnName("payingdepartment");
            entity.Property(e => e.Payingdeptaccountnumber)
                .HasMaxLength(255)
                .HasColumnName("payingdeptaccountnumber");
            entity.Property(e => e.Payingdeptbankname)
                .HasMaxLength(255)
                .HasColumnName("payingdeptbankname");
            entity.Property(e => e.Payingdeptifsccode)
                .HasMaxLength(255)
                .HasColumnName("payingdeptifsccode");
            entity.Property(e => e.Paymentfilegenerationdate)
                .HasMaxLength(255)
                .HasColumnName("paymentfilegenerationdate");
            entity.Property(e => e.Paymentofmonth)
                .HasMaxLength(255)
                .HasColumnName("paymentofmonth");
            entity.Property(e => e.Paymentofyear)
                .HasMaxLength(255)
                .HasColumnName("paymentofyear");
            entity.Property(e => e.Pensionamount)
                .HasMaxLength(255)
                .HasColumnName("pensionamount");
            entity.Property(e => e.Pensioneraccountno)
                .HasMaxLength(255)
                .HasColumnName("pensioneraccountno");
            entity.Property(e => e.Pensionerifsccode)
                .HasMaxLength(255)
                .HasColumnName("pensionerifsccode");
            entity.Property(e => e.Pensionername)
                .HasMaxLength(255)
                .HasColumnName("pensionername");
            entity.Property(e => e.Pensionertype)
                .HasMaxLength(255)
                .HasColumnName("pensionertype");
            entity.Property(e => e.Referencenumber)
                .HasMaxLength(255)
                .HasColumnName("referencenumber");
            entity.Property(e => e.Statecode)
                .HasMaxLength(255)
                .HasColumnName("statecode");
            entity.Property(e => e.Statename)
                .HasMaxLength(255)
                .HasColumnName("statename");
        });

        modelBuilder.Entity<Pool>(entity =>
        {
            entity.HasKey(e => e.Poolid).HasName("pool_pkey");

            entity.ToTable("pool");

            entity.HasIndex(e => e.Serviceid, "ix_pool_serviceid");

            entity.Property(e => e.Poolid).HasColumnName("poolid");
            entity.Property(e => e.Accesscode).HasColumnName("accesscode");
            entity.Property(e => e.Accesslevel)
                .HasMaxLength(255)
                .HasColumnName("accesslevel");
            entity.Property(e => e.List)
                .HasColumnType("jsonb")
                .HasColumnName("list");
            entity.Property(e => e.Listtype)
                .HasMaxLength(20)
                .HasColumnName("listtype");
            entity.Property(e => e.Serviceid).HasColumnName("serviceid");

            entity.HasOne(d => d.Service).WithMany(p => p.Pool)
                .HasForeignKey(d => d.Serviceid)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("fk_pool_services");
        });

        modelBuilder.Entity<Scheduledjobs>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("scheduledjobs_pkey");

            entity.ToTable("scheduledjobs");

            entity.Property(e => e.Id)
                .HasDefaultValueSql("uuid_generate_v4()")
                .HasColumnName("id");
            entity.Property(e => e.Actiontype)
                .HasMaxLength(100)
                .HasColumnName("actiontype");
            entity.Property(e => e.Createdat)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("timestamp without time zone")
                .HasColumnName("createdat");
            entity.Property(e => e.Cronexpression)
                .HasMaxLength(100)
                .HasColumnName("cronexpression");
            entity.Property(e => e.Jsonparameters)
                .HasColumnType("jsonb")
                .HasColumnName("jsonparameters");
            entity.Property(e => e.Lastexecutedat)
                .HasColumnType("timestamp without time zone")
                .HasColumnName("lastexecutedat");
        });

        modelBuilder.Entity<Services>(entity =>
        {
            entity.HasKey(e => e.Serviceid).HasName("services_pkey");

            entity.ToTable("services");

            entity.Property(e => e.Serviceid).HasColumnName("serviceid");
            entity.Property(e => e.Active)
                .HasDefaultValue(false)
                .HasColumnName("active");
            entity.Property(e => e.Activeforofficers)
                .HasDefaultValue(true)
                .HasColumnName("activeforofficers");
            entity.Property(e => e.Approvallistenabled).HasColumnName("approvallistenabled");
            entity.Property(e => e.Bankdetails)
                .HasColumnType("jsonb")
                .HasColumnName("bankdetails");
            entity.Property(e => e.Createdat)
                .HasMaxLength(50)
                .HasColumnName("createdat");
            entity.Property(e => e.Departmentid).HasColumnName("departmentid");
            entity.Property(e => e.Documentfields)
                .HasDefaultValueSql("'\"\"'::jsonb")
                .HasColumnType("jsonb")
                .HasColumnName("documentfields");
            entity.Property(e => e.Formelement)
                .HasColumnType("jsonb")
                .HasColumnName("formelement");
            entity.Property(e => e.Letters)
                .HasColumnType("jsonb")
                .HasColumnName("letters");
            entity.Property(e => e.Nameshort)
                .HasMaxLength(50)
                .HasColumnName("nameshort");
            entity.Property(e => e.Officereditablefield)
                .HasColumnType("jsonb")
                .HasColumnName("officereditablefield");
            entity.Property(e => e.Privatefields)
                .HasColumnType("jsonb")
                .HasColumnName("privatefields");
            entity.Property(e => e.Servicename)
                .HasMaxLength(255)
                .HasColumnName("servicename");
            entity.Property(e => e.Submissionlimitconfig)
                .HasDefaultValueSql("'{\"isLimited\": false, \"limitType\": \"\", \"limitCount\": 0}'::jsonb")
                .HasColumnType("jsonb")
                .HasColumnName("submissionlimitconfig");
        });

        modelBuilder.Entity<StatusCountsSnapshot>(entity =>
        {
            entity.HasKey(e => e.SnapshotId).HasName("status_counts_snapshot_pkey");

            entity.ToTable("status_counts_snapshot");

            entity.HasIndex(e => new { e.PServiceId, e.PAccessLevel, e.PTakenBy, e.CapturedAt }, "idx_status_counts_params");

            entity.Property(e => e.SnapshotId).HasColumnName("snapshot_id");
            entity.Property(e => e.Amendmentcount)
                .HasDefaultValue(0)
                .HasColumnName("amendmentcount");
            entity.Property(e => e.Amendmentforwardedcount)
                .HasDefaultValue(0)
                .HasColumnName("amendmentforwardedcount");
            entity.Property(e => e.Amendmentpendingcount)
                .HasDefaultValue(0)
                .HasColumnName("amendmentpendingcount");
            entity.Property(e => e.Amendmentrejectedcount)
                .HasDefaultValue(0)
                .HasColumnName("amendmentrejectedcount");
            entity.Property(e => e.Amendmentreturnedcount)
                .HasDefaultValue(0)
                .HasColumnName("amendmentreturnedcount");
            entity.Property(e => e.Amendmentsanctionedcount)
                .HasDefaultValue(0)
                .HasColumnName("amendmentsanctionedcount");
            entity.Property(e => e.CapturedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("captured_at");
            entity.Property(e => e.Correctioncount)
                .HasDefaultValue(0)
                .HasColumnName("correctioncount");
            entity.Property(e => e.Correctionforwardedcount)
                .HasDefaultValue(0)
                .HasColumnName("correctionforwardedcount");
            entity.Property(e => e.Correctionpendingcount)
                .HasDefaultValue(0)
                .HasColumnName("correctionpendingcount");
            entity.Property(e => e.Correctionrejectedcount)
                .HasDefaultValue(0)
                .HasColumnName("correctionrejectedcount");
            entity.Property(e => e.Correctionreturnedcount)
                .HasDefaultValue(0)
                .HasColumnName("correctionreturnedcount");
            entity.Property(e => e.Correctionsanctionedcount)
                .HasDefaultValue(0)
                .HasColumnName("correctionsanctionedcount");
            entity.Property(e => e.Corrigendumcount)
                .HasDefaultValue(0)
                .HasColumnName("corrigendumcount");
            entity.Property(e => e.Corrigendumforwardedcount)
                .HasDefaultValue(0)
                .HasColumnName("corrigendumforwardedcount");
            entity.Property(e => e.Corrigendumpendingcount)
                .HasDefaultValue(0)
                .HasColumnName("corrigendumpendingcount");
            entity.Property(e => e.Corrigendumrejectedcount)
                .HasDefaultValue(0)
                .HasColumnName("corrigendumrejectedcount");
            entity.Property(e => e.Corrigendumreturnedcount)
                .HasDefaultValue(0)
                .HasColumnName("corrigendumreturnedcount");
            entity.Property(e => e.Corrigendumsanctionedcount)
                .HasDefaultValue(0)
                .HasColumnName("corrigendumsanctionedcount");
            entity.Property(e => e.Disbursedcount)
                .HasDefaultValue(0)
                .HasColumnName("disbursedcount");
            entity.Property(e => e.Forwardedcount)
                .HasDefaultValue(0)
                .HasColumnName("forwardedcount");
            entity.Property(e => e.Forwardedsanctionedcorrigendumcount)
                .HasDefaultValue(0)
                .HasColumnName("forwardedsanctionedcorrigendumcount");
            entity.Property(e => e.Forwardedsanctionedcount)
                .HasDefaultValue(0)
                .HasColumnName("forwardedsanctionedcount");
            entity.Property(e => e.Forwardedverifiedcorrectioncount)
                .HasDefaultValue(0)
                .HasColumnName("forwardedverifiedcorrectioncount");
            entity.Property(e => e.PAccessCode).HasColumnName("p_access_code");
            entity.Property(e => e.PAccessLevel)
                .HasMaxLength(50)
                .HasColumnName("p_access_level");
            entity.Property(e => e.PDivisionCode).HasColumnName("p_division_code");
            entity.Property(e => e.PServiceId).HasColumnName("p_service_id");
            entity.Property(e => e.PTakenBy)
                .HasMaxLength(255)
                .HasColumnName("p_taken_by");
            entity.Property(e => e.Pendingcount)
                .HasDefaultValue(0)
                .HasColumnName("pendingcount");
            entity.Property(e => e.Permanentwithheldcount)
                .HasDefaultValue(0)
                .HasColumnName("permanentwithheldcount");
            entity.Property(e => e.Rejectcount)
                .HasDefaultValue(0)
                .HasColumnName("rejectcount");
            entity.Property(e => e.Returnedcount)
                .HasDefaultValue(0)
                .HasColumnName("returnedcount");
            entity.Property(e => e.Returntoeditcount)
                .HasDefaultValue(0)
                .HasColumnName("returntoeditcount");
            entity.Property(e => e.Sanctionedcount)
                .HasDefaultValue(0)
                .HasColumnName("sanctionedcount");
            entity.Property(e => e.Temporarywithheldcount)
                .HasDefaultValue(0)
                .HasColumnName("temporarywithheldcount");
            entity.Property(e => e.Totalapplications)
                .HasDefaultValue(0)
                .HasColumnName("totalapplications");
            entity.Property(e => e.Totalwithheldcount)
                .HasDefaultValue(0)
                .HasColumnName("totalwithheldcount");
            entity.Property(e => e.Withheldapprovedcount)
                .HasDefaultValue(0)
                .HasColumnName("withheldapprovedcount");
            entity.Property(e => e.Withheldforwardedcount)
                .HasDefaultValue(0)
                .HasColumnName("withheldforwardedcount");
            entity.Property(e => e.Withheldpendingcount)
                .HasDefaultValue(0)
                .HasColumnName("withheldpendingcount");
        });

        modelBuilder.Entity<Tehsil>(entity =>
        {
            entity.HasKey(e => new { e.Tehsilid, e.Uuid }).HasName("tehsil_pkey");

            entity.ToTable("tehsil");

            entity.Property(e => e.Tehsilid).HasColumnName("tehsilid");
            entity.Property(e => e.Uuid)
                .ValueGeneratedOnAdd()
                .HasColumnName("uuid");
            entity.Property(e => e.Districtid).HasColumnName("districtid");
            entity.Property(e => e.Istswo)
                .HasDefaultValue(false)
                .HasColumnName("istswo");
            entity.Property(e => e.Tehsilname)
                .HasMaxLength(255)
                .HasColumnName("tehsilname");
        });

        modelBuilder.Entity<Tswotehsil>(entity =>
        {
            entity
                .HasNoKey()
                .ToTable("tswotehsil");

            entity.Property(e => e.Districtid).HasColumnName("districtid");
            entity.Property(e => e.Divisioncode).HasColumnName("divisioncode");
            entity.Property(e => e.Tehsilid).HasColumnName("tehsilid");
            entity.Property(e => e.Tehsilname)
                .HasMaxLength(50)
                .HasColumnName("tehsilname");
            entity.Property(e => e.Tswoofficename)
                .HasMaxLength(50)
                .HasColumnName("tswoofficename");
        });

        modelBuilder.Entity<Userdocuments>(entity =>
        {
            entity.HasKey(e => e.Fileid).HasName("userdocuments_pkey");

            entity.ToTable("userdocuments");

            entity.Property(e => e.Fileid).HasColumnName("fileid");
            entity.Property(e => e.Documenttype)
                .HasMaxLength(50)
                .HasColumnName("documenttype");
            entity.Property(e => e.Filedata).HasColumnName("filedata");
            entity.Property(e => e.Filename)
                .HasMaxLength(255)
                .HasColumnName("filename");
            entity.Property(e => e.Filesize).HasColumnName("filesize");
            entity.Property(e => e.Filetype)
                .HasMaxLength(50)
                .HasColumnName("filetype");
            entity.Property(e => e.Updatedat)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("timestamp without time zone")
                .HasColumnName("updatedat");
        });

        modelBuilder.Entity<Users>(entity =>
        {
            entity.HasKey(e => e.Userid).HasName("users_pkey");

            entity.ToTable("users");

            entity.Property(e => e.Userid).HasColumnName("userid");
            entity.Property(e => e.Additionaldetails)
                .HasColumnType("jsonb")
                .HasColumnName("additionaldetails");
            entity.Property(e => e.Backupcodes)
                .HasColumnType("jsonb")
                .HasColumnName("backupcodes");
            entity.Property(e => e.Email)
                .HasMaxLength(100)
                .HasColumnName("email");
            entity.Property(e => e.Isemailvalid)
                .HasDefaultValue(false)
                .HasColumnName("isemailvalid");
            entity.Property(e => e.Mobilenumber)
                .HasMaxLength(20)
                .HasColumnName("mobilenumber");
            entity.Property(e => e.Name)
                .HasMaxLength(255)
                .HasColumnName("name");
            entity.Property(e => e.Password).HasColumnName("password");
            entity.Property(e => e.Profile)
                .HasMaxLength(100)
                .HasColumnName("profile");
            entity.Property(e => e.Registereddate)
                .HasMaxLength(120)
                .HasColumnName("registereddate");
            entity.Property(e => e.Username)
                .HasMaxLength(100)
                .HasColumnName("username");
            entity.Property(e => e.Usertype)
                .HasMaxLength(30)
                .HasColumnName("usertype");
        });

        modelBuilder.Entity<Usersessions>(entity =>
        {
            entity.HasKey(e => e.Sessionid).HasName("usersessions_pkey");

            entity.ToTable("usersessions");

            entity.Property(e => e.Sessionid)
                .ValueGeneratedNever()
                .HasColumnName("sessionid");
            entity.Property(e => e.Jwttoken).HasColumnName("jwttoken");
            entity.Property(e => e.Lastactivitytime)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("timestamp without time zone")
                .HasColumnName("lastactivitytime");
            entity.Property(e => e.Logintime)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("timestamp without time zone")
                .HasColumnName("logintime");
            entity.Property(e => e.Userid).HasColumnName("userid");
        });

        modelBuilder.Entity<Villages>(entity =>
        {
            entity.HasKey(e => e.Uuid).HasName("villages_pkey");

            entity.ToTable("villages");

            entity.Property(e => e.Uuid).HasColumnName("uuid");
            entity.Property(e => e.Halqapanchayatid).HasColumnName("halqapanchayatid");
            entity.Property(e => e.Villageid).HasColumnName("villageid");
            entity.Property(e => e.Villagename)
                .HasMaxLength(255)
                .HasColumnName("villagename");
        });

        modelBuilder.Entity<Wards>(entity =>
        {
            entity.HasKey(e => e.Uuid).HasName("wards_pkey");

            entity.ToTable("wards");

            entity.Property(e => e.Uuid).HasColumnName("uuid");
            entity.Property(e => e.Muncipalityid).HasColumnName("muncipalityid");
            entity.Property(e => e.Wardcode).HasColumnName("wardcode");
            entity.Property(e => e.Wardno).HasColumnName("wardno");
        });

        modelBuilder.Entity<Webservice>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("webservice_pkey");

            entity.ToTable("webservice");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.Apiendpoint)
                .HasColumnType("jsonb")
                .HasColumnName("apiendpoint");
            entity.Property(e => e.Createdat)
                .HasMaxLength(100)
                .HasColumnName("createdat");
            entity.Property(e => e.Fieldmappings)
                .HasColumnType("jsonb")
                .HasColumnName("fieldmappings");
            entity.Property(e => e.Headers)
                .HasDefaultValueSql("'[]'::jsonb")
                .HasColumnType("jsonb")
                .HasColumnName("headers");
            entity.Property(e => e.Isactive)
                .HasDefaultValue(false)
                .HasColumnName("isactive");
            entity.Property(e => e.Onaction)
                .HasColumnType("jsonb")
                .HasColumnName("onaction");
            entity.Property(e => e.Serviceid).HasColumnName("serviceid");
            entity.Property(e => e.Updatedat)
                .HasMaxLength(100)
                .HasColumnName("updatedat");
            entity.Property(e => e.Webservicename)
                .HasMaxLength(255)
                .HasColumnName("webservicename");

            entity.HasOne(d => d.Service).WithMany(p => p.Webservice)
                .HasForeignKey(d => d.Serviceid)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("fk_webservice_services");
        });

        modelBuilder.Entity<WithheldApplications>(entity =>
        {
            entity.HasKey(e => e.WithheldId).HasName("withheld_applications_pkey");

            entity.ToTable("withheld_applications");

            entity.HasIndex(e => new { e.Serviceid, e.Iswithheld, e.Withheldtype }, "idx_withheld_applications_service_type");

            entity.HasIndex(e => e.Workflow, "idx_withheld_applications_workflow_gin").HasMethod("gin");

            entity.HasIndex(e => new { e.Serviceid, e.Iswithheld }, "ix_withheld_applications_serviceid_iswithheld");

            entity.Property(e => e.WithheldId).HasColumnName("withheld_id");
            entity.Property(e => e.Currentplayer).HasColumnName("currentplayer");
            entity.Property(e => e.Files)
                .HasColumnType("jsonb")
                .HasColumnName("files");
            entity.Property(e => e.History)
                .HasColumnType("jsonb")
                .HasColumnName("history");
            entity.Property(e => e.Iswithheld)
                .HasDefaultValue(false)
                .HasColumnName("iswithheld");
            entity.Property(e => e.Location)
                .HasColumnType("jsonb")
                .HasColumnName("location");
            entity.Property(e => e.Referencenumber)
                .HasMaxLength(50)
                .HasColumnName("referencenumber");
            entity.Property(e => e.Serviceid).HasColumnName("serviceid");
            entity.Property(e => e.Status)
                .HasMaxLength(50)
                .HasColumnName("status");
            entity.Property(e => e.Withheldon)
                .HasDefaultValueSql("CURRENT_DATE")
                .HasColumnName("withheldon");
            entity.Property(e => e.Withheldreason).HasColumnName("withheldreason");
            entity.Property(e => e.Withheldtype)
                .HasMaxLength(20)
                .HasColumnName("withheldtype");
            entity.Property(e => e.Workflow)
                .HasColumnType("jsonb")
                .HasColumnName("workflow");
        });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
