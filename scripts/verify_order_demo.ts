import { createOrderAccess } from "../src/order_access.js";

const phone = process.env.DEMO_PHONE;
const code = process.env.DEMO_CODE;
if (!phone || !code) throw new Error("DEMO_PHONE and DEMO_CODE are required");

const access = createOrderAccess();
const result = await access.verifyAndReadOrder({ phone, code });
console.log(JSON.stringify(result, null, 2));
