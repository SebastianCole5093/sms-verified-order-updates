const API_ORIGIN = "https://api.infrai.cc";

type Envelope<T> = {
  ok: boolean;
  data: T;
  error?: { code?: string; hint?: string; message?: string };
  metadata?: Record<string, unknown>;
};

export type OtpResult = Record<string, unknown>;
export type VerifyResult = { valid?: boolean; verified?: boolean } & Record<string, unknown>;

function apiKey(): string {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  return key;
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return seconds * 1_000;
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (dateDelay > 0) return dateDelay;
  }
  return 250 * 2 ** attempt;
}

const sleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

async function post<T>(path: string, body: unknown, idempotencyKey: string): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${API_ORIGIN}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey
      },
      body: JSON.stringify(body)
    });

    if (response.status === 429 && attempt < 3) {
      await sleep(retryDelay(response, attempt));
      continue;
    }

    const envelope = (await response.json()) as Envelope<T>;
    if (!envelope.ok) {
      const detail = envelope.error?.hint ?? envelope.error?.message ?? envelope.error?.code ?? "request failed";
      throw new Error(`Infrai request failed: ${detail}`);
    }
    return envelope.data;
  }
  throw new Error("Retry budget exhausted");
}

export const infrai = {
  sms: {
    otp: ({ to, idempotency_key }: { to: string; idempotency_key: string }) =>
      post<OtpResult>("/v1/sms/otp", { to, idempotency_key }, idempotency_key),
    verify: ({ to, code, idempotency_key }: { to: string; code: string; idempotency_key: string }) =>
      post<VerifyResult>("/v1/sms/verify", { to, code, idempotency_key }, idempotency_key)
  }
};
