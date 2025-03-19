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
        
        return this.convertToContainerInfo(container, inspect);
      });
      
      return Promise.all(containerDetailsPromises);
    } catch (error) {
      console.error('Error listing containers:', error);
      throw new Error(`Failed to list containers: ${(error as Error).message}`);
    }
  }

  // Helper method to convert Docker container data to ContainerInfo format
  private convertToContainerInfo(containerData: Docker.ContainerInfo, inspectData: Docker.ContainerInspectInfo): ContainerInfo {
    return {
      id: containerData.Id,
      name: containerData.Names[0].replace(/^\//, ''),
      image: containerData.Image,
      state: containerData.State,
      status: containerData.Status,
      ports: (containerData.Ports || []).map((port: any) => ({
        privatePort: port.PrivatePort,
        publicPort: port.PublicPort,
        type: port.Type
      })),
      created: new Date(containerData.Created * 1000).toISOString(),
      tty: inspectData.Config.Tty,
      openStdin: inspectData.Config.OpenStdin
    };
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

  async getContainerById(containerId: string): Promise<ContainerInfo> {
    return this.listContainers().then((containers) => {
      const container = containers.find((c) => c.id === containerId);
      if (container) {
        return container;
      } else {
        throw new Error('Container not found');
      }
    });
  }
}

export default new DockerService();
