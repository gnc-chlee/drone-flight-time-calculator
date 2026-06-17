import { useState, useMemo, useCallback } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Cell, LabelList
} from "recharts";
import { TMOTOR_COMBOS, getComboLabel, interpolateByThrust } from "./data/tmotorMultirotorMotors";

const G = 9.81;
const RHO = 1.225;
const CELL_V = 3.7;

const INIT = {
  rotors: 4, frameKg: 0.432, elecKg: 0.3,
  motorPropKg: 0.07, escWireKg: 0.037,
  propInch: 9.4, fm: 0.45, avW: 10, errKg: 0.05,
};

const INIT_BATT = { cells: 4, mah: 10000, kg: 0.8 };

const INIT_EQUIP = [
  { id: 1, name: "짐벌 카메라", kg: 0.30, w: 8, on: false },
  { id: 2, name: "열화상 카메라", kg: 0.20, w: 5, on: false },
  { id: 3, name: "AI 보드 (Jetson Nano)", kg: 0.15, w: 15, on: false },
  { id: 4, name: "LiDAR 센서", kg: 0.25, w: 12, on: false },
  { id: 5, name: "미스트 펌프+노즐", kg: 0.50, w: 20, on: false },
  { id: 6, name: "물탱크 (1L)", kg: 1.00, w: 0, on: false },
  { id: 7, name: "태양전지판", kg: 0.50, w: 0, on: false },
];

function calc(p, battWh, payloadKg, extraW) {
  const mT = p.motorPropKg * p.rotors;
  const eT = p.escWireKg * p.rotors;
  const tow = p.frameKg + p.elecKg + mT + eT + p.errKg + payloadKg;
  const d = p.propInch * 0.0254;
  const A = p.rotors * Math.PI * (d / 2) ** 2;
  const T = tow * G;
  const vi = Math.sqrt(Math.max(T / (2 * RHO * A), 0.001));
  const hW = (T * vi) / Math.max(p.fm, 0.01);
  const tW = hW + p.avW + extraW;
  const mFull = tW > 0 ? (battWh / tW) * 60 : 0;
  return { tow, T, vi, hW, tW, battWh, mFull, m90: mFull * 0.9, mT, eT, A };
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

const Sec = ({ title, icon, children, open: initOpen = true }) => {
  const [open, setOpen] = useState(initOpen);
  return (
    <div style={{ marginBottom: 6, background: "white", borderRadius: 10, border: "1px solid #e2e8f0", overflow: "hidden" }}>
      <button onClick={() => setOpen(!open)}
        style={{ width: "100%", padding: "7px 12px", display: "flex", alignItems: "center", gap: 6,
          background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#1e293b" }}>
        <span>{icon}</span><span style={{ flex: 1, textAlign: "left" }}>{title}</span>
        <span style={{ fontSize: 10, color: "#94a3b8", transform: open ? "rotate(180deg)" : "none", transition: "0.2s" }}>▼</span>
      </button>
      {open && <div style={{ padding: "2px 12px 10px" }}>{children}</div>}
    </div>
  );
};

const BigNum = ({ label, value, unit, sub, color, border }) => (
  <div style={{ background: border ? `linear-gradient(135deg,${color}14,${color}06)` : "white",
    borderRadius: 12, padding: "12px 16px", border: border ? `2px solid ${color}35` : "1px solid #e2e8f0",
    flex: 1, minWidth: 0, textAlign: "center" }}>
    <div style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}>{label}</div>
    <div style={{ fontSize: 36, fontWeight: 800, color: color || "#0f172a", lineHeight: 1.1,
      fontVariantNumeric: "tabular-nums" }}>{value}</div>
    <div style={{ fontSize: 13, color: color || "#64748b", fontWeight: 500 }}>{unit}</div>
    {sub && <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 3 }}>{sub}</div>}
  </div>
);

