import { useState, useEffect } from 'react';
import { SuccessComponent } from '../../components/SuccessComponent';
import { supabase } from '../utils/supabaseClient';
import { useRouter } from 'next/router';

export default function Success() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    async function checkUser() {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) {
          router.push('/sign-in');
          return;
        }
        setUser(user);
      } catch (error) {
        console.error('Error checking auth:', error);
        router.push('/sign-in');
      } finally {
        setLoading(false);
      }
    }

    checkUser();
  }, [router]);

  if (loading) {
    return null;
  }

  if (!user) {
    return null;
  }

  return <SuccessComponent />;
} 