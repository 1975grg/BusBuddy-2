/**
 * Password Expiration Utilities
 * 
 * Rules:
 * - Riders: Passwords expire on July 1st every year (end of school year)
 * - Drivers: Never expire unless manually revoked
 * - Admins: Never expire unless manually revoked
 */

/**
 * Calculate the next July 1st expiration date
 * @param fromDate - Starting date (defaults to now)
 * @returns Next July 1st at midnight
 */
export function getNextJuly1st(fromDate: Date = new Date()): Date {
  const year = fromDate.getFullYear();
  const july1st = new Date(year, 6, 1, 0, 0, 0, 0); // Month is 0-indexed, so 6 = July
  
  // If we're past July 1st this year, return next year's July 1st
  if (fromDate >= july1st) {
    return new Date(year + 1, 6, 1, 0, 0, 0, 0);
  }
  
  // Otherwise return this year's July 1st
  return july1st;
}

/**
 * Check if a password has expired
 * @param expiresAt - Password expiration date (null = never expires)
 * @returns true if expired, false otherwise
 */
export function isPasswordExpired(expiresAt: Date | null): boolean {
  if (!expiresAt) return false; // null means never expires
  return new Date() > expiresAt;
}

/**
 * Get password expiration date for a new user based on their role
 * @param role - User role ('rider', 'driver', 'org_admin', 'system_admin')
 * @returns Expiration date or null for non-expiring roles
 */
export function getPasswordExpirationForRole(role: string): Date | null {
  if (role === 'rider') {
    return getNextJuly1st();
  }
  // Drivers and admins never expire
  return null;
}

/**
 * Renew password expiration for a rider to the next July 1st
 * @returns New expiration date
 */
export function renewRiderPassword(): Date {
  return getNextJuly1st();
}
