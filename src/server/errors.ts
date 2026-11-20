// ERRORS AND INPUT CHECKS
// -----------------------
// Small helpers shared by all the server code.

// An error whose message is safe to show to the person using the app, together with the
// HTTP status the API should answer with (400 bad input, 401 not signed in, 403 not
// allowed, 404 not found, 409 conflicts with the current state).
// server/http.ts turns an AppError into a JSON reply; any OTHER kind of error is treated
// as a bug and answered with a generic 500, so internal details never reach the browser.
export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

// Checks that a value from a request body is a non-empty piece of text of sensible
// length, and returns it with the spaces trimmed from both ends. `label` is used in the
// error message, for example "Subject is required."
export function requireText(value: unknown, label: string, max = 5000): string {
  if (typeof value !== "string" || !value.trim()) throw new AppError(400, `${label} is required.`);
  if (value.length > max) throw new AppError(400, `${label} is too long.`);
  return value.trim();
}
