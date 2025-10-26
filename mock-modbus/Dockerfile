FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements and install Python dependencies
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY main.py /app/
COPY start_mock_plc.sh /app/

# Make startup script executable
RUN chmod +x /app/start_mock_plc.sh

# Expose Modbus TCP port
EXPOSE 502

# Expose Modbus RTU over TCP port (for serial simulation)
EXPOSE 503

CMD ["/app/start_mock_plc.sh"]
