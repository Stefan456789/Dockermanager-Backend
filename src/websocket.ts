import { Server as HttpServer } from 'http';
import { Server as WebSocketServer } from 'ws';
import Docker from 'dockerode';
import { Readable } from 'stream';

const docker = new Docker();
const containerLogStreams = new Map<string, Readable>();

export function setupWebSocketServer(server: HttpServer) {
  const wss = new WebSocketServer({ server, path: '/api/logs' });

  wss.on('connection', (ws, req) => {
    console.log('WebSocket connection established');
    
    // Get container ID from URL query params
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const containerId = url.searchParams.get('containerId');
    
    if (!containerId) {
      ws.close(1008, 'Container ID is required');
      return;
    }

    // Set up log streaming for the container
    setupContainerLogs(containerId, ws);
    
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        if (data.type === 'command' && data.containerId && data.command) {
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
        } else if (data.type === 'stdin' && data.containerId && data.input) {
          const container = docker.getContainer(data.containerId);
          const attachOptions = {
            stream: true,
            stdin: true,
            stdout: true,
            stderr: true
          };

          const stream = await container.attach(attachOptions);
          stream.write(data.input + '\n');
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
