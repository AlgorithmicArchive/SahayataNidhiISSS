import React, { useContext } from "react";
import { Outlet } from "react-router-dom";
import { PageContainer } from "../../components/gov/SkipToContent";
import { UserContext } from "../../UserContext";

export default function OfficerLayout() {
  return (
    <PageContainer>
      <Outlet />
    </PageContainer>
  );
}
