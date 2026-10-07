/**
 * Removes comments so structural checks cannot be satisfied by commented-out
 * code. Mirrors stripComments() in scripts/lib/content-validator.ts, which
 * verifies that every reference solution passes its own checks.
 */
export function stripComments(code: string, language: string): string {
  switch (language) {
    case 'sas':
      return code.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|;)\s*\*[^;]*;/g, '$1');
    case 'sql':
      return code.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, '');
    case 'r':
    case 'python':
      return code.replace(/(^|[^'"\\])#[^\n]*/g, '$1');
    default:
      return code;
  }
}
