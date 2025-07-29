// script.js - FINAL, COMPLETE VERSION WITH ALL FEATURES (THAI TRANSLATIONS)

// --- GLOBAL STATE & CONFIG ---
const API_BASE_URL = 'http://127.0.0.1:5000';
let socket = null;
let currentConfigDevice = null;
let allDevices = [];
let allGroups = [];
let currentBackupDeviceId = null;
let currentDbData = [];

const tableTranslations = {
    'devices': 'อุปกรณ์',
    'device_groups': 'กลุ่มอุปกรณ์',
    'activity_log': 'ประวัติการใช้งาน',
    'config_backups': 'ไฟล์สำรองการตั้งค่า',
    'users': 'ผู้ใช้งาน'
};

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    // --- PROFILE & LOGOUT LOGIC ---
    const userIconButton = document.getElementById('user-icon-button');
    const profileDropdown = document.getElementById('profile-dropdown');
    const logoutButton = document.getElementById('logout-button');
    const profileUsernameSpan = document.getElementById('profile-username');

    if (localStorage.getItem('isLoggedIn') !== 'true') {
        window.location.href = 'login.html';
        return;
    }

    const loggedInUser = localStorage.getItem('loggedInUser');
    if (loggedInUser && profileUsernameSpan) {
        profileUsernameSpan.textContent = loggedInUser;
    }

    if (userIconButton) {
        userIconButton.addEventListener('click', (event) => {
            event.stopPropagation();
            profileDropdown.classList.toggle('hidden');
        });
    }

    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            localStorage.removeItem('isLoggedIn');
            localStorage.removeItem('loggedInUser');
            alert('ออกจากระบบสำเร็จ');
            window.location.href = 'login.html';
        });
    }

    window.addEventListener('click', (e) => {
        if (profileDropdown && !profileDropdown.classList.contains('hidden') && !profileDropdown.contains(e.target) && !userIconButton.contains(e.target)) {
            profileDropdown.classList.add('hidden');
        }
    });

    // --- SETUP ---
    setupNavigation();
    setupEventListeners();
    setupMobileMenu(); // <-- เพิ่มการเรียกใช้ฟังก์ชันนี้
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
function setupMobileMenu() {
    const hamburgerButton = document.getElementById('hamburger-button');
    const mainNav = document.getElementById('main-nav');

    if (hamburgerButton && mainNav) {
        hamburgerButton.addEventListener('click', (event) => {
            event.stopPropagation(); // ป้องกันการปิดทันทีจาก event listener ของ window
            mainNav.classList.toggle('nav-open');
        });

        // ทำให้เมนูปิดเมื่อคลิกที่ลิงก์
        mainNav.addEventListener('click', () => {
            if (mainNav.classList.contains('nav-open')) {
                mainNav.classList.remove('nav-open');
            }
        });

        // ทำให้เมนูปิดเมื่อคลิกที่พื้นที่อื่น
        window.addEventListener('click', (e) => {
            if (mainNav.classList.contains('nav-open') && !mainNav.contains(e.target) && !hamburgerButton.contains(e.target)) {
                mainNav.classList.remove('nav-open');
            }
        });
    }
}
function showSection(sectionId) {
    document.querySelectorAll('.main-section').forEach(s => s.classList.add('hidden'));
    const sectionElement = document.getElementById(`${sectionId}-section`);
    if (sectionElement) {
        sectionElement.classList.remove('hidden');
    }
    document.querySelectorAll('.nav-link').forEach(l => l.classList.toggle('active', l.id.includes(sectionId)));

    if (sectionId === 'dashboard') initializeDashboard();
    if (sectionId === 'add-device') populateGroupDropdown(document.querySelector('#add-device-section #device-group-select'));
    if (sectionId === 'logs') fetchAndDisplayLogs();
    if (sectionId === 'db-management') initializeDbManagement();
}

