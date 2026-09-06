'use client';

import { useLogin } from '../../../hooks/useLogin';
import LoginForm from '../../../components/auth/LoginForm';

export default function LoginPage() {
  const login = useLogin();

  return <LoginForm {...login} />;
}
