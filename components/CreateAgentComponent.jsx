import { useState, useEffect } from 'react';
import { NavBarComponent } from './NavBarComponent';
import { useRouter } from 'next/router';
import { supabase } from '../src/utils/supabaseClient'; // Assurez-vous que le chemin d'accès est correct

export const CreateAgentComponent = () => {
    const [userNumbers, setUserNumbers] = useState([]);
    const [selectedNumber, setSelectedNumber] = useState('');
    const [agentParams, setAgentParams] = useState({
        callminutes: 0,
        ringseconds: 0,
        instructionforagent: '',
        
        agentname: ''
    });
    const router = useRouter();

    useEffect(() => {
        async function fetchUserNumbers() {
            const {data: { session },} = await supabase.auth.getSession()
            if (!session) {
                router.push('/sign-in');
                return;
            }

            const { data, error } = await supabase
                .from('agents')
                .select('agent_id, phone_number')
                .eq('id', session.user.id);  // Utilisez 'id' pour correspondre à la clé étrangère dans la table 'agents'

            if (error) {
                console.error('Error fetching user numbers:', error);
                return;
            }

            setUserNumbers(data);
        }

        fetchUserNumbers();
    }, [router]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setAgentParams(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!selectedNumber) {
            alert('Please select a phone number');
            return;
        }

        const response = await fetch('/api/customizeAgent', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ ...agentParams, agent_id: selectedNumber }),
        });

        const result = await response.json();
        if (result.success) {
            alert('Agent updated successfully');
        } else {
            console.error('Error updating agent:', result.error);
        }
    };

    return (
        <div className='flex h-screen overflow-auto'>
            <NavBarComponent />
            <div className='flex w-full'>
                <form onSubmit={handleSubmit} className='w-full max-w-lg p-6 bg-white'>
                    <h2 className='text-2xl font-semibold mb-6'>Create Agent</h2>
                    <div className='mb-4'>
                        <label htmlFor="phone_number" className='block mb-2 font-medium text-gray-700'>
                            Select Phone Number:
                        </label>
                        <select
                            id="phone_number"
                            value={selectedNumber}
                            onChange={(e) => setSelectedNumber(e.target.value)}
                            required
                            className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                        >
                            <option value="" disabled>Select a number</option>
                            {userNumbers.map((item) => (
                                <option key={item.agent_id} value={item.agent_id}>
                                    {item.phone_number}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className='mb-4'>
                        <label htmlFor="agentname" className='block mb-2 font-medium text-gray-700'>
                            Agent Name:
                        </label>
                        <input
                            type="text"
                            name="agentname"
                            id="agentname"
                            value={agentParams.agentname}
                            onChange={handleInputChange}
                            placeholder="Agent Name"
                            required
                            className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                        />
                    </div>

                    <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>

                        <div className='mb-4'>
                            <label htmlFor="ringseconds" className='block mb-2 font-medium text-gray-700'>
                                Ring Seconds:
                            </label>
                            <input
                                type="number"
                                name="ringseconds"
                                id="ringseconds"
                                value={agentParams.ringseconds}
                                onChange={handleInputChange}
                                placeholder="Ring Seconds"
                                required
                                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                            />
                        </div>
                        <div className='mb-4'>
                            <label htmlFor="compagnynumber" className='block mb-2 font-medium text-gray-700'>
                                Your compagny number:
                            </label>
                            <input
                                type="text"
                                name="compagnynumber"
                                id="compagnynumber"
                                value={agentParams.compagnynumber}
                                onChange={handleInputChange}
                                placeholder="Your compagny number"
                                required
                                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                            />
                        </div>

                    </div>

                    <div className='mb-4'>
                        <label htmlFor="instructionforagent" className='block mb-2 font-medium text-gray-700'>
                            Instructions for Agent:
                        </label>
                        <input
                            type="text"
                            name="instructionforagent"
                            id="instructionforagent"
                            value={agentParams.instructionforagent}
                            onChange={handleInputChange}
                            placeholder="Instructions for Agent"
                            required
                            className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                        />
                    </div>

                    <button
                        type="submit"
                        className='w-full bg-autocallblue text-white py-2 rounded-md hover:bg-blue-700 transition duration-200'
                    >
                        Create Agent
                    </button>
                </form>
            </div>
        </div>
    );
}