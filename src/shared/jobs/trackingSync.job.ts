import cron from "node-cron";
import { shipmentRepository } from "../../modules/commerce/shipment/shipment.repository";
import { checkoutRepository } from "../../modules/commerce/checkout/checkout.repository";
import { trackingService } from "../services/tracking.service";
import logger from "../utils/logger";

const DELIVERY_STATUS: Record<string, string> = {
  Pending: "Processing",
  Shipped: "Shipped",
  InTransit: "Shipped",
  OutForDelivery: "Shipped",
  Delivered: "Delivered",
};

const STATUS_ORDER: Record<string, number> = {
  Pending: 0,
  Shipped: 1,
  InTransit: 2,
  OutForDelivery: 3,
  Delivered: 4,
};

async function syncActiveShipments(): Promise<void> {
  const active = await shipmentRepository.find({
    ShipmentStatus: { $ne: "Delivered" },
    TrackingNumber: { $exists: true, $ne: "" },
  } as any);

  if (active.length === 0) return;

  logger.info(`Tracking sync: checking ${active.length} active shipment(s)`);

  for (const shipment of active) {
    try {
      const result = await trackingService.fetchTracking(shipment.TrackingNumber, shipment.Courier);
      const targetStatus = trackingService.mapToShipmentStatus(result.CurrentStatus);
      if (!targetStatus) continue;

      const currentOrder = STATUS_ORDER[shipment.ShipmentStatus] ?? 0;
      const targetOrder = STATUS_ORDER[targetStatus] ?? -1;
      if (targetOrder <= currentOrder) continue;

      const now = new Date();
      const patch: Record<string, unknown> = {
        ShipmentStatus: targetStatus,
        TrackingEvents: result.Events,
        LastTrackedAt: now,
        TrackingProvider: "TrackingMore",
      };

      if (targetOrder >= STATUS_ORDER["Shipped"] && !shipment.ShippedAt) {
        patch.ShippedAt = now;
      }
      if (targetStatus === "Delivered" && !shipment.DeliveredAt) {
        patch.DeliveredAt = now;
      }

      await shipmentRepository.updateById(shipment._id!, patch);
      await checkoutRepository.updateById(shipment.CheckoutID, {
        DeliveryStatus: DELIVERY_STATUS[targetStatus],
      } as any);

      logger.info(`Tracking sync: ${shipment.TrackingNumber} → ${targetStatus}`);
    } catch (err) {
      logger.warn(`Tracking sync: failed for ${shipment.TrackingNumber} — ${(err as Error).message}`);
    }
  }
}

export function startTrackingSyncJob(): void {
  // Runs once daily at midnight as a safety net for missed webhook pushes.
  cron.schedule("0 0 * * *", () => {
    syncActiveShipments().catch((err) =>
      logger.error(`Tracking sync job failed: ${err.message}`)
    );
  });
  logger.info("Tracking sync job scheduled (daily at midnight)");
}
