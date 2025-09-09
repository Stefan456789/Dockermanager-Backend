
import { app } from './server';
import { setupWebSocketServer } from './websocket';
import http from 'http';
import dotenv from 'dotenv';

dotenv.config();

console.log('Environment variables loaded:');
console.log('ADMIN_EMAIL:', process.env.ADMIN_EMAIL || 'Not set');
console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'Set' : 'Not set');

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);
setupWebSocketServer(server);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});