import { useEffect, useState, useMemo, useCallback } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Cell, LabelList
} from "recharts";
import {
  Activity,
  BarChart3,
  BatteryCharging,
  Check,
  ChevronDown,
  CircleAlert,
  Cpu,
  ExternalLink,
  Info,
  LineChart,
  Plane,
  Plus,
  RotateCcw,
  Settings2,
  SlidersHorizontal,
  Sun,
  Target,
  TriangleAlert,
  X,
  Zap
} from "lucide-react";
import { getComboLabel, interpolateByThrust, loadMotorPresetCsv } from "./data/motorData";
import sentieryIcon from "../sentiery-icon.png";
import sentieryLogoEn from "../sentiery-logo-en.png";
import sentieryMark from "../sentiery-mark.png";

const G = 9.81;
const RHO = 1.225;
const CELL_V = 3.7;
const DEFAULT_MOTOR_COMBO_ID = "holybro-air2216ii-kv920-4s-t1045ii";
const ASSET_BASE = import.meta.env.BASE_URL || "./";

const INIT = {
  rotors: 4, frameKg: 0.61, elecKg: 0.3,
  motorPropKg: 0.077, escWireKg: 0.021,
  propInch: 10, fm: 0.45, avW: 10, errKg: 0.05,
};

const INIT_BATT = { cells: 4, mah: 5000, kg: 0.5, cRate: 20 };
const INIT_ESC = { kg: 0.021, continuousA: 20, maxA: 30, cellMin: 3, cellMax: 4 };
const INIT_SOLAR = { on: false, kg: 0.5, watts: 0, weatherPct: 70 };
const INIT_DIRECT_MOTOR = { cells: 4, thrustN50: 0, powerW50: 0 };
const LOG_STORAGE_KEY = "drone-flight-test-logs-v1";

const STATUS = {
  danger: { color: "#dc2626", bg: "#fef2f2", soft: "#fee2e2", Icon: TriangleAlert },
  warning: { color: "#b45309", bg: "#fffbeb", soft: "#fef3c7", Icon: CircleAlert },
  ok: { color: "#047857", bg: "#ecfdf5", soft: "#d1fae5", Icon: Check },
  info: { color: "#2563eb", bg: "#eff6ff", soft: "#dbeafe", Icon: Info }
};

const LEVEL_META = {
  danger: STATUS.danger,
  warning: STATUS.warning,
  ok: STATUS.ok,
  info: STATUS.info
};

const TIME_COLORS = {
  good: "#059669",
  caution: "#d97706",
  low: "#ea580c",
  danger: "#dc2626"
};

const VEHICLE_MODE_META = {
  multicopter: {
    id: "multicopter",
    label: "멀티콥터",
    badge: "사용 가능",
    title: "멀티콥터 비행시간 추정기",
    subtitle: "호버링 비행시간 · 전류 여유 · 임무장비 영향",
    Icon: Activity
  },
  fixedwing: {
    id: "fixedwing",
    label: "고정익",
    badge: "베타 계산",
    title: "고정익 비행시간 추정기",
    subtitle: "윙스팬 기반 면적 추정 · 항력 · 순항전력",
    Icon: Plane,
    focus: "사진 기반 주익 면적 추정부터 함께 설계할 예정입니다.",
    items: [
      "Top view 사진 + 실제 윙스팬으로 주익 면적 계산",
      "수동 외곽선 지정 후 평균 시위와 aspect ratio 추정",
      "CD0, Oswald 효율, 추진 효율을 이용한 속도별 필요전력 곡선",
      "실측 비행 로그로 항력계수와 순항전력 보정"
    ],
    notes: [
      ["1단계", "수동 입력 계산기"],
      ["2단계", "사진 기반 날개 면적 추정"],
      ["3단계", "실측 로그 보정"]
    ]
  },
  vtol: {
    id: "vtol",
    label: "VTOL",
    badge: "업데이트 예정",
    title: "VTOL 임무시간 추정기",
    subtitle: "수직이착륙 · 전환비행 · 순항 구간 통합",
    Icon: Zap,
    focus: "멀티콥터 호버 계산과 고정익 순항 계산을 한 임무 프로파일로 연결할 예정입니다.",
    items: [
      "이륙/착륙 호버 구간 소비전력 계산",
      "전환비행 시간과 여유 전력 반영",
      "고정익 순항 구간 거리, 속도, 전력 계산",
      "전체 임무 기준 배터리 사용량과 안전 여유 판정"
    ],
    notes: [
      ["입력", "호버 시간, 순항 거리, 순항속도"],
      ["계산", "멀티콥터 + 고정익 모델 결합"],
      ["출력", "임무 가능 여부와 배터리 여유"]
    ]
  }
};

const FIXED_WING_PRESETS = [
  {
    id: "flightory-stork",
    maker: "Flightory",
    name: "Stork",
    type: "Classic pusher / V-tail",
    wingspanM: 1.62,
    lengthM: 1.0,
    auwMinKg: 1.4,
    auwMaxKg: 3.1,
    speedMinKmh: 50,
    speedMaxKmh: 70,
    bestCruiseKmh: 56,
    airframeKg: 0.92,
    electronicsKg: 0.22,
    refWeightKg: 2.2,
    refSpeedKmh: 58,
    refCruisePowerW: 115,
    material: "LW-PLA/ASA + PC/PETG",
    airfoil: "Selig S3021",
    propulsion: "28XX 모터, 9-10인치 프로펠러, 4S-6S Li-Ion/Li-Po",
    vtolPack: true,
    sourceUrl: "https://flightory.com/product/stork/",
    imageUrl: `${ASSET_BASE}aircraft/stork.jpg`,
    summary: "안정성과 효율을 강조한 3D 프린터 FPV 고정익으로, pusher 배치와 V-tail 구성을 사용합니다."
  },
  {
    id: "flightory-stallion",
    maker: "Flightory",
    name: "Stallion",
    type: "Twin tractor / V-tail",
    wingspanM: 1.34,
    lengthM: 0.99,
    auwMinKg: 1.5,
    auwMaxKg: 3.0,
    speedMinKmh: 60,
    speedMaxKmh: 70,
    bestCruiseKmh: 64,
    airframeKg: 0.95,
    electronicsKg: 0.26,
    refWeightKg: 2.45,
    refSpeedKmh: 65,
    refCruisePowerW: 60,
    material: "LW-PLA + PETG",
    airfoil: "Eppler E205",
    propulsion: "T-Motor F60/F90 2개, 7x4-7x6 프로펠러, 4S 또는 3S 배터리",
    vtolPack: true,
    sourceUrl: "https://flightory.com/product/stallion/",
    imageUrl: `${ASSET_BASE}aircraft/stallion.jpg`,
    summary: "쌍발 tractor 구성을 쓰는 고성능 3D 프린터 고정익으로, 모듈형 페이로드 구성을 고려합니다."
  }
];

const FIXED_WING_POWERTRAINS = [
  {
    id: "stork-2812-910",
    presetId: "flightory-stork",
    label: "BrotherHobby Avenger 2812 V5 910KV",
    shortLabel: "28XX 910KV",
    motorCount: 1,
    weightKg: 0.13,
    maxContinuousW: 700,
    efficiencyFactor: 1.0,
    cellMin: 4,
    cellMax: 6,
    props: [
      { id: "stork-9x6", label: "9x6", diameterIn: 9, pitchIn: 6, powerFactor: 1.04, speedBiasKmh: -1 },
      { id: "stork-10x6", label: "10x6", diameterIn: 10, pitchIn: 6, powerFactor: 1.0, speedBiasKmh: 0 },
      { id: "stork-10x7", label: "10x7", diameterIn: 10, pitchIn: 7, powerFactor: 0.98, speedBiasKmh: 2 }
    ]
  },
  {
    id: "stork-generic-28xx",
    presetId: "flightory-stork",
    label: "Generic 28XX endurance motor",
    shortLabel: "28XX 직접 대체",
    motorCount: 1,
    weightKg: 0.15,
    maxContinuousW: 620,
    efficiencyFactor: 0.94,
    cellMin: 4,
    cellMax: 6,
    props: [
      { id: "stork-generic-9x6", label: "9x6", diameterIn: 9, pitchIn: 6, powerFactor: 1.08, speedBiasKmh: -1 },
      { id: "stork-generic-10x6", label: "10x6", diameterIn: 10, pitchIn: 6, powerFactor: 1.03, speedBiasKmh: 0 }
    ]
  },
  {
    id: "stallion-f60-1750",
    presetId: "flightory-stallion",
    label: "T-Motor F60 1750KV ×2",
    shortLabel: "F60 1750KV ×2",
    motorCount: 2,
    weightKg: 0.16,
    maxContinuousW: 900,
    efficiencyFactor: 0.98,
    cellMin: 3,
    cellMax: 4,
    props: [
      { id: "stallion-f60-7x4", label: "7x4", diameterIn: 7, pitchIn: 4, powerFactor: 0.98, speedBiasKmh: -2 },
      { id: "stallion-f60-7x5", label: "7x5", diameterIn: 7, pitchIn: 5, powerFactor: 1.0, speedBiasKmh: 0 },
      { id: "stallion-f60-7x6", label: "7x6", diameterIn: 7, pitchIn: 6, powerFactor: 1.06, speedBiasKmh: 2 }
    ]
  },
  {
    id: "stallion-f90-1300",
    presetId: "flightory-stallion",
    label: "T-Motor F90 1300KV ×2",
    shortLabel: "F90 1300KV ×2",
    motorCount: 2,
    weightKg: 0.24,
    maxContinuousW: 1250,
    efficiencyFactor: 1.04,
    cellMin: 3,
    cellMax: 4,
    props: [
      { id: "stallion-f90-7x5", label: "7x5", diameterIn: 7, pitchIn: 5, powerFactor: 0.99, speedBiasKmh: 0 },
      { id: "stallion-f90-7x6", label: "7x6", diameterIn: 7, pitchIn: 6, powerFactor: 1.02, speedBiasKmh: 2 }
    ]
  }
];

const FIXED_WING_BATTERY_PRESETS = [
  { id: "3s-10000-liion", label: "3S 10000mAh Li-Ion", cells: 3, mah: 10000, kg: 0.52, cRate: 10 },
  { id: "4s-6000-lipo", label: "4S 6000mAh LiPo", cells: 4, mah: 6000, kg: 0.58, cRate: 25 },
  { id: "4s-10000-liion", label: "4S 10000mAh Li-Ion", cells: 4, mah: 10000, kg: 0.68, cRate: 10 },
  { id: "4s-21000-liion", label: "4S6P 21000mAh Li-Ion", cells: 4, mah: 21000, kg: 1.08, cRate: 8 },
  { id: "6s-8000-liion", label: "6S 8000mAh Li-Ion", cells: 6, mah: 8000, kg: 0.88, cRate: 10 },
  { id: "custom", label: "직접 입력", cells: 4, mah: 10000, kg: 0.7, cRate: 10 }
];

const FIXED_WING_DEFAULTS = {
  "flightory-stork": {
    powertrainId: "stork-2812-910",
    propId: "stork-10x7",
    batteryId: "6s-8000-liion",
    payloadKg: 0.25,
    avionicsW: 8,
    reservePct: 15,
    customBattery: { cells: 4, mah: 10000, kg: 0.7, cRate: 10 }
  },
  "flightory-stallion": {
    powertrainId: "stallion-f60-1750",
    propId: "stallion-f60-7x5",
    batteryId: "4s-21000-liion",
    payloadKg: 0.25,
    avionicsW: 8,
    reservePct: 15,
    customBattery: { cells: 4, mah: 21000, kg: 1.08, cRate: 8 }
  }
};

const VEHICLE_PRESETS = [
  {
    id: "holybro-x500-v2",
    name: "Holybro X500 V2",
    p: {
      rotors: 4,
      frameKg: 0.61,
      elecKg: 0.3,
      motorPropKg: 0.077,
      propInch: 10,
      fm: 0.45,
      avW: 10,
      errKg: 0.05
    },
    batt: { cells: 4, mah: 5000, kg: 0.5, cRate: 20 },
    esc: { kg: 0.021, continuousA: 20, maxA: 30, cellMin: 3, cellMax: 4 },
    comboId: DEFAULT_MOTOR_COMBO_ID
  },
  {
    id: "edu-450-quad",
    name: "450급 교육용 쿼드",
    p: {
      rotors: 4,
      frameKg: 0.432,
      elecKg: 0.3,
      motorPropKg: 0.07,
      propInch: 9.4,
      fm: 0.45,
      avW: 10,
      errKg: 0.05
    },
    batt: { cells: 4, mah: 10000, kg: 0.8, cRate: 25 },
    esc: { kg: 0.037, continuousA: 35, maxA: 60, cellMin: 2, cellMax: 6 }
  },
  {
    id: "tarot-680-pro-hexa",
    name: "Tarot 680 Pro (헥사)",
    p: {
      rotors: 6,
      frameKg: 0.75,
      elecKg: 0.35,
      motorPropKg: 0.12,
      propInch: 13,
      fm: 0.48,
      avW: 12,
      errKg: 0.08
    },
    batt: { cells: 6, mah: 10000, kg: 1.25, cRate: 25 },
    esc: { kg: 0.045, continuousA: 40, maxA: 60, cellMin: 3, cellMax: 6 }
  }
];

