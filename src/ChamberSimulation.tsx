import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export type PackageType =
  | 'QFP'
  | 'SOIC'
  | 'MODULE'
  | 'USB'
  | 'REGULATOR'
  | 'CAPACITOR'
  | 'HEADER'
  | 'LED'
  | 'SENSOR';

export type ViewMode = 'physical' | 'xray' | 'thermal' | 'exploded';

export interface ComponentSpec {
  id: string;
  designator: string;
  name: string;
  category: string;
  packageType: PackageType;
  position: [number, number];
  size: [number, number, number];
  pins: number;
  nominalVoltage: number;
  baseCurrentMa: number;
  thermalResistance: number;
  description: string;
  waypoints: Array<{
    x: number;
    z: number;
    action: 'SOLDER' | 'INSPECT' | 'PROBE';
    dwellMs: number;
  }>;
}

export interface TraceSpec {
  id: string;
  netName: string;
  points: Array<[number, number]>;
  width: number;
  isPower: boolean;
}

export interface BoardSpec {
  id: string;
  name: string;
  revision: string;
  architecture: string;
  category:
    | 'Microcontroller'
    | 'Wireless IoT'
    | 'Industrial Control'
    | 'Power Systems'
    | 'Avionics';
  dimensions: [number, number];
  layers: number;
  substrateColor: number;
  substrateHex: string;
  silkscreenColor: string;
  nominalVcc: number;
  maxVcc: number;
  clockMhz: number;
  stars: number;
  remixes: number;
  summary: string;
  components: ComponentSpec[];
  traces: TraceSpec[];
}

export interface SimulationParams {
  running: boolean;
  supplyVoltage: number;
  clockScale: number;
  loadPercent: number;
  ambientTemp: number;
  viewMode: ViewMode;
  showToolpath: boolean;
  activeWaypointIndex: number;
}

