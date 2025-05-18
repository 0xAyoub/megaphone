import Stripe from 'stripe';
import { buffer } from 'micro';
import { createClient } from '@supabase/supabase-js';
import twilio from 'twilio';

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only POST requests are allowed'
    });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'Please log in to continue'
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) {
      return res.status(401).json({ 
        error: 'Authentication failed',
        message: 'Your session has expired. Please log in again.'
      });
    }

    const { data: subscription, error: subError } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (subError || !subscription) {
      return res.status(400).json({ 
        error: 'Subscription required',
        message: 'You need an active subscription to get a phone number'
      });
    }

    if (subscription.phone_number) {
      return res.status(400).json({
        error: 'Phone number exists',
        message: 'You already have a phone number assigned to your subscription'
      });
    }

    // 5. Acheter un nouveau numéro Twilio
    try {
      // Rechercher un numéro disponible
      const availableNumbers = await twilioClient.availablePhoneNumbers('US')
        .local
        .list({
          capabilities: ['voice', 'SMS'],
          limit: 1
        });

      if (!availableNumbers || availableNumbers.length === 0) {
        return res.status(500).json({
          error: 'No available numbers',
          message: 'No phone numbers available at the moment'
        });
      }

      // Acheter le numéro sans configuration de webhooks
      const number = await twilioClient.incomingPhoneNumbers
        .create({
          phoneNumber: availableNumbers[0].phoneNumber
        });

      // 6. Mettre à jour l'abonnement avec le nouveau numéro
      const { error: updateError } = await supabaseAdmin
        .from('subscriptions')
        .update({
          phone_number: number.phoneNumber,
          updated_at: new Date().toISOString()
        })
        .eq('id', subscription.id)
        .eq('status', 'active');

      if (updateError) {
        // En cas d'erreur, libérer le numéro
        await twilioClient.incomingPhoneNumbers(number.sid).remove();
        throw updateError;
      }

      console.log('Phone number purchased successfully:', {
        userId: user.id,
        subscriptionId: subscription.id,
        phoneNumber: number.phoneNumber
      });

      return res.status(200).json({
        success: true,
        phoneNumber: number.phoneNumber
      });

    } catch (twilioError) {
      console.error('Twilio error:', twilioError);
      return res.status(500).json({
        error: 'Failed to purchase number',
        message: twilioError.message
      });
    }

  } catch (error) {
    console.error('Error in buyNumber:', error);
    return res.status(500).json({
      error: 'Server error',
      message: 'An unexpected error occurred. Please try again later.'
    });
  }
}