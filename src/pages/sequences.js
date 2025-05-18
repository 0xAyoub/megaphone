import { useState } from 'react';
import {SequencesComponent} from '../../components/SequencesComponent.jsx';
import { supabase } from '../utils/supabaseClient.js';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

export default function Sequences() {
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
    <SequencesComponent />
  );
}


