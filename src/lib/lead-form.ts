import type {
  LeadFormConfig,
  LeadFormField,
  LeadFormFieldType,
  LeadFormGridRule,
  LeadFormMultipleChoiceGridField,
  LeadFormCheckboxGridField,
  LeadFormOption,
  LeadFormSettings,
  LeadFormSubmission,
  LeadFormValidation,
} from "@/types/lead-form";

type ValidationError = { fieldId: string; message: string };

const DEFAULT_FORM_TITLE = "Let's Connect!";
const DEFAULT_CONFIRMATION =
  "Thanks for reaching out. We will follow up soon.";

export function createDefaultLeadFormConfig(id: string): LeadFormConfig {
  const now = new Date().toISOString();
  return {
    id,
    title: DEFAULT_FORM_TITLE,
    description: "",
    status: "published",
    settings: {
      collectEmail: "user_input",
      allowEditAfterSubmit: false,
      limitOneResponse: "off",
      showProgressBar: false,
      shuffleQuestionOrder: false,
      confirmationMessage: DEFAULT_CONFIRMATION,
    },
    fields: [
      createField("short_text", "Name", {
        helpText: "Ex. John Doe",
        required: true,
      }),
      createField("short_text", "Email", {
        helpText: "JDoe@LinketConnect.com",
        validation: { rule: "email" },
      }),
      createField("short_text", "Phone Number", {
        helpText: "(###) ### - ####",
      }),
      createField("long_text", "Note"),
    ],
    meta: { createdAt: now, updatedAt: now, version: 1 },
  };
}

export function normalizeLeadFormConfig(
  raw: Partial<LeadFormConfig> | null | undefined,
  fallbackId: string
): LeadFormConfig {
  const base = createDefaultLeadFormConfig(
    toNonEmptyString(raw?.id, fallbackId)
  );
  if (!raw) return base;

  const meta = isRecord(raw.meta)
    ? (raw.meta as Partial<LeadFormConfig["meta"]>)
    : null;

  const merged: LeadFormConfig = {
    ...base,
    id: toNonEmptyString(raw.id, base.id),
    title: toTextString(raw.title, base.title),
    description: toTextString(raw.description, base.description),
    status: "published",
    settings: normalizeSettings(raw.settings, base.settings),
    fields: Array.isArray(raw.fields)
      ? raw.fields.map((field) => normalizeField(field))
      : base.fields,
    meta: {
      createdAt: toNonEmptyString(meta?.createdAt, base.meta.createdAt),
      updatedAt: toNonEmptyString(meta?.updatedAt, base.meta.updatedAt),
      version: toPositiveInteger(meta?.version, base.meta.version),
    },
  };

  return merged;
}

export function createField(
  type: LeadFormFieldType,
  label: string,
  overrides: Partial<LeadFormField> = {}
): LeadFormField {
  const base = {
    id: overrides.id || `field_${randomId()}`,
    type,
    label,
    helpText: "",
    required: false,
    validation: { rule: "none" },
  } as LeadFormField;

  switch (type) {
    case "short_text":
    case "long_text":
      return { ...base, ...overrides } as LeadFormField;
    case "multiple_choice":
    case "checkboxes":
    case "dropdown":
      return {
        ...base,
        options: [
          { id: `opt_${randomId()}`, label: "Option 1" },
          { id: `opt_${randomId()}`, label: "Option 2" },
        ],
        allowOther: false,
        otherLabel: "Other",
        presentation: { shuffleOptions: false },
        ...overrides,
      } as LeadFormField;
    case "linear_scale":
      return {
        ...base,
        min: 1,
        max: 5,
        minLabel: "Low",
        maxLabel: "High",
        ...overrides,
      } as LeadFormField;
    case "rating":
      return {
        ...base,
        icon: "star",
        scale: 5,
        ...overrides,
      } as LeadFormField;
    case "date":
      return {
        ...base,
        includeYear: true,
        includeTime: false,
        ...overrides,
      } as LeadFormField;
    case "time":
      return {
        ...base,
        mode: "time_of_day",
        stepMinutes: 5,
        ...overrides,
      } as LeadFormField;
    case "file_upload":
      return {
        ...base,
        acceptedTypes: ["pdf", "png", "jpg"],
        maxFiles: 1,
        maxSizeMB: 10,
        ...overrides,
      } as LeadFormField;
    case "multiple_choice_grid":
    case "checkbox_grid":
      return {
        ...base,
        rows: [
          { id: `row_${randomId()}`, label: "Row 1" },
          { id: `row_${randomId()}`, label: "Row 2" },
        ],
        columns: [
          { id: `col_${randomId()}`, label: "Col 1" },
          { id: `col_${randomId()}`, label: "Col 2" },
        ],
        gridRules: { requireResponsePerRow: false, limitOneResponsePerColumn: false },
        ...overrides,
      } as LeadFormField;
    case "section":
      return {
        ...base,
        title: label,
        description: "",
        ...overrides,
      } as LeadFormField;
    default:
      return { ...base, ...overrides } as LeadFormField;
  }
}

