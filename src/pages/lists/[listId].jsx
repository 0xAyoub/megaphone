import { useEffect, useState } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { useRouter } from 'next/router';
import { CiCircleChevLeft, CiEdit } from "react-icons/ci";
import { AiOutlineDelete } from "react-icons/ai";
import { NavBarComponent } from '../../../components/NavBarComponent';
import { NotificationComponent } from '../../../components/NotificationComponent';
import Link from 'next/link';

export default function ListDetails() {
    const router = useRouter();
    const { listId } = router.query;
    const [listDetails, setListDetails] = useState(null);
    const [showPopup, setShowPopup] = useState(false);
    const [showImportPopup, setShowImportPopup] = useState(false);
    const [showDeleteContactPopup, setShowDeleteContactPopup] = useState(false);
    const [contactToDelete, setContactToDelete] = useState(null);
    const [importFormData, setImportFormData] = useState({
        firstName: '',
        lastName: '',
        phoneNumber: '',
        amountDue: '',
        context: '',
        dueDate: '',
    });
    const [contacts, setContacts] = useState([]);
    const [notification, setNotification] = useState(null);
    
    const validatePhoneNumber = (phoneNumber) => {
        const phoneRegex = /^\+?[1-9]\d{1,14}$/;
        return phoneRegex.test(phoneNumber);
    };

    useEffect(() => {
      const fetchListDetails = async () => {
        if (listId) { // Ensure listId is not undefined
          const { data, error } = await supabase
            .from('lists')
            .select('*')
            .eq('id', listId)
            .eq('is_deleted', false)
            .single();
  
          if (error) {
            console.error('Error fetching list details', error);
          } else {
            setListDetails(data);
          }
        }
      };
  
      fetchListDetails();
    }, [listId]);

    useEffect(() => {
      const fetchContacts = async () => {
        if (listId) { // Ensure listId is not undefined
          const { data, error } = await supabase
            .from('contacts')
            .select('*')
            .eq('list_id', listId)
            .eq('is_deleted', false);
  
          if (error) {
            console.error('Error fetching contacts', error);
          } else {
            setContacts(data);
          }
        }
      };
  
      fetchContacts();
    }, [listId]);
  
    const handleDelete = async () => {
        const { error } = await supabase
            .from('lists')
            .delete()
            .eq('id', listId);
        if (error) {
            console.error('Error deleting list', error);
        } else {
            router.push('/yourlists');
        }
    };

    const handleDeleteContact = async () => {
        if (!contactToDelete) return;

        const { error } = await supabase
            .from('contacts')
            .update({ is_deleted: true, deleted_at: new Date() })
            .eq('id', contactToDelete);

        if (error) {
            console.error('Error deleting contact', error);
        } else {
            setShowDeleteContactPopup(false);
            setContactToDelete(null);
            // Refresh contacts list to exclude the deleted one
            const { data, error: fetchError } = await supabase
                .from('contacts')
                .select('*')
                .eq('list_id', listId)
                .eq('is_deleted', false);
            if (fetchError) {
                console.error('Error fetching contacts', fetchError);
            } else {
                setContacts(data);
            }
        }
    };

    const handleImport = async (e) => {
        e.preventDefault();
        if (!validatePhoneNumber(importFormData.phoneNumber)) {
            setNotification({
                type: 'error',
                message: 'Invalid phone number. Please enter a valid phone number.'
            });
            return;
        }
        if (importFormData.amountDue <= 0) {
            setNotification({
                type: 'error',
                message: 'Amount due must be greater than 0.'
            });
            return;
        }
        // Check if the phone number already exists in the list
        const { data: existingContacts, error: fetchError } = await supabase
            .from('contacts')
            .select('phone_number')
            .eq('phone_number', importFormData.phoneNumber)
            .eq('list_id', listId)
            .eq('is_deleted', false);
        
        if (fetchError) {
            console.error('Error checking existing contacts', fetchError);
            return;
        }
        
        if (existingContacts.length > 0) {
            setNotification({
                type: 'error',
                message: 'This phone number has already been imported into this list.'
            });
            return;
        }

        const { error } = await supabase
            .from('contacts')
            .insert([
                {
                    list_id: listId,
                    first_name: importFormData.firstName,
                    last_name: importFormData.lastName,
                    phone_number: importFormData.phoneNumber,
                    amount_due: importFormData.amountDue,
                    context: importFormData.context,
                    due_date: importFormData.dueDate,
                },
            ]);
        if (error) {
            console.error('Error importing contact', error);
            setNotification({
                type: 'error',
                message: 'Error importing contact'
            });
        } else {
            // Refresh contacts after importing a new one
            const { data: updatedContacts, error: fetchError } = await supabase
                .from('contacts')
                .select('*')
                .eq('list_id', listId)
                .eq('is_deleted', false);

            if (fetchError) {
                console.error('Error fetching updated contacts', fetchError);
            } else {
                setContacts(updatedContacts);
            }

            setNotification({
                type: 'success',
                message: 'Contact imported successfully'
            });
            setShowImportPopup(false);
            setImportFormData({
                firstName: '',
                lastName: '',
                phoneNumber: '',
                amountDue: '',
                context: '',
                dueDate: '',
            });
        }
    };

    if (!listDetails) return <p>Loading...</p>;

    return(
        <div className='flex h-screen bg-gray-50'>
            <NavBarComponent />
            <div className='flex-1 overflow-hidden'>
                <div className='max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6'>
                    <div className='flex justify-between items-center mb-6'>
                        <div className='flex items-center gap-3'>
                            <Link href="/yourlists" className="text-gray-400 hover:text-gray-600">
                                <CiCircleChevLeft className="w-5 h-5" />
                            </Link>
                            <div>
                                <h1 className='text-lg font-medium text-gray-900'>{listDetails.name}</h1>
                                <p className='text-sm text-gray-500'>{listDetails.description}</p>
                            </div>
                        </div>
                        <div className='flex items-center space-x-2'>
                            <button 
                                onClick={() => setShowPopup(true)} 
                                className="inline-flex items-center px-2 py-1 rounded-md border border-gray-200 text-xs font-normal text-gray-600 hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-colors"
                            >
                                <AiOutlineDelete className="w-3 h-3" />
                            </button>
                            <button 
                                onClick={() => setShowImportPopup(true)} 
                                className="inline-flex items-center px-3 py-1.5 bg-black text-white text-xs font-normal rounded-md hover:bg-gray-800 transition-all duration-200"
                            >
                                Import
                            </button>
                        </div>
                    </div>

                    <div className='bg-white rounded-md border border-gray-200'>
                        <div className='overflow-x-auto'>
                            <table className='min-w-full divide-y divide-gray-200'>
                                <thead className='bg-gray-50'>
                                    <tr>
                                        <th scope="col" className='px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>First Name</th>
                                        <th scope="col" className='px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>Last Name</th>
                                        <th scope="col" className='px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>Phone Number</th>
                                        <th scope="col" className='px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>Amount Due</th>
                                        <th scope="col" className='px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>Currency</th>
                                        <th scope="col" className='px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>Due Date</th>
                                        <th scope="col" className='px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>Status</th>
                                        <th scope="col" className='px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>Last Interaction</th>
                                        <th scope="col" className='px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>Context</th>
                                        <th scope="col" className='px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>Actions</th>
                                    </tr>
                                </thead>
                                <tbody className='bg-white divide-y divide-gray-200'>
                                    {contacts.map((contact, index) => (
                                        <tr key={index} className='hover:bg-gray-50'>
                                            <td className='px-3 py-2 whitespace-nowrap text-xs text-gray-900'>{contact.first_name}</td>
                                            <td className='px-3 py-2 whitespace-nowrap text-xs text-gray-900'>{contact.last_name}</td>
                                            <td className='px-3 py-2 whitespace-nowrap text-xs text-gray-900'>{contact.phone_number}</td>
                                            <td className='px-3 py-2 whitespace-nowrap text-xs text-gray-900'>{contact.amount_due}</td>
                                            <td className='px-3 py-2 whitespace-nowrap text-xs text-gray-900'>{contact.currency}</td>
                                            <td className='px-3 py-2 whitespace-nowrap text-xs text-gray-900'>{contact.due_date}</td>
                                            <td className='px-3 py-2 whitespace-nowrap text-xs text-gray-900'>{contact.status}</td>
                                            <td className='px-3 py-2 whitespace-nowrap text-xs'>
                                                {contact.last_interaction ? (
                                                    <span className='text-gray-900'>{contact.last_interaction}</span>
                                                ) : (
                                                    <span className='inline-flex items-center px-2 py-0.5 rounded-md text-xs font-normal bg-red-50 text-red-600'>
                                                        Never contacted
                                                    </span>
                                                )}
                                            </td>
                                            <td className='px-3 py-2 whitespace-nowrap text-xs text-gray-900 max-w-[100px] overflow-hidden overflow-ellipsis'>
                                                {contact.context}
                                            </td>
                                            <td className='px-3 py-2 whitespace-nowrap'>
                                                <div className='flex items-center space-x-2'>
                                                    <button 
                                                        onClick={() => router.push(`/lists/${listId}/${contact.id}`)}
                                                        className='inline-flex items-center p-1 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors'
                                                    >
                                                        <CiEdit className="w-3 h-3" />
                                                    </button>
                                                    <button 
                                                        onClick={() => {
                                                            setContactToDelete(contact.id);
                                                            setShowDeleteContactPopup(true);
                                                        }}
                                                        className='inline-flex items-center p-1 rounded-md border border-gray-200 text-gray-600 hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-colors'
                                                    >
                                                        <AiOutlineDelete className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* Delete List Modal */}
            {showPopup && (
                <div className='fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 p-4'>
                    <div className='bg-white rounded-md shadow-lg max-w-md w-full'>
                        <div className='p-4'>
                            <div className='flex items-center gap-2 text-red-600 mb-3'>
                                <AiOutlineDelete className="w-4 h-4" />
                                <h2 className='text-base font-medium'>Delete List</h2>
                            </div>
                            <p className='text-sm text-gray-600 mb-4'>Are you sure you want to delete this list? This action cannot be undone.</p>
                            <div className='flex justify-end gap-2'>
                                <button 
                                    onClick={() => setShowPopup(false)} 
                                    className='px-3 py-1.5 border border-gray-200 rounded-md text-xs font-normal text-gray-600 hover:bg-gray-50 transition-colors'
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={handleDelete} 
                                    className='inline-flex items-center px-3 py-1.5 bg-red-600 text-white rounded-md text-xs font-normal hover:bg-red-700 transition-colors'
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Import Contact Modal */}
            {showImportPopup && (
                <div className='fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 p-4'>
                    <div className='bg-white rounded-md shadow-lg max-w-md w-full'>
                        <div className='p-4'>
                            <h2 className='text-base font-medium text-gray-900 mb-4'>Import Contact</h2>
                            <form onSubmit={handleImport} className='space-y-4'>
                                <div className='grid grid-cols-2 gap-3'>
                                    <div>
                                        <label className='block text-xs font-normal text-gray-700 mb-1'>First Name</label>
                                        <input
                                            type='text'
                                            value={importFormData.firstName}
                                            onChange={(e) => setImportFormData({ ...importFormData, firstName: e.target.value })}
                                            className='w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-1 focus:ring-black focus:border-black transition-all duration-200'
                                            placeholder="John"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className='block text-xs font-normal text-gray-700 mb-1'>Last Name</label>
                                        <input
                                            type='text'
                                            value={importFormData.lastName}
                                            onChange={(e) => setImportFormData({ ...importFormData, lastName: e.target.value })}
                                            className='w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-1 focus:ring-black focus:border-black transition-all duration-200'
                                            placeholder="Doe"
                                            required
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className='block text-xs font-normal text-gray-700 mb-1'>Phone Number</label>
                                    <input
                                        type='text'
                                        value={importFormData.phoneNumber}
                                        onChange={(e) => setImportFormData({ ...importFormData, phoneNumber: e.target.value })}
                                        className='w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-1 focus:ring-black focus:border-black transition-all duration-200'
                                        placeholder="+19091234567"
                                        required
                                    />
                                </div>
                                <div className='grid grid-cols-2 gap-3'>
                                    <div>
                                        <label className='block text-xs font-normal text-gray-700 mb-1'>Amount Due</label>
                                        <input
                                            type='number'
                                            value={importFormData.amountDue}
                                            onChange={(e) => setImportFormData({ ...importFormData, amountDue: e.target.value })}
                                            className='w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-1 focus:ring-black focus:border-black transition-all duration-200'
                                            placeholder="100"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className='block text-xs font-normal text-gray-700 mb-1'>Due Date</label>
                                        <input
                                            type='date'
                                            value={importFormData.dueDate}
                                            onChange={(e) => setImportFormData({ ...importFormData, dueDate: e.target.value })}
                                            className='w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-1 focus:ring-black focus:border-black transition-all duration-200'
                                            required
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className='block text-xs font-normal text-gray-700 mb-1'>Context</label>
                                    <textarea
                                        value={importFormData.context}
                                        onChange={(e) => setImportFormData({ ...importFormData, context: e.target.value })}
                                        className='w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-1 focus:ring-black focus:border-black transition-all duration-200'
                                        rows={3}
                                        placeholder="Add the maximum amount of context about the contact"
                                    />
                                </div>
                                <div className='flex justify-end gap-2'>
                                    <button 
                                        type='button' 
                                        onClick={() => setShowImportPopup(false)} 
                                        className='px-3 py-1.5 border border-gray-200 rounded-md text-xs font-normal text-gray-600 hover:bg-gray-50 transition-colors'
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        type='submit' 
                                        className='inline-flex items-center px-3 py-1.5 bg-black text-white rounded-md text-xs font-normal hover:bg-gray-800 transition-colors'
                                    >
                                        Import
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Contact Modal */}
            {showDeleteContactPopup && (
                <div className='fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 p-4'>
                    <div className='bg-white rounded-md shadow-lg max-w-md w-full'>
                        <div className='p-4'>
                            <div className='flex items-center gap-2 text-red-600 mb-3'>
                                <AiOutlineDelete className="w-4 h-4" />
                                <h2 className='text-base font-medium'>Delete Contact</h2>
                            </div>
                            <p className='text-sm text-gray-600 mb-4'>Are you sure you want to delete this contact? This action cannot be undone.</p>
                            <div className='flex justify-end gap-2'>
                                <button 
                                    onClick={() => setShowDeleteContactPopup(false)} 
                                    className='px-3 py-1.5 border border-gray-200 rounded-md text-xs font-normal text-gray-600 hover:bg-gray-50 transition-colors'
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={handleDeleteContact} 
                                    className='inline-flex items-center px-3 py-1.5 bg-red-600 text-white rounded-md text-xs font-normal hover:bg-red-700 transition-colors'
                                >
                                    Delete
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
        </div>
    );
}