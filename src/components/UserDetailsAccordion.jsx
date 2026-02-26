import React, { useEffect, useState } from "react";
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  Grid2,
  Box,
  Divider,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import axiosInstance from "../axiosConfig";
import BasicModal from "./BasicModal";
import { formatKey } from "../assets/formvalidations";
import { Col, Container, Row } from "react-bootstrap";

const UserDetailsAccordion = ({ applicationId }) => {
  const [generalDetails, setGeneralDetails] = useState([]);
  const [preAddressDetails, setPreAddressDetails] = useState([]);
  const [perAddressDetails, setPerAddressDetails] = useState([]);
  const [bankDetails, setBankDetails] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [open, setOpen] = useState(false);
  const [pdf, setPdf] = useState(null);
  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);

  const handleDocument = (link) => {
    setPdf(`http://localhost:5004${link}`);
    handleOpen();
  };

  useEffect(() => {
    async function fetchUserDetail() {
      const response = await axiosInstance.get("/User/GetApplicationDetails", {
        params: { applicationId: applicationId },
      });
      setGeneralDetails(response.data.generalDetails);
      setPreAddressDetails(response.data.presentAddressDetails);
      setPerAddressDetails(response.data.permanentAddressDetails);
      setBankDetails(response.data.bankDetails);
      setDocuments(response.data.documents);
    }
    fetchUserDetail();
  }, []);

  return (
    <Accordion>
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        aria-controls="panel1-content"
        id="panel1-header"
        sx={{ backgroundColor: "primary.main", borderRadius: 3 }}
      >
        <Typography sx={{ color: "background.paper", fontSize: "18px" }}>
          Application Details
        </Typography>
      </AccordionSummary>
      <AccordionDetails
        sx={{
          maxHeight: "400px", // Set max height for scrollable area
          overflowY: "scroll", // Enable vertical scrolling,
          backgroundColor: "transparent",
        }}
      >
        <Container fluid>
          <Row>
            <Col md={12} xs={12}>
              <Typography variant="h5">General Details</Typography>
            </Col>
            {generalDetails.map((item, index) => (
              <Col key={index} md={6} xs={12}>
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    width: "100%",
                  }}
                >
                  <Typography sx={{ fontWeight: "bold", fontSize: "12px" }}>
                    {item.key}
                  </Typography>
                  {item.key != "Applicant Image" ? (
                    <Typography
                      sx={{
                        fontWeight: "normal",
                        fontSize: "14px",
                        border: "2px solid",
                        borderColor: "primary.main",
                        borderRadius: 3,
                        padding: 1,
                      }}
                    >
                      {item.value}
                    </Typography>
                  ) : (
                    <Box>
                      <img
                        src={`http://localhost:5004${item.value}`}
                        alt="Preview"
                        style={{
                          width: "150px",
                          height: "150px",
                          objectFit: "cover",
                          borderRadius: "5px",
                        }}
                      />
                    </Box>
                  )}
                </Box>
              </Col>
            ))}
            <Divider
              sx={{
                width: "100%",
                borderColor: "primary.main",
                borderWidth: "2px",
                marginTop: "10px",
                marginBottom: "10px",
              }}
            />
            <Col md={12} xs={12}>
              <Typography variant="h5">Present Address Details</Typography>
            </Col>
            {preAddressDetails.map((item, index) => (
              <Col key={index} md={6} xs={12}>
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    width: "100%",
                  }}
                >
                  <Typography sx={{ fontWeight: "bold", fontSize: "12px" }}>
                    {item.key}
                  </Typography>
                  <Typography
                    sx={{
                      fontWeight: "normal",
                      fontSize: "14px",
                      border: "2px solid",
                      borderColor: "primary.main",
                      borderRadius: 3,
                      padding: 1,
                    }}
                  >
                    {item.value}
                  </Typography>
                </Box>
              </Col>
            ))}
            <Divider
              sx={{
                width: "100%",
                borderColor: "primary.main",
                borderWidth: "2px",
                marginTop: "10px",
                marginBottom: "10px",
              }}
            />
            <Col md={12} xs={12}>
              <Typography variant="h5">Permanent Address Details</Typography>
            </Col>
            {perAddressDetails.map((item, index) => (
              <Col key={index} md={6} xs={12}>
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    width: "100%",
                  }}
                >
                  <Typography sx={{ fontWeight: "bold", fontSize: "12px" }}>
                    {item.key}
                  </Typography>
                  <Typography
                    sx={{
                      fontWeight: "normal",
                      fontSize: "14px",
                      border: "2px solid",
                      borderColor: "primary.main",
                      borderRadius: 3,
                      padding: 1,
                    }}
                  >
                    {item.value}
                  </Typography>
                </Box>
              </Col>
            ))}
            <Divider
              sx={{
                width: "100%",
                borderColor: "primary.main",
                borderWidth: "2px",
                marginTop: "10px",
                marginBottom: "10px",
              }}
            />
            <Col md={12} xs={12}>
              <Typography variant="h5">Bank Details</Typography>
            </Col>
            {bankDetails.map((item, index) => (
              <Col key={index} md={6} xs={12}>
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    width: "100%",
                  }}
                >
                  <Typography sx={{ fontWeight: "bold", fontSize: "12px" }}>
                    {item.key}
                  </Typography>
                  <Typography
                    sx={{
                      fontWeight: "normal",
                      fontSize: "14px",
                      border: "2px solid",
                      borderColor: "primary.main",
                      borderRadius: 3,
                      padding: 1,
                    }}
                  >
                    {item.value}
                  </Typography>
                </Box>
              </Col>
            ))}
            <Divider
              sx={{
                width: "100%",
                borderColor: "primary.main",
                borderWidth: "2px",
                marginTop: "10px",
                marginBottom: "10px",
              }}
            />
            <Col md={12} xs={12}>
              <Typography variant="h5">Bank Details</Typography>
            </Col>
            {documents.map((item, index) => (
              <Col key={index} md={6} xs={12}>
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    width: "100%",
                  }}
                >
                  <Typography
                    sx={{
                      fontWeight: "bold",
                      fontSize: "14px",
                      wordWrap: "break-word",
                    }}
                  >
                    {formatKey(item.Label)}
                  </Typography>
                  <Typography
                    component={"div"}
                    sx={{
                      fontWeight: "normal",
                      fontSize: "18px",
                      border: "2px solid",
                      borderColor: "primary.main",
                      borderRadius: 3,
                      padding: 1,
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <Typography>{item.Enclosure}</Typography>
                    <Typography
                      sx={{
                        cursor: "pointer",
                        fontWeight: "bold",
                        border: "2px solid",
                        borderRadius: 3,
                        height: "max-content",
                        paddingLeft: 1,
                        paddingRight: 1,
                        backgroundColor: "primary.main",
                        color: "background.paper",
                      }}
                      onClick={() => handleDocument(item.File)}
                    >
                      View
                    </Typography>
                  </Typography>
                </Box>
              </Col>
            ))}
          </Row>
        </Container>
      </AccordionDetails>
      <BasicModal
        open={open}
        handleClose={handleClose}
        Title={""}
        pdf={pdf}
        table={null}
      />
    </Accordion>
  );
};

export default UserDetailsAccordion;
