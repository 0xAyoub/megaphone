import { useState, useEffect } from 'react';
import { NavBarComponent } from './NavBarComponent';
import { supabase } from '../src/utils/supabaseClient';
import { FaPlus, FaSpinner, FaTrash, FaPen, FaList, FaExclamationTriangle } from 'react-icons/fa';

export const YourListsComponent = () => {
    const [lists, setLists] = useState([]);
    const [showPopup, setShowPopup] = useState(false);
    const [showDeletePopup, setShowDeletePopup] = useState(false);
    const [listToDelete, setListToDelete] = useState(null);
    const [listName, setListName] = useState('');
    const [listDescription, setListDescription] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const getUserId = async () => {
        const { data, error } = await supabase.auth.getUser();
        if (error) {
            console.error('Error fetching user:', error);
            return null;
        }
        return data.user.id;
    };

    // Toggle the visibility of the create list popup
    const togglePopup = () => {
        setShowPopup(!showPopup);
        if (!showPopup) {
            setListName('');
            setListDescription('');
        }
    };

    // Toggle the visibility of the delete confirmation popup
    const toggleDeletePopup = (listId) => {
        setListToDelete(listId);
        setShowDeletePopup(!showDeletePopup);
    };

    // Handle the creation of a new list
    const handleCreateList = async (e) => {
        e.preventDefault();
        setIsCreating(true);
        try {
            const userId = await getUserId();
            if (!userId) {
                console.error('User ID not found');
                return;
            }
            const { data, error } = await supabase
                .from('lists')
                .insert([{ name: listName, description: listDescription, user_id: userId }]);

            if (error) {
                console.error('Error creating list', error);
            } else {
                // Refresh lists after creating a new one
                const { data: updatedLists, error: fetchError } = await supabase
                    .from('lists')
                    .select('*')
                    .eq('user_id', userId)
                    .eq('is_deleted', false);

                if (fetchError) {
                    console.error('Error fetching updated lists', fetchError);
                } else {
                    setLists(updatedLists);
                }

                setListName('');
                setListDescription('');
                togglePopup();
            }
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setIsCreating(false);
        }
    };

    // Handle the deletion of a list
    const handleDeleteList = async () => {
        if (!listToDelete) return;
        setIsDeleting(true);
        try {
            // First, mark all associated contacts as deleted
            await handleDeleteContacts(listToDelete);

            // Then, mark the list as deleted
            const { error } = await supabase
                .from('lists')
                .update({ is_deleted: true, deleted_at: new Date() })
                .eq('id', listToDelete);

            if (error) {
                console.error('Error deleting list', error);
            } else {
                setLists(lists.filter(list => list.id !== listToDelete));
                setListToDelete(null);
                toggleDeletePopup();
            }
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setIsDeleting(false);
        }
    };

    // Handle the deletion of contacts associated with a list
    const handleDeleteContacts = async (listId) => {
        const { error } = await supabase
            .from('contacts')
            .update({ is_deleted: true, deleted_at: new Date() })
            .eq('list_id', listId);

        if (error) {
            console.error('Error deleting contacts', error);
        }
    };

    // Fetch lists from the database
    useEffect(() => {
        const fetchLists = async () => {
            setIsLoading(true);
            try {
                const userId = await getUserId();
                if (userId) {
                    const { data, error } = await supabase
                        .from('lists')
                        .select('*')
                        .eq('user_id', userId)
                        .eq('is_deleted', false);
                    if (error) {
                        console.error('Error fetching lists', error);
                    } else {
                        setLists(data);
                    }
                } else {
                    console.error('User not authenticated');
                }
            } catch (error) {
                console.error('Error:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchLists();
    }, []);

    return (
        <div className='flex h-screen bg-gray-50'>
            <NavBarComponent />
            <div className='flex-1 overflow-hidden'>
                <div className='max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6'>
                    <div className='flex justify-between items-center mb-6'>
                        <h1 className='text-lg font-medium text-gray-900'>Your Lists</h1>
                        <button 
                            onClick={togglePopup} 
                            className="inline-flex items-center px-3 py-1.5 bg-black text-white text-sm font-normal rounded-md hover:bg-gray-800 transition-all duration-200"
                        >
                            <FaPlus className="w-3 h-3 mr-1.5" />
                            New List
                        </button>
                    </div>

                    {isLoading ? (
                        <div className='flex justify-center items-center h-64'>
                            <FaSpinner className="animate-spin text-xl text-gray-400" />
                        </div>
                    ) : (
                        <div className='space-y-2'>
                            {lists.length === 0 ? (
                                <div className='text-center py-8 bg-white rounded-md border border-gray-200'>
                                    <FaList className="mx-auto h-6 w-6 text-gray-300 mb-2" />
                                    <p className='text-gray-500 text-sm'>No lists yet. Create your first list to get started!</p>
                                </div>
                            ) : (
                                lists.map((list, index) => (
                                    <div 
                                        key={index} 
                                        className='bg-white border border-gray-200 rounded-md p-3 hover:border-gray-300 transition-all duration-200'
                                    >
                                        <div className='flex justify-between items-start'>
                                            <div>
                                                <h2 className='text-sm font-medium text-gray-900'>{list.name}</h2>
                                                <p className='text-xs text-gray-500 mt-0.5'>{list.description}</p>
                                            </div>
                                            <div className='flex items-center space-x-2'>
                                                <a 
                                                    href={`/lists/${list.id}`} 
                                                    className='inline-flex items-center px-2.5 py-1.5 rounded-md border border-gray-200 text-xs font-normal text-gray-600 hover:bg-gray-50 transition-colors'
                                                >
                                                    <FaPen className="w-3 h-3 mr-1.5" />
                                                    Edit
                                                </a>
                                                <button 
                                                    onClick={() => toggleDeletePopup(list.id)}
                                                    className='inline-flex items-center px-2.5 py-1.5 rounded-md border border-gray-200 text-xs font-normal text-gray-600 hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-colors'
                                                >
                                                    <FaTrash className="w-3 h-3 mr-1.5" />
                                                    Delete
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

            {/* Create List Modal */}
            {showPopup && (
                <div className='fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 p-4'>
                    <div className='bg-white rounded-md shadow-lg max-w-md w-full'>
                        <div className='p-4'>
                            <h2 className='text-base font-medium text-gray-900 mb-4'>Create a New List</h2>
                            <form onSubmit={handleCreateList} className='space-y-4'>
                                <div>
                                    <label className='block text-xs font-normal text-gray-700 mb-1'>Name</label>
                                    <input
                                        type='text'
                                        value={listName}
                                        onChange={(e) => setListName(e.target.value)}
                                        className='w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-1 focus:ring-black focus:border-black transition-all duration-200'
                                        required
                                    />
                                </div>
                                <div>
                                    <label className='block text-xs font-normal text-gray-700 mb-1'>Description</label>
                                    <input
                                        type='text'
                                        value={listDescription}
                                        onChange={(e) => setListDescription(e.target.value)}
                                        className='w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-1 focus:ring-black focus:border-black transition-all duration-200'
                                        required
                                    />
                                </div>
                                <div className='flex justify-end gap-2 pt-2'>
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
                                                <FaPlus className="w-3 h-3 mr-1.5" />
                                                Create List
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
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
                                <FaExclamationTriangle className="w-4 h-4" />
                                <h2 className='text-base font-medium'>Confirm Deletion</h2>
                            </div>
                            <p className='text-sm text-gray-600 mb-4'>Are you sure you want to delete this list? This action cannot be undone.</p>
                            <div className='flex justify-end gap-2'>
                                <button 
                                    type='button' 
                                    onClick={toggleDeletePopup}
                                    className='px-3 py-1.5 border border-gray-200 rounded-md text-xs font-normal text-gray-600 hover:bg-gray-50 transition-colors'
                                >
                                    Cancel
                                </button>
                                <button 
                                    type='button' 
                                    onClick={handleDeleteList}
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
                                            <FaTrash className="w-3 h-3 mr-1.5" />
                                            Delete List
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}