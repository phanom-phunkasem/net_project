# app.py - FINAL VERSION WITH ALL FEATURES INCLUDING BACKUPS, RESTORE & DB MANAGEMENT

import eventlet

eventlet.monkey_patch()

from flask import Flask, jsonify, request
from flask_socketio import SocketIO, emit
from flask_cors import CORS
from netmiko import (
    ConnectHandler,
    NetmikoAuthenticationException,
    NetmikoTimeoutException,
)
import pymysql
import pymysql.cursors
import re
import hashlib

# --- App Initialization ---
app = Flask(__name__)
CORS(app)
app.config["SECRET_KEY"] = "a-very-secret-key-that-you-should-change"
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="eventlet")

# --- Database Configuration ---
DB_CONFIG = {
    "host": "localhost",
    "user": "root",
    "password": "",
    "database": "network_database",
    "cursorclass": pymysql.cursors.DictCursor,
    "charset": "utf8mb4",
}


def get_db_connection():
    """Establishes a new database connection."""
    return pymysql.connect(**DB_CONFIG)


def init_db_mysql():
    """Initializes all necessary MySQL tables if they don't exist."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # 1. Create users table
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS users (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    username VARCHAR(255) NOT NULL UNIQUE,
                    password_hash VARCHAR(255) NOT NULL,
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """
            )
            # 2. Create device_groups table
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS device_groups (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    building_name VARCHAR(255) NOT NULL,
                    floor_name VARCHAR(255) NOT NULL,
                    description TEXT DEFAULT NULL,
                    UNIQUE KEY unique_group (building_name, floor_name)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """
            )
            # 3. Create devices table
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS devices (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    category VARCHAR(255) NOT NULL,
                    host VARCHAR(255) NOT NULL UNIQUE,
                    device_type VARCHAR(255) NOT NULL,
                    username VARCHAR(255) NOT NULL,
                    password VARCHAR(255) NOT NULL,
                    secret VARCHAR(255),
                    group_id INT DEFAULT NULL,
                    FOREIGN KEY (group_id) REFERENCES device_groups(id) ON DELETE SET NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """
            )
            # 4. Create activity_log table
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS activity_log (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NULL,
                    action VARCHAR(255) NOT NULL,
                    target_identifier VARCHAR(255) DEFAULT NULL,
                    details TEXT DEFAULT NULL,
                    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """
            )
            # 5. Create config_backups table
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS config_backups (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    device_id INT NOT NULL,
                    user_id INT NULL,
                    configuration LONGTEXT NOT NULL,
                    description VARCHAR(255) DEFAULT NULL,
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """
            )
            conn.commit()
            # Create default admin user
            cursor.execute("SELECT id FROM users WHERE username = 'admin'")
            if cursor.fetchone() is None:
                hashed_password = hashlib.sha256("password".encode()).hexdigest()
                cursor.execute(
                    "INSERT INTO users (username, password_hash) VALUES (%s, %s)",
                    ("admin", hashed_password),
                )
                conn.commit()
    except Exception as e:
        print(f"Database initialization error: {e}")
    finally:
        if conn:
            conn.close()


with app.app_context():
    init_db_mysql()


def log_activity(action, username=None, target_identifier=None, details=None):
    log_conn = get_db_connection()
    try:
        with log_conn.cursor() as cursor:
            user_id = None
            if username:
                cursor.execute("SELECT id FROM users WHERE username = %s", (username,))
                user_result = cursor.fetchone()
                if user_result:
                    user_id = user_result["id"]
            sql = "INSERT INTO activity_log (user_id, action, target_identifier, details) VALUES (%s, %s, %s, %s)"
            cursor.execute(sql, (user_id, action, target_identifier, details))
        log_conn.commit()
    except Exception as e:
        print(f"Error logging activity: {e}")
    finally:
        if log_conn:
            log_conn.close()


connections = {}


# ==============================================================================
# --- PARSER FUNCTIONS ---
# ==============================================================================
def parse_ip_interface_brief(output):
    interfaces = []
    lines = output.strip().splitlines()[1:]
    for line in lines:
        parts = line.split()
        if len(parts) >= 6:
            interfaces.append(
                {
                    "interface": parts[0],
                    "ip_address": parts[1],
                    "status": parts[4],
                    "protocol": parts[5],
                }
            )
    return interfaces


