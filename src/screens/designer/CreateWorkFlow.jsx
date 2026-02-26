import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
} from "@mui/material";
import { Container, Row, Col } from "react-bootstrap";
import {
  DndContext,
  closestCenter,
  useSensor,
  useSensors,
  PointerSensor,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { SortableItem } from "../../components/designer/SortableItem";
import PlayerEditModal from "../../components/designer/PlayerEditModal";
import axiosInstance from "../../axiosConfig";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import AddIcon from "@mui/icons-material/Add";
import SaveIcon from "@mui/icons-material/Save";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/DeleteOutline";

// UPDATED: Enhanced sanitizeActionForm with declaration support
const sanitizeActionForm = (actionForm) => {
  if (!Array.isArray(actionForm)) return [];

  return actionForm.map((field) => {
    const sanitizedField = {
      ...field,
      // Ensure all fields have basic properties
      id: field.id || `field-${Date.now()}`,
      name: field.name || `field_${Date.now()}`,
      label: field.label || "Unnamed Field",
      type: field.type || "text",
      span: field.span || 12,
      editable: field.editable ?? true,
      // Declaration-specific properties
      isConsentCheckbox: field.isConsentCheckbox || false,
      isDeclaration: field.isDeclaration || false,
      declaration: field.declaration || "",
      declarationFields: Array.isArray(field.declarationFields) ? field.declarationFields : [],
    };

    // Handle options
    if (field.options && Array.isArray(field.options)) {
      sanitizedField.options = field.options;
    } else {
      sanitizedField.options = [];
    }

    // Handle dependentOptions
    if (field.dependentOptions && typeof field.dependentOptions === 'object') {
      sanitizedField.dependentOptions = Object.fromEntries(
        Object.entries(field.dependentOptions).map(([key, opts]) => [
          key,
          Array.isArray(opts) ? opts : [],
        ])
      );
    }

    // Recursively sanitize additionalFields
    if (field.additionalFields && typeof field.additionalFields === 'object') {
      sanitizedField.additionalFields = Object.fromEntries(
        Object.entries(field.additionalFields).map(([key, fields]) => [
          key,
          Array.isArray(fields) ? fields.map(f => ({
            ...f,
            isConsentCheckbox: f.isConsentCheckbox || false,
            isDeclaration: f.isDeclaration || false,
            declaration: f.declaration || "",
            declarationFields: Array.isArray(f.declarationFields) ? f.declarationFields : [],
          })) : []
        ])
      );
    }

    return sanitizedField;
  });
};

// Button styles
const buttonStyles = {
  backgroundColor: "primary.main",
  color: "background.paper",
  fontWeight: 600,
  textTransform: "none",
  py: 1,
  px: 3,
  borderRadius: 2,
  "&:hover": {
    backgroundColor: "primary.dark",
    transform: "scale(1.02)",
    transition: "all 0.2s ease",
  },
};

// Form control styles
const formControlStyles = {
  "& .MuiOutlinedInput-root": {
    "& fieldset": { borderColor: "divider" },
    "&:hover fieldset": { borderColor: "primary.main" },
    "&.Mui-focused fieldset": {
      borderColor: "primary.main",
      borderWidth: "2px",
    },
    backgroundColor: "background.paper",
    color: "text.primary",
    borderRadius: 1,
  },
  "& .MuiInputLabel-root": {
    color: "text.secondary",
    "&.Mui-focused": { color: "primary.main" },
  },
  marginBottom: 2,
};

export default function CreateWorkflow() {
  const [players, setPlayers] = useState([]);
  const [newPlayer, setNewPlayer] = useState({
    playerId: 0,
    designation: "",
    accessLevel: "",
    canSanction: false,
    canReturnToPlayer: false,
    canReturnToCitizen: false,
    canForwardToPlayer: false,
    canReject: false,
    canPull: false,
    canHavePool: false,
    canCorrigendum: false,
    canManageBankFiles: false,
    canWithhold: false,
    canValidateAadhaar: false,
    customPermissions: [],
    actionForm: [],
    actionFormOptions: {
      canSanction: false,
      canReturnToPlayer: false,
      canReturnToCitizen: false,
      canForwardToPlayer: false,
      canReject: false,
      canWithhold: false,
      customPermissions: {},
    },
    prevPlayerId: null,
    nextPlayerId: null,
    status: "",
    completedAt: null,
    remarks: "",
  });

  const [services, setServices] = useState([]);
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState(null);

  const getDefaultActionFields = (player) => {
    const actionOptions = [];
    const optionsConfig = player.actionFormOptions || {
      canForwardToPlayer: player.canForwardToPlayer,
      canSanction: player.canSanction,
      canReturnToPlayer: player.canReturnToPlayer,
      canReturnToCitizen: player.canReturnToCitizen,
      canReject: player.canReject,
      canWithhold: player.canWithhold,
      customPermissions: player.customPermissions
        ? Object.fromEntries(
          player.customPermissions.map((perm) => [perm.name, perm.enabled])
        )
        : {},
    };
    if (optionsConfig.canForwardToPlayer && player.canForwardToPlayer) {
      let label = "Forward to Player";
      if (player.nextPlayerId !== null) {
        const nextPlayer = players.find(
          (p) => p.playerId === player.nextPlayerId
        );
        if (nextPlayer && nextPlayer.designation) {
          label = `Forward to ${nextPlayer.designation}`;
        }
      }
      actionOptions.push({ value: "Forward", label });
    }
    if (optionsConfig.canSanction && player.canSanction) {
      actionOptions.push({ value: "Sanction", label: "Sanction" });
    }
    if (optionsConfig.canReturnToPlayer && player.canReturnToPlayer) {
      let label = "Return to Player";
      if (player.prevPlayerId !== null) {
        const previousPlayer = players.find(
          (p) => p.playerId === player.prevPlayerId
        );
        if (previousPlayer && previousPlayer.designation) {
          label = `Return to ${previousPlayer.designation}`;
        }
      }
      actionOptions.push({ value: "ReturnToPlayer", label });
    }
    if (optionsConfig.canReturnToCitizen && player.canReturnToCitizen) {
      actionOptions.push({
        value: "ReturnToCitizen",
        label: "Return to Citizen",
      });
    }
    if (optionsConfig.canReject && player.canReject) {
      actionOptions.push({ value: "Reject", label: "Reject" });
    }
    if (optionsConfig.canWithhold && player.canWithhold) {
      actionOptions.push({ value: "Withhold", label: "Withhold" });
    }
    // Add custom permissions to action options
    if (optionsConfig.customPermissions) {
      player.customPermissions?.forEach((perm) => {
        if (perm.enabled && optionsConfig.customPermissions[perm.name]) {
          actionOptions.push({
            value: perm.name.replace("custom_", ""),
            label: perm.label,
          });
        }
      });
    }
    const defaultActionField = {
      id: `default-field-${Date.now()}`,
      type: "select",
      label: "Action",
      name: "defaultAction",
      minLength: 0,
      maxLength: 0,
      options: actionOptions,
      span: 12,
      validationFunctions: [],
      transformationFunctions: [],
      additionalFields: {},
      accept: "",
      isConsentCheckbox: false,
      declaration: "",
      declarationFields: [],
      isDeclaration: false,
    };
    const remarksField = {
      id: `remarks-field-${Date.now()}`,
      type: "text",
      label: "Remarks",
      name: "Remarks",
      minLength: 0,
      maxLength: 100,
      options: [],
      span: 12,
      validationFunctions: ["notEmpty", "onlyAlphabets"],
      transformationFunctions: [],
      additionalFields: {},
      accept: "",
      isConsentCheckbox: false,
      declaration: "",
      declarationFields: [],
      isDeclaration: false,
    };
    return [defaultActionField, remarksField];
  };

  const updateAllDefaultActionFields = () => {
    setPlayers((prevPlayers) =>
      prevPlayers.map((player) => {
        const defaultFields = getDefaultActionFields(player);
        const updatedActionForm = player.actionForm.map((field) => {
          if (field.name === "defaultAction") {
            const newActionField = defaultFields.find(
              (f) => f.name === "defaultAction"
            );
            if (newActionField) {
              return {
                ...field,
                options: newActionField.options,
                label: newActionField.label,
              };
            }
          }
          return field;
        });
        return { ...player, actionForm: updatedActionForm };
      })
    );
  };

  const removePlayer = (playerIdToRemove) => {
    const filteredPlayers = players.filter(
      (player) => player.playerId !== playerIdToRemove
    );
    const updatedPlayers = filteredPlayers.map((player, index) => ({
      ...player,
      playerId: index,
      prevPlayerId: index > 0 ? index - 1 : null,
      nextPlayerId: index < filteredPlayers.length - 1 ? index + 1 : null,
    }));
    setPlayers(updatedPlayers);
    updateAllDefaultActionFields();
  };

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await axiosInstance.get("/Base/GetServices");
        if (response.data.status && response.data.services) {
          setServices(response.data.services);
        }
      } catch (error) {
        console.error("Error fetching services:", error);
        toast.error("Failed to fetch services");
      }
    }
    fetchData();
  }, []);

  const handleServiceChange = (e) => {
    const serviceId = e.target.value;
    setSelectedServiceId(serviceId);
    const service = services.find((s) => s.serviceId === serviceId);
    if (service && service.officerEditableField) {
      try {
        const workflow = JSON.parse(service.officerEditableField);
        const updatedWorkflow = workflow.map((player) => ({
          ...player,
          accessLevel: player.accessLevel || "",
          customPermissions: player.customPermissions || [],
          actionForm: sanitizeActionForm(player.actionForm || []),
        }));
        setPlayers(updatedWorkflow);
      } catch (err) {
        console.error("Error parsing workflow:", err);
        setPlayers([]);
        toast.error("Error loading workflow");
      }
    } else {
      setPlayers([]);
    }
  };

  const addPlayer = () => {
    const newPlayerId = players.length;
    const updatedPlayers = players.map((player, index) =>
      index === players.length - 1
        ? { ...player, nextPlayerId: newPlayerId }
        : player
    );
    const newPlayerWithDefaultFields = {
      ...newPlayer,
      playerId: newPlayerId,
      prevPlayerId: newPlayerId > 0 ? newPlayerId - 1 : null,
      nextPlayerId: null,
      actionForm: sanitizeActionForm(getDefaultActionFields(newPlayer)),
    };
    setPlayers([...updatedPlayers, newPlayerWithDefaultFields]);
    setNewPlayer({
      designation: "",
      accessLevel: "",
      canSanction: false,
      canReturnToPlayer: false,
      canReturnToCitizen: false,
      canForwardToPlayer: false,
      canReject: false,
      canPull: false,
      canHavePool: false,
      canCorrigendum: false,
      canManageBankFiles: false,
      canWithhold: false,
      canValidateAadhaar: false,
      customPermissions: [],
      actionForm: [],
      actionFormOptions: {
        canSanction: false,
        canReturnToPlayer: false,
        canReturnToCitizen: false,
        canForwardToPlayer: false,
        canReject: false,
        canWithhold: false,
        customPermissions: {},
      },
      status: "",
      completedAt: null,
      remarks: "",
    });
    toast.success("New player added");
  };

  // UPDATED: saveWorkflow with declaration check
  const saveWorkflow = async () => {
    if (!selectedServiceId) {
      toast.error("Please select a service first.");
      return;
    }

    // Debug: Check for declaration data
    console.log("=== DEBUG: Checking declaration data before save ===");
    players.forEach((player, playerIndex) => {
      console.log(`\nPlayer ${playerIndex}: ${player.designation}`);

      // Check main actionForm
      player.actionForm?.forEach((field, fieldIndex) => {
        if (field.type === "checkbox" && field.isConsentCheckbox) {
          console.log(`  Main field ${fieldIndex}:`, {
            name: field.name,
            isConsentCheckbox: field.isConsentCheckbox,
            declaration: field.declaration?.substring(0, 100),
            declarationFieldsCount: field.declarationFields?.length || 0
          });
        }
      });

      // Check additionalFields
      player.actionForm?.forEach((field, fieldIndex) => {
        if (field.additionalFields) {
          Object.entries(field.additionalFields).forEach(([action, additionalFields]) => {
            additionalFields.forEach((addField, addIndex) => {
              if (addField.type === "checkbox" && addField.isConsentCheckbox) {
                console.log(`  Additional field ${fieldIndex}.${action}[${addIndex}]:`, {
                  name: addField.name,
                  isConsentCheckbox: addField.isConsentCheckbox,
                  declaration: addField.declaration?.substring(0, 100),
                  declarationFieldsCount: addField.declarationFields?.length || 0
                });
              }
            });
          });
        }
      });
    });
    console.log("=== END DEBUG ===");

    // Check for multiple players with exclusive authorities
    const corrigendumCount = players.filter((p) => p.canCorrigendum).length;
    const bankFilesCount = players.filter((p) => p.canManageBankFiles).length;
    const validateAadhaarCount = players.filter(
      (p) => p.canValidateAadhaar
    ).length;

    if (corrigendumCount > 1) {
      toast.error("Only one player can have Can Corrigendum authority.");
      return;
    }
    if (bankFilesCount > 1) {
      toast.error("Only one player can have Can Manage Bank Files authority.");
      return;
    }
    if (validateAadhaarCount > 1) {
      toast.error("Only one player can have Can Validate Aadhaar authority.");
      return;
    }

    const formdata = new FormData();
    formdata.append("serviceId", selectedServiceId);

    // Ensure all data is properly sanitized
    const sanitizedPlayers = players.map(player => ({
      ...player,
      actionForm: sanitizeActionForm(player.actionForm || [])
    }));

    formdata.append("workflowplayers", JSON.stringify(sanitizedPlayers));

    console.log("Saving workflow with:", {
      serviceId: selectedServiceId,
      playersCount: sanitizedPlayers.length,
      totalFields: sanitizedPlayers.reduce((sum, p) => sum + (p.actionForm?.length || 0), 0)
    });

    try {
      const response = await axiosInstance.post(
        "/Designer/WorkFlowPlayers",
        formdata
      );
      const result = response.data;
      if (result.status) {
        toast.success("WorkFlow saved successfully!");
      } else {
        toast.error("Failed to save workflow.");
      }
    } catch (error) {
      console.error("Save error:", error);
      toast.error("An error occurred while saving the workflow.");
    }
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = active.data.current.sortable.index;
    const newIndex = over.data.current.sortable.index;
    const reorderedPlayers = arrayMove(players, oldIndex, newIndex);
    const updatedPlayers = reorderedPlayers.map((player, index) => ({
      ...player,
      playerId: index,
      prevPlayerId: index > 0 ? index - 1 : null,
      nextPlayerId: index < reorderedPlayers.length - 1 ? index + 1 : null,
    }));
    setPlayers(updatedPlayers);
    updateAllDefaultActionFields();
  };

  const handleEditPlayer = (player) => {
    setSelectedPlayer(player);
    setIsEditModalOpen(true);
  };

  // UPDATED: updatePlayer with declaration support
  const updatePlayer = (updatedPlayer) => {
    // Check for multiple players with exclusive authorities
    if (updatedPlayer.canCorrigendum) {
      const otherCorrigendum = players.find(
        (p) => p.playerId !== updatedPlayer.playerId && p.canCorrigendum
      );
      if (otherCorrigendum) {
        toast.error(
          `Another player (${otherCorrigendum.designation}) already has Can Corrigendum authority.`
        );
        return;
      }
    }
    if (updatedPlayer.canManageBankFiles) {
      const otherBankFiles = players.find(
        (p) => p.playerId !== updatedPlayer.playerId && p.canManageBankFiles
      );
      if (otherBankFiles) {
        toast.error(
          `Another player (${otherBankFiles.designation}) already has Can Manage Bank Files authority.`
        );
        return;
      }
    }
    if (updatedPlayer.canValidateAadhaar) {
      const otherValidateAadhaar = players.find(
        (p) => p.playerId !== updatedPlayer.playerId && p.canValidateAadhaar
      );
      if (otherValidateAadhaar) {
        toast.error(
          `Another player (${otherValidateAadhaar.designation}) already has Can Validate Aadhaar authority.`
        );
        return;
      }
    }

    // Ensure actionForm is properly sanitized
    const sanitizedPlayer = {
      ...updatedPlayer,
      actionForm: sanitizeActionForm(updatedPlayer.actionForm || [])
    };

    setPlayers((prev) =>
      prev.map((p) =>
        p.playerId === sanitizedPlayer.playerId ? sanitizedPlayer : p
      )
    );
    updateAllDefaultActionFields();
    setIsEditModalOpen(false);
    setSelectedPlayer(null);
    toast.success("Player updated successfully");
  };

  const sensors = useSensors(useSensor(PointerSensor));

  return (
    <Container
      fluid
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(135deg, rgb(252, 252, 252) 0%, rgb(240, 236, 236) 100%)",
        py: { xs: 3, md: 5 },
      }}
    >
      <Box
        sx={{
          bgcolor: "background.default",
          borderRadius: 3,
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.1)",
          p: { xs: 3, md: 5 },
          maxWidth: 1200,
          mx: "auto",
        }}
      >
        <Typography
          variant="h4"
          sx={{
            fontFamily: "'Playfair Display', serif",
            color: "primary.main",
            textAlign: "center",
            mb: 4,
            fontWeight: 700,
          }}
        >
          Create WorkFlow
        </Typography>
        <Row className="g-4">
          <Col xs={12} md={3}>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <FormControl fullWidth sx={formControlStyles}>
                <InputLabel id="service-select-label">
                  Select Service
                </InputLabel>
                <Select
                  labelId="service-select-label"
                  value={selectedServiceId}
                  label="Select Service"
                  onChange={handleServiceChange}
                >
                  {services.map((service) => (
                    <MenuItem key={service.serviceId} value={service.serviceId}>
                      {service.serviceName}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button
                variant="contained"
                onClick={addPlayer}
                sx={buttonStyles}
                startIcon={<AddIcon />}
              >
                Add Player
              </Button>
              <Button
                variant="contained"
                onClick={saveWorkflow}
                sx={buttonStyles}
                startIcon={<SaveIcon />}
              >
                Save WorkFlow
              </Button>
            </Box>
          </Col>
          <Col xs={12} md={9}>
            <Box
              sx={{
                bgcolor: "background.paper",
                borderRadius: 3,
                p: 3,
                minHeight: 400,
                maxHeight: 600,
                overflowY: "auto",
                boxShadow: "0 4px 16px rgba(0, 0, 0, 0.1)",
              }}
            >
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={players.map((p) => p.playerId)}
                  strategy={verticalListSortingStrategy}
                >
                  {players.map((player) => (
                    <SortableItem key={player.playerId} id={player.playerId}>
                      <Box
                        sx={{
                          bgcolor: "background.default",
                          border: "1px solid",
                          borderColor: "divider",
                          borderRadius: 2,
                          p: 2,
                          mb: 2,
                          transition: "transform 0.3s ease",
                          "&:hover": {
                            transform: "scale(1.02)",
                            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.1)",
                          },
                        }}
                      >
                        <Typography
                          variant="subtitle1"
                          sx={{ fontWeight: 600, color: "primary.main", mb: 1 }}
                        >
                          {player.designation
                            ? `${player.designation} (${player.accessLevel || "N/A"
                            })`
                            : "Unnamed Player"}
                        </Typography>
                        <Box sx={{ pl: 2 }}>
                          <Typography variant="body2">
                            <strong>Sanction:</strong>{" "}
                            {player.canSanction ? "Yes" : "No"}
                          </Typography>
                          <Typography variant="body2">
                            <strong>Return to Player:</strong>{" "}
                            {player.canReturnToPlayer ? "Yes" : "No"}
                          </Typography>
                          <Typography variant="body2">
                            <strong>Return to Citizen:</strong>{" "}
                            {player.canReturnToCitizen ? "Yes" : "No"}
                          </Typography>
                          <Typography variant="body2">
                            <strong>Forward to Player:</strong>{" "}
                            {player.canForwardToPlayer ? "Yes" : "No"}
                          </Typography>
                          <Typography variant="body2">
                            <strong>Reject:</strong>{" "}
                            {player.canReject ? "Yes" : "No"}
                          </Typography>
                          <Typography variant="body2">
                            <strong>Pull:</strong>{" "}
                            {player.canPull ? "Yes" : "No"}
                          </Typography>
                          <Typography variant="body2">
                            <strong>Bulk Applications:</strong>{" "}
                            {player.canHavePool ? "Yes" : "No"}
                          </Typography>
                          <Typography variant="body2">
                            <strong>Corrigendum:</strong>{" "}
                            {player.canCorrigendum ? "Yes" : "No"}
                          </Typography>
                          <Typography variant="body2">
                            <strong>Manage Bank Files:</strong>{" "}
                            {player.canManageBankFiles ? "Yes" : "No"}
                          </Typography>
                          <Typography variant="body2">
                            <strong>Withhold:</strong>{" "}
                            {player.canWithhold ? "Yes" : "No"}
                          </Typography>
                          <Typography variant="body2">
                            <strong>Validate Aadhaar:</strong>{" "}
                            {player.canValidateAadhaar ? "Yes" : "No"}
                          </Typography>
                          {player.customPermissions?.map((perm) => (
                            <Typography variant="body2" key={perm.name}>
                              <strong>{perm.label}:</strong>{" "}
                              {perm.enabled ? "Yes" : "No"}
                            </Typography>
                          ))}
                        </Box>
                        <Box sx={{ mt: 2, display: "flex", gap: 2 }}>
                          <Button
                            variant="contained"
                            onClick={() => handleEditPlayer(player)}
                            sx={buttonStyles}
                            startIcon={<EditIcon />}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="contained"
                            onClick={() => removePlayer(player.playerId)}
                            sx={{
                              ...buttonStyles,
                              bgcolor: "error.main",
                              "&:hover": { bgcolor: "error.dark" },
                            }}
                            startIcon={<DeleteIcon />}
                          >
                            Remove
                          </Button>
                        </Box>
                      </Box>
                    </SortableItem>
                  ))}
                </SortableContext>
              </DndContext>
            </Box>
          </Col>
        </Row>
        {isEditModalOpen && selectedPlayer && (
          <PlayerEditModal
            player={selectedPlayer}
            onClose={() => setIsEditModalOpen(false)}
            onSave={updatePlayer}
            players={players}
            serviceId={selectedServiceId}
            services={services}
            sx={{
              "& .MuiDialog-paper": {
                borderRadius: 2,
                p: 3,
                width: { xs: "90%", md: 700 },
              },
            }}
          />
        )}
      </Box>
      <ToastContainer position="top-center" autoClose={3000} theme="colored" />
    </Container>
  );
}