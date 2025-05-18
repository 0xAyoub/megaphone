import { useState, useEffect } from 'react';
import { ProfileComponent } from '../../components/ProfileComponent.jsx';
import { supabase } from '../utils/supabaseClient';
import { useRouter } from 'next/router';

export default function Profile() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [subscription, setSubscription] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        // Récupérer l'utilisateur
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
          router.push('/sign-in');
          return;
        }
        setUser(user);

        // Récupérer l'abonnement
        const { data: sub, error: subError } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .single();

        if (!subError) {
          setSubscription(sub);
        }

      } catch (error) {
        console.error('Error fetching data:', error);
        router.push('/sign-in');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [router]);

  if (loading) {
    return null;
  }

  if (!user) {
    return null;
  }

  return <ProfileComponent user={user} subscription={subscription} />;
}


