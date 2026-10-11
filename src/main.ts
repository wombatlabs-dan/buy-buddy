// Buy Buddy backend — entry point.
// Right now this is a minimal "hello" server used to prove that an Anbaric Cloud
// deploy gets a public address the Base44 front end can call. The hunt engine
// (Anbaric state machine) gets added in the next pull request.
import { createServer } from "node:http";

const port = Number(process.env.PORT ?? 3000);

const server = createServer((req, res) => {
  // Allow the Base44 front end (a different domain) to call this API
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.writeHead(204).end();
    return;
  }
  if (req.url === "/health" || req.url === "/api/hello") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, app: "buy-buddy", time: new Date().toISOString() }));
    return;
  }
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "not found" }));
});

server.listen(port, () => console.log(`buy-buddy listening on ${port}`));
