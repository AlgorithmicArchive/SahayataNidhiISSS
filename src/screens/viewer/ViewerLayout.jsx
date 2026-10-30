import React from "react";
import { Outlet } from "react-router-dom";
import { PageContainer } from "../../components/gov/SkipToContent";

export default function ViewerLayout() {
  return (
    <PageContainer>
      <Outlet />
    </PageContainer>
  );
}
