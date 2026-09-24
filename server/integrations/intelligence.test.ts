import { describe, expect, it } from "vitest";
import { sendSignalAction, ticketmasterEvents } from "./intelligence";

describe("production integration fallbacks", () => {
  it("does not pretend signal control is live when credentials are absent", async () => {
    const result = await sendSignalAction({
      selectedArea: "Gandhipuram Junction",
      controllerId: "coimbatore-signal-controller",
      action: "Extend green by 18 sec",
    });

    expect(result.status).toBe("notConfigured");
    expect(result.provider).toBe("signal-control");
  });

  it("returns an explicit unconfigured event-provider state", async () => {
    const result = await ticketmasterEvents({ lat: 11.0183, lng: 76.9725 });

    expect(result.configured).toBe(false);
    expect(result.source).toBe("ticketmaster");
    expect(result.events).toEqual([]);
  });
});
