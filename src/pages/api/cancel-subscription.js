import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import twilio from 'twilio';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
); 

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 1. Récupérer le token d'authentification depuis le header
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Missing authorization header' });
    }

    // 2. Vérifier et récupérer l'utilisateur
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) {
      console.error('Auth error:', userError);
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // 3. Récupérer l'abonnement actif de l'utilisateur
    const { data: subscription, error: fetchError } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (fetchError || !subscription) {
      console.error('Error fetching subscription:', fetchError);
      return res.status(404).json({ error: 'No active subscription found' });
    }

    // 4. Libérer le numéro Twilio si existant
    if (subscription.phone_number) {
      try {
        const numbers = await twilioClient.incomingPhoneNumbers.list({
          phoneNumber: subscription.phone_number
        });

        if (numbers && numbers.length > 0) {
          await twilioClient.incomingPhoneNumbers(numbers[0].sid).remove();
          console.log('Twilio number released:', subscription.phone_number);
        }
      } catch (twilioError) {
        console.error('Error releasing Twilio number:', twilioError);
      }
    }

    // 5. Annuler l'abonnement Stripe si existant
    if (subscription.stripe_subscription_id) {
      try {
        await stripe.subscriptions.cancel(subscription.stripe_subscription_id);
      } catch (stripeError) {
        console.error('Error canceling Stripe subscription:', stripeError);
      }
    }

    // 6. Mettre à jour l'abonnement dans Supabase
    const { error: updateError } = await supabaseAdmin
      .from('subscriptions')
      .update({
        status: 'canceled',
        canceled_at: new Date().toISOString(),
        phone_number: null
      })
      .eq('id', subscription.id);

    if (updateError) {
      throw updateError;
    }

    console.log('Subscription canceled successfully:', {
      userId: user.id,
      subscriptionId: subscription.id,
      phoneNumber: subscription.phone_number
    });

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('Error canceling subscription:', error);
    return res.status(500).json({ 
      error: 'Failed to cancel subscription',
      message: error.message 
    });
  }
} 