import { useEffect, useState } from 'react';
import { supabase } from '../../../utils/supabaseClient';
import { useRouter } from 'next/router';
import { CiCircleChevLeft, CiEdit } from "react-icons/ci";
import { AiOutlineDelete } from "react-icons/ai";
import { NavBarComponent } from '../../../../components/NavBarComponent';
import { NotificationComponent } from '../../../../components/NotificationComponent';

export default function ContactDetails() {

  const router = useRouter();

  useEffect(() => {
    async function checkUser() {
      // Vérifiez si un utilisateur est connecté
      const user = await supabase.auth?.getUser(); // Utilisez user() pour obtenir l'utilisateur actuel
      console.log(user.data.user);
      if (!user.data.user) {
        router.push('/sign-in');
      }
    }

    checkUser();
  }, [router]); // Ajoutez router comme dépendance de useEffect


    const { listId, contactId } = router.query;
    const [contactDetails, setContactDetails] = useState(null);
    const [notification, setNotification] = useState(null);

    useEffect(() => {
      const fetchContactDetails = async () => {
        if (contactId) {
          const { data, error } = await supabase
            .from('contacts')
            .select('first_name, last_name, phone_number, amount_due, currency, due_date, context, status')
            .eq('id', contactId)
            .single();
  
          if (error) {
            console.error('Error fetching contact details', error);
          } else {
            setContactDetails(data);
          }
        }
      };
  
      fetchContactDetails();
    }, [contactId]);

    const handleUpdateContact = async (e) => {
      e.preventDefault();
      if (contactId && contactDetails) {
        // Check for duplicate phone number
        const { data: existingContacts, error: fetchError } = await supabase
          .from('contacts')
          .select('phone_number')
          .eq('list_id', listId)
          .eq('is_deleted', false)
          .neq('id', contactId); // Exclude current contact

        if (fetchError) {
          console.error('Error fetching existing contacts', fetchError);
          setNotification({
            type: 'error',
            message: 'Error checking for duplicate phone numbers'
          });
          return;
        }

        const phoneNumberExists = existingContacts.some(contact => contact.phone_number === contactDetails.phone_number);

        if (phoneNumberExists) {
          setNotification({
            type: 'error',
            message: 'Phone number already exists in another contact'
          });
          return;
        }

        const { error } = await supabase
          .from('contacts')
          .update(contactDetails)
          .eq('id', contactId);

        if (error) {
          console.error('Error updating contact details', error);
          setNotification({
            type: 'error',
            message: 'Error updating contact details'
          });
        } else {
          setNotification({
            type: 'success',
            message: 'Contact details updated successfully'
          });
        }
      }
    };

    if (!contactDetails) return <p>Loading...</p>;

    return(
        <div className='flex h-screen'>
            {notification && (
                <NotificationComponent
                    type={notification.type}
                    message={notification.message}
                    onClose={() => setNotification(null)}
                />
            )}
            <div className='sticky top-0 h-screen'>
                <NavBarComponent />
            </div>
            <div className='flex-1 overflow-y-auto bg-gray-50'>
                <div className='max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6'>
                    <div className='flex items-center gap-3 mb-6'>
                        <button onClick={() => router.push(`/lists/${listId}`)} className="text-gray-400 hover:text-gray-600">
                            <CiCircleChevLeft className="w-5 h-5" />
                        </button>
                        <h1 className='text-lg font-medium text-gray-900'>Edit Contact</h1>
                    </div>

                    <div className='grid grid-cols-3 gap-6'>
                        <div className='col-span-2'>
                            <form onSubmit={handleUpdateContact} className='space-y-4'>
                                <div className='bg-white rounded-md border border-gray-200 p-4'>
                                    <h2 className='text-sm font-medium text-gray-900 mb-4'>Basic Information</h2>
                                    <div className='grid grid-cols-2 gap-4'>
                                        <div>
                                            <label className='block text-xs font-normal text-gray-700 mb-1'>First Name</label>
                                            <input 
                                                type="text"
                                                value={contactDetails.first_name}
                                                onChange={(e) => setContactDetails({...contactDetails, first_name: e.target.value})}
                                                className='w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-1 focus:ring-black focus:border-black transition-all duration-200'
                                            />
                                        </div>
                                        <div>
                                            <label className='block text-xs font-normal text-gray-700 mb-1'>Last Name</label>
                                            <input 
                                                type="text"
                                                value={contactDetails.last_name}
                                                onChange={(e) => setContactDetails({...contactDetails, last_name: e.target.value})}
                                                className='w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-1 focus:ring-black focus:border-black transition-all duration-200'
                                            />
                                        </div>
                                    </div>
                                    <div className='mt-4'>
                                        <label className='block text-xs font-normal text-gray-700 mb-1'>Phone Number</label>
                                        <input 
                                            type="text"
                                            value={contactDetails.phone_number}
                                            onChange={(e) => setContactDetails({...contactDetails, phone_number: e.target.value})}
                                            className='w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-1 focus:ring-black focus:border-black transition-all duration-200'
                                        />
                                    </div>
                                </div>

                                <div className='bg-white rounded-md border border-gray-200 p-4'>
                                    <h2 className='text-sm font-medium text-gray-900 mb-4'>Payment Details</h2>
                                    <div className='grid grid-cols-2 gap-4'>
                                        <div>
                                            <label className='block text-xs font-normal text-gray-700 mb-1'>Amount Due</label>
                                            <input 
                                                type="number"
                                                value={contactDetails.amount_due}
                                                onChange={(e) => setContactDetails({...contactDetails, amount_due: e.target.value})}
                                                className='w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-1 focus:ring-black focus:border-black transition-all duration-200'
                                            />
                                        </div>
                                        <div>
                                            <label className='block text-xs font-normal text-gray-700 mb-1'>Currency</label>
                                            <input 
                                                type="text"
                                                value={contactDetails.currency}
                                                onChange={(e) => setContactDetails({...contactDetails, currency: e.target.value})}
                                                className='w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-1 focus:ring-black focus:border-black transition-all duration-200'
                                            />
                                        </div>
                                    </div>
                                    <div className='mt-4'>
                                        <label className='block text-xs font-normal text-gray-700 mb-1'>Due Date</label>
                                        <input 
                                            type="date"
                                            value={contactDetails.due_date}
                                            onChange={(e) => setContactDetails({...contactDetails, due_date: e.target.value})}
                                            className='w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-1 focus:ring-black focus:border-black transition-all duration-200'
                                        />
                                    </div>
                                </div>

                                <div className='bg-white rounded-md border border-gray-200 p-4'>
                                    <h2 className='text-sm font-medium text-gray-900 mb-4'>Additional Information</h2>
                                    <div>
                                        <label className='block text-xs font-normal text-gray-700 mb-1'>Context</label>
                                        <textarea 
                                            value={contactDetails.context}
                                            onChange={(e) => setContactDetails({...contactDetails, context: e.target.value})}
                                            className='w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-1 focus:ring-black focus:border-black transition-all duration-200'
                                            rows={3}
                                        />
                                    </div>
                                </div>

                                <button 
                                    type="submit" 
                                    className="w-full inline-flex items-center justify-center px-3 py-2 bg-black text-white text-sm font-normal rounded-md hover:bg-gray-800 transition-all duration-200"
                                >
                                    Save Changes
                                </button>
                            </form>
                        </div>

                        <div className='col-span-1'>
                            <div className='bg-white rounded-md border border-gray-200 p-4 sticky top-6'>
                                <h2 className='text-sm font-medium text-gray-900 mb-4'>Contact Overview</h2>
                                <div className='space-y-4'>
                                    <div className='grid grid-cols-2 gap-4'>
                                        <div>
                                            <p className='text-xs text-gray-500 mb-1'>First Name</p>
                                            <p className='text-sm text-gray-900'>{contactDetails.first_name}</p>
                                        </div>
                                        <div>
                                            <p className='text-xs text-gray-500 mb-1'>Last Name</p>
                                            <p className='text-sm text-gray-900'>{contactDetails.last_name}</p>
                                        </div>
                                    </div>
                                    <div>
                                        <p className='text-xs text-gray-500 mb-1'>Phone Number</p>
                                        <p className='text-sm text-gray-900'>{contactDetails.phone_number}</p>
                                    </div>
                                    <div className='grid grid-cols-2 gap-4'>
                                        <div>
                                            <p className='text-xs text-gray-500 mb-1'>Amount Due</p>
                                            <p className='text-sm text-gray-900'>{contactDetails.amount_due} {contactDetails.currency}</p>
                                        </div>
                                        <div>
                                            <p className='text-xs text-gray-500 mb-1'>Due Date</p>
                                            <p className='text-sm text-gray-900'>{contactDetails.due_date}</p>
                                        </div>
                                    </div>
                                    <div>
                                        <p className='text-xs text-gray-500 mb-1'>Context</p>
                                        <p className='text-sm text-gray-900'>{contactDetails.context}</p>
                                    </div>
                                    <div>
                                        <p className='text-xs text-gray-500 mb-1'>Status</p>
                                        <p className='text-sm text-gray-900'>{contactDetails.status}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}