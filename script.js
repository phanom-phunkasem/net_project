// script.js - FULLY COMPLETE VERSION

// --- GLOBAL STATE & CONFIG ---
const API_BASE_URL = 'http://127.0.0.1:5000';
let socket = null;
let currentConfigDevice = null;
let currentPrompt = '';

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    // Basic auth check can be added here if needed
    setupNavigation();
    setupEventListeners();
    showSection('dashboard');
});

// --- CORE UI & NAVIGATION ---
function setupNavigation() {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            const sectionId = e.target.id.replace('nav-', '');
            showSection(sectionId);
        });
    });
}

function showSection(sectionId) {
    document.querySelectorAll('.main-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(`${sectionId}-section`)?.classList.remove('hidden');
    document.querySelectorAll('.nav-link').forEach(l => l.classList.toggle('active', l.id.includes(sectionId)));
    if (sectionId === 'dashboard') fetchAndDisplayAllDevices();
}

// --- DASHBOARD DISPLAY ---
async function fetchAndDisplayAllDevices() {
    const routerGrid = document.getElementById('Routers-grid');
    const switchGrid = document.getElementById('Switches-grid');
    routerGrid.innerHTML = '<p>Loading Routers...</p>';
    switchGrid.innerHTML = '<p>Loading Switches...</p>';
    try {
        const response = await fetch(`${API_BASE_URL}/api/devices`);
        const data = await response.json();
        routerGrid.innerHTML = '';
        switchGrid.innerHTML = '';
        if (data.status === 'success' && data.devices.length > 0) {
            data.devices.forEach(device => {
                const cardHTML = createDeviceCardHTML(device);
                const targetGrid = device.category === 'Routers' ? routerGrid : switchGrid;
                targetGrid.insertAdjacentHTML('beforeend', cardHTML);
                checkDeviceStatus(document.getElementById(`device-card-${device.id}`));
            });
        } else {
            routerGrid.innerHTML = '<p>No Routers found.</p>';
            switchGrid.innerHTML = '<p>No Switches found.</p>';
        }
    } catch (error) {
        routerGrid.innerHTML = `<p>Error: ${error.message}</p>`;
        switchGrid.innerHTML = '';
    }
}

function createDeviceCardHTML(device) {
    const deviceInfoForApi = JSON.stringify({
        device_type: device.device_type, host: device.host, username: device.username,
        password: device.password, secret: device.secret || ''
    });
    // เพิ่ม data-device-category เข้าไปใน card หลัก
    return `
        <div class="device-card" id="device-card-${device.id}" data-device-info='${deviceInfoForApi}' data-device-name="${device.name}" data-device-category="${device.category}">
            <div class="device-summary">
                <div class="device-main-info">
                    <h3 class="device-name">${device.name}</h3>
                    <p class="device-ip">${device.host}</p>
                </div>
                <div class="device-info-summary">
                    <span class="status-badge checking-badge">Checking...</span>
                </div>
                <div class="device-actions">
                    <button class="icon-button config-button" title="Config">
                        <svg class="button-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M7 3.5A1.5 1.5 0 018.5 2h3A1.5 1.5 0 0113 3.5v1.086a.75.75 0 00.443.674l1.547.814A1.5 1.5 0 0119 7.43V10a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 011 10V7.43a1.5 1.5 0 011.01-1.456l1.547-.814A.75.75 0 004 4.586V3.5A1.5 1.5 0 015.5 2h1.536A1.5 1.5 0 018.5 3.5v1.086a.75.75 0 00.443.674l.97.51a.75.75 0 00.674.002l.97-.51A.75.75 0 0012 4.586V3.5zM3.5 12A1.5 1.5 0 002 13.5v1.07a1.5 1.5 0 001.01 1.456l1.547.814A.75.75 0 016.5 17h7a.75.75 0 01.443-.674l1.547-.814A1.5 1.5 0 0017 14.57V13.5A1.5 1.5 0 0015.5 12h-12z" /></svg>
                    </button>
                    <button class="icon-button remove-button" title="Remove">
                         <svg class="button-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.58.22-2.365.468a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193v-.443A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75a1.25 1.25 0 00-1.25-1.25h-2.5A1.25 1.25 0 007.5 3.75v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clip-rule="evenodd" /></svg>
                    </button>
                </div>
            </div>
            <div class="device-details hidden"></div>
        </div>
    `;
}

async function checkDeviceStatus(cardElement) {
    const summaryInfo = cardElement.querySelector('.device-info-summary');
    const card = cardElement.closest('.device-card');
    const deviceInfo = JSON.parse(card.dataset.deviceInfo);
    try {
        const response = await fetch(`${API_BASE_URL}/api/check-device`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(deviceInfo),
        });
        const data = await response.json();
        card.classList.remove('checking', 'offline', 'online', 'error');
        if (data.status === 'online') {
            card.classList.add('online');
            summaryInfo.innerHTML = `
                <span class="status-badge online-badge">Online</span>
                <span><strong>Uptime:</strong> ${data.uptime}</span>`;
        } else {
            card.classList.add('offline');
            summaryInfo.innerHTML = `<span class="status-badge offline-badge">Offline</span>`;
        }
    } catch (error) {
        card.classList.add('error');
        summaryInfo.innerHTML = '<span class="status-badge error-badge">Error</span>';
    }
}

