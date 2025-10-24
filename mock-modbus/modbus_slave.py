import asyncio
from pymodbus.client import AsyncModbusTcpClient


async def read_data():
    client = AsyncModbusTcpClient("127.0.0.1", port=5020)
    await client.connect()
    while True:
        # ✅ 여기서 unit_id=1 로 설정 (클라이언트 기본 slave id)
        

        if not client.connected:
            print("서버 연결 실패")
            return

        # # Holding Register (D00000~D00005 = LV1~LV6)
        # rr = await client.read_holding_registers(address=0, count=6)
        # if not rr.isError():
        #     print("LV1~6:", rr.registers)

        # # ENC1 (D00008~9, 32bit)
        # rr = await client.read_holding_registers(address=8, count=2)
        # if not rr.isError():
        #     enc1 = (rr.registers[0] << 16) | rr.registers[1]
        #     print("ENC1:", enc1)

        # rr = await client.read_holding_registers(address=10, count=2)
        # if not rr.isError():
        #     enc2 = (rr.registers[0] << 16) | rr.registers[1]
        #     print("ENC2:", enc2)

        # rr = await client.read_holding_registers(address=12, count=2)
        # if not rr.isError():
        #     enc3 = (rr.registers[0] << 16) | rr.registers[1]
        #     print("ENC3:", enc3)


        # rr = await client.read_holding_registers(address=22, count=2)
        # if not rr.isError():
        #     enc_mean = (rr.registers[0] << 16) | rr.registers[1]
        #     print("ENC_MEAN:", enc_mean)

        # Coils (M00000~M00004)

        coil_addr = 1
        coil_count = 20
        rr = await client.read_coils(address=coil_addr, count=coil_count)
        if not rr.isError():
            print(f"{coil_addr}~{coil_addr+coil_count-1}:", rr.bits)

        await asyncio.sleep(0.1)
    await client.close()



if __name__ == "__main__":
    asyncio.run(read_data())
