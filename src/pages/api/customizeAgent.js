import { supabase } from '../../utils/supabaseClient';

export default async function handler(req, res) {
    const { agent_id, ...params } = req.body;

    const { data, error } = await supabase
        .from('agents')
        .update(params)
        .eq('agent_id', agent_id);

    if (error) {
        console.error('Error updating agent:', error);
        return res.status(500).json({ error: 'Failed to update agent' });
    }

    res.status(200).json({ success: true });
}