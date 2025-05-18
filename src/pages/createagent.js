import { useState, useEffect } from 'react';
import CreateAgentComponent from '../../components/CreateAgentComponent';
import { supabase } from '../utils/supabaseClient';
import { useRouter } from 'next/router';

export default function CreateAgent() {
  const router = useRouter();
  const [loading, setLoading] = useState(true); // Ajout d'un état pour le chargement

  useEffect(() => {
    async function checkUser() {
      const user = await supabase.auth.getUser(); // Obtenez l'utilisateur actuel
      if (!user.data.user) {
        router.push('/sign-in');
      } else {
        setLoading(false); // Arrêtez le chargement lorsque l'utilisateur est authentifié
      }
    }

    checkUser();
  }, [router]);

  if (loading) {
    return <div className="loading">Chargement...</div>; // Affichez une animation ou un message de chargement
  }

  return (
    <CreateAgentComponent />
  );
}