// Click the header "Start hunting" button in headless Chrome and report whether the
// "Start a hunt" box ends up in view. Usage: node scripts/check-start-scroll.mjs <debug-port> <url>
const [port, url] = process.argv.slice(2);
const targets = await (await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: "PUT" })).json();
const ws = new WebSocket(targets.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
let id = 0;
const send = (method, params = {}) => new Promise((resolve) => {
    const my = ++id;
    const on = (ev) => { const m = JSON.parse(ev.data); if (m.id === my) { ws.removeEventListener("message", on); resolve(m.result); } };
    ws.addEventListener("message", on);
    ws.send(JSON.stringify({ id: my, method, params }));
});
const evalJs = async (expr) => (await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true })).result.value;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await sleep(2500);
const before = await evalJs(`JSON.stringify({ scrollY: Math.round(scrollY), boxTop: Math.round(document.getElementById("start").getBoundingClientRect().top) })`);
await evalJs(`document.querySelector('[data-testid="link-start"]').click()`);
await sleep(1500);
const after = await evalJs(`JSON.stringify({ path: location.pathname, scrollY: Math.round(scrollY), boxTop: Math.round(document.getElementById("start").getBoundingClientRect().top), inView: (() => { const r = document.getElementById("start").getBoundingClientRect(); return r.top >= 0 && r.top < innerHeight; })(), focused: document.activeElement?.getAttribute("data-testid") })`);
console.log("before:", before);
console.log("after: ", after);
ws.close();
process.exit(0);
