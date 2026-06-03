// Lightweight, dependency-free form validation used by Book and Contact.

export const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())

// Accepts Ghana formats: +233XXXXXXXXX, 0XXXXXXXXX, with spaces/dashes.
export const isPhone = (v) => {
  const d = v.replace(/[\s-]/g, '')
  return /^(\+233|0)\d{9}$/.test(d)
}

export const required = (v) => v.trim().length > 0

// Returns { field: 'message' } for any invalid field.
export function validate(values, rules) {
  const errors = {}
  for (const [field, checks] of Object.entries(rules)) {
    for (const { test, message } of checks) {
      if (!test(values[field] ?? '')) {
        errors[field] = message
        break
      }
    }
  }
  return errors
}