export function normalizeField(
  rawField: Partial<LeadFormField> | null | undefined
): LeadFormField {
  const source: Record<string, unknown> = isRecord(rawField) ? rawField : {};
  const nextType = isLeadFormFieldType(source.type)
    ? source.type
    : "short_text";
  const nextLabel = toTextString(source.label, "Field");
  const base = createField(nextType, nextLabel);
  const common = {
    ...base,
    id: toNonEmptyString(source.id, base.id),
    type: nextType,
    label: nextLabel,
    helpText: toTextString(source.helpText, base.helpText),
    required: Boolean(source.required),
    validation: normalizeValidation(
      source.validation as LeadFormValidation | null | undefined,
      base.validation
    ),
  };

  switch (nextType) {
    case "short_text":
    case "long_text":
      return common as LeadFormField;
    case "multiple_choice":
    case "checkboxes":
    case "dropdown": {
      const typedBase = base as Extract<
        LeadFormField,
        { type: "multiple_choice" | "checkboxes" | "dropdown" }
      >;
      const presentation = normalizePresentation(source.presentation);
      return {
        ...common,
        options: normalizeOptionList(source.options, typedBase.options, "opt"),
        allowOther: Boolean(source.allowOther),
        otherLabel: toNonEmptyString(source.otherLabel, typedBase.otherLabel),
        presentation: {
          shuffleOptions: Boolean(presentation?.shuffleOptions),
        },
      } as LeadFormField;
    }
    case "linear_scale": {
      const typedBase = base as Extract<LeadFormField, { type: "linear_scale" }>;
      const min = toPositiveInteger(source.min, typedBase.min);
      const max = Math.max(
        min + 1,
        toPositiveInteger(source.max, typedBase.max)
      );
      return {
        ...common,
        min,
        max,
        minLabel: toTextString(source.minLabel, typedBase.minLabel),
        maxLabel: toTextString(source.maxLabel, typedBase.maxLabel),
      } as LeadFormField;
    }
    case "rating": {
      const typedBase = base as Extract<LeadFormField, { type: "rating" }>;
      const icon =
        source.icon === "heart" || source.icon === "thumbs" || source.icon === "star"
          ? source.icon
          : typedBase.icon;
      return {
        ...common,
        icon,
        scale: Math.min(
          10,
          Math.max(3, toPositiveInteger(source.scale, typedBase.scale))
        ),
      } as LeadFormField;
    }
    case "date": {
      const typedBase = base as Extract<LeadFormField, { type: "date" }>;
      return {
        ...common,
        includeYear:
          typeof source.includeYear === "boolean"
            ? source.includeYear
            : typedBase.includeYear,
        includeTime:
          typeof source.includeTime === "boolean"
            ? source.includeTime
            : typedBase.includeTime,
      } as LeadFormField;
    }
    case "time": {
      const typedBase = base as Extract<LeadFormField, { type: "time" }>;
      return {
        ...common,
        mode: source.mode === "duration" ? "duration" : "time_of_day",
        stepMinutes: toPositiveInteger(source.stepMinutes, typedBase.stepMinutes),
      } as LeadFormField;
    }
    case "file_upload": {
      const typedBase = base as Extract<LeadFormField, { type: "file_upload" }>;
      return {
        ...common,
        acceptedTypes: normalizeStringArray(source.acceptedTypes, typedBase.acceptedTypes),
        maxFiles: toPositiveInteger(source.maxFiles, typedBase.maxFiles),
        maxSizeMB: toPositiveInteger(source.maxSizeMB, typedBase.maxSizeMB),
      } as LeadFormField;
    }
    case "multiple_choice_grid":
    case "checkbox_grid": {
      const typedBase = base as Extract<
        LeadFormField,
        { type: "multiple_choice_grid" | "checkbox_grid" }
      >;
      return {
        ...common,
        rows: normalizeOptionList(source.rows, typedBase.rows, "row"),
        columns: normalizeOptionList(source.columns, typedBase.columns, "col"),
        gridRules: normalizeGridRule(source.gridRules, typedBase.gridRules),
      } as LeadFormField;
    }
    case "section": {
      const typedBase = base as Extract<LeadFormField, { type: "section" }>;
      return {
        ...common,
        title: toTextString(source.title, typedBase.title),
        description: toTextString(source.description, typedBase.description),
      } as LeadFormField;
    }
    default:
      return common as LeadFormField;
  }
}

