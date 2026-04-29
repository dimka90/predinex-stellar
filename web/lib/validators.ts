export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export interface PoolCreationInput {
  title: string;
  description: string;
  outcomeA: string;
  outcomeB: string;
  duration: number;
}

const TITLE_MIN = 5;
const TITLE_MAX = 100;
const DESCRIPTION_MIN = 20;
const DESCRIPTION_MAX = 500;
const OUTCOME_MIN = 1;
const OUTCOME_MAX = 50;
const DURATION_MIN = 300; // 5 minutes
const DURATION_MAX = 31_536_000; // 365 days

/**
 * Validates the pool creation form with real-time feedback.
 *
 * @returns ValidationResult with valid flag and inline error messages.
 */
export function validatePoolCreationForm(input: PoolCreationInput): ValidationResult {
  const errors: Record<string, string> = {};

  // Title
  const title = input.title?.trim();
  if (!title || title.length < TITLE_MIN) {
    errors.title = `Title must be at least ${TITLE_MIN} characters`;
  } else if (title.length > TITLE_MAX) {
    errors.title = `Title must be under ${TITLE_MAX} characters (${title.length}/${TITLE_MAX})`;
  }

  // Description
  const desc = input.description?.trim();
  if (!desc || desc.length < DESCRIPTION_MIN) {
    errors.description = `Description must be at least ${DESCRIPTION_MIN} characters (${desc?.length || 0}/${DESCRIPTION_MIN})`;
  } else if (desc.length > DESCRIPTION_MAX) {
    errors.description = `Description must be under ${DESCRIPTION_MAX} characters (${desc.length}/${DESCRIPTION_MAX})`;
  }

  // Outcome A
  const outcomeA = input.outcomeA?.trim();
  if (!outcomeA || outcomeA.length < OUTCOME_MIN) {
    errors.outcomeA = 'Outcome A is required';
  } else if (outcomeA.length > OUTCOME_MAX) {
    errors.outcomeA = `Outcome A must be under ${OUTCOME_MAX} characters`;
  }

  // Outcome B
  const outcomeB = input.outcomeB?.trim();
  if (!outcomeB || outcomeB.length < OUTCOME_MIN) {
    errors.outcomeB = 'Outcome B is required';
  } else if (outcomeB.length > OUTCOME_MAX) {
    errors.outcomeB = `Outcome B must be under ${OUTCOME_MAX} characters`;
  }

  // Ensure outcomes are different
  if (outcomeA && outcomeB && outcomeA.toLowerCase() === outcomeB.toLowerCase()) {
    errors.outcomeB = 'Outcomes must be different';
  }

  // Duration
  if (!input.duration || input.duration < DURATION_MIN) {
    errors.duration = `Minimum duration is ${DURATION_MIN} seconds`;
  } else if (input.duration > DURATION_MAX) {
    errors.duration = `Maximum duration is ${DURATION_MAX} seconds (365 days)`;
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validates a single field for real-time inline feedback.
 * Returns undefined if valid, or an error message string if invalid.
 */
export function validateField(
  name: keyof PoolCreationInput,
  value: string | number
): string | undefined {
  const result = validatePoolCreationForm({
    title: name === 'title' ? String(value) : 'Valid Title',
    description: name === 'description' ? String(value) : 'Valid description for pool creation validation',
    outcomeA: name === 'outcomeA' ? String(value) : 'Yes',
    outcomeB: name === 'outcomeB' ? String(value) : 'No',
    duration: name === 'duration' ? Number(value) : 86400,
  });

  return result.errors[name];
}

/**
 * Get the maximum character limit for a given field.
 */
export function getCharLimit(field: keyof PoolCreationInput): number | undefined {
  const limits: Partial<Record<keyof PoolCreationInput, number>> = {
    title: TITLE_MAX,
    description: DESCRIPTION_MAX,
    outcomeA: OUTCOME_MAX,
    outcomeB: OUTCOME_MAX,
  };
  return limits[field];
}

/**
 * Get inline help text for a given field.
 */
export function getHelpText(field: keyof PoolCreationInput): string {
  const help: Record<string, string> = {
    title: `${TITLE_MIN}-${TITLE_MAX} characters. Ask a clear yes/no question.`,
    description: `${DESCRIPTION_MIN}-${DESCRIPTION_MAX} characters. Provide context and resolution criteria.`,
    outcomeA: `Short label for the first outcome (max ${OUTCOME_MAX} chars).`,
    outcomeB: `Short label for the second outcome (max ${OUTCOME_MAX} chars). Must differ from Outcome A.`,
    duration: `${DURATION_MIN / 60} min – ${DURATION_MAX / 86400} days in seconds. Bets close after this period.`,
  };
  return help[field] || '';
}