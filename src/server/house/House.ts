import { ManagedRuntime } from "effect";
import { SyncServer } from "partysync/server";
import type { Connection, WSMessage } from "partyserver";
import { collectionRecord, HOUSE_COLLECTION } from "../../lib/house/collection";
import { findEmoji } from "../../lib/house/emoji";
import type { HouseSnapshot, Viewer } from "../../lib/house/types";
import { HouseService, result } from "./service";
import { HouseStore } from "./store";
import { isPublicSyncRequest } from "./sync";

export class House extends SyncServer<Env> {
  private readonly runtime: ManagedRuntime.ManagedRuntime<HouseService, never>;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    const store = new HouseStore({
      query: <T extends Record<string, string | number | null>>(query: string, ...values: (string | number | null)[]) => this.ctx.storage.sql.exec<T>(query, ...values).toArray(),
      transaction: (run) => this.ctx.storage.transactionSync(run),
    }, (id) => Boolean(findEmoji(id)));
    // Native DO RPC bypasses PartyServer.onStart: initialize in the constructor
    // so GET/create/remove work even before the first WebSocket connection.
    ctx.blockConcurrencyWhile(async () => store.initialize());
    this.runtime = ManagedRuntime.make(HouseService.layer(store));
  }

  async snapshot() {
    return this.runtime.runPromise(result(HouseService.use((house) => house.snapshot())));
  }

  async detail(id: string, viewer: Viewer) {
    return this.runtime.runPromise(result(HouseService.use((house) => house.detail(id, viewer))));
  }

  async create(input: unknown, viewer: Viewer) {
    const response = await this.runtime.runPromise(result(HouseService.use((house) => house.create(input, viewer))));
    if (response.ok) this.publish(response.value);
    return response;
  }

  async remove(id: string, viewer: Viewer) {
    const response = await this.runtime.runPromise(result(HouseService.use((house) => house.remove(id, viewer))));
    if (response.ok) this.publish(response.value);
    return response;
  }

  async allowSuggestion(key: string): Promise<boolean> {
    return this.runtime.runPromise(HouseService.use((house) => house.allowSuggestion(key)));
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") return new Response("WebSocket required", { status: 426 });
    // Keep the existing DO identity and endpoint without exposing PartyServer's
    // client-controlled room, props, connection IDs, or authentication headers.
    const url = new URL(request.url);
    url.search = "";
    return super.fetch(new Request(url, { headers: { Upgrade: "websocket", "x-partykit-room": "home" } }));
  }

  async onMessage(connection: Connection, message: WSMessage): Promise<void> {
    if (!isPublicSyncRequest(message)) {
      connection.close(1008, "Use the house API for changes.");
      return;
    }
    const response = await this.snapshot();
    if (!response.ok) {
      connection.close(1011, "The house could not load.");
      return;
    }
    // Keep partysync's permanent-row replacement, but assemble in JavaScript:
    // aggregating the entire collection inside SQLite hits its 2 MB value limit.
    connection.send(JSON.stringify({
      sync: true, channel: HOUSE_COLLECTION, payload: [collectionRecord(response.value)],
    }));
  }

  private publish(snapshot: HouseSnapshot): void {
    this.broadcast(JSON.stringify({
      broadcast: true, type: "update", channel: HOUSE_COLLECTION,
      payload: [collectionRecord(snapshot)],
    }));
  }
}