function normalizeSettings(
  raw: Partial<LeadFormSettings> | null | undefined,
  fallback: LeadFormSettings
): LeadFormSettings {
  const source: Record<string, unknown> = isRecord(raw) ? raw : {};
  const collectEmail =
    source.collectEmail === "off" ||
    source.collectEmail === "verified" ||
    source.collectEmail === "user_input"
      ? source.collectEmail
      : fallback.collectEmail;
  const limitOneResponse =
    source.limitOneResponse === "off" || source.limitOneResponse === "on"
      ? source.limitOneResponse
      : fallback.limitOneResponse;

  return {
    collectEmail,
    allowEditAfterSubmit:
      typeof source.allowEditAfterSubmit === "boolean"
        ? source.allowEditAfterSubmit
        : fallback.allowEditAfterSubmit,
    limitOneResponse,
    showProgressBar:
      typeof source.showProgressBar === "boolean"
        ? source.showProgressBar
        : fallback.showProgressBar,
    shuffleQuestionOrder:
      typeof source.shuffleQuestionOrder === "boolean"
        ? source.shuffleQuestionOrder
        : fallback.shuffleQuestionOrder,
    confirmationMessage: toTextString(
      source.confirmationMessage,
      fallback.confirmationMessage
    ),
  };
}

function normalizeValidation(
  raw: LeadFormValidation | null | undefined,
  fallback: LeadFormValidation
): LeadFormValidation {
  const source: Record<string, unknown> = isRecord(raw) ? raw : {};
  const next: LeadFormValidation = {
    rule: toNonEmptyString(source.rule, fallback.rule),
  };
  if ("value" in source) {
    next.value = source.value;
  } else if ("value" in fallback) {
    next.value = fallback.value;
  }
  if (typeof source.message === "string") {
    next.message = source.message;
  } else if (typeof fallback.message === "string") {
    next.message = fallback.message;
  }
  return next;
}

function normalizePresentation(raw: unknown) {
  if (!isRecord(raw)) return undefined;
  if (typeof raw.shuffleOptions !== "boolean") return undefined;
  return { shuffleOptions: raw.shuffleOptions };
}

function normalizeOptionList(
  raw: unknown,
  fallback: LeadFormOption[],
  prefix: string
): LeadFormOption[] {
  if (!Array.isArray(raw)) return fallback.map((option) => ({ ...option }));
  const seen = new Set<string>();
  const out: LeadFormOption[] = [];

  raw.forEach((entry) => {
    if (!isRecord(entry)) return;
    const id = toNonEmptyString(entry.id, `${prefix}_${randomId()}`);
    if (seen.has(id)) return;
    seen.add(id);
    out.push({
      id,
      label: toTextString(entry.label, ""),
    });
  });

  if (out.length === 0) {
    return fallback.map((option) => ({ ...option }));
  }

  return out;
}

function normalizeStringArray(raw: unknown, fallback: string[]): string[] {
  if (!Array.isArray(raw)) return fallback.slice();
  const values = Array.from(
    new Set(raw.map((entry) => toNonEmptyString(entry, "")).filter(Boolean))
  );
  return values.length > 0 ? values : fallback.slice();
}

