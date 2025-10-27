#!/usr/bin/env python3
"""
Mock PLC Server for S-Pavilion
Simulates LS XBC-DN20E PLC with Modbus RTU over TCP 

pymodbus 3.10+ API (ModbusDeviceContext/devices=) 사용
qasync로 asyncio + PyQt5 이벤트루프 통합
AddressMap을 그대로 반영, 0-based Modbus 주소
10 Hz(0.1s) 주기 업데이트
"""

import logging
import time
import threading
import asyncio
from datetime import datetime

import sys
import pymodbus

# check python version
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

class CustomDeviceContext(ModbusDeviceContext):
    """Custom device context that handles coil writes with device control logic"""

    def __init__(self, plc_server, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.plc_server = plc_server

    def getValues(self, fc_as_hex, address, count=1):
        """Override getValues to add logging for coil reads"""
        logger.info(f"Reading coil address {address}, count={count}, fc={fc_as_hex}")
        result = super().getValues(fc_as_hex, address, count)
        logger.info(f"Read result for address {address}: {result}")
        return result

    def setValues(self, fc_as_hex, address, values):
        """Override setValues to handle device control logic"""
        logger.info(f"Writing to coil address {address}: {values}")

        # Handle control coil writes (0x10-0x17)
        if fc_as_hex == 5 and 16 <= address <= 23:  # FC 5 = Write Single Coil, 0x10-0x17
            device_index = address - 16
            device_names = list(self.plc_server.device_controls.keys())

            logger.info(f"Control coil write detected: address={address}, device_index={device_index}, device_names={device_names}")

            if device_index < len(device_names):
                device_name = device_names[device_index]
                control_name = device_name
                status_name = device_name.replace('_set', '_status')

                logger.info(f"Processing device control: device_name={device_name}, control_name={control_name}, status_name={status_name}")

                if values[0]:  # If control is set to True
                    logger.info(f"Triggering device control for {status_name}")
                    self.plc_server.handle_device_control(status_name, control_name)
                else:
                    logger.info(f"Control value is False, not triggering device control")
            else:
                logger.warning(f"Device index {device_index} out of range for device names {device_names}")
        else:
            logger.info(f"Not a control coil write: fc_as_hex={fc_as_hex}, address={address}")

        # Call parent setValues and return the result
        result = super().setValues(fc_as_hex, address, values)
        logger.info(f"Successfully wrote coil address {address}: {values}")
        return result

class MockPLCServer:
    def __init__(self):
        # Initialize device states (8 devices)
        # Status coils (0x00-0x07): heat_status, fan_status, btsp_status, light_red_status, light_green_status, light_blue_status, light_white_status, display_status
        # Control coils (0x10-0x17): heat_set, fan_set, btsp_set, light_red_set, light_green_set, light_blue_set, light_white_set, display_set
        
        self.device_states = {
            'heat_status': False,
            'fan_status': False,
            'btsp_status': False,
            'light_red_status': False,
            'light_green_status': False,
            'light_blue_status': False,
            'light_white_status': False,
            'display_status': False
        }
        
        self.device_controls = {
            'heat_set': False,
            'fan_set': False,
            'btsp_set': False,
            'light_red_set': False,
            'light_green_set': False,
            'light_blue_set': False,
            'light_white_set': False,
            'display_set': False
        }
        
        # Device timers (in seconds)
        self.device_timers = {
            'heat': 600,      # 10 minutes
            'fan': 600,       # 10 minutes
            'btsp': 3600,     # 1 hour
            'light_red': 3600,    # 1 hour
            'light_green': 3600,  # 1 hour
            'light_blue': 3600,   # 1 hour
            'light_white': 3600,  # 1 hour
            'display': 0      # Manual (no timer)
        }
        
        self.timer_start_times = {}
        
        # Create Modbus data store
        self.setup_modbus_datastore()
        
        # Start timer thread
        self.timer_thread = threading.Thread(target=self.timer_loop, daemon=True)
        self.timer_thread.start()
    
    def setup_modbus_datastore(self):
        """Setup Modbus data store with initial values"""
        # Create data blocks
        # Coils: 0x00-0x07 (status), 0x10-0x17 (control)
        coils_data = [0] * 2000  # Using integers (0/1) instead of booleans - increased to support wider range

        # Set initial status values
        status_keys = list(self.device_states.keys())
        for i, key in enumerate(status_keys):
            coils_data[i] = 1 if self.device_states[key] else 0

        # Set initial control values
        control_keys = list(self.device_controls.keys())
        for i, key in enumerate(control_keys):
            coils_data[16 + i] = 1 if self.device_controls[key] else 0  # 0x10-0x17

        # Create custom device context with device control logic
        self.store = CustomDeviceContext(
            self,  # Pass PLC server instance
            di=ModbusSequentialDataBlock(0, [0] * 2000),  # Discrete Inputs - increased to match coils
            co=ModbusSequentialDataBlock(0, coils_data),     # Coils
            hr=ModbusSequentialDataBlock(0, [0] * 2000),      # Holding Registers - increased to match coils
            ir=ModbusSequentialDataBlock(0, [0] * 2000)       # Input Registers - increased to match coils
        )

        # Create server context
        self.context = ModbusServerContext(devices=self.store, single=True)
        self.slave_id = 0x00  # Slave ID for device context
    
    
    def handle_device_control(self, status_name, control_name):
        """Handle device control logic with timers"""
        device_name = status_name.replace('_status', '')
        
        if self.device_states[status_name]:
            # Device is on, turn it off
            self.device_states[status_name] = False
            self.device_controls[control_name] = False
            if device_name in self.timer_start_times:
                del self.timer_start_times[device_name]
            logger.info(f"Device {device_name} turned OFF")
        else:
            # Device is off, turn it on
            self.device_states[status_name] = True
            self.device_controls[control_name] = True
            
            # Start timer if device has auto-off timer
            if self.device_timers[device_name] > 0:
                self.timer_start_times[device_name] = time.time()
                logger.info(f"Device {device_name} turned ON (timer: {self.device_timers[device_name]}s)")
            else:
                logger.info(f"Device {device_name} turned ON (manual)")
        
        # Update Modbus data store
        self.update_modbus_store()
    
    def update_modbus_store(self):
        """Update Modbus data store with current device states"""
        # Update status coils (0x00-0x07)
        status_keys = list(self.device_states.keys())
        for i, key in enumerate(status_keys):
            self.context[self.slave_id].setValues(1, i, [1 if self.device_states[key] else 0])  # FC 1 = Coils

        # Update control coils (0x10-0x17)
        control_keys = list(self.device_controls.keys())
        for i, key in enumerate(control_keys):
            self.context[self.slave_id].setValues(1, 16 + i, [1 if self.device_controls[key] else 0])
    
    def timer_loop(self):
        """Timer loop for auto-off functionality"""
        while True:
            current_time = time.time()
            
            for device_name, start_time in list(self.timer_start_times.items()):
                elapsed = current_time - start_time
                timer_duration = self.device_timers[device_name]
                
                if elapsed >= timer_duration:
                    # Auto-off device
                    status_name = f"{device_name}_status"
                    control_name = f"{device_name}_set"
                    
                    self.device_states[status_name] = False
                    self.device_controls[control_name] = False
                    del self.timer_start_times[device_name]
                    
                    logger.info(f"Device {device_name} auto-turned OFF after {timer_duration}s")
                    self.update_modbus_store()
            
            time.sleep(1)  # Check every second
    
    def get_device_status(self):
        """Get current device status for API"""
        return {
            'timestamp': datetime.now().isoformat(),
            'devices': self.device_states.copy()
        }
    
    async def start_server(self, host='0.0.0.0', port=502):
        """Start Modbus TCP server"""
        # Device identification
        identity = ModbusDeviceIdentification()
        identity.VendorName = 'LS Electric'
        identity.ProductCode = 'XBC-DN20E'
        identity.VendorUrl = 'http://www.ls-electric.com'
        identity.ProductName = 'XBC-DN20E PLC'
        identity.ModelName = 'XBC-DN20E'
        identity.MajorMinorRevision = '1.0'

        logger.info(f"Starting Mock PLC Server (Modbus TCP) on {host}:{port}")
        logger.info("Device mapping:")
        logger.info("Coils 0x00-0x07: Device status (heat, fan, btsp, light_red, light_green, light_blue, light_white, display)")
        logger.info("Coils 0x10-0x17: Device control (heat_set, fan_set, btsp_set, light_red_set, light_green_set, light_blue_set, light_white_set, display_set)")
        logger.info("Server is ready to accept connections...")

        try:
            await StartAsyncTcpServer(
                context=self.context,
                identity=identity,
                address=(host, port),
                framer=FramerType.SOCKET  # 일반 TCP 사용
            )
        except Exception as e:
            logger.error(f"Error starting server: {e}")

async def main():
    """Main function"""
    server = MockPLCServer()
    await server.start_server()

if __name__ == "__main__":
    asyncio.run(main())

