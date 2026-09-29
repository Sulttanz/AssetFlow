import type { Response } from "express";

// Events carry no CAB data: each authenticated client reloads its own API views.
const subscribers = new Set<Response>();

export function subscribeToCabEvents(res: Response): () => void {
  subscribers.add(res);
  return () => { subscribers.delete(res); };
}

export function publishCabChange(): void {
  subscribers.forEach(res => {
    if (res.destroyed) {
      subscribers.delete(res);
      return;
    }
    res.write("event: cab-change\ndata: {}\n\n");
  });
}