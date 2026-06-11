# TrackingMore — Account Setup Guide

Used for: live package tracking, AWB status, delivery webhooks.  
**Free plan available.** Supports Delhivery, BlueDart, DTDC, Ekart, Xpressbees, Shadowfax, India Post, and 1300+ couriers worldwide.

> Why TrackingMore instead of Shiprocket?  
> Shiprocket's tracking API requires a paid plan. TrackingMore offers 500 free trackings/month with webhooks on the free tier — enough to get started without spending anything.

---

## Step 1 — Create a TrackingMore Account

1. Go to [https://www.trackingmore.com/register](https://www.trackingmore.com/register)
2. Sign up with your email
3. Verify your email address
4. Log in to the dashboard

---

## Step 2 — Get Your API Key

1. In the dashboard, go to **Developer** (left sidebar)
2. Click **API Key**
3. Click **Generate API Key**
4. Give it a name (e.g. `krono-square-prod`)
5. Click **Create**
6. **Copy the key immediately** — TrackingMore only shows it once

> If you lose the key, delete it and generate a new one.

---

## Step 3 — Set Environment Variables

Add these two variables to your `.env` file:

```env
TRACKINGMORE_API_KEY=your_api_key_here
TRACKING_WEBHOOK_SECRET=pick_any_random_secret_string
```

- `TRACKINGMORE_API_KEY` — the key from Step 2
- `TRACKING_WEBHOOK_SECRET` — a secret string you invent (used to verify webhook calls are genuinely from TrackingMore)

---

## Step 4 — Register the Webhook URL (Optional)

Webhooks let TrackingMore push status updates to your server automatically.  
**This is optional** — the `GET /api/seller/shipments/:id/track` endpoint already fetches live data on demand without needing webhooks.

Only set up webhooks if you want the DB to update automatically in the background.

1. Log in to [https://app.trackingmore.com](https://app.trackingmore.com)
2. Go to **Developer → Webhook**
3. Click **Add Webhook**
4. Fill in the form:

   | Field | Value |
   |-------|-------|
   | **Webhook URL** | `https://your-api-domain.com/api/shipments/webhook/tracking` |
   | **Events** | Select: `delivered`, `in_transit`, `out_for_delivery`, `failed_attempt` |
   | **Header Name** | `X-Trackingmore-Secret` |
   | **Header Value** | Same string as `TRACKING_WEBHOOK_SECRET` in `.env` |

5. Click **Save**

> For local testing, use [ngrok](https://ngrok.com) — run `ngrok http 5000` and use the HTTPS URL it gives you.

---

## Step 5 — Test Without a Real Shipment (Dummy Tracking Numbers)

TrackingMore provides an official **test courier** so you can verify the integration is working before you have any real orders.

### Test tracking numbers

Use `Courier: "test-carrier"` with the tracking number for the status you want to simulate.

**Even months (Feb, Apr, Jun, Aug, Oct, Dec) — TEST2234 series:**

| Status to simulate | Tracking Number |
|--------------------|-----------------|
| Pending | `TEST2234123401` |
| Info Received | `TEST2234123411` |
| In Transit | `TEST2234123421` |
| Out for Delivery | `TEST2234123431` |
| Delivered | `TEST2234123441` |
| Failed Attempt | `TEST2234123451` |
| Exception | `TEST2234123461` |
| Expired | `TEST2234123481` |

**Odd months (Jan, Mar, May, Jul, Sep, Nov) — TEST1234 series:**

Same pattern, replace `TEST2234` with `TEST1234` (e.g. `TEST1234123441` for Delivered).

> Using the wrong month's series returns `NotFound` — expected, not a bug.

### Step-by-step in Postman

**1. Create a test shipment**

```
POST http://localhost:5000/api/shipments
Content-Type: application/json

{
  "CheckoutID": "<any real checkout _id from MongoDB>",
  "SellerID": "<any real user _id from MongoDB>",
  "Courier": "test-carrier",
  "TrackingNumber": "TEST2234123401",
  "ShipmentStatus": "Shipped"
}
```

Copy the `_id` from the response.

**2. Fetch live tracking**

```
GET http://localhost:5000/api/shipments/<_id from above>/track
```

You should get back a full events timeline (Info Received → In Transit → Out for Delivery → Delivered) with dummy data from TrackingMore's test server.

If this works, the API key is correct and the service is wired up properly.

---

## Step 6 — Test the Integration with a Real AWB

### Test live tracking (on-demand)
```
GET /api/shipments/:shipmentID/track
```
1. Create a shipment with a real AWB/tracking number and the actual courier name (e.g. `Delhivery`)
2. Call the endpoint above
3. You should get back `CurrentStatus`, `CurrentLocation`, and an `Events[]` array

### Test the webhook (simulated push)
```bash
curl -X POST http://localhost:5000/api/shipments/webhook/tracking \
  -H "Content-Type: application/json" \
  -H "X-Trackingmore-Secret: pick_any_random_secret_string" \
  -d '{
    "tracking_number": "YOUR_AWB_NUMBER",
    "delivery_status": "delivered",
    "latest_event": {
      "tracking_detail": "Shipment delivered successfully",
      "location": "Mumbai",
      "checkpoint_time": "2024-01-15T14:30:00Z"
    }
  }'
```

After sending this, check MongoDB — the shipment's `TrackingEvents` array should grow, and if status is `delivered`, the checkout's `DeliveryStatus` should change to `"Delivered"`.

---

## Supported Indian Couriers

| Courier | Code used internally |
|---------|----------------------|
| Delhivery | `delhivery` |
| BlueDart | `bluedart` |
| DTDC | `dtdc` |
| Ekart | `ekart-in` |
| Xpressbees | `xpressbees` |
| Shadowfax | `shadowfax-in` |
| Ecom Express | `ecom-express` |
| India Post | `india-post` |
| FedEx | `fedex` |
| DHL | `dhl` |

The seller just enters the courier name when creating a shipment — the backend maps it automatically. If a courier isn't in the list, add it to `COURIER_CODE_MAP` in `src/shared/services/tracking.service.ts`.

Full courier list: [https://www.trackingmore.com/courier.html](https://www.trackingmore.com/courier.html)

---

## Free Plan Limits

| Feature | Free Plan |
|---------|-----------|
| Trackings per month | 500 |
| Couriers supported | 1300+ |
| Webhooks | Yes |
| API access | Yes |
| Overage cost | $0.002 per tracking |

500 trackings/month = 500 unique shipments tracked. More than enough during development and early launch.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `401 Unauthorized` | Wrong or missing `TRACKINGMORE_API_KEY` in `.env` |
| `Could not detect courier` | Pass the courier name when creating the shipment — auto-detect can fail for some AWB formats |
| No events returned | AWB not yet scanned by the courier (normal for first few hours after dispatch) |
| Webhook not firing | Check URL is publicly reachable; use ngrok for local dev |
| `Invalid webhook secret` in logs | `TRACKING_WEBHOOK_SECRET` in `.env` doesn't match header value in TrackingMore dashboard |
| Courier not found | Add the courier code to `COURIER_CODE_MAP` in `tracking.service.ts` |

---

## Files in This Project

| File | Purpose |
|------|---------|
| `src/shared/services/tracking.service.ts` | TrackingMore API client + webhook parser + courier code mapping |
| `src/modules/commerce/shipment/shipment.controller.ts` | `getShipmentTracking` + `handleTrackingWebhook` handlers |
| `src/modules/commerce/shipment/shipment.routes.ts` | Routes: `GET /:id/track` and `POST /webhook/tracking` |
| `src/shared/config/env.ts` | Env var definitions |