// =================================================================
// --- EVENT LISTENERS & FORM HANDLING ---
// =================================================================
function setupEventListeners() {
    document.getElementById('dashboard-section').addEventListener('click', e => {
        const card = e.target.closest('.device-card');
        if (!card) return;

        // แยก event target
        const configBtn = e.target.closest('.config-button');
        const removeBtn = e.target.closest('.remove-button');
        const summary = e.target.closest('.device-summary');

        if (configBtn) {
            e.stopPropagation(); // หยุดไม่ให้ event bubble ไปที่ summary
            const deviceInfo = JSON.parse(card.dataset.deviceInfo);
            const deviceName = card.dataset.deviceName;
            showConfigModal({ name: deviceName, device_info: deviceInfo });
        } else if (removeBtn) {
            e.stopPropagation();
            const host = JSON.parse(card.dataset.deviceInfo).host;
            if (confirm(`Are you sure you want to remove device ${host}?`)) {
                removeDeviceFromBackend(card, host);
            }
        } else if (summary) {
            const detailsDiv = card.querySelector('.device-details');
            const isHidden = detailsDiv.classList.contains('hidden');

            if (isHidden) {
                // If opening, fetch data
                fetchAndRenderDetails(card);
            }
            detailsDiv.classList.toggle('hidden');
        }
    });

    document.getElementById('add-device-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const deviceData = Object.fromEntries(formData.entries());
        try {
            const response = await fetch(`${API_BASE_URL}/api/add_device`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(deviceData)
            });
            const result = await response.json();
            alert(result.message);
            if (response.ok) {
                e.target.reset();
                showSection('dashboard');
            }
        } catch (error) {
            alert(`Error: ${error.message}`);
        }
    });
    
    document.getElementById('close-config-modal').addEventListener('click', hideConfigModal);
    setupCliModalListeners();
}

