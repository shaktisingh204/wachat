export interface LeadFormField {
  _id: string;
  field_name: string;
  field_type: string;
  field_values?: string[];
  is_required?: boolean;
}

export interface LeadFormResponse {
  formId: string;
  fields: LeadFormField[];
}
