import * as signalR from "@microsoft/signalr";

// Initialize SignalR connection
const connection = new signalR.HubConnectionBuilder()
  .withUrl("http://localhost:5004/progressHub") // Replace with your actual backend URL and hub route
  .withAutomaticReconnect()
  .configureLogging(signalR.LogLevel.Information)
  .build();

export const startSignalRConnection = async () => {
  if (connection.state === signalR.HubConnectionState.Disconnected) {
    try {
      await connection.start();
      console.log("SignalR Connected");
    } catch (error) {
      console.error("SignalR Connection Error:", error);
      setTimeout(startSignalRConnection, 5000); // Retry connection
    }
  } else {
    console.log("SignalR connection is already started or reconnecting.");
  }
};

export default connection;