export const HARDWARE_BOARDS: BoardSpec[] = [
  {
    id: 'uno-r4-wifi',
    name: 'Arduino Uno R4 WiFi',
    revision: 'REV 1.2',
    architecture: 'ARM Cortex-M4 + XTensa LX7',
    category: 'Microcontroller',
    dimensions: [8.8, 6.0],
    layers: 4,
    substrateColor: 0x0f4c5c,
    substrateHex: '#0f4c5c',
    silkscreenColor: '#f8fafc',
    nominalVcc: 5.0,
    maxVcc: 5.5,
    clockMhz: 48,
    stars: 1420,
    remixes: 318,
    summary:
      'Renesas RA4M1 32-bit Cortex-M4 MCU paired with ESP32-S3-MINI Wi-Fi/BLE coprocessor, 12x8 red LED matrix, and Qwiic I2C bus.',
    components: [
      {
        id: 'u1-ra4m1',
        designator: 'U1',
        name: 'Renesas R7FA4M1AB3CFM',
        category: 'Microcontroller',
        packageType: 'QFP',
        position: [-0.2, -0.15],
        size: [1.35, 0.22, 1.35],
        pins: 64,
        nominalVoltage: 5.0,
        baseCurrentMa: 52,
        thermalResistance: 0.22,
        description: '48MHz Arm Cortex-M4 MCU with 256KB Flash, 32KB SRAM, 12-bit DAC, and CAN bus.',
        waypoints: [{ x: -0.2, z: -0.15, action: 'SOLDER', dwellMs: 480 }]
      },
      {
        id: 'u2-esp32',
        designator: 'M1',
        name: 'ESP32-S3-MINI-1-N8',
        category: 'Wireless Module',
        packageType: 'MODULE',
        position: [2.4, 0.35],
        size: [1.5, 0.3, 1.95],
        pins: 42,
        nominalVoltage: 3.3,
        baseCurrentMa: 135,
        thermalResistance: 0.31,
        description: 'Dual-core 2.4GHz Wi-Fi and Bluetooth LE 5.0 radio coprocessor.',
        waypoints: [{ x: 2.4, z: 0.35, action: 'SOLDER', dwellMs: 550 }]
      },
      {
        id: 'u3-buck',
        designator: 'U3',
        name: 'ISL854102FRZ Wide-VIN Buck',
        category: 'Power Management',
        packageType: 'REGULATOR',
        position: [-2.4, 1.35],
        size: [0.85, 0.24, 0.7],
        pins: 8,
        nominalVoltage: 5.0,
        baseCurrentMa: 45,
        thermalResistance: 0.29,
        description: 'Synchronous buck regulator stepping 6-24V VIN down to regulated 5V rail.',
        waypoints: [{ x: -2.4, z: 1.35, action: 'INSPECT', dwellMs: 280 }]
      },
      {
        id: 'j1-usbc',
        designator: 'J1',
        name: 'USB-C Programming Port',
        category: 'Connector',
        packageType: 'USB',
        position: [-3.95, -0.75],
        size: [0.95, 0.34, 1.1],
        pins: 16,
        nominalVoltage: 5.0,
        baseCurrentMa: 12,
        thermalResistance: 0.05,
        description: 'USB 2.0 Full-Speed DFU and HID serial interface.',
        waypoints: [{ x: -3.8, z: -0.75, action: 'SOLDER', dwellMs: 490 }]
      },
      {
        id: 'j2-dio',
        designator: 'J2',
        name: 'Digital PWM Header (D0-D13)',
        category: 'Connector',
        packageType: 'HEADER',
        position: [0.2, -2.45],
        size: [4.6, 0.4, 0.42],
        pins: 14,
        nominalVoltage: 5.0,
        baseCurrentMa: 18,
        thermalResistance: 0.04,
        description: 'Standard Arduino shield-compatible 2.54mm female header bank.',
        waypoints: [{ x: 0.2, z: -2.45, action: 'PROBE', dwellMs: 360 }]
      },
      {
        id: 'j3-aio',
        designator: 'J3',
        name: 'Power & Analog Header (A0-A5)',
        category: 'Connector',
        packageType: 'HEADER',
        position: [0.2, 2.45],
        size: [4.2, 0.4, 0.42],
        pins: 12,
        nominalVoltage: 5.0,
        baseCurrentMa: 14,
        thermalResistance: 0.04,
        description: '14-bit ADC input bank and reference voltage rail pins.',
        waypoints: [{ x: 0.2, z: 2.45, action: 'PROBE', dwellMs: 340 }]
      },
      {
        id: 'd1-matrix',
        designator: 'LED1',
        name: '12x8 Charlieplexed LED Matrix',
        category: 'Indicator',
        packageType: 'LED',
        position: [-2.1, -0.4],
        size: [1.1, 0.14, 0.8],
        pins: 12,
        nominalVoltage: 5.0,
        baseCurrentMa: 42,
        thermalResistance: 0.14,
        description: '96-node red SMD LED matrix driven directly by RA4M1 GPIO pins.',
        waypoints: [{ x: -2.1, z: -0.4, action: 'INSPECT', dwellMs: 260 }]
      }
    ],
    traces: [
      { id: 'u-t1', netName: 'VBUS_5V', points: [[-3.95, -0.75], [-2.4, 1.35], [-0.2, -0.15]], width: 0.09, isPower: true },
      { id: 'u-t2', netName: 'UART_ESP_BRIDGE', points: [[-0.2, -0.15], [1.1, 0.35], [2.4, 0.35]], width: 0.05, isPower: false },
      { id: 'u-t3', netName: 'PORT_DIO_BUS', points: [[-0.2, -0.15], [0.2, -2.45]], width: 0.05, isPower: false },
      { id: 'u-t4', netName: 'PORT_ADC_BUS', points: [[-0.2, -0.15], [0.2, 2.45]], width: 0.05, isPower: false },
      { id: 'u-t5', netName: 'MTX_SCAN', points: [[-0.2, -0.15], [-2.1, -0.4]], width: 0.045, isPower: false }
    ]
  },
  {
    id: 'esp32-devkit-v4',
    name: 'ESP32-WROOM-32D DevKit V4',
    revision: 'REV 4.0',
    architecture: 'Dual-Core Tensilica LX6',
    category: 'Wireless IoT',
    dimensions: [7.6, 4.4],
    layers: 2,
    substrateColor: 0x18181b,
    substrateHex: '#18181b',
    silkscreenColor: '#e4e4e7',
    nominalVcc: 3.3,
    maxVcc: 3.6,
    clockMhz: 240,
    stars: 1890,
    remixes: 540,
    summary:
      'Industry-standard Wi-Fi + Bluetooth LE IoT evaluation board with CP2102N USB-UART bridge, auto-reset transistors, and 38-pin breakout headers.',
    components: [
      {
        id: 'esp-mod',
        designator: 'U1',
        name: 'ESP32-WROOM-32D RF Module',
        category: 'Wireless Module',
        packageType: 'MODULE',
        position: [1.65, 0.0],
        size: [1.8, 0.32, 2.1],
        pins: 38,
        nominalVoltage: 3.3,
        baseCurrentMa: 165,
        thermalResistance: 0.34,
        description: '240MHz dual-core SoC with integrated PCB trace antenna and 4MB SPI Flash.',
        waypoints: [{ x: 1.65, z: 0.0, action: 'SOLDER', dwellMs: 600 }]
      },
      {
        id: 'cp2102',
        designator: 'U2',
        name: 'Silicon Labs CP2102N QFN28',
        category: 'Interface IC',
        packageType: 'QFP',
        position: [-1.45, -0.35],
        size: [0.85, 0.18, 0.85],
        pins: 28,
        nominalVoltage: 3.3,
        baseCurrentMa: 24,
        thermalResistance: 0.19,
        description: 'USB-to-UART bridge with hardware auto-reset DTR/RTS transistor logic.',
        waypoints: [{ x: -1.45, z: -0.35, action: 'SOLDER', dwellMs: 410 }]
      },
      {
        id: 'ldo-3v3',
        designator: 'U3',
        name: 'AMS1117-3.3 High-Current LDO',
        category: 'Power Management',
        packageType: 'REGULATOR',
        position: [-1.5, 0.85],
        size: [0.8, 0.22, 0.65],
        pins: 3,
        nominalVoltage: 3.3,
        baseCurrentMa: 80,
        thermalResistance: 0.38,
        description: '800mA low-dropout linear voltage regulator with thermal overload protection.',
        waypoints: [{ x: -1.5, z: 0.85, action: 'INSPECT', dwellMs: 290 }]
      },
      {
        id: 'usb-port',
        designator: 'J1',
        name: 'Micro-USB / Type-C Power Port',
        category: 'Connector',
        packageType: 'USB',
        position: [-3.35, 0.0],
        size: [0.85, 0.3, 1.0],
        pins: 5,
        nominalVoltage: 5.0,
        baseCurrentMa: 10,
        thermalResistance: 0.05,
        description: 'Primary 5V power input and serial UART programming port.',
        waypoints: [{ x: -3.2, z: 0.0, action: 'SOLDER', dwellMs: 450 }]
      },
      {
        id: 'hdr-top',
        designator: 'J2',
        name: '19-Pin Left Expansion Bank',
        category: 'Connector',
        packageType: 'HEADER',
        position: [-0.2, -1.75],
        size: [5.2, 0.36, 0.38],
        pins: 19,
        nominalVoltage: 3.3,
        baseCurrentMa: 15,
        thermalResistance: 0.03,
        description: 'Breaks out ADC1, DAC, touch sensors, and SPI bus pins.',
        waypoints: [{ x: -0.2, z: -1.75, action: 'PROBE', dwellMs: 320 }]
      },
      {
        id: 'hdr-bot',
        designator: 'J3',
        name: '19-Pin Right Expansion Bank',
        category: 'Connector',
        packageType: 'HEADER',
        position: [-0.2, 1.75],
        size: [5.2, 0.36, 0.38],
        pins: 19,
        nominalVoltage: 3.3,
        baseCurrentMa: 15,
        thermalResistance: 0.03,
        description: 'Breaks out UART0/2, I2C, PWM channels, and 3V3/GND rails.',
        waypoints: [{ x: -0.2, z: 1.75, action: 'PROBE', dwellMs: 320 }]
      }
    ],
    traces: [
      { id: 'e-t1', netName: 'VDD_3V3', points: [[-3.35, 0], [-1.5, 0.85], [1.65, 0.0]], width: 0.085, isPower: true },
      { id: 'e-t2', netName: 'UART0_TX_RX', points: [[-3.35, 0], [-1.45, -0.35], [1.65, 0.0]], width: 0.05, isPower: false },
      { id: 'e-t3', netName: 'GPIO_BANK_A', points: [[1.65, 0.0], [-0.2, -1.75]], width: 0.045, isPower: false },
      { id: 'e-t4', netName: 'GPIO_BANK_B', points: [[1.65, 0.0], [-0.2, 1.75]], width: 0.045, isPower: false }
    ]
  },
  {
    id: 'rpi-pico-rp2040',
    name: 'Raspberry Pi Pico RP2040',
    revision: 'REV 1.4',
    architecture: 'Dual ARM Cortex-M0+',
    category: 'Microcontroller',
    dimensions: [7.8, 3.6],
    layers: 2,
    substrateColor: 0x155e3b,
    substrateHex: '#155e3b',
    silkscreenColor: '#f8fafc',
    nominalVcc: 3.3,
    maxVcc: 3.6,
    clockMhz: 133,
    stars: 1640,
    remixes: 412,
    summary:
      'Dual-core ARM Cortex-M0+ microcontroller board with programmable I/O (PIO) state machines, 2MB QSPI Flash, and RT6150 buck-boost SMPS.',
    components: [
      {
        id: 'rp2040-ic',
        designator: 'U1',
        name: 'Raspberry Pi RP2040 QFN56',
        category: 'Microcontroller',
        packageType: 'QFP',
        position: [0.1, 0.0],
        size: [1.1, 0.2, 1.1],
        pins: 56,
        nominalVoltage: 3.3,
        baseCurrentMa: 44,
        thermalResistance: 0.18,
        description: '133MHz dual Cortex-M0+ with 264KB multi-bank SRAM and 8 PIO state machines.',
        waypoints: [{ x: 0.1, z: 0.0, action: 'SOLDER', dwellMs: 460 }]
      },
      {
        id: 'w25q16-flash',
        designator: 'U2',
        name: 'Winbond W25Q16JVUXIQ 2MB QSPI',
        category: 'Memory',
        packageType: 'SOIC',
        position: [-1.45, -0.45],
        size: [0.65, 0.16, 0.55],
        pins: 8,
        nominalVoltage: 3.3,
        baseCurrentMa: 15,
        thermalResistance: 0.12,
        description: '133MHz Quad-SPI NOR Flash memory for execute-in-place (XIP) firmware.',
        waypoints: [{ x: -1.45, z: -0.45, action: 'SOLDER', dwellMs: 350 }]
      },
      {
        id: 'rt6150-smps',
        designator: 'U3',
        name: 'Richtek RT6150B Buck-Boost',
        category: 'Power Management',
        packageType: 'REGULATOR',
        position: [-1.6, 0.65],
        size: [0.7, 0.22, 0.55],
        pins: 6,
        nominalVoltage: 3.3,
        baseCurrentMa: 38,
        thermalResistance: 0.26,
        description: '1.8V to 5.5V input synchronous buck-boost DC-DC converter.',
        waypoints: [{ x: -1.6, z: 0.65, action: 'INSPECT', dwellMs: 280 }]
      },
      {
        id: 'pico-usb',
        designator: 'J1',
        name: 'USB 1.1 Host/Device Port',
        category: 'Connector',
        packageType: 'USB',
        position: [-3.45, 0.0],
        size: [0.8, 0.28, 0.95],
        pins: 5,
        nominalVoltage: 5.0,
        baseCurrentMa: 10,
        thermalResistance: 0.05,
        description: 'UF2 mass-storage bootloader and USB CDC serial interface.',
        waypoints: [{ x: -3.35, z: 0.0, action: 'SOLDER', dwellMs: 420 }]
      },
      {
        id: 'pico-hdr-n',
        designator: 'J2',
        name: '20-Pin Castellated GPIO Bank A',
        category: 'Connector',
        packageType: 'HEADER',
        position: [0.1, -1.45],
        size: [5.8, 0.32, 0.32],
        pins: 20,
        nominalVoltage: 3.3,
        baseCurrentMa: 12,
        thermalResistance: 0.03,
        description: 'GP0-GP15 digital I/O, UART, I2C, and SPI pins.',
        waypoints: [{ x: 0.1, z: -1.45, action: 'PROBE', dwellMs: 300 }]
      },
      {
        id: 'pico-hdr-s',
        designator: 'J3',
        name: '20-Pin Castellated GPIO Bank B',
        category: 'Connector',
        packageType: 'HEADER',
        position: [0.1, 1.45],
        size: [5.8, 0.32, 0.32],
        pins: 20,
        nominalVoltage: 3.3,
        baseCurrentMa: 12,
        thermalResistance: 0.03,
        description: 'GP16-GP28, 3x 12-bit SAR ADC inputs, VBUS, VSYS, and 3V3_OUT.',
        waypoints: [{ x: 0.1, z: 1.45, action: 'PROBE', dwellMs: 300 }]
      }
    ],
    traces: [
      { id: 'p-t1', netName: 'VSYS_3V3', points: [[-3.45, 0], [-1.6, 0.65], [0.1, 0]], width: 0.08, isPower: true },
      { id: 'p-t2', netName: 'QSPI_XIP', points: [[-1.45, -0.45], [0.1, 0]], width: 0.05, isPower: false },
      { id: 'p-t3', netName: 'PIO_BUS_0', points: [[0.1, 0], [0.1, -1.45]], width: 0.045, isPower: false },
      { id: 'p-t4', netName: 'ADC_VREF', points: [[0.1, 0], [0.1, 1.45]], width: 0.045, isPower: false }
    ]
  },
  {
    id: 'reflowlab-ctrl-v2',
    name: 'ReflowLab Thermal Chamber PCB',
    revision: 'REV 2.4B',
    architecture: 'STM32F405 + Dual SSR PID',
    category: 'Industrial Control',
    dimensions: [8.4, 5.6],
    layers: 4,
    substrateColor: 0x133829,
    substrateHex: '#133829',
    silkscreenColor: '#e2e8f0',
    nominalVcc: 5.0,
    maxVcc: 6.0,
    clockMhz: 168,
    stars: 980,
    remixes: 194,
    summary:
      'Closed-loop PID micro-soldering & reflow controller with dual SSR power MOSFET stages, MAX31855 thermocouple ADC, and robotic sync bus.',
    components: [
      {
        id: 'u1-mcu',
        designator: 'U1',
        name: 'STM32F405RGT6 Core',
        category: 'Microcontroller',
        packageType: 'QFP',
        position: [-0.4, 0.1],
        size: [1.3, 0.22, 1.3],
        pins: 64,
        nominalVoltage: 3.3,
        baseCurrentMa: 85,
        thermalResistance: 0.28,
        description: '32-bit ARM Cortex-M4 MCU running real-time PID thermal profiling and robotic kinematics sync.',
        waypoints: [
          { x: -1.05, z: -0.45, action: 'SOLDER', dwellMs: 420 },
          { x: 0.25, z: 0.75, action: 'INSPECT', dwellMs: 250 }
        ]
      },
      {
        id: 'u2-tc',
        designator: 'U2',
        name: 'MAX31855 Cold-Junction ADC',
        category: 'Sensor Frontend',
        packageType: 'SOIC',
        position: [1.8, -0.9],
        size: [0.75, 0.18, 0.55],
        pins: 8,
        nominalVoltage: 3.3,
        baseCurrentMa: 12,
        thermalResistance: 0.15,
        description: '14-bit K-type thermocouple-to-digital converter over SPI bus.',
        waypoints: [{ x: 1.8, z: -0.9, action: 'SOLDER', dwellMs: 380 }]
      },
      {
        id: 'q1-ssr',
        designator: 'Q1',
        name: 'IRFZ44N Heater MOSFET',
        category: 'Power Stage',
        packageType: 'REGULATOR',
        position: [2.4, 1.1],
        size: [0.95, 0.26, 0.85],
        pins: 3,
        nominalVoltage: 5.0,
        baseCurrentMa: 210,
        thermalResistance: 0.42,
        description: 'High-current PWM switching stage driving infrared quartz reflow elements.',
        waypoints: [{ x: 2.4, z: 1.1, action: 'SOLDER', dwellMs: 650 }]
      },
      {
        id: 'u3-ldo',
        designator: 'U3',
        name: 'AMS1117-3.3 LDO Regulator',
        category: 'Power Management',
        packageType: 'REGULATOR',
        position: [-2.3, 1.2],
        size: [0.75, 0.22, 0.6],
        pins: 3,
        nominalVoltage: 5.0,
        baseCurrentMa: 65,
        thermalResistance: 0.35,
        description: 'Low-dropout linear regulator stepping 5V USB/rail down to 3.3V logic.',
        waypoints: [{ x: -2.3, z: 1.2, action: 'INSPECT', dwellMs: 300 }]
      },
      {
        id: 'j1-usb',
        designator: 'J1',
        name: 'USB-C Host Interface',
        category: 'Connector',
        packageType: 'USB',
        position: [-3.75, 0.0],
        size: [0.9, 0.32, 1.1],
        pins: 16,
        nominalVoltage: 5.0,
        baseCurrentMa: 15,
        thermalResistance: 0.05,
        description: 'High-retention SMD USB Type-C connector with CC1/CC2 5.1k pulldowns.',
        waypoints: [{ x: -3.5, z: 0.0, action: 'SOLDER', dwellMs: 520 }]
      },
      {
        id: 'c1-bulk',
        designator: 'C1',
        name: '470uF 16V Low-ESR Electrolytic',
        category: 'Passive',
        packageType: 'CAPACITOR',
        position: [-1.9, -1.2],
        size: [0.65, 0.55, 0.65],
        pins: 2,
        nominalVoltage: 5.0,
        baseCurrentMa: 4,
        thermalResistance: 0.06,
        description: 'Primary input rail decoupling capacitor.',
        waypoints: [{ x: -1.9, z: -1.2, action: 'INSPECT', dwellMs: 200 }]
      },
      {
        id: 'j2-gpio',
        designator: 'J2',
        name: '16-Pin Actuator & Telemetry Header',
        category: 'Connector',
        packageType: 'HEADER',
        position: [0.4, -2.15],
        size: [3.2, 0.38, 0.45],
        pins: 16,
        nominalVoltage: 3.3,
        baseCurrentMa: 20,
        thermalResistance: 0.04,
        description: '2.54mm pitch header for stepper drivers and chamber pyrometer I/O.',
        waypoints: [{ x: 0.4, z: -2.15, action: 'PROBE', dwellMs: 310 }]
      },
      {
        id: 'd1-stat',
        designator: 'D1',
        name: 'Status & Reflow Lock LED',
        category: 'Indicator',
        packageType: 'LED',
        position: [-2.8, -1.5],
        size: [0.45, 0.14, 0.3],
        pins: 2,
        nominalVoltage: 3.3,
        baseCurrentMa: 18,
        thermalResistance: 0.08,
        description: 'High-efficiency SMD 0805 diagnostic status indicator.',
        waypoints: [{ x: -2.8, z: -1.5, action: 'INSPECT', dwellMs: 180 }]
      }
    ],
    traces: [
      { id: 't1', netName: 'VCC_5V0', points: [[-3.75, 0], [-2.3, 1.2], [2.4, 1.1]], width: 0.09, isPower: true },
      { id: 't2', netName: 'VDD_3V3', points: [[-2.3, 1.2], [-0.4, 0.1], [1.8, -0.9]], width: 0.07, isPower: true },
      { id: 't3', netName: 'SPI1_MISO', points: [[-0.4, 0.1], [0.8, 0.1], [1.8, -0.9]], width: 0.045, isPower: false },
      { id: 't4', netName: 'PWM_SSR_A', points: [[-0.4, 0.1], [1.1, 1.1], [2.4, 1.1]], width: 0.055, isPower: false },
      { id: 't5', netName: 'GPIO_BUS', points: [[-0.4, 0.1], [-0.4, -1.4], [0.4, -2.15]], width: 0.045, isPower: false },
      { id: 't6', netName: 'SYS_STAT', points: [[-0.4, 0.1], [-1.9, -1.2], [-2.8, -1.5]], width: 0.04, isPower: false }
    ]
  },
  {
    id: 'stm32-blackpill-f411',
    name: 'STM32F411CEU6 BlackPill V3.1',
    revision: 'REV 3.1',
    architecture: 'ARM Cortex-M4F 100MHz',
    category: 'Microcontroller',
    dimensions: [7.4, 3.8],
    layers: 4,
    substrateColor: 0x171923,
    substrateHex: '#171923',
    silkscreenColor: '#f1f5f9',
    nominalVcc: 3.3,
    maxVcc: 3.6,
    clockMhz: 100,
    stars: 1120,
    remixes: 275,
    summary:
      'Compact matte-black STM32F411CEU6 development board with hardware floating-point unit, 512KB Flash, SOIC-8 SPI Flash footprint, and USB-C.',
    components: [
      {
        id: 'f411-mcu',
        designator: 'U1',
        name: 'STM32F411CEU6 UFQFPN48',
        category: 'Microcontroller',
        packageType: 'QFP',
        position: [0.15, 0.0],
        size: [1.05, 0.2, 1.05],
        pins: 48,
        nominalVoltage: 3.3,
        baseCurrentMa: 38,
        thermalResistance: 0.21,
        description: '100MHz Cortex-M4 MCU with DSP instructions, 512KB Flash, and 128KB SRAM.',
        waypoints: [{ x: 0.15, z: 0.0, action: 'SOLDER', dwellMs: 430 }]
      },
      {
        id: 'spi-flash',
        designator: 'U2',
        name: 'W25Q64JVSSIQ 8MB SPI Flash',
        category: 'Memory',
        packageType: 'SOIC',
        position: [1.75, 0.0],
        size: [0.75, 0.18, 0.65],
        pins: 8,
        nominalVoltage: 3.3,
        baseCurrentMa: 16,
        thermalResistance: 0.14,
        description: 'Onboard non-volatile data logging and RTOS filesystem flash chip.',
        waypoints: [{ x: 1.75, z: 0.0, action: 'SOLDER', dwellMs: 360 }]
      },
      {
        id: 'ap2112k',
        designator: 'U3',
        name: 'AP2112K-3.3 CMOS LDO',
        category: 'Power Management',
        packageType: 'REGULATOR',
        position: [-1.55, 0.6],
        size: [0.65, 0.2, 0.5],
        pins: 5,
        nominalVoltage: 3.3,
        baseCurrentMa: 32,
        thermalResistance: 0.28,
        description: '600mA low-noise LDO voltage regulator with enable pin.',
        waypoints: [{ x: -1.55, z: 0.6, action: 'INSPECT', dwellMs: 250 }]
      },
      {
        id: 'bp-usbc',
        designator: 'J1',
        name: 'USB Type-C OTG Connector',
        category: 'Connector',
        packageType: 'USB',
        position: [-3.25, 0.0],
        size: [0.85, 0.3, 1.0],
        pins: 16,
        nominalVoltage: 5.0,
        baseCurrentMa: 10,
        thermalResistance: 0.05,
        description: 'Native STM32 ROM DFU bootloader interface.',
        waypoints: [{ x: -3.15, z: 0.0, action: 'SOLDER', dwellMs: 460 }]
      },
      {
        id: 'bp-hdr-1',
        designator: 'J2',
        name: '20-Pin Port A/B Header North',
        category: 'Connector',
        packageType: 'HEADER',
        position: [0.0, -1.5],
        size: [5.4, 0.34, 0.34],
        pins: 20,
        nominalVoltage: 3.3,
        baseCurrentMa: 14,
        thermalResistance: 0.03,
        description: '5V-tolerant GPIO pins, I2C1, and TIM1 PWM outputs.',
        waypoints: [{ x: 0.0, z: -1.5, action: 'PROBE', dwellMs: 290 }]
      },
      {
        id: 'bp-hdr-2',
        designator: 'J3',
        name: '20-Pin Port A/B Header South',
        category: 'Connector',
        packageType: 'HEADER',
        position: [0.0, 1.5],
        size: [5.4, 0.34, 0.34],
        pins: 20,
        nominalVoltage: 3.3,
        baseCurrentMa: 14,
        thermalResistance: 0.03,
        description: 'SPI1, USART1/2, ADC1 inputs, and SWD debug bus.',
        waypoints: [{ x: 0.0, z: 1.5, action: 'PROBE', dwellMs: 290 }]
      }
    ],
    traces: [
      { id: 'b-t1', netName: 'VCC_3V3', points: [[-3.25, 0], [-1.55, 0.6], [0.15, 0], [1.75, 0]], width: 0.08, isPower: true },
      { id: 'b-t2', netName: 'USB_DP_DM', points: [[-3.25, 0], [0.15, 0]], width: 0.05, isPower: false },
      { id: 'b-t3', netName: 'GPIO_NORTH', points: [[0.15, 0], [0.0, -1.5]], width: 0.045, isPower: false },
      { id: 'b-t4', netName: 'GPIO_SOUTH', points: [[0.15, 0], [0.0, 1.5]], width: 0.045, isPower: false }
    ]
  },
  {
    id: 'helios-f7-fc',
    name: 'Helios F722 UAV Flight Controller',
    revision: 'REV 3.1',
    architecture: 'STM32F722 + Dual ICM-42688',
    category: 'Avionics',
    dimensions: [6.4, 6.4],
    layers: 6,
    substrateColor: 0x1e1b4b,
    substrateHex: '#1e1b4b',
    silkscreenColor: '#f1f5f9',
    nominalVcc: 5.0,
    maxVcc: 5.5,
    clockMhz: 216,
    stars: 845,
    remixes: 162,
    summary:
      'High-density 6-layer drone flight controller with STM32F722RET6, dual ICM-42688-P 6-axis IMUs, BMP388 barometer, and 8-motor DShot600 output.',
    components: [
      {
        id: 'f7-mcu',
        designator: 'U1',
        name: 'STM32F722RET6 216MHz',
        category: 'Microcontroller',
        packageType: 'QFP',
        position: [0.0, 0.0],
        size: [1.4, 0.22, 1.4],
        pins: 64,
        nominalVoltage: 3.3,
        baseCurrentMa: 115,
        thermalResistance: 0.29,
        description: 'Superscalar ARM Cortex-M7 processor running 8kHz gyro PID loop and blackbox logging.',
        waypoints: [{ x: 0.0, z: 0.0, action: 'SOLDER', dwellMs: 510 }]
      },
      {
        id: 'imu-1',
        designator: 'U2',
        name: 'TDK ICM-42688-P 6-Axis MEMS',
        category: 'Sensor',
        packageType: 'SENSOR',
        position: [-1.5, -1.2],
        size: [0.65, 0.16, 0.65],
        pins: 14,
        nominalVoltage: 3.3,
        baseCurrentMa: 8,
        thermalResistance: 0.1,
        description: 'Ultra-low-noise 6-axis gyroscope and accelerometer with dedicated low-noise LDO.',
        waypoints: [{ x: -1.5, z: -1.2, action: 'INSPECT', dwellMs: 340 }]
      },
      {
        id: 'osd-ic',
        designator: 'U3',
        name: 'AT7456E Analog OSD Chip',
        category: 'Video Processor',
        packageType: 'SOIC',
        position: [1.65, -0.8],
        size: [0.85, 0.2, 1.25],
        pins: 28,
        nominalVoltage: 5.0,
        baseCurrentMa: 48,
        thermalResistance: 0.27,
        description: 'Monochrome on-screen display generator overlaying telemetry onto camera feed.',
        waypoints: [{ x: 1.65, z: -0.8, action: 'SOLDER', dwellMs: 440 }]
      },
      {
        id: 'bec-9v',
        designator: 'U4',
        name: 'MP9943 Synchronous Buck BEC',
        category: 'Power Management',
        packageType: 'REGULATOR',
        position: [-1.4, 1.55],
        size: [0.85, 0.24, 0.75],
        pins: 8,
        nominalVoltage: 5.0,
        baseCurrentMa: 92,
        thermalResistance: 0.36,
        description: 'High-efficiency step-down converter providing filtered 5V/3A and 9V/2A rails.',
        waypoints: [{ x: -1.4, z: 1.55, action: 'SOLDER', dwellMs: 490 }]
      },
      {
        id: 'esc-hdr',
        designator: 'J1',
        name: '8-Pin 4-in-1 ESC Telemetry Socket',
        category: 'Connector',
        packageType: 'HEADER',
        position: [1.1, 2.2],
        size: [2.1, 0.32, 0.5],
        pins: 8,
        nominalVoltage: 5.0,
        baseCurrentMa: 25,
        thermalResistance: 0.05,
        description: 'JST-SH 1.0mm pitch harness for bidirectional DShot600 motor signals and current sense.',
        waypoints: [{ x: 1.1, z: 2.2, action: 'PROBE', dwellMs: 300 }]
      }
    ],
    traces: [
      { id: 'f-t1', netName: 'VBAT_BEC_5V', points: [[-1.4, 1.55], [0.0, 0.0], [1.65, -0.8]], width: 0.085, isPower: true },
      { id: 'f-t2', netName: 'SPI1_GYRO', points: [[0.0, 0.0], [-1.5, -1.2]], width: 0.05, isPower: false },
      { id: 'f-t3', netName: 'DSHOT_M1_M4', points: [[0.0, 0.0], [1.1, 2.2]], width: 0.06, isPower: false }
    ]
  },
  {
    id: 'smartbms-4s-40a',
    name: 'SmartBMS 4S 40A Li-Ion Pack',
    revision: 'REV 2.0',
    architecture: 'TI BQ76920 + Dual N-MOSFET',
    category: 'Power Systems',
    dimensions: [8.6, 5.2],
    layers: 4,
    substrateColor: 0x451a1c,
    substrateHex: '#451a1c',
    silkscreenColor: '#fef2f2',
    nominalVcc: 5.0,
    maxVcc: 5.8,
    clockMhz: 32,
    stars: 730,
    remixes: 128,
    summary:
      '2oz copper 4-series lithium battery management system with TI BQ76920 analog front-end, passive cell balancing, and 1mOhm current shunt.',
    components: [
      {
        id: 'bq-afe',
        designator: 'U1',
        name: 'TI BQ7692003PWR 4S AFE',
        category: 'Battery Management',
        packageType: 'SOIC',
        position: [-0.8, 0.1],
        size: [0.95, 0.2, 1.15],
        pins: 20,
        nominalVoltage: 3.3,
        baseCurrentMa: 28,
        thermalResistance: 0.21,
        description: '3-to-5 series cell protection analog front-end with 16-bit coulomb counter ADC.',
        waypoints: [{ x: -0.8, z: 0.1, action: 'SOLDER', dwellMs: 460 }]
      },
      {
        id: 'mosfet-chg',
        designator: 'Q1',
        name: 'CSD18532KCS Charge MOSFET',
        category: 'Power Stage',
        packageType: 'REGULATOR',
        position: [1.8, -0.95],
        size: [1.1, 0.28, 0.95],
        pins: 3,
        nominalVoltage: 5.0,
        baseCurrentMa: 195,
        thermalResistance: 0.39,
        description: '60V 1.8mOhm ultra-low RDS(on) N-channel power MOSFET for charge path control.',
        waypoints: [{ x: 1.8, z: -0.95, action: 'SOLDER', dwellMs: 620 }]
      },
      {
        id: 'mosfet-dsg',
        designator: 'Q2',
        name: 'CSD18532KCS Discharge MOSFET',
        category: 'Power Stage',
        packageType: 'REGULATOR',
        position: [1.8, 0.95],
        size: [1.1, 0.28, 0.95],
        pins: 3,
        nominalVoltage: 5.0,
        baseCurrentMa: 225,
        thermalResistance: 0.41,
        description: 'High-side discharge protection MOSFET with short-circuit hardware trip.',
        waypoints: [{ x: 1.8, z: 0.95, action: 'SOLDER', dwellMs: 620 }]
      },
      {
        id: 'bms-mcu',
        designator: 'U2',
        name: 'STM32G071CBT6 CAN Telemetry MCU',
        category: 'Microcontroller',
        packageType: 'QFP',
        position: [-2.4, -0.7],
        size: [1.0, 0.2, 1.0],
        pins: 48,
        nominalVoltage: 3.3,
        baseCurrentMa: 34,
        thermalResistance: 0.2,
        description: 'Cortex-M0+ controller computing state-of-charge (SoC) and broadcasting CAN telemetry.',
        waypoints: [{ x: -2.4, z: -0.7, action: 'SOLDER', dwellMs: 410 }]
      },
      {
        id: 'cell-hdr',
        designator: 'J1',
        name: '5-Pin Cell Sense Balance Connector',
        category: 'Connector',
        packageType: 'HEADER',
        position: [-2.2, 1.65],
        size: [2.4, 0.36, 0.45],
        pins: 5,
        nominalVoltage: 5.0,
        baseCurrentMa: 15,
        thermalResistance: 0.05,
        description: 'JST-XH balance tap connector for individual cell voltage sense (VC1-VC4).',
        waypoints: [{ x: -2.2, z: 1.65, action: 'PROBE', dwellMs: 310 }]
      }
    ],
    traces: [
      { id: 's-t1', netName: 'PACK_HIGH_CURRENT', points: [[1.8, -0.95], [1.8, 0.95]], width: 0.12, isPower: true },
      { id: 's-t2', netName: 'CELL_SENSE_BUS', points: [[-2.2, 1.65], [-0.8, 0.1]], width: 0.055, isPower: false },
      { id: 's-t3', netName: 'I2C_AFE_LINK', points: [[-2.4, -0.7], [-0.8, 0.1]], width: 0.045, isPower: false },
      { id: 's-t4', netName: 'GATE_CHG_DSG', points: [[-0.8, 0.1], [1.8, -0.95]], width: 0.055, isPower: false }
    ]
  },
  {
    id: 'jetson-orin-carrier',
    name: 'EdgeAI Orin Nano Carrier Twin',
    revision: 'REV 1.1',
    architecture: 'PCIe Gen3 + Dual MIPI CSI-2',
    category: 'Industrial Control',
    dimensions: [9.2, 6.2],
    layers: 8,
    substrateColor: 0x1e293b,
    substrateHex: '#1e293b',
    silkscreenColor: '#f8fafc',
    nominalVcc: 5.0,
    maxVcc: 5.5,
    clockMhz: 200,
    stars: 910,
    remixes: 205,
    summary:
      '8-layer high-speed carrier board featuring 260-pin SO-DIMM SOM bus, dual MIPI CSI-2 camera lanes, TPS53015 synchronous buck, and Gigabit PoE.',
    components: [
      {
        id: 'som-bridge',
        designator: 'U1',
        name: 'RTL8111H PCIe Gigabit PHY',
        category: 'Interface IC',
        packageType: 'QFP',
        position: [0.3, -0.3],
        size: [1.25, 0.22, 1.25],
        pins: 48,
        nominalVoltage: 3.3,
        baseCurrentMa: 110,
        thermalResistance: 0.27,
        description: 'Integrated 10/100/1000M Ethernet transceiver with PCIe 1.1 host bus.',
        waypoints: [{ x: 0.3, z: -0.3, action: 'SOLDER', dwellMs: 490 }]
      },
      {
        id: 'wifi-m2',
        designator: 'M1',
        name: 'Intel AX210 Wi-Fi 6E Module',
        category: 'Wireless Module',
        packageType: 'MODULE',
        position: [2.5, 0.5],
        size: [1.65, 0.28, 2.0],
        pins: 52,
        nominalVoltage: 3.3,
        baseCurrentMa: 155,
        thermalResistance: 0.33,
        description: 'Tri-band 2x2 MIMO Wi-Fi 6E and Bluetooth 5.3 M.2 Key-E module.',
        waypoints: [{ x: 2.5, z: 0.5, action: 'SOLDER', dwellMs: 560 }]
      },
      {
        id: 'tps-buck',
        designator: 'U2',
        name: 'TI TPS53015 D-CAP2 Buck',
        category: 'Power Management',
        packageType: 'REGULATOR',
        position: [-2.4, 1.2],
        size: [0.9, 0.25, 0.8],
        pins: 10,
        nominalVoltage: 5.0,
        baseCurrentMa: 140,
        thermalResistance: 0.34,
        description: 'High-current 5V/10A main system rail regulator for SOM core.',
        waypoints: [{ x: -2.4, z: 1.2, action: 'INSPECT', dwellMs: 320 }]
      },
      {
        id: 'usbc-pd',
        designator: 'J1',
        name: 'USB 3.2 Gen2 Type-C Port',
        category: 'Connector',
        packageType: 'USB',
        position: [-4.1, -0.6],
        size: [0.95, 0.34, 1.15],
        pins: 24,
        nominalVoltage: 5.0,
        baseCurrentMa: 22,
        thermalResistance: 0.06,
        description: '10Gbps SuperSpeed USB recovery and DisplayPort Alt-Mode port.',
        waypoints: [{ x: -4.0, z: -0.6, action: 'SOLDER', dwellMs: 520 }]
      },
      {
        id: 'gpio-40p',
        designator: 'J2',
        name: '40-Pin Industrial Automation Header',
        category: 'Connector',
        packageType: 'HEADER',
        position: [0.1, -2.55],
        size: [5.4, 0.4, 0.48],
        pins: 40,
        nominalVoltage: 3.3,
        baseCurrentMa: 28,
        thermalResistance: 0.04,
        description: 'I2C, SPI, UART, CAN-FD, and hardware PWM expansion header.',
        waypoints: [{ x: 0.1, z: -2.55, action: 'PROBE', dwellMs: 380 }]
      }
    ],
    traces: [
      { id: 'j-t1', netName: 'SYS_5V0_MAIN', points: [[-4.1, -0.6], [-2.4, 1.2], [0.3, -0.3]], width: 0.095, isPower: true },
      { id: 'j-t2', netName: 'PCIE_LANE0_DIFF', points: [[0.3, -0.3], [2.5, 0.5]], width: 0.055, isPower: false },
      { id: 'j-t3', netName: 'CAM_CSI2_CLK', points: [[0.3, -0.3], [0.1, -2.55]], width: 0.045, isPower: false }
    ]
  }
];

