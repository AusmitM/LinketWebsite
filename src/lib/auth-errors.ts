export const DUPLICATE_ACCOUNT_ERROR =
  "This account has already been created.";

export const SIGNUP_VERIFICATION_NOTICE =
  "Check your email to verify your account before signing in. A verification email has been sent.";

export function friendlyAuthError(message: string, code?: string) {
  const lowerMessage = message.toLowerCase();

  if (code === "invalid_login_credentials" || lowerMessage.includes("invalid login")) {
    return "We couldn't match that email and password. Try again or reset your password.";
  }
  if (
    lowerMessage.includes("already registered") ||
    lowerMessage.includes("already exists") ||
    lowerMessage.includes("already been created")
  ) {
    return DUPLICATE_ACCOUNT_ERROR;
  }
  if (lowerMessage.includes("email not confirmed")) {
    return "Please verify your email before signing in. A verification email should already be in your inbox.";
  }
  if (
    lowerMessage.includes("password should contain at least one character of each") ||
    (lowerMessage.includes("password") &&
      lowerMessage.includes("lowercase") &&
      lowerMessage.includes("uppercase") &&
      lowerMessage.includes("number") &&
      lowerMessage.includes("symbol"))
  ) {
    return "Use a stronger password: include at least 1 lowercase letter, 1 uppercase letter, 1 number, and 1 symbol.";
  }
  if (lowerMessage.includes("password should be at least")) {
    return "Choose a stronger password (minimum 8 characters with letters and numbers).";
  }
  return message;
}