async function removeDeviceFromBackend(cardElement, host) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/remove_device/${host}`, { method: 'DELETE' });
        const data = await response.json();
        alert(data.message);
        if (response.ok) cardElement.remove();
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

// =================================================================
// --- FETCH AND RENDER DEVICE DETAILS ---
// =================================================================
async function fetchAndRenderDetails(cardElement) {
    const detailsDiv = cardElement.querySelector('.device-details');
    // Show loading state only if it hasn't been loaded before
    if (detailsDiv.innerHTML === '') {
        detailsDiv.innerHTML = '<p style="padding: 1.5rem;">Loading details...</p>';
        
        const deviceInfo = JSON.parse(cardElement.dataset.deviceInfo);
        const category = cardElement.dataset.deviceCategory;

        try {
            const response = await fetch(`${API_BASE_URL}/api/device-details/${deviceInfo.host}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({device_info: deviceInfo, category: category})
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.message || `HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            if (data.status === 'success') {
                detailsDiv.innerHTML = renderDeviceDetails(data.details, category);
            } else {
                throw new Error(data.message);
            }

        } catch (error) {
            detailsDiv.innerHTML = `<p style="padding: 1.5rem; color: var(--red);">Could not load details: ${error.message}</p>`;
        }
    }
}

function renderDeviceDetails(details, category) {
    let html = '<div class="details-grid">';

    // --- RENDER DATA FOR ROUTERS ---
    if (category === 'Routers') {
        // IP Interfaces & Connection Status
        if (details.ip_interfaces?.length) {
            html += `
            <div class="detail-card full-width">
                <h4><span class="status-dot up"></span>IP Interfaces & Connection Status</h4>
                <table class="details-table">
                    <thead><tr><th>Interface</th><th>IP Address</th><th>Status</th><th>Protocol</th></tr></thead>
                    <tbody>${details.ip_interfaces.map(i => `
                        <tr>
                            <td>${i.interface}</td><td>${i.ip_address}</td>
                            <td><span class="status-dot ${i.status}"></span>${i.status}</td>
                            <td><span class="status-dot ${i.protocol}"></span>${i.protocol}</td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>`;
        }
        // Routing Table
        if (details.routing_table?.length) {
            html += `
            <div class="detail-card full-width">
                <h4><span class="status-dot blue"></span>Routing Table</h4>
                <table class="details-table">
                    <thead><tr><th>Type</th><th>Network</th><th>Next Hop / Interface</th></tr></thead>
                    <tbody>${details.routing_table.map(r => `
                        <tr><td>${r.type}</td><td>${r.network}</td><td>${r.next_hop || r.interface}</td></tr>`).join('')}
                    </tbody>
                </table>
            </div>`;
        }
        // DHCP Leases
        if (details.dhcp_bindings?.length) {
            html += `
            <div class="detail-card">
                <h4><span class="status-dot green"></span>DHCP Leases</h4>
                <table class="details-table">
                    <thead><tr><th>IP Address</th><th>MAC Address</th></tr></thead>
                    <tbody>${details.dhcp_bindings.map(b => `<tr><td>${b.ip_address}</td><td>${b.mac_address}</td></tr>`).join('')}</tbody>
                </table>
            </div>`;
        }
        // Firewall (Access-Lists)
        if (details.access_lists) {
            html += `
            <div class="detail-card">
                <h4><span class="status-dot red"></span>Security: Firewall (ACLs)</h4>
                <pre class="cli-output-condensed">${details.access_lists}</pre>
            </div>`;
        }
        // VPN Status
        if (details.vpn_status?.length) {
            html += `
            <div class="detail-card">
                <h4><span class="status-dot orange"></span>Security: Active VPN Tunnels</h4>
                <table class="details-table">
                    <thead><tr><th>Destination</th><th>Source</th><th>State</th><th>Status</th></tr></thead>
                    <tbody>${details.vpn_status.map(v => `
                        <tr><td>${v.dst}</td><td>${v.src}</td><td>${v.state}</td><td>${v.status}</td></tr>`).join('')}
                    </tbody>
                </table>
            </div>`;
        }
    } 
    // --- RENDER DATA FOR SWITCHES ---
    else if (category === 'Switches') {
        // Port Status
        if (details.port_status?.length) {
            html += `
            <div class="detail-card full-width">
                <h4><span class="status-dot up"></span>Port Status</h4>
                <table class="details-table">
                    <thead><tr><th>Port</th><th>Status</th><th>VLAN</th><th>Duplex</th><th>Speed</th></tr></thead>
                    <tbody>${details.port_status.map(p => `
                        <tr>
                            <td>${p.port}</td><td><span class="status-dot ${p.status === 'connected' ? 'up' : 'down'}"></span>${p.status}</td>
                            <td>${p.vlan}</td><td>${p.duplex}</td><td>${p.speed}</td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>`;
        }
        // MAC Address Table
        if (details.mac_table?.length) {
            html += `
            <div class="detail-card full-width">
                <h4><span class="status-dot blue"></span>MAC Address Table</h4>
                <table class="details-table">
                     <thead><tr><th>VLAN</th><th>MAC Address</th><th>Port</th></tr></thead>
                    <tbody>${details.mac_table.map(m => `<tr><td>${m.vlan}</td><td>${m.mac_address}</td><td>${m.port}</td></tr>`).join('')}</tbody>
                </table>
            </div>`;
        }
        // VLANs
         if (details.vlan_brief?.length) {
            html += `
            <div class="detail-card">
                <h4><span class="status-dot orange"></span>VLAN Configuration</h4>
                 <table class="details-table">
                     <thead><tr><th>ID</th><th>Name</th><th>Ports</th></tr></thead>
                    <tbody>${details.vlan_brief.map(v => `<tr><td>${v.id}</td><td>${v.name}</td><td>${v.ports.join(', ')}</td></tr>`).join('')}</tbody>
                </table>
            </div>`;
        }
        // PoE Status
         if (details.poe_status?.length) {
            html += `
            <div class="detail-card">
                <h4><span class="status-dot orange"></span>PoE Status</h4>
                 <table class="details-table">
                     <thead><tr><th>Interface</th><th>Status</th><th>Power (mW)</th><th>Device</th></tr></thead>
                    <tbody>${details.poe_status.map(p => `<tr><td>${p.interface}</td><td>${p.status}</td><td>${p.power_mw}</td><td>${p.device}</td></tr>`).join('')}</tbody>
                </table>
            </div>`;
        }
    }
    
    // --- RENDER COMMON DATA (TRAFFIC STATS) ---
    if (details.traffic_stats?.length) {
        html += `
        <div class="detail-card full-width">
            <h4><span class="status-dot blue"></span>Bandwidth & Traffic Statistics</h4>
            <table class="details-table">
                <thead><tr><th>Interface</th><th>Packets In</th><th>Bytes In</th><th>Packets Out</th><th>Bytes Out</th></tr></thead>
                <tbody>
                    ${details.traffic_stats.map(s => `
                        <tr>
                            <td>${s.interface}</td><td>${s.pkts_in}</td><td>${s.bytes_in}</td>
                            <td>${s.pkts_out}</td><td>${s.bytes_out}</td>
                        </tr>`).join('')}
                </tbody>
            </table>
        </div>`;
    }

    html += '</div>'; // close .details-grid
    return html;
}

// =================================================================
// --- REAL-TIME CLI MODAL (WEBSOCKETS) ---
// =================================================================
function setupCliModalListeners() {
    const cliInput = document.getElementById('cli-command-input');
    const sendCommand = () => {
        const command = cliInput.value.trim();
        if (socket && command) {
            socket.emit('send_command', { command });
            cliInput.value = '';
        }
    };
    document.getElementById('send-cli-button').addEventListener('click', sendCommand);
    cliInput.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
            event.preventDefault();
            sendCommand();
        }
    });
}

function showConfigModal(deviceData) {
    currentConfigDevice = deviceData;
    const modalTitle = document.querySelector('#config-modal .modal-title');
    const cliOutputPre = document.getElementById('cli-output');
    const cliOutputMessage = document.getElementById('cli-output-message');
    const cliInput = document.getElementById('cli-command-input');
    const cliPromptDisplay = document.getElementById('cli-prompt-display');

    modalTitle.innerHTML = `ตั้งค่าอุปกรณ์ ${deviceData.name} (${deviceData.device_info.host})`;
    cliOutputPre.textContent = '';
    cliInput.value = '';
    cliPromptDisplay.textContent = '';
    cliInput.disabled = true;

    document.getElementById('config-modal').classList.remove('hidden');
    document.body.classList.add('modal-open');

    cliOutputMessage.textContent = 'Connecting via WebSocket...';
    cliOutputMessage.style.color = '#6b7280';

    socket = io(API_BASE_URL);

    socket.on('connect', () => {
        socket.emit('connect_cli', { device_info: currentConfigDevice.device_info });
    });

    socket.on('cli_ready', (data) => {
        cliOutputMessage.textContent = 'Connected';
        cliOutputMessage.style.color = '#22c55e';
        cliInput.disabled = false;
        cliPromptDisplay.textContent = data.prompt;
        cliInput.focus();
    });

    socket.on('cli_output', (data) => {
        // ต่อท้ายด้วยคำสั่งที่ user พิมพ์ และผลลัพธ์ที่ได้
        cliOutputPre.textContent += `${cliPromptDisplay.textContent}${data.command}\n${data.output}\n`;
        cliPromptDisplay.textContent = data.prompt; // อัปเดต prompt ใหม่
        cliInput.focus();
        cliOutputPre.scrollTop = cliOutputPre.scrollHeight;
    });

    socket.on('cli_error', (data) => {
        cliOutputMessage.textContent = 'Error';
        cliOutputMessage.style.color = '#ef4444';
        cliOutputPre.textContent += `\n<Error: ${data.error}>\n`;
        cliInput.disabled = true;
    });
}

function hideConfigModal() {
    document.getElementById('config-modal').classList.add('hidden');
    document.body.classList.remove('modal-open');
    if (socket) {
        socket.disconnect();
        socket = null;
    }
    currentConfigDevice = null;
}