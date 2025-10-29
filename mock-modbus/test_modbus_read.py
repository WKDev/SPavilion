#!/usr/bin/env python3
"""Test script to verify Modbus server configuration"""

from pymodbus.client import ModbusTcpClient
import sys

def test_modbus_connection():
    """Test Modbus TCP connection and read operations"""
    client = ModbusTcpClient('localhost', port=502)

    print(f"Connecting to Modbus server at localhost:502...")
    if not client.connect():
        print("ERROR: Failed to connect to Modbus server")
        return False

    print("Connected successfully!")

    # Test reading different numbers of coils
    test_cases = [
        (0, 1, "Reading 1 coil at address 0"),
        (0, 8, "Reading 8 coils at address 0-7"),
        (0, 24, "Reading 24 coils at address 0-23"),
        (0, 100, "Reading 100 coils at address 0-99"),
    ]

    for start_addr, read_count, description in test_cases:
        print(f"\n{description}...")
        try:
            result = client.read_coils(start_addr, count=read_count, device_id=0)
            if result.isError():
                print(f"  ERROR: {result}")
            else:
                print(f"  SUCCESS: Read {len(result.bits)} coils")
                print(f"  First 10 values: {result.bits[:10]}")
        except Exception as e:
            print(f"  EXCEPTION: {e}")

    # Test reading registers
    print(f"\nReading 100 holding registers at address 0-99...")
    try:
        result = client.read_holding_registers(0, count=100, device_id=0)
        if result.isError():
            print(f"  ERROR: {result}")
        else:
            print(f"  SUCCESS: Read {len(result.registers)} registers")
    except Exception as e:
        print(f"  EXCEPTION: {e}")

    client.close()
    print("\nTest completed!")
    return True

if __name__ == "__main__":
    success = test_modbus_connection()
    sys.exit(0 if success else 1)
