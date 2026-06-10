import axios, { AxiosError } from "axios";
import { env } from "../config/env";
import { ShipmentStatus, TrackingEvent } from "../../modules/commerce/shipment/shipment.types";

const BASE_URL = "https://api.trackingmore.com/v4";

// Full list at https://www.trackingmore.com/courier.html
const COURIER_CODE_MAP: Record<string, string> = {
  delhivery: "delhivery",
  bluedart: "bluedart",
  "blue dart": "bluedart",
  dtdc: "dtdc",
  ekart: "ekart-in",
  xpressbees: "xpressbees",
  shadowfax: "shadowfax-in",
  "ecom express": "ecom-express",
  "india post": "india-post",
  fedex: "fedex",
  dhl: "dhl",
  "test-carrier": "test-carrier",
};

export interface TrackingResult {
  CurrentStatus: string;
  CurrentLocation?: string;
  Events: TrackingEvent[];
}

class TrackingService {
  private get headers() {
    return {
      "Tracking-Api-Key": env.TRACKINGMORE_API_KEY,
      "Content-Type": "application/json",
    };
  }

  async fetchTracking(awb: string, courier: string): Promise<TrackingResult> {
    const courierCode =
      COURIER_CODE_MAP[courier.toLowerCase()] ??
      courier.toLowerCase().replace(/\s+/g, "-");

    let trackingData: Record<string, unknown>;

    try {
      // Create the tracking — response includes full events on success
      const res = await axios.post(
        `${BASE_URL}/trackings/create`,
        { tracking_number: awb, courier_code: courierCode },
        { headers: this.headers }
      );
      trackingData = res.data.data;
    } catch (err) {
      const error = err as AxiosError<Record<string, unknown>>;
      const code = (error.response?.data?.meta as Record<string, unknown>)?.code;

      if (code === 4101) {
        // Already registered — get the ID from the error then fetch full details
        const id = (error.response?.data?.data as Record<string, unknown>)?.id as string;
        if (!id) throw new Error("TrackingMore: tracking exists but ID not returned");

        const res = await axios.get(`${BASE_URL}/trackings/${id}`, {
          headers: this.headers,
        });
        trackingData = Array.isArray(res.data.data) ? res.data.data[0] : res.data.data;
      } else {
        const meta = error.response?.data?.meta;
        throw new Error(`TrackingMore: ${JSON.stringify(meta ?? error.message)}`);
      }
    }

    if (!trackingData) throw new Error("No tracking data returned from TrackingMore");

    return this.normalise(trackingData);
  }

  private normalise(data: Record<string, unknown>): TrackingResult {
    const trackinfo =
      (data.origin_info as Record<string, unknown>)?.trackinfo ??
      (data.destination_info as Record<string, unknown>)?.trackinfo ??
      [];

    const events: TrackingEvent[] = (trackinfo as Array<Record<string, unknown>>).map((e) => ({
      Status: String(e.tracking_detail ?? ""),
      Location: e.location ? String(e.location) : undefined,
      Description: e.tracking_detail ? String(e.tracking_detail) : undefined,
      Timestamp: new Date(String(e.checkpoint_time ?? Date.now())),
    }));

    const latest = data.latest_event as Record<string, unknown> | undefined;

    return {
      CurrentStatus: String(data.delivery_status ?? ""),
      CurrentLocation: latest?.location ? String(latest.location) : undefined,
      Events: events,
    };
  }

  parseWebhookPayload(body: Record<string, unknown>): TrackingEvent {
    const latest = body.latest_event as Record<string, unknown> | undefined;
    return {
      Status: String(body.delivery_status ?? ""),
      Location: latest?.location ? String(latest.location) : undefined,
      Description: latest?.tracking_detail ? String(latest.tracking_detail) : undefined,
      Timestamp: latest?.checkpoint_time ? new Date(String(latest.checkpoint_time)) : new Date(),
    };
  }

  getWebhookAwb(body: Record<string, unknown>): string | undefined {
    const awb = body.tracking_number;
    return awb ? String(awb) : undefined;
  }

  isDeliveredEvent(event: TrackingEvent): boolean {
    return /delivered/i.test(event.Status);
  }

  // Maps TrackingMore's delivery_status to our internal ShipmentStatus.
  // Returns null for statuses that don't warrant a state change (pending, exception, etc.).
  mapToShipmentStatus(deliveryStatus: string): ShipmentStatus | null {
    const s = deliveryStatus.toLowerCase();
    if (s === "pickup") return "Shipped";
    if (s === "transit") return "InTransit";
    if (/delivered/.test(s)) return "Delivered";
    return null;
  }
}

export const trackingService = new TrackingService();
