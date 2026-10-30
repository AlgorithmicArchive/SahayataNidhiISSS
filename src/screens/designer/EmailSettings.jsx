import GovPageHeader from "../../components/gov/GovPageHeader";
import {
  Box,
  TextField,
  Typography,
  Button,
  Paper,
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  RadioGroup,
  Radio,
  FormControlLabel,
  Checkbox,
  FormGroup,
  FormHelperText,
  Switch,
  Alert,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import { Row, Col } from "react-bootstrap";
import React, { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { toast, ToastContainer } from "react-toastify";
import axiosInstance from "../../axiosConfig";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";

export default function EmailManager() {
  const [tabValue, setTabValue] = useState(0);

  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  // Dynamic Email Template Generator Component
  const DynamicEmailTemplateGenerator = () => {
    const [services, setServices] = useState([]);
    const [formFields, setFormFields] = useState([]);
    const [serviceDetails, setServiceDetails] = useState({});
    const [selectedServiceId, setSelectedServiceId] = useState("");
    const [selectedLetterType, setSelectedLetterType] = useState("");
    const [template, setTemplate] = useState("");
    const [htmlOutput, setHtmlOutput] = useState("");

    // Dummy data for preview (replace with actual API data if available)
    const dummyServiceDetails = {};

    // Fetch services
    useEffect(() => {
      const fetchServices = async () => {
        try {
          const response = await axiosInstance.get("/Base/GetServices");
          if (response.data.status && response.data.services) {
            setServices(response.data.services);
          } else {
            toast.error("No services found.");
          }
        } catch (error) {
          console.error("Error fetching services:", error);
          toast.error("Failed to load services.");
        }
      };

      fetchServices();
    }, []);

    // Fetch form fields and email template when service or letter type changes
    useEffect(() => {
      if (!selectedServiceId) {
        setFormFields([]);
        setServiceDetails({});
        setSelectedLetterType("");
        setTemplate("");
        setHtmlOutput("");
        return;
      }

      const fetchFormFields = async () => {
        try {
          const response = await axiosInstance.get(
            "/Designer/GetFormElementsForEmail",
            {
              params: { serviceId: selectedServiceId },
            },
          );
          setFormFields(response.data.names || []);
        } catch (error) {
          console.error("Error fetching form fields:", error);
          toast.error("Failed to load form fields.");
        }
      };

      const fetchEmailTemplate = async () => {
        if (!selectedLetterType) {
          setTemplate("");
          setHtmlOutput("");
          return;
        }
        try {
          const response = await axiosInstance.get(
            "/Designer/GetEmailTemplate",
            {
              params: {
                serviceId: selectedServiceId,
                type: selectedLetterType,
              },
            },
          );
          if (response.data.status) {
            setTemplate(response.data.template || "");
            toast.success("Email template loaded successfully.");
          } else {
            setTemplate("");
            toast.info("No existing template found for this service and type.");
          }
        } catch (error) {
          console.error("Error fetching email template:", error);
          setTemplate("");
          toast.error("Failed to load email template.");
        }
      };

      fetchFormFields();
      setServiceDetails(dummyServiceDetails); // Replace with actual API if available
      if (selectedLetterType) {
        fetchEmailTemplate();
      }
    }, [selectedServiceId, selectedLetterType]);

    const insertVariable = (variable) => {
      const quillEditor = document.querySelector(".ql-editor");
      const cursorPosition = quillEditor?.selectionStart || template.length;
      setTemplate((prev) => {
        return (
          prev.slice(0, cursorPosition) +
          `{${variable}}` +
          prev.slice(cursorPosition)
        );
      });
    };

    const handleTemplateChange = (content) => {
      setTemplate(content);
    };

    const generateEmailHtml = () => {
      let output = template;
      const allVariables = [...formFields, ...Object.keys(serviceDetails)];
      allVariables.forEach((variable) => {
        output = output.replace(
          new RegExp(`{${variable}}`, "g"),
          dummyServiceDetails[variable] || `{${variable}}`,
        );
      });
      const currentDate = new Date("2025-07-15T13:41:00+05:30");
      const formattedDate = currentDate.toLocaleString("en-US", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
        timeZone: "Asia/Kolkata",
      });
      output = output.replace(new RegExp("{Date}", "g"), formattedDate);

      const html = `
        <div style='font-family: Arial, sans-serif;'>
          ${output}
          <br />
          <p style='font-size: 12px; color: #888;'>Thank you,<br />Your Application Team</p>
        </div>
      `;
      setHtmlOutput(html);
      toast.success("Email template updated!");
    };

    const handleSaveTemplate = async () => {
      if (!selectedServiceId || !selectedLetterType || !template) {
        toast.error(
          "Please select a service, email type, and enter a template.",
        );
        return;
      }

      const formData = new FormData();
      formData.append("serviceId", selectedServiceId);
      formData.append("type", selectedLetterType);
      formData.append("template", template);

      try {
        const response = await axiosInstance.post(
          "/Designer/SaveEmailTemplate",
          formData,
        );
        if (response.data.status) {
          toast.success("Email template saved successfully!");
        } else {
          toast.error("Failed to save email template.");
        }
      } catch (error) {
        console.error("Error saving email template:", error);
        toast.error("An error occurred while saving the email template.");
      }
    };

    return (
      <Box sx={{ p: 4, maxWidth: 1200, mx: "auto" }}>
        <Typography
          variant="h4"
          align="center"
          sx={{ fontWeight: "bold", color: "primary.main", mb: 3 }}
        >
          Dynamic Email Template Generator
        </Typography>
        <Row>
          <Col md={6}>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel id="service-select-label">Select Service</InputLabel>
              <Select
                labelId="service-select-label"
                value={selectedServiceId}
                label="Select Service"
                onChange={(e) => setSelectedServiceId(e.target.value)}
              >
                <MenuItem value="" disabled>
                  Select a Service
                </MenuItem>
                {services.map((service) => (
                  <MenuItem key={service.serviceId} value={service.serviceId}>
                    {service.serviceName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel id="letter-type-select-label">
                Select Email Type
              </InputLabel>
              <Select
                labelId="letter-type-select-label"
                value={selectedLetterType}
                label="Select Email Type"
                onChange={(e) => setSelectedLetterType(e.target.value)}
                disabled={!selectedServiceId}
              >
                <MenuItem value="" disabled>
                  Select an Email Type
                </MenuItem>
                <MenuItem value="Submission">Application Submission</MenuItem>
                <MenuItem value="OfficerAction">Officer Action</MenuItem>
              </Select>
            </FormControl>
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                Template (Use formatting and insert variables like{" "}
                {"{FirstName}"}, {"{OfficerRole}"}, {"{Date}"})
              </Typography>
              <ReactQuill
                value={template}
                onChange={handleTemplateChange}
                modules={{
                  toolbar: [
                    [{ header: [1, 2, false] }],
                    ["bold", "italic", "underline", "strike"],
                    [{ list: "ordered" }, { list: "bullet" }],
                    ["link"],
                  ],
                }}
                formats={[
                  "header",
                  "bold",
                  "italic",
                  "underline",
                  "strike",
                  "list",
                  "bullet",
                  "link",
                ]}
                style={{
                  height: "300px",
                  marginBottom: "16px",
                  backgroundColor: "#f5f5f5",
                }}
                readOnly={!selectedServiceId || !selectedLetterType}
              />
            </Box>
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                Insert Variable
              </Typography>
              <Select
                value=""
                onChange={(e) => insertVariable(e.target.value)}
                displayEmpty
                disabled={!selectedServiceId || !selectedLetterType}
                sx={{ mr: 2 }}
              >
                <MenuItem value="" disabled>
                  Select Variable
                </MenuItem>
                {[...formFields, ...Object.keys(serviceDetails), "Date"].map(
                  (field) => (
                    <MenuItem key={field} value={field}>
                      {field}
                    </MenuItem>
                  ),
                )}
              </Select>
            </Box>
            <Box sx={{ display: "flex", gap: 2 }}>
              <Button
                variant="contained"
                color="primary"
                onClick={generateEmailHtml}
                disabled={!selectedServiceId || !selectedLetterType}
              >
                Generate Email
              </Button>
              <Button
                variant="contained"
                color="success"
                onClick={handleSaveTemplate}
                disabled={!selectedServiceId || !selectedLetterType}
              >
                Save Template
              </Button>
            </Box>
          </Col>
          <Col md={6}>
            <Typography
              variant="h5"
              sx={{ color: "grey.800", mb: 2, fontWeight: "bold" }}
            >
              Email Preview
            </Typography>
            {htmlOutput ? (
              <Paper elevation={1} sx={{ p: 2, mb: 2, bgcolor: "#f5f5f5" }}>
                <div dangerouslySetInnerHTML={{ __html: htmlOutput }} />
              </Paper>
            ) : (
              <Typography variant="body1" sx={{ color: "grey.600", mt: 2 }}>
                Edit the template to preview the email.
              </Typography>
            )}
            {htmlOutput && (
              <>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Generated HTML
                </Typography>
                <Paper elevation={1} sx={{ p: 2, bgcolor: "#f5f5f5" }}>
                  <pre style={{ whiteSpace: "pre-wrap", fontSize: "14px" }}>
                    {htmlOutput}
                  </pre>
                </Paper>
              </>
            )}
          </Col>
        </Row>
      </Box>
    );
  };

  // Email Settings Component
  const EmailSettings = () => {
    const {
      control,
      handleSubmit,
      formState: { errors },
    } = useForm({
      defaultValues: {
        SenderName: "Social Welfare Department",
        SenderEmail: "websiterandom24@gmail.com",
        SmtpServer: "smtp.gmail.com",
        SmtpPort: 587,
        Password: "uuku vmsm auwi livn",
      },
      mode: "onChange",
    });

    const onSubmit = (data) => {
      try {
        sessionStorage.setItem("emailSettings", JSON.stringify(data));
        toast.success("Settings saved successfully!");
      } catch (error) {
        toast.error("An error occurred while saving settings.");
        console.error(error);
      }
    };

    return (
      <Box sx={{ p: 4, maxWidth: 500, mx: "auto" }}>
        <Typography
          variant="h4"
          align="center"
          sx={{ fontWeight: "bold", color: "primary.main", mb: 3 }}
        >
          Email Settings
        </Typography>
        <Box
          component="form"
          onSubmit={handleSubmit(onSubmit)}
          sx={{ display: "flex", flexDirection: "column", gap: 2 }}
        >
          <Controller
            name="SenderName"
            control={control}
            rules={{ required: "Sender Name is required" }}
            render={({ field }) => (
              <TextField
                {...field}
                label="Sender Name"
                variant="outlined"
                fullWidth
                error={!!errors.SenderName}
                helperText={errors.SenderName?.message}
              />
            )}
          />
          <Controller
            name="SenderEmail"
            control={control}
            rules={{
              required: "Sender Email is required",
              pattern: {
                value: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
                message: "Invalid email address",
              },
            }}
            render={({ field }) => (
              <TextField
                {...field}
                label="Sender Email"
                type="email"
                variant="outlined"
                fullWidth
                error={!!errors.SenderEmail}
                helperText={errors.SenderEmail?.message}
              />
            )}
          />
          <Controller
            name="SmtpServer"
            control={control}
            rules={{ required: "SMTP Server is required" }}
            render={({ field }) => (
              <TextField
                {...field}
                label="SMTP Server"
                variant="outlined"
                fullWidth
                error={!!errors.SmtpServer}
                helperText={errors.SmtpServer?.message}
              />
            )}
          />
          <Controller
            name="SmtpPort"
            control={control}
            rules={{
              required: "SMTP Port is required",
              min: { value: 1, message: "Port must be greater than 0" },
              max: { value: 65535, message: "Port must be less than 65536" },
            }}
            render={({ field }) => (
              <TextField
                {...field}
                label="SMTP Port"
                type="number"
                variant="outlined"
                fullWidth
                error={!!errors.SmtpPort}
                helperText={errors.SmtpPort?.message}
              />
            )}
          />
          <Controller
            name="Password"
            control={control}
            rules={{ required: "Password is required" }}
            render={({ field }) => (
              <TextField
                {...field}
                label="Password"
                type="password"
                variant="outlined"
                fullWidth
                error={!!errors.Password}
                helperText={errors.Password?.message}
              />
            )}
          />
          <Button
            type="submit"
            variant="contained"
            color="primary"
            size="large"
            sx={{ mt: 2, py: 1.5, fontWeight: "medium" }}
          >
            Save Settings
          </Button>
        </Box>
      </Box>
    );
  };

  // =====================================================================
  // Dynamic Notification Rules: per service + action, choose channel,
  // recipients (citizen + location-bound workflow officers) and templates.
  // =====================================================================
  const ACTIONS = [
    "Submission",
    "Resubmission",
    "Sanction",
    "Reject",
    "Forward",
    "ReturnToCitizen",
    "ReturnToPlayer",
    "OfficerAction",
  ];

  const NotificationRules = () => {
    const [services, setServices] = useState([]);
    const [steps, setSteps] = useState([]);
    const [formFields, setFormFields] = useState([]);
    const [config, setConfig] = useState({});

    const [selectedServiceId, setSelectedServiceId] = useState("");
    const [selectedAction, setSelectedAction] = useState("");

    const [channel, setChannel] = useState("Email");
    const [recipients, setRecipients] = useState([]); // ["Citizen", "WorkflowStep:0", ...]
    const [emailSubject, setEmailSubject] = useState("");
    const [emailTemplate, setEmailTemplate] = useState("");
    const [smsTemplate, setSmsTemplate] = useState("");

    useEffect(() => {
      const fetchServices = async () => {
        try {
          const response = await axiosInstance.get("/Base/GetServices");
          if (response.data.status && response.data.services)
            setServices(response.data.services);
        } catch (error) {
          console.error("Error fetching services:", error);
        }
      };
      fetchServices();
    }, []);

    useEffect(() => {
      if (!selectedServiceId) {
        setSteps([]);
        setConfig({});
        setRecipients([]);
        setEmailTemplate("");
        setSmsTemplate("");
        return;
      }
      axiosInstance
        .get("/Designer/GetServiceWorkflowSteps", {
          params: { serviceId: selectedServiceId },
        })
        .then((r) => setSteps(r.data.steps || []))
        .catch(console.error);
      axiosInstance
        .get("/Designer/GetFormElementsForEmail", {
          params: { serviceId: selectedServiceId },
        })
        .then((r) => setFormFields(r.data.names || []))
        .catch(console.error);
      axiosInstance
        .get("/Designer/GetNotificationConfig", {
          params: { serviceId: selectedServiceId },
        })
        .then((r) => setConfig(r.data.config || {}))
        .catch(console.error);
    }, [selectedServiceId]);

    // Load the selected action's rule into the form.
    useEffect(() => {
      if (!selectedAction) return;
      const rule = config[selectedAction] || {};
      setChannel(rule.channel || "Email");
      setEmailSubject(rule.emailSubject || "");
      setEmailTemplate(rule.emailTemplate || "");
      setSmsTemplate(rule.smsTemplate || "");
      setRecipients(
        (rule.recipients || []).map((r) =>
          r.type === "WorkflowStep" ? `${r.type}:${r.step}` : r.type,
        ),
      );
    }, [selectedAction, config]);

    const recipientOptions = [
      { value: "Citizen", label: "Citizen (Applicant)" },
      { value: "ActingOfficer", label: "Acting Officer" },
      ...steps.map((s) => ({
        value: `WorkflowStep:${s.step}`,
        label: `${s.designation}${s.accessLevel ? ` (${s.accessLevel}, for this application)` : " (for this application)"}`,
      })),
    ];

    const toggleRecipient = (value) =>
      setRecipients((prev) =>
        prev.includes(value)
          ? prev.filter((v) => v !== value)
          : [...prev, value],
      );

    const buildRule = () => ({
      channel,
      emailSubject,
      emailTemplate,
      smsTemplate,
      recipients: recipients
        .map((r) => {
          if (r.startsWith("WorkflowStep:"))
            return { type: "WorkflowStep", step: Number(r.split(":")[1]) };
          return { type: r };
        })
        .filter((r) => (r.type === "WorkflowStep" ? !Number.isNaN(r.step) : true)),
    });

    const handleSave = async () => {
      if (!selectedServiceId || !selectedAction) {
        toast.error("Please select a service and an action.");
        return;
      }
      try {
        const formData = new FormData();
        formData.append("serviceId", selectedServiceId);
        formData.append("action", selectedAction);
        formData.append("rule", JSON.stringify(buildRule()));
        const response = await axiosInstance.post(
          "/Designer/SaveNotificationConfig",
          formData,
        );
        if (response.data.status) {
          toast.success("Notification rule saved.");
          const res = await axiosInstance.get("/Designer/GetNotificationConfig", {
            params: { serviceId: selectedServiceId },
          });
          setConfig(res.data.config || {});
        } else {
          toast.error(response.data.message || "Failed to save.");
        }
      } catch (error) {
        console.error("Error saving notification config:", error);
        toast.error("An error occurred while saving.");
      }
    };

    const variables = [
      ...new Set([
        ...formFields,
        "ApplicantName",
        "ServiceName",
        "ReferenceNumber",
        "OfficerRole",
        "OfficerArea",
        "ActionTaken",
        "Date",
      ]),
    ];

    return (
      <Box sx={{ maxWidth: 1200, mx: "auto" }}>
        <Row>
          <Col md={6}>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel id="n-svc">Select Service</InputLabel>
              <Select
                labelId="n-svc"
                value={selectedServiceId}
                label="Select Service"
                onChange={(e) => {
                  setSelectedServiceId(e.target.value);
                  setSelectedAction("");
                }}
              >
                <MenuItem value="" disabled>
                  Select a Service
                </MenuItem>
                {services.map((s) => (
                  <MenuItem key={s.serviceId} value={s.serviceId}>
                    {s.serviceName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel id="n-action">Select Action</InputLabel>
              <Select
                labelId="n-action"
                value={selectedAction}
                label="Select Action"
                disabled={!selectedServiceId}
                onChange={(e) => setSelectedAction(e.target.value)}
              >
                <MenuItem value="" disabled>
                  Select an Action
                </MenuItem>
                {ACTIONS.map((a) => (
                  <MenuItem key={a} value={a}>
                    {a}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
              Channel
            </Typography>
            <RadioGroup row value={channel} onChange={(e) => setChannel(e.target.value)}>
              <FormControlLabel value="Email" control={<Radio />} label="Email only" />
              <FormControlLabel value="Sms" control={<Radio />} label="SMS only" />
              <FormControlLabel value="Both" control={<Radio />} label="Email + SMS" />
              <FormControlLabel value="None" control={<Radio />} label="None" />
            </RadioGroup>

            <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
              Send To
            </Typography>
            <FormGroup>
              {recipientOptions.map((opt) => (
                <FormControlLabel
                  key={opt.value}
                  control={
                    <Checkbox
                      checked={recipients.includes(opt.value)}
                      onChange={() => toggleRecipient(opt.value)}
                    />
                  }
                  label={opt.label}
                />
              ))}
            </FormGroup>
            {steps.length === 0 && (
              <FormHelperText>
                No officer steps found yet for this service (add an application
                with its workflow to see them).
              </FormHelperText>
            )}

            <TextField
              label="Email Subject"
              fullWidth
              sx={{ my: 2 }}
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
            />
          </Col>

          <Col md={6}>
            <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
              Email Template
            </Typography>
            <ReactQuill
              value={emailTemplate}
              onChange={setEmailTemplate}
              modules={{
                toolbar: [
                  [{ header: [1, 2, false] }],
                  ["bold", "italic", "underline", "strike"],
                  [{ list: "ordered" }, { list: "bullet" }],
                  ["link"],
                ],
              }}
              formats={[
                "header", "bold", "italic", "underline", "strike",
                "list", "bullet", "link",
              ]}
              style={{ height: "220px", marginBottom: "12px", backgroundColor: "#f5f5f5" }}
            />
            <Box sx={{ mb: 3 }}>
              <FormControl size="small" sx={{ minWidth: 220 }}>
                <InputLabel id="var-email">Insert into Email</InputLabel>
                <Select
                  labelId="var-email"
                  label="Insert into Email"
                  value=""
                  onChange={(e) => {
                    if (e.target.value) setEmailTemplate((t) => t + `{${e.target.value}}`);
                  }}
                >
                  <MenuItem value="" disabled>
                    Select variable
                  </MenuItem>
                  {variables.map((f) => (
                    <MenuItem key={f} value={f}>
                      {f}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
              SMS Template (plain text)
            </Typography>
            <TextField
              multiline
              minRows={4}
              fullWidth
              value={smsTemplate}
              onChange={(e) => setSmsTemplate(e.target.value)}
              placeholder="e.g. Dear {ApplicantName}, your application {ReferenceNumber} has been {ActionTaken}. - SWD"
              sx={{ mb: 1, backgroundColor: "#f5f5f5" }}
            />
            <Box sx={{ mb: 3 }}>
              <FormControl size="small" sx={{ minWidth: 220 }}>
                <InputLabel id="var-sms">Insert into SMS</InputLabel>
                <Select
                  labelId="var-sms"
                  label="Insert into SMS"
                  value=""
                  onChange={(e) => {
                    if (e.target.value) setSmsTemplate((t) => t + `{${e.target.value}}`);
                  }}
                >
                  <MenuItem value="" disabled>
                    Select variable
                  </MenuItem>
                  {variables.map((f) => (
                    <MenuItem key={f} value={f}>
                      {f}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            <Button
              variant="contained"
              color="success"
              onClick={handleSave}
              disabled={!selectedServiceId || !selectedAction}
            >
              Save Notification Rule
            </Button>
          </Col>
        </Row>
      </Box>
    );
  };

  // =====================================================================
  // SMS provider settings (generic — plug in any provider's credentials).
  // =====================================================================
  const SmsSettings = () => {
    const {
      control,
      handleSubmit,
      reset,
      formState: { errors },
    } = useForm({
      defaultValues: {
        providername: "",
        apiurl: "",
        httpmethod: "POST",
        apikey: "",
        keylocation: "header",
        keyname: "authkey",
        senderid: "",
        bodytemplate: "",
        successindicator: "",
        enabled: false,
      },
      mode: "onChange",
    });

    useEffect(() => {
      axiosInstance
        .get("/Designer/GetSmsSettings")
        .then((r) => {
          if (r.data.settings)
            reset({
              providername: r.data.settings.providername || "",
              apiurl: r.data.settings.apiurl || "",
              httpmethod: r.data.settings.httpmethod || "POST",
              apikey: "",
              keylocation: r.data.settings.keylocation || "header",
              keyname: r.data.settings.keyname || "authkey",
              senderid: r.data.settings.senderid || "",
              bodytemplate: r.data.settings.bodytemplate || "",
              successindicator: r.data.settings.successindicator || "",
              enabled: !!r.data.settings.enabled,
            });
        })
        .catch(console.error);
    }, [reset]);

    const onSubmit = async (data) => {
      try {
        const formData = new FormData();
        formData.append("providername", data.providername);
        formData.append("apiurl", data.apiurl);
        formData.append("httpmethod", data.httpmethod);
        formData.append("apikey", data.apikey);
        formData.append("keylocation", data.keylocation);
        formData.append("keyname", data.keyname);
        formData.append("senderid", data.senderid);
        formData.append("bodytemplate", data.bodytemplate);
        formData.append("successindicator", data.successindicator);
        formData.append("enabled", String(data.enabled));
        const response = await axiosInstance.post(
          "/Designer/SaveSmsSettings",
          formData,
        );
        if (response.data.status) toast.success("SMS settings saved.");
        else toast.error(response.data.message);
      } catch (error) {
        console.error(error);
        toast.error("An error occurred while saving SMS settings.");
      }
    };

    return (
      <Box sx={{ maxWidth: 700, mx: "auto" }}>
        <Alert severity="info" sx={{ mb: 2 }}>
          Generic SMS provider — endpoint, API key, sender id and request-body
          template are stored here. When you get real credentials, fill this
          form; no code change is needed. Sending stays <b>disabled</b> (log-only)
          until you toggle it on.
        </Alert>
        <Box component="form" onSubmit={handleSubmit(onSubmit)} sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Controller
            name="providername"
            control={control}
            render={({ field }) => (
              <TextField {...field} label="Provider Name (e.g. Msg91, Fast2SMS)" variant="outlined" fullWidth />
            )}
          />
          <Controller
            name="apiurl"
            control={control}
            render={({ field }) => (
              <TextField {...field} label="API URL / Endpoint" variant="outlined" fullWidth />
            )}
          />
          <Row>
            <Col md={6}>
              <FormControl fullWidth>
                <InputLabel id="sms-method">HTTP Method</InputLabel>
                <Controller
                  name="httpmethod"
                  control={control}
                  render={({ field }) => (
                    <Select {...field} labelId="sms-method" label="HTTP Method">
                      <MenuItem value="POST">POST</MenuItem>
                      <MenuItem value="GET">GET</MenuItem>
                    </Select>
                  )}
                />
              </FormControl>
            </Col>
            <Col md={6}>
              <Controller
                name="keyname"
                control={control}
                render={({ field }) => (
                  <TextField {...field} label="API Key Name (header/query param)" variant="outlined" fullWidth />
                )}
              />
            </Col>
          </Row>
          <Row>
            <Col md={6}>
              <FormControl fullWidth>
                <InputLabel id="sms-keyloc">Key Location</InputLabel>
                <Controller
                  name="keylocation"
                  control={control}
                  render={({ field }) => (
                    <Select {...field} labelId="sms-keyloc" label="Key Location">
                      <MenuItem value="header">Header</MenuItem>
                      <MenuItem value="query">Query string</MenuItem>
                      <MenuItem value="body">Request body</MenuItem>
                    </Select>
                  )}
                />
              </FormControl>
            </Col>
            <Col md={6}>
              <Controller
                name="senderid"
                control={control}
                render={({ field }) => (
                  <TextField {...field} label="Sender ID" variant="outlined" fullWidth />
                )}
              />
            </Col>
          </Row>
          <Controller
            name="apikey"
            control={control}
            render={({ field }) => (
              <TextField {...field} label="API Key (leave blank to keep existing key)" type="password" variant="outlined" fullWidth />
            )}
          />
          <Controller
            name="bodytemplate"
            control={control}
            render={({ field }) => (
              <TextField {...field} label="Request Body Template ({to} {message} {senderid} {apikey})" variant="outlined" fullWidth multiline minRows={2} />
            )}
          />
          <Controller
            name="successindicator"
            control={control}
            render={({ field }) => (
              <TextField {...field} label="Success Indicator (substring in successful response; optional)" variant="outlined" fullWidth />
            )}
          />
          <Controller
            name="enabled"
            control={control}
            render={({ field }) => (
              <FormControlLabel
                control={<Switch checked={!!field.value} onChange={(e) => field.onChange(e.target.checked)} />}
                label="Enable SMS sending (when disabled, sends are simulated/logged)"
              />
            )}
          />
          <Button type="submit" variant="contained" color="primary" size="large" sx={{ mt: 1 }}>
            Save SMS Settings
          </Button>
        </Box>
      </Box>
    );
  };

  return (
    <Box sx={{ width: "100%", minHeight: "100vh", bgcolor: "grey.100", p: 2 }}>
      <GovPageHeader
        title="Notification Settings"
        hindiTitle="सूचना सेटिंग्स"
        crumbs={[
          { label: "Designer", path: "/designer/dashboard" },
          { label: "Notification Settings", path: "" },
        ]}
      />
      <Tabs value={tabValue} onChange={handleTabChange} centered sx={{ mb: 2 }}>
        <Tab label="Notification Rules" />
        <Tab label="SMS Settings" />
        <Tab label="Email Template Generator" />
        <Tab label="Email Settings" />
      </Tabs>
      {tabValue === 0 && <NotificationRules />}
      {tabValue === 1 && <SmsSettings />}
      {tabValue === 2 && <DynamicEmailTemplateGenerator />}
      {tabValue === 3 && <EmailSettings />}
      <ToastContainer position="top-right" autoClose={3000} />
    </Box>
  );
}
