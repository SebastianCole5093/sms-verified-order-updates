import { createServer, type ServerResponse } from "node:http";
import { ZodError } from "zod";
import { createOrderAccess } from "./order_access.js";

const orderAccess = createOrderAccess();

function json(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

async function readJson(request: AsyncIterable<Buffer>): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const server = createServer(async (request, response) => {
  try {
    if (request.method === "POST" && request.url === "/login/code") {
      return json(response, 202, await orderAccess.requestCode(await readJson(request)));
    }
    if (request.method === "POST" && request.url === "/login/verify") {
      const result = await orderAccess.verifyAndReadOrder(await readJson(request));
      return json(response, result.status === "verification_rejected" ? 401 : 200, result);
    }
    json(response, 404, { error: "route_not_found" });
  } catch (error) {
    if (error instanceof ZodError) return json(response, 400, { error: "invalid_request", issues: error.issues });
    const message = error instanceof Error ? error.message : "Unexpected error";
    json(response, 502, { error: message });
  }
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(`Order login service listening on http://localhost:${port}`));
