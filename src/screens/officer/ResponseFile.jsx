import { Box, Typography } from "@mui/material";
import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import {
  fetchData,
  fetchDataPost,
  fetchDistricts,
  fetchServiceList,
} from "../../assets/fetch";
import CustomSelectField from "../../components/form/CustomSelectField";
import CustomInputField from "../../components/form/CustomInputField";
import CustomButton from "../../components/CustomButton";
import axiosInstance from "../../axiosConfig";
import { downloadFile } from "../../assets/downloadFile";
import LoadingSpinner from "../../components/LoadingSpinner";
import CustomTable from "../../components/CustomTable";

export default function () {
  const {
    control,
    formState: { errors },
    handleSubmit,
    getValues,
  } = useForm();
  const [districts, setDistricts] = useState([]);
  const [services, setServices] = useState([]);
  const [responseMessage, setResponseMessage] = useState("");
  const [responseColor, setResponseColor] = useState("background.paper");
  // const [responseFile, setResponseFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [table, setTable] = useState(null);
  useEffect(() => {
    fetchDistricts(setDistricts);
    fetchServiceList(setServices);
  }, []);

  const onSubmit = async (data) => {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      formData.append(key, value);
    });
    setTable({
      url: "/Officer/GetResponseBankFile",
      formdata: formData,
      key: Date.now(),
    });
  };

  const buttonActionHandler = (functionName, parameters) => {
    if (functionName == "UpdateDatabase") {
      const responseFile = parameters.responseFile;
      DownloadFileAndUpdateDatabase(responseFile);
    }
  };

  const DownloadFileAndUpdateDatabase = async (responseFile) => {
    downloadFile(responseFile);
    setLoading(true);
    const serviceId = getValues("serviceId");
    const formdata = new FormData();
    formdata.append("serviceId", serviceId);
    formdata.append("responseFile", responseFile);
    const response = await axiosInstance.post(
      "/Officer/ProcessResponseFile",
      formdata
    );
    const result = response.data;
    if (result.status) {
      setResponseMessage(result.message);
      setResponseColor("background.paper");
      setTable({
        url: "/Officer/GetPaymentHistory",
        params: {
          referenceNumbersString: result.referenceNumbers,
        },
        key: Date.now(),
      });
      setLoading(false);
    } else {
      setResponseMessage(result.message);
      setResponseColor("red");
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        justifyContent: "flex-start",
        alignItems: "center",
      }}
    >
      {loading && <LoadingSpinner />}
      <Box
        sx={{
          backgroundColor: "primary.main",
          padding: 3,
          borderRadius: 3,
          height: "max-content",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <CustomSelectField
          label="Select District"
          name="districtId"
          control={control}
          options={districts}
          placeholder="Select District"
          rules={{ required: "This field is required" }}
          errors={errors}
        />
        <CustomSelectField
          label="Select Service"
          name="serviceId"
          control={control}
          options={services}
          placeholder="Select Service"
          rules={{ required: "This field is required" }}
          errors={errors}
        />
        <CustomInputField
          name={"ftpHost"}
          label={"FTP HOST"}
          control={control}
          placeholder="FTP HOST"
          rules={{ required: "This field is required" }}
          errors={errors}
        />
        <CustomInputField
          name={"ftpUser"}
          label={"FTP User"}
          control={control}
          placeholder="FTP User"
          rules={{ required: "This field is required" }}
          errors={errors}
        />
        <CustomInputField
          name={"ftpPassword"}
          label={"FTP Password"}
          type="password"
          control={control}
          placeholder="FTP Password"
          rules={{ required: "This field is required" }}
          errors={errors}
        />
        <CustomButton
          text="Check Response"
          bgColor="background.paper"
          color="primary.main"
          onClick={handleSubmit(onSubmit)}
        />
        {responseMessage != "" && (
          <Typography
            sx={{
              textAlign: "center",
              color: responseColor,
              fontWeight: "bold",
            }}
          >
            {responseMessage}
          </Typography>
        )}
      </Box>

      <Box>
        {table != null && (
          <CustomTable
            key={table.key}
            fetchData={fetchDataPost}
            url={table.url}
            params={null}
            formdata={table.formdata}
            buttonActionHandler={buttonActionHandler}
          />
        )}
      </Box>
    </Box>
  );
}
