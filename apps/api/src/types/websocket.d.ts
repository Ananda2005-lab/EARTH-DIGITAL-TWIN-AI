/**
 * Minimal ambient declaration for the WHATWG WebSocket client that Node exposes
 * globally from v22. `@types/node` does not ship it yet and the API deliberately
 * adds no extra dependency for the AISStream collector, so the surface actually
 * used is declared here. Runtime code still feature-detects before using it.
 */
declare global {
  interface EdtWebSocketMessageEvent {
    data: string | ArrayBuffer | Uint8Array;
  }

  interface EdtWebSocketCloseEvent {
    code: number;
    reason: string;
  }

  interface EdtWebSocket {
    readonly readyState: number;
    send(data: string): void;
    close(code?: number, reason?: string): void;
    addEventListener(type: 'open', listener: () => void): void;
    addEventListener(type: 'message', listener: (event: EdtWebSocketMessageEvent) => void): void;
    addEventListener(type: 'error', listener: (event: unknown) => void): void;
    addEventListener(type: 'close', listener: (event: EdtWebSocketCloseEvent) => void): void;
  }

  interface EdtWebSocketConstructor {
    new (url: string): EdtWebSocket;
    readonly OPEN: number;
    readonly CONNECTING: number;
    readonly CLOSING: number;
    readonly CLOSED: number;
  }

  // eslint-disable-next-line no-var
  var WebSocket: EdtWebSocketConstructor | undefined;
}

export {};
