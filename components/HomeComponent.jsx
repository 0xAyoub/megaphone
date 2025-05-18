import { useState, useEffect } from 'react';
import { NavBarComponent } from './NavBarComponent';
import { useRouter } from 'next/router';
import { supabase } from '../src/utils/supabaseClient';
import { FaPhoneAlt, FaClock, FaCoins, FaRocket, FaSpinner } from 'react-icons/fa';
import { BsThreeDotsVertical } from 'react-icons/bs';

export const HomeComponent = () => {
  const [sequences, setSequences] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalCalls: 0,
    totalTimeUsed: '0m 0s',
    remainingMinutes: 0,
    totalSubscriptionMinutes: 0,
    usedMinutes: 0
  });
  const router = useRouter();

  const getUserId = async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      console.error('Error fetching user:', error);
      return null;
    }
    return data.user.id;
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatDuration = (seconds) => {
    if (!seconds) return '0m 0s';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const formatMinutes = (seconds) => {
    if (!seconds) return 0;
    return Math.ceil(seconds / 60);
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Récupérer les données d'abonnement
        const { data: subscriptionData, error: subscriptionError } = await supabase
          .from('subscriptions')
          .select('remaining_minutes, minutes, used_seconds')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .single();

        if (subscriptionError) throw subscriptionError;

        if (subscriptionData) {
          setStats(prevStats => ({
            ...prevStats,
            totalTimeUsed: formatDuration(subscriptionData.used_seconds || 0),
            remainingMinutes: subscriptionData.remaining_minutes || 0,
            totalSubscriptionMinutes: subscriptionData.minutes || 0
          }));
        }

        // Fetch sequences
        const { data: sequencesData } = await supabase
          .from('sequences')
          .select('*, lists(*, contacts(*))')
          .eq('user_id', user.id)
          .eq('is_deleted', false);

        if (sequencesData) {
          setSequences(sequencesData.filter(sequence => !sequence.is_deleted));
        }

        // Fetch conversations for total calls count
        const { data: conversationsData } = await supabase
          .from('conversations')
          .select('*, sequences!inner(*)')
          .eq('sequences.user_id', user.id)
          .eq('sequences.is_deleted', false);

        if (conversationsData) {
          const filteredConversations = conversationsData.filter(conversation => !conversation.sequences.is_deleted);
          
          setStats(prevStats => ({
            ...prevStats,
            totalCalls: filteredConversations.length
          }));
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStats = async (userId) => {
    try {
      // Récupérer l'abonnement actif
      const { data: subscription, error: subError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();

      if (subError) throw subError;

      if (subscription) {
        // Convertir les secondes en format minutes:secondes pour le temps total utilisé
        const totalMinutes = Math.floor(subscription.used_seconds / 60);
        const remainingSeconds = subscription.used_seconds % 60;
        const formattedTimeUsed = `${totalMinutes}m ${remainingSeconds}s`;

        setStats({
          totalCalls: sequences.length || 0,
          totalTimeUsed: formattedTimeUsed,
          remainingMinutes: subscription.remaining_minutes,
          totalSubscriptionMinutes: subscription.total_minutes,
          usedMinutes: subscription.total_minutes - subscription.remaining_minutes
        });
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const StatCard = ({ icon: Icon, title, value, subValue, color }) => (
    <div className='bg-white p-4 rounded-md border border-gray-200 hover:border-gray-300 transition-all duration-200'>
      <div className='flex items-center justify-between mb-2'>
        <div className={`p-2 ${color} rounded-md`}>
          <Icon className="text-base" />
        </div>
      </div>
      <h3 className='text-gray-500 text-xs font-normal uppercase tracking-wide mb-1'>{title}</h3>
      <p className='text-xl font-medium text-gray-900'>
        {isLoading ? <FaSpinner className="animate-spin" /> : value}
      </p>
      {subValue && (
        <p className='text-xs text-gray-500 mt-1'>{subValue}</p>
      )}
    </div>
  );

  return (
    <div className='flex h-screen bg-gray-50'>
      <NavBarComponent/>
      <div className='flex-1 overflow-hidden'>
        <div className='max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6'>
          <div className='flex justify-between items-center mb-6'>
            <h1 className='text-lg font-medium text-gray-900'>Dashboard</h1>
            <button 
              onClick={() => router.push('/yourlists')}
              className='inline-flex items-center px-3 py-1.5 bg-black text-white text-sm font-normal rounded-md hover:bg-gray-800 transition-all duration-200'
            >
              <FaRocket className="w-3 h-3 mr-1.5" />
              New
            </button>
          </div>

          <div className='grid grid-cols-1 md:grid-cols-3 gap-4 mb-6'>
            <StatCard 
              icon={FaPhoneAlt}
              title="Total Calls"
              value={stats.totalCalls}
              color="bg-blue-50 text-blue-600"
            />
            <StatCard 
              icon={FaClock}
              title="Total Time Used"
              value={stats.totalTimeUsed}
              color="bg-green-50 text-green-600"
            />
            <StatCard 
              icon={FaCoins}
              title="Remaining Minutes"
              value={`${stats.remainingMinutes} minutes`}
              subValue={`${stats.usedMinutes}/${stats.totalSubscriptionMinutes} minutes used`}
              color="bg-purple-50 text-purple-600"
            />
          </div>

          <div className='bg-white rounded-md border border-gray-200 p-4'>
            <h2 className='text-sm font-medium text-gray-900 mb-3'>Active Sequences</h2>
            {isLoading ? (
              <div className='flex justify-center py-6'>
                <FaSpinner className="animate-spin text-xl text-gray-400" />
              </div>
            ) : (
              <div className='space-y-2'>
                {sequences.map((sequence) => (
                  <div 
                    key={sequence.id}
                    className='border border-gray-200 rounded-md p-3 hover:border-gray-300 transition-all duration-200 cursor-pointer bg-white'
                    onClick={() => router.push(`/sequences/${sequence.id}`)}
                  >
                    <div className='flex items-center justify-between'>
                      <h3 className='text-sm font-normal text-gray-900'>{sequence.name}</h3>
                      <span className='text-xs px-2 py-0.5 bg-green-50 text-green-600 rounded-md font-normal'>
                        Active
                      </span>
                    </div>
                    <div className='flex gap-2 mt-1 text-xs text-gray-500'>
                      <span>{sequence.lists?.contacts?.length || 0} contacts</span>
                      <span>•</span>
                      <span>{new Date(sequence.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
                {sequences.length === 0 && (
                  <div className='text-center py-6 text-gray-500 text-sm font-normal'>
                    No active sequences found
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}