using System.Collections;
using System.Collections.Specialized;
using System.Reflection;
using System.Text.RegularExpressions;
using iText.Barcodes;
using iText.IO.Image;
using iText.Kernel.Colors;
using iText.Kernel.Geom;
using iText.Kernel.Pdf;
using iText.Kernel.Pdf.Canvas;
using iText.Kernel.Pdf.Xobject;
using iText.Layout;
using iText.Layout.Borders;
using iText.Layout.Element;
using iText.Layout.Properties;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using SahayataNidhi.Models.Entities;

public class PdfService(IWebHostEnvironment webHostEnvironment, SwdjkContext dbcontext, UserHelperFunctions helper)
{
    private readonly IWebHostEnvironment _webHostEnvironment = webHostEnvironment;
    protected readonly SwdjkContext dbcontext = dbcontext;
    protected readonly UserHelperFunctions helper = helper;

    public string GetArreaName(string? accessLevel, int? accessCode)
    {
        string areaName = "";

        if (accessLevel == "Tehsil")
        {
            areaName = dbcontext.Tswotehsil.FirstOrDefault(t => t.Tehsilid == accessCode)!.Tehsilname!;
        }
        else if (accessLevel == "District")
        {
            areaName = dbcontext.District.FirstOrDefault(t => t.Districtid == accessCode)!.Districtname!;
        }
        else if (accessLevel == "Division")
        {
            areaName = accessCode == 1 ? "Jammu" : "Kashmir";
        }
        return areaName;
    }

    public string GetBranchOffice(string applicationId)
    {
        var citizenDetails = dbcontext.CitizenApplications
            .FirstOrDefault(ca => ca.Referencenumber == applicationId);

        if (citizenDetails == null || string.IsNullOrEmpty(citizenDetails.Formdetails))
            throw new Exception("Application not found or form data missing.");

        int serviceId = citizenDetails.Serviceid;

        // Deserialize form data
        var formdata = JsonConvert.DeserializeObject<JObject>(citizenDetails.Formdetails!);

        // Extract District -> Division
        var locationArray = formdata!["Location"] as JArray;
        int? districtValue = (int?)locationArray?
            .FirstOrDefault(item => item["name"]?.ToString() == "District")?["value"];

        if (districtValue == null)
            throw new Exception("District not found in form data.");

        string division = dbcontext.District
            .FirstOrDefault(d => d.Districtid == districtValue)!.Division == 1 ? "Jammu" : "Kashmir";

        // Get bank details JSON
        var bankDetailsJson = dbcontext.Services
            .FirstOrDefault(s => s.Serviceid == serviceId)?.Bankdetails;

        if (string.IsNullOrEmpty(bankDetailsJson))
            throw new Exception("Bank details not found.");

        // Deserialize as JObject
        var bankDetailsObj = JsonConvert.DeserializeObject<JObject>(bankDetailsJson!);

        // Determine branch office
        string branchOffice = "";

        // Case 1: Contains division-specific structure
        if (bankDetailsObj!.ContainsKey("Jammu") || bankDetailsObj.ContainsKey("Kashmir"))
        {
            var divisionObj = bankDetailsObj[division] as JObject;
            branchOffice = divisionObj?["BranchOffice"]?.ToString() ?? "";
        }
        // Case 2: Flat structure
        else
        {
            branchOffice = bankDetailsObj["BranchOffice"]?.ToString() ?? "";
        }

        return branchOffice;
    }