def parse_ip_route(output):
    routes = []
    for line in output.strip().splitlines():
        if "is directly connected" in line:
            match = re.search(r"(\S+)\s+is directly connected, (\S+)", line)
            if match:
                routes.append(
                    {
                        "type": "Direct",
                        "network": match.group(1),
                        "interface": match.group(2),
                    }
                )
        elif "via" in line:
            match = re.search(
                r"^\S\s+([\d\.\/]+)\s+\[\d+/\d+\]\s+via\s+([\d\.]+)", line
            )
            if match:
                routes.append(
                    {
                        "type": "Static/Dynamic",
                        "network": match.group(1),
                        "next_hop": match.group(2),
                    }
                )
    return routes


def parse_dhcp_binding(output):
    bindings = []
    for line in output.strip().splitlines()[1:]:
        parts = line.split()
        if len(parts) >= 3:
            bindings.append({"ip_address": parts[0], "mac_address": parts[1]})
    return bindings


def parse_interfaces_status(output):
    statuses = []
    lines = output.strip().splitlines()[1:]
    for line in lines:
        match = re.match(r"(\S+)\s+(.*?)\s+(\w+)\s+(\w+)\s+(\S+)\s+(\S+)", line)
        if match:
            statuses.append(
                {
                    "port": match.group(1),
                    "status": match.group(3),
                    "vlan": match.group(4),
                    "duplex": match.group(5),
                    "speed": match.group(6),
                }
            )
    return statuses


def parse_mac_address_table(output):
    entries = []
    lines = output.strip().splitlines()
    for line in lines:
        match = re.search(
            r"(?:\*|\s)?\s*(\d+)\s+([0-9a-f\.]+)[\s\S]+?(Fa\S+|Gi\S+|Po\S+)",
            line,
            re.IGNORECASE,
        )
        if match:
            entries.append(
                {
                    "vlan": match.group(1),
                    "mac_address": match.group(2),
                    "port": match.group(3),
                }
            )
    return entries


def parse_vlan_brief(output):
    vlans = []
    lines = output.strip().splitlines()
    for line in lines:
        match = re.match(r"^(\d+)\s+(\S+)\s+(\w+)\s+(.*)", line)
        if match and match.group(1) != "1":
            ports = [p.strip() for p in match.group(4).split(",")]
            vlans.append(
                {
                    "id": match.group(1),
                    "name": match.group(2),
                    "status": match.group(3),
                    "ports": ports,
                }
            )
    return vlans


def parse_power_inline(output):
    poe_ports = []
    lines = output.strip().splitlines()[2:]
    for line in lines:
        parts = line.split()
        if len(parts) >= 6:
            poe_ports.append(
                {
                    "interface": parts[0],
                    "status": parts[1],
                    "power_mw": parts[3],
                    "device": " ".join(parts[6:]),
                }
            )
    return poe_ports


def parse_interfaces_traffic(output):
    stats = []
    interface_blocks = re.split(r"\n(?=\S)", output)
    for block in interface_blocks:
        if not block.strip():
            continue
        if_match = re.match(r"(\S+)\s+is", block)
        if not if_match:
            continue
        interface_name = if_match.group(1)
        in_match = re.search(r"(\d+)\s+packets input,\s+(\d+)\s+bytes", block)
        out_match = re.search(r"(\d+)\s+packets output,\s+(\d+)\s+bytes", block)
        pkts_in = in_match.group(1) if in_match else "0"
        bytes_in = in_match.group(2) if in_match else "0"
        pkts_out = out_match.group(1) if out_match else "0"
        bytes_out = out_match.group(2) if out_match else "0"
        stats.append(
            {
                "interface": interface_name,
                "pkts_in": f"{int(pkts_in):,}",
                "bytes_in": f"{int(bytes_in):,}",
                "pkts_out": f"{int(pkts_out):,}",
                "bytes_out": f"{int(bytes_out):,}",
            }
        )
    return stats


def parse_vpn_status(output):
    s_a = []
    lines = output.strip().splitlines()[1:]
    for line in lines:
        parts = line.split()
        if len(parts) >= 6:
            s_a.append(
                {
                    "dst": parts[0],
                    "src": parts[1],
                    "state": parts[2],
                    "status": parts[5],
                }
            )
    return s_a


