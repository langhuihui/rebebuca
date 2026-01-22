import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import DashboardNav from '@/components/dashboard/DashboardNav';
import { verifyToken } from '@/lib/auth/jwt';
import { getDB, User } from '@/lib/db';


export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access_token')?.value;

  if (!accessToken) {
    redirect('/login');
  }

  const payload = await verifyToken(accessToken);
  if (!payload || payload.type !== 'access') {
    redirect('/login');
  }

  const db = getDB();
  const user = await db.prepare('SELECT * FROM users WHERE id = ?').bind(payload.sub).first<User>();

  if (!user) {
    redirect('/login');
  }

  // Super admin and admin don't need invitation code
  if (user.role !== 'super_admin' && user.role !== 'admin') {
    // Check if user has used an invitation code
    const usedCode = await db.prepare(`
      SELECT id FROM invitation_codes
      WHERE used_by_user_id = ?
      LIMIT 1
    `).bind(user.id).first();

    if (!usedCode) {
      redirect('/invitation-code');
    }
  }

  // Transform user to match expected format
  const userForNav = {
    id: user.id,
    email: user.email,
    user_metadata: {
      display_name: user.display_name ?? undefined,
      avatar_url: user.avatar_url ?? undefined,
    },
    created_at: user.created_at,
    role: user.role,
    is_banned: user.is_banned,
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-900">
      <DashboardNav user={userForNav} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
