import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { priceId, userId } = req.body;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${req.headers.host}`;

    // Vérifier que le priceId est un ID de prix production valide
    if (!priceId.startsWith('price_')) {
      return res.status(400).json({ message: 'Invalid price ID' });
    }

    // Vérifier si l'utilisateur a déjà un abonnement actif
    const { data: existingSubscription, error: subscriptionError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (subscriptionError && subscriptionError.code !== 'PGRST116') {
      // PGRST116 signifie qu'aucun enregistrement n'a été trouvé, ce qui est OK
      console.error('Error checking subscription:', subscriptionError);
      return res.status(500).json({ message: 'Error checking subscription status' });
    }

    if (existingSubscription) {
      // Vérifier si l'utilisateur essaie de s'abonner au même plan
      if (existingSubscription.stripe_price_id === priceId) {
        return res.status(400).json({ 
          message: 'You are already subscribed to this plan.' 
        });
      } else {
        console.log('User attempting to change subscription from', existingSubscription.stripe_price_id, 'to', priceId);
        return res.status(400).json({ 
          message: 'You already have an active subscription. Please contact support to change your plan.' 
        });
      }
    }

    console.log('Received priceId:', priceId);
    console.log('Creating checkout session with:', {
      mode: 'subscription',
      priceId,
      userId
    });

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/pricing`,
      client_reference_id: userId,
    });

    res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('Stripe error:', error);
    res.status(500).json({ message: error.message });
  }
}