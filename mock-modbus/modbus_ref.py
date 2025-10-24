"""
Modbus TCP Sensor Simulator (Py 3.11+ / 3.13 OK)
- pymodbus 3.10+ API (ModbusDeviceContext/devices=) 사용
- qasync로 asyncio + PyQt5 이벤트루프 통합
- AddressMap을 그대로 반영, 0-based Modbus 주소
- 10 Hz(0.1s) 주기 업데이트
"""

import math
import random
import asyncio
from typing import Dict, Tuple

from PyQt5 import QtWidgets, QtCore
from qasync import QEventLoop, asyncSlot

from pymodbus.server import StartAsyncTcpServer
from pymodbus.datastore import (
    ModbusServerContext, ModbusDeviceContext, ModbusSequentialDataBlock
)
try:
    # 신버전 경로
    from pymodbus import ModbusDeviceIdentification
except Exception:  # pragma: no cover
    from pymodbus.device import ModbusDeviceIdentification  # 구버전 호환

# =========================
# Address Map (0-based)
# =========================
# BIT(Coils)
COILS: Dict[str, int] = {
    # 모니터링
    "RESET_DEVICE":     0x00000,
    "DEVICE_RDY":       0x00001,
    "INIT_CURSOR_DONE": 0x00002,
    # 제어
    "IS_RUNNING_SIGNAL":0x00003,

    # 변위센서/엔코더 health
    "LV1_OK":0x00005, "LV2_OK":0x00006, "LV3_OK":0x00007,
    "LV4_OK":0x00008, "LV5_OK":0x00009, "LV6_OK":0x0000A,
    "ENC1_OK":0x0000B, "ENC2_OK":0x0000C, "ENC3_OK":0x0000D,

    # GUI 제어 (RUN/STOP/ERR)
    "PLC_RUN":  0x00013,
    "PLC_STOP": 0x00014,
    "PLC_ERR":  0x00015,

    # 입력/버튼
    "SW_START": 0x0001C,
    "SW_STOP":  0x0001D,
    "SW_RESET": 0x0001E,
    "PB_START": 0x00000,  # PB는 예시로 P영역을 코일로 맵핑
    "PB_STOP":  0x00001,
}

# WORD(Holding Registers)
HREGS: Dict[str, int] = {
    "LV1":0, "LV2":1, "LV3":2,
    "LV4":3, "LV5":4, "LV6":5,

    "ENC1_H":9, "ENC1_L":8,
    "ENC2_H":11, "ENC2_L":10,
    "ENC3_H":13, "ENC3_L":12,

    "ENC_MEAN_H":22, "ENC_MEAN_L":23,

    "LGAP_IDX":36, "LGAP_STEPSIZE":39, "LGAP_STEP_POS_H": 37, "LGAP_STEP_POS_L": 38,
    "RGAP_IDX":41, "RGAP_STEPSIZE":44, "RGAP_STEP_POS_H": 42, "RGAP_STEP_POS_L": 43,
}

# =========================
# Modbus Datastore
# =========================
device = ModbusDeviceContext(
    di=ModbusSequentialDataBlock(0, [0]*0x0500),
    co=ModbusSequentialDataBlock(0, [0]*0x0500),
    hr=ModbusSequentialDataBlock(0, [0]*0x0500),
    ir=ModbusSequentialDataBlock(0, [0]*0x0500),
)
context = ModbusServerContext(devices=device, single=True)
SLAVE_ID = 0x00  # single=True 권장 ID

# --- helpers (추가) ---
def _run_enabled() -> bool:
    """러닝 조건: (IS_RUNNING_SIGNAL or PLC_RUN) and not PLC_STOP"""
    # return (get_coil("IS_RUNNING_SIGNAL") or get_coil("PLC_RUN")) and (not get_coil("PLC_STOP"))
    return True

def _set_u32_pair(name_hi: str, name_lo: str, value: int) -> None:
    set_hr_u32(name_hi, name_lo, value & 0xFFFFFFFF)


def set_coil(name: str, val: int) -> None:
    context[SLAVE_ID].setValues(1, COILS[name], [1 if val else 0])

def get_coil(name: str) -> int:
    return context[SLAVE_ID].getValues(1, COILS[name], 1)[0]

def set_hr(name: str, val: int) -> None:
    context[SLAVE_ID].setValues(3, HREGS[name], [val & 0xFFFF])

def set_hr_u32(name_hi: str, name_lo: str, u32: int) -> None:
    u32 &= 0xFFFFFFFF
    context[SLAVE_ID].setValues(3, HREGS[name_hi], [(u32 >> 16) & 0xFFFF])
    context[SLAVE_ID].setValues(3, HREGS[name_lo], [ u32        & 0xFFFF])

