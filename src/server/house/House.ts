import { DurableObject } from "cloudflare:workers";
import { ManagedRuntime } from "effect";
import { findEmoji } from "../../lib/house/emoji";
import { settleHouse } from "../../lib/house/physics";
import type { Viewer } from "../../lib/house/types";
import { HouseService, result } from "./service";
import { HouseStore } from "./store";

export class House extends DurableObject<Env> {
  private readonly runtime: ManagedRuntime.ManagedRuntime<HouseService, never>;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    const store = new HouseStore({
      query: <T extends Record<string, string | number | null>>(query: string, ...values: (string | number | null)[]) => this.ctx.storage.sql.exec<T>(query, ...values).toArray(),
      transaction: (run) => this.ctx.storage.transactionSync(run),
    }, { initial: (gifts) => settleHouse(gifts, []), settle: settleHouse, hasEmoji: (id) => Boolean(findEmoji(id)) });
    ctx.blockConcurrencyWhile(async () => store.initialize());
    this.runtime = ManagedRuntime.make(HouseService.layer(store));
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }

  async snapshot() {
    return this.runtime.runPromise(result(HouseService.use((house) => house.snapshot())));
  }

  async detail(id: string, viewer: Viewer) {
    return this.runtime.runPromise(result(HouseService.use((house) => house.detail(id, viewer))));
  }

  async create(input: unknown, viewer: Viewer) {
    const response = await this.runtime.runPromise(result(HouseService.use((house) => house.create(input, viewer))));
    if (response.ok) this.broadcast(response.value);
    return response;
  }

  async remove(id: string, viewer: Viewer) {
    const response = await this.runtime.runPromise(result(HouseService.use((house) => house.remove(id, viewer))));
    if (response.ok) this.broadcast(response.value);
    return response;
  }

  async place(input: unknown, viewer: Viewer) {
    const response = await this.runtime.runPromise(result(HouseService.use((house) => house.place(input, viewer))));
    if (response.ok) this.broadcast(response.value);
    return response;
  }

  async allowSuggestion(key: string): Promise<boolean> {
    return this.runtime.runPromise(HouseService.use((house) => house.allowSuggestion(key)));
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") return new Response("WebSocket required", { status: 426 });
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    const snapshot = await this.snapshot();
    if (!snapshot.ok) {
      pair[1].close(1011, "Reconnect to the house.");
      return Response.json({ error: snapshot.error }, { status: snapshot.status });
    }
    pair[1].send(JSON.stringify({ type: "snapshot", snapshot: snapshot.value }));
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  webSocketMessage(socket: WebSocket): void {
    // This channel publishes public state only; commands use authenticated HTTP.
    socket.close(1008, "Use the house API for changes.");
  }

  webSocketClose(socket: WebSocket, code: number, reason: string): void {
    socket.close(code, reason);
  }

  webSocketError(socket: WebSocket): void {
    socket.close(1011, "Reconnect to the house.");
  }

  private broadcast(snapshot: unknown): void {
    const message = JSON.stringify({ type: "snapshot", snapshot });
    for (const socket of this.ctx.getWebSockets()) {
      try { socket.send(message); } catch { socket.close(1011, "Reconnect to the house."); }
    }
  }
}