# ==============================================================================
# --- WebSocket Event Handlers ---
# ==============================================================================
@socketio.on("connect_cli")
def handle_cli_connect(data):
    sid = request.sid
    device_info = data.get("device_info")
    if not device_info:
        return emit("cli_error", {"error": "Missing device info."})
    try:
        net_connect = ConnectHandler(**device_info)
        net_connect.enable()
        connections[sid] = net_connect
        prompt = net_connect.find_prompt()
        emit("cli_ready", {"prompt": prompt})
    except Exception as e:
        emit("cli_error", {"error": str(e)})


@socketio.on("send_command")
def handle_send_command(data):
    sid = request.sid
    command = data.get("command")
    if sid in connections:
        try:
            net_connect = connections[sid]
            output = net_connect.send_command(command, expect_string=r"#|>")
            prompt = net_connect.find_prompt()
            emit("cli_output", {"output": output, "prompt": prompt, "command": command})
        except Exception as e:
            emit("cli_error", {"error": str(e)})
    else:
        emit(
            "cli_error",
            {"error": "Connection lost. Please close and reopen the terminal."},
        )


@socketio.on("disconnect")
def handle_disconnect():
    sid = request.sid
    if sid in connections:
        try:
            connections[sid].disconnect()
        except Exception as e:
            print(f"Error on disconnect for {sid}: {e}")
        del connections[sid]


# ==============================================================================
# --- Database Management Endpoints ---
# ==============================================================================

ALLOWED_TABLES = {
    "devices": "id",
    "device_groups": "id",
    "activity_log": "id",
    "config_backups": "id",
    "users": "id",
}


@app.route("/api/db/tables", methods=["GET"])
def get_db_tables():
    return jsonify({"status": "success", "tables": list(ALLOWED_TABLES.keys())})


@app.route("/api/db/table/<string:table_name>", methods=["GET"])
def get_table_data(table_name):
    if table_name not in ALLOWED_TABLES:
        return (
            jsonify({"status": "error", "message": "Table not found or access denied"}),
            404,
        )

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            query = f"SELECT * FROM `{table_name}` ORDER BY `{ALLOWED_TABLES[table_name]}` DESC LIMIT 200"
            cursor.execute(query)
            data = cursor.fetchall()
            columns = [desc[0] for desc in cursor.description]
        return jsonify({"status": "success", "columns": columns, "data": data})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        if conn:
            conn.close()


@app.route("/api/db/table/<string:table_name>/<int:row_id>", methods=["DELETE"])
def delete_table_row(table_name, row_id):
    if table_name not in ALLOWED_TABLES:
        return (
            jsonify({"status": "error", "message": "Table not found or access denied"}),
            404,
        )

    if table_name == "users" and row_id == 1:
        return (
            jsonify(
                {"status": "error", "message": "Cannot delete the primary admin user."}
            ),
            403,
        )

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            pk_column = ALLOWED_TABLES[table_name]
            query = f"DELETE FROM `{table_name}` WHERE `{pk_column}` = %s"
            cursor.execute(query, (row_id,))
            conn.commit()
            if cursor.rowcount > 0:
                log_activity(
                    "DB_DELETE_ROW",
                    username=request.args.get("user"),
                    target_identifier=f"{table_name}:{row_id}",
                )
                return jsonify(
                    {
                        "status": "success",
                        "message": f"Row {row_id} from table {table_name} deleted successfully.",
                    }
                )
            else:
                return jsonify({"status": "error", "message": "Row not found."}), 404
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        if conn:
            conn.close()


@app.route("/api/db/table/<string:table_name>/<int:row_id>", methods=["PUT"])
def update_table_row(table_name, row_id):
    if table_name not in ALLOWED_TABLES:
        return (
            jsonify({"status": "error", "message": "Table not found or access denied"}),
            404,
        )

    data = request.json
    if not data:
        return (
            jsonify({"status": "error", "message": "No data provided for update."}),
            400,
        )

    pk_column = ALLOWED_TABLES[table_name]

    if pk_column in data:
        del data[pk_column]

    if table_name == "users" and "password_hash" in data and not data["password_hash"]:
        del data["password_hash"]

    set_clause = ", ".join(
        [f"`{key}` = %s" for key in data.keys() if key != "loggedInUser"]
    )
    if not set_clause:
        return jsonify({"status": "success", "message": "No changes detected."})

    values = [v for k, v in data.items() if k != "loggedInUser"]
    values.append(row_id)

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            query = f"UPDATE `{table_name}` SET {set_clause} WHERE `{pk_column}` = %s"
            cursor.execute(query, tuple(values))
            conn.commit()
            log_activity(
                "DB_UPDATE_ROW",
                username=data.get("loggedInUser"),
                target_identifier=f"{table_name}:{row_id}",
                details=str(data),
            )
            return jsonify(
                {
                    "status": "success",
                    "message": f"Row {row_id} in {table_name} updated successfully.",
                }
            )
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        if conn:
            conn.close()


