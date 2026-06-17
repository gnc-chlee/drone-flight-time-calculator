// Seed data transcribed from T-MOTOR official store product test tables.
// Sources:
// U3: https://store.tmotor.com/product/u3-motor-u-power.html
// U5: https://store.tmotor.com/product/u-power-u5.html
// MN5008: https://store.tmotor.com/cn/product/mn5008-kv170-motor-antigravity-type.html
export const TMOTOR_COMBOS = [
  {
    id: "tmotor-u3-kv700-4s-12x4",
    maker: "T-MOTOR",
    motor: "U3",
    kv: 700,
    voltage: 14.8,
    cells: 4,
    prop: "12*4CF",
    propInch: 12,
    motorWeightKg: 0.128,
    propWeightKg: 0,
    maxCurrentA: 25,
    sourceUrl: "https://store.tmotor.com/product/u3-motor-u-power.html",
    note: "Prop weight not listed on the motor page.",
    test: [
      { throttle: 50, currentA: 3.8, powerW: 56.24, thrustG: 580, rpm: 5000 },
      { throttle: 65, currentA: 7.4, powerW: 109.52, thrustG: 880, rpm: 6300 },
      { throttle: 75, currentA: 10.3, powerW: 152.44, thrustG: 1100, rpm: 7300 },
      { throttle: 85, currentA: 14.0, powerW: 207.2, thrustG: 1360, rpm: 7700 },
      { throttle: 100, currentA: 16.8, powerW: 248.64, thrustG: 1600, rpm: 8300 }
    ]
  },
  {
    id: "tmotor-u3-kv700-4s-13x44",
    maker: "T-MOTOR",
    motor: "U3",
    kv: 700,
    voltage: 14.8,
    cells: 4,
    prop: "13*4.4CF",
    propInch: 13,
    motorWeightKg: 0.128,
    propWeightKg: 0,
    maxCurrentA: 25,
    sourceUrl: "https://store.tmotor.com/product/u3-motor-u-power.html",
    note: "Prop weight not listed on the motor page.",
    test: [
      { throttle: 50, currentA: 4.7, powerW: 69.56, thrustG: 730, rpm: 4900 },
      { throttle: 65, currentA: 9.0, powerW: 133.2, thrustG: 1120, rpm: 6100 },
      { throttle: 75, currentA: 12.3, powerW: 182.04, thrustG: 1400, rpm: 6800 },
      { throttle: 85, currentA: 16.0, powerW: 236.8, thrustG: 1600, rpm: 7400 },
      { throttle: 100, currentA: 19.4, powerW: 287.12, thrustG: 1800, rpm: 7850 }
    ]
  },
  {
    id: "tmotor-u5-kv400-6s-15x5",
    maker: "T-MOTOR",
    motor: "U5",
    kv: 400,
    voltage: 22.2,
    cells: 6,
    prop: "15*5CF",
    propInch: 15,
    motorWeightKg: 0.195,
    propWeightKg: 0,
    maxCurrentA: 30,
    sourceUrl: "https://store.tmotor.com/product/u-power-u5.html",
    note: "Prop weight not listed on the motor page.",
    test: [
      { throttle: 50, currentA: 4.3, powerW: 95.46, thrustG: 990, rpm: 4200 },
      { throttle: 65, currentA: 7.9, powerW: 175.38, thrustG: 1490, rpm: 5200 },
      { throttle: 75, currentA: 11.6, powerW: 257.52, thrustG: 1900, rpm: 5700 },
      { throttle: 85, currentA: 14.5, powerW: 321.9, thrustG: 2220, rpm: 6200 },
      { throttle: 100, currentA: 17.2, powerW: 381.84, thrustG: 2480, rpm: 6500 }
    ]
  },
  {
    id: "tmotor-u5-kv400-6s-16x54",
    maker: "T-MOTOR",
    motor: "U5",
    kv: 400,
    voltage: 22.2,
    cells: 6,
    prop: "16*5.4CF",
    propInch: 16,
    motorWeightKg: 0.195,
    propWeightKg: 0,
    maxCurrentA: 30,
    sourceUrl: "https://store.tmotor.com/product/u-power-u5.html",
    note: "Prop weight not listed on the motor page.",
    test: [
      { throttle: 50, currentA: 5.2, powerW: 115.44, thrustG: 1200, rpm: 4050 },
      { throttle: 65, currentA: 9.4, powerW: 208.68, thrustG: 1750, rpm: 4850 },
      { throttle: 75, currentA: 13.0, powerW: 288.6, thrustG: 2120, rpm: 5400 },
      { throttle: 85, currentA: 16.9, powerW: 375.18, thrustG: 2650, rpm: 5850 },
      { throttle: 100, currentA: 20.0, powerW: 444.0, thrustG: 2850, rpm: 6250 }
    ]
  },
  {
    id: "tmotor-mn5008-kv400-6s-p16x54",
    maker: "T-MOTOR",
    motor: "MN5008",
    kv: 400,
    voltage: 22.2,
    cells: 6,
    prop: "P16*5.4 CF",
    propInch: 16,
    motorWeightKg: 0.132,
    propWeightKg: 0,
    maxCurrentA: 35,
    sourceUrl: "https://store.tmotor.com/cn/product/mn5008-kv170-motor-antigravity-type.html",
    note: "Prop weight not listed on the motor page.",
    test: [
      { throttle: 40, currentA: 3.22, powerW: 76, thrustG: 803, rpm: 3429 },
      { throttle: 45, currentA: 4.46, powerW: 104, thrustG: 1021, rpm: 3874 },
      { throttle: 50, currentA: 5.93, powerW: 138, thrustG: 1259, rpm: 4303 },
      { throttle: 60, currentA: 9.28, powerW: 216, thrustG: 1722, rpm: 5016 },
      { throttle: 70, currentA: 13.16, powerW: 304, thrustG: 2185, rpm: 5645 },
      { throttle: 80, currentA: 18.53, powerW: 425, thrustG: 2750, rpm: 6293 },
      { throttle: 90, currentA: 24.84, powerW: 566, thrustG: 3323, rpm: 6896 },
      { throttle: 100, currentA: 28.16, powerW: 638, thrustG: 3591, rpm: 7165 }
    ]
  }
];

export function getComboLabel(combo) {
  return `${combo.maker} ${combo.motor} KV${combo.kv} / ${combo.cells}S / ${combo.prop}`;
}

export function interpolateByThrust(test, thrustG) {
  const rows = [...test].sort((a, b) => a.thrustG - b.thrustG);
  if (thrustG <= rows[0].thrustG) return { ...rows[0], limited: "low" };
  if (thrustG >= rows[rows.length - 1].thrustG) return { ...rows[rows.length - 1], limited: "high" };

  for (let i = 0; i < rows.length - 1; i += 1) {
    const a = rows[i];
    const b = rows[i + 1];
    if (thrustG >= a.thrustG && thrustG <= b.thrustG) {
      const t = (thrustG - a.thrustG) / (b.thrustG - a.thrustG);
      return {
        throttle: a.throttle + (b.throttle - a.throttle) * t,
        currentA: a.currentA + (b.currentA - a.currentA) * t,
        powerW: a.powerW + (b.powerW - a.powerW) * t,
        thrustG,
        rpm: a.rpm + (b.rpm - a.rpm) * t,
        limited: false
      };
    }
  }
  return null;
}
