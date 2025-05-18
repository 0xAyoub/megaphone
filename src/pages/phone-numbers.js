import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../utils/supabaseClient';
import { BuyNumberComponent } from '../../components/BuyNumberComponent';

export default function BuyNumber() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkUser() {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) {
          router.push('/sign-in');
        }
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
    return null; // ou un composant de chargement
  }

  return <BuyNumberComponent />;
}