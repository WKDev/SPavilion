#!/usr/bin/env python3
"""
Basic Modbus TCP Server
Simple Modbus server with 2-second status printing
"""

import logging
import asyncio
from datetime import datetime

import sys
import pymodbus

# Check python version
print(f"Python version: {sys.version_info} | pymodbus version: {pymodbus.__version__}")

if sys.version_info < (3, 11) or pymodbus.__version__ < "3.11":
    print("Python 3.11 or higher and pymodbus 3.11 or higher are required")
    sys.exit(1)

from pymodbus import ModbusDeviceIdentification
from pymodbus.server import StartAsyncTcpServer
from pymodbus.datastore import ModbusSequentialDataBlock, ModbusServerContext, ModbusDeviceContext
from pymodbus.framer import FramerType

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Reduce noise from frequent polling operations
logging.getLogger('pymodbus').setLevel(logging.WARNING)


class LoggingDeviceContext(ModbusDeviceContext):
    """Custom device context that logs all write operations"""
    
    def setValues(self, fc_as_hex, address, values):
        """Override setValues to log write operations"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        
        # Map function codes to names
        fc_names = {
            5: "Write Single Coil",
            6: "Write Single Register",
            15: "Write Multiple Coils",
            16: "Write Multiple Registers"
        }
        
        fc_name = fc_names.get(fc_as_hex, f"Unknown FC({fc_as_hex})")
        
        # Log the write operation
        logger.info(f"[{timestamp}] WRITE - {fc_name}: Address={address}, Values={values}")
        
        # Call parent to perform the actual write
        return super().setValues(fc_as_hex, address, values)


class MockPLCServer:
    def __init__(self):
        # Create basic Modbus data store
        self.setup_modbus_datastore()
        
        # Task for periodic status printing
        self.status_task = None
    
    def setup_modbus_datastore(self):
        """Setup basic Modbus data store"""
        # Create data blocks with 1000 registers/coils
        self.store = LoggingDeviceContext(
            di=ModbusSequentialDataBlock(0, [0] * 1000),  # Discrete Inputs
            co=ModbusSequentialDataBlock(0, [0] * 1000),  # Coils
            hr=ModbusSequentialDataBlock(0, [0] * 1000),  # Holding Registers
            ir=ModbusSequentialDataBlock(0, [0] * 1000)   # Input Registers
        )

        # Create server context
        self.context = ModbusServerContext(devices=self.store, single=True)
        self.slave_id = 0x00
    
    async def print_status(self):
        """Print current Modbus status every 2 seconds"""
        while True:
            await asyncio.sleep(2)
            
            # Read current values from all data blocks
            coils = self.context[self.slave_id].getValues(1, 0, 1000)  # FC 1 = Read Coils
            discrete_inputs = self.context[self.slave_id].getValues(2, 0, 1000)  # FC 2 = Read Discrete Inputs
            holding_registers = self.context[self.slave_id].getValues(3, 0, 1000)  # FC 3 = Read Holding Registers
            input_registers = self.context[self.slave_id].getValues(4, 0, 1000)  # FC 4 = Read Input Registers
            
            # Print first 16 values from each block as sample
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            print(f"\n[{timestamp}] Modbus Status:")
            print(f"  Coils (0-15): {coils[:16] if len(coils) >= 16 else coils}")
            print(f"  Discrete Inputs (0-15): {discrete_inputs[:16] if len(discrete_inputs) >= 16 else discrete_inputs}")
            print(f"  Holding Registers (0-15): {holding_registers[:16] if len(holding_registers) >= 16 else holding_registers}")
            print(f"  Input Registers (0-15): {input_registers[:16] if len(input_registers) >= 16 else input_registers}")
    
    async def start_server(self, host='0.0.0.0', port=502):
        """Start Modbus TCP server"""
        # Device identification
        identity = ModbusDeviceIdentification()
        identity.VendorName = 'Mock PLC'
        identity.ProductCode = 'MockServer'
        identity.VendorUrl = 'http://localhost'
        identity.ProductName = 'Mock Modbus Server'
        identity.ModelName = 'Basic Server'
        identity.MajorMinorRevision = '1.0'

        logger.info(f"Starting Basic Modbus TCP Server on {host}:{port}")
        logger.info("=" * 80)
        logger.info("Modbus Address Map:")
        logger.info("  Coils: 0-999")
        logger.info("  Discrete Inputs: 0-999")
        logger.info("  Holding Registers: 0-999")
        logger.info("  Input Registers: 0-999")
        logger.info("=" * 80)
        logger.info("Status will be printed every 2 seconds...")
        logger.info("Server is ready to accept connections...")

        # Start status printing task
        self.status_task = asyncio.create_task(self.print_status())

        try:
            await StartAsyncTcpServer(
                context=self.context,
                identity=identity,
                address=(host, port),
                framer=FramerType.SOCKET
            )
        except Exception as e:
            logger.error(f"Error starting server: {e}")
            raise


async def main():
    """Main function"""
    server = MockPLCServer()
    await server.start_server()


if __name__ == "__main__":
    asyncio.run(main())
