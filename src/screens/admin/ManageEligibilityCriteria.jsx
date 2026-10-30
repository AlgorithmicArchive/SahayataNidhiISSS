import React, { useEffect, useState, useMemo } from "react";
import {
  Card,
  Row,
  Col,
  Table,
  Button,
  Modal,
  Form,
  Spinner,
  Alert,
  Badge,
  InputGroup,
  Dropdown,
} from "react-bootstrap";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import VisibilityIcon from "@mui/icons-material/Visibility";
import SearchIcon from "@mui/icons-material/Search";
import RefreshIcon from "@mui/icons-material/Refresh";
import { toast } from "react-toastify";
import axiosInstance from "../../axiosConfig";

const API_BASE = window.__CONFIG__?.API_URL || "";
const ADMIN_API = `${API_BASE}/Admin`;

// Built from the expiration_types table. A criterion:
//  - conditionField: JSON object, e.g. { "KindOfDisability": "Temporary" }
//  - basedOnField: true  -> the expiration date is read from valueField (date field)
//  - basedOnField: false -> the expiration date is approval_date + validityPeriod
const DEFAULT_FORM = {
  id: 0,
  serviceId: 0,
  typeCode: "",
  expirationName: "",
  description: "",
  conditionField: "",
  conditionFieldName: "",
  conditionValue: "",
  conditionEdited: false,
  basedOnField: true,
  valueField: "",
  validityPeriod: "1 year",
  reminderBefore: "",
  stopPaymentOnExpiry: false,
  stopPaymentGracePeriod: "",
  messageTemplate: "",
  isActive: true,
};

const VALIDITY_OPTIONS = [
  "1 year",
  "2 years",
  "3 years",
  "6 months",
  "1 month",
  "30 days",
  "15 days",
];

