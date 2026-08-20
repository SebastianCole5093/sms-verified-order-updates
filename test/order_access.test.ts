import assert from "node:assert/strict";
import test from "node:test";
import { createOrderAccess, type SmsOtpGateway } from "../src/order_access.js";

test("releases the complete order timeline only after OTP verification", async () => {
  const accepted: SmsOtpGateway = {
    send: async () => ({}),
    verify: async () => ({ verified: true })
  };
  const access = createOrderAccess(accepted);

  const result = await access.verifyAndReadOrder({ phone: "+14155550123", code: "482911" });

  assert.equal(result.status, "order_released");
  if (result.status !== "order_released") return;
  assert.equal(result.order.checkout.total, "86.40");
  assert.equal(result.order.fulfillment.status, "shipped");
  assert.equal(result.order.receipt.number, "RCPT-1042");
  assert.deepEqual(result.order.updates.map((update) => update.state), [
    "checkout_confirmed",
    "fulfillment_packed",
    "receipt_issued",
    "shipped"
  ]);
});

test("does not expose order data when OTP verification is rejected", async () => {
  const rejected: SmsOtpGateway = {
    send: async () => ({}),
    verify: async () => ({ verified: false })
  };
  const result = await createOrderAccess(rejected).verifyAndReadOrder({
    phone: "+14155550123",
    code: "000000"
  });

  assert.deepEqual(result, { status: "verification_rejected" });
});

test("rejects an unknown request field at the boundary", async () => {
  const gateway: SmsOtpGateway = {
    send: async () => ({}),
    verify: async () => ({ verified: true })
  };

  await assert.rejects(
    createOrderAccess(gateway).verifyAndReadOrder({
      phone: "+14155550123",
      code: "482911",
      customerId: "customer-7"
    })
  );
});
