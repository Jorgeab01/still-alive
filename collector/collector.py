import psutil
import sqlite3
import subprocess
import re
import os
from datetime import datetime, timezone

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "metrics.db")


def get_temperature():
    # Temp measured from lm-sensors
    output = subprocess.run(["sensors"], capture_output=True, text=True).stdout
    match = re.search(r"Core 0:\s+\+([\d.]+)", output)
    return float(match.group(1)) if match else None


def init_db(conn):
    conn.execute("""
        CREATE TABLE IF NOT EXISTS metrics (
            timestamp TEXT PRIMARY KEY,
            cpu_percent REAL,
            ram_percent REAL,
            disk_percent REAL,
            temp_celsius REAL
        )
    """)
    conn.commit()


def collect():
    conn = sqlite3.connect(DB_PATH)
    init_db(conn)

    timestamp = datetime.now(timezone.utc).isoformat()
    cpu = psutil.cpu_percent(interval=1)
    ram = psutil.virtual_memory().percent
    disk = psutil.disk_usage("/").percent
    temp = get_temperature()

    conn.execute(
        "INSERT INTO metrics VALUES (?, ?, ?, ?, ?)",
        (timestamp, cpu, ram, disk, temp),
    )
    conn.commit()
    conn.close()


collect()