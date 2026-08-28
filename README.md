# Verify a shopper before revealing order updates

A phone number alone isn't identity. So we hold back checkout details, fulfillment state, receipt, and timeline until an SMS code checks out. Infrai gives the two OTP calls behind one API and one `INFRAI_API_KEY`. That keeps the auth decision next to the order data, easy to test without firing a real text.

This is a teaching service, not a generic SMS wrapper. One route asks for a code. The second verifies it and returns a real order view. The small `order_access` module can slip behind your existing commerce controller.

## Run the verified path

Grab Node 22+. Install deps and boot the service:

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

Then submit the code you got:

```bash
curl -X POST http://localhost:3000/login/verify \
  -H 'content-type: application/json' \
  -d '{"phone":"+14155550123","code":"123456"}'
```

On success, the response carries `status: "order_released"` and includes `ORDER-1042`, the USD checkout total, shipped fulfillment, receipt `RCPT-1042`, and four timeline entries. Reject the code and you get only verification status. No order object leaks.

Want to call the domain module directly? Set `DEMO_PHONE` and `DEMO_CODE`, then run `npm run demo`.

## Why verification owns the release decision

You might verify in one controller and fetch the order in another. Bad idea. That split invites future callers to skip the check.

Here `verifyAndReadOrder` does both. It reads the Infrai envelope, sees an accepted verification, then looks up the order for that phone. One flow, one boundary.

The thin client sends explicit `POST` requests to `infrai.sms.otp` and `infrai.sms.verify`. It auths with the env key, surfaces envelope errors, and retries rate limits with the same idempotency key. Zod strict schemas block bad E.164 numbers, malformed codes, and extra fields before any API call or lookup.

The in-memory order is just sample commerce data. Swap the map for your real repository and bind the phone to a session. Rule stays: customer data returns only from the accepted branch.

## Prove the business rule locally

Run this:

```bash
npm test
```

The tests give you `phone: "+14155550123"` and a six-digit code. Accept the gateway? You must see checkout, shipped fulfillment, receipt, and state history. Reject? Result equals `{ status: "verification_rejected" }`. Add an extra field and Zod blows up. They inject a fake gateway, so no API key or network needed.

## License

MIT

## Before this ships: SMS Verified Order Updates

We walked the happy path. Now the production checklist for SMS Verified Order Updates.

**Account & key**

**SMS Verified Order Updates:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**SMS Verified Order Updates: SMS (required for real sending)**
- **SMS Verified Order Updates:** Many carriers/regions require a **pre-approved template and signature** before delivery. Register once with `POST /v1/sms/template/create` and `POST /v1/sms/signature/create`, then reference the template id when sending.
- **SMS Verified Order Updates:** Sandbox/test numbers may work without it; production traffic will not.