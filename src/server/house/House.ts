import { DurableObject } from "cloudflare:workers";

/** Keeps the historical namespace and its data intact until explicit retirement. */
export class House extends DurableObject {
  async fetch(): Promise<Response> {
    return new Response("This gift store is archived.", { status: 410 });
  }
}
