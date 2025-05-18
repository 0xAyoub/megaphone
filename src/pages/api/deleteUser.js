import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import twilio from 'twilio';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = req.headers.token;
  
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // 1. Vérifier le token et obtenir l'utilisateur
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const userId = user.id;

    // 2. Supprimer toutes les données liées dans l'ordre correct
    // Commencer par les tables qui référencent l'utilisateur

    // Supprimer les abonnements
    const { data: subscriptions } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId);

    if (subscriptions) {
      for (const subscription of subscriptions) {
        // Annuler l'abonnement Stripe si actif
        if (subscription.stripe_subscription_id) {
          try {
            await stripe.subscriptions.cancel(subscription.stripe_subscription_id);
          } catch (stripeError) {
            console.error('Stripe cancellation error:', stripeError);
          }
        }

        // Logger les numéros à supprimer
        if (subscription.phone_number) {
          console.log('Suppression du numéro:', subscription.phone_number);
        }
      }

      // Mettre à jour tous les abonnements en 'canceled'
      await supabaseAdmin
        .from('subscriptions')
        .update({
          status: 'canceled',
          canceled_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);
    }

    // Supprimer les données des autres tables dans l'ordre
    await supabaseAdmin.from('phone_numbers').delete().eq('user_id', userId);
    await supabaseAdmin.from('profiles').delete().eq('id', userId);
    await supabaseAdmin.from('subscriptions').delete().eq('user_id', userId);

    // 3. Finalement, supprimer l'utilisateur
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteError) {
      throw deleteError;
    }

    res.status(200).json({ message: 'Account successfully deleted' });

  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({ 
      error: 'Failed to delete account',
      message: error.message || 'An unexpected error occurred'
    });
  }
} 