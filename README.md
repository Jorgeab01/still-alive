# Still Alive

![Status](https://img.shields.io/badge/status-in%20progress-yellow?style=for-the-badge)
![Python](https://img.shields.io/badge/python-3.14-3670A0?style=for-the-badge&logo=python&logoColor=ffdd54)

Lightweight monitoring for a home server, however old it is. Tracks uptime,
temperature, and resource usage over time, and can send an alert if the
server goes down or overheats.

## Why

I run a home server on an old laptop from 2008. It works fine, but old
hardware fails in ways new hardware does not: it overheats more, it has no
battery backup, and if it goes down while I am away, I have no way of
knowing unless I check manually.

still-alive collects basic health data every few minutes and keeps a
history, so I can see how the server is actually doing over days and weeks,
not just right now. It is built to work on any Linux machine, not just mine.

## How

A small Python script runs on a schedule (cron) and reads CPU usage, RAM
usage, disk usage, and temperature from the system. Each reading is saved
to a local SQLite database with a timestamp.

A Flask API reads from that database and exposes the data over HTTP. The
API is only reachable through a private network (Tailscale), so nothing is
exposed to the internet directly.

A small web dashboard then displays the data: current status, recent
history as graphs, and a day by day uptime view.

## Stack

- Python (collector script, using `psutil` and `lm-sensors`)
- SQLite
- Flask
- Tailscale

## Setup

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python collector/collector.py
```

The collector is meant to run on a schedule. Add it to cron to run every
few minutes:

```
*/5 * * * * /path/to/venv/bin/python /path/to/collector/collector.py
```

## Roadmap

- [x] `collector/collector.py`: reads system metrics and saves them to
    SQLite.
- [ ] `api/`: Flask API that reads the database and serves it as JSON.
- [ ] Tailscale Funnel to expose the API safely.
- [ ] `dashboard/`: web page showing server status.
- [ ] Alerts if the server goes down or overheats.