# ==============================================================================
# --- Standard HTTP Endpoints ---
# ==============================================================================
@app.route("/api/login", methods=["POST"])
def login():
    data = request.json
    username = data.get("username")
    password = data.get("password")
    if not username or not password:
        return jsonify({"status": "error", "message": "กรุณากรอกชื่อผู้ใช้และรหัสผ่าน"}), 400
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "SELECT password_hash FROM users WHERE username = %s", (username,)
            )
            user = cursor.fetchone()
            if (
                user
                and hashlib.sha256(password.encode()).hexdigest()
                == user["password_hash"]
            ):
                return jsonify({"status": "success", "message": "เข้าสู่ระบบสำเร็จ!"})
            else:
                return (
                    jsonify({"status": "error", "message": "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง"}),
                    401,
                )
    finally:
        conn.close()


@app.route("/api/groups", methods=["GET"])
def get_groups():
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "SELECT * FROM device_groups ORDER BY building_name, floor_name"
            )
            groups = cursor.fetchall()
        return jsonify({"status": "success", "groups": groups})
    finally:
        conn.close()


@app.route("/api/groups", methods=["POST"])
def add_group():
    data = request.json
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "INSERT INTO device_groups (building_name, floor_name, description) VALUES (%s, %s, %s)",
                (
                    data["building_name"],
                    data["floor_name"],
                    data.get("description", ""),
                ),
            )
        conn.commit()
        log_activity(
            "CREATE_GROUP",
            username=data.get("loggedInUser"),
            target_identifier=f"{data['building_name']} - {data['floor_name']}",
        )
        return jsonify({"status": "success", "message": "เพิ่มกลุ่มใหม่สำเร็จ"}), 201
    except pymysql.IntegrityError:
        return jsonify({"status": "error", "message": "กลุ่มนี้ (อาคาร/ชั้น) มีอยู่แล้ว"}), 409
    finally:
        conn.close()


@app.route("/api/devices", methods=["GET"])
def get_devices():
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            sql = "SELECT d.id, d.name, d.category, d.host, d.device_type, d.username, d.password, d.secret, d.group_id, g.building_name, g.floor_name FROM devices d LEFT JOIN device_groups g ON d.group_id = g.id ORDER BY g.building_name, g.floor_name, d.name"
            cursor.execute(sql)
            devices = cursor.fetchall()
        return jsonify({"status": "success", "devices": devices})
    finally:
        conn.close()


@app.route("/api/add_device", methods=["POST"])
def add_device():
    data = request.json
    conn = get_db_connection()
    try:
        group_id = data.get("group_id")
        if not group_id or group_id == "":
            group_id = None
        with conn.cursor() as cursor:
            cursor.execute(
                "INSERT INTO devices (name, category, host, device_type, username, password, secret, group_id) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
                (
                    data["name"],
                    data["category"],
                    data["host"],
                    "cisco_ios",
                    data["username"],
                    data["password"],
                    data.get("secret"),
                    group_id,
                ),
            )
        conn.commit()
        log_activity(
            "CREATE_DEVICE",
            username=data.get("loggedInUser"),
            target_identifier=data["host"],
            details=f"Name: {data['name']}",
        )
        return jsonify({"status": "success", "message": "บันทึกข้อมูลสำเร็จ"}), 201
    except pymysql.IntegrityError:
        return jsonify({"status": "error", "message": "บันทึกข้อมูลไม่สำเร็จ IP ซ้ำ"}), 409
    finally:
        conn.close()