# =========================
# Simulation Tasks (async)
# =========================
async def task_displacement_sensors(stop: asyncio.Event) -> None:
    """
    1) health: 기본 on, 매 1초마다 1→2→3→4→5→6 순서로 잠깐 off 후 on
    2) 값: 0.1초마다 2000~2200 사인파, 채널별 위상차
    """
    # 초기 health on
    for k in ("LV1_OK","LV2_OK","LV3_OK","LV4_OK","LV5_OK","LV6_OK"):
        set_coil(k, 1)

    phase = {
        "LV1":0.0, "LV2":math.pi/6, "LV3":math.pi/3,
        "LV4":math.pi/2, "LV5":2*math.pi/3, "LV6":5*math.pi/6
    }
    t = 0
    idx_off = 0
    names = ["LV1","LV2","LV3","LV4","LV5","LV6"]
    ok_names = ["LV1_OK","LV2_OK","LV3_OK","LV4_OK","LV5_OK","LV6_OK"]

    while not stop.is_set():
        # 사인파 값 업데이트(10 Hz)
        for n in names:
            v = 2100 + 50 * math.sin(2*math.pi*(t*0.1) + phase[n])  # 2000~2200
            set_hr(n, int(v))
        t += 1

        # # 1초마다 health 순차 off→on
        # if t % 10 == 0:
        #     k = idx_off % 6
        #     set_coil(ok_names[k], 0)
        #     await asyncio.sleep(0.2)  # 200ms 다운시간
        #     set_coil(ok_names[k], 1)
        #     idx_off += 1

        await asyncio.sleep(0.1)
# --- 교체: ENC1/ENC2 누적 펄스 태스크 ---
async def task_encoder12(stop: asyncio.Event) -> None:
    """
    ENC1/ENC2
    - 누적 카운터: 러닝 중 0.1초마다 +125(=초당 +1250)
    - health: 기본 on, 1초마다 ENC1→ENC2 교대로 200ms off 후 on
    """
    for k in ("ENC1_OK", "ENC2_OK"):
        set_coil(k, 1)

    enc1_cnt = 0
    enc2_cnt = 0
    tick = 0
    off_toggle = 0  # 짝수: ENC1, 홀수: ENC2

    while not stop.is_set():
        if _run_enabled():
            enc1_cnt = (enc1_cnt + 12) & 0xFFFFFFFF
            enc2_cnt = (enc2_cnt + 12) & 0xFFFFFFFF

        _set_u32_pair("ENC1_H", "ENC1_L", enc1_cnt)
        _set_u32_pair("ENC2_H", "ENC2_L", enc2_cnt)

        # # 1초마다 health 교대 off→on
        # if tick % 10 == 0:
        #     if off_toggle % 2 == 0:
        #         set_coil("ENC1_OK", 0); await asyncio.sleep(0.2); set_coil("ENC1_OK", 1)
        #     else:
        #         set_coil("ENC2_OK", 0); await asyncio.sleep(0.2); set_coil("ENC2_OK", 1)
        #     off_toggle += 1

        tick += 1
        await asyncio.sleep(0.01)

# --- 교체: ENC3 가변 펄스 태스크 ---
async def task_encoder3(stop: asyncio.Event) -> None:
    """
    ENC3
    - 누적 카운터: 러닝 중 0.1초마다 +Δ(t)
      Δ(t) = 200 + 100*sin(2π·t/1s) ∈ [100, 300]
    - health: 1초마다 토글
    """
    enc3_cnt = 0
    tick = 0  # 0.1s 단위 틱

    # 초기 health(on) 보장
    if get_coil("ENC3_OK") not in (0, 1):  # 미설정 시
        set_coil("ENC3_OK", 1)

    while not stop.is_set():
        # Δ(t): 1Hz 사인(0.1초 주기 샘플)
        delta = int(200 + 100 * math.sin(2 * math.pi * (tick * 0.1)))

        if _run_enabled():
            enc3_cnt = (max(0, delta)) & 0xFFFFFFFF  # 음수 방지(이론상 100~300라 필요X이지만 안전장치)

        _set_u32_pair("ENC3_H", "ENC3_L", enc3_cnt)

        # health 1초마다 토글
        # if tick % 10 == 0:
        #     set_coil("ENC3_OK", 0 if get_coil("ENC3_OK") else 1)

        tick += 1
        await asyncio.sleep(0.1)