const INIT_EQUIP = [
  { id: 1, name: "짐벌 카메라", kg: 0.30, w: 8, on: false },
  { id: 2, name: "열화상 카메라", kg: 0.20, w: 5, on: false },
  { id: 3, name: "AI 보드 (Jetson Nano)", kg: 0.15, w: 15, on: false },
  { id: 4, name: "LiDAR 센서", kg: 0.25, w: 12, on: false },
  { id: 5, name: "미스트 펌프+노즐", kg: 0.50, w: 20, on: false },
  { id: 6, name: "물탱크 (1L)", kg: 1.00, w: 0, on: false },
];

function calc(p, battWh, payloadKg, extraW, generatedW = 0) {
  const mT = p.motorPropKg * p.rotors;
  const eT = p.escWireKg * p.rotors;
  const tow = p.frameKg + p.elecKg + mT + eT + p.errKg + payloadKg;
  const d = p.propInch * 0.0254;
  const A = p.rotors * Math.PI * (d / 2) ** 2;
  const T = tow * G;
  const vi = Math.sqrt(Math.max(T / (2 * RHO * A), 0.001));
  const hW = (T * vi) / Math.max(p.fm, 0.01);
  const grossW = hW + p.avW + extraW;
  const tW = Math.max(grossW - generatedW, 1);
  const mFull = tW > 0 ? (battWh / tW) * 60 : 0;
  return { tow, T, vi, hW, grossW, generatedW, tW, battWh, mFull, m90: mFull * 0.9, mT, eT, A };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getFixedWingDefaultConfig(presetId) {
  const fallback = FIXED_WING_DEFAULTS["flightory-stork"];
  const base = FIXED_WING_DEFAULTS[presetId] || fallback;
  return {
    ...base,
    customBattery: { ...base.customBattery }
  };
}

function getFixedWingBattery(config) {
  if (config.batteryId === "custom") return { ...config.customBattery, id: "custom", label: "직접 입력" };
  return FIXED_WING_BATTERY_PRESETS.find(item => item.id === config.batteryId) || FIXED_WING_BATTERY_PRESETS[0];
}

function calcFixedWing(preset, powertrain, prop, battery, config) {
  const voltage = battery.cells * CELL_V;
  const batteryWh = voltage * battery.mah / 1000;
  const usableWh = batteryWh * (1 - clamp(config.reservePct, 0, 60) / 100);
  const towKg = preset.airframeKg + preset.electronicsKg + powertrain.weightKg + battery.kg + config.payloadKg;
  const weightBand = Math.max(preset.auwMaxKg - preset.auwMinKg, 0.01);
  const weightRatio = clamp((towKg - preset.auwMinKg) / weightBand, 0, 1);
  const speedFromWeight = preset.bestCruiseKmh + (weightRatio - 0.5) * (preset.speedMaxKmh - preset.speedMinKmh) * 0.45;
  const cruiseKmh = clamp(speedFromWeight + prop.speedBiasKmh, preset.speedMinKmh, preset.speedMaxKmh);
  const speedRatio = cruiseKmh / Math.max(preset.refSpeedKmh, 1);
  const speedPowerFactor = 0.58 * Math.pow(speedRatio, 3) + 0.42 / Math.max(speedRatio, 0.45);
  const weightPowerFactor = Math.pow(towKg / Math.max(preset.refWeightKg, 0.1), 1.15);
  const propulsionPowerW = preset.refCruisePowerW * weightPowerFactor * speedPowerFactor * prop.powerFactor / Math.max(powertrain.efficiencyFactor, 0.1);
  const totalPowerW = propulsionPowerW + config.avionicsW;
  const enduranceMin = totalPowerW > 0 ? (usableWh / totalPowerW) * 60 : 0;
  const fullEnduranceMin = totalPowerW > 0 ? (batteryWh / totalPowerW) * 60 : 0;
  const rangeKm = cruiseKmh * enduranceMin / 60;
  const currentA = voltage > 0 ? totalPowerW / voltage : 0;
  const batteryMaxCurrentA = (battery.mah / 1000) * battery.cRate;
  const batteryLoadPct = batteryMaxCurrentA > 0 ? (currentA / batteryMaxCurrentA) * 100 : 0;
  const propulsionLoadPct = (propulsionPowerW / Math.max(powertrain.maxContinuousW, 1)) * 100;
  const auwStatus = towKg > preset.auwMaxKg ? "danger" : towKg > preset.auwMaxKg * 0.92 ? "warning" : "ok";
  const cellStatus = battery.cells < powertrain.cellMin || battery.cells > powertrain.cellMax ? "warning" : "ok";
  return {
    towKg,
    voltage,
    batteryWh,
    usableWh,
    cruiseKmh,
    propulsionPowerW,
    totalPowerW,
    enduranceMin,
    fullEnduranceMin,
    rangeKm,
    currentA,
    batteryMaxCurrentA,
    batteryLoadPct,
    propulsionLoadPct,
    weightRatio,
    auwStatus,
    cellStatus
  };
}

/* ── tiny reusable pieces ── */

const InputRow = ({ label, unit, value, onChange, min = 0, max = 99999, step = 0.01, width }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
    <span style={{ fontSize: 12, color: "#475569", width: width || 110, flexShrink: 0 }}>{label}</span>
    <input type="number" value={value} min={min} max={max} step={step}
      onChange={e => onChange(+e.target.value)}
      style={{ width: 72, padding: "4px 6px", border: "1px solid #cbd5e1", borderRadius: 6,
        fontSize: 13, textAlign: "right", outline: "none", background: "#f8fafc" }} />
    {unit && <span style={{ fontSize: 11, color: "#94a3b8", width: 40 }}>{unit}</span>}
  </div>
);

const Sec = ({ title, icon: Icon, children, open: initOpen = true }) => {
  const [open, setOpen] = useState(initOpen);
  return (
    <div className="section-card" style={{ marginBottom: 6, background: "white", borderRadius: 10, border: "1px solid #e2e8f0", overflow: "hidden" }}>
      <button onClick={() => setOpen(!open)}
        style={{ width: "100%", padding: "7px 12px", display: "flex", alignItems: "center", gap: 6,
          background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#1e293b" }}>
        {Icon && <Icon size={15} strokeWidth={2.2} color="#2563eb" style={{ flexShrink: 0 }} />}
        <span style={{ flex: 1, textAlign: "left" }}>{title}</span>
        <ChevronDown size={14} color="#94a3b8" style={{ flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "0.2s" }} />
      </button>
      {open && <div style={{ padding: "2px 12px 10px" }}>{children}</div>}
    </div>
  );
};

const BigNum = ({ label, value, unit, sub, color, border, featured = false }) => (
  <div className={`big-num${featured ? " big-num-featured" : ""}`}
    style={{ background: border ? `linear-gradient(135deg,${color}14,${color}06)` : "white",
    borderRadius: 12, padding: featured ? "16px 18px" : "12px 16px", border: border ? `2px solid ${color}35` : "1px solid #e2e8f0",
    boxShadow: featured ? `0 14px 30px ${color}18` : undefined,
    flex: featured ? 1.25 : 1, minWidth: 0, textAlign: "center" }}>
    <div style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}>{label}</div>
    <div style={{ fontSize: featured ? 44 : 36, fontWeight: 800, color: color || "#0f172a", lineHeight: 1.1,
      fontVariantNumeric: "tabular-nums" }}>{value}</div>
    <div style={{ fontSize: 13, color: color || "#64748b", fontWeight: 500 }}>{unit}</div>
    {sub && <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 3 }}>{sub}</div>}
  </div>
);

const SmallCard = ({ label, value, unit, className = "" }) => (
  <div className={`small-card${className ? ` ${className}` : ""}`}
    style={{ background: "white", borderRadius: 8, padding: "8px 12px", border: "1px solid #e2e8f0", flex: 1, minWidth: 0 }}>
    <div style={{ fontSize: 10, color: "#94a3b8" }}>{label}</div>
    <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", fontVariantNumeric: "tabular-nums" }}>
      {typeof value === "number" ? value.toFixed(1) : value}<span style={{ fontSize: 11, color: "#94a3b8", marginLeft: 3 }}>{unit}</span>
    </div>
  </div>
);

const CurveTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 8,
      padding: "8px 12px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", fontSize: 12 }}>
      <div style={{ fontWeight: 600 }}>페이로드: {label} kg</div>
      <div style={{ color: "#3b82f6" }}>비행시간: {payload[0]?.value?.toFixed(1)} 분</div>
    </div>
  );
};

const BarTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 8,
      padding: "8px 12px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", fontSize: 12 }}>
      <div style={{ fontWeight: 600, marginBottom: 2 }}>{d?.name}</div>
      <div>비행시간: <b>{d?.time?.toFixed(1)} 분</b></div>
      <div>이륙중량: {d?.tow?.toFixed(2)} kg</div>
      <div>총 소비전력: {d?.power?.toFixed(0)} W</div>
    </div>
  );
};

