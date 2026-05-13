import { redirect } from 'next/navigation';
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
