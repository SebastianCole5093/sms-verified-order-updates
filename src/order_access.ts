import { randomUUID } from "node:crypto";
import { z } from "zod";
import { infrai, type VerifyResult } from "./infrai_sms.js";

export const phoneSchema = z.string().regex(/^\+[1-9]\d{7,14}$/, "Use an E.164 phone number");
export const sendCodeBody = z.object({ phone: phoneSchema }).strict();
export const verifyCodeBody = z.object({
  phone: phoneSchema,
  code: z.string().regex(/^\d{4,8}$/, "Code must contain 4 to 8 digits")
}).strict();

type OrderUpdate = {
  at: string;
  state: "checkout_confirmed" | "fulfillment_packed" | "receipt_issued" | "shipped";
  note: string;
};

export type CustomerOrder = {
  orderId: string;
  checkout: { total: string; currency: "USD" };
  fulfillment: { status: "shipped"; carrier: string };
  receipt: { number: string; issuedAt: string };
  updates: OrderUpdate[];
};

export interface SmsOtpGateway {
  send(phone: string, idempotencyKey: string): Promise<unknown>;
  verify(phone: string, code: string, idempotencyKey: string): Promise<VerifyResult>;
}

const liveSms: SmsOtpGateway = {
  send: (phone, idempotencyKey) => infrai.sms.otp({ to: phone, idempotency_key: idempotencyKey }),
  verify: (phone, code, idempotencyKey) =>
    infrai.sms.verify({ to: phone, code, idempotency_key: idempotencyKey })
};

const ordersByPhone = new Map<string, CustomerOrder>([
  [
    "+14155550123",
    {
      orderId: "ORDER-1042",
      checkout: { total: "86.40", currency: "USD" },
      fulfillment: { status: "shipped", carrier: "Parcel North" },
      receipt: { number: "RCPT-1042", issuedAt: "2026-08-12T08:30:00Z" },
      updates: [
        { at: "2026-08-12T08:30:00Z", state: "checkout_confirmed", note: "Payment received" },
        { at: "2026-08-12T10:10:00Z", state: "fulfillment_packed", note: "Items packed" },
        { at: "2026-08-12T10:15:00Z", state: "receipt_issued", note: "Receipt RCPT-1042 issued" },
        { at: "2026-08-12T14:20:00Z", state: "shipped", note: "Handed to Parcel North" }
      ]
    }
  ]
]);

export function createOrderAccess(gateway: SmsOtpGateway = liveSms) {
  return {
    async requestCode(input: unknown) {
      const { phone } = sendCodeBody.parse(input);
      await gateway.send(phone, randomUUID());
      return { status: "code_sent" as const, phone };
    },

    async verifyAndReadOrder(input: unknown) {
      const { phone, code } = verifyCodeBody.parse(input);
      const verification = await gateway.verify(phone, code, randomUUID());
      const accepted = verification.verified === true || verification.valid === true;
      if (!accepted) return { status: "verification_rejected" as const };

      const order = ordersByPhone.get(phone);
      return order
        ? { status: "order_released" as const, order }
        : { status: "verified_no_order" as const };
    }
  };
}