interface ChamberSimulationProps {
  board: BoardSpec;
  simParams: SimulationParams;
  selectedComponentId: string | null;
  onSelectComponent: (id: string | null) => void;
}

interface PulseItem {
  mesh: THREE.Mesh;
  curve: THREE.CatmullRomCurve3;
  progress: number;
  speed: number;
  isPower: boolean;
}

export const ChamberSimulation: React.FC<ChamberSimulationProps> = ({
  board,
  simParams,
  selectedComponentId,
  onSelectComponent
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const simParamsRef = useRef<SimulationParams>(simParams);
  const selectedIdRef = useRef<string | null>(selectedComponentId);
  const onSelectRef = useRef(onSelectComponent);

  useEffect(() => {
    simParamsRef.current = simParams;
  }, [simParams]);

  useEffect(() => {
    selectedIdRef.current = selectedComponentId;
  }, [selectedComponentId]);

  useEffect(() => {
    onSelectRef.current = onSelectComponent;
  }, [onSelectComponent]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0c0e);

    const camera = new THREE.PerspectiveCamera(
      40,
      container.clientWidth / Math.max(container.clientHeight, 1),
      0.1,
      100
    );
    camera.position.set(0, 6.8, 7.8);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.maxPolarAngle = Math.PI / 2 - 0.04;
    controls.minDistance = 3.2;
    controls.maxDistance = 18;
    controls.target.set(0, 0.2, 0);

    const ambientLight = new THREE.AmbientLight(0xdbeafe, 0.85);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.35);
    keyLight.position.set(6, 11, 7);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x93c5fd, 0.45);
    rimLight.position.set(-7, 5, -6);
    scene.add(rimLight);

    const grid = new THREE.GridHelper(22, 44, 0x27272a, 0x16181d);
    grid.position.y = -0.35;
    scene.add(grid);

    const boardGroup = new THREE.Group();
    scene.add(boardGroup);

    const [boardW, boardD] = board.dimensions;
    const pcbThickness = 0.16;

    const pcbGeo = new THREE.BoxGeometry(boardW, pcbThickness, boardD);
    const pcbMat = new THREE.MeshStandardMaterial({
      color: board.substrateColor,
      roughness: 0.42,
      metalness: 0.08,
      transparent: true,
      opacity: 1
    });
    const pcbMesh = new THREE.Mesh(pcbGeo, pcbMat);
    pcbMesh.receiveShadow = true;
    pcbMesh.castShadow = true;
    boardGroup.add(pcbMesh);

    const borderEdges = new THREE.EdgesGeometry(pcbGeo);
    const borderLines = new THREE.LineSegments(
      borderEdges,
      new THREE.LineBasicMaterial({ color: 0x3f3f46, transparent: true, opacity: 0.65 })
    );
    pcbMesh.add(borderLines);

    const holeOffsets: Array<[number, number]> = [
      [-boardW / 2 + 0.35, -boardD / 2 + 0.35],
      [boardW / 2 - 0.35, -boardD / 2 + 0.35],
      [-boardW / 2 + 0.35, boardD / 2 - 0.35],
      [boardW / 2 - 0.35, boardD / 2 - 0.35]
    ];
    const ringGeo = new THREE.RingGeometry(0.11, 0.21, 24);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      metalness: 0.85,
      roughness: 0.25,
      side: THREE.DoubleSide
    });
    holeOffsets.forEach(([hx, hz]) => {
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(hx, pcbThickness / 2 + 0.003, hz);
      boardGroup.add(ring);
    });

    const tracesGroup = new THREE.Group();
    boardGroup.add(tracesGroup);
    const pulses: PulseItem[] = [];

    board.traces.forEach((trace) => {
      const vecPoints = trace.points.map(
        ([px, pz]) => new THREE.Vector3(px, pcbThickness / 2 + 0.008, pz)
      );
      const curve = new THREE.CatmullRomCurve3(vecPoints, false, 'catmullrom', 0.08);
      const tubeGeo = new THREE.TubeGeometry(curve, 36, trace.width * 0.38, 6, false);
      const tubeMat = new THREE.MeshStandardMaterial({
        color: trace.isPower ? 0xd97706 : 0xb45309,
        metalness: 0.78,
        roughness: 0.28
      });
      const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
      tracesGroup.add(tubeMesh);

      const pulseGeo = new THREE.SphereGeometry(trace.width * 0.62, 10, 10);
      const pulseMat = new THREE.MeshBasicMaterial({
        color: trace.isPower ? 0x38bdf8 : 0x34d399
      });
      const pulseMesh = new THREE.Mesh(pulseGeo, pulseMat);
      tracesGroup.add(pulseMesh);

      pulses.push({
        mesh: pulseMesh,
        curve,
        progress: Math.random(),
        speed: trace.isPower ? 0.32 : 0.55,
        isPower: trace.isPower
      });
    });

    const componentMeshes = new Map<
      string,
      {
        root: THREE.Group;
        bodyMesh: THREE.Mesh;
        baseY: number;
        spec: ComponentSpec;
        selectionBox: THREE.LineSegments;
        ledMat?: THREE.MeshStandardMaterial;
      }
    >();
    const pickableTargets: THREE.Object3D[] = [];

    const pinMat = new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      metalness: 0.9,
      roughness: 0.2
    });

    board.components.forEach((comp) => {
      const compGroup = new THREE.Group();
      const [cw, ch, cd] = comp.size;
      const [cx, cz] = comp.position;
      const baseY = pcbThickness / 2 + ch / 2;
      compGroup.position.set(cx, baseY, cz);

      let bodyGeo: THREE.BufferGeometry = new THREE.BoxGeometry(cw, ch, cd);
      let baseColor = 0x1e2026;
      let metalness = 0.2;
      let roughness = 0.55;

      if (comp.packageType === 'CAPACITOR') {
        bodyGeo = new THREE.CylinderGeometry(cw * 0.46, cw * 0.46, ch, 24);
        baseColor = 0x334155;
        metalness = 0.75;
        roughness = 0.25;
      } else if (comp.packageType === 'MODULE') {
        baseColor = 0x94a3b8;
        metalness = 0.82;
        roughness = 0.22;
      } else if (comp.packageType === 'USB') {
        baseColor = 0xcbd5e1;
        metalness = 0.88;
        roughness = 0.18;
      } else if (comp.packageType === 'HEADER') {
        baseColor = 0x111318;
        metalness = 0.1;
        roughness = 0.8;
      } else if (comp.packageType === 'LED') {
        baseColor = 0x10b981;
      }

      const bodyMat = new THREE.MeshStandardMaterial({
        color: baseColor,
        metalness,
        roughness
      });

      let ledMat: THREE.MeshStandardMaterial | undefined;
      if (comp.packageType === 'LED') {
        bodyMat.emissive = new THREE.Color(0x10b981);
        bodyMat.emissiveIntensity = 0.8;
        ledMat = bodyMat;
      }

      const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
      bodyMesh.castShadow = true;
      bodyMesh.receiveShadow = true;
      bodyMesh.userData = { componentId: comp.id };
      compGroup.add(bodyMesh);
      pickableTargets.push(bodyMesh);

      if (
        comp.packageType === 'QFP' ||
        comp.packageType === 'SOIC' ||
        comp.packageType === 'SENSOR'
      ) {
        const dotGeo = new THREE.CircleGeometry(Math.min(cw, cd) * 0.08, 16);
        const dotMat = new THREE.MeshBasicMaterial({ color: 0x94a3b8 });
        const dot = new THREE.Mesh(dotGeo, dotMat);
        dot.rotation.x = -Math.PI / 2;
        dot.position.set(-cw * 0.34, ch / 2 + 0.002, -cd * 0.34);
        compGroup.add(dot);
      }

      const pinCountSide = Math.min(Math.max(Math.floor(comp.pins / 4), 2), 10);
      const pinGeo = new THREE.BoxGeometry(0.05, 0.04, 0.12);
      if (comp.packageType === 'QFP' || comp.packageType === 'SOIC') {
        for (let i = 0; i < pinCountSide; i++) {
          const offset = (i / (pinCountSide - 1) - 0.5) * (cw * 0.78);
          const pNorth = new THREE.Mesh(pinGeo, pinMat);
          pNorth.position.set(offset, -ch / 2 + 0.02, -cd / 2 - 0.04);
          compGroup.add(pNorth);

          const pSouth = new THREE.Mesh(pinGeo, pinMat);
          pSouth.position.set(offset, -ch / 2 + 0.02, cd / 2 + 0.04);
          compGroup.add(pSouth);
        }
      } else if (comp.packageType === 'HEADER') {
        const goldPinGeo = new THREE.BoxGeometry(0.05, ch * 0.75, 0.05);
        const count = Math.min(comp.pins, 14);
        for (let i = 0; i < count; i++) {
          const offset = (i / Math.max(count - 1, 1) - 0.5) * (cw * 0.88);
          const goldPin = new THREE.Mesh(goldPinGeo, ringMat);
          goldPin.position.set(offset, ch * 0.35, 0);
          compGroup.add(goldPin);
        }
      }

      const selEdges = new THREE.EdgesGeometry(
        new THREE.BoxGeometry(cw + 0.14, ch + 0.1, cd + 0.14)
      );
      const selMat = new THREE.LineBasicMaterial({ color: 0x3b82f6 });
      const selectionBox = new THREE.LineSegments(selEdges, selMat);
      selectionBox.visible = comp.id === selectedIdRef.current;
      compGroup.add(selectionBox);

      boardGroup.add(compGroup);
      componentMeshes.set(comp.id, {
        root: compGroup,
        bodyMesh,
        baseY,
        spec: comp,
        selectionBox,
        ledMat
      });
    });

    const toolpathGroup = new THREE.Group();
    boardGroup.add(toolpathGroup);

    const allWaypoints: Array<{ pos: THREE.Vector3; action: string }> = [];
    board.components.forEach((c) => {
      c.waypoints.forEach((wp) => {
        allWaypoints.push({
          pos: new THREE.Vector3(wp.x, pcbThickness / 2 + 0.32, wp.z),
          action: wp.action
        });
      });
    });

    if (allWaypoints.length > 1) {
      const wpVectors = [
        new THREE.Vector3(-boardW / 2 + 0.5, 1.4, -boardD / 2 + 0.5),
        ...allWaypoints.map((w) => w.pos)
      ];
      const pathGeo = new THREE.BufferGeometry().setFromPoints(wpVectors);
      const pathMat = new THREE.LineBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.75
      });
      const pathLine = new THREE.Line(pathGeo, pathMat);
      toolpathGroup.add(pathLine);

      allWaypoints.forEach((w) => {
        const markerGeo = new THREE.RingGeometry(0.09, 0.14, 20);
        const markerMat = new THREE.MeshBasicMaterial({
          color: w.action === 'SOLDER' ? 0xf59e0b : 0x38bdf8,
          side: THREE.DoubleSide
        });
        const marker = new THREE.Mesh(markerGeo, markerMat);
        marker.rotation.x = -Math.PI / 2;
        marker.position.copy(w.pos);
        marker.position.y = pcbThickness / 2 + 0.02;
        toolpathGroup.add(marker);
      });
    }

    const robotHead = new THREE.Group();
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.08, 0.9, 20),
      new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8, roughness: 0.25 })
    );
    barrel.position.y = 0.65;
    robotHead.add(barrel);

    const tip = new THREE.Mesh(
      new THREE.ConeGeometry(0.075, 0.32, 20),
      new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xd97706,
        emissiveIntensity: 0.45
      })
    );
    tip.rotation.x = Math.PI;
    tip.position.y = 0.16;
    robotHead.add(tip);
    toolpathGroup.add(robotHead);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let pointerDownPos = { x: 0, y: 0 };

    const handlePointerDown = (e: MouseEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const handlePointerUp = (e: MouseEvent) => {
      const dx = Math.abs(e.clientX - pointerDownPos.x);
      const dy = Math.abs(e.clientY - pointerDownPos.y);
      if (dx > 5 || dy > 5) return;

      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(pickableTargets, false);
      if (hits.length > 0) {
        const hitId = hits[0].object.userData.componentId as string | undefined;
        if (hitId) {
          onSelectRef.current(hitId);
        }
      } else {
        onSelectRef.current(null);
      }
    };

    renderer.domElement.addEventListener('mousedown', handlePointerDown);
    renderer.domElement.addEventListener('mouseup', handlePointerUp);

    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / Math.max(container.clientHeight, 1);
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    let frameId = 0;
    const clock = new THREE.Clock();

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const dt = clock.getDelta();
      const elapsed = clock.getElapsedTime();
      const params = simParamsRef.current;

      controls.update();

      const vRatio = params.supplyVoltage / board.nominalVcc;
      const powerFactor = vRatio * (params.loadPercent / 100) * params.clockScale;

      pcbMat.opacity = params.viewMode === 'xray' ? 0.22 : 1.0;
      if (params.viewMode === 'thermal') {
        pcbMat.color.setHex(0x111827);
      } else {
        pcbMat.color.setHex(board.substrateColor);
      }

      const targetTraceY = params.viewMode === 'exploded' ? 0.36 : 0;
      tracesGroup.position.y += (targetTraceY - tracesGroup.position.y) * 0.12;

      pulses.forEach((p) => {
        p.mesh.visible = params.running && params.supplyVoltage > 1.5;
        if (params.running) {
          p.progress =
            (p.progress + dt * p.speed * params.clockScale * (0.5 + params.loadPercent / 140)) % 1;
          const pt = p.curve.getPointAt(p.progress);
          p.mesh.position.copy(pt);
        }
      });

      componentMeshes.forEach((item, id) => {
        item.selectionBox.visible = id === selectedIdRef.current;

        const explodedOffset =
          params.viewMode === 'exploded' ? 0.75 + (item.spec.pins > 16 ? 0.35 : 0) : 0;
        const desiredY = item.baseY + explodedOffset;
        item.root.position.y += (desiredY - item.root.position.y) * 0.12;

        const mat = item.bodyMesh.material as THREE.MeshStandardMaterial;

        if (params.viewMode === 'thermal') {
          const powerMw = item.spec.baseCurrentMa * params.supplyVoltage * powerFactor;
          const tempC = params.ambientTemp + powerMw * item.spec.thermalResistance * 0.12;
          const norm = Math.min(Math.max((tempC - 25) / 65, 0), 1);
          const heatColor = new THREE.Color();
          heatColor.setHSL((1 - norm) * 0.62, 0.88, 0.48);
          mat.color.copy(heatColor);
        } else {
          if (item.spec.packageType === 'CAPACITOR') mat.color.setHex(0x334155);
          else if (item.spec.packageType === 'MODULE') mat.color.setHex(0x94a3b8);
          else if (item.spec.packageType === 'USB') mat.color.setHex(0xcbd5e1);
          else if (item.spec.packageType === 'HEADER') mat.color.setHex(0x111318);
          else if (item.spec.packageType === 'LED') mat.color.setHex(0x10b981);
          else mat.color.setHex(0x1e2026);
        }

        if (item.ledMat) {
          if (params.running && params.supplyVoltage >= 2.5) {
            const pulse = 0.55 + 0.45 * Math.sin(elapsed * 6 * params.clockScale);
            item.ledMat.emissiveIntensity = pulse * vRatio;
          } else {
            item.ledMat.emissiveIntensity = 0.05;
          }
        }
      });

      toolpathGroup.visible = params.showToolpath;
      if (params.showToolpath && allWaypoints.length > 0) {
        const wpIdx = Math.min(params.activeWaypointIndex, allWaypoints.length - 1);
        const targetPos = allWaypoints[wpIdx].pos;
        robotHead.position.lerp(targetPos, 0.14);
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('mousedown', handlePointerDown);
      renderer.domElement.removeEventListener('mouseup', handlePointerUp);
      controls.dispose();
      renderer.dispose();
    };
  }, [board]);

  return <div ref={mountRef} className="viewport-canvas-mount" />;
};