// --- EVENT LISTENERS ---
function setupEventListeners() {
    document.getElementById('dashboard-section')?.addEventListener('click', e => {
        const card = e.target.closest('.device-card');
        if (!card) return;
        const configBtn = e.target.closest('.config-button');
        const removeBtn = e.target.closest('.remove-button');
        const editBtn = e.target.closest('.edit-button');
        const backupBtn = e.target.closest('.backup-button');
        const summary = e.target.closest('.device-summary');
        const deviceData = allDevices.find(d => d.id == card.id.replace('device-card-', ''));
        if (!deviceData) return;

        if (backupBtn) { e.stopPropagation(); showBackupModal(deviceData.id, deviceData.name); }
        else if (editBtn) { e.stopPropagation(); showEditModal(deviceData); }
        else if (configBtn) { e.stopPropagation(); showConfigModal({ name: deviceData.name, device_info: JSON.parse(card.dataset.deviceInfo) }); }
        else if (removeBtn) { e.stopPropagation(); if (confirm(`ต้องการลบอุปกรณ์ ${deviceData.host} หรือไม่`)) removeDeviceFromBackend(deviceData.host); }
        else if (summary) {
            const detailsDiv = card.querySelector('.device-details');
            detailsDiv.classList.toggle('hidden');
            if (!detailsDiv.classList.contains('hidden')) fetchAndRenderDetails(card);
        }
    });

    document.getElementById('add-device-form')?.addEventListener('submit', handleFormSubmit);
    document.getElementById('add-group-form')?.addEventListener('submit', handleFormSubmit);
    document.getElementById('edit-device-form')?.addEventListener('submit', handleFormSubmit);
    document.getElementById('db-edit-form')?.addEventListener('submit', handleFormSubmit);

    document.querySelectorAll('#dashboard-section .filter-button').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('#dashboard-section .filter-button').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            document.getElementById('group-filter-select').value = 'all';
            applyFilters();
        });
    });

    document.getElementById('group-filter-select')?.addEventListener('change', () => {
        document.querySelectorAll('#dashboard-section .filter-button').forEach(btn => btn.classList.remove('active'));
        document.querySelector('.filter-button[data-filter="all"]').classList.add('active');
        applyFilters();
    });

    document.getElementById('close-config-modal')?.addEventListener('click', hideConfigModal);
    document.getElementById('close-edit-modal')?.addEventListener('click', hideEditModal);
    document.getElementById('close-backup-modal')?.addEventListener('click', hideBackupModal);
    document.getElementById('close-view-config-modal')?.addEventListener('click', hideViewConfigModal);
    document.getElementById('close-db-edit-modal')?.addEventListener('click', hideDbEditModal);

    document.getElementById('backup-list-body')?.addEventListener('click', e => {
        const viewBtn = e.target.closest('.view-backup-btn');
        const restoreBtn = e.target.closest('.restore-backup-btn');
        if (viewBtn) handleViewBackup(viewBtn.dataset.backupId);
        if (restoreBtn) handleRestoreBackup(restoreBtn.dataset.backupId, currentBackupDeviceId);
    });

    document.getElementById('db-table-container')?.addEventListener('click', handleDbTableActions);

    document.getElementById('db-table-select')?.addEventListener('change', e => {
        const tableName = e.target.value;
        if (tableName) {
            fetchAndDisplayTableData(tableName);
        } else {
            document.getElementById('db-table-container').innerHTML = '<p>เลือกตารางเพื่อดูข้อมูล</p>';
        }
    });

    setupCliModalListeners();
}

// --- UNIFIED FORM HANDLER ---
async function handleFormSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    data.loggedInUser = localStorage.getItem('loggedInUser');

    let url = '';
    let method = 'POST';
    let successCallback = () => {
        form.reset();
        showSection('dashboard');
    };

    switch (form.getAttribute('id')) {
        case 'add-device-form':
            url = `${API_BASE_URL}/api/add_device`;
            break;
        case 'add-group-form':
            url = `${API_BASE_URL}/api/groups`;
            successCallback = () => {
                form.reset();
                allGroups = [];
                populateGroupDropdown(document.querySelector('#add-device-section #device-group-select'));
                showSection('manage-groups');
            }
            break;
        case 'edit-device-form':
            url = `${API_BASE_URL}/api/devices/${data.original_host}`;
            method = 'PUT';
            successCallback = () => {
                hideEditModal();
                initializeDashboard();
            }
            break;
        case 'db-edit-form':
            const tableName = form.dataset.tableName;
            const rowId = form.dataset.rowId;
            url = `${API_BASE_URL}/api/db/table/${tableName}/${rowId}`;
            method = 'PUT';
            successCallback = () => {
                hideDbEditModal();
                fetchAndDisplayTableData(tableName);
            }
            break;
        default:
            console.error('Unknown form ID:', form.getAttribute('id'));
            return;
    }

    try {
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await response.json();
        alert(result.message);
        if (response.ok) {
            successCallback();
        }
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}