export default function ManageEligibilityCriteria() {
  const [services, setServices] = useState([]);
  const [criteria, setCriteria] = useState([]);
  const [formFields, setFormFields] = useState([]);
  const [selectedServiceId, setSelectedServiceId] = useState(0);
  const [loadingServices, setLoadingServices] = useState(false);
  const [loadingCriteria, setLoadingCriteria] = useState(false);
  const [loadingFields, setLoadingFields] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showFormModal, setShowFormModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [formData, setFormData] = useState({ ...DEFAULT_FORM });
  const [isEditing, setIsEditing] = useState(false);
  const [search, setSearch] = useState("");
  const [previewData, setPreviewData] = useState([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const loadServices = async () => {
    setLoadingServices(true);
    try {
      const json = (await axiosInstance.get("/Base/GetServices")).data;
      if (json && json.status) setServices(json.services || json.data || []);
      else toast.error(json.message || "Failed to load services");
    } catch (e) {
      console.error(e);
      toast.error("Error loading services");
    } finally {
      setLoadingServices(false);
    }
  };

  const loadCriteria = async (serviceId) => {
    if (!serviceId) {
      setCriteria([]);
      return;
    }
    setLoadingCriteria(true);
    setError("");
    try {
      const json = (
        await axiosInstance.get(
          `${ADMIN_API}/GetEligibilityCriteria?serviceId=${serviceId}`,
        )
      ).data;
      if (json && json.status) setCriteria(json.data || []);
      else setError(json.message || "Failed to load criteria");
    } catch (e) {
      console.error(e);
      setError("Error loading criteria");
    } finally {
      setLoadingCriteria(false);
    }
  };

  const loadFormFields = async (serviceId) => {
    if (!serviceId) {
      setFormFields([]);
      return;
    }
    setLoadingFields(true);
    try {
      const json = (
        await axiosInstance.get(
          `${ADMIN_API}/GetServiceFormFields?serviceId=${serviceId}`,
        )
      ).data;
      if (json && json.status) setFormFields(json.fields || []);
      else setFormFields([]);
    } catch (e) {
      console.error(e);
      setFormFields([]);
    } finally {
      setLoadingFields(false);
    }
  };

  useEffect(() => {
    loadServices();
  }, []);
  useEffect(() => {
    if (selectedServiceId) {
      loadCriteria(selectedServiceId);
      loadFormFields(selectedServiceId);
    } else {
      setCriteria([]);
      setFormFields([]);
    }
  }, [selectedServiceId]);

  // Group fields by section label returned from the backend ({ path, name, section, type, isAdditional })
  const groupedFields = useMemo(() => {
    const groups = {};
    formFields.forEach((f) => {
      const grp = f.section || "Other";
      if (!groups[grp]) groups[grp] = [];
      groups[grp].push(f);
    });
    return groups;
  }, [formFields]);

  const filteredCriteria = useMemo(() => {
    if (!search) return criteria;
    const s = search.toLowerCase();
    return criteria.filter(
      (c) =>
        (c.criterionName || c.expirationName || "").toLowerCase().includes(s) ||
        (c.typeCode || "").toLowerCase().includes(s) ||
        (c.conditionField || "").toLowerCase().includes(s),
    );
  }, [criteria, search]);

  const parseCondition = (raw) => {
    try {
      if (!raw) return { obj: {}, name: "", value: "", raw: "" };
      const obj = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (!obj || typeof obj !== "object")
        return { obj: {}, name: "", value: "", raw: "" };
      const keys = Object.keys(obj);
      if (keys.length === 0)
        return {
          obj,
          name: "",
          value: "",
          raw: typeof raw === "string" ? raw : JSON.stringify(obj),
        };
      const name = keys[0];
      return {
        obj,
        name,
        value: obj[name],
        raw: typeof raw === "string" ? raw : JSON.stringify(obj),
      };
    } catch {
      return { obj: {}, name: "", value: "", raw: "" };
    }
  };

  const renderConditionText = (raw) => {
    const { obj } = parseCondition(raw);
    const entries = Object.entries(obj || {});
    if (entries.length === 0)
      return <span className="text-muted">— Any applicant</span>;
    return (
      <span>
        {entries.map(([k, v], i) => (
          <span key={k}>
            {i > 0 ? <span className="text-muted"> AND </span> : null}
            <code>{k}</code>
            {v ? <span className="text-muted"> = </span> : null}
            <code>{v || ""}</code>
          </span>
        ))}
      </span>
    );
  };

  const renderBasisText = (c) => {
    if (c.basedOnField) {
      return (
        <span>
          Date field: <code>{c.valueField || "—"}</code>
        </span>
      );
    }
    return (
      <span>
        Valid for <Badge bg="info">{c.validityPeriod || "—"}</Badge> after
        sanction
      </span>
    );
  };

  const openCreate = () => {
    if (!selectedServiceId) {
      toast.warning("Please select a service first");
      return;
    }
    setFormData({ ...DEFAULT_FORM, serviceId: selectedServiceId });
    setIsEditing(false);
    setShowFormModal(true);
  };

  const openEdit = (c) => {
    const cond = parseCondition(c.conditionField);
    setFormData({
      id: c.id,
      serviceId: c.serviceId ?? selectedServiceId,
      typeCode: c.typeCode || "",
      expirationName: c.criterionName || c.expirationName || "",
      description: c.description || "",
      conditionField: cond.raw, // preserve the FULL condition JSON (multi-key) exactly as stored
      conditionFieldName: cond.name,
      conditionValue: cond.value,
      conditionEdited: false,
      basedOnField: c.basedOnField ?? true,
      valueField: c.valueField || "",
      validityPeriod: c.validityPeriod || "1 year",
      reminderBefore: c.reminderBefore || "",
      stopPaymentOnExpiry: c.stopPaymentOnExpiry ?? false,
      stopPaymentGracePeriod: c.stopPaymentGracePeriod || "",
      messageTemplate: c.messageTemplate || "",
      isActive: c.isActive ?? true,
    });
    setIsEditing(true);
    setShowFormModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Preserve the original condition JSON (including multi-key conditions) unless the user
      // actually modified the condition field name/value in this modal session.
      let conditionField = formData.conditionField || "";
      if (formData.conditionEdited) {
        conditionField = formData.conditionFieldName
          ? JSON.stringify({
              [formData.conditionFieldName]: formData.conditionValue || "",
            })
          : "";
      }

      const payload = {
        id: formData.id,
        serviceId: formData.serviceId,
        typeCode: formData.typeCode,
        expirationName: formData.expirationName,
        description: formData.description,
        conditionField,
        basedOnField: formData.basedOnField,
        valueField: formData.valueField,
        validityPeriod: formData.validityPeriod,
        reminderBefore: formData.reminderBefore,
        stopPaymentOnExpiry: formData.stopPaymentOnExpiry,
        stopPaymentGracePeriod: formData.stopPaymentGracePeriod,
        messageTemplate: formData.messageTemplate,
        isActive: formData.isActive,
      };

            const url = isEditing
        ? `${ADMIN_API}/UpdateEligibilityCriteria/${formData.id}`
        : `${ADMIN_API}/CreateEligibilityCriteria`;
      const json = (
        await axiosInstance.request({
          url,
          method: isEditing ? "PUT" : "POST",
          data: payload,
        })
      ).data;
      if (json.status) {
        toast.success(json.message || "Saved successfully");
        setShowFormModal(false);
        await loadCriteria(selectedServiceId);
      } else {
        toast.error(json.message || "Save failed");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error saving criterion");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (c) => {
    if (
      !window.confirm(
        `Deactivate criterion "${c.criterionName || c.expirationName}"?`,
      )
    )
      return;
        try {
      const json = (
        await axiosInstance.delete(
          `${ADMIN_API}/DeleteEligibilityCriteria/${c.id}`
        )
      ).data;
      if (json.status) {
        toast.success("Deactivated");
        await loadCriteria(selectedServiceId);
      } else toast.error(json.message || "Delete failed");
    } catch (err) {
      console.error(err);
      toast.error("Error deleting criterion");
    }
  };

  const handlePreview = async (c) => {
    setShowPreviewModal(true);
    setLoadingPreview(true);
    setPreviewData([]);
        try {
      const json = (
        await axiosInstance.get(
          `${ADMIN_API}/PreviewEligibilityCriteria?serviceId=${c.serviceId ?? selectedServiceId}&criteriaId=${c.id}`
        )
      ).data;
      if (json.status) setPreviewData(json.data || []);
      else toast.error(json.message || "Preview failed");
    } catch (err) {
      console.error(err);
      toast.error("Error loading preview");
    } finally {
      setLoadingPreview(false);
    }
  };

  const formatDate = (d) => {
    if (!d) return "N/A";
    try {
      return new Date(d).toLocaleDateString();
    } catch {
      return d;
    }
  };
  return (
    <div className="container-fluid py-3">
      <Card className="shadow-sm">
        <Card.Header className="d-flex justify-content-between align-items-center flex-wrap">
          <h4 className="mb-0">Eligibility Criteria Management</h4>
          <Button variant="outline-secondary" onClick={loadServices}>
            <RefreshIcon fontSize="small" /> Refresh Services
          </Button>
        </Card.Header>
        <Card.Body>
          {error && <Alert variant="danger">{error}</Alert>}

          <Row className="mb-3 align-items-end">
            <Col md={6}>
              <Form.Label>Service</Form.Label>
              <Form.Select
                value={selectedServiceId}
                onChange={(e) => setSelectedServiceId(Number(e.target.value))}
                disabled={loadingServices}
              >
                <option value={0}>-- Select a service --</option>
                {services.map((s) => (
                  <option key={s.serviceId ?? s.id} value={s.serviceId ?? s.id}>
                    {s.serviceName || s.nameShort}
                  </option>
                ))}
              </Form.Select>
            </Col>
            <Col md={4}>
              <InputGroup>
                <InputGroup.Text>
                  <SearchIcon fontSize="small" />
                </InputGroup.Text>
                <Form.Control
                  placeholder="Search criteria..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </InputGroup>
            </Col>
            <Col md={2} className="text-end">
              <Button
                variant="primary"
                onClick={openCreate}
                disabled={!selectedServiceId}
              >
                + New Criterion
              </Button>
            </Col>
          </Row>

          {loadingCriteria ? (
            <div className="text-center py-4">
              <Spinner animation="border" />
            </div>
          ) : (
            <Table striped bordered hover responsive>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name / Type Code</th>
                  <th>Condition</th>
                  <th>Expiration Basis</th>
                  <th>Reminder</th>
                  <th>Stop Payment</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCriteria.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center text-muted">
                      {selectedServiceId
                        ? "No criteria defined yet for this service."
                        : "Select a service to view its criteria."}
                    </td>
                  </tr>
                ) : (
                  filteredCriteria.map((c, idx) => (
                    <tr key={c.id}>
                      <td>{idx + 1}</td>
                      <td>
                        <div className="fw-semibold">
                          {c.criterionName || c.expirationName}
                        </div>
                        <Badge bg="secondary">{c.typeCode}</Badge>
                        {c.description && (
                          <div className="text-muted small">
                            {c.description}
                          </div>
                        )}
                      </td>
                      <td>{renderConditionText(c.conditionField)}</td>
                      <td>{renderBasisText(c)}</td>
                      <td>{c.reminderBefore || "—"}</td>
                      <td>
                        {c.stopPaymentOnExpiry ? (
                          <Badge bg="danger">Yes</Badge>
                        ) : (
                          <span>No</span>
                        )}
                      </td>
                      <td>
                        {c.isActive ? (
                          <Badge bg="success">Active</Badge>
                        ) : (
                          <Badge bg="secondary">Inactive</Badge>
                        )}
                      </td>
                      <td>
                        <Button
                          size="sm"
                          variant="outline-info"
                          className="me-1"
                          onClick={() => handlePreview(c)}
                          title="Preview"
                        >
                          <VisibilityIcon fontSize="small" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline-primary"
                          className="me-1"
                          onClick={() => openEdit(c)}
                        >
                          <EditIcon fontSize="small" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline-danger"
                          className="me-1"
                          onClick={() => handleDelete(c)}
                        >
                          <DeleteIcon fontSize="small" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>
      <Modal
        show={showFormModal}
        onHide={() => setShowFormModal(false)}
        size="lg"
        backdrop="static"
      >
        <Form onSubmit={handleSubmit}>
          <Modal.Header closeButton>
            <Modal.Title>
              {isEditing
                ? "Edit Eligibility Criterion"
                : "Create Eligibility Criterion"}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Name *</Form.Label>
                  <Form.Control
                    required
                    placeholder="e.g. PCP UDID Card Expiry"
                    value={formData.expirationName}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        expirationName: e.target.value,
                      })
                    }
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Type Code *</Form.Label>
                  <Form.Control
                    required
                    placeholder="e.g. PCP_UDID_EXPIRY"
                    value={formData.typeCode}
                    onChange={(e) =>
                      setFormData({ ...formData, typeCode: e.target.value })
                    }
                  />
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Label>Description</Form.Label>
              <Form.Control
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />
            </Form.Group>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Condition Field (optional)</Form.Label>
                  <InputGroup>
                    <Form.Control
                      placeholder="e.g. KindOfDisability"
                      value={formData.conditionFieldName}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          conditionFieldName: e.target.value,
                          conditionEdited: true,
                        })
                      }
                    />
                    {formFields.length > 0 && (
                      <Dropdown>
                        <Dropdown.Toggle variant="outline-secondary">
                          Pick
                        </Dropdown.Toggle>
                        <Dropdown.Menu
                          style={{ maxHeight: 300, overflowY: "auto" }}
                        >
                          {Object.entries(groupedFields).map(([grp, items]) => (
                            <div key={grp}>
                              <Dropdown.Header>{grp}</Dropdown.Header>
                              {items.map((f) => (
                                <Dropdown.Item
                                  key={f.path}
                                  onClick={() =>
                                    setFormData({
                                      ...formData,
                                      conditionFieldName: f.name,
                                      conditionEdited: true,
                                    })
                                  }
                                >
                                  <code>{f.name}</code>
                                </Dropdown.Item>
                              ))}
                            </div>
                          ))}
                        </Dropdown.Menu>
                      </Dropdown>
                    )}
                  </InputGroup>
                  {loadingFields && (
                    <small className="text-muted">Loading fields...</small>
                  )}
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Condition Value</Form.Label>
                  <Form.Control
                    placeholder="e.g. Temporary"
                    value={formData.conditionValue}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        conditionValue: e.target.value,
                        conditionEdited: true,
                      })
                    }
                  />
                </Form.Group>
              </Col>
            </Row>
            <Form.Check
              type="switch"
              className="mb-3"
              label="Expiry comes from a date field in the application"
              checked={formData.basedOnField}
              onChange={(e) =>
                setFormData({ ...formData, basedOnField: e.target.checked })
              }
            />

            {formData.basedOnField ? (
              <Form.Group className="mb-3">
                <Form.Label>Date Field (holds the expiry date) *</Form.Label>
                <InputGroup>
                  <Form.Control
                    required
                    placeholder="e.g. UdidCardValidUpto"
                    value={formData.valueField}
                    onChange={(e) =>
                      setFormData({ ...formData, valueField: e.target.value })
                    }
                  />
                  {formFields.length > 0 && (
                    <Dropdown>
                      <Dropdown.Toggle variant="outline-secondary">
                        Pick
                      </Dropdown.Toggle>
                      <Dropdown.Menu
                        style={{ maxHeight: 300, overflowY: "auto" }}
                      >
                        {Object.entries(groupedFields).map(([grp, items]) => (
                          <div key={grp}>
                            <Dropdown.Header>{grp}</Dropdown.Header>
                            {items.map((f) => (
                              <Dropdown.Item
                                key={f.path}
                                onClick={() =>
                                  setFormData({
                                    ...formData,
                                    valueField: f.name,
                                  })
                                }
                              >
                                <code>{f.name}</code>
                              </Dropdown.Item>
                            ))}
                          </div>
                        ))}
                      </Dropdown.Menu>
                    </Dropdown>
                  )}
                </InputGroup>
                <Form.Text className="text-muted">
                  Tip: pick the date field that holds the expiry date (e.g.
                  "IfTemporaryDisabilityUdidCardValidUpto" under Pension Type).
                </Form.Text>
              </Form.Group>
            ) : (
              <Form.Group className="mb-3">
                <Form.Label>Validity Period (after sanction) *</Form.Label>
                <Form.Select
                  value={formData.validityPeriod}
                  onChange={(e) =>
                    setFormData({ ...formData, validityPeriod: e.target.value })
                  }
                >
                  {VALIDITY_OPTIONS.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </Form.Select>
                <Form.Text className="text-muted">
                  e.g. "1 year" = renewal every year after sanction
                  (life-expectancy pension).
                </Form.Text>
              </Form.Group>
            )}

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Reminder Before</Form.Label>
                  <Form.Select
                    value={formData.reminderBefore}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        reminderBefore: e.target.value,
                      })
                    }
                  >
                    <option value="">No reminder</option>
                    <option value="30 days">30 days</option>
                    <option value="60 days">60 days</option>
                    <option value="90 days">90 days</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Stop Payment Grace Period</Form.Label>
                  <Form.Control
                    placeholder="e.g. 15 days"
                    value={formData.stopPaymentGracePeriod}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        stopPaymentGracePeriod: e.target.value,
                      })
                    }
                  />
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Label>Message Template (used in expiry emails)</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                value={formData.messageTemplate}
                onChange={(e) =>
                  setFormData({ ...formData, messageTemplate: e.target.value })
                }
                placeholder="Dear {ApplicantName}, your {CertificateName} under ref {ReferenceNumber} expires on {ExpiryDate}."
              />
            </Form.Group>

            <Form.Check
              type="switch"
              className="mb-2"
              label="Stop payment on expiry"
              checked={formData.stopPaymentOnExpiry}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  stopPaymentOnExpiry: e.target.checked,
                })
              }
            />
            <Form.Check
              type="switch"
              label="Active"
              checked={formData.isActive}
              onChange={(e) =>
                setFormData({ ...formData, isActive: e.target.checked })
              }
            />
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowFormModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? <Spinner size="sm" /> : isEditing ? "Update" : "Create"}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
      <Modal
        show={showPreviewModal}
        onHide={() => setShowPreviewModal(false)}
        size="xl"
      >
        <Modal.Header closeButton>
          <Modal.Title>Matching Applications Preview</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {loadingPreview ? (
            <div className="text-center py-4">
              <Spinner animation="border" />
            </div>
          ) : previewData.length === 0 ? (
            <Alert variant="info">
              No matching applications found for this criterion.
            </Alert>
          ) : (
            <Table striped bordered hover responsive size="sm">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Reference #</th>
                  <th>Source Value</th>
                  <th>Expiration Date</th>
                  <th>Days Until Expiry</th>
                </tr>
              </thead>
              <tbody>
                {previewData.map((p, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td>{p.referenceNumber}</td>
                    <td>
                      <code>{p.matchingFieldValue}</code>
                    </td>
                    <td>{formatDate(p.expirationDate)}</td>
                    <td>
                      {p.daysUntilExpiry !== null &&
                      p.daysUntilExpiry !== undefined ? (
                        <Badge
                          bg={
                            p.daysUntilExpiry < 0
                              ? "danger"
                              : p.daysUntilExpiry < 30
                                ? "warning"
                                : "success"
                          }
                        >
                          {p.daysUntilExpiry} days
                        </Badge>
                      ) : (
                        "N/A"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setShowPreviewModal(false)}
          >
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
