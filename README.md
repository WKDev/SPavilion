# hardware monitoring system 


# goals

# features

# scenario
 - PLC status watch / control with pc web browser
 - PLC status watch / control with mobile app

 



# configuration
- PC
    - H/W
        - usb: uvc webcam(get stream and feed with mediamtx webrtc)
        - usb: PLC(communicates with PLC. get current status, send commands)
    - S/W 
        - docker
            - mediamtx: webrtc server
            - postgres: database
            - nginx: reverse proxy
            - nestjs: 
                - react

- PLC(LS XBC-DN20E, NPN, TR, 24V)
    - INPUT
        - button1: heat-on
        - button2: fan-on
        - button3: btsp-on
        - button4: light-red-on
        - button5: light-green-on
        - button6: light-blue-on
        - button7: light-white-on
        - button8: display-on
     
    - OUTPUT
        - Relay01: heat control
        - Relay02: fan control
        - Relay03: light-red
        - Relay04: light-green
        - Relay05: light-blue
        - Relay06: light-white
        - Relay07: display

    - ADDRESS
        - COIL
            - 0x00: heat-status
            - 0x01: fan-status
            - 0x02: btsp-status
            - 0x03: light-red-status
            - 0x04: light-green-status
            - 0x05: light-blue-status
            - 0x06: light-white-status
            - 0x07: display-status
            <!-- reset each of timers  -->
            - 0x10: heat-set
            - 0x11: fan-set
            - 0x12: btsp-set
            - 0x13: light-red-set
            - 0x14: light-green-set
            - 0x15: light-blue-set
            - 0x16: light-white-set
            - 0x17: display-set

    - Communication        
        - modbus-rtu
            - baud rate: 9600
            - data bits: 8
            - stop bits: 1
            - parity: none
            - flow control: none
            - hardware handshake: none
            - software handshake: none
            - timeout: 1000ms

    - Timer
        - heat-timer: 10minutes
        - fan-timer: 10minutes
        - btsp-timer: 1 hour
        - light-red-timer: 1 hour
        - light-green-timer: 1 hour
        - light-blue-timer: 1 hour
        - light-white-timer: 1 hour
        - display-timer: 1 hour


    - logic (each of devices should be controlled by button or plc)
        - heat, fan : controlled by 10minutes timer
            - if button or plc address triggered -> start timer
            - if button or plc address triggered again -> stop timer
            - while timer is running -> turn on heat


        - btsp, light-red, light-green, light-blue, light-white: controlled by 1 hour timer
            - if button or plc address triggered -> start timer
            - if button or plc address triggered again -> stop timer
            - while timer is running -> turn on fan

        - display: controlled by manual
            - while address triggered -> turn on display 
            - while address triggered again -> turn off display 



    





