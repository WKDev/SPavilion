const ModbusRTU = require('modbus-serial');

const PORT = 'COM3';
const BAUD_RATE = 115200;
const SLAVE_ID = 1;

const client = new ModbusRTU();

async function testConnection() {
  try {
    console.log(`Attempting to connect to Modbus RTU...`);
    console.log(`Port: ${PORT}`);
    console.log(`Baud Rate: ${BAUD_RATE}`);
    console.log(`Slave ID: ${SLAVE_ID}`);
    console.log('-----------------------------------');

    // Connect to RTU port
    await client.connectRTUBuffered(PORT, {
      baudRate: BAUD_RATE,
      dataBits: 8,
      stopBits: 1,
      parity: 'none',
    });

    console.log('✓ Connection established successfully!');

    // Set slave ID
    client.setID(SLAVE_ID);
    client.setTimeout(1000);

    console.log('\nReading coils (0x00-0x07)...');
    const coils = await client.readCoils(0x00, 8);
    console.log('Coils data:', coils.data);

    console.log('\nReading holding registers (0x00-0x07)...');
    const registers = await client.readHoldingRegisters(0x00, 8);
    console.log('Registers data:', registers.data);

    console.log('\n✓ Test completed successfully!');

  } catch (error) {
    console.error('\n✗ Error occurred:');
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    if (client.isOpen) {
      client.close(() => {
        console.log('\nConnection closed.');
        process.exit(0);
      });
    } else {
      process.exit(1);
    }
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n\nReceived SIGINT, closing connection...');
  if (client.isOpen) {
    client.close(() => {
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

// Run test
testConnection();
