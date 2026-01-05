import type {
  LeadFormConfig,
  LeadFormField,
  LeadFormFieldType,
  LeadFormMultipleChoiceGridField,
  LeadFormCheckboxGridField,
  LeadFormOption,
  LeadFormSubmission,
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
    status: "draft",
    settings: {
      collectEmail: "off",
      allowEditAfterSubmit: false,
      limitOneResponse: "off",
      showProgressBar: false,
      shuffleQuestionOrder: false,
      confirmationMessage: DEFAULT_CONFIRMATION,
    },
    fields: [
      createField("short_text", "Name"),
      createField("short_text", "Email", {
        validation: { rule: "email" },
        required: true,
      }),
    ],
    meta: { createdAt: now, updatedAt: now, version: 1 },
  };
}

export function normalizeLeadFormConfig(
  raw: Partial<LeadFormConfig> | null | undefined,
  fallbackId: string
): LeadFormConfig {
  const base = createDefaultLeadFormConfig(raw?.id || fallbackId);
  if (!raw) return base;
  const merged: LeadFormConfig = {
    ...base,
    ...raw,
    settings: { ...base.settings, ...(raw.settings ?? {}) },
    fields: Array.isArray(raw.fields)
      ? raw.fields.map((field) => normalizeField(field))
      : base.fields,
    meta: {
      ...base.meta,
      ...(raw.meta ?? {}),
      updatedAt: raw.meta?.updatedAt || base.meta.updatedAt,
      createdAt: raw.meta?.createdAt || base.meta.createdAt,
      version: raw.meta?.version ?? base.meta.version,
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

export function normalizeField(field: LeadFormField): LeadFormField {
  const base = createField(field.type, field.label || "Field", field);
  return { ...base, ...field } as LeadFormField;
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
