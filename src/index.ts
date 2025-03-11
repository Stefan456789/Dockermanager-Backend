
import { app } from './server';
import { setupWebSocketServer } from './websocket';
import http from 'http';

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);
setupWebSocketServer(server);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});