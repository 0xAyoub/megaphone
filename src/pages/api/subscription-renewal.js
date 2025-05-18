import Stripe from 'stripe';
import { buffer } from 'micro';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET_RENEWAL;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const config = {
  api: {
    bodyParser: false,
  },
};

const getSubscriptionMinutes = (priceId) => {
  const plans = {
    [process.env.NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID]: 2000,
    [process.env.NEXT_PUBLIC_STRIPE_GROWTH_PRICE_ID]: 5000,
    [process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID]: 10000,
  };
  return plans[priceId] || 0;
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const buf = await buffer(req);
    const sig = req.headers['stripe-signature'];

    let event;
    try {
      event = stripe.webhooks.constructEvent(buf, sig, webhookSecret);
      console.log('Webhook event type:', event.type);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).json({ error: err.message });
    }

    if (event.type === 'invoice.payment_succeeded') {
      const invoice = event.data.object;
      
      // 1. Vérifier que c'est un renouvellement d'abonnement
      if (invoice.billing_reason !== 'subscription_cycle') {
        console.log('Ignoring non-renewal invoice:', invoice.billing_reason);
        return res.status(200).json({ received: true });
      }

      const subscriptionId = invoice.subscription;

      // 2. Vérifier qu'on a un ID d'abonnement
      if (!subscriptionId) {
        console.error('No subscription ID found in renewal invoice');
        return res.status(400).json({ error: 'Missing subscription ID' });
      }

      try {
        // 3. Récupérer et vérifier l'abonnement Stripe
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        
        if (subscription.status !== 'active') {
          console.error('Subscription is not active:', subscription.status);
          return res.status(400).json({ error: 'Subscription not active' });
        }

        // 4. Récupérer l'abonnement dans Supabase en utilisant stripe_subscription_id
        const { data: subscriptionData, error: subError } = await supabaseAdmin
          .from('subscriptions')
          .select('*')
          .eq('stripe_subscription_id', subscriptionId)
          .eq('status', 'active')
          .single();

        if (subError || !subscriptionData) {
          console.error('Failed to find active subscription:', { subError, stripe_subscription_id: subscriptionId });
          return res.status(500).json({ error: 'Subscription not found' });
        }

        // 5. Calculer les nouvelles minutes
        const planMinutes = getSubscriptionMinutes(subscription.items.data[0].price.id);
        if (!planMinutes) {
          console.error('Invalid price ID or no minutes defined for plan');
          return res.status(400).json({ error: 'Invalid subscription plan' });
        }

        const newRemainingMinutes = subscriptionData.remaining_minutes + planMinutes;

        // 6. Mettre à jour l'abonnement de manière atomique
        const { error: updateError } = await supabaseAdmin
          .from('subscriptions')
          .update({
            remaining_minutes: newRemainingMinutes,
            updated_at: new Date().toISOString(),
            current_period_start: new Date(subscription.current_period_start * 1000),
            current_period_end: new Date(subscription.current_period_end * 1000)
          })
          .eq('id', subscriptionData.id)
          .eq('status', 'active')
          .eq('remaining_minutes', subscriptionData.remaining_minutes); // Condition de concurrence

        if (updateError) {
          console.error('Update error:', updateError);
          return res.status(500).json({ error: 'Failed to update subscription' });
        }

        console.log('Subscription renewed successfully:', {
          subscriptionId: subscriptionData.id,
          addedMinutes: planMinutes,
          newTotal: newRemainingMinutes,
          nextRenewal: new Date(subscription.current_period_end * 1000)
        });

      } catch (error) {
        console.error('Subscription processing error:', error);
        return res.status(500).json({ error: error.message });
      }
    }

    res.status(200).json({ received: true });

  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: error.message });
  }
} 