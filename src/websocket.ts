import { Server as HttpServer } from 'http';
import { Server as WebSocketServer } from 'ws';
import Docker from 'dockerode';
import { Readable } from 'stream';
import jwt from 'jsonwebtoken';
import * as db from './models/database';

const docker = new Docker();
const containerLogStreams = new Map<string, Readable>();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export function setupWebSocketServer(server: HttpServer) {
  const wss = new WebSocketServer({ server, path: '/api/logs' });

  wss.on('connection', async (ws, req) => {
    console.log('WebSocket connection attempt');
    
    // Get container ID from URL query params
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const containerId = url.searchParams.get('containerId');
    const token = url.searchParams.get('token');
    
    if (!containerId) {
      ws.close(1008, 'Container ID is required');
      console.log('Container ID is required');
    return;
    }
    
    
    // Authenticate user
    if (!token) {
      ws.close(1008, 'Authentication required');
      console.log('Authentication required');
      return;
    }
    try {
      // Verify the JWT token
      const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string };
          
      // Find the user in the database
      const user = await db.findUserByEmail(decoded.email);
      
      if (!user){
        ws.close(1008, 'User does not exist');
        console.log('User does not exist');
        return
      }

      // Check container-specific permissions using the user context
      if (!db.hasPermission(user.id, 'container.read_console')) {
        ws.close(1008, 'Not authorized to read console output');
        console.log('Not authorized to read console output');
      return;
      }
      
      console.log('WebSocket connection established for user:', decoded.email);
      
      // Set up log streaming for the container
      setupContainerLogs(containerId, ws);
      
      ws.on('message', async (message) => {
        try {
          const data = JSON.parse(message.toString());
          
          if (data.type === 'command' && data.containerId && data.command) {
            // Check write permission for console commands
            if (!db.hasPermission(decoded.id, 'container.write_console')) {
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Permission denied: You are not authorized to execute commands'
              }));
              return;
            }
            
            const container = docker.getContainer(data.containerId);
            const exec = await container.exec({
              Cmd: ['sh', '-c', data.command],
              AttachStdout: true,
              AttachStderr: true
            });
            
            const stream = await exec.start({ hijack: true, stdin: true });
            stream.on('data', (chunk) => {
              ws.send(JSON.stringify({
                type: 'commandOutput',
                containerId: data.containerId,
                output: chunk.toString()
              }));
            });
          } 
        } catch (error) {
          console.error('WebSocket error:', error);
          ws.send(JSON.stringify({ type: 'error', message: 'Error processing command' }));
        }
      });

      ws.on('close', () => {
        // Clean up log stream if it exists
        if (containerId && containerLogStreams.has(containerId)) {
          const stream = containerLogStreams.get(containerId);
          if (stream) {
            stream.destroy();
          }
          containerLogStreams.delete(containerId);
        }
        console.log('WebSocket connection closed');
      });
      
    } catch (error) {
      console.error('WebSocket authentication error:', error);
      ws.close(1008, 'Authentication failed');
    }
  });

  return wss;
}

async function setupContainerLogs(containerId: string, ws: any) {
  try {
    const container = docker.getContainer(containerId);
    
    // Get logs
    const logStream = await container.logs({
      follow: true,
      stdout: true,
      stderr: true,
      timestamps: true,
    });
    
    containerLogStreams.set(containerId, logStream as Readable);
    
    logStream.on('data', (chunk) => {
      ws.send(JSON.stringify({
        type: 'logs',
        containerId: containerId,
        log: chunk.toString('utf8')
      }));
    });
    
    logStream.on('error', (err) => {
      console.error('Log stream error:', err);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Error streaming logs',
        error: err.message
      }));
    });
    
    logStream.on('end', () => {
      ws.send(JSON.stringify({
        type: 'logs',
        containerId: containerId,
        log: 'Log stream ended'
      }));
    });
    
  } catch (error) {
    console.error('Error setting up logs:', error);
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Error setting up log streaming',
      error: (error as Error).message
    }));
  }
}