const SmallCard = ({ label, value, unit }) => (
  <div style={{ background: "white", borderRadius: 8, padding: "8px 12px", border: "1px solid #e2e8f0", flex: 1, minWidth: 0 }}>
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

/* ── main ── */

export default function App() {
  const [p, setP] = useState(INIT);
  const [batt, setBatt] = useState(INIT_BATT);
  const [equip, setEquip] = useState(INIT_EQUIP);
  const [nextId, setNextId] = useState(100);
  const [tab, setTab] = useState("curve");
  const [comboId, setComboId] = useState("");

  const set = useCallback((k, v) => setP(prev => ({ ...prev, [k]: isNaN(v) ? prev[k] : v })), []);
  const setB = useCallback((k, v) => setBatt(prev => ({ ...prev, [k]: isNaN(v) ? prev[k] : v })), []);

  const battV = batt.cells * CELL_V;
  const battWh = battV * batt.mah / 1000;
  const battWhKg = batt.kg > 0 ? battWh / batt.kg : 0;

  const totalBattKg = batt.kg;
  const eqPayload = equip.filter(e => e.on).reduce((s, e) => s + e.kg, 0);
  const eqPower = equip.filter(e => e.on).reduce((s, e) => s + e.w, 0);

  // TOW includes battery weight
  const fullPayload = totalBattKg + eqPayload;
  const r = useMemo(() => calc(p, battWh, fullPayload, eqPower), [p, battWh, fullPayload, eqPower]);
  const selectedCombo = useMemo(() => TMOTOR_COMBOS.find(c => c.id === comboId), [comboId]);
  const tableCalc = useMemo(() => {
    if (!selectedCombo) return null;
    const requiredThrustG = (r.tow / p.rotors) * 1000;
    const hover = interpolateByThrust(selectedCombo.test, requiredThrustG);
    if (!hover) return null;
    const totalCurrentA = hover.currentA * p.rotors;
    const totalPowerW = hover.powerW * p.rotors + p.avW + eqPower;
    const capacityAh = batt.mah / 1000;
    const fullMinByCurrent = totalCurrentA > 0 ? (capacityAh / totalCurrentA) * 60 : 0;
    const fullMinByPower = totalPowerW > 0 ? (battWh / totalPowerW) * 60 : 0;
    const maxThrustG = Math.max(...selectedCombo.test.map(row => row.thrustG));
    return {
      ...hover,
      requiredThrustG,
      totalCurrentA,
      totalPowerW,
      mFull: fullMinByPower || fullMinByCurrent,
      m90: (fullMinByPower || fullMinByCurrent) * 0.9,
      thrustMarginPct: ((maxThrustG - requiredThrustG) / Math.max(requiredThrustG, 1)) * 100,
      escMarginPct: ((selectedCombo.maxCurrentA - hover.currentA) / Math.max(hover.currentA, 0.01)) * 100,
      voltageMismatch: Math.abs(battV - selectedCombo.voltage) > 1
    };
  }, [selectedCombo, r.tow, p.rotors, p.avW, eqPower, batt.mah, battWh, battV]);

  // payload curve: vary equipment payload from 0 to max
  const maxPl = Math.max(5, eqPayload + 2);
  const curve = useMemo(() => {
    const pts = [];
    for (let pl = 0; pl <= maxPl; pl += 0.05) {
      const res = calc(p, battWh, totalBattKg + pl, eqPower);
      pts.push({ payload: +pl.toFixed(2), time: Math.max(0, +res.m90.toFixed(1)) });
    }
    return pts;
  }, [p, battWh, totalBattKg, eqPower, maxPl]);

  // cumulative equipment scenario
  const cumData = useMemo(() => {
    const enabled = equip.filter(e => e.on);
    const base = calc(p, battWh, totalBattKg, 0);
    const data = [{ name: "기본 기체", time: +base.m90.toFixed(1), tow: +base.tow.toFixed(2), power: +base.tW.toFixed(0), color: "#3b82f6" }];
    let ck = 0, cw = 0;
    const colors = ["#8b5cf6","#06b6d4","#f59e0b","#ef4444","#ec4899","#14b8a6","#f97316","#6366f1","#84cc16"];
    enabled.forEach((e, i) => {
      ck += e.kg; cw += e.w;
      const res = calc(p, battWh, totalBattKg + ck, cw);
      data.push({ name: `+ ${e.name}`, time: +res.m90.toFixed(1), tow: +res.tow.toFixed(2), power: +res.tW.toFixed(0), color: colors[i % colors.length] });
    });
    return data;
  }, [p, battWh, totalBattKg, equip]);

  // equipment handlers
  const toggleEq = (id) => setEquip(prev => prev.map(e => e.id === id ? { ...e, on: !e.on } : e));
  const removeEq = (id) => setEquip(prev => prev.filter(e => e.id !== id));
  const updateEq = (id, k, v) => setEquip(prev => prev.map(e => e.id === id ? { ...e, [k]: v } : e));
  const addEq = () => {
    setEquip(prev => [...prev, { id: nextId, name: "", kg: 0, w: 0, on: true }]);
    setNextId(n => n + 1);
  };

  const applyCombo = (id) => {
    setComboId(id);
    const combo = TMOTOR_COMBOS.find(c => c.id === id);
    if (!combo) return;
    setP(prev => ({
      ...prev,
      motorPropKg: +(combo.motorWeightKg + combo.propWeightKg).toFixed(3),
      propInch: combo.propInch
    }));
    setBatt(prev => ({ ...prev, cells: combo.cells }));
  };

  const resetAll = () => { setP(INIT); setBatt(INIT_BATT); setEquip(INIT_EQUIP); setComboId(""); };

  const tc = r.m90 > 25 ? "#10b981" : r.m90 > 15 ? "#f59e0b" : r.m90 > 8 ? "#f97316" : "#ef4444";

  const weights = [
    { name: "프레임", val: p.frameKg, col: "#64748b" },
    { name: "전자부품", val: p.elecKg, col: "#8b5cf6" },
    { name: "모터+프롭", val: r.mT, col: "#3b82f6" },
    { name: "ESC+배선", val: r.eT, col: "#06b6d4" },
    { name: "배터리", val: totalBattKg, col: "#f59e0b" },
    { name: "오차", val: p.errKg, col: "#94a3b8" },
    { name: "임무장비", val: eqPayload, col: "#ef4444" },
  ];
  const towDisplay = r.tow;

  return (
    <div style={{ fontFamily: "'Inter',-apple-system,system-ui,sans-serif", background: "#f1f5f9", minHeight: "100vh" }}>
      {/* header */}
      <div style={{ background: "linear-gradient(135deg,#0f172a,#1e3a5f)", padding: "12px 20px", color: "white",
        display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, letterSpacing: -0.5 }}>✈️ 멀티콥터 비행시간 추정기</h1>
          <p style={{ fontSize: 11, opacity: 0.55, margin: "2px 0 0" }}>Momentum Theory 기반 호버링 비행시간 계산</p>
        </div>
        <button onClick={resetAll} style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)",
          color: "white", padding: "5px 12px", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>↺ 초기화</button>
      </div>

      <div style={{ display: "flex", gap: 10, padding: 10, maxWidth: 1400, margin: "0 auto" }}>
        {/* ─── LEFT ─── */}
        <div style={{ width: 280, flexShrink: 0 }}>
          <Sec title="기체 구성" icon="🔧">
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
            <InputRow label="오차 계수" unit="kg" value={p.errKg} onChange={v => set("errKg", v)} max={1} />
          </Sec>

          <Sec title="모터 / 프로펠러" icon="⚡">
            <div style={{ marginBottom: 8 }}>
              <span style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 4 }}>T-MOTOR 프리셋</span>
              <select value={comboId} onChange={e => applyCombo(e.target.value)}
                style={{ width: "100%", border: "1px solid #cbd5e1", borderRadius: 6, padding: "5px 6px",
                  fontSize: 12, color: "#1e293b", background: "#f8fafc", outline: "none" }}>
                <option value="">직접 입력</option>
                {TMOTOR_COMBOS.map(combo => (
                  <option key={combo.id} value={combo.id}>{getComboLabel(combo)}</option>
                ))}
              </select>
              {selectedCombo && (
                <div style={{ fontSize: 10, color: "#64748b", lineHeight: 1.5, marginTop: 4 }}>
                  모터 {selectedCombo.motorWeightKg.toFixed(3)}kg/개 자동 반영
                  {selectedCombo.propWeightKg === 0 && <span> · 프롭 무게는 별도 확인 필요</span>}
                </div>
              )}
            </div>
            <InputRow label="모터+프롭 (개당)" unit="kg" value={p.motorPropKg} onChange={v => set("motorPropKg", v)} max={2} />
            <InputRow label="ESC+배선 (개당)" unit="kg" value={p.escWireKg} onChange={v => set("escWireKg", v)} max={1} />
            <InputRow label="프롭 직경" unit="inch" value={p.propInch} onChange={v => set("propInch", v)} min={3} max={30} step={0.1} />
            <InputRow label="Figure of Merit" unit="" value={p.fm} onChange={v => set("fm", v)} min={0.1} max={0.8} step={0.01} />
          </Sec>

          <Sec title="배터리 (LiPo)" icon="🔋">
            <InputRow label="셀 수 (S)" unit="S" value={batt.cells} onChange={v => setB("cells", Math.round(v))} min={1} max={14} step={1} />
            <InputRow label="용량" unit="mAh" value={batt.mah} onChange={v => setB("mah", Math.round(v))} min={100} max={100000} step={100} />
            <InputRow label="배터리 무게" unit="kg" value={batt.kg} onChange={v => setB("kg", v)} max={10} />
            <div style={{ background: "#f8fafc", borderRadius: 6, padding: "6px 8px", marginTop: 4, fontSize: 11, color: "#475569", lineHeight: 1.7 }}>
              전압: <b>{battV.toFixed(1)}V</b>&ensp;·&ensp;
              에너지: <b>{battWh.toFixed(1)} Wh</b>&ensp;·&ensp;
              밀도: <b>{battWhKg.toFixed(0)} Wh/kg</b>
            </div>
          </Sec>

          <Sec title="비행 조건" icon="🌤️" open={false}>
            <InputRow label="기본 전자장비 전력" unit="W" value={p.avW} onChange={v => set("avW", v)} max={200} step={1} />
          </Sec>

          {/* ── 임무장비 ── */}
          <div style={{ background: "white", borderRadius: 10, border: "1px solid #e2e8f0", padding: "10px 12px", marginTop: 6 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>🎯 임무장비</span>
              <button onClick={addEq} style={{ background: "#3b82f6", color: "white", border: "none", borderRadius: 6,
                padding: "4px 10px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>+ 추가</button>
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
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
          {/* big numbers */}
          <div style={{ display: "flex", gap: 10 }}>
            <BigNum label="예상 비행시간 (90%)" value={r.m90.toFixed(1)} unit="분" color={tc} border
              sub={`100% 용량: ${r.mFull.toFixed(1)}분`} />
            <BigNum label="이륙중량 (TOW)" value={towDisplay.toFixed(2)} unit="kg" color="#1e293b" border
              sub={`임무장비: ${eqPayload.toFixed(2)}kg 포함`} />
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <SmallCard label="호버 전력 (전체)" value={r.tW} unit="W" />
            <SmallCard label="배터리 에너지" value={r.battWh} unit="Wh" />
            <SmallCard label={`로터당 추력 (×${p.rotors})`} value={r.tow / p.rotors} unit="kgf" />
            <SmallCard label="전력 하중비" value={r.tW / Math.max(r.tow, 0.01)} unit="W/kg" />
          </div>

          {selectedCombo && tableCalc && (
            <div style={{ background: "white", borderRadius: 10, border: "1px solid #dbeafe", padding: "10px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#1e3a8a" }}>제조사 추력표 기준</div>
                  <div style={{ fontSize: 10, color: "#64748b" }}>{getComboLabel(selectedCombo)}</div>
                </div>
                <a href={selectedCombo.sourceUrl} target="_blank" rel="noreferrer"
                  style={{ fontSize: 10, color: "#2563eb", textDecoration: "none", whiteSpace: "nowrap" }}>T-MOTOR 자료</a>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}>
                <SmallCard label="추력표 비행시간 (90%)" value={tableCalc.m90} unit="분" />
                <SmallCard label="예상 스로틀" value={tableCalc.throttle} unit="%" />
                <SmallCard label="로터당 전류" value={tableCalc.currentA} unit="A" />
                <SmallCard label="추력 여유" value={tableCalc.thrustMarginPct} unit="%" />
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8, fontSize: 11, color: "#475569" }}>
                <span>요구 추력 <b>{(tableCalc.requiredThrustG / 1000).toFixed(2)} kgf/rotor</b></span>
                <span>총 전류 <b>{tableCalc.totalCurrentA.toFixed(1)} A</b></span>
                <span>총 전력 <b>{tableCalc.totalPowerW.toFixed(0)} W</b></span>
                <span>ESC 여유 <b>{tableCalc.escMarginPct.toFixed(0)}%</b></span>
                {tableCalc.limited === "high" && <span style={{ color: "#dc2626", fontWeight: 700 }}>요구 추력이 표 최대값을 넘습니다</span>}
                {tableCalc.voltageMismatch && <span style={{ color: "#b45309", fontWeight: 700 }}>배터리 전압과 추력표 전압이 다릅니다</span>}
              </div>
            </div>
          )}

          {/* weight bar */}
          <div style={{ background: "white", borderRadius: 10, border: "1px solid #e2e8f0", padding: "8px 14px" }}>
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
            {[{ id: "curve", label: "📈 페이로드 vs 비행시간" }, { id: "scenario", label: "📊 장비 누적 비교" }].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                style={{ padding: "5px 14px", fontSize: 12, fontWeight: tab === t.id ? 700 : 400,
                  border: "none", borderBottom: tab === t.id ? "2px solid #3b82f6" : "2px solid transparent",
                  background: "none", cursor: "pointer", color: tab === t.id ? "#1e293b" : "#94a3b8" }}>{t.label}</button>
            ))}
          </div>

          <div style={{ background: "white", borderRadius: 10, border: "1px solid #e2e8f0", padding: "12px 14px 6px", flex: 1, minHeight: 260 }}>
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
                    fontSize: 11, color: "#92400e", lineHeight: 1.5 }}>
                    💡 기본 기체 대비 전체 장비 탑재 시 비행시간{" "}
                    <b>{((1 - cumData[cumData.length - 1].time / Math.max(cumData[0].time, 0.01)) * 100).toFixed(0)}%</b> 감소
                    &ensp;|&ensp;이륙중량 {cumData[0].tow}kg → {cumData[cumData.length - 1].tow}kg
                  </div>
                )}
              </>
            )}
          </div>

          {/* physics row */}
          <div style={{ background: "white", borderRadius: 10, border: "1px solid #e2e8f0",
            padding: "8px 14px", display: "flex", gap: 14, flexWrap: "wrap" }}>
            {[
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
    </div>
  );
}
