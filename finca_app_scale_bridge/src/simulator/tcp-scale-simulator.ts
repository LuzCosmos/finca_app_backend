import * as net from 'net';

const port = Number(process.env.SIMULATOR_PORT ?? 10001);
const stableWeight = Number(process.env.SIM_STABLE_WEIGHT ?? 412.5);

let tick = 0;

const server = net.createServer((socket) => {
  console.log(`[simulator] client connected`);
  const interval = setInterval(() => {
    tick += 1;
    const noise = (tick % 8 < 3) ? (Math.random() - 0.5) * 4 : 0;
    const w = (stableWeight + noise).toFixed(2);
    socket.write(`${w} kg\r\n`);
  }, 500);

  socket.on('close', () => {
    clearInterval(interval);
    console.log('[simulator] client disconnected');
  });
});

server.listen(port, '0.0.0.0', () => {
  console.log(`[simulator] TCP scale listening on ${port}`);
});
