import { useEffect, useRef, useState } from "react";
import { WebSocket } from "partysocket";
import { useSync } from "partysync/react";
import { collectionSnapshot, HOUSE_COLLECTION, HOUSE_SYNC_REQUEST, type HouseCollectionRecord } from "./collection";
import type { HouseSnapshot } from "./types";

/** Only collection membership syncs. Movement and retained/deleting gifts are UI state. */
export function useHouseSync(onSnapshot: (snapshot: HouseSnapshot) => void): void {
  const accept = useRef(onSnapshot);
  useEffect(() => { accept.current = onSnapshot; }, [onSnapshot]);
  const [socket] = useState(() => new WebSocket(() => {
    const url = new URL("/api/house/events", window.location.href);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    // Public channel: no visitor bearer token, URL credential, or custom protocol.
    return url.href;
  }, [], { startClosed: true, maxEnqueuedMessages: 0 }));
  const [records] = useSync<HouseCollectionRecord, never>(HOUSE_COLLECTION, socket);

  useEffect(() => {
    const sync = () => {
      if (socket.readyState === WebSocket.OPEN) socket.send(HOUSE_SYNC_REQUEST);
    };
    const foreground = () => {
      if (document.hidden) return;
      // OPEN can be a half-open connection after device sleep or a network change.
      socket.reconnect();
    };
    socket.addEventListener("open", sync);
    document.addEventListener("visibilitychange", foreground);
    window.addEventListener("pageshow", foreground);
    // useSync's listeners are installed before starting the connection. The same
    // closed socket can reconnect after StrictMode's effect cleanup/setup replay.
    socket.reconnect();
    return () => {
      socket.removeEventListener("open", sync);
      document.removeEventListener("visibilitychange", foreground);
      window.removeEventListener("pageshow", foreground);
      socket.close();
    };
  }, [socket]);

  useEffect(() => {
    const snapshot = collectionSnapshot(records.find((record) => record[0] === "home"));
    // The parent accepts revisions monotonically, including HTTP mutation results;
    // a late IndexedDB cache read must never roll back a newer HTTP snapshot.
    if (snapshot) accept.current(snapshot);
  }, [records]);
}
