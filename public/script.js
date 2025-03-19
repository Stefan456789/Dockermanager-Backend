document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const containerList = document.getElementById('containerList');
  const containerDetails = document.getElementById('containerDetails');
  const containerNameDisplay = document.getElementById('containerName');
  const startButton = document.getElementById('startButton');
  const stopButton = document.getElementById('stopButton');
  const restartButton = document.getElementById('restartButton');
  const refreshButton = document.getElementById('refreshButton');
  const consoleOutput = document.getElementById('console');
  const commandInput = document.getElementById('commandInput');
  const sendCommandButton = document.getElementById('sendCommandButton');
  
  // WebSocket connection
  let ws = null;
  let selectedContainerId = null;
  
  // API URL
  const API_URL = '/api';
  
  // Fetch container list
  async function fetchContainers() {
    try {
      const response = await fetch(`${API_URL}/containers`);
      const containers = await response.json();
      renderContainers(containers);
    } catch (error) {
      console.error('Error fetching containers:', error);
      showErrorMessage('Failed to fetch containers');
    }
  }
  
  // Render container list
  function renderContainers(containers) {
    containerList.innerHTML = '';
    
    if (containers.length === 0) {
      containerList.innerHTML = '<div class="no-containers">No containers found</div>';
      return;
    }
    
    containers.forEach(container => {
      const item = document.createElement('div');
      item.className = `container-item ${container.state.toLowerCase()}`;
      item.dataset.id = container.id;
      
      const portDisplay = container.ports.length > 0 ? 
        container.ports.map(p => `${p.publicPort || p.privatePort}:${p.privatePort}/${p.type}`).join(', ') : 
        'No ports exposed';
      
      item.innerHTML = `
        <div class="container-name">${container.name}</div>
        <div class="container-info">
          <span>${container.image}</span>
          <span class="container-status">${container.status}</span>
        </div>
        <div class="container-info">
          <span>Ports: ${portDisplay}</span>
        </div>
      `;
      
      item.addEventListener('click', () => selectContainer(container));
      containerList.appendChild(item);
    });
  }
  
  // Select a container to view details
  function selectContainer(container) {
    selectedContainerId = container.id;
    containerNameDisplay.textContent = container.name;
    containerDetails.classList.remove('hidden');
    
    // Connect to WebSocket for container logs
    connectWebSocket(container.id);
    
    // Update UI based on container state
    updateUIForContainerState(container.state);
  }
  
  function updateUIForContainerState(state) {
    if (state.toLowerCase() === 'running') {
      startButton.disabled = true;
      stopButton.disabled = false;
    } else {
      startButton.disabled = false;
      stopButton.disabled = true;
    }
  }
  
  // WebSocket connection for logs
  function connectWebSocket(containerId) {
    // Close existing WebSocket connection if any
    if (ws) {
      ws.close();
    }
    
    consoleOutput.innerHTML = '';
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/logs?containerId=${containerId}`;
    
    ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log('WebSocket connection established');
      appendToConsole('Connected to container logs...');
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'logs') {
          appendToConsole(data.log);
        } else if (data.type === 'commandOutput') {
          appendToConsole(`> ${data.output}`);
        } else if (data.type === 'error') {
          appendToConsole(`ERROR: ${data.message}`);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
        appendToConsole(`ERROR: Could not parse server message`);
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      appendToConsole('ERROR: WebSocket connection error');
    };
    
    ws.onclose = () => {
      appendToConsole('Disconnected from container logs');
    };
  }
  
  function appendToConsole(text) {
    const line = document.createElement('div');
    line.textContent = text;
    consoleOutput.appendChild(line);
    consoleOutput.scrollTop = consoleOutput.scrollHeight;
  }
  
  // Container actions
  async function startContainer() {
    if (!selectedContainerId) return;
    
    try {
      const response = await fetch(`${API_URL}/containers/${selectedContainerId}/start`, {
        method: 'POST'
      });
      
      if (response.ok) {
        appendToConsole('Container started');
        updateUIForContainerState('running');
        fetchContainers(); // Refresh the container list
      } else {
        const error = await response.json();
        appendToConsole(`Error starting container: ${error.message}`);
      }
    } catch (error) {
      console.error('Error starting container:', error);
      appendToConsole('Error starting container');
    }
  }
  
  async function stopContainer() {
    if (!selectedContainerId) return;
    
    try {
      const response = await fetch(`${API_URL}/containers/${selectedContainerId}/stop`, {
        method: 'POST'
      });
      
      if (response.ok) {
        appendToConsole('Container stopped');
        updateUIForContainerState('exited');
        fetchContainers(); // Refresh the container list
      } else {
        const error = await response.json();
        appendToConsole(`Error stopping container: ${error.message}`);
      }
    } catch (error) {
      console.error('Error stopping container:', error);
      appendToConsole('Error stopping container');
    }
  }
  
  async function restartContainer() {
    if (!selectedContainerId) return;
    
    try {
      const response = await fetch(`${API_URL}/containers/${selectedContainerId}/restart`, {
        method: 'POST'
      });
      
      if (response.ok) {
        appendToConsole('Container restarted');
        updateUIForContainerState('running');
        fetchContainers(); // Refresh the container list
      } else {
        const error = await response.json();
        appendToConsole(`Error restarting container: ${error.message}`);
      }
    } catch (error) {
      console.error('Error restarting container:', error);
      appendToConsole('Error restarting container');
    }
  }
  
  function sendCommand() {
    if (!selectedContainerId || !ws || ws.readyState !== WebSocket.OPEN) {
      appendToConsole('ERROR: Not connected to container');
      return;
    }
    
    const command = commandInput.value.trim();
    if (!command) return;
    
    appendToConsole(`> ${command}`);
    
    ws.send(JSON.stringify({
      type: 'command',
      containerId: selectedContainerId,
      command: command
    }));
    
    commandInput.value = '';
  }
  
  // Event listeners
  startButton.addEventListener('click', startContainer);
  stopButton.addEventListener('click', stopContainer);
  restartButton.addEventListener('click', restartContainer);
  refreshButton.addEventListener('click', fetchContainers);
  
  sendCommandButton.addEventListener('click', sendCommand);
  commandInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendCommand();
    }
  });
  
  // Initial load
  fetchContainers();
});
