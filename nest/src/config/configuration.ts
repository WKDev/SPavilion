export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  database: {
    url:
      process.env.DATABASE_URL ??
      'postgresql://nest:nest@localhost:5432/nest?schema=public',
  },
  modbus: {
    mock: (process.env.MODBUS_MOCK ?? 'true').toLowerCase() !== 'false',
    port: process.env.PLC_PORT ?? '/dev/ttyUSB0',
    baudRate: parseInt(process.env.PLC_BAUD_RATE ?? '9600', 10),
    tcpHost: process.env.MODBUS_TCP_HOST ?? 'localhost',
    tcpPort: parseInt(process.env.MODBUS_TCP_PORT ?? '502', 10),
    unitId: parseInt(process.env.MODBUS_DEVICE_UNIT_ID ?? '1', 10),
  },
  heatmap: {
    gridSize: parseInt(process.env.HEATMAP_GRID_SIZE ?? '50', 10),
    cellSize: parseInt(process.env.HEATMAP_CELL_SIZE ?? '100', 10),
  },
});
