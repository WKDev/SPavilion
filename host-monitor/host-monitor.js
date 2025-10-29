const express = require('express');
const si = require('systeminformation');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 9100;

// Enable CORS for Docker container access
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Main system info endpoint
app.get('/api/system/info', async (req, res) => {
  try {
    // Gather system information in parallel
    const [cpuLoad, memInfo, diskInfo] = await Promise.all([
      si.currentLoad(),
      Promise.resolve({
        total: os.totalmem(),
        free: os.freemem(),
      }),
      si.fsSize(),
    ]);

    // Process CPU info
    const cpuCores = os.cpus().length;
    const cpuUsage = Math.round(cpuLoad.currentLoad * 100) / 100;

    // Process memory info
    const memTotal = memInfo.total;
    const memFree = memInfo.free;
    const memUsed = memTotal - memFree;
    const memPercentage = Math.round((memUsed / memTotal) * 100 * 100) / 100;

    // Process disk info (aggregate all filesystems)
    let diskTotal = 0;
    let diskUsed = 0;
    let diskFree = 0;

    // Filter out system/virtual drives and only include physical drives
    const physicalDisks = diskInfo.filter((disk) => {
      // On Windows, exclude system reserved, recovery partitions
      // Only include main drives (C:, D:, etc.)
      return (
        disk.size > 0 &&
        !disk.fs.toLowerCase().includes('recovery') &&
        !disk.fs.toLowerCase().includes('system reserved')
      );
    });

    physicalDisks.forEach((disk) => {
      diskTotal += disk.size;
      diskUsed += disk.used;
      diskFree += disk.available;
    });

    const diskPercentage = diskTotal > 0
      ? Math.round((diskUsed / diskTotal) * 100 * 100) / 100
      : 0;

    // Return formatted response matching NestJS DTO structure
    const response = {
      cpu: {
        usage: cpuUsage,
        cores: cpuCores,
      },
      memory: {
        total: memTotal,
        used: memUsed,
        free: memFree,
        percentage: memPercentage,
      },
      disk: {
        total: diskTotal,
        used: diskUsed,
        free: diskFree,
        percentage: diskPercentage,
      },
    };

    res.json(response);
  } catch (error) {
    console.error('Error gathering system info:', error);
    res.status(500).json({
      error: 'Failed to gather system information',
      message: error.message,
    });
  }
});

// Individual metric endpoints (optional, for debugging)
app.get('/api/system/cpu', async (req, res) => {
  try {
    const cpuLoad = await si.currentLoad();
    res.json({
      usage: Math.round(cpuLoad.currentLoad * 100) / 100,
      cores: os.cpus().length,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/system/memory', async (req, res) => {
  try {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;
    res.json({
      total,
      used,
      free,
      percentage: Math.round((used / total) * 100 * 100) / 100,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/system/disk', async (req, res) => {
  try {
    const diskInfo = await si.fsSize();
    let total = 0;
    let used = 0;
    let free = 0;

    diskInfo
      .filter(
        (d) =>
          d.size > 0 &&
          !d.fs.toLowerCase().includes('recovery') &&
          !d.fs.toLowerCase().includes('system reserved')
      )
      .forEach((disk) => {
        total += disk.size;
        used += disk.used;
        free += disk.available;
      });

    res.json({
      total,
      used,
      free,
      percentage: total > 0 ? Math.round((used / total) * 100 * 100) / 100 : 0,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`S-Pavilion Host Monitor running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`System info: http://localhost:${PORT}/api/system/info`);
  console.log(`Platform: ${os.platform()} ${os.release()}`);
  console.log(`Hostname: ${os.hostname()}`);
});