@app.route("/api/devices/<string:host>", methods=["PUT"])
def update_device(host):
    data = request.json
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            group_id = data.get("group_id")
            if not group_id or group_id == "":
                group_id = None
            sql = """
                UPDATE devices SET 
                    name=%s, category=%s, host=%s, username=%s, 
                    password=%s, secret=%s, group_id=%s 
                WHERE host=%s
            """
            cursor.execute(
                sql,
                (
                    data["name"],
                    data["category"],
                    data["host"],
                    data["username"],
                    data["password"],
                    data.get("secret", ""),
                    group_id,
                    host,
                ),
            )
            conn.commit()
            if cursor.rowcount > 0:
                details = (
                    f"Updated device info. New IP: {data['host']}, Name: {data['name']}"
                )
                log_activity(
                    "UPDATE_DEVICE",
                    username=data.get("loggedInUser"),
                    target_identifier=host,
                    details=details,
                )
                return jsonify({"status": "success", "message": "อัปเดตข้อมูลสำเร็จ"})
            else:
                return (
                    jsonify({"status": "error", "message": "ไม่พบอุปกรณ์ที่ต้องการแก้ไข"}),
                    404,
                )
    except pymysql.IntegrityError:
        return jsonify({"status": "error", "message": "IP Address ใหม่ซ้ำกับอุปกรณ์อื่น"}), 409
    finally:
        conn.close()


@app.route("/api/remove_device/<string:host>", methods=["DELETE"])
def remove_device(host):
    user = request.args.get("user")
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("DELETE FROM devices WHERE host = %s", (host,))
            conn.commit()
            if cursor.rowcount > 0:
                log_activity("DELETE_DEVICE", username=user, target_identifier=host)
                return jsonify(
                    {"status": "success", "message": f"Device {host} ลบข้อมูลสำเร็จ"}
                )
            else:
                return jsonify({"status": "error", "message": "ไม่พบอุปกรณ์"}), 404
    finally:
        conn.close()


# --- APIs FOR CONFIG BACKUPS ---
@app.route("/api/devices/<int:device_id>/backups", methods=["POST"])
def create_backup(device_id):
    data = request.json
    username = data.get("loggedInUser")
    description = data.get("description", "")
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT * FROM devices WHERE id = %s", (device_id,))
            device = cursor.fetchone()
            if not device:
                return jsonify({"status": "error", "message": "ไม่พบอุปกรณ์"}), 404
            device_info = {
                "device_type": device["device_type"],
                "host": device["host"],
                "username": device["username"],
                "password": device["password"],
                "secret": device.get("secret", ""),
            }
            with ConnectHandler(**device_info) as net_connect:
                net_connect.enable()
                running_config = net_connect.send_command(
                    "show running-config", read_timeout=60
                )
            if not running_config:
                return (
                    jsonify({"status": "error", "message": "ไม่สามารถดึงข้อมูลการตั้งค่าได้"}),
                    500,
                )
            cursor.execute("SELECT id FROM users WHERE username = %s", (username,))
            user = cursor.fetchone()
            user_id = user["id"] if user else None
            sql = "INSERT INTO config_backups (device_id, user_id, configuration, description) VALUES (%s, %s, %s, %s)"
            cursor.execute(sql, (device_id, user_id, running_config, description))
            conn.commit()
            log_activity(
                "CREATE_BACKUP",
                username=username,
                target_identifier=device["host"],
                details=description,
            )
            return jsonify({"status": "success", "message": "บันทึกการตั้งค่าสำเร็จ!"}), 201
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        if conn:
            conn.close()


@app.route("/api/devices/<int:device_id>/backups", methods=["GET"])
def get_backups(device_id):
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            sql = "SELECT b.id, b.description, b.created_at, u.username FROM config_backups b LEFT JOIN users u ON b.user_id = u.id WHERE b.device_id = %s ORDER BY b.created_at DESC"
            cursor.execute(sql, (device_id,))
            backups = cursor.fetchall()
        return jsonify({"status": "success", "backups": backups})
    finally:
        conn.close()


@app.route("/api/backups/<int:backup_id>", methods=["GET"])
def get_backup_config(backup_id):
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "SELECT configuration FROM config_backups WHERE id = %s", (backup_id,)
            )
            backup = cursor.fetchone()
            if backup:
                return jsonify(
                    {"status": "success", "configuration": backup["configuration"]}
                )
            else:
                return jsonify({"status": "error", "message": "ไม่พบไฟล์ Backup"}), 404
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        if conn:
            conn.close()


