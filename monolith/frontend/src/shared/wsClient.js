import { getToken } from "@/shared/api/client";

function buildWsUrl(path) {
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const token = getToken();
  return `${protocol}://${window.location.host}/api${path}?token=${encodeURIComponent(token || "")}`;
}

export class TextWebSocketClient {
  constructor(path, handlers = {}) {
    this.path = path;
    this.handlers = handlers;
    this.socket = null;
    this.manualClose = false;
    this.retryTimer = null;
    this.hasOpened = false;
  }

  connect() {
    if (this.socket && this.socket.readyState <= 1) return;

    this.manualClose = false;
    this.hasOpened = false;
    this.socket = new WebSocket(buildWsUrl(this.path));

    this.socket.onopen = () => {
      this.hasOpened = true;
      this.handlers.onOpen?.();
    };

    this.socket.onmessage = (event) => {
      this.handlers.onMessage?.(event.data);
    };

    this.socket.onerror = () => {
      if (!this.hasOpened) {
        this.handlers.onError?.(new Error("WebSocket connection failed"));
      }
    };

    this.socket.onclose = (event) => {
      this.handlers.onClose?.(event);
      this.socket = null;

      if (this.manualClose) return;

      if (event.code === 1008) {
        this.handlers.onError?.(
          new Error("WebSocket rejected by backend. Verify the user exists, is different from the current one, and restart the backend if needed.")
        );
        return;
      }

      clearTimeout(this.retryTimer);
      this.retryTimer = setTimeout(() => this.connect(), 1200);
    };
  }

  send(text) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket is not connected");
    }

    this.socket.send(text);
  }

  close() {
    this.manualClose = true;
    clearTimeout(this.retryTimer);
    this.socket?.close();
    this.socket = null;
  }
}
