export type LeadFormStatus = "draft" | "published";

export type LeadFormSettings = {
  collectEmail: "off" | "verified" | "user_input";
  allowEditAfterSubmit: boolean;
  limitOneResponse: "off" | "on";
  showProgressBar: boolean;
  shuffleQuestionOrder: boolean;
  confirmationMessage: string;
};

export type LeadFormMeta = {
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type LeadFormValidation = {
  rule: string;
  value?: unknown;
  message?: string;
};

export type LeadFormPresentation = {
  shuffleOptions?: boolean;
};

export type LeadFormFieldBase = {
  id: string;
  type: LeadFormFieldType;
  label: string;
  helpText: string;
  required: boolean;
  defaultValue?: unknown;
  validation: LeadFormValidation;
  presentation?: LeadFormPresentation;
};

export type LeadFormOption = { id: string; label: string };

export type LeadFormField =
  | LeadFormShortTextField
  | LeadFormLongTextField
  | LeadFormMultipleChoiceField
  | LeadFormCheckboxesField
  | LeadFormDropdownField
  | LeadFormLinearScaleField
  | LeadFormRatingField
  | LeadFormDateField
  | LeadFormTimeField
  | LeadFormFileUploadField
  | LeadFormMultipleChoiceGridField
  | LeadFormCheckboxGridField
  | LeadFormSectionField;

export type LeadFormFieldType =
  | "short_text"
  | "long_text"
  | "multiple_choice"
  | "checkboxes"
  | "dropdown"
  | "linear_scale"
  | "rating"
  | "date"
  | "time"
  | "file_upload"
  | "multiple_choice_grid"
  | "checkbox_grid"
  | "section";

export type LeadFormShortTextField = LeadFormFieldBase & {
  type: "short_text";
};

export type LeadFormLongTextField = LeadFormFieldBase & {
  type: "long_text";
};

export type LeadFormMultipleChoiceField = LeadFormFieldBase & {
  type: "multiple_choice";
  options: LeadFormOption[];
  allowOther: boolean;
  otherLabel: string;
  presentation?: LeadFormPresentation & { shuffleOptions?: boolean };
};

export type LeadFormCheckboxesField = LeadFormFieldBase & {
  type: "checkboxes";
  options: LeadFormOption[];
  allowOther: boolean;
  otherLabel: string;
  presentation?: LeadFormPresentation & { shuffleOptions?: boolean };
};

export type LeadFormDropdownField = LeadFormFieldBase & {
  type: "dropdown";
  options: LeadFormOption[];
  allowOther: boolean;
  otherLabel: string;
  presentation?: LeadFormPresentation & { shuffleOptions?: boolean };
};

export type LeadFormLinearScaleField = LeadFormFieldBase & {
  type: "linear_scale";
  min: number;
  max: number;
  minLabel: string;
  maxLabel: string;
};

export type LeadFormRatingField = LeadFormFieldBase & {
  type: "rating";
  icon: "star" | "heart" | "thumbs";
  scale: number;
};

export type LeadFormDateField = LeadFormFieldBase & {
  type: "date";
  includeYear: boolean;
  includeTime: boolean;
};

export type LeadFormTimeField = LeadFormFieldBase & {
  type: "time";
  mode: "time_of_day" | "duration";
  stepMinutes: number;
};

export type LeadFormFileUploadField = LeadFormFieldBase & {
  type: "file_upload";
  acceptedTypes: string[];
  maxFiles: number;
  maxSizeMB: number;
};

export type LeadFormUploadedFile = {
  name: string;
  path: string;
  url: string | null;
  sizeBytes: number;
  mimeType: string | null;
};

export type LeadFormGridRule = {
  requireResponsePerRow: boolean;
  limitOneResponsePerColumn: boolean;
};

export type LeadFormGridRow = { id: string; label: string };
export type LeadFormGridColumn = { id: string; label: string };

export type LeadFormMultipleChoiceGridField = LeadFormFieldBase & {
  type: "multiple_choice_grid";
  rows: LeadFormGridRow[];
  columns: LeadFormGridColumn[];
  gridRules: LeadFormGridRule;
};

export type LeadFormCheckboxGridField = LeadFormFieldBase & {
  type: "checkbox_grid";
  rows: LeadFormGridRow[];
  columns: LeadFormGridColumn[];
  gridRules: LeadFormGridRule;
};

export type LeadFormSectionField = LeadFormFieldBase & {
  type: "section";
  title: string;
  description: string;
};

export type LeadFormConfig = {
  id: string;
  title: string;
  description: string;
  status: LeadFormStatus;
  settings: LeadFormSettings;
  fields: LeadFormField[];
  meta: LeadFormMeta;
};

export type LeadFormSubmission = {
  responseId: string;
  submittedAt: string;
  answers: Record<string, { value: unknown }>;
};
