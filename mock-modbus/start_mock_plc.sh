#!/bin/bash

echo "Starting Mock PLC Server"
echo "Simulating LS XBC-DN20E PLC"
echo "Modbus TCP Server on port 502"
echo "Device timers:"
echo "  - heat, fan: 10 minutes auto-off"
echo "  - btsp, lights: 1 hour auto-off"
echo "  - display: manual toggle"
echo "----------------------------------------"

# Start the mock PLC server
python3 /app/mock_plc_server.py