    public async Task CreateAcknowledgement(OrderedDictionary details, string applicationId, string serviceName)
    {
        // Generate PDF into MemoryStream
        using var memoryStream = new MemoryStream();
        using PdfWriter writer = new PdfWriter(memoryStream);
        using PdfDocument pdf = new PdfDocument(writer);
        using Document document = new Document(pdf);

        string emblem = System.IO.Path.Combine(_webHostEnvironment.WebRootPath, "assets", "images", "emblem.png");
        Image image = new Image(ImageDataFactory.Create(emblem))
                        .ScaleToFit(50, 50)
                        .SetHorizontalAlignment(HorizontalAlignment.CENTER);
        document.Add(image);

        document.Add(new Paragraph("Union Territory of Jammu and Kashmir")
            .SetBold()
            .SetTextAlignment(TextAlignment.CENTER)
            .SetFontSize(20));

        document.Add(new Paragraph(serviceName)
            .SetBold()
            .SetTextAlignment(TextAlignment.CENTER)
            .SetFontSize(16));

        document.Add(new Paragraph("Acknowledgement")
            .SetBold()
            .SetTextAlignment(TextAlignment.CENTER)
            .SetFontSize(16));

        // Create table with fixed layout to auto-scale cells based on content
        Table table = new Table(UnitValue.CreatePercentArray(2))
            .UseAllAvailableWidth()
            .SetFixedLayout(); // Set fixed layout to adjust cell size to content

        foreach (DictionaryEntry item in details)
        {
            // Add cells with auto-scaling based on content
            Cell keyCell = new Cell()
                .Add(new Paragraph(item.Key.ToString())
                    .SetFontSize(12)); // Optional: Adjust font size for better fit
            keyCell.SetPadding(5); // Add padding for better readability
            table.AddCell(keyCell);

            Cell valueCell = new Cell()
                .Add(new Paragraph(item.Value?.ToString() ?? string.Empty)
                    .SetFontSize(12)); // Optional: Adjust font size for better fit
            valueCell.SetPadding(5); // Add padding for better readability
            table.AddCell(valueCell);
        }

        document.Add(table);

        // Ensure the PDF is finalized
        document.Close();

        // Call GetFilePath to store in database
        await helper.GetFilePath(null, memoryStream.ToArray(), applicationId.Replace("/", "_") + "Acknowledgement.pdf", "document");
    }
    public async Task CreateSanctionPdf(Dictionary<string, string> details, string sanctionLetterFor, string information, OfficerDetailsModal Officer, string ApplicationId)
    {
        using var memoryStream = new MemoryStream();

        string emblem = System.IO.Path.Combine(_webHostEnvironment.WebRootPath, "assets", "images", "emblem.png");

        string? sanctionedFromWhere = Officer.AccessLevel != "State"
            ? $"Office of The {Officer.Role}, {GetArreaName(Officer.AccessLevel, Officer.AccessCode)}"
            : "SOCIAL WELFARE DEPARTMENT\nCIVIL SECRETARIAT, JAMMU / SRINAGAR";

        using PdfWriter writer = new(memoryStream);
        using PdfDocument pdf = new(writer);
        pdf.SetDefaultPageSize(PageSize.A4);

        // Create canvas for absolute positioning
        PdfCanvas canvas = new PdfCanvas(pdf.AddNewPage());
        float pageHeight = PageSize.A4.GetHeight();
        float pageWidth = PageSize.A4.GetWidth();

        using Document document = new(pdf);

        // --- Header with image ---
        Image image = new Image(ImageDataFactory.Create(emblem))
                        .ScaleToFit(50, 50)
                        .SetHorizontalAlignment(HorizontalAlignment.CENTER);
        document.Add(image);

        document.Add(new Paragraph("Union Territory of Jammu and Kashmir")
            .SetBold()
            .SetTextAlignment(TextAlignment.CENTER)
            .SetFontSize(16)
            .SetMarginBottom(5));

        document.Add(new Paragraph(sanctionedFromWhere)
            .SetTextAlignment(TextAlignment.CENTER)
            .SetFontSize(16)
            .SetMarginBottom(5));

        document.Add(new Paragraph($"Sanction Letter for {sanctionLetterFor}")
            .SetTextAlignment(TextAlignment.CENTER)
            .SetFontSize(16)
            .SetMarginBottom(10));

        // --- Number and Date ---
        Table headerInfoTable = new Table(UnitValue.CreatePercentArray(new float[] { 50, 50 }))
            .UseAllAvailableWidth()
            .SetMarginBottom(10);

        headerInfoTable.AddCell(new Cell().SetBorder(Border.NO_BORDER));
        headerInfoTable.AddCell(new Cell()
            .Add(new Paragraph($"No: {ApplicationId}\nDate: {DateTime.Today:dd/MM/yyyy}")
                .SetFontSize(10)
                .SetTextAlignment(TextAlignment.RIGHT)
                .SetBold())
            .SetBorder(Border.NO_BORDER));
        document.Add(headerInfoTable);

        // --- Beneficiary Table (Compact) ---
        document.Add(new Paragraph("Please Find the Particulars of Beneficiary given below:")
            .SetFontSize(11)
            .SetMarginBottom(5));

        Table table = new Table(UnitValue.CreatePercentArray(2)).UseAllAvailableWidth();
        table.SetFontSize(9);

        foreach (var item in details)
        {
            table.AddCell(new Cell()
                .Add(new Paragraph(item.Key).SetFontSize(9))
                .SetPadding(2));
            table.AddCell(new Cell()
                .Add(new Paragraph(item.Value).SetFontSize(9))
                .SetPadding(2));
        }
        document.Add(table);

        // --- Additional Information (Compact) ---
        if (!string.IsNullOrEmpty(information))
        {
            document.Add(new Paragraph(information)
                .SetFontSize(9)
                .SetMarginTop(8)
                .SetMarginBottom(15));
        }

        // --- Pre-calculate if we need to add manual space ---
        // Add a small fixed space (reduced from original)
        document.Add(new Paragraph("\n").SetHeight(30));

        // --- Footer Table with Issuing Authority ---
        // Positioned higher with less space before it
        Table footerTable = new Table(UnitValue.CreatePercentArray(new float[] { 50, 50 }))
            .UseAllAvailableWidth()
            .SetMarginTop(10); // Reduced margin

        footerTable.AddCell(new Cell()
            .SetBorder(Border.NO_BORDER)
            .SetTextAlignment(TextAlignment.LEFT));

        footerTable.AddCell(new Cell()
            .Add(new Paragraph("ISSUING AUTHORITY")
                .SetFontSize(10)
                .SetBold()
                .SetMarginBottom(1))
            .Add(new Paragraph($"{Officer.Role}, {GetArreaName(Officer.AccessLevel, Officer.AccessCode)}")
                .SetFontSize(10)
                .SetBold())
            .SetBorder(Border.NO_BORDER)
            .SetTextAlignment(TextAlignment.RIGHT));

        document.Add(footerTable);

        // --- QR Code (Added after main content to avoid overlapping) ---
        string qrContent = string.Join("\n", details
            .Where(kv => new[] { "NAME OF APPLICANT", "FATHER / HUSBAND / GUARDIAN", "ApplicationId" }.Contains(kv.Key))
            .Select(kv => $"{kv.Key}: {kv.Value}"));

        if (string.IsNullOrEmpty(qrContent))
            qrContent = $"ApplicationId: {ApplicationId}";
        else
            qrContent += $"\nApplicationId: {ApplicationId}";

        BarcodeQRCode qrCode = new BarcodeQRCode(qrContent);
        PdfFormXObject qrXObject = qrCode.CreateFormXObject(ColorConstants.BLACK, pdf);

        // Position QR at bottom left corner
        Image qrImage = new Image(qrXObject)
            .ScaleToFit(90, 90)
            .SetFixedPosition(30, 40); // Fixed position at bottom

        document.Add(qrImage);

        document.Close();

        await helper.GetFilePath(null, memoryStream.ToArray(),
            ApplicationId.Replace("/", "_") + "_SanctionLetter.pdf", "document");
    }
    public async Task CreateCorrigendumSanctionPdf(string corrigendumFieldsJson, string applicationId, OfficerDetailsModal officer, string serviceName, string corrigendumId, string sanctionedDate, string type)
    {
        if (string.IsNullOrEmpty(corrigendumFieldsJson))
            throw new ArgumentException($"{type} fields JSON cannot be null or empty.");
        if (string.IsNullOrEmpty(applicationId))
            throw new ArgumentException("Application ID cannot be null or empty.");
        if (officer == null)
            throw new ArgumentException("Officer details cannot be null.");

        var corrigendumFields = JsonConvert.DeserializeObject<JObject>(corrigendumFieldsJson);
        if (corrigendumFields == null)
            throw new Exception("Failed to deserialize corrigendum fields.");

        using var memoryStream = new MemoryStream();
        using PdfWriter writer = new(memoryStream);
        using PdfDocument pdf = new(writer);
        pdf.SetDefaultPageSize(PageSize.A4);
        using Document document = new(pdf, PageSize.A4, false);

        float pageHeight = pdf.GetDefaultPageSize().GetHeight() - document.GetTopMargin() - document.GetBottomMargin();

        // --- Emblem ---
        string emblemPath = System.IO.Path.Combine(_webHostEnvironment.WebRootPath, "assets", "images", "emblem.png");
        Image emblem = new Image(ImageDataFactory.Create(emblemPath))
            .ScaleToFit(50, 50)
            .SetHorizontalAlignment(HorizontalAlignment.CENTER);
        document.Add(emblem);

        // --- Header ---
        document.Add(new Paragraph("Union Territory of Jammu and Kashmir")
            .SetBold()
            .SetTextAlignment(TextAlignment.CENTER)
            .SetFontSize(16));

        string sanctionedFromWhere = officer.AccessLevel != "State"
            ? $"Office of The {officer.Role}, {GetArreaName(officer.AccessLevel, officer.AccessCode)}"
            : "SOCIAL WELFARE DEPARTMENT\nCIVIL SECRETARIAT, JAMMU / SRINAGAR";
        document.Add(new Paragraph(sanctionedFromWhere)
            .SetTextAlignment(TextAlignment.CENTER)
            .SetFontSize(16));
        document.Add(new Paragraph($"{type}")
            .SetTextAlignment(TextAlignment.CENTER)
            .SetFontSize(16));

        // --- No and Date above corrigendum table (right side) ---
        Table headerInfoTable = new Table(UnitValue.CreatePercentArray(new float[] { 50, 50 }))
            .UseAllAvailableWidth();
        headerInfoTable.AddCell(new Cell().SetBorder(Border.NO_BORDER));
        headerInfoTable.AddCell(new Cell()
            .Add(new Paragraph($"No: {corrigendumId}\nDate: {DateTime.Today:dd/MM/yyyy}")
                .SetFontSize(10)
                .SetTextAlignment(TextAlignment.RIGHT)
                .SetBold())
            .SetBorder(Border.NO_BORDER));
        document.Add(headerInfoTable);

        // --- Subject and Intro ---
        document.Add(new Paragraph($"\nSubject: {type} to Sanction Letter No. {applicationId} {(sanctionedDate != null ? "dated " + sanctionedDate : "")}")
             .SetFontSize(14));
        document.Add(new Paragraph($"\nIn partial modification of above mentioned Sanction Letter No., the following corrections may be read as:")
            .SetFontSize(12));

        // --- Corrigendum Fields Table ---
        Table table = new Table(UnitValue.CreatePercentArray(new float[] { 10, 30, 30, 30 }))
            .UseAllAvailableWidth()
            .SetKeepTogether(true);

        table.AddHeaderCell(new Cell().Add(new Paragraph("S.No").SetBold()));
        table.AddHeaderCell(new Cell().Add(new Paragraph("Description").SetBold()));
        table.AddHeaderCell(new Cell().Add(new Paragraph("As Existing").SetBold()));
        table.AddHeaderCell(new Cell().Add(new Paragraph(type == "Corrigendum" ? "As Corrected" : "As Updated").SetBold()));

        var stack = new Stack<(string path, JToken field)>();
        var qrDetails = new List<string>();
        int serialNumber = 1;

        foreach (var item in corrigendumFields)
        {
            if (item.Key != "remarks" && item.Value is JObject)
                stack.Push((item.Key, item.Value));
        }

        while (stack.Count > 0)
        {
            var (path, field) = stack.Pop();
            string header = Regex.Replace(path, "(\\B[A-Z])", " $1");
            string oldValue = field["old_value"]?.ToString() ?? "";
            string newValue = field["new_value"]?.ToString() ?? "";

            table.AddCell(new Cell().Add(new Paragraph(serialNumber.ToString())));
            table.AddCell(new Cell().Add(new Paragraph(header)));
            table.AddCell(new Cell().Add(new Paragraph(oldValue)));
            table.AddCell(new Cell().Add(new Paragraph(newValue)));

            if (!string.IsNullOrEmpty(oldValue) || !string.IsNullOrEmpty(newValue))
                qrDetails.Add($"{header} = {newValue}");

            serialNumber++;

            var additionalValues = field["additional_values"];
            if (additionalValues != null && additionalValues is JObject nested)
            {
                foreach (var nestedItem in nested)
                    stack.Push(($"{path}.{nestedItem.Key}", nestedItem.Value)!);
            }
        }

        table.SetFontSize(12);

        // --- QR Code ---
        qrDetails.Add($"Application Number: {applicationId}");
        string qrContent = string.Join("\n", qrDetails);
        if (string.IsNullOrEmpty(qrContent))
            qrContent = $"Application Number: {applicationId}";

        BarcodeQRCode qrCode = new(qrContent);
        PdfFormXObject qrXObject = qrCode.CreateFormXObject(ColorConstants.BLACK, pdf);
        Image qrImage = new Image(qrXObject).ScaleToFit(110, 110).SetHorizontalAlignment(HorizontalAlignment.LEFT).SetMarginTop(10);

        // --- Footer ---
        // Added more space before the issuing authority section
        Table footerTable = new Table(UnitValue.CreatePercentArray(new float[] { 50, 50 })).UseAllAvailableWidth();
        footerTable.AddCell(new Cell()
            .SetBorder(Border.NO_BORDER)
            .SetTextAlignment(TextAlignment.LEFT));
        footerTable.AddCell(new Cell()
            .Add(new Paragraph("ISSUING AUTHORITY")
                .SetFontSize(10)
                .SetBold())
            .SetBorder(Border.NO_BORDER)
            .SetTextAlignment(TextAlignment.RIGHT)
            .Add(new Paragraph($"{officer.Role}, {GetArreaName(officer.AccessLevel, officer.AccessCode)}")
                .SetFontSize(10)
                .SetBold()));

        Div div = new Div().SetKeepTogether(true);
        div.Add(table);

        // Added more space (extra paragraph breaks) before the unchanged text
        div.Add(new Paragraph("\n\n")); // Increased from \n to \n\n
        div.Add(new Paragraph($"The rest of the contents of the afore said Sanction Letter No. remains unchanged.").SetFontSize(12));

        // Added more space before the issuing authority
        div.Add(new Paragraph("\n\n")); // Added this for more spacing

        div.Add(footerTable);
        div.Add(qrImage);

        document.Add(div);
        document.Close();

        await helper.GetFilePath(null, memoryStream.ToArray(), corrigendumId.Replace("/", "_") + $"_{type}_SanctionLetter.pdf", "document");
    }
}