/**
 * Insurance Claim Form Templates Registry
 * Maps each medical aid scheme to its field layout coordinates
 * Coordinates are in mm for A4 (210x297mm)
 */

export const CLAIM_FORM_TEMPLATES = {
  liberty: {
    name: 'Liberty Health Cover',
    displayName: 'Liberty Health Cover Claim Form',
    fields: {
      invoice_number: { x: 155, y: 15, width: 40, height: 6 },
      patient_first_name: { x: 105, y: 32, width: 90, height: 5 },
      patient_last_name: { x: 155, y: 32, width: 40, height: 5 },
      patient_member_no: { x: 105, y: 40, width: 90, height: 5 },
      patient_dob: { x: 155, y: 40, width: 40, height: 5 },
      patient_gender: { x: 125, y: 40, width: 25, height: 5 },
      facility_name: { x: 15, y: 62, width: 90, height: 5 },
      doctor_name: { x: 155, y: 62, width: 40, height: 5 },
      doctor_specialty: { x: 155, y: 68, width: 40, height: 5 },
      treatment_date: { x: 15, y: 75, width: 40, height: 5 },
      admission_date: { x: 105, y: 75, width: 40, height: 5 },
      discharge_date: { x: 155, y: 75, width: 40, height: 5 },
      diagnosis: { x: 15, y: 88, width: 180, height: 10 },
      // Treatment items table starts at y: 100
      items_start_y: 100,
      items_row_height: 5,
      items_columns: {
        description: { x: 15, width: 90 },
        code: { x: 107, width: 20 },
        quantity: { x: 130, width: 15 },
        cost: { x: 147, width: 48 }
      },
      total_cost: { x: 147, y: 250, width: 48, height: 6 }
    }
  },

  masm: {
    name: 'MASM Medical Aid',
    displayName: 'Medical Aid Claim Form (MASM)',
    fields: {
      member_name: { x: 15, y: 35, width: 90, height: 5 },
      employee_name: { x: 15, y: 42, width: 90, height: 5 },
      patient_name: { x: 15, y: 49, width: 90, height: 5 },
      department_treated: { x: 105, y: 42, width: 90, height: 5 },
      treatment_date: { x: 15, y: 56, width: 40, height: 5 },
      nature_of_illness: { x: 15, y: 75, width: 180, height: 8 },
      // Cost sections
      consultation_cost: { x: 155, y: 90, width: 40, height: 5 },
      hospitalization_cost: { x: 155, y: 100, width: 40, height: 5 },
      drugs_cost: { x: 155, y: 110, width: 40, height: 5 },
      lab_cost: { x: 155, y: 120, width: 40, height: 5 },
      dentistry_cost: { x: 155, y: 130, width: 40, height: 5 },
      optician_cost: { x: 155, y: 140, width: 40, height: 5 },
      total_cost: { x: 155, y: 180, width: 40, height: 6 }
    }
  },

  wemas: {
    name: 'WEMAS',
    displayName: 'Wella Medical Aid Society Claim Form',
    fields: {
      claim_no: { x: 15, y: 32, width: 40, height: 5 },
      invoice_no: { x: 105, y: 32, width: 40, height: 5 },
      member_surname: { x: 15, y: 45, width: 90, height: 5 },
      member_first_name: { x: 105, y: 45, width: 90, height: 5 },
      employer_name: { x: 15, y: 52, width: 180, height: 5 },
      patient_surname: { x: 15, y: 75, width: 90, height: 5 },
      patient_first_name: { x: 105, y: 75, width: 90, height: 5 },
      patient_dob: { x: 15, y: 82, width: 40, height: 5 },
      patient_gender: { x: 105, y: 82, width: 25, height: 5 },
      admission_date: { x: 15, y: 95, width: 40, height: 5 },
      discharge_date: { x: 105, y: 95, width: 40, height: 5 },
      provider_name: { x: 15, y: 108, width: 90, height: 5 },
      diagnosis: { x: 15, y: 130, width: 180, height: 8 },
      // Treatment items table starts at y: 145
      items_start_y: 145,
      items_row_height: 5,
      items_columns: {
        date: { x: 15, width: 20 },
        description: { x: 37, width: 70 },
        type_of_service: { x: 109, width: 25 },
        unit_days: { x: 136, width: 15 },
        quantity: { x: 153, width: 12 },
        fee_charged: { x: 167, width: 28 }
      },
      total_cost: { x: 167, y: 240, width: 28, height: 6 }
    }
  },

  nabmas: {
    name: 'NABMAS',
    displayName: 'National Bank of Malawi Medical Scheme',
    fields: {
      claim_no: { x: 155, y: 20, width: 40, height: 5 },
      employee_name: { x: 15, y: 35, width: 90, height: 5 },
      employee_id: { x: 105, y: 35, width: 90, height: 5 },
      patient_name: { x: 15, y: 42, width: 90, height: 5 },
      treatment_date: { x: 105, y: 42, width: 90, height: 5 },
      consultation_cost: { x: 155, y: 90, width: 40, height: 5 },
      hospitalization_cost: { x: 155, y: 100, width: 40, height: 5 },
      drugs_cost: { x: 155, y: 110, width: 40, height: 5 },
      total_cost: { x: 155, y: 180, width: 40, height: 6 }
    }
  },

  horizon: {
    name: 'Horizon Health',
    displayName: 'Horizon Health Claim Form',
    fields: {
      claim_no: { x: 15, y: 32, width: 40, height: 5 },
      member_surname: { x: 15, y: 45, width: 90, height: 5 },
      member_first_name: { x: 105, y: 45, width: 90, height: 5 },
      employer_name: { x: 15, y: 52, width: 180, height: 5 },
      patient_surname: { x: 15, y: 75, width: 90, height: 5 },
      patient_first_name: { x: 105, y: 75, width: 90, height: 5 },
      patient_dob: { x: 15, y: 82, width: 40, height: 5 },
      provider_name: { x: 15, y: 108, width: 90, height: 5 },
      nature_of_illness: { x: 15, y: 130, width: 180, height: 8 },
      // Treatment items table starts at y: 145
      items_start_y: 145,
      items_row_height: 5,
      items_columns: {
        date: { x: 15, width: 20 },
        description: { x: 37, width: 70 },
        type_of_service: { x: 109, width: 25 },
        unit_days: { x: 136, width: 15 },
        quantity: { x: 153, width: 12 },
        fee_charged: { x: 167, width: 28 }
      },
      total_cost: { x: 167, y: 240, width: 28, height: 6 }
    }
  },

  precious: {
    name: 'Precious Medical International',
    displayName: 'Precious Medical International Claim Form',
    fields: {
      claim_no: { x: 155, y: 20, width: 40, height: 5 },
      member_surname: { x: 15, y: 40, width: 90, height: 5 },
      member_first_name: { x: 105, y: 40, width: 90, height: 5 },
      employer_name: { x: 15, y: 47, width: 180, height: 5 },
      patient_surname: { x: 15, y: 70, width: 90, height: 5 },
      patient_first_name: { x: 105, y: 70, width: 90, height: 5 },
      patient_dob: { x: 15, y: 77, width: 40, height: 5 },
      diagnosis: { x: 15, y: 100, width: 180, height: 8 },
      // Treatment items table
      items_start_y: 115,
      items_row_height: 5,
      items_columns: {
        date: { x: 15, width: 20 },
        code: { x: 37, width: 20 },
        description: { x: 59, width: 60 },
        unit_cost: { x: 121, width: 25 },
        quantity: { x: 148, width: 15 },
        cost: { x: 165, width: 30 }
      },
      total_cost: { x: 165, y: 235, width: 30, height: 6 }
    }
  },

  unimed: {
    name: 'UNIMED',
    displayName: 'University of Malawi Medical Scheme',
    fields: {
      patient_unimed_id: { x: 15, y: 35, width: 90, height: 5 },
      principal_member: { x: 15, y: 42, width: 90, height: 5 },
      patient_name: { x: 15, y: 49, width: 90, height: 5 },
      patient_dob: { x: 105, y: 49, width: 90, height: 5 },
      provider_name: { x: 15, y: 68, width: 90, height: 5 },
      diagnosis: { x: 15, y: 85, width: 180, height: 8 },
      // Treatment cost table
      consultation_cost: { x: 155, y: 100, width: 40, height: 5 },
      drugs_cost: { x: 155, y: 110, width: 40, height: 5 },
      hospitalization_cost: { x: 155, y: 120, width: 40, height: 5 },
      lab_cost: { x: 155, y: 130, width: 40, height: 5 },
      total_cost: { x: 155, y: 170, width: 40, height: 6 }
    }
  },

  zamzam: {
    name: 'Zamzam Africa',
    displayName: 'Zamzam Medical Claim Form',
    fields: {
      claim_no: { x: 155, y: 20, width: 40, height: 5 },
      employee_name: { x: 15, y: 35, width: 90, height: 5 },
      patient_name: { x: 15, y: 55, width: 90, height: 5 },
      patient_dob: { x: 105, y: 55, width: 90, height: 5 },
      doctor_number: { x: 15, y: 90, width: 40, height: 5 },
      invoice_no: { x: 60, y: 90, width: 40, height: 5 },
      diagnosis: { x: 15, y: 105, width: 180, height: 8 },
      // Line items table
      items_start_y: 120,
      items_row_height: 5,
      items_columns: {
        line_no: { x: 15, width: 10 },
        code: { x: 27, width: 20 },
        description: { x: 49, width: 70 },
        qty: { x: 121, width: 12 },
        fee_charged: { x: 135, width: 25 }
      },
      total_cost: { x: 135, y: 235, width: 25, height: 6 }
    }
  }
};

/**
 * Get a scheme template by ID
 */
export function getTemplate(schemeId) {
  return CLAIM_FORM_TEMPLATES[schemeId.toLowerCase()] || null;
}

/**
 * List all available schemes
 */
export function listSchemes() {
  return Object.entries(CLAIM_FORM_TEMPLATES).map(([id, template]) => ({
    id,
    name: template.name,
    displayName: template.displayName
  }));
}