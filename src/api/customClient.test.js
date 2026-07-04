/**
 * Adapter regression tests (audit N9/H1): the FastAPI adapter must map
 * backend field names to the names the pages actually read.
 */
import { describe, it, expect } from 'vitest';
import { ENTITY_DEFS, formatApiError } from './customClient';

describe('Admission mapping', () => {
  it('preserves the backend admission_date (regression: admitted_at override)', () => {
    const out = ENTITY_DEFS.Admission.fromAPI({
      id: 'a1',
      admission_date: '2026-07-01T08:00:00Z',
      created_at: '2026-07-01T08:00:00Z',
    });
    expect(out.admission_date).toBe('2026-07-01T08:00:00Z');
    expect(out.created_date).toBe('2026-07-01T08:00:00Z');
  });
});

describe('Invoice mapping', () => {
  it('maps backend total → total_amount and computes net_amount without NaN', () => {
    const out = ENTITY_DEFS.Invoice.fromAPI({
      id: 'i1',
      total: 5000,
      amount_paid: 2000,
      balance: 3000,
      created_at: '2026-07-01T08:00:00Z',
    });
    expect(out.total_amount).toBe(5000);
    expect(out.paid_amount).toBe(2000);
    expect(out.net_amount).toBe(2000); // total - balance
    expect(Number.isNaN(out.net_amount)).toBe(false);
  });
});

describe('Visit mapping', () => {
  it('maps encounter fields to the visit names pages read', () => {
    const out = ENTITY_DEFS.Visit.fromAPI({
      id: 'v1',
      encounter_type: 'opd',
      encounter_date: '2026-07-01T08:00:00Z',
      status: 'open',
      created_at: '2026-07-01T08:00:00Z',
      updated_at: '2026-07-01T09:00:00Z',
    });
    expect(out.visit_type).toBe('opd');
    expect(out.visit_date).toBe('2026-07-01T08:00:00Z');
    expect(out.queue_status).toBe('open');
  });
});

describe('Appointment mapping', () => {
  it('splits scheduled_datetime into the date/time fields the page reads', () => {
    const out = ENTITY_DEFS.Appointment.fromAPI({
      id: 'ap1',
      scheduled_datetime: '2026-07-18T09:30:00+00:00',
      appointment_type: 'antenatal',
      provider_id: 'doc-1',
      status: 'scheduled',
      created_at: '2026-07-04T08:00:00Z',
      updated_at: '2026-07-04T08:00:00Z',
    });
    expect(out.appointment_date).toBe('2026-07-18');
    expect(out.appointment_time).toBe('09:30');
    expect(out.doctor_id).toBe('doc-1');
    expect(out.type).toBe('anc');
  });

  it('combines the form fields into scheduled_datetime and maps the type enum', () => {
    const out = ENTITY_DEFS.Appointment.toAPI({
      patient_id: 'p1',
      appointment_date: '2026-07-18',
      appointment_time: '09:30',
      type: 'surgery',
      doctor_id: '',
      notes: 'theatre slot',
    });
    expect(out.scheduled_datetime).toBe('2026-07-18T09:30:00');
    expect(out.appointment_type).toBe('procedure');
    expect(out.provider_id).toBeNull();
    expect(out.appointment_date).toBeUndefined();
    expect(out.type).toBeUndefined();
  });
});

describe('MedicalAidScheme mapping', () => {
  it('maps insurer name to scheme_name', () => {
    const out = ENTITY_DEFS.MedicalAidScheme.fromAPI({
      id: 's1', name: 'MASM', payer_type: 'medical_scheme',
      created_at: '2026-07-04T08:00:00Z',
    });
    expect(out.scheme_name).toBe('MASM');
  });
  it('defaults payer_type to medical_scheme on create', () => {
    const out = ENTITY_DEFS.MedicalAidScheme.toAPI({ scheme_name: 'Liberty Health' });
    expect(out.name).toBe('Liberty Health');
    expect(out.payer_type).toBe('medical_scheme');
  });
});

describe('formatApiError', () => {
  it('formats FastAPI 422 detail arrays', () => {
    const err = { data: { detail: [{ loc: ['body', 'amount'], msg: 'must be greater than 0' }] } };
    expect(formatApiError(err)).toBe('amount: must be greater than 0');
  });
  it('passes through string detail', () => {
    expect(formatApiError({ data: { detail: 'Insufficient stock' } })).toBe('Insufficient stock');
  });
  it('falls back to the error message', () => {
    expect(formatApiError(new Error('boom'))).toBe('boom');
  });
});
