# app.py - FINAL WEBSOCKET VERSION (FULLY COMPLETE)

import eventlet
eventlet.monkey_patch() # สำคัญมาก! ต้องอยู่บรรทัดแรกๆ

from flask import Flask, jsonify, request
from flask_socketio import SocketIO, emit
from flask_cors import CORS
from netmiko import ConnectHandler, NetmikoAuthenticationException, NetmikoTimeoutException
import pymysql
import pymysql.cursors
import re
import hashlib

# --- App Initialization ---
app = Flask(__name__)
CORS(app)
app.config['SECRET_KEY'] = 'a-very-secret-key-that-you-should-change'
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

# --- Database Configuration ---
DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',
    'password': '', # <--- แก้ไขรหัสผ่าน MySQL ของคุณที่นี่
    'database': 'network_database',
    'cursorclass': pymysql.cursors.DictCursor,
    'charset': 'utf8mb4'
}

def get_db_connection():
    """Establishes a new database connection."""
    return pymysql.connect(**DB_CONFIG)

def init_db_mysql():
    """Initializes MySQL tables if they don't exist."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # Create devices table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS devices (
                    id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255) NOT NULL,
                    category VARCHAR(255) NOT NULL, host VARCHAR(255) NOT NULL UNIQUE,
                    device_type VARCHAR(255) NOT NULL, username VARCHAR(255) NOT NULL,
                    password VARCHAR(255) NOT NULL, secret VARCHAR(255)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            ''')
            # Create users table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS users (
                    id INT AUTO_INCREMENT PRIMARY KEY, username VARCHAR(255) NOT NULL UNIQUE,
                    password_hash VARCHAR(255) NOT NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            ''')
            conn.commit()
            # Create default admin user
            cursor.execute("SELECT id FROM users WHERE username = 'admin'")
            if cursor.fetchone() is None:
                hashed_password = hashlib.sha256('password'.encode()).hexdigest()
                cursor.execute("INSERT INTO users (username, password_hash) VALUES (%s, %s)", ('admin', hashed_password))
                conn.commit()
                print("Default admin user created: username='admin', password='password'")
    except Exception as e:
        print(f"Database initialization error: {e}")
    finally:
        if conn:
            conn.close()

# Initialize DB on startup
with app.app_context():
    init_db_mysql()

# --- SSH Connection State Management ---
connections = {} # Dict สำหรับเก็บ Active SSH connections

# ==============================================================================
# --- PARSER FUNCTIONS ---
# ==============================================================================
def parse_ip_interface_brief(output):
    interfaces = []
    lines = output.strip().splitlines()[1:] # Skip header
    for line in lines:
        parts = line.split()
        if len(parts) >= 6:
            interfaces.append({
                "interface": parts[0], "ip_address": parts[1],
                "status": parts[4], "protocol": parts[5]
            })
    return interfaces

def parse_ip_route(output):
    routes = []
    for line in output.strip().splitlines():
        if "is directly connected" in line:
            match = re.search(r'(\S+)\s+is directly connected, (\S+)', line)
            if match:
                routes.append({"type": "Direct", "network": match.group(1), "interface": match.group(2)})
        elif "via" in line:
            match = re.search(r'^\S\s+([\d\.\/]+)\s+\[\d+/\d+\]\s+via\s+([\d\.]+)', line)
            if match:
                routes.append({"type": "Static/Dynamic", "network": match.group(1), "next_hop": match.group(2)})
    return routes

def parse_dhcp_binding(output):
    bindings = []
    for line in output.strip().splitlines()[1:]: # Skip header if any
        parts = line.split()
        if len(parts) >= 3:
            bindings.append({"ip_address": parts[0], "mac_address": parts[1]})
    return bindings

def parse_interfaces_status(output):
    statuses = []
    lines = output.strip().splitlines()[1:] # Skip header
    for line in lines:
        match = re.match(r'(\S+)\s+(.*?)\s+(\w+)\s+(\w+)\s+(\S+)\s+(\S+)', line)
        if match:
            statuses.append({
                "port": match.group(1), "status": match.group(3),
                "vlan": match.group(4), "duplex": match.group(5), "speed": match.group(6)
            })
    return statuses

def parse_mac_address_table(output):
    entries = []
    lines = output.strip().splitlines()
    for line in lines:
        match = re.search(r'(?:\*|\s)?\s*(\d+)\s+([0-9a-f\.]+)[\s\S]+?(Fa\S+|Gi\S+|Po\S+)', line, re.IGNORECASE)
        if match:
            entries.append({"vlan": match.group(1), "mac_address": match.group(2), "port": match.group(3)})
    return entries
    
def parse_vlan_brief(output):
    vlans = []
    lines = output.strip().splitlines()
    for line in lines:
        match = re.match(r'^(\d+)\s+(\S+)\s+(\w+)\s+(.*)', line)
        if match and match.group(1) != "1": # Exclude default VLAN details if needed
             ports = [p.strip() for p in match.group(4).split(',')]
             vlans.append({"id": match.group(1), "name": match.group(2), "status": match.group(3), "ports": ports})
    return vlans
    
def parse_power_inline(output):
    poe_ports = []
    lines = output.strip().splitlines()[2:] # Skip headers
    for line in lines:
        parts = line.split()
        if len(parts) >= 6:
            poe_ports.append({
                "interface": parts[0], "status": parts[1], 
                "power_mw": parts[3], "device": ' '.join(parts[6:])
            })
    return poe_ports

def parse_interfaces_traffic(output):
    stats = []
    # Split output into blocks for each interface
    interface_blocks = re.split(r'\n(?=\S)', output)
    for block in interface_blocks:
        if not block.strip(): continue
        
        # Get interface name
        if_match = re.match(r'(\S+)\s+is', block)
        if not if_match: continue
        interface_name = if_match.group(1)
        
        # Get traffic stats
        in_match = re.search(r'(\d+)\s+packets input,\s+(\d+)\s+bytes', block)
        out_match = re.search(r'(\d+)\s+packets output,\s+(\d+)\s+bytes', block)
        
        pkts_in = in_match.group(1) if in_match else '0'
        bytes_in = in_match.group(2) if in_match else '0'
        pkts_out = out_match.group(1) if out_match else '0'
        bytes_out = out_match.group(2) if out_match else '0'

        stats.append({
            "interface": interface_name, "pkts_in": f"{int(pkts_in):,}", "bytes_in": f"{int(bytes_in):,}",
            "pkts_out": f"{int(pkts_out):,}", "bytes_out": f"{int(bytes_out):,}"
        })
    return stats

def parse_vpn_status(output):
    s_a = []
    lines = output.strip().splitlines()[1:] # Skip header
    for line in lines:
        parts = line.split()
        if len(parts) >= 6:
            s_a.append({"dst": parts[0], "src": parts[1], "state": parts[2], "status": parts[5]})
    return s_a

# ==============================================================================
# --- WebSocket Event Handlers for REAL-TIME CLI ---
# ==============================================================================
@socketio.on('connect_cli')
def handle_cli_connect(data):
    sid = request.sid
    device_info = data.get('device_info')
    if not device_info:
        return emit('cli_error', {'error': 'Missing device info.'})
    try:
        print(f"Client {sid} connecting to {device_info['host']}...")
        net_connect = ConnectHandler(**device_info)
        net_connect.enable()
        connections[sid] = net_connect
        prompt = net_connect.find_prompt()
        emit('cli_ready', {'prompt': prompt})
    except Exception as e:
        emit('cli_error', {'error': str(e)})

@socketio.on('send_command')
def handle_send_command(data):
    sid = request.sid
    command = data.get('command')
    if sid in connections:
        try:
            net_connect = connections[sid]
            # ใช้ send_command() เพื่อให้ Netmiko จัดการ prompt ได้ดีขึ้น
            output = net_connect.send_command(command, expect_string=r'#|>')
            prompt = net_connect.find_prompt()
            # ส่งทั้ง output และ prompt ใหม่กลับไป
            emit('cli_output', {'output': output, 'prompt': prompt, 'command': command})
        except Exception as e:
            emit('cli_error', {'error': str(e)})
    else:
        emit('cli_error', {'error': 'Connection lost. Please close and reopen the terminal.'})

@socketio.on('disconnect')
def handle_disconnect():
    sid = request.sid
    if sid in connections:
        try:
            connections[sid].disconnect()
        except Exception as e:
            print(f"Error on disconnect for {sid}: {e}")
        del connections[sid]
        print(f"Client {sid} disconnected.")

# ==============================================================================
# --- Standard HTTP Endpoints ---
# ==============================================================================
@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    if not username or not password:
        return jsonify({'status': 'error', 'message': 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน'}), 400
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT password_hash FROM users WHERE username = %s", (username,))
            user = cursor.fetchone()
            if user and hashlib.sha256(password.encode()).hexdigest() == user['password_hash']:
                return jsonify({'status': 'success', 'message': 'เข้าสู่ระบบสำเร็จ!'})
            else:
                return jsonify({'status': 'error', 'message': 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'}), 401
    finally:
        conn.close()

@app.route('/api/devices', methods=['GET'])
def get_devices():
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT * FROM devices")
            devices = cursor.fetchall()
        return jsonify({'status': 'success', 'devices': devices})
    finally:
        conn.close()

@app.route('/api/add_device', methods=['POST'])
def add_device():
    data = request.json
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "INSERT INTO devices (name, category, host, device_type, username, password, secret) VALUES (%s, %s, %s, %s, %s, %s, %s)",
                (data['name'], data['category'], data['host'], 'cisco_ios', data['username'], data['password'], data.get('secret'))
            )
        conn.commit()
        return jsonify({'status': 'success', 'message': 'บันทึกข้อมูลสำเร็จ'}), 201
    except pymysql.IntegrityError:
        return jsonify({'status': 'error', 'message': 'บันทึกข้อมูลไม่สำเร็จ IP ซ้ำ'}), 409
    finally:
        conn.close()

@app.route('/api/remove_device/<string:host>', methods=['DELETE'])
def remove_device(host):
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("DELETE FROM devices WHERE host = %s", (host,))
            conn.commit()
            if cursor.rowcount > 0:
                return jsonify({'status': 'success', 'message': f"Device {host} ลบข้อมูลสำเร็จ"})
            else:
                return jsonify({'status': 'error', 'message': 'ไม่พบอุปกรณ์'}), 404
    finally:
        conn.close()

@app.route('/api/check-device', methods=['POST'])
def check_device():
    device_info = request.json
    try:
        with ConnectHandler(**device_info, conn_timeout=5) as net_connect:
            net_connect.enable()
            version_output = net_connect.send_command('show version', read_timeout=10)
            uptime_match = re.search(r'uptime is\s+(.*)', version_output)
            uptime = uptime_match.group(1).strip() if uptime_match else 'N/A'
            return jsonify({ 'status': 'online', 'uptime': uptime })
    except Exception:
        return jsonify({'status': 'offline'})

@app.route('/api/device-details/<string:host>', methods=['POST'])
def get_device_details(host):
    device_data = request.json
    device_info = device_data.get('device_info')
    category = device_data.get('category')
    details = {}

    try:
        with ConnectHandler(**device_info, conn_timeout=10) as net_connect:
            net_connect.enable()

            # --- COMMON COMMAND FOR BOTH ---
            traffic_output = net_connect.send_command("show interfaces", read_timeout=20)
            details['traffic_stats'] = parse_interfaces_traffic(traffic_output)
            
            if category == 'Routers':
                # --- Router Specific Commands ---
                details['ip_interfaces'] = parse_ip_interface_brief(net_connect.send_command("show ip interface brief", read_timeout=15))
                details['routing_table'] = parse_ip_route(net_connect.send_command("show ip route", read_timeout=15))
                details['dhcp_bindings'] = parse_dhcp_binding(net_connect.send_command("show ip dhcp binding", read_timeout=15))

                # Security Info
                acl_output = net_connect.send_command("show access-lists", read_timeout=15)
                if "Invalid input" not in acl_output:
                    details['access_lists'] = acl_output.strip()

                vpn_output = net_connect.send_command("show crypto isakmp sa", read_timeout=15)
                if "Invalid input" not in vpn_output and "NO SAs" not in vpn_output.upper():
                    details['vpn_status'] = parse_vpn_status(vpn_output)
            
            elif category == 'Switches':
                # --- Switch Specific Commands ---
                details['port_status'] = parse_interfaces_status(net_connect.send_command("show interfaces status", read_timeout=15))
                details['mac_table'] = parse_mac_address_table(net_connect.send_command("show mac address-table", read_timeout=15))
                details['vlan_brief'] = parse_vlan_brief(net_connect.send_command("show vlan brief", read_timeout=15))
                
                poe_output = net_connect.send_command("show power inline", read_timeout=15)
                if "Invalid input" not in poe_output:
                    details['poe_status'] = parse_power_inline(poe_output)

        return jsonify({'status': 'success', 'details': details})

    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

# --- Main Execution ---
if __name__ == '__main__':
    print("Starting Flask-SocketIO server on http://0.0.0.0:5000")
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)