# --- 참고: 평균값 태스크(필요 시) ---
async def task_encoder_mean(stop: asyncio.Event) -> None:
    """
    ENC_MEAN: 1초당 +1250 (사양 그대로; 러닝 여부와 무관)
    """
    mean = 0
    tick = 0
    while not stop.is_set():
        mean = (mean + 6) & 0xFFFFFFFF  # 0.1초 당 +125
        _set_u32_pair("ENC_MEAN_H", "ENC_MEAN_L", mean)
        tick += 1
        await asyncio.sleep(0.01)

async def task_gaps(stop: asyncio.Event) -> None:
    """
    단차:
    - index: 1초마다 +1
    - height: 1초마다 1~10 랜덤 (좌/우 각각)
    - position: 1250씩 증가
    """
    lidx = ridx = 0
    t = 0
    while not stop.is_set():
        if t % 10 == 0:
            lidx = (lidx + 1) & 0xFFFF
            ridx = (ridx + 1) & 0xFFFF
            set_hr("LGAP_IDX", lidx)
            set_hr("RGAP_IDX", ridx)
            set_hr("LGAP_STEPSIZE", random.randint(1, 10))
            set_hr("RGAP_STEPSIZE", random.randint(1, 10))
            set_hr("LGAP_STEP_POS_H", (lidx * 1250) >> 16)
            set_hr("LGAP_STEP_POS_L", (lidx * 1250) & 0xFFFF)
            set_hr("RGAP_STEP_POS_H", (ridx * 1250) >> 16)
            set_hr("RGAP_STEP_POS_L", (ridx * 1250) & 0xFFFF)
        t += 1
        await asyncio.sleep(0.1)

# =========================
# PyQt GUI
# =========================
class MainWindow(QtWidgets.QWidget):
    """
    - 제어: IS_RUNNING_SIGNAL, PLC_RUN/STOP/ERR, PB_START/PB_STOP (momentary)
    - 모니터: RESET_DEVICE, DEVICE_RDY, INIT_CURSOR_DONE, SW_START/STOP/RESET
    """
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Modbus Simulator Control Panel")
        self.setMinimumWidth(520)

        # Controls
        self.chk_is_run = QtWidgets.QCheckBox("IS_RUNNING_SIGNAL (M00003)")
        self.chk_plc_run = QtWidgets.QCheckBox("PLC_RUN (M00013)")
        self.chk_plc_stop = QtWidgets.QCheckBox("PLC_STOP (M00014)")
        self.chk_plc_err = QtWidgets.QCheckBox("PLC_ERR (M00015)")
        self.btn_pb_start = QtWidgets.QPushButton("PB_START (P00000) momentary")
        self.btn_pb_stop  = QtWidgets.QPushButton("PB_STOP  (P00001) momentary")

        # Monitor labels
        self.lbl_reset = QtWidgets.QLabel("RESET_DEVICE (M00000): ?")
        self.lbl_rdy   = QtWidgets.QLabel("DEVICE_RDY   (M00001): ?")
        self.lbl_init  = QtWidgets.QLabel("INIT_CURSOR_DONE (M00002): ?")
        self.lbl_sw_st = QtWidgets.QLabel("SW_START (M0001C): ?")
        self.lbl_sw_sp = QtWidgets.QLabel("SW_STOP  (M0001D): ?")
        self.lbl_sw_rs = QtWidgets.QLabel("SW_RESET (M0001E): ?")

        # Layout
        g = QtWidgets.QGridLayout(self)
        g.addWidget(QtWidgets.QLabel("■ Controls"), 0, 0, 1, 2)
        g.addWidget(self.chk_is_run, 1, 0, 1, 2)
        g.addWidget(self.chk_plc_run, 2, 0)
        g.addWidget(self.chk_plc_stop,2, 1)
        g.addWidget(self.chk_plc_err, 3, 0)
        g.addWidget(self.btn_pb_start,4, 0)
        g.addWidget(self.btn_pb_stop, 4, 1)

        row = 5
        g.addWidget(QtWidgets.QLabel("■ Monitors"), row, 0, 1, 2); row += 1
        for w in (self.lbl_reset, self.lbl_rdy, self.lbl_init,
                  self.lbl_sw_st, self.lbl_sw_sp, self.lbl_sw_rs):
            g.addWidget(w, row, 0, 1, 2); row += 1

        # Bind
        self.chk_is_run.toggled.connect(lambda v: set_coil("IS_RUNNING_SIGNAL", int(v)))
        self.chk_plc_run.toggled.connect(lambda v: set_coil("PLC_RUN",  int(v)))
        self.chk_plc_stop.toggled.connect(lambda v: set_coil("PLC_STOP", int(v)))
        self.chk_plc_err.toggled.connect(lambda v: set_coil("PLC_ERR",  int(v)))
        self.btn_pb_start.clicked.connect(self._pulse_pb_start)
        self.btn_pb_stop.clicked.connect(self._pulse_pb_stop)

        # Poll timer for monitor update
        self.timer = QtCore.QTimer(self)
        self.timer.setInterval(100)  # 10 Hz
        self.timer.timeout.connect(self.update_monitors)
        self.timer.start()

    @asyncSlot()
    async def _pulse(self, coil_name: str, ms: int = 150):
        set_coil(coil_name, 1)
        await asyncio.sleep(ms / 1000)
        set_coil(coil_name, 0)

    def _pulse_pb_start(self):
        asyncio.create_task(self._pulse("PB_START"))

    def _pulse_pb_stop(self):
        asyncio.create_task(self._pulse("PB_STOP"))

    def update_monitors(self):
        self.lbl_reset.setText(f"RESET_DEVICE (M00000): {get_coil('RESET_DEVICE')}")
        self.lbl_rdy.setText(  f"DEVICE_RDY   (M00001): {get_coil('DEVICE_RDY')}")
        self.lbl_init.setText( f"INIT_CURSOR_DONE (M00002): {get_coil('INIT_CURSOR_DONE')}")
        self.lbl_sw_st.setText(f"SW_START (M0001C): {get_coil('SW_START')}")
        self.lbl_sw_sp.setText(f"SW_STOP  (M0001D): {get_coil('SW_STOP')}")
        self.lbl_sw_rs.setText(f"SW_RESET (M0001E): {get_coil('SW_RESET')}")

