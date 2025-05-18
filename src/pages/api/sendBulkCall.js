import { createClient } from '@supabase/supabase-js';
import twilio from 'twilio';

// Créer un client Supabase avec le service role
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Initialiser le client Twilio
const twilioClient = twilio(process.env.ACCOUNT_SID, process.env.AUTH_TOKEN);

export default async function handler(req, res) {
    if (req.method === 'POST') {
        const { sequenceId } = req.body;

        try {
            // 1. Vérifier la séquence et ses détails
            const { data: sequenceData, error: sequenceError } = await supabaseAdmin
                .from('sequences')
                .select('*, user_id')
                .eq('id', sequenceId)
                .single();

            if (sequenceError) {
                return res.status(500).json({ 
                    error: 'Database error',
                    message: 'Error fetching sequence details',
                    type: 'system'
                });
            }

            // 2. Vérifier le format du numéro de téléphone
            if (!sequenceData.phone_number || !sequenceData.phone_number.match(/^\+[1-9]\d{1,14}$/)) {
                return res.status(400).json({
                    error: 'Invalid phone number',
                    message: 'The phone number format is invalid. It should be in E.164 format (e.g., +1234567890).',
                    type: 'validation'
                });
            }

            // 4. Vérifier l'abonnement actif
            const { data: subscriptions, error: subscriptionsError } = await supabaseAdmin
                .from('subscriptions')
                .select('*')
                .eq('user_id', sequenceData.user_id)
                .eq('status', 'active')
                .order('created_at', { ascending: false });

            if (subscriptionsError || !subscriptions || subscriptions.length === 0) {
                return res.status(400).json({ 
                    error: 'No active subscription',
                    message: 'You need an active subscription to launch sequences.',
                    type: 'subscription'
                });
            }

            const activeSubscription = subscriptions[0];

            // Vérifier si le numéro de téléphone est configuré dans l'abonnement
            if (!activeSubscription.phone_number) {
                return res.status(400).json({
                    error: 'No phone number configured',
                    message: 'You need to configure a phone number in your subscription before making calls.',
                    type: 'phone_number'
                });
            }

            // 5. Vérifier les minutes disponibles
            const usedMinutes = Math.ceil((activeSubscription.used_seconds || 0) / 60);
            const totalMinutes = activeSubscription.minutes;
            const remainingMinutes = Math.max(0, totalMinutes - usedMinutes);

            if (remainingMinutes <= 0) {
                return res.status(400).json({ 
                    error: 'No minutes remaining',
                    message: `You have used all your available minutes (${usedMinutes}/${totalMinutes}).`,
                    type: 'minutes'
                });
            }

            // 6. Récupérer et vérifier les contacts
            const { data: contacts, error: contactsError } = await supabaseAdmin
                .from('contacts')
                .select('*')
                .eq('list_id', sequenceData.list_id)
                .eq('is_deleted', false);

            if (contactsError || !contacts) {
                return res.status(500).json({ 
                    error: 'Database error',
                    message: 'Error fetching contacts',
                    type: 'system'
                });
            }

            // 7. Vérifier s'il y a assez de minutes pour tous les contacts
            if (activeSubscription.remaining_minutes < contacts.length) {
                return res.status(400).json({
                    error: 'Insufficient minutes',
                    message: `Not enough minutes available. Need ${contacts.length} minutes, have ${activeSubscription.remaining_minutes} minutes.`,
                    type: 'minutes'
                });
            }

            // Mettre à jour le statut de la séquence
            await supabaseAdmin
                .from('sequences')
                .update({ status: 'in_progress' })
                .eq('id', sequenceId);

            // Lancer tous les appels en parallèle avec un délai de 1 seconde entre chaque
            const callPromises = contacts.map((contact, index) => {
                return new Promise(async (resolve) => {
                    try {
                        if (!contact.phone_number) {
                            console.error(`Invalid phone number for contact index ${index}`);
                            resolve({ error: 'Invalid phone number', contact });
                            return;
                        }

                        await new Promise(r => setTimeout(r, 1000 * index));
                        
                        const response = await fetch(`http://${req.headers.host}/api/sendCall`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                contactDetails: contact,
                                sequenceDetails: {
                                    ...sequenceData,
                                    phone_number: sequenceData.phone_number,
                                    totalCalls: contacts.length,
                                    currentCallIndex: index + 1
                                }
                            })
                        });

                        const data = await response.json();

                        if (!response.ok) {
                            // Vérifier si c'est une erreur d'authentification
                            if (data.type === 'auth_error') {
                                return res.status(500).json({
                                    error: 'Authentication Error',
                                    message: 'Technical error with our call system. Please contact technical support.',
                                    type: 'auth_error'
                                });
                            }
                            throw new Error(`Failed to initiate call: ${JSON.stringify(data)}`);
                        }

                        console.log(`Call ${index} initiated for contact ${contact.phone_number}`, data);
                        resolve(data);
                    } catch (error) {
                        console.error(`Error initiating call ${index}:`, error);
                        resolve(null);
                    }
                });
            });

            await Promise.all(callPromises);

            // Si tous les appels sont terminés avec succès
            await supabaseAdmin
                .from('sequences')
                .update({ status: 'completed' })
                .eq('id', sequenceId);

            res.status(200).json({ message: 'Calls initiated successfully' });
        } catch (error) {
            console.error('Error in sendBulkCall:', error);

            // En cas d'erreur, mettre à jour le statut de la séquence
            try {
                await supabaseAdmin
                    .from('sequences')
                    .update({ status: 'failed' })
                    .eq('id', sequenceId);
            } catch (updateError) {
                console.error('Error updating sequence status:', updateError);
            }

            res.status(500).json({
                error: 'Internal Server Error',
                message: 'An error occurred while initiating calls.',
                type: 'system'
            });
        }
    } else {
        res.status(405).json({ error: 'Method Not Allowed' });
    }
}