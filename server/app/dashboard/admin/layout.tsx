export const runtime = 'edge';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken } from '@/lib/auth/jwt';
import { getDB, User } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/auth';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requireSuperAdmin();
  } catch (error) {
    redirect('/dashboard');
  }

  return <>{children}</>;
}