function normalizeGridRule(
  raw: unknown,
  fallback: LeadFormGridRule
): LeadFormGridRule {
  if (!isRecord(raw)) return { ...fallback };
  return {
    requireResponsePerRow:
      typeof raw.requireResponsePerRow === "boolean"
        ? raw.requireResponsePerRow
        : fallback.requireResponsePerRow,
    limitOneResponsePerColumn:
      typeof raw.limitOneResponsePerColumn === "boolean"
        ? raw.limitOneResponsePerColumn
        : fallback.limitOneResponsePerColumn,
  };
}

function isLeadFormFieldType(value: unknown): value is LeadFormFieldType {
  return (
    value === "short_text" ||
    value === "long_text" ||
    value === "multiple_choice" ||
    value === "checkboxes" ||
    value === "dropdown" ||
    value === "linear_scale" ||
    value === "rating" ||
    value === "date" ||
    value === "time" ||
    value === "file_upload" ||
    value === "multiple_choice_grid" ||
    value === "checkbox_grid" ||
    value === "section"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toTextString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return fallback;
}

function toNonEmptyString(value: unknown, fallback: string): string {
  const text = toTextString(value, "").trim();
  return text || fallback;
}

function toPositiveInteger(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const rounded = Math.floor(parsed);
  return rounded > 0 ? rounded : fallback;
}

export function validateSubmission(
  config: LeadFormConfig,
  answers: LeadFormSubmission["answers"]
): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const field of config.fields) {
    if (field.type === "section") continue;
    const value = answers[field.id]?.value;
    if (field.type === "multiple_choice_grid") {
      const gridError = validateGrid(field, value);
      if (gridError) {
        errors.push(gridError);
        continue;
      }
    }
    if (field.type === "checkbox_grid") {
      const gridError = validateGrid(field, value);
      if (gridError) {
        errors.push(gridError);
        continue;
      }
    }
    if (field.required && isEmptyValue(value)) {
      errors.push({
        fieldId: field.id,
        message: field.validation.message || "This field is required.",
      });
      continue;
    }
    const validationError = validateField(field, value);
    if (validationError) errors.push(validationError);
  }
  return errors;
}

export function shuffleFields(fields: LeadFormField[]) {
  return shuffleArray(fields.slice());
}

export function shuffleOptions(options: LeadFormOption[]) {
  return shuffleArray(options.slice());
}