@app.route("/api/devices/<int:device_id>/restore", methods=["POST"])
def restore_backup(device_id):
    data = request.json
    backup_id = data.get("backup_id")
    username = data.get("loggedInUser")
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT * FROM devices WHERE id = %s", (device_id,))
            device = cursor.fetchone()
            if not device:
                return jsonify({"status": "error", "message": "ไม่พบอุปกรณ์"}), 404
            cursor.execute(
                "SELECT configuration FROM config_backups WHERE id = %s", (backup_id,)
            )
            backup = cursor.fetchone()
            if not backup:
                return jsonify({"status": "error", "message": "ไม่พบไฟล์ Backup"}), 404

            raw_config_lines = backup["configuration"].splitlines()
            config_commands = []
            ignore_phrases = [
                "Current configuration",
                "Building configuration",
                "version",
                "boot-start-marker",
                "boot-end-marker",
                "end",
                "ntp clock-period",
            ]
            for line in raw_config_lines:
                line = line.strip()
                if not line or line.startswith("!"):
                    continue
                if any(phrase in line for phrase in ignore_phrases):
                    continue
                config_commands.append(line)

            device_info = {
                "device_type": device["device_type"],
                "host": device["host"],
                "username": device["username"],
                "password": device["password"],
                "secret": device.get("secret", ""),
            }
            try:
                with ConnectHandler(**device_info) as net_connect:
                    net_connect.enable()
                    output = net_connect.send_config_set(config_commands)
            except Exception as net_e:
                return (
                    jsonify(
                        {
                            "status": "error",
                            "message": f"Failed to apply config to device: {net_e}",
                        }
                    ),
                    500,
                )
            details = f"Restored configuration from backup ID: {backup_id}"
            log_activity(
                "RESTORE_CONFIG",
                username=username,
                target_identifier=device["host"],
                details=details,
            )
            return jsonify(
                {"status": "success", "message": "คืนค่าการตั้งค่าสำเร็จ!", "output": output}
            )
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        if conn:
            conn.close()


@app.route("/api/check-device", methods=["POST"])
def check_device():
    device_info = request.json
    try:
        with ConnectHandler(**device_info, conn_timeout=5) as net_connect:
            net_connect.enable()
            version_output = net_connect.send_command("show version", read_timeout=10)
            uptime_match = re.search(r"uptime is\s+(.*)", version_output)
            uptime = uptime_match.group(1).strip() if uptime_match else "N/A"
            return jsonify({"status": "online", "uptime": uptime})
    except Exception:
        return jsonify({"status": "offline"})


@app.route("/api/device-details/<string:host>", methods=["POST"])
def get_device_details(host):
    device_data = request.json
    device_info = device_data.get("device_info")
    category = device_data.get("category")
    details = {}
    try:
        with ConnectHandler(**device_info, conn_timeout=10) as net_connect:
            net_connect.enable()
            if category == "Routers":
                details["ip_interfaces"] = parse_ip_interface_brief(
                    net_connect.send_command("show ip interface brief", read_timeout=15)
                )
                details["routing_table"] = parse_ip_route(
                    net_connect.send_command("show ip route", read_timeout=15)
                )
                details["dhcp_bindings"] = parse_dhcp_binding(
                    net_connect.send_command("show ip dhcp binding", read_timeout=15)
                )
            elif category == "Switches":
                details["port_status"] = parse_interfaces_status(
                    net_connect.send_command("show interfaces status", read_timeout=15)
                )
                details["mac_table"] = parse_mac_address_table(
                    net_connect.send_command("show mac address-table", read_timeout=15)
                )
                details["vlan_brief"] = parse_vlan_brief(
                    net_connect.send_command("show vlan brief", read_timeout=15)
                )
        return jsonify({"status": "success", "details": details})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/api/logs", methods=["GET"])
def get_logs():
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            sql = "SELECT a.id, a.action, a.target_identifier, a.details, a.timestamp, u.username FROM activity_log a LEFT JOIN users u ON a.user_id = u.id ORDER BY a.timestamp DESC LIMIT 100"
            cursor.execute(sql)
            logs = cursor.fetchall()
        return jsonify({"status": "success", "logs": logs})
    finally:
        conn.close()


# --- Main Execution ---
if __name__ == "__main__":
    print("Starting Flask-SocketIO server on http://0.0.0.0:5000")
    socketio.run(app, debug=True, host="0.0.0.0", port=5000)
