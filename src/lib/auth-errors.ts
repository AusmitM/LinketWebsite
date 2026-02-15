export function friendlyAuthError(message: string, code?: string) {
  const lowerMessage = message.toLowerCase();

  if (code === "invalid_login_credentials" || lowerMessage.includes("invalid login")) {
    return "We couldn't match that email and password. Try again or reset your password.";
  }
  if (lowerMessage.includes("email not confirmed")) {
    return "Please confirm your email before signing in.";
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