const ComingSoonPanel = ({ mode, fixedWingPreset, onFixedWingPresetChange }) => {
  const ModeIcon = mode.Icon || Info;
  const showFixedWingPreset = mode.id === "fixedwing" && fixedWingPreset;
  return (
    <div className="coming-soon-shell">
      <section className="coming-soon-hero">
        <div className="coming-soon-icon">
          <ModeIcon size={24} strokeWidth={2.3} />
        </div>
        <div>
          <div className="coming-soon-kicker">{mode.badge}</div>
          <h2>{mode.title}</h2>
          <p>{mode.focus}</p>
        </div>
      </section>

      {showFixedWingPreset && (
        <section className="fixedwing-preset-card">
          <div className="fixedwing-preset-head">
            <div>
              <div className="coming-soon-kicker">대표 3D 프린터 기체 프리셋</div>
              <h3>Flightory 기준 기체 제원</h3>
              <p>공개 웹페이지 제원을 기반으로 시작하고, 주익 면적은 다음 단계에서 사진 + 윙스팬으로 추정합니다.</p>
            </div>
            <select value={fixedWingPreset.id} onChange={e => onFixedWingPresetChange(e.target.value)}>
              {FIXED_WING_PRESETS.map(preset => (
                <option key={preset.id} value={preset.id}>{preset.maker} {preset.name}</option>
              ))}
            </select>
          </div>

          <div className="fixedwing-preset-main">
            <div className="fixedwing-preset-summary">
              <span>{fixedWingPreset.maker}</span>
              <strong>{fixedWingPreset.name}</strong>
              <p>{fixedWingPreset.summary}</p>
              <a href={fixedWingPreset.sourceUrl} target="_blank" rel="noreferrer">
                공식 페이지
                <ExternalLink size={12} />
              </a>
            </div>
            <div className="fixedwing-spec-grid">
              {[
                ["윙스팬", `${(fixedWingPreset.wingspanM * 1000).toFixed(0)} mm`],
                ["전장", `${(fixedWingPreset.lengthM * 1000).toFixed(0)} mm`],
                ["중량(AUW)", `${fixedWingPreset.auwMinKg.toFixed(1)}-${fixedWingPreset.auwMaxKg.toFixed(1)} kg`],
                ["권장 속도", `${fixedWingPreset.speedMinKmh}-${fixedWingPreset.speedMaxKmh} km/h`],
                ["익형", fixedWingPreset.airfoil],
                ["주익 면적", "사진 기반 추정 예정"],
                ["형상", fixedWingPreset.type],
                ["재질", fixedWingPreset.material]
              ].map(([label, value]) => (
                <div key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          </div>

          <div className="fixedwing-next-row">
            <span>추진계</span>
            <strong>{fixedWingPreset.propulsion}</strong>
          </div>
        </section>
      )}

      <div className="coming-soon-grid">
        <section className="coming-soon-card">
          <h3>개발 예정 기능</h3>
          <div className="coming-soon-list">
            {mode.items.map(item => (
              <div key={item}>
                <Check size={14} strokeWidth={2.5} />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="coming-soon-card">
          <h3>진행 방향</h3>
          <div className="coming-soon-notes">
            {mode.notes.map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

const FixedWingPanel = ({
  mode,
  fixedWingPreset,
  onFixedWingPresetChange,
  powertrains,
  selectedPowertrain,
  selectedProp,
  selectedBattery,
  config,
  fixedWingCalc,
  onPowertrainChange,
  onPropChange,
  onBatteryChange,
  onConfigChange,
  onCustomBatteryChange
}) => {
  const ModeIcon = mode.Icon || Plane;
  const auwMeta = LEVEL_META[fixedWingCalc.auwStatus] || LEVEL_META.info;
  const cellMeta = fixedWingCalc.cellStatus === "ok" ? LEVEL_META.ok : LEVEL_META.warning;
  const batteryMeta = fixedWingCalc.batteryLoadPct >= 70 ? LEVEL_META.warning : LEVEL_META.ok;
  const loadMeta = fixedWingCalc.propulsionLoadPct >= 65 ? LEVEL_META.warning : LEVEL_META.ok;
  const AuwIcon = auwMeta.Icon || Info;
  const CellIcon = cellMeta.Icon || Info;
  const BatteryIcon = batteryMeta.Icon || Info;
  const LoadIcon = loadMeta.Icon || Info;
  const [setupTipOpen, setSetupTipOpen] = useState(false);

  return (
    <div className="fixedwing-shell">
      <section className="coming-soon-hero fixedwing-hero">
        <div className="coming-soon-icon">
          <ModeIcon size={24} strokeWidth={2.3} />
        </div>
        <div>
          <div className="coming-soon-kicker">베타 계산</div>
          <h2>{mode.title}</h2>
          <p>기체 프리셋과 추진계, 프로펠러, 배터리를 선택하면 권장 순항속도와 예상 항속시간을 1차 추정합니다.</p>
        </div>
      </section>

      <div className="app-layout fixedwing-layout">
        <div className="inputs-panel fixedwing-inputs-panel" style={{ width: 280, flexShrink: 0 }}>
          <Sec title="기체 프리셋" icon={Plane}>
            <div style={{ marginBottom: 8 }}>
              <span style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 4 }}>기체</span>
              <select value={fixedWingPreset.id} onChange={e => onFixedWingPresetChange(e.target.value)}
                style={{ width: "100%", border: "1px solid #cbd5e1", borderRadius: 6, padding: "5px 6px",
                  fontSize: 12, color: "#1e293b", background: "#f8fafc", outline: "none" }}>
                {FIXED_WING_PRESETS.map(preset => (
                  <option key={preset.id} value={preset.id}>{preset.maker} {preset.name}</option>
                ))}
              </select>
            </div>
            <div className="fixedwing-input-summary">
              <img src={fixedWingPreset.imageUrl} alt={`${fixedWingPreset.name} aircraft`} className="fixedwing-preset-thumb" />
              <div>
                <strong>{fixedWingPreset.name}</strong>
                <span>{fixedWingPreset.summary}</span>
                <a href={fixedWingPreset.sourceUrl} target="_blank" rel="noreferrer">
                  공식 페이지
                  <ExternalLink size={10} />
                </a>
              </div>
            </div>
            <button type="button" className="preset-tip-button" onClick={() => setSetupTipOpen(true)}>
              <Info size={13} strokeWidth={2.5} />
              사전 세팅 TIP
            </button>
            <div className="fixedwing-mini-spec">
              <span>윙스팬 <b>{(fixedWingPreset.wingspanM * 1000).toFixed(0)} mm</b></span>
              <span>전장 <b>{(fixedWingPreset.lengthM * 1000).toFixed(0)} mm</b></span>
              <span>권장 AUW <b>{fixedWingPreset.auwMinKg.toFixed(1)}-{fixedWingPreset.auwMaxKg.toFixed(1)} kg</b></span>
              <span>권장 속도 <b>{fixedWingPreset.speedMinKmh}-{fixedWingPreset.speedMaxKmh} km/h</b></span>
            </div>
          </Sec>

          <Sec title="추진계 / 프로펠러" icon={Zap}>
            <div style={{ marginBottom: 8 }}>
              <span style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 4 }}>추진계통</span>
              <select value={selectedPowertrain.id} onChange={e => onPowertrainChange(e.target.value)}
                style={{ width: "100%", border: "1px solid #cbd5e1", borderRadius: 6, padding: "5px 6px",
                  fontSize: 12, color: "#1e293b", background: "#f8fafc", outline: "none", marginBottom: 7 }}>
                {powertrains.map(item => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </select>
              <span style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 4 }}>프로펠러</span>
              <select value={selectedProp.id} onChange={e => onPropChange(e.target.value)}
                style={{ width: "100%", border: "1px solid #cbd5e1", borderRadius: 6, padding: "5px 6px",
                  fontSize: 12, color: "#1e293b", background: "#f8fafc", outline: "none" }}>
                {selectedPowertrain.props.map(prop => (
                  <option key={prop.id} value={prop.id}>{prop.label}</option>
                ))}
              </select>
            </div>
            <div className="fixedwing-selected-note">
              <span>모터 {selectedPowertrain.motorCount}개</span>
              <span>추진계 {selectedPowertrain.weightKg.toFixed(2)}kg</span>
              <span>{selectedPowertrain.cellMin}-{selectedPowertrain.cellMax}S 권장</span>
            </div>
          </Sec>

          <Sec title="배터리" icon={BatteryCharging}>
            <div style={{ marginBottom: 8 }}>
              <span style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 4 }}>배터리 프리셋</span>
              <select value={config.batteryId} onChange={e => onBatteryChange(e.target.value)}
                style={{ width: "100%", border: "1px solid #cbd5e1", borderRadius: 6, padding: "5px 6px",
                  fontSize: 12, color: "#1e293b", background: "#f8fafc", outline: "none" }}>
                {FIXED_WING_BATTERY_PRESETS.map(item => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </select>
            </div>
            {config.batteryId === "custom" && (
              <div className="fixedwing-custom-battery">
                <InputRow label="셀 수" unit="S" value={config.customBattery.cells} onChange={v => onCustomBatteryChange("cells", Math.round(v))} min={1} max={12} step={1} />
                <InputRow label="용량" unit="mAh" value={config.customBattery.mah} onChange={v => onCustomBatteryChange("mah", Math.round(v))} min={100} max={100000} step={100} />
                <InputRow label="무게" unit="kg" value={config.customBattery.kg} onChange={v => onCustomBatteryChange("kg", v)} min={0} max={5} step={0.01} />
                <InputRow label="방전률" unit="C" value={config.customBattery.cRate} onChange={v => onCustomBatteryChange("cRate", v)} min={1} max={100} step={1} />
              </div>
            )}
            <div className="fixedwing-selected-note">
              <span>전압 {fixedWingCalc.voltage.toFixed(1)}V</span>
              <span>에너지 {fixedWingCalc.batteryWh.toFixed(1)}Wh</span>
              <span>사용 가능 {fixedWingCalc.usableWh.toFixed(1)}Wh</span>
            </div>
          </Sec>

          <Sec title="임무 조건" icon={Target}>
            <InputRow label="페이로드" unit="kg" value={config.payloadKg} onChange={v => onConfigChange("payloadKg", v)} min={0} max={5} step={0.01} />
            <InputRow label="전자장비 전력" unit="W" value={config.avionicsW} onChange={v => onConfigChange("avionicsW", v)} min={0} max={200} step={1} />
            <InputRow label="배터리 예비" unit="%" value={config.reservePct} onChange={v => onConfigChange("reservePct", v)} min={0} max={60} step={1} />
            <div className="fixedwing-selected-note">
              <span>AUW {fixedWingCalc.towKg.toFixed(2)}kg</span>
              <span>예비 {config.reservePct.toFixed(0)}%</span>
            </div>
          </Sec>

          <Sec title="고급 설정" icon={Settings2} open={false}>
            <div className="fixedwing-model-note">
              <strong>현재 계산 모델</strong>
              <span>권장속도 범위와 기준 순항전력을 이용한 1차 추정입니다.</span>
              <span>주익 면적, 항력계수, 실측 로그를 넣으면 이후 보정 정확도를 높일 수 있습니다.</span>
            </div>
          </Sec>
        </div>

        <div className="results-panel fixedwing-results-panel">
          <div className="result-overview fixedwing-result-panel" style={{ padding: "12px 14px" }}>
          <div className="fixedwing-card-title">
            <span>결과</span>
            <strong>추천 순항속도와 항속시간</strong>
          </div>
          <div className="fixedwing-hero-metrics">
            <BigNum label="추천 순항속도" value={fixedWingCalc.cruiseKmh.toFixed(1)} unit="km/h" color="#0f766e" border featured
              sub={`${fixedWingPreset.speedMinKmh}-${fixedWingPreset.speedMaxKmh} km/h 권장 범위 내`} />
            <BigNum label="예상 항속시간" value={fixedWingCalc.enduranceMin.toFixed(0)} unit="분" color="#2563eb" border featured
              sub={`100% 사용 시 ${fixedWingCalc.fullEnduranceMin.toFixed(0)}분 · 예비 ${config.reservePct.toFixed(0)}%`} />
          </div>

          <div className="fixedwing-result-grid">
            <SmallCard label="예상 항속거리" value={fixedWingCalc.rangeKm} unit="km" />
            <SmallCard label="총 중량(AUW)" value={fixedWingCalc.towKg} unit="kg" />
            <SmallCard label="순항전력" value={fixedWingCalc.totalPowerW} unit="W" />
            <SmallCard label="배터리 전류" value={fixedWingCalc.currentA} unit="A" />
          </div>

          <div className="fixedwing-status-grid">
            {[
              [AuwIcon, auwMeta, "AUW", fixedWingCalc.auwStatus === "danger" ? "권장 최대중량 초과" : fixedWingCalc.auwStatus === "warning" ? "권장 최대중량에 가까움" : "권장 범위 내"],
              [CellIcon, cellMeta, "전압", fixedWingCalc.cellStatus === "ok" ? "추진계 권장 셀 수 적합" : "추진계 권장 셀 수 확인"],
              [BatteryIcon, batteryMeta, "배터리 부하", `정격의 ${fixedWingCalc.batteryLoadPct.toFixed(0)}% 사용`],
              [LoadIcon, loadMeta, "추진계 부하", `연속출력의 ${fixedWingCalc.propulsionLoadPct.toFixed(0)}% 순항`]
            ].map(([Icon, meta, title, detail]) => (
              <div key={title} style={{ background: meta.bg, borderColor: meta.soft }}>
                <Icon size={14} strokeWidth={2.7} style={{ color: meta.color }} />
                <span>
                  <strong>{title}</strong>
                  <small>{detail}</small>
                </span>
              </div>
            ))}
          </div>

          <div className="fixedwing-formula-strip">
            <span>모델: 권장속도 범위 + 기준 순항전력 보정</span>
            <span>추진전력 {fixedWingCalc.propulsionPowerW.toFixed(0)}W + 전자장비 {config.avionicsW.toFixed(0)}W</span>
            <span>정확도는 주익 면적/실측 로그 추가 후 보정 예정</span>
          </div>
          </div>

          <section className="fixedwing-preset-card">
            <div className="fixedwing-preset-head">
              <div>
                <div className="coming-soon-kicker">선택 기체 제원</div>
                <h3>{fixedWingPreset.maker} {fixedWingPreset.name}</h3>
                <p>공개 웹페이지 제원을 기반으로 시작하고, 주익 면적은 다음 단계에서 사진 + 윙스팬으로 보정합니다.</p>
              </div>
            </div>
            <div className="fixedwing-spec-grid">
              {[
                ["윙스팬", `${(fixedWingPreset.wingspanM * 1000).toFixed(0)} mm`],
                ["전장", `${(fixedWingPreset.lengthM * 1000).toFixed(0)} mm`],
                ["권장 AUW", `${fixedWingPreset.auwMinKg.toFixed(1)}-${fixedWingPreset.auwMaxKg.toFixed(1)} kg`],
                ["권장 속도", `${fixedWingPreset.speedMinKmh}-${fixedWingPreset.speedMaxKmh} km/h`],
                ["익형", fixedWingPreset.airfoil],
                ["주익 면적", "사진 기반 추정 예정"],
                ["형상", fixedWingPreset.type],
                ["재질", fixedWingPreset.material]
              ].map(([label, value]) => (
                <div key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          </section>

          <div className="coming-soon-grid">
            <section className="coming-soon-card">
              <h3>다음 보정 항목</h3>
              <div className="coming-soon-list">
                {mode.items.map(item => (
                  <div key={item}>
                    <Check size={14} strokeWidth={2.5} />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="coming-soon-card">
              <h3>진행 방향</h3>
              <div className="coming-soon-notes">
                {mode.notes.map(([label, value]) => (
                  <div key={label}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
      {setupTipOpen && (
        <div className="setup-tip-backdrop" role="dialog" aria-modal="true" aria-labelledby="fixedwing-setup-tip-title">
          <div className="setup-tip-modal">
            <div className="setup-tip-header">
              <span>Fixed-wing Preset Guide</span>
              <button type="button" onClick={() => setSetupTipOpen(false)} aria-label="닫기">
                <X size={18} strokeWidth={2.4} />
              </button>
            </div>

            <div className="setup-tip-body">
              <section className="setup-tip-section">
                <div className="setup-tip-kicker">① 무게중심(CG) 먼저 맞추기</div>
                <h2 id="fixedwing-setup-tip-title">초도비행 전 사전 세팅 TIP</h2>
                <p>
                  고정익은 항속시간보다 <b>무게중심(CG)</b>이 먼저입니다. 처음에는 매뉴얼의 권장 CG를 기준으로 잡고,
                  확실하지 않다면 약간 기수가 무거운 상태에서 시작하는 편이 안전합니다.
                </p>
                <div className="cg-balance-grid" aria-label="손가락 지지 기준 무게중심 상태">
                  {[
                    ["nose", "Nose heavy", "기수가 아래로 많이 내려감", "초도비행은 가능하지만 조종이 둔해질 수 있음", -8, "#2563eb"],
                    ["good", "Good C.G.", "거의 수평 또는 기수 살짝 아래", "처음 맞춰볼 때 가장 좋은 출발점", 0, "#0f766e"],
                    ["tail", "Tail heavy", "꼬리가 아래로 내려감", "피치가 예민하고 실속 회복이 어려울 수 있음", 8, "#dc2626"]
                  ].map(([state, title, subtitle, detail, angle, color]) => (
                    <div className={`cg-balance-card cg-balance-${state}`} key={state}>
                      <svg viewBox="0 0 340 152" role="img" aria-label={`${title} 무게중심 확인 그림`}>
                        <g transform={`rotate(${angle} 170 72)`}>
                          <path d="M36 66 L195 66 L300 78 L195 90 L36 90 C19 85 19 71 36 66Z" fill="#ffffff" stroke="#334155" strokeWidth="2.2" />
                          <path d="M104 55 C139 36 207 38 253 62 C191 72 137 72 94 64Z" fill="#ef4444" stroke="#991b1b" strokeWidth="1.4" />
                          <path d="M205 66 L315 43 L328 53 L227 78 Z" fill="#f8fafc" stroke="#334155" strokeWidth="1.7" />
                          <path d="M205 90 L315 113 L328 103 L227 78 Z" fill="#f8fafc" stroke="#334155" strokeWidth="1.7" />
                          <circle cx="38" cy="78" r="7" fill="#0f172a" />
                          <rect x="78" y="74" width="44" height="10" rx="3" fill="#f59e0b" />
                          <line x1="144" y1="51" x2="196" y2="51" stroke="#64748b" strokeWidth="1.6" />
                          <line x1="144" y1="45" x2="144" y2="58" stroke="#64748b" strokeWidth="1.6" />
                          <line x1="196" y1="45" x2="196" y2="58" stroke="#64748b" strokeWidth="1.6" />
                          <text x="170" y="43" textAnchor="middle" fontSize="10" fontWeight="800" fill="#475569">C.G. Range</text>
                          <line x1="138" y1="103" x2="216" y2="103" stroke={color} strokeWidth="5" strokeLinecap="round" />
                        </g>
                        <path d="M154 98 C154 89 162 84 170 84 C178 84 186 89 186 98 L186 143 L154 143 Z" fill="#ffd6bf" stroke="#eab08d" strokeWidth="1.5" />
                        <path d="M155 142 L187 142" stroke="#eab08d" strokeWidth="2" />
                        <line x1="170" y1="52" x2="170" y2="124" stroke="#0f766e" strokeWidth="2" strokeDasharray="4 4" />
                        <rect x="128" y="18" width="84" height="25" rx="13" fill={`${color}18`} stroke={color} />
                        <text x="170" y="35" textAnchor="middle" fontSize="13" fontWeight="900" fill={color}>{title}</text>
                      </svg>
                      <strong>{subtitle}</strong>
                      <span>{detail}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="setup-tip-section">
                <div className="setup-tip-kicker">② 배터리 위치로 조정</div>
                <div className="setup-tip-split">
                  <div>
                    <h3>기수가 살짝 내려가면 출발점으로 좋습니다</h3>
                    <p>
                      손가락이나 CG 스탠드로 권장 CG 위치를 받쳤을 때 기수가 살짝 내려가는 정도를 먼저 목표로 잡습니다.
                      꼬리가 무거우면 피치가 예민해지고 실속 회복이 어려워질 수 있습니다.
                    </p>
                  </div>
                  <div className="balance-diagram">
                    <svg viewBox="0 0 360 160" role="img" aria-label="배터리 위치와 무게중심 조정 개념도">
                      <path d="M40 72 L230 72 L312 86 L230 100 L40 100 C24 94 24 78 40 72Z" fill="#eef2ff" stroke="#475569" strokeWidth="2" />
                      <rect x="72" y="79" width="68" height="16" rx="4" fill="#f59e0b" />
                      <text x="106" y="68" textAnchor="middle" fontSize="11" fontWeight="800" fill="#b45309">배터리</text>
                      <line x1="155" y1="50" x2="155" y2="124" stroke="#0f766e" strokeWidth="2" />
                      <circle cx="155" cy="86" r="12" fill="#0f766e" />
                      <text x="155" y="90" textAnchor="middle" fontSize="10" fontWeight="800" fill="#fff">CG</text>
                      <path d="M85 124 L50 144 L120 144 Z" fill="#cbd5e1" />
                      <path d="M155 124 L120 144 L190 144 Z" fill="#0f766e" opacity="0.75" />
                      <path d="M250 124 L215 144 L285 144 Z" fill="#cbd5e1" />
                      <path d="M88 112 L122 112" stroke="#b45309" strokeWidth="2.5" markerEnd="url(#arrowTip)" />
                      <defs>
                        <marker id="arrowTip" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                          <path d="M0 0 L8 4 L0 8 Z" fill="#b45309" />
                        </marker>
                      </defs>
                    </svg>
                  </div>
                </div>
              </section>

              <section className="setup-tip-section">
                <div className="setup-tip-kicker">③ 초도비행 체크리스트</div>
                <div className="setup-tip-checkgrid">
                  {[
                    ["CG", "권장 CG에서 받쳤을 때 기수가 살짝 아래로"],
                    ["조종면", "엘리베이터/에일러론/러더 방향 확인"],
                    ["프로펠러", "회전 방향과 고정 상태 확인"],
                    ["트림", "초도비행 후 트림이 크면 CG 재확인"],
                    ["스로틀", "순항은 여유 있게, 이륙은 충분한 출력 확보"],
                    ["비행장", "넓고 바람이 약한 곳에서 첫 테스트"]
                  ].map(([label, text]) => (
                    <div key={label}>
                      <Check size={15} strokeWidth={2.7} />
                      <span>
                        <strong>{label}</strong>
                        <small>{text}</small>
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="setup-tip-section setup-tip-formula">
                <div>
                  <strong>나중에 넣을 CG 계산식</strong>
                  <span>현재 CG 위치 = Σ(부품 무게 × 기준점 거리) / Σ(부품 무게)</span>
                </div>
                <p>Stork/Stallion 매뉴얼의 기준 CG 값을 넣으면, 배터리 위치를 얼마나 앞뒤로 옮길지까지 추천할 수 있습니다.</p>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ── main ── */

export default function App() {
  const [activeMode, setActiveMode] = useState("multicopter");
  const [fixedWingPresetId, setFixedWingPresetId] = useState("flightory-stork");
  const [fixedWingConfig, setFixedWingConfig] = useState(() => getFixedWingDefaultConfig("flightory-stork"));
  const [p, setP] = useState(INIT);
  const [batt, setBatt] = useState(INIT_BATT);
  const [esc, setEsc] = useState(INIT_ESC);
  const [solar, setSolar] = useState(INIT_SOLAR);
  const [equip, setEquip] = useState(INIT_EQUIP);
  const [nextId, setNextId] = useState(100);
  const [tab, setTab] = useState("curve");
  const [vehiclePresetId, setVehiclePresetId] = useState("holybro-x500-v2");
  const [motorCombos, setMotorCombos] = useState([]);
  const [motorDataError, setMotorDataError] = useState("");
  const [motorMaker, setMotorMaker] = useState("");
  const [comboId, setComboId] = useState("");
  const [directMotor, setDirectMotor] = useState(INIT_DIRECT_MOTOR);
  const [logName, setLogName] = useState("");
  const [measuredMin, setMeasuredMin] = useState("");
  const [applyCalibration, setApplyCalibration] = useState(false);
  const [calibrationOpen, setCalibrationOpen] = useState(false);
  const [flightLogs, setFlightLogs] = useState(() => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(window.localStorage.getItem(LOG_STORAGE_KEY) || "[]");
    } catch {
      return [];
    }
  });

  const set = useCallback((k, v) => setP(prev => ({ ...prev, [k]: isNaN(v) ? prev[k] : v })), []);
  const setB = useCallback((k, v) => setBatt(prev => ({ ...prev, [k]: isNaN(v) ? prev[k] : v })), []);
  const setE = useCallback((k, v) => setEsc(prev => ({ ...prev, [k]: isNaN(v) ? prev[k] : v })), []);
  const setS = useCallback((k, v) => setSolar(prev => ({ ...prev, [k]: isNaN(v) ? prev[k] : v })), []);
  const setD = useCallback((k, v) => setDirectMotor(prev => ({ ...prev, [k]: isNaN(v) ? prev[k] : v })), []);
  const setFW = useCallback((k, v) => setFixedWingConfig(prev => ({ ...prev, [k]: isNaN(v) ? prev[k] : v })), []);
  const setFWBattery = useCallback((k, v) => setFixedWingConfig(prev => ({
    ...prev,
    customBattery: { ...prev.customBattery, [k]: isNaN(v) ? prev.customBattery[k] : v }
  })), []);

  const battV = batt.cells * CELL_V;
  const battWh = battV * batt.mah / 1000;
  const battWhKg = batt.kg > 0 ? battWh / batt.kg : 0;
  const batteryMaxCurrentA = (batt.mah / 1000) * batt.cRate;
  const pCalc = useMemo(() => ({ ...p, escWireKg: esc.kg }), [p, esc.kg]);

  const totalBattKg = batt.kg;
  const eqPayload = equip.filter(e => e.on).reduce((s, e) => s + e.kg, 0);
  const eqPower = equip.filter(e => e.on).reduce((s, e) => s + e.w, 0);
  const solarKg = solar.on ? solar.kg : 0;
  const solarW = solar.on ? solar.watts * (solar.weatherPct / 100) : 0;

  // TOW includes battery weight
  const fullPayload = totalBattKg + eqPayload + solarKg;
  const r = useMemo(() => calc(pCalc, battWh, fullPayload, eqPower, solarW), [pCalc, battWh, fullPayload, eqPower, solarW]);
  const selectedCombo = useMemo(() => motorCombos.find(c => c.id === comboId), [motorCombos, comboId]);
  const motorMakers = useMemo(() => [...new Set(motorCombos.map(c => c.maker))], [motorCombos]);
  const makerCombos = useMemo(() => motorCombos.filter(c => c.maker === motorMaker), [motorCombos, motorMaker]);
  const tableCalc = useMemo(() => {
    if (!selectedCombo) return null;
    const requiredThrustG = (r.tow / p.rotors) * 1000;
    const hover = interpolateByThrust(selectedCombo.test, requiredThrustG);
    if (!hover) return null;
    const motorCurrentA = hover.currentA * p.rotors;
    const grossPowerW = hover.powerW * p.rotors + p.avW + eqPower;
    const totalPowerW = Math.max(grossPowerW - solarW, 1);
    const batteryCurrentA = battV > 0 ? totalPowerW / battV : 0;
    const capacityAh = batt.mah / 1000;
    const fullMinByCurrent = batteryCurrentA > 0 ? (capacityAh / batteryCurrentA) * 60 : 0;
    const fullMinByPower = totalPowerW > 0 ? (battWh / totalPowerW) * 60 : 0;
    const maxThrustG = Math.max(...selectedCombo.test.map(row => row.thrustG));
    return {
      ...hover,
      requiredThrustG,
      motorCurrentA,
      batteryCurrentA,
      grossPowerW,
      totalPowerW,
      mFull: fullMinByPower || fullMinByCurrent,
      m90: (fullMinByPower || fullMinByCurrent) * 0.9,
      thrustMarginPct: ((maxThrustG - requiredThrustG) / Math.max(requiredThrustG, 1)) * 100,
      escMarginPct: ((esc.continuousA - hover.currentA) / Math.max(hover.currentA, 0.01)) * 100,
      voltageMismatch: batt.cells !== selectedCombo.cells
    };
  }, [selectedCombo, r.tow, p.rotors, p.avW, eqPower, solarW, batt.mah, battWh, battV, batt.cells, esc.continuousA]);
  const directSpecCalc = useMemo(() => {
    if (selectedCombo || directMotor.thrustN50 <= 0 || directMotor.powerW50 <= 0) return null;
    const requiredThrustN = (r.tow * G) / Math.max(p.rotors, 1);
    const thrustRatio = requiredThrustN / Math.max(directMotor.thrustN50, 0.001);
    const throttle = 50 * Math.sqrt(Math.max(thrustRatio, 0));
    const powerPerRotorW = directMotor.powerW50 * Math.pow(Math.max(thrustRatio, 0), 1.5);
    const grossPowerW = powerPerRotorW * p.rotors + p.avW + eqPower;
    const totalPowerW = Math.max(grossPowerW - solarW, 1);
    const batteryCurrentA = battV > 0 ? totalPowerW / battV : 0;
    const currentA = battV > 0 ? powerPerRotorW / battV : 0;
    const maxThrustN = directMotor.thrustN50 * 4;
    const mFull = totalPowerW > 0 ? (battWh / totalPowerW) * 60 : 0;
    return {
      source: "direct50",
      throttle,
      powerW: powerPerRotorW,
      currentA,
      requiredThrustN,
      requiredThrustG: (requiredThrustN / G) * 1000,
      motorCurrentA: currentA * p.rotors,
      batteryCurrentA,
      grossPowerW,
      totalPowerW,
      mFull,
      m90: mFull * 0.9,
      thrustMarginPct: ((maxThrustN - requiredThrustN) / Math.max(requiredThrustN, 0.001)) * 100,
      escMarginPct: ((esc.continuousA - currentA) / Math.max(currentA, 0.01)) * 100,
      limited: requiredThrustN > maxThrustN ? "high" : null,
      voltageMismatch: directMotor.cells > 0 && directMotor.cells !== batt.cells
    };
  }, [selectedCombo, directMotor, r.tow, p.rotors, p.avW, eqPower, solarW, battV, battWh, batt.cells, esc.continuousA]);
  const motorCalc = tableCalc || directSpecCalc;
  const estimate90 = motorCalc?.m90 || r.m90;
  const estimatedBatteryCurrentA = motorCalc?.batteryCurrentA || (battV > 0 ? r.tW / battV : 0);
  const batteryLoadPct = batteryMaxCurrentA > 0
    ? (estimatedBatteryCurrentA / batteryMaxCurrentA) * 100
    : 0;
  const hoverThrottle = motorCalc?.throttle;
  const decisionItems = useMemo(() => {
    const items = [];
    const add = (level, title, detail) => items.push({ level, title, detail });

    if (motorCalc) {
      const sourceName = selectedCombo ? "제조사 추력표" : "50% 기준 입력값";
      if (motorCalc.limited === "high") add("danger", "추력 부족", `요구 추력이 ${sourceName}으로 추정한 최대 추력을 넘습니다.`);
      else if (motorCalc.thrustMarginPct < 30) add("warning", "추력 여유 낮음", `추력 여유가 ${motorCalc.thrustMarginPct.toFixed(0)}%입니다.`);
      else add("ok", "추력 여유 충분", `추력 여유 ${motorCalc.thrustMarginPct.toFixed(0)}%`);

      if (motorCalc.escMarginPct < 20) add("danger", "ESC 연속전류 여유 부족", `ESC 여유가 ${motorCalc.escMarginPct.toFixed(0)}%입니다.`);
      else if (motorCalc.escMarginPct < 50) add("warning", "ESC 연속전류 여유 확인", `ESC 여유 ${motorCalc.escMarginPct.toFixed(0)}%`);
      else add("ok", "ESC 전류 여유 충분", `ESC 여유 ${motorCalc.escMarginPct.toFixed(0)}%`);

      if (hoverThrottle >= 75) add("warning", "호버 스로틀 높음", `예상 호버 스로틀 ${hoverThrottle.toFixed(0)}%`);
      else if (hoverThrottle) add("ok", "호버 스로틀 양호", `예상 호버 스로틀 ${hoverThrottle.toFixed(0)}%`);

      if (motorCalc.voltageMismatch) {
        add("warning", selectedCombo ? "추력표 전압 불일치" : "시험 전압 불일치",
          selectedCombo ? "배터리 전압과 선택한 추력표 전압이 다릅니다." : "배터리 셀 수와 입력한 제조사 시험 셀 수가 다릅니다.");
      }
    } else {
      add("info", "모터 성능 기준 미입력", "추력표를 선택하거나 제조사 50% 추력/전력을 입력하면 판정이 더 정확해집니다.");
    }

    if (batteryMaxCurrentA <= 0) add("warning", "배터리 C-rate 확인 필요", "배터리 C-rate가 0이거나 비어 있습니다.");
    else if (batteryLoadPct >= 80) add("danger", "배터리 방전부하 위험", `정격 최대전류의 ${batteryLoadPct.toFixed(0)}%를 사용합니다.`);
    else if (batteryLoadPct >= 50) add("warning", "배터리 방전부하 주의", `정격 최대전류의 ${batteryLoadPct.toFixed(0)}%를 사용합니다.`);
    else add("ok", "배터리 방전부하 양호", `예상 ${estimatedBatteryCurrentA.toFixed(1)}A / 정격 최대 ${batteryMaxCurrentA.toFixed(0)}A`);

    if (r.tW <= 1 && solarW > 0) add("warning", "발전량 과대 가능", "태양전지 발전량이 소비전력을 거의 상쇄합니다. 실제 조건을 확인하세요.");

    return items;
  }, [selectedCombo, motorCalc, hoverThrottle, batteryMaxCurrentA, estimatedBatteryCurrentA, batteryLoadPct, r.tW, solarW]);
  const decisionSummary = useMemo(() => {
    if (decisionItems.some(item => item.level === "danger")) {
      return {
        level: "danger",
        title: "조합 재검토 필요",
        detail: "위험 항목이 있어 모터, ESC, 배터리 조건을 다시 확인해야 합니다."
      };
    }
    if (decisionItems.some(item => item.level === "warning")) {
      return {
        level: "warning",
        title: "주의해서 사용",
        detail: "비행은 가능해 보이지만 여유가 낮은 항목을 확인하는 편이 좋습니다."
      };
    }
    if (decisionItems.some(item => item.level === "info")) {
      return {
        level: "info",
        title: "모터 성능 입력 권장",
        detail: "제조사 추력표 또는 50% 기준값을 입력하면 스로틀, 전류, 추력 여유 판정이 더 정확해집니다."
      };
    }
    return {
      level: "ok",
      title: "현재 조합 양호",
      detail: "입력된 조건 기준으로 추력, ESC, 배터리 부하가 적정 범위입니다."
    };
  }, [decisionItems]);
  const decisionStyle = LEVEL_META[decisionSummary.level] || LEVEL_META.info;
  const calibrationFactor = useMemo(() => {
    const ratios = flightLogs
      .filter(log => log.measuredMin > 0 && log.estimatedMin > 0)
      .map(log => log.measuredMin / log.estimatedMin);
    if (!ratios.length) return 1;
    return ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length;
  }, [flightLogs]);
  const calibrated90 = estimate90 * calibrationFactor;

  useEffect(() => {
    window.localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(flightLogs));
  }, [flightLogs]);

  useEffect(() => {
    const currentIcon = document.querySelector("link[rel~='icon']");
    const favicon = currentIcon || document.createElement("link");
    favicon.rel = "icon";
    favicon.type = "image/png";
    favicon.href = sentieryIcon;
    if (!currentIcon) document.head.appendChild(favicon);
  }, []);

  useEffect(() => {
    let alive = true;
    loadMotorPresetCsv()
      .then(combos => {
        if (!alive) return;
        setMotorCombos(combos);
        const defaultCombo = combos.find(combo => combo.id === DEFAULT_MOTOR_COMBO_ID);
        setMotorMaker(defaultCombo?.maker || combos[0]?.maker || "");
        setComboId(defaultCombo?.id || "");
        setMotorDataError("");
      })
      .catch(error => {
        if (!alive) return;
        setMotorDataError(error.message);
      });
    return () => { alive = false; };
  }, []);

  // payload curve: vary equipment payload from 0 to max
  const maxPl = Math.max(5, eqPayload + 2);
  const curve = useMemo(() => {
    const pts = [];
    for (let pl = 0; pl <= maxPl; pl += 0.05) {
      const res = calc(pCalc, battWh, totalBattKg + pl + solarKg, eqPower, solarW);
      pts.push({ payload: +pl.toFixed(2), time: Math.max(0, +res.m90.toFixed(1)) });
    }
    return pts;
  }, [pCalc, battWh, totalBattKg, eqPower, maxPl, solarKg, solarW]);

  // cumulative equipment scenario
  const cumData = useMemo(() => {
    const enabled = equip.filter(e => e.on);
    const base = calc(pCalc, battWh, totalBattKg + solarKg, 0, solarW);
    const data = [{ name: "기본 기체", time: +base.m90.toFixed(1), tow: +base.tow.toFixed(2), power: +base.tW.toFixed(0), color: "#3b82f6" }];
    let ck = 0, cw = 0;
    const colors = ["#8b5cf6","#06b6d4","#f59e0b","#ef4444","#ec4899","#14b8a6","#f97316","#6366f1","#84cc16"];
    enabled.forEach((e, i) => {
      ck += e.kg; cw += e.w;
      const res = calc(pCalc, battWh, totalBattKg + solarKg + ck, cw, solarW);
      data.push({ name: `+ ${e.name}`, time: +res.m90.toFixed(1), tow: +res.tow.toFixed(2), power: +res.tW.toFixed(0), color: colors[i % colors.length] });
    });
    return data;
  }, [pCalc, battWh, totalBattKg, solarKg, solarW, equip]);

  // equipment handlers
  const toggleEq = (id) => setEquip(prev => prev.map(e => e.id === id ? { ...e, on: !e.on } : e));
  const removeEq = (id) => setEquip(prev => prev.filter(e => e.id !== id));
  const updateEq = (id, k, v) => setEquip(prev => prev.map(e => e.id === id ? { ...e, [k]: v } : e));
  const addEq = () => {
    setEquip(prev => [...prev, { id: nextId, name: "", kg: 0, w: 0, on: true }]);
    setNextId(n => n + 1);
  };
  const applyVehiclePreset = (id) => {
    setVehiclePresetId(id);
    const preset = VEHICLE_PRESETS.find(item => item.id === id);
    if (!preset) return;
    setP(prev => ({ ...prev, ...preset.p }));
    setBatt(prev => ({ ...prev, ...preset.batt }));
    setEsc(prev => ({ ...prev, ...preset.esc }));
    if (preset.comboId) {
      const combo = motorCombos.find(item => item.id === preset.comboId);
      setMotorMaker(combo?.maker || "");
      setComboId(preset.comboId);
    } else {
      setComboId("");
    }
  };
  const applyFixedWingPreset = (id) => {
    setFixedWingPresetId(id);
    setFixedWingConfig(getFixedWingDefaultConfig(id));
  };
  const applyFixedWingPowertrain = (id) => {
    const powertrain = FIXED_WING_POWERTRAINS.find(item => item.id === id);
    setFixedWingConfig(prev => ({
      ...prev,
      powertrainId: id,
      propId: powertrain?.props?.[0]?.id || prev.propId
    }));
  };
  const applyFixedWingProp = (id) => setFixedWingConfig(prev => ({ ...prev, propId: id }));
  const applyFixedWingBattery = (id) => setFixedWingConfig(prev => ({ ...prev, batteryId: id }));
  const addFlightLog = () => {
    const measured = Number(measuredMin);
    if (!measured || measured <= 0) return;
    const entry = {
      id: Date.now(),
      name: logName.trim() || `Test ${flightLogs.length + 1}`,
      measuredMin: measured,
      estimatedMin: +estimate90.toFixed(2),
      towKg: +r.tow.toFixed(3),
      battery: `${batt.cells}S ${(batt.mah / 1000).toFixed(1)}Ah`,
      combo: selectedCombo ? getComboLabel(selectedCombo) : directSpecCalc ? "직접 입력 50% 스펙 기준" : "직접 입력",
      createdAt: new Date().toISOString()
    };
    setFlightLogs(prev => [entry, ...prev].slice(0, 12));
    setMeasuredMin("");
    setLogName("");
    setCalibrationOpen(true);
  };
  const removeFlightLog = (id) => setFlightLogs(prev => prev.filter(log => log.id !== id));

  const applyCombo = (id) => {
    setComboId(id);
    const combo = motorCombos.find(c => c.id === id);
    if (!combo) return;
    setP(prev => ({
      ...prev,
      motorPropKg: +(combo.motorWeightKg + combo.propWeightKg).toFixed(3),
      propInch: combo.propInch
    }));
    setBatt(prev => ({ ...prev, cells: combo.cells }));
    setEsc(prev => ({ ...prev, continuousA: Math.max(prev.continuousA, combo.maxCurrentA) }));
  };

  const resetAll = () => {
    setP(INIT);
    setBatt(INIT_BATT);
    setEsc(INIT_ESC);
    setSolar(INIT_SOLAR);
    setDirectMotor(INIT_DIRECT_MOTOR);
    setEquip(INIT_EQUIP);
    setVehiclePresetId("holybro-x500-v2");
    const defaultCombo = motorCombos.find(combo => combo.id === DEFAULT_MOTOR_COMBO_ID);
    setMotorMaker(defaultCombo?.maker || motorCombos[0]?.maker || "");
    setComboId(defaultCombo?.id || "");
  };

  const shown90 = applyCalibration && flightLogs.length ? calibrated90 : estimate90;
  const showCalibrationDetails = calibrationOpen;
  const tc = shown90 > 25 ? TIME_COLORS.good : shown90 > 15 ? TIME_COLORS.caution : shown90 > 8 ? TIME_COLORS.low : TIME_COLORS.danger;
  const DecisionIcon = decisionStyle.Icon || Info;

  const weights = [
    { name: "프레임", val: p.frameKg, col: "#64748b" },
    { name: "전자부품", val: p.elecKg, col: "#8b5cf6" },
    { name: "모터+프롭", val: r.mT, col: "#3b82f6" },
    { name: "ESC+배선", val: r.eT, col: "#06b6d4" },
    { name: "배터리", val: totalBattKg, col: "#f59e0b" },
    { name: "태양전지", val: solarKg, col: "#22c55e" },
    { name: "오차", val: p.errKg, col: "#94a3b8" },
    { name: "임무장비", val: eqPayload, col: "#ef4444" },
  ];
  const towDisplay = r.tow;
  const currentPresetName = VEHICLE_PRESETS.find(preset => preset.id === vehiclePresetId)?.name || "직접 입력";
  const activeModeMeta = VEHICLE_MODE_META[activeMode] || VEHICLE_MODE_META.multicopter;
  const isMulticopterMode = activeMode === "multicopter";
  const fixedWingPreset = FIXED_WING_PRESETS.find(preset => preset.id === fixedWingPresetId) || FIXED_WING_PRESETS[0];
  const fixedWingPowertrains = useMemo(
    () => FIXED_WING_POWERTRAINS.filter(item => item.presetId === fixedWingPreset.id),
    [fixedWingPreset.id]
  );
  const selectedFixedWingPowertrain = fixedWingPowertrains.find(item => item.id === fixedWingConfig.powertrainId)
    || fixedWingPowertrains[0]
    || FIXED_WING_POWERTRAINS[0];
  const selectedFixedWingProp = selectedFixedWingPowertrain.props.find(prop => prop.id === fixedWingConfig.propId)
    || selectedFixedWingPowertrain.props[0];
  const selectedFixedWingBattery = useMemo(() => getFixedWingBattery(fixedWingConfig), [fixedWingConfig]);
  const fixedWingCalc = useMemo(
    () => calcFixedWing(fixedWingPreset, selectedFixedWingPowertrain, selectedFixedWingProp, selectedFixedWingBattery, fixedWingConfig),
    [fixedWingPreset, selectedFixedWingPowertrain, selectedFixedWingProp, selectedFixedWingBattery, fixedWingConfig]
  );
  const headerChips = isMulticopterMode
    ? [
      currentPresetName,
      `${p.rotors}로터`,
      `${batt.cells}S ${batt.mah.toLocaleString()}mAh`,
      selectedCombo ? `${selectedCombo.maker} 추력표` : directSpecCalc ? "50% 스펙 기준" : "직접 입력 추력"
    ]
    : activeMode === "fixedwing"
      ? [
        `${fixedWingPreset.maker} ${fixedWingPreset.name}`,
        selectedFixedWingPowertrain.shortLabel,
        `${selectedFixedWingBattery.cells}S ${selectedFixedWingBattery.mah.toLocaleString()}mAh`,
        `추천 ${fixedWingCalc.cruiseKmh.toFixed(0)}km/h · ${fixedWingCalc.enduranceMin.toFixed(0)}분`
      ]
      : [activeModeMeta.badge, "기획 중", activeModeMeta.subtitle];

  return (
    <div className="app-root" style={{ fontFamily: "'Inter',-apple-system,system-ui,sans-serif", background: "linear-gradient(180deg,#eef7f8 0%,#f8fafc 34%,#eef2f7 100%)", minHeight: "100vh" }}>
      {/* header */}
      <div className="app-header" style={{ background: "linear-gradient(135deg,#0f172a 0%,#164e63 58%,#0f766e 100%)", padding: "14px 22px", color: "white",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div style={{ minWidth: 0 }}>
          <h1 className="app-title" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 18, fontWeight: 700, margin: 0, letterSpacing: 0 }}>
            <span className="brand-icon-frame">
              <img src={sentieryIcon} alt="" className="brand-icon" />
            </span>
            {activeModeMeta.title}
          </h1>
          <p className="app-subtitle" style={{ fontSize: 11, opacity: 1, margin: "3px 0 0" }}>{activeModeMeta.subtitle}</p>
          <div className="header-context">
            {headerChips.map(chip => (
              <span className="header-chip" key={chip}>{chip}</span>
            ))}
          </div>
        </div>
        <div className="header-actions">
          <div className="brand-signature" aria-label="Sentiery">
            <img src={sentieryLogoEn} alt="Sentiery" className="brand-signature-logo" />
          </div>
          {isMulticopterMode && (
            <button className="reset-button" onClick={resetAll} style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)",
              color: "white", padding: "5px 12px", borderRadius: 6, fontSize: 11, cursor: "pointer",
              display: "inline-flex", alignItems: "center", gap: 5 }}>
              <RotateCcw size={13} />
              초기화
            </button>
          )}
        </div>
      </div>

      <div className="mode-switcher" role="tablist" aria-label="Aircraft calculator mode">
        {Object.values(VEHICLE_MODE_META).map(mode => {
          const ModeIcon = mode.Icon;
          const active = activeMode === mode.id;
          return (
            <button key={mode.id} className={`mode-tab${active ? " mode-tab-active" : ""}`}
              onClick={() => setActiveMode(mode.id)} role="tab" aria-selected={active}>
              <ModeIcon size={16} strokeWidth={2.3} />
              <span>{mode.label}</span>
              <small>{mode.badge}</small>
            </button>
          );
        })}
      </div>

      {isMulticopterMode ? (
      <>
      <div className="mobile-quick-summary" style={{ background: "white", border: `1px solid ${decisionStyle.soft}`, borderRadius: 10,
        padding: 12, margin: "8px 8px 0", boxShadow: "0 8px 24px rgba(15,23,42,0.06)" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
          <span style={{ width: 28, height: 28, borderRadius: 7, background: decisionStyle.bg, color: decisionStyle.color,
            display: "grid", placeItems: "center", flexShrink: 0 }}>
            <DecisionIcon size={16} strokeWidth={2.6} />
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>{decisionSummary.title}</div>
            <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.4 }}>{decisionSummary.detail}</div>
          </div>
        </div>
        <div className="mobile-summary-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 6 }}>
          <SmallCard label="예상 시간" value={shown90} unit="분" />
          <SmallCard label="이륙중량" value={towDisplay} unit="kg" />
          <SmallCard label="방전부하" value={batteryLoadPct} unit="%" />
        </div>
      </div>

      <div className="app-layout" style={{ display: "flex", gap: 10, padding: 10, maxWidth: 1400, margin: "0 auto" }}>
        {/* ─── LEFT ─── */}
        <div className="inputs-panel" style={{ width: 280, flexShrink: 0 }}>
          <Sec title="기체 구성" icon={SlidersHorizontal}>
            <div style={{ marginBottom: 8 }}>
              <span style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 4 }}>기체 프리셋</span>
              <select value={vehiclePresetId} onChange={e => applyVehiclePreset(e.target.value)}
                style={{ width: "100%", border: "1px solid #cbd5e1", borderRadius: 6, padding: "5px 6px",
                  fontSize: 12, color: "#1e293b", background: "#f8fafc", outline: "none" }}>
                <option value="">직접 입력</option>
                {VEHICLE_PRESETS.map(preset => (
                  <option key={preset.id} value={preset.id}>{preset.name}</option>
                ))}
              </select>
              {vehiclePresetId && (
                <div style={{ fontSize: 10, color: "#94a3b8", lineHeight: 1.5, marginTop: 4 }}>
                  프리셋 적용 후 아래 값은 자유롭게 수정할 수 있습니다.
                </div>
              )}
            </div>
            <div style={{ marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: "#475569", marginRight: 8 }}>로터 수</span>
              {[3,4,6,8].map(n => (
                <button key={n} onClick={() => set("rotors", n)}
                  style={{ padding: "3px 10px", margin: "0 2px", borderRadius: 5, fontSize: 12, cursor: "pointer",
                    border: p.rotors === n ? "2px solid #3b82f6" : "1px solid #cbd5e1",
                    background: p.rotors === n ? "#eff6ff" : "white",
                    color: p.rotors === n ? "#2563eb" : "#475569", fontWeight: p.rotors === n ? 700 : 400 }}>{n}</button>
              ))}
            </div>
            <InputRow label="프레임 무게" unit="kg" value={p.frameKg} onChange={v => set("frameKg", v)} max={10} />
            <InputRow label="전자부품 무게" unit="kg" value={p.elecKg} onChange={v => set("elecKg", v)} max={5} />
          </Sec>

          <Sec title="모터 / 프로펠러" icon={Zap}>
            <div style={{ marginBottom: 8 }}>
              <span style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 4 }}>제조사</span>
              <select value={motorMaker} onChange={e => { setMotorMaker(e.target.value); setComboId(""); }}
                style={{ width: "100%", border: "1px solid #cbd5e1", borderRadius: 6, padding: "5px 6px",
                  fontSize: 12, color: "#1e293b", background: "#f8fafc", outline: "none", marginBottom: 5 }}>
                {!motorMakers.length && <option value="">CSV 로딩 중</option>}
                {motorMakers.map(maker => <option key={maker} value={maker}>{maker}</option>)}
                <option value="custom">기타 / 직접 입력</option>
              </select>
              <span style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 4 }}>모터+프롭 조합</span>
              <select value={comboId} onChange={e => applyCombo(e.target.value)} disabled={motorMaker === "custom"}
                style={{ width: "100%", border: "1px solid #cbd5e1", borderRadius: 6, padding: "5px 6px",
                  fontSize: 12, color: "#1e293b", background: "#f8fafc", outline: "none" }}>
                <option value="">직접 입력</option>
                {makerCombos.map(combo => (
                  <option key={combo.id} value={combo.id}>{getComboLabel(combo)}</option>
                ))}
              </select>
              {motorDataError && (
                <div style={{ fontSize: 10, color: "#dc2626", lineHeight: 1.5, marginTop: 4 }}>
                  CSV 데이터를 불러오지 못했습니다: {motorDataError}
                </div>
              )}
              {!motorDataError && motorCombos.length > 0 && (
                <div style={{ fontSize: 10, color: "#94a3b8", lineHeight: 1.5, marginTop: 4 }}>
                  CSV 프리셋 {motorCombos.length}개 로드됨
                </div>
              )}
              {selectedCombo && (
                <div style={{ fontSize: 10, color: "#64748b", lineHeight: 1.5, marginTop: 4 }}>
                  모터 {selectedCombo.motorWeightKg.toFixed(3)}kg/개 자동 반영
                  {selectedCombo.propWeightKg === 0 && <span> · 프롭 무게는 별도 확인 필요</span>}
                </div>
              )}
            </div>
            <InputRow label="모터+프롭 (개당)" unit="kg" value={p.motorPropKg} onChange={v => set("motorPropKg", v)} max={2} />
            <InputRow label="프롭 직경" unit="inch" value={p.propInch} onChange={v => set("propInch", v)} min={3} max={30} step={0.1} />
            {!selectedCombo && (
              <div className="direct-spec-card" style={{ background: "#f8fafc", border: "1px solid #dbeafe", borderRadius: 8,
                padding: "8px 9px", marginTop: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#1e3a8a", marginBottom: 2 }}>제조사 50% 기준 직접 입력</div>
                <div style={{ fontSize: 10, color: "#64748b", lineHeight: 1.45, marginBottom: 7 }}>
                  같은 프로펠러/전압 조합에서 50% throttle 행의 값을 넣으면 물리식 대신 이 값을 기준으로 추정합니다.
                </div>
                <InputRow label="시험 셀 수" unit="S" value={directMotor.cells} onChange={v => setD("cells", Math.round(v))} min={1} max={14} step={1} width={120} />
                <InputRow label="50% 추력" unit="N" value={directMotor.thrustN50} onChange={v => setD("thrustN50", v)} max={500} step={0.1} width={120} />
                <InputRow label="50% 전력" unit="W" value={directMotor.powerW50} onChange={v => setD("powerW50", v)} max={5000} step={1} width={120} />
                <div style={{ fontSize: 10, color: directSpecCalc ? "#475569" : "#94a3b8", lineHeight: 1.45, marginTop: 4 }}>
                  현재 필요 추력: <b>{((r.tow * G) / Math.max(p.rotors, 1)).toFixed(2)} N/rotor</b>
                  {directSpecCalc && (
                    <span> · 예상 스로틀 <b>{directSpecCalc.throttle.toFixed(0)}%</b> · 로터당 전력 <b>{directSpecCalc.powerW.toFixed(0)} W</b></span>
                  )}
                </div>
              </div>
            )}
          </Sec>

          <Sec title="ESC / 배선" icon={Cpu}>
            <InputRow label="ESC+배선 (개당)" unit="kg" value={esc.kg} onChange={v => setE("kg", v)} max={1} />
            <InputRow label="연속 전류" unit="A" value={esc.continuousA} onChange={v => setE("continuousA", v)} max={300} step={1} />
            <div style={{ background: "#f8fafc", borderRadius: 6, padding: "6px 8px", marginTop: 2, fontSize: 11, color: "#475569", lineHeight: 1.6 }}>
              전체 ESC+배선 무게: <b>{(esc.kg * p.rotors).toFixed(3)} kg</b>
              {batt.cells < esc.cellMin || batt.cells > esc.cellMax
                ? <span style={{ color: "#dc2626", fontWeight: 700 }}> · 배터리 셀 수 확인 필요</span>
                : <span> · 셀 수 적합</span>}
            </div>
          </Sec>

          <Sec title="배터리 (LiPo)" icon={BatteryCharging}>
            <InputRow label="셀 수 (S)" unit="S" value={batt.cells} onChange={v => setB("cells", Math.round(v))} min={1} max={14} step={1} />
            <InputRow label="용량" unit="mAh" value={batt.mah} onChange={v => setB("mah", Math.round(v))} min={100} max={100000} step={100} />
            <InputRow label="배터리 무게" unit="kg" value={batt.kg} onChange={v => setB("kg", v)} max={10} />
            <InputRow label="방전률" unit="C" value={batt.cRate} onChange={v => setB("cRate", v)} min={0} max={200} step={1} />
            <div style={{ background: "#f8fafc", borderRadius: 6, padding: "6px 8px", marginTop: 4, fontSize: 11, color: "#475569", lineHeight: 1.7 }}>
              전압: <b>{battV.toFixed(1)}V</b>&ensp;·&ensp;
              에너지: <b>{battWh.toFixed(1)} Wh</b>&ensp;·&ensp;
              밀도: <b>{battWhKg.toFixed(0)} Wh/kg</b>&ensp;·&ensp;
              최대전류: <b>{batteryMaxCurrentA.toFixed(0)}A</b>
            </div>
          </Sec>

          <Sec title="고급 설정" icon={Settings2} open={false}>
            <InputRow label="Figure of Merit" unit="" value={p.fm} onChange={v => set("fm", v)} min={0.1} max={0.8} step={0.01} />
            <InputRow label="오차 계수" unit="kg" value={p.errKg} onChange={v => set("errKg", v)} max={1} />
            <InputRow label="기본 전자장비 전력" unit="W" value={p.avW} onChange={v => set("avW", v)} max={200} step={1} />
            <InputRow label="ESC 최대 전류" unit="A" value={esc.maxA} onChange={v => setE("maxA", v)} max={500} step={1} />
            <div style={{ display: "grid", gridTemplateColumns: "90px 1fr 16px 1fr 16px", alignItems: "center", gap: 6, marginBottom: 5 }}>
              <span style={{ fontSize: 12, color: "#475569" }}>ESC 지원 셀</span>
              <input type="number" value={esc.cellMin} min={1} max={24} step={1}
                onChange={e => setE("cellMin", Math.round(+e.target.value))}
                style={{ width: "100%", minWidth: 0, padding: "4px 6px", border: "1px solid #cbd5e1", borderRadius: 6,
                  fontSize: 13, textAlign: "right", outline: "none", background: "#f8fafc" }} />
              <span style={{ fontSize: 11, color: "#94a3b8" }}>S</span>
              <input type="number" value={esc.cellMax} min={1} max={24} step={1}
                onChange={e => setE("cellMax", Math.round(+e.target.value))}
                style={{ width: "100%", minWidth: 0, padding: "4px 6px", border: "1px solid #cbd5e1", borderRadius: 6,
                  fontSize: 13, textAlign: "right", outline: "none", background: "#f8fafc" }} />
              <span style={{ fontSize: 11, color: "#94a3b8" }}>S</span>
            </div>
          </Sec>

          <Sec title="발전 옵션" icon={Sun} open={false}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 7, fontSize: 12, color: "#475569", cursor: "pointer" }}>
              <input type="checkbox" checked={solar.on} onChange={e => setSolar(prev => ({ ...prev, on: e.target.checked }))}
                style={{ accentColor: "#22c55e", width: 15, height: 15 }} />
              태양전지 발전 반영
            </label>
            <InputRow label="패널 무게" unit="kg" value={solar.kg} onChange={v => setS("kg", v)} max={10} />
            <InputRow label="정격 발전량" unit="W" value={solar.watts} onChange={v => setS("watts", v)} max={1000} step={1} />
            <InputRow label="기상/효율 계수" unit="%" value={solar.weatherPct} onChange={v => setS("weatherPct", v)} min={0} max={100} step={5} />
            <div style={{ background: solar.on ? "#f0fdf4" : "#f8fafc", borderRadius: 6, padding: "6px 8px", marginTop: 2,
              fontSize: 11, color: solar.on ? "#166534" : "#64748b", lineHeight: 1.6 }}>
              유효 발전량: <b>{solarW.toFixed(0)} W</b>
              {solar.on && <span> · 순소비전력에서 차감</span>}
            </div>
          </Sec>

          {/* ── 임무장비 ── */}
          <div style={{ background: "white", borderRadius: 10, border: "1px solid #e2e8f0", padding: "10px 12px", marginTop: 6 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "#1e293b" }}>
                <Target size={15} strokeWidth={2.2} color="#2563eb" />
                임무장비
              </span>
              <button onClick={addEq} style={{ background: "#3b82f6", color: "white", border: "none", borderRadius: 6,
                padding: "4px 10px", fontSize: 11, cursor: "pointer", fontWeight: 600,
                display: "inline-flex", alignItems: "center", gap: 4 }}>
                <Plus size={12} strokeWidth={2.5} />
                추가
              </button>
            </div>

            {/* column headers */}
            <div style={{ display: "flex", gap: 4, marginBottom: 4, padding: "0 0 0 28px" }}>
              <span style={{ flex: 1, fontSize: 9, color: "#94a3b8" }}>장비명</span>
              <span style={{ width: 52, fontSize: 9, color: "#94a3b8", textAlign: "right" }}>무게(kg)</span>
              <span style={{ width: 48, fontSize: 9, color: "#94a3b8", textAlign: "right" }}>전력(W)</span>
              <span style={{ width: 20 }}></span>
            </div>

            <div style={{ maxHeight: 260, overflowY: "auto" }}>
              {equip.map(e => (
                <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 3,
                  padding: "3px 0", borderBottom: "1px solid #f1f5f9", opacity: e.on ? 1 : 0.5, transition: "opacity 0.15s" }}>
                  <input type="checkbox" checked={e.on} onChange={() => toggleEq(e.id)}
                    style={{ accentColor: "#3b82f6", cursor: "pointer", margin: 0, width: 16, height: 16, flexShrink: 0 }} />
                  <input type="text" value={e.name} placeholder="장비명"
                    onChange={ev => updateEq(e.id, "name", ev.target.value)}
                    style={{ flex: 1, border: "1px solid #e2e8f0", borderRadius: 4, padding: "3px 6px",
                      fontSize: 11, outline: "none", background: "#fafafa", minWidth: 0 }} />
                  <input type="number" value={e.kg} min={0} max={50} step={0.01}
                    onChange={ev => updateEq(e.id, "kg", +ev.target.value)}
                    style={{ width: 52, border: "1px solid #e2e8f0", borderRadius: 4, padding: "3px 4px",
                      fontSize: 11, textAlign: "right", outline: "none", background: "#fafafa" }} />
                  <input type="number" value={e.w} min={0} max={500} step={1}
                    onChange={ev => updateEq(e.id, "w", +ev.target.value)}
                    style={{ width: 48, border: "1px solid #e2e8f0", borderRadius: 4, padding: "3px 4px",
                      fontSize: 11, textAlign: "right", outline: "none", background: "#fafafa" }} />
                  <button onClick={() => removeEq(e.id)} style={{ background: "none", border: "none",
                    cursor: "pointer", fontSize: 14, color: "#cbd5e1", padding: "0 2px", lineHeight: 1 }}
                    title="삭제">×</button>
                </div>
              ))}
            </div>

            {/* equipment summary */}
            <div style={{ marginTop: 6, padding: "6px 8px", background: "#f8fafc", borderRadius: 6,
              display: "flex", justifyContent: "space-between", fontSize: 11, color: "#475569" }}>
              <span>활성: <b>{equip.filter(e=>e.on).length}</b>개</span>
              <span>무게: <b style={{ color: "#ef4444" }}>{eqPayload.toFixed(2)} kg</b></span>
              <span>전력: <b style={{ color: "#f59e0b" }}>{eqPower.toFixed(0)} W</b></span>
            </div>
          </div>
        </div>

        {/* ─── RIGHT ─── */}
        <div className="results-panel" style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
          <div className="result-overview" style={{ padding: "2px 0 0" }}>
            <div className="overview-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
              gap: 10, marginBottom: 8, padding: "0 2px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <span style={{ width: 30, height: 30, borderRadius: 8, display: "grid", placeItems: "center",
                  background: "#eff6ff", color: "#2563eb", flexShrink: 0 }}>
                  <Activity size={17} strokeWidth={2.4} />
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>성능 요약</div>
                  <div style={{ fontSize: 10, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {selectedCombo ? getComboLabel(selectedCombo) : directSpecCalc ? `${directMotor.cells}S / ${p.propInch}" / 50% 스펙 기준` : "직접 입력 기준"}
                  </div>
                </div>
              </div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: decisionStyle.bg,
                color: decisionStyle.color, border: `1px solid ${decisionStyle.soft}`, borderRadius: 999,
                padding: "5px 9px", fontSize: 11, fontWeight: 800, whiteSpace: "nowrap" }}>
                <DecisionIcon size={13} strokeWidth={2.7} />
                {decisionSummary.title}
              </div>
            </div>

            <div className="hero-metrics" style={{ display: "flex", gap: 10 }}>
              <BigNum label={applyCalibration && flightLogs.length ? "보정 비행시간 (90%)" : "예상 비행시간 (90%)"}
                value={shown90.toFixed(1)} unit="분" color={tc} border featured
                sub={`${tableCalc ? "추력표" : directSpecCalc ? "50% 스펙" : "물리식"} 기준: ${estimate90.toFixed(1)}분 · 100%: ${(shown90 / 0.9).toFixed(1)}분`} />
              <BigNum label="이륙중량 (TOW)" value={towDisplay.toFixed(2)} unit="kg" color="#1e293b" border
                sub={`임무장비: ${eqPayload.toFixed(2)}kg 포함`} />
            </div>

            <div className="metric-row" style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <SmallCard label="순소비전력" value={r.tW} unit="W" />
              <SmallCard label="배터리 에너지" value={r.battWh} unit="Wh" />
              <SmallCard label={`로터당 추력 (×${p.rotors})`} value={r.tow / p.rotors} unit="kgf" />
              <SmallCard label="배터리 방전부하" value={batteryLoadPct} unit="%" />
            </div>
          </div>

          {selectedCombo && tableCalc && (
            <div className="panel-card thrust-panel" style={{ background: "white", borderRadius: 10, border: "1px solid #dbeafe", padding: "10px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#1e3a8a" }}>제조사 추력표 기준</div>
                  <div style={{ fontSize: 10, color: "#64748b" }}>{getComboLabel(selectedCombo)}</div>
                </div>
                <a href={selectedCombo.sourceUrl} target="_blank" rel="noreferrer"
                  style={{ fontSize: 10, color: "#2563eb", textDecoration: "none", whiteSpace: "nowrap",
                    display: "inline-flex", alignItems: "center", gap: 3 }}>
                  {selectedCombo.maker} 자료
                  <ExternalLink size={10} />
                </a>
              </div>
              <div className="thrust-metric-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}>
                <SmallCard label="추력표 비행시간 (90%)" value={tableCalc.m90} unit="분" />
                <SmallCard label="예상 스로틀" value={tableCalc.throttle} unit="%" />
                <SmallCard label="로터당 전류" value={tableCalc.currentA} unit="A" />
                <SmallCard label="추력 여유" value={tableCalc.thrustMarginPct} unit="%" />
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8, fontSize: 11, color: "#475569" }}>
                <span>요구 추력 <b>{(tableCalc.requiredThrustG / 1000).toFixed(2)} kgf/rotor</b></span>
                <span>모터 총전류 <b>{tableCalc.motorCurrentA.toFixed(1)} A</b></span>
                <span>배터리 전류 <b>{tableCalc.batteryCurrentA.toFixed(1)} A</b></span>
                <span>순소비전력 <b>{tableCalc.totalPowerW.toFixed(0)} W</b></span>
                <span>ESC 여유 <b>{tableCalc.escMarginPct.toFixed(0)}%</b></span>
                {tableCalc.limited === "high" && <span style={{ color: "#dc2626", fontWeight: 700 }}>요구 추력이 표 최대값을 넘습니다</span>}
                {tableCalc.voltageMismatch && <span style={{ color: "#b45309", fontWeight: 700 }}>배터리 전압과 추력표 전압이 다릅니다</span>}
              </div>
            </div>
          )}

          {!selectedCombo && directSpecCalc && (
            <div className="panel-card thrust-panel" style={{ background: "white", borderRadius: 10, border: "1px solid #dbeafe", padding: "10px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#1e3a8a" }}>제조사 50% 스펙 기준</div>
                  <div style={{ fontSize: 10, color: "#64748b" }}>
                    {directMotor.cells}S / {p.propInch}" prop · 50% 추력 {directMotor.thrustN50.toFixed(1)} N · 50% 전력 {directMotor.powerW50.toFixed(0)} W
                  </div>
                </div>
                <div style={{ fontSize: 10, color: "#64748b", textAlign: "right", lineHeight: 1.4 }}>
                  T~throttle²<br />P~T^1.5 보정
                </div>
              </div>
              <div className="thrust-metric-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}>
                <SmallCard label="50% 기준 비행시간 (90%)" value={directSpecCalc.m90} unit="분" />
                <SmallCard label="예상 스로틀" value={directSpecCalc.throttle} unit="%" />
                <SmallCard label="로터당 전력" value={directSpecCalc.powerW} unit="W" />
                <SmallCard label="추력 여유" value={directSpecCalc.thrustMarginPct} unit="%" />
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8, fontSize: 11, color: "#475569" }}>
                <span>요구 추력 <b>{directSpecCalc.requiredThrustN.toFixed(2)} N/rotor</b></span>
                <span>로터당 전류 <b>{directSpecCalc.currentA.toFixed(1)} A</b></span>
                <span>모터 총전류 <b>{directSpecCalc.motorCurrentA.toFixed(1)} A</b></span>
                <span>배터리 전류 <b>{directSpecCalc.batteryCurrentA.toFixed(1)} A</b></span>
                <span>순소비전력 <b>{directSpecCalc.totalPowerW.toFixed(0)} W</b></span>
                <span>ESC 여유 <b>{directSpecCalc.escMarginPct.toFixed(0)}%</b></span>
                {directSpecCalc.limited === "high" && <span style={{ color: "#dc2626", fontWeight: 700 }}>요구 추력이 50% 기준 추정 최대값을 넘습니다</span>}
                {directSpecCalc.voltageMismatch && <span style={{ color: "#b45309", fontWeight: 700 }}>배터리 셀 수와 시험 셀 수가 다릅니다</span>}
              </div>
            </div>
          )}

          <div className="panel-card decision-panel" style={{ background: "white", borderRadius: 10, border: "1px solid #e2e8f0", padding: "10px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>조합 판정</div>
                <div style={{ fontSize: 10, color: "#94a3b8" }}>
                  배터리 {estimatedBatteryCurrentA.toFixed(1)}A 예상 · 최대 {batteryMaxCurrentA.toFixed(0)}A
                </div>
              </div>
              <div style={{ fontSize: 11, color: batteryLoadPct >= 80 ? "#dc2626" : batteryLoadPct >= 50 ? "#b45309" : "#047857",
                fontWeight: 800, whiteSpace: "nowrap" }}>
                방전부하 {batteryLoadPct.toFixed(0)}%
              </div>
            </div>
            <div className="decision-summary-strip" style={{ background: decisionStyle.bg, border: `1px solid ${decisionStyle.soft}`,
              borderRadius: 8, padding: "9px 10px", display: "grid", gridTemplateColumns: "24px 1fr", gap: 8,
              alignItems: "center", marginBottom: 8 }}>
              <span style={{ width: 24, height: 24, borderRadius: 6, background: "white", color: decisionStyle.color,
                display: "grid", placeItems: "center" }}>
                <DecisionIcon size={14} strokeWidth={2.7} />
              </span>
              <span>
                <span style={{ display: "block", color: "#0f172a", fontSize: 13, fontWeight: 800 }}>{decisionSummary.title}</span>
                <span style={{ display: "block", color: "#475569", fontSize: 11, lineHeight: 1.4 }}>{decisionSummary.detail}</span>
              </span>
            </div>
            <div className="decision-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 6 }}>
              {decisionItems.map((item, i) => {
                const { color, bg, Icon } = LEVEL_META[item.level] || LEVEL_META.info;
                const ItemIcon = Icon || Info;
                return (
                  <div key={`${item.title}-${i}`} style={{ background: bg, border: `1px solid ${color}22`, borderRadius: 8, padding: "7px 9px",
                    display: "grid", gridTemplateColumns: "18px 1fr", gap: 6, alignItems: "start" }}>
                    <span style={{ color, lineHeight: "16px", textAlign: "center", display: "grid", placeItems: "center" }}>
                      <ItemIcon size={13} strokeWidth={2.7} />
                    </span>
                    <span>
                      <span style={{ display: "block", color: "#1e293b", fontSize: 11, fontWeight: 700 }}>{item.title}</span>
                      <span style={{ display: "block", color: "#64748b", fontSize: 10, lineHeight: 1.35 }}>{item.detail}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="panel-card calibration-panel" style={{ background: "white", borderRadius: 10, border: "1px solid #e2e8f0", padding: "10px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: showCalibrationDetails ? 8 : 0 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>실측 보정</div>
                <div style={{ fontSize: 10, color: "#94a3b8" }}>
                  평균 보정계수 {calibrationFactor.toFixed(2)}× · 기록 {flightLogs.length}개
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#475569", whiteSpace: "nowrap", cursor: flightLogs.length ? "pointer" : "default" }}>
                  <input type="checkbox" checked={applyCalibration} onChange={e => setApplyCalibration(e.target.checked)}
                    disabled={!flightLogs.length} style={{ accentColor: "#0f766e", width: 14, height: 14 }} />
                  보정 적용
                </label>
                <button onClick={() => setCalibrationOpen(open => !open)}
                  style={{ background: showCalibrationDetails ? "#f8fafc" : "#0f766e", color: showCalibrationDetails ? "#475569" : "white",
                    border: showCalibrationDetails ? "1px solid #cbd5e1" : "none", borderRadius: 6, padding: "5px 9px",
                    fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                  {showCalibrationDetails ? "접기" : "기록 추가"}
                </button>
              </div>
            </div>

            {showCalibrationDetails && (
              <>
                <div className="calibration-form" style={{ display: "grid", gridTemplateColumns: "1fr 92px 72px", gap: 6, alignItems: "center", marginBottom: 8 }}>
                  <input type="text" value={logName} placeholder="테스트명"
                    onChange={e => setLogName(e.target.value)}
                    style={{ minWidth: 0, border: "1px solid #cbd5e1", borderRadius: 6, padding: "5px 7px", fontSize: 12, outline: "none", background: "#f8fafc" }} />
                  <input type="number" value={measuredMin} placeholder="실측 분"
                    onChange={e => setMeasuredMin(e.target.value)}
                    style={{ border: "1px solid #cbd5e1", borderRadius: 6, padding: "5px 7px", fontSize: 12, textAlign: "right", outline: "none", background: "#f8fafc" }} />
                  <button onClick={addFlightLog}
                    style={{ background: "#0f766e", color: "white", border: "none", borderRadius: 6, padding: "6px 8px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                    기록
                  </button>
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 11, color: "#475569", marginBottom: flightLogs.length ? 8 : 0 }}>
                  <span>현재 기준 추정 <b>{estimate90.toFixed(1)}분</b></span>
                  <span>보정 후 <b>{calibrated90.toFixed(1)}분</b></span>
                  <span>현재 TOW <b>{r.tow.toFixed(2)}kg</b></span>
                </div>

                {flightLogs.length > 0 && (
                  <div style={{ display: "grid", gap: 4, maxHeight: 118, overflowY: "auto" }}>
                    {flightLogs.map(log => (
                      <div key={log.id} style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: 8, alignItems: "center",
                        borderTop: "1px solid #f1f5f9", paddingTop: 4, fontSize: 10, color: "#64748b" }}>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{log.name} · {log.battery}</span>
                        <span>예상 {log.estimatedMin.toFixed(1)}분</span>
                        <span style={{ color: "#0f766e", fontWeight: 700 }}>실측 {log.measuredMin.toFixed(1)}분</span>
                        <button onClick={() => removeFlightLog(log.id)} title="삭제"
                          style={{ background: "none", border: "none", color: "#cbd5e1", cursor: "pointer", fontSize: 14, lineHeight: 1 }}>×</button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* weight bar */}
          <div className="panel-card weight-panel" style={{ background: "white", borderRadius: 10, border: "1px solid #e2e8f0", padding: "8px 14px" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4 }}>
              중량 구성 — 총 {towDisplay.toFixed(2)} kg
            </div>
            <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", height: 22 }}>
              {weights.filter(w => w.val > 0).map((w, i) => (
                <div key={i} style={{ width: `${(w.val / towDisplay) * 100}%`, background: w.col, minWidth: 2,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 9, color: "white", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", transition: "width 0.3s" }}
                  title={`${w.name}: ${w.val.toFixed(3)}kg`}>
                  {(w.val / towDisplay) > 0.08 ? w.name : ""}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "3px 10px", marginTop: 5 }}>
              {weights.filter(w => w.val > 0).map((w, i) => (
                <span key={i} style={{ fontSize: 10, color: "#64748b", display: "flex", alignItems: "center", gap: 3 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: w.col, display: "inline-block" }} />
                  {w.name} {w.val.toFixed(2)}kg ({((w.val / towDisplay) * 100).toFixed(0)}%)
                </span>
              ))}
            </div>
          </div>

          {/* chart tabs */}
          <div style={{ display: "flex", gap: 4 }}>
            {[{ id: "curve", label: "페이로드 vs 비행시간", Icon: LineChart }, { id: "scenario", label: "장비 누적 비교", Icon: BarChart3 }].map(t => {
              const TabIcon = t.Icon;
              return (
              <button key={t.id} onClick={() => setTab(t.id)}
                style={{ padding: "5px 14px", fontSize: 12, fontWeight: tab === t.id ? 700 : 400,
                  border: "none", borderBottom: tab === t.id ? "2px solid #3b82f6" : "2px solid transparent",
                  background: "none", cursor: "pointer", color: tab === t.id ? "#1e293b" : "#94a3b8",
                  display: "inline-flex", alignItems: "center", gap: 5 }}>
                <TabIcon size={14} strokeWidth={2.2} />
                {t.label}
              </button>
              );
            })}
          </div>

          <div className="panel-card chart-panel" style={{ background: "white", borderRadius: 10, border: "1px solid #e2e8f0", padding: "12px 14px 6px", flex: 1, minHeight: 260 }}>
            {tab === "curve" ? (
              <>
                <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>
                  장비 페이로드 증가에 따른 비행시간 변화
                  {eqPayload > 0 && <span style={{ fontSize: 11 }}> — 현재 장비 무게: <b style={{ color: "#ef4444" }}>{eqPayload.toFixed(2)} kg</b></span>}
                </div>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={curve} margin={{ top: 5, right: 20, bottom: 20, left: 0 }}>
                    <defs>
                      <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="payload" type="number" domain={[0, maxPl]}
                      tick={{ fontSize: 11, fill: "#94a3b8" }}
                      label={{ value: "장비 페이로드 (kg)", position: "bottom", offset: 0, style: { fontSize: 11, fill: "#94a3b8" } }} />
                    <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} domain={[0, "auto"]}
                      label={{ value: "비행시간 (분)", angle: -90, position: "insideLeft", offset: 10, style: { fontSize: 11, fill: "#94a3b8" } }} />
                    <Tooltip content={<CurveTooltip />} />
                    <Area type="monotone" dataKey="time" stroke="#3b82f6" strokeWidth={2.5} fill="url(#tg)" />
                    {eqPayload > 0 && (
                      <ReferenceLine x={eqPayload} stroke={tc} strokeDasharray="4 4" strokeWidth={1.5}
                        label={{ value: `${r.m90.toFixed(1)}분`, position: "top", style: { fontSize: 11, fill: tc, fontWeight: 700 } }} />
                    )}
                  </AreaChart>
                </ResponsiveContainer>
              </>
            ) : (
              <>
                <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>
                  활성 장비 순차 탑재 시 비행시간 변화
                </div>
                {cumData.length <= 1 ? (
                  <div style={{ textAlign: "center", padding: "60px 20px", color: "#94a3b8", fontSize: 13 }}>
                    왼쪽 임무장비에서 항목을 활성화하면<br />누적 비교 차트가 표시됩니다.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={Math.max(200, cumData.length * 44 + 40)}>
                    <BarChart data={cumData} layout="vertical" margin={{ top: 5, right: 50, bottom: 5, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                      <XAxis type="number" domain={[0, "auto"]} tick={{ fontSize: 11, fill: "#94a3b8" }}
                        label={{ value: "비행시간 (분)", position: "bottom", offset: -2, style: { fontSize: 11, fill: "#94a3b8" } }} />
                      <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11, fill: "#475569" }} />
                      <Tooltip content={<BarTooltip />} />
                      <Bar dataKey="time" radius={[0, 6, 6, 0]} barSize={26}>
                        {cumData.map((d, i) => <Cell key={i} fill={d.color} />)}
                        <LabelList dataKey="time" position="right" style={{ fontSize: 12, fontWeight: 700, fill: "#1e293b" }}
                          formatter={v => `${v}분`} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
                {cumData.length > 1 && (
                  <div style={{ marginTop: 6, padding: "8px 12px", background: "#fef3c7", borderRadius: 8,
                    fontSize: 11, color: "#92400e", lineHeight: 1.5, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <Info size={13} strokeWidth={2.4} style={{ flexShrink: 0 }} />
                    <span>
                      기본 기체 대비 전체 장비 탑재 시 비행시간{" "}
                      <b>{((1 - cumData[cumData.length - 1].time / Math.max(cumData[0].time, 0.01)) * 100).toFixed(0)}%</b> 감소
                      &ensp;|&ensp;이륙중량 {cumData[0].tow}kg → {cumData[cumData.length - 1].tow}kg
                    </span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* physics row */}
          <div className="physics-strip" style={{ background: "white", borderRadius: 10, border: "1px solid #e2e8f0",
            padding: "8px 14px", display: "flex", gap: 14, flexWrap: "wrap" }}>
            {[
              ["물리 모델", "Momentum Theory", ""],
              ["유도속도", r.vi.toFixed(2), "m/s"],
              ["디스크 면적", r.A.toFixed(4), "m²"],
              ["디스크 로딩", (r.T / Math.max(r.A, 0.001)).toFixed(1), "N/m²"],
              ["로터당 호버전력", (r.hW / p.rotors).toFixed(1), "W"],
            ].map(([l, v, u]) => (
              <span key={l} style={{ fontSize: 11, color: "#64748b" }}>
                <span style={{ fontWeight: 600 }}>{l}</span> {v} {u}
              </span>
            ))}
          </div>
        </div>
      </div>
      </>
      ) : activeMode === "fixedwing" ? (
        <FixedWingPanel
          mode={activeModeMeta}
          fixedWingPreset={fixedWingPreset}
          onFixedWingPresetChange={applyFixedWingPreset}
          powertrains={fixedWingPowertrains}
          selectedPowertrain={selectedFixedWingPowertrain}
          selectedProp={selectedFixedWingProp}
          selectedBattery={selectedFixedWingBattery}
          config={fixedWingConfig}
          fixedWingCalc={fixedWingCalc}
          onPowertrainChange={applyFixedWingPowertrain}
          onPropChange={applyFixedWingProp}
          onBatteryChange={applyFixedWingBattery}
          onConfigChange={setFW}
          onCustomBatteryChange={setFWBattery}
        />
      ) : (
        <ComingSoonPanel
          mode={activeModeMeta}
          fixedWingPreset={fixedWingPreset}
          onFixedWingPresetChange={setFixedWingPresetId}
        />
      )}
      <footer className="app-footer">
        <div className="footer-brand">
          <span className="footer-mark-wrap">
            <img src={sentieryMark} alt="" className="footer-mark" />
          </span>
          <span>
            <img src={sentieryLogoEn} alt="Sentiery" className="footer-logo" />
            <span className="footer-product">UAV Flight Time Calculator</span>
          </span>
        </div>
        <div className="footer-legal">
          <span>Copyright © 2026 Sentiery. All rights reserved.</span>
          <span>Engineering estimate tool for UAV education and mission planning.</span>
        </div>
      </footer>
    </div>
  );
}
