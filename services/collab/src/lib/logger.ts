export function log(context: string, message: string): void {
  console.log(`[${context}] ${message}`);
}

export function logError(context: string, message: string, error?: unknown): void {
  console.error(`[${context}] ${message}`, error ?? "");
}
