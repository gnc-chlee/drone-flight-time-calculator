const NUMBER_FIELDS = [
  "kv",
  "cells",
  "voltage",
  "propInch",
  "motorWeightKg",
  "propWeightKg",
  "maxCurrentA",
  "throttle",
  "currentA",
  "powerW",
  "thrustG",
  "rpm"
];

const CSV_FIELD_MAP = {
  id: "id",
  maker: "maker",
  motor: "motor",
  kv: "kv",
  cells: "cells",
  voltage: "voltage",
  prop: "prop",
  prop_inch: "propInch",
  motor_weight_g: "motorWeightKg",
  prop_weight_g: "propWeightKg",
  max_current_a: "maxCurrentA",
  throttle: "throttle",
  current_a: "currentA",
  power_w: "powerW",
  thrust_g: "thrustG",
  rpm: "rpm",
  source_url: "sourceUrl",
  note: "note"
};

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (ch === "\"" && next === "\"") {
        cell += "\"";
        i += 1;
      } else if (ch === "\"") {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === "\"") {
      quoted = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (ch !== "\r") {
      cell += ch;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter(cols => cols.some(value => value.trim()));
}

function slug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeCsvRow(raw) {
  const row = {};
  Object.entries(raw).forEach(([key, value]) => {
    const target = CSV_FIELD_MAP[key.trim()];
    if (!target) return;
    row[target] = value.trim();
  });

  NUMBER_FIELDS.forEach(field => {
    if (row[field] !== undefined) row[field] = toNumber(row[field]);
  });

  row.motorWeightKg = toNumber(row.motorWeightKg) / 1000;
  row.propWeightKg = toNumber(row.propWeightKg) / 1000;
  row.id = row.id || [
    row.maker,
    row.motor,
    `kv${row.kv}`,
    `${row.cells}s`,
    row.prop
  ].map(slug).filter(Boolean).join("-");

  return row;
}

export function csvToMotorCombos(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];

  const headers = rows[0].map(header => header.trim());
  const grouped = new Map();

  rows.slice(1).forEach(cols => {
    const raw = {};
    headers.forEach((header, i) => {
      raw[header] = cols[i] || "";
    });
    const row = normalizeCsvRow(raw);
    if (!row.maker || !row.motor || !row.prop || !row.thrustG) return;

    if (!grouped.has(row.id)) {
      grouped.set(row.id, {
        id: row.id,
        maker: row.maker,
        motor: row.motor,
        kv: row.kv,
        voltage: row.voltage,
        cells: row.cells,
        prop: row.prop,
        propInch: row.propInch,
        motorWeightKg: row.motorWeightKg,
        propWeightKg: row.propWeightKg,
        maxCurrentA: row.maxCurrentA,
        sourceUrl: row.sourceUrl,
        note: row.note,
        test: []
      });
    }

    grouped.get(row.id).test.push({
      throttle: row.throttle,
      currentA: row.currentA,
      powerW: row.powerW,
      thrustG: row.thrustG,
      rpm: row.rpm
    });
  });

  return [...grouped.values()].map(combo => ({
    ...combo,
    test: combo.test.sort((a, b) => a.thrustG - b.thrustG)
  }));
}

export async function loadMotorPresetCsv() {
  const response = await fetch("./data/motor-presets.csv");
  if (!response.ok) throw new Error(`Failed to load motor CSV: ${response.status}`);
  return csvToMotorCombos(await response.text());
}

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
