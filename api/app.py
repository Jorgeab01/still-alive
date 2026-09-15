from flask import Flask, jsonify, request
from flask_cors import CORS
import sqlite3
import os
from datetime import datetime, timedelta, timezone

app = Flask(__name__)
CORS(app)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "..", "collector", "metrics.db")

SAMPLES_PER_DAY = 24 * 60 / 5  # collector runs every 5 minutes


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


@app.route("/api/status")
def status():
    conn = get_db()
    row = conn.execute(
        "SELECT * FROM metrics ORDER BY timestamp DESC LIMIT 1"
    ).fetchone()
    conn.close()

    if row is None:
        return jsonify({"online": False}), 404

    return jsonify({
        "online": True,
        "timestamp": row["timestamp"],
        "cpu_percent": row["cpu_percent"],
        "ram_percent": row["ram_percent"],
        "disk_percent": row["disk_percent"],
        "temp_celsius": row["temp_celsius"],
    })


@app.route("/api/history")
def history():
    hours = request.args.get("hours", default=24, type=int)
    since = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()

    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM metrics WHERE timestamp >= ? ORDER BY timestamp ASC",
        (since,),
    ).fetchall()
    conn.close()

    return jsonify([dict(row) for row in rows])


@app.route("/api/uptime")
def uptime():
    days = request.args.get("days", default=90, type=int)
    now = datetime.now(timezone.utc)
    today = now.date()
    # -1 so the range includes today, not just the (days-1) days before it
    since = today - timedelta(days=days - 1)

    conn = get_db()
    rows = conn.execute(
        "SELECT timestamp FROM metrics WHERE timestamp >= ?",
        (since.isoformat(),),
    ).fetchall()
    conn.close()

    counts = {}
    for row in rows:
        day = row["timestamp"][:10]
        counts[day] = counts.get(day, 0) + 1

    minutes_elapsed_today = now.hour * 60 + now.minute
    expected_today = max(1, minutes_elapsed_today / 5)

    result = []
    for i in range(days):
        day = since + timedelta(days=i)
        day_str = day.isoformat()
        count = counts.get(day_str, 0)
        expected = expected_today if day == today else SAMPLES_PER_DAY
        percent = min(100, round(count / expected * 100))
        result.append({"date": day_str, "uptime_percent": percent})

    return jsonify(result)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)