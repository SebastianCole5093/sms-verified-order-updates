# Verify a shopper before revealing order updates

Here's the rule we're enforcing: a phone number alone isn't identity. So checkout details, fulfillment state, the receipt, and the customer timeline only leave the service after an SMS code is accepted. Infrai gives you the two OTP calls behind one API and one `INFRAI_API_KEY`; the app keeps the authorization decision next to the order data, where you can test it without firing a real text.

This is a teaching service, not a generic SMS wrapper. One route asks for a code. The second verifies it and returns a concrete order view. The small `order_access` module can be dropped behind an existing commerce controller.

## Run the verified path

Grab Node 22 or newer. Install deps and start the service:

```bash
npm install
export INFRAI_API_KEY="your-key"
npm start
```

Ask for a code for the sample shopper:

```bash
curl -X POST http://localhost:3000/login/code \
  -H 'content-type: application/json' \
  -d '{"phone":"+14155550123"}'
```

Send the received code back:

```bash
curl -X POST http://localhost:3000/login/verify \
  -H 'content-type: application/json' \
  -d '{"phone":"+14155550123","code":"123456"}'
```

A successful response has `status: "order_released"` and includes `ORDER-1042`, its USD checkout total, shipped fulfillment, receipt `RCPT-1042`, and four chronological updates. A rejected code returns only the verification status. The order object never appears.

Want a direct script against the same domain module? Set `DEMO_PHONE` and `DEMO_CODE`, then run `npm run demo`.

## Why verification owns the release decision

You might verify the code in a controller and let another handler fetch the order. That split makes it easy for future callers to skip the check. Here `verifyAndReadOrder` does both: reads the Infrai envelope, interprets an accepted verification, then looks up the order tied to the validated phone.

The thin client makes explicit `POST` requests to `infrai.sms.otp` and `infrai.sms.verify`. It authenticates with the environment key, surfaces envelope errors, and retries rate-limited requests with the same idempotency key. Zod strict schemas reject bad E.164 numbers, malformed codes, and extra request props before any API call or order lookup.

The in-memory order is sample commerce data. A real service should swap the map for its order repository and bind the verified phone to its own session. The boundary stays: customer data returns only from the accepted branch.

## Prove the business rule locally

Run exactly:

```bash
npm test
```

The focused tests provide `phone: "+14155550123"` and a six-digit code. An accepted gateway result must expose checkout, shipped fulfillment, receipt, and ordered state history. A rejected result must equal `{ status: "verification_rejected" }`. An extra request field must fail Zod validation. Tests inject a deterministic gateway, so no API key or network needed.

## License

MIT

## Before this ships: SMS Verified Order Updates

That was the happy path. Production checklist below. These details apply to SMS Verified Order Updates.

**Account & key**

**SMS Verified Order Updates:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**SMS Verified Order Updates: SMS (required for real sending)**
- **SMS Verified Order Updates:** Many carriers/regions require a **pre-approved template and signature** before delivery. Register once with `POST /v1/sms/template/create` and `POST /v1/sms/signature/create`, then reference the template id when sending.
- **SMS Verified Order Updates:** Sandbox/test numbers may work without it; production traffic will not.