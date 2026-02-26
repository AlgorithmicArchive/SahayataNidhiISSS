import React from "react";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import PersonIcon from "@mui/icons-material/Person";
import CancelIcon from "@mui/icons-material/Cancel";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import InboxIcon from "@mui/icons-material/Inbox";
import AllInboxIcon from "@mui/icons-material/AllInbox";

const StatusIcons = ({ status, textColor }) => {
  const renderIcon = () => {
    switch (status) {
      case "Pending":
        return (
          <HourglassEmptyIcon
            color="primary"
            sx={{ fontSize: "50px", color: textColor }}
          />
        );
      case "Forwarded":
        return (
          <ArrowForwardIcon
            color="primary"
            sx={{ fontSize: "50px", color: textColor }}
          />
        );
      case "Citizen Pending":
        return (
          <PersonIcon
            color="primary"
            sx={{ fontSize: "50px", color: textColor }}
          />
        );
      case "Rejected":
        return (
          <CancelIcon
            color="error"
            sx={{ fontSize: "50px", color: textColor }}
          />
        );
      case "Total":
        return (
          <AllInboxIcon
            color="primary"
            sx={{ fontSize: "50px", color: textColor }}
          />
        );
      case "Sanctioned":
        return (
          <CheckCircleIcon
            color="success"
            sx={{ fontSize: "50px", color: textColor }}
          />
        );
      case "Disbursed":
        return (
          <AttachMoneyIcon
            color="success"
            sx={{ fontSize: "50px", color: textColor }}
          />
        );
      case "Deposited":
        return (
          <InboxIcon
            color="primary"
            sx={{ fontSize: "50px", color: textColor }}
          />
        );
      case "Dispatched":
        return (
          <LocalShippingIcon
            color="primary"
            sx={{ fontSize: "50px", color: textColor }}
          />
        );
      default:
        return null;
    }
  };

  return renderIcon();
};

export default StatusIcons;
