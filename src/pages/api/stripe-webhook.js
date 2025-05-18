import Stripe from 'stripe';
import { buffer } from 'micro';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Assurez-vous d'utiliser le bon secret de webhook de production
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end('Method Not Allowed');
  }

  const buf = await buffer(req);
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(buf, sig, webhookSecret);
    console.log('Webhook received');
    console.log('Webhook event constructed');
    console.log('Webhook event received:', event.type);
  } catch (err) {
    console.error('Webhook error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const userId = session.client_reference_id;
      console.log('Payment completed for user:', userId);

      // Récupérer les détails de l'abonnement
      const subscription = await stripe.subscriptions.retrieve(session.subscription);
      const planMinutes = getSubscriptionMinutes(subscription.items.data[0].price.id);

      // Vérifier si un abonnement actif existe déjà
      const { data: existingSubscription } = await supabaseAdmin
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();

      if (existingSubscription) {
        // Calculer les nouvelles minutes restantes en additionnant
        const newRemainingMinutes = (existingSubscription.remaining_minutes || 0) + planMinutes;
        
        // Mettre à jour l'abonnement existant
        const { error: updateError } = await supabaseAdmin
          .from('subscriptions')
          .update({
            stripe_subscription_id: session.subscription,
            stripe_price_id: subscription.items.data[0].price.id,
            status: 'active',
            minutes: planMinutes,
            remaining_minutes: newRemainingMinutes,  // Additionner les minutes restantes
            updated_at: new Date().toISOString()
          })
          .eq('id', existingSubscription.id);

        if (updateError) {
          console.error('Error updating subscription:', updateError);
          return res.status(500).json({ error: updateError.message });
        }

        console.log('Subscription updated successfully:', {
          userId,
          subscriptionId: session.subscription,
          previousRemainingMinutes: existingSubscription.remaining_minutes,
          addedMinutes: planMinutes,
          newTotalMinutes: newRemainingMinutes
        });
      } else {
        // Pour un nouvel abonnement, remaining_minutes = minutes du plan
        const { error: insertError } = await supabaseAdmin
          .from('subscriptions')
          .insert({
            id: crypto.randomUUID(),
            user_id: userId,
            stripe_subscription_id: session.subscription,
            stripe_price_id: subscription.items.data[0].price.id,
            status: 'active',
            minutes: planMinutes,
            remaining_minutes: planMinutes,
            used_seconds: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

        if (insertError) {
          console.error('Error creating subscription:', insertError);
          return res.status(500).json({ error: insertError.message });
        }

        console.log('New subscription created:', {
          userId,
          subscriptionId: session.subscription,
          minutes: planMinutes
        });
      }
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: error.message });
  }
}

const getSubscriptionMinutes = (priceId) => {
  const plans = {
    [process.env.NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID]: 2000,
    [process.env.NEXT_PUBLIC_STRIPE_GROWTH_PRICE_ID]: 5000,
    [process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID]: 10000,
  };
  return plans[priceId] || 0;
};