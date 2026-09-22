const KEY = 'dinlux-email-change-pending'

export function markEmailChangeRequested(originalEmail: string) {
  try {
    localStorage.setItem(KEY, originalEmail)
  } catch {
    return
  }
}

export function pendingEmailChangeOrigin(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function wasEmailChangeRequested(): boolean {
  return pendingEmailChangeOrigin() !== null
}

export function clearEmailChangeRequested() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    return
  }
}
