import { useEffect, useState } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { useRouter } from 'next/router';
import {NavBarComponent} from '../../../components/NavBarComponent';
import { CiCircleChevLeft, CiCircleChevRight } from "react-icons/ci";
import { GoArrowRight } from "react-icons/go";
import { FaSort, FaSync, FaSpinner, FaStop } from "react-icons/fa";
import { BsInfoCircle } from "react-icons/bs";
import { IoMdAnalytics } from "react-icons/io";
import { FaBolt } from "react-icons/fa";
import { BsPeople } from "react-icons/bs";
import { AiOutlineEye } from "react-icons/ai";
import { CiEdit } from "react-icons/ci";
import { RiDeleteBin6Line } from "react-icons/ri";
import {NotificationComponent} from '../../../components/NotificationComponent';
import Link from 'next/link';

const StatusBadge = ({ status }) => {
    const getStatusStyles = () => {
        switch (status) {
            case 'not_started':
                return 'bg-gray-100 text-gray-600';
            case 'pending':
                return 'bg-blue-100 text-blue-600';
            case 'in_progress':
                return 'bg-orange-100 text-orange-600';
            case 'completed':
                return 'bg-green-100 text-green-600';
            case 'failed':
                return 'bg-red-100 text-red-600';
            case 'canceled':
                return 'bg-yellow-100 text-yellow-600';
            case 'no_answer':
                return 'bg-purple-100 text-purple-600';
            default:
                return 'bg-gray-100 text-gray-600';
        }
    };

    const getStatusText = () => {
        switch (status) {
            case 'not_started':
                return 'Not Started';
            case 'pending':
                return 'Pending';
            case 'in_progress':
                return 'In Progress';
            case 'completed':
                return 'Completed';
            case 'failed':
                return 'Failed';
            case 'canceled':
                return 'Canceled';
            case 'no_answer':
                return 'No Answer';
            default:
                return 'Unknown';
        }
    };

    return (
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusStyles()}`}>
            {getStatusText()}
        </span>
    );
};

const getStatusBadge = (status) => {
    let badgeClasses = 'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-normal ';
    
    switch (status) {
        case 'pending':
            return (
                <span className={badgeClasses + 'bg-gray-100 text-gray-600'}>
                    Pending
                </span>
            );
        case 'in_progress':
            return (
                <span className={badgeClasses + 'bg-blue-100 text-blue-600'}>
                    In Progress
                </span>
            );
        case 'completed':
            return (
                <span className={badgeClasses + 'bg-green-100 text-green-600'}>
                    Completed
                </span>
            );
        case 'failed':
            return (
                <span className={badgeClasses + 'bg-red-100 text-red-600'}>
                    Failed
                </span>
            );
        default:
            return (
                <span className={badgeClasses + 'bg-gray-100 text-gray-600'}>
                    {status || 'Unknown'}
                </span>
            );
    }
};

export default function SequenceDetails() {
    const router = useRouter();
    const { sequenceId } = router.query;
    const [sequenceDetails, setSequenceDetails] = useState(null);
    const [conversations, setConversations] = useState([]);
    const [showConversation, setShowConversation] = useState(false);
    const [listName, setListName] = useState('');
    const [selectedConversation, setSelectedConversation] = useState(null);
    const [sortOrder, setSortOrder] = useState('desc');
    const [activeTab, setActiveTab] = useState('details');
    const [contacts, setContacts] = useState([]);
    const [editedSequence, setEditedSequence] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isLaunching, setIsLaunching] = useState(false);
    const [isStopping, setIsStopping] = useState(false);
    const [notification, setNotification] = useState(null);
    const [isRefreshingConversations, setIsRefreshingConversations] = useState(false);
    const [isRefreshingSingleConversation, setIsRefreshingSingleConversation] = useState(false);
    const [errorMessage, setErrorMessage] = useState(null);
    const [showLaunchPopup, setShowLaunchPopup] = useState(false);
    const [technicalError, setTechnicalError] = useState(null);
    const [showStopPopup, setShowStopPopup] = useState(false);
    const [showDeletePopup, setShowDeletePopup] = useState(false);

    const handleDeleteSequence = async () => {
        setShowDeletePopup(false);
        try {
            const { error } = await supabase
                .from('sequences')
                .update({ is_deleted: true })
                .eq('id', sequenceId);

            if (error) throw error;

            setNotification({
                type: 'success',
                message: 'Sequence deleted successfully'
            });
            setTimeout(() => {
                router.push('/sequences');
            }, 1000);
        } catch (error) {
            setNotification({
                type: 'error',
                message: 'Error deleting sequence'
            });
        }
    };

    const handleLaunchSequence = async () => {
        try {
            setIsLaunching(true);
            setNotification(null);
            const response = await fetch('/api/sendBulkCall', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sequenceId })
            });

            const data = await response.json();

            if (!response.ok) {
                if (data.message?.includes('Authenticate')) {
                    setTechnicalError('Une erreur technique est survenue avec notre système d\'appel. Veuillez contacter le support technique.');
                    return;
                }
                setNotification({
                    type: 'error',
                    message: data.message || 'An error occurred while launching the sequence'
                });
                return;
            }

            setNotification({
                type: 'success',
                message: data.message || 'Sequence launched successfully'
            });
            setShowLaunchPopup(false);
        } catch (error) {
            console.error('Error launching sequence:', error);
            setNotification({
                type: 'error',
                message: 'An unexpected error occurred while launching the sequence'
            });
        } finally {
            setIsLaunching(false);
        }
    };

    const handleUpdateSequence = async (e) => {
        e.preventDefault();
        try {
            const { error } = await supabase
                .from('sequences')
                .update({
                    name: editedSequence.name,
                    instructions: editedSequence.instructions,
                    sms_text: editedSequence.sms_text,
                    tone: editedSequence.tone,
                    phone_number: editedSequence.phone_number
                })
                .eq('id', sequenceId);

            if (error) throw error;

            setSequenceDetails(editedSequence);
            setIsEditing(false);
            setNotification({
                type: 'success',
                message: 'Sequence updated successfully'
            });
        } catch (error) {
            setNotification({
                type: 'error',
                message: 'Error updating sequence'
            });
        }
    };

    const handleRefreshContacts = async () => {
        setIsRefreshing(true);
        try {
            const { data, error } = await supabase
                .from('contacts')
                .select('*')
                .eq('list_id', sequenceDetails.list_id)
                .eq('is_deleted', false);

            if (error) {
                console.error('Error refreshing contacts:', error);
            } else {
                setContacts(data);
            }
        } catch (error) {
            console.error('Error refreshing contacts:', error);
        } finally {
            setIsRefreshing(false);
        }
    };

    const fetchConversations = async () => {
        if (sequenceId) {
            setIsRefreshingConversations(true);
            try {
                const { data, error } = await supabase
                    .from('conversations')
                    .select(`
                        *,
                        contacts(first_name, last_name),
                        start_time,
                        end_time,
                        call_sid,
                        call_record
                    `)
                    .eq('sequence_id', sequenceId)
                    .order('start_time', { ascending: sortOrder === 'asc' });

                if (error) {
                    console.error('Error fetching conversations:', error);
                    setNotification({
                        type: 'error',
                        message: 'Error refreshing conversations'
                    });
                } else {
                    setConversations(data);
                }
            } catch (error) {
                console.error('Error:', error);
                setNotification({
                    type: 'error',
                    message: 'Error refreshing conversations'
                });
            } finally {
                setIsRefreshingConversations(false);
            }
        }
    };

    const fetchSingleConversation = async (conversationId) => {
        if (!conversationId) return;
        
        setIsRefreshingSingleConversation(true);
        try {
            const { data, error } = await supabase
                .from('conversations')
                .select(`
                    *,
                    contacts(first_name, last_name),
                    start_time,
                    end_time,
                    call_sid,
                    call_record
                `)
                .eq('id', conversationId)
                .single();

            if (error) {
                console.error('Error fetching conversation:', error);
                setNotification({
                    type: 'error',
                    message: 'Error refreshing conversation'
                });
            } else {
                setSelectedConversation(data);
                // Also update this conversation in the main list
                setConversations(prevConversations => 
                    prevConversations.map(conv => 
                        conv.id === conversationId ? data : conv
                    )
                );
            }
        } catch (error) {
            console.error('Error:', error);
            setNotification({
                type: 'error',
                message: 'Error refreshing conversation'
            });
        } finally {
            setIsRefreshingSingleConversation(false);
        }
    };

    const handleStopSequence = async () => {
        setShowStopPopup(false);
        setIsStopping(true);
        try {
            const response = await fetch('/api/stopBulkCalls', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sequenceId })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to stop calls');
            }

            setNotification({
                type: 'success',
                message: `Successfully stopped ${data.stoppedCalls} calls`
            });

            await fetchConversations();

        } catch (error) {
            console.error('Error stopping sequence:', error);
            setNotification({
                type: 'error',
                message: error.message || 'Failed to stop calls'
            });
        } finally {
            setIsStopping(false);
        }
    };

    useEffect(() => {
        const fetchSequenceDetails = async () => {
            if (sequenceId) {
                const { data, error } = await supabase
                    .from('sequences')
                    .select('*')
                    .eq('id', sequenceId)
                    .single();

                if (error) {
                    console.error('Error fetching sequence details', error);
                } else {
                    setSequenceDetails(data);
                    setEditedSequence(data);
                    fetchListName(data.list_id);
                    fetchContacts(data.list_id);
                }
            }
        };

        const fetchListName = async (listId) => {
            const { data, error } = await supabase
                .from('lists')
                .select('name')
                .eq('id', listId)
                .single();

            if (error) {
                console.error('Error fetching list name', error);
            } else {
                setListName(data.name);
            }
        };

        const fetchContacts = async (listId) => {
            const { data, error } = await supabase
                .from('contacts')
                .select('*')
                .eq('list_id', listId)
                .eq('is_deleted', false);

            if (error) {
                console.error('Error fetching contacts:', error);
            } else {
                setContacts(data);
            }
        };

        fetchSequenceDetails();
        fetchConversations();
    }, [sequenceId, sortOrder]);

    const handleViewConversation = (conversation) => {
        setSelectedConversation(conversation);
        setShowConversation(true);
    };

    const toggleSortOrder = () => {
        setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    };

    if (!sequenceDetails || !editedSequence) return <p>Loading...</p>;

    return (
        <div className='flex h-screen'>
            {notification && (
                <NotificationComponent
                    type={notification.type}
                    message={notification.message}
                    onClose={() => setNotification(null)}
                />
            )}
            {technicalError && (
                <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4" role="alert">
                    <p className="font-bold">Erreur Technique</p>
                    <p>{technicalError}</p>
                    <p className="text-sm mt-2">
                        Pour toute assistance, contactez le support technique à support@votreapp.com
                    </p>
                </div>
            )}
            <div className='sticky top-0 h-screen'>
                <NavBarComponent />
            </div>
            <div className='flex-1 overflow-y-auto bg-gray-50'>
                <div className='max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6'>
                    <div className='flex items-center justify-between mb-6'>
                        <div className='flex items-center gap-3'>
                            <Link href="/sequences" className="text-gray-400 hover:text-gray-600">
                                <CiCircleChevLeft className="w-5 h-5" />
                            </Link>
                            <div>
                                <h1 className='text-lg font-medium text-gray-900'>{sequenceDetails?.name}</h1>
                                <p className='text-sm text-gray-500'>List: {listName}</p>
                            </div>
                        </div>
                        <div className='flex items-centxer gap-2'>
                            <button
                                onClick={() => setShowStopPopup(true)}
                                disabled={isStopping}
                                className='inline-flex items-center px-3 py-1.5 bg-yellow-500 text-white text-xs font-normal rounded-md hover:bg-yellow-600 transition-all duration-200 disabled:opacity-75'
                            >
                                {isStopping ? (
                                    <>
                                        <FaSpinner className="w-3 h-3 mr-1.5 animate-spin" />
                                        Stopping...
                                    </>
                                ) : (
                                    <>
                                        <FaStop className="w-3 h-3 mr-1.5" />
                                        Stop Calls
                                    </>
                                )}
                            </button>
                            <button
                                onClick={() => setShowDeletePopup(true)}
                                className='inline-flex items-center px-3 py-1.5 bg-red-500 text-white text-xs font-normal rounded-md hover:bg-red-600 transition-all duration-200'
                            >
                                <RiDeleteBin6Line className="w-3 h-3 mr-1.5" />
                                Delete
                            </button>
                            <button
                                onClick={() => setShowLaunchPopup(true)}
                                className='inline-flex items-center px-3 py-1.5 bg-black text-white text-xs font-normal rounded-md hover:bg-gray-800 transition-all duration-200 disabled:opacity-75'
                            >
                                <FaBolt className="w-3 h-3 mr-1.5" />
                                Launch Sequence
                            </button>
                        </div>
                    </div>

                    <div className='space-y-6'>
                        <div className='bg-white rounded-md border border-gray-200 p-4'>
                            <h2 className='text-sm font-medium text-gray-900 mb-4'>Sequence Information</h2>
                            <div className='grid grid-cols-2 gap-4'>
                              
                                <div>
                                    <p className='text-xs text-gray-500 mb-1'>From Phone Number</p>
                                    <p className='text-sm text-gray-900'>{sequenceDetails?.phone_number || 'Not set'}</p>
                                </div>
                                <div>
                                    <p className='text-xs text-gray-500 mb-1'>SMS Text</p>
                                    <p className='text-sm text-gray-900'>{sequenceDetails?.sms_text}</p>
                                </div>
                            </div>
                            <div className='mt-4 grid grid-cols-2 gap-4'>
                                <div>
                                    <p className='text-xs text-gray-500 mb-1'>Tone</p>
                                    <p className='text-sm text-gray-900 capitalize'>{sequenceDetails?.tone}</p>
                                </div>
                                <div>
                                    <p className='text-xs text-gray-500 mb-1'>Global Instructions</p>
                                    <p className='text-sm text-gray-900'>{sequenceDetails?.instructions}</p>
                                </div>
                            </div>
                        </div>

                        <div className='bg-white rounded-md border border-gray-200 p-4'>
                            <div className='flex justify-between items-center mb-4'>
                                <h2 className='text-sm font-medium text-gray-900'>Contacts</h2>
                                <div className='flex items-center gap-2'>
                                    <button 
                                        onClick={handleRefreshContacts}
                                        className='inline-flex items-center px-2 py-1 rounded-md border border-gray-200 text-xs font-normal text-gray-600 hover:bg-gray-50 transition-colors'
                                    >
                                        <FaSync className={`w-3 h-3 mr-1.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                                        Refresh
                                    </button>
                                </div>
                            </div>

                            <div className='overflow-x-auto'>
                                <table className='min-w-full divide-y divide-gray-200'>
                                    <thead className='bg-gray-50'>
                                        <tr>
                                            <th scope="col" className='px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>Name</th>
                                            <th scope="col" className='px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>Phone</th>
                                            <th scope="col" className='px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>Amount Due</th>
                                            <th scope="col" className='px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>Due Date</th>
                                            <th scope="col" className='px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>Status</th>
                                            <th scope="col" className='px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>Context</th>
                                        </tr>
                                    </thead>
                                    <tbody className='bg-white divide-y divide-gray-200'>
                                        {contacts.map((contact, index) => (
                                            <tr key={index} className='hover:bg-gray-50'>
                                                <td className='px-3 py-2 whitespace-nowrap'>
                                                    <div className='text-xs text-gray-900'>{contact.first_name} {contact.last_name}</div>
                                                </td>
                                                <td className='px-3 py-2 whitespace-nowrap text-xs text-gray-900'>{contact.phone_number}</td>
                                                <td className='px-3 py-2 whitespace-nowrap text-xs text-gray-900'>{contact.amount_due} {contact.currency}</td>
                                                <td className='px-3 py-2 whitespace-nowrap text-xs text-gray-900'>{contact.due_date}</td>
                                                <td className='px-3 py-2 whitespace-nowrap'>
                                                    {getStatusBadge(contact.status)}
                                                </td>
                                                <td className='px-3 py-2 whitespace-nowrap text-xs text-gray-900 truncate max-w-[200px]'>
                                                    
                                                    {contact.context || '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className='bg-white rounded-md border border-gray-200 p-4'>
                            <div className='flex justify-between items-center mb-4'>
                                <h2 className='text-sm font-medium text-gray-900'>Conversations</h2>
                                <div className='flex items-center gap-2'>
                                    <button 
                                        onClick={() => fetchConversations()}
                                        className='inline-flex items-center px-2 py-1 rounded-md border border-gray-200 text-xs font-normal text-gray-600 hover:bg-gray-50 transition-colors'
                                    >
                                        <FaSync className="w-3 h-3 mr-1.5" />
                                        Refresh
                                    </button>
                                    <button 
                                        onClick={toggleSortOrder}
                                        className='inline-flex items-center px-2 py-1 rounded-md border border-gray-200 text-xs font-normal text-gray-600 hover:bg-gray-50 transition-colors'
                                    >
                                        <FaSort className="w-3 h-3 mr-1.5" />
                                        {sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}
                                    </button>
                                </div>
                            </div>

                            <div className='space-y-3'>
                                {conversations.map((conversation, index) => (
                                    <div key={index} className='border border-gray-200 rounded-md p-3 hover:border-gray-300 transition-all duration-200'>
                                        <div className='flex justify-between items-start'>
                                            <div className='space-y-1'>
                                                <div className='flex items-center gap-2'>
                                                    <h3 className='text-sm font-medium text-gray-900'>
                                                        {conversation.contacts?.first_name} {conversation.contacts?.last_name}
                                                    </h3>
                                                    <div className='mt-1'>
                                                        <StatusBadge status={conversation.status} />
                                                    </div>
                                                </div>
                                                <div className='text-xs text-gray-500'>
                                                    {conversation.start_time && (
                                                        <span>Started: {new Date(conversation.start_time).toLocaleString()}</span>
                                                    )}
                                                    {conversation.end_time && (
                                                        <span> • Ended: {new Date(conversation.end_time).toLocaleString()}</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className='flex items-center gap-2'>
                                                {conversation.call_record && (
                                                    <a 
                                                        href={conversation.call_record}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className='inline-flex items-center px-2 py-1 rounded-md border border-gray-200 text-xs font-normal text-blue-600 hover:bg-blue-50 hover:border-blue-100 transition-colors'
                                                    >
                                                        Recording
                                                    </a>
                                                )}
                                                <button 
                                                    onClick={() => handleViewConversation(conversation)}
                                                    className='inline-flex items-center px-2 py-1 rounded-md border border-gray-200 text-xs font-normal text-gray-600 hover:bg-gray-50 transition-colors'
                                                >
                                                    View Details
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Conversation Details Modal */}
            {showConversation && selectedConversation && (
                <div className='fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-end'>
                    <div className='w-1/3 bg-white h-full overflow-y-auto'>
                        <div className='p-4 border-b border-gray-200'>
                            <div className='flex justify-between items-start'>
                                <div>
                                    <h2 className='text-lg font-medium text-gray-900'>
                                        {selectedConversation.contacts.first_name} {selectedConversation.contacts.last_name}
                                    </h2>
                                    <div className='flex items-center gap-2 mt-1'>
                                        <StatusBadge status={selectedConversation.status} />
                                        {selectedConversation.call_record && (
                                            <a 
                                                href={selectedConversation.call_record}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className='text-xs text-blue-600 hover:underline'
                                            >
                                                View Recording
                                            </a>
                                        )}
                                    </div>
                                </div>
                                <div className='flex items-center gap-2'>
                                    <button 
                                        onClick={() => fetchSingleConversation(selectedConversation.id)}
                                        className='inline-flex items-center px-2 py-1 rounded-md border border-gray-200 text-xs font-normal text-gray-600 hover:bg-gray-50 transition-colors'
                                        disabled={isRefreshingSingleConversation}
                                    >
                                        <FaSync className={`w-3 h-3 ${isRefreshingSingleConversation ? 'animate-spin' : ''}`} />
                                    </button>
                                    <button 
                                        onClick={() => setShowConversation(false)}
                                        className='text-gray-400 hover:text-gray-600'
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className='p-4 space-y-4'>
                            {selectedConversation.conversation_data?.length > 0 ? (
                                selectedConversation.conversation_data.map((message, index) => (
                                    <div key={index} className='space-y-4'>
                                        <div className='flex justify-start'>
                                            <div className='bg-gray-100 rounded-lg p-3 max-w-[80%]'>
                                                <p className='text-xs text-gray-900'>{message.user}</p>
                                            </div>
                                        </div>
                                        <div className='flex justify-end'>
                                            <div className='bg-black text-white rounded-lg p-3 max-w-[80%]'>
                                                <p className='text-xs'>{message.assistant}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className='flex justify-center items-center py-8'>
                                    <p className='text-sm text-gray-500'>No conversation messages available</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Launch Confirmation Modal */}
            {showLaunchPopup && (
                <div className='fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 p-4'>
                    <div className='bg-white rounded-md shadow-lg max-w-md w-full'>
                        <div className='p-4'>
                            <div className='flex items-center gap-2 text-blue-600 mb-3'>
                                <CiCircleChevRight className="w-4 h-4" />
                                <h2 className='text-base font-medium'>Launch Sequence</h2>
                            </div>
                            <p className='text-sm text-gray-600 mb-4'>Are you sure you want to launch this sequence? This will start making calls to all contacts in the list.</p>
                            <div className='flex justify-end gap-2'>
                                <button 
                                    type='button' 
                                    onClick={() => setShowLaunchPopup(false)}
                                    className='px-3 py-1.5 border border-gray-200 rounded-md text-xs font-normal text-gray-600 hover:bg-gray-50 transition-colors'
                                >
                                    Cancel
                                </button>
                                <button 
                                    type='button' 
                                    onClick={handleLaunchSequence}
                                    disabled={isLaunching}
                                    className='inline-flex items-center px-3 py-1.5 bg-blue-600 text-white rounded-md text-xs font-normal hover:bg-blue-700 transition-colors disabled:opacity-75'
                                >
                                    {isLaunching ? (
                                        <>
                                            <FaSpinner className="animate-spin w-3 h-3 mr-1.5" />
                                            Launching...
                                        </>
                                    ) : (
                                        <>
                                            <CiCircleChevRight className="w-3 h-3 mr-1.5" />
                                            Launch Now
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Stop Confirmation Modal */}
            {showStopPopup && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
                        <div className="p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="bg-yellow-50 p-2 rounded-full">
                                    <FaStop className="w-5 h-5 text-yellow-600" />
                                </div>
                                <h3 className="text-lg font-medium text-gray-900">
                                    Stop All Calls
                                </h3>
                            </div>
                            <p className="text-sm text-gray-500 mb-4">
                                Are you sure you want to stop all ongoing calls in this sequence? This action cannot be undone.
                            </p>
                            <div className="flex justify-end gap-2">
                                <button
                                    onClick={() => setShowStopPopup(false)}
                                    className="px-3 py-1.5 text-xs font-normal text-gray-700 hover:text-gray-900"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleStopSequence}
                                    disabled={isStopping}
                                    className="inline-flex items-center px-3 py-1.5 bg-yellow-500 text-white text-xs font-normal rounded-md hover:bg-yellow-600 transition-all duration-200 disabled:opacity-75"
                                >
                                    {isStopping ? (
                                        <>
                                            <FaSpinner className="w-3 h-3 mr-1.5 animate-spin" />
                                            Stopping...
                                        </>
                                    ) : (
                                        <>
                                            <FaStop className="w-3 h-3 mr-1.5" />
                                            Stop All Calls
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeletePopup && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
                        <div className="p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="bg-red-50 p-2 rounded-full">
                                    <RiDeleteBin6Line className="w-5 h-5 text-red-600" />
                                </div>
                                <h3 className="text-lg font-medium text-gray-900">
                                    Delete Sequence
                                </h3>
                            </div>
                            <p className="text-sm text-gray-500 mb-4">
                                Are you sure you want to delete this sequence? This action cannot be undone and will remove all associated data.
                            </p>
                            <div className="flex justify-end gap-2">
                                <button
                                    onClick={() => setShowDeletePopup(false)}
                                    className="px-3 py-1.5 text-xs font-normal text-gray-700 hover:text-gray-900"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDeleteSequence}
                                    className="inline-flex items-center px-3 py-1.5 bg-red-500 text-white text-xs font-normal rounded-md hover:bg-red-600 transition-all duration-200"
                                >
                                    <RiDeleteBin6Line className="w-3 h-3 mr-1.5" />
                                    Delete Sequence
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}