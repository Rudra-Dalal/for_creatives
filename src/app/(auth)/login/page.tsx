import { LoginForm } from '@/features/auth/components/LoginForm';

export const metadata = {
  title: 'Sign In — Creative Workspace',
  description: 'Sign in to your creative workspace projects and references.',
};

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-background">
      <LoginForm />
    </main>
  );
}