// --- DASHBOARD & DEVICE FUNCTIONS ---
async function initializeDashboard() {
    try {
        const [groupsRes, devicesRes] = await Promise.all([
            fetch(`${API_BASE_URL}/api/groups`),
            fetch(`${API_BASE_URL}/api/devices`)
        ]);
        const groupsData = await groupsRes.json();
        const devicesData = await devicesRes.json();

        if (groupsData.status === 'success') allGroups = groupsData.groups;
        if (devicesData.status === 'success') allDevices = devicesData.devices;

        populateGroupDropdown(document.getElementById('group-filter-select'), true);
        applyFilters();
    } catch (error) {
        console.error("Error initializing dashboard:", error);
        document.getElementById('device-groups-container').innerHTML = `<p>Error initializing dashboard: ${error.message}</p>`;
    }
}

function applyFilters() {
    const categoryFilterEl = document.querySelector('#dashboard-section .filter-button.active');
    if (!categoryFilterEl) return;
    const categoryFilter = categoryFilterEl.dataset.filter;
    const groupFilter = document.getElementById('group-filter-select').value;

    let filteredDevices = allDevices;
    if (categoryFilter !== 'all') filteredDevices = filteredDevices.filter(d => d.category === categoryFilter);
    if (groupFilter !== 'all') filteredDevices = filteredDevices.filter(d => d.group_id == groupFilter);
    renderDeviceCards(filteredDevices);
}

async function renderDeviceCards(devicesToRender) {
    const container = document.getElementById('device-groups-container');
    container.innerHTML = '';
    document.getElementById('total-count').textContent = devicesToRender.length;
    ['online-count', 'offline-count'].forEach(id => document.getElementById(id).textContent = '...');

    if (devicesToRender.length === 0) {
        container.innerHTML = '<p>ไม่พบอุปกรณ์ที่ตรงตามเงื่อนไข</p>';
        ['online-count', 'offline-count'].forEach(id => document.getElementById(id).textContent = 0);
        return;
    }

    const devicesByGroup = devicesToRender.reduce((acc, device) => {
        const groupName = (device.building_name && device.floor_name) ? `${device.building_name} - ${device.floor_name}` : "Unassigned Devices";
        if (!acc[groupName]) acc[groupName] = [];
        acc[groupName].push(device);
        return acc;
    }, {});

    Object.keys(devicesByGroup).sort().forEach(groupName => {
        const groupSection = document.createElement('div');
        groupSection.className = 'category-section';
        groupSection.innerHTML = `</h2><div class="device-grid">${devicesByGroup[groupName].map(createDeviceCardHTML).join('')}</div>`;
        container.appendChild(groupSection);
    });

    let onlineCount = 0, offlineCount = 0;
    const statusPromises = devicesToRender.map(async (device) => {
        const cardElement = document.getElementById(`device-card-${device.id}`);
        const status = await checkDeviceStatus(cardElement);
        if (status === 'online') onlineCount++; else offlineCount++;
    });

    await Promise.all(statusPromises);
    document.getElementById('online-count').textContent = onlineCount;
    document.getElementById('offline-count').textContent = offlineCount;
}

// --- DATABASE MANAGEMENT FUNCTIONS ---

async function initializeDbManagement() {
    const selectElement = document.getElementById('db-table-select');
    if (!selectElement || selectElement.options.length > 1) return;

    try {
        const response = await fetch(`${API_BASE_URL}/api/db/tables`);
        const result = await response.json();

        if (result.status === 'success') {
            result.tables.forEach(tableName => {
                const option = document.createElement('option');
                option.value = tableName;
                option.textContent = tableTranslations[tableName] || tableName;
                selectElement.appendChild(option);
            });
        } else {
            console.error("Could not fetch tables:", result.message);
        }
    } catch (error) {
        console.error("Error fetching tables:", error);
    }
}

async function fetchAndDisplayTableData(tableName) {
    const container = document.getElementById('db-table-container');
    container.innerHTML = `<p>Loading data for <strong>${tableTranslations[tableName] || tableName}</strong>...</p>`;
    try {
        const response = await fetch(`${API_BASE_URL}/api/db/table/${tableName}`);
        const result = await response.json();

        if (result.status === 'success') {
            currentDbData = result.data;
            if (result.data.length === 0) {
                container.innerHTML = `<p>Table <strong>${tableTranslations[tableName] || tableName}</strong> is empty.</p>`;
                return;
            }

            const table = document.createElement('table');
            table.className = 'details-table';
            const thead = `<thead><tr>${result.columns.map(c => `<th>${c}</th>`).join('')}<th>Actions</th></tr></thead>`;
            const tbody = `<tbody>${result.data.map((row, rowIndex) => `
                <tr>
                    ${result.columns.map(col => `<td><div class="td-content" title="${row[col] || ''}">${row[col] === null ? 'NULL' : String(row[col]).length > 70 ? String(row[col]).substring(0, 70) + '...' : row[col]}</div></td>`).join('')}
                    <td class="backup-actions">
                        <button class="filter-button db-edit-btn" data-table="${tableName}" data-row-index="${rowIndex}">Edit</button>
                        <button class="filter-button db-delete-btn" data-table="${tableName}" data-row-id="${row.id}">Delete</button>
                    </td>
                </tr>`).join('')}</tbody>`;
            table.innerHTML = thead + tbody;
            container.innerHTML = '';
            container.appendChild(table);

        } else {
            container.innerHTML = `<p>Error loading data: ${result.message}</p>`;
        }
    } catch (error) {
        container.innerHTML = `<p>Network error: ${error.message}</p>`;
    }
}

