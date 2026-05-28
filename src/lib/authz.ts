import type { Session } from 'next-auth';

export function getAdminEmails() {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminSession(session: Session | null) {
  const email = session?.user?.email?.toLowerCase();
  if (!email) return false;

  const adminEmails = getAdminEmails();
  return adminEmails.includes(email);
}
