// Shared, DOM-free appearance configuration normalization.
export const APPEARANCE_COLORS = Object.freeze(["gray", "blue", "green", "amber", "red", "purple", "teal"]);

const FORBIDDEN_FIELDS = new Set(["id", "title", "kind", "labels", "prototype", "constructor", "__proto__"]);
const MAX_APPEARANCE_BYTES = 64 * 1024;
const MAX_CARD_FIELDS = 32;
const MAX_COLOR_FIELDS = 32;
const MAX_COLORS_PER_FIELD = 64;
const MAX_COLOR_VALUE_LENGTH = 120;

function validField(field) {
  return typeof field === "string"
    && /^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(field)
    && !FORBIDDEN_FIELDS.has(field);
}

function scalar(value) {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

export function normalizeAppearance(raw) {
  if (raw === undefined) return { appearance: null, warnings: [] };

  const details = [];
  const warn = (detail) => {
    if (details.length < 8) details.push(String(detail).slice(0, 160));
  };
  const warning = () => details.length ? [{
    code: "invalid_appearance",
    message: "Some roadmap appearance settings were ignored or limited.",
    details,
  }] : [];

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    warn("appearance must be an object");
    return { appearance: null, warnings: warning() };
  }

  let encoded;
  try {
    encoded = JSON.stringify(raw);
  } catch {
    warn("appearance could not be serialized");
    return { appearance: null, warnings: warning() };
  }
  if (new TextEncoder().encode(encoded).length > MAX_APPEARANCE_BYTES) {
    warn("appearance exceeds 64 KiB; all appearance settings were ignored");
    return { appearance: null, warnings: warning() };
  }

  const appearance = {};
  if (Object.hasOwn(raw, "cardFields")) {
    if (Array.isArray(raw.cardFields)) {
      const entries = raw.cardFields;
      if (entries.length > MAX_CARD_FIELDS) warn("cardFields was limited to the first 32 entries");
      const fields = [];
      for (const field of entries.slice(0, MAX_CARD_FIELDS)) {
        if (!validField(field)) {
          warn("invalid cardFields entry was ignored");
          continue;
        }
        if (fields.includes(field)) {
          warn("duplicate cardFields entry was ignored");
          continue;
        }
        fields.push(field);
      }
      appearance.cardFields = fields;
    } else {
      warn("cardFields must be an array; defaults will be used");
    }
  }

  if (Object.hasOwn(raw, "cardColorBy")) {
    if (validField(raw.cardColorBy) && raw.cardColorBy !== "status") {
      appearance.cardColorBy = raw.cardColorBy;
    } else {
      warn("invalid cardColorBy was ignored; status styling will be used");
    }
  }

  if (Object.hasOwn(raw, "colorTags")) {
    if (typeof raw.colorTags === "boolean") appearance.colorTags = raw.colorTags;
    else warn("colorTags must be a boolean; custom tag colors will remain enabled");
  }

  if (Object.hasOwn(raw, "tagColors")) {
    const source = raw.tagColors;
    if (!source || typeof source !== "object" || Array.isArray(source)) {
      warn("tagColors must be an object");
    } else {
      const tagColors = Object.create(null);
      const fields = Object.entries(source);
      if (fields.length > MAX_COLOR_FIELDS) warn("tagColors was limited to the first 32 fields");
      for (const [field, values] of fields.slice(0, MAX_COLOR_FIELDS)) {
        if (!validField(field) || field === "status") {
          warn("invalid or status tagColors field was ignored");
          continue;
        }
        if (!values || typeof values !== "object" || Array.isArray(values)) {
          warn("invalid tagColors field mapping was ignored");
          continue;
        }
        const entries = Object.entries(values);
        if (entries.length > MAX_COLORS_PER_FIELD) warn("tagColors field was limited to the first 64 values");
        const colors = Object.create(null);
        for (const [value, color] of entries.slice(0, MAX_COLORS_PER_FIELD)) {
          if (value.length > MAX_COLOR_VALUE_LENGTH || !APPEARANCE_COLORS.includes(color)) {
            warn("invalid tagColors value or palette name was ignored");
            continue;
          }
          colors[value] = color;
        }
        if (Object.keys(colors).length) tagColors[field] = colors;
      }
      if (Object.keys(tagColors).length) appearance.tagColors = tagColors;
    }
  }

  return { appearance, warnings: warning() };
}

export function getAppearanceColor(appearance, field, scalarValue) {
  if (!appearance || field === "status" || typeof field !== "string" || !scalar(scalarValue)) return "";
  if (scalarValue === "") return "";
  const tagColors = appearance.tagColors;
  if (!tagColors || !Object.hasOwn(tagColors, field)) return "";
  const values = tagColors[field];
  const key = String(scalarValue);
  if (!values || !Object.hasOwn(values, key)) return "";
  const color = values[key];
  return APPEARANCE_COLORS.includes(color) ? color : "";
}
