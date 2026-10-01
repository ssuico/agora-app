const ALLOWED_SIGNUP_DOMAINS = ['outdoorequipped.com', 'channelprecision.com'] as const;

export function isEmailVerificationEnabled(): boolean {
  return process.env.EMAIL_VERIFICATION_ENABLED === 'true';
}

export function signupDomainError(email: string): string | null {
  const domain = email.split('@')[1] ?? '';
  const allowed = ALLOWED_SIGNUP_DOMAINS.some(
    (company) => domain === company || domain.endsWith(`.${company}`)
  );
  if (allowed) return null;
  return 'Use an @outdoorequipped.com or @channelprecision.com email.';
}