function handleDbTableActions(e) {
    const editBtn = e.target.closest('.db-edit-btn');
    const deleteBtn = e.target.closest('.db-delete-btn');

    if (editBtn) {
        const rowIndex = parseInt(editBtn.dataset.rowIndex, 10);
        showDbEditModal(editBtn.dataset.table, currentDbData[rowIndex]);
    }

    if (deleteBtn) {
        handleDbRowDelete(deleteBtn.dataset.table, deleteBtn.dataset.rowId);
    }
}

async function handleDbRowDelete(tableName, rowId) {
    if (!confirm(`Are you sure you want to delete row with ID ${rowId} from the "${tableName}" table?`)) return;

    try {
        const user = localStorage.getItem('loggedInUser');
        const response = await fetch(`${API_BASE_URL}/api/db/table/${tableName}/${rowId}?user=${user}`, {
            method: 'DELETE'
        });
        const result = await response.json();
        alert(result.message);
        if (response.ok && result.status === 'success') {
            fetchAndDisplayTableData(tableName);
        }
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

// --- HELPER & API FUNCTIONS ---
async function populateGroupDropdown(selectElement, isFilter = false) {
    if (!selectElement) return;
    try {
        if (allGroups.length === 0) {
            const response = await fetch(`${API_BASE_URL}/api/groups`);
            const data = await response.json();
            if (data.status === 'success') allGroups = data.groups;
        }

        const defaultOptionValue = isFilter ? "all" : "";
        const defaultOptionText = isFilter ? "แสดงทุกกลุ่ม" : "-- ไม่ระบุกลุ่ม --";

        selectElement.innerHTML = `<option value="${defaultOptionValue}">${defaultOptionText}</option>`;

        allGroups.forEach(group => {
            const option = document.createElement('option');
            option.value = group.id;
            option.textContent = `${group.building_name} - ${group.floor_name}`;
            selectElement.appendChild(option);
        });
    } catch (error) {
        console.error("Could not populate groups:", error);
    }
}

function createDeviceCardHTML(device) {
    const deviceInfoForApi = JSON.stringify({
        device_type: 'cisco_ios',
        host: device.host,
        username: device.username,
        password: device.password,
        secret: device.secret || ''
    });

    const categoryClass = device.category === 'Routers' ? 'router' : 'switch';
    const categoryInitial = device.category === 'Routers' ? 'R' : 'S';

    return `
        <div class="device-card" id="device-card-${device.id}" data-device-info='${deviceInfoForApi}' data-device-name="${device.name}" data-device-category="${device.category}">
            <div class="device-summary">
                <div class="device-main-info">
                    <div class="device-name-container">
                       <span class="device-category-indicator ${categoryClass}">${categoryInitial}</span>
                       <h3 class="device-name">${device.name}</h3>
                    </div>
                    <p class="device-ip">${device.host}</p>
                </div>
                <div class="device-info-summary">
                    <span class="status-badge checking-badge">Checking...</span>
                </div>
                <div class="device-actions">
                    <button class="icon-button backup-button" title="Backups">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="button-icon"><path fill-rule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 6a.75.75 0 0 0-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 0 0 0-1.5h-3.75V6Z" clip-rule="evenodd" /></svg>
                    </button>
                    <button class="icon-button edit-button" title="Edit">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="button-icon"><path d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 0 0 0-3.712ZM19.513 8.199l-3.712-3.712-8.4 8.4a5.25 5.25 0 0 0-1.32 2.214l-.8 2.685a.75.75 0 0 0 .933.933l2.685-.8a5.25 5.25 0 0 0 2.214-1.32l8.4-8.4Z" /><path d="M5.25 5.25a3 3 0 0 0-3 3v10.5a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3V13.5a.75.75 0 0 0-1.5 0v5.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5V8.25a1.5 1.5 0 0 1 1.5-1.5h5.25a.75.75 0 0 0 0-1.5H5.25Z" /></svg>
                    </button>
                    <button class="icon-button config-button" title="Config">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="button-icon"><path fill-rule="evenodd" d="M11.078 2.25c-.917 0-1.699.663-1.946 1.55l-.29 1.161c-.693.303-1.341.688-1.942 1.144l-1.09-.311a2.015 2.015 0 0 0-2.09.22l-1.446 1.445a2.015 2.015 0 0 0-.22 2.09l.312 1.09c-.456.602-.841 1.25-1.144 1.942l-1.16.29a2.015 2.015 0 0 0-1.55 1.946v2.122c0 .917.663 1.699 1.55 1.946l1.16.29c.303.693.688 1.341 1.144 1.942l-.312 1.09a2.015 2.015 0 0 0 .22 2.09l1.446 1.445a2.015 2.015 0 0 0 2.09.22l1.09-.311c.602-.456 1.25-.841 1.942-1.144l.29-1.161a2.015 2.015 0 0 0 1.946-1.55h2.122c.917 0 1.699-.663 1.946-1.55l.29-1.161c.693-.303 1.341-.688 1.942-1.144l1.09.311a2.015 2.015 0 0 0 2.09-.22l1.446-1.445a2.015 2.015 0 0 0 .22-2.09l-.312-1.09c.456-.602.841 1.25 1.144-1.942l1.16-.29a2.015 2.015 0 0 0 1.55-1.946v-2.122c0-.917-.663-1.699-1.55-1.946l-1.16-.29a48.747 48.747 0 0 1-1.144-1.942l.312-1.09a2.015 2.015 0 0 0-.22-2.09l-1.446-1.445a2.015 2.015 0 0 0-2.09-.22l-1.09.311a48.747 48.747 0 0 1-1.942-1.144l-.29-1.16a2.015 2.015 0 0 0-1.946-1.55h-2.122ZM12 15.75a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Z" clip-rule="evenodd" /></svg>
                    </button>
                    <button class="icon-button remove-button" title="Remove">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="button-icon"><path fill-rule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 0 1 3.878.512.75.75 0 1 1-.256 1.478l-.209-.035-1.005 13.07a3 3 0 0 1-2.991 2.77H8.084a3 3 0 0 1-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 0 1-.256-1.478A48.567 48.567 0 0 1 7.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 0 1 3.369 0c1.603.051 2.815 1.387 2.815 2.951Zm-6.136-1.452a51.196 51.196 0 0 1 3.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 0 0-6 0v-.113c0-.794.609-1.428 1.364-1.452Zm-.355 5.945a.75.75 0 1 0-1.5.058l.347 9a.75.75 0 1 0 1.499-.058l-.346-9Zm5.48.058a.75.75 0 1 0-1.499-.058l-.347 9a.75.75 0 0 0 1.5.058l.345-9Z" clip-rule="evenodd" /></svg>
                    </button>
                </div>
            </div>
            <div class="device-details hidden"></div>
        </div>
    `;
}

async function checkDeviceStatus(cardElement) {
    if (!cardElement) return 'offline';
    const summaryInfo = cardElement.querySelector('.device-info-summary');
    const deviceInfo = JSON.parse(cardElement.dataset.deviceInfo);
    try {
        const response = await fetch(`${API_BASE_URL}/api/check-device`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(deviceInfo),
        });
        const data = await response.json();
        cardElement.classList.remove('checking', 'offline', 'online', 'error');
        if (data.status === 'online') {
            cardElement.classList.add('online');
            summaryInfo.innerHTML = `<span class="status-badge online-badge">Online</span><span><strong>Uptime:</strong> ${data.uptime}</span>`;
            return 'online';
        } else {
            cardElement.classList.add('offline');
            summaryInfo.innerHTML = `<span class="status-badge offline-badge">Offline</span>`;
            return 'offline';
        }
    } catch (error) {
        cardElement.classList.add('error');
        summaryInfo.innerHTML = '<span class="status-badge error-badge">Error</span>';
        return 'error';
    }
}

async function removeDeviceFromBackend(host) {
    try {
        const user = localStorage.getItem('loggedInUser');
        const response = await fetch(`${API_BASE_URL}/api/remove_device/${host}?user=${user}`, { method: 'DELETE' });
        const data = await response.json();
        alert(data.message);
        if (response.ok) {
            initializeDashboard();
        }
    } catch (error) {
        alert(`Error removing device: ${error.message}`);
    }
}

async function fetchAndRenderDetails(cardElement) {
    const detailsDiv = cardElement.querySelector('.device-details');
    if (detailsDiv.innerHTML.includes('Loading') || detailsDiv.innerHTML === '') {
        detailsDiv.innerHTML = '<p style="padding: 1.5rem;">Loading details...</p>';
        const deviceInfo = JSON.parse(cardElement.dataset.deviceInfo);
        const category = cardElement.dataset.deviceCategory;
        try {
            const response = await fetch(`${API_BASE_URL}/api/device-details/${deviceInfo.host}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ device_info: deviceInfo, category: category })
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
    if (category === 'Routers') {
        html += createTableCard('IP Interfaces', ['Interface', 'IP Address', 'Status', 'Protocol'], details.ip_interfaces, row => `<td>${row.interface}</td><td>${row.ip_address}</td><td>${row.status}</td><td>${row.protocol}</td>`);
        html += createTableCard('Routing Table', ['Type', 'Network', 'Next Hop / Interface'], details.routing_table, row => `<td>${row.type}</td><td>${row.network}</td><td>${row.next_hop || row.interface}</td>`);
        html += createTableCard('DHCP Bindings', ['IP Address', 'MAC Address'], details.dhcp_bindings, row => `<td>${row.ip_address}</td><td>${row.mac_address}</td>`);
    } else if (category === 'Switches') {
        html += createTableCard('Port Status', ['Port', 'Status', 'VLAN', 'Duplex', 'Speed'], details.port_status, row => `<td>${row.port}</td><td>${row.status}</td><td>${row.vlan}</td><td>${row.duplex}</td><td>${row.speed}</td>`);
        html += createTableCard('MAC Address Table', ['VLAN', 'MAC Address', 'Port'], details.mac_table, row => `<td>${row.vlan}</td><td>${row.mac_address}</td><td>${row.port}</td>`);
        html += createTableCard('VLANs', ['ID', 'Name', 'Status', 'Ports'], details.vlan_brief, row => `<td>${row.id}</td><td>${row.name}</td><td>${row.status}</td><td>${row.ports.join(', ')}</td>`);
    }
    html += '</div>';
    return html;
}

function createTableCard(title, headers, data, rowRenderer) {
    if (!data || data.length === 0) return '';
    let tableRows = data.map(row => `<tr>${rowRenderer(row)}</tr>`).join('');
    return `
        <div class="detail-card">
            <h4>${title}</h4>
            <div class="logs-container" style="padding: 0; box-shadow: none;">
                <table class="details-table">
                    <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
                    <tbody>${tableRows}</tbody>
                </table>
            </div>
        </div>
    `;
}

async function fetchAndDisplayLogs() {
    const tableBody = document.getElementById('logs-table-body');
    tableBody.innerHTML = '<tr><td colspan="5">Loading...</td></tr>';
    try {
        const response = await fetch(`${API_BASE_URL}/api/logs`);
        const data = await response.json();
        if (data.status === 'success') {
            tableBody.innerHTML = '';
            data.logs.forEach(log => {
                const row = document.createElement('tr');
                const timestamp = new Date(log.timestamp + 'Z').toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
                row.innerHTML = `
                    <td>${timestamp}</td>
                    <td>${log.username || 'N/A'}</td>
                    <td>${log.action}</td>
                    <td>${log.target_identifier || '-'}</td>
                    <td>${log.details || '-'}</td>
                `;
                tableBody.appendChild(row);
            });
        } else {
            tableBody.innerHTML = '<tr><td colspan="5">Could not fetch logs.</td></tr>';
        }
    } catch (error) {
        tableBody.innerHTML = `<tr><td colspan="5">Error: ${error.message}</td></tr>`;
    }
}

// --- MODAL FUNCTIONS ---
function showEditModal(deviceData) {
    const modal = document.getElementById('edit-modal');
    if (!modal) return;
    document.getElementById('edit-original-host').value = deviceData.host;
    document.getElementById('edit-device-name').value = deviceData.name;
    document.getElementById('edit-device-ip').value = deviceData.host;
    document.getElementById('edit-device-category').value = deviceData.category;
    document.getElementById('edit-device-username').value = deviceData.username;
    document.getElementById('edit-device-password').value = deviceData.password;
    document.getElementById('edit-device-secret').value = deviceData.secret || '';
    const groupSelect = document.getElementById('edit-device-group-select');
    populateGroupDropdown(groupSelect).then(() => {
        groupSelect.value = deviceData.group_id || '';
    });
    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');
}

function hideEditModal() {
    const modal = document.getElementById('edit-modal');
    if (modal) modal.classList.add('hidden');
    document.body.classList.remove('modal-open');
}

function showBackupModal(deviceId, deviceName) {
    const modal = document.getElementById('backup-modal');
    if (!modal) return;
    currentBackupDeviceId = deviceId;
    document.getElementById('backup-modal-title').textContent = `ประวัติการตั้งค่าของ ${deviceName}`;
    document.getElementById('backup-description').value = '';
    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');
    fetchAndDisplayBackups(deviceId);
    const createBtn = document.getElementById('create-backup-button');
    const newCreateBtn = createBtn.cloneNode(true);
    createBtn.parentNode.replaceChild(newCreateBtn, createBtn);
    newCreateBtn.addEventListener('click', handleCreateBackup);
}

function hideBackupModal() {
    const modal = document.getElementById('backup-modal');
    if (modal) modal.classList.add('hidden');
    document.body.classList.remove('modal-open');
    currentBackupDeviceId = null;
}

async function fetchAndDisplayBackups(deviceId) {
    const tableBody = document.getElementById('backup-list-body');
    tableBody.innerHTML = '<tr><td colspan="4">Loading...</td></tr>';
    try {
        const response = await fetch(`${API_BASE_URL}/api/devices/${deviceId}/backups`);
        const data = await response.json();
        if (data.status === 'success') {
            tableBody.innerHTML = '';
            if (data.backups.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="4">ยังไม่มีการบันทึก Backup</td></tr>';
            } else {
                data.backups.forEach(backup => {
                    const row = document.createElement('tr');
                    const timestamp = new Date(backup.created_at + 'Z').toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
                    row.innerHTML = `
                        <td>${timestamp}</td>
                        <td>${backup.description || '-'}</td>
                        <td>${backup.username || 'N/A'}</td>
                        <td class="backup-actions">
                            <button class="filter-button view-backup-btn" data-backup-id="${backup.id}">ดู</button>
                            <button class="filter-button restore-backup-btn" data-backup-id="${backup.id}">คืนค่า</button>
                        </td>
                    `;
                    tableBody.appendChild(row);
                });
            }
        } else {
            tableBody.innerHTML = `<tr><td colspan="4">${data.message}</td></tr>`;
        }
    } catch (error) {
        tableBody.innerHTML = `<tr><td colspan="4">Error: ${error.message}</td></tr>`;
    }
}

async function handleCreateBackup() {
    if (!currentBackupDeviceId) return;
    const description = document.getElementById('backup-description').value;
    const button = document.getElementById('create-backup-button');
    button.textContent = 'กำลังบันทึก...';
    button.disabled = true;
    try {
        const response = await fetch(`${API_BASE_URL}/api/devices/${currentBackupDeviceId}/backups`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ description, loggedInUser: localStorage.getItem('loggedInUser') })
        });
        const result = await response.json();
        alert(result.message);
        if (response.ok) {
            fetchAndDisplayBackups(currentBackupDeviceId);
        }
    } catch (error) {
        alert(`Error: ${error.message}`);
    } finally {
        button.textContent = 'บันทึกการตั้งค่าปัจจุบัน';
        button.disabled = false;
        document.getElementById('backup-description').value = '';
    }
}

async function handleViewBackup(backupId) {
    const modal = document.getElementById('view-config-modal');
    const outputPre = document.getElementById('config-output');
    if (!modal || !outputPre) return;
    outputPre.textContent = 'Loading configuration...';
    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');
    try {
        const response = await fetch(`${API_BASE_URL}/api/backups/${backupId}`);
        const data = await response.json();
        if (data.status === 'success') {
            outputPre.textContent = data.configuration;
        } else {
            outputPre.textContent = `Error: ${data.message}`;
        }
    } catch (error) {
        outputPre.textContent = `Error: ${error.message}`;
    }
}

async function handleRestoreBackup(backupId, deviceId) {
    if (!deviceId || !confirm("คุณแน่ใจหรือไม่ว่าจะคืนค่าการตั้งค่านี้?\nการตั้งค่าปัจจุบันบนอุปกรณ์จะถูกเขียนทับทั้งหมด!")) return;

    alert('กำลังดำเนินการคืนค่า... กรุณารอสักครู่');
    try {
        const response = await fetch(`${API_BASE_URL}/api/devices/${deviceId}/restore`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                backup_id: backupId,
                loggedInUser: localStorage.getItem('loggedInUser')
            })
        });
        const result = await response.json();
        alert(result.message);
    } catch (error) {
        alert(`เกิดข้อผิดพลาด: ${error.message}`);
    }
}

function hideViewConfigModal() {
    const modal = document.getElementById('view-config-modal');
    if (modal) modal.classList.add('hidden');
    document.body.classList.remove('modal-open');
}

function showDbEditModal(tableName, rowData) {
    const modal = document.getElementById('db-edit-modal');
    if (!modal) return;

    const thaiTableName = tableTranslations[tableName] || tableName;
    document.getElementById('db-edit-modal-title').textContent = `แก้ไขข้อมูลในตาราง ${thaiTableName} (ID: ${rowData.id})`;

    const formFieldsContainer = document.getElementById('db-edit-form-fields');
    formFieldsContainer.innerHTML = '';

    const form = document.getElementById('db-edit-form');
    form.dataset.tableName = tableName;
    form.dataset.rowId = rowData.id;

    const keys = Object.keys(rowData);
    formFieldsContainer.className = keys.length > 4 ? 'form-grid-2-col' : 'form-grid-1-col';

    for (const key of keys) {
        const fieldGroup = document.createElement('div');
        fieldGroup.className = 'form-group';

        const label = document.createElement('label');
        label.htmlFor = `db-edit-${key}`;
        label.textContent = key;
        fieldGroup.appendChild(label);

        let input;
        const value = rowData[key];

        if (key === 'configuration' || (typeof value === 'string' && value.length > 100 && key !== 'password_hash')) {
            input = document.createElement('textarea');
            input.rows = 5;
        } else {
            input = document.createElement('input');
            input.type = 'text';
        }

        input.id = `db-edit-${key}`;
        input.name = key;
        input.value = value === null ? '' : value;

        if (key === 'id' || key.endsWith('_at')) {
            input.readOnly = true;
            input.style.backgroundColor = '#e9ecef';
        }
        if (key === 'password_hash') {
            input.placeholder = "Leave empty to keep current password";
            input.value = '';
        }

        fieldGroup.appendChild(input);
        formFieldsContainer.appendChild(fieldGroup);
    }

    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');
}

function hideDbEditModal() {
    const modal = document.getElementById('db-edit-modal');
    if (modal) modal.classList.add('hidden');
    document.body.classList.remove('modal-open');
}

function setupCliModalListeners() {
    const cliInput = document.getElementById('cli-command-input');
    const sendBtn = document.getElementById('send-cli-button');
    if (!cliInput || !sendBtn) return;
    const sendCommand = () => {
        const command = cliInput.value.trim();
        if (socket && command) {
            socket.emit('send_command', { command });
            cliInput.value = '';
        }
    };
    sendBtn.addEventListener('click', sendCommand);
    cliInput.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
            event.preventDefault();
            sendCommand();
        }
    });
}

function showConfigModal(deviceData) {
    const modal = document.getElementById('config-modal');
    if (!modal) return;
    currentConfigDevice = deviceData;
    modal.querySelector('.modal-title').textContent = `CLI: ${deviceData.name} (${deviceData.device_info.host})`;
    const cliOutput = modal.querySelector('#cli-output');
    const cliMsg = modal.querySelector('#cli-output-message');
    const cliInput = modal.querySelector('#cli-command-input');
    const cliPrompt = modal.querySelector('#cli-prompt-display');

    cliOutput.textContent = '';
    cliMsg.textContent = 'Connecting via WebSocket...';
    cliInput.value = '';
    cliPrompt.textContent = '';
    cliInput.disabled = true;

    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');

    socket = io(API_BASE_URL);
    socket.on('connect', () => socket.emit('connect_cli', { device_info: currentConfigDevice.device_info }));
    socket.on('cli_ready', (data) => {
        cliMsg.textContent = 'Connected. Ready for commands.';
        cliPrompt.textContent = data.prompt;
        cliInput.disabled = false;
        cliInput.focus();
    });
    socket.on('cli_output', (data) => {
        cliOutput.textContent += `${cliPrompt.textContent}${data.command}\n${data.output}\n`;
        cliPrompt.textContent = data.prompt;
        cliOutput.scrollTop = cliOutput.scrollHeight;
    });
    socket.on('cli_error', (data) => {
        cliMsg.textContent = `Error: ${data.error}`;
        cliInput.disabled = true;
    });
}

function hideConfigModal() {
    const modal = document.getElementById('config-modal');
    if (modal) modal.classList.add('hidden');
    document.body.classList.remove('modal-open');
    if (socket) {
        socket.disconnect();
        socket = null;
    }
    currentConfigDevice = null;
}