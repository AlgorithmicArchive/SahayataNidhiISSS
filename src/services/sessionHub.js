// src/services/sessionHub.js
import * as signalR from "@microsoft/signalr";

class SessionHubService {
  constructor() {
    this.connection = null;
    this.onForceLogout = null;
  }

  async start(token) {
    // Stop existing connection if any
    if (this.connection) {
      await this.stop();
    }

    this.connection = new signalR.HubConnectionBuilder()
      .withUrl("/swdjk/sessionHub", {
        accessTokenFactory: () => token,
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000]) // Retry pattern
      .build();

    this.connection.on("ForceLogout", (data) => {
      if (this.onForceLogout) {
        this.onForceLogout(data);
      }
    });

    this.connection.on("SessionRegistered", (sessionId) => {
      console.log("Session registered:", sessionId);
    });

    // Handle reconnect: re-register session
    this.connection.onreconnected(async (connectionId) => {
      console.log("SignalR reconnected:", connectionId);
      const userId = this.getUserIdFromToken(token);
      const sessionId = this.getSessionIdFromToken(token);
      if (userId && sessionId) {
        await this.connection.invoke("RegisterSession", userId, sessionId);
      }
    });

    await this.connection.start();

    // Register this session
    const userId = this.getUserIdFromToken(token);
    const sessionId = this.getSessionIdFromToken(token);

    if (userId && sessionId) {
      await this.connection.invoke("RegisterSession", userId, sessionId);
    }

    return this.connection;
  }

  async stop() {
    if (this.connection) {
      await this.connection.stop();
      this.connection = null;
    }
  }

  setForceLogoutHandler(handler) {
    this.onForceLogout = handler;
  }

  getUserIdFromToken(token) {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return (
        payload[
          "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"
        ] ||
        payload.sub ||
        payload.userId ||
        payload.nameid
      );
    } catch {
      return null;
    }
  }

  getSessionIdFromToken(token) {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload.SessionId;
    } catch {
      return null;
    }
  }
}

export const sessionHub = new SessionHubService();
