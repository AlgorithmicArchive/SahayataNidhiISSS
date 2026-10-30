import React from "react";
import { Outlet } from "react-router-dom";
import { PageContainer } from "../../components/gov/SkipToContent";

export default function UserLayout() {
  return (
    <PageContainer sx={{ minHeight: "90vh" }}>
      <Outlet />
    </PageContainer>
  );
}
