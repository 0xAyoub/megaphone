import { useState, useEffect } from 'react';
import { NavBarComponent } from './NavBarComponent';
import { supabase } from '../src/utils/supabaseClient';
import { useRouter } from 'next/router';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, LineChart, Line, ResponsiveContainer } from 'recharts';
import { AiOutlineClose } from 'react-icons/ai';

export const AnalyticsComponent = () => {
  const [sequences, setSequences] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [lists, setLists] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [selectedSequence, setSelectedSequence] = useState(null);
  const [selectedList, setSelectedList] = useState(null);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalContent, setModalContent] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [usageStats, setUsageStats] = useState({
    totalMinutesUsed: 0,
    remainingMinutes: 0,
    totalCalls: 0,
    successfulCalls: 0,
    averageCallDuration: 0
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
    fetchSubscriptionData();
  }, []);

  const fetchData = async () => {
    try {
      const userId = await getUserId();
      if (userId) {
        // Récupérer les données des séquences avec plus de détails
        const { data: sequencesData, error: sequencesError } = await supabase
          .from('sequences')
          .select(`
            *,
            lists (
              *,
              contacts (*)
            )
          `)
          .eq('user_id', userId)
          .eq('is_deleted', false);

        if (sequencesError) {
          console.error('Error fetching sequences:', sequencesError);
        } else {
          setSequences(sequencesData.filter(sequence => !sequence.is_deleted));
        }

        // Récupérer les données des contacts avec leurs listes et conversations
        const { data: contactsData, error: contactsError } = await supabase
          .from('contacts')
          .select(`
            *,
            lists!inner (*),
            conversations (*)
          `)
          .eq('lists.user_id', userId)
          .eq('lists.is_deleted', false)
          .eq('is_deleted', false);

        if (contactsError) {
          console.error('Error fetching contacts:', contactsError);
        } else {
          setContacts(contactsData.filter(contact => !contact.is_deleted));
        }

        // Récupérer les données des listes avec leurs contacts
        const { data: listsData, error: listsError } = await supabase
          .from('lists')
          .select(`
            *,
            contacts (*),
            sequences (*)
          `)
          .eq('user_id', userId)
          .eq('is_deleted', false);

        if (listsError) {
          console.error('Error fetching lists:', listsError);
        } else {
          setLists(listsData.filter(list => !list.is_deleted));
        }

        // Récupérer les données des conversations avec plus de détails
        const { data: conversationsData, error: conversationsError } = await supabase
          .from('conversations')
          .select(`
            *,
            contacts (*),
            sequences!inner (*)
          `)
          .eq('sequences.user_id', userId)
          .eq('sequences.is_deleted', false);

        if (conversationsError) {
          console.error('Error fetching conversations:', conversationsError);
        } else {
          setConversations(conversationsData.filter(conversation => !conversation.sequences.is_deleted));
        }
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const fetchSubscriptionData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Récupérer l'abonnement actif de l'utilisateur
      const { data: subscriptionData, error: subscriptionError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();

      if (subscriptionError && subscriptionError.code !== 'PGRST116') {
        console.error('Error fetching subscription:', subscriptionError);
        return;
      }

      // Si aucun abonnement actif n'est trouvé, chercher le dernier abonnement annulé
      if (!subscriptionData) {
        const { data: canceledSubscription, error: canceledError } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'canceled')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (canceledError && canceledError.code !== 'PGRST116') {
          console.error('Error fetching canceled subscription:', canceledError);
          return;
        }

        setSubscription(canceledSubscription || null);
        
        if (canceledSubscription) {
          setUsageStats({
            totalMinutesUsed: Math.ceil((canceledSubscription.used_seconds || 0) / 60),
            remainingMinutes: canceledSubscription.remaining_minutes || 0,
            totalCalls: 0,
            successfulCalls: 0,
            averageCallDuration: 0
          });
        }
        return;
      }

      setSubscription(subscriptionData);

      // Récupérer les statistiques des conversations avec start_time et end_time
      const { data: conversationsData, error: convError } = await supabase
        .from('conversations')
        .select('status, start_time, end_time')
        .eq('user_id', user.id);

      if (convError) {
        console.error('Error fetching conversations:', convError);
        return;
      }

      const totalCalls = conversationsData.length;
      const successfulCalls = conversationsData.filter(c => c.status === 'completed').length;
      
      // Calculer la durée moyenne des appels en utilisant start_time et end_time
      const completedCallsWithDuration = conversationsData.filter(conv => 
        conv.status === 'completed' && conv.start_time && conv.end_time
      );

      const averageCallDuration = completedCallsWithDuration.length > 0
        ? Math.round(
            completedCallsWithDuration.reduce((acc, conv) => {
              const start = new Date(conv.start_time);
              const end = new Date(conv.end_time);
              const durationInSeconds = (end - start) / 1000;
              return acc + durationInSeconds;
            }, 0) / completedCallsWithDuration.length
          )
        : 0;

      setUsageStats({
        totalMinutesUsed: Math.ceil((subscriptionData?.used_seconds || 0) / 60),
        remainingMinutes: subscriptionData?.remaining_minutes || 0,
        totalCalls,
        successfulCalls,
        averageCallDuration
      });

    } catch (error) {
      console.error('Error in fetchSubscriptionData:', error);
    }
  };

  const handleShowModal = (content, type) => {
    setModalContent({ content, type });
    setShowModal(true);
  };

  const sequencesData = sequences
    .filter(sequence => !sequence.is_deleted)
    .map((sequence) => ({
      name: sequence.name,
      contacts: contacts.filter((contact) => contact.list_id === sequence.list_id && !contact.is_deleted).length,
    }));

  const contactStatusData = contacts
    .filter(contact => !contact.is_deleted)
    .reduce((acc, contact) => {
      const status = contact.status || 'Unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

  const contactStatusChartData = Object.entries(contactStatusData).map(([status, count]) => ({
    name: status,
    value: count,
  }));

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF'];

  const totalSequences = sequences.filter(sequence => !sequence.is_deleted).length;
  const totalContacts = contacts.filter(contact => !contact.is_deleted).length;
  const totalLists = lists.filter(list => !list.is_deleted).length;
  const totalConversations = conversations.filter(conversation => !conversation.sequences.is_deleted).length;

  const getSubscriptionStatus = (subscription) => {
    if (!subscription) return { name: 'No subscription', status: 'none' };
    
    if (subscription.status === 'active') {
      switch (subscription.stripe_price_id) {
        case process.env.NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID:
          return { name: 'Starter', status: 'active' };
        case process.env.NEXT_PUBLIC_STRIPE_GROWTH_PRICE_ID:
          return { name: 'Growth', status: 'active' };
        case process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID:
          return { name: 'Enterprise', status: 'active' };
        default:
          return { 
            name: subscription.plan_name || 'Custom Plan', 
            status: 'active' 
          };
      }
    }
    
    return { 
      name: subscription.status === 'canceled' ? 'Canceled' : 'No subscription', 
      status: subscription.status 
    };
  };

  const statsCards = [
    { 
      title: 'Subscription Plan', 
      value: getSubscriptionStatus(subscription).name,
      subtext: subscription 
        ? subscription.status === 'active'
          ? `${subscription.minutes.toLocaleString()} minutes included`
          : 'Subscription inactive'
        : 'Subscribe to get started',
      color: subscription?.status === 'active' ? 'border-green-100' : 'border-gray-100'
    },
    { 
      title: 'Minutes Remaining', 
      value: (subscription?.remaining_minutes || 0).toLocaleString(),
      subtext: `${Math.ceil((subscription?.used_seconds || 0) / 60).toLocaleString()} minutes used`,
      color: 'border-green-100' 
    },
    { 
      title: 'Call Success Rate', 
      value: `${usageStats.totalCalls ? Math.round((usageStats.successfulCalls / usageStats.totalCalls) * 100) : 0}%`,
      subtext: `${usageStats.successfulCalls}/${usageStats.totalCalls} calls`,
      color: 'border-yellow-100' 
    },
    { 
      title: 'Avg Call Duration', 
      value: usageStats.averageCallDuration > 0 
        ? `${Math.floor(usageStats.averageCallDuration / 60)}m ${usageStats.averageCallDuration % 60}s`
        : '0s',
      subtext: `Based on ${usageStats.successfulCalls} completed calls`,
      color: 'border-purple-100' 
    }
  ];

  const getDailyCallsData = () => {
    const last7Days = [...Array(7)].map((_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return date.toISOString().split('T')[0];
    }).reverse();

    return last7Days.map(date => ({
      date,
      calls: conversations.filter(conv => 
        conv.created_at.startsWith(date)
      ).length
    }));
  };

  // Fonction pour obtenir les données d'utilisation des minutes par jour
  const getMinutesUsageData = () => {
    const last7Days = [...Array(7)].map((_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return date.toISOString().split('T')[0];
    }).reverse();

    return last7Days.map(date => {
      const dayConversations = conversations.filter(conv => 
        conv.created_at.startsWith(date)
      );
      
      const secondsUsed = dayConversations.reduce((acc, conv) => 
        acc + (conv.duration || 0), 0
      );

      return {
        date,
        minutes: Math.ceil(secondsUsed / 60)
      };
    });
  };

  // Statistiques d'utilisation détaillées
  const getUsageStats = () => {
    if (!subscription) return [];

    const totalMinutes = subscription.minutes || 0;
    const usedMinutes = Math.ceil((subscription.used_seconds || 0) / 60);
    const remainingMinutes = subscription.remaining_minutes || 0;

    return [
      {
        name: 'Used',
        value: usedMinutes,
        color: '#4309E4'
      },
      {
        name: 'Remaining',
        value: remainingMinutes,
        color: '#E5E7EB'
      }
    ];
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'not_started': 
        return <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-1 rounded-full">Not Started</span>;
      case 'pending':
        return <span className="text-xs font-medium bg-blue-100 text-blue-600 px-2 py-1 rounded-full">Pending</span>;
      case 'in_progress':
        return <span className="text-xs font-medium bg-orange-100 text-orange-600 px-2 py-1 rounded-full">In Progress</span>;
      case 'completed':
        return <span className="text-xs font-medium bg-green-100 text-green-600 px-2 py-1 rounded-full">Completed</span>;
      case 'failed':
        return <span className="text-xs font-medium bg-red-100 text-red-600 px-2 py-1 rounded-full">Failed</span>;
      case 'canceled':
        return <span className="text-xs font-medium bg-yellow-100 text-yellow-600 px-2 py-1 rounded-full">Canceled</span>;
      case 'no_answer':
        return <span className="text-xs font-medium bg-purple-100 text-purple-600 px-2 py-1 rounded-full">No Answer</span>;
      default:
        return <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-1 rounded-full">Unknown</span>;
    }
  };

  return (
    <div className="flex h-screen">
      <div className="sticky top-0 h-screen">
        <NavBarComponent />
      </div>
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-lg font-medium text-gray-900 mb-6">Analytics Dashboard</h1>

          {/* Stats Cards Améliorés */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            {statsCards.map((stat, i) => (
              <div 
                key={i} 
                className={`bg-white rounded-md border ${stat.color} p-4 hover:border-gray-300 transition-all duration-200`}
              >
                <p className="text-xs text-gray-500 mb-1">{stat.title}</p>
                <p className="text-lg font-medium text-gray-900">{stat.value}</p>
                <p className="text-xs text-gray-400 mt-1">{stat.subtext}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6">
            {/* Graphique des contacts par séquence (existant) */}
            <div className="bg-white rounded-md border border-gray-200 p-4">
              <h2 className="text-sm font-medium text-gray-900 mb-4">Contacts per Sequence</h2>
              <BarChart width={500} height={300} data={sequencesData} className="text-xs">
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="name" tick={{fill: '#6B7280'}} />
                <YAxis tick={{fill: '#6B7280'}} />
                <Tooltip />
                <Bar dataKey="contacts" fill="#4309E4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </div>

            {/* Nouveau graphique des appels quotidiens */}
            <div className="bg-white rounded-md border border-gray-200 p-4">
              <h2 className="text-sm font-medium text-gray-900 mb-4">Daily Calls (Last 7 Days)</h2>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={getDailyCallsData()} margin={{ top: 5, right: 20, bottom: 20, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fill: '#6B7280', fontSize: 11 }}
                    tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { 
                      month: 'numeric', 
                      day: 'numeric' 
                    })}
                    axisLine={{ stroke: '#E5E7EB' }}
                  />
                  <YAxis 
                    tick={{ fill: '#6B7280', fontSize: 11 }}
                    axisLine={{ stroke: '#E5E7EB' }}
                    tickLine={false}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white',
                      border: '1px solid #E5E7EB',
                      borderRadius: '4px',
                      fontSize: '12px',
                      padding: '8px'
                    }}
                    labelFormatter={(date) => new Date(date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric'
                    })}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="calls" 
                    stroke="#4309E4" 
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#4309E4' }}
                    activeDot={{ r: 4, fill: '#4309E4' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6">
            {/* Minutes Usage Graph */}
            <div className="bg-white rounded-md border border-gray-200 p-4">
              <h2 className="text-sm font-medium text-gray-900 mb-4">Minutes Usage (Last 7 Days)</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={getMinutesUsageData()} margin={{ top: 5, right: 20, bottom: 20, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fill: '#6B7280', fontSize: 11 }}
                    tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric' 
                    })}
                    axisLine={{ stroke: '#E5E7EB' }}
                  />
                  <YAxis 
                    tick={{ fill: '#6B7280', fontSize: 11 }}
                    axisLine={{ stroke: '#E5E7EB' }}
                    tickLine={false}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white',
                      border: '1px solid #E5E7EB',
                      borderRadius: '4px',
                      fontSize: '12px',
                      padding: '8px'
                    }}
                    formatter={(value) => [`${value} minutes`]}
                    labelFormatter={(date) => new Date(date).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric'
                    })}
                  />
                  <Bar 
                    dataKey="minutes" 
                    fill="#4309E4" 
                    radius={[4, 4, 0, 0]}
                    maxBarSize={50}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Minutes Usage Overview */}
            <div className="bg-white rounded-md border border-gray-200 p-4">
              <h2 className="text-sm font-medium text-gray-900 mb-4">Minutes Usage Overview</h2>
              <div className="flex items-start space-x-8">
                <div className="flex-1 space-y-4">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Total Minutes</span>
                      <span className="text-sm font-medium text-gray-900">
                        {subscription?.minutes?.toLocaleString() || 0}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-indigo-600 rounded-full" 
                        style={{ width: '100%' }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Used Minutes</span>
                      <span className="text-sm font-medium text-gray-900">
                        {Math.ceil((subscription?.used_seconds || 0) / 60).toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-indigo-600 rounded-full" 
                        style={{ 
                          width: `${subscription?.minutes ? (Math.ceil((subscription.used_seconds || 0) / 60) / subscription.minutes * 100) : 0}%` 
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Remaining Minutes</span>
                      <span className="text-sm font-medium text-gray-900">
                        {(subscription?.remaining_minutes || 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-green-500 rounded-full" 
                        style={{ 
                          width: `${subscription?.minutes ? (subscription.remaining_minutes / subscription.minutes * 100) : 0}%` 
                        }}
                      />
                    </div>
                  </div>

                  {subscription?.additional_minute_price && (
                    <div className="pt-2 border-t border-gray-100">
                      <span className="text-xs text-gray-500">
                        Additional minutes cost: ${subscription.additional_minute_price}/minute
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Lists Section */}
          <div className="grid grid-cols-3 gap-6">
            <div className="bg-white rounded-md border border-gray-200 p-4">
              <h2 className="text-sm font-medium text-gray-900 mb-4">Sequences Overview</h2>
              <div className="space-y-2">
                {sequences.filter(sequence => !sequence.is_deleted).map((sequence) => (
                  <div 
                    key={sequence.id}
                    className="border border-gray-200 rounded-md p-3 hover:border-gray-300 transition-all duration-200 cursor-pointer"
                    onClick={() => handleShowModal(sequence, 'sequence')}
                  >
                    <p className="text-sm text-gray-900 font-medium">{sequence.name}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {contacts.filter(c => c.list_id === sequence.list_id && !c.is_deleted).length} contacts
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-md border border-gray-200 p-4">
              <h2 className="text-sm font-medium text-gray-900 mb-4">Lists Overview</h2>
              <div className="space-y-2">
                {lists.filter(list => !list.is_deleted).map((list) => (
                  <div 
                    key={list.id}
                    className="border border-gray-200 rounded-md p-3 hover:border-gray-300 transition-all duration-200 cursor-pointer"
                    onClick={() => handleShowModal(list, 'list')}
                  >
                    <p className="text-sm text-gray-900 font-medium">{list.name}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {contacts.filter(c => c.list_id === list.id && !c.is_deleted).length} contacts
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-md border border-gray-200 p-4">
              <h2 className="text-sm font-medium text-gray-900 mb-4">Recent Conversations</h2>
              <div className="space-y-2">
                {conversations.filter(conversation => !conversation.sequences.is_deleted).slice(0, 10).map((conv) => (
                  <div 
                    key={conv.id}
                    className="border border-gray-200 rounded-md p-3 hover:border-gray-300 transition-all duration-200 cursor-pointer"
                    onClick={() => handleShowModal(conv, 'conversation')}
                  >
                    <p className="text-sm text-gray-900 font-medium">
                      {contacts.find(c => c.id === conv.contact_id && !c.is_deleted)?.first_name || 'Unknown'} 
                      {contacts.find(c => c.id === conv.contact_id && !c.is_deleted)?.last_name}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(conv.created_at).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-md shadow-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-medium text-gray-900">
                  {modalContent.type.charAt(0).toUpperCase() + modalContent.type.slice(1)} Details
                </h2>
                <button 
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <AiOutlineClose className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-4">
              {/* Modal content based on type */}
              {modalContent.type === 'sequence' && (
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Name</p>
                    <p className="text-sm text-gray-900">{modalContent.content.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">List</p>
                    <p className="text-sm text-gray-900">
                      {lists.find(l => l.id === modalContent.content.list_id && !l.is_deleted)?.name}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Status</p>
                    <p className="text-sm text-gray-900">{getStatusLabel(modalContent.content.status)}</p>
                  </div>
                </div>
              )}
              {modalContent.type === 'list' && (
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Name</p>
                    <p className="text-sm text-gray-900">{modalContent.content.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Description</p>
                    <p className="text-sm text-gray-900">{modalContent.content.description}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Contacts</p>
                    <p className="text-sm text-gray-900">
                      {contacts.filter(c => c.list_id === modalContent.content.id && !c.is_deleted).length}
                    </p>
                  </div>
                </div>
              )}
              {modalContent.type === 'conversation' && (
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Contact</p>
                    <p className="text-sm text-gray-900">
                      {contacts.find(c => c.id === modalContent.content.contact_id && !c.is_deleted)?.first_name} 
                      {contacts.find(c => c.id === modalContent.content.contact_id && !c.is_deleted)?.last_name}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Date</p>
                    <p className="text-sm text-gray-900">
                      {new Date(modalContent.content.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Status</p>
                    <p className="text-sm text-gray-900">{getStatusLabel(modalContent.content.status)}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};