import { supabase } from '../../utils/supabaseClient';
import { createClient } from '@supabase/supabase-js';
import twilio from 'twilio';

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// Créer un client Supabase avec le service role pour contourner la RLS
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const { sequenceId } = req.body;
    console.log('Stopping calls for sequence:', sequenceId);

    try {
        // Récupérer toutes les conversations non terminées
        const { data: conversations, error } = await supabaseAdmin
            .from('conversations')
            .select('id, call_sid, status')
            .eq('sequence_id', sequenceId)
            .neq('status', 'completed')
            .neq('status', 'canceled');

        console.log('Found conversations:', conversations);

        if (error) throw error;

        // Arrêter chaque appel et mettre à jour les conversations
        const updatePromises = conversations.map(async (conversation) => {
            // Si on a un call_sid, on essaie d'arrêter l'appel Twilio
            if (conversation.call_sid) {
                try {
                    await client.calls(conversation.call_sid)
                        .update({ status: 'completed' });
                    console.log('Stopped Twilio call:', conversation.call_sid);
                } catch (twilioError) {
                    console.log('Could not stop Twilio call:', conversation.call_sid);
                }
            }

            // Dans tous les cas, on met à jour le statut de la conversation
            return supabaseAdmin
                .from('conversations')
                .update({ 
                    status: 'canceled',
                    end_time: new Date().toISOString()
                })
                .eq('id', conversation.id);
        });

        await Promise.all(updatePromises);

        // Mettre à jour le statut de la séquence
        await supabaseAdmin
            .from('sequences')
            .update({ status: 'stopped' })
            .eq('id', sequenceId);

        return res.status(200).json({ 
            message: 'All calls stopped successfully',
            stoppedCalls: conversations ? conversations.length : 0
        });

    } catch (error) {
        console.error('Error stopping calls:', error);
        return res.status(500).json({ 
            message: 'Error stopping calls',
            error: error.message
        });
    }
} 