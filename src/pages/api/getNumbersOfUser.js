import { createClient } from '@supabase/supabase-js';

// Vérifier les variables d'environnement
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing Supabase environment variables');
    throw new Error('Missing required environment variables');
}

// Créer un client Supabase avec le service role
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
);

export default async function handler(req, res) {
    // Vérifier que le client Supabase est correctement initialisé
    if (!supabaseAdmin) {
        console.error('Supabase client not initialized');
        return res.status(500).json({
            error: 'Configuration error',
            message: 'Database connection not available'
        });
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { userId } = req.query;

    if (!userId) {
        return res.status(400).json({ 
            error: 'Missing parameter', 
            message: 'User ID is required' 
        });
    }

    try {
        // Chercher l'abonnement actif avec le numéro de téléphone
        const { data: subscriptions, error } = await supabaseAdmin
            .from('subscriptions')
            .select('id, phone_number')
            .eq('user_id', userId)
            .eq('status', 'active')
            .not('phone_number', 'is', null)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Database error:', error);
            return res.status(500).json({ 
                error: 'Database error', 
                message: 'Failed to fetch subscription data' 
            });
        }

        // Si aucun abonnement trouvé, renvoyer un tableau vide
        if (!subscriptions || subscriptions.length === 0) {
            return res.status(200).json([]);
        }

        // Renvoyer les données
        return res.status(200).json(subscriptions);

    } catch (error) {
        console.error('Server error:', error);
        return res.status(500).json({ 
            error: 'Server error', 
            message: 'An unexpected error occurred' 
        });
    }
}