# =========================
# Bootstrap
# =========================
async def run_server_and_sim() -> None:
    # 초기 상태: DEVICE_RDY=1 가정(필요시 조정)
    set_coil("DEVICE_RDY", 1)

    stop = asyncio.Event()
    # 시뮬 태스크
    tasks = [
        asyncio.create_task(task_displacement_sensors(stop)),
        asyncio.create_task(task_encoder12(stop)),
        asyncio.create_task(task_encoder3(stop)),
        asyncio.create_task(task_encoder_mean(stop)),
        asyncio.create_task(task_gaps(stop)),
    ]
    # Modbus 서버
    server = asyncio.create_task(StartAsyncTcpServer(
        context=context, identity=_build_identity(), address=("0.0.0.0", 5020)
    ))

    # PyQt 앱
    app = QtWidgets.QApplication([])
    win = MainWindow(); win.show()

    loop = QEventLoop(app)
    asyncio.set_event_loop(loop)
    try:
        async with loop:
            # GUI 이벤트 루프와 함께 대기
            await asyncio.gather(server, *tasks)
    finally:
        stop.set()
        for t in tasks:
            t.cancel()

def _build_identity():
    ident = ModbusDeviceIdentification()
    ident.VendorName = "wklabs"
    ident.ProductCode = "OSDL-MEA"
    ident.ProductName = "Modbus TCP Server"
    ident.ModelName = "OSDL-MEA-Modbus"
    ident.MajorMinorRevision = "3.0"
    return ident

async def _async_bootstrap(app: QtWidgets.QApplication):
    """서버/시뮬 태스크를 띄우고, 앱 종료 시 정리까지 담당."""
    stop = asyncio.Event()

    # 앱 종료되면 stop 세트
    app.aboutToQuit.connect(lambda: stop.set())

    # === 여기서 기존 run_server_and_sim() 안에서 하던 것들을 시작 ===
    # 예: 초기 상태
    # set_coil("DEVICE_RDY", 1)

    # 시뮬 태스크들
    sim_tasks = [
        asyncio.create_task(task_displacement_sensors(stop)),
        asyncio.create_task(task_encoder12(stop)),
        asyncio.create_task(task_encoder3(stop)),
        asyncio.create_task(task_encoder_mean(stop)),
        asyncio.create_task(task_gaps(stop)),
    ]

    # Modbus 서버 태스크
    server_task = asyncio.create_task(StartAsyncTcpServer(
        context=context, identity=_build_identity(), address=("0.0.0.0", 5020)
    ))

    # stop 신호까지 대기
    await stop.wait()

    # 종료 정리
    server_task.cancel()
    for t in sim_tasks:
        t.cancel()
    # 취소 전파 후, 잠깐 대기
    await asyncio.sleep(0)
def main():
    app = QtWidgets.QApplication([])
    win = MainWindow()
    win.show()

    loop = QEventLoop(app)
    asyncio.set_event_loop(loop)

    # with (동기) 컨텍스트 매니저 사용! (async with 금지)
    with loop:
        loop.run_until_complete(_async_bootstrap(app))

if __name__ == "__main__":
    main()