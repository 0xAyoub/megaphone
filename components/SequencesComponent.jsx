import { useState, useEffect } from 'react';
import { NavBarComponent } from './NavBarComponent';
import { supabase } from '../src/utils/supabaseClient';
import { useRouter } from 'next/router';
import { FaSpinner } from 'react-icons/fa';
import { CiCirclePlus, CiTrash, CiCircleAlert, CiViewList, CiCircleChevRight, CiSettings, CiViewTimeline, CiCircleMore } from "react-icons/ci";
import { IoEyeOutline, IoFlash } from "react-icons/io5";
import { NotificationComponent } from './NotificationComponent';

export const SequencesComponent = () => {
    const [campaignName, setCampaignName] = useState('');
    const [globalInstructions, setGlobalInstructions] = useState('');
    const [smsText, setSmsText] = useState('');
    const [tone, setTone] = useState('');
    const [showPopup, setShowPopup] = useState(false);
    const [showLaunchPopup, setShowLaunchPopup] = useState(false);
    const [showDeletePopup, setShowDeletePopup] = useState(false);
    const [lists, setLists] = useState([]);
    const [selectedListId, setSelectedListId] = useState('');
    const [userId, setUserId] = useState(null);
    const [sequences, setSequences] = useState([]);
    const [selectedSequenceId, setSelectedSequenceId] = useState(null);
    const [formErrors, setFormErrors] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [isLaunching, setIsLaunching] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [errorMessage, setErrorMessage] = useState(null);
    const [notification, setNotification] = useState(null);
    const [userPhoneNumbers, setUserPhoneNumbers] = useState([]);
    const [selectedPhoneNumber, setSelectedPhoneNumber] = useState('');
    const [technicalError, setTechnicalError] = useState(null);
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
        const fetchInitialData = async () => {
            setIsLoading(true);
            try {
                const fetchedUserId = await getUserId();
                setUserId(fetchedUserId);

                if (fetchedUserId) {
                    const { data: listsData, error: listsError } = await supabase
                        .from('lists')
                        .select('*')
                        .eq('user_id', fetchedUserId)
                        .eq('is_deleted', false);

                    if (listsError) console.error('Error fetching lists:', listsError);
                    else setLists(listsData);

                    const { data: sequencesData, error: sequencesError } = await supabase
                        .from('sequences')
                        .select('*')
                        .eq('user_id', fetchedUserId)
                        .eq('is_deleted', false);

                    if (sequencesError) console.error('Error fetching sequences:', sequencesError);
                    else setSequences(sequencesData);
                }
            } catch (error) {
                console.error('Error:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchInitialData();
    }, []);

    useEffect(() => {
        fetchUserNumbers();
    }, []);

    const fetchUserNumbers = async () => {
        try {
            const userId = await getUserId();
            if (!userId) return;

            const response = await fetch(`/api/getNumbersOfUser?userId=${userId}`);
            if (!response.ok) throw new Error('Failed to fetch numbers');
            
            const data = await response.json();
            setUserPhoneNumbers(data || []);
            if (data && data.length > 0) {
                setSelectedPhoneNumber(data[0].phone_number);
            }
        } catch (error) {
            console.error('Error fetching user numbers:', error);
        }
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
            default:
                return <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-1 rounded-full">Unknown</span>;
        }
    };

    const togglePopup = () => {
        setShowPopup(!showPopup);
        if (!showPopup) {
            setCampaignName('');
            setGlobalInstructions('');
            setSmsText('');
            setTone('');
            setSelectedListId('');
        }
        setFormErrors({});
    };

    const toggleLaunchPopup = (sequenceId) => {
        setSelectedSequenceId(sequenceId);
        setShowLaunchPopup(!showLaunchPopup);
    };

    const toggleDeletePopup = (sequenceId) => {
        setSelectedSequenceId(sequenceId);
        setShowDeletePopup(!showDeletePopup);
    };

    const validateForm = () => {
        const errors = {};
        if (!selectedListId.match(/^[0-9a-fA-F-]{36}$/)) errors.list = 'Invalid list ID';
        if (campaignName.length > 100) errors.campaignName = 'Campaign name too long';
        if (!globalInstructions.trim()) errors.globalInstructions = 'Global instructions are required';
        if (!smsText.trim()) errors.smsText = 'SMS text is required';
        if (!tone) errors.tone = 'Please select a tone';
        
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleCreateSequence = async (e) => {
        e.preventDefault();
        setIsCreating(true);
        try {
            const { data, error } = await supabase
                .from('sequences')
                .insert([{
                    name: campaignName,
                    instructions: globalInstructions,
                    sms_text: smsText,
                    tone: tone,
                    list_id: selectedListId,
                    user_id: userId,
                    status: 'not_started',
                    phone_number: selectedPhoneNumber
                }])
                .select();

            if (error) throw error;
            
            if (!data || data.length === 0) {
                throw new Error('No data returned after sequence creation');
            }

            setShowPopup(false);
            router.push(`/sequences/${data[0].id}`);
            setNotification({
                type: 'success',
                message: 'Sequence created successfully'
            });
        } catch (error) {
            console.error('Error creating sequence:', error);
            setNotification({
                type: 'error',
                message: 'Error creating sequence'
            });
        } finally {
            setIsCreating(false);
        }
    };

    const handleLaunchSequence = async () => {
        if (selectedSequenceId) {
            setIsLaunching(true);
            setNotification(null);
            try {
                await supabase
                    .from('sequences')
                    .update({ status: 'pending' })
                    .eq('id', selectedSequenceId);

                const response = await fetch('/api/sendBulkCall', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sequenceId: selectedSequenceId })
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

                await supabase
                    .from('sequences')
                    .update({ status: 'in_progress' })
                    .eq('id', selectedSequenceId);

                setNotification({
                    type: 'success',
                    message: data.message || 'Sequence launched successfully'
                });
                toggleLaunchPopup(null);
            } catch (error) {
                console.error('Error launching sequence:', error);
                
                await supabase
                    .from('sequences')
                    .update({ status: 'failed' })
                    .eq('id', selectedSequenceId);

                setNotification({
                    type: 'error',
                    message: 'An unexpected error occurred while launching the sequence'
                });
            } finally {
                setIsLaunching(false);
                setShowLaunchPopup(false);
            }
        }
    };

    const handleDeleteSequence = async () => {
        if (!selectedSequenceId) return;
        setIsDeleting(true);
        try {
            const { error } = await supabase
                .from('sequences')
                .update({ is_deleted: true, deleted_at: new Date() })
                .eq('id', selectedSequenceId);

            if (error) {
                console.error('Error deleting sequence', error);
            } else {
                setSequences(sequences.filter(sequence => sequence.id !== selectedSequenceId));
                setSelectedSequenceId(null);
                toggleDeletePopup();
            }
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setIsDeleting(false);
        }
    };

    const handleStartSequence = async () => {
        if (!selectedPhoneNumber) {
            setNotification({
                type: 'error',
                message: 'Please select a phone number to use for calls'
            });
            return;
        }

        setIsStarting(true);
        try {
            const response = await fetch('/api/sendBulkCall', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    numbers: selectedNumbers,
                    message: selectedMessage,
                    fromNumber: selectedPhoneNumber
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to start sequence');
            }

            setNotification({
                type: 'success',
                message: 'Sequence started successfully'
            });
            setShowStartPopup(false);
        } catch (error) {
            setNotification({
                type: 'error',
                message: error.message
            });
        } finally {
            setIsStarting(false);
        }
    };

    return (
        <div className='flex h-screen bg-gray-50'>
            <NavBarComponent />
            <div className='flex-1 overflow-hidden'>
                <div className='max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6'>
                    <div className='flex justify-between items-center mb-6'>
                        <h1 className='text-lg font-medium text-gray-900'>Your Sequences</h1>
                        <button 
                            onClick={togglePopup} 
                            className="inline-flex items-center px-3 py-1.5 bg-black text-white text-sm font-normal rounded-md hover:bg-gray-800 transition-all duration-200"
                        >
                            <IoFlash className="w-3 h-3 mr-1.5" />
                            New Sequence
                        </button>
                    </div>

                    {isLoading ? (
                        <div className='flex justify-center items-center h-64'>
                            <FaSpinner className="animate-spin text-xl text-gray-400" />
                        </div>
                    ) : (
                        <div className='space-y-2'>
                            {sequences.length === 0 ? (
                                <div className='text-center py-8 bg-white rounded-md border border-gray-200'>
                                    <p className='text-gray-500 text-sm'>No sequences yet. Create your first sequence to get started!</p>
                                </div>
                            ) : (
                                sequences.map((sequence, index) => (
                                    <div 
                                        key={index} 
                                        className='bg-white border border-gray-200 rounded-md p-3 hover:border-gray-300 transition-all duration-200'
                                    >
                                        <div className='flex justify-between items-start'>
                                            <div>
                                                <h2 className='text-sm font-medium text-gray-900'>{sequence.name}</h2>
                                                <div className='flex items-center gap-2 mt-1 text-xs text-gray-500'>
                                                    <div className='flex items-center gap-1'>
                                                        <CiViewList className="w-3 h-3" />
                                                        <span>{lists.find(list => list.id === sequence.list_id)?.name || 'Unknown List'}</span>
                                                    </div>
                                                    {getStatusLabel(sequence.status)}
                                                </div>
                                            </div>
                                            <div className='flex items-center space-x-2'>
                                                <button 
                                                    onClick={() => toggleDeletePopup(sequence.id)}
                                                    className='inline-flex items-center px-2 py-1 rounded-md border border-gray-200 text-xs font-normal text-gray-600 hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-colors'
                                                    title="Delete sequence"
                                                >
                                                    <CiTrash className="w-4 h-4 text-gray-900" />
                                                </button>
                                                <button 
                                                    onClick={() => router.push(`/sequences/${sequence.id}`)}
                                                    className='inline-flex items-center px-2 py-1 rounded-md border border-gray-200 text-xs font-normal text-gray-600 hover:bg-gray-50 transition-colors'
                                                    title="View sequence"
                                                >
                                                    <IoEyeOutline className="w-4 h-4 text-gray-700" />
                                                </button>
                                                <button 
                                                    onClick={() => toggleLaunchPopup(sequence.id)}
                                                    className='inline-flex items-center px-2 py-1 rounded-md border border-gray-200 text-xs font-normal text-gray-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-100 transition-colors'
                                                    title="Launch sequence"
                                                >
                                                    <IoFlash className="w-4 h-4 text-gray-900" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Create Sequence Modal */}
            {showPopup && (
                <div className='fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 p-4'>
                    <div className='bg-white rounded-md shadow-lg max-w-xl w-full'>
                        <div className='p-4'>
                            <div className='flex items-center gap-2 text-gray-900 mb-4'>
                                <CiCirclePlus className="w-4 h-4" />
                                <h2 className='text-base font-medium'>Create New Sequence</h2>
                            </div>
                            <form onSubmit={handleCreateSequence}>
                                <div className='space-y-4'>
                                    {/* Nom de la campagne */}
                                    <div>
                                        <label className='block text-sm font-normal text-gray-700 mb-1'>
                                            Campaign Name
                                        </label>
                                        <input
                                            type='text'
                                            value={campaignName}
                                            onChange={(e) => setCampaignName(e.target.value)}
                                            className='w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                                            placeholder='Enter campaign name'
                                        />
                                        {formErrors.campaignName && (
                                            <p className='text-xs text-red-600 mt-1'>{formErrors.campaignName}</p>
                                        )}
                                    </div>

                                    {/* Sélecteurs de liste et de numéro sur la même ligne */}
                                    <div className='grid grid-cols-2 gap-4'>
                                        {/* Sélecteur de liste */}
                                        <div>
                                            <label className='block text-sm font-normal text-gray-700 mb-1'>
                                                Contact List
                                            </label>
                                            <select
                                                value={selectedListId}
                                                onChange={(e) => setSelectedListId(e.target.value)}
                                                className='w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                                            >
                                                <option value=''>Select a list</option>
                                                {lists.map((list) => (
                                                    <option key={list.id} value={list.id}>
                                                        {list.name}
                                                    </option>
                                                ))}
                                            </select>
                                            {formErrors.list && (
                                                <p className='text-xs text-red-600 mt-1'>{formErrors.list}</p>
                                            )}
                                        </div>

                                        {/* Sélecteur de numéro de téléphone */}
                                        <div>
                                            <label className='block text-sm font-normal text-gray-700 mb-1'>
                                                From Phone Number
                                            </label>
                                            <select
                                                value={selectedPhoneNumber}
                                                onChange={(e) => setSelectedPhoneNumber(e.target.value)}
                                                className='w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                                            >
                                                <option value=''>Select a phone number</option>
                                                {userPhoneNumbers.map((subscription, index) => (
                                                    <option key={index} value={subscription.phone_number}>
                                                        {subscription.phone_number}
                                                    </option>
                                                ))}
                                            </select>
                                            {formErrors.phoneNumber && (
                                                <p className='text-xs text-red-600 mt-1'>{formErrors.phoneNumber}</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Global Instructions */}
                                    <div>
                                        <label className='block text-xs font-normal text-gray-700 mb-1'>
                                            Global Instructions <span className="text-red-500">*</span>
                                        </label>
                                        <textarea 
                                            value={globalInstructions} 
                                            onChange={(e) => setGlobalInstructions(e.target.value)} 
                                            className={`w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-1 focus:ring-black focus:border-black transition-all duration-200 ${formErrors.globalInstructions ? 'border-red-500' : ''}`}
                                            rows={3}
                                            placeholder="e.g. Your name is Maxim, you are a Billing Officer from Mayo Clinic, you are calling to remind the customer of their overdue payment, and request payment arrangements. Introduce yourself and your role, ask question to understand the customer's situation, and then remind the customer of their overdue payment."
                                        />
                                        {formErrors.globalInstructions && <p className="text-red-500 text-xs mt-1">{formErrors.globalInstructions}</p>}
                                    </div>

                                    {/* SMS Text */}
                                    <div>
                                        <label className='block text-xs font-normal text-gray-700 mb-1'>
                                            SMS Text <span className="text-red-500">*</span>
                                        </label>
                                        <textarea 
                                            value={smsText} 
                                            onChange={(e) => setSmsText(e.target.value)} 
                                            className={`w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-1 focus:ring-black focus:border-black transition-all duration-200 ${formErrors.smsText ? 'border-red-500' : ''}`}
                                            rows={3}
                                            placeholder="e.g. Hi! This is Maxim, that is the payment link for your overdue payment: https://mayo.com/pay. ||  Please click on the link to make the payment. Thank you!"
                                        />
                                        {formErrors.smsText && <p className="text-red-500 text-xs mt-1">{formErrors.smsText}</p>}
                                    </div>

                                    {/* Tone */}
                                    <div>
                                        <label className='block text-xs font-normal text-gray-700 mb-1'>
                                            Tone <span className="text-red-500">*</span>
                                        </label>
                                        <select 
                                            value={tone} 
                                            onChange={(e) => setTone(e.target.value)} 
                                            className={`w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-1 focus:ring-black focus:border-black transition-all duration-200 ${formErrors.tone ? 'border-red-500' : ''}`}
                                        >
                                            <option value="" disabled>Select a tone</option>
                                            <option value="friendly">Friendly</option>
                                            <option value="soft">Soft</option>
                                            <option value="firm">Firm</option>
                                            <option value="professional">Professional</option>
                                        </select>
                                        {formErrors.tone && <p className="text-red-500 text-xs mt-1">{formErrors.tone}</p>}
                                    </div>
                                </div>

                                <div className='flex justify-end gap-2 mt-6'>
                                    <button 
                                        type='button' 
                                        onClick={togglePopup}
                                        className='px-3 py-1.5 border border-gray-200 rounded-md text-xs font-normal text-gray-600 hover:bg-gray-50 transition-colors'
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        type='submit'
                                        disabled={isCreating}
                                        className='inline-flex items-center px-3 py-1.5 bg-black text-white rounded-md text-xs font-normal hover:bg-gray-800 transition-colors disabled:opacity-75'
                                    >
                                        {isCreating ? (
                                            <>
                                                <FaSpinner className="animate-spin w-3 h-3 mr-1.5" />
                                                Creating...
                                            </>
                                        ) : (
                                            <>
                                                <IoFlash className="w-3 h-3 mr-1.5" />
                                                Create Sequence
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
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
                                    onClick={() => toggleLaunchPopup(null)}
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

            {/* Delete Confirmation Modal */}
            {showDeletePopup && (
                <div className='fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 p-4'>
                    <div className='bg-white rounded-md shadow-lg max-w-md w-full'>
                        <div className='p-4'>
                            <div className='flex items-center gap-2 text-red-600 mb-3'>
                                <CiCircleAlert className="w-4 h-4" />
                                <h2 className='text-base font-medium'>Delete Sequence</h2>
                            </div>
                            <p className='text-sm text-gray-600 mb-4'>Are you sure you want to delete this sequence? This action cannot be undone.</p>
                            <div className='flex justify-end gap-2'>
                                <button 
                                    type='button' 
                                    onClick={() => toggleDeletePopup(null)}
                                    className='px-3 py-1.5 border border-gray-200 rounded-md text-xs font-normal text-gray-600 hover:bg-gray-50 transition-colors'
                                >
                                    Cancel
                                </button>
                                <button 
                                    type='button' 
                                    onClick={handleDeleteSequence}
                                    disabled={isDeleting}
                                    className='inline-flex items-center px-3 py-1.5 bg-red-600 text-white rounded-md text-xs font-normal hover:bg-red-700 transition-colors disabled:opacity-75'
                                >
                                    {isDeleting ? (
                                        <>
                                            <FaSpinner className="animate-spin w-3 h-3 mr-1.5" />
                                            Deleting...
                                        </>
                                    ) : (
                                        <>
                                            <CiTrash className="w-3 h-3 mr-1.5" />
                                            Delete Sequence
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

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
        </div>
    );
};