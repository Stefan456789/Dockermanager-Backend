import Docker from 'dockerode';

const docker = new Docker();

export interface ContainerInfo {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
  ports: Array<{
    privatePort: number;
    publicPort?: number;
    type: string;
  }>;
  created: string;
  tty: boolean;
  openStdin: boolean;
}

export class DockerService {
  async listContainers(): Promise<ContainerInfo[]> {
    try {
      const containers = await docker.listContainers({ all: true });
      
      const containerDetailsPromises = containers.map(async (container) => {
        const containerDetail = docker.getContainer(container.Id);
        const inspect = await containerDetail.inspect();
        
        return {
          id: container.Id,
          name: container.Names[0].replace(/^\//, ''),
          image: container.Image,
          state: container.State,
          status: container.Status,
          ports: container.Ports.map(port => ({
            privatePort: port.PrivatePort,
            publicPort: port.PublicPort,
            type: port.Type
          })),
          created: new Date(container.Created * 1000).toISOString(),
          tty: inspect.Config.Tty,
          openStdin: inspect.Config.OpenStdin
        };
      });
      
      return Promise.all(containerDetailsPromises);
    } catch (error) {
      console.error('Error listing containers:', error);
      throw new Error(`Failed to list containers: ${(error as Error).message}`);
    }
  }

  async startContainer(containerId: string): Promise<void> {
    try {
      const container = docker.getContainer(containerId);
      await container.start();
    } catch (error) {
      console.error('Error starting container:', error);
      throw new Error(`Failed to start container: ${(error as Error).message}`);
    }
  }

  async stopContainer(containerId: string): Promise<void> {
    try {
      const container = docker.getContainer(containerId);
      await container.stop();
    } catch (error) {
      console.error('Error stopping container:', error);
      throw new Error(`Failed to stop container: ${(error as Error).message}`);
    }
  }

  async restartContainer(containerId: string): Promise<void> {
    try {
      const container = docker.getContainer(containerId);
      await container.restart();
    } catch (error) {
      console.error('Error restarting container:', error);
      throw new Error(`Failed to restart container: ${(error as Error).message}`);
    }
  }
}

export default new DockerService();
