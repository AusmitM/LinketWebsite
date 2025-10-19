export function friendlyAuthError(message: string, code?: string) {
  if (code === "invalid_login_credentials" || message.toLowerCase().includes("invalid login")) {
    return "We couldn't match that email and password. Try again or reset your password.";
  }
  if (message.toLowerCase().includes("email not confirmed")) {
    return "Please confirm your email before signing in.";
  }
  if (message.toLowerCase().includes("password should be at least")) {
    return "Choose a stronger password (minimum 8 characters with letters and numbers).";
  }
  return message;
}
