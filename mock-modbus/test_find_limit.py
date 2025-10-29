#!/usr/bin/env python3
"""Test to find the exact coil read limit"""

from pymodbus.client import ModbusTcpClient

def test_coil_limit():
    """Test different coil counts to find the limit"""
    client = ModbusTcpClient('localhost', port=502)

    if not client.connect():
        print("ERROR: Failed to connect")
        return

    # Test different coil counts - narrow down between 80 and 100
    test_counts = [80, 85, 90, 95, 96, 97, 98, 99, 100]

    for count in test_counts:
        try:
            result = client.read_coils(0, count=count, device_id=0)
            if result.isError():
                print(f"Count {count:4d}: ERROR")
            else:
                print(f"Count {count:4d}: SUCCESS (read {len(result.bits)} coils)")
        except Exception as e:
            print(f"Count {count:4d}: EXCEPTION - {e}")

    client.close()

if __name__ == "__main__":
    test_coil_limit()
