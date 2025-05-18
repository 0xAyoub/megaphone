import { useEffect } from 'react';
import { YourListsComponent } from '../../components/YourListsComponent';
import { supabase } from '../utils/supabaseClient';
import { useRouter } from 'next/router';

export default function YourLists() {
  const router = useRouter();

  useEffect(() => {
    async function checkUser() {
      // Vérifiez si un utilisateur est connecté
      const user = await supabase.auth?.getUser(); // Utilisez user() pour obtenir l'utilisateur actuel
      console.log(user.data.user);
      if (!user.data.user) {
        router.push('/sign-in');
      }
    }

    checkUser();
  }, [router]); // Ajoutez router comme dépendance de useEffect

  return (
    <YourListsComponent />
  );
}