function validateField(
  field: LeadFormField,
  value: unknown
): ValidationError | null {
  const rule = field.validation?.rule || "none";
  const message = field.validation?.message;
  if (rule === "none" || value == null) return null;

  const str = typeof value === "string" ? value.trim() : "";
  const length = str.length;

  switch (field.type) {
    case "short_text": {
      if (rule === "email" && str && !/^\S+@\S+\.\S+$/.test(str)) {
        return { fieldId: field.id, message: message || "Enter a valid email." };
      }
      if (rule === "url" && str && !/^https?:\/\//i.test(str)) {
        return { fieldId: field.id, message: message || "Enter a valid URL." };
      }
      if (rule === "regex" && str) {
        try {
          const regex = new RegExp(String(field.validation.value || ""));
          if (!regex.test(str)) {
            return { fieldId: field.id, message: message || "Invalid format." };
          }
        } catch {
          return null;
        }
      }
      if (rule === "min_length" && length < Number(field.validation.value || 0)) {
        return { fieldId: field.id, message: message || "Too short." };
      }
      if (rule === "max_length" && length > Number(field.validation.value || 0)) {
        return { fieldId: field.id, message: message || "Too long." };
      }
      if (rule === "length_range") {
        const range = field.validation.value as { min?: number; max?: number } | undefined;
        if (range?.min != null && length < range.min) {
          return { fieldId: field.id, message: message || "Too short." };
        }
        if (range?.max != null && length > range.max) {
          return { fieldId: field.id, message: message || "Too long." };
        }
      }
      return null;
    }
    case "long_text": {
      if (rule === "regex" && str) {
        try {
          const regex = new RegExp(String(field.validation.value || ""));
          if (!regex.test(str)) {
            return { fieldId: field.id, message: message || "Invalid format." };
          }
        } catch {
          return null;
        }
      }
      if (rule === "max_length" && length > Number(field.validation.value || 0)) {
        return { fieldId: field.id, message: message || "Too long." };
      }
      if (rule === "length_range") {
        const range = field.validation.value as { min?: number; max?: number } | undefined;
        if (range?.max != null && length > range.max) {
          return { fieldId: field.id, message: message || "Too long." };
        }
      }
      return null;
    }
    case "checkboxes": {
      const arr = Array.isArray(value) ? value : [];
      const count = arr.length;
      if (rule === "min_selections" && count < Number(field.validation.value || 0)) {
        return { fieldId: field.id, message: message || "Select more options." };
      }
      if (rule === "max_selections" && count > Number(field.validation.value || 0)) {
        return { fieldId: field.id, message: message || "Select fewer options." };
      }
      if (rule === "selection_range") {
        const range = field.validation.value as { min?: number; max?: number } | undefined;
        if (range?.min != null && count < range.min) {
          return { fieldId: field.id, message: message || "Select more options." };
        }
        if (range?.max != null && count > range.max) {
          return { fieldId: field.id, message: message || "Select fewer options." };
        }
      }
      return null;
    }
    case "date": {
      if (!str) return null;
      const date = new Date(str);
      if (Number.isNaN(date.getTime())) return null;
      if (rule === "min_date" && field.validation.value) {
        const min = new Date(String(field.validation.value));
        if (date < min) {
          return { fieldId: field.id, message: message || "Select a later date." };
        }
      }
      if (rule === "max_date" && field.validation.value) {
        const max = new Date(String(field.validation.value));
        if (date > max) {
          return { fieldId: field.id, message: message || "Select an earlier date." };
        }
      }
      if (rule === "date_range") {
        const range = field.validation.value as { min?: string; max?: string } | undefined;
        if (range?.min && date < new Date(range.min)) {
          return { fieldId: field.id, message: message || "Select a later date." };
        }
        if (range?.max && date > new Date(range.max)) {
          return { fieldId: field.id, message: message || "Select an earlier date." };
        }
      }
      return null;
    }
    case "time": {
      if (!str) return null;
      if (rule === "min_time" && field.validation.value) {
        if (str < String(field.validation.value)) {
          return { fieldId: field.id, message: message || "Select a later time." };
        }
      }
      if (rule === "max_time" && field.validation.value) {
        if (str > String(field.validation.value)) {
          return { fieldId: field.id, message: message || "Select an earlier time." };
        }
      }
      if (rule === "time_range") {
        const range = field.validation.value as { min?: string; max?: string } | undefined;
        if (range?.min && str < range.min) {
          return { fieldId: field.id, message: message || "Select a later time." };
        }
        if (range?.max && str > range.max) {
          return { fieldId: field.id, message: message || "Select an earlier time." };
        }
      }
      return null;
    }
    default:
      return null;
  }
}

function validateGrid(
  field: LeadFormMultipleChoiceGridField | LeadFormCheckboxGridField,
  value: unknown
): ValidationError | null {
  const message = field.validation?.message || "Please complete the grid.";
  const rows = field.rows;
  const columns = field.columns;
  const map = (value || {}) as Record<string, unknown>;

  if (field.required && isEmptyValue(map)) {
    return { fieldId: field.id, message };
  }

  if (field.gridRules?.requireResponsePerRow) {
    const missingRow = rows.find((row) => {
      const rowValue = map[row.id];
      if (field.type === "multiple_choice_grid") {
        return !rowValue;
      }
      return !Array.isArray(rowValue) || rowValue.length === 0;
    });
    if (missingRow) {
      return { fieldId: field.id, message };
    }
  }

  if (field.gridRules?.limitOneResponsePerColumn) {
    const used = new Map<string, number>();
    rows.forEach((row) => {
      const rowValue = map[row.id];
      if (field.type === "multiple_choice_grid") {
        if (typeof rowValue === "string") {
          used.set(rowValue, (used.get(rowValue) || 0) + 1);
        }
      } else if (Array.isArray(rowValue)) {
        rowValue.forEach((columnId) => {
          used.set(String(columnId), (used.get(String(columnId)) || 0) + 1);
        });
      }
    });
    const hasDuplicate = columns.some(
      (column) => (used.get(column.id) || 0) > 1
    );
    if (hasDuplicate) {
      return { fieldId: field.id, message };
    }
  }

  return null;
}

function isEmptyValue(value: unknown) {
  if (value == null) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value).length === 0;
  return false;
}

function shuffleArray<T>(items: T[]) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function randomId() {
  return Math.random().toString(36).slice(2, 10